// Données de l'appli : réglages + planning de chaque mois. Tout reste sur le téléphone (localStorage).
import { iso, joursDuMois, dayIndex, pad } from "./dates.js";

export const STATUTS = [
  { id: "travail", court: "OK", long: "Travaille" },
  { id: "repos", court: "Repos", long: "Repos" },
  { id: "conge", court: "CP", long: "Congé payé" },
  { id: "ecole", court: "École", long: "École" },
  { id: "maladie", court: "Malade", long: "Malade" },
  { id: "absent", court: "Absent", long: "Absent" },
];
export const STATUT = Object.fromEntries(STATUTS.map((s) => [s.id, s]));

const H = (a, dp, fp, d) => ({ arrivee: a, debut_pause: dp, fin_pause: fp, depart: d });
export const HORAIRES_DEFAUT = [...Array.from({ length: 6 }, () => H("10:00", "15:00", "16:00", "20:30")), H("11:00", "15:00", "16:00", "19:00")];

const REGLAGES_DEFAUT = () => ({
  employes: [
    { nom: "Belal N'DAO", colonne: 1 },
    { nom: "Soso", colonne: 2 },
    { nom: "Maeva", colonne: 3 },
    { nom: "Nour", colonne: 4 },
  ].map((e) => ({ ...e, boutique: "NOA", actif: true, repos: [], horaires: structuredClone(HORAIRES_DEFAUT) })),
  extras: ["Sérine", "Lisa", "Sarra", "Katy", "Shaily"],
  taille: "normal",
  tarifExtra: 100,
});

const lire = (k, d) => {
  try {
    const v = localStorage.getItem(k);
    return v == null ? d : JSON.parse(v);
  } catch {
    return d;
  }
};
const ecrire = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* stockage indisponible : l'appli reste utilisable pour cette session */
  }
};

let reglages = lire("v2.settings", null);
const moisCache = new Map();
const abonnes = new Set();
export let rev = 0;
const notifier = () => {
  rev++;
  for (const f of abonnes) f(rev);
};
export const abonner = (f) => (abonnes.add(f), () => abonnes.delete(f));

// ---------- Reprise des données de la V1 (une seule fois) ----------
export function v1Disponible() {
  try {
    return !!localStorage.getItem("fp.settings") || Object.keys(localStorage).some((k) => k.startsWith("fp.pl.2"));
  } catch {
    return false;
  }
}
export function importerV1() {
  const s = lire("fp.settings", null);
  if (s?.employes) {
    reglages = { ...REGLAGES_DEFAUT(), ...s, taille: s.taille === "tres" ? "tres" : s.taille === "grand" ? "grand" : "normal" };
    delete reglages.sync;
    ecrire("v2.settings", reglages);
  }
  let n = 0;
  for (const k of Object.keys(localStorage)) {
    if (/^fp\.pl\.\d{4}-\d{2}$/.test(k)) {
      localStorage.setItem(`v2.${k.slice(3)}`, localStorage.getItem(k));
      n++;
    }
  }
  moisCache.clear();
  notifier();
  return n;
}
if (!reglages) {
  reglages = REGLAGES_DEFAUT();
  if (v1Disponible()) {
    importerV1();
  } else ecrire("v2.settings", reglages);
}
// Compléter un réglage ancien
for (const e of reglages.employes) {
  e.horaires ||= structuredClone(HORAIRES_DEFAUT);
  e.repos ||= [];
  if (e.colonne === undefined) e.colonne = 0;
}
reglages.extras ||= [];
reglages.tarifExtra ??= 100;
reglages.taille ||= "normal";

export const getReglages = () => reglages;
export function modifierReglages(fn) {
  fn(reglages);
  ecrire("v2.settings", reglages);
  notifier();
}
export const vendeurs = () =>
  reglages.employes
    .filter((e) => e.colonne >= 1 && e.colonne <= 4)
    .sort((a, b) => a.colonne - b.colonne);

// ---------- Mois ----------
function exempleNovembre2026() {
  const t = {};
  const mettre = (col, f) => {
    for (let j = 1; j <= 30; j++) {
      const s = f(j);
      if (s) (t[`2026-11-${pad(j)}`] ||= {})[col] = s;
    }
  };
  mettre(1, (j) => ([5, 8, 11, 12, 18, 19, 26].includes(j) ? "repos" : "travail"));
  mettre(2, (j) => ([2, 3, 9, 10, 16, 17, 30].includes(j) ? "repos" : "travail"));
  mettre(3, (j) => ([1, 2, 3, 5, 6, 7, 13].includes(j) ? "absent" : [14, 27].includes(j) ? "repos" : j === 28 ? "conge" : [23, 24, 25].includes(j) ? null : "travail"));
  mettre(4, (j) => ([3, 9, 10, 16, 17, 23, 24, 30].includes(j) ? "ecole" : [14, 15, 20, 22].includes(j) ? "repos" : j === 21 ? "conge" : j === 29 ? null : "travail"));
  const extras = {
    1: ["Nour"], 2: ["Nour"], 3: ["Lisa"], 5: ["Lisa"], 7: ["Nour", "Katy"], 8: ["Nour", "Sérine"], 9: ["Sérine"], 10: ["Sérine"], 11: ["Sérine"],
    12: ["Maeva"], 14: ["Sérine"], 15: ["Sérine"], 16: ["Sérine"], 17: ["Sérine"], 18: ["Sérine"], 23: ["Soso", "Sérine"], 24: ["Soso", "Sérine"],
    25: ["Sérine", "Belal"], 26: ["Maeva", "Lisa"], 27: ["Sérine"], 28: ["Nour", "Sérine", "Sarra"], 29: ["Sarra", "Sérine"],
  };
  for (const [j, noms] of Object.entries(extras)) (t[`2026-11-${pad(j)}`] ||= {}).extras = [...noms];
  for (const j of [1, 2, 3, 5, 6, 7, 13]) {
    const x = (t[`2026-11-${pad(j)}`] ||= {});
    x.extras = [...(x.extras || []), "Shaily"];
  }
  return { jours: t };
}

export function mois(m) {
  if (moisCache.has(m)) return moisCache.get(m);
  let d = lire(`v2.pl.${m}`, null);
  let neuf = false;
  if (!d) {
    neuf = true;
    if (m === "2026-11") d = exempleNovembre2026();
    else {
      d = { jours: {} };
      for (const jour of joursDuMois(m)) {
        const j = (d.jours[iso(jour)] = {});
        for (const v of vendeurs()) j[v.colonne] = (v.repos || []).includes(dayIndex(jour)) ? "repos" : "travail";
      }
    }
    ecrire(`v2.pl.${m}`, d);
  }
  d.neuf = neuf;
  moisCache.set(m, d);
  return d;
}
const sauverMois = (m) => ecrire(`v2.pl.${m}`, { jours: mois(m).jours });
const jour = (date) => {
  const m = mois(date.slice(0, 7));
  return (m.jours[date] ||= {});
};
export const lireJour = (date) => mois(date.slice(0, 7)).jours[date] || {};

// ---------- Modifications (chacune renvoie une fonction « annuler ») ----------
function muter(date, fn) {
  const m = date.slice(0, 7);
  const avant = structuredClone(mois(m).jours[date] || null);
  fn(jour(date));
  sauverMois(m);
  notifier();
  return () => {
    if (avant) mois(m).jours[date] = avant;
    else delete mois(m).jours[date];
    sauverMois(m);
    notifier();
  };
}
export const definirStatut = (date, col, code) =>
  muter(date, (j) => {
    if (code) j[col] = code;
    else delete j[col];
  });
export const definirRenforts = (date, noms) =>
  muter(date, (j) => {
    if (noms.length) j.extras = noms;
    else delete j.extras;
  });
export const definirTarif = (date, nom, t) =>
  muter(date, (j) => {
    j.paie = { ...(j.paie || {}), tarifs: { ...(j.paie?.tarifs || {}), [nom]: Math.max(0, t) } };
  });
export const definirTarifs = (date, t) =>
  muter(date, (j) => {
    j.paie = { ...(j.paie || {}), tarifs: Object.fromEntries((j.extras || []).map((n) => [n, t])) };
  });
export const definirNote = (date, texte) =>
  muter(date, (j) => {
    if (texte.trim()) j.note = texte.trim();
    else delete j.note;
  });

// ---------- Paiements des extras ----------
export const tarifDe = (j, nom) => Number(j.paie?.tarifs?.[nom] ?? reglages.tarifExtra);
const signature = (j) => (j.extras || []).map((n) => `${n}:${tarifDe(j, n)}`).join("|");
export const estValide = (j) => !!(j.extras || []).length && j.paie?.valide === signature(j);
export const totalJour = (j) => (j.extras || []).reduce((t, n) => t + tarifDe(j, n), 0);
export function libelleTarifs(j) {
  const t = (j.extras || []).map((n) => tarifDe(j, n));
  if (!t.length) return "";
  if (t.every((x) => x === t[0])) return t.length === 1 ? `${t[0]} €` : `${t[0]} € × ${t.length}`;
  return `${t.join(" + ")} €`;
}
export const validerPaiement = (date, oui = true) =>
  muter(date, (j) => {
    j.paie = { ...(j.paie || {}), valide: oui ? signature(j) : null };
  });
export function validerTout(m) {
  const dates = Object.entries(mois(m).jours).filter(([, j]) => (j.extras || []).length && !estValide(j)).map(([d]) => d);
  const annulations = dates.map((d) => validerPaiement(d, true));
  return () => annulations.reverse().forEach((f) => f());
}
export function bilanPaiements(m) {
  let ok = 0, attente = 0, jours = 0;
  for (const j of Object.values(mois(m).jours)) {
    if (!(j.extras || []).length) continue;
    jours++;
    if (estValide(j)) ok += totalJour(j);
    else attente += totalJour(j);
  }
  return { ok, attente, jours, aValider: Object.values(mois(m).jours).filter((j) => (j.extras || []).length && !estValide(j)).length };
}
export const commentaireImprime = (j) => [estValide(j) ? libelleTarifs(j) : "", (j.note || "").trim()].filter(Boolean).join(" · ");

// ---------- Données ----------
export function reinitialiserNovembre() {
  localStorage.removeItem("v2.pl.2026-11");
  moisCache.delete("2026-11");
  notifier();
}
export function toutEffacer() {
  for (const k of Object.keys(localStorage)) if (k.startsWith("v2.pl.")) localStorage.removeItem(k);
  moisCache.clear();
  notifier();
}
export const ajouterExtraConnu = (nom) =>
  modifierReglages((r) => {
    if (!r.extras.includes(nom)) r.extras.push(nom);
  });
