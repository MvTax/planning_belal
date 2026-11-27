// Mini-appli de pointage d'un salarié : un seul gros bouton (arrivée → pause → reprise → départ).
// Tout reste sur le téléphone du salarié ; il envoie son mois au patron par message quand il veut.

const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const JC = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const ETAPES = [
  { cle: "arrivee", bouton: "Pointer l'arrivée", court: "Arrivée", couleur: "#34c759" },
  { cle: "debut_pause", bouton: "Partir en pause", court: "Départ en pause", couleur: "#ff9500" },
  { cle: "fin_pause", bouton: "Revenir de pause", court: "Retour de pause", couleur: "#34c759" },
  { cle: "depart", bouton: "Pointer le départ", court: "Départ", couleur: "#ff3b30" },
];
const CHAMPS = ETAPES.map((e) => e.cle);

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toMin = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const dateDe = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
};
const jourIdx = (d) => (d.getDay() + 6) % 7;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const prenom = (n) => String(n).trim().split(/\s+/)[0];

function duree(min) {
  if (!(min > 0)) return "0h00";
  return `${Math.floor(min / 60)}h${pad(min % 60)}`;
}
function heure(t) {
  if (!t) return "";
  const [h, m] = t.split(":");
  return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

// Minutes travaillées d'une journée ; si elle est en cours, on compte jusqu'à maintenant
function minutes(p, maintenant = null) {
  if (!p?.arrivee) return 0;
  const nowMin = maintenant ? toMin(maintenant) : null;
  let fin = p.depart ? toMin(p.depart) : nowMin;
  if (fin == null) return 0;
  let total = fin - toMin(p.arrivee);
  if (total < 0) total += 1440;
  if (p.debut_pause) {
    const finPause = p.fin_pause ? toMin(p.fin_pause) : p.depart ? null : nowMin;
    if (finPause != null) {
      let pause = finPause - toMin(p.debut_pause);
      if (pause < 0) pause += 1440;
      total -= pause;
    }
  }
  return Math.max(0, total);
}

// ---------- Stockage ----------
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
const b64 = {
  vers: (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  depuis: (s) => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))))),
};

let ident = lire("pt.id", null); // { n, b }
let jours = lire("pt.jours", {}); // { "YYYY-MM-DD": { arrivee, debut_pause, fin_pause, depart } }
const sauver = () => ecrire("pt.jours", jours);

// Lien personnel envoyé par le patron : #e=<identité>
(function lireLien() {
  const m = location.hash.match(/^#e=(.+)$/);
  if (!m) return;
  try {
    const nouveau = b64.depuis(m[1]);
    if (nouveau?.n && (!ident || ident.n === nouveau.n)) {
      ident = { n: String(nouveau.n), b: String(nouveau.b || "") };
      ecrire("pt.id", ident);
    } else if (nouveau?.n && confirm(`Cette appli est déjà celle de « ${ident.n} ». La remplacer par « ${nouveau.n} » ? Les pointages enregistrés seront effacés.`)) {
      ident = { n: String(nouveau.n), b: String(nouveau.b || "") };
      jours = {};
      ecrire("pt.id", ident);
      sauver();
    }
  } catch {
    /* lien illisible : on ignore */
  }
  history.replaceState(null, "", location.pathname + location.search);
})();

// ---------- Éléments ----------
const $ = (id) => document.getElementById(id);
const aujourdHui = () => iso(new Date());

// ---------- Étape suivante ----------
function etapeSuivante(p) {
  if (!p?.arrivee) return 0;
  if (p.depart) return -1;
  if (!p.debut_pause) return 1;
  if (!p.fin_pause) return 2;
  return 3;
}

function pointer(cle) {
  const k = aujourdHui();
  const p = (jours[k] ||= {});
  p[cle] = hm(new Date());
  sauver();
  if (navigator.vibrate) navigator.vibrate(25);
  rendre();
  const e = ETAPES.find((x) => x.cle === cle);
  bandeau(`${e.court} à ${heure(p[cle])}`, () => annulerDernier());
}

function annulerDernier() {
  const k = aujourdHui();
  const p = jours[k];
  if (!p) return;
  for (let i = CHAMPS.length - 1; i >= 0; i--) {
    if (p[CHAMPS[i]]) {
      delete p[CHAMPS[i]];
      break;
    }
  }
  if (!CHAMPS.some((c) => p[c])) delete jours[k];
  sauver();
  rendre();
}

// ---------- Affichage ----------
function rendre() {
  const maintenant = new Date();
  const k = iso(maintenant);
  const p = jours[k];
  $("date").textContent = `${JOURS[jourIdx(maintenant)]} ${maintenant.getDate()} ${MOIS[maintenant.getMonth()]}`;
  $("nom").textContent = ident ? prenom(ident.n) : "Pointage";

  const suiv = etapeSuivante(p);
  const gros = $("gros");
  const sec = $("sec");
  sec.hidden = true;
  $("annuler").hidden = !p || !CHAMPS.some((c) => p[c]);
  if (suiv === -1) {
    gros.className = "p-gros termine";
    $("gros-txt").textContent = "Journée terminée ✓";
    gros.dataset.etape = "";
    $("etat").textContent = `${heure(p.arrivee)} → ${heure(p.depart)}`;
    $("sous").textContent = "Bonne soirée !";
  } else {
    const e = ETAPES[suiv];
    gros.className = "p-gros";
    gros.style.setProperty("--couleur", e.couleur);
    gros.style.background = e.couleur;
    $("gros-txt").textContent = e.bouton;
    gros.dataset.etape = e.cle;
    if (suiv === 0) {
      $("etat").textContent = "Pas encore pointé aujourd'hui";
      $("sous").textContent = "Appuyez quand vous arrivez";
    } else if (suiv === 1) {
      $("etat").textContent = `Au travail depuis ${heure(p.arrivee)}`;
      $("sous").textContent = "";
      sec.hidden = false;
      sec.textContent = "Terminer la journée (sans pause)";
      sec.dataset.etape = "depart";
    } else if (suiv === 2) {
      $("etat").textContent = `En pause depuis ${heure(p.debut_pause)}`;
      $("sous").textContent = "";
    } else {
      $("etat").textContent = `Reprise à ${heure(p.fin_pause)}`;
      $("sous").textContent = "";
    }
  }
  const m = minutes(p, hm(maintenant));
  $("chrono").textContent = p ? duree(m) : "0h00";

  // Pointages du jour
  const liste = $("pointages");
  const faits = ETAPES.filter((e) => p?.[e.cle]);
  $("aujourdhui").hidden = !faits.length;
  liste.innerHTML = faits.map((e) => `<div class="p-ligne"><span><i class="p-pastille" style="background:${e.couleur}"></i>${e.court}</span><b>${heure(p[e.cle])}</b></div>`).join("");

  // Totaux
  const lundi = new Date(maintenant);
  lundi.setDate(maintenant.getDate() - jourIdx(maintenant));
  const debutSemaine = iso(lundi);
  const prefixe = k.slice(0, 7);
  let sem = 0, mois = 0;
  for (const [d, pj] of Object.entries(jours)) {
    const t = minutes(pj, d === k ? hm(maintenant) : null);
    if (d >= debutSemaine && d <= k) sem += t;
    if (d.startsWith(prefixe)) mois += t;
  }
  $("t-semaine").textContent = duree(sem);
  $("t-mois").textContent = duree(mois);
  $("t-mois-nom").textContent = `En ${MOIS[maintenant.getMonth()]}`;

  // Mes journées (les plus récentes d'abord, par mois)
  const cles = Object.keys(jours).sort().reverse();
  if (!cles.length) {
    $("jours").innerHTML = `<div class="p-vide">Vos journées apparaîtront ici.</div>`;
  } else {
    let html = "", moisCourant = "";
    for (const d of cles) {
      const mo = d.slice(0, 7);
      if (mo !== moisCourant) {
        moisCourant = mo;
        const [y, mm] = mo.split("-").map(Number);
        html += `<div class="p-mois-titre">${MOIS[mm - 1]} ${y}</div>`;
      }
      const pj = jours[d], dt = dateDe(d);
      const parts = [heure(pj.arrivee), pj.debut_pause ? `${heure(pj.debut_pause)}–${heure(pj.fin_pause) || "…"}` : "", heure(pj.depart) || (d === k ? "en cours" : "…")].filter(Boolean);
      html += `<button type="button" class="p-jour" data-date="${d}"><span class="d"><small>${JC[jourIdx(dt)]}</small><b>${dt.getDate()}</b></span><span class="h">${parts.join(" · ")}</span><span class="t">${duree(minutes(pj, d === k ? hm(maintenant) : null))}</span></button>`;
    }
    $("jours").innerHTML = html;
  }
}

// ---------- Feuilles ----------
function feuille(titre, corps, actions) {
  $("f-titre").textContent = titre;
  $("f-corps").innerHTML = corps;
  const zone = $("f-actions");
  zone.innerHTML = "";
  for (const a of actions) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = a.texte;
    if (a.classe) b.className = a.classe;
    b.addEventListener("click", () => a.fait());
    zone.appendChild(b);
  }
  $("voile").hidden = false;
}
const fermer = () => {
  if (!ident) return; // sans prénom, on ne ferme pas la feuille de bienvenue
  $("voile").hidden = true;
};
$("voile").addEventListener("click", (e) => e.target === $("voile") && fermer());

function editerJour(d, nouveau = false) {
  const pj = jours[d] || {};
  const dt = dateDe(d);
  const champ = (cle, label) => `<label class="p-champ"><span>${label}</span><input type="time" data-c="${cle}" value="${pj[cle] || ""}"></label>`;
  const dateChamp = nouveau ? `<label class="p-champ"><span>Jour</span><input type="date" id="f-date" value="${d}" max="${aujourdHui()}"></label>` : "";
  feuille(
    nouveau ? "Ajouter un oubli" : `${JOURS[jourIdx(dt)][0].toUpperCase()}${JOURS[jourIdx(dt)].slice(1)} ${dt.getDate()} ${MOIS[dt.getMonth()]}`,
    `<div class="p-champs">${dateChamp}${ETAPES.map((e) => champ(e.cle, e.court)).join("")}</div>`,
    [
      {
        texte: "Enregistrer",
        classe: "principal",
        fait: () => {
          const cle = nouveau ? document.getElementById("f-date").value || d : d;
          const valeurs = {};
          for (const i of document.querySelectorAll("#f-corps input[data-c]")) if (i.value) valeurs[i.dataset.c] = i.value;
          if (valeurs.arrivee || Object.keys(valeurs).length) jours[cle] = valeurs;
          else delete jours[cle];
          sauver();
          fermer();
          rendre();
        },
      },
      ...(!nouveau
        ? [
            {
              texte: "Supprimer cette journée",
              classe: "danger",
              fait: () => {
                if (!confirm("Supprimer cette journée ?")) return;
                delete jours[d];
                sauver();
                fermer();
                rendre();
              },
            },
          ]
        : []),
      { texte: "Fermer", fait: fermer },
    ],
  );
}

// ---------- Envoi au patron ----------
function moisDisponibles() {
  const m = {};
  for (const [d, pj] of Object.entries(jours)) {
    const mo = d.slice(0, 7);
    m[mo] ||= { jours: 0, min: 0 };
    m[mo].jours++;
    m[mo].min += minutes(pj);
  }
  return Object.entries(m).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 4);
}

function lienEnvoi(mois) {
  const d = {};
  for (const [k, pj] of Object.entries(jours)) {
    if (!k.startsWith(mois) || !pj.arrivee) continue;
    d[k.slice(8)] = CHAMPS.map((c) => (pj[c] || "").replace(":", "")).join(",");
  }
  const charge = { v: 1, n: ident.n, b: ident.b || "", m: mois, d };
  return new URL(`index.html#import=${b64.vers(charge)}`, location.href).href;
}

async function envoyer(mois) {
  const [y, mm] = mois.split("-").map(Number);
  const url = lienEnvoi(mois);
  const texte = `Pointages de ${prenom(ident.n)} — ${MOIS[mm - 1]} ${y}. Ouvre ce lien pour les ajouter aux fiches :`;
  fermer();
  if (navigator.share) {
    try {
      await navigator.share({ title: "Mes pointages", text: texte, url });
      return;
    } catch (err) {
      if (err?.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(`${texte}\n${url}`);
    bandeau("Lien copié : collez-le dans un message");
  } catch {
    prompt("Copiez ce lien et envoyez-le :", url);
  }
}

$("envoyer").addEventListener("click", () => {
  const mois = moisDisponibles();
  if (!mois.length) {
    bandeau("Aucun pointage à envoyer pour l'instant");
    return;
  }
  feuille(
    "Envoyer quel mois ?",
    `<p class="p-texte">Le patron recevra un lien qui ajoute vos heures à ses fiches.</p><div class="p-choix">${mois
      .map(([mo, v]) => {
        const [y, mm] = mo.split("-").map(Number);
        return `<button type="button" data-mois="${mo}"><span>${MOIS[mm - 1][0].toUpperCase()}${MOIS[mm - 1].slice(1)} ${y}</span><small>${v.jours} jour${v.jours > 1 ? "s" : ""} · ${duree(v.min)}</small></button>`;
      })
      .join("")}</div>`,
    [{ texte: "Fermer", fait: fermer }],
  );
  for (const b of document.querySelectorAll("#f-corps [data-mois]")) b.addEventListener("click", () => envoyer(b.dataset.mois));
});

$("ajouter").addEventListener("click", () => {
  const hier = new Date();
  hier.setDate(hier.getDate() - 1);
  editerJour(iso(hier), true);
});
$("jours").addEventListener("click", (e) => {
  const b = e.target.closest("[data-date]");
  if (b) editerJour(b.dataset.date);
});
$("gros").addEventListener("click", () => $("gros").dataset.etape && pointer($("gros").dataset.etape));
$("sec").addEventListener("click", () => $("sec").dataset.etape && pointer($("sec").dataset.etape));
$("annuler").addEventListener("click", () => {
  if (confirm("Annuler le dernier pointage ?")) annulerDernier();
});

$("menu").addEventListener("click", () => {
  feuille(
    ident ? ident.n : "Mon profil",
    `<div class="p-champs"><label class="p-champ"><span>Mon nom</span><input type="text" id="f-nom" value="${esc(ident?.n || "")}" placeholder="Prénom"></label></div>
     <p class="p-texte" style="margin-top:12px">Si l'appli doit être celle de quelqu'un d'autre, demandez au patron de vous envoyer votre lien.</p>`,
    [
      {
        texte: "Enregistrer",
        classe: "principal",
        fait: () => {
          const n = document.getElementById("f-nom").value.trim();
          if (n) {
            ident = { n, b: ident?.b || "" };
            ecrire("pt.id", ident);
          }
          fermer();
          rendre();
        },
      },
      { texte: "Fermer", fait: fermer },
    ],
  );
});

// ---------- Bandeau ----------
let tBandeau;
function bandeau(msg, annuler) {
  const b = $("bandeau");
  clearTimeout(tBandeau);
  b.innerHTML = `<span>${esc(msg)}</span>${annuler ? `<button type="button">Annuler</button>` : ""}`;
  b.hidden = false;
  b.querySelector("button")?.addEventListener("click", () => {
    annuler();
    b.hidden = true;
  });
  tBandeau = setTimeout(() => (b.hidden = true), annuler ? 5000 : 3500);
}

// ---------- Démarrage ----------
if (!ident) {
  feuille(
    "Bienvenue",
    `<p class="p-texte">Quel est votre prénom ?</p><div class="p-champs"><label class="p-champ"><span>Prénom</span><input type="text" id="f-nom" placeholder="Prénom" autocomplete="given-name"></label></div>`,
    [
      {
        texte: "Commencer",
        classe: "principal",
        fait: () => {
          const n = document.getElementById("f-nom").value.trim();
          if (!n) return;
          ident = { n, b: "" };
          ecrire("pt.id", ident);
          fermer();
          rendre();
        },
      },
    ],
  );
}
rendre();
setInterval(rendre, 20000);
document.addEventListener("visibilitychange", () => !document.hidden && rendre());
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
