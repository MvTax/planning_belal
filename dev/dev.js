// Espace développeur (/dev) : réglages complets, données du téléphone, anciennes versions, diagnostic.
// Il travaille sur les mêmes données que /app (même site, même stockage du navigateur).
import { html, render, useState, useEffect } from "../app/vendor/ui.js";
import { getReglages, reinitialiserNovembre, toutEffacer } from "../app/js/store.js";
import { Reglages, ToastHote, toast } from "../app/js/views.js";
import { useStore } from "../app/js/ui-parts.js";

// Empreinte SHA-256 de « planning-dev:<code> ». Le code lui-même n'est écrit nulle part dans le site.
const EMPREINTE = "cdc39297e8b7fea0fcda063eb6513b54a6daa6bffe2c57f9751b9664a9d94c3e";
const CLE_ACCES = "dev.acces";
const PREFIXE = "v2."; // données de /app

const lireLS = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const cles = () => {
  try {
    return Object.keys(localStorage).sort();
  } catch {
    return [];
  }
};
const taille = (k) => (lireLS(k) || "").length;
const ko = (n) => (n < 1024 ? `${n} o` : `${(n / 1024).toFixed(1).replace(".", ",")} Ko`);

async function empreinte(code) {
  const octets = new TextEncoder().encode(`planning-dev:${code}`);
  const h = await crypto.subtle.digest("SHA-256", octets);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- Verrou ----------
function Verrou({ onOuvert }) {
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState("");
  const valider = async (e) => {
    e.preventDefault();
    if ((await empreinte(code.trim())) === EMPREINTE) {
      try {
        localStorage.setItem(CLE_ACCES, EMPREINTE);
      } catch {
        /* on reste ouvert pour cette visite */
      }
      onOuvert();
    } else {
      setErreur("Code incorrect");
      setCode("");
    }
  };
  return html`<div class="verrou"><form onSubmit=${valider}>
    <h1>Espace dev</h1>
    <p>Entrez le code développeur</p>
    <input type="password" inputmode="numeric" autocomplete="off" autofocus value=${code} onInput=${(e) => setCode(e.target.value)} aria-label="Code" />
    <button class="btn-principal" type="submit">Entrer</button>
    <p class="erreur">${erreur}</p>
  </form></div>`;
}

// ---------- Sauvegarde : exporter / importer toutes les données de /app ----------
function exporter() {
  const donnees = {};
  for (const k of cles()) if (k.startsWith(PREFIXE)) donnees[k] = lireLS(k);
  const contenu = JSON.stringify({ app: "planning", format: 1, date: new Date().toISOString(), donnees }, null, 1);
  const nom = `planning-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
  const fichier = new File([contenu], nom, { type: "application/json" });
  if (navigator.canShare?.({ files: [fichier] })) {
    navigator.share({ files: [fichier], title: nom }).catch((err) => err?.name !== "AbortError" && telecharger(fichier, nom));
    return;
  }
  telecharger(fichier, nom);
}
function telecharger(fichier, nom) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(fichier);
  a.download = nom;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

async function importer(e) {
  const f = e.target.files?.[0];
  e.target.value = "";
  if (!f) return;
  let s;
  try {
    s = JSON.parse(await f.text());
  } catch {
    toast("Ce fichier n'est pas une sauvegarde valide.");
    return;
  }
  const entrees = Object.entries(s?.donnees || {}).filter(([k, v]) => k.startsWith(PREFIXE) && typeof v === "string");
  if (s?.app !== "planning" || !entrees.length) {
    toast("Ce fichier n'est pas une sauvegarde du planning.");
    return;
  }
  const mois = entrees.filter(([k]) => k.startsWith(`${PREFIXE}pl.`)).length;
  const date = s.date ? new Date(s.date).toLocaleString("fr-FR") : "date inconnue";
  if (!confirm(`Remplacer les données de ce téléphone par la sauvegarde du ${date} (${mois} mois) ?`)) return;
  for (const k of cles()) if (k.startsWith(PREFIXE)) localStorage.removeItem(k);
  for (const [k, v] of entrees) localStorage.setItem(k, v);
  location.reload();
}

// ---------- Éditeur de données brutes ----------
function Editeur() {
  const [liste, setListe] = useState(cles);
  const [cle, setCle] = useState(null);
  const [texte, setTexte] = useState("");
  const choisir = (k) => {
    setCle(k);
    const v = lireLS(k) || "";
    try {
      setTexte(JSON.stringify(JSON.parse(v), null, 2));
    } catch {
      setTexte(v);
    }
  };
  const enregistrer = () => {
    let v = texte;
    try {
      v = JSON.stringify(JSON.parse(texte));
    } catch {
      if (!confirm("Ce n'est pas du JSON valide. L'enregistrer quand même tel quel ?")) return;
    }
    localStorage.setItem(cle, v);
    toast("Enregistré. Rechargement…");
    setTimeout(() => location.reload(), 700);
  };
  const supprimer = () => {
    if (!confirm(`Supprimer la donnée « ${cle} » ?`)) return;
    localStorage.removeItem(cle);
    setCle(null);
    setListe(cles());
    toast(`« ${cle} » supprimé`);
  };
  return html`<div class="bloc"><p class="bloc-titre">Données brutes (stockage du navigateur)</p>
    <div class="cles">${liste.map((k) => html`<button class=${`cle ${k === cle ? "on" : ""}`} onClick=${() => choisir(k)}><code>${k}</code><small>${ko(taille(k))}</small></button>`)}</div>
    ${cle
      ? html`<p class="petit-texte" style=${{ margin: "12px 2px 6px" }}><b>${cle}</b></p>
        <textarea class="json" spellcheck="false" value=${texte} onInput=${(e) => setTexte(e.target.value)}></textarea>
        <div class="rangee"><button class="btn-secondaire" onClick=${supprimer} style=${{ color: "var(--rouge)" }}>Supprimer</button><button class="btn-principal" onClick=${enregistrer}>Enregistrer</button></div>
        <p class="avertissement">Modification directe : une erreur ici peut casser l'affichage. Exportez une sauvegarde avant.</p>`
      : html`<p class="petit-texte">Touchez une clé pour la lire ou la modifier. <code>v2.*</code> = /app, <code>fp.*</code> = V1, <code>v3.*</code> = V3.</p>`}
  </div>`;
}

// ---------- Diagnostic ----------
function Diagnostic() {
  const [stockage, setStockage] = useState("…");
  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => setStockage(`${ko(e.usage || 0)} utilisés`)).catch(() => setStockage("inconnu"));
  }, []);
  const toutes = cles();
  const totalApp = toutes.filter((k) => k.startsWith(PREFIXE)).reduce((n, k) => n + taille(k), 0);
  const moisApp = toutes.filter((k) => k.startsWith(`${PREFIXE}pl.`)).map((k) => k.slice(6));
  const installe = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const lignes = [
    ["Mois enregistrés", moisApp.length ? moisApp.join(", ") : "aucun"],
    ["Données de /app", ko(totalApp)],
    ["Stockage du site", stockage],
    ["Salariés", String(getReglages().employes.length)],
    ["Ouvert depuis l'écran d'accueil", installe ? "oui" : "non"],
    ["Écran", `${screen.width} × ${screen.height} pt · ×${devicePixelRatio}`],
    ["Navigateur", navigator.userAgent],
  ];
  return html`<div class="bloc"><p class="bloc-titre">Diagnostic</p>
    ${lignes.map(([a, b]) => html`<div class="ligne-info"><span>${a}</span><span>${b}</span></div>`)}
  </div>`;
}

// ---------- Page ----------
function Dev() {
  useStore();
  const [reglages, setReglages] = useState(false);
  const r = getReglages();
  useEffect(() => {
    document.documentElement.classList.remove("t-normal", "t-grand", "t-tres");
    document.documentElement.classList.add(`t-${r.taille}`);
  }, [r.taille]);
  const verrouiller = () => {
    try {
      localStorage.removeItem(CLE_ACCES);
    } catch {
      /* rien */
    }
    location.reload();
  };
  return html`<div class="dev">
    <h1>Espace dev</h1>
    <p class="sous">Réglages complets, données et outils · réservé au développeur</p>

    <div class="bloc"><p class="bloc-titre">Applications</p>
      <a class="lien-app" href="../app/">Ouvrir l'app du patron <small>/app</small></a>
      <a class="lien-app" href="v1/">Ancienne version V1 <small>/dev/v1</small></a>
      <a class="lien-app" href="v3/">Version V3 (recherche) <small>/dev/v3</small></a>
    </div>

    <div class="bloc"><p class="bloc-titre">Réglages</p>
      <button class="btn-principal" onClick=${() => setReglages(true)}>Réglages complets</button>
      <p class="petit-texte">Les mêmes réglages que dans /app, plus le bloc « Données » (reprise de la V1, remise à zéro, effacement), absent de /app.</p>
    </div>

    <div class="bloc"><p class="bloc-titre">Sauvegarde</p>
      <div class="rangee">
        <button class="btn-principal" onClick=${exporter}>Exporter</button>
        <label class="btn-secondaire" style=${{ display: "grid", placeItems: "center", cursor: "pointer" }}>Importer<input type="file" accept="application/json,.json" hidden onChange=${importer} /></label>
      </div>
      <p class="petit-texte">Les données vivent uniquement dans le téléphone (il n'y a pas de serveur). Pour récupérer le planning du patron : ouvrez /dev sur son téléphone, « Exporter », puis « Importer » sur le vôtre (et inversement).</p>
    </div>

    <${Editeur} />
    <${Diagnostic} />

    <div class="bloc"><p class="bloc-titre">Remise à zéro</p>
      <button class="btn-ligne" onClick=${() => confirm("Remettre le planning de novembre 2026 d'origine ?") && (reinitialiserNovembre(), toast("Novembre 2026 remis"))}>Remettre le planning de novembre 2026</button>
      <button class="btn-ligne danger" onClick=${() => confirm("Effacer tous les plannings enregistrés sur ce téléphone ?") && (toutEffacer(), toast("Plannings effacés"))}>Effacer tous les plannings</button>
    </div>

    <button class="btn-secondaire" onClick=${verrouiller}>Verrouiller l'espace dev sur ce téléphone</button>
    ${reglages ? html`<${Reglages} complet onClose=${() => setReglages(false)} />` : null}
    <${ToastHote} />
  </div>`;
}

function Racine() {
  const [ouvert, setOuvert] = useState(() => lireLS(CLE_ACCES) === EMPREINTE);
  return ouvert ? html`<${Dev} />` : html`<${Verrou} onOuvert=${() => setOuvert(true)} />`;
}

render(html`<${Racine} />`, document.getElementById("app"));
