# Planning boutique

Deux adresses seulement :

| Adresse | Pour qui | Contenu |
|---|---|---|
| **https://mvtax.github.io/planning_belal/app/** | le patron | l'application (V2) : planning, extras payés, fiches à imprimer. Réglages : taille du texte et équipe de base (salariés, horaires, repos). Le tarif des extras et le bloc « Données » sont dans /dev. |
| **https://mvtax.github.io/planning_belal/dev/** | le développeur (code demandé) | réglages complets (équipe, colonnes, horaires, repos), sauvegarde export/import, éditeur des données, diagnostic, anciennes versions (V1, V3). |

La racine `/` et l'ancienne adresse `/v2/` renvoient automatiquement vers `/app/`.

## Données
Pas de serveur : les données vivent dans le navigateur du téléphone (localStorage, clés `v2.*`).
`/app` et `/dev` ouverts **sur le même téléphone** voient les mêmes données. Pour passer des données d'un
téléphone à l'autre : `/dev` → **Exporter** (fichier `.json`), puis **Importer** sur l'autre téléphone.

## Code de /dev
Le code n'est pas écrit dans le site : seule son empreinte SHA-256 (`EMPREINTE` dans `dev/dev.js`, calculée sur
`planning-dev:<code>`) y figure. Une fois saisi, le téléphone s'en souvient ; « Verrouiller » l'oublie.
C'est un verrou côté navigateur, suffisant contre la curiosité, pas une vraie sécurité : le site est statique et public.

## Fichiers
- `app/` : l'application du patron (voir `app/README.md`).
- `dev/` : l'espace développeur (`dev.js`, `dev.css`), `dev/v1/` (V1), `dev/v3/` (V3 + `RECHERCHE.md`).
- `vendor/pdf.js` : jsPDF + html2canvas, partagé par toutes les versions.
