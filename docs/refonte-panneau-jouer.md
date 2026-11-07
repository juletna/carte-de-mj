# Refonte du panneau de droite de Jouer

**Statut : validée par Julien le 7 novembre 2026, réalisée (les six étapes, voir « État de la livraison » en bas).** À suivre avec `docs/design-panneaux.md`.

Maquette de l'état actuel (les quatre vues, avec les incohérences numérotées) : [`maquettes/panneau-jouer-avant.html`](maquettes/panneau-jouer-avant.html), à ouvrir dans le navigateur. Maquette de la proposition : [`maquettes/panneau-jouer-apres.html`](maquettes/panneau-jouer-apres.html).

## Ce qu'il y a aujourd'hui

Le panneau de droite de la régie change d'onglets selon la carte affichée : **Salle · Joueurs · Table** pour un donjon, **Lieu · Table** pour un monde.

| Onglet | Contenu |
|---|---|
| **Salle** (donjon) | « Visible à la table » (interrupteurs Monstres visibles / Objets visibles) · « Cette salle » (compte des cachés, Révéler toute la salle, portes, éléments) · « Notes » (préparation en lecture seule + notes de partie modifiables) |
| **Joueurs** (donjon seulement) | Personnages (fiches, PV, pion) · Ajouter un joueur |
| **Lieu** (monde) | « Carte à la table » (une phrase + Masquer les noms) · « Point choisi » (Révéler, Entrer) · « Points » (liste) · « Notes du lieu » (lecture seule) |
| **Table** (les deux) | Alerte « En retrait » + Reprendre la main · « Table » (Ouvrir la fenêtre, Plein écran ici, Taille de la carte : Remplir / Échelle réelle, Mini-carte) · « Régler l'écran de table » (Rotation, Miroir, Taille réelle d'une case en mm, Calibrer) · « Faire défiler la vue table » · « Réglages » (Taille d'une case, Adapter la carte à la fenêtre) |

## Incohérences relevées

1. **Quatre « Table » qui n'ont pas le même sens.** L'onglet de vue « À la table » (barre d'outils), l'onglet « Table » (réglages de l'écran), la section « Table » dans cet onglet, et la pastille « À la table » du bandeau. Une section « Table » dans l'onglet « Table » est une tautologie.
2. **Le même concept, deux endroits, deux vocabulaires.** « Ce que voit la table » s'appelle « Visible à la table » (interrupteurs) dans Salle, « Carte à la table » (une simple phrase) dans Lieu, et « Révéler à la table » dans chaque point. La révélation d'une salle et celle d'un point ne se ressemblent pas.
3. **Salle et Lieu sont la même chose** : l'endroit qu'on regarde. Deux noms, deux structures, deux jeux de notes.
4. **Les notes ne sont pas symétriques.** Une salle a des notes de partie modifiables, un lieu seulement ses notes de préparation en lecture seule. Impossible de noter ce qui se passe sur une carte de monde.
5. **Les joueurs disparaissent dans un monde.** L'onglet Joueurs n'existe que pour un donjon, alors que le groupe est le même partout.
6. **Trois « taille ».** « Taille de la carte à la table » (Remplir / Réelle), « Taille réelle d'une case (mm) » (calibrage de l'écran) et « Taille d'une case » (zoom de la régie, dans « Réglages »). Cette dernière ne concerne pas la table : elle règle l'affichage de la régie et devrait être avec le bouton « Affichage » de la barre d'outils.
7. **L'alerte « En retrait » est enterrée.** « Reprendre la main » est un geste critique, mais il est dans l'onglet Table, déjà doublé par le bandeau rouge.
8. **Anciennes commandes hors du design.** Dans « Régler l'écran de table », un « ? » orphelin, des cases à cocher et des étiquettes qui ne s'alignent pas, un `fieldset` avec légende : ce sont les anciens composants, pas les règles de `docs/design-panneaux.md`.
9. **Deux onglets « aide » différents** (« ? » dans l'en-tête de section et `details.aide` dans le corps).

## Proposition

**Principe : deux onglets, les mêmes dans un monde et dans un donjon.** Tout ce qui concerne la table est sur la carte, dans « Ouvrir la table » ou dans « Affichage » : il n'y a plus d'onglet « Table » ni « Écran ». Maquette : [`maquettes/panneau-jouer-apres.html`](maquettes/panneau-jouer-apres.html).

| Onglet | Question | Contenu |
|---|---|---|
| **Ici** | « Où suis-je, que voit la table ? » | *Visible à la table* (une seule section, mêmes mots pour une salle et un lieu : interrupteurs **Monstres**, **Objets** et **Plan du donjon** dans un donjon ; **Points** et **Noms des points** dans un monde) · *Cachés* (la seule liste : ce qui n'est pas encore à la table, « Révéler » sur chaque ligne et « Révéler tout » ; elle disparaît quand rien n'est caché) · *Notes* (préparation en lecture seule + notes de partie modifiables, aussi pour un lieu) |
| **Joueurs** | « Qui joue ? » | **Inchangé pour l'instant** (décision du 7 novembre : on n'y touche pas). Reste tel qu'il est dans le code : personnages, PV, pion, retardataires, seulement dans un donjon. Une piste est notée plus bas pour plus tard. |

**Barre d'outils de la scène.** Sélecteur **En régie / À la table** (liseré vert et pastille « en direct » dans la vue « À la table »), bouton doré **Ouvrir la table ▾** (menu : « Dans une fenêtre », « Plein écran ici »), puis la grille et **Affichage**. « Ouvrir la table » n'existe qu'à cet endroit.

**Décisions du 7 novembre 2026**

1. **Plus d'onglets « Table » ni « Écran ».** Les collisions de noms (quatre « Table ») disparaissent d'un coup. « Salle » et « Lieu » deviennent « Ici ».
2. **Plus de listes d'éléments, de points ni de portes.** Elles doublent la carte (un clic y choisit déjà l'élément) et l'arbre (qui montre les lieux auxquels les points mènent et descend depuis la navigation de Jouer). Elles sont remplacées par **Cachés**, la seule liste utile : retrouver ce qu'on a préparé en secret pour le révéler au bon moment. Les éléments visibles ne sont pas listés.
3. **Le détail d'un point est un popover sur la carte** (Mène à, Entrer dans ce lieu, Cacher ou Révéler), ancré au point touché ; même geste pour un point, une porte ou un pion, il remplace aussi le panneau « Sélection » flottant d'une salle. Il réutilise la bulle et le placement de Préparer (`js/mj/bulle.js`, `js/mise-en-page.js`), se ferme au clic ailleurs ou avec Échap, évite les bords et le point voisin. À prévoir : dans la vue « À la table », la carte est dans un cadre, donc le cadre doit envoyer la position du clic avec le message ; sur téléphone, une feuille en bas ; toucher un petit point est plus difficile qu'une ligne de liste (le zoom doit suffire).
4. **« Remplir l'écran » et « Échelle réelle » sont des cadrages de zoom, pas des réglages de panneau.** Ils vivent dans le contrôle de cadrage de la vue « À la table » : `− 160 % +`, **Remplir**, **Réel**. « Réel » est grisé tant que la carte n'a pas de grille (infobulle « Cette carte n'a pas de grille ») ; toucher + ou − en sort, il n'y a pas de verrou.
5. **Défilement et zoom directement sur la carte**, dans la vue « À la table » : glisser pour décaler, molette ou pincer pour zoomer. La section « Défilement » et ses flèches disparaissent. La régie garde le zoom et la position (source unique) et les envoie à la fenêtre de table et à l'aperçu ; le cadre de la vue ne fait qu'envoyer les gestes. Zoom et position sont propres à chaque carte et reviennent au cadrage de base au changement de carte. **Nouveau** : la table n'a pas de zoom aujourd'hui, il faut un message de plus sur le canal (`js/protocole-table.js`) géré par le plan du donjon (`js/ecran-table.js`) et par la carte du monde (`js/univers-table.js`) ; c'est une étape à part.
6. **« Mini-carte » devient « Plan du donjon »** (le plan des salles découvertes que la table affiche) et passe dans **Ici › Visible à la table**, avec Monstres et Objets : c'est un réglage de ce que la table montre de la salle, et il n'existe que dans un donjon (pas d'interrupteur mort dans un monde).
7. **Le matériel de la table** (rotation, miroir, taille réelle d'une case, calibrage) est réglé une fois : il quitte le panneau et vit **directement dans le groupe « À la table » du popover « Affichage »**, avec la pénombre et les flammes (pas de fenêtre séparée : un clic de moins, et c'est déjà là que le MJ cherche les réglages de la table). Le calibrage a des étapes (carte bancaire, ajustements ±0,1) : il se déplie dans le popover, qui **reste ouvert** pendant le calibrage (un clic ailleurs ne le ferme pas), avec « Terminer le calibrage ». Les préférences de la régie de l'ancienne section « Réglages » (taille d'une case, adapter à la fenêtre) rejoignent le groupe « Régie » du même popover.
   **Design du popover « Affichage »** : un contrôle adapté à chaque réglage, plutôt que des listes déroulantes et des cases partout. Style et Détails en **boutons segmentés** (deux choix, un clic) ; Pénombre et Taille d'une case en **curseurs avec leur valeur** (« 60 % », « 48 px ») ; oui/non en **interrupteurs** alignés à droite ; trois groupes séparés par un filet et titrés (**Régie**, **À la table**, **Écran de la table** « réglé une fois »). Dans « Écran de la table » : l'**orientation** se règle par deux boutons **↺ ↻** (comme tourner une photo sur un iPhone, par quarts de tour), avec un **aperçu** : un écran de table fixe, en paysage, où une lettre « F » tourne et se retourne comme la carte le fera, la valeur écrite à côté (« 90° à droite ») ; le **miroir** est un **interrupteur** comme les autres lignes (pas un bouton à part) ; la **taille réelle d'une case** est un **stepper − 25 mm +** ; « Calibrer sur la table » ouvre le calibrage, qui se déplie dans le popover. Cibles de 40 px, étiquettes à gauche et contrôle à droite sur toutes les lignes.
8. **« Reprendre la main » et « Consultation » ne vivent que dans les bandeaux au-dessus de la carte** (rouge « En retrait », jaune « Consultation »), plus dans un onglet. Normalement, aucun bandeau.
9. **Les composants qui restent** (le groupe « À la table » du popover, Notes, etc.) passent au système de `docs/design-panneaux.md` : champs à étiquette T3, interrupteurs, une seule aide par section (le « ? » du bandeau).

## Ordre de réalisation suggéré

1. ✅ **Livrée le 7 novembre 2026.** Renommer (Salle et Lieu → Ici), « Ouvrir la table ▾ » dans la barre d'outils (menu « Dans une fenêtre » / « Plein écran ici », `js/atelier/ouvrir-table.js`), « Reprendre la main » seulement dans le bandeau rouge, « Réglages » (taille d'une case, Adapter) dans le groupe « Régie » du popover « Affichage ». Choix faits : l'onglet « Table » est **renommé « Écran »** et reste en attendant les étapes 2 et 6 (il garde « Taille de la carte », « Plan du donjon » ex-« Mini-carte », « Régler l'écran de table », « Faire défiler la vue table ») ; sa section « Table » devient « Carte à la table » ; les en-têtes de type « Salle » (en-tête de l'onglet Ici) ne changent pas ; le texte long de l'ancienne alerte (partie aussi ouverte dans l'autre régie, non enregistrée) est passé dans le bandeau rouge. **Reste** : étape 2 (matériel de la table dans « Affichage », « Plan du donjon » dans Ici), étape 6 (cadrage et défilement sur la carte, fin de l'onglet Écran).
2. ✅ **Livrée le 7 novembre 2026** (commit « étape 2 »). Popover « Affichage » redessiné (boutons segmentés, curseurs avec valeur, interrupteurs ; groupes Régie / À la table / Écran de la table avec ↺ ↻ + aperçu F, miroir, stepper mm, calibrage qui se déplie et garde le popover ouvert) ; « Régler l'écran de table » retiré du panneau ; « Plan du donjon » est un bouton à bascule dans Ici › Visible à la table (donjon seulement, comme avant). Choix : le stepper de taille réelle avance de 1 mm (le champ central accepte toujours 25,4) ; sous 760 px le bouton « Ouvrir la table » ne garde que l'icône pour que la barre tienne. Texte d'origine : Le matériel de la table dans le groupe « À la table » du popover « Affichage » (calibrage qui se déplie, popover maintenu ouvert), « Mini-carte » renommée « Plan du donjon » et placée dans Ici.
3. ✅ **Livrée le 7 novembre 2026.** Section « Notes » dans Ici d'un monde : préparation en lecture seule + champ de notes de partie (`notesPartie: { idLieu: texte }` dans la partie du monde, `js/univers-partie.js`, testé ; absent des anciennes parties). Texte d'origine : Notes de partie pour les lieux (stockage dans la partie du monde). L'onglet Joueurs n'est pas touché (hors périmètre pour l'instant).
4. ✅ **Livrée le 7 novembre 2026.** « Visible à la table » : mêmes rangées à interrupteurs (donjon : Monstres, Objets, Plan du donjon ; monde : Points, Noms des points). Nouveau champ de partie de monde `masquerPoints` (la table ne voit aucun point). Texte d'origine : Unifier « Visible à la table » entre salle et lieu.
5. ✅ **Livrée le 7 novembre 2026** (deux commits : donjon, puis monde). Liste « Cachés » (Révéler par ligne, Révéler tout, section masquée quand rien n'est caché) pour les éléments/portes d'une salle et pour les points d'un monde ; listes d'éléments, de portes et de points supprimées ; le panneau « Sélection » (donjon) et le bloc « Point choisi » (monde) deviennent des popovers posés à côté du clic (`js/popover-element.js`, placement de `js/mise-en-page.js`), la position du point touché dans la vue « À la table » part avec le message `table-point` (fractions du cadre). Sous 760 px : feuille en bas (CSS existante). Limites : (levée : voir « État de la livraison ») ; `js/mj/bulle.js` n'est pas réutilisé tel quel (seulement `positionBulle`). Texte d'origine : Liste « Cachés » (Révéler / Révéler tout) à la place des listes d'éléments, de points et de portes ; popover d'élément sur la carte (réutilise `js/mj/bulle.js`).
6. ✅ **Livrée le 7 novembre 2026.** Contrôle `− 100 % +  Remplir  Réel` posé sur la vue « À la table » (Réel grisé sans grille, + ou − sort de Réel) ; molette et pincer zooment, glisser décale (dans le cadre, `js/cadrage-table.js`) ; le zoom vit dans la régie (`affichage.zoom`, propre à chaque carte, remis à 1 quand la carte change) ; messages `table-zoom`, `table-cadrer`, `cadrage` ; la position (défilement) reste locale à chaque écran et se rejoue par `cadrage`. L'onglet « Écran » est supprimé (Taille de la carte, Défilement, Régler l'écran de table n'existent plus) ; dans un monde, l'onglet « Ici » reste affiché seul (décision de Julien : l'onglet Ici existe toujours). Texte d'origine : Contrôle de cadrage sur la carte (− / + / Remplir / Réel), défilement et zoom directement sur la carte dans la vue « À la table » (nouveau message de zoom sur le canal, gestes envoyés depuis le cadre, la régie reste la source). Étape à part, la plus lourde.

Les étapes 3 et 4 touchent la logique de partie (`js/partie.js`, `js/regie-univers.js`) et dépendent du chantier « arbre de Jouer » en cours dans sa propre session : à coordonner avant de les lancer.

## Piste pour plus tard : l'onglet Joueurs

Non décidée, notée le 7 novembre pour ne pas la perdre. Joueurs = le résumé du groupe : une ligne par personnage (nom, barre de PV avec − et + rapides, états en pastilles, position cliquable qui sélectionne le pion) ; le pion touché sur la carte ouvre le même popover que les points (PV −/+, états, fiche) ; dans un monde, mêmes lignes sans position (« avec le groupe »). Question ouverte : les PV changés en jeu ne vivent aujourd'hui que dans la partie (la fiche ne bouge pas) ; faut-il pouvoir les reporter sur la fiche en fin de séance ?

## Blocages

Aucun : les six étapes ont passé tests et vérification navigateur.

## État de la livraison (7 novembre 2026)

**En production (poussé sur `main`, un ou deux commits par étape, tous revertibles seuls avec `git revert <sha>`) :**

| Étape | Contenu | Commit |
|---|---|---|
| 1 | Onglets « Ici », « Ouvrir la table ▾ » dans la barre, « Reprendre la main » seulement dans le bandeau, taille d'une case et Adapter dans Affichage | 61b1d5b |
| 2 | Popover « Affichage » redessiné + matériel de la table (↺ ↻ avec aperçu, miroir, mm, calibrage qui se déplie) ; Plan du donjon dans Ici | 6985ac8 |
| 3 | Notes de partie des lieux d'un monde | fa2e6e0 |
| 4 | « Visible à la table » en interrupteurs, unifié salle / lieu | db5905f |
| 5 | « Cachés » + popover d'élément (donjon c0f5a43, monde bd82e94) | c0f5a43, bd82e94 |
| 6 | Cadrage sur la carte (zoom, Remplir, Réel, glisser, molette, pincer), suppression de l'onglet Écran | d037c51 |

**Choix faits sans demander :** le stepper de taille réelle avance de 1 mm ; « Noms des points » masque aussi le nom du lieu à la table (comme avant) ; `masquerPoints` est un nouveau champ de la partie de monde ; le zoom est transitoire (non enregistré) et revient à 100 % au changement de carte ; le texte « Projet libre (MIT) » de l'ancien onglet Table a disparu ; l'en-tête de l'onglet Ici garde le type « Salle ».

**Non vérifié / limites :**
- Les captures de la maquette n'ont pas été comparées pixel à pixel ; vérification faite à la main sur des parties de donjon et de monde de démonstration (le monde de démonstration n'a pas d'image : le zoom de la carte du monde est testé sous Node mais pas vu à l'écran).
- Pas de test sur un vrai écran de table / une vraie fenêtre table (le navigateur d'aperçu bloque `window.open`), ni sur un vrai téléphone (seulement l'émulation 375 px).
- (Levé ensuite) Dans la vue « À la table » d'un donjon, toucher un pion, un objet ou une porte ouvre maintenant son popover (message `table-element`) ; seuls les éléments visibles à la table s'y touchent, les cachés se révèlent par « Cachés ».
- Les notes de partie d'un lieu sont réécrites si la régie redessine pendant la frappe (le champ perd le focus) : à surveiller.
- Le glisser et le zoom ne marchent que dans le cadre de la vue « À la table » ; la fenêtre table des joueurs ne reçoit que le résultat.
