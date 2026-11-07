# Calibrage de la table

**Statut : décidé le 7 novembre 2026, à réaliser.** Maquette : [`maquettes/calibrage-table.html`](maquettes/calibrage-table.html).

## Problème

On ne calibre pas un donjon, on calibre une grille. Aujourd'hui le calibrage est un drapeau (`affichage.calibrage`) ajouté à l'envoi de la salle courante (`regie.js` `affichageTable()`, `js/ecran-table.js` `montrerCalibrage`). Conséquences : rien n'est envoyé à la table tant qu'aucune salle n'est affichée, il est impossible dans un monde, et le premier « Ouvrir la table » ne mène à aucun calibrage.

## Décisions

1. **Le calibrage est un mode de la table**, pas un drapeau de la salle : un message dédié sur le canal (`js/protocole-table.js`), géré par `js/ecran-table.js` / `js/vue-table.js`. Fond uni, grille seule, carte bancaire. Aucun plan ni partie ne passe. Il marche sans présentation, avec un monde comme avec un donjon.
2. **Parcours guidé en quatre étapes** : Orienter (F, rotation, miroir) · Mesurer (carte bancaire, ± au dixième de pixel, case visée en mm) · Vérifier (trois cases et un pion de test) · Terminé (mode « Échelle réelle » choisi). « Annuler » toujours possible.
3. **Premier « Ouvrir la table » sans calibrage enregistré : la fenêtre s'ouvre directement en calibrage**, avec un bandeau dans la régie et « Plus tard ». Le bouton garde une pastille tant que ce n'est pas fait.
4. **Toujours accessible** : entrée « Calibrer l'écran… » dans le menu « Ouvrir la table ▾ » et dans Affichage › Écran de la table, même sans salle ni présentation, même dans un monde (plus de bouton grisé).
5. **Mémorisé pour l'écran** (résolution, rapport de pixels) ; un autre écran redemande le calibrage.
6. **Fin ou annulation** : la table retrouve la même salle, la même case montrée, le même défilement ; un bandeau de la régie rappelle « Calibrage en cours » pendant ce temps.

## À trancher

- L'étape « Vérifier » est-elle utile ou superflue ?
- Sur un seul écran, le parcours vit dans la fenêtre table (les consignes de la régie ne seraient pas visibles en même temps).
- Popover Affichage ou petite fenêtre dédiée pour le parcours.

## Réalisation

1. Protocole : message `calibrage`, mode dans `ecran-table.js` / `vue-table.js`, retrait du drapeau dans `affichageTable()`.
2. Régie : module `calibrage.js` (étapes), sorti de `js/regie-reglages.js` ; fin du grisage dans un monde (`js/regie-univers.js`).
3. Premier lancement : menu « Ouvrir la table », bandeau, pastille.
4. Parcours dans le popover Affichage (reste ouvert pendant le calibrage).
5. Tests : sans présentation, monde, donjon, reprise du contenu, première ouverture, changement d'écran.
6. **Livraison : supprimer ce document et sa maquette** (le code devient la référence).
