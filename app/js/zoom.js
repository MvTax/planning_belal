// Agrandissement plein écran d'une page : ouverture animée depuis la miniature, zoom au pincement, déplacement au doigt,
// un simple toucher referme (animation retour vers la miniature).
import { html, useRef, useEffect, useLayoutEffect } from "../vendor/ui.js?v=22";
import { Icone } from "./ui-parts.js?v=22";

export const LARGEUR_FEUILLE = 793.7; // A4 en px CSS (96 dpi)
export const HAUTEUR_FEUILLE = 1122.5;
const MAX_ZOOM = 5;

export function Zoom({ page, miniature, onClose }) {
  const voile = useRef();
  const contenu = useRef();
  const etat = useRef({ s: 1, tx: 0, ty: 0, fit: 1 });
  const L = LARGEUR_FEUILLE, H = HAUTEUR_FEUILLE;

  const dessiner = () => {
    const { s, tx, ty } = etat.current;
    contenu.current.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
  };
  const borner = () => {
    const e = etat.current;
    const vw = innerWidth, vh = innerHeight;
    const w = L * e.s, h = H * e.s;
    e.tx = w <= vw ? (vw - w) / 2 : Math.min(8, Math.max(vw - w - 8, e.tx));
    e.ty = h <= vh ? (vh - h) / 2 : Math.min(8, Math.max(vh - h - 8, e.ty));
  };
  const ajuster = () => {
    const e = etat.current;
    e.fit = Math.min((innerWidth - 12) / L, (innerHeight - 12) / H);
    return e.fit;
  };

  // Ouverture : la page part de la miniature et grandit jusqu'à l'écran
  useLayoutEffect(() => {
    const e = etat.current;
    e.s = ajuster();
    borner();
    dessiner();
    const fin = contenu.current.style.transform;
    if (miniature) {
      const k = miniature.width / L;
      contenu.current.animate([{ transform: `translate(${miniature.left}px, ${miniature.top}px) scale(${k})` }, { transform: fin }], { duration: 420, easing: "cubic-bezier(.2,.85,.25,1)" });
    } else contenu.current.animate([{ opacity: 0, transform: fin + " scale(.96)" }, { opacity: 1, transform: fin }], { duration: 260, easing: "ease-out" });
    voile.current.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: "ease-out" });
  }, []);

  let fermeture = useRef(false);
  const fermer = () => {
    if (fermeture.current) return;
    fermeture.current = true;
    const e = etat.current;
    const debut = contenu.current.style.transform;
    let anim;
    if (miniature && Math.abs(e.s - e.fit) < 0.02) {
      const k = miniature.width / L;
      anim = contenu.current.animate([{ transform: debut }, { transform: `translate(${miniature.left}px, ${miniature.top}px) scale(${k})` }], { duration: 340, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" });
    } else anim = contenu.current.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: "forwards" });
    voile.current.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, fill: "forwards" });
    setTimeout(onClose, 330);
  };

  // Gestes tactiles (non passifs pour bloquer le défilement de la page derrière)
  useEffect(() => {
    const el = voile.current;
    const e = etat.current;
    let g = null; // geste en cours
    const pts = (ev) => [...ev.touches].map((t) => ({ x: t.clientX, y: t.clientY }));
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const debut = (ev) => {
      if (ev.target.closest?.(".zoom-btn")) return;
      const p = pts(ev);
      if (p.length === 1) g = { type: "un", x0: p[0].x, y0: p[0].y, tx0: e.tx, ty0: e.ty, t0: performance.now(), bouge: false, pince: g?.pince || false };
      else if (p.length >= 2) g = { type: "deux", d0: dist(p[0], p[1]), s0: e.s, cx0: (p[0].x + p[1].x) / 2, cy0: (p[0].y + p[1].y) / 2, tx0: e.tx, ty0: e.ty, pince: true, bouge: true };
      ev.preventDefault();
    };
    const bouge = (ev) => {
      if (!g) return;
      ev.preventDefault();
      const p = pts(ev);
      if (g.type === "un" && p.length === 1) {
        const dx = p[0].x - g.x0, dy = p[0].y - g.y0;
        if (Math.hypot(dx, dy) > 8) g.bouge = true;
        if (g.bouge && e.s > e.fit * 1.02) {
          e.tx = g.tx0 + dx;
          e.ty = g.ty0 + dy;
          dessiner();
        }
      } else if (g.type === "deux" && p.length >= 2) {
        const d = dist(p[0], p[1]);
        const cx = (p[0].x + p[1].x) / 2, cy = (p[0].y + p[1].y) / 2;
        const s = Math.min(e.fit * MAX_ZOOM, Math.max(e.fit, g.s0 * (d / g.d0)));
        const px = (g.cx0 - g.tx0) / g.s0, py = (g.cy0 - g.ty0) / g.s0; // point de la page sous les doigts
        e.s = s;
        e.tx = cx - px * s;
        e.ty = cy - py * s;
        dessiner();
      }
    };
    const fin = (ev) => {
      if (ev.target.closest?.(".zoom-btn")) return;
      if (ev.touches.length === 0 && g) {
        const tap = g.type === "un" && !g.bouge && !g.pince && performance.now() - g.t0 < 450;
        g = null;
        borner();
        el.querySelector(".zoom-contenu").style.transition = "transform .25s cubic-bezier(.2,.9,.3,1.1)";
        dessiner();
        setTimeout(() => (el.querySelector(".zoom-contenu").style.transition = ""), 280);
        if (tap) fermer();
      } else if (ev.touches.length === 1 && g) {
        const t = ev.touches[0];
        g = { type: "un", x0: t.clientX, y0: t.clientY, tx0: e.tx, ty0: e.ty, t0: performance.now(), bouge: true, pince: true };
      }
    };
    el.addEventListener("touchstart", debut, { passive: false });
    el.addEventListener("touchmove", bouge, { passive: false });
    el.addEventListener("touchend", fin, { passive: false });
    el.addEventListener("touchcancel", () => (g = null));
    // Souris : clic = fermer, molette = zoom
    let moved = false, d0 = null;
    el.addEventListener("mousedown", (ev) => { moved = false; d0 = { x: ev.clientX, y: ev.clientY, tx: e.tx, ty: e.ty }; });
    el.addEventListener("mousemove", (ev) => {
      if (!d0 || ev.buttons !== 1) return;
      if (Math.hypot(ev.clientX - d0.x, ev.clientY - d0.y) > 6) moved = true;
      if (moved && e.s > e.fit * 1.02) { e.tx = d0.tx + ev.clientX - d0.x; e.ty = d0.ty + ev.clientY - d0.y; dessiner(); }
    });
    el.addEventListener("mouseup", (ev) => {
      if (ev.target.closest(".zoom-btn")) return;
      if (!moved && !("ontouchstart" in window)) fermer();
      borner(); dessiner();
    });
    el.addEventListener("wheel", (ev) => {
      ev.preventDefault();
      const s = Math.min(e.fit * MAX_ZOOM, Math.max(e.fit, e.s * (ev.deltaY < 0 ? 1.15 : 1 / 1.15)));
      const px = (ev.clientX - e.tx) / e.s, py = (ev.clientY - e.ty) / e.s;
      e.s = s; e.tx = ev.clientX - px * s; e.ty = ev.clientY - py * s; borner(); dessiner();
    }, { passive: false });
    const touche = (ev) => ev.key === "Escape" && fermer();
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, []);

  const pas = (f) => {
    const e = etat.current;
    const s = Math.min(e.fit * MAX_ZOOM, Math.max(e.fit, e.s * f));
    const cx = innerWidth / 2, cy = innerHeight / 2;
    const px = (cx - e.tx) / e.s, py = (cy - e.ty) / e.s;
    e.s = s; e.tx = cx - px * s; e.ty = cy - py * s;
    borner();
    contenu.current.style.transition = "transform .3s cubic-bezier(.2,.9,.3,1.1)";
    dessiner();
    setTimeout(() => contenu.current && (contenu.current.style.transition = ""), 320);
  };

  return html`<div class="zoom-voile" ref=${voile} role="dialog" aria-label="Page en plein écran">
    <div class="zoom-astuce">Pincez pour zoomer · touchez pour fermer</div>
    <div class="zoom-contenu" ref=${contenu} style=${{ width: `${L}px`, height: `${H}px` }} dangerouslySetInnerHTML=${{ __html: page.html }}></div>
    <div class="zoom-outils">
      <button class="zoom-btn" onClick=${(e) => { e.stopPropagation(); pas(1 / 1.6); }} aria-label="Dézoomer"><span>−</span></button>
      <button class="zoom-btn" onClick=${(e) => { e.stopPropagation(); pas(1.6); }} aria-label="Zoomer"><span>+</span></button>
    </div>
  </div>`;
}
