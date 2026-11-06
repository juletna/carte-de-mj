/**
 * Le branchement du côté Donjon sur la coquille (lot B).
 *
 * Signature : `inscrireDonjon(coquille, ctx)`, appelée une fois par js/main-mj.js après la création de la coquille et de `ctx`.
 *   coquille : voir js/atelier/coquille.js (arbre.ajouterAction, barreOutils, inspecteur.enregistrer, selectionner, naviguer…)
 *   ctx      : le ctx de main-mj.js (etat, donjon(), salle(), rendre, modifierPlan, historique, activerSalle, afficherSalleActive, …)
 * Elle enregistre les inspecteurs salle, donjon, porte, objet, creature et pion (inspecteurs-donjon.js), range la barre d'outils de la
 * scène (barre-salle.js : Portes, Mobilier, Créatures, pose, salle, vue d'ensemble, annuler), ajoute au menu « + Nouveau » de l'arbre ce que
 * le menu du donjon faisait (nouveau, coller, copies mises de côté ; l'import est commun, js/atelier/importer.js) et tient d'accord la sélection de la carte et celle de l'atelier.
 * Elle expose `ctx.barre` (voir barre-salle.js).
 */
import { enregistrerInspecteursDonjon } from './inspecteurs-donjon.js';
import { creerBarreSalle } from './barre-salle.js';
import { TYPES_ELEMENT } from '../atelier-selection.js';
import { telephone } from '../telephone.js';
import { creerCartouche, cartoucheSalle, cartoucheEnsemble } from './cartouche.js';
import { $ } from '../dom.js';

export function inscrireDonjon(coquille, ctx) {
  const { etat } = ctx;

  enregistrerInspecteursDonjon(coquille, ctx);
  ctx.barre = creerBarreSalle(coquille, ctx);
  // Une seule ligne en haut de la scène : le bouton de l'arbre au début, puis les outils et « Affichage ». Pas de bouton « Jouer » : on joue par l'onglet « Jouer » de la barre de navigation (le lien #presenter reste caché dans la page, son adresse est tenue à jour par menu-donjon.js).
  coquille.barreOutils.prepend($('arbre-bouton'));

  // --- L'arbre : ce que faisait le menu du donjon (le choix du donjon, lui, est l'arbre) -------------------------
  // Sous 760 px la feuille s'ouvre par-dessus la carte : le tiroir de l'arbre se referme d'abord.
  const feuille = (section) => () => { if (telephone()) coquille.fermerTiroir({ rendreFocus: false }); ctx.menu.ouvrir(section); };
  // (L'import d'un fichier est commun au monde et au donjon : js/atelier/importer.js. La feuille garde son propre bouton « Importer un fichier ».)
  coquille.arbre.ajouterAction({ groupe: 'creer', ordre: 2, libelle: 'Donjon…', icone: 'donjon', aide: 'Nouveau donjon : vide, au hasard ou d’un modèle', executer: feuille('nouveau') });
  coquille.arbre.ajouterAction({ groupe: 'apporter', ordre: 2, libelle: 'Coller un donjon…', icone: 'copier', executer: feuille('coller') });
  const copies = ctx.menu.nombreCopies();
  if (copies) coquille.arbre.ajouterAction({ groupe: 'signal', libelle: `Copies mises de côté (${copies})`, icone: 'alerte', executer: feuille('copies') });

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
    ctx.cartouche.maj();
    if (ctx.univers?.ouvert()) return;
    coquille.positionner(etat.plan ? { donjon: etat.actif } : { donjon: etat.actif, salle: ctx.donjon().salleActive });
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  // --- Le cartouche d'échelle : en haut à gauche de la zone de carte (après le catalogue, qui le pousse à droite quand il est ouvert) ---------
  // Une salle : sa taille en cases et en mètres, et l'échelle ; la vue d'ensemble : l'échelle seule. ctx.rendre() le tient à jour (taille, échelle).
  const cartouche = creerCartouche();
  cartouche.element.classList.add('cartouche-donjon');
  $('zone-scene').append(cartouche.element);
  ctx.cartouche = {
    maj() {
      const echelle = etat.reglages.echelle;
      if (etat.plan) { cartouche.definir(cartoucheEnsemble(echelle)); return; }
      const p = ctx.salle()?.plan;
      cartouche.definir(p ? cartoucheSalle(p.largeur, p.longueur, echelle) : null);
    },
  };

  // --- La barre d'outils du Donjon se tait quand le Monde est affiché (il y met ses propres outils) --------------------
  const majBarre = () => ctx.barre.montrer(!ctx.univers?.ouvert());
  ctx.univers?.surChangement(majBarre);
  coquille.surSelection(majBarre);
  majBarre();
  ctx.cartouche.maj();
}
