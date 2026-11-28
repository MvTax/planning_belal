# Planning V3 — ergonomie fondée sur la recherche

La V3 reprend la V2 (mêmes écrans, mêmes données, même thème) et la corrige point par point
d'après la littérature scientifique sur l'usage du smartphone, en particulier par les personnes âgées.
L'utilisateur visé a 65 ans, voit mal, utilise un iPhone XR (écran 6,1", 326 ppp) et tient souvent
son téléphone d'une main.

**Conversion utilisée partout** : sur l'iPhone XR, 1 point CSS = 2 pixels = 0,156 mm, donc **1 mm ≈ 6,4 pt**.
Toutes les tailles « V2 → V3 » ci-dessous ont été mesurées dans un navigateur réglé comme un iPhone XR
(414 × 896 pt), réglage de texte par défaut de chaque version.

---

## Résumé des mesures V2 → V3

| Élément | V2 | V3 | Repère scientifique |
|---|---|---|---|
| Case du planning (visible) | 8,9 × 8,4 mm | **10,0 × 12,4 mm** | ≥ 9,2–9,6 mm (Parhi 2006) ; 10 mm → 98–99 % de réussite (Hoober 2017) |
| Case du planning (zone de touche réelle) | 8,9 × 8,4 mm, zones mortes entre cases | **≈ 10,9 × 13,3 mm, aucune zone morte** | rattrapage vers la cible la plus proche (Grossman & Balakrishnan 2005) |
| Bulle de choix (roue) | 12,1 mm | **15,4 mm** | ≥ 14 mm pour le toucher chez les seniors (Leitão & Silva 2012 ; Silva et al. 2017) |
| Flèches de mois | 7,2 × 6,5 mm | **9,0 × 8,7 mm** + nom du mois voisin | coins d'écran : ~12 mm souhaités (Hoober 2017) ; usage 1 fois/mois |
| Onglets du bas | 2 onglets, 17 × 8,4 mm | **3 onglets, 20 × 10 mm**, pleine largeur | zone du pouce (Hoober 2013 ; Bergstrom-Lehtovirta & Oulasvirta 2014) |
| Bouton « + Note » | hauteur 5,0 mm | **7,2 mm** | ≥ 44 pt (Apple HIG, WCAG 2.5.5) |
| Texte des cases | 13,5 px | **17,8 px** | seniors : ≥ 14 pt préféré (synthèses 2022–2025) |
| Prénoms en tête de colonne | 11,5 px | **16,1 px** | idem |
| Gris secondaire | contraste **2,5:1** | **5,3:1** | ≥ 4,5:1 (WCAG 1.4.3) |
| Couleur d'accent | 4,3:1 | **6,1:1** | idem |
| Texte des statuts (OK, Repos…) | 5,4 à 7,0:1 | **7,2 à 8,3:1** | ≥ 7:1 (WCAG 1.4.6, niveau AAA) |
| Message « Annuler » | en haut, 5,2 s | **en bas (sous le pouce), 8 s, bouton 48 pt** | WCAG 2.2.1 ; vitesse de traitement réduite avec l'âge |

---

## P1 — Lire en haut, agir en bas (la zone du pouce)

**Ce que dit la recherche**
- Sur 1 333 observations de personnes utilisant leur téléphone dans la rue, **49 % le tiennent d'une seule main**, 36 % le « bercent » (une main tient, l'autre touche) et 15 % le tiennent à deux mains (Hoober 2013).
- La surface que le pouce atteint confortablement se prédit à partir de la taille de l'écran et de la main : c'est un arc en bas de l'écran, côté main qui tient (Bergstrom-Lehtovirta & Oulasvirta, CHI 2014).
- Chez les **personnes âgées**, les touchers les plus réussis se trouvent **au centre, au bord droit et en bas à droite** de l'écran (Silva, Leitão & Kerwin 2017, deux expériences de 40 participants).
- La zone utilisable par le pouce des personnes âgées **reste limitée même quand l'écran grandit** (Xiong & Muraki 2016).
- Déplacer une barre d'actions du haut vers une position adaptée à la main rend l'usage plus rapide pour la main non dominante et la prise plus stable (Mehrotra et al. 2022).

**Ce que fait la V3**
- Les trois destinations (**Planning · Extras payés · Fiches**) sont dans une barre pleine largeur, en bas. En V2, « Extras payés » était un onglet en haut de l'écran, la zone la plus difficile à atteindre d'une main.
- Le message de confirmation et son bouton **Annuler** apparaissent en bas, juste au-dessus des onglets (V2 : en haut).
- Sur l'écran Fiches, le bouton **Imprimer** reste collé en bas pendant qu'on fait défiler l'aperçu (il reste aussi en haut).
- Le haut de l'écran sert à **lire** : nom du mois, en-têtes de colonnes.

**Compromis assumé** : les flèches de changement de mois restent en haut à droite, comme demandé pour la V2.
Leur emplacement est difficile à atteindre, mais elles servent une fois par mois. La règle « fréquence × accessibilité »
place les gestes fréquents dans la zone facile et les gestes rares ailleurs. Elles sont agrandies (voir P2).

## P2 — Des cibles assez grandes pour un doigt de 65 ans

**Ce que dit la recherche**
- Utilisation d'une main avec le pouce : **9,2 mm** suffisent pour un toucher isolé, **9,6 mm** pour une série de touchers (Parhi, Karlson & Bederson 2006).
- La précision dépend de l'endroit : au centre, des cibles de **7 mm** suffisent, dans les coins il faut environ **12 mm** ; des boutons de **10 mm** donnent **98 à 99,4 %** de réussite (Hoober 2017).
- Personnes âgées : le temps de réaction baisse quand la taille des boutons et l'espace entre eux augmentent ; **19 mm** sont recommandés (Jin, Plocher & Kiff 2007, chiffre rapporté par des travaux qui le citent).
- Personnes âgées sur smartphone : les performances sont meilleures avec des cibles de **plus de 14 mm** pour le toucher et de **plus de 17,5 mm** pour le balayage ; l'espacement n'a pas d'effet significatif une fois la cible assez grande (Leitão & Silva 2012 ; Silva, Leitão & Kerwin 2017).
- De petits boutons (3 mm contre 9 mm) dégradent la vitesse du pouce des personnes âgées et augmentent la fatigue musculaire (Xiong & Muraki 2016).
- Normes : 44 × 44 pt (Apple Human Interface Guidelines), 48 × 48 dp (Material Design), 44 × 44 px (WCAG 2.5.5, AAA), 24 × 24 px minimum (WCAG 2.5.8, AA).

**Ce que fait la V3**
- Quatre vendeurs, la date et les renforts doivent tenir dans 414 pt de large. On ne peut donc pas atteindre 14 mm de large. La V3 récupère toute la largeur possible (marges réduites) et grandit en hauteur : **10,0 × 12,4 mm** visibles, au-dessus des 9,2–9,6 mm et des 10 mm à 98–99 %.
- **Choix en deux temps** : toucher une case ne change rien, cela ouvre la roue. Le choix décisif se fait sur des bulles de **15,4 mm**, au-dessus du seuil de 14 mm des études sur les seniors. Une erreur sur la petite cible coûte donc seulement d'ouvrir la mauvaise roue (le titre de la roue dit « Belal · jeudi 19 »), et le message permet d'annuler.
- Flèches de mois 9 × 8,7 mm, réglages 8,1 mm, onglets 20 × 10 mm, boutons des feuilles ≥ 48 pt.

## P3 — Pas de zone morte : le doigt ne tombe pas là où l'œil vise

**Ce que dit la recherche**
- L'imprécision du toucher n'est pas seulement le « gros doigt » : environ **deux tiers** de l'erreur viennent d'un **décalage systématique** entre le point visé et le point mesuré par l'écran, décalage qui dépend de l'angle du doigt (Holz & Baudisch, CHI 2010).
- Sur **120 millions** de touchers enregistrés par un jeu Android, les touchers sont décalés de façon systématique ; corriger ce décalage réduit les erreurs de **7,79 %** (Henze, Rukzio & Boll 2011).
- Agrandir la zone active d'une cible jusqu'à couvrir l'espace vide autour (« curseur-bulle ») accélère la sélection sans gêner (Grossman & Balakrishnan, CHI 2005).

**Ce que fait la V3**
- Chaque case a une zone de touche qui déborde de 3 pt dans l'espace entre les cases.
- Un toucher qui tombe quand même entre deux cases (jusqu'à 14 pt d'écart) est attribué à la **case la plus proche** : la grille n'a plus de zone morte. Ces « rattrapages » sont comptés (voir P11).

## P4 — Un texte plus grand, que la personne peut encore agrandir

**Ce que dit la recherche**
- Les personnes âgées préfèrent des polices plus grandes, mais il n'y a **pas de taille unique** : les besoins varient d'une personne à l'autre. Une revue systématique recommande de laisser l'utilisateur régler la taille (Hou, Anicetus & He 2022).
- Des travaux sur les applications pour seniors rapportent une préférence pour **au moins 14 pt** et des polices sans empattement.
- Le Nielsen Norman Group recommande que tout site laisse l'utilisateur agrandir le texte, ciblé « seniors » ou non.

**Ce que fait la V3**
- Démarre en **« grand texte »** (× 1,12) au lieu de « normal ».
- Lit le réglage **Taille du texte d'iOS** (Dynamic Type, via `-apple-system-body`). Si le patron a déjà agrandi le texte de son iPhone, l'appli suit automatiquement (jusqu'à × 1,3), puis applique le choix fait dans Réglages (plafond global × 1,45).
- Textes minimums : 17,8 px dans les cases, 16 px pour les prénoms, 16–18 px dans les feuilles. Vérifié en « très grand » : aucun texte ne déborde.

## P5 — Du contraste, et jamais la couleur seule

**Ce que dit la recherche**
- La sensibilité au contraste baisse dès 40–50 ans. Les lecteurs âgés sont **plus pénalisés** que les jeunes quand le contraste du texte baisse (étude de lecture citée dans les références ; Mitzner & Rogers 2006).
- Beaucoup de personnes de plus de 65 ans ont une acuité « normale » mais une sensibilité au contraste faible (étude de l'Université du Michigan sur 4 475 bénéficiaires de Medicare, 2026).
- WCAG : 4,5:1 minimum pour le texte (1.4.3, AA), **7:1** pour le niveau renforcé (1.4.6, AAA).

**Ce que fait la V3** (contrastes calculés avec la formule WCAG sur le fond crème)
- Gris secondaire 2,5:1 → **5,3:1**. Texte secondaire 5,3:1 → **7,4:1**. Accent 4,3:1 → **6,1:1**.
- Mots dans les cases : OK 8,3:1 · Repos 7,2:1 · CP 7,6:1 · École 7,5:1 · Malade 7,8:1 · Absent 7,6:1, **tous au niveau AAA**.
- Chaque statut reste codé **trois fois** : couleur + icône + mot. Il reste lisible si la couleur est mal perçue, ce qui arrive plus souvent avec le jaunissement du cristallin.

## P6 — Typographie : l'écriture manuscrite reste un décor

**Ce que dit la recherche** : les personnes âgées lisent mieux et préfèrent les polices **sans empattement** à l'écran (synthèses citées en P4). Les polices manuscrites ont des formes de lettres irrégulières, donc moins reconnaissables.

**Ce que fait la V3** : le thème cosy garde sa police manuscrite seulement pour le décor. Les notes, messages, boutons et étiquettes d'aperçu passent en sans-serif (Avenir Next sur iPhone). Les capitales espacées sont réservées aux titres d'un seul mot.

## P7 — Chaque geste a un bouton visible, chaque icône a un mot

**Ce que dit la recherche**
- Les seniors interprètent moins bien les icônes des téléphones ; **ajouter un libellé** et rapprocher l'image de la fonction améliore la compréhension (Leung et al. 2011).
- Le toucher et le balayage sont les gestes les plus faciles à découvrir pour les seniors novices (Leitão & Silva 2013).
- Dans une étude d'oculométrie, des utilisateurs âgés **ne distinguaient pas l'appui court de l'appui long** (étude d'oculométrie de 2021, arXiv:2101.00792).
- WCAG 2.5.1 : toute action faite par un geste à trajectoire doit aussi pouvoir se faire d'un simple toucher.

**Ce que fait la V3**
- Le balayage vers « Extras payés » existe toujours, mais il n'est plus nécessaire : l'onglet du bas fait la même chose.
- Appui court et appui long ouvrent **la même roue**. La personne n'a donc pas besoin de savoir faire la différence.
- Les feuilles se ferment avec une croix de 48 pt (le glisser vers le bas reste possible). Le zoom de l'aperçu a des boutons + et −.
- Onglets avec icône + mot ; flèches de mois avec le nom du mois voisin (« oct. », « déc. »).
- L'astuce du premier lancement décrit le geste le plus simple : « Touchez une case, puis touchez le bon choix ».

## P8 — Moins de choix et de stimuli à la fois

**Ce que dit la recherche**
- Le temps de décision augmente avec le nombre de choix (loi de Hick-Hyman), et **cette pente est plus forte chez les personnes âgées** (étude de 2013 dans *Frontiers in Aging Neuroscience*).
- Les personnes âgées préfèrent des ensembles de choix plus petits (Reed, Mikels & Simon 2008).

**Ce que fait la V3** : 3 onglets, 6 statuts dans la roue, rien d'autre à l'écran pendant un choix. Les taches de couleur animées du fond (V2) sont **arrêtées** : un mouvement permanent attire l'œil sans rien apporter. Le réglage iOS « Réduire les animations » est respecté.

## P9 — Reconnaître plutôt que se souvenir

**Ce que dit la recherche** : l'heuristique « reconnaissance plutôt que rappel » (Nielsen 1994) dit qu'il faut montrer l'information utile plutôt que la faire chercher ou retenir.

**Ce que fait la V3**
- À l'ouverture du mois en cours, l'écran arrive **directement sur la semaine d'aujourd'hui**, sur les deux pages (Planning et Extras).
- La semaine en cours est encadrée et le jour est marqué d'un trait.
- Les flèches de mois indiquent où elles mènent (« oct. », « déc. »).

## P10 — Un retour immédiat, et le droit à l'erreur

**Ce que dit la recherche**
- Les gens prennent l'habitude de valider les fenêtres de confirmation sans les lire. Il vaut mieux **permettre d'annuler** que demander « Êtes-vous sûr ? » (Raskin 2000 ; motif « Undo, not confirmation »).
- Les personnes âgées traitent l'information plus lentement. WCAG 2.2.1 demande de laisser assez de temps.
- Un retour vibrotactile améliore la sélection de cibles chez les utilisateurs âgés (étude sur souris vibrante), et les vibrations entre 100 et 300 Hz sont les plus confortables à tout âge (Zhang 2016).

**Ce que fait la V3**
- Chaque choix affiche ce qui a changé (« Belal · jeu. 19 → Congé payé ») avec **Annuler**, pendant 8 s au lieu de 5,2 s, dans un bouton de 48 pt placé sous le pouce.
- **Retour haptique** quand la roue s'ouvre, quand le doigt passe sur une bulle, quand on valide, quand on change d'onglet. L'iPhone ne connaît pas `navigator.vibrate`, donc la V3 utilise le retour haptique natif d'un interrupteur iOS (Safari 18 et plus, disponible sur iPhone XR).
- Chaque bouton s'enfonce visiblement sous le doigt.

## P11 — Mesurer, pas seulement supposer

Une démarche scientifique ne s'arrête pas aux études publiées : il faut vérifier sur le terrain, avec l'utilisateur réel.

**Ce que fait la V3** : Réglages → *Mesures d'utilisation*. Le téléphone compte, sans rien envoyer :
- le nombre de cases remplies ;
- le **temps moyen par choix** (de l'ouverture de la roue au choix) ;
- le **taux d'annulation**, qui sert d'indicateur d'erreur ;
- les roues fermées sans choix ;
- les touchers rattrapés entre deux cases (P3).

**Protocole de test proposé** (critères de la norme ISO 9241-11 : efficacité, efficience, satisfaction)
1. **Tâches** : remplir une semaine complète, mettre un congé, ajouter deux renforts, valider les extras, imprimer le mois.
2. **Comparaison** : faire les mêmes tâches sur la V2 puis sur la V3, dans des ordres croisés si possible.
3. **Mesures** : réussite sans aide (oui/non), temps par tâche, erreurs (annulations), puis le questionnaire SUS (*System Usability Scale*, Brooke 1996 ; 10 questions, score sur 100, 68 = moyenne).
4. **Hypothèses** : la V3 réduit le taux d'annulation et le temps par choix, et le score SUS est plus élevé.

## Limites

- Plusieurs chiffres viennent d'études menées sur d'autres téléphones ou dans d'autres conditions. Le chiffre de Jin et al. (19 mm) est rapporté d'après des articles qui le citent.
- 14 mm de large ne tiennent pas avec quatre colonnes sur un écran de 6,1". La V3 compense par le choix en deux temps, la zone de touche élargie et l'annulation.
- Le retour haptique iOS repose sur un comportement de Safari 18 qui n'est pas une API officielle : s'il disparaît, l'appli fonctionne simplement sans vibration.
- Les conclusions doivent être confirmées avec le patron lui-même (P11).

---

## Références

1. Hoober, S. (2013). *How Do Users Really Hold Mobile Devices?* UXmatters. https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php
2. Hoober, S. (2017). *Design for Fingers, Touch, and People*, parties 1 à 3. UXmatters. https://www.uxmatters.com/mt/archives/2017/03/design-for-fingers-touch-and-people-part-1.php
3. Bergstrom-Lehtovirta, J. & Oulasvirta, A. (2014). Modeling the Functional Area of the Thumb on Mobile Touchscreen Surfaces. *CHI 2014*, 1991–2000. doi:10.1145/2556288.2557354
4. Parhi, P., Karlson, A. K. & Bederson, B. B. (2006). Target Size Study for One-Handed Thumb Use on Small Touchscreen Devices. *MobileHCI 2006*, 203–210. doi:10.1145/1152215.1152260
5. Jin, Z. X., Plocher, T. & Kiff, L. (2007). Touch Screen User Interfaces for Older Adults: Button Size and Spacing. *HCI International 2007*, LNCS 4554, 933–941.
6. Leitão, R. & Silva, P. A. (2012). Target and Spacing Sizes for Smartphone User Interfaces for Older Adults. *PLoP 2012*. https://mural.maynoothuniversity.ie/6045
7. Silva, P. A., Leitão, R. & Kerwin, M. (2017). Investigating Activity Zones on Smartphones: An Empirical Study with Older Adults. https://mural.maynoothuniversity.ie/11919
8. Leitão, R. & Silva, P. A. (2013). A Study of Novice Older Adults and Gestural Interaction on Smartphones. *Workshop Mobile Accessibility, CHI 2013*. https://mural.maynoothuniversity.ie/6032
9. Xiong, J. & Muraki, S. (2016). Thumb performance of elderly users on smartphone touchscreen. *SpringerPlus* 5, 1218. https://pmc.ncbi.nlm.nih.gov/articles/PMC4967054/
10. Xiong, J. & Muraki, S. (2016). Effects of age, thumb length and screen size on thumb movement coverage on smartphone touchscreens. *Int. J. of Industrial Ergonomics* 53, 140–148.
11. Mehrotra, Das & Zanwar (2022). Action Bar Adaptations for One-Handed Use of Smartphones. arXiv:2208.08734
12. Holz, C. & Baudisch, P. (2010). The Generalized Perceived Input Point Model and How to Double Touch Accuracy by Extracting Fingerprints. *CHI 2010*, 581–590.
13. Henze, N., Rukzio, E. & Boll, S. (2011). 100,000,000 Taps: Analysis and Improvement of Touch Performance in the Large. *MobileHCI 2011*. https://eprints.lancs.ac.uk/id/eprint/57576
14. Grossman, T. & Balakrishnan, R. (2005). The Bubble Cursor: Enhancing Target Acquisition by Dynamic Resizing of the Cursor's Activation Area. *CHI 2005*.
15. Findlater, L., Froehlich, J., Fattal, K., Wobbrock, J. O. & Dastyar, T. (2013). Age-Related Differences in Performance with Touchscreens Compared to Traditional Mouse Input. *CHI 2013*. https://faculty.washington.edu/wobbrock/pubs/chi-13.04.pdf
16. Hou, G., Anicetus, U. & He, J. (2022). How to design font size for older adults: A systematic literature review with a mobile device. *Frontiers in Psychology* 13. https://pmc.ncbi.nlm.nih.gov/articles/PMC9376262/
17. Nielsen Norman Group. *Usability for Seniors*. https://www.nngroup.com/articles/usability-seniors-improvements/
18. Leung, R., McGrenere, J. & Graf, P. (2011). Age-related differences in the initial usability of mobile device icons. *Behaviour & Information Technology*. https://www.cs.ubc.ca/labs/edapt/papers/leung2011.pdf
19. *Eye Tracking to Understand Impact of Aging on Mobile Phone Applications* (2021). arXiv:2101.00792
20. W3C (2023). *Web Content Accessibility Guidelines (WCAG) 2.2* : 1.4.3, 1.4.6, 2.2.1, 2.5.1, 2.5.5, 2.5.8.
21. Apple. *Human Interface Guidelines* : Accessibility, Layout (cibles de 44 × 44 pt), Typography (Dynamic Type).
22. Reed, A. E., Mikels, J. A. & Simon, K. I. (2008). Older adults prefer less choice than young adults. *Psychology and Aging* 23(3), 671–675.
23. Étude Hick-Hyman et Fitts chez les personnes âgées (2013). *Frontiers in Aging Neuroscience*. doi:10.3389/fnagi.2013.00062
24. Étude de lecture et contraste chez les lecteurs âgés. https://pmc.ncbi.nlm.nih.gov/articles/PMC6233613/ ; Mitzner, T. L. & Rogers, W. A. (2006). Reading in the dark: effects of age and contrast on reading speed and comprehension. *Human Factors* 48(2).
25. Xu et al. (2026). Seuil de sensibilité au contraste et difficulté visuelle (NHATS, 4 475 participants). *JAMA Ophthalmology*.
26. Raskin, J. (2000). *The Humane Interface*. Addison-Wesley. Voir aussi : Raskin, A. *Never Use a Warning When You Mean Undo*, A List Apart.
27. Zhang, X. (2016). Thèse de doctorat sur le retour vibrotactile des écrans tactiles, Université de Sheffield. https://etheses.whiterose.ac.uk/9651
28. Nielsen, J. (1994). *10 Usability Heuristics for User Interface Design*.
29. ISO 9241-11:2018. *Ergonomics of human-system interaction — Usability: Definitions and concepts*.
30. Brooke, J. (1996). SUS: A "quick and dirty" usability scale. In *Usability Evaluation in Industry*.
