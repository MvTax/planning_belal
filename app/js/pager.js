// Balayage horizontal Planning ↔ Extras, entièrement piloté par l'appli.
// Le défilement horizontal natif d'iOS (aimantation + effet « élastique » en bout de course)
// faisait partir la page à gauche puis revenir. Ici : la page suit le doigt, puis glisse
// jusqu'à sa place avec une courbe douce. Le défilement vertical reste natif.
import { useEffect, useLayoutEffect, useRef } from "../vendor/ui.js";

const DUREE = 380; // ms
const COURBE = "cubic-bezier(.22,.8,.24,1)";

export function usePager({ pager, piste, pages, entete, page, onPage, nb = 2 }) {
  const etat = useRef({ page, anim: null });
  etat.current.page = page;
  etat.current.onPage = onPage;

  const largeur = () => pager.current?.clientWidth || 1;

  // Position de la piste (en pages, 0 = Planning) et fondu de l'en-tête
  const placer = (pos, anime) => {
    const p = piste.current;
    if (!p) return;
    p.style.transition = anime ? `transform ${DUREE}ms ${COURBE}` : "none";
    p.style.transform = `translate3d(${-pos * largeur()}px,0,0)`;
    const e = entete.current;
    if (e) {
      e.classList.toggle("anime", !!anime);
      e.style.setProperty("--p", Math.min(1, Math.max(0, pos)).toFixed(3));
    }
  };

  // Hauteur : celle de la page affichée ; pendant un glissement, la plus grande des deux
  const hauteur = (toutes) => {
    const el = pager.current;
    if (!el) return;
    const h = pages.map((r) => r.current?.offsetHeight || 0);
    el.style.height = `${toutes ? Math.max(...h) : h[etat.current.page] || 0}px`;
  };

  useLayoutEffect(() => {
    if (!etat.current.anim && !etat.current.glisse) hauteur(false);
  });
  useEffect(() => {
    const ro = new ResizeObserver(() => !etat.current.anim && !etat.current.glisse && hauteur(false));
    for (const r of pages) r.current && ro.observe(r.current);
    const auRedim = () => placer(etat.current.page, false);
    window.addEventListener("resize", auRedim);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", auRedim);
    };
  }, []);

  // Changement de page (doigt, onglet, « Aller les valider ») : glissement animé
  const premier = useRef(true);
  useLayoutEffect(() => {
    if (premier.current) {
      premier.current = false;
      placer(page, false);
      return;
    }
    hauteur(true);
    placer(page, true);
    clearTimeout(etat.current.anim);
    etat.current.anim = setTimeout(() => {
      etat.current.anim = null;
      hauteur(false);
      if (entete.current) entete.current.classList.remove("anime");
    }, DUREE + 40);
  }, [page]);

  // Gestes
  useEffect(() => {
    const el = pager.current;
    if (!el) return;
    let g = null; // { x0, y0, axe, dx, t, pts }
    let bloquerClic = false;
    const roueOuverte = () => !!document.querySelector(".roue-voile.ouvert");

    const debut = (e) => {
      if (e.touches.length !== 1 || roueOuverte()) return (g = null);
      const t = e.touches[0];
      g = { x0: t.clientX, y0: t.clientY, axe: null, dx: 0, pts: [[t.clientX, performance.now()]] };
    };
    const bouge = (e) => {
      if (!g) return;
      if (roueOuverte()) {
        if (g.axe === "x") placer(etat.current.page, true);
        g = null;
        return;
      }
      const t = e.touches[0];
      const dx = t.clientX - g.x0, dy = t.clientY - g.y0;
      if (!g.axe) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        g.axe = Math.abs(dx) > Math.abs(dy) * 1.15 ? "x" : "y";
        if (g.axe === "x") {
          etat.current.glisse = true;
          hauteur(true);
        }
      }
      if (g.axe !== "x") return;
      e.cancelable && e.preventDefault(); // pas de défilement vertical pendant un balayage
      const w = largeur(), p = etat.current.page;
      let d = dx;
      // Résistance douce au-delà des bords (aucun rebond)
      if ((p === 0 && d > 0) || (p === nb - 1 && d < 0)) d = d / (1 + Math.abs(d) / 60);
      g.dx = d;
      g.pts.push([t.clientX, performance.now()]);
      if (g.pts.length > 6) g.pts.shift();
      placer(p - d / w, false);
    };
    const fin = () => {
      if (!g) return;
      const geste = g;
      g = null;
      if (geste.axe !== "x") return;
      etat.current.glisse = false;
      bloquerClic = true;
      setTimeout(() => (bloquerClic = false), 350);
      const w = largeur(), p = etat.current.page;
      const [a, b] = [geste.pts[0], geste.pts[geste.pts.length - 1]];
      const v = (b[0] - a[0]) / Math.max(1, b[1] - a[1]); // px/ms
      let cible = p;
      if (geste.dx < -w * 0.22 || v < -0.35) cible = p + 1;
      else if (geste.dx > w * 0.22 || v > 0.35) cible = p - 1;
      cible = Math.max(0, Math.min(nb - 1, cible));
      if (cible === p) {
        // retour à sa place
        placer(p, true);
        clearTimeout(etat.current.anim);
        etat.current.anim = setTimeout(() => {
          etat.current.anim = null;
          hauteur(false);
        }, DUREE + 40);
      } else etat.current.onPage(cible);
    };
    // Un balayage ne doit pas déclencher le bouton sous le doigt
    const clic = (e) => {
      if (bloquerClic) {
        e.stopPropagation();
        e.preventDefault();
      }
    };
    el.addEventListener("touchstart", debut, { passive: true });
    el.addEventListener("touchmove", bouge, { passive: false });
    el.addEventListener("touchend", fin);
    el.addEventListener("touchcancel", fin);
    el.addEventListener("click", clic, true);
    return () => {
      el.removeEventListener("touchstart", debut);
      el.removeEventListener("touchmove", bouge);
      el.removeEventListener("touchend", fin);
      el.removeEventListener("touchcancel", fin);
      el.removeEventListener("click", clic, true);
    };
  }, []);
}
