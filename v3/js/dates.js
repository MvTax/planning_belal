// Dates, jours fériés et semaines (lundi → dimanche)
export const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
export const JC = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export const pad = (n) => String(n).padStart(2, "0");
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromISO = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
};
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);
export const dayIndex = (d) => (d.getDay() + 6) % 7; // 0 = lundi
export const mondayOf = (d) => addDays(d, -dayIndex(d));
export const moisDe = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const aujourdhui = () => iso(new Date());
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function joursDuMois(mois) {
  const [y, m] = mois.split("-").map(Number);
  const n = new Date(y, m, 0).getDate();
  return Array.from({ length: n }, (_, i) => new Date(y, m - 1, i + 1, 12));
}
export function decalerMois(mois, n) {
  const [y, m] = mois.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1, 12);
  return moisDe(d);
}
export const nomMois = (mois) => {
  const [y, m] = mois.split("-").map(Number);
  return { nom: cap(MOIS[m - 1]), annee: y };
};

// Le mois d'une semaine = celui de son jeudi (règle ISO), pour ne pas hésiter entre deux mois
export const moisDeSemaine = (lundi) => moisDe(addDays(lundi, 3));

// Toutes les semaines (lundis) qui couvrent [debutMois - avant, finMois + apres]
export function semainesAutour(mois, avant = 7, apres = 7) {
  const debut = mondayOf(fromISO(`${decalerMois(mois, -avant)}-01`));
  const finMois = joursDuMois(decalerMois(mois, apres)).at(-1);
  const res = [];
  for (let l = debut; l <= finMois; l = addDays(l, 7)) res.push(l);
  return res;
}

// Jours fériés en France (fixes + liés à Pâques)
const cache = new Map();
function feries(annee) {
  if (cache.has(annee)) return cache.get(annee);
  const a = annee % 19, b = Math.floor(annee / 100), c = annee % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  const paques = new Date(annee, mois - 1, jour, 12);
  const s = new Set(
    [
      new Date(annee, 0, 1), addDays(paques, 1), new Date(annee, 4, 1), new Date(annee, 4, 8), addDays(paques, 39), addDays(paques, 50),
      new Date(annee, 6, 14), new Date(annee, 7, 15), new Date(annee, 10, 1), new Date(annee, 10, 11), new Date(annee, 11, 25),
    ].map(iso),
  );
  cache.set(annee, s);
  return s;
}
export const estFerie = (d) => feries(d.getFullYear()).has(iso(d));

// Heures
export const toMin = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
export const heure = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":");
  return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`;
};
export const duree = (min) => {
  if (!(min > 0)) return "";
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h${pad(m)}` : `${h}h`;
};
