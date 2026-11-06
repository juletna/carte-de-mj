/**
 * Ambiance, état et éclairage d'une salle dans la description : « crypte glaciale », « salle chaleureuse », « de nuit », « abandonnée »,
 * « en ruine », « envahie par la végétation », « bien éclairée », « sombre », « plongée dans le noir »… (champs `ambiance`, `etat`, `eclairage`
 * du plan : voir schema.js).
 *
 * Chaque expression est retirée du texte (comme le sol, dimensions.js) pour ne pas être relue comme un mot inconnu. Pour ne pas confondre une salle
 * « sombre » avec un chevalier « sombre » ou un garde « de nuit » :
 *   - un adjectif collé à un objet, une créature ou une porte (avant ou après) qualifie cet élément, pas la salle : on le laisse ;
 *   - « vieille », « ancienne » (qui sont aussi des préfixes de créature : « une ancienne liche ») ne comptent que contre un nom de lieu
 *     (« vieille salle », « crypte ancienne »).
 * Un mot de type de salle (« crypte ») ne suggère pas d'ambiance : sans mot explicite, rien n'est deviné.
 * Pour chaque champ, la première règle de la table qui trouve quelque chose l'emporte (les autres expressions du champ restent dans le texte). Le texte attendu est normalisé (normaliser.js) : minuscules, sans accents.
 */
import { trouverObjet, PORTES, PIECES } from './lexique.js';

/** Les mots qui désignent le lieu : « vieille » ou « ancienne » n'y sont un état que collés à l'un d'eux. */
const LIEUX = new Set([...PIECES, 'salles', 'pieces', 'couloir', 'donjon', 'cellier', 'bureau', 'laboratoire', 'armurerie', 'tresor']);

/** Ce que le parseur reconnaît : champ, valeur, motif (sur le texte normalisé), libellé du retour « Compris », et `lieu` pour les adjectifs ambigus. */
const REGLES = [
  // Éclairage : les plus longues d'abord (« plongée dans le noir » avant « dans le noir », « mal éclairée » avant « éclairée »).
  { champ: 'eclairage', valeur: 'obscurite', motif: '(?:plongee? )?dans (?:le noir|l obscurite|les tenebres)|obscures?|noires?|tenebreu(?:x|se|ses)' },
  { champ: 'eclairage', valeur: 'penombre', motif: 'dans la penombre|en penombre|penombre|mal eclairee?s?|sombres?' },
  { champ: 'eclairage', valeur: 'eclairee', motif: 'bien eclairee?s?|illuminee?s?|lumineu(?:x|se|ses)' },
  // Ambiance.
  { champ: 'ambiance', valeur: 'froide', motif: 'glacial(?:e|es|s)?|glaciaux|froid(?:e|es|s)?|gelee?s?' },
  { champ: 'ambiance', valeur: 'chaude', motif: 'chaleureu(?:x|se|ses)|chaud(?:e|es|s)?|accueillant(?:e|es|s)?' },
  { champ: 'ambiance', valeur: 'nuit', motif: 'de nuit|nocturnes?|au clair de lune|sous la lune' },
  // État du décor.
  { champ: 'etat', valeur: 'ruine', motif: 'en ruines?|ruinees?|abandonnee?s?|effondree?s?|envahi(?:e|es|s)? (?:par|de|d) (?:la |le |les |l |une? |des )?(?:vegetation|lierre|mousse|ronces?|herbes?|plantes?|racines?)' },
  { champ: 'etat', valeur: 'usee', motif: 'usee?s?|delabree?s?|vieux|vieil|vieilles?|anciens?|ancienne?s?', lieu: ['vieux', 'vieil', 'vieille', 'vieilles', 'ancien', 'anciens', 'ancienne', 'anciennes'] },
  { champ: 'etat', valeur: 'neuve', motif: 'neuve?s?|propres?' },
];

/** Libellés du retour « Compris » et de la description réécrite (decrire.js) : ce que le parseur relit sans rien changer. */
export const MOTS_AMBIANCE = {
  ambiance: { froide: 'froide', chaude: 'chaude', nuit: 'de nuit' },
  etat: { neuve: 'neuve', usee: 'usée', ruine: 'en ruine' },
  eclairage: { eclairee: 'bien éclairée', penombre: 'dans la pénombre', obscurite: 'plongée dans le noir' },
};
const TITRES = { ambiance: 'ambiance', etat: 'état de la salle', eclairage: 'éclairage' };

/** Un mot qui désigne un élément du décor ou un pion (un adjectif à côté de lui lui appartient). */
const estElement = (mot) => !!mot && (!!trouverObjet(mot) || mot in PORTES);

/**
 * Cherche les expressions d'ambiance, d'état et d'éclairage dans `texte` et les retire.
 * @param {string} texte  texte normalisé
 * @returns {{champs:{ambiance?:string, etat?:string, eclairage?:string}, reste:string, compris:string[]}}
 */
export function extraireAmbiance(texte) {
  const champs = {};
  let t = texte;
  for (const regle of REGLES) {
    if (champs[regle.champ]) continue;
    const re = new RegExp(`(?<![a-z0-9_])(?:${regle.motif})(?![a-z0-9_])`, 'g');
    const trouves = [...t.matchAll(re)].filter((m) => {
      const avant = t.slice(0, m.index).trim().split(' ').pop();
      const apres = t.slice(m.index + m[0].length).trim().split(' ')[0];
      if (estElement(avant) || estElement(apres)) return false;
      return !(regle.lieu?.includes(m[0].split(' ')[0]) && !LIEUX.has(avant) && !LIEUX.has(apres));
    });
    if (!trouves.length) continue;
    champs[regle.champ] = regle.valeur;
    for (const m of trouves.reverse()) t = t.slice(0, m.index) + ' ' + t.slice(m.index + m[0].length); // « de nuit, nocturne » : tout ce que dit cette règle
    t = t.replace(/\s+/g, ' ');
  }
  const compris = Object.keys(TITRES).filter((c) => champs[c]).map((c) => `${TITRES[c]} : ${MOTS_AMBIANCE[c][champs[c]]}`);
  return { champs, reste: t.trim(), compris };
}
