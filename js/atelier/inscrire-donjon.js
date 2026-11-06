/**
 * Le branchement du côté Donjon sur la coquille (lot B).
 *
 * Signature : `inscrireDonjon(coquille, ctx)`, appelée une fois par js/main-mj.js après la création de la coquille et de `ctx`.
 *   coquille : voir js/atelier/coquille.js (arbre.ajouterAction, barreOutils, inspecteur.enregistrer, selectionner, naviguer…)
 *   ctx      : le ctx de main-mj.js (etat, donjon(), salle(), rendre, modifierPlan, historique, activerSalle, afficherSalleActive, …)
 * Elle enregistre les inspecteurs salle, donjon, porte, objet, creature et pion (inspecteurs-donjon.js), range la barre d'outils de la
 * scène (barre-salle.js : Portes, Mobilier, Créatures, pose, salle, vue d'ensemble, annuler), ajoute au « ⋯ » de l'arbre ce que le menu
 * du donjon faisait (nouveau, importer, coller, copies mises de côté) et tient d'accord la sélection de la carte et celle de l'atelier.
 * Elle expose `ctx.barre` (voir barre-salle.js).
 */
import { enregistrerInspecteursDonjon } from './inspecteurs-donjon.js';
import { creerBarreSalle } from './barre-salle.js';
import { TYPES_ELEMENT } from '../atelier-selection.js';
import { telephone } from '../telephone.js';

export function inscrireDonjon(coquille, ctx) {
  const { etat } = ctx;

  enregistrerInspecteursDonjon(coquille, ctx);
  ctx.barre = creerBarreSalle(coquille, ctx);

  // --- L'arbre : ce que faisait le menu du donjon (le choix du donjon, lui, est l'arbre) -------------------------
  // Sous 760 px la feuille s'ouvre par-dessus la carte : le tiroir de l'arbre se referme d'abord.
  const feuille = (section) => () => { if (telephone()) coquille.fermerTiroir({ rendreFocus: false }); ctx.menu.ouvrir(section); };
  coquille.arbre.ajouterAction({ libelle: 'Nouveau donjon…', icone: 'plus', executer: feuille('nouveau') });
  coquille.arbre.ajouterAction({ libelle: 'Importer un donjon…', icone: 'importer', executer: feuille('importer') });
  coquille.arbre.ajouterAction({ libelle: 'Coller un donjon…', icone: 'copier', executer: feuille('coller') });
  const copies = ctx.menu.nombreCopies();
  if (copies) coquille.arbre.ajouterAction({ libelle: `Copies mises de côté (${copies})`, icone: 'alerte', executer: feuille('copies') });

  // --- Sélection : la carte (descripteur de donjon.js) et l'atelier restent d'accord -------------------------------
  // La carte pose `etat.selection` puis appelle `ctx.bulle.maj()`, qui met la sélection commune à jour (js/mj/bulle.js). Dans l'autre
  // sens : dès que la sélection commune n'est plus un élément (clic dans l'arbre, salle choisie), la carte oublie le sien.
  coquille.surSelection((sel) => {
    if ((sel && TYPES_ELEMENT.includes(sel.type)) || !etat.selection) return;
    ctx.deselectionner();
    ctx.carte.redessiner(ctx.salle().plan);
  });

  // --- Vue d'ensemble : le nœud « donjon » de l'arbre (sans salle) est la vue d'ensemble, le nœud d'une salle la salle ----------
  // vue-plan.js pose la classe `vue-plan` sur <body> en ouvrant ou en fermant la vue : l'arbre et l'inspecteur la suivent.
  let planAffiche = etat.plan;
  new MutationObserver(() => {
    if (etat.plan === planAffiche) return;
    planAffiche = etat.plan;
    if (ctx.univers?.ouvert()) return;
    coquille.positionner(etat.plan ? { donjon: etat.actif } : { donjon: etat.actif, salle: ctx.donjon().salleActive });
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  // --- La barre d'outils du Donjon se tait quand le Monde est affiché (il y met ses propres outils) --------------------
  const majBarre = () => ctx.barre.montrer(!ctx.univers?.ouvert());
  ctx.univers?.surChangement(majBarre);
  coquille.surSelection(majBarre);
  majBarre();
}
