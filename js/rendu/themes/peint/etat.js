/**
 * L'état du thème « peint » pendant qu'une salle est dessinée. Le contrat d'un thème (vectoriel.js) ne donne aux dessins d'objets ni le plan ni
 * le centre de la salle ; or la fausse 3D a besoin du centre (perspective.js). `preparer`, appelé par le moteur avant de dessiner une salle
 * (moteur.js : `peindre`), remplit cet état ; les dessins du thème le lisent. Un seul dessin à la fois : le rendu est synchrone.
 *
 * Champs :
 *   vue      { cx, cy, kp, lum } de la salle (perspective.js), dans le repère de la salle
 *   base     matrice du contexte dans le repère de la salle (pour passer au repère local d'un objet : `volumesLocaux`)
 *   dpr      densité de pixels (les ombres portées du Canvas se règlent en pixels physiques)
 *   graine   nombre dérivé de l'identifiant de la salle : tout aléa du décor en est tiré (même salle, même rendu, partout)
 *   relief   la perspective est-elle active ? (kp > 0)
 *   ambiance, etatSalle   neutre/froide/chaude/nuit et neuve/usee/ruine : champs du plan prévus pour le lot 4, valeurs neutres d'ici là
 */
import { IDENTITE } from '../../perspective.js';

export const etat = {
  vue: { cx: 0, cy: 0, kp: 0, lum: [-0.6, -0.8] },
  base: IDENTITE,
  dpr: 1,
  graine: 0,
  relief: false,
  ambiance: 'neutre',
  etatSalle: 'neuve',
  plan: null,
  t: 48,
};
