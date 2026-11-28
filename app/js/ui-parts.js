// Petits composants réutilisables : icônes, avatars, feuilles qui se ferment d'un glissement, « glisser pour confirmer »
import { html, useState, useEffect, useRef } from "../vendor/ui.js?v=22";
import { ICONES } from "./icons.js?v=22";
import { abonner, rev } from "./store.js?v=22";

export const Icone = ({ n, cls = "", style }) => html`<svg class=${cls} style=${style} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" dangerouslySetInnerHTML=${{ __html: ICONES[n] || "" }}></svg>`;

export function useStore() {
  const [, setR] = useState(rev);
  useEffect(() => abonner(setR), []);
}

// Les couleurs d'avatar suivent l'ordre de l'équipe ; les renforts en ont une stable d'après leur prénom
export const couleurNom = (nom) => {
  let h = 0;
  for (const c of String(nom)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `a${(h % 4) + 2}`;
};
export const initiale = (nom) => (String(nom).trim()[0] || "?").toUpperCase();
export const Avatar = ({ nom, c, petit }) => html`<span class=${`avatar ${petit ? "petit" : ""} ${c}`}>${initiale(nom)}</span>`;

// Feuille (bottom sheet) : se ferme en la tirant vers le bas
export function Feuille({ titre, sous, onClose, children }) {
  const ref = useRef();
  const g = useRef(null);
  const [sort, setSort] = useState(false);
  const fermer = () => {
    setSort(true);
    setTimeout(onClose, 260);
  };
  const debut = (e) => {
    if (e.target.closest("button")) return; // la croix reste un vrai bouton (sinon la capture du pointeur lui vole le clic)
    g.current = { y: e.clientY, t: performance.now(), dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    ref.current.style.animation = "none";
    ref.current.style.transition = "none";
  };
  const bouge = (e) => {
    if (!g.current) return;
    g.current.dy = Math.max(0, e.clientY - g.current.y);
    ref.current.style.transform = `translateY(${g.current.dy}px)`;
  };
  const fin = () => {
    if (!g.current) return;
    const { dy, t } = g.current;
    const vitesse = dy / Math.max(1, performance.now() - t);
    g.current = null;
    if (dy > 110 || vitesse > 0.6) {
      ref.current.style.transition = "transform .22s ease";
      ref.current.style.transform = "translateY(100%)";
      setTimeout(onClose, 200);
    } else {
      ref.current.style.transition = "transform .4s cubic-bezier(.2,.9,.3,1.15)";
      ref.current.style.transform = "";
    }
  };
  const tire = { onPointerDown: debut, onPointerMove: bouge, onPointerUp: fin, onPointerCancel: fin };
  return html`<div class="voile" onClick=${(e) => e.target === e.currentTarget && fermer()}>
    <div class=${`feuille ${sort ? "sortie" : ""}`} ref=${ref} role="dialog" aria-modal="true">
      <div class="poignee" ...${tire}></div>
      <div class="feuille-tete" ...${tire}>
        <div><h2>${titre}</h2>${sous ? html`<p>${sous}</p>` : null}</div>
        <button class="fermer" onClick=${fermer} aria-label="Fermer"><${Icone} n="x" /></button>
      </div>
      <div class="feuille-corps">${children}</div>
    </div>
  </div>`;
}

// Curseur « glisser pour confirmer » : l'action part au moment où le doigt se relève (geste utilisateur valide pour imprimer)
export function Glisse({ texte, icone, type, onDone, desactive, relache = 1200 }) {
  const piste = useRef();
  const [x, setX] = useState(0);
  const [etat, setEtat] = useState("repos"); // repos | tire | fini
  const g = useRef(null);
  const max = () => (piste.current ? piste.current.clientWidth - 66 : 0);
  const debut = (e) => {
    if (desactive || etat === "fini") return;
    g.current = { x0: e.clientX - x };
    e.currentTarget.setPointerCapture(e.pointerId);
    setEtat("tire");
  };
  const bouge = (e) => {
    if (!g.current) return;
    setX(Math.min(max(), Math.max(0, e.clientX - g.current.x0)));
  };
  const fin = () => {
    if (!g.current) return;
    g.current = null;
    if (x >= max() * 0.88) {
      setX(max());
      setEtat("fini");
      if (navigator.vibrate) navigator.vibrate(18);
      onDone();
      setTimeout(() => {
        setEtat("repos");
        setX(0);
      }, relache);
    } else {
      setEtat("repos");
      setX(0);
    }
  };
  const p = max() ? x / max() : 0;
  return html`<div ref=${piste} class=${`glisse ${type} ${etat === "tire" ? "tire" : ""} ${etat === "fini" ? "fini" : ""}`} style=${{ "--x": `${x}px`, "--p": p, opacity: desactive ? 0.5 : 1 }}>
    <div class="remplit"></div>
    <div class="texte">${texte}</div>
    <div class="poignee-g" style=${{ touchAction: "none" }} onPointerDown=${debut} onPointerMove=${bouge} onPointerUp=${fin} onPointerCancel=${fin}>
      <${Icone} n=${etat === "fini" ? "travail" : icone} />
    </div>
  </div>`;
}
