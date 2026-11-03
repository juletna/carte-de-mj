/**
 * Lexique du parseur : le vocabulaire (mots reconnus, adjectifs, mots vides, noms de pièces) et l'index qui retrouve un type
 * par un de ses mots. Les types eux-mêmes (leurs mots, leur taille, leur nom, leur genre…) sont décrits dans catalogue.js :
 * c'est là qu'on ajoute un nouvel objet.
 */
import { OBJETS, CREATURES, OUVERTURES, nomDe } from '../catalogue.js';

/** Couleurs reconnues après une créature (« un dragon rouge »). */
export const COULEURS = {
  rouge: '#c0392b', bleu: '#2e6fd1', vert: '#2f8f46', noir: '#222222', blanc: '#e8e8e8',
  or: '#d9a929', dore: '#d9a929', argent: '#b8bec6', argente: '#b8bec6',
  bronze: '#a46628', cuivre: '#b8733a', airain: '#9c7a3c', violet: '#7b3fa0', gris: '#7a7a7a',
};

/** Adjectifs qui changent le camp d'une créature (« un nain hostile »). */
export const CAMPS = {
  hostile: 'monstre', hostiles: 'monstre', ennemi: 'monstre', ennemis: 'monstre', ennemie: 'monstre', ennemies: 'monstre',
  allie: 'pnj', allies: 'pnj', alliee: 'pnj', alliees: 'pnj', amical: 'pnj', amicaux: 'pnj', neutre: 'pnj', neutres: 'pnj',
};

/** Préfixes de taille pour les créatures (« un jeune dragon », « un rat géant »). */
export const TAILLES_CREATURE = { jeune: -1, petit: -1, petite: -1, bebe: -2, ancien: 1, ancienne: 1, vieux: 0, geant: 1, geante: 1, gigantesque: 1 };

/** Les portes ne sont pas des objets : elles vont dans plan.portes. Mot reconnu → type (voir OUVERTURES dans catalogue.js). */
export const PORTES = Object.fromEntries(OUVERTURES.flatMap((d) => d.mots.map((mot) => [mot, d.type])));

/**
 * Adjectifs qui rendent un élément secret (« un coffre caché », « une porte secrète »),
 * sans accents comme le texte normalisé. Ils produisent `cache: true` dans le plan.
 */
export const ADJ_CACHE = new Set(['cache', 'cachee', 'caches', 'cachees', 'secret', 'secrete', 'secrets', 'secretes']);

/** Adjectifs qui agrandissent un objet d'une case (« une grande table »). */
export const ADJ_GRAND = new Set(['grand', 'grande', 'grands', 'grandes', 'large', 'larges', 'immense', 'immenses', 'enorme', 'enormes']);

/**
 * Noms de pièces : « salle du trône » nomme la pièce (index.js), ces mots ne sont jamais des objets à poser.
 * Les autres listes de pièces du parseur en sont tirées : PIECES_A_TAILLE ci-dessous, et les mots vides.
 */
export const PIECES = [
  'salle', 'chambre', 'crypte', 'piece', 'caverne', 'grotte', 'hall', 'cellule', 'prison', 'taverne', 'auberge', 'temple', 'chapelle', 'cuisine', 'cave',
];

/** Parmi PIECES, celles dont la taille se dit en un mot (« grande salle », « vaste crypte » : dimensions.js). */
export const PIECES_A_TAILLE = ['salle', 'piece', 'chambre', 'caverne', 'grotte', 'crypte', 'hall'];

/**
 * Mots sans information pour le parseur : ils ne sont pas signalés
 * comme « non compris ». Y figurent tous les noms de pièces (PIECES), leur pluriel et d'autres lieux.
 */
export const MOTS_VIDES = new Set([...PIECES, ...(
  'le la les l un une des de du d en au aux a et ou avec sur sous dans par pour il y ' +
  'qui que qu est sont se trouve trouvent fait font mesure mesurant ce cette ces son sa ses leur leurs ' +
  'salles pieces couloir donjon ici on voit contre cellier bureau laboratoire armurerie tresor ' +
  'pose posee poses posees place placee places placees situe situee situes situees range rangee ranges ' +
  'mur murs sol cote cotes pres proche juste bien tout toute tous toutes chaque meme aussi ' +
  'grand grande grands grandes petit petite petits petites moyen moyenne vaste immense enorme long longue ' +
  'large m metre metres case cases carreau carreaux environ'
).split(' ')]);

// Zone par défaut d'une créature selon son camp.
const ZONE_CAMP = { pj: 'entree', pnj: 'centre', monstre: 'centre' };

// Index mot → entrée, construit une seule fois.
// Les expressions de plusieurs mots (« loup garou ») sont indexées avec des « _ ».
const INDEX = new Map();
const EXPRESSIONS = [];
const indexer = (mot, entree) => {
  if (mot.includes(' ')) EXPRESSIONS.push(mot);
  INDEX.set(mot.replace(/ /g, '_'), entree);
};
for (const def of OBJETS) for (const mot of def.mots) indexer(mot, { genre: 'objet', ...def });
for (const def of CREATURES) {
  for (const mot of def.mots) indexer(mot, { genre: 'creature', l: def.taille, h: def.taille, zone: ZONE_CAMP[def.camp], ...def });
}
for (const [mot, type] of Object.entries(PORTES)) indexer(mot, { genre: 'porte', type, l: 1, h: 1 });

// « loups garous » → « loups_garous » (chaque mot peut porter la marque du pluriel).
const RE_EXPRESSIONS = EXPRESSIONS.map((e) => [
  new RegExp(`\\b${e.split(' ').map((m) => `${m}[sx]?`).join(' ')}\\b`, 'g'),
  e,
]);

/** Soude les expressions de plusieurs mots du lexique pour qu'elles forment un seul mot. */
export function souderExpressions(texte) {
  let t = texte;
  for (const [re, e] of RE_EXPRESSIONS) {
    t = t.replace(re, (m) => (/[sx]$/.test(m) && !/[sx]$/.test(e) ? `${e.replace(/ /g, '_')}s` : e.replace(/ /g, '_')));
  }
  return t;
}

/**
 * Reconnaît un mot du lexique, au singulier ou au pluriel.
 * @returns {{def: object, pluriel: boolean} | null}
 */
export function trouverObjet(mot) {
  if (!mot) return null;
  if (INDEX.has(mot)) return { def: INDEX.get(mot), pluriel: false };
  const singulier = mot.replace(/[sx]$/, '');
  if (singulier !== mot && INDEX.has(singulier)) return { def: INDEX.get(singulier), pluriel: true };
  return null;
}

/** Définition d'un type d'objet (pour le placement et la validation). */
export function definition(type) {
  const objet = OBJETS.find((d) => d.type === type);
  if (objet) return { genre: 'objet', ...objet };
  const creature = CREATURES.find((d) => d.type === type);
  if (creature) return { genre: 'creature', l: creature.taille, h: creature.taille, zone: ZONE_CAMP[creature.camp], ...creature };
  return null;
}

/** Mots du lexique qui ne sont pas un type mais s'écrivent avec un accent (« salle du fut » → « fût »). */
const MOTS_ACCENTES = new Map([['fut', 'fût']]);

/** Nom lisible d'un type ou d'un mot, pour les messages (« bibliotheque » → « bibliothèque »), au pluriel si n > 1. */
export function nomAffiche(type, n = 1) {
  const nom = MOTS_ACCENTES.get(type) ?? nomDe(type);
  if (n <= 1 || /[sx]$/.test(nom)) return nom;
  return nom.endsWith('eau') ? nom + 'x' : nom + 's';
}
