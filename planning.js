// Planning du mois : une ligne par jour, une colonne par vendeur + les renforts.
// Pensé pour un usage très simple : on appuie sur une case, une roue de choix s'ouvre autour du doigt,
// on glisse sur le bon choix et on relâche. Un simple toucher ouvre aussi la roue (sans glisser).

export const CHOIX = [
  { id: "travail", court: "OK", long: "OK", couleur: "#007aff" },
  { id: "repos", court: "Repos", long: "Repos", couleur: "#ff3b30" },
  { id: "conge", court: "CP", long: "Congé", couleur: "#ff9500" },
  { id: "ecole", court: "École", long: "École", couleur: "#af52de" },
  { id: "maladie", court: "Malade", long: "Malade", couleur: "#8e8e93" },
  { id: "absent", court: "Absent", long: "Absent", couleur: "#1c1c1e" },
];
const PAR_ID = Object.fromEntries(CHOIX.map((c) => [c.id, c]));
const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const JC = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const APPUI_LONG_MS = 220;

const pad = (n) => String(n).padStart(2, "0");
const cle = (mois) => `fp.pl.${mois}`;
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
    /* stockage indisponible */
  }
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const prenom = (nom) => String(nom).trim().split(/\s+/)[0];

export function joursDuMois(mois) {
  const [y, m] = mois.split("-").map(Number);
  const n = new Date(y, m, 0).getDate();
  return Array.from({ length: n }, (_, i) => new Date(y, m - 1, i + 1));
}
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const jourIdx = (d) => (d.getDay() + 6) % 7;

// Le planning papier de novembre 2026, recopié : la démonstration s'ouvre sur son vrai mois.
function exempleNovembre2026(colonnes) {
  const t = {};
  const remplir = (col, codes) => {
    for (let j = 1; j <= 30; j++) {
      const s = codes(j);
      if (s) (t[`2026-11-${pad(j)}`] ||= {})[col] = s;
    }
  };
  remplir(1, (j) => ([5, 8, 11, 12, 18, 19, 26].includes(j) ? "repos" : "travail"));
  remplir(2, (j) => ([2, 3, 9, 10, 16, 17, 30].includes(j) ? "repos" : "travail"));
  remplir(3, (j) =>
    [1, 2, 3, 5, 6, 7, 13].includes(j) ? "absent" : [14, 27].includes(j) ? "repos" : j === 28 ? "conge" : [23, 24, 25].includes(j) ? null : "travail");
  remplir(4, (j) =>
    [3, 9, 10, 16, 17, 23, 24, 30].includes(j) ? "ecole" : [14, 15, 20, 22].includes(j) ? "repos" : j === 21 ? "conge" : j === 29 ? null : "travail");
  const extras = {
    1: ["Nour"], 2: ["Nour"], 3: ["Lisa"], 5: ["Lisa"], 7: ["Nour", "Katy"], 8: ["Nour", "Sérine"],
    9: ["Sérine"], 10: ["Sérine"], 11: ["Sérine"], 12: ["Maeva"], 14: ["Sérine"], 15: ["Sérine"], 16: ["Sérine"],
    17: ["Sérine"], 18: ["Sérine"], 23: ["Soso", "Sérine"], 24: ["Soso", "Sérine"], 25: ["Sérine", "Belal"],
    26: ["Maeva", "Lisa"], 27: ["Sérine"], 28: ["Nour", "Sérine", "Sarra"], 29: ["Sarra", "Sérine"],
  };
  for (const [j, noms] of Object.entries(extras)) (t[`2026-11-${pad(j)}`] ||= {}).extras = noms;
  for (const j of [1, 2, 3, 5, 6, 7, 13]) (t[`2026-11-${pad(j)}`] ||= {}).extras = [...(t[`2026-11-${pad(j)}`].extras || []), "Shaily"];
  return { jours: t, exemple: true };
}

export function initPlanning(ctx) {
  // ctx : { vendeurs() → [{nom, colonne, repos:[0..6]}], extrasConnus(), ajouterExtra(nom), estFerie(date),
  //         onFiches(mois, donnees), ouvrirReglages() }
  const racine = document.getElementById("vue-planning");
  const grille = racine.querySelector("#pl-grille");
  const pageCom = racine.querySelector("#pl-com");
  const entetePaie = racine.querySelector("#pl-cols-com");
  const pages = racine.querySelector("#pl-pages");
  const titre = racine.querySelector("#pl-titre");
  const entete = racine.querySelector("#pl-cols");
  let mois = lire("fp.pl.courant", null) || `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}`;
  let donnees = null;

  // ----- Données du mois (pré-remplies la première fois) -----
  function charger() {
    donnees = lire(cle(mois), null);
    if (!donnees) {
      const vend = ctx.vendeurs();
      if (mois === "2026-11") {
        donnees = exempleNovembre2026(vend.map((v) => v.colonne));
        toast("Voici votre planning de novembre, recopié depuis la feuille papier.");
      } else {
        donnees = { jours: {} };
        for (const d of joursDuMois(mois)) {
          const j = (donnees.jours[iso(d)] = {});
          for (const v of vend) j[v.colonne] = (v.repos || []).includes(jourIdx(d)) ? "repos" : "travail";
        }
        toast("Mois préparé : tout le monde « OK », sauf les repos habituels. Appuyez sur une case pour changer.");
      }
      sauver();
    }
  }
  const sauver = () => ecrire(cle(mois), donnees);

  // ----- Affichage -----
  function rendre() {
    ecrire("fp.pl.courant", mois);
    const [y, m] = mois.split("-").map(Number);
    titre.innerHTML = `<span class="pl-annee">${y}</span>${MOIS[m - 1][0].toUpperCase()}${MOIS[m - 1].slice(1)}`;
    const vend = ctx.vendeurs();
    racine.style.setProperty("--nb-col", vend.length);
    entete.innerHTML =
      `<span class="pl-c-jour"></span>` +
      vend.map((v) => `<span class="pl-nom">${esc(prenom(v.nom))}</span>`).join("") +
      `<span class="pl-nom pl-nom-extra">Renforts</span>`;
    const aujourdhui = iso(new Date());
    const lignes = joursDuMois(mois).map((d) => {
        const k = iso(d), j = donnees.jours[k] || {}, ji = jourIdx(d);
        const classes = ["pl-ligne"];
        if (ji >= 5) classes.push("we");
        if (ji === 0) classes.push("lundi");
        if (k === aujourdhui) classes.push("auj");
        const ferie = ctx.estFerie(d);
        const cases = vend
          .map((v) => {
            const s = j[v.colonne];
            return `<button type="button" class="pl-case" data-date="${k}" data-col="${v.colonne}" aria-label="${esc(prenom(v.nom))}, ${JOURS[ji]} ${d.getDate()}">${puce(s)}</button>`;
          })
          .join("");
        const ex = j.extras || [];
        const jourHtml = `<div class="pl-jour"><span class="pl-jn">${JC[ji]}</span><span class="pl-jd">${d.getDate()}</span>${ferie ? `<span class="pl-ferie">Férié</span>` : ""}</div>`;
        return {
          lundi: ji === 0,
          com: `<div class="pl-lcom ${classes.slice(1).join(" ")}" data-date="${k}">${jourHtml}<div class="pl-paie-cell">${cellulePaie(k)}</div></div>`,
          html: `<div class="${classes.join(" ")}">
          ${jourHtml}
          ${cases}
          <button type="button" class="pl-case pl-extra" data-date="${k}" data-col="extras" aria-label="Renforts du ${JOURS[ji]} ${d.getDate()}">${puceExtras(ex)}</button>
        </div>`,
        };
      });
    // Une carte blanche par semaine, comme les pages d'un agenda
    const semaines = [];
    for (const l of lignes) {
      if (l.lundi || !semaines.length) semaines.push({ a: [], b: [] });
      semaines[semaines.length - 1].a.push(l.html);
      semaines[semaines.length - 1].b.push(l.com);
    }
    grille.innerHTML = semaines.map((w) => `<section class="pl-semaine">${w.a.join("")}</section>`).join("");
    pageCom.innerHTML = semaines.map((w) => `<section class="pl-semaine">${w.b.join("")}</section>`).join("");
    resumePaie();
  }

  // ----- Extras payés (colonne « commentaires » du planning papier) -----
  const euros = (n) => `${Math.round(n * 100) / 100} €`.replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f");
  const tarifDe = (j, nom) => Number(j.paie?.tarifs?.[nom] ?? ctx.tarifDefaut());
  const signature = (j) => (j.extras || []).map((n) => `${n}:${tarifDe(j, n)}`).join("|");
  const estValide = (j) => !!(j.extras || []).length && j.paie?.valide === signature(j);
  const totalJour = (j) => (j.extras || []).reduce((t, n) => t + tarifDe(j, n), 0);
  function libelleTarifs(j) {
    const t = (j.extras || []).map((n) => tarifDe(j, n));
    if (t.every((x) => x === t[0])) return t.length === 1 ? `${t[0]} €` : `${t[0]} € × ${t.length}`;
    return t.map((x) => x).join(" + ") + " €";
  }
  function ligneNote(k) {
    const n = ((donnees.jours[k] || {}).note || "").trim();
    return n
      ? `<button type="button" class="pl-note plein" data-act="note" data-date="${k}" aria-label="Modifier la note"><span class="pl-note-ico" aria-hidden="true"></span><span class="pl-note-txt">${esc(n)}</span></button>`
      : `<button type="button" class="pl-note" data-act="note" data-date="${k}" aria-label="Ajouter une note"><span class="pl-note-plus" aria-hidden="true">+</span> Note</button>`;
  }
  function cellulePaie(k) {
    const j = donnees.jours[k] || {};
    return `<div class="pl-cell-col">${cellulePaieHaut(k, j)}${ligneNote(k)}</div>`;
  }
  function cellulePaieHaut(k, j) {
    if (!(j.extras || []).length) return "";
    const ok = estValide(j);
    const nom = (j.extras || []).map(prenom).join(", ");
    return `<div class="pl-paie ${ok ? "ok" : "attente"}" data-date="${k}">
      <button type="button" class="pl-paie-corps" data-act="ouvrir" data-date="${k}" aria-label="Extras du ${k}, ${esc(libelleTarifs(j))}">
        <span class="pl-paie-calc">${esc(libelleTarifs(j))}${(j.extras || []).length > 1 || true ? ` <b>= ${euros(totalJour(j))}</b>` : ""}</span>
        <span class="pl-paie-qui">${esc(nom)}${ok ? "" : " · à valider"}</span>
      </button>
      ${ok
        ? `<span class="pl-paie-coche" aria-hidden="true"></span>`
        : `<button type="button" class="pl-paie-valider" data-act="valider" data-date="${k}" aria-label="Valider ce paiement"></button>`}
    </div>`;
  }
  function majPaie(k) {
    const cell = pageCom.querySelector(`.pl-lcom[data-date="${k}"] .pl-paie-cell`);
    if (cell) {
      cell.innerHTML = cellulePaie(k);
      cell.classList.remove("flash");
      void cell.offsetWidth;
      cell.classList.add("flash");
    }
    resumePaie();
  }
  function resumePaie() {
    let ok = 0, att = 0;
    for (const j of Object.values(donnees.jours)) {
      if (!(j.extras || []).length) continue;
      if (estValide(j)) ok += totalJour(j);
      else att += totalJour(j);
    }
    entetePaie.innerHTML = `<div class="pl-bilan"><span><b>${euros(ok)}</b> validés</span>${att ? `<span class="att"><b>${euros(att)}</b> à valider</span>` : ""}</div>${att ? `<button type="button" class="pl-toutvalider" data-act="tout">Tout valider</button>` : ""}`;
  }
  function validerJour(k, oui = true) {
    const j = (donnees.jours[k] ||= {});
    j.paie = { ...(j.paie || {}), valide: oui ? signature(j) : null };
    sauver();
    majPaie(k);
  }

  function puce(s) {
    const c = PAR_ID[s];
    return c ? `<span class="pl-puce s-${c.id}">${c.court}</span>` : `<span class="pl-vide">·</span>`;
  }
  function puceExtras(ex) {
    if (!ex.length) return `<span class="pl-vide">+</span>`;
    const premiers = ex.slice(0, 2).map((n) => `<span class="pl-ex">${esc(prenom(n))}</span>`).join("");
    return premiers + (ex.length > 2 ? `<span class="pl-ex-plus">+${ex.length - 2}</span>` : "");
  }

  function majCase(date, col) {
    const b = grille.querySelector(`.pl-case[data-date="${date}"][data-col="${col}"]`);
    if (!b) return;
    const j = donnees.jours[date] || {};
    b.innerHTML = col === "extras" ? puceExtras(j.extras || []) : puce(j[col]);
    b.classList.remove("flash");
    void b.offsetWidth;
    b.classList.add("flash");
  }

  function changer(date, col, valeur) {
    const j = (donnees.jours[date] ||= {});
    const avant = col === "extras" ? [...(j.extras || [])] : j[col];
    if (col === "extras") j.extras = valeur;
    else j[col] = valeur;
    sauver();
    majCase(date, col);
    if (col === "extras") majPaie(date);
    return avant;
  }

  // ----- Roue de choix -----
  const voile = document.createElement("div");
  voile.className = "roue-voile no-print";
  voile.hidden = true;
  voile.innerHTML = `<div class="roue-titre"></div><div class="roue">${CHOIX.map(
    (c) => `<button type="button" class="roue-choix" data-id="${c.id}" style="--c:${c.couleur}">${c.long}</button>`,
  ).join("")}<button type="button" class="roue-centre" aria-label="Fermer">✕</button></div>`;
  document.body.appendChild(voile);
  const roue = voile.querySelector(".roue");
  const roueTitre = voile.querySelector(".roue-titre");
  let cible = null; // { date, col, bouton }
  let mode = null; // "glisse" (doigt posé) ou "toucher" (roue ouverte, on touche un choix)
  let survol = null;

  function ouvrirRoue(bouton, x, y, m) {
    const { date, col } = bouton.dataset;
    cible = { date, col, bouton };
    mode = m;
    survol = null;
    const v = ctx.vendeurs().find((e) => String(e.colonne) === col);
    const d = new Date(date + "T12:00:00");
    roueTitre.textContent = `${prenom(v?.nom || "")} · ${JOURS[jourIdx(d)]} ${d.getDate()}`;
    const R = Math.min(104, window.innerWidth * 0.25);
    const marge = R + 46;
    const cx = Math.min(Math.max(x, marge), window.innerWidth - marge);
    const cy = Math.min(Math.max(y, marge + 70), window.innerHeight - marge);
    roue.style.left = `${cx}px`;
    roue.style.top = `${cy}px`;
    roueTitre.style.top = `${Math.max(12, cy - R - 108)}px`;
    roue.querySelectorAll(".roue-choix").forEach((b, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / CHOIX.length;
      b.style.setProperty("--x", `${Math.cos(a) * R}px`);
      b.style.setProperty("--y", `${Math.sin(a) * R}px`);
      b.classList.toggle("actuel", b.dataset.id === (donnees.jours[date] || {})[col]);
      b.classList.remove("survol");
    });
    voile.hidden = false;
    requestAnimationFrame(() => voile.classList.add("ouvert"));
    bouton.classList.add("presse");
  }

  function fermerRoue() {
    voile.classList.remove("ouvert");
    voile.hidden = true;
    cible?.bouton.classList.remove("presse");
    cible = null;
    mode = null;
  }

  function choixSous(x, y) {
    let best = null, bd = Infinity;
    for (const b of roue.querySelectorAll(".roue-choix")) {
      const r = b.getBoundingClientRect();
      const d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    return bd < 62 ? best : null;
  }

  function survoler(x, y) {
    const b = choixSous(x, y);
    if (b === survol) return;
    survol?.classList.remove("survol");
    survol = b;
    b?.classList.add("survol");
  }

  function choisir(id) {
    if (!cible) return;
    const { date, col } = cible;
    const avant = changer(date, col, id);
    const v = ctx.vendeurs().find((e) => String(e.colonne) === col);
    const d = new Date(date + "T12:00:00");
    fermerRoue();
    if (avant !== id) {
      toast(`${prenom(v?.nom || "")} · ${JC[jourIdx(d)]} ${d.getDate()} → ${PAR_ID[id].long}`, () => changer(date, col, avant));
    }
  }

  voile.addEventListener("click", (e) => {
    if (mode !== "toucher") return;
    const b = e.target.closest(".roue-choix");
    if (b) choisir(b.dataset.id);
    else fermerRoue();
  });

  // ----- Gestes : appui long + glisser, ou simple toucher -----
  let appui = null; // { bouton, x, y, timer }
  let dernierTouch = 0;

  function debut(bouton, x, y) {
    if (!bouton || cible) return;
    appui = { bouton, x, y, timer: null };
    bouton.classList.add("enfonce");
    if (bouton.dataset.col === "extras") return; // les renforts s'ouvrent au relâcher
    appui.timer = setTimeout(() => {
      if (!appui) return;
      bouton.classList.remove("enfonce");
      ouvrirRoue(bouton, appui.x, appui.y, "glisse");
      appui = null;
    }, APPUI_LONG_MS);
  }
  function bouge(x, y, e) {
    if (mode === "glisse") {
      e?.cancelable && e.preventDefault(); // pas de défilement pendant le choix
      survoler(x, y);
      return;
    }
    if (appui && Math.hypot(x - appui.x, y - appui.y) > 9) annulerAppui(); // c'est un défilement
  }
  function fin(x, y) {
    if (mode === "glisse") {
      const b = choixSous(x, y);
      if (b) choisir(b.dataset.id);
      else fermerRoue(); // doigt relâché au milieu ou ailleurs : on ferme sans rien changer
      return;
    }
    if (appui) {
      const bouton = appui.bouton;
      annulerAppui();
      if (bouton.dataset.col === "extras") ouvrirRenforts(bouton.dataset.date);
      else ouvrirRoue(bouton, x, y, "toucher");
    }
  }
  function annulerAppui() {
    if (!appui) return;
    clearTimeout(appui.timer);
    appui.bouton.classList.remove("enfonce");
    appui = null;
  }

  const pt = (e) => e.changedTouches?.[0] || e.touches?.[0] || e;
  grille.addEventListener(
    "touchstart",
    (e) => {
      dernierTouch = Date.now();
      const t = pt(e);
      debut(e.target.closest(".pl-case"), t.clientX, t.clientY);
    },
    { passive: true },
  );
  window.addEventListener("touchmove", (e) => bouge(pt(e).clientX, pt(e).clientY, e), { passive: false });
  window.addEventListener("touchend", (e) => {
    dernierTouch = Date.now();
    if (!appui && mode !== "glisse") return;
    const t = pt(e);
    fin(t.clientX, t.clientY);
    e.cancelable && e.preventDefault(); // évite le « clic » qui suit le toucher
  });
  window.addEventListener("touchcancel", () => {
    annulerAppui();
    if (mode === "glisse") fermerRoue();
  });
  // Souris (ordinateur) : mêmes gestes
  const viaTouch = () => Date.now() - dernierTouch < 800;
  grille.addEventListener("mousedown", (e) => !viaTouch() && debut(e.target.closest(".pl-case"), e.clientX, e.clientY));
  window.addEventListener("mousemove", (e) => !viaTouch() && bouge(e.clientX, e.clientY, e));
  window.addEventListener("mouseup", (e) => {
    if (viaTouch() || (!appui && mode !== "glisse")) return;
    fin(e.clientX, e.clientY);
  });
  grille.addEventListener("contextmenu", (e) => e.preventDefault());

  // ----- Renforts : grandes étiquettes à cocher -----
  const feuille = document.createElement("div");
  feuille.className = "feuille-voile no-print";
  feuille.hidden = true;
  feuille.innerHTML = `<div class="feuille" role="dialog" aria-label="Renforts">
      <p class="feuille-titre"></p>
      <div class="feuille-noms"></div>
      <div class="feuille-actions">
        <button type="button" class="feuille-ajout">+ Autre prénom</button>
        <button type="button" class="feuille-ok">Terminé</button>
      </div>
    </div>`;
  document.body.appendChild(feuille);
  let renfortDate = null;

  function ouvrirRenforts(date) {
    renfortDate = date;
    const d = new Date(date + "T12:00:00");
    feuille.querySelector(".feuille-titre").textContent = `Renforts du ${JOURS[jourIdx(d)]} ${d.getDate()}`;
    dessinerNoms();
    feuille.hidden = false;
    requestAnimationFrame(() => feuille.classList.add("ouvert"));
  }
  function dessinerNoms() {
    const choisis = (donnees.jours[renfortDate] || {}).extras || [];
    const tous = [...new Set([...ctx.extrasConnus(), ...ctx.vendeurs().map((v) => prenom(v.nom)), ...choisis])];
    feuille.querySelector(".feuille-noms").innerHTML = tous
      .map((n) => `<button type="button" class="feuille-nom${choisis.includes(n) ? " on" : ""}" data-nom="${esc(n)}">${esc(n)}</button>`)
      .join("");
  }
  function fermerRenforts() {
    feuille.classList.remove("ouvert");
    feuille.hidden = true;
    renfortDate = null;
  }
  feuille.addEventListener("click", (e) => {
    const nom = e.target.closest(".feuille-nom")?.dataset.nom;
    if (nom) {
      const ex = [...((donnees.jours[renfortDate] || {}).extras || [])];
      const i = ex.indexOf(nom);
      if (i >= 0) ex.splice(i, 1);
      else ex.push(nom);
      changer(renfortDate, "extras", ex);
      dessinerNoms();
    } else if (e.target.closest(".feuille-ajout")) {
      const n = (prompt("Prénom du renfort :") || "").trim();
      if (n) {
        ctx.ajouterExtra(n);
        const ex = [...((donnees.jours[renfortDate] || {}).extras || []), n];
        changer(renfortDate, "extras", ex);
        dessinerNoms();
      }
    } else if (e.target.closest(".feuille-ok") || e.target === feuille) fermerRenforts();
  });

  // ----- Bandeau d'information (avec « Annuler ») -----
  const bandeau = document.createElement("div");
  bandeau.className = "bandeau no-print";
  bandeau.hidden = true;
  document.body.appendChild(bandeau);
  let bandeauTimer;
  function toast(msg, annuler) {
    clearTimeout(bandeauTimer);
    bandeau.innerHTML = `<span>${esc(msg)}</span>${annuler ? `<button type="button">Annuler</button>` : ""}`;
    bandeau.hidden = false;
    bandeau.classList.add("ouvert");
    bandeau.querySelector("button")?.addEventListener("click", () => {
      annuler();
      bandeau.hidden = true;
    });
    bandeauTimer = setTimeout(() => (bandeau.hidden = true), annuler ? 4500 : 6000);
  }

  // ----- Feuille de paiement d'un jour -----
  const paie = document.createElement("div");
  paie.className = "feuille-voile no-print";
  paie.hidden = true;
  paie.innerHTML = `<div class="feuille" role="dialog" aria-label="Extras payés">
      <p class="feuille-titre"></p>
      <div class="paie-rapide"><button type="button" data-tout="defaut">Tout à <span class="td"></span> €</button><button type="button" data-tout="60">Tout à 60 €</button></div>
      <div class="paie-lignes"></div>
      <p class="paie-total"></p>
      <div class="feuille-actions"><button type="button" class="paie-secondaire"></button><button type="button" class="paie-valider-gros"></button></div>
    </div>`;
  document.body.appendChild(paie);
  let paieDate = null;

  function dessinerPaie() {
    const j = donnees.jours[paieDate] || {};
    const d = new Date(paieDate + "T12:00:00");
    paie.querySelector(".feuille-titre").textContent = `Extras du ${JOURS[jourIdx(d)]} ${d.getDate()}`;
    paie.querySelector(".td").textContent = ctx.tarifDefaut();
    paie.querySelector(".paie-lignes").innerHTML = (j.extras || [])
      .map(
        (n) => `<div class="paie-ligne"><span class="paie-nom">${esc(n)}</span>
          <button type="button" class="paie-pas" data-nom="${esc(n)}" data-pas="-10" aria-label="Moins 10 euros">−</button>
          <span class="paie-val">${tarifDe(j, n)} €</span>
          <button type="button" class="paie-pas" data-nom="${esc(n)}" data-pas="10" aria-label="Plus 10 euros">+</button></div>`,
      )
      .join("");
    paie.querySelector(".paie-total").innerHTML = `Total : <b>${euros(totalJour(j))}</b>`;
    const ok = estValide(j);
    const sec = paie.querySelector(".paie-secondaire");
    sec.textContent = ok ? "Remettre à valider" : "Fermer";
    sec.dataset.act = ok ? "devalider" : "fermer";
    paie.querySelector(".paie-valider-gros").textContent = ok ? "Terminé" : "Valider";
    paie.querySelector(".paie-valider-gros").dataset.act = ok ? "fermer" : "valider";
  }
  function ouvrirPaie(k) {
    paieDate = k;
    dessinerPaie();
    paie.hidden = false;
    requestAnimationFrame(() => paie.classList.add("ouvert"));
  }
  function fermerPaie() {
    paie.classList.remove("ouvert");
    paie.hidden = true;
    if (paieDate) majPaie(paieDate);
    paieDate = null;
  }
  paie.addEventListener("click", (e) => {
    if (e.target === paie) return fermerPaie();
    const j = (donnees.jours[paieDate] ||= {});
    const pas = e.target.closest(".paie-pas");
    const tout = e.target.closest("[data-tout]")?.dataset.tout;
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (pas) {
      const t = Math.max(0, tarifDe(j, pas.dataset.nom) + Number(pas.dataset.pas));
      j.paie = { ...(j.paie || {}), tarifs: { ...(j.paie?.tarifs || {}), [pas.dataset.nom]: t } };
      sauver();
      dessinerPaie();
    } else if (tout) {
      const t = tout === "defaut" ? ctx.tarifDefaut() : Number(tout);
      j.paie = { ...(j.paie || {}), tarifs: Object.fromEntries((j.extras || []).map((n) => [n, t])) };
      sauver();
      dessinerPaie();
    } else if (act === "valider") {
      validerJour(paieDate, true);
      fermerPaie();
    } else if (act === "devalider") {
      validerJour(paieDate, false);
      dessinerPaie();
    } else if (act === "fermer") fermerPaie();
  });

  pageCom.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    if (b.dataset.act === "valider") {
      validerJour(b.dataset.date, true);
      toast(`Extras du ${Number(b.dataset.date.slice(8))} validés`, () => validerJour(b.dataset.date, false));
    } else if (b.dataset.act === "ouvrir") ouvrirPaie(b.dataset.date);
    else if (b.dataset.act === "note") ouvrirNote(b.dataset.date);
  });
  entetePaie.addEventListener("click", (e) => {
    if (!e.target.closest('[data-act="tout"]')) return;
    const avant = Object.entries(donnees.jours).filter(([, j]) => (j.extras || []).length && !estValide(j)).map(([k]) => k);
    for (const k of avant) validerJour(k, true);
    toast(`${avant.length} jour${avant.length > 1 ? "s" : ""} validé${avant.length > 1 ? "s" : ""}`, () => avant.forEach((k) => validerJour(k, false)));
  });

  // ----- Feuille de note d'un jour -----
  const noteF = document.createElement("div");
  noteF.className = "feuille-voile no-print";
  noteF.hidden = true;
  noteF.innerHTML = `<div class="feuille" role="dialog" aria-label="Note du jour">
      <p class="feuille-titre"></p>
      <div class="note-idees"></div>
      <textarea class="note-texte" rows="3" placeholder="Écrivez votre note…" aria-label="Note"></textarea>
      <div class="feuille-actions"><button type="button" class="paie-secondaire note-suppr" data-n="suppr">Supprimer</button><button type="button" class="paie-valider-gros" data-n="ok">Enregistrer</button></div>
    </div>`;
  document.body.appendChild(noteF);
  const IDEES = ["Acompte 100 €", "Acompte 50 €", "Retard", "Absent prévenu", "Extra payé 60 €"];
  let noteDate = null;
  const champNote = noteF.querySelector(".note-texte");
  noteF.querySelector(".note-idees").innerHTML = IDEES.map((t) => `<button type="button" data-idee="${esc(t)}">${esc(t)}</button>`).join("");

  function ouvrirNote(k) {
    noteDate = k;
    const d = new Date(k + "T12:00:00");
    noteF.querySelector(".feuille-titre").textContent = `Note du ${JOURS[jourIdx(d)]} ${d.getDate()}`;
    champNote.value = (donnees.jours[k] || {}).note || "";
    noteF.querySelector(".note-suppr").hidden = !champNote.value;
    noteF.hidden = false;
    requestAnimationFrame(() => noteF.classList.add("ouvert"));
    setTimeout(() => champNote.focus(), 250);
  }
  function fermerNote(enregistrer = true) {
    if (noteDate && enregistrer) {
      const j = (donnees.jours[noteDate] ||= {});
      const t = champNote.value.trim();
      if (t) j.note = t;
      else delete j.note;
      sauver();
      majPaie(noteDate);
    }
    champNote.blur();
    noteF.classList.remove("ouvert");
    noteF.hidden = true;
    noteDate = null;
  }
  noteF.addEventListener("click", (e) => {
    if (e.target === noteF) return fermerNote(true);
    const idee = e.target.closest("[data-idee]")?.dataset.idee;
    if (idee) {
      champNote.value = champNote.value.trim() ? `${champNote.value.trim()} · ${idee}` : idee;
      return champNote.focus();
    }
    const n = e.target.closest("[data-n]")?.dataset.n;
    if (n === "suppr") {
      champNote.value = "";
      fermerNote(true);
    } else if (n === "ok") fermerNote(true);
  });

  // ----- Deux pages à l'horizontale : planning | extras payés (aimantées, pas de glissement libre) -----
  const onglets = [...racine.querySelectorAll(".pl-onglets button")];
  let pageActive = 0;
  function afficherPage(n) {
    pageActive = n;
    racine.classList.toggle("page-com", n === 1);
    onglets.forEach((b, i) => b.classList.toggle("actif", i === n));
  }
  let tAttente;
  pages.addEventListener("scroll", () => {
    clearTimeout(tAttente);
    const n = pages.scrollLeft > pages.clientWidth / 2 ? 1 : 0;
    if (n !== pageActive) afficherPage(n);
    tAttente = setTimeout(() => afficherPage(Math.round(pages.scrollLeft / pages.clientWidth)), 80);
  }, { passive: true });
  onglets.forEach((b) => b.addEventListener("click", () => pages.scrollTo({ left: Number(b.dataset.page) * pages.clientWidth, behavior: "smooth" })));

  // ----- Navigation entre les mois -----
  function decaler(n) {
    const [y, m] = mois.split("-").map(Number);
    const d = new Date(y, m - 1 + n, 1);
    mois = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    charger();
    rendre();
    window.scrollTo({ top: 0 });
  }
  racine.querySelector("#pl-prec").addEventListener("click", () => decaler(-1));
  racine.querySelector("#pl-suiv").addEventListener("click", () => decaler(1));
  racine.querySelector("#pl-reglages").addEventListener("click", () => ctx.ouvrirReglages());
  racine.querySelector("#pl-fiches").addEventListener("click", () => ctx.onFiches(mois, donnees));

  charger();
  rendre();
  return {
    rafraichir: () => {
      charger();
      rendre();
    },
    mois: () => mois,
    donnees: () => donnees,
    toast,
  };
}
