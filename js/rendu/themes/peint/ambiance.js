/**
 * Ambiance et état de la salle pour le thème « peint » : module PUR (aucun DOM), testable sous Node.
 *
 *   ambiance (plan.ambiance : neutre, froide, chaude, nuit)  teinte le sol et les murs (`teinterSol`, `couleurMur`) ; la pénombre a sa propre teinte (rendu/lumiere.js)
 *   état (plan.etat : neuve, usee, ruine)                    l'usure du décor : `usureDe` donne un degré 0, 1 ou 2 que les sols (sols.js), les murs (murs.js)
 *                                                            et les petits détails (details.js) lisent chacun à leur façon
 */

/** Degré d'usure de chaque état : neuve (propre), usée (fissures, un peu de mousse, blocs ébréchés), en ruine (la nature reprend ses droits). */
const USURES = { neuve: 0, usee: 1, ruine: 2 };
/** Le degré d'usure d'un état (0 pour un état absent ou inconnu). */
export const usureDe = (etat) => (Object.hasOwn(USURES, etat) ? USURES[etat] : 0);

/** Facteurs [r, g, b] multipliés sur les couleurs du sol et des murs, et contraste autour de `pivot` (nuit : plus contrasté). */
export const TEINTES = {
  neutre: { f: [1, 1, 1], contraste: 1 },
  froide: { f: [0.89, 0.96, 1.1], contraste: 1 },
  chaude: { f: [1.1, 1, 0.85], contraste: 1 },
  nuit: { f: [0.66, 0.75, 1.02], contraste: 1.16 },
};
const PIVOT = 105;

/** La teinte d'une ambiance (neutre si elle est absente ou inconnue). */
export const teinteDe = (ambiance) => TEINTES[Object.hasOwn(TEINTES, ambiance) ? ambiance : 'neutre'];

/** Teinte une couleur `out` = [r, g, b] (0–255, modifiée sur place) selon l'ambiance. */
export function teinterSol(out, ambiance) {
  if (ambiance === 'neutre' || !Object.hasOwn(TEINTES, ambiance)) return out;
  const { f, contraste } = TEINTES[ambiance];
  for (let i = 0; i < 3; i++) out[i] = (out[i] * f[i] - PIVOT) * contraste + PIVOT;
  return out;
}

/** Teinte, saturation et luminosité (0–100) → [r, g, b] de 0 à 255. */
export function hslEnRgb(h, s, l) {
  const S = s / 100, L = l / 100, a = S * Math.min(L, 1 - L);
  const f = (n) => { const k = (n + h / 30) % 12; return 255 * (L - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); };
  return [f(0), f(8), f(4)];
}

const borne = (v) => Math.round(v < 0 ? 0 : v > 255 ? 255 : v);

/**
 * La couleur CSS d'une pierre de mur de luminosité `l`, teintée par l'ambiance. `mur` : { h, s } (murs.js, selon le sol).
 * Neutre : la couleur du thème telle quelle (`hsl(...)`).
 */
export function couleurMur(mur, l, ambiance) {
  if (ambiance === 'neutre' || !Object.hasOwn(TEINTES, ambiance)) return `hsl(${mur.h} ${mur.s}% ${l}%)`;
  const c = teinterSol(hslEnRgb(mur.h, mur.s, l), ambiance);
  return `rgb(${borne(c[0])},${borne(c[1])},${borne(c[2])})`;
}

/**
 * Densités des petits détails semés (details.js) : probabilité, pour une case libre, de recevoir chaque sorte de détail.
 * Une salle neuve n'en a aucun ; les os et les toiles d'araignée sont pour les salles froides ou de nuit (un peu de toile ailleurs, en ruine).
 * @param {string} etat  neuve, usee, ruine
 * @param {string} ambiance
 * @param {string} sol
 * @returns {{caillou:number, mousse:number, feuille:number, touffe:number, os:number, toile:number}}
 */
export function densites(etat, ambiance, sol) {
  const usure = usureDe(etat);
  if (!usure) return { caillou: 0, mousse: 0, feuille: 0, touffe: 0, os: 0, toile: 0 };
  const sombre = ambiance === 'froide' || ambiance === 'nuit';
  const pierreux = sol !== 'herbe' && sol !== 'glace' && sol !== 'sable';
  return usure === 1
    ? { caillou: 0.06, mousse: pierreux ? 0.035 : 0, feuille: sol === 'herbe' ? 0.03 : 0.008, touffe: 0, os: sombre ? 0.018 : 0, toile: sombre ? 0.7 : 0 }
    : { caillou: 0.11, mousse: pierreux ? 0.08 : 0.02, feuille: 0.08, touffe: sol === 'glace' ? 0 : 0.35, os: sombre ? 0.035 : 0.004, toile: sombre ? 0.9 : 0.25 };
}
