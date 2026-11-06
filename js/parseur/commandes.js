/**
 * Commandes à la volée : une phrase du MJ qui modifie une salle déjà en jeu.
 *
 *   « ajoute trois gobelins »            « ajoute un coffre en C4 »        « ajoute un gobelin caché »
 *   « supprime le coffre »               « supprime le gobelin 2 »         « supprime tous les gobelins »
 *   « déplace la statue à gauche »       « déplace le gobelin 2 en C4 »    « déplace le coffre de C4 à D5 »
 *
 * Module PUR : aucun accès au DOM, il ne modifie jamais le plan reçu. Il réutilise le parseur
 * existant (normaliser, nombres, lexique, coordonnées, positions) et le placement de
 * placement.js : pour trouver une place, la salle est « rejouée » avec ses éléments actuels à
 * leurs cases exactes, puis le nouvel élément est posé selon les règles habituelles (dans la
 * pièce, jamais sur un autre pion ni sur un objet bloquant, cases devant les portes évitées).
 *
 * Les éléments déjà en place gardent leur identifiant, leur numéro, leur état et leurs champs :
 * rien n'est relu depuis un texte. Les portes ne sont jamais touchées, donc les liaisons non plus.
 *
 * Une commande ambiguë ou incompréhensible ne change RIEN : { ok: false, message } avec une
 * phrase française qui dit quoi préciser.
 *
 * @returns {{ok:false, message:string}
 *          |{ok:true, message:string, plan:object, ajoutes:string[], supprimes:string[], deplaces:string[]}}
 */
import { estSol } from '../formes.js';
import { evaluerPose } from '../pose.js';
import { trouverObjet, definition, nomAffiche, MOTS_VIDES, ADJ_CACHE } from './lexique.js';
import { analyserPosition } from './positions.js';
import { construirePlan } from './placement.js';
import { analyserProposition, decouper, hacher, preparer } from './index.js';
import { lireCase, nomCase } from '../coordonnees.js';
import { portesEntreeDabord } from '../murs.js';

const VERBES = {
  ajouter: ['ajoute', 'ajouter', 'rajoute', 'rajouter', 'place', 'placer', 'pose', 'poser', 'mets', 'met', 'mettre', 'cree', 'creer'],
  supprimer: ['supprime', 'supprimer', 'enleve', 'enlever', 'retire', 'retirer', 'efface', 'effacer', 'elimine', 'eliminer'],
  deplacer: ['deplace', 'deplacer', 'bouge', 'bouger', 'decale', 'decaler'],
};
const ACTION = Object.fromEntries(Object.entries(VERBES).flatMap(([action, verbes]) => verbes.map((v) => [v, action])));
const AIDE = 'Exemples : « ajoute trois gobelins », « ajoute un coffre en C4 », « supprime le gobelin 2 », « déplace la statue à gauche ».';
const MAX_LISTE = 8; // éléments cités au plus dans un message

const refus = (message) => ({ ok: false, message });
const citer = (mots) => mots.map((m) => `« ${m} »`).join(', ');
const rectDe = (e) => ({ x: e.x, y: e.y, l: e.taille ?? e.l, h: e.taille ?? e.h });
const estChiffres = (m) => /^\d+$/.test(m);
const casePrincipale = (e) => nomCase(e.x, e.y);

/** « gobelin 2 », « coffre » (+ « caché »). */
const libelle = (genre, e) => `${nomAffiche(e.type)}${genre === 'creature' ? ` ${e.numero}` : ''}${e.cache ? ' caché' : ''}`;

/** Tous les éléments qui occupent la salle (hors portes), avec leur genre. */
const occupants = (plan) => [
  ...plan.objets.map((e) => ({ genre: 'objet', e })),
  ...plan.creatures.map((e) => ({ genre: 'creature', e })),
];

/** Un repère cité par la position (« devant le coffre », « devant la porte ») existe-t-il dans la salle ? */
function repereAbsent(plan, position, sauf) {
  const c = position.cible;
  if (!c) return null;
  if (c.genre === 'porte') {
    if (!plan.portes.length) return 'Il n’y a aucune porte dans cette salle pour s’y repérer.';
    return !c.mur || plan.portes.some((p) => p.mur === c.mur) ? null : `Il n’y a pas de porte au mur ${c.mur} dans cette salle pour s’y repérer.`;
  }
  const existe = occupants(plan).some((o) => o.e !== sauf && o.e.type === c.type);
  return existe ? null : `Il n’y a pas de ${nomAffiche(c.type)} dans cette salle pour s’y repérer.`;
}

/** Une case exacte hors de la salle est refusée (le parseur de salle, lui, la ramènerait au bord). */
function caseHorsSalle(plan, position) {
  if (position.zone !== 'cases') return null;
  const cases = position.etendue ? [[position.etendue[0], position.etendue[1]], [position.etendue[2], position.etendue[3]]] : position.cases;
  const hors = cases.find(([x, y]) => !estSol(plan, x, y) );
  return hors ? `La case ${nomCase(Math.max(0, hors[0]), Math.max(0, hors[1]))} est hors de la salle (elle va de A1 à ${nomCase(plan.largeur - 1, plan.longueur - 1)}).` : null;
}

// --- Rejouer la salle pour trouver une place -------------------------------------------------

function intentionExistante(genre, e) {
  const l = e.taille ?? e.l, h = e.taille ?? e.h;
  const position = { zone: 'cases', etendue: [e.x, e.y, e.x + l - 1, e.y + h - 1], rotation: e.rotation, libelle: '' };
  return genre === 'creature'
    ? { genre, type: e.type, n: 1, taille: 0, camp: e.camp, couleur: null, position }
    : { genre, type: e.type, n: 1, taille: 0, position, ...(e.sens === 'monte' ? { sens: 'monte' } : {}), ...(e.variante ? { variante: e.variante } : {}) };
}

/**
 * Pose `nouvelles` (intentions du parseur) dans la salle, en tenant compte de tout ce qui y est
 * (sauf `sauf`, l'élément qu'on déplace). Renvoie les éléments créés par le placement, bruts.
 */
function rejouer(plan, sauf, nouvelles, graine) {
  const portes = portesEntreeDabord(plan)
    .map((q) => ({ genre: 'porte', type: q.type, n: 1, position: { zone: 'mur', mur: q.mur, positionMur: q.position }, ...(q.cache ? { cache: true } : {}) }));
  const objets = plan.objets.filter((o) => o !== sauf).map((o) => intentionExistante('objet', o));
  const creatures = plan.creatures.filter((k) => k !== sauf).map((k) => intentionExistante('creature', k));
  const { plan: rejoue } = construirePlan({
    largeur: plan.largeur, longueur: plan.longueur, sol: plan.sol, forme: plan, entree: plan.entree, graine,
    intentions: [...portes, ...objets, ...creatures, ...nouvelles],
  });
  // Les éléments existants sont posés en premier (positions exactes), les nouveaux viennent après.
  return {
    objets: rejoue.objets.slice(objets.length).map((e) => ({ genre: 'objet', e })),
    creatures: rejoue.creatures.slice(creatures.length).map((e) => ({ genre: 'creature', e })),
  };
}

/**
 * Règles de pose : celles de deplacement.js, c'est-à-dire `evaluerPose` (pose.js) : dans la pièce ; un pion ne se pose
 * pas sur un autre pion ; un objet bloquant ne se pose ni sur un pion ni sur un autre objet bloquant ; un pion peut
 * monter sur un objet ; un objet non bloquant (torche) va partout.
 * @returns {{gardes:object[], refuses:{n:object, raison:string}[]}}
 */
function controlerPose(plan, sauf, nouveaux) {
  // Deux plans, interrogés dans cet ordre : la salle sans l'élément déplacé, puis ce qui vient d'être gardé. Ainsi l'élément
  // cité quand plusieurs gênent est toujours le premier dans l'ordre « objets en place, pions en place, nouveaux objets, nouveaux pions ».
  const enPlace = { ...plan, objets: plan.objets.filter((o) => o !== sauf), creatures: plan.creatures.filter((k) => k !== sauf) };
  const ajoutes = { ...plan, objets: [], creatures: [] };
  const gardes = [], refuses = [];
  for (const n of nouveaux) {
    const r = rectDe(n.e);
    let pose = null;
    for (const salle of [enPlace, ajoutes]) {
      pose = evaluerPose(salle, n.genre, n.e, r.x, r.y);
      if (!pose.ok) break;
    }
    if (pose.raison === 'hors') {
      refuses.push({ n, raison: `${libelle(n.genre, n.e)} ne tient pas dans la salle à cet endroit.` });
      continue;
    }
    if (!pose.ok) {
      refuses.push({ n, raison: `${casePrincipale(n.e)} est déjà occupée (${libelle(pose.gene.genre, pose.gene.element)}).` });
      continue;
    }
    gardes.push(n);
    ajoutes[n.genre === 'creature' ? 'creatures' : 'objets'].push(n.e);
  }
  return { gardes, refuses };
}

/** Identifiants libres : o1, o2… et c1, c2… sans jamais reprendre un identifiant du plan. */
function fabriqueIds(plan) {
  const pris = new Set([...plan.portes, ...plan.objets, ...plan.creatures].map((e) => e.id));
  return (prefixe) => {
    let n = 1;
    while (pris.has(`${prefixe}${n}`)) n++;
    pris.add(`${prefixe}${n}`);
    return `${prefixe}${n}`;
  };
}

function enumerer(genre, liste) {
  const montres = liste.slice(0, MAX_LISTE).map((e) => `${libelle(genre, e)} (${casePrincipale(e)})`);
  return montres.join(', ') + (liste.length > MAX_LISTE ? ` et ${liste.length - MAX_LISTE} autres` : '');
}

// --- Ajouter ------------------------------------------------------------------------------

function ajouter(reste, plan, graine) {
  const intentions = [], ignores = [];
  for (const prop of decouper(reste)) analyserProposition(prop, intentions, ignores);
  if (ignores.length) return refus(`Je n’ai pas compris : ${citer([...new Set(ignores)])}. Rien n’a été modifié. ${AIDE}`);
  if (!intentions.length) return refus(`Je n’ai pas trouvé quoi ajouter. ${AIDE}`);
  if (intentions.some((i) => i.genre === 'porte')) {
    return refus('Les portes ne s’ajoutent pas par commande : elles relient les salles. Franchis une porte non reliée pour créer la salle d’à côté, ou prépare la porte dans l’outil Donjon. Rien n’a été modifié.');
  }
  for (const it of intentions) {
    const manque = (it.position.cible && !intentions.some((i) => i !== it && i.type === it.position.cible.type) && repereAbsent(plan, it.position, null))
      || caseHorsSalle(plan, it.position);
    if (manque) return refus(`${manque} Rien n’a été modifié.`);
  }

  const demandes = intentions.reduce((s, it) => s + (it.position.etendue ? 1 : it.position.cases ? Math.max(it.n, it.position.cases.length) : it.n), 0);
  const poses = rejouer(plan, null, intentions, graine);
  const { gardes, refuses } = controlerPose(plan, null, [...poses.objets, ...poses.creatures]);
  if (!gardes.length) {
    return refus(`${refuses[0]?.raison || 'Il n’y a plus de place dans la salle pour ça.'} Précise une autre case ou un autre endroit. Rien n’a été modifié.`);
  }

  const id = fabriqueIds(plan);
  const numeros = {};
  for (const k of plan.creatures) numeros[k.type] = Math.max(numeros[k.type] || 0, k.numero || 0);
  const objets = [], creatures = [];
  for (const { genre, e } of gardes) {
    if (genre === 'creature') {
      numeros[e.type] = (numeros[e.type] || 0) + 1;
      creatures.push({ ...e, id: id('c'), numero: numeros[e.type] });
    } else objets.push({ ...e, id: id('o') });
  }

  const nouveaux = [...objets.map((e) => ({ genre: 'objet', e })), ...creatures.map((e) => ({ genre: 'creature', e }))];
  const liste = nouveaux.slice(0, MAX_LISTE).map(({ genre, e }) => `${libelle(genre, e)} en ${casePrincipale(e)}`).join(', ')
    + (nouveaux.length > MAX_LISTE ? ` et ${nouveaux.length - MAX_LISTE} autres` : '');
  const sansPlace = demandes - gardes.length;
  let message = `Ajouté : ${liste}.`;
  if (nouveaux.some((n) => n.e.cache)) message += ' Ce qui est caché reste invisible à la table jusqu’à sa révélation.';
  if (sansPlace > 0) message += ` ${sansPlace} élément${sansPlace > 1 ? 's n’ont' : ' n’a'} pas trouvé de place.`;
  return {
    ok: true, message,
    plan: { ...plan, objets: [...plan.objets, ...objets], creatures: [...plan.creatures, ...creatures] },
    ajoutes: nouveaux.map((n) => n.e.id), supprimes: [], deplaces: [],
  };
}

// --- Désigner un élément existant (supprimer, déplacer) ---------------------------------------------

/**
 * Lit « le gobelin 2 », « les coffres », « le coffre caché », « la statue en C4 » au début de `mots`.
 * @returns {{erreur:string}|{trouve:object, genre:string, plusieurs:boolean, cache:boolean, numero:number|null,
 *            casePrecise:number[]|null, fin:number, ignores:string[]}}
 */
function lireDesignation(mots, exemple) {
  const i = mots.findIndex((m) => trouverObjet(m));
  if (i < 0) return { erreur: `Je n’ai pas trouvé de quel élément il s’agit. Nomme-le, par exemple « ${exemple} ».` };
  const trouve = trouverObjet(mots[i]);
  if (trouve.def.genre === 'porte') {
    return { erreur: 'Les portes ne se gèrent pas par commande : elles portent les liaisons entre les salles (outil Donjon). Rien n’a été modifié.' };
  }
  let plusieurs = trouve.pluriel, cache = false, quantite = 1, numero = null;
  const ignores = [];
  for (const m of mots.slice(0, i)) {
    if (ADJ_CACHE.has(m)) cache = true;
    else if (m === 'tous' || m === 'toutes') plusieurs = true;
    else if (estChiffres(m)) quantite = Number(m);
    else if (!MOTS_VIDES.has(m) && m.length > 1) ignores.push(m);
  }
  if (quantite > 1) return { erreur: `Je ne sais pas lequel prendre parmi ${quantite} ${nomAffiche(trouve.def.type, quantite)}. Dis « ${exemple} » (avec son numéro) ou « tous les ${nomAffiche(trouve.def.type, 2)} ».` };
  let j = i + 1;
  for (; j < mots.length; j++) {
    if (estChiffres(mots[j]) && numero === null) numero = Number(mots[j]);
    else if (ADJ_CACHE.has(mots[j])) cache = true;
    else break;
  }
  return { trouve, genre: trouve.def.genre, plusieurs, cache, numero, fin: j, ignores };
}

/** Éléments de la salle qui correspondent à la désignation, ou un message si aucun. */
function chercherCandidats(plan, d, casePrecise, verbe) {
  const type = d.trouve.def.type, nom = nomAffiche(type);
  const liste = (d.genre === 'creature' ? plan.creatures : plan.objets).filter((e) => e.type === type);
  if (!liste.length) return { erreur: `Il n’y a aucun ${nom} dans cette salle.` };
  // Les pions se désignent par leur numéro ; les objets par leur rang de lecture (de haut en bas, puis de gauche à droite).
  const ordre = [...liste].sort((a, b) => a.y - b.y || a.x - b.x);
  const numeroDe = (e) => (d.genre === 'creature' ? e.numero : ordre.indexOf(e) + 1);
  let retenus = liste;
  if (d.numero !== null) {
    retenus = retenus.filter((e) => numeroDe(e) === d.numero);
    if (!retenus.length) return { erreur: `Il n’y a pas de ${nom} ${d.numero} dans cette salle. ${enumerer(d.genre, ordre)}.` };
  }
  if (d.cache) retenus = retenus.filter((e) => e.cache);
  if (casePrecise) {
    retenus = retenus.filter((e) => { const r = rectDe(e); return casePrecise[0] >= r.x && casePrecise[0] < r.x + r.l && casePrecise[1] >= r.y && casePrecise[1] < r.y + r.h; });
  }
  if (!retenus.length) {
    const precis = [d.cache ? 'caché' : '', casePrecise ? `en ${nomCase(...casePrecise)}` : ''].filter(Boolean).join(' ');
    return { erreur: `Aucun ${nom}${precis ? ` ${precis}` : ''} dans cette salle. Il y a : ${enumerer(d.genre, ordre)}.` };
  }
  retenus.sort((a, b) => numeroDe(a) - numeroDe(b));
  if (retenus.length > 1 && !d.plusieurs) {
    const ex = retenus[0];
    const conseil = [`« ${verbe} le ${nom} ${numeroDe(ex)} »`, `« ${verbe} le ${nom} en ${casePrincipale(ex)} »`];
    if (retenus.some((e) => e.cache) && retenus.some((e) => !e.cache)) conseil.push(`« ${verbe} le ${nom} caché »`);
    if (verbe === 'supprime') conseil.push(`« supprime tous les ${nomAffiche(type, 2)} »`);
    const rang = d.genre === 'creature' ? '' : ' (numérotés de haut en bas, puis de gauche à droite)';
    return { erreur: `Il y a ${retenus.length} ${nomAffiche(type, retenus.length)} dans cette salle${rang} : ${enumerer(d.genre, retenus)}. Précise lequel : ${conseil.join(', ')}.` };
  }
  return { retenus };
}

// --- Supprimer ---------------------------------------------------------------------------------

function supprimer(mots, plan) {
  const d = lireDesignation(mots, 'supprime le gobelin 2');
  if (d.erreur) return refus(d.erreur);
  const apres = mots.slice(d.fin);
  const k = apres.findIndex((m) => lireCase(m));
  const casePrecise = k >= 0 ? lireCase(apres[k]) : null;
  const ignores = [...d.ignores, ...apres.filter((m, i) => i !== k && !MOTS_VIDES.has(m) && !estChiffres(m) && m.length > 1)];
  if (ignores.length) return refus(`Je n’ai pas compris : ${citer(ignores)}. Rien n’a été modifié. Exemple : « supprime le gobelin 2 ».`);

  const c = chercherCandidats(plan, d, casePrecise, 'supprime');
  if (c.erreur) return refus(`${c.erreur} Rien n’a été modifié.`);
  const retire = new Set(c.retenus);
  const liste = d.genre === 'creature' ? 'creatures' : 'objets';
  return {
    ok: true,
    message: `Supprimé : ${enumerer(d.genre, c.retenus)}.`,
    plan: { ...plan, [liste]: plan[liste].filter((e) => !retire.has(e)) },
    ajoutes: [], supprimes: c.retenus.map((e) => e.id), deplaces: [],
  };
}

// --- Déplacer ----------------------------------------------------------------------------------

/** Rangée de côtés (x ou y) d'un objet de taille l × h, ramenée à un « supplément de taille » du lexique. */
function supplementTaille(genre, e) {
  const def = definition(e.type);
  if (genre === 'creature') return e.taille - def.l;
  const a = [e.l, e.h].sort(), b = [def.l, def.h].sort();
  return a[0] - b[0] === a[1] - b[1] ? a[0] - b[0] : null; // null : taille particulière
}

function deplacer(mots, plan) {
  const d = lireDesignation(mots, 'déplace le gobelin 2 à gauche');
  if (d.erreur) return refus(d.erreur);
  if (d.plusieurs) return refus('Je ne déplace qu’un élément à la fois. Exemple : « déplace le gobelin 2 à gauche ».');
  let apres = mots.slice(d.fin);

  // « déplace le coffre de C4 à D5 » : la première case désigne l'élément, la seconde est la destination.
  let casePrecise = null;
  const de = apres.findIndex((m, i) => m === 'de' && lireCase(apres[i + 1]) && ['a', 'en', 'vers'].includes(apres[i + 2]) && lireCase(apres[i + 3]));
  if (de >= 0) {
    casePrecise = lireCase(apres[de + 1]);
    apres = [...apres.slice(0, de), 'en', apres[de + 3], ...apres.slice(de + 4)];
  }
  const c = chercherCandidats(plan, d, casePrecise, 'déplace');
  if (c.erreur) return refus(`${c.erreur} Rien n’a été modifié.`);
  const element = c.retenus[0];
  const nom = `« ${libelle(d.genre, element)} »`;

  const destination = apres.join(' ').replace(/\b(?:vers|sur|a|au|jusqu a|jusqu en)\s+([a-z]{1,2}\d{1,2})\b/g, 'en $1');
  if (!destination.trim()) return refus(`Où faut-il déplacer ${nom} ? Dis par exemple « à gauche », « au fond », « en C4 » ou « devant la porte ».`);
  const position = analyserPosition(destination);
  if (!position.zone) return refus(`Je n’ai pas compris où déplacer ${nom} (« ${destination.trim()} »). Dis par exemple « à gauche », « au fond », « en C4 » ou « devant la porte ». Rien n’a été modifié.`);
  const mDest = destination.split(' ');
  const ignores = [...d.ignores, ...mDest.filter((m, i) => !position.indices.includes(i) && position.cible?.index !== i
    && !MOTS_VIDES.has(m) && !estChiffres(m) && m.length > 1)];
  if (ignores.length) return refus(`Je n’ai pas compris : ${citer([...new Set(ignores)])}. Rien n’a été modifié.`);
  const manque = repereAbsent(plan, position, element) || caseHorsSalle(plan, position);
  if (manque) return refus(`${manque} Rien n’a été modifié.`);

  const taille = supplementTaille(d.genre, element);
  if (taille === null) return refus(`${nom} a une taille particulière : déplace-le plutôt à la souris. Rien n’a été modifié.`);
  const intention = d.genre === 'creature'
    ? { genre: 'creature', type: element.type, n: 1, taille, camp: element.camp, couleur: element.couleur ?? null, position }
    : { genre: 'objet', type: element.type, n: 1, taille, position };
  const poses = rejouer(plan, element, [intention], hacher(destination));
  const { gardes, refuses } = controlerPose(plan, element, [...poses.objets, ...poses.creatures]);
  if (!gardes.length) return refus(`${refuses[0]?.raison || `Il n’y a pas de place pour ${nom} à cet endroit.`} Précise une autre destination. Rien n’a été modifié.`);

  const placé = gardes[0].e;
  const deplace = d.genre === 'creature'
    ? { ...element, x: placé.x, y: placé.y }
    : { ...element, x: placé.x, y: placé.y, l: placé.l, h: placé.h, rotation: placé.rotation };
  if (['x', 'y', 'l', 'h', 'rotation'].every((champ) => deplace[champ] === element[champ])) {
    return refus(`${nom} est déjà là (${casePrincipale(element)}). Rien n’a été modifié.`);
  }
  const liste = d.genre === 'creature' ? 'creatures' : 'objets';
  return {
    ok: true,
    message: `Déplacé : ${libelle(d.genre, element)}, ${casePrincipale(element)} → ${casePrincipale(deplace)}.`,
    plan: { ...plan, [liste]: plan[liste].map((e) => (e === element ? deplace : e)) },
    ajoutes: [], supprimes: [], deplaces: [element.id],
  };
}

// --- Entrée ---------------------------------------------------------------------------------------

/**
 * @param {string} texte la commande du MJ
 * @param {object} plan  plan de la salle (validé, voir schema.js) : jamais modifié
 */
export function interpreterCommande(texte, plan) {
  const brut = String(texte ?? '').trim();
  if (!brut) return refus(`Écris une commande. ${AIDE}`);
  const t = preparer(brut);
  const mots = t.replace(/[,;:!?]/g, ' ').replace(/\.(?!\d)/g, ' ').split(' ').filter(Boolean);
  const action = ACTION[mots[0]];
  if (!action) return refus(`Je n’ai pas compris « ${brut.split(/\s+/)[0]} ». Une commande commence par ajoute, supprime ou déplace. ${AIDE}`);
  const reste = mots.slice(1);
  if (!reste.length) return refus(`Que faut-il ${action === 'ajouter' ? 'ajouter' : action === 'supprimer' ? 'supprimer' : 'déplacer'} ? ${AIDE}`);
  if (action === 'ajouter') return ajouter(reste.join(' '), plan, hacher(t));
  return action === 'supprimer' ? supprimer(reste, plan) : deplacer(reste, plan);
}
