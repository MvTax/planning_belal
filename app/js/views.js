// Écrans : planning du mois (+ page « extras payés » à balayer), fiches à imprimer, réglages
import { html, useState, useEffect, useRef, useMemo, useLayoutEffect } from "../vendor/ui.js";
import {
  STATUT, vendeurs, mois as lireMois, lireJour, getReglages, modifierReglages, definirRenforts, definirTarif, definirTarifs, definirNote,
  estValide, totalJour, tarifDe, libelleTarifs, validerPaiement, validerTout, bilanPaiements, ajouterExtraConnu, HORAIRES_DEFAUT, v1Disponible, importerV1,
  reinitialiserNovembre, toutEffacer, rev,
} from "./store.js";
import { JOURS, JC, MOIS, MOIS_COURTS, iso, fromISO, dayIndex, joursDuMois, estFerie, aujourdhui, nomMois, cap } from "./dates.js";
import { Icone, Avatar, couleurNom, Feuille, useStore } from "./ui-parts.js";
import { toutesLesPages } from "./sheets.js";
import { imprimer, partagerPDF } from "./impression.js";
import { Zoom, LARGEUR_FEUILLE, HAUTEUR_FEUILLE } from "./zoom.js";

const prenom = (n) => String(n).trim().split(/\s+/)[0];
const classeAvatar = (i) => `a${i % 4}`;

// ---------- Notifications ----------
let afficherToast = () => {};
export const toast = (msg, annuler) => afficherToast({ msg, annuler, id: Math.random() });
export function ToastHote() {
  const [t, setT] = useState(null);
  afficherToast = setT;
  useEffect(() => {
    if (!t) return;
    const id = setTimeout(() => setT(null), t.annuler ? 5200 : 3600);
    return () => clearTimeout(id);
  }, [t]);
  if (!t) return null;
  return html`<div class="toast" key=${t.id}><span>${t.msg}</span>${t.annuler ? html`<button onClick=${() => { t.annuler(); setT(null); }}>Annuler</button>` : null}</div>`;
}

// ---------- En-tête : mois à gauche, flèches et réglages à droite ----------
export function Haut({ mois, onDelta, onPicker, onReglages, enfants }) {
  const { nom, annee } = nomMois(mois);
  return html`<header class="haut">
    <div class="haut-ligne">
      <button class="titre-mois" onClick=${onPicker} aria-label="Choisir un mois">
        <span class="annee">${annee}</span>
        <span class="nom" key=${mois}>${nom}</span>
      </button>
      <div class="actions-haut">
        ${onDelta
          ? html`<div class="nav-mois" role="group" aria-label="Changer de mois">
              <button onClick=${() => onDelta(-1)} aria-label="Mois précédent"><${Icone} n="gauche" /></button>
              <button onClick=${() => onDelta(1)} aria-label="Mois suivant"><${Icone} n="droite" /></button>
            </div>`
          : null}
        <button class="rond" onClick=${onReglages} aria-label="Réglages"><${Icone} n="reglages" /></button>
      </div>
    </div>
    ${enfants}
  </header>`;
}

// ---------- Planning : tout le mois, une carte par semaine ----------
function Tuile({ date, v, statut }) {
  const prec = useRef(statut);
  const [vue, setVue] = useState(false);
  useEffect(() => {
    if (prec.current !== statut) {
      prec.current = statut;
      setVue(true);
      const id = setTimeout(() => setVue(false), 450);
      return () => clearTimeout(id);
    }
  }, [statut]);
  const s = statut && STATUT[statut];
  return html`<button class=${`tuile ${s ? `s-${statut}` : "vide"} ${vue ? "vue" : ""}`} data-date=${date} data-col=${v.colonne} data-statut=${statut || ""} aria-label=${`${prenom(v.nom)}, ${date}, ${s ? s.long : "vide"}`}>
    ${s ? html`<${Icone} n=${statut} /><span class="lib">${s.court}</span>` : html`<${Icone} n="plus" />`}
  </button>`;
}

function CelluleJour({ d, k, i }) {
  const we = i >= 5;
  return html`<div class=${`jj ${we ? "we" : ""} ${k === aujourdhui() ? "auj" : ""}`}>
    ${estFerie(d) ? html`<span class="ferie">Férié</span>` : null}
    <span class="nom-j">${JC[i]}</span><span class="num">${d.getDate()}</span>
  </div>`;
}

function Renforts({ date, j, onRenforts }) {
  const ex = j.extras || [];
  return html`<button class="renforts" onClick=${() => onRenforts(date)} aria-label=${`Renforts du ${date}`}>
    ${ex.length
      ? html`<div class="pile">${ex.slice(0, 3).map((n) => html`<${Avatar} nom=${n} c=${couleurNom(n)} petit />`)}</div>${ex.length > 3 ? html`<span class="plus">+${ex.length - 3}</span>` : null}`
      : html`<span class="ajout"><${Icone} n="plus" /></span>`}
  </button>`;
}

const semainesDuMois = (m) => {
  const res = [];
  for (const d of joursDuMois(m)) {
    if (dayIndex(d) === 0 || !res.length) res.push([]);
    res.at(-1).push(d);
  }
  return res;
};

function PagePlanning({ mois, vend, onRenforts }) {
  const data = lireMois(mois);
  return html`<div class="page2" id="page-planning">
    ${semainesDuMois(mois).map(
      (sem) => html`<section class="carte-sem">${sem.map((d) => {
        const k = iso(d), j = data.jours[k] || {}, i = dayIndex(d);
        return html`<div class=${`ligne-j ${i >= 5 ? "we" : ""}`} key=${k}>
          <${CelluleJour} d=${d} k=${k} i=${i} />
          ${vend.map((v) => html`<${Tuile} date=${k} v=${v} statut=${j[v.colonne]} />`)}
          <${Renforts} date=${k} j=${j} onRenforts=${onRenforts} />
        </div>`;
      })}</section>`,
    )}
  </div>`;
}

// ---------- Page « extras payés » (commentaires) ----------
function LigneNote({ date, note, onNote }) {
  return note
    ? html`<button class="note-ligne pleine" onClick=${() => onNote(date)}><${Icone} n="note" /><span>${note}</span></button>`
    : html`<button class="note-ligne" onClick=${() => onNote(date)}><i>+</i> Note</button>`;
}

function PagePaiements({ mois, onPaie, onNote }) {
  const data = lireMois(mois);
  return html`<div class="page2" id="page-paiements">
    ${semainesDuMois(mois).map(
      (sem) => html`<section class="carte-sem">${sem.map((d) => {
        const k = iso(d), j = data.jours[k] || {}, i = dayIndex(d);
        const ex = j.extras || [];
        const ok = ex.length && estValide(j);
        return html`<div class=${`ligne-c ${i >= 5 ? "we" : ""}`} key=${k}>
          <${CelluleJour} d=${d} k=${k} i=${i} />
          <div class="cell-c">
            ${ex.length
              ? html`<div class=${`paie-chip ${ok ? "ok" : "attente"}`}>
                  <button class="paie-corps" onClick=${() => onPaie(k)}>
                    <span class="paie-calc">${libelleTarifs(j)} <b>= ${totalJour(j)} €</b></span>
                    <span class="paie-qui">${ex.map(prenom).join(", ")}${ok ? "" : " · à valider"}</span>
                  </button>
                  ${ok
                    ? html`<span class="paie-coche"><${Icone} n="travail" /></span>`
                    : html`<button class="paie-valider" aria-label="Valider ce paiement" onClick=${() => { const a = validerPaiement(k, true); toast(`Paiement du ${d.getDate()} validé`, a); }}><${Icone} n="travail" /></button>`}
                </div>`
              : null}
            <${LigneNote} date=${k} note=${(j.note || "").trim()} onNote=${onNote} />
          </div>
        </div>`;
      })}</section>`,
    )}
  </div>`;
}

export function Planning({ mois, page, onPage, onDelta, onPicker, onReglages, onRenforts, onPaie, onNote }) {
  useStore();
  const vend = vendeurs();
  const pager = useRef();
  const p0 = useRef();
  const p1 = useRef();
  const bilan = bilanPaiements(mois);

  // Le conteneur prend la hauteur de la page affichée : chaque page garde sa propre taille
  const ajuster = () => {
    const el = pager.current;
    const cible = (page === 1 ? p1 : p0).current;
    if (el && cible) el.style.height = `${cible.offsetHeight}px`;
  };
  useLayoutEffect(ajuster);
  useEffect(() => {
    const ro = new ResizeObserver(ajuster);
    if (p0.current) ro.observe(p0.current);
    if (p1.current) ro.observe(p1.current);
    return () => ro.disconnect();
  }, [mois, page]);
  // Retour en haut au changement de mois
  const defile = useRef();
  useEffect(() => {
    if (defile.current) defile.current.scrollTop = 0;
  }, [mois]);
  // Balayage : on laisse le navigateur finir son glissement et son aimantation, puis on note la page.
  // (Avant, la page changeait au milieu du geste et relançait un défilement programmé qui se battait
  // avec celui du doigt : la colonne partait à gauche puis revenait.)
  const pageRef = useRef(page);
  pageRef.current = page;
  const venantDuDoigt = useRef(false);
  const attente = useRef();
  const entete = useRef();
  const surScroll = (e) => {
    const el = e.currentTarget;
    // En-tête (prénoms ↔ total des extras) en fondu qui suit le doigt, sans re-rendu
    entete.current?.style.setProperty("--p", Math.min(1, Math.max(0, el.scrollLeft / el.clientWidth)).toFixed(3));
    clearTimeout(attente.current);
    attente.current = setTimeout(() => {
      const w = el.clientWidth;
      const n = Math.round(el.scrollLeft / w);
      if (Math.abs(el.scrollLeft - n * w) > 2) return; // encore en mouvement : un autre évènement suivra
      if (n !== pageRef.current) {
        venantDuDoigt.current = true;
        onPage(n);
      }
    }, 110);
  };
  useEffect(() => () => clearTimeout(attente.current), []);
  // Page demandée par un bouton (onglet, « Aller les valider ») : défilement doux vers cette page
  useEffect(() => {
    if (venantDuDoigt.current) {
      venantDuDoigt.current = false;
      return;
    }
    const el = pager.current;
    if (el && Math.abs(el.scrollLeft - page * el.clientWidth) > 2) el.scrollTo({ left: page * el.clientWidth, behavior: "smooth" });
  }, [page]);

  return html`<div class="vue" style=${{ "--n": vend.length }}>
    <${Haut} mois=${mois} onDelta=${onDelta} onPicker=${onPicker} onReglages=${onReglages}
      enfants=${html`<div class="onglets-pl" role="tablist">
        <button class=${page === 0 ? "on" : ""} onClick=${() => onPage(0)}>Planning</button>
        <button class=${page === 1 ? "on" : ""} onClick=${() => onPage(1)}>Extras payés${bilan.aValider ? html`<i>${bilan.aValider}</i>` : null}</button>
      </div>`} />
    <div class="entete-pages" ref=${entete}>
      <div class=${`colonnes ${page === 0 ? "actif" : ""}`} aria-hidden=${page !== 0}>
          <span></span>
          ${vend.map((v, i) => html`<div class=${`col-tete ${classeAvatar(i)}`}><${Avatar} nom=${v.nom} c=${classeAvatar(i)} /><span>${prenom(v.nom)}</span></div>`)}
          <div class="col-tete extras"><span class="ico"><${Icone} n="utilisateur" /></span><span>Renforts</span></div>
        </div>
      <div class=${`bilan-ligne ${page === 1 ? "actif" : ""}`} aria-hidden=${page !== 1}>
          <div class="bilan-txt"><b>${bilan.ok} €</b> validés${bilan.attente ? html` · <span class="att"><b>${bilan.attente} €</b> à valider</span>` : null}</div>
          ${bilan.aValider ? html`<button class="tout-valider" onClick=${() => { const a = validerTout(mois); toast(`${bilan.aValider} jour${bilan.aValider > 1 ? "s" : ""} validé${bilan.aValider > 1 ? "s" : ""}`, a); }}>Tout valider</button>` : null}
        </div>
    </div>
    <div class="defile" ref=${defile}>
      <div class="pager2" ref=${pager} onScroll=${surScroll}>
        <div class="page-ref" ref=${p0}><${PagePlanning} mois=${mois} vend=${vend} onRenforts=${onRenforts} /></div>
        <div class="page-ref" ref=${p1}><${PagePaiements} mois=${mois} onPaie=${onPaie} onNote=${onNote} /></div>
      </div>
    </div>
  </div>`;
}

// ---------- Feuille des renforts : uniquement les prénoms à choisir ----------
export function FeuilleRenforts({ date, onClose }) {
  useStore();
  const j = lireJour(date);
  const d = fromISO(date);
  const ex = j.extras || [];
  const reg = getReglages();
  const [nouveau, setNouveau] = useState(null);
  const tous = [...new Set([...reg.extras, ...vendeurs().map((v) => prenom(v.nom)), ...ex])];
  const bascule = (n) => {
    const annuler = definirRenforts(date, ex.includes(n) ? ex.filter((x) => x !== n) : [...ex, n]);
    toast(`${n} ${ex.includes(n) ? "retiré(e)" : "ajouté(e)"} le ${d.getDate()}`, annuler);
  };
  const ajouter = () => {
    const n = (nouveau || "").trim();
    if (n) {
      ajouterExtraConnu(n);
      definirRenforts(date, [...ex.filter((x) => x !== n), n]);
    }
    setNouveau(null);
  };
  return html`<${Feuille} titre=${`Renforts du ${JOURS[dayIndex(d)].toLowerCase()} ${d.getDate()}`} sous=${`${cap(MOIS[d.getMonth()])} ${d.getFullYear()}`} onClose=${onClose}>
    <div class="bloc">
      <div class="puces">
        ${tous.map((n) => html`<button class=${`puce ${ex.includes(n) ? "on" : ""}`} onClick=${() => bascule(n)}><${Avatar} nom=${n} c=${couleurNom(n)} petit />${n}</button>`)}
        ${nouveau === null
          ? html`<button class="puce nouveau" onClick=${() => setNouveau("")}>+ Autre prénom</button>`
          : html`<span class="puce" style=${{ paddingLeft: "14px" }}><input autofocus class="champ-prenom" placeholder="Prénom" value=${nouveau} onInput=${(e) => setNouveau(e.target.value)} onKeyDown=${(e) => e.key === "Enter" && ajouter()} /><button onClick=${ajouter} style=${{ color: "var(--accent)", fontWeight: 800 }}>OK</button></span>`}
      </div>
    </div>
    <button class="btn-principal" onClick=${onClose}>Terminé</button>
  <//>`;
}

// ---------- Feuille d'un paiement : montant de chaque extra ----------
export function FeuillePaie({ date, onClose }) {
  useStore();
  const j = lireJour(date);
  const d = fromISO(date);
  const ex = j.extras || [];
  const reg = getReglages();
  const ok = ex.length && estValide(j);
  if (!ex.length) return null;
  return html`<${Feuille} titre=${`Extras du ${JOURS[dayIndex(d)].toLowerCase()} ${d.getDate()}`} sous="Montant de chaque extra" onClose=${onClose}>
    <div class="bloc">
      <div class="rapides"><button onClick=${() => definirTarifs(date, reg.tarifExtra)}>Tout à ${reg.tarifExtra} €</button><button onClick=${() => definirTarifs(date, 60)}>Tout à 60 €</button></div>
      ${ex.map((n) => html`<div class="ligne-paie"><${Avatar} nom=${n} c=${couleurNom(n)} petit /><span class="qui">${n}</span>
        <button class="pas" onClick=${() => definirTarif(date, n, tarifDe(j, n) - 10)} aria-label="Moins 10 euros">−</button>
        <span class="montant">${tarifDe(j, n)} €</span>
        <button class="pas" onClick=${() => definirTarif(date, n, tarifDe(j, n) + 10)} aria-label="Plus 10 euros">+</button></div>`)}
      <div class="total-ligne"><span>Total du jour</span><b>${totalJour(j)} €</b></div>
    </div>
    ${ok
      ? html`<button class="btn-secondaire" onClick=${() => validerPaiement(date, false)}>Remettre à valider</button><button class="btn-principal" onClick=${onClose}>Terminé</button>`
      : html`<button class="btn-principal vert" onClick=${() => { const a = validerPaiement(date, true); toast(`Paiement du ${d.getDate()} validé`, a); onClose(); }}>Valider</button>`}
  <//>`;
}

// ---------- Feuille d'une note ----------
export function FeuilleNote({ date, onClose }) {
  const j = lireJour(date);
  const d = fromISO(date);
  const [note, setNote] = useState(j.note || "");
  const idees = ["Acompte 100 €", "Acompte 50 €", "Retard", "Absent prévenu", "Extra payé 60 €"];
  const enregistrer = () => {
    if ((j.note || "") !== note.trim()) definirNote(date, note);
    onClose();
  };
  return html`<${Feuille} titre=${`Note du ${JOURS[dayIndex(d)].toLowerCase()} ${d.getDate()}`} sous=${`${cap(MOIS[d.getMonth()])} ${d.getFullYear()}`} onClose=${enregistrer}>
    <div class="idees">${idees.map((t) => html`<button onClick=${() => setNote(note.trim() ? `${note.trim()} · ${t}` : t)}>${t}</button>`)}</div>
    <textarea class="note-champ" rows="4" autofocus placeholder="Acompte, retard, remarque…" value=${note} onInput=${(e) => setNote(e.target.value)}></textarea>
    <button class="btn-principal" onClick=${enregistrer} style=${{ marginTop: "12px" }}>Enregistrer</button>
    ${j.note ? html`<button class="btn-secondaire" onClick=${() => { definirNote(date, ""); onClose(); }}>Supprimer la note</button>` : null}
  <//>`;
}

// ---------- Fiches : planning + fiches à imprimer ----------
function Apercu({ pages }) {
  const ref = useRef();
  const [w, setW] = useState(0);
  const [zoom, setZoom] = useState(null); // { page, miniature }
  useLayoutEffect(() => {
    const mesurer = () => ref.current && setW(ref.current.clientWidth);
    mesurer();
    const ro = new ResizeObserver(mesurer);
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const k = w ? w / LARGEUR_FEUILLE : 0.4;
  return html`<div class="apercu" ref=${ref}>
    ${pages.map((p, i) => html`<p class="page-etiquette">Page ${i + 1} sur ${pages.length} · ${p.type === "planning" ? "Planning du mois" : `Fiche de ${p.titre}`}</p>
      <button class="papier-page" style=${{ height: `${HAUTEUR_FEUILLE * k}px` }} aria-label=${`Agrandir la page ${i + 1}`}
        onClick=${(e) => setZoom({ page: p, miniature: e.currentTarget.getBoundingClientRect() })}>
        <div style=${{ transform: `scale(${k})`, transformOrigin: "top left", width: `${LARGEUR_FEUILLE}px`, pointerEvents: "none" }} dangerouslySetInnerHTML=${{ __html: p.html }}></div>
        <span class="loupe"><${Icone} n="zoom" /></span>
      </button>`)}
    ${zoom ? html`<${Zoom} page=${zoom.page} miniature=${zoom.miniature} onClose=${() => setZoom(null)} />` : null}
  </div>`;
}

function BoutonsImpression({ onImprimer, onPDF, pdfEtat }) {
  return html`<div class="rangee-imp">
    <button class="btn-imprimer" onClick=${onImprimer}><${Icone} n="imprimer" /><span>Imprimer</span></button>
    <button class="btn-pdf" onClick=${onPDF} aria-label="Obtenir en PDF"><${Icone} n="doc" /><span>${pdfEtat || "PDF"}</span></button>
  </div>`;
}

export function Fiches({ mois, onPicker, onReglages, onAllerExtras }) {
  useStore();
  const pages = useMemo(() => toutesLesPages(mois), [mois, rev]);
  const bilan = bilanPaiements(mois);
  const fiches = pages.filter((p) => p.type === "fiche");
  const noms = [...new Set(fiches.map((p) => p.titre))];
  const [statut, setStatut] = useState("");
  const [pdfEtat, setPdfEtat] = useState("");
  const [attente, setAttente] = useState(false);
  const { nom, annee } = nomMois(mois);

  const lancerPDF = async () => {
    if (pdfEtat && !attente) return;
    setAttente(false);
    setPdfEtat("…");
    setStatut("");
    try {
      const r = await partagerPDF(mois, (i, n) => setPdfEtat(`${i}/${n}`));
      if (r === "toucher-encore") {
        setAttente(true);
        setPdfEtat("Prêt : toucher");
        setStatut("Le PDF est prêt : touchez « PDF » une fois de plus.");
        return;
      }
    } catch (err) {
      setStatut(`PDF impossible : ${err.message}`);
    }
    setPdfEtat("");
  };
  const lancerImpression = () => {
    setStatut("");
    imprimer(mois, () => {
      setStatut("La fenêtre d'impression ne s'est pas ouverte : préparation du PDF, puis choisissez « Imprimer » dans la liste.");
      lancerPDF();
    });
  };
  const boutons = html`<${BoutonsImpression} onImprimer=${lancerImpression} onPDF=${lancerPDF} pdfEtat=${pdfEtat} />`;

  return html`<div class="vue">
    <${Haut} mois=${mois} onPicker=${onPicker} onReglages=${onReglages} />
    <div class="defile">
      <div class="bloc carte-fiches">
        <p class="fiches-mois">${nom} ${annee}</p>
        <p class="petit-texte" style=${{ margin: "0 0 12px" }}>Planning du mois + ${noms.length} fiche${noms.length > 1 ? "s" : ""} de présence · ${pages.length} pages</p>
        ${bilan.aValider
          ? html`<div class="alerte"><span>${bilan.aValider} jour${bilan.aValider > 1 ? "s" : ""} d'extras pas encore validé${bilan.aValider > 1 ? "s" : ""} : le montant n'est pas imprimé.</span><button onClick=${onAllerExtras}>Aller les valider</button></div>`
          : null}
        ${boutons}
        <p class="im-statut">${statut}</p>
        <details class="aide"><summary>Comment imprimer en Wi-Fi ?</summary>
          <ol><li>Allumez l'imprimante et connectez-la au même Wi-Fi que le téléphone.</li><li>Appuyez sur <b>Imprimer</b> : la fenêtre d'impression s'ouvre.</li><li>Touchez <b>Imprimante</b> et choisissez la vôtre.</li><li>Vérifiez le nombre de pages, puis <b>Imprimer</b> en haut à droite.</li></ol>
          <p class="petit-texte">Il faut une imprimante compatible AirPrint.</p></details>
      </div>
      <${Apercu} pages=${pages} />
      <div class="bloc">${boutons}</div>
    </div>
  </div>`;
}

// ---------- Choix du mois ----------
export function ChoixMois({ mois, onChoix, onClose }) {
  const [annee, setAnnee] = useState(Number(mois.slice(0, 4)));
  const auj = aujourdhui().slice(0, 7);
  return html`<${Feuille} titre="Choisir un mois" onClose=${onClose}>
    <div class="annee-nav"><button class="rond" onClick=${() => setAnnee(annee - 1)}><${Icone} n="gauche" /></button><b>${annee}</b><button class="rond" onClick=${() => setAnnee(annee + 1)}><${Icone} n="droite" /></button></div>
    <div class="grille-mois">
      ${MOIS.map((_, i) => {
        const m = `${annee}-${String(i + 1).padStart(2, "0")}`;
        return html`<button class=${`mois-case ${m === mois ? "on" : ""}`} onClick=${() => onChoix(m)}>${cap(MOIS_COURTS[i])}${m === auj ? html`<small>ce mois-ci</small>` : null}</button>`;
      })}
    </div>
  <//>`;
}

// ---------- Réglages ----------
function Equipier({ e, i }) {
  const [h, setH] = useState(false);
  const maj = (fn) => modifierReglages((r) => fn(r.employes[i]));
  return html`<div class="bloc equipier">
    <div class="equipier-tete"><${Avatar} nom=${e.nom || "?"} c=${classeAvatar(e.colonne ? e.colonne - 1 : i)} />
      <input type="text" value=${e.nom} placeholder="Prénom Nom" onInput=${(ev) => maj((x) => (x.nom = ev.target.value))} />
      <label class="interrupteur" aria-label="Reçoit une fiche"><input type="checkbox" checked=${e.actif} onChange=${(ev) => maj((x) => (x.actif = ev.target.checked))} /><i></i></label></div>
    <label class="champ"><span>Boutique</span><input type="text" value=${e.boutique} onInput=${(ev) => maj((x) => (x.boutique = ev.target.value))} /></label>
    <label class="champ"><span>Colonne du planning</span><select onChange=${(ev) => maj((x) => (x.colonne = Number(ev.target.value)))}>${[0, 1, 2, 3, 4].map((c) => html`<option value=${c} selected=${Number(e.colonne) === c}>${c ? `Vendeur ${c}` : "Aucune"}</option>`)}</select></label>
    <div style=${{ paddingTop: "12px" }}><span class="champ" style=${{ minHeight: 0, border: 0 }}><span>Repos habituels</span></span>
      <div class="jours-rond">${["L", "M", "M", "J", "V", "S", "D"].map((l, k) => html`<button class=${(e.repos || []).includes(k) ? "on" : ""} onClick=${() => maj((x) => (x.repos = x.repos.includes(k) ? x.repos.filter((y) => y !== k) : [...x.repos, k]))}>${l}</button>`)}</div></div>
    <button class=${`btn-ligne ${h ? "ouvert" : ""}`} onClick=${() => setH(!h)}>Horaires habituels<${Icone} n="droite" /></button>
    <div class=${`horaires ${h ? "ouvert" : ""}`}>
      <div class="h-grille"><span></span><span>Arrivée</span><span>Pause</span><span>Reprise</span><span>Départ</span>
        ${JC.map((jc, k) => html`<span>${jc}</span>${["arrivee", "debut_pause", "fin_pause", "depart"].map((f) => html`<input type="time" value=${e.horaires?.[k]?.[f] || ""} onChange=${(ev) => maj((x) => (x.horaires[k][f] = ev.target.value))} />`)}`)}</div>
    </div>
    <button class="btn-ligne danger" onClick=${() => confirm(`Retirer ${e.nom || "ce salarié"} de l'équipe ?`) && modifierReglages((r) => r.employes.splice(i, 1))}>Retirer de l'équipe</button>
  </div>`;
}

export function Reglages({ onClose }) {
  useStore();
  const r = getReglages();
  return html`<${Feuille} titre="Réglages" sous="Tout reste sur ce téléphone" onClose=${onClose}>
    <div class="bloc"><p class="bloc-titre">Taille du texte</p>
      <div class="seg">${[["normal", 14], ["grand", 19], ["tres", 25]].map(([v, s]) => html`<button class=${r.taille === v ? "on" : ""} style=${{ fontSize: `${s}px` }} onClick=${() => modifierReglages((x) => (x.taille = v))}>A</button>`)}</div></div>
    <div class="bloc"><p class="bloc-titre">Tarif des extras</p>
      <label class="champ"><span>Tarif d'un extra par jour</span><input type="number" inputmode="numeric" min="0" step="5" value=${r.tarifExtra} onChange=${(ev) => modifierReglages((x) => (x.tarifExtra = Math.max(0, Number(ev.target.value) || 0)))} /><span style=${{ color: "var(--ink3)" }}>€</span></label>
      <p class="petit-texte">C'est le montant proposé sur la page « Extras payés ». On peut le changer jour par jour (par exemple 60 €).</p></div>
    <p class="bloc-titre" style=${{ margin: "18px 6px 10px" }}>Équipe</p>
    ${r.employes.map((e, i) => html`<${Equipier} key=${i} e=${e} i=${i} />`)}
    <button class="ajout-equipier" onClick=${() => modifierReglages((x) => x.employes.push({ nom: "", boutique: x.employes[0]?.boutique || "", colonne: 0, actif: true, repos: [], horaires: structuredClone(HORAIRES_DEFAUT) }))}>+ Ajouter un salarié</button>
    <p class="petit-texte" style=${{ margin: "-4px 6px 16px" }}>L'interrupteur décide s'il reçoit une fiche. Sur le planning, « OK » reprend ses horaires habituels.</p>
    <p class="version">Planning</p>
  <//>`;
}
