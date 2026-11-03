/**
 * Fiche au hasard : des paramètres et un numéro de tirage → des fiches complètes, au format de l'outil Fiche.
 * Module PUR (sans DOM), testable sous Node. Le pendant de generateur.js, avec les mêmes règles :
 * le même numéro et les mêmes paramètres redonnent les mêmes fiches, et le résultat se retouche ensuite comme une fiche écrite à la main.
 *
 * Il sert à deux endroits : le Donjon (qui en garde le résumé de personnages.js) et la Fiche (qui les enregistre telles quelles).
 *
 * Règles de construction, inspirées de la 5e édition :
 *  - caractéristiques : 4d6 sans le plus bas, rangées selon les priorités de la classe, puis bonus de race et, aux niveaux 4, 8, 12, 16 et 19,
 *    +2 à la caractéristique principale (20 au plus) ;
 *  - PV : le dé de vie entier au niveau 1, sa moyenne ensuite ; bonus de maîtrise, attaques et emplacements de sorts suivent le niveau ;
 *  - dans un groupe, les classes ne se répètent qu'une fois toutes tirées.
 */
import { generateur, lireGraine, nouvelleGraine, melanger, GRAINE_MAX } from './alea.js';

export { GRAINE_MAX };

const STATS = ['FOR', 'DEX', 'CON', 'INT', 'SAG', 'CHA'];
const FLECHES = 'Flèches', CARREAUX = 'Carreaux';

/** Une attaque : `car` est sa caractéristique (`fin` : la meilleure de FOR et DEX). Un sort ne rajoute pas sa caractéristique aux dégâts. */
const arme = (n, de, car, note = '', ammo = '') => ({ n, de, car, note, ammo });
const sort = (n, de, car, note) => ({ n, de, car, note, sort: true });
const objet = (n, q = 1) => ({ n, q, type: 'objet' });
const BOUCLIER = { n: 'Bouclier', q: 1, type: 'equip', acb: 2, eq: true };
const artsMartiaux = (lvl) => `1d${lvl >= 17 ? 10 : lvl >= 11 ? 8 : lvl >= 5 ? 6 : 4}`;

/**
 * priorites : les caractéristiques de la classe, de la plus utile à la moins utile ; `magie` : full, demi, pacte, ou rien.
 * ca(m) : classe d'armure de base (sans bouclier, qui est un objet équipé du sac), selon les modificateurs.
 */
export const CLASSES = {
  barbare: { nom: 'Barbare', de: 12, priorites: ['FOR', 'CON', 'DEX'], sauvegardes: ['FOR', 'CON'], nbCompetences: 2,
    competences: ['Athlétisme', 'Dressage', 'Intimidation', 'Nature', 'Perception', 'Survie'], ca: (m) => 10 + m.DEX + m.CON,
    attaques: () => [arme('Hache à deux mains', '1d12', 'FOR', 'Lourde, à deux mains'), arme('Javeline', '1d6', 'FOR', 'Lancer 9/36 m')],
    sac: [objet('Hache à deux mains'), objet('Javeline', 4), objet('Sac d’explorateur')],
    capacites: (lvl) => [{ n: 'Rage', max: lvl >= 17 ? 6 : lvl >= 12 ? 5 : lvl >= 6 ? 4 : lvl >= 3 ? 3 : 2, rest: 'long' }] },
  barde: { nom: 'Barde', de: 8, priorites: ['CHA', 'DEX', 'CON'], sauvegardes: ['DEX', 'CHA'], nbCompetences: 3, magie: 'full',
    competences: ['Acrobaties', 'Discrétion', 'Escamotage', 'Intuition', 'Persuasion', 'Représentation', 'Tromperie'], ca: (m) => 11 + m.DEX,
    attaques: () => [arme('Rapière', '1d8', 'fin', 'Finesse'), arme('Dague', '1d4', 'fin', 'Finesse, lancer 6/18 m')],
    sac: [objet('Rapière'), objet('Dague'), objet('Armure de cuir'), objet('Luth'), objet('Sac d’artiste')],
    capacites: (lvl, m) => [{ n: 'Inspiration bardique', max: Math.max(1, m.CHA), rest: lvl >= 5 ? 'court' : 'long' }] },
  clerc: { nom: 'Clerc', de: 8, priorites: ['SAG', 'CON', 'FOR'], sauvegardes: ['SAG', 'CHA'], nbCompetences: 2, magie: 'full',
    competences: ['Histoire', 'Intuition', 'Médecine', 'Persuasion', 'Religion'], ca: (m) => 14 + Math.min(m.DEX, 2),
    attaques: () => [arme('Masse d’armes', '1d6', 'FOR'), arme('Arbalète légère', '1d8', 'DEX', '24/96 m', CARREAUX)],
    sac: [objet('Masse d’armes'), objet('Arbalète légère'), objet('Armure d’écailles'), BOUCLIER, objet('Symbole sacré'), objet('Sac d’ecclésiastique')],
    munitions: [{ n: CARREAUX, q: 20, spent: 0 }],
    capacites: (lvl) => (lvl >= 2 ? [{ n: 'Conduit divin', max: lvl >= 18 ? 3 : lvl >= 6 ? 2 : 1, rest: 'court' }] : []) },
  druide: { nom: 'Druide', de: 8, priorites: ['SAG', 'CON', 'DEX'], sauvegardes: ['INT', 'SAG'], nbCompetences: 2, magie: 'full',
    competences: ['Arcanes', 'Dressage', 'Intuition', 'Médecine', 'Nature', 'Perception', 'Religion', 'Survie'], ca: (m) => 11 + m.DEX,
    attaques: (lvl) => [arme('Cimeterre', '1d6', 'fin', 'Finesse, légère'), sort('Flammes', `${degatsSort(lvl)}d8`, 'SAG', 'Sort mineur, 9 m')],
    sac: [objet('Cimeterre'), objet('Armure de cuir'), BOUCLIER, objet('Focaliseur druidique'), objet('Sac d’explorateur')],
    capacites: (lvl) => (lvl >= 2 ? [{ n: 'Forme sauvage', max: 2, rest: 'court' }] : []) },
  ensorceleur: { nom: 'Ensorceleur', de: 6, priorites: ['CHA', 'CON', 'DEX'], sauvegardes: ['CON', 'CHA'], nbCompetences: 2, magie: 'full',
    competences: ['Arcanes', 'Intimidation', 'Intuition', 'Persuasion', 'Religion', 'Tromperie'], ca: (m) => 10 + m.DEX,
    attaques: (lvl) => [sort('Trait de feu', `${degatsSort(lvl)}d10`, 'CHA', 'Sort mineur, 36 m'), arme('Dague', '1d4', 'fin', 'Finesse, lancer 6/18 m')],
    sac: [objet('Dague', 2), objet('Focaliseur arcanique'), objet('Sac d’exploration souterraine')],
    capacites: (lvl) => (lvl >= 2 ? [{ n: 'Points de sorcellerie', max: Math.min(20, lvl), rest: 'long' }] : []) },
  guerrier: { nom: 'Guerrier', de: 10, priorites: ['FOR', 'CON', 'DEX'], sauvegardes: ['FOR', 'CON'], nbCompetences: 2,
    competences: ['Acrobaties', 'Athlétisme', 'Dressage', 'Histoire', 'Intimidation', 'Intuition', 'Perception', 'Survie'], ca: () => 16,
    attaques: () => [arme('Épée longue', '1d8', 'FOR', 'Polyvalente (1d10)'), arme('Arc long', '1d8', 'DEX', '45/180 m', FLECHES)],
    sac: [objet('Épée longue'), objet('Arc long'), objet('Cotte de mailles'), BOUCLIER, objet('Sac d’explorateur')],
    munitions: [{ n: FLECHES, q: 20, spent: 0 }],
    capacites: (lvl) => [{ n: 'Second souffle', max: 1, rest: 'court' }, ...(lvl >= 2 ? [{ n: 'Fougue', max: lvl >= 17 ? 2 : 1, rest: 'court' }] : [])] },
  magicien: { nom: 'Magicien', de: 6, priorites: ['INT', 'CON', 'DEX'], sauvegardes: ['INT', 'SAG'], nbCompetences: 2, magie: 'full',
    competences: ['Arcanes', 'Histoire', 'Intuition', 'Investigation', 'Médecine', 'Religion'], ca: (m) => 10 + m.DEX,
    attaques: (lvl) => [sort('Trait de feu', `${degatsSort(lvl)}d10`, 'INT', 'Sort mineur, 36 m'), arme('Bâton', '1d6', 'FOR', 'Polyvalent (1d8)')],
    sac: [objet('Bâton'), objet('Grimoire'), objet('Focaliseur arcanique'), objet('Sac d’érudit')],
    capacites: () => [{ n: 'Restauration arcanique', max: 1, rest: 'long' }] },
  moine: { nom: 'Moine', de: 8, priorites: ['DEX', 'SAG', 'CON'], sauvegardes: ['FOR', 'DEX'], nbCompetences: 2,
    competences: ['Acrobaties', 'Athlétisme', 'Discrétion', 'Histoire', 'Intuition', 'Religion'], ca: (m) => 10 + m.DEX + m.SAG,
    attaques: (lvl) => [arme('Épée courte', artsMartiaux(lvl) === '1d4' ? '1d6' : artsMartiaux(lvl), 'fin', 'Arme de moine'), arme('Mains nues', artsMartiaux(lvl), 'fin', 'Arts martiaux')],
    sac: [objet('Épée courte'), objet('Fléchette', 10), objet('Sac d’explorateur')],
    capacites: (lvl) => (lvl >= 2 ? [{ n: 'Points de ki', max: Math.min(20, lvl), rest: 'court' }] : []) },
  occultiste: { nom: 'Occultiste', de: 8, priorites: ['CHA', 'CON', 'DEX'], sauvegardes: ['SAG', 'CHA'], nbCompetences: 2, magie: 'pacte',
    competences: ['Arcanes', 'Histoire', 'Intimidation', 'Investigation', 'Nature', 'Religion', 'Tromperie'], ca: (m) => 11 + m.DEX,
    attaques: (lvl) => [sort('Décharge occulte', `${degatsSort(lvl)}d10`, 'CHA', 'Sort mineur, 36 m'), arme('Dague', '1d4', 'fin', 'Finesse, lancer 6/18 m')],
    sac: [objet('Dague', 2), objet('Armure de cuir'), objet('Focaliseur arcanique'), objet('Sac d’érudit')],
    capacites: () => [] },
  paladin: { nom: 'Paladin', de: 10, priorites: ['FOR', 'CHA', 'CON'], sauvegardes: ['SAG', 'CHA'], nbCompetences: 2, magie: 'demi',
    competences: ['Athlétisme', 'Intimidation', 'Intuition', 'Médecine', 'Persuasion', 'Religion'], ca: () => 16,
    attaques: () => [arme('Épée longue', '1d8', 'FOR', 'Polyvalente (1d10)'), arme('Javeline', '1d6', 'FOR', 'Lancer 9/36 m')],
    sac: [objet('Épée longue'), objet('Javeline', 5), objet('Cotte de mailles'), BOUCLIER, objet('Symbole sacré'), objet('Sac d’ecclésiastique')],
    capacites: (lvl, m) => [{ n: 'Sens divin', max: Math.max(1, 1 + m.CHA), rest: 'long' }] },
  rodeur: { nom: 'Rôdeur', de: 10, priorites: ['DEX', 'SAG', 'CON'], sauvegardes: ['FOR', 'DEX'], nbCompetences: 3, magie: 'demi',
    competences: ['Athlétisme', 'Discrétion', 'Dressage', 'Intuition', 'Investigation', 'Nature', 'Perception', 'Survie'], ca: (m) => 12 + m.DEX,
    attaques: () => [arme('Arc long', '1d8', 'DEX', '45/180 m', FLECHES), arme('Épée courte', '1d6', 'fin', 'Légère, finesse')],
    sac: [objet('Arc long'), objet('Épée courte', 2), objet('Armure de cuir clouté'), objet('Sac d’explorateur')],
    munitions: [{ n: FLECHES, q: 20, spent: 0 }],
    capacites: () => [] },
  roublard: { nom: 'Roublard', de: 8, priorites: ['DEX', 'INT', 'CON'], sauvegardes: ['DEX', 'INT'], nbCompetences: 4,
    competences: ['Acrobaties', 'Athlétisme', 'Discrétion', 'Escamotage', 'Intimidation', 'Intuition', 'Investigation', 'Perception', 'Persuasion', 'Représentation', 'Tromperie'], ca: (m) => 12 + m.DEX,
    attaques: (lvl) => [arme('Rapière', '1d8', 'fin', `Finesse. Attaque sournoise ${Math.ceil(lvl / 2)}d6`), arme('Arc court', '1d6', 'DEX', '24/96 m', FLECHES)],
    sac: [objet('Rapière'), objet('Arc court'), objet('Armure de cuir clouté'), objet('Outils de voleur'), objet('Sac de cambrioleur')],
    munitions: [{ n: FLECHES, q: 20, spent: 0 }],
    capacites: () => [] },
};

/** bonus : aux caractéristiques ; vitesse : en mètres ; prenoms : tirés pour le nom. */
export const RACES = {
  demiElfe: { nom: 'Demi-elfe', bonus: { CHA: 2, DEX: 1, CON: 1 }, vitesse: 9, prenoms: ['Elwen', 'Tamar', 'Lysa', 'Ariel', 'Séléna', 'Dorian', 'Maelis', 'Corwin'] },
  demiOrc: { nom: 'Demi-orc', bonus: { FOR: 2, CON: 1 }, vitesse: 9, prenoms: ['Grom', 'Ursa', 'Karg', 'Shara', 'Dorn', 'Vola', 'Thokk', 'Brena'] },
  drakeide: { nom: 'Drakéide', bonus: { FOR: 2, CHA: 1 }, vitesse: 9, prenoms: ['Kava', 'Rhazin', 'Sora', 'Torinn', 'Nala', 'Medrash', 'Akra', 'Vorn'] },
  elfe: { nom: 'Elfe', bonus: { DEX: 2, INT: 1 }, vitesse: 9, prenoms: ['Aelar', 'Lia', 'Thamior', 'Naeris', 'Varis', 'Sylwen', 'Erevan', 'Mirael'] },
  gnome: { nom: 'Gnome', bonus: { INT: 2, CON: 1 }, vitesse: 7.5, prenoms: ['Boddyn', 'Nissa', 'Fibble', 'Lilli', 'Wrenn', 'Dimble', 'Tana', 'Zook'] },
  halfelin: { nom: 'Halfelin', bonus: { DEX: 2, CHA: 1 }, vitesse: 7.5, prenoms: ['Milo', 'Rosie', 'Perrin', 'Lidda', 'Corrin', 'Nedda', 'Tobin', 'Pia'] },
  humain: { nom: 'Humain', bonus: { FOR: 1, DEX: 1, CON: 1, INT: 1, SAG: 1, CHA: 1 }, vitesse: 9, prenoms: ['Alda', 'Bran', 'Cécile', 'Gauthier', 'Mira', 'Roland', 'Isaure', 'Tristan'] },
  nain: { nom: 'Nain', bonus: { CON: 2, FOR: 2 }, vitesse: 7.5, prenoms: ['Thorin', 'Dagna', 'Brok', 'Helga', 'Rurik', 'Sigrid', 'Baern', 'Ilde'] },
  tieffelin: { nom: 'Tieffelin', bonus: { CHA: 2, INT: 1 }, vitesse: 9, prenoms: ['Akmenos', 'Damaia', 'Lérissa', 'Morthos', 'Nemeia', 'Zariel', 'Skamos', 'Orianna'] },
};

const SURNOMS = ['Brisevent', 'Cœurfort', 'Longuemain', 'Fendroc', 'Vifargent', 'Sombrelame', 'Clairval', 'Ferrebrume', 'Hautepierre', 'Noirbois', 'Rochefeu', 'Dorevent'];

/** Valeurs de départ et bornes des nombres : [défaut, minimum, maximum]. */
export const BORNES = { nombre: [1, 1, 8], niveau: [1, 1, 20] };

/** Emplacements de sorts d'un lanceur complet, par niveau : emplacements par niveau de sort. */
const EMPLACEMENTS = [[], [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1]];

const mod = (v) => Math.floor((v - 10) / 2);
const maitrise = (lvl) => 2 + Math.floor((lvl - 1) / 4);
/** Les sorts mineurs gagnent un dé aux niveaux 5, 11 et 17. */
function degatsSort(lvl) { return 1 + (lvl >= 5) + (lvl >= 11) + (lvl >= 17); }

/** Bornes appliquées, classe et race inconnues écartées. Sans numéro de tirage valable : `graine` reste null, à l'appelant d'en tirer un. */
export function normaliserOptions(brut = {}) {
  const nombre = (cle) => {
    const [defaut, min, max] = BORNES[cle];
    const v = Math.round(Number(brut[cle]));
    return Number.isFinite(v) && brut[cle] !== '' && brut[cle] !== null && brut[cle] !== undefined ? Math.max(min, Math.min(max, v)) : defaut;
  };
  const connu = (table, cle) => (typeof cle === 'string' && Object.hasOwn(table, cle) ? cle : null);
  return { nombre: nombre('nombre'), niveau: nombre('niveau'), classe: connu(CLASSES, brut.classe), race: connu(RACES, brut.race), graine: lireGraine(brut.graine) };
}

function emplacements(magie, lvl) {
  let parNiveau = [];
  if (magie === 'full') parNiveau = EMPLACEMENTS[lvl];
  else if (magie === 'demi') parNiveau = lvl >= 2 ? EMPLACEMENTS[Math.ceil(lvl / 2)] : [];
  else if (magie === 'pacte') {
    const niveauSort = Math.min(5, Math.ceil(lvl / 2)) - 1;
    parNiveau = Array.from({ length: niveauSort + 1 }, (_, i) => (i < niveauSort ? 0 : lvl >= 17 ? 4 : lvl >= 11 ? 3 : lvl >= 2 ? 2 : 1));
  }
  return Array.from({ length: 9 }, (_, i) => ({ max: parNiveau[i] || 0, used: 0 }));
}

function caracteristiques(classe, race, lvl, alea) {
  const de = () => 1 + Math.floor(alea() * 6);
  const tirages = Array.from({ length: 6 }, () => {
    const des = [de(), de(), de(), de()].sort((a, b) => a - b);
    return des[1] + des[2] + des[3];
  }).sort((a, b) => b - a);
  const reste = melanger(STATS.filter((s) => !classe.priorites.includes(s)), alea);
  const stats = {};
  [...classe.priorites, ...reste].forEach((s, i) => { stats[s] = tirages[i]; });
  for (const [s, b] of Object.entries(race.bonus)) stats[s] = Math.min(20, stats[s] + b);
  for (const palier of [4, 8, 12, 16, 19]) {
    if (lvl < palier) break;
    const cible = classe.priorites.find((s) => stats[s] < 20);
    if (cible) stats[cible] = Math.min(20, stats[cible] + 2);
  }
  return Object.fromEntries(STATS.map((s) => [s, stats[s]])); // toujours dans le même ordre
}

function ficheComplete(classe, race, nom, lvl, alea) {
  const stats = caracteristiques(classe, race, lvl, alea);
  const m = Object.fromEntries(STATS.map((s) => [s, mod(stats[s])]));
  const prof = maitrise(lvl);
  const moyenne = Math.floor(classe.de / 2) + 1;
  const hpMax = Math.max(lvl, classe.de + m.CON + (lvl - 1) * (moyenne + m.CON));
  const attaques = classe.attaques(lvl).map((a) => {
    const bonus = a.car === 'fin' ? Math.max(m.FOR, m.DEX) : m[a.car];
    const degats = a.sort || !bonus ? a.de : `${a.de}${bonus > 0 ? '+' : '-'}${Math.abs(bonus)}`;
    return { n: a.n, hit: prof + bonus, dmg: degats, ammo: a.ammo || '', note: a.note || '' };
  });
  return {
    example: false, name: nom, guild: '', race: race.nom, cls: classe.nom, lvl, hpMax, hp: hpMax, tmp: 0,
    ac: classe.ca(m), speed: race.vitesse, init: m.DEX, prof, stats, saves: { s: 0, f: 0 }, conds: [], exh: 0, conc: false,
    saveProf: [...classe.sauvegardes],
    skills: Object.fromEntries(melanger(classe.competences, alea).slice(0, classe.nbCompetences).map((c) => [c, 1])),
    attacks: attaques,
    res: classe.capacites(lvl, m).map((c) => ({ ...c, used: 0 })),
    hd: { die: classe.de, used: 0 },
    ammo: (classe.munitions || []).map((a) => ({ ...a })),
    slots: emplacements(classe.magie, lvl),
    coins: { pp: 0, po: 5 + Math.floor(alea() * 20), pa: Math.floor(alea() * 10), pc: 0 },
    inv: [...classe.sac.map((o) => ({ ...o })), { n: 'Rations (1 jour)', q: 5, type: 'conso', act: 'none' }, { n: 'Potion de soins', q: 1, type: 'soin', dice: '2d4+2', act: 'bonus' }],
    log: [],
  };
}

/**
 * Génère des fiches.
 * @param {object} brut  nombre, niveau, classe, race, graine (voir normaliserOptions)
 * @returns {{fiches:object[], graine:number, resume:Array<{nom:string,race:string,classe:string,niveau:number}>}}
 */
export function genererFiches(brut = {}) {
  const o = normaliserOptions(brut);
  const graine = o.graine ?? nouvelleGraine();
  const alea = generateur(graine);
  const tirer = (liste) => liste[Math.floor(alea() * liste.length)];
  const classes = melanger(Object.keys(CLASSES), alea);
  const pris = new Set();
  const fiches = Array.from({ length: o.nombre }, (_, i) => {
    const classe = CLASSES[o.classe ?? classes[i % classes.length]];
    const race = RACES[o.race ?? tirer(Object.keys(RACES))];
    let nom;
    do nom = `${tirer(race.prenoms)} ${tirer(SURNOMS)}`; while (pris.has(nom));
    pris.add(nom);
    return ficheComplete(classe, race, nom, o.niveau, alea);
  });
  return { fiches, graine, resume: fiches.map((f) => ({ nom: f.name, race: f.race, classe: f.cls, niveau: f.lvl })) };
}

/** « Mira Brisevent (Humain, Barde, niveau 1) » */
export const decrireTirage = ({ nom, race, classe, niveau }) => `${nom} (${race}, ${classe}, niveau ${niveau})`;
