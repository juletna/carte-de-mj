/**
 * Rapport texte d'une génération, à copier-coller pour signaler un
 * résultat bizarre : description, ce qui a été compris, mots ignorés,
 * et la carte dessinée en caractères.
 */
import { nomAffiche } from './parseur/lexique.js';
import { lettreDe, coucheDe, COUCHE_PAR_DEFAUT } from './catalogue.js';


/** Dessine le plan en caractères ; les portes sont des « D » dans les murs. */
export function carteTexte(plan) {
  const W = plan.largeur, L = plan.longueur;
  const grille = Array.from({ length: L }, () => Array(W).fill('.'));
  const vus = new Set();
  for (const o of plan.objets) {
    const c = lettreDe(o.type) || '?';
    vus.add(o.type);
    for (let x = o.x; x < o.x + o.l; x++) for (let y = o.y; y < o.y + o.h; y++) {
      // Ce qui est accroché au mur (une torche) ne masque pas ce qui est au sol.
      if (grille[y]?.[x] !== undefined && (coucheDe(o.type) <= COUCHE_PAR_DEFAUT || grille[y][x] === '.')) grille[y][x] = c;
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
  const legende = [...vus].map((t) => `${lettreDe(t) || '?'}=${nomAffiche(t)}`);
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
