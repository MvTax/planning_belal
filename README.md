# Fiches de présence

Petite appli web (iPhone/Android) : **photo du planning → fiches de présence hebdomadaires remplies → impression**.

Adresse une fois GitHub Pages activé : **https://mvtax.github.io/planning_belal/**

## Utilisation

1. Ouvrir le lien dans Safari, puis Partager → **Sur l'écran d'accueil**.
2. Onglet **Planning** : le mois s'affiche en entier, une ligne par jour, une colonne par vendeur et une colonne « Renforts ».
   - **Changer une case** : appuyer sur la case, une roue de 6 choix s'ouvre autour du doigt (OK, Repos, Congé, École, Malade, Absent). Glisser sur le bon choix et relâcher. Un simple toucher ouvre aussi la roue.
   - **Renforts** : toucher la case de droite, cocher les prénoms, « Terminé ».
   - Chaque changement peut être annulé avec « Annuler » dans le bandeau du bas.
   - Un nouveau mois est préparé tout seul : tout le monde « OK », sauf les repos habituels (réglables pour chaque salarié).
3. **Préparer les fiches du mois** : les fiches de présence de tous les vendeurs sont remplies (horaires habituels, repos, congés, école, fériés), puis **Imprimer**.
4. Planning encore sur papier : onglet **Fiches** → **Scanner le planning**.

Réglages (⚙︎) : taille du texte, salariés (colonne, horaires habituels, repos habituels), lecture des scans.

## Ce que fait l'appli

- Planning du mois (`planning.js`) : toute la largeur de l'écran, défilement vertical seulement, gros caractères, choix par appui + glisser. Novembre 2026 s'ouvre avec le planning papier recopié.

- Lecture sur le téléphone (`lecteur.js`) : retrouve les lignes du tableau sur le scan redressé, puis lit la couleur de l'encre dans la colonne de chaque salarié (rouge = Repos, bleu = OK). Les autres mentions (CP, École, prénom…) sont signalées en orange à vérifier. Aucun token, aucune donnée envoyée.
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
