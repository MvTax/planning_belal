// Petit client pour les fonctions Supabase (REST). Aucune bibliothèque : un simple fetch.
export function configValide(c) {
  return !!(c && /^(https:\/\/[^/\s]+\.[^/\s]+|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)/.test(c.url || "") && (c.key || "").length > 20);
}

export async function rpc(cfg, nom, args, delaiMs = 15000) {
  const url = `${cfg.url.replace(/\/+$/, "")}/rest/v1/rpc/${nom}`;
  const entetes = { "Content-Type": "application/json", apikey: cfg.key };
  if (cfg.key.startsWith("eyJ")) entetes.Authorization = `Bearer ${cfg.key}`; // anciennes clés (JWT)
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), delaiMs);
  let rep;
  try {
    rep = await fetch(url, { method: "POST", headers: entetes, body: JSON.stringify(args), signal: ctrl.signal });
  } catch (err) {
    const e = new Error(err?.name === "AbortError" ? "Le serveur ne répond pas" : "Pas de connexion");
    e.reseau = true;
    throw e;
  } finally {
    clearTimeout(t);
  }
  if (!rep.ok) {
    let msg = `Erreur ${rep.status}`;
    try {
      const j = await rep.json();
      msg = j.message || j.hint || msg;
      if (/Could not find the function|schema cache/i.test(msg)) msg = "Le script de base de données n'est pas installé (voir les réglages).";
    } catch {
      /* corps illisible */
    }
    const e = new Error(msg);
    e.statut = rep.status;
    throw e;
  }
  const txt = await rep.text();
  return txt ? JSON.parse(txt) : null;
}

export const codeAleatoire = (n = 24) => {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return [...a].map((x) => "abcdefghjkmnpqrstuvwxyz23456789"[x % 31]).join("");
};
