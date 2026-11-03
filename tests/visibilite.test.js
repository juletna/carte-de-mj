/**
 * Tests des règles partagées par la Présentation, la pose et les commandes : ce que la table voit d'un élément
 * (`estDevoile`, `visibleATable`), les états d'un pion, le chevauchement unique et l'élément gênant d'`evaluerPose`.
 * Sans dépendance : marche sous Node et dans tests.html.
 */
import * as p from '../js/presentation.js';
import { ETATS } from '../js/schema.js';
import { evaluerPose, seChevauchent } from '../js/pose.js';
import { interpreterCommande as commande } from '../js/parseur/commandes.js';
import { genererDonjon } from '../js/generateur.js';
import { analyser } from '../js/parseur/index.js';
import { verifier, egal, executerSuite } from './mini-test.js';

/** Une partie à une salle avec un élément de chaque sorte, cachés ou non. */
function partieDeTest() {
  const plan = {
    version: 1, id: 's1', nom: 'Salle', largeur: 8, longueur: 8, sol: 'pierre', entree: 'sud', connexions: [],
    portes: [{ id: 'p1', mur: 'sud', position: 1, type: 'porte' }, { id: 'p2', mur: 'nord', position: 2, type: 'porte', cache: true }],
    objets: [{ id: 'o1', type: 'coffre', x: 1, y: 1, l: 1, h: 1, rotation: 0 }, { id: 'o2', type: 'coffre', x: 3, y: 1, l: 1, h: 1, rotation: 0, cache: true }],
    creatures: [
      { id: 'c1', type: 'gobelin', camp: 'monstre', x: 5, y: 5, taille: 1, numero: 1 },
      { id: 'c2', type: 'gobelin', camp: 'monstre', x: 6, y: 5, taille: 1, numero: 2, cache: true },
      { id: 'c3', type: 'pj', camp: 'pj', x: 1, y: 5, taille: 1, numero: 1 },
      { id: 'c4', type: 'garde', camp: 'pnj', x: 2, y: 5, taille: 1, numero: 1 },
    ],
  };
  return p.creerPresentation({ nom: 'D', salles: { s1: { id: 's1', nom: 'Salle', texte: '', notes: '', plan } }, salleActive: 's1', liaisons: [] });
}
const elements = (pres) => {
  const plan = pres.donjon.salles.s1.plan;
  return [...plan.portes.map((e) => ['porte', e]), ...plan.objets.map((e) => ['objet', e]), ...plan.creatures.map((e) => ['creature', e])];
};
const visibles = (pres) => elements(pres).filter(([genre, e]) => p.visibleATable(pres, 's1', genre, e)).map(([, e]) => e.id);

const TESTS = [
  ['estDevoile : ce qui n’est pas caché l’est toujours ; ce qui est caché le devient une fois révélé, et plus après recacher', () => {
    const pres = partieDeTest();
    const [coffre, coffreCache] = pres.donjon.salles.s1.plan.objets;
    egal([p.estDevoile(pres, 's1', coffre), p.estDevoile(pres, 's1', coffreCache)], [true, false], 'au départ');
    p.revelerElement(pres, 's1', 'o2');
    egal(p.estDevoile(pres, 's1', coffreCache), true, 'révélé');
    p.recacherElement(pres, 's1', 'o2');
    egal(p.estDevoile(pres, 's1', coffreCache), false, 'recaché');
    egal(p.estDevoile(pres, 's1', undefined), true, 'rien à cacher');
  }],
  ['estRevele : une partie sans révélations, ou une liste qui n’en est pas une, ne révèle rien (et ne lève pas)', () => {
    egal(p.estRevele({}, 's1', 'o2'), false, 'pas de reveles');
    egal(p.estRevele({ reveles: {} }, 's1', 'o2'), false, 'salle sans entrée');
    egal(p.estRevele({ reveles: { s1: 'o2' } }, 's1', 'o2'), false, 'ce n’est pas une liste');
    egal(p.estRevele({ reveles: { s1: ['o2'] } }, 's1', 'o2'), true, 'révélé');
  }],
  ['visibleATable : caché non révélé, puis masqué par catégorie ; les pions des joueurs et les portes ne se masquent jamais', () => {
    const pres = partieDeTest();
    egal(visibles(pres), ['p1', 'o1', 'c1', 'c3', 'c4'], 'au départ : tout sauf les cachés');
    p.revelerElement(pres, 's1', 'p2'); p.revelerElement(pres, 's1', 'o2'); p.revelerElement(pres, 's1', 'c2');
    egal(visibles(pres), ['p1', 'p2', 'o1', 'o2', 'c1', 'c2', 'c3', 'c4'], 'tout révélé : tout');
    p.definirMasque(pres, 's1', 'monstres', true);
    egal(visibles(pres), ['p1', 'p2', 'o1', 'o2', 'c3'], 'monstres et PNJ masqués, pion de joueur gardé');
    p.definirMasque(pres, 's1', 'objets', true);
    egal(visibles(pres), ['p1', 'p2', 'c3'], 'objets masqués aussi : restent les portes et le pion de joueur');
    p.recacherElement(pres, 's1', 'p2');
    egal(visibles(pres), ['p1', 'c3'], 'une porte recachée disparaît');
  }],
  ['visibleATable = ce que montre vueTable, élément par élément, y compris dans l’encart du plan (sans pions)', () => {
    const pres = partieDeTest();
    for (const [mode, ids] of [['rien', []], ['reveles', ['p2', 'o2', 'c2']], ['masques', ['o2']]]) {
      for (const id of ids) p.revelerElement(pres, 's1', id);
      if (mode === 'masques') { p.definirMasque(pres, 's1', 'monstres', true); p.definirMasque(pres, 's1', 'objets', true); }
      const vue = p.vueTable(pres);
      egal([...vue.portes, ...vue.objets, ...vue.creatures].map((e) => e.id), visibles(pres), `vueTable (${mode})`);
      const encart = Object.values(p.miniPlanTable(pres).plans)[0];
      egal([...encart.portes, ...encart.objets].map((e) => e.id), visibles(pres).filter((id) => !id.startsWith('c')), `encart (${mode})`);
      egal(encart.creatures, [], `l’encart n’a pas de pions (${mode})`);
    }
  }],
  ['visibleATable = vueTable sur des donjons au hasard, avec secrets, révélations et masques tirés', () => {
    for (const graine of [3, 14, 159, 2653]) {
      const { donjon } = genererDonjon({ salles: 4, monstres: 20, secretes: 3, pieges: 2, coffres: 3, graine });
      const pres = p.creerPresentation(donjon);
      let hasard = graine;
      const tirer = () => (hasard = (hasard * 1103515245 + 12345) % 2147483648) / 2147483648;
      for (const id of Object.keys(pres.donjon.salles)) {
        const plan = pres.donjon.salles[id].plan;
        for (const e of [...plan.portes, ...plan.objets, ...plan.creatures]) {
          if (tirer() < 0.3) e.cache = true;
          if (e.cache && tirer() < 0.5) p.revelerElement(pres, id, e.id);
        }
        for (const categorie of ['monstres', 'objets']) if (tirer() < 0.3) p.definirMasque(pres, id, categorie, true);
        p.afficherATable(pres, id);
        const plan2 = pres.donjon.salles[id].plan;
        const attendu = [
          ...plan2.portes.map((e) => ['porte', e]), ...plan2.objets.map((e) => ['objet', e]), ...plan2.creatures.map((e) => ['creature', e]),
        ].filter(([genre, e]) => p.visibleATable(pres, id, genre, e)).map(([, e]) => e.id);
        const vue = p.vueTable(pres);
        egal([...vue.portes, ...vue.objets, ...vue.creatures].map((e) => e.id), attendu, `donjon ${graine}, salle ${id}`);
      }
    }
  }],
  ['planPublic : le filtre `visible` reçoit le genre ; sans filtre, seul ce qui n’est pas caché sort', () => {
    const pres = partieDeTest();
    const plan = pres.donjon.salles.s1.plan;
    const vus = [];
    p.planPublic(plan, { visible: (e, genre) => { vus.push(`${genre}:${e.id}`); return true; } });
    egal(vus, ['porte:p1', 'porte:p2', 'objet:o1', 'objet:o2', 'creature:c1', 'creature:c2', 'creature:c3', 'creature:c4'], 'genre transmis');
    const sans = p.planPublic(plan);
    egal([...sans.portes, ...sans.objets, ...sans.creatures].map((e) => e.id), ['p1', 'o1', 'c1', 'c3', 'c4'], 'défaut : pas les cachés');
  }],
  ['états de pion : « normal » est la sentinelle, chaque état du schéma a son libellé, l’ordre est celui des boutons', () => {
    egal(p.ETAT_NORMAL, 'normal', 'sentinelle');
    egal(p.ETATS_DE_PION, ['normal', 'blesse', 'mort'], 'ordre des états proposés');
    egal(p.ETATS_DE_PION, [p.ETAT_NORMAL, ...ETATS], 'normal puis ceux du schéma');
    egal(p.LIBELLES_ETAT, { normal: 'normal', blesse: 'blessé', mort: 'mort' }, 'libellés');
    for (const e of p.ETATS_DE_PION) verifier(typeof p.LIBELLES_ETAT[e] === 'string', `libellé de ${e}`);
  }],
  ['definirEtat : blessé et mort posent le champ, « normal » le retire, un état inconnu est refusé', () => {
    const pres = partieDeTest();
    const pion = pres.donjon.salles.s1.plan.creatures[0];
    for (const etat of ETATS) {
      egal(p.definirEtat(pres, 's1', 'c1', etat), true, `${etat} accepté`);
      egal(pion.etat, etat, `${etat} posé`);
    }
    egal(p.definirEtat(pres, 's1', 'c1', p.ETAT_NORMAL), true, 'normal accepté');
    verifier(!('etat' in pion), 'normal retire le champ');
    egal(p.definirEtat(pres, 's1', 'c1', 'endormi'), false, 'état inconnu');
    egal(p.definirEtat(pres, 's1', 'inconnu', 'mort'), false, 'pion inconnu');
  }],
  ['seChevauchent : un seul test pour les éléments (taille ou l × h) et les rectangles, bords qui se touchent exclus', () => {
    const pion = (x, y, taille) => ({ x, y, taille });
    const objet = (x, y, l, h) => ({ x, y, l, h });
    egal(seChevauchent(pion(0, 0, 2), objet(1, 1, 2, 2)), true, 'pion 2×2 et objet qui mordent');
    egal(seChevauchent(pion(0, 0, 2), objet(2, 0, 1, 1)), false, 'côte à côte');
    egal(seChevauchent(pion(0, 0, 1), objet(0, 1, 3, 1)), false, 'dessus / dessous');
    egal(seChevauchent({ x: 2, y: 2, l: 1, h: 3 }, objet(0, 4, 5, 1)), true, 'rectangles { x, y, l, h }');
    egal(seChevauchent(objet(0, 0, 4, 4), objet(1, 1, 1, 1)), true, 'inclus');
    egal(seChevauchent(objet(1, 1, 1, 1), objet(0, 0, 4, 4)), true, 'dans l’autre sens aussi');
  }],
  ['evaluerPose : renvoie aussi l’élément qui gêne (objets d’abord, puis pions) ; rien si c’est hors de la salle ou posable', () => {
    const plan = analyser('Salle de 6 par 6 cases, un coffre en B2, un gobelin en B2, un gobelin en D4, une torche en A1').plan;
    const coffre = plan.objets.find((o) => o.type === 'coffre'), gob = plan.creatures.find((k) => k.x === 3 && k.y === 3);
    const surCoffre = evaluerPose(plan, 'objet', { type: 'tonneau', l: 1, h: 1 }, coffre.x, coffre.y);
    egal([surCoffre.ok, surCoffre.raison, surCoffre.gene.genre, surCoffre.gene.element.id], [false, 'gene', 'objet', coffre.id], 'objet sur un objet : l’objet d’abord');
    const surPion = evaluerPose(plan, 'objet', { type: 'tonneau', l: 1, h: 1 }, gob.x, gob.y);
    egal([surPion.raison, surPion.gene.genre, surPion.gene.element.id], ['gene', 'creature', gob.id], 'objet sur un pion');
    const pionSurPion = evaluerPose(plan, 'creature', { type: 'orque', taille: 1 }, gob.x, gob.y);
    egal([pionSurPion.raison, pionSurPion.gene.genre, pionSurPion.gene.element.id], ['gene', 'creature', gob.id], 'pion sur un pion');
    egal(evaluerPose(plan, 'creature', { type: 'orque', taille: 1 }, coffre.x, coffre.y + 2).ok, true, 'case libre');
    egal(evaluerPose(plan, 'creature', gob, gob.x, gob.y, gob).ok, true, 'un pion ne se gêne pas lui-même');
    const hors = evaluerPose(plan, 'creature', { type: 'orque', taille: 2 }, 5, 5);
    egal([hors.ok, hors.raison, 'gene' in hors], [false, 'hors', false], 'hors de la salle : pas d’élément gênant');
    egal(evaluerPose(plan, 'objet', { type: 'torche', l: 1, h: 1 }, coffre.x, coffre.y).ok, true, 'une torche se pose partout');
  }],
  ['commandes : le refus cite l’élément qui gêne, avec les mots d’avant (objets, puis pions ; en place, puis ajoutés)', () => {
    const plan = analyser('Salle de 8 par 8 cases, une porte au mur sud en D, une porte au mur est en 3, deux coffres en C4 F2, une statue en B6, deux gobelins en A1 H8, un pilier en E5.').plan;
    const attendu = {
      'ajoute un coffre en C4': 'C4 est déjà occupée (coffre). Précise une autre case ou un autre endroit. Rien n’a été modifié.',
      'ajoute un pilier en A1': 'A1 est déjà occupée (gobelin 1). Précise une autre case ou un autre endroit. Rien n’a été modifié.',
      'ajoute un gobelin en A1': 'A1 est déjà occupée (gobelin 1). Précise une autre case ou un autre endroit. Rien n’a été modifié.',
      'déplace le gobelin 2 en A1': 'A1 est déjà occupée (gobelin 1). Précise une autre destination. Rien n’a été modifié.',
      'ajoute une fosse en H8': 'H8 est déjà occupée (gobelin 2). Précise une autre case ou un autre endroit. Rien n’a été modifié.',
    };
    for (const [texte, message] of Object.entries(attendu)) egal(commande(texte, plan).message, message, texte);
  }],
];

export const executer = () => executerSuite('visibilité et pose : ', TESTS);
