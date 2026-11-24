# Fiches de présence

Petite appli web (iPhone/Android) : **photo du planning → fiches de présence hebdomadaires remplies → impression**.

Adresse une fois GitHub Pages activé : **https://mvtax.github.io/planning_belal/**

## Utilisation

1. Ouvrir le lien dans Safari, puis Partager → **Sur l'écran d'accueil** (ou ajouter en favori).
2. La première fois : ⚙︎ Réglages → coller la **clé API Claude** (console.anthropic.com → API Keys). Elle reste sur le téléphone.
3. **Prendre / choisir une photo** du planning global → **Lire le planning et remplir les fiches**.
4. Vérifier l'aperçu (les jours mal lus sont surlignés en orange dans « Vérifier / corriger les horaires »).
5. **Imprimer** → choisir l'imprimante (AirPrint) → Imprimer.
   Depuis l'icône de l'écran d'accueil, le bouton ouvre le PDF dans la feuille de partage : choisir « Imprimer ».

## Ce que fait l'appli

- Lit la photo avec Claude (modèle `claude-opus-5-5`), récupère pour chaque salarié les heures d'arrivée, de pause, de départ, et les jours de repos / congé.
- Remplit la fiche « FEUILLE DE PRESENCE HEBDOMADAIRE » : 3 semaines (lundi → dimanche) par page A4, totaux calculés, « REPOS » en rouge, jours fériés marqués automatiquement.
- Pause par défaut (15h–16h) ajoutée si le planning ne l'indique pas (modifiable dans les réglages).
- Salariés, boutique et horaires sont enregistrés sur le téléphone. Un nouveau nom lu sur le planning est ajouté aux réglages, décoché : il suffit de le cocher pour imprimer sa fiche.
- Coût : quelques centimes par photo, facturés sur le compte Anthropic de la clé.

## Fichiers

- `index.html`, `styles.css`, `app.js` : l'appli (aucune compilation nécessaire).
- `vendor/anthropic.js` : SDK officiel `@anthropic-ai/sdk` 1.4.0 empaqueté pour le navigateur.
- `vendor/pdf.js` : jsPDF 4.2.1 + html2canvas 1.4.1 (création du PDF).
