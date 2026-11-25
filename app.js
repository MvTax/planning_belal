// Planning boutique — planning du mois en quelques gestes → planning imprimé + fiches de présence (PDF).
// Aucune IA, aucun scan : tout est saisi sur le téléphone et reste dessus (localStorage).
import { initPlanning, joursDuMois } from "./planning.js?v=24";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const JOURS_COURTS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
// Texte écrit en rouge sur la fiche ("" = ligne laissée vide, seulement la date)
const ABSENCE_TEXTE = { conge: "CONGÉ PAYÉ", ecole: "ÉCOLE", maladie: "MALADIE", absent: "ABSENT" };
const TEXTE_PLANNING = { travail: "OK", repos: "Repos", conge: "CP", ecole: "École", maladie: "Maladie", absent: "Absent" };

// Horaires habituels (lundi → dimanche). Le planning dit seulement « OK » : les heures viennent d'ici.
const H = (arrivee, debut_pause, fin_pause, depart) => ({ arrivee, debut_pause, fin_pause, depart });
const HORAIRES_DEFAUT = [
  ...Array.from({ length: 6 }, () => H("10:00", "15:00", "16:00", "20:30")),
  H("11:00", "15:00", "16:00", "19:00"),
];

const VENDEURS_DEFAUT = [
  { nom: "Belal N'DAO", colonne: 1 },
  { nom: "Soso", colonne: 2 },
  { nom: "Maeva", colonne: 3 },
  { nom: "Nour", colonne: 4 },
];
const DEFAULT_SETTINGS = {
  employes: VENDEURS_DEFAUT.map((v) => ({ ...v, boutique: "NOA", actif: true, horaires: HORAIRES_DEFAUT, repos: [] })),
  extras: ["Sérine", "Lisa", "Sarra", "Katy", "Shaily"],
  taille: "grand",
  tarifExtra: 100,
};

// ---------- Stockage local (protégé : peut échouer en navigation privée) ----------
const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* stockage indisponible : l'appli fonctionne quand même pour cette session */
    }
  },
  retirer(prefixe) {
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith(prefixe)) localStorage.removeItem(k);
    } catch {
      /* ignoré */
    }
  },
};
// Anciennes versions (scan, clés API, lecture de photos) : tout est supprimé de ce téléphone
for (const k of ["fp.apikey", "fp.geminikey", "fp.gemini.models", "fp.lecture", "fp.planning", "fp.periode", "fp.remarques", "fp.mois", "fp.scan.auto"]) {
  try {
    localStorage.removeItem(k);
  } catch {
    /* ignoré */
  }
}

const state = { settings: store.get("fp.settings", structuredClone(DEFAULT_SETTINGS)) };
delete state.settings.pause;
for (const e of state.settings.employes) {
  e.horaires ||= structuredClone(HORAIRES_DEFAUT);
  if (e.colonne === undefined) e.colonne = e.nom === "Belal N'DAO" ? 1 : 0; // colonne « Vendeur N » sur le planning
  e.repos ||= []; // jours de repos habituels (0 = lundi) pour préparer chaque nouveau mois
}
// Les 4 vendeurs du planning papier, s'il en manque
for (const v of VENDEURS_DEFAUT) {
  if (!state.settings.employes.some((e) => Number(e.colonne) === v.colonne)) {
    state.settings.employes.push({ ...v, boutique: state.settings.employes[0]?.boutique || "NOA", actif: true, horaires: structuredClone(HORAIRES_DEFAUT), repos: [] });
  }
}
state.settings.extras ||= structuredClone(DEFAULT_SETTINGS.extras);
state.settings.taille ||= "grand";
state.settings.tarifExtra ??= 100;
const appliquerTaille = () => {
  document.documentElement.classList.remove("t-normal", "t-grand", "t-tres");
  document.documentElement.classList.add(`t-${state.settings.taille}`);
};
appliquerTaille();

function save() {
  store.set("fp.settings", state.settings);
}

// ---------- Dates ----------
const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function fromISO(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const dayIndex = (d) => (d.getDay() + 6) % 7; // 0 = lundi
const mondayOf = (d) => addDays(d, -dayIndex(d));
const isISODate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(fromISO(s).getTime());
const court = (d) => `${d.getDate()}/${pad(d.getMonth() + 1)}`;

// Jours fériés en France (fixes + liés à Pâques)
const feriesCache = new Map();
function joursFeries(year) {
  if (feriesCache.has(year)) return feriesCache.get(year);
  // Calcul de Pâques (algorithme grégorien anonyme)
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const paques = new Date(year, month - 1, day);
  const set = new Set(
    [
      new Date(year, 0, 1), addDays(paques, 1), new Date(year, 4, 1), new Date(year, 4, 8),
      addDays(paques, 39), addDays(paques, 50), new Date(year, 6, 14), new Date(year, 7, 15),
      new Date(year, 10, 1), new Date(year, 10, 11), new Date(year, 11, 25),
    ].map(toISO),
  );
  feriesCache.set(year, set);
  return set;
}
const estFerie = (d) => joursFeries(d.getFullYear()).has(toISO(d));

// ---------- Heures ----------
// Accepte "10:00", "10h", "10h30", "10H30", "9", "20.30" → "HH:MM" (ou "" si vide/illisible)
function normTime(v) {
  if (v == null) return "";
  const s = String(v).trim().toLowerCase().replace(/\s/g, "");
  if (!s) return "";
  const m = s.match(/^(\d{1,2})(?:[:h.](\d{0,2}))?h?$/);
  if (!m) return "";
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2].padEnd(2, "0")) : 0;
  if (h > 24 || min > 59) return "";
  return `${pad(h)}:${pad(min)}`;
}
const toMin = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
// "20:30" → "20h30", "10:00" → "10h"
function affHeure(t) {
  if (!t) return "";
  const [h, m] = t.split(":");
  return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`;
}
function affDuree(min) {
  if (min == null || min <= 0) return "";
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h${pad(m)}` : `${h}h`;
}
function minutesTravaillees(e) {
  if (!e || e.statut !== "travail" || !e.arrivee || !e.depart) return null;
  let total = toMin(e.depart) - toMin(e.arrivee);
  if (total < 0) total += 24 * 60; // fin après minuit
  if (e.debut_pause && e.fin_pause) {
    const p = toMin(e.fin_pause) - toMin(e.debut_pause);
    if (p > 0) total -= p;
  }
  return total > 0 ? total : null;
}

const VIDE = { arrivee: "", debut_pause: "", fin_pause: "", depart: "" };

// Heures d'un jour travaillé : celles écrites sur le planning, sinon les horaires habituels du salarié.
function heuresDuJour(emp, iso, arriveeLue = "", departLue = "") {
  const type = emp?.horaires?.[dayIndex(fromISO(iso))] || VIDE;
  const arrivee = arriveeLue || type.arrivee || "";
  const depart = departLue || type.depart || "";
  let pause = { debut_pause: "", fin_pause: "" };
  if (type.debut_pause && type.fin_pause && arrivee && depart &&
      toMin(arrivee) <= toMin(type.debut_pause) && toMin(depart) >= toMin(type.fin_pause)) {
    pause = { debut_pause: type.debut_pause, fin_pause: type.fin_pause };
  }
  return { arrivee, ...pause, depart };
}

// ---------- Noms ----------
const normNom = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function trouverSalarie(nomLu) {
  const n = normNom(nomLu);
  if (!n) return null;
  const tokensLu = n.split(" ").filter((t) => t.length >= 3);
  let best = null;
  for (const emp of state.settings.employes) {
    const ne = normNom(emp.nom);
    if (ne === n) return emp;
    const tokensEmp = ne.split(" ").filter((t) => t.length >= 3);
    const communs = tokensLu.filter((t) => tokensEmp.includes(t)).length;
    if (communs > 0 && (!best || communs > best.score)) best = { emp, score: communs };
  }
  return best ? best.emp : null;
}


// ---------- Fiches de présence (hebdomadaires) ----------
function semainesDeLaPeriode(debut, fin) {
  const weeks = [];
  for (let start = mondayOf(debut); start <= fin; start = addDays(start, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(start, i)));
  }
  return weeks;
}

function libelleSemaine(jours) {
  const y = jours[jours.length - 1].getFullYear();
  if (jours.length === 1) return `${court(jours[0])}/${y}`;
  const a = jours[0], b = jours[jours.length - 1];
  if (a.getMonth() === b.getMonth()) return `du ${a.getDate()} au ${court(b)}/${y}`;
  return `du ${court(a)} au ${court(b)}/${y}`;
}


function htmlSemaine(jours, debut, fin, entrees) {
  const dans = (d) => d >= debut && d <= fin;
  const joursDans = jours.filter(dans);
  const rows = [];
  for (let i = 0; i < 7; i++) {
    const d = jours[i];
    const inPeriod = dans(d);
    const e = inPeriod ? entrees[toISO(d)] : null;
    const ferie = inPeriod && estFerie(d) ? `<span class="ferie">Férié</span>` : "";
    let cells = "";
    if (!inPeriod) {
      cells = `<td></td>` + `<td></td>`.repeat(5);
    } else if (e?.statut === "repos") {
      // Regroupe les jours de repos consécutifs, comme sur la fiche manuscrite
      let span = 1;
      while (i + span < 7 && dans(jours[i + span]) && entrees[toISO(jours[i + span])]?.statut === "repos") span++;
      const cls = `repos${span > 1 ? " span2" : ""}`;
      cells = `<td>${court(d)}</td>` + ["R", "E", "P", "O", "S"].map((l) => `<td class="${cls}" rowspan="${span}">${l}</td>`).join("");
      rows.push(`<tr><td class="jour">${ferie}${JOURS[i]}</td>${cells}</tr>`);
      for (let k = 1; k < span; k++) {
        const dk = jours[i + k];
        const fk = estFerie(dk) ? `<span class="ferie">Férié</span>` : "";
        rows.push(`<tr><td class="jour">${fk}${JOURS[i + k]}</td><td>${court(dk)}</td></tr>`);
      }
      i += span - 1;
      continue;
    } else if (e && e.statut !== "travail") {
      const texte = e.statut in ABSENCE_TEXTE ? ABSENCE_TEXTE[e.statut] : (e.texte || "ABSENCE").toUpperCase();
      cells = texte
        ? `<td>${court(d)}</td><td class="absence" colspan="5">${esc(texte)}</td>`
        : `<td>${court(d)}</td>` + `<td></td>`.repeat(5);
    } else {
      const total = minutesTravaillees(e);
      cells =
        `<td>${court(d)}</td>` +
        `<td>${affHeure(e?.arrivee)}</td><td>${affHeure(e?.debut_pause)}</td><td>${affHeure(e?.fin_pause)}</td>` +
        `<td>${affHeure(e?.depart)}</td><td>${affDuree(total)}</td>`;
    }
    rows.push(`<tr><td class="jour">${ferie}${JOURS[i]}</td>${cells}</tr>`);
  }
  return `
    <div class="week">
      <p class="semaine">SEMAINE:<span class="val">${joursDans.length ? esc(libelleSemaine(joursDans)) : ""}</span></p>
      <table>
        <colgroup><col class="c-jour"><col class="c-date"><col><col><col><col><col></colgroup>
        <thead><tr><th>Jour</th><th>Date</th><th>Heure d'arrivée</th><th>Départ en Pause</th><th>Arrivée de pause</th><th>Heure de départ</th><th>Total heures</th></tr></thead>
        <tbody>${rows.join("")}</tbody>
      </table>
    </div>`;
}

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const prenom = (nom) => String(nom).trim().split(/\s+/)[0];

function vendeursDuPlanning() {
  return state.settings.employes
    .filter((e) => e.colonne >= 1 && e.colonne <= 4)
    .sort((a, b) => a.colonne - b.colonne)
    .map((e) => ({ nom: e.nom, colonne: Number(e.colonne), repos: e.repos || [] }));
}
const salariesAImprimer = () => state.settings.employes.filter((e) => e.actif);

// Ce que fait chaque salarié chaque jour, d'après le planning du mois
function entreesDepuisPlanning(mois, donnees) {
  const dates = joursDuMois(mois).map(toISO);
  const res = {};
  for (const emp of state.settings.employes) {
    const jours = (res[emp.nom] = {});
    for (const d of dates) {
      const j = donnees.jours[d] || {};
      const code = Number(emp.colonne) > 0 ? j[emp.colonne] : null;
      const enRenfort = (j.extras || []).some((n) => trouverSalarie(n) === emp);
      if (code === "travail" || (!code && enRenfort)) jours[d] = { statut: "travail", ...heuresDuJour(emp, d) };
      else if (code) jours[d] = { statut: code, ...VIDE };
    }
  }
  return res;
}

function pagesFiches(mois, donnees) {
  const [y, m] = mois.split("-").map(Number);
  const debut = new Date(y, m - 1, 1), fin = new Date(y, m, 0);
  const semaines = semainesDeLaPeriode(debut, fin);
  const entrees = entreesDepuisPlanning(mois, donnees);
  const pages = [];
  for (const emp of salariesAImprimer()) {
    for (let p = 0; p < semaines.length; p += 3) {
      const bloc = semaines.slice(p, p + 3);
      pages.push(`
          <div class="sheet">
            <p class="title">FEUILLE DE PRESENCE HEBDOMADAIRE</p>
            <p class="field">BOUTIQUE:<span class="val">${esc(emp.boutique)}</span></p>
            <p class="field">SALARIÉ:<span class="val">${esc(emp.nom)}</span></p>
            ${bloc.map((jours) => htmlSemaine(jours, debut, fin, entrees[emp.nom] || {})).join("")}
            <p class="signature">SIGNATURE:</p>
          </div>`);
    }
  }
  return pages;
}

// ---------- Le planning du mois, au format de la feuille papier ----------
function pagePlanning(mois, donnees) {
  const [y, m] = mois.split("-").map(Number);
  const jours = joursDuMois(mois);
  const vend = vendeursDuPlanning();
  const boutique = state.settings.employes.find((e) => e.boutique)?.boutique || "";
  const hauteur = Math.min(6.4, 154 / jours.length).toFixed(2);
  const cellule = (s) => (s ? `<span class="pp-${s}">${TEXTE_PLANNING[s] || ""}</span>` : "");
  const lignes = jours
    .map((d) => {
      const k = toISO(d), j = donnees.jours[k] || {}, ji = dayIndex(d);
      const ex = j.extras || [];
      const com = planning?.commentaire(k) || "";
      return `<tr class="${ji === 0 ? "lundi" : ""}" style="height:${hauteur}mm">
        <td class="pp-date">${estFerie(d) ? `<span class="ferie">Férié</span>` : ""}Le ${d.getDate()}</td>
        <td class="pp-jour${ji >= 5 ? " we" : ""}">${JOURS[ji]}</td>
        ${vend.map((v) => `<td>${cellule(j[v.colonne])}</td>`).join("")}
        <td class="pp-extra">${esc(ex[0] || "")}</td>
        <td class="pp-extra">${esc(ex.slice(1).join(" / "))}</td>
        <td class="pp-com">${esc(com)}</td>
      </tr>`;
    })
    .join("");
  const n = vend.length;
  return `
          <div class="sheet paysage">
            <div class="pp-tete"><span>Magasin :<b>${esc(boutique)}</b></span><span>Mois :<b>${MOIS[m - 1][0].toUpperCase()}${MOIS[m - 1].slice(1)} ${y}</b></span></div>
            <table class="pp">
              <colgroup><col style="width:7.5%"><col style="width:10.5%">${vend.map(() => `<col style="width:${(40 / Math.max(n, 1)).toFixed(2)}%">`).join("")}<col style="width:9.5%"><col style="width:9.5%"><col></colgroup>
              <thead>
                <tr><th rowspan="2">Date</th><th rowspan="2">JOUR</th>${vend.map((_, i) => `<th>Vendeur ${i + 1}</th>`).join("")}<th rowspan="2">Extra</th><th rowspan="2">Extra</th><th rowspan="2">Commentaires, Acomptes et Retards</th></tr>
                <tr>${vend.map((v) => `<th class="pp-nom">${esc(prenom(v.nom))}</th>`).join("")}</tr>
              </thead>
              <tbody>${lignes}</tbody>
            </table>
          </div>`;
}

// ---------- Écran « Fiches » ----------
let planning = null;
let pagesCourantes = [];

function rendreFiches() {
  const mois = planning.mois();
  const donnees = planning.donnees();
  const [y, m] = mois.split("-").map(Number);
  const planningPage = pagePlanning(mois, donnees);
  const fiches = pagesFiches(mois, donnees);
  pagesCourantes = [planningPage, ...fiches];
  const total = pagesCourantes.length;
  const noms = ["Le planning du mois", ...fiches.map((_, i) => `Fiche ${i + 1}`)];
  document.getElementById("sheets").innerHTML = pagesCourantes
    .map((html, i) => `<p class="page-label no-print">Page ${i + 1} / ${total} · ${i === 0 ? "Planning du mois" : "Fiche de présence"}</p><div class="page-wrap">${html}</div>`)
    .join("");
  const nbSal = salariesAImprimer().length;
  document.getElementById("fiches-mois").textContent = `${MOIS[m - 1][0].toUpperCase()}${MOIS[m - 1].slice(1)} ${y}`;
  document.getElementById("fiches-detail").textContent = `Planning du mois + ${nbSal} fiche${nbSal > 1 ? "s" : ""} de présence · ${total} pages`;
  const nv = planning.nonValides();
  const alerte = document.getElementById("fiches-alerte");
  alerte.hidden = !nv;
  if (nv) document.getElementById("fiches-alerte-txt").textContent = `${nv} jour${nv > 1 ? "s" : ""} d'extras pas encore validé${nv > 1 ? "s" : ""} : le montant n'est pas imprimé.`;
  ajusterApercu();
  attenteToucher = false;
  majBoutonsImpression();
}

// Réduit chaque page à la largeur de l'écran
function ajusterApercu() {
  for (const wrap of document.querySelectorAll("#sheets .page-wrap")) {
    const sheet = wrap.firstElementChild;
    sheet.style.transform = "";
    const scale = wrap.clientWidth / sheet.offsetWidth;
    sheet.style.transform = `scale(${scale})`;
    wrap.style.height = `${sheet.offsetHeight * scale}px`;
  }
}

// ---------- PDF : planning du mois (paysage) + fiches (portrait) ----------
async function genererPDF(progression) {
  const { jsPDF, html2canvas } = await import("./vendor/pdf.js?v=24");
  const sheets = [...document.querySelectorAll("#sheets .sheet")];
  const stage = document.createElement("div");
  stage.style.cssText = "position:fixed;left:-10000px;top:0;";
  document.body.appendChild(stage);
  try {
    let pdf = null;
    for (let i = 0; i < sheets.length; i++) {
      progression?.(i + 1, sheets.length);
      await new Promise((r) => setTimeout(r, 20)); // laisse l'écran se rafraîchir
      const clone = sheets[i].cloneNode(true);
      clone.style.transform = "none";
      stage.replaceChildren(clone);
      const paysage = clone.classList.contains("paysage");
      const canvas = await html2canvas(clone, { scale: 2, backgroundColor: "#ffffff", logging: false });
      if (!pdf) pdf = new jsPDF({ unit: "mm", format: "a4", orientation: paysage ? "landscape" : "portrait" });
      else pdf.addPage("a4", paysage ? "landscape" : "portrait");
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, paysage ? 297 : 210, paysage ? 210 : 297);
      canvas.width = canvas.height = 0; // libère la mémoire (important sur les anciens iPhone)
    }
    return pdf.output("blob");
  } finally {
    stage.remove();
  }
}

// ----- Impression -----
// « Imprimer » ouvre directement la fenêtre d'impression de l'appareil (AirPrint en Wi-Fi sur iPhone).
// Le PDF n'est qu'une option : bouton « PDF » à côté, préparé seulement à la demande.
let pdfPret = null; // { sig, file }
let pdfEnCours = null; // { sig, promesse }
let attenteToucher = false; // PDF prêt, mais un nouveau toucher est nécessaire pour le partager
let progression = "";
let compteurPreparation = 0;

const signature = () => {
  let h = 0;
  for (const c of pagesCourantes.join("")) h = (h * 31 + c.charCodeAt(0)) | 0;
  return `${pagesCourantes.length}:${h}`;
};
const nomPDF = () => {
  const [y, m] = planning.mois().split("-").map(Number);
  return `Planning_et_fiches_${MOIS[m - 1]}_${y}.pdf`;
};

function majBoutonsImpression(message = "") {
  let texte = "PDF";
  if (pdfEnCours) texte = progression ? progression.replace("Préparation… page ", "") : "…";
  else if (attenteToucher) texte = "Prêt : toucher";
  for (const b of document.querySelectorAll(".btn-pdf")) {
    b.querySelector("span").textContent = texte;
    b.classList.toggle("occupe", !!pdfEnCours);
  }
  for (const m of document.querySelectorAll(".statut-impression")) m.textContent = message;
}

function preparerPDF() {
  const sig = signature();
  if (pdfPret?.sig === sig) return Promise.resolve(pdfPret);
  if (pdfEnCours?.sig === sig) return pdfEnCours.promesse;
  const numero = ++compteurPreparation;
  const promesse = genererPDF((i, n) => {
    if (numero === compteurPreparation) {
      progression = `Préparation… page ${i}/${n}`;
      majBoutonsImpression();
    }
  })
    .then((blob) => {
      const resultat = { sig, file: new File([blob], nomPDF(), { type: "application/pdf" }) };
      if (numero === compteurPreparation) pdfPret = resultat;
      return resultat;
    })
    .finally(() => {
      if (pdfEnCours?.promesse === promesse) pdfEnCours = null;
      progression = "";
      majBoutonsImpression();
    });
  pdfEnCours = { sig, promesse };
  majBoutonsImpression();
  return promesse;
}

async function partagerFichier(file) {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Planning et fiches" });
    } catch (err) {
      if (err?.name === "AbortError") return;
      if (err?.name === "NotAllowedError") {
        attenteToucher = true; // le toucher est trop ancien : un nouveau toucher suffira
        majBoutonsImpression("Le PDF est prêt : touchez « PDF » une fois de plus.");
        return;
      }
      throw err;
    }
  } else {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }
}

async function pdf() {
  if (pdfEnCours) return;
  try {
    const encore = attenteToucher;
    attenteToucher = false;
    majBoutonsImpression();
    const pret = pdfPret?.sig === signature() ? pdfPret : await preparerPDF();
    await partagerFichier(pret.file);
    if (!attenteToucher && !encore) majBoutonsImpression("");
  } catch (err) {
    majBoutonsImpression(`PDF impossible : ${err.message}`);
  }
}

// Sans prise en charge des pages nommées (anciens navigateurs), le planning est tourné pour tenir sur une page portrait
const pagesNommees = () => "page" in document.documentElement.style;

function imprimer() {
  document.documentElement.classList.toggle("print-rotation", !pagesNommees());
  let ouverte = false;
  const marque = () => (ouverte = true);
  window.addEventListener("beforeprint", marque, { once: true });
  try {
    window.print();
  } catch {
    /* repli ci-dessous */
  }
  // Certains téléphones n'ouvrent pas la fenêtre d'impression : on propose alors le PDF
  setTimeout(() => {
    window.removeEventListener("beforeprint", marque);
    if (!ouverte) {
      majBoutonsImpression("L'impression directe ne s'est pas ouverte : préparation du PDF, puis choisissez « Imprimer » dans la liste.");
      pdf();
    }
  }, 1200);
}

// ---------- Réglages ----------
function rendreReglages() {
  for (const r of document.querySelectorAll('input[name="taille"]')) r.checked = r.value === state.settings.taille;
  document.getElementById("s-tarif").value = state.settings.tarifExtra;
  const list = document.getElementById("s-employes");
  list.innerHTML = state.settings.employes
    .map(
      (e, i) => `
      <div class="emp liste" data-i="${i}">
        <div class="ligne emp-top">
          <span class="avatar" aria-hidden="true">${esc((e.nom || "?").trim()[0] || "?").toUpperCase()}</span>
          <input type="text" class="emp-nom" value="${esc(e.nom)}" placeholder="Nom" aria-label="Nom">
          <label class="interrupteur" aria-label="Recevoir une fiche"><input type="checkbox" class="emp-actif" ${e.actif ? "checked" : ""}><i></i></label>
        </div>
        <label class="ligne"><span class="ligne-nom">Boutique</span>
          <input type="text" class="emp-boutique" value="${esc(e.boutique)}" placeholder="Boutique" aria-label="Boutique">
        </label>
        <label class="ligne"><span class="ligne-nom">Colonne du planning</span>
          <select class="emp-colonne">
            ${[0, 1, 2, 3, 4].map((c) => `<option value="${c}"${Number(e.colonne) === c ? " selected" : ""}>${c ? `Vendeur ${c}` : "Aucune"}</option>`).join("")}
          </select>
        </label>
        <div class="ligne ligne-col emp-repos">
          <span class="ligne-nom">Repos habituels</span>
          <span class="jours">${["L", "M", "M", "J", "V", "S", "D"]
            .map((j, k) => `<label><input type="checkbox" class="emp-rj" value="${k}"${(e.repos || []).includes(k) ? " checked" : ""}><span>${j}</span></label>`)
            .join("")}</span>
        </div>
        <details class="emp-h">
          <summary class="ligne"><span class="ligne-nom">Horaires habituels</span><span class="chevron" aria-hidden="true"></span></summary>
          <div class="h-grid">
            <span></span><span>Arrivée</span><span>Pause</span><span>Reprise</span><span>Départ</span>
            ${JOURS_COURTS.map(
              (j, k) =>
                `<span>${j}</span>` +
                ["arrivee", "debut_pause", "fin_pause", "depart"]
                  .map((f) => `<input type="time" data-k="${k}" data-f="${f}" value="${esc(e.horaires?.[k]?.[f] || "")}" aria-label="${j} ${f}">`)
                  .join(""),
            ).join("")}
          </div>
        </details>
        <button type="button" class="ligne ligne-action rouge del">Supprimer ce salarié</button>
      </div>`,
    )
    .join("");
}

function lireHoraires(div) {
  const h = Array.from({ length: 7 }, () => ({ ...VIDE }));
  for (const input of div.querySelectorAll(".h-grid input")) h[Number(input.dataset.k)][input.dataset.f] = input.value || "";
  return h;
}

function lireReglages() {
  const rows = [...document.querySelectorAll("#s-employes .emp")];
  const anciens = state.settings.employes;
  const employes = rows
    .map((r) => ({
      ancien: anciens[Number(r.dataset.i)]?.nom,
      nom: r.querySelector(".emp-nom").value.trim(),
      boutique: r.querySelector(".emp-boutique").value.trim(),
      actif: r.querySelector(".emp-actif").checked,
      horaires: lireHoraires(r),
      colonne: Number(r.querySelector(".emp-colonne").value),
      repos: [...r.querySelectorAll(".emp-rj:checked")].map((i) => Number(i.value)),
    }))
    .filter((e) => e.nom);
  // Un salarié renommé garde ses horaires
  for (const e of employes) {
    if (e.ancien && e.ancien !== e.nom && state.planning[e.ancien] && !state.planning[e.nom]) {
      state.planning[e.nom] = state.planning[e.ancien];
      delete state.planning[e.ancien];
    }
    delete e.ancien;
  }
  state.settings.employes = employes;
  state.settings.taille = document.querySelector('input[name="taille"]:checked')?.value || "grand";
  const tarif = Number(document.getElementById("s-tarif").value);
  state.settings.tarifExtra = Number.isFinite(tarif) && tarif >= 0 ? tarif : 100;
}


function montrerVue(vue) {
  const fiches = vue === "fiches";
  document.getElementById("vue-planning").hidden = fiches;
  document.getElementById("vue-fiches").hidden = !fiches;
  document.body.classList.toggle("en-planning", !fiches);
  for (const b of document.querySelectorAll(".onglets button")) b.classList.toggle("actif", b.dataset.vue === vue);
  window.scrollTo({ top: 0 });
  if (fiches) {
    rendreFiches();
    requestAnimationFrame(ajusterApercu);
  }
}

function init() {
  const $ = (id) => document.getElementById(id);
  const dlg = $("settings");

  const ouvrirReglages = () => {
    rendreReglages();
    dlg.returnValue = "";
    dlg.showModal();
  };
  planning = initPlanning({
    vendeurs: vendeursDuPlanning,
    extrasConnus: () => state.settings.extras,
    tarifDefaut: () => state.settings.tarifExtra,
    ajouterExtra: (nom) => {
      if (!state.settings.extras.includes(nom)) state.settings.extras.push(nom);
      save();
    },
    estFerie,
    onFiches: () => montrerVue("fiches"),
    ouvrirReglages,
  });
  for (const b of document.querySelectorAll(".onglets button")) b.addEventListener("click", () => montrerVue(b.dataset.vue));
  for (const b of document.querySelectorAll(".btn-imprimer")) b.addEventListener("click", imprimer);
  for (const b of document.querySelectorAll(".btn-pdf")) b.addEventListener("click", pdf);
  window.addEventListener("afterprint", ajusterApercu);
  $("fiches-valider").addEventListener("click", () => {
    montrerVue("planning");
    planning.allerExtras();
  });
  $("btn-settings").addEventListener("click", ouvrirReglages);

  $("s-add-emp").addEventListener("click", () => {
    lireReglages();
    state.settings.employes.push({
      nom: "",
      boutique: state.settings.employes[0]?.boutique || "",
      actif: true,
      horaires: structuredClone(state.settings.employes[0]?.horaires || HORAIRES_DEFAUT),
      colonne: 0,
      repos: [],
    });
    rendreReglages();
    const inputs = document.querySelectorAll("#s-employes .emp-nom");
    inputs[inputs.length - 1]?.focus();
  });
  $("s-employes").addEventListener("click", (ev) => {
    if (!ev.target.classList.contains("del")) return;
    lireReglages();
    state.settings.employes.splice(Number(ev.target.closest(".emp").dataset.i), 1);
    rendreReglages();
  });
  $("s-exemple").addEventListener("click", () => {
    if (!confirm("Remettre le planning de novembre 2026 d'origine ? Vos changements de ce mois seront perdus.")) return;
    try {
      localStorage.removeItem("fp.pl.2026-11");
    } catch {
      /* ignoré */
    }
    dlg.close("cancel");
    planning.rafraichir();
  });
  $("s-clear").addEventListener("click", () => {
    if (!confirm("Effacer tous les plannings enregistrés sur ce téléphone ?")) return;
    store.retirer("fp.pl.");
    dlg.close("cancel");
    planning.rafraichir();
  });
  dlg.addEventListener("close", () => {
    if (dlg.returnValue !== "save") return;
    lireReglages();
    save();
    appliquerTaille();
    planning.rafraichir();
    if (!$("vue-fiches").hidden) rendreFiches();
  });

  let t;
  window.addEventListener("resize", () => {
    clearTimeout(t);
    t = setTimeout(ajusterApercu, 100);
  });
}

init();
