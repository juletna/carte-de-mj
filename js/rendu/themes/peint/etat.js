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
 *   lumieres sources de lumière relevées pendant le dessin des objets, vidées par `preparer` : { x, y, s, r, c, k, petite? } en pixels, dans le repère de la
 *            salle (origine : coin nord-ouest de la pièce) ; s = taille de la flamme, r = rayon de la lumière, c = 'r,g,b', k = intensité (0–1).
 *            Un objet les déclare avec `V.lumiere(x, y, h, source)` (volumes.js) ; la couche de lumière (lumiere.js) les lit après avoir dessiné les objets.
 *   flammesAnimees  vrai quand la couche de lumière dessine elle-même les flammes (lumiere.js, vue table animée) : les objets ne dessinent alors plus leur petite flamme fixe ;
 *            posé par `preparer` (option `flammes`) à chaque dessin
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
  lumieres: [],
  flammesAnimees: false,
};
