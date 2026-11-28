# Planning — V3 (ergonomie fondée sur la recherche)

Base : la V2 (mêmes écrans, mêmes fonctions, même thème cosy, mêmes feuilles imprimées).
Chaque changement s'appuie sur une étude ou une norme : voir **[RECHERCHE.md](RECHERCHE.md)**
(11 principes, mesures V2 → V3, protocole de test, 30 références).
Adresse : `…/planning_belal/v3/`

## Ce qui change par rapport à la V2
- **Barre du bas pleine largeur** : Planning · Extras payés · Fiches, sous le pouce, avec icône et mot.
- **Cases plus grandes** (10 × 12,4 mm) **sans zone morte** : un toucher entre deux cases va à la plus proche.
- **Roue** : bulles de 15 mm, retour haptique sur iPhone (iOS 18+).
- **Texte** : « grand » par défaut, suit la taille de texte réglée dans l'iPhone, contraste AAA (≥ 7:1) pour les statuts.
- **Annuler** en bas de l'écran, pendant 8 s ; **Imprimer** toujours visible en bas de l'écran Fiches.
- Ouverture sur **la semaine d'aujourd'hui** ; flèches de mois avec le nom du mois voisin.
- Fond fixe (plus d'animation décorative) ; écriture manuscrite réservée au décor.
- Réglages → **Mesures d'utilisation** : temps par choix, taux d'annulation… (rien ne quitte le téléphone).

## Données
Clés `v3.*`. Au premier lancement, la V3 copie les données de la **V2** (ou, à défaut, de la V1) sans les modifier.

## Fichiers
- `css/app.css` (base V2), `css/v3.css` (couche ergonomique V3, commentée avec les principes), `css/print.css`
- `js/retour.js` (retour haptique), `js/mesures.js` (mesures d'utilisation), le reste comme la V2
- `RECHERCHE.md` : le dossier scientifique
