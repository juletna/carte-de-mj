/**
 * Extraction des dimensions de la pièce et de la nature du sol.
 * Chaque fonction renvoie la valeur trouvée ET le texte restant
 * (le passage reconnu est retiré pour ne pas être relu ensuite).
 */

const NB = '(\\d+(?:\\.\\d+)?)';
const UNITE = '(?:\\s+(m|metres?|cases?|carreaux?))?';

const RE_PAR = new RegExp(`${NB}${UNITE}\\s+(?:de (?:large|largeur|long|longueur)\\s+)?(?:par|sur|fois)\\s+${NB}${UNITE}`);
const RE_CARRE = [
  new RegExp(`carree?s?\\s+de\\s+${NB}${UNITE}(?:\\s+de cote)?`),
  new RegExp(`${NB}${UNITE}\\s+de cote`),
];
const RE_LARGE = new RegExp(`${NB}${UNITE}\\s+de\\s+(?:large|largeur)`);
const RE_LONG = new RegExp(`${NB}${UNITE}\\s+de\\s+(?:long|longueur|profondeur|profond)`);

// Tailles « à la louche » quand aucune mesure n'est donnée (en cases).
const TAILLES = {
  minuscule: [3, 3], petit: [4, 4], petite: [4, 4], moyen: [6, 6], moyenne: [6, 6],
  grand: [8, 10], grande: [8, 10], vaste: [10, 12], immense: [12, 16], enorme: [12, 16], gigantesque: [16, 20],
};
const RE_TAILLE = /\b(minuscule|petite?|moyenne?|grande?|vaste|immense|enorme|gigantesque)\s+(?:\w+\s+)?(?:salle|piece|chambre|caverne|grotte|crypte|hall)\b/;
const TAILLE_DEFAUT = [6, 6];
const MAX_CASES = 60;

/** Convertit une mesure en nombre de cases (arrondi au plus proche, au moins 1). */
function enCases(valeur, unite, echelle) {
  const v = parseFloat(valeur);
  const cases = unite && /^c/.test(unite) ? v : v / echelle;
  return Math.min(MAX_CASES, Math.max(1, Math.round(cases)));
}

const fmt = (n) => String(Math.round(n * 100) / 100).replace('.', ',');

/**
 * @param {string} texte   texte normalisé, nombres convertis
 * @param {number} echelle mètres par case
 * @returns {{largeur:number, longueur:number, reste:string, compris:string[]}}
 */
export function extraireDimensions(texte, echelle) {
  let t = texte
    .replace(/(\d+) (m|metres?) et demi\b/g, (_, n, u) => `${Number(n) + 0.5} ${u}`)
    .replace(/(\d+) (?:m|metres?) (\d{2})\b/g, '$1.$2 m'); // 1 m 50 → 1.50 m

  let largeur = null, longueur = null, unites = null;
  let m;

  if ((m = t.match(RE_PAR))) {
    const unite = m[2] || m[4] || 'm';
    largeur = enCases(m[1], m[2] || unite, echelle);
    longueur = enCases(m[3], m[4] || unite, echelle);
    unites = /^c/.test(unite) ? 'cases' : 'm';
    t = t.replace(m[0], ' ');
  } else if ((m = RE_CARRE.map((re) => t.match(re)).find(Boolean))) {
    largeur = longueur = enCases(m[1], m[2], echelle);
    unites = m[2] && /^c/.test(m[2]) ? 'cases' : 'm';
    t = t.replace(m[0], ' ');
  } else {
    const ml = t.match(RE_LARGE), mL = t.match(RE_LONG);
    if (ml || mL) {
      if (ml) { largeur = enCases(ml[1], ml[2], echelle); t = t.replace(ml[0], ' '); }
      if (mL) { longueur = enCases(mL[1], mL[2], echelle); t = t.replace(mL[0], ' '); }
      largeur ??= longueur; longueur ??= largeur;
      unites = 'm';
    }
  }

  const compris = [];
  if (largeur) {
    compris.push(`pièce de ${largeur} × ${longueur} cases (${fmt(largeur * echelle)} × ${fmt(longueur * echelle)} m)`);
  } else if ((m = t.match(RE_TAILLE))) {
    [largeur, longueur] = TAILLES[m[1]];
    compris.push(`${m[1]} pièce → ${largeur} × ${longueur} cases`);
  } else if (/\blong(?:ue)? couloir\b|\bcouloir\s+long/.test(t)) {
    [largeur, longueur] = [2, 14];
    compris.push(`long couloir → 2 × 14 cases`);
  } else if (/\bcouloir\b/.test(t)) {
    [largeur, longueur] = [2, 10];
    compris.push(`couloir → 2 × 10 cases`);
  } else {
    [largeur, longueur] = TAILLE_DEFAUT;
    compris.push(`pas de dimensions : ${largeur} × ${longueur} cases par défaut`);
  }

  return { largeur, longueur, unites, reste: t.replace(/\s+/g, ' ').trim(), compris };
}

// « en L » n'est une forme que suivi de la fin de la phrase ou des dimensions : « suspendu en l air » n'en est pas une.
const RE_FORME = /\b(?:en forme de |en )(croix|octogone|(?:l|t|u)(?= *(?:$|[,.;]| de \d| par )))|\b(cruciforme|octogonale?)\b/;
const NOMS_FORMES = { croix: 'croix', octogone: 'octogone', l: 'L', t: 'T', u: 'U', cruciforme: 'croix', octogonal: 'octogone', octogonale: 'octogone' };
const RE_BRAS = /\b(?:bras|pans?) de (\d+)(?: cases?)?/;
const RE_POSITION = {
  croix: [/\bbras (?:en |au |vers le )?(haut|milieu|bas)\b/, (m) => m[1]],
  T: [/\bbarre au (nord|sud|est|ouest)\b/, (m) => m[1]],
  U: [/\bouverte? au (nord|sud|est|ouest)\b/, (m) => m[1]],
  L: [/\bangle au (nord|sud) (est|ouest)\b/, (m) => `${m[1]}-${m[2]}`],
};

/**
 * Forme de la salle : « en croix », « en U ouvert au sud », « bras de 2 cases »… (voir formes.js)
 * @returns {{champs:object, reste:string, compris:string[]}}  champs : { forme, bras?, position? } ; vide pour un rectangle
 */
export function extraireForme(texte) {
  const m = texte.match(RE_FORME);
  if (!m) return { champs: {}, reste: texte, compris: [] };
  const forme = NOMS_FORMES[m[1] || m[2]];
  let t = texte.replace(m[0], ' ');
  const champs = { forme };
  const compris = [`forme : ${forme}`];
  const bras = t.match(RE_BRAS);
  if (bras) { champs.bras = Math.max(1, Number(bras[1])); t = t.replace(bras[0], ' '); compris.push(`${forme === 'octogone' ? 'pans' : 'bras'} de ${champs.bras} case${champs.bras > 1 ? 's' : ''}`); }
  if (RE_POSITION[forme]) {
    const [re, valeur] = RE_POSITION[forme];
    const pos = t.match(re);
    if (pos) { champs.position = valeur(pos); t = t.replace(pos[0], ' '); }
  }
  return { champs, reste: t.replace(/\s+/g, ' ').trim(), compris };
}

const SOLS = {
  pierre: 'pierre', dalle: 'pierre', dalles: 'pierre', dallage: 'pierre', roche: 'pierre',
  bois: 'bois', parquet: 'bois', plancher: 'bois', planches: 'bois',
  terre: 'terre', boue: 'terre', sable: 'sable', herbe: 'herbe', mousse: 'herbe',
  marbre: 'marbre', glace: 'glace',
};

/** « sol en bois », « sol de terre battue », « parquet »… → nature du sol. */
export function extraireSol(texte) {
  let m = texte.match(/\bsol\s+(?:en|de|d|couvert de)\s+(\w+)(?:\s+battue)?/);
  if (m && SOLS[m[1]]) return { valeur: SOLS[m[1]], reste: texte.replace(m[0], ' ').trim() };
  m = texte.match(/\b(parquet|plancher|dallage)\b/);
  if (m) return { valeur: SOLS[m[1]], reste: texte.replace(m[0], ' ').trim() };
  return { valeur: 'pierre', reste: texte };
}
