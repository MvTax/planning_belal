// Pages imprimées : planning du mois (A4 paysage) et fiches de présence hebdomadaires (A4 portrait).
// Mise en page identique à la feuille papier.
import { MOIS, JOURS, joursDuMois, addDays, mondayOf, dayIndex, iso, fromISO, toMin, heure, duree, estFerie, cap } from "./dates.js";
import { getReglages, vendeurs, mois as lireMois, commentaireImprime } from "./store.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const prenom = (n) => String(n).trim().split(/\s+/)[0];
const court = (d) => `${d.getDate()}/${String(d.getMonth() + 1).padStart(2, "0")}`;
const TEXTE = { travail: "OK", repos: "Repos", conge: "CP", ecole: "École", maladie: "Maladie", absent: "Absent" };
const ABSENCE = { conge: "CONGÉ PAYÉ", ecole: "ÉCOLE", maladie: "MALADIE", absent: "ABSENT" };
const VIDE = { arrivee: "", debut_pause: "", fin_pause: "", depart: "" };

const normNom = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
function trouverSalarie(nom) {
  const n = normNom(nom);
  if (!n) return null;
  const mots = n.split(" ").filter((t) => t.length >= 3);
  let best = null;
  for (const e of getReglages().employes) {
    const ne = normNom(e.nom);
    if (ne === n) return e;
    const c = mots.filter((t) => ne.split(" ").includes(t)).length;
    if (c && (!best || c > best.c)) best = { e, c };
  }
  return best?.e || null;
}

// Horaires habituels du salarié pour ce jour de la semaine
function heuresDuJour(emp, date) {
  const t = emp?.horaires?.[dayIndex(fromISO(date))] || VIDE;
  let pause = { debut_pause: "", fin_pause: "" };
  if (t.debut_pause && t.fin_pause && t.arrivee && t.depart && toMin(t.arrivee) <= toMin(t.debut_pause) && toMin(t.depart) >= toMin(t.fin_pause)) {
    pause = { debut_pause: t.debut_pause, fin_pause: t.fin_pause };
  }
  return { arrivee: t.arrivee || "", ...pause, depart: t.depart || "" };
}
function minutesJour(e) {
  if (!e?.arrivee || !e?.depart) return null;
  let t = toMin(e.depart) - toMin(e.arrivee);
  if (t < 0) t += 1440;
  if (e.debut_pause && e.fin_pause) t -= Math.max(0, toMin(e.fin_pause) - toMin(e.debut_pause));
  return t > 0 ? t : null;
}

function entrees(m) {
  const d = lireMois(m);
  const res = {};
  for (const emp of getReglages().employes) {
    const jours = (res[emp.nom] = {});
    for (const dt of joursDuMois(m)) {
      const k = iso(dt), j = d.jours[k] || {};
      const code = Number(emp.colonne) > 0 ? j[emp.colonne] : null;
      const renfort = (j.extras || []).some((n) => trouverSalarie(n) === emp);
      if (code === "travail" || (!code && renfort)) jours[k] = { statut: "travail", ...heuresDuJour(emp, k) };
      else if (code) jours[k] = { statut: code, ...VIDE };
    }
  }
  return res;
}

function libelleSemaine(jours) {
  const y = jours.at(-1).getFullYear();
  if (jours.length === 1) return `${court(jours[0])}/${y}`;
  const a = jours[0], b = jours.at(-1);
  return a.getMonth() === b.getMonth() ? `du ${a.getDate()} au ${court(b)}/${y}` : `du ${court(a)} au ${court(b)}/${y}`;
}

function semaineHtml(jours, debut, fin, ent) {
  const dans = (d) => d >= debut && d <= fin;
  const joursDans = jours.filter(dans);
  const rows = [];
  for (let i = 0; i < 7; i++) {
    const d = jours[i];
    const ok = dans(d);
    const e = ok ? ent[iso(d)] : null;
    const ferie = ok && estFerie(d) ? `<span class="ferie">Férié</span>` : "";
    if (!ok) {
      rows.push(`<tr><td class="jour">${JOURS[i]}</td>${"<td></td>".repeat(6)}</tr>`);
    } else if (e?.statut === "repos") {
      let span = 1;
      while (i + span < 7 && dans(jours[i + span]) && ent[iso(jours[i + span])]?.statut === "repos") span++;
      const cls = `repos${span > 1 ? " span2" : ""}`;
      rows.push(`<tr><td class="jour">${ferie}${JOURS[i]}</td><td>${court(d)}</td>${["R", "E", "P", "O", "S"].map((l) => `<td class="${cls}" rowspan="${span}">${l}</td>`).join("")}</tr>`);
      for (let k = 1; k < span; k++) {
        const dk = jours[i + k];
        rows.push(`<tr><td class="jour">${estFerie(dk) ? `<span class="ferie">Férié</span>` : ""}${JOURS[i + k]}</td><td>${court(dk)}</td></tr>`);
      }
      i += span - 1;
    } else if (e && e.statut !== "travail") {
      const t = ABSENCE[e.statut] || "ABSENCE";
      rows.push(`<tr><td class="jour">${ferie}${JOURS[i]}</td><td>${court(d)}</td><td class="absence" colspan="5">${t}</td></tr>`);
    } else {
      const m = minutesJour(e);
      rows.push(`<tr><td class="jour">${ferie}${JOURS[i]}</td><td>${court(d)}</td><td>${heure(e?.arrivee)}</td><td>${heure(e?.debut_pause)}</td><td>${heure(e?.fin_pause)}</td><td>${heure(e?.depart)}</td><td>${duree(m)}</td></tr>`);
    }
  }
  return `<div class="week">
      <p class="semaine"><span class="lib">Semaine</span><span class="val">${joursDans.length ? esc(libelleSemaine(joursDans)) : ""}</span></p>
      <table><colgroup><col class="c-jour"><col class="c-date"><col><col><col><col><col></colgroup>
        <thead><tr><th>Jour</th><th>Date</th><th>Heure d'arrivée</th><th>Départ en Pause</th><th>Arrivée de pause</th><th>Heure de départ</th><th>Total heures</th></tr></thead>
        <tbody>${rows.join("")}</tbody></table></div>`;
}

export function pagesFiches(m) {
  const [y, mm] = m.split("-").map(Number);
  const debut = new Date(y, mm - 1, 1, 12), fin = new Date(y, mm, 0, 12);
  const semaines = [];
  for (let l = mondayOf(debut); l <= fin; l = addDays(l, 7)) semaines.push(Array.from({ length: 7 }, (_, i) => addDays(l, i)));
  const ent = entrees(m);
  const pages = [];
  for (const emp of getReglages().employes.filter((e) => e.actif)) {
    for (let p = 0; p < semaines.length; p += 3) {
      pages.push({
        type: "fiche",
        titre: prenom(emp.nom),
        html: `<div class="sheet"><div class="cadre">
            <header class="entete"><p class="titre">FEUILLE DE PRÉSENCE<em>hebdomadaire</em></p>
              <div class="champs"><div class="champ"><small>Boutique</small><b>${esc(emp.boutique)}</b></div><div class="champ"><small>Salarié</small><b>${esc(emp.nom)}</b></div></div></header>
            ${semaines.slice(p, p + 3).map((j) => semaineHtml(j, debut, fin, ent[emp.nom] || {})).join("")}
            <div class="pied"><div class="signature">Signature</div></div></div></div>`,
      });
    }
  }
  return pages;
}

export function pagePlanning(m) {
  const [y, mm] = m.split("-").map(Number);
  const jours = joursDuMois(m);
  const d = lireMois(m);
  const vend = vendeurs();
  const boutique = getReglages().employes.find((e) => e.boutique)?.boutique || "";
  const h = Math.min(10, 229 / jours.length); // le tableau occupe toute la page
  const police = Math.min(10.5, h * 1.38).toFixed(1);
  const cell = (s) => (s ? `<span class="pp-${s}">${TEXTE[s] || ""}</span>` : "");
  const lignes = jours
    .map((dt) => {
      const k = iso(dt), j = d.jours[k] || {}, ji = dayIndex(dt), ex = j.extras || [];
      return `<tr class="${ji === 0 ? "lundi" : ""}" style="height:${h.toFixed(2)}mm">
        <td class="pp-date">${estFerie(dt) ? `<span class="ferie">Férié</span>` : ""}Le ${dt.getDate()}</td>
        <td class="pp-jour${ji >= 5 ? " we" : ""}">${JOURS[ji].slice(0, 3)}.</td>
        ${vend.map((v) => `<td>${cell(j[v.colonne])}</td>`).join("")}
        <td class="pp-extra">${esc(ex[0] || "")}</td><td class="pp-extra">${esc(ex.slice(1).join(" / "))}</td>
        <td class="pp-com">${esc(commentaireImprime(j))}</td></tr>`;
    })
    .join("");
  const n = Math.max(vend.length, 1);
  return {
    type: "planning",
    titre: "Planning",
    html: `<div class="sheet plan"><div class="cadre">
      <header class="entete"><p class="titre">PLANNING<em>${cap(MOIS[mm - 1])} ${y}</em></p>
        <div class="champs"><div class="champ"><small>Magasin</small><b>${esc(boutique)}</b></div></div></header>
      <table class="pp" style="--pp-f:${police}pt">
        <colgroup><col style="width:8.5%"><col style="width:8.5%">${vend.map(() => `<col style="width:${(43 / n).toFixed(2)}%">`).join("")}<col style="width:9.5%"><col style="width:9.5%"><col></colgroup>
        <thead><tr><th rowspan="2">Date</th><th rowspan="2">Jour</th>${vend.map((_, i) => `<th>Vendeur ${i + 1}</th>`).join("")}<th rowspan="2">Extra</th><th rowspan="2">Extra</th><th rowspan="2">Commentaires, acomptes et retards</th></tr>
        <tr>${vend.map((v) => `<th class="pp-nom">${esc(prenom(v.nom))}</th>`).join("")}</tr></thead>
        <tbody>${lignes}</tbody></table></div></div>`,
  };
}

export const toutesLesPages = (m) => [pagePlanning(m), ...pagesFiches(m)];
