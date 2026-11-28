// Mesures d'utilisation [P11] : quelques compteurs anonymes, gardés sur ce téléphone uniquement.
// Ils servent à vérifier sur le terrain ce que la recherche prédit (taux d'erreur, temps de choix).
const CLE = "v3.mesures";

const lire = () => {
  try {
    return JSON.parse(localStorage.getItem(CLE)) || {};
  } catch {
    return {};
  }
};

export function compter(nom, valeur = 1) {
  try {
    const m = lire();
    m[nom] = (m[nom] || 0) + valeur;
    m.depuis ||= new Date().toISOString().slice(0, 10);
    localStorage.setItem(CLE, JSON.stringify(m));
  } catch {
    /* stockage indisponible : on ne mesure pas */
  }
}

export function lireMesures() {
  const m = lire();
  const choix = m.choix || 0;
  return {
    depuis: m.depuis || null,
    choix,
    annulations: m.annulations || 0,
    roueSansChoix: m.roueSansChoix || 0,
    rattrapes: m.rattrapes || 0,
    tempsMoyen: choix ? Math.round((m.tempsChoix || 0) / choix) : 0,
    tauxAnnulation: choix ? Math.round(((m.annulations || 0) / choix) * 100) : 0,
  };
}

export function remettreMesures() {
  try {
    localStorage.removeItem(CLE);
  } catch {
    /* rien */
  }
}
