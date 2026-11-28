# Planning — application (/app, ex-V2)

Nouvelle application, indépendante de la V1 (`../`) : mêmes fonctionnalités, interface repensée « swipe d'abord ».
Adresse : `…/planning_belal/app/` (l'ancienne adresse `/v2/` y renvoie)

## Structure (comme la V1, avec un autre habillage)
- **Planning** : tout le mois en une seule colonne, une carte par semaine, on **fait défiler vers le bas**. On change de mois avec les **flèches en haut à droite**.
- **Toucher** une case ouvre la roue des 6 statuts (on touche son choix) ; **maintenir** puis glisser et relâcher marche aussi. Relâcher au milieu ferme sans rien changer.
- **Renforts** : un toucher ouvre la liste des prénoms à choisir (rien d'autre).
- **Extras payés** : **balayer vers la gauche** (ou l'onglet) affiche les commentaires : montants calculés, rond pour valider, appui sur le montant pour le modifier, notes. Chaque page garde sa hauteur.
- **Fiches** : boutons **Imprimer** (en haut et en bas) + **PDF**, aperçu des 9 pages, rappel des extras non validés.
- **Réglages** : taille du texte, **tarif des extras**, équipe (horaires habituels, repos), données.

## Habillage
Thème cosy : crème, taupe, caramel, plaid et grain de papier, accents manuscrits. Technologies : Preact + htm, modules ES, scroll-snap, CSS oklch.

## Données
Séparées de la V1 (clés `v2.*`). Au premier lancement, les réglages et plannings de la V1 sont **copiés** automatiquement (la V1 n'est pas modifiée).
Réglages → « Reprendre les données de la V1 » pour recommencer la copie.

## Fichiers
- `index.html`, `css/app.css` (interface), `css/print.css` (feuilles imprimées, identiques à la V1)
- `js/app.js` (point d'entrée), `js/views.js` (écrans), `js/store.js` (données), `js/roue.js` (roue), `js/ui-parts.js` (feuilles)
- `js/sheets.js` (pages imprimées), `js/impression.js` (impression + PDF), `js/dates.js`
- `vendor/ui.js` : Preact + htm. Le PDF réutilise `../vendor/pdf.js`.

## Impression et aperçu

- Toutes les pages sont en **portrait A4** : le planning du mois occupe toute la feuille, puis une fiche hebdomadaire par salarié.
- Fond blanc (peu d'encre), cadre marron, entêtes beiges, même police que l'application.
- Un toucher sur une page d'aperçu l'ouvre en plein écran (transition, pincer pour zoomer, toucher pour fermer).
