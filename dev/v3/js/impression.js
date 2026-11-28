// Impression et PDF : les pages complètes sont placées dans #print-root, puis imprimées ou converties en PDF.
import { MOIS } from "./dates.js";
import { toutesLesPages } from "./sheets.js";

function remplir(mois) {
  const pages = toutesLesPages(mois);
  const racine = document.getElementById("print-root");
  racine.innerHTML = pages.map((p) => p.html).join("");
  return pages;
}

// À appeler directement depuis un geste (toucher, relâchement du curseur) : iOS l'exige pour ouvrir l'impression.
export function imprimer(mois, repli) {
  remplir(mois);
  let ouverte = false;
  const marque = () => (ouverte = true);
  window.addEventListener("beforeprint", marque, { once: true });
  try {
    window.print();
  } catch {
    /* repli ci-dessous */
  }
  // Certains téléphones n'ouvrent pas la fenêtre d'impression : on propose alors le PDF
  setTimeout(() => {
    window.removeEventListener("beforeprint", marque);
    if (!ouverte) repli?.();
  }, 1200);
}

async function genererPDF(mois, progression) {
  remplir(mois);
  const { jsPDF, html2canvas } = await import(new URL("../../../vendor/pdf.js?v=30", import.meta.url).href);
  const feuilles = [...document.querySelectorAll("#print-root .sheet")];
  // html2canvas ne comprend pas les couleurs oklch de l'interface : pendant la création, la page est en couleurs simples
  document.documentElement.classList.add("pdf-mode");
  const scene = document.createElement("div");
  scene.style.cssText = "position:fixed;left:-10000px;top:0;";
  document.body.appendChild(scene);
  try {
    let pdf = null;
    for (let i = 0; i < feuilles.length; i++) {
      progression?.(i + 1, feuilles.length);
      await new Promise((r) => setTimeout(r, 20));
      const copie = feuilles[i].cloneNode(true);
      copie.style.transform = "none";
      scene.replaceChildren(copie);
      const paysage = false;
      const canvas = await html2canvas(copie, { scale: 2, backgroundColor: "#ffffff", logging: false });
      if (!pdf) pdf = new jsPDF({ unit: "mm", format: "a4", orientation: paysage ? "landscape" : "portrait" });
      else pdf.addPage("a4", paysage ? "landscape" : "portrait");
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, paysage ? 297 : 210, paysage ? 210 : 297);
      canvas.width = canvas.height = 0;
    }
    return pdf.output("blob");
  } finally {
    scene.remove();
    document.documentElement.classList.remove("pdf-mode");
  }
}

export async function partagerPDF(mois, progression) {
  const [y, m] = mois.split("-").map(Number);
  const blob = await genererPDF(mois, progression);
  const fichier = new File([blob], `Planning_et_fiches_${MOIS[m - 1]}_${y}.pdf`, { type: "application/pdf" });
  if (navigator.canShare?.({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier], title: "Planning et fiches" });
      return "partage";
    } catch (err) {
      if (err?.name === "AbortError") return "annule";
      if (err?.name === "NotAllowedError") return "toucher-encore";
      throw err;
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fichier.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  return "telecharge";
}
