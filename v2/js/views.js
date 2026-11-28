// Écrans : planning (semaines à balayer), extras payés, impression, réglages
import { html, useState, useEffect, useRef, useMemo, useLayoutEffect } from "../vendor/ui.js";
import {
  STATUTS, STATUT, vendeurs, mois as lireMois, lireJour, getReglages, modifierReglages, definirStatut, definirRenforts, definirTarif, definirTarifs, definirNote,
  estValide, totalJour, tarifDe, libelleTarifs, validerPaiement, validerTout, bilanPaiements, ajouterExtraConnu, HORAIRES_DEFAUT, v1Disponible, importerV1,
  reinitialiserNovembre, toutEffacer, rev,
} from "./store.js";
import {
  JOURS, JC, MOIS, MOIS_COURTS, iso, fromISO, addDays, dayIndex, moisDeSemaine, semainesAutour, joursDuMois, estFerie, aujourdhui, mondayOf, moisDe, nomMois, decalerMois, cap,
} from "./dates.js";
import { Icone, Avatar, couleurNom, Feuille, Glisse, useStore } from "./ui-parts.js";
import { toutesLesPages } from "./sheets.js";
import { imprimer, partagerPDF } from "./impression.js";

const prenom = (n) => String(n).trim().split(/\s+/)[0];
const classeAvatar = (i) => `a${i % 4}`;

// ---------- Notifications (toast) ----------
let afficherToast = () => {};
export const toast = (msg, annuler) => afficherToast({ msg, annuler, id: Math.random() });
export function ToastHote() {
  const [t, setT] = useState(null);
  afficherToast = setT;
  useEffect(() => {
    if (!t) return;
    const id = setTimeout(() => setT(null), t.annuler ? 5200 : 3600);
    return () => clearTimeout(id);
  }, [t]);
  if (!t) return null;
  return html`<div class="toast" key=${t.id}><span>${t.msg}</span>${t.annuler ? html`<button onClick=${() => { t.annuler(); setT(null); }}>Annuler</button>` : null}</div>`;
}

// ---------- En-tête ----------
export function Haut({ mois, onMois, onReglages, enfants }) {
  const { nom, annee } = nomMois(mois);
  return html`<header class="haut">
    <div class="haut-ligne">
      <button class="titre-mois" onClick=${onMois} aria-label="Choisir un mois">
        <span class="annee">${annee}</span>
        <span class="nom" key=${mois}>${nom}<${Icone} n="bas" /></span>
      </button>
      <button class="rond" onClick=${onReglages} aria-label="Réglages"><${Icone} n="reglages" /></button>
    </div>
    ${enfants}
  </header>`;
}

// ---------- Planning : une semaine par page, balayage horizontal ----------
function Tuile({ date, v, statut, nom }) {
  const prec = useRef(statut);
  const [vue, setVue] = useState(false);
  useEffect(() => {
    if (prec.current !== statut) {
      prec.current = statut;
      setVue(true);
      const id = setTimeout(() => setVue(false), 450);
      return () => clearTimeout(id);
    }
  }, [statut]);
  const s = statut && STATUT[statut];
  return html`<button class=${`tuile ${s ? `s-${statut}` : "vide"} ${vue ? "vue" : ""}`} data-date=${date} data-col=${v.colonne} data-statut=${statut || ""} aria-label=${`${prenom(v.nom)}, ${date}, ${s ? s.long : "vide"}`}>
    ${s ? html`<${Icone} n=${statut} /><span class="lib">${s.court}</span>` : html`<${Icone} n="plus" />`}
  </button>`;
}

function Renforts({ date, j }) {
  const ex = j.extras || [];
  const ok = ex.length && estValide(j);
  return html`<button class="renforts" data-date=${date} onClick=${() => Planning.ouvrirJour(date, "renforts")} aria-label=${`Renforts du ${date}`}>
    ${ex.length
      ? html`<div class="pile">${ex.slice(0, 3).map((n) => html`<${Avatar} nom=${n} c=${couleurNom(n)} petit />`)}</div>${ex.length > 3 ? html`<span class="plus">+${ex.length - 3}</span>` : null}`
      : html`<span class="ajout"><${Icone} n="plus" /></span>`}
    ${ex.length ? html`<i class=${`pastille-paie ${ok ? "ok" : "attente"}`}></i>` : null}
    ${j.note ? html`<${Icone} n="note" cls="pastille-note" />` : null}
  </button>`;
}

function Semaine({ lundi, vend }) {
  const auj = aujourdhui();
  return html`<div class="page">
    ${Array.from({ length: 7 }, (_, i) => {
      const d = addDays(lundi, i), k = iso(d), j = lireJour(k);
      lireMois(k.slice(0, 7));
      const we = i >= 5;
      return html`<div class=${`ligne-j ${we ? "we" : ""}`}>
        <button class=${`jj ${we ? "we" : ""} ${k === auj ? "auj" : ""}`} onClick=${() => Planning.ouvrirJour(k)} aria-label=${`Jour ${k}`}>
          ${estFerie(d) ? html`<span class="ferie">Férié</span>` : null}
          <span class="nom-j">${JC[i]}</span><span class="num">${d.getDate()}</span>
        </button>
        ${vend.map((v) => html`<${Tuile} date=${k} v=${v} statut=${j[v.colonne]} />`)}
        <${Renforts} date=${k} j=${j} />
      </div>`;
    })}
  </div>`;
}

export function Planning({ ancre, onMois, onActif, onReglages, onPicker, onJour }) {
  useStore();
  Planning.ouvrirJour = onJour;
  const vend = vendeurs();
  const semaines = useMemo(() => semainesAutour(ancre, 8, 8), [ancre]);
  const pager = useRef();
  const [idx, setIdx] = useState(-1);
  const indexDe = (m) => {
    const auj = mondayOf(new Date());
    if (m === moisDe(new Date())) return semaines.findIndex((l) => iso(l) === iso(auj));
    return semaines.findIndex((l) => moisDeSemaine(l) === m);
  };
  useLayoutEffect(() => {
    const el = pager.current;
    const cible = Math.max(0, indexDe(ancre));
    el.style.scrollSnapType = "none";
    el.scrollLeft = cible * el.clientWidth;
    el.style.scrollSnapType = "";
    setIdx(cible);
  }, [ancre]);
  const moisActif = idx >= 0 ? moisDeSemaine(semaines[idx]) : ancre;
  useEffect(() => {
    onActif(moisActif);
  }, [moisActif]);
  const surScroll = (e) => {
    const el = e.currentTarget;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== idx && i >= 0) setIdx(i);
  };
  const aller = (i) => pager.current.scrollTo({ left: i * pager.current.clientWidth, behavior: "smooth" });
  const lundiActif = semaines[Math.max(0, idx)];
  const dimanche = addDays(lundiActif, 6);
  const libelle = lundiActif.getMonth() === dimanche.getMonth()
    ? `${lundiActif.getDate()} – ${dimanche.getDate()} ${MOIS[dimanche.getMonth()]}`
    : `${lundiActif.getDate()} ${MOIS_COURTS[lundiActif.getMonth()]} – ${dimanche.getDate()} ${MOIS_COURTS[dimanche.getMonth()]}`;
  const indicesMois = semaines.map((l, i) => (moisDeSemaine(l) === moisActif ? i : -1)).filter((i) => i >= 0);
  const iAuj = indexDe(moisDe(new Date()));
  const loin = iAuj >= 0 ? idx !== iAuj : true;

  return html`<div class="vue" style=${{ "--n": vend.length }}>
    <${Haut} mois=${moisActif} onMois=${onPicker} onReglages=${onReglages}
      enfants=${html`<div class="semaine-ligne">
        <span class="semaine-nom">${libelle}</span>
        ${loin
          ? html`<button class="aujourdhui" onClick=${() => (iAuj >= 0 && moisDe(new Date()) === ancre ? aller(iAuj) : onMois(moisDe(new Date())))}>Aujourd'hui</button>`
          : html`<div class="points">${indicesMois.map((i) => html`<button class=${`point ${i === idx ? "actif" : ""}`} onClick=${() => aller(i)} aria-label="Semaine"></button>`)}</div>`}
      </div>`} />
    <div class="colonnes">
      <span></span>
      ${vend.map((v, i) => html`<div class="col-tete"><${Avatar} nom=${v.nom} c=${classeAvatar(i)} /><span>${prenom(v.nom)}</span></div>`)}
      <div class="col-tete extras"><span>Renforts</span></div>
    </div>
    <div class="pager" ref=${pager} onScroll=${surScroll}>
      ${semaines.map((l, i) => (Math.abs(i - idx) <= 1 ? html`<${Semaine} key=${iso(l)} lundi=${l} vend=${vend} />` : html`<div class="page" key=${iso(l)}></div>`))}
    </div>
  </div>`;
}

// ---------- Feuille d'un jour : renforts, paiement, note ----------
export function FeuilleJour({ date, onClose }) {
  useStore();
  const j = lireJour(date);
  const d = fromISO(date);
  const ex = j.extras || [];
  const reg = getReglages();
  const [nouveau, setNouveau] = useState(null);
  const tous = [...new Set([...reg.extras, ...ex])];
  const bascule = (n) => {
    const liste = ex.includes(n) ? ex.filter((x) => x !== n) : [...ex, n];
    const annuler = definirRenforts(date, liste);
    toast(`${n} ${ex.includes(n) ? "retiré(e)" : "ajouté(e)"} le ${d.getDate()}`, annuler);
  };
  const ajouter = () => {
    const n = (nouveau || "").trim();
    if (n) {
      ajouterExtraConnu(n);
      definirRenforts(date, [...ex, n]);
    }
    setNouveau(null);
  };
  const ok = ex.length && estValide(j);
  const idees = ["Acompte 100 €", "Acompte 50 €", "Retard", "Absent prévenu", "Extra payé 60 €"];
  const [note, setNote] = useState(j.note || "");
  const enregistrerNote = () => {
    if ((j.note || "") !== note.trim()) definirNote(date, note);
  };
  return html`<${Feuille} titre=${`${JOURS[dayIndex(d)]} ${d.getDate()}`} sous=${`${cap(MOIS[d.getMonth()])} ${d.getFullYear()}${estFerie(d) ? " · jour férié" : ""}`} onClose=${() => { enregistrerNote(); onClose(); }}>
    <div class="bloc">
      <p class="bloc-titre">Renforts du jour</p>
      <div class="puces">
        ${tous.map((n) => html`<button class=${`puce ${ex.includes(n) ? "on" : ""}`} onClick=${() => bascule(n)}><${Avatar} nom=${n} c=${couleurNom(n)} petit />${n}</button>`)}
        ${nouveau === null
          ? html`<button class="puce nouveau" onClick=${() => setNouveau("")}>+ Autre prénom</button>`
          : html`<span class="puce" style=${{ paddingLeft: "14px" }}><input autofocus class="note-champ" style=${{ padding: "4px 8px", width: "130px", borderRadius: "10px" }} placeholder="Prénom" value=${nouveau} onInput=${(e) => setNouveau(e.target.value)} onKeyDown=${(e) => e.key === "Enter" && ajouter()} /><button onClick=${ajouter} style=${{ color: "var(--accent)", fontWeight: 800 }}>OK</button></span>`}
      </div>
    </div>
    ${ex.length
      ? html`<div class="bloc">
          <p class="bloc-titre">Paiement des extras</p>
          <div class="rapides"><button onClick=${() => definirTarifs(date, reg.tarifExtra)}>Tout à ${reg.tarifExtra} €</button><button onClick=${() => definirTarifs(date, 60)}>Tout à 60 €</button></div>
          ${ex.map((n) => html`<div class="ligne-paie"><${Avatar} nom=${n} c=${couleurNom(n)} petit /><span class="qui">${n}</span>
            <button class="pas" onClick=${() => definirTarif(date, n, tarifDe(j, n) - 10)} aria-label="Moins 10 euros">−</button>
            <span class="montant">${tarifDe(j, n)} €</span>
            <button class="pas" onClick=${() => definirTarif(date, n, tarifDe(j, n) + 10)} aria-label="Plus 10 euros">+</button></div>`)}
          <div class="total-ligne"><span>Total du jour</span><b>${totalJour(j)} €</b></div>
          ${ok
            ? html`<div class="verif" style=${{ marginTop: "12px", justifyContent: "space-between", width: "100%" }}><span style=${{ display: "inline-flex", gap: "8px", alignItems: "center" }}><i><${Icone} n="travail" /></i>Paiement validé</span><button style=${{ color: "var(--accent)", fontWeight: 750 }} onClick=${() => validerPaiement(date, false)}>Remettre à valider</button></div>`
            : html`<${Glisse} texte="Glisser pour valider" icone="fleche" type="valide" onDone=${() => { const a = validerPaiement(date, true); toast(`Paiement du ${d.getDate()} validé`, a); }} relache=${900} />`}
        </div>`
      : null}
    <div class="bloc">
      <p class="bloc-titre">Commentaire du jour</p>
      <div class="idees">${idees.map((t) => html`<button onClick=${() => setNote(note.trim() ? `${note.trim()} · ${t}` : t)}>${t}</button>`)}</div>
      <textarea class="note-champ" rows="3" placeholder="Acompte, retard, remarque…" value=${note} onInput=${(e) => setNote(e.target.value)} onBlur=${enregistrerNote}></textarea>
    </div>
  <//>`;
}

// ---------- Extras payés ----------
function RangExtra({ date, j, onOuvrir }) {
  const ref = useRef();
  const g = useRef(null);
  const d = fromISO(date);
  const ok = estValide(j);
  const debut = (e) => {
    if (ok) return;
    g.current = { x: e.clientX, y: e.clientY, dx: 0, actif: false };
  };
  const bouge = (e) => {
    const s = g.current;
    if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (!s.actif) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) return void (g.current = null);
      if (dx > 8) {
        s.actif = true;
        ref.current.setPointerCapture?.(e.pointerId);
        ref.current.classList.add("glisse-en-cours");
      } else return;
    }
    s.dx = Math.max(0, Math.min(150, dx));
    ref.current.style.transform = `translateX(${s.dx}px)`;
  };
  const fin = () => {
    const s = g.current;
    g.current = null;
    if (!s) return;
    ref.current.classList.remove("glisse-en-cours");
    ref.current.style.transform = "";
    if (s.actif && s.dx > 90) {
      const a = validerPaiement(date, true);
      if (navigator.vibrate) navigator.vibrate(14);
      toast(`Paiement du ${d.getDate()} validé`, a);
    } else if (!s.actif) onOuvrir();
  };
  return html`<div class=${`rang ${ok ? "valide" : ""}`}>
    ${!ok ? html`<div class="fond-valide"><${Icone} n="travail" />Valider</div>` : null}
    <div class="rang-corps" ref=${ref} onPointerDown=${debut} onPointerMove=${bouge} onPointerUp=${fin} onPointerCancel=${() => { g.current = null; ref.current.style.transform = ""; }}>
      <div class="date-bloc"><small>${JC[dayIndex(d)]}</small><b>${d.getDate()}</b></div>
      <div class="rang-mid">
        <div class="qui">${(j.extras || []).slice(0, 4).map((n) => html`<${Avatar} nom=${n} c=${couleurNom(n)} petit />`)}</div>
        <div class="calc">${libelleTarifs(j)} <b>= ${totalJour(j)} €</b></div>
        <div class="noms">${(j.extras || []).join(" · ")}</div>
        ${j.note ? html`<div class="memo">${j.note}</div>` : null}
      </div>
      <div class=${`etat ${ok ? "ok" : "attente"}`}>${ok ? html`<${Icone} n="travail" />` : null}</div>
    </div>
  </div>`;
}

export function Extras({ mois, onMois, onReglages, onPicker, onJour }) {
  useStore();
  const m = lireMois(mois);
  const lignes = joursDuMois(mois).map((d) => [iso(d), m.jours[iso(d)] || {}, d]).filter(([, j]) => (j.extras || []).length);
  const bilan = bilanPaiements(mois);
  const total = bilan.ok + bilan.attente;
  const groupes = [];
  for (const l of lignes) {
    const lundi = iso(mondayOf(l[2]));
    if (!groupes.length || groupes.at(-1).lundi !== lundi) groupes.push({ lundi, lignes: [] });
    groupes.at(-1).lignes.push(l);
  }
  const lib = (lundi) => {
    const a = fromISO(lundi), b = addDays(a, 6);
    return a.getMonth() === b.getMonth() ? `Semaine du ${a.getDate()} au ${b.getDate()} ${MOIS[b.getMonth()]}` : `Semaine du ${a.getDate()} ${MOIS_COURTS[a.getMonth()]} au ${b.getDate()} ${MOIS_COURTS[b.getMonth()]}`;
  };
  return html`<div class="vue">
    <${Haut} mois=${mois} onMois=${onPicker} onReglages=${onReglages} />
    <div class="defile">
      <div class="hero">
        <small>Extras du mois</small>
        <div class="grand">${total} €</div>
        <div class="barre"><i style=${{ width: `${total ? (bilan.ok / total) * 100 : 0}%` }}></i></div>
        <div class="legende"><span>${bilan.ok} € validés</span><span>${bilan.attente ? `${bilan.attente} € à valider` : total ? "Tout est validé ✓" : ""}</span></div>
      </div>
      ${lignes.length
        ? groupes.map((g) => html`<div class="groupe-sem">${lib(g.lundi)}</div>${g.lignes.map(([k, j]) => html`<${RangExtra} key=${k} date=${k} j=${j} onOuvrir=${() => onJour(k)} />`)}`)
        : html`<div class="vide-etat"><${Icone} n="euro" /><p>Aucun renfort ce mois-ci.<br />Ajoutez-les depuis le planning, en touchant la colonne « Renforts ».</p></div>`}
      ${lignes.length ? html`<p class="petit-texte" style=${{ textAlign: "center" }}>Balayez une ligne vers la droite pour la valider.</p>` : null}
    </div>
    ${bilan.aValider
      ? html`<div class="pied-glisse"><${Glisse} texte=${`Glisser pour tout valider (${bilan.aValider})`} icone="fleche" type="valide" onDone=${() => { const a = validerTout(mois); toast(`${bilan.aValider} jour${bilan.aValider > 1 ? "s" : ""} validé${bilan.aValider > 1 ? "s" : ""}`, a); }} /></div>`
      : null}
  </div>`;
}

// ---------- Imprimer ----------
export function Imprimer({ mois, onMois, onReglages, onPicker, onExtras }) {
  useStore();
  const pages = useMemo(() => toutesLesPages(mois), [mois, rev]);
  const [cw, setCw] = useState(() => Math.min(window.innerWidth * 0.62, 270));
  useEffect(() => {
    const f = () => setCw(Math.min(window.innerWidth * 0.62, 270));
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  const car = useRef();
  const [page, setPage] = useState(0);
  const [statut, setStatut] = useState("");
  const [pdf, setPdf] = useState(false);
  const bilan = bilanPaiements(mois);
  const fiches = pages.filter((p) => p.type === "fiche");
  const noms = [...new Set(fiches.map((p) => p.titre))];

  useEffect(() => {
    const el = car.current;
    let raf;
    const maj = () => {
      raf = 0;
      const pas = cw - 52;
      const centre = el.scrollLeft;
      [...el.children].forEach((c, i) => {
        const d = (i * pas - centre) / pas;
        c.style.setProperty("--d", Math.max(-3, Math.min(3, d)).toFixed(3));
        c.style.setProperty("--ad", Math.min(3, Math.abs(d)).toFixed(3));
      });
      setPage(Math.max(0, Math.min(pages.length - 1, Math.round(centre / pas))));
    };
    const surScroll = () => !raf && (raf = requestAnimationFrame(maj));
    el.addEventListener("scroll", surScroll, { passive: true });
    maj();
    return () => el.removeEventListener("scroll", surScroll);
  }, [pages.length, cw]);

  const lancerPDF = async () => {
    if (pdf) return;
    setPdf(true);
    setStatut("Création du PDF…");
    try {
      const r = await partagerPDF(mois, (i, n) => setStatut(`Création du PDF… page ${i} sur ${n}`));
      setStatut(r === "toucher-encore" ? "PDF prêt : touchez « PDF » une fois de plus." : "");
    } catch (err) {
      setStatut(`PDF impossible : ${err.message}`);
    } finally {
      setPdf(false);
    }
  };
  const lancerImpression = () => {
    setStatut("");
    imprimer(mois, () => {
      setStatut("La fenêtre d'impression ne s'est pas ouverte : préparation du PDF, puis choisissez « Imprimer ».");
      lancerPDF();
    });
  };
  const p = pages[page];
  const { nom: nm, annee } = nomMois(mois);
  return html`<div class="vue">
    <${Haut} mois=${mois} onMois=${onPicker} onReglages=${onReglages} />
    <div class="im-tete"><h1>Prêt à imprimer</h1><p>${pages.length} pages : le planning de ${nm.toLowerCase()} et ${fiches.length ? `${noms.length} fiche${noms.length > 1 ? "s" : ""} de présence` : "aucune fiche"}.</p></div>
    <div class="carrousel" ref=${car} style=${{ "--cw": `${cw}px` }}>
      ${pages.map((pg, i) => {
        const paysage = pg.type === "planning";
        const largeurFeuille = paysage ? 1122.5 : 793.7;
        const k = cw / largeurFeuille;
        return html`<div class="vignette" key=${i}><div class="papier" style=${{ width: `${cw}px`, height: `${cw * (paysage ? 0.7071 : 1.4142)}px` }}>
          ${Math.abs(i - page) <= 2 ? html`<div style=${{ transform: `scale(${k})`, transformOrigin: "top left", width: `${largeurFeuille}px` }} dangerouslySetInnerHTML=${{ __html: pg.html }}></div>` : null}
        </div></div>`;
      })}
    </div>
    <div class="legende-page">${p ? html`Page <b>${page + 1}</b> sur ${pages.length} · ${p.type === "planning" ? "Planning du mois" : `Fiche de ${p.titre}`}` : ""}</div>
    <div class="verifs">
      <span class="verif"><i><${Icone} n="travail" /></i>Planning du mois</span>
      ${noms.length ? html`<span class="verif"><i><${Icone} n="travail" /></i>${noms.length} fiche${noms.length > 1 ? "s" : ""}</span>` : null}
      ${bilan.aValider
        ? html`<button class="verif alerte" onClick=${onExtras}><i><${Icone} n="euro" /></i>${bilan.aValider} jour${bilan.aValider > 1 ? "s" : ""} d'extras à valider</button>`
        : bilan.jours ? html`<span class="verif"><i><${Icone} n="travail" /></i>Extras validés</span>` : null}
    </div>
    <div class="im-bas">
      <div class="im-statut">${statut}</div>
      <${Glisse} texte="Glisser pour imprimer" icone="imprimer" type="imprime" onDone=${lancerImpression} relache=${1500} />
      <button class="lien-pdf" onClick=${lancerPDF}><${Icone} n="doc" />${pdf ? "Création…" : "Obtenir en PDF"}</button>
    </div>
  </div>`;
}

// ---------- Choix du mois ----------
export function ChoixMois({ mois, onChoix, onClose }) {
  const [annee, setAnnee] = useState(Number(mois.slice(0, 4)));
  return html`<${Feuille} titre="Choisir un mois" onClose=${onClose}>
    <div class="annee-nav"><button class="rond" onClick=${() => setAnnee(annee - 1)}><${Icone} n="gauche" /></button><b>${annee}</b><button class="rond" onClick=${() => setAnnee(annee + 1)}><${Icone} n="droite" /></button></div>
    <div class="grille-mois">
      ${MOIS.map((nom, i) => {
        const m = `${annee}-${String(i + 1).padStart(2, "0")}`;
        return html`<button class=${`mois-case ${m === mois ? "on" : ""}`} onClick=${() => onChoix(m)}>${cap(MOIS_COURTS[i])}${m === moisDe(new Date()) ? html`<small>ce mois-ci</small>` : null}</button>`;
      })}
    </div>
  <//>`;
}

// ---------- Réglages ----------
function Equipier({ e, i }) {
  const [h, setH] = useState(false);
  const maj = (fn) => modifierReglages((r) => fn(r.employes[i]));
  return html`<div class="bloc equipier">
    <div class="equipier-tete"><${Avatar} nom=${e.nom || "?"} c=${classeAvatar(e.colonne ? e.colonne - 1 : i)} />
      <input type="text" value=${e.nom} placeholder="Prénom Nom" onInput=${(ev) => maj((x) => (x.nom = ev.target.value))} />
      <label class="interrupteur" aria-label="Reçoit une fiche"><input type="checkbox" checked=${e.actif} onChange=${(ev) => maj((x) => (x.actif = ev.target.checked))} /><i></i></label></div>
    <label class="champ"><span>Boutique</span><input type="text" value=${e.boutique} onInput=${(ev) => maj((x) => (x.boutique = ev.target.value))} /></label>
    <label class="champ"><span>Colonne du planning</span><select onChange=${(ev) => maj((x) => (x.colonne = Number(ev.target.value)))}>${[0, 1, 2, 3, 4].map((c) => html`<option value=${c} selected=${Number(e.colonne) === c}>${c ? `Vendeur ${c}` : "Aucune"}</option>`)}</select></label>
    <div style=${{ paddingTop: "12px" }}><span class="champ" style=${{ minHeight: 0, border: 0 }}><span>Repos habituels</span></span>
      <div class="jours-rond">${["L", "M", "M", "J", "V", "S", "D"].map((l, k) => html`<button class=${(e.repos || []).includes(k) ? "on" : ""} onClick=${() => maj((x) => (x.repos = x.repos.includes(k) ? x.repos.filter((y) => y !== k) : [...x.repos, k]))}>${l}</button>`)}</div></div>
    <button class=${`btn-ligne ${h ? "ouvert" : ""}`} onClick=${() => setH(!h)}>Horaires habituels<${Icone} n="droite" /></button>
    <div class=${`horaires ${h ? "ouvert" : ""}`}>
      <div class="h-grille"><span></span><span>Arrivée</span><span>Pause</span><span>Reprise</span><span>Départ</span>
        ${JC.map((jc, k) => html`<span>${jc}</span>${["arrivee", "debut_pause", "fin_pause", "depart"].map((f) => html`<input type="time" value=${e.horaires?.[k]?.[f] || ""} onChange=${(ev) => maj((x) => (x.horaires[k][f] = ev.target.value))} />`)}`)}</div>
    </div>
    <button class="btn-ligne danger" onClick=${() => confirm(`Retirer ${e.nom || "ce salarié"} de l'équipe ?`) && modifierReglages((r) => r.employes.splice(i, 1))}>Retirer de l'équipe</button>
  </div>`;
}

export function Reglages({ onClose, onChange }) {
  useStore();
  const r = getReglages();
  return html`<${Feuille} titre="Réglages" sous="Tout reste sur ce téléphone" onClose=${onClose}>
    <div class="bloc"><p class="bloc-titre">Taille du texte</p>
      <div class="seg">${[["normal", "Normal", 14], ["grand", "Grand", 19], ["tres", "Très grand", 25]].map(([v, l, s]) => html`<button class=${r.taille === v ? "on" : ""} style=${{ fontSize: `${s}px` }} onClick=${() => { modifierReglages((x) => (x.taille = v)); onChange?.(); }}>A</button>`)}</div></div>
    <p class="bloc-titre" style=${{ margin: "18px 6px 10px" }}>Équipe</p>
    ${r.employes.map((e, i) => html`<${Equipier} key=${i} e=${e} i=${i} />`)}
    <button class="ajout-equipier" onClick=${() => modifierReglages((x) => x.employes.push({ nom: "", boutique: x.employes[0]?.boutique || "", colonne: 0, actif: true, repos: [], horaires: structuredClone(HORAIRES_DEFAUT) }))}>+ Ajouter un salarié</button>
    <p class="petit-texte" style=${{ margin: "-4px 6px 16px" }}>L'interrupteur décide s'il reçoit une fiche. Sur le planning, « OK » reprend ses horaires habituels.</p>
    <div class="bloc"><p class="bloc-titre">Extras</p>
      <label class="champ"><span>Tarif d'un extra par jour</span><input type="number" inputmode="numeric" min="0" step="5" value=${r.tarifExtra} onChange=${(ev) => modifierReglages((x) => (x.tarifExtra = Math.max(0, Number(ev.target.value) || 0)))} /><span style=${{ color: "var(--ink3)" }}>€</span></label></div>
    <div class="bloc"><p class="bloc-titre">Données</p>
      ${v1Disponible() ? html`<button class="btn-ligne" onClick=${() => { if (confirm("Reprendre les réglages et les plannings de la V1 ? Cela remplace ceux de la V2.")) { const n = importerV1(); toast(`${n} mois repris de la V1`); } }}>Reprendre les données de la V1</button>` : null}
      <button class="btn-ligne" onClick=${() => confirm("Remettre le planning de novembre 2026 d'origine ?") && reinitialiserNovembre()}>Remettre le planning de novembre 2026</button>
      <button class="btn-ligne danger" onClick=${() => confirm("Effacer tous les plannings enregistrés sur ce téléphone ?") && toutEffacer()}>Effacer tous les plannings</button></div>
    <p class="version">Planning · V2</p>
  <//>`;
}
