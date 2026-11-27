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

## Pointage des salariés (mini-appli)

Chaque salarié a sa mini-appli : un seul gros bouton **Arrivée → Pause → Reprise → Départ**, ses heures du jour / de la semaine / du mois, correction d'un oubli, annulation.

### Mise en place du pointage en direct (une seule fois, ~10 min, gratuit)

1. Créer un compte sur <https://supabase.com> puis **New project** (nom au choix, région Europe, un mot de passe quelconque).
2. Dans le projet : **SQL Editor** → **New query**. Coller le script `supabase/schema.sql` (ou bouton « Copier le script » dans Réglages) → **Run**. Message « Success ».
3. **Project Settings → API** (ou « Connect ») : copier **Project URL** et la clé **anon / publishable**.
4. Dans l'appli du patron : ⚙︎ → **Pointage en direct** → coller l'adresse et la clé → **Enregistrer et tester la connexion**. Un code d'équipe est généré : le garder (il donne accès aux pointages).
5. ⚙︎ → Équipe → un salarié → **Envoyer son appli de pointage** : lien personnel à envoyer par WhatsApp/SMS. Le salarié l'ouvre et l'ajoute à son écran d'accueil.

Ensuite chaque pointage arrive tout seul : en haut du planning s'affiche « ● Soso » (en poste) ou « ☕ en pause », la case du jour montre « OK ● 10h02 » puis « OK 9h28 » après le départ, et les fiches de présence reprennent les heures réelles.

Sécurité : les tables ne sont lisibles par personne directement ; seules les fonctions du script y accèdent, avec le code d'équipe (patron) ou le jeton personnel (salarié, une seule personne). La clé « anon » est publique par conception.

Sans serveur, un mode manuel reste possible : le salarié envoie le lien de son mois, le patron l'ouvre et choisit « Ajouter ».

## Notes

- Aucune IA, aucun scan, aucune donnée envoyée : tout reste sur le téléphone (localStorage).
- Les montants d'extras ne sont imprimés dans la colonne « Commentaires » que s'ils sont validés.

## Fichiers

- `index.html`, `styles.css` : l'interface.
- `planning.js` : planning du mois (roue de choix, renforts, extras payés, notes).
- `supabase/schema.sql`, `schema-sql.js`, `supabase.js` : base de données et client des pointages en direct.
- `pointage.html`, `pointage.js`, `pointage.css`, `sw.js`, `manifest-pointage.webmanifest` : mini-appli de pointage.
- `app.js` : réglages, fiches de présence, planning imprimé, PDF.
- `vendor/pdf.js` : jsPDF + html2canvas (création du PDF).
