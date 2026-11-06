/**
 * Le catalogue : tout ce qu'on sait de chaque type d'objet, de créature et d'ouverture. Module PUR : des données, aucun comportement.
 * C'est ICI qu'on ajoute un nouvel objet ; il ne reste ensuite que ses dessins, dans chacun des deux thèmes (rendu/themes/). Un test le vérifie.
 *
 * Entrée d'un objet :
 *   type       identifiant utilisé dans le JSON et par le thème graphique
 *   nom        nom affiché quand il diffère du type (accents : « bibliotheque » → « bibliothèque »)
 *   pluriel    pluriel du nom affiché quand ce n'est pas « nom + s » (« feux de camp ») ; « -eau » prend un « x », un nom en -s ou -x ne change pas
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
 *   variantes  liste ordonnée { id, nom, mots, fem?, pluriel?, invariable? } des aspects que peut prendre l'objet (torche éteinte, flamme bleue…).
 *              La PREMIÈRE est la variante par défaut : c'est le dessin d'origine, et le plan n'écrit rien pour elle. `id` : minuscules, sans accent ;
 *              `nom` : l'adjectif au masculin singulier, tel qu'on l'affiche (« éteint ») ; `fem` : son féminin si ce n'est pas « nom + e » ;
 *              `pluriel` : son pluriel masculin si ce n'est pas « nom + s » (« infernaux » ; « -al » donne « -aux » seul) ; `invariable` : jamais de s, aux deux genres
 *              (« à treuil », « debout », « de grimoires ») ; `mots` : les formes reconnues dans le texte, sans accents,
 *              au singulier et aux deux genres (le pluriel en -s est reconnu). Le plan garde `variante: id` sur un objet seulement si elle est connue
 *              de son type et n'est pas la défaut (schema.js). Accès : variantesDe, varianteDe, variantePourMot, nomVariante. Un thème qui ne
 *              connaît pas une variante dessine l'objet par défaut ; un test vérifie que le thème peint dessine chaque variante déclarée (themes.test.js).
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

/**
 * Les variantes d'un feu (torche, brasero, bougies, feu de camp) : la flamme normale, éteinte, ou d'une couleur magique.
 * Les teintes de chaque variante sont dans rendu/feu.js (TEINTES_FLAMME), indexées par ces mêmes `id`.
 */
const VARIANTES_FEU = [
  { id: 'normale', nom: 'normal', mots: ['normal', 'normale', 'allume', 'allumee', 'ordinaire'] },
  { id: 'eteinte', nom: 'éteint', fem: 'éteinte', mots: ['eteint', 'eteinte', 'consume', 'consumee', 'cendreux', 'cendreuse'] },
  { id: 'bleue', nom: 'bleu', fem: 'bleue', mots: ['bleu', 'bleue', 'magique', 'enchante', 'enchantee', 'arcanique'] },
  { id: 'verte', nom: 'vert', fem: 'verte', mots: ['vert', 'verte', 'feerique'] },
  { id: 'violette', nom: 'violet', fem: 'violette', mots: ['violet', 'violette', 'mauve', 'pourpre'] },
  { id: 'argentee', nom: 'argenté', fem: 'argentée', mots: ['argente', 'argentee', 'blanc', 'blanche', 'follet', 'spectral', 'spectrale', 'fantomatique'] },
  { id: 'infernale', nom: 'infernal', fem: 'infernale', pluriel: 'infernaux', mots: ['infernal', 'infernale', 'infernaux', 'demoniaque', 'cramoisi', 'cramoisie', 'rouge'] },
];

/**
 * Les états du mobilier : le dessin d'origine (premier) et ses variantes (coffre ouvert, bibliothèque renversée, tonneau couché…). Chaque entrée de ces listes
 * est dessinée dans les quatre thèmes (peint riches et sobres : peint/objets-etats.js, peint/objets-etats-dessines.js ; vectoriel ; papier).
 * Les mots sont ceux du texte libre (« coffre au trésor », « étagères à moitié vides », « statue en ruine ») : un mot ne désigne qu'une variante par type.
 */
const VARIANTES_COFFRE = [
  { id: 'ferme', nom: 'fermé', mots: ['ferme', 'fermee', 'clos', 'close', 'verrouille', 'verrouillee'] },
  { id: 'ouvert', nom: 'ouvert', mots: ['ouvert', 'ouverte', 'entrouvert', 'entrouverte', 'tresor', 'garni', 'garnie', 'plein', 'pleine'] },
  { id: 'vide', nom: 'vide', fem: 'vide', mots: ['vide', 'pille', 'pillee', 'depouille', 'depouillee'] },
  { id: 'brise', nom: 'brisé', mots: ['brise', 'brisee', 'fracasse', 'fracassee', 'fracture', 'fracturee', 'defonce', 'defoncee', 'eventre', 'eventree', 'fendu', 'fendue', 'force', 'forcee', 'casse', 'cassee', 'detruit', 'detruite'] },
];
const VARIANTES_BIBLIOTHEQUE = [
  { id: 'pleine', nom: 'plein', fem: 'pleine', mots: ['plein', 'pleine', 'garni', 'garnie', 'rempli', 'remplie', 'fourni', 'fournie'] },
  { id: 'clairsemee', nom: 'clairsemé', fem: 'clairsemée', mots: ['clairseme', 'clairsemee', 'vide', 'degarni', 'degarnie', 'depeuple', 'depeuplee', 'pille', 'pillee'] },
  { id: 'renversee', nom: 'renversé', fem: 'renversée', mots: ['renverse', 'renversee', 'bascule', 'basculee', 'tombe', 'tombee', 'effondre', 'effondree', 'couche', 'couchee'] },
  { id: 'grimoires', nom: 'de grimoires', fem: 'de grimoires', invariable: true, mots: ['grimoire', 'mage', 'magicien', 'sorcier', 'sorciere', 'arcane', 'arcanes', 'occulte', 'magique', 'enchante', 'enchantee'] },
];
const VARIANTES_TONNEAU = [
  { id: 'debout', nom: 'debout', invariable: true, mots: ['debout', 'dresse', 'dressee'] },
  { id: 'couche', nom: 'couché', mots: ['couche', 'couchee', 'renverse', 'renversee', 'allonge', 'allongee', 'tombe', 'tombee'] },
  { id: 'eventre', nom: 'éventré', mots: ['eventre', 'eventree', 'defonce', 'defoncee', 'creve', 'crevee', 'perce', 'percee', 'fendu', 'fendue', 'brise', 'brisee'] },
];
const VARIANTES_SARCOPHAGE = [
  { id: 'ferme', nom: 'fermé', mots: ['ferme', 'fermee', 'clos', 'close', 'scelle', 'scellee'] },
  { id: 'ouvert', nom: 'ouvert', mots: ['ouvert', 'ouverte', 'entrouvert', 'entrouverte', 'profane', 'profanee', 'pille', 'pillee', 'viole', 'violee', 'force', 'forcee', 'vide'] },
];
const VARIANTES_STATUE = [
  { id: 'intacte', nom: 'intact', mots: ['intact', 'intacte', 'entier', 'entiere'] },
  { id: 'brisee', nom: 'brisé', mots: ['brise', 'brisee', 'renverse', 'renversee', 'ruine', 'ruinee', 'casse', 'cassee', 'fracasse', 'fracassee', 'decapite', 'decapitee', 'mutile', 'mutilee', 'effondre', 'effondree'] },
];
const VARIANTES_CAISSE = [
  { id: 'fermee', nom: 'fermé', mots: ['ferme', 'fermee', 'clouee', 'cloue', 'close', 'clos'] },
  { id: 'ouverte', nom: 'ouvert', mots: ['ouvert', 'ouverte', 'entrouvert', 'entrouverte', 'eventre', 'eventree', 'defonce', 'defoncee', 'pille', 'pillee', 'vide'] },
];

/**
 * Le décor : l'eau d'une fontaine, l'état d'un autel, la couverture d'un puits, la couleur d'une étoffe. La première entrée de chaque liste est le dessin
 * d'origine ; chaque variante est dessinée dans les quatre thèmes (peint/objets-etats-decor.js, vectoriel, papier ; teintes d'étoffe dans rendu/teintes-tissu.js).
 * Le tapis d'origine est rouge ; la bannière d'origine tire sa couleur de sa place (rouge, bleue ou verte) : elle s'appelle « variée ».
 */
const VARIANTES_FONTAINE = [
  { id: 'eau', nom: 'limpide', fem: 'limpide', mots: ['limpide', 'claire', 'propre', 'pure', 'vive'] },
  { id: 'asec', nom: 'asséché', fem: 'asséchée', mots: ['sec', 'seche', 'tari', 'tarie', 'asseche', 'assechee', 'desseche', 'dessechee', 'vide'] },
  { id: 'sombre', nom: 'sombre', fem: 'sombre', mots: ['sombre', 'trouble', 'croupi', 'croupie', 'stagnant', 'stagnante', 'sale', 'pollue', 'polluee', 'vaseux', 'vaseuse', 'empoisonne', 'empoisonnee', 'maudit', 'maudite'] },
  { id: 'sacree', nom: 'sacré', fem: 'sacrée', mots: ['sacre', 'sacree', 'benit', 'benite', 'saint', 'sainte', 'miraculeux', 'miraculeuse', 'enchante', 'enchantee', 'magique', 'lumineux', 'lumineuse'] },
];
const VARIANTES_AUTEL = [
  { id: 'nu', nom: 'nu', fem: 'nue', mots: ['nu', 'nue', 'simple', 'depouille', 'depouillee'] },
  { id: 'rituel', nom: 'rituel', fem: 'rituelle', mots: ['rituel', 'rituelle', 'cultuel', 'cultuelle'] },
  { id: 'ensanglante', nom: 'ensanglanté', fem: 'ensanglantée', mots: ['ensanglante', 'ensanglantee', 'sanglant', 'sanglante', 'sanguinolent', 'sanguinolente', 'sacrificiel', 'sacrificielle', 'macule', 'maculee', 'souille', 'souillee'] },
  { id: 'sacre', nom: 'sacré', fem: 'sacrée', mots: ['sacre', 'sacree', 'dore', 'doree', 'benit', 'benite', 'consacre', 'consacree', 'saint', 'sainte', 'divin', 'divine', 'solaire'] },
];
const VARIANTES_PUITS = [
  { id: 'ouvert', nom: 'ouvert', fem: 'ouverte', mots: ['ouvert', 'ouverte', 'decouvert', 'decouverte'] },
  { id: 'couvert', nom: 'couvert', fem: 'couverte', mots: ['couvert', 'couverte', 'ferme', 'fermee', 'bouche', 'bouchee', 'condamne', 'condamnee', 'planche', 'planches', 'scelle', 'scellee'] },
  { id: 'treuil', nom: 'à treuil', fem: 'à treuil', invariable: true, mots: ['treuil', 'seau', 'corde', 'portique', 'potence', 'poulie', 'manivelle'] },
];
const COULEURS_TISSU = [
  { id: 'rouge', nom: 'rouge', fem: 'rouge', mots: ['rouge', 'ecarlate', 'cramoisi', 'cramoisie'] },
  { id: 'bleue', nom: 'bleu', fem: 'bleue', mots: ['bleu', 'bleue', 'azur', 'marine'] },
  { id: 'verte', nom: 'vert', fem: 'verte', mots: ['vert', 'verte', 'emeraude'] },
  { id: 'noire', nom: 'noir', fem: 'noire', mots: ['noir', 'noire'] },
  { id: 'doree', nom: 'doré', fem: 'dorée', mots: ['dore', 'doree', 'or', 'jaune'] },
  { id: 'violette', nom: 'violet', fem: 'violette', mots: ['violet', 'violette', 'mauve', 'pourpre'] },
  { id: 'blanche', nom: 'blanc', fem: 'blanche', mots: ['blanc', 'blanche', 'ivoire', 'creme'] },
];
const VARIANTES_TAPIS = COULEURS_TISSU;
const VARIANTES_BANNIERE = [{ id: 'variee', nom: 'varié', fem: 'variée', mots: ['varie', 'variee', 'multicolore', 'bigarre', 'bigarree'] }, ...COULEURS_TISSU];

export const OBJETS = [
  { type: 'pilier',       mots: ['pilier'],                                   l: 1, h: 1, zone: 'grille',    lettre: 'P', symetrique: true, auLarge: true },
  { type: 'colonne',      mots: ['colonne'],                                  l: 1, h: 1, zone: 'grille',    lettre: 'C', feminin: true, symetrique: true, auLarge: true },
  { type: 'coffre',       mots: ['coffre', 'malle'],                          l: 1, h: 1, zone: 'fond',      lettre: 'K', variantes: VARIANTES_COFFRE },
  { type: 'statue',       mots: ['statue', 'gargouille', 'idole'],            l: 1, h: 1, zone: 'centre',    lettre: 'S', feminin: true, auLarge: true, variantes: VARIANTES_STATUE },
  { type: 'table',        mots: ['table'],                                    l: 2, h: 1, zone: 'centre',    lettre: 'T', feminin: true },
  { type: 'chaise',       mots: ['chaise', 'tabouret', 'banc'],               l: 1, h: 1, zone: 'centre',    lettre: 'h', feminin: true },
  { type: 'autel',        mots: ['autel'],                                    l: 2, h: 1, zone: 'fond',      lettre: 'A', variantes: VARIANTES_AUTEL },
  { type: 'trone',        mots: ['trone'],                                    l: 1, h: 1, zone: 'fond',      lettre: 'R', nom: 'trône' },
  { type: 'tonneau',      mots: ['tonneau', 'baril', 'barrique', 'fut'],      l: 1, h: 1, zone: 'coins',     lettre: 'O', symetrique: true, variantes: VARIANTES_TONNEAU },
  { type: 'caisse',       mots: ['caisse', 'caisson', 'cageot'],              l: 1, h: 1, zone: 'coins',     lettre: 'X', feminin: true, symetrique: true, variantes: VARIANTES_CAISSE },
  { type: 'escalier',     mots: ['escalier', 'marche'],                       l: 1, h: 2, zone: 'coins',     lettre: 'E' },
  { type: 'fosse',        mots: ['fosse', 'trou', 'gouffre', 'piege', 'trappe'], l: 1, h: 1, zone: 'centre', lettre: 'F', feminin: true, symetrique: true, couche: 0 },
  { type: 'lit',          mots: ['lit', 'couchette', 'paillasse'],            l: 1, h: 2, zone: 'cotes',     lettre: 'L' },
  { type: 'bibliotheque', mots: ['bibliotheque', 'etagere', 'rayonnage'],     l: 2, h: 1, zone: 'fond',      lettre: 'B', nom: 'bibliothèque', feminin: true, variantes: VARIANTES_BIBLIOTHEQUE },
  { type: 'torche',       mots: ['torche', 'flambeau'], l: 1, h: 1, zone: 'perimetre', lettre: '*', feminin: true, bloquant: false, couche: 9, variantes: VARIANTES_FEU },
  { type: 'debris',       mots: ['debris', 'gravat', 'eboulis', 'decombre', 'ruine'], l: 1, h: 1, zone: 'aleatoire', lettre: '%', nom: 'débris', symetrique: true, couche: 1 },
  { type: 'puits',        mots: ['puits'],                                    l: 1, h: 1, zone: 'centre',    lettre: 'U', symetrique: true, variantes: VARIANTES_PUITS },
  { type: 'fontaine',     mots: ['fontaine', 'bassin'],                       l: 1, h: 1, zone: 'centre',    lettre: 'W', feminin: true, symetrique: true, variantes: VARIANTES_FONTAINE },
  { type: 'sarcophage',   mots: ['sarcophage', 'tombeau', 'cercueil'],        l: 1, h: 2, zone: 'centre',    lettre: 'Z', variantes: VARIANTES_SARCOPHAGE },
  { type: 'brasero',      mots: ['brasero', 'brasier', 'vasque de feu'],      l: 1, h: 1, zone: 'coins',     lettre: 'V', symetrique: true, variantes: VARIANTES_FEU },
  { type: 'bougies',      mots: ['bougie', 'chandelle', 'chandelier', 'cierge'], l: 1, h: 1, zone: 'aleatoire', lettre: '!', nom: 'bougie', feminin: true, symetrique: true, bloquant: false, couche: 6, variantes: VARIANTES_FEU },
  { type: 'tapis',        mots: ['tapis', 'carpette'],                        l: 3, h: 2, zone: 'centre',    lettre: '=', symetrique: true, bloquant: false, couche: -1, variantes: VARIANTES_TAPIS },
  { type: 'banniere',     mots: ['banniere', 'etendard', 'tenture', 'tapisserie', 'oriflamme'], l: 1, h: 1, zone: 'perimetre', lettre: 'N', nom: 'bannière', feminin: true, bloquant: false, couche: 8, variantes: VARIANTES_BANNIERE },
  { type: 'feudecamp',    mots: ['feu de camp', 'feu de bois', 'feu de joie', 'foyer', 'feu'], l: 1, h: 1, zone: 'centre', lettre: 'Y', nom: 'feu de camp', pluriel: 'feux de camp', symetrique: true, variantes: VARIANTES_FEU },
  { type: 'flaque',       mots: ['flaque', 'mare'],                           l: 2, h: 1, zone: 'aleatoire', lettre: '~', feminin: true, symetrique: true, bloquant: false, couche: 0 },
  { type: 'rocher',       mots: ['rocher', 'roc', 'bloc de pierre', 'bloc de roche'], l: 1, h: 1, zone: 'aleatoire', lettre: '^', symetrique: true },
  { type: 'champignons',  mots: ['champignon'],                               l: 1, h: 1, zone: 'coins',     lettre: 'M', nom: 'champignon', symetrique: true, bloquant: false },
  { type: 'toile',        mots: ['toile d araignee', 'toile'],                l: 1, h: 1, zone: 'coins',     lettre: '#', nom: 'toile d’araignée', pluriel: 'toiles d’araignée', feminin: true, symetrique: true, bloquant: false, couche: 7 },
  { type: 'ossements',    mots: ['ossement', 'tas d os', 'tas d ossements', 'os', 'crane'], l: 1, h: 1, zone: 'aleatoire', lettre: 'I', nom: 'ossement', symetrique: true, bloquant: false, couche: 2 },
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
/** Pluriel propre d'un type (« feux de camp »), ou undefined quand le nom suit la règle ordinaire (voir nomAffiche dans parseur/lexique.js). */
export const plurielDe = (type) => PAR_TYPE.get(type)?.pluriel;
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

// --- Variantes d'objet ---------------------------------------------------------------------------------------

/** Les variantes d'un type d'objet (voir l'en-tête), la défaut en premier ; liste vide pour un type qui n'en a pas. */
export const variantesDe = (type) => PAR_TYPE.get(type)?.variantes ?? [];
/** L'id de la variante par défaut d'un type (la première), ou null s'il n'a pas de variantes. */
export const varianteParDefaut = (type) => variantesDe(type)[0]?.id ?? null;
/** La variante `id` est-elle connue de ce type ? */
export const varianteConnue = (type, id) => variantesDe(type).some((v) => v.id === id);
/** La variante effective d'un objet du plan : la sienne si elle est connue de son type, sinon la défaut (null si le type n'en a pas). */
export const varianteDe = (objet) => (objet && varianteConnue(objet.type, objet.variante) ? objet.variante : varianteParDefaut(objet?.type));
/** L'objet porte-t-il une variante qui n'est pas la défaut ? */
export const aUneVariante = (objet) => { const v = varianteDe(objet); return v !== null && v !== varianteParDefaut(objet.type); };
/** L'id de la variante d'un type que désigne ce mot du texte (sans accents, singulier ou pluriel en -s), ou null. */
export function variantePourMot(type, mot) {
  const singulier = mot.replace(/s$/, '');
  return variantesDe(type).find((v) => v.mots.includes(mot) || v.mots.includes(singulier))?.id ?? null;
}
/** Le nom d'une variante, accordé au type (« éteinte » pour une torche, « éteint » pour un brasero) et au nombre n. */
export function nomVariante(type, id, n = 1) {
  const v = variantesDe(type).find((x) => x.id === id);
  if (!v) return '';
  const feminin = estFeminin(type);
  const base = feminin ? (v.fem ?? `${v.nom}e`) : v.nom;
  if (n <= 1 || v.invariable || /[sx]$/.test(base)) return base;
  if (!feminin) return v.pluriel ?? (/al$/.test(base) ? base.replace(/al$/, 'aux') : `${base}s`); // « normal » → « normaux », « infernal » → « infernaux »
  return `${base}s`;
}
