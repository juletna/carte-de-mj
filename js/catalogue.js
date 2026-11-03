/**
 * Le catalogue : tout ce qu'on sait de chaque type d'objet, de créature et d'ouverture. Module PUR : des données, aucun comportement.
 * C'est ICI qu'on ajoute un nouvel objet ; il ne reste ensuite que ses dessins, dans chacun des deux thèmes (rendu/themes/). Un test le vérifie.
 *
 * Entrée d'un objet :
 *   type       identifiant utilisé dans le JSON et par le thème graphique
 *   nom        nom affiché quand il diffère du type (accents : « bibliotheque » → « bibliothèque »)
 *   mots       formes reconnues, sans accents, au singulier
 *              (le pluriel en -s / -x est reconnu automatiquement)
 *   l, h       taille en cases (l = ouest→est, h = nord→sud) quand l'objet
 *              est adossé au mur nord ; il pivote tout seul sur les autres murs
 *   zone       placement par défaut si la phrase ne précise rien
 *              (grille, centre, fond, coins, cotes, perimetre, aleatoire…)
 *   bloquant   false si l'objet ne gêne pas le passage (torche murale)
 *   lettre     sa lettre sur la carte en texte du rapport
 *   feminin    nom féminin (« une table »), pour les accords de la description
 *   symetrique identique quelle que soit son orientation : la description n'a pas à la préciser
 *   auLarge    écarté d'une case du mur quand la pièce est assez large
 *   couche     ordre de dessin, 5 par défaut : en dessous, c'est au sol (dessiné sous la grille et sous les autres objets, et
 *              attrapé en dernier à la souris) ; au-dessus, c'est accroché au mur (dessiné en dernier)
 * Un créature a de même `type`, `nom`, `mots` et `feminin`, plus :
 *   camp       pj (personnages des joueurs), pnj (neutres), monstre
 *   taille     côté du pion en cases, selon la catégorie de taille : P/M = 1, G = 2, TG = 3, Gig = 4
 *   abr        abréviation affichée sur le pion (3 lettres max conseillé)
 * Une ouverture (les portes ne sont pas des objets : elles vont dans plan.portes) a `type`, `mots` et `feminin`.
 *
 * Uniquement des créatures génériques de fantasy (pas de monstres propres
 * à une gamme commerciale) pour éviter tout souci de droits.
 */

export const COUCHE_PAR_DEFAUT = 5;

export const OBJETS = [
  { type: 'pilier',       mots: ['pilier'],                                   l: 1, h: 1, zone: 'grille',    lettre: 'P', symetrique: true, auLarge: true },
  { type: 'colonne',      mots: ['colonne'],                                  l: 1, h: 1, zone: 'grille',    lettre: 'C', feminin: true, symetrique: true, auLarge: true },
  { type: 'coffre',       mots: ['coffre', 'malle'],                          l: 1, h: 1, zone: 'fond',      lettre: 'K' },
  { type: 'statue',       mots: ['statue', 'gargouille', 'idole'],            l: 1, h: 1, zone: 'centre',    lettre: 'S', feminin: true, auLarge: true },
  { type: 'table',        mots: ['table'],                                    l: 2, h: 1, zone: 'centre',    lettre: 'T', feminin: true },
  { type: 'chaise',       mots: ['chaise', 'tabouret', 'banc'],               l: 1, h: 1, zone: 'centre',    lettre: 'h', feminin: true },
  { type: 'autel',        mots: ['autel'],                                    l: 2, h: 1, zone: 'fond',      lettre: 'A' },
  { type: 'trone',        mots: ['trone'],                                    l: 1, h: 1, zone: 'fond',      lettre: 'R', nom: 'trône' },
  { type: 'tonneau',      mots: ['tonneau', 'baril', 'barrique', 'fut'],      l: 1, h: 1, zone: 'coins',     lettre: 'O', symetrique: true },
  { type: 'caisse',       mots: ['caisse', 'caisson', 'cageot'],              l: 1, h: 1, zone: 'coins',     lettre: 'X', feminin: true, symetrique: true },
  { type: 'escalier',     mots: ['escalier', 'marche'],                       l: 1, h: 2, zone: 'coins',     lettre: 'E' },
  { type: 'fosse',        mots: ['fosse', 'trou', 'gouffre', 'piege', 'trappe'], l: 1, h: 1, zone: 'centre', lettre: 'F', feminin: true, symetrique: true, couche: 0 },
  { type: 'lit',          mots: ['lit', 'couchette', 'paillasse'],            l: 1, h: 2, zone: 'cotes',     lettre: 'L' },
  { type: 'bibliotheque', mots: ['bibliotheque', 'etagere', 'rayonnage'],     l: 2, h: 1, zone: 'fond',      lettre: 'B', nom: 'bibliothèque', feminin: true },
  { type: 'torche',       mots: ['torche', 'flambeau', 'brasero', 'chandelier'], l: 1, h: 1, zone: 'perimetre', lettre: '*', feminin: true, bloquant: false, couche: 9 },
  { type: 'debris',       mots: ['debris', 'gravat', 'eboulis', 'decombre', 'ruine'], l: 1, h: 1, zone: 'aleatoire', lettre: '%', nom: 'débris', symetrique: true, couche: 1 },
  { type: 'puits',        mots: ['puits'],                                    l: 1, h: 1, zone: 'centre',    lettre: 'U', symetrique: true },
  { type: 'fontaine',     mots: ['fontaine', 'bassin'],                       l: 1, h: 1, zone: 'centre',    lettre: 'W', feminin: true, symetrique: true },
  { type: 'sarcophage',   mots: ['sarcophage', 'tombeau', 'cercueil'],        l: 1, h: 2, zone: 'centre',    lettre: 'Z' },
];

export const CREATURES = [
  // Personnages des joueurs
  { type: 'pj', nom: 'personnage', mots: ['personnage', 'joueur', 'aventurier', 'heros', 'pj'], camp: 'pj', taille: 1, abr: 'PJ' },
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
  { type: 'goule', mots: ['goule'], feminin: true, camp: 'monstre', taille: 1, abr: 'Gou' },
  { type: 'spectre', mots: ['spectre', 'fantome', 'ame en peine', 'banshee'], camp: 'monstre', taille: 1, abr: 'Spe' },
  { type: 'vampire', mots: ['vampire'], camp: 'monstre', taille: 1, abr: 'Vam' },
  { type: 'liche', mots: ['liche'], feminin: true, camp: 'monstre', taille: 1, abr: 'Lic' },
  { type: 'rat', mots: ['rat'], camp: 'monstre', taille: 1, abr: 'Rat' },
  { type: 'loup', mots: ['loup'], camp: 'monstre', taille: 1, abr: 'Lou' },
  { type: 'loup-garou', mots: ['loup garou', 'lycanthrope'], camp: 'monstre', taille: 1, abr: 'LGa' },
  { type: 'araignee', nom: 'araignée', mots: ['araignee'], feminin: true, camp: 'monstre', taille: 2, abr: 'Ara' },
  { type: 'harpie', mots: ['harpie'], feminin: true, camp: 'monstre', taille: 1, abr: 'Har' },
  { type: 'ogre', mots: ['ogre'], camp: 'monstre', taille: 2, abr: 'Ogr' },
  { type: 'troll', mots: ['troll'], camp: 'monstre', taille: 2, abr: 'Trl' },
  { type: 'minotaure', mots: ['minotaure'], camp: 'monstre', taille: 2, abr: 'Min' },
  { type: 'golem', mots: ['golem'], camp: 'monstre', taille: 2, abr: 'Gol' },
  { type: 'ours', mots: ['ours'], camp: 'monstre', taille: 2, abr: 'Our' },
  { type: 'elementaire', nom: 'élémentaire', mots: ['elementaire'], camp: 'monstre', taille: 2, abr: 'Elé' },
  { type: 'manticore', mots: ['manticore', 'chimere', 'griffon'], feminin: true, camp: 'monstre', taille: 2, abr: 'Man' },
  { type: 'wyverne', mots: ['wyverne', 'vouivre'], feminin: true, camp: 'monstre', taille: 2, abr: 'Wyv' },
  { type: 'basilic', mots: ['basilic'], camp: 'monstre', taille: 1, abr: 'Bas' },
  { type: 'geant', nom: 'géant', mots: ['geant', 'cyclope'], camp: 'monstre', taille: 3, abr: 'Géa' },
  { type: 'hydre', mots: ['hydre'], feminin: true, camp: 'monstre', taille: 3, abr: 'Hyd' },
  { type: 'dragon', mots: ['dragon'], camp: 'monstre', taille: 3, abr: 'Dra' },
  { type: 'dragonnet', mots: ['dragonnet'], camp: 'monstre', taille: 1, abr: 'Dnt' },
];

export const OUVERTURES = [
  { type: 'porte', mots: ['porte', 'portail', 'sortie'], feminin: true },
  { type: 'herse', mots: ['herse'], feminin: true },
  { type: 'arche', mots: ['arche', 'passage', 'ouverture', 'arcade'], feminin: true },
];

const PAR_TYPE = new Map([...OBJETS, ...CREATURES, ...OUVERTURES].map((d) => [d.type, d]));

/** Nom lisible d'un type, au singulier (« bibliotheque » → « bibliothèque ») ; le type lui-même s'il n'a pas de nom propre. */
export const nomDe = (type) => PAR_TYPE.get(type)?.nom ?? type;
/** Le nom est-il féminin (« une table », « une porte ») ? */
export const estFeminin = (type) => PAR_TYPE.get(type)?.feminin === true;
/** L'objet est-il identique quelle que soit son orientation ? */
export const estSymetrique = (type) => PAR_TYPE.get(type)?.symetrique === true;
/** L'objet s'écarte-t-il d'une case du mur quand la pièce est assez large ? */
export const estAuLarge = (type) => PAR_TYPE.get(type)?.auLarge === true;
/** Ordre de dessin d'un type : plus c'est petit, plus c'est dessous (voir COUCHE_PAR_DEFAUT). */
export const coucheDe = (type) => PAR_TYPE.get(type)?.couche ?? COUCHE_PAR_DEFAUT;
/** Lettre d'un type d'objet sur la carte en texte du rapport (undefined si le type n'en a pas). */
export const lettreDe = (type) => PAR_TYPE.get(type)?.lettre;
