# Fiches de présence

Petite appli web (iPhone/Android) : **photo du planning → fiches de présence hebdomadaires remplies → impression**.

Adresse une fois GitHub Pages activé : **https://mvtax.github.io/planning_belal/**

## Utilisation

1. Ouvrir le lien dans Safari, puis Partager → **Sur l'écran d'accueil**.
2. Onglet **Planning** : le mois en entier, une ligne par jour, une colonne par vendeur et une colonne « Renforts ».
   - **Changer une case** : poser le doigt sur la case, une roue de 6 choix s'ouvre ; glisser sur le bon choix et relâcher.
   - **Renforts** : toucher la case de droite, cocher les prénoms.
   - **Extras payés** (balayer vers la gauche) : montant calculé automatiquement (100 € par extra, modifiable), à valider jour par jour ; notes libres (acomptes, retards).
   - Un nouveau mois est préparé tout seul : tout le monde « OK », sauf les repos habituels.
3. Onglet **Fiches** → **Récupérer mes fiches** : un seul PDF avec le planning du mois (format de la feuille papier, A4 paysage) puis la fiche de présence de chaque salarié (A4 portrait). Dans la feuille de partage de l'iPhone, choisir **Imprimer**.

Réglages (⚙︎) : taille du texte, salariés (colonne, horaires habituels, repos habituels, interrupteur « reçoit une fiche »), tarif d'un extra.

## Notes

- Aucune IA, aucun scan, aucune donnée envoyée : tout reste sur le téléphone (localStorage).
- Les montants d'extras ne sont imprimés dans la colonne « Commentaires » que s'ils sont validés.

## Fichiers

- `index.html`, `styles.css` : l'interface.
- `planning.js` : planning du mois (roue de choix, renforts, extras payés, notes).
- `app.js` : réglages, fiches de présence, planning imprimé, PDF.
- `vendor/pdf.js` : jsPDF + html2canvas (création du PDF).
