-- Planning boutique : base de données des pointages (à coller dans Supabase → SQL Editor → Run)
-- Personne n'accède directement aux tables : tout passe par les fonctions ci-dessous,
-- qui exigent le code d'équipe (patron) ou le jeton personnel (salarié).

create table if not exists pt_employes (
  equipe text not null,
  nom    text not null,
  jeton  text not null unique default replace(gen_random_uuid()::text, '-', ''),
  primary key (equipe, nom)
);

create table if not exists pt_pointages (
  equipe      text not null,
  nom         text not null,
  jour        date not null,
  arrivee     text,
  debut_pause text,
  fin_pause   text,
  depart      text,
  maj         timestamptz not null default now(),
  primary key (equipe, nom, jour)
);

alter table pt_employes  enable row level security;
alter table pt_pointages enable row level security;
revoke all on pt_employes, pt_pointages from anon, authenticated;

-- Patron : crée (ou retrouve) le jeton d'un salarié
create or replace function pt_equipe_employe(p_equipe text, p_nom text)
returns text language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if length(coalesce(p_equipe, '')) < 16 then raise exception 'code equipe invalide'; end if;
  if length(trim(coalesce(p_nom, ''))) = 0 then raise exception 'nom manquant'; end if;
  insert into pt_employes (equipe, nom) values (p_equipe, trim(p_nom)) on conflict (equipe, nom) do nothing;
  select jeton into t from pt_employes where equipe = p_equipe and nom = trim(p_nom);
  return t;
end $$;

-- Patron : lit les pointages d'un mois ("2026-11") pour toute l'équipe
create or replace function pt_equipe_lire(p_equipe text, p_mois text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d1 date; d2 date;
begin
  if length(coalesce(p_equipe, '')) < 16 then raise exception 'code equipe invalide'; end if;
  d1 := (p_mois || '-01')::date;
  d2 := (d1 + interval '1 month')::date;
  return jsonb_build_object(
    'employes', coalesce((select jsonb_agg(nom order by nom) from pt_employes where equipe = p_equipe), '[]'::jsonb),
    'pointages', coalesce((
      select jsonb_agg(jsonb_build_object('nom', nom, 'jour', jour, 'arrivee', arrivee,
             'debut_pause', debut_pause, 'fin_pause', fin_pause, 'depart', depart) order by nom, jour)
      from pt_pointages where equipe = p_equipe and jour >= d1 and jour < d2), '[]'::jsonb));
end $$;

-- Salarié : enregistre un lot de journées [{jour, arrivee, debut_pause, fin_pause, depart}, ...]
create or replace function pt_enregistrer(p_jeton text, p_lot jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare e pt_employes%rowtype; x jsonb; n integer := 0;
begin
  select * into e from pt_employes where jeton = p_jeton;
  if not found then raise exception 'jeton inconnu'; end if;
  if jsonb_typeof(p_lot) <> 'array' or jsonb_array_length(p_lot) > 70 then raise exception 'lot invalide'; end if;
  for x in select * from jsonb_array_elements(p_lot) loop
    insert into pt_pointages (equipe, nom, jour, arrivee, debut_pause, fin_pause, depart, maj)
    values (e.equipe, e.nom, (x->>'jour')::date,
            nullif(x->>'arrivee', ''), nullif(x->>'debut_pause', ''), nullif(x->>'fin_pause', ''), nullif(x->>'depart', ''), now())
    on conflict (equipe, nom, jour) do update
      set arrivee = excluded.arrivee, debut_pause = excluded.debut_pause,
          fin_pause = excluded.fin_pause, depart = excluded.depart, maj = now();
    n := n + 1;
  end loop;
  return n;
end $$;

-- Salarié : supprime une de ses journées
create or replace function pt_supprimer(p_jeton text, p_jour date)
returns void language plpgsql security definer set search_path = public as $$
declare e pt_employes%rowtype;
begin
  select * into e from pt_employes where jeton = p_jeton;
  if not found then raise exception 'jeton inconnu'; end if;
  delete from pt_pointages where equipe = e.equipe and nom = e.nom and jour = p_jour;
end $$;

-- Salarié : retrouve ses pointages (nouveau téléphone)
create or replace function pt_moi(p_jeton text, p_depuis date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e pt_employes%rowtype;
begin
  select * into e from pt_employes where jeton = p_jeton;
  if not found then raise exception 'jeton inconnu'; end if;
  return jsonb_build_object('nom', e.nom, 'pointages', coalesce((
    select jsonb_agg(jsonb_build_object('jour', jour, 'arrivee', arrivee, 'debut_pause', debut_pause,
           'fin_pause', fin_pause, 'depart', depart) order by jour)
    from pt_pointages where equipe = e.equipe and nom = e.nom and jour >= p_depuis), '[]'::jsonb));
end $$;

grant execute on function pt_equipe_employe(text, text), pt_equipe_lire(text, text),
  pt_enregistrer(text, jsonb), pt_supprimer(text, date), pt_moi(text, date) to anon, authenticated;
