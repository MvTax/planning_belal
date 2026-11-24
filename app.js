// Fiches de présence — photo du planning → fiches hebdomadaires remplies → impression.
// Tout tourne dans le navigateur ; les données restent sur le téléphone (localStorage).

const MODEL = "claude-opus-5-5";
const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const JOURS_COURTS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const STATUTS = {
  travail: "Travail",
  repos: "Repos",
  conge: "Congé payé",
  maladie: "Maladie",
  absent: "Absent",
  autre: "Autre absence",
};
const ABSENCE_TEXTE = { conge: "CONGÉ PAYÉ", maladie: "MALADIE", absent: "ABSENT", autre: "ABSENCE" };

const DEFAULT_SETTINGS = {
  employes: [{ nom: "Belal N'DAO", boutique: "NOA", actif: true }],
  pause: { active: true, debut: "15:00", fin: "16:00" },
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
};

const state = {
  settings: store.get("fp.settings", structuredClone(DEFAULT_SETTINGS)),
  apiKey: store.get("fp.apikey", ""),
  planning: store.get("fp.planning", {}), // { nom: { "YYYY-MM-DD": entrée } }
  periode: store.get("fp.periode", null), // { debut, fin }
  remarques: store.get("fp.remarques", ""),
  photos: [], // File[]
};

function save() {
  store.set("fp.settings", state.settings);
  store.set("fp.apikey", state.apiKey);
  store.set("fp.planning", state.planning);
  store.set("fp.periode", state.periode);
  store.set("fp.remarques", state.remarques);
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

function appliquerPauseParDefaut(e) {
  const p = state.settings.pause;
  if (!p?.active || e.statut !== "travail" || e.debut_pause || e.fin_pause) return e;
  if (!e.arrivee || !e.depart || !p.debut || !p.fin) return e;
  if (toMin(e.arrivee) <= toMin(p.debut) && toMin(e.depart) >= toMin(p.fin)) {
    return { ...e, debut_pause: p.debut, fin_pause: p.fin };
  }
  return e;
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

// ---------- Lecture de la photo par Claude ----------
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["salaries", "remarques"],
  properties: {
    salaries: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["nom", "jours"],
        properties: {
          nom: { type: "string" },
          jours: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["date", "statut", "arrivee", "debut_pause", "fin_pause", "depart", "incertain"],
              properties: {
                date: { type: "string", description: "Date au format YYYY-MM-DD" },
                statut: { type: "string", enum: Object.keys(STATUTS) },
                arrivee: { type: "string", description: "HH:MM sur 24 h, ou chaîne vide" },
                debut_pause: { type: "string", description: "HH:MM sur 24 h, ou chaîne vide" },
                fin_pause: { type: "string", description: "HH:MM sur 24 h, ou chaîne vide" },
                depart: { type: "string", description: "HH:MM sur 24 h, ou chaîne vide" },
                incertain: { type: "boolean" },
              },
            },
          },
        },
      },
    },
    remarques: { type: "string" },
  },
};

const SYSTEM_PROMPT = `Tu lis des photos de plannings de boutique (souvent manuscrits) et tu en extrais les horaires de chaque salarié, jour par jour, pour remplir ensuite des feuilles de présence hebdomadaires.

Règles :
- Une entrée par salarié et par jour visible sur le planning, y compris les jours de repos.
- date : format YYYY-MM-DD. Déduis le mois et l'année des en-têtes du planning ; si l'année n'est écrite nulle part, prends celle qui place ces dates le plus près de la date du jour fournie.
- Heures sur 24 h au format HH:MM. "10h" → "10:00", "20h30" → "20:30". En boutique, une heure de fin écrite "7" ou "8:30" après une arrivée le matin veut dire 19:00 ou 20:30.
- debut_pause / fin_pause : seulement si la pause est indiquée sur le planning (par ex. "10h-15h / 16h-20h30" donne une pause de 15:00 à 16:00). Sinon laisse des chaînes vides : n'invente pas de pause.
- statut : "travail" quand il y a des horaires ; "repos" pour R, Repos, OFF, une croix ou une case vide un jour sans horaires ; "conge" pour CP / congé ; "maladie" pour arrêt maladie ; "absent" pour une absence ; "autre" pour toute autre absence. Pour un jour sans travail, laisse toutes les heures vides.
- Recopie les noms tels qu'écrits. Si un nom correspond à un salarié connu de la liste fournie, utilise exactement l'orthographe de la liste.
- incertain : true si tu as dû deviner un chiffre, une date ou un nom difficile à lire.
- remarques : en français, une ou deux phrases courtes sur ce qui était difficile à lire ou ambigu ; chaîne vide si tout est clair.`;

async function preparerImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error(`Impossible d'ouvrir la photo « ${file.name} ».`));
      i.src = url;
    });
    const MAX = 2000;
    const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.9).split(",")[1];
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function lirePlanning(files) {
  const { Anthropic } = await import("./vendor/anthropic.js");
  const images = await Promise.all(files.map(preparerImage));
  const client = new Anthropic({ apiKey: state.apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });
  const connus = state.settings.employes.map((e) => `${e.nom} (boutique ${e.boutique})`).join(", ");

  let response;
  try {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "high", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            ...images.map((data) => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } })),
            {
              type: "text",
              text: `Date du jour : ${toISO(new Date())}.\nSalariés connus : ${connus || "aucun"}.\nLis ce planning et renvoie les horaires de chaque salarié pour chaque jour visible.`,
            },
          ],
        },
      ],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new Error("Clé API refusée. Vérifiez-la dans les réglages (⚙︎).");
    if (err instanceof Anthropic.PermissionDeniedError) throw new Error("Cette clé API n'a pas accès au modèle. Vérifiez votre compte Anthropic.");
    if (err instanceof Anthropic.RateLimitError) throw new Error("Trop de demandes ou crédit épuisé. Réessayez dans une minute ou vérifiez votre crédit Anthropic.");
    if (err instanceof Anthropic.APIConnectionError) throw new Error("Pas de connexion internet. Réessayez.");
    if (err instanceof Anthropic.APIError) throw new Error(`Erreur du service (${err.status ?? "?"}) : ${err.message}`);
    throw err;
  }

  if (response.stop_reason === "refusal") throw new Error("La photo n'a pas pu être analysée. Reprenez une photo du planning.");
  if (response.stop_reason === "max_tokens") throw new Error("Le planning est trop long pour une seule photo. Essayez avec moins de semaines par photo.");
  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Réponse illisible. Réessayez.");
  }
}

function integrerResultat(result) {
  const dates = [];
  for (const sal of result.salaries || []) {
    let emp = trouverSalarie(sal.nom);
    if (!emp) {
      // Nouveau salarié détecté : ajouté aux réglages, décoché par défaut.
      emp = { nom: sal.nom.trim(), boutique: state.settings.employes[0]?.boutique || "", actif: false };
      if (!emp.nom) continue;
      state.settings.employes.push(emp);
    }
    const jours = (state.planning[emp.nom] ||= {});
    for (const j of sal.jours || []) {
      if (!isISODate(j.date)) continue;
      const statut = STATUTS[j.statut] ? j.statut : "travail";
      let entree = {
        statut,
        arrivee: statut === "travail" ? normTime(j.arrivee) : "",
        debut_pause: statut === "travail" ? normTime(j.debut_pause) : "",
        fin_pause: statut === "travail" ? normTime(j.fin_pause) : "",
        depart: statut === "travail" ? normTime(j.depart) : "",
        incertain: !!j.incertain,
      };
      entree = appliquerPauseParDefaut(entree);
      jours[j.date] = entree;
      if (emp.actif) dates.push(j.date);
    }
  }
  if (!dates.length) {
    // Aucun salarié coché trouvé : on prend toutes les dates lues
    for (const sal of result.salaries || []) for (const j of sal.jours || []) if (isISODate(j.date)) dates.push(j.date);
  }
  if (!dates.length) throw new Error("Aucune date lisible sur la photo. Reprenez la photo bien à plat, avec tout le planning visible.");
  dates.sort();
  state.periode = { debut: dates[0], fin: dates[dates.length - 1] };
  state.remarques = result.remarques || "";
  save();
}

// ---------- Génération des fiches ----------
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

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

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
      cells = `<td>${court(d)}</td><td class="absence" colspan="5">${esc(ABSENCE_TEXTE[e.statut] || "ABSENCE")}</td>`;
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

function salariesAImprimer() {
  return state.settings.employes.filter((e) => e.actif);
}

function rendreFiches() {
  const container = document.getElementById("sheets");
  if (!state.periode) {
    container.innerHTML = "";
    return;
  }
  const debut = fromISO(state.periode.debut);
  const fin = fromISO(state.periode.fin);
  const semaines = semainesDeLaPeriode(debut, fin);
  const pages = [];
  for (const emp of salariesAImprimer()) {
    const entrees = state.planning[emp.nom] || {};
    for (let p = 0; p < semaines.length; p += 3) {
      const bloc = semaines.slice(p, p + 3);
      pages.push(`
        <div class="page-wrap">
          <div class="sheet">
            <p class="title">FEUILLE DE PRESENCE HEBDOMADAIRE</p>
            <p class="field">BOUTIQUE:<span class="val">${esc(emp.boutique)}</span></p>
            <p class="field">SALARIÉ:<span class="val">${esc(emp.nom)}</span></p>
            ${bloc.map((jours) => htmlSemaine(jours, debut, fin, entrees)).join("")}
            <p class="signature">SIGNATURE:</p>
          </div>
        </div>`);
    }
  }
  const total = pages.length;
  container.innerHTML = pages
    .map((html, i) => `<p class="page-label no-print">Page ${i + 1} / ${total}</p>${html}`)
    .join("");
  ajusterApercu();
}

// Réduit chaque page A4 à la largeur de l'écran
function ajusterApercu() {
  for (const wrap of document.querySelectorAll("#sheets .page-wrap")) {
    const sheet = wrap.firstElementChild;
    sheet.style.transform = "";
    const scale = wrap.clientWidth / sheet.offsetWidth;
    sheet.style.transform = `scale(${scale})`;
    wrap.style.height = `${sheet.offsetHeight * scale}px`;
  }
}

// ---------- Écran de vérification ----------
function rendreVerification() {
  const body = document.getElementById("review-body");
  if (!state.periode) {
    body.innerHTML = "";
    return;
  }
  const debut = fromISO(state.periode.debut);
  const fin = fromISO(state.periode.fin);
  const semaines = semainesDeLaPeriode(debut, fin);
  const html = [];
  for (const emp of salariesAImprimer()) {
    html.push(`<div class="rev-emp"><h3>${esc(emp.nom)}</h3>`);
    for (const jours of semaines) {
      const dansLaSemaine = jours.filter((d) => d >= debut && d <= fin);
      html.push(`<p class="rev-week">Semaine ${esc(libelleSemaine(dansLaSemaine))}</p>`);
      for (const d of dansLaSemaine) {
        const iso = toISO(d);
        const e = state.planning[emp.nom]?.[iso] || { statut: "travail", arrivee: "", debut_pause: "", fin_pause: "", depart: "" };
        const attrs = `data-nom="${esc(emp.nom)}" data-date="${iso}"`;
        const opt = Object.entries(STATUTS)
          .map(([k, v]) => `<option value="${k}"${k === e.statut ? " selected" : ""}>${v}</option>`)
          .join("");
        const champ = (f, label) =>
          `<label>${label}<input type="time" ${attrs} data-field="${f}" value="${esc(e[f] || "")}"></label>`;
        html.push(`
          <div class="rev-day${e.incertain ? " incertain" : ""}">
            <div class="rev-head">
              <span class="d">${JOURS_COURTS[dayIndex(d)]} ${court(d)}${estFerie(d) ? ` <span class="ferie-tag">férié</span>` : ""}</span>
              <select ${attrs} data-field="statut" aria-label="Statut du ${court(d)}">${opt}</select>
              <span class="tot">${affDuree(minutesTravaillees(e))}</span>
            </div>
            <div class="rev-times${e.statut === "travail" ? "" : " off"}">
              ${champ("arrivee", "Arrivée")}${champ("debut_pause", "Pause")}${champ("fin_pause", "Reprise")}${champ("depart", "Départ")}
            </div>
          </div>`);
      }
    }
    html.push(`</div>`);
  }
  body.innerHTML = html.join("") || `<p class="small">Aucun salarié coché dans les réglages.</p>`;
}

function onEditionHoraire(ev) {
  const el = ev.target;
  const { nom, date, field } = el.dataset;
  if (!nom || !date || !field) return;
  const jours = (state.planning[nom] ||= {});
  const e = (jours[date] ||= { statut: "travail", arrivee: "", debut_pause: "", fin_pause: "", depart: "" });
  e[field] = field === "statut" ? el.value : normTime(el.value);
  e.incertain = false;
  if (field === "statut" && e.statut !== "travail") {
    e.arrivee = e.debut_pause = e.fin_pause = e.depart = "";
  }
  save();
  const card = el.closest(".rev-day");
  card.classList.remove("incertain");
  card.querySelector(".rev-times").classList.toggle("off", e.statut !== "travail");
  card.querySelector(".tot").textContent = affDuree(minutesTravaillees(e));
  rendreFiches();
}

// ---------- Impression / PDF ----------
async function genererPDF() {
  const { jsPDF, html2canvas } = await import("./vendor/pdf.js");
  const sheets = [...document.querySelectorAll("#sheets .sheet")];
  // Rendu hors écran à taille réelle (sans la réduction de l'aperçu)
  const stage = document.createElement("div");
  stage.style.cssText = "position:fixed;left:-10000px;top:0;";
  document.body.appendChild(stage);
  try {
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    for (let i = 0; i < sheets.length; i++) {
      const clone = sheets[i].cloneNode(true);
      clone.style.transform = "none";
      stage.replaceChildren(clone);
      const canvas = await html2canvas(clone, { scale: 2, backgroundColor: "#ffffff", logging: false });
      if (i > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 210, 296);
    }
    return pdf.output("blob");
  } finally {
    stage.remove();
  }
}

function nomFichier() {
  const p = state.periode;
  return `Fiches_presence_${p?.debut ?? ""}_${p?.fin ?? ""}.pdf`;
}

async function partagerPDF() {
  setStatus("Création du PDF…", "busy");
  try {
    const blob = await genererPDF();
    const file = new File([blob], nomFichier(), { type: "application/pdf" });
    setStatus("");
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Fiches de présence" });
      } catch (err) {
        if (err?.name !== "AbortError") throw err;
      }
    } else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    }
  } catch (err) {
    setStatus(`PDF impossible : ${err.message}`, "error");
  }
}

function imprimer() {
  // Dans l'appli ajoutée à l'écran d'accueil d'iPhone, window.print() n'est pas fiable :
  // on passe par le PDF et la feuille de partage (qui contient « Imprimer »).
  if (navigator.standalone || matchMedia("(display-mode: standalone)").matches) return partagerPDF();
  window.print();
}

// ---------- Réglages ----------
function rendreReglages() {
  document.getElementById("s-apikey").value = state.apiKey;
  const list = document.getElementById("s-employes");
  list.innerHTML = state.settings.employes
    .map(
      (e, i) => `
      <div class="emp-row" data-i="${i}">
        <input type="checkbox" class="emp-actif" ${e.actif ? "checked" : ""} aria-label="Imprimer une fiche">
        <input type="text" class="emp-nom" value="${esc(e.nom)}" placeholder="Nom" aria-label="Nom">
        <input type="text" class="emp-boutique" value="${esc(e.boutique)}" placeholder="Boutique" aria-label="Boutique">
        <button type="button" class="del" aria-label="Supprimer">×</button>
      </div>`,
    )
    .join("");
  const p = state.settings.pause;
  document.getElementById("s-pause-on").checked = !!p.active;
  document.getElementById("s-pause-debut").value = p.debut;
  document.getElementById("s-pause-fin").value = p.fin;
}

function lireReglages() {
  const rows = [...document.querySelectorAll("#s-employes .emp-row")];
  const anciens = state.settings.employes;
  const employes = rows
    .map((r) => ({
      ancien: anciens[Number(r.dataset.i)]?.nom,
      nom: r.querySelector(".emp-nom").value.trim(),
      boutique: r.querySelector(".emp-boutique").value.trim(),
      actif: r.querySelector(".emp-actif").checked,
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
  state.settings.pause = {
    active: document.getElementById("s-pause-on").checked,
    debut: document.getElementById("s-pause-debut").value || "15:00",
    fin: document.getElementById("s-pause-fin").value || "16:00",
  };
  state.apiKey = document.getElementById("s-apikey").value.trim();
}

function chargerExemple() {
  const t = (arrivee, depart, statut = "travail") =>
    statut === "travail"
      ? { statut, arrivee, debut_pause: "15:00", fin_pause: "16:00", depart }
      : { statut, arrivee: "", debut_pause: "", fin_pause: "", depart: "" };
  const L = () => t("10:00", "20:30"), D = () => t("11:00", "19:00"), R = () => t("", "", "repos");
  const nom = "Belal N'DAO";
  if (!state.settings.employes.some((e) => e.nom === nom)) state.settings.employes.unshift({ nom, boutique: "NOA", actif: true });
  state.planning[nom] = {
    "2026-11-01": D(),
    "2026-11-02": L(), "2026-11-03": L(), "2026-11-04": R(), "2026-11-05": R(), "2026-11-06": L(), "2026-11-07": L(), "2026-11-08": D(),
    "2026-11-09": L(), "2026-11-10": L(), "2026-11-11": R(), "2026-11-12": R(), "2026-11-13": L(), "2026-11-14": L(), "2026-11-15": D(),
  };
  state.periode = { debut: "2026-11-01", fin: "2026-11-15" };
  state.remarques = "";
  save();
}

// ---------- Interface ----------
function setStatus(msg, kind = "") {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.className = `status ${kind}`;
}

function afficherResultat() {
  const has = !!state.periode;
  document.getElementById("step-result").hidden = !has;
  if (has) {
    document.getElementById("p-debut").value = state.periode.debut;
    document.getElementById("p-fin").value = state.periode.fin;
  }
  const rq = document.getElementById("remarques");
  rq.hidden = !state.remarques;
  rq.textContent = state.remarques ? `À vérifier : ${state.remarques}` : "";
  rendreVerification();
  rendreFiches();
}

function rendreMiniatures() {
  const thumbs = document.getElementById("thumbs");
  for (const img of thumbs.querySelectorAll("img")) URL.revokeObjectURL(img.src);
  thumbs.innerHTML = state.photos
    .map((f, i) => `<div class="thumb"><img alt="Photo ${i + 1}" src="${URL.createObjectURL(f)}"><button type="button" data-i="${i}" aria-label="Retirer">×</button></div>`)
    .join("");
  document.getElementById("btn-analyser").disabled = state.photos.length === 0;
}

function init() {
  const $ = (id) => document.getElementById(id);
  const dlg = $("settings");

  $("photo-input").addEventListener("change", (ev) => {
    state.photos.push(...ev.target.files);
    ev.target.value = "";
    rendreMiniatures();
    setStatus("");
  });
  $("thumbs").addEventListener("click", (ev) => {
    const i = ev.target.dataset?.i;
    if (i == null) return;
    state.photos.splice(Number(i), 1);
    rendreMiniatures();
  });

  $("btn-analyser").addEventListener("click", async () => {
    if (!state.apiKey) {
      setStatus("Ajoutez d'abord votre clé API Claude dans les réglages.", "error");
      rendreReglages();
      dlg.returnValue = "";
      dlg.showModal();
      return;
    }
    const btn = $("btn-analyser");
    btn.disabled = true;
    setStatus("Lecture du planning en cours… (30 s à 1 min)", "busy");
    try {
      const result = await lirePlanning(state.photos);
      integrerResultat(result);
      state.photos = [];
      rendreMiniatures();
      setStatus("Fiches remplies. Vérifiez l'aperçu puis imprimez.");
      afficherResultat();
      $("step-result").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      setStatus(err.message || String(err), "error");
    } finally {
      btn.disabled = state.photos.length === 0;
    }
  });

  $("link-manuel").addEventListener("click", (ev) => {
    ev.preventDefault();
    if (!state.periode) {
      const now = new Date();
      state.periode = { debut: toISO(new Date(now.getFullYear(), now.getMonth(), 1)), fin: toISO(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
      save();
    }
    afficherResultat();
    $("review").open = true;
    $("step-result").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  const onPeriode = () => {
    const debut = $("p-debut").value, fin = $("p-fin").value;
    if (!isISODate(debut) || !isISODate(fin) || debut > fin) return;
    state.periode = { debut, fin };
    save();
    rendreVerification();
    rendreFiches();
  };
  $("p-debut").addEventListener("change", onPeriode);
  $("p-fin").addEventListener("change", onPeriode);

  $("review-body").addEventListener("change", onEditionHoraire);
  $("btn-print").addEventListener("click", imprimer);
  $("btn-pdf").addEventListener("click", partagerPDF);

  $("btn-settings").addEventListener("click", () => {
    rendreReglages();
    dlg.returnValue = "";
    dlg.showModal();
  });
  $("s-add-emp").addEventListener("click", () => {
    lireReglages();
    state.settings.employes.push({ nom: "", boutique: state.settings.employes[0]?.boutique || "", actif: true });
    rendreReglages();
    const inputs = document.querySelectorAll("#s-employes .emp-nom");
    inputs[inputs.length - 1]?.focus();
  });
  $("s-employes").addEventListener("click", (ev) => {
    if (!ev.target.classList.contains("del")) return;
    lireReglages();
    state.settings.employes.splice(Number(ev.target.closest(".emp-row").dataset.i), 1);
    rendreReglages();
  });
  $("s-exemple").addEventListener("click", () => {
    lireReglages();
    chargerExemple();
    dlg.close("cancel");
    afficherResultat();
  });
  $("s-clear").addEventListener("click", () => {
    if (!confirm("Effacer tous les horaires enregistrés sur ce téléphone ?")) return;
    state.planning = {};
    state.periode = null;
    state.remarques = "";
    save();
    dlg.close("cancel");
    afficherResultat();
  });
  dlg.addEventListener("close", () => {
    if (dlg.returnValue !== "save") return;
    lireReglages();
    save();
    afficherResultat();
  });

  let t;
  window.addEventListener("resize", () => {
    clearTimeout(t);
    t = setTimeout(ajusterApercu, 100);
  });
  // Le navigateur remet l'aperçu à l'échelle après l'impression
  window.addEventListener("afterprint", ajusterApercu);

  afficherResultat();

}

init();
