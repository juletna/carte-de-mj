/**
 * Les sols DESSINÉS du thème peint (réglage « Détails des sols » : riches), un fichier par sol, avec leurs réglages. Un sol absent ou nul ici
 * garde son dessin actuel (sols.js). Même contrat que les sols de sols.js : `fn(X, Y, o, out)`, périodique sur PERIODE (voir outils.js).
 */
import { dalles } from './pierre.js';
import { bois } from './bois.js';
import { marbre } from './marbre.js';
import { glace } from './glace.js';
import { terre } from './terre.js';
import { sable } from './sable.js';
import { herbe } from './herbe.js';

const GRAVIER = [[168, 156, 138], [146, 140, 132], [184, 170, 146]];

const tous = {
  /** Tons clairs et un peu saturés, comme un dessin animé : gris chaud, gris bleu, sable, gris vert, gris rosé. */
  pierre: { fn: dalles, o: { n: 9, s: 3, relief: 1.6, tons: [[172, 164, 150], [156, 162, 170], [182, 168, 142], [158, 164, 148], [170, 160, 154]], joint: [104, 88, 70], gravier: GRAVIER, mousse: true } },
  /** La roche autour de la salle : la même pierre, sombre (elle encadre la salle sans attirer l'œil), sans mousse. */
  roche: { fn: dalles, o: { n: 7, s: 13, relief: 1.4, tons: [[66, 64, 72], [58, 60, 70], [72, 66, 64], [62, 62, 66]], joint: [34, 30, 32], gravier: [[84, 80, 84], [74, 72, 78]], mousse: false } },
  bois: bois && { fn: bois, o: { s: 7 } },
  marbre: marbre && { fn: marbre, o: { s: 5 } },
  glace: glace && { fn: glace, o: { s: 100 } },
  terre: terre && { fn: terre, o: { s: 64 } },
  sable: sable && { fn: sable, o: { s: 80 } },
  herbe: herbe && { fn: herbe, o: { s: 66 } },
};

export const SOLS_DESSINES = Object.fromEntries(Object.entries(tous).filter(([, def]) => def));
