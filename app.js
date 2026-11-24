// Fiches de présence — photo du planning → fiches hebdomadaires remplies → impression.
// Tout tourne dans le navigateur ; les données restent sur le téléphone (localStorage).

const MODEL = "claude-opus-5-5";
const GEMINI_DEFAUT = "gemini-3.8-flash"; // utilisé seulement si la liste des modèles est inaccessible
const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const JOURS_COURTS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const STATUTS = {
  travail: "Travaille (OK)",
  repos: "Repos",
  conge: "Congé payé (CP)",
  ecole: "École",
  maladie: "Maladie",
  absent: "Absent",
  remplace: "Remplacé(e)",
  autre: "Autre",
};
// Texte écrit en rouge sur la ligne de la fiche ("" = ligne laissée vide, seulement la date)
const ABSENCE_TEXTE = { conge: "CONGÉ PAYÉ", ecole: "ÉCOLE", maladie: "MALADIE", absent: "ABSENT", remplace: "" };

// Horaires habituels (lundi → dimanche). Le planning dit seulement « OK » : les heures viennent d'ici.
const H = (arrivee, debut_pause, fin_pause, depart) => ({ arrivee, debut_pause, fin_pause, depart });
const HORAIRES_DEFAUT = [
  ...Array.from({ length: 6 }, () => H("10:00", "15:00", "16:00", "20:30")),
  H("11:00", "15:00", "16:00", "19:00"),
];

const DEFAULT_SETTINGS = {
  employes: [{ nom: "Belal N'DAO", boutique: "NOA", actif: true, horaires: HORAIRES_DEFAUT }],
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
  provider: store.get("fp.provider", "gemini"), // "gemini" ou "claude"
  geminiKey: store.get("fp.geminikey", ""),
  apiKey: store.get("fp.apikey", ""), // clé Claude
  planning: store.get("fp.planning", {}), // { nom: { "YYYY-MM-DD": entrée } }
  periode: store.get("fp.periode", null), // { debut, fin }
  remarques: store.get("fp.remarques", ""),
  photos: [], // File[]
};
// Réglages enregistrés par une version précédente : on ajoute les horaires habituels
delete state.settings.pause;
for (const e of state.settings.employes) e.horaires ||= structuredClone(HORAIRES_DEFAUT);

function save() {
  store.set("fp.settings", state.settings);
  store.set("fp.provider", state.provider);
  store.set("fp.geminikey", state.geminiKey);
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

// ---------- Lecture de la photo (Gemini ou Claude) ----------
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
              required: ["date", "statut", "texte", "arrivee", "depart", "incertain"],
              properties: {
                date: { type: "string", description: "Date au format YYYY-MM-DD" },
                statut: { type: "string", enum: Object.keys(STATUTS) },
                texte: { type: "string", description: "Ce qui est écrit dans la case, recopié tel quel" },
                arrivee: { type: "string", description: "HH:MM sur 24 h si une heure est écrite, sinon chaîne vide" },
                depart: { type: "string", description: "HH:MM sur 24 h si une heure est écrite, sinon chaîne vide" },
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

const SYSTEM_PROMPT = `Tu lis la photo du planning mensuel manuscrit d'une boutique, pour remplir ensuite la feuille de présence de chaque vendeur.

Format habituel du planning :
- En haut : "Magasin" et "Mois" (par exemple "Novembre 2026").
- Une ligne par jour : colonne Date ("Le 1", "Le 2"…) et colonne JOUR (lundi, mardi…).
- Colonnes "Vendeur 1" à "Vendeur 4" : le prénom du vendeur est écrit sous l'en-tête. Chaque case dit ce que fait ce vendeur ce jour-là.
- Colonnes "Extra" : prénoms des personnes venues en renfort ce jour-là.
- Colonne "Commentaires, Acomptes et Retards" : à ignorer.
- La mention "Férié" dans la marge : à ignorer (les jours fériés sont calculés à part).

Pour chaque vendeur, une entrée par jour du mois, avec le contenu de la case recopié dans texte :
- "OK" → statut "travail".
- "Repos" (souvent écrit en rouge) → "repos".
- "CP" → "conge". "École" → "ecole". "Maladie" ou "AM" → "maladie". "Absent" ou "ABS" → "absent".
- Un autre prénom écrit dans la case (par exemple "Shaily" dans la colonne de Maeva) → "remplace".
- Toute autre mention (sigle, mot inconnu) → "autre".
- Case vide → "repos" avec incertain = true.
- arrivee / depart : seulement si des heures sont écrites dans la case (par exemple "10h-19h" donne "10:00" et "19:00"), au format HH:MM sur 24 h. Sinon chaîne vide : les horaires habituels sont ajoutés ensuite.

Personnes en extra : pour chaque prénom écrit dans une colonne Extra, ajoute une entrée "travail" pour cette personne ce jour-là, sauf si elle a déjà une entrée ce jour-là dans sa propre colonne de vendeur. Jamais deux entrées pour la même personne le même jour.

Si le planning a un autre format (par exemple des heures dans les cases), applique les mêmes statuts.

- date : YYYY-MM-DD, à partir du numéro du jour et du mois écrit en haut. Vérifie que le jour de la semaine écrit correspond ; sinon, fais confiance au numéro et mets incertain = true. Si l'année n'est écrite nulle part, prends celle qui place ces dates le plus près de la date du jour fournie.
- nom : le prénom tel qu'écrit ; s'il correspond à un salarié connu de la liste fournie, utilise exactement l'orthographe de la liste.
- incertain : true si tu as dû deviner une case difficile à lire.
- remarques : en français, une ou deux phrases courtes sur ce qui était difficile à lire ; chaîne vide si tout est clair.`;

async function preparerImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error(`Impossible d'ouvrir la photo « ${file.name} ».`));
      i.src = url;
    });
    const MAX = 2400;
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

function consigneUtilisateur() {
  const connus = state.settings.employes.map((e) => `${e.nom} (boutique ${e.boutique})`).join(", ");
  return `Date du jour : ${toISO(new Date())}.\nSalariés connus : ${connus || "aucun"}.\nLis ce planning et renvoie ce que fait chaque salarié pour chaque jour visible.`;
}

function analyserJSON(text) {
  try {
    return JSON.parse(String(text || "").replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new Error("Réponse illisible. Réessayez.");
  }
}

async function lirePlanning(files) {
  const images = await Promise.all(files.map(preparerImage));
  return state.provider === "claude" ? lireAvecClaude(images) : lireAvecGemini(images);
}

// ----- Google Gemini -----
// Choisit le meilleur modèle « flash » stable disponible pour cette clé (mis en cache une semaine).
async function choisirModeleGemini(ai) {
  const cache = store.get("fp.gemini.model", null);
  if (cache?.name && Date.now() - cache.t < 7 * 864e5) return cache.name;
  const noms = [];
  const pager = await ai.models.list({ config: { pageSize: 100 } });
  for await (const m of pager) {
    const name = String(m.name || "").replace(/^models\//, "");
    if (m.supportedActions && !m.supportedActions.includes("generateContent")) continue;
    if (!/^gemini-\d/.test(name)) continue;
    if (/(tts|image|live|audio|embed|transcribe|customtools|robotics|computer|lite|exp|thinking|-\d{3}$|\d{2}-\d{2})/.test(name)) continue;
    noms.push(name);
  }
  const version = (n) => parseFloat(n.match(/^gemini-(\d+(?:\.\d+)?)/)?.[1] || "0");
  const score = (n) => version(n) * 10 + (n.includes("flash") ? 3 : 0) + (n.includes("preview") ? -5 : 0);
  noms.sort((x, y) => score(y) - score(x));
  const name = noms[0] || GEMINI_DEFAUT;
  store.set("fp.gemini.model", { name, t: Date.now() });
  return name;
}

async function lireAvecGemini(images) {
  const { GoogleGenAI, ApiError } = await import("./vendor/gemini.js?v=6");
  const ai = new GoogleGenAI({ apiKey: state.geminiKey });
  const contents = [
    {
      role: "user",
      parts: [...images.map((data) => ({ inlineData: { mimeType: "image/jpeg", data } })), { text: consigneUtilisateur() }],
    },
  ];
  const base = { systemInstruction: SYSTEM_PROMPT, responseMimeType: "application/json" };
  // Du plus complet au plus simple, au cas où un modèle refuse une option
  const essais = [
    { ...base, responseJsonSchema: SCHEMA, thinkingConfig: { thinkingLevel: "HIGH" } },
    { ...base, responseJsonSchema: SCHEMA },
    base,
  ];

  const erreur = (err) => {
    const msg = String(err?.message || "");
    if (/API key not valid|API_KEY_INVALID|api key/i.test(msg) && err?.status === 400) return new Error("Clé API Gemini refusée. Vérifiez-la dans les réglages (⚙︎).");
    if (err?.status === 403) return new Error("Cette clé Gemini n'a pas accès au service. Vérifiez-la sur aistudio.google.com.");
    if (err?.status === 429) return new Error("Quota Gemini atteint. Réessayez dans une minute (ou plus tard dans la journée).");
    if (err instanceof TypeError) return new Error("Pas de connexion internet. Réessayez.");
    return new Error(`Erreur Gemini (${err?.status ?? "?"}) : ${msg.slice(0, 200)}`);
  };

  let model;
  try {
    model = await choisirModeleGemini(ai);
  } catch (err) {
    if (err instanceof ApiError && err.status !== 404) throw erreur(err);
    model = GEMINI_DEFAUT;
  }

  let response, derniere;
  for (const config of essais) {
    try {
      response = await ai.models.generateContent({ model, contents, config });
      break;
    } catch (err) {
      derniere = err;
      if (err instanceof ApiError && err.status === 404) {
        store.set("fp.gemini.model", null); // modèle retiré : on en choisira un autre la prochaine fois
        throw new Error("Modèle Gemini indisponible. Réessayez.");
      }
      const optionRefusee = err instanceof ApiError && err.status === 400 && !/api key/i.test(String(err.message));
      if (!optionRefusee) throw erreur(err);
    }
  }
  if (!response) throw erreur(derniere);

  if (response.promptFeedback?.blockReason) throw new Error("La photo n'a pas pu être analysée. Reprenez le scan du planning.");
  const fin = response.candidates?.[0]?.finishReason;
  if (fin === "MAX_TOKENS") throw new Error("Le planning est trop long pour une seule lecture. Scannez-le en plusieurs pages.");
  if (fin && fin !== "STOP") throw new Error("La photo n'a pas pu être analysée. Reprenez le scan du planning.");
  state.dernierModele = model;
  return analyserJSON(response.text);
}

// ----- Claude (Anthropic) -----
async function lireAvecClaude(images) {
  const { Anthropic } = await import("./vendor/anthropic.js?v=6");
  const client = new Anthropic({ apiKey: state.apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });

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
            { type: "text", text: consigneUtilisateur() },
          ],
        },
      ],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new Error("Clé API Claude refusée. Vérifiez-la dans les réglages (⚙︎).");
    if (err instanceof Anthropic.PermissionDeniedError) throw new Error("Cette clé API n'a pas accès au modèle. Vérifiez votre compte Anthropic.");
    if (err instanceof Anthropic.RateLimitError) throw new Error("Trop de demandes ou crédit épuisé. Réessayez dans une minute ou vérifiez votre crédit Anthropic.");
    if (err instanceof Anthropic.APIConnectionError) throw new Error("Pas de connexion internet. Réessayez.");
    if (err instanceof Anthropic.APIError) throw new Error(`Erreur du service (${err.status ?? "?"}) : ${err.message}`);
    throw err;
  }

  if (response.stop_reason === "refusal") throw new Error("La photo n'a pas pu être analysée. Reprenez le scan du planning.");
  if (response.stop_reason === "max_tokens") throw new Error("Le planning est trop long pour une seule lecture. Scannez-le en plusieurs pages.");
  state.dernierModele = MODEL;
  return analyserJSON(response.content.filter((b) => b.type === "text").map((b) => b.text).join(""));
}

function integrerResultat(result) {
  const dates = [];
  for (const sal of result.salaries || []) {
    let emp = trouverSalarie(sal.nom);
    if (!emp) {
      // Nouveau salarié détecté : ajouté aux réglages, décoché par défaut.
      emp = {
        nom: sal.nom.trim(),
        boutique: state.settings.employes[0]?.boutique || "",
        actif: false,
        horaires: structuredClone(state.settings.employes[0]?.horaires || HORAIRES_DEFAUT),
      };
      if (!emp.nom) continue;
      state.settings.employes.push(emp);
    }
    const jours = (state.planning[emp.nom] ||= {});
    for (const j of sal.jours || []) {
      if (!isISODate(j.date)) continue;
      const statut = STATUTS[j.statut] ? j.statut : "autre";
      const entree = { statut, ...VIDE, texte: String(j.texte || "").trim(), incertain: !!j.incertain };
      if (statut === "travail") {
        Object.assign(entree, heuresDuJour(emp, j.date, normTime(j.arrivee), normTime(j.depart)));
        if (!entree.arrivee || !entree.depart) entree.incertain = true; // pas d'horaire habituel ce jour-là
      }
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
  const e = (jours[date] ||= { statut: "travail", ...VIDE });
  e[field] = field === "statut" ? el.value : normTime(el.value);
  e.incertain = false;
  if (field === "statut") {
    const emp = state.settings.employes.find((x) => x.nom === nom);
    Object.assign(e, e.statut === "travail" ? heuresDuJour(emp, date) : VIDE);
  }
  save();
  const card = el.closest(".rev-day");
  if (field === "statut") {
    for (const input of card.querySelectorAll(".rev-times input")) input.value = e[input.dataset.field] || "";
  }
  card.classList.remove("incertain");
  card.querySelector(".rev-times").classList.toggle("off", e.statut !== "travail");
  card.querySelector(".tot").textContent = affDuree(minutesTravaillees(e));
  rendreFiches();
}

// ---------- Impression / PDF ----------
async function genererPDF() {
  const { jsPDF, html2canvas } = await import("./vendor/pdf.js?v=6");
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
  document.getElementById("s-geminikey").value = state.geminiKey;
  for (const r of document.querySelectorAll('input[name="provider"]')) r.checked = r.value === state.provider;
  afficherChampCle();
  const list = document.getElementById("s-employes");
  list.innerHTML = state.settings.employes
    .map(
      (e, i) => `
      <div class="emp" data-i="${i}">
        <div class="emp-row">
          <input type="checkbox" class="emp-actif" ${e.actif ? "checked" : ""} aria-label="Imprimer une fiche">
          <input type="text" class="emp-nom" value="${esc(e.nom)}" placeholder="Nom" aria-label="Nom">
          <input type="text" class="emp-boutique" value="${esc(e.boutique)}" placeholder="Boutique" aria-label="Boutique">
          <button type="button" class="del" aria-label="Supprimer">×</button>
        </div>
        <details class="emp-h">
          <summary>Horaires habituels</summary>
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
      </div>`,
    )
    .join("");
}

const cleActive = () => (state.provider === "claude" ? state.apiKey : state.geminiKey);

function afficherChampCle() {
  const p = document.querySelector('input[name="provider"]:checked')?.value || "gemini";
  for (const el of document.querySelectorAll("[data-for]")) el.hidden = el.dataset.for !== p;
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
  state.apiKey = document.getElementById("s-apikey").value.trim();
  state.geminiKey = document.getElementById("s-geminikey").value.trim();
  state.provider = document.querySelector('input[name="provider"]:checked')?.value || "gemini";
}

// Exemple : la colonne de Belal sur le planning de novembre 2026, telle que la lecture doit la renvoyer.
function chargerExemple() {
  const nom = "Belal N'DAO";
  if (!state.settings.employes.some((e) => e.nom === nom)) {
    state.settings.employes.unshift({ nom, boutique: "NOA", actif: true, horaires: structuredClone(HORAIRES_DEFAUT) });
  }
  const repos = new Set([5, 8, 11, 12, 18, 19, 26]);
  const jours = Array.from({ length: 30 }, (_, i) => {
    const r = repos.has(i + 1);
    return { date: `2026-11-${pad(i + 1)}`, statut: r ? "repos" : "travail", texte: r ? "Repos" : "OK", arrivee: "", depart: "", incertain: false };
  });
  integrerResultat({ salaries: [{ nom: "BELAL", jours }], remarques: "" });
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
  document.getElementById("btn-analyser").hidden = state.photos.length === 0;
}

async function lancerLecture() {
  const $ = (id) => document.getElementById(id);
  const dlg = $("settings");
  if (!cleActive()) {
    setStatus("Ajoutez d'abord votre clé API dans les réglages (⚙︎).", "error");
    rendreReglages();
    dlg.returnValue = "";
    dlg.showModal();
    return;
  }
  const btn = $("btn-analyser");
  if (!state.photos.length || btn.disabled) return;
  btn.disabled = true;
  setStatus("Lecture du planning en cours… (30 s à 1 min)", "busy");
  try {
    const result = await lirePlanning(state.photos);
    integrerResultat(result);
    state.photos = [];
    rendreMiniatures();
    setStatus(`Fiches remplies (lu avec ${state.dernierModele}). Vérifiez l'aperçu puis imprimez.`);
    afficherResultat();
    $("step-result").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    setStatus(err.message || String(err), "error");
  } finally {
    btn.disabled = false;
  }
}

function init() {
  const $ = (id) => document.getElementById(id);
  const dlg = $("settings");

  // Scan réel (caméra) ou simulation avec la photo du planning de novembre 2026
  const scanner = async (options) => {
    const { openScanner } = await import("./scanner.js?v=6");
    const { pages, finished } = await openScanner(options);
    if (!pages.length) return;
    state.photos.push(...pages);
    rendreMiniatures();
    setStatus("");
    if (finished) lancerLecture(); // scan validé : on lit le planning tout de suite
  };
  $("btn-scan").addEventListener("click", () => scanner());
  $("btn-simulation").addEventListener("click", () => scanner({ image: "test/planning-novembre-2026.jpg?v=6" }));
  $("thumbs").addEventListener("click", (ev) => {
    const i = ev.target.dataset?.i;
    if (i == null) return;
    state.photos.splice(Number(i), 1);
    rendreMiniatures();
  });

  $("btn-analyser").addEventListener("click", lancerLecture);

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
    state.settings.employes.push({
      nom: "",
      boutique: state.settings.employes[0]?.boutique || "",
      actif: true,
      horaires: structuredClone(state.settings.employes[0]?.horaires || HORAIRES_DEFAUT),
    });
    rendreReglages();
    const inputs = document.querySelectorAll("#s-employes .emp-nom");
    inputs[inputs.length - 1]?.focus();
  });
  $("settings-form").addEventListener("change", (ev) => {
    if (ev.target.name === "provider") afficherChampCle();
  });
  $("s-employes").addEventListener("click", (ev) => {
    if (!ev.target.classList.contains("del")) return;
    lireReglages();
    state.settings.employes.splice(Number(ev.target.closest(".emp").dataset.i), 1);
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
    if (cleActive() && state.photos.length) lancerLecture(); // clé ajoutée juste après un scan
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
