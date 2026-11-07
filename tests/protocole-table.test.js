/**
 * Tests du protocole régie ↔ table (protocole-table.js) : ce que la régie met dans le message `etat` (rien de secret), et ce
 * que la fenêtre table en relit. Sans dépendance : marche sous Node et dans tests.html.
 */
import * as p from '../js/presentation.js';
import * as t from '../js/commande-table.js';
import { MESSAGES, CANAL, messageEtat, lireEtat, messageDefiler, lireDefilement, messageDemandeEtat, messageDeplacer, messageViser, messagePoint, lirePosition } from '../js/protocole-table.js';
import { AFFICHAGE_PAR_DEFAUT } from '../js/affichage.js';
import { verifier, egal, executerSuite } from './mini-test.js';

const SECRETS = ['SECRET-NOM-SALLE', 'SECRET-TEXTE-SALLE', 'SECRET-NOTE-SALLE', 'SECRET-NOTE-PARTIE', 'SECRET-NOM-DONJON', 'SECRET-AUTRE-SALLE'];

/** Deux salles reliées, des secrets partout (noms, textes, notes), un élément caché de chaque sorte, un monstre et un objet visibles. */
function partieAvecSecrets() {
  const plan = (id) => ({
    version: 1, id, nom: 'SECRET-NOM-SALLE', largeur: 8, longueur: 8, sol: 'pierre', entree: 'sud', connexions: [],
    portes: [{ id: 'p1', mur: 'sud', position: 1, type: 'porte' }, { id: 'p2', mur: 'nord', position: 2, type: 'porte', cache: true }],
    objets: [{ id: 'o1', type: 'coffre', x: 1, y: 1, l: 1, h: 1, rotation: 0 }, { id: 'o2', type: 'coffre', x: 3, y: 1, l: 1, h: 1, rotation: 0, cache: true }],
    creatures: [
      { id: 'c1', type: 'gobelin', camp: 'monstre', x: 5, y: 5, taille: 1, numero: 1 },
      { id: 'c2', type: 'gobelin', camp: 'monstre', x: 6, y: 5, taille: 1, numero: 2, cache: true },
      { id: 'c3', type: 'pj', camp: 'pj', x: 1, y: 5, taille: 1, numero: 1 },
    ],
  });
  const salle = (id, nom) => ({ id, nom, texte: 'SECRET-TEXTE-SALLE', notes: 'SECRET-NOTE-SALLE', plan: plan(id) });
  const pres = p.creerPresentation({ nom: 'SECRET-NOM-DONJON', salles: { s1: salle('s1', 'SECRET-NOM-SALLE'), s2: salle('s2', 'SECRET-AUTRE-SALLE') }, salleActive: 's1', liaisons: [] });
  p.definirNotePartie(pres, 's1', 'SECRET-NOTE-PARTIE');
  return pres;
}

/** Ce que la régie envoie à la table pour cette partie, tel qu'il traverse le canal (copie structurée ≈ JSON). */
function envoi(pres, caseVisee = null) {
  const contenu = { plan: p.vueTable(pres), mini: p.miniPlanTable(pres), caseVisee: p.caseATable(pres, caseVisee), affichage: { ...AFFICHAGE_PAR_DEFAUT } };
  return JSON.parse(JSON.stringify(messageEtat(contenu)));
}
/** Les quatre champs d'un affichage, dans l'ordre où validerAffichage les rend (egal compare le JSON). */
const affichage = ({ mode, taille, grille, reperes }) => ({ mode, taille, grille, reperes });
const ids = (m) => ['portes', 'objets', 'creatures'].flatMap((l) => m.plan[l].map((e) => e.id)).sort();

const TESTS = [
  ['un point touché dans la vue « Table » porte sa position (fractions du cadre), relue avec ses bornes', () => {
    egal(lirePosition(messagePoint('p1', 0.25, 0.5)), { x: 0.25, y: 0.5 }, 'relue');
    egal(messagePoint('p1'), { type: MESSAGES.TABLE_POINT, id: 'p1' }, 'sans position : seulement l’identifiant');
    egal([lirePosition({ x: 2, y: 0.5 }), lirePosition({ x: 'a', y: 0 }), lirePosition(null), lirePosition({})], [null, null, null, null], 'hors bornes ou absente : null');
  }],
  ['les types de messages : distincts, et ceux que commande-table.js lit sont les mêmes', () => {
    egal(MESSAGES, { ETAT: 'etat', DEFILER: 'defiler', DEMANDE_ETAT: 'demande-etat', TABLE_DEPLACER: 'table-deplacer', TABLE_VISER: 'table-viser', TABLE_POINT: 'table-point' }, 'types sur le canal');
    egal(CANAL, 'carte-de-mj-presentation', 'nom du canal');
    egal(new Set(Object.values(MESSAGES)).size, Object.keys(MESSAGES).length, 'aucun type en double');
    const main = t.creerCommande('a'), libre = t.creerCommande('b');
    t.surMessage(libre, t.prendreMain(main, 1000)); // main prend la main : libre passe en retrait
    egal([t.surMessage(main, messageDemandeEtat()), t.surMessage(libre, messageDemandeEtat())], ['diffuser', 'presence'], 'demande d’état');
    egal([t.surMessage(main, messageDeplacer('c1', 2, 3)), t.surMessage(main, messageViser(2, 3)), t.surMessage(libre, messageViser(2, 3))], ['appliquer', 'appliquer', null], 'gestes de la table');
  }],
  ['messageEtat : exactement type, plan, mini, caseVisee, affichage', () => {
    const m = messageEtat({ plan: 1, mini: 2, caseVisee: 3, affichage: 4, intrus: 5 });
    egal(m, { type: 'etat', plan: 1, mini: 2, caseVisee: 3, affichage: 4 }, 'message');
    egal(Object.keys(m), ['type', 'plan', 'mini', 'caseVisee', 'affichage'], 'champs, dans l’ordre');
  }],
  ['le message envoyé à la table ne porte aucun secret : ni noms, textes, notes, ni autre salle', () => {
    const pres = partieAvecSecrets();
    const texte = JSON.stringify(envoi(pres));
    for (const secret of SECRETS) verifier(!texte.includes(secret), `« ${secret} » est dans le message envoyé à la table`);
    verifier(!texte.includes('"cache"'), 'un champ `cache` est dans le message');
    verifier(!texte.includes('"s1"') && !texte.includes('"s2"'), 'un identifiant de salle est dans le message');
    verifier(!texte.includes('liaisons') && !texte.includes('personnages'), 'liaisons ou personnages dans le message');
  }],
  ['une révélation fait apparaître l’élément dans le message ; un masque retire sa catégorie ; les pions des joueurs restent', () => {
    const pres = partieAvecSecrets();
    egal(ids(envoi(pres)), ['c1', 'c3', 'o1', 'p1'], 'au départ : ni porte, ni coffre, ni gobelin cachés');
    p.revelerElement(pres, 's1', 'o2');
    p.revelerElement(pres, 's1', 'p2');
    egal(ids(envoi(pres)), ['c1', 'c3', 'o1', 'o2', 'p1', 'p2'], 'après révélation');
    p.definirMasque(pres, 's1', 'objets', true);
    egal(ids(envoi(pres)), ['c1', 'c3', 'p1', 'p2'], 'objets masqués (révélés ou non)');
    p.definirMasque(pres, 's1', 'monstres', true);
    egal(ids(envoi(pres)), ['c3', 'p1', 'p2'], 'monstres masqués : le pion de joueur reste');
    p.recacherElement(pres, 's1', 'p2');
    egal(ids(envoi(pres)), ['c3', 'p1'], 'porte recachée');
    egal(Object.keys(envoi(pres).mini.plans).length, 1, 'l’encart ne montre que la salle découverte');
    verifier(!JSON.stringify(envoi(pres).mini).includes('"creatures":[{'), 'l’encart n’a aucun pion');
  }],
  ['lireEtat : ce que la régie envoie se relit à l’identique côté table', () => {
    const pres = partieAvecSecrets();
    p.revelerElement(pres, 's1', 'o2');
    const m = envoi(pres, { salle: 's1', x: 4, y: 4 });
    const lu = lireEtat(m, AFFICHAGE_PAR_DEFAUT);
    egal(ids({ plan: lu.plan }), ids(m), 'éléments du plan');
    egal([lu.plan.nom, lu.plan.connexions], ['', []], 'le plan relu n’a ni nom ni connexions');
    egal(lu.caseVisee, { x: 4, y: 4 }, 'case montrée');
    verifier(lu.mini && Object.keys(lu.mini.donjon.salles).length === 1 && lu.mini.actif in lu.mini.disposition.positions, 'encart relu');
    egal(lu.affichage, affichage(AFFICHAGE_PAR_DEFAUT), 'affichage');
  }],
  ['lireEtat : sans plan, rien à montrer ; un affichage invalide reprend l’affichage actuel', () => {
    const lu = lireEtat({ type: 'etat', plan: null, mini: null, caseVisee: { x: 1, y: 1 }, affichage: { mode: 'x', taille: 9999, grille: 'oui', reperes: 0 } }, AFFICHAGE_PAR_DEFAUT);
    egal([lu.plan, lu.mini, lu.caseVisee], [null, null, null], 'plan, encart, case');
    egal(lu.affichage, affichage(AFFICHAGE_PAR_DEFAUT), 'affichage de repli');
    const reel = { taille: 60, grille: false, reperes: false, mode: 'reel' };
    egal(lireEtat({ type: 'etat', affichage: { taille: 80, mode: 'bof' } }, reel).affichage, { mode: 'reel', taille: 80, grille: false, reperes: false }, 'champs valides gardés, autres repris');
  }],
  ['lireEtat : un message hostile n’affiche rien de caché, et ce qui ne se relit pas est écarté', () => {
    const pres = partieAvecSecrets();
    const m = envoi(pres);
    m.plan.objets.push({ id: 'ox', type: 'coffre', x: 2, y: 2, l: 1, h: 1, rotation: 0, cache: true });
    m.plan.creatures.push({ id: 'cx', type: 'gobelin', camp: 'monstre', x: 2, y: 3, taille: 1, numero: 9, cache: true });
    m.plan.portes.push({ id: 'px', mur: 'est', position: 3, type: 'porte', cache: true });
    m.plan.nom = 'SECRET-NOM-SALLE';
    const lu = lireEtat(m, AFFICHAGE_PAR_DEFAUT);
    egal(ids({ plan: lu.plan }), ids(envoi(pres)), 'les éléments marqués cachés sont écartés');
    egal(lu.plan.nom, '', 'le nom reçu est effacé');
    const mini = envoi(pres);
    mini.mini.plans.s0.objets.push({ id: 'ox', type: 'coffre', x: 2, y: 2, l: 1, h: 1, rotation: 0, cache: true });
    egal(lireEtat(mini, AFFICHAGE_PAR_DEFAUT).mini.donjon.salles.s0.plan.objets.map((o) => o.id), ['o1'], 'même règle pour l’encart');
    egal(lireEtat({ type: 'etat', plan: 'oups', mini: { x: 1 }, caseVisee: { x: 1, y: 1 } }, AFFICHAGE_PAR_DEFAUT).plan, null, 'plan illisible');
    egal(lireEtat({ type: 'etat', plan: 'oups', mini: { x: 1 }, caseVisee: { x: 1, y: 1 } }, AFFICHAGE_PAR_DEFAUT).mini, null, 'encart illisible');
    const horsSol = envoi(pres);
    horsSol.caseVisee = { x: 99, y: 99 };
    egal(lireEtat(horsSol, AFFICHAGE_PAR_DEFAUT).caseVisee, null, 'case hors de la salle');
  }],
  ['défiler : -1, 0 et 1 passent, tout le reste vaut 0 ; recentrer doit être exactement vrai', () => {
    egal(lireDefilement(messageDefiler(1, -1, false)), { dx: 1, dy: -1, recentrer: false }, 'valeurs valides');
    egal(lireDefilement(messageDefiler(0, 0, true)), { dx: 0, dy: 0, recentrer: true }, 'recentrer');
    egal(lireDefilement({ dx: 2, dy: '1', recentrer: 'oui' }), { dx: 0, dy: 0, recentrer: false }, 'valeurs hostiles');
    egal(lireDefilement({}), { dx: 0, dy: 0, recentrer: false }, 'message vide');
  }],
  ['les messages de la table à la régie : forme exacte', () => {
    egal(messageDemandeEtat(), { type: 'demande-etat' }, 'demande d’état');
    egal(messageDeplacer('c1', 3, 4), { type: 'table-deplacer', id: 'c1', x: 3, y: 4 }, 'pion glissé');
    egal(messageViser(2, 5), { type: 'table-viser', x: 2, y: 5 }, 'case touchée');
  }],
];

export const executer = () => executerSuite('protocole de la table : ', TESTS);
