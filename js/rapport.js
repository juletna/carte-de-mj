/**
 * Rapport texte d'une génération, à copier-coller pour signaler un
 * résultat bizarre : description, ce qui a été compris, mots ignorés,
 * et la carte dessinée en caractères.
 */
import { nomAffiche } from './parseur/lexique.js';

// Une lettre par type d'objet pour la carte texte.
const LETTRES = {
  pilier: 'P', colonne: 'C', coffre: 'K', statue: 'S', table: 'T', chaise: 'h', autel: 'A',
  trone: 'R', tonneau: 'O', caisse: 'X', escalier: 'E', fosse: 'F', lit: 'L', bibliotheque: 'B',
  torche: '*', debris: '%', puits: 'U', fontaine: 'W', sarcophage: 'Z',
};

/** Dessine le plan en caractères ; les portes sont des « D » dans les murs. */
export function carteTexte(plan) {
  const W = plan.largeur, L = plan.longueur;
  const grille = Array.from({ length: L }, () => Array(W).fill('.'));
  const vus = new Set();
  for (const o of plan.objets) {
    const c = LETTRES[o.type] || '?';
    vus.add(o.type);
    for (let x = o.x; x < o.x + o.l; x++) for (let y = o.y; y < o.y + o.h; y++) {
      // Une torche est accrochée au mur : elle ne masque pas ce qui est au sol.
      if (grille[y]?.[x] !== undefined && (o.type !== 'torche' || grille[y][x] === '.')) grille[y][x] = c;
    }
  }
  // Créatures : chiffre de leur numéro pour les PJ (1, 2…), initiale en minuscule pour les autres.
  const legendeCreatures = new Map();
  for (const k of plan.creatures || []) {
    const c = k.camp === 'pj' ? String(k.numero % 10) : k.type[0];
    legendeCreatures.set(k.camp === 'pj' ? 'chiffres=personnages' : `${c}=${nomAffiche(k.type)}`, true);
    for (let x = k.x; x < k.x + k.taille; x++) for (let y = k.y; y < k.y + k.taille; y++) if (grille[y]?.[x] !== undefined) grille[y][x] = c;
  }
  const nord = Array(W).fill('─'), sud = Array(W).fill('─');
  const ouest = Array(L).fill('│'), est = Array(L).fill('│');
  for (const p of plan.portes) ({ nord, sud, ouest, est })[p.mur][p.position] = 'D';

  const lignes = [`┌${nord.join('')}┐`];
  grille.forEach((rang, y) => lignes.push(`${ouest[y]}${rang.join('')}${est[y]}`));
  lignes.push(`└${sud.join('')}┘`);
  const legende = [...vus].map((t) => `${LETTRES[t] || '?'}=${nomAffiche(t)}`);
  legende.push(...legendeCreatures.keys());
  if (plan.portes.length) legende.push('D=porte');
  return `${lignes.join('\n')}\n${legende.join('  ')}`;
}

/**
 * @param {{texte:string, compris:string[], ignores:string[], plan:object}} donnees
 */
export function rapport({ texte, compris, ignores, plan }) {
  return [
    `Description : ${texte.trim()}`,
    '',
    'Compris :',
    ...compris.map((c) => `- ${c}`),
    '',
    `Mots non compris : ${ignores.length ? ignores.join(', ') : '(aucun)'}`,
    '',
    'Carte (nord en haut) :',
    carteTexte(plan),
  ].join('\n');
}
