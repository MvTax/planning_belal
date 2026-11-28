// Roue de choix : appui prolongé sur une tuile → 6 bulles autour du doigt ; on glisse sur l'une d'elles et on relâche.
// Un simple toucher fait basculer OK ↔ Repos. Même comportement physique que la V1.
import { STATUTS } from "./store.js";
import { svgStr } from "./icons.js";
import { JOURS, fromISO, dayIndex } from "./dates.js";

const APPUI_LONG_MS = 220;

export function creerRoue({ nomDe, surChoix }) {
  const voile = document.createElement("div");
  voile.className = "roue-voile";
  voile.hidden = true;
  voile.innerHTML = `<div class="roue-titre"></div><div class="roue">${STATUTS.map(
    (s) => `<button type="button" class="roue-choix s-${s.id}" data-id="${s.id}">${svgStr(s.id)}<span>${s.court}</span></button>`,
  ).join("")}<button type="button" class="roue-centre" aria-label="Fermer">${svgStr("x")}</button></div>`;
  document.body.appendChild(voile);
  const roue = voile.querySelector(".roue");
  const titre = voile.querySelector(".roue-titre");

  let cible = null; // { date, col, bouton }
  let mode = null; // "glisse" tant que le doigt est posé
  let survol = null;
  let appui = null;

  function ouvrir(bouton, x, y, m = "glisse") {
    const { date, col } = bouton.dataset;
    cible = { date, col, bouton };
    mode = m;
    survol = null;
    const d = fromISO(date);
    titre.textContent = `${nomDe(col)} · ${JOURS[dayIndex(d)].toLowerCase()} ${d.getDate()}`;
    const R = Math.min(106, window.innerWidth * 0.26);
    const marge = R + 48;
    const cx = Math.min(Math.max(x, marge), window.innerWidth - marge);
    const cy = Math.min(Math.max(y, marge + 70), window.innerHeight - marge);
    roue.style.left = `${cx}px`;
    roue.style.top = `${cy}px`;
    titre.style.top = `${Math.max(14, cy - R - 112)}px`;
    const actuel = bouton.dataset.statut;
    roue.querySelectorAll(".roue-choix").forEach((b, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / STATUTS.length;
      b.style.setProperty("--x", `${Math.cos(a) * R}px`);
      b.style.setProperty("--y", `${Math.sin(a) * R}px`);
      b.classList.toggle("actuel", b.dataset.id === actuel);
      b.classList.remove("survol");
    });
    voile.hidden = false;
    requestAnimationFrame(() => voile.classList.add("ouvert"));
    bouton.classList.add("appui");
    if (navigator.vibrate) navigator.vibrate(12);
  }

  function fermer() {
    voile.classList.remove("ouvert");
    voile.hidden = true;
    cible?.bouton.classList.remove("appui");
    cible = null;
    mode = null;
  }

  function choixSous(x, y) {
    let meilleur = null, bd = Infinity;
    for (const b of roue.querySelectorAll(".roue-choix")) {
      const r = b.getBoundingClientRect();
      const d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
      if (d < bd) {
        bd = d;
        meilleur = b;
      }
    }
    return bd < 64 ? meilleur : null;
  }
  function survoler(x, y) {
    const b = choixSous(x, y);
    if (b === survol) return;
    survol?.classList.remove("survol");
    survol = b;
    b?.classList.add("survol");
    if (b && navigator.vibrate) navigator.vibrate(6);
  }

  const annulerAppui = () => {
    if (!appui) return;
    clearTimeout(appui.timer);
    appui.bouton.classList.remove("appui");
    appui = null;
  };
  function debut(bouton, x, y) {
    if (!bouton || cible) return;
    appui = { bouton, x, y, timer: null };
    bouton.classList.add("appui");
    appui.timer = setTimeout(() => {
      if (!appui) return;
      const b = appui.bouton, { x: ax, y: ay } = appui;
      appui = null;
      b.classList.remove("appui");
      ouvrir(b, ax, ay);
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
      const c = cible;
      fermer();
      if (b && c) surChoix(c.date, c.col, b.dataset.id);
      return;
    }
    if (appui) {
      const b = appui.bouton, { x: ax, y: ay } = appui;
      annulerAppui();
      ouvrir(b, x ?? ax, y ?? ay, "toucher"); // simple toucher : la roue reste ouverte, on touche son choix
    }
  }

  voile.addEventListener("click", (e) => {
    if (mode !== "toucher") return;
    const b = e.target.closest(".roue-choix");
    const c = cible;
    fermer();
    if (b && c) surChoix(c.date, c.col, b.dataset.id);
  });

  let dernierTouch = 0;
  const pt = (e) => e.changedTouches?.[0] || e.touches?.[0] || e;
  const tuile = (e) => e.target.closest?.(".tuile");
  document.addEventListener("touchstart", (e) => {
    dernierTouch = Date.now();
    const b = tuile(e);
    if (b) debut(b, pt(e).clientX, pt(e).clientY);
  }, { passive: true });
  window.addEventListener("touchmove", (e) => bouge(pt(e).clientX, pt(e).clientY, e), { passive: false });
  window.addEventListener("touchend", (e) => {
    dernierTouch = Date.now();
    if (!appui && mode !== "glisse") return;
    fin(pt(e).clientX, pt(e).clientY);
    e.cancelable && e.preventDefault();
  });
  window.addEventListener("touchcancel", () => {
    annulerAppui();
    if (mode === "glisse") fermer();
  });
  const viaTouch = () => Date.now() - dernierTouch < 800;
  document.addEventListener("mousedown", (e) => !viaTouch() && tuile(e) && debut(tuile(e), e.clientX, e.clientY));
  window.addEventListener("mousemove", (e) => !viaTouch() && bouge(e.clientX, e.clientY, e));
  window.addEventListener("mouseup", (e) => {
    if (viaTouch() || (!appui && mode !== "glisse")) return;
    fin(e.clientX, e.clientY);
  });
  document.addEventListener("contextmenu", (e) => tuile(e) && e.preventDefault());
  return { ouverte: () => !!cible, fermer };
}
