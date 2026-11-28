# Planning — V2 (refonte complète)

Nouvelle application, indépendante de la V1 (`../`) : mêmes fonctionnalités, interface repensée « swipe d'abord ».
Adresse : `…/planning_belal/v2/`

## Ce qui change
- **Une semaine par écran**, sans aucun défilement vertical : on balaie à gauche / droite pour changer de semaine (le mois suit tout seul).
- **Toucher** une case : OK ↔ Repos. **Maintenir** : la roue des 6 statuts (même physique que la V1). Chaque changement est annulable.
- **Feuille du jour** (toucher la date ou la colonne « Renforts ») : renforts, paiement de chaque extra, **« glisser pour valider »**, commentaire — tout au même endroit. Elle se ferme en la tirant vers le bas.
- **Extras** : bilan du mois, une ligne par jour à **balayer vers la droite pour valider**, ou **« glisser pour tout valider »**.
- **Imprimer** : carrousel des 9 pages (planning paysage + fiches portrait), pastilles de vérification, **« glisser pour imprimer »** ; bouton PDF en option.
- Style : fond « aurore » clair, verre dépoli, couleurs distinctes par statut et par salarié (oklch), titres en serif iOS.
- Technologies : Preact + htm (15 Ko), modules ES, scroll-snap, CSS oklch / color-mix, aucune dépendance serveur.

## Données
Séparées de la V1 (clés `v2.*`). Au premier lancement, les réglages et plannings de la V1 sont **copiés** automatiquement (la V1 n'est pas modifiée).
Réglages → « Reprendre les données de la V1 » pour recommencer la copie.

## Fichiers
- `index.html`, `css/app.css` (interface), `css/print.css` (feuilles imprimées, identiques à la V1)
- `js/app.js` (point d'entrée), `js/views.js` (écrans), `js/store.js` (données), `js/roue.js` (roue), `js/ui-parts.js` (feuilles, curseur de confirmation)
- `js/sheets.js` (pages imprimées), `js/impression.js` (impression + PDF), `js/dates.js`
- `vendor/ui.js` : Preact + htm. Le PDF réutilise `../vendor/pdf.js`.
