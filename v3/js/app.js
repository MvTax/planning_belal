// Planning V3 — point d'entrée (base V2 + ergonomie fondée sur la recherche : voir RECHERCHE.md)
import { html, render, useState, useEffect } from "../vendor/ui.js";
import { getReglages, bilanPaiements, mois as lireMois, definirStatut, vendeurs, STATUT } from "./store.js";
import { moisDe, decalerMois, JOURS, fromISO, dayIndex } from "./dates.js";
import { Icone, useStore } from "./ui-parts.js";
import { tic } from "./retour.js";
import { compter } from "./mesures.js";
import { creerRoue } from "./roue.js";
import { Planning, Fiches, FeuilleRenforts, FeuillePaie, FeuilleNote, ChoixMois, Reglages, ToastHote, toast } from "./views.js";

const prenom = (n) => String(n).trim().split(/\s+/)[0];
// [P1] Les trois destinations sont dans la barre du bas, sous le pouce, avec icône ET mot [P7]
const ONGLETS = [
  { id: "planning", titre: "Planning", icone: "cal" },
  { id: "extras", titre: "Extras payés", icone: "euro" },
  { id: "fiches", titre: "Fiches", icone: "doc" },
];
const FACTEUR = { normal: 1, grand: 1.12, tres: 1.26 };

// [P4] Taille du texte : on part du réglage « Taille du texte » d'iOS (Dynamic Type), puis du choix fait dans l'appli
function tailleSysteme() {
  try {
    if (!CSS.supports("font", "-apple-system-body")) return 1;
    const s = document.createElement("span");
    s.style.font = "-apple-system-body";
    s.style.position = "absolute";
    s.style.visibility = "hidden";
    document.body.appendChild(s);
    const px = parseFloat(getComputedStyle(s).fontSize) || 17;
    s.remove();
    return Math.min(1.3, Math.max(1, px / 17));
  } catch {
    return 1;
  }
}
const SYSTEME = tailleSysteme();

const lireCoach = () => {
  try {
    return localStorage.getItem("v3.coach") === "2";
  } catch {
    return false;
  }
};

function App() {
  useStore();
  const [vue, setVue] = useState("planning");
  const [mois, setMois] = useState(moisDe(new Date()));
  const [page, setPage] = useState(0);
  const [feuille, setFeuille] = useState(null); // { type, date }
  const [picker, setPicker] = useState(false);
  const [reglages, setReglages] = useState(false);
  const [coach, setCoach] = useState(() => !lireCoach());
  const r = getReglages();

  useEffect(() => {
    document.documentElement.classList.remove("t-normal", "t-grand", "t-tres");
    document.documentElement.classList.add(`t-${r.taille}`);
    document.documentElement.style.setProperty("--t", Math.min(1.45, (FACTEUR[r.taille] || 1) * SYSTEME).toFixed(3));
  }, [r.taille]);

  // Mois nouvellement préparé : on le dit une fois
  useEffect(() => {
    const d = lireMois(mois);
    if (d.neuf && !App.dit?.has(mois)) {
      (App.dit ||= new Set()).add(mois);
      if (coach) return;
      toast(mois === "2026-11" ? "Voici votre planning de novembre." : "Mois préparé : tout le monde « OK », sauf les repos habituels.");
    }
  }, [mois]);

  const fermerCoach = () => {
    setCoach(false);
    try {
      localStorage.setItem("v3.coach", "2");
    } catch {
      /* ignoré */
    }
  };
  const aValider = bilanPaiements(mois).aValider;
  const choisirMois = (m) => {
    setMois(m);
    setPicker(false);
    setVue("planning");
  };
  const actif = vue === "fiches" ? "fiches" : page === 1 ? "extras" : "planning";
  const aller = (id) => {
    tic();
    if (id === "fiches") return setVue("fiches");
    setVue("planning");
    setPage(id === "extras" ? 1 : 0);
  };
  const commun = { onReglages: () => setReglages(true), onPicker: () => setPicker(true) };

  return html`
    <div style=${{ position: "absolute", inset: 0, display: vue === "planning" ? "flex" : "none", flexDirection: "column" }}>
      <${Planning} mois=${mois} page=${page} onPage=${setPage} onDelta=${(n) => setMois(decalerMois(mois, n))}
        onRenforts=${(d) => setFeuille({ type: "renforts", date: d })} onPaie=${(d) => setFeuille({ type: "paie", date: d })} onNote=${(d) => setFeuille({ type: "note", date: d })} ...${commun} />
    </div>
    ${vue === "fiches" ? html`<div style=${{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}><${Fiches} mois=${mois} onAllerExtras=${() => { setPage(1); setVue("planning"); }} ...${commun} /></div>` : null}

    <nav class="dock" aria-label="Navigation">
      ${ONGLETS.map((o) => html`<button class=${actif === o.id ? "actif" : ""} aria-current=${actif === o.id ? "page" : null} onClick=${() => aller(o.id)}>
        <${Icone} n=${o.icone} />${o.titre}${o.id === "extras" && aValider ? html`<span class="badge" aria-label=${`${aValider} à valider`}>${aValider}</span>` : null}
      </button>`)}
    </nav>

    ${coach && vue === "planning" ? html`<div class="astuce"><div class="gestes"><b>Touchez une case</b>, puis touchez le bon choix.<br />Les boutons du bas changent de page.</div><button onClick=${fermerCoach}>Compris</button></div>` : null}
    ${feuille?.type === "renforts" ? html`<${FeuilleRenforts} date=${feuille.date} onClose=${() => setFeuille(null)} />` : null}
    ${feuille?.type === "paie" ? html`<${FeuillePaie} date=${feuille.date} onClose=${() => setFeuille(null)} />` : null}
    ${feuille?.type === "note" ? html`<${FeuilleNote} date=${feuille.date} onClose=${() => setFeuille(null)} />` : null}
    ${picker ? html`<${ChoixMois} mois=${mois} onChoix=${choisirMois} onClose=${() => setPicker(false)} />` : null}
    ${reglages ? html`<${Reglages} onClose=${() => setReglages(false)} />` : null}
    <${ToastHote} />`;
}

// Roue de choix : un toucher l'ouvre (on touche son choix), ou appui long puis glissé
const nomDe = (col) => prenom(vendeurs().find((v) => String(v.colonne) === String(col))?.nom || "");
creerRoue({
  nomDe,
  surChoix: (date, col, code) => {
    const defaire = definirStatut(date, col, code);
    compter("choix");
    const annuler = () => {
      compter("annulations");
      defaire();
    };
    const d = fromISO(date);
    toast(`${nomDe(col)} · ${JOURS[dayIndex(d)].slice(0, 3).toLowerCase()}. ${d.getDate()} → ${STATUT[code].long}`, annuler);
  },
});

render(html`<${App} />`, document.getElementById("app"));
