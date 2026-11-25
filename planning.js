// Planning du mois : une ligne par jour, une colonne par vendeur + les renforts.
// Pensé pour un usage très simple : on appuie sur une case, une roue de choix s'ouvre autour du doigt,
// on glisse sur le bon choix et on relâche. Un simple toucher ouvre aussi la roue (sans glisser).

export const CHOIX = [
  { id: "travail", court: "OK", long: "OK", couleur: "#1d4fb8" },
  { id: "repos", court: "Repos", long: "Repos", couleur: "#c62828" },
  { id: "conge", court: "CP", long: "Congé", couleur: "#c2620a" },
  { id: "ecole", court: "École", long: "École", couleur: "#6b3fb0" },
  { id: "maladie", court: "Malade", long: "Malade", couleur: "#4f5b6b" },
  { id: "absent", court: "Absent", long: "Absent", couleur: "#222831" },
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
    titre.innerHTML = `${MOIS[m - 1][0].toUpperCase()}${MOIS[m - 1].slice(1)} <span class="pl-annee">${y}</span>`;
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
        return {
          lundi: ji === 0,
          html: `<div class="${classes.join(" ")}">
          <div class="pl-jour"><span class="pl-jn">${JC[ji]}</span><span class="pl-jd">${d.getDate()}</span>${ferie ? `<span class="pl-ferie">Férié</span>` : ""}</div>
          ${cases}
          <button type="button" class="pl-case pl-extra" data-date="${k}" data-col="extras" aria-label="Renforts du ${JOURS[ji]} ${d.getDate()}">${puceExtras(ex)}</button>
        </div>`,
        };
      });
    // Une carte blanche par semaine, comme les pages d'un agenda
    const semaines = [];
    for (const l of lignes) {
      if (l.lundi || !semaines.length) semaines.push([]);
      semaines[semaines.length - 1].push(l.html);
    }
    grille.innerHTML = semaines.map((s) => `<section class="pl-semaine">${s.join("")}</section>`).join("");
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
      else mode = "toucher"; // doigt relâché sans choisir : la roue reste ouverte
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
    if (mode === "glisse") mode = "toucher";
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
