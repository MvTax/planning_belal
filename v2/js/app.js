// Planning V2 — point d'entrée
import { html, render, useState, useEffect } from "../vendor/ui.js";
import { getReglages, bilanPaiements, mois as lireMois, definirStatut, vendeurs, STATUT } from "./store.js";
import { moisDe, JOURS, fromISO, dayIndex } from "./dates.js";
import { Icone, useStore } from "./ui-parts.js";
import { creerRoue } from "./roue.js";
import { Planning, Extras, Imprimer, FeuilleJour, ChoixMois, Reglages, ToastHote, toast } from "./views.js";

const prenom = (n) => String(n).trim().split(/\s+/)[0];
const ONGLETS = [
  { id: "planning", titre: "Planning", icone: "cal" },
  { id: "extras", titre: "Extras", icone: "euro" },
  { id: "imprimer", titre: "Imprimer", icone: "imprimer" },
];

function lireCoach() {
  try {
    return localStorage.getItem("v2.coach") === "1";
  } catch {
    return false;
  }
}

function App() {
  useStore();
  const [vue, setVue] = useState("planning");
  const [ancre, setAncre] = useState(moisDe(new Date()));
  const [moisActif, setMoisActif] = useState(ancre);
  const [jour, setJour] = useState(null);
  const [picker, setPicker] = useState(false);
  const [reglages, setReglages] = useState(false);
  const [coach, setCoach] = useState(() => !lireCoach());
  const r = getReglages();

  useEffect(() => {
    document.documentElement.classList.remove("t-normal", "t-grand", "t-tres");
    document.documentElement.classList.add(`t-${r.taille}`);
  }, [r.taille]);

  // Mois nouvellement préparé : on le dit une fois
  useEffect(() => {
    const d = lireMois(moisActif);
    if (d.neuf && !App.dit?.has(moisActif)) {
      (App.dit ||= new Set()).add(moisActif);
      if (coach) return; // au tout premier lancement, l'astuce suffit
      toast(moisActif === "2026-11" ? "Voici votre planning de novembre." : "Mois préparé : tout le monde « OK », sauf les repos habituels.");
    }
  }, [moisActif]);

  const fermerCoach = () => {
    setCoach(false);
    try {
      localStorage.setItem("v2.coach", "1");
    } catch {
      /* ignoré */
    }
  };
  const aValider = bilanPaiements(moisActif).aValider;
  const ouvrirJour = (date, section) => setJour({ date, section });
  const allerMois = (m) => {
    setAncre(m);
    setMoisActif(m);
    setPicker(false);
    setVue("planning");
  };
  const commun = { onReglages: () => setReglages(true), onPicker: () => setPicker(true) };

  return html`
    <div class="vue" style=${{ position: "absolute", inset: 0, display: vue === "planning" ? "flex" : "none" }}>
      <${Planning} ancre=${ancre} onMois=${allerMois} onActif=${setMoisActif} onJour=${ouvrirJour} ...${commun} />
    </div>
    ${vue === "extras" ? html`<div class="vue" style=${{ position: "absolute", inset: 0 }}><${Extras} mois=${moisActif} onMois=${allerMois} onJour=${ouvrirJour} ...${commun} /></div>` : null}
    ${vue === "imprimer" ? html`<div class="vue" style=${{ position: "absolute", inset: 0 }}><${Imprimer} mois=${moisActif} onMois=${allerMois} onExtras=${() => setVue("extras")} ...${commun} /></div>` : null}

    <nav class="dock" aria-label="Navigation">
      <span class="glisseur" style=${{ transform: `translateX(calc(${ONGLETS.findIndex((o) => o.id === vue)} * (88px * var(--t) + 2px)))` }}></span>
      ${ONGLETS.map((o) => html`<button class=${vue === o.id ? "actif" : ""} onClick=${() => setVue(o.id)}>
        <${Icone} n=${o.icone} />${o.titre}${o.id === "extras" && aValider ? html`<span class="badge">${aValider}</span>` : null}
      </button>`)}
    </nav>

    ${coach && vue === "planning" ? html`<div class="astuce"><div class="gestes"><b>Touchez</b> une case : OK ↔ Repos.<br /><b>Maintenez</b> pour plus de choix. <b>Balayez</b> pour changer de semaine.</div><button onClick=${fermerCoach}>Compris</button></div>` : null}
    ${jour ? html`<${FeuilleJour} date=${jour.date} onClose=${() => setJour(null)} />` : null}
    ${picker ? html`<${ChoixMois} mois=${moisActif} onChoix=${allerMois} onClose=${() => setPicker(false)} />` : null}
    ${reglages ? html`<${Reglages} onClose=${() => setReglages(false)} />` : null}
    <${ToastHote} />`;
}

// Roue de choix : appui long sur une tuile ; un simple toucher fait basculer OK ↔ Repos
const nomDe = (col) => prenom(vendeurs().find((v) => String(v.colonne) === String(col))?.nom || "");
creerRoue({
  nomDe,
  surChoix: (date, col, code) => {
    const annuler = definirStatut(date, col, code);
    const d = fromISO(date);
    toast(`${nomDe(col)} · ${JOURS[dayIndex(d)].slice(0, 3).toLowerCase()}. ${d.getDate()} → ${STATUT[code].long}`, annuler);
  },
  surToucher: (b) => {
    const { date, col, statut } = b.dataset;
    const prochain = statut === "travail" ? "repos" : "travail";
    const annuler = definirStatut(date, col, prochain);
    const d = fromISO(date);
    toast(`${nomDe(col)} · ${JOURS[dayIndex(d)].slice(0, 3).toLowerCase()}. ${d.getDate()} → ${STATUT[prochain].long}`, annuler);
  },
});

render(html`<${App} />`, document.getElementById("app"));
