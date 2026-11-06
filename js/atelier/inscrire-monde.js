/**
 * Le branchement du côté Monde sur la coquille (lot C). Vide pour l'instant : l'écran Monde (#univers) reste branché.
 *
 * Signature attendue : `inscrireMonde(coquille, ctx)`, appelée une fois par js/main-mj.js après la création de la coquille et de `ctx`.
 *   coquille : voir js/atelier/coquille.js (arbre.ajouterAction, barreOutils, inspecteur.enregistrer, selectionner, naviguer…)
 *   ctx      : le ctx de main-mj.js ; `ctx.univers` donne `donnees()`, `lieu()`, `allerALieu(id)` et `surChangement(f)` (js/mj/univers-ui.js)
 * Elle enregistre les inspecteurs monde, lieu et point, remplit la barre d'outils (Sélection, Point, Grille) et ajoute au « ⋯ » de
 * l'arbre ce qui crée un lieu ou un monde.
 */
export function inscrireMonde(/* coquille, ctx */) {}
