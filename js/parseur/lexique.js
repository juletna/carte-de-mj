/**
 * Lexique du parseur : c'est ICI qu'on ajoute un nouvel objet.
 *
 * Chaque entrée :
 *   type     identifiant utilisé dans le JSON et par le thème graphique
 *   mots     formes reconnues, sans accents, au singulier
 *            (le pluriel en -s / -x est reconnu automatiquement)
 *   l, h     taille en cases (l = ouest→est, h = nord→sud) quand l'objet
 *            est adossé au mur nord ; il pivote tout seul sur les autres murs
 *   zone     placement par défaut si la phrase ne précise rien
 *            (grille, centre, fond, coins, cotes, perimetre, aleatoire…)
 *   bloquant false si l'objet ne gêne pas le passage (torche murale)
 */
export const OBJETS = [
  { type: 'pilier',       mots: ['pilier'],                                   l: 1, h: 1, zone: 'grille' },
  { type: 'colonne',      mots: ['colonne'],                                  l: 1, h: 1, zone: 'grille' },
  { type: 'coffre',       mots: ['coffre', 'malle'],                          l: 1, h: 1, zone: 'fond' },
  { type: 'statue',       mots: ['statue', 'gargouille', 'idole'],   l: 1, h: 1, zone: 'centre' },
  { type: 'table',        mots: ['table'],                                    l: 2, h: 1, zone: 'centre' },
  { type: 'chaise',       mots: ['chaise', 'tabouret', 'banc'],               l: 1, h: 1, zone: 'centre' },
  { type: 'autel',        mots: ['autel'],                                    l: 2, h: 1, zone: 'fond' },
  { type: 'trone',        mots: ['trone'],                                    l: 1, h: 1, zone: 'fond' },
  { type: 'tonneau',      mots: ['tonneau', 'baril', 'barrique', 'fut'],      l: 1, h: 1, zone: 'coins' },
  { type: 'caisse',       mots: ['caisse', 'caisson', 'cageot'],              l: 1, h: 1, zone: 'coins' },
  { type: 'escalier',     mots: ['escalier', 'marche'],                       l: 1, h: 2, zone: 'coins' },
  { type: 'fosse',        mots: ['fosse', 'trou', 'gouffre', 'piege', 'trappe'], l: 1, h: 1, zone: 'centre' },
  { type: 'lit',          mots: ['lit', 'couchette', 'paillasse'],            l: 1, h: 2, zone: 'cotes' },
  { type: 'bibliotheque', mots: ['bibliotheque', 'etagere', 'rayonnage'],     l: 2, h: 1, zone: 'fond' },
  { type: 'torche',       mots: ['torche', 'flambeau', 'brasero', 'chandelier'], l: 1, h: 1, zone: 'perimetre', bloquant: false },
  { type: 'debris',       mots: ['debris', 'gravat', 'eboulis', 'decombre', 'ruine'], l: 1, h: 1, zone: 'aleatoire' },
  { type: 'puits',        mots: ['puits'],                                    l: 1, h: 1, zone: 'centre' },
  { type: 'fontaine',     mots: ['fontaine', 'bassin'],                       l: 1, h: 1, zone: 'centre' },
  { type: 'sarcophage',   mots: ['sarcophage', 'tombeau', 'cercueil'],        l: 1, h: 2, zone: 'centre' },
];

/**
 * Créatures : elles deviennent des PIONS (plan.creatures), pas des objets.
 *   camp   pj (personnages des joueurs), pnj (neutres), monstre
 *   taille côté du pion en cases, selon la catégorie de taille :
 *          P/M = 1, G = 2, TG = 3, Gig = 4
 *   abr    abréviation affichée sur le pion (3 lettres max conseillé)
 * Uniquement des créatures génériques de fantasy (pas de monstres propres
 * à une gamme commerciale) pour éviter tout souci de droits.
 */
export const CREATURES = [
  // Personnages des joueurs
  { type: 'pj', mots: ['personnage', 'joueur', 'aventurier', 'heros', 'pj'], camp: 'pj', taille: 1, abr: 'PJ' },
  // Peuples (neutres par défaut)
  { type: 'humain', mots: ['humain', 'villageois', 'paysan', 'marchand', 'aubergiste'], camp: 'pnj', taille: 1, abr: 'Hum' },
  { type: 'elfe', mots: ['elfe'], camp: 'pnj', taille: 1, abr: 'Elf' },
  { type: 'nain', mots: ['nain'], camp: 'pnj', taille: 1, abr: 'Nai' },
  { type: 'halfelin', mots: ['halfelin', 'hobbit'], camp: 'pnj', taille: 1, abr: 'Hal' },
  { type: 'gnome', mots: ['gnome'], camp: 'pnj', taille: 1, abr: 'Gno' },
  { type: 'garde', mots: ['garde', 'soldat', 'sentinelle', 'chevalier'], camp: 'pnj', taille: 1, abr: 'Gar' },
  { type: 'mage', mots: ['mage', 'magicien', 'sorcier', 'sorciere', 'pretre', 'pretresse', 'druide'], camp: 'pnj', taille: 1, abr: 'Mag' },
  { type: 'roi', mots: ['roi', 'reine', 'seigneur', 'prince', 'princesse'], camp: 'pnj', taille: 1, abr: 'Roi' },
  // Monstres
  { type: 'gobelin', mots: ['gobelin'], camp: 'monstre', taille: 1, abr: 'Gob' },
  { type: 'hobgobelin', mots: ['hobgobelin'], camp: 'monstre', taille: 1, abr: 'Hob' },
  { type: 'kobold', mots: ['kobold'], camp: 'monstre', taille: 1, abr: 'Kob' },
  { type: 'orque', mots: ['orque', 'orc'], camp: 'monstre', taille: 1, abr: 'Orq' },
  { type: 'gnoll', mots: ['gnoll'], camp: 'monstre', taille: 1, abr: 'Gnl' },
  { type: 'bandit', mots: ['bandit', 'brigand', 'voleur', 'assassin', 'pirate'], camp: 'monstre', taille: 1, abr: 'Ban' },
  { type: 'cultiste', mots: ['cultiste', 'fanatique', 'necromancien'], camp: 'monstre', taille: 1, abr: 'Cul' },
  { type: 'squelette', mots: ['squelette'], camp: 'monstre', taille: 1, abr: 'Squ' },
  { type: 'zombie', mots: ['zombie', 'mort vivant'], camp: 'monstre', taille: 1, abr: 'Zom' },
  { type: 'goule', mots: ['goule'], camp: 'monstre', taille: 1, abr: 'Gou' },
  { type: 'spectre', mots: ['spectre', 'fantome', 'ame en peine', 'banshee'], camp: 'monstre', taille: 1, abr: 'Spe' },
  { type: 'vampire', mots: ['vampire'], camp: 'monstre', taille: 1, abr: 'Vam' },
  { type: 'liche', mots: ['liche'], camp: 'monstre', taille: 1, abr: 'Lic' },
  { type: 'rat', mots: ['rat'], camp: 'monstre', taille: 1, abr: 'Rat' },
  { type: 'loup', mots: ['loup'], camp: 'monstre', taille: 1, abr: 'Lou' },
  { type: 'loup-garou', mots: ['loup garou', 'lycanthrope'], camp: 'monstre', taille: 1, abr: 'LGa' },
  { type: 'araignee', mots: ['araignee'], camp: 'monstre', taille: 2, abr: 'Ara' },
  { type: 'harpie', mots: ['harpie'], camp: 'monstre', taille: 1, abr: 'Har' },
  { type: 'ogre', mots: ['ogre'], camp: 'monstre', taille: 2, abr: 'Ogr' },
  { type: 'troll', mots: ['troll'], camp: 'monstre', taille: 2, abr: 'Trl' },
  { type: 'minotaure', mots: ['minotaure'], camp: 'monstre', taille: 2, abr: 'Min' },
  { type: 'golem', mots: ['golem'], camp: 'monstre', taille: 2, abr: 'Gol' },
  { type: 'ours', mots: ['ours'], camp: 'monstre', taille: 2, abr: 'Our' },
  { type: 'elementaire', mots: ['elementaire'], camp: 'monstre', taille: 2, abr: 'Elé' },
  { type: 'manticore', mots: ['manticore', 'chimere', 'griffon'], camp: 'monstre', taille: 2, abr: 'Man' },
  { type: 'wyverne', mots: ['wyverne', 'vouivre'], camp: 'monstre', taille: 2, abr: 'Wyv' },
  { type: 'basilic', mots: ['basilic'], camp: 'monstre', taille: 1, abr: 'Bas' },
  { type: 'geant', mots: ['geant', 'cyclope'], camp: 'monstre', taille: 3, abr: 'Géa' },
  { type: 'hydre', mots: ['hydre'], camp: 'monstre', taille: 3, abr: 'Hyd' },
  { type: 'dragon', mots: ['dragon'], camp: 'monstre', taille: 3, abr: 'Dra' },
  { type: 'dragonnet', mots: ['dragonnet'], camp: 'monstre', taille: 1, abr: 'Dnt' },
];

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

/** Les portes ne sont pas des objets : elles vont dans plan.portes. */
export const PORTES = {
  porte: 'porte', portail: 'porte', sortie: 'porte',
  herse: 'herse',
  arche: 'arche', passage: 'arche', ouverture: 'arche', arcade: 'arche',
};

/**
 * Adjectifs qui rendent un élément secret (« un coffre caché », « une porte secrète »),
 * sans accents comme le texte normalisé. Ils produisent `cache: true` dans le plan.
 */
export const ADJ_CACHE = new Set(['cache', 'cachee', 'caches', 'cachees', 'secret', 'secrete', 'secrets', 'secretes']);

/** Adjectifs qui agrandissent un objet d'une case (« une grande table »). */
export const ADJ_GRAND = new Set(['grand', 'grande', 'grands', 'grandes', 'large', 'larges', 'immense', 'immenses', 'enorme', 'enormes']);

/**
 * Mots sans information pour le parseur : ils ne sont pas signalés
 * comme « non compris ».
 */
export const MOTS_VIDES = new Set((
  'le la les l un une des de du d en au aux a et ou avec sur sous dans par pour il y ' +
  'qui que qu est sont se trouve trouvent fait font mesure mesurant ce cette ces son sa ses leur leurs ' +
  'salle salles piece pieces chambre caverne grotte crypte hall couloir donjon ici on voit contre ' +
  'taverne auberge temple chapelle cave cellier cuisine prison cellule bureau laboratoire armurerie tresor ' +
  'pose posee poses posees place placee places placees situe situee situes situees range rangee ranges ' +
  'mur murs sol cote cotes pres proche juste bien tout toute tous toutes chaque meme aussi ' +
  'grand grande grands grandes petit petite petits petites moyen moyenne vaste immense enorme long longue ' +
  'large m metre metres case cases carreau carreaux environ'
).split(' '));

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

/** Nom lisible d'un type, pour les messages (« bibliotheque » → « bibliothèque »). */
const NOMS = {
  trone: 'trône', bibliotheque: 'bibliothèque', debris: 'débris', fut: 'fût', pj: 'personnage',
  araignee: 'araignée', elementaire: 'élémentaire', geant: 'géant', 'loup-garou': 'loup-garou',
};
export function nomAffiche(type, n = 1) {
  const nom = NOMS[type] || type;
  if (n <= 1 || /[sx]$/.test(nom)) return nom;
  return nom.endsWith('eau') ? nom + 'x' : nom + 's';
}
