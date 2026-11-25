// Lecture du planning SUR LE TÉLÉPHONE, sans IA ni internet.
// Le planning est toujours le même tableau imprimé : on retrouve ses lignes sur le scan redressé,
// puis on regarde la couleur de l'encre dans chaque case des colonnes « Vendeur » :
// rouge → Repos, bleu/noir → OK, vide → rien. Les cas douteux sont marqués « ? » pour vérification.

const LARGEUR = 1600;

function pixels(canvas) {
  const k = LARGEUR / canvas.width;
  const w = LARGEUR, h = Math.round(canvas.height * k);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(canvas, 0, 0, w, h);
  return { w, h, d: ctx.getImageData(0, 0, w, h).data };
}

// Trait imprimé du tableau : sombre et sans couleur
const estTrait = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b) < 60 && r + g + b < 3 * 175;
// Surligneur jaune (à ignorer)
const estJaune = (r, g, b) => r > 170 && g > 150 && b < 140 && Math.abs(r - g) < 70;
// Encre manuscrite : tout ce qui n'est pas du papier (ni du surligneur)
const estEncre = (r, g, b) => (r + g + b < 3 * 185 || Math.max(r, g, b) - Math.min(r, g, b) > 60) && !estJaune(r, g, b);
// Encre rouge (Repos, CP)
const estRouge = (r, g, b) => r > 110 && r > g + 45 && r > b + 25;

// Positions des pics d'un profil (centres des lignes du tableau)
function pics(profil, seuil, ecartMin) {
  const res = [];
  let debut = -1;
  for (let i = 0; i <= profil.length; i++) {
    const haut = i < profil.length && profil[i] >= seuil;
    if (haut && debut < 0) debut = i;
    if (!haut && debut >= 0) {
      let best = debut;
      for (let j = debut; j < i; j++) if (profil[j] > profil[best]) best = j;
      if (res.length && best - res[res.length - 1] < ecartMin) {
        if (profil[best] > profil[res[res.length - 1]]) res[res.length - 1] = best;
      } else res.push(best);
      debut = -1;
    }
  }
  return res;
}

// Somme glissante (les traits sont un peu penchés : on regroupe quelques pixels voisins)
function glisser(p, k) {
  const r = Math.floor(k / 2);
  return p.map((_, i) => {
    let s = 0;
    for (let j = i - r; j <= i + r; j++) s += p[j] || 0;
    return s;
  });
}
const mediane = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)] || 0;
};

// Lignes horizontales dans une bande verticale étroite (là, l'inclinaison ne gêne pas)
function lignesDansBande(g, xa, xb) {
  xa = Math.round(xa) + 4;
  xb = Math.round(xb) - 4;
  const p = new Array(g.h).fill(0);
  for (let y = 0; y < g.h; y++) {
    let n = 0;
    for (let x = xa; x < xb; x++) n += g.trait[y * g.w + x];
    p[y] = n / Math.max(1, xb - xa);
  }
  return pics(glisser(p, 3), 1.2, 6);
}

// Trouve la grille : lignes verticales (colonnes) et limites des jours (colonne Date)
export function trouverGrille(canvas) {
  const { w, h, d } = pixels(canvas);
  const trait = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < w * h; i++, j += 4) trait[i] = estTrait(d[j], d[j + 1], d[j + 2]) ? 1 : 0;
  const g = { w, h, d, trait };

  // Colonnes : traits verticaux dans la bande du milieu de la feuille
  const y0 = Math.round(h * 0.3), y1 = Math.round(h * 0.7);
  const pv = new Array(w).fill(0);
  for (let x = 0; x < w; x++) {
    let n = 0;
    for (let y = y0; y < y1; y++) n += trait[y * w + x];
    pv[x] = n / (y1 - y0);
  }
  g.lignesV = pics(glisser(pv, 5), 2.0, 8);
  if (g.lignesV.length < 7) throw new Error("Tableau introuvable sur le scan. Refaites le scan avec toute la feuille bien visible et bien à plat.");

  // Jours : traits horizontaux de la colonne Date. L'en-tête est plus haut qu'une ligne de jour.
  const L = lignesDansBande(g, g.lignesV[0], g.lignesV[1]);
  if (L.length < 10) throw new Error("Lignes du tableau introuvables. Refaites le scan avec toute la feuille bien visible.");
  const ecarts = L.slice(1).map((y, i) => y - L[i]);
  g.pas = mediane(ecarts);
  let i0 = ecarts.findIndex((e) => e > g.pas * 1.4);
  i0 = i0 < 0 ? 0 : i0 + 1;
  const bornes = [L[i0]];
  for (let i = i0; i < L.length - 1; i++) {
    const ecart = L[i + 1] - L[i];
    const n = Math.max(1, Math.round(ecart / g.pas)); // trait effacé : on coupe en lignes régulières
    for (let k = 1; k <= n; k++) bornes.push(L[i] + (ecart * k) / n);
  }
  g.bornes = bornes;
  return g;
}

// Recale les limites des jours sur les traits de la colonne lue (feuille un peu penchée ou courbée)
function recaler(g, bornes, lignes) {
  let decalage = 0;
  return bornes.map((y) => {
    let best = null;
    for (const v of lignes) if (best == null || Math.abs(v - (y + decalage)) < Math.abs(best - (y + decalage))) best = v;
    if (best != null && Math.abs(best - (y + decalage)) < g.pas * 0.33) {
      decalage = best - y;
      return best;
    }
    return y + decalage;
  });
}

// Mesure une case : quantité d'encre, part de rouge, largeur de l'écriture
function lireCase(g, x0, x1, y0, y1) {
  const mx = (x1 - x0) * 0.08, my = (y1 - y0) * 0.18;
  const ax = Math.round(x0 + mx), bx = Math.round(x1 - mx), ay = Math.round(y0 + my), by = Math.round(y1 - my);
  let encre = 0, rouge = 0, minX = Infinity, maxX = -Infinity;
  for (let y = ay; y < by; y++) {
    for (let x = ax; x < bx; x++) {
      const j = (y * g.w + x) * 4;
      const r = g.d[j], v = g.d[j + 1], b = g.d[j + 2];
      if (!estEncre(r, v, b)) continue;
      encre++;
      if (estRouge(r, v, b)) rouge++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
  }
  const aire = Math.max(1, (bx - ax) * (by - ay));
  return { part: encre / aire, rouge: encre ? rouge / encre : 0, largeur: encre ? (maxX - minX) / (bx - ax) : 0 };
}

// Réglages mesurés sur le planning de novembre 2026 (120 cases, toutes bien classées)
function texteDeCase(c) {
  if (c.part < 0.003) return ""; // case vide
  if (c.part < 0.006) return "OK?"; // très peu d'encre
  if (c.rouge >= 0.15) return c.largeur < 0.4 ? "CP?" : "Repos"; // « CP » est court, « Repos » est long
  return c.largeur > 0.42 ? "OK?" : "OK"; // écriture longue en bleu : « École », un prénom… à vérifier
}

// colonnes : [{ nom, colonne: 1..4 }] ; dates : ["YYYY-MM-DD", …] dans l'ordre des lignes
export function lireSurTelephone(canvas, colonnes, dates) {
  const g = trouverGrille(canvas);
  // Colonnes du modèle : Date | JOUR | Vendeur 1 | Vendeur 2 | Vendeur 3 | Vendeur 4 | Extra | Extra | Commentaires
  const vendeurs = [];
  for (const { nom, colonne } of colonnes) {
    const x0 = g.lignesV[colonne + 1], x1 = g.lignesV[colonne + 2];
    if (x0 == null || x1 == null) continue;
    const b = recaler(g, g.bornes, lignesDansBande(g, x0, x1));
    const cases = dates.map((_, i) => (b[i + 1] != null ? texteDeCase(lireCase(g, x0, x1, b[i], b[i + 1])) : "?"));
    vendeurs.push({ nom, cases });
  }
  const manquants = dates.length - (g.bornes.length - 1);
  return {
    dates,
    vendeurs,
    extras: [],
    remarques: manquants > 0 ? `${manquants} jour(s) en fin de mois non trouvés sur le scan : vérifiez-les.` : "",
  };
}
