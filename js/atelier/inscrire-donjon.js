/**
 * Le branchement du côté Donjon sur la coquille (lot B). Vide pour l'instant : l'ancien rail et l'ancien panneau restent branchés.
 *
 * Signature attendue : `inscrireDonjon(coquille, ctx)`, appelée une fois par js/main-mj.js après la création de la coquille et de `ctx`.
 *   coquille : voir js/atelier/coquille.js (arbre.ajouterAction, barreOutils, inspecteur.enregistrer, selectionner, naviguer…)
 *   ctx      : le ctx de main-mj.js (etat, donjon(), salle(), rendre, modifierPlan, historique, activerSalle, afficherSalleActive, …)
 * Elle enregistre les inspecteurs salle, porte, objet, creature, pion et donjon, remplit la barre d'outils (Portes, Mobilier, Créatures) et
 * ajoute au « ⋯ » de l'arbre ce que le menu du donjon faisait (nouveau, hasard, modèle, importer, coller, copies de côté).
 */
export function inscrireDonjon(/* coquille, ctx */) {}
