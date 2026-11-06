/**
 * Donjon au hasard : des paramètres et un numéro de tirage → un donjon complet. Module PUR (sans DOM), testable sous Node.
 *
 * Le même numéro et les mêmes paramètres redonnent le même donjon. Comme partout dans l'outil, chaque salle est décrite par
 * un TEXTE, relu par le parseur : le MJ peut donc tout retoucher ensuite comme s'il l'avait écrit.
 *
 * Choix de construction :
 *  - les salles poussent sur une grille invisible, chacune contre une voisine. Une liaison ne relie que deux voisines de
 *    grille, une par mur : le plan a ainsi très peu de croisements, boucles comprises ;
 *  - les nombres demandés sont tenus exactement : une salle trop petite pour ce qu'on y met est agrandie et relue ;
 *  - la salle d'entrée reste sans monstre, ni coffre, ni piège, et le boss attend dans la salle la plus éloignée ;
 *  - une porte secrète ne coupe jamais le chemin vers le reste du donjon : elle ferme une boucle, sinon une salle au bout d'un chemin.
 */
import * as modele from './donjon.js';
import { analyser } from './parseur/index.js';
import { debutDescription, decrire } from './parseur/decrire.js';
import { MOTS_AMBIANCE } from './parseur/ambiance.js';
import { nomAffiche } from './parseur/lexique.js';
import { CREATURES } from './catalogue.js';
import { reperePorte } from './coordonnees.js';
import { OPPOSE, VECTEUR, longueurMur, portesEntreeDabord } from './murs.js';
import { POSITIONS_FORMES, brasMax, retraitPorte, nombreCases, estSol } from './formes.js';
import { redimensionner, changerForme } from './pose.js';
import { generateur, lireGraine, nouvelleGraine, melanger, GRAINE_MAX } from './alea.js';

export { GRAINE_MAX };

/** Familles de monstres : `troupe` peuple les salles, `boss` attend au fond. */
export const FAMILLES = {
  gobelins: { libelle: 'Gobelins et orques', nom: 'Repaire gobelin', troupe: ['gobelin', 'kobold', 'hobgobelin', 'orque', 'gnoll'], boss: ['troll', 'ogre'] },
  morts: { libelle: 'Morts-vivants', nom: 'Crypte oubliée', troupe: ['squelette', 'zombie', 'goule', 'spectre'], boss: ['vampire', 'liche'] },
  betes: { libelle: 'Bêtes', nom: 'Antre des bêtes', troupe: ['rat', 'loup', 'araignee', 'harpie', 'ours'], boss: ['manticore', 'basilic'] },
  brigands: { libelle: 'Brigands et cultistes', nom: 'Planque des brigands', troupe: ['bandit', 'cultiste'], boss: ['golem', 'elementaire'] },
  colosses: { libelle: 'Colosses', nom: 'Forteresse des colosses', troupe: ['ogre', 'troll', 'minotaure', 'golem'], boss: ['geant'] },
  dragons: { libelle: 'Dragons', nom: 'Antre du dragon', troupe: ['dragonnet', 'basilic', 'wyverne'], boss: ['dragon', 'hydre'] },
};

/** Valeurs de départ et bornes des nombres : [défaut, minimum, maximum]. */
export const BORNES = {
  salles: [8, 1, 30], monstres: [15, 0, 150], coffres: [4, 0, 40], pieges: [2, 0, 30], secretes: [1, 0, 10], boucles: [2, 0, 12],
};

const ROLES = [
  { nom: 'Salle des gardes', contenu: ['une table', '2 lits', '2 tonneaux'] },
  { nom: 'Armurerie', contenu: ['3 caisses', '2 tonneaux'] },
  { nom: 'Cuisine', sol: 'bois', contenu: ['une table', '2 tonneaux', 'une caisse'] },
  { nom: 'Cellier', contenu: ['4 tonneaux', '2 caisses'] },
  { nom: 'Dortoir', sol: 'bois', contenu: ['4 lits', 'une caisse'] },
  { nom: 'Bibliothèque', sol: 'bois', contenu: ['3 bibliotheques', 'une table'] },
  { nom: 'Chapelle', forme: 'croix', contenu: ['un autel', '2 statues', '2 torches'] },
  { nom: 'Crypte', contenu: ['3 sarcophages', '2 debris'] },
  { nom: 'Salle du puits', contenu: ['un puits', '2 debris'] },
  { nom: 'Salle de la fontaine', sol: 'marbre', forme: 'octogone', contenu: ['une fontaine', '2 statues'] },
  { nom: 'Prison', contenu: ['2 lits', '3 debris'] },
  { nom: 'Caverne', sol: 'terre', contenu: ['4 debris'] },
  { nom: 'Ossuaire', contenu: ['2 sarcophages', '3 debris'] },
  { nom: 'Laboratoire', contenu: ['une table', 'une bibliotheque', '2 caisses'] },
  { nom: 'Salle aux colonnes', sol: 'marbre', contenu: ['4 colonnes', '2 torches'] },
  { nom: 'Réserve', contenu: ['4 caisses', '2 tonneaux'] },
];
const ENTREE = { nom: 'Hall d’entrée', contenu: ['2 torches'] };
const BOSS = { nom: 'Salle du trône', sol: 'marbre', contenu: ['un trone', '4 colonnes', '2 torches'] };

const FORMES_TIRABLES = ['croix', 'L', 'T', 'U', 'octogone'];
const CHANCE_FORME = 0.3;       // part des salles assez grandes qui ne sont pas rectangulaires
const COTE_FORME_MIN = 7;       // en dessous, une forme laisse trop peu de sol
const PLACE_PAR_MONSTRE = 2.2;  // cases de sol prévues par case de pion : la salle reste jouable
const PLACE_DECOR = 10;         // cases de sol prévues pour le mobilier, les coffres et les pièges
const ESSAIS_FORME = 6;         // tirages de forme et de dimensions essayés avant de se contenter de remplir
const ESSAIS_SALLE = 10;        // agrandissements au plus, si tout ne tient pas
const PAR_PHRASE = 40;          // le parseur lit au plus 40 éléments par groupe de mots

const tailleDe = (type) => CREATURES.find((c) => c.type === type).taille;

/** Bornes appliquées, familles inconnues écartées. Sans numéro de tirage valable : `graine` reste null, à l'appelant d'en tirer un. */
export function normaliserOptions(brut = {}) {
  const nombre = (cle) => {
    const [defaut, min, max] = BORNES[cle];
    const v = Math.round(Number(brut[cle]));
    return Number.isFinite(v) && brut[cle] !== '' && brut[cle] !== null && brut[cle] !== undefined ? Math.max(min, Math.min(max, v)) : defaut;
  };
  return {
    ...Object.fromEntries(Object.keys(BORNES).map((cle) => [cle, nombre(cle)])),
    familles: (Array.isArray(brut.familles) ? brut.familles : []).filter((f) => f in FAMILLES),
    formes: brut.formes !== false,
    boss: brut.boss !== false,
    graine: lireGraine(brut.graine),
  };
}

/** Les salles sur leur grille, reliées en arbre. @returns {{cases:Array<{x,y}>, arbre:Array<{a,b,mur}>}}  mur : celui de `a`, vers `b` */
function pousser(n, alea) {
  const cases = [{ x: 0, y: 0 }];
  const prises = new Set(['0,0']);
  const arbre = [];
  const libres = ({ x, y }) => Object.entries(VECTEUR).filter(([, [dx, dy]]) => !prises.has(`${x + dx},${y + dy}`));
  for (let i = 1; i < n; i++) {
    // Plus souvent depuis la dernière salle : on obtient des enfilades, pas une pelote autour de l'entrée.
    const derniere = i - 1;
    const candidates = cases.map((_, k) => k).filter((k) => libres(cases[k]).length);
    const depuis = alea() < 0.55 && candidates.includes(derniere) ? derniere : candidates[Math.floor(alea() * candidates.length)];
    const choix = libres(cases[depuis]);
    const [mur, [dx, dy]] = choix[Math.floor(alea() * choix.length)];
    const c = { x: cases[depuis].x + dx, y: cases[depuis].y + dy };
    cases.push(c);
    prises.add(`${c.x},${c.y}`);
    arbre.push({ a: depuis, b: i, mur });
  }
  return { cases, arbre };
}

/** Voisines de grille pas encore reliées : ce sont les boucles possibles. */
function bouclesPossibles(cases, arbre) {
  const index = new Map(cases.map((c, i) => [`${c.x},${c.y}`, i]));
  const reliees = new Set(arbre.flatMap(({ a, b }) => [`${a},${b}`, `${b},${a}`]));
  const res = [];
  cases.forEach((c, a) => {
    for (const mur of ['est', 'sud']) {
      const [dx, dy] = VECTEUR[mur];
      const b = index.get(`${c.x + dx},${c.y + dy}`);
      if (b !== undefined && !reliees.has(`${a},${b}`)) res.push({ a, b, mur });
    }
  });
  return res;
}

/** Répartit `total` unités sur `salles`, à poids tirés au sort : certaines salles en ont beaucoup, d'autres peu ou pas. */
function repartir(total, salles, alea) {
  const poids = salles.map(() => alea() ** 2 + 0.05);
  const somme = poids.reduce((a, b) => a + b, 0);
  const parts = new Map(salles.map((s) => [s, 0]));
  for (let k = 0; k < total; k++) {
    let t = alea() * somme;
    let i = 0;
    while (i < salles.length - 1 && t >= poids[i]) t -= poids[i++];
    parts.set(salles[i], parts.get(salles[i]) + 1);
  }
  return parts;
}

/** Ajoute `n` monstres à `monstres` : une salle n'abrite qu'un ou deux types, on croise des groupes, pas un inventaire. */
function peupler(n, troupe, alea, monstres) {
  const tirer = (liste) => liste[Math.floor(alea() * liste.length)];
  const types = [tirer(troupe), tirer(troupe)];
  for (let k = n; k > 0; k--) {
    const type = alea() < 0.75 ? types[0] : types[1];
    monstres[type] = (monstres[type] || 0) + 1;
  }
  return monstres;
}

/** Position d'une porte sur un mur : pas dans un coin, et sur le bord de la forme tant que c'est possible. */
function positionPorte(forme, mur, alea) {
  const long = longueurMur(mur, forme.largeur, forme.longueur);
  const toutes = Array.from({ length: long }, (_, i) => i);
  const interieures = long > 2 ? toutes.slice(1, -1) : toutes;
  const auBord = interieures.filter((p) => retraitPorte(forme, mur, p) === 0);
  const choix = auBord.length ? auBord : interieures;
  return choix[Math.floor(alea() * choix.length)];
}

const quantite = (n, mot) => `${n} ${mot}`;

/** Les phrases du contenu tiré au sort : coffres, pièges cachés, monstres (par groupes que le parseur sait lire). */
function phrasesContenu(spec) {
  const parties = [];
  if (spec.coffres) parties.push(quantite(spec.coffres, nomAffiche('coffre', spec.coffres)));
  if (spec.pieges) parties.push(`${spec.pieges} ${spec.pieges > 1 ? 'fosses cachées' : 'fosse cachée'}`);
  for (const [type, n] of Object.entries(spec.monstres)) {
    for (let reste = n; reste > 0; reste -= PAR_PHRASE) {
      const k = Math.min(reste, PAR_PHRASE);
      parties.push(quantite(k, nomAffiche(type, k)));
    }
  }
  return parties;
}

/** Le texte d'une salle, avec des portes déjà placées. `spec.sol` et `spec.ambiance` (phrases) priment sur le rôle, s'ils sont donnés. */
function texteSalle(forme, spec, portes) {
  const parties = debutDescription(forme);
  const sol = spec.sol ?? spec.role.sol;
  if (sol) parties.push(`sol en ${sol}`);
  if (spec.ambiance) parties.push(...spec.ambiance);
  for (const q of portes) parties.push(`${q.type === 'arche' ? 'une arche' : `une porte${q.secrete ? ' secrète' : ''}`} au mur ${q.mur} en ${reperePorte(q.mur, q.position)}`);
  parties.push(...spec.role.contenu);
  parties.push(...phrasesContenu(spec));
  return `${parties.join(', ')}.`;
}

/** Tout ce qui était demandé est-il bien posé dans ce plan ? */
function toutEstPose(plan, spec) {
  const compte = (liste, test) => liste.filter(test).length;
  if (compte(plan.objets, (o) => o.type === 'coffre') !== spec.coffres) return false;
  if (compte(plan.objets, (o) => o.type === 'fosse' && o.cache) !== spec.pieges) return false;
  return Object.entries(spec.monstres).every(([type, n]) => compte(plan.creatures, (k) => k.type === type) === n);
}

/** Construit le texte définitif d'une salle : elle grandit tant que tout n'y tient pas. */
function construireSalle(spec, murs, alea) {
  const demande = Object.entries(spec.monstres).reduce((s, [type, n]) => s + n * tailleDe(type) ** 2 * PLACE_PAR_MONSTRE, 0) + PLACE_DECOR + 2 * (spec.coffres + spec.pieges);
  const grossissement = Math.max(1, Math.sqrt(demande / (spec.largeur * spec.longueur)));
  const coteMin = Math.max(1, ...Object.keys(spec.monstres).map(tailleDe));
  let largeur = Math.max(coteMin, Math.ceil(spec.largeur * grossissement));
  let longueur = Math.max(coteMin, Math.ceil(spec.longueur * grossissement));
  // Toujours la même suite de tirages, quel que soit le nombre d'agrandissements : on tire la forme une fois pour toutes.
  const tirageForme = { chance: alea(), forme: alea(), position: alea() };
  const fractions = murs.map(() => alea());
  let portes = [], texte = '', dernier = null;
  for (let essai = 0; essai < ESSAIS_SALLE; essai++) {
    const forme = { largeur, longueur, forme: 'rectangle' };
    if (spec.formes && Math.min(largeur, longueur) >= COTE_FORME_MIN && (spec.role.forme || tirageForme.chance < CHANCE_FORME)) {
      forme.forme = spec.role.forme || FORMES_TIRABLES[Math.floor(tirageForme.forme * FORMES_TIRABLES.length)];
      const positions = POSITIONS_FORMES[forme.forme];
      if (positions) forme.position = positions[Math.floor(tirageForme.position * positions.length)];
      if (!brasMax(forme)) { forme.forme = 'rectangle'; delete forme.position; }
    }
    let i = 0;
    portes = murs.map((m) => ({ ...m, position: positionPorte(forme, m.mur, () => fractions[i++]) }));
    texte = texteSalle(forme, spec, portes);
    dernier = analyser(texte).plan;
    if (toutEstPose(dernier, spec)) break;
    largeur += 2;
    longueur += 2;
  }
  return { texte, portes };
}

/**
 * Génère un donjon.
 * @param {object} brut  salles, monstres, coffres, pieges, secretes, boucles, familles, formes, boss, graine (voir normaliserOptions)
 * @returns {{donjon:object, graine:number, resume:{salles:number,monstres:number,coffres:number,pieges:number,secretes:number,boucles:number,familles:string[]}}}
 */
export function genererDonjon(brut = {}) {
  const o = normaliserOptions(brut);
  const graine = o.graine ?? nouvelleGraine();
  const alea = generateur(graine);
  const tirer = (liste) => liste[Math.floor(alea() * liste.length)];

  const familles = o.familles.length ? o.familles : melanger(Object.keys(FAMILLES), alea).slice(0, 2);
  const troupe = familles.flatMap((f) => FAMILLES[f].troupe);
  const { cases, arbre } = pousser(o.salles, alea);
  const boucles = melanger(bouclesPossibles(cases, arbre), alea).slice(0, o.boucles);
  const liaisons = [...arbre, ...boucles];

  // La salle la plus éloignée de l'entrée, en suivant les liaisons de l'arbre.
  const profondeur = [0];
  for (const { a, b } of arbre) profondeur[b] = profondeur[a] + 1;
  const fond = profondeur.indexOf(Math.max(...profondeur));

  // Portes secrètes : les boucles d'abord, puis les salles au bout d'un chemin (jamais l'entrée).
  const degre = cases.map(() => 0);
  for (const { a, b } of arbre) { degre[a]++; degre[b]++; }
  const auBout = melanger(arbre.filter(({ b }) => degre[b] === 1), alea);
  const secretes = new Set([...boucles, ...auBout].slice(0, o.secretes));

  const indices = cases.map((_, i) => i);
  const peuplees = o.salles > 1 ? indices.filter((i) => i !== 0) : indices;
  const avecBoss = o.boss && o.monstres > 0;
  const parts = repartir(o.monstres - (avecBoss ? 1 : 0), peuplees, alea);
  const coffres = repartir(o.coffres, peuplees, alea);
  const pieges = repartir(o.pieges, peuplees, alea);
  const roles = melanger(ROLES, alea);
  let rangRole = 0;

  const specs = indices.map((i) => {
    const estFond = avecBoss && i === fond;
    const role = i === 0 ? ENTREE : estFond ? BOSS : roles[rangRole++ % roles.length];
    const monstres = {};
    if (estFond) monstres[tirer(familles.flatMap((f) => FAMILLES[f].boss))] = 1;
    peupler(parts.get(i) || 0, troupe, alea, monstres);
    const tirerCote = estFond ? 10 + Math.floor(alea() * 5) : 5 + Math.floor(alea() * 5);
    const largeur = tirerCote, longueur = estFond ? 10 + Math.floor(alea() * 5) : 5 + Math.floor(alea() * 5);
    return { role, monstres, coffres: coffres.get(i) || 0, pieges: i === 0 && o.salles > 1 ? 0 : pieges.get(i) || 0, largeur, longueur, formes: o.formes };
  });

  // Les murs de chaque salle : une porte par liaison, et une arche d'entrée sur un mur resté libre.
  const murs = indices.map(() => []);
  liaisons.forEach((l, n) => {
    const secrete = secretes.has(l);
    murs[l.a].push({ mur: l.mur, secrete, liaison: n });
    murs[l.b].push({ mur: OPPOSE[l.mur], secrete, liaison: n });
  });
  const murLibre = Object.keys(VECTEUR).filter((m) => !murs[0].some((q) => q.mur === m));
  if (murLibre.length) murs[0].unshift({ mur: murLibre.includes('sud') ? 'sud' : murLibre[0], type: 'arche' });

  // La première porte du texte est le mur d'entrée de la salle : celle par où on arrive, plutôt qu'une secrète.
  const salles = indices.map((i) => construireSalle(specs[i], [...murs[i]].sort((a, b) => Boolean(a.secrete) - Boolean(b.secrete)), alea));

  const compte = {};
  const nomDe = (role) => {
    compte[role.nom] = (compte[role.nom] || 0) + 1;
    return compte[role.nom] > 1 ? `${role.nom} ${compte[role.nom]}` : role.nom;
  };
  const donjon = modele.creerDonjon({ nom: `${FAMILLES[familles[0]].nom} (tirage ${graine})`, texte: salles[0].texte });
  const ids = [donjon.salleActive];
  modele.renommerSalle(donjon, ids[0], nomDe(specs[0].role));
  for (let i = 1; i < salles.length; i++) ids.push(modele.ajouterSalle(donjon, { nom: nomDe(specs[i].role), texte: salles[i].texte }).id);

  liaisons.forEach((l, n) => {
    const bout = (i) => {
      const q = salles[i].portes.find((p) => p.liaison === n);
      return { salle: ids[i], mur: q.mur, position: q.position };
    };
    modele.relier(donjon, bout(l.a), bout(l.b));
  });

  return { donjon, graine, resume: { salles: o.salles, monstres: o.monstres, coffres: o.coffres, pieges: o.pieges, secretes: secretes.size, boucles: boucles.length, familles } };
}

// --- Une seule salle au hasard ------------------------------------------------------------------------------------------------

/**
 * Bornes d'une salle seule : [valeur de départ, minimum, maximum] (les bornes sont celles du donjon entier). La valeur de départ n'est
 * plus appliquée : un nombre absent (ou vide) est « automatique », tiré par `quantitesAuto` ; elle reste là pour la forme du tableau.
 */
export const BORNES_SALLE = {
  monstres: [4, BORNES.monstres[1], BORNES.monstres[2]],
  coffres: [1, BORNES.coffres[1], BORNES.coffres[2]],
  pieges: [1, BORNES.pieges[1], BORNES.pieges[2]],
};

/**
 * Plages du tirage automatique, selon `cases` de sol disponibles (une salle imposée dans un mode « remplir » n'est pas agrandie) :
 *  - monstres : de 0 à un tiers de ce que la salle peut accueillir (cases hors mobilier / place par case de pion), au plus la borne ;
 *    0 n'est tiré qu'une fois sur dix, pour que la salle ne soit pas vide le plus souvent ;
 *  - coffres, pièges : de 0 à 2 (à 1 dans une petite salle, 0 dans une toute petite), de façon uniforme.
 * Un réglage imposé (y compris 0) n'est jamais touché ; seules les valeurs `null` sont tirées. Ne tire rien d'autre.
 */
export function quantitesAuto(imposees, cases, alea) {
  const libre = Math.max(0, cases - PLACE_DECOR);
  const maxMonstres = Math.min(BORNES_SALLE.monstres[2], Math.floor(libre / PLACE_PAR_MONSTRE / 3));
  const maxDecor = Math.min(2, cases >= 30 ? 2 : cases >= 15 ? 1 : 0);
  const decor = (cle) => Math.min(BORNES_SALLE[cle][2], Math.floor(alea() * (maxDecor + 1)));
  return {
    monstres: imposees.monstres ?? (maxMonstres > 0 && alea() >= 0.1 ? 1 + Math.floor(alea() * maxMonstres) : 0),
    coffres: imposees.coffres ?? decor('coffres'),
    pieges: imposees.pieges ?? decor('pieges'),
  };
}

/** Un nom de salle que l'outil a donné lui-même (« Salle 3 ») : il peut être remplacé par le nom du rôle tiré. */
export const estNomParDefaut = (nom) => /^Salle( \d+)?$/.test(String(nom ?? '').trim());

/** Une salle a-t-elle déjà un contenu à perdre ? (objets, créatures ou une description qui n'est pas celle d'une salle vide) */
export function salleAUnContenu(salle) {
  const p = salle?.plan;
  if (!p) return false;
  return (p.objets?.length ?? 0) + (p.creatures?.length ?? 0) > 0 || (String(salle.texte ?? '').trim() !== '' && salle.texte !== modele.TEXTE_SALLE_VIDE);
}

/**
 * Les familles qui expliquent le mieux des types de monstres déjà présents (les deux plus fréquentes), dans l'ordre de FAMILLES.
 * @param {string[]} types  un type par créature (« gobelin », « gobelin », « troll »…)
 */
export function famillesPresentes(types) {
  const compte = Object.entries(FAMILLES).map(([cle, f], rang) => [cle, types.filter((t) => f.troupe.includes(t) || f.boss.includes(t)).length, rang]);
  return compte.filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1] || a[2] - b[2]).slice(0, 2).map(([cle]) => cle);
}

/** Bornes appliquées pour une salle seule : monstres, coffres et pièges valent `null` (automatique) s'ils sont absents ou vides ; `graine` reste null si elle n'est pas valable. */
export function normaliserOptionsSalle(brut = {}) {
  const nombre = (cle) => {
    const [, min, max] = BORNES_SALLE[cle];
    const v = Math.round(Number(brut[cle]));
    return Number.isFinite(v) && brut[cle] !== '' && brut[cle] !== null && brut[cle] !== undefined ? Math.max(min, Math.min(max, v)) : null; // null : automatique
  };
  return {
    ...Object.fromEntries(Object.keys(BORNES_SALLE).map((cle) => [cle, nombre(cle)])),
    familles: (Array.isArray(brut.familles) ? brut.familles : []).filter((f) => f in FAMILLES),
    typesPresents: (Array.isArray(brut.typesPresents) ? brut.typesPresents : []).filter((t) => typeof t === 'string'),
    formes: brut.formes !== false,
    nouvelleForme: brut.nouvelleForme === true,
    reliee: brut.reliee !== false, // au moindre doute, la salle est prise pour reliée : ses portes restent
    graine: lireGraine(brut.graine),
  };
}

const escaliersDe = (plan) => (plan.objets || []).filter((o) => o.type === 'escalier');
/** Ce qui ne doit jamais bouger en remplissant : forme, dimensions, sol, ambiance, portes et escaliers (avec leur place et leur sens). */
function ancresDe(plan) {
  return JSON.stringify({
    forme: [plan.forme ?? 'rectangle', plan.largeur, plan.longueur, plan.bras ?? null, plan.position ?? null],
    aspect: [plan.sol ?? 'pierre', plan.ambiance ?? null, plan.etat ?? null, plan.eclairage ?? null],
    portes: (plan.portes || []).map((p) => [p.mur, p.position, p.type, !!p.cache]).sort(),
    escaliers: escaliersDe(plan).map((o) => [o.x, o.y, o.l, o.h, o.rotation, o.sens ?? null]).sort(),
  });
}
/** Le contenu demandé, réduit d'une fraction `f` (arrondie vers le bas) : sert quand tout ne tient pas dans une salle qu'on ne peut pas agrandir. */
const reduire = (spec, f) => ({
  ...spec,
  coffres: Math.floor(spec.coffres * f),
  pieges: Math.floor(spec.pieges * f),
  monstres: Object.fromEntries(Object.entries(spec.monstres).map(([t, n]) => [t, Math.floor(n * f)]).filter(([, n]) => n > 0)),
});
const nombreMonstres = (spec) => Object.values(spec.monstres).reduce((a, b) => a + b, 0);

/**
 * Génère le contenu d'UNE salle (monstres, coffres, pièges, mobilier, et éventuellement la forme), à partir du plan qu'elle a déjà.
 * Même ingrédients que `genererDonjon` (rôles, familles, placement, relecture par le parseur), sans règle d'entrée ni de boss.
 *
 * Deux modes, pour qu'une porte reliée à une autre salle ne disparaisse jamais :
 *  - « remplir » (par défaut) : forme, dimensions, sol, ambiance, TOUTES les portes et TOUS les escaliers restent où ils sont ; seul le
 *    contenu change. La salle n'est pas agrandie : si tout ne tient pas, le contenu est réduit (`resume.reduit`) ;
 *  - « nouvelle » (`nouvelleForme`) : nouvelle forme et nouvelles dimensions, appliquées au plan comme le fait la saisie à la main
 *    (`redimensionner`, `changerForme`) : les portes et escaliers, reliés ou non, restent sur leur mur à leur position, donc leurs
 *    liaisons aussi. Quelques tirages voisins sont essayés ; si aucun ne garde TOUTES les portes et tous les escaliers, ou au moindre
 *    doute, le mode « remplir » est employé et `refus` en dit la raison. `reliee` n'a plus d'effet sur ce mode (gardé pour la forme).
 *    Le résultat porte `plan` : le plan à la nouvelle forme, sans contenu, à donner à `modifierPlan(plan, { suivrePortes: true, texte })`.
 * Si même le mode « remplir » ne peut pas garantir les portes et escaliers, rien n'est proposé (`ok: false`, `texte: null`).
 *
 * @param {object} brut  plan (le plan actuel de la salle), monstres, coffres, pieges, familles, typesPresents (types de monstres des
 *   autres salles du donjon : leurs familles sont reprises par défaut), formes, nouvelleForme, reliee, graine (voir normaliserOptionsSalle)
 * @returns {{ok:boolean, texte:string|null, plan?:object, nom:string|null, graine:number, mode:'remplir'|'nouvelle', refus:string|null,
 *   resume:{monstres:number,coffres:number,pieges:number,familles:string[],reduit:boolean}}}
 */
export function genererSalle(brut = {}) {
  const o = normaliserOptionsSalle(brut);
  const plan = brut.plan ?? null;
  const graine = o.graine ?? nouvelleGraine();
  const alea = generateur(graine);

  const presentes = famillesPresentes(o.typesPresents);
  const familles = o.familles.length ? o.familles : presentes.length ? presentes : melanger(Object.keys(FAMILLES), alea).slice(0, 2);
  const troupe = familles.flatMap((f) => FAMILLES[f].troupe);
  const role = melanger(ROLES, alea)[0];
  // Les quantités : imposées, ou tirées selon la place (`quantitesAuto`) une fois la salle connue ; `spec` est refait à chaque salle envisagée.
  let demande = { monstres: 0, coffres: 0, pieges: 0 }, spec = null;
  const preparer = (cases) => {
    demande = quantitesAuto(o, cases, alea);
    spec = { role, monstres: peupler(demande.monstres, troupe, alea, {}), coffres: demande.coffres, pieges: demande.pieges, formes: o.formes };
  };
  const bilan = (texte, mode, refus, s, ok = true) => ({
    ok, texte, nom: ok ? role.nom : null, graine, mode, refus,
    resume: { monstres: nombreMonstres(s), coffres: s.coffres, pieges: s.pieges, familles, reduit: nombreMonstres(s) < demande.monstres || s.coffres < demande.coffres || s.pieges < demande.pieges },
  });

  // Remplir sur un plan donné : le plan sans son contenu (les escaliers restent), décrit tel quel ; le nouveau contenu s'ajoute à la fin.
  // Renvoie null si la relecture ne garde pas exactement les ancres (forme, dimensions, portes, escaliers) de `base`.
  const remplir = (base, mode, refus) => {
    preparer(nombreCases(base));
    const debut = decrire({ ...base, objets: escaliersDe(base), creatures: [] }).replace(/\.$/, '');
    const essais = [[1, true], [1, false], ...[0.8, 0.6, 0.4, 0.2, 0].map((f) => [f, false])];
    for (const [f, avecDecor] of essais) {
      const s = reduire(spec, f);
      const texte = `${[debut, ...(avecDecor ? role.contenu : []), ...phrasesContenu(s)].join(', ')}.`;
      const relu = analyser(texte).plan;
      if (toutEstPose(relu, s) && ancresDe(relu) === ancresDe(base)) return { ...bilan(texte, mode, refus, s), plan: base };
    }
    return null;
  };

  // Nouvelle forme : le changement manuel, appliqué au plan existant (`formeNeuve`) ; les portes et les escaliers, reliés ou non,
  // gardent leur place. Quelques tirages voisins sont essayés ; sinon, ou au moindre doute, on remplit seulement.
  let refus = null;
  if (o.nouvelleForme && plan) {
    for (let essai = 0; essai < ESSAIS_FORME; essai++) {
      const aleaForme = essai === 0 ? alea : generateur(graine + essai * 7919);
      const neuf = formeNeuve(plan, role, o.formes, aleaForme);
      const r = neuf && remplir(neuf, 'nouvelle', null);
      if (r) return r;
    }
    refus = 'Aucune nouvelle forme n’a pu garder toutes les portes et tous les escaliers de la salle : sa forme et ses dimensions restent.';
  }

  if (!plan) { preparer(0); return bilan(null, 'remplir', 'Il n’y a pas de plan à remplir.', reduire(spec, 0), false); }
  const r = remplir(plan, 'remplir', refus); // même après une nouvelle forme manquée : le tirage suit la place de la salle qui reste
  return r ?? bilan(null, 'remplir', refus ?? 'Les portes et escaliers de cette salle ne peuvent pas être gardés avec certitude : rien n’a été changé.', reduire(spec, 0), false);
}

/**
 * Un plan à la forme et aux dimensions tirées, à partir de celui de la salle : MÊME mécanisme que le changement à la main (`redimensionner`
 * par les bords est et sud, puis `changerForme`, js/pose.js). Le contenu est retiré (les escaliers restent) ; les portes gardent leur mur
 * et leur position le long du mur, donc leurs liaisons aussi. Les dimensions ne descendent pas sous ce qu'il faut pour tenir les portes
 * et les escaliers (la plage de 5 à 9 cases est relevée au besoin). Renvoie null si une porte tomberait hors du sol ou si un escalier devait bouger.
 */
function formeNeuve(plan, role, formes, alea) {
  const escaliers = escaliersDe(plan);
  const horizontal = (mur) => mur === 'nord' || mur === 'sud';
  const minLargeur = Math.max(5, ...plan.portes.filter((q) => horizontal(q.mur)).map((q) => q.position + 1), ...escaliers.map((e) => e.x + e.l));
  const minLongueur = Math.max(5, ...plan.portes.filter((q) => !horizontal(q.mur)).map((q) => q.position + 1), ...escaliers.map((e) => e.y + e.h));
  const tirerCote = (min) => Math.max(min, 5 + Math.floor(alea() * 5)); // 5 à 9 cases, tirées à chaque fois : jamais une valeur par défaut
  const largeur = tirerCote(minLargeur), longueur = tirerCote(minLongueur);
  const tirageForme = { chance: alea(), forme: alea(), position: alea() };

  let courant = { ...plan, objets: escaliers, creatures: [] };
  for (const [cote, delta] of [['est', largeur - plan.largeur], ['sud', longueur - plan.longueur]]) {
    if (!delta) continue;
    const res = redimensionner(courant, cote, delta);
    if (res.erreur) return null;
    courant = res.plan;
  }
  const champs = { forme: 'rectangle' };
  if (formes && Math.min(largeur, longueur) >= COTE_FORME_MIN && (role.forme || tirageForme.chance < CHANCE_FORME)) {
    champs.forme = role.forme || FORMES_TIRABLES[Math.floor(tirageForme.forme * FORMES_TIRABLES.length)];
    const positions = POSITIONS_FORMES[champs.forme];
    if (positions) champs.position = positions[Math.floor(tirageForme.position * positions.length)];
    if (!brasMax({ ...courant, ...champs })) { champs.forme = 'rectangle'; delete champs.position; }
  }
  const res = changerForme(courant, champs);
  if (res.erreur) return null;
  const neuf = res.plan;
  // Une porte doit déboucher sur du sol (elle s'enfonce dans une forme découpée) ; un escalier ne doit pas avoir bougé.
  const surLeSolDuMur = (q) => {
    const h = horizontal(q.mur), profondeur = h ? neuf.longueur : neuf.largeur;
    for (let d = 0; d < profondeur; d++) {
      const x = h ? q.position : (q.mur === 'ouest' ? d : neuf.largeur - 1 - d);
      const y = h ? (q.mur === 'nord' ? d : neuf.longueur - 1 - d) : q.position;
      if (estSol(neuf, x, y)) return true;
    }
    return false;
  };
  if (!neuf.portes.every(surLeSolDuMur)) return null;
  if (!escaliers.every((e) => neuf.objets.some((n) => n.id === e.id && n.x === e.x && n.y === e.y))) return null;
  return (plan.sol && plan.sol !== 'pierre') || !role.sol ? neuf : { ...neuf, sol: role.sol }; // le rôle ne change que le sol resté « pierre »
}

/** Une porte ou un escalier de cette salle est-il relié à une autre salle ? (alors sa forme et ses dimensions ne doivent pas changer) */
export const salleReliee = (donjon, idSalle) => (donjon?.liaisons || []).some((l) => l.a.salle === idSalle || l.b.salle === idSalle);

/** Les types de monstres des AUTRES salles du donjon, un par créature : de quoi reprendre leurs familles (`typesPresents` de `genererSalle`). */
export const typesDesAutresSalles = (donjon, idSalle) => Object.values(donjon?.salles || {})
  .filter((s) => s.id !== idSalle)
  .flatMap((s) => (s.plan?.creatures || []).filter((k) => k.camp === 'monstre').map((k) => k.type));
