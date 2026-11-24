# Fiches de présence

Petite appli web (iPhone/Android) : **photo du planning → fiches de présence hebdomadaires remplies → impression**.

Adresse une fois GitHub Pages activé : **https://mvtax.github.io/planning_belal/**

## Utilisation

1. Ouvrir le lien dans Safari, puis Partager → **Sur l'écran d'accueil** (ou ajouter en favori).
2. La première fois : ⚙︎ Réglages → **Lecture du planning** → Google Gemini (par défaut) → coller la **clé API Gemini** (aistudio.google.com → Get API key). Claude reste possible en option (console.anthropic.com → API Keys). La clé reste sur le téléphone.
3. **Scanner le planning** : la caméra s'ouvre en mode scan, la feuille est entourée en vert et prise automatiquement quand elle est stable (ou bouton rond). Ajuster les coins si besoin → **Valider** → **Utiliser ce scan**. La lecture démarre toute seule.
4. Vérifier l'aperçu (les jours mal lus sont surlignés en orange dans « Vérifier / corriger les horaires »).
5. **Imprimer** → choisir l'imprimante (AirPrint) → Imprimer.
   Depuis l'icône de l'écran d'accueil, le bouton ouvre le PDF dans la feuille de partage : choisir « Imprimer ».

## Ce que fait l'appli

- Mode scan (`scanner.js`) : détection de la feuille en direct, prise automatique, recadrage, redressement de la perspective et fond blanchi en gardant les couleurs de l'encre. « + Page » pour scanner plusieurs feuilles, « Importer une photo » pour partir d'une photo existante.
- Lit le scan du planning mensuel avec **Gemini** (meilleur modèle « flash » stable disponible pour la clé, choisi automatiquement) ou **Claude** (`claude-opus-5-5`) : pour chaque vendeur et chaque jour, « OK », « Repos », « CP », « École », remplacement…
- « OK » → la fiche reprend les **horaires habituels** du salarié pour ce jour de la semaine (Réglages → Salariés → Horaires habituels). Belal : 10h–15h / 16h–20h30 du lundi au samedi, 11h–15h / 16h–19h le dimanche.
- Remplit la fiche « FEUILLE DE PRESENCE HEBDOMADAIRE » : 3 semaines (lundi → dimanche) par page A4, totaux calculés, « REPOS » en rouge, jours fériés marqués automatiquement.
- Salariés, boutique et horaires sont enregistrés sur le téléphone. Un nouveau nom lu sur le planning est ajouté aux réglages, décoché : il suffit de le cocher pour imprimer sa fiche.
- Coût : gratuit dans le quota gratuit de Gemini ; avec Claude, quelques centimes par scan.

## Fichiers

- `index.html`, `styles.css`, `app.js` : l'appli (aucune compilation nécessaire).
- `vendor/gemini.js` : SDK officiel `@google/genai` 3.0.0 empaqueté pour le navigateur.
- `vendor/anthropic.js` : SDK officiel `@anthropic-ai/sdk` 1.4.0 empaqueté pour le navigateur.
- `vendor/pdf.js` : jsPDF 4.2.1 + html2canvas 1.4.1 (création du PDF).
