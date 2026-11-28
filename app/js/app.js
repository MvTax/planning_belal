// Planning V2 — point d'entrée
import { html, render, useState, useEffect } from "../vendor/ui.js?v=22";
import { getReglages, bilanPaiements, mois as lireMois, definirStatut, vendeurs, STATUT } from "./store.js?v=22";
import { moisDe, decalerMois, JOURS, fromISO, dayIndex } from "./dates.js?v=22";
import { Icone, useStore } from "./ui-parts.js?v=22";
import { creerRoue } from "./roue.js?v=22";
import { Planning, Fiches, FeuilleRenforts, FeuillePaie, FeuilleNote, ChoixMois, Reglages, ToastHote, toast } from "./views.js?v=22";

const prenom = (n) => String(n).trim().split(/\s+/)[0];
const ONGLETS = [
  { id: "planning", titre: "Planning", icone: "cal" },
  { id: "fiches", titre: "Fiches", icone: "doc" },
];

const lireCoach = () => {
  try {
    return localStorage.getItem("v2.coach") === "2";
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
      localStorage.setItem("v2.coach", "2");
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
  const commun = { onReglages: () => setReglages(true), onPicker: () => setPicker(true) };

  return html`
    <div style=${{ position: "absolute", inset: 0, display: vue === "planning" ? "flex" : "none", flexDirection: "column" }}>
      <${Planning} mois=${mois} page=${page} onPage=${setPage} onDelta=${(n) => setMois(decalerMois(mois, n))}
        onRenforts=${(d) => setFeuille({ type: "renforts", date: d })} onPaie=${(d) => setFeuille({ type: "paie", date: d })} onNote=${(d) => setFeuille({ type: "note", date: d })} ...${commun} />
    </div>
    ${vue === "fiches" ? html`<div style=${{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}><${Fiches} mois=${mois} onAllerExtras=${() => { setPage(1); setVue("planning"); }} ...${commun} /></div>` : null}

    <nav class="dock" aria-label="Navigation">
      <span class="glisseur" style=${{ transform: `translateX(calc(${ONGLETS.findIndex((o) => o.id === vue)} * (110px * var(--t) + 2px)))` }}></span>
      ${ONGLETS.map((o) => html`<button class=${vue === o.id ? "actif" : ""} onClick=${() => setVue(o.id)}>
        <${Icone} n=${o.icone} />${o.titre}${o.id === "fiches" && aValider ? html`<span class="badge">${aValider}</span>` : null}
      </button>`)}
    </nav>

    ${coach && vue === "planning" ? html`<div class="astuce"><div class="gestes"><b>Touchez</b> une case pour choisir, ou <b>maintenez</b> et glissez.<br /><b>Balayez à gauche</b> : extras payés.</div><button onClick=${fermerCoach}>Compris</button></div>` : null}
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
    const annuler = definirStatut(date, col, code);
    const d = fromISO(date);
    toast(`${nomDe(col)} · ${JOURS[dayIndex(d)].slice(0, 3).toLowerCase()}. ${d.getDate()} → ${STATUT[code].long}`, annuler);
  },
});

render(html`<${App} />`, document.getElementById("app"));
