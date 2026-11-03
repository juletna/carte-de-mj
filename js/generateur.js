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
import { debutDescription } from './parseur/decrire.js';
import { nomAffiche, CREATURES } from './parseur/lexique.js';
import { lettreColonne } from './parseur/coordonnees.js';
import { POSITIONS_FORMES, brasMax, retraitPorte } from './formes.js';

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
export const GRAINE_MAX = 999999;

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

const DIRECTIONS = { nord: [0, -1], sud: [0, 1], est: [1, 0], ouest: [-1, 0] };
const OPPOSE = { nord: 'sud', sud: 'nord', est: 'ouest', ouest: 'est' };
const FORMES_TIRABLES = ['croix', 'L', 'T', 'U', 'octogone'];
const CHANCE_FORME = 0.3;       // part des salles assez grandes qui ne sont pas rectangulaires
const COTE_FORME_MIN = 7;       // en dessous, une forme laisse trop peu de sol
const PLACE_PAR_MONSTRE = 2.2;  // cases de sol prévues par case de pion : la salle reste jouable
const PLACE_DECOR = 10;         // cases de sol prévues pour le mobilier, les coffres et les pièges
const ESSAIS_SALLE = 10;        // agrandissements au plus, si tout ne tient pas
const PAR_PHRASE = 40;          // le parseur lit au plus 40 éléments par groupe de mots

const tailleDe = (type) => CREATURES.find((c) => c.type === type).taille;

function generateur(graine) {
  let a = (graine * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bornes appliquées, familles inconnues écartées. Sans numéro de tirage valable : `graine` reste null, à l'appelant d'en tirer un. */
export function normaliserOptions(brut = {}) {
  const nombre = (cle) => {
    const [defaut, min, max] = BORNES[cle];
    const v = Math.round(Number(brut[cle]));
    return Number.isFinite(v) && brut[cle] !== '' && brut[cle] !== null && brut[cle] !== undefined ? Math.max(min, Math.min(max, v)) : defaut;
  };
  const graine = Math.round(Number(brut.graine));
  return {
    ...Object.fromEntries(Object.keys(BORNES).map((cle) => [cle, nombre(cle)])),
    familles: (Array.isArray(brut.familles) ? brut.familles : []).filter((f) => f in FAMILLES),
    formes: brut.formes !== false,
    boss: brut.boss !== false,
    graine: Number.isInteger(graine) && graine >= 1 && graine <= GRAINE_MAX ? graine : null,
  };
}

/** Les salles sur leur grille, reliées en arbre. @returns {{cases:Array<{x,y}>, arbre:Array<{a,b,mur}>}}  mur : celui de `a`, vers `b` */
function pousser(n, alea) {
  const cases = [{ x: 0, y: 0 }];
  const prises = new Set(['0,0']);
  const arbre = [];
  const libres = ({ x, y }) => Object.entries(DIRECTIONS).filter(([, [dx, dy]]) => !prises.has(`${x + dx},${y + dy}`));
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
      const [dx, dy] = DIRECTIONS[mur];
      const b = index.get(`${c.x + dx},${c.y + dy}`);
      if (b !== undefined && !reliees.has(`${a},${b}`)) res.push({ a, b, mur });
    }
  });
  return res;
}

const melanger = (liste, alea) => {
  const copie = [...liste];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(alea() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
};

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

/** Position d'une porte sur un mur : pas dans un coin, et sur le bord de la forme tant que c'est possible. */
function positionPorte(forme, mur, alea) {
  const long = mur === 'nord' || mur === 'sud' ? forme.largeur : forme.longueur;
  const toutes = Array.from({ length: long }, (_, i) => i);
  const interieures = long > 2 ? toutes.slice(1, -1) : toutes;
  const auBord = interieures.filter((p) => retraitPorte(forme, mur, p) === 0);
  const choix = auBord.length ? auBord : interieures;
  return choix[Math.floor(alea() * choix.length)];
}

const quantite = (n, mot) => `${n} ${mot}`;
const repere = (mur, p) => (mur === 'nord' || mur === 'sud' ? lettreColonne(p) : p + 1);

/** Le texte d'une salle, avec des portes déjà placées. */
function texteSalle(forme, spec, portes) {
  const parties = debutDescription(forme);
  if (spec.role.sol) parties.push(`sol en ${spec.role.sol}`);
  for (const q of portes) parties.push(`${q.type === 'arche' ? 'une arche' : `une porte${q.secrete ? ' secrète' : ''}`} au mur ${q.mur} en ${repere(q.mur, q.position)}`);
  parties.push(...spec.role.contenu);
  if (spec.coffres) parties.push(quantite(spec.coffres, nomAffiche('coffre', spec.coffres)));
  if (spec.pieges) parties.push(`${spec.pieges} ${spec.pieges > 1 ? 'fosses cachées' : 'fosse cachée'}`);
  for (const [type, n] of Object.entries(spec.monstres)) {
    for (let reste = n; reste > 0; reste -= PAR_PHRASE) {
      const k = Math.min(reste, PAR_PHRASE);
      parties.push(quantite(k, nomAffiche(type, k)));
    }
  }
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
  const graine = o.graine ?? 1 + Math.floor(Math.random() * GRAINE_MAX);
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
    // Une salle n'abrite qu'un ou deux types : on croise des groupes, pas un inventaire.
    const types = [tirer(troupe), tirer(troupe)];
    for (let k = parts.get(i) || 0; k > 0; k--) {
      const type = alea() < 0.75 ? types[0] : types[1];
      monstres[type] = (monstres[type] || 0) + 1;
    }
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
  const murLibre = Object.keys(DIRECTIONS).filter((m) => !murs[0].some((q) => q.mur === m));
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
