/**
 * Reconnaissance des positions dans une proposition.
 *
 * Deux familles :
 *  - positions RELATIVES à un autre élément : « devant la porte »,
 *    « de chaque côté du trône », « autour du puits »…
 *  - ZONES de la pièce : au fond, à l'entrée, au centre, contre le mur
 *    nord, dans les coins, de chaque côté, en cercle…
 *
 * Le résultat est une intention abstraite ({ zone, mur, coin, relation,
 * cible }) ; c'est placement.js qui la traduit en coordonnées.
 */
import { trouverObjet } from './lexique.js';
import { lireCase, indexColonne } from './coordonnees.js';

// Préposition relative → type de relation
const RELATIONS = [
  [/^devant$/, 'devant'],
  [/^derriere$/, 'derriere'],
  [/^(?:a cote|pres|contre|le long) d(?:e|u|es)?$/, 'cote'],
  [/^contre$/, 'cote'],
  [/^autour d(?:e|u|es)?$/, 'autour'],
  [/^(?:de chaque cote|de part et d autre|des deux cotes|de part et d autre) d(?:e|u|es)?$/, 'flancs'],
  [/^(?:en face d(?:e|u|es)?|face a(?:u|ux)?)$/, 'face'],
];
const RE_RELATION = /\b(devant|derriere|a cote d(?:e|u|es)?|pres d(?:e|u|es)?|autour d(?:e|u|es)?|de chaque cote d(?:e|u|es)?|des deux cotes d(?:e|u|es)?|de part et d autre d(?:e|u|es)?|en face d(?:e|u|es)?|face a(?:u|ux)?|contre)\b/;

const ZONES = {
  coinPrecis: /\b(?:coins?|angles?)\s+(?:\w+\s+)?(nord|sud)\s+(est|ouest)\b/,
  coins: /\b(?:coins?|angles?)\b/,
  cotes: /\b(?:de chaque cote|de part et d autre|des deux cotes|sur les cotes|murs lateraux)\b/,
  cercle: /\ben (?:cercle|rond|couronne)\b|\bcirculairement\b/,
  ligne: /\ben (?:ligne|rang|file)\b|\balignee?s?\b/,
  rangees: /\brangees?\b/,
  perimetre: /\b(?:murs|parois)\b|\btout autour\b/,
  mur: /\b(?:mur|paroi|cote|face)\s+(nord|sud|est|ouest)\b|\b(?:au|a l|a|vers le|vers l)\s+(nord|sud|est|ouest)\b/,
  fond: /\bfond\b/,
  entree: /\bentree\b/,
  gauche: /\bgauche\b/,
  droite: /\bdroite\b/,
  centre: /\b(?:centre|milieu|central|centrale)\b/,
};

/** Indices (positions de mots) couverts par un passage de la proposition. */
function indicesMots(prop, debut, longueur) {
  const avant = prop.slice(0, debut).split(' ').filter(Boolean).length;
  const n = prop.slice(debut, debut + longueur).trim().split(' ').filter(Boolean).length;
  return Array.from({ length: n }, (_, k) => avant + k);
}

const DIRECTIONS = { nord: 0, est: 90, sud: 180, ouest: 270 };
const RE_REGARD = /\btourne(?:e|es|ees|s)?\s+vers\s+(?:le|l)\s+(nord|sud|est|ouest)\b/;
const RE_PORTE_PRECISE = /\bmur\s+(nord|sud|est|ouest)\s+en\s+([a-z]{1,2}|\d{1,2})\b/;

/**
 * Coordonnées exactes : « en C4 », « en A1 C1 E1 », « de A2 à B2 »,
 * éventuellement « tourné vers l'est ». Renvoie null s'il n'y en a pas.
 */
function analyserCases(prop, mots) {
  let res = null;
  for (let i = 0; i < mots.length && !res; i++) {
    if (mots[i] === 'de' && lireCase(mots[i + 1]) && mots[i + 2] === 'a' && lireCase(mots[i + 3])) {
      const [x1, y1] = lireCase(mots[i + 1]), [x2, y2] = lireCase(mots[i + 3]);
      res = {
        zone: 'cases',
        etendue: [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)],
        libelle: `de ${mots[i + 1].toUpperCase()} à ${mots[i + 3].toUpperCase()}`,
        indices: [i, i + 1, i + 2, i + 3],
      };
    } else if ((mots[i] === 'en' || mots[i] === 'case') && lireCase(mots[i + 1])) {
      const liste = [];
      for (let j = i + 1; lireCase(mots[j]); j++) liste.push(j);
      res = {
        zone: 'cases',
        cases: liste.map((j) => lireCase(mots[j])),
        libelle: `en ${liste.map((j) => mots[j].toUpperCase()).join(', ')}`,
        indices: [i, ...liste],
      };
    }
  }
  if (res) {
    const m = prop.match(RE_REGARD);
    if (m) {
      res.rotation = DIRECTIONS[m[1]];
      res.indices.push(...indicesMots(prop, m.index, m[0].length));
    }
  }
  return res;
}

const MURS = new Set(['nord', 'sud', 'est', 'ouest']);

/**
 * Mur désigné juste après le mot « porte » (à l'indice k) : « la porte est », « la porte nord »,
 * « la porte du mur est », « la porte de l'ouest ». Renvoie { mur, indices } ou null.
 * « est » nu est aussi un verbe (« la porte est au nord », « la porte est fermée ») : il ne désigne
 * un mur que s'il termine la proposition ; précédé de « du mur », « de l' », il est sans ambiguïté.
 * « sud est », « nord ouest » désignent un angle, pas un mur : on n'y touche pas.
 */
function murDeLaPorte(mots, k) {
  let j = k + 1;
  let explicite = false;
  if (mots[j] === 'du' || mots[j] === 'de') {
    explicite = true;
    j++;
    if (mots[j] === 'l') j++;
  }
  if (['mur', 'cote', 'paroi'].includes(mots[j])) {
    explicite = true;
    j++;
    if (mots[j] === 'de' && mots[j + 1] === 'l') j += 2;
  }
  const mur = mots[j];
  if (!MURS.has(mur) || MURS.has(mots[j + 1])) return null;
  if (!explicite && mur === 'est' && j + 1 < mots.length) return null; // « est » verbe
  return { mur, indices: Array.from({ length: j - k }, (_, i) => k + 1 + i) };
}

/**
 * @param {string} prop proposition normalisée (« 2 coffres au fond de la salle »)
 * @returns {{zone:string|null, mur?:string, coin?:string[], cote?:string,
 *            relation?:string, cible?:{type:string, genre:string, index:number},
 *            colonnes?:number, indices:number[]}}
 */
export function analyserPosition(prop) {
  const res = { zone: null, indices: [] };
  const mots = prop.split(' ');

  // 0. Coordonnées exactes : elles priment sur tout le reste.
  const cases = analyserCases(prop, mots);
  if (cases) return cases;

  // Porte à un endroit précis du mur : « au mur sud en D », « au mur est en 4 ».
  const mp = prop.match(RE_PORTE_PRECISE);
  if (mp) {
    const positionMur = /^\d/.test(mp[2]) ? Number(mp[2]) - 1 : indexColonne(mp[2]);
    return { zone: 'mur', mur: mp[1], positionMur, indices: indicesMots(prop, mp.index, mp[0].length) };
  }

  // 1. Relation à un autre élément : on cherche l'objet visé dans les 4 mots suivants.
  const mr = prop.match(RE_RELATION);
  if (mr) {
    const idx = indicesMots(prop, mr.index, mr[0].length);
    const fin = idx[idx.length - 1];
    for (let k = fin + 1; k <= fin + 4 && k < mots.length; k++) {
      const trouve = trouverObjet(mots[k]);
      if (trouve) {
        res.zone = 'relation';
        res.relation = RELATIONS.find(([re]) => re.test(mr[1]))?.[1] || 'cote';
        res.cible = { type: trouve.def.type, genre: trouve.def.genre, index: k };
        for (let j = idx[0]; j < k; j++) res.indices.push(j);
        if (trouve.def.genre === 'porte') {
          const precis = murDeLaPorte(mots, k);
          if (precis) {
            res.cible.mur = precis.mur;
            res.indices.push(...precis.indices);
          }
        }
        return res;
      }
    }
  }

  // 2. Zones de la pièce. On note tout ce qui est présent, puis on arbitre.
  const vu = {};
  for (const [nom, re] of Object.entries(ZONES)) {
    const m = prop.match(re);
    if (!m) continue;
    if (nom === 'coins' && vu.coinPrecis) continue;
    if (nom === 'mur' && vu.coinPrecis) continue;
    vu[nom] = m;
    res.indices.push(...indicesMots(prop, m.index, m[0].length));
  }

  if (vu.coinPrecis) return { ...res, zone: 'coin', coin: [vu.coinPrecis[1], vu.coinPrecis[2]] };
  if (vu.coins) return { ...res, zone: 'coins', filtre: vu.fond ? 'fond' : vu.entree ? 'entree' : null };
  if ((vu.fond || vu.entree) && (vu.gauche || vu.droite)) {
    return { ...res, zone: 'coin-relatif', mur: vu.fond ? 'fond' : 'entree', cote: vu.gauche ? 'gauche' : 'droite' };
  }
  if (vu.cercle) return { ...res, zone: 'cercle' };
  if (vu.cotes) return { ...res, zone: 'cotes' };
  if (vu.ligne) return { ...res, zone: 'ligne' };
  if (vu.rangees) return { ...res, zone: 'grille', colonnes: 2 };
  if (vu.mur) return { ...res, zone: 'mur', mur: vu.mur[1] || vu.mur[2] };
  if (vu.perimetre) return { ...res, zone: 'perimetre' };
  if (vu.fond) return { ...res, zone: 'fond' };
  if (vu.entree) return { ...res, zone: 'entree' };
  if (vu.gauche || vu.droite) return { ...res, zone: 'lateral', cote: vu.gauche ? 'gauche' : 'droite' };
  if (vu.centre) return { ...res, zone: 'centre' };
  return res;
}
