/**
 * Les murs d'une salle comme SEGMENTS continus, pour les dessiner en perspective : module PUR (aucun DOM), testable sous Node.
 * formes.js donne un tronçon par côté de case qui donne sur le vide ; ici, les tronçons alignés et contigus sont fondus en un seul
 * segment (les briques courent d'un bout à l'autre du mur, sans joint à chaque case).
 */
import { troncons } from '../../../formes.js';

/** Normale d'un mur, côté pièce (vers l'intérieur de la salle). */
export const NORMALES = { nord: [0, 1], sud: [0, -1], ouest: [1, 0], est: [-1, 0] };

/**
 * Les segments de mur d'une salle, en cases (origine : coin nord-ouest de la pièce).
 * @returns {Array<{mur:string, horizontal:boolean, a:number[], b:number[], normale:number[], avant:boolean, apres:boolean}>}
 *   `a` → `b` dans le sens des coordonnées croissantes ; `avant`/`apres` : le bout est un coin sortant (le mur y tourne vers l'extérieur).
 */
export function segmentsDeMurs(plan) {
  const parLigne = new Map();
  for (const c of troncons(plan)) {
    const horizontal = c.mur === 'nord' || c.mur === 'sud';
    const ligne = horizontal ? (c.mur === 'nord' ? c.y : c.y + 1) : (c.mur === 'ouest' ? c.x : c.x + 1);
    const cle = `${c.mur}|${ligne}`;
    if (!parLigne.has(cle)) parLigne.set(cle, { mur: c.mur, horizontal, ligne, liste: [] });
    parLigne.get(cle).liste.push({ pos: horizontal ? c.x : c.y, avant: c.avant, apres: c.apres });
  }
  const segments = [];
  for (const { mur, horizontal, ligne, liste } of parLigne.values()) {
    liste.sort((p, q) => p.pos - q.pos);
    let debut = liste[0], fin = liste[0];
    const clore = () => {
      const p0 = debut.pos, p1 = fin.pos + 1;
      segments.push({
        mur, horizontal, a: horizontal ? [p0, ligne] : [ligne, p0], b: horizontal ? [p1, ligne] : [ligne, p1],
        normale: NORMALES[mur], avant: debut.avant, apres: fin.apres,
      });
    };
    for (let i = 1; i < liste.length; i++) {
      if (liste[i].pos === fin.pos + 1) fin = liste[i];
      else { clore(); debut = fin = liste[i]; }
    }
    clore();
  }
  return segments;
}
