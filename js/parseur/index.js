/**
 * Parseur local à règles : description en français → plan JSON.
 *
 * Étapes :
 *   1. normalisation (minuscules, accents, ponctuation) et nombres en chiffres
 *   2. dimensions de la pièce et nature du sol
 *   3. découpage en propositions (« , », « . », « et », « avec »…)
 *   4. dans chaque proposition : objets + quantité + position → « intentions »
 *   5. placement des intentions sur la grille (placement.js)
 *
 * Le parseur ne devine pas : ce qu'il ne comprend pas est renvoyé dans
 * `ignores` pour être affiché au MJ.
 */
import { normaliser } from './normaliser.js';
import { convertirNombres } from './nombres.js';
import { extraireDimensions, extraireSol, extraireForme } from './dimensions.js';
import {
  trouverObjet, definition, nomAffiche, souderExpressions,
  ADJ_GRAND, ADJ_CACHE, MOTS_VIDES, COULEURS, CAMPS, TAILLES_CREATURE,
} from './lexique.js';
import { analyserPosition } from './positions.js';
import { construirePlan } from './placement.js';

// Quantité retenue pour un pluriel sans nombre (« des torches »), selon la zone par défaut.
const QUANTITE_PLURIEL = { grille: 4, perimetre: 4, aleatoire: 5 };

/**
 * « salle du trône », « salle des gardes » : c'est le NOM de la pièce,
 * pas un objet à poser. On le retire du texte.
 *
 * Avec un simple « de » (« salle de garde », « crypte de vampire »), le mot suivant n'est un nom
 * de pièce que s'il est du lexique ET que le groupe ouvre la phrase : « une salle avec un garde »
 * et « deux gardes » créent toujours leurs pions, et « salle de 6 par 6 » n'est pas un nom.
 */
const PIECES = 'salle|chambre|crypte|piece|caverne|grotte|hall|cellule|prison|taverne|auberge|temple|chapelle|cuisine|cave';
const RE_NOM = new RegExp(`\\b(${PIECES})\\s+(du|des|de la|de l)\\s+([a-z]+)`);
const RE_NOM_DE = new RegExp(`\\b(${PIECES})\\s+(de|d)\\s+([a-z]+)`, 'g');
const DEBUT_DE_PHRASE = /^(?:(?:une?|la|cette|grande?|petite?|vaste)\s+)*$/;
function extraireNom(texte) {
  let m = texte.match(RE_NOM);
  let cherche = m;
  if (!m) {
    for (const c of texte.matchAll(RE_NOM_DE)) {
      const avant = texte.slice(0, c.index).split(/[.;:!?,]/).pop();
      if (DEBUT_DE_PHRASE.test(avant) && trouverObjet(c[3])) { m = c; break; }
    }
  }
  if (!m) return { nom: null, reste: texte };
  return { nom: `${m[1]} ${m[2]} ${nomAffiche(m[3])}`, reste: texte.replace(m[0], m[1]) };
}

/** Découpe le texte en propositions indépendantes. */
export function decouper(texte) {
  return texte
    .replace(/de part et d autre/g, 'de_part_d_autre')
    .split(/[;:!?,]|\.(?!\d)|\b(?:et|avec|ainsi que|puis|plus loin)\b/)
    .map((s) => s.replace(/de_part_d_autre/g, 'de part et d autre').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** Petit hachage pour une graine stable (même phrase → mêmes débris). */
function hacher(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Analyse une proposition et ajoute ses intentions à la liste. */
export function analyserProposition(prop, intentions, ignores) {
  const mots = prop.split(' ');
  const position = analyserPosition(prop);
  const utilises = new Set(position.indices);

  for (let i = 0; i < mots.length; i++) {
    if (utilises.has(i)) continue; // déjà lu comme adjectif d'un mot précédent (« rat géant »)
    const trouve = trouverObjet(mots[i]);
    if (!trouve) continue;
    utilises.add(i);
    if (position.cible && position.cible.index === i) continue; // c'est le repère, pas un nouvel objet
    const creature = trouve.def.genre === 'creature';

    // Quantité et taille : on regarde jusqu'à 3 mots en arrière (« deux grands coffres »).
    let n = null, taille = 0, cache = false;
    for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
      if (trouverObjet(mots[j]) && !utilises.has(j)) break;
      if (ADJ_CACHE.has(mots[j])) { cache = true; utilises.add(j); continue; }
      if (/^\d+(\.\d+)?$/.test(mots[j])) { n = Math.max(1, Math.round(parseFloat(mots[j]))); utilises.add(j); break; }
      if (ADJ_GRAND.has(mots[j])) { taille = 1; utilises.add(j); }
      if (creature && mots[j] in TAILLES_CREATURE) { taille += TAILLES_CREATURE[mots[j]]; utilises.add(j); }
    }

    // Adjectifs après le nom : taille, couleur, camp (« deux dragons rouges hostiles »).
    let couleur = null, camp = creature ? trouve.def.camp : null;
    for (let j = i + 1; j <= i + 3 && j < mots.length; j++) {
      const m = mots[j], sing = m.replace(/s$/, '');
      if (ADJ_GRAND.has(m)) { taille = 1; utilises.add(j); continue; }
      if (ADJ_CACHE.has(m)) { cache = true; utilises.add(j); continue; }
      if (!creature) break;
      if (m in TAILLES_CREATURE) { taille += TAILLES_CREATURE[m]; utilises.add(j); continue; }
      if (COULEURS[m] || COULEURS[sing]) { couleur = m in COULEURS ? m : sing; utilises.add(j); continue; }
      if (m in CAMPS) { camp = CAMPS[m]; utilises.add(j); continue; }
      break;
    }

    // « des piliers » sans nombre : on choisit une quantité selon le type.
    const pluriel = trouve.pluriel || ['des', 'les'].includes(mots[i - 1]);
    const parDefaut = creature ? (trouve.def.camp === 'pj' ? 4 : 3) : QUANTITE_PLURIEL[trouve.def.zone] || 2;
    if (n === null) n = pluriel ? parDefaut : 1;
    n = Math.min(n, 40);

    const intention = { genre: trouve.def.genre, type: trouve.def.type, n, taille, position };
    if (creature) Object.assign(intention, { camp, couleur });
    if (cache) intention.cache = true;
    intentions.push(intention);
  }

  mots.forEach((m, i) => {
    if (!utilises.has(i) && !MOTS_VIDES.has(m) && !/^\d/.test(m) && m.length > 1) ignores.push(m);
  });
}

/**
 * @param {string} texte description du MJ
 * @param {{echelle?: number, entree?: string}} options echelle = mètres par case (1,5 par défaut) ; entree = mur d'entrée imposé
 * @returns {{plan: object, compris: string[], ignores: string[]}}
 */
export function analyser(texte, options = {}) {
  const echelle = options.echelle || 1.5;
  const t = souderExpressions(convertirNombres(normaliser(texte)));
  const nom = extraireNom(t);

  const forme = extraireForme(nom.reste);
  const dims = extraireDimensions(forme.reste, echelle);
  const sol = extraireSol(dims.reste);

  const intentions = [];
  const ignores = [];
  for (const prop of decouper(sol.reste)) analyserProposition(prop, intentions, ignores);

  // Un objet ou une créature cité seulement comme repère (« de chaque côté du trône ») est créé.
  for (const it of [...intentions]) {
    const c = it.position.cible;
    if (c && c.genre !== 'porte' && !intentions.some((i) => i.type === c.type && i.position !== it.position)) {
      const def = definition(c.type);
      intentions.push({ genre: def.genre, type: c.type, n: 1, taille: 0, camp: def.camp, couleur: null, position: { zone: null, indices: [] } });
    }
  }

  const { plan, journal } = construirePlan({
    largeur: dims.largeur, longueur: dims.longueur, sol: sol.valeur, forme: forme.champs, intentions, graine: hacher(t), entree: options.entree,
  });

  if (nom.nom) plan.nom = nom.nom.charAt(0).toUpperCase() + nom.nom.slice(1);
  const compris = [...(nom.nom ? [`nom : ${plan.nom}`] : []), ...dims.compris, ...forme.compris];
  if (sol.valeur !== 'pierre') compris.push(`sol : ${sol.valeur}`);
  compris.push(...journal);
  return { plan, compris, ignores: [...new Set(ignores)] };
}

export { definition };
