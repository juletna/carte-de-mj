# Refonte du panneau de droite de Jouer

**Statut : proposition du 7 novembre 2026, non décidée.** Rien n'est fait tant que Julien ne l'a pas validée. À suivre avec `docs/design-panneaux.md`.

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

**Principe : un panneau, trois onglets stables, les mêmes dans un monde et dans un donjon.** Chaque onglet répond à une question.

| Onglet | Question | Contenu |
|---|---|---|
| **Ici** | « Où suis-je, que voit la table ? » | *Visible à la table* (une seule section, même vocabulaire pour une salle ou un lieu : interrupteurs Monstres, Objets ou Points, Noms des points) · *Cachés* (la seule liste : ce qui n'est pas encore à la table, « Révéler » sur chaque ligne et « Révéler tout » ; elle disparaît quand rien n'est caché) · *Notes* (préparation en lecture seule + notes de partie modifiables, aussi pour un lieu) |
| **Joueurs** | « Qui joue ? » | Personnages · Ajouter un joueur. Disponible dans un monde comme dans un donjon. |
| **Écran** | « Comment la table affiche-t-elle ? » | *Fenêtre de table* (Ouvrir, Plein écran ici, Reprendre la main si besoin) · *Taille de la carte* (Remplir / Échelle réelle, Mini-carte) · *Calibrage* (Rotation, Miroir, mm, Calibrer) · *Défilement* |

**Changements qui en découlent**

- « Table » devient « Écran » : plus de collision avec « À la table ».
- « Salle » et « Lieu » deviennent « Ici ».
- La section « Réglages » (taille d'une case, adapter à la fenêtre) sort du panneau et rejoint le popover « Affichage » de la barre d'outils, avec le thème, la grille et les repères : ce sont des préférences de la régie.
- « Reprendre la main » vit seulement dans le bandeau rouge « En retrait », au-dessus de la carte, qui est déjà là.
- Le bouton « Ouvrir la fenêtre table » (le seul doré du panneau) monte dans la barre d'outils, à côté du sélecteur « En régie / À la table », pour être atteint depuis n'importe quel onglet.
- Les composants de l'onglet Écran passent au système de `docs/design-panneaux.md` : champs à étiquette T3, interrupteurs, une seule aide par section (le « ? » du bandeau).

**Décision du 7 novembre : plus de listes d'éléments, de points ni de portes.** Les listes « Éléments » (salle), « Points » (lieu) et « Portes de la salle » doublent la carte (un clic y choisit déjà l'élément) et l'arbre (qui montre les lieux auxquels les points mènent, et qui descend depuis la navigation de Jouer). Elles sont remplacées par **Cachés**, la seule liste utile : retrouver ce qu'on a préparé en secret pour le révéler au bon moment. Les éléments visibles ne sont pas listés. Le détail d'un point (Mène à, Entrer dans ce lieu, Cacher ou Révéler) devient un **popover sur la carte**, ancré au point touché (décision du 7 novembre : meilleur qu'un bloc dans le panneau, qui sautait à chaque clic). Même geste pour un point, une porte ou un pion : il remplace aussi le panneau « Sélection » flottant d'une salle. Il réutilise la bulle et le placement de Préparer (`js/mj/bulle.js`, `js/mise-en-page.js`), se ferme au clic ailleurs ou avec Échap, évite les bords et le point voisin. À prévoir : dans la vue « À la table », la carte est dans un cadre, donc le cadre doit envoyer la position du clic avec le message pour que la régie place le popover ; sur téléphone, une feuille en bas plutôt qu'une bulle ; et toucher un petit point sur la carte est plus difficile qu'une ligne de liste (le zoom doit suffire).

**Couplage optionnel (à tester à l'usage).** Passer à la vue « À la table » ouvre l'onglet **Écran** ; revenir à « En régie » ouvre **Ici**. Le MJ qui règle l'écran voit tout de suite le résultat sans manipuler le panneau. Reste désactivable : un onglet choisi à la main n'est pas écrasé.

## Ordre de réalisation suggéré

1. Renommer (Table → Écran, Salle et Lieu → Ici) et sortir « Réglages » vers « Affichage » : rapide, sans risque.
2. Remettre l'onglet Écran au design des panneaux (champs, interrupteurs, aide).
3. Rendre Joueurs disponible dans un monde ; notes de partie pour les lieux (stockage dans la partie du monde).
4. Unifier « Visible à la table » entre salle et lieu.
5. Monter « Ouvrir la fenêtre table » dans la barre d'outils ; coupler vues et onglets.

Les étapes 3 et 4 touchent la logique de partie (`js/partie.js`, `js/regie-univers.js`) et dépendent du chantier « arbre de Jouer » en cours dans sa propre session : à coordonner avant de les lancer.
