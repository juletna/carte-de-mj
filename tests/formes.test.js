/**
 * Tests des formes de salle (js/formes.js) et de ce qui en dépend : texte, pose, portes, couloirs, table.
 * Sans dépendance : marche sous Node et dans tests.html.
 */
import * as m from '../js/donjon.js';
import { FORMES, POSITIONS_FORMES, casesRetirees, estSol, nombreCases, retraitPorte, brasDe, brasMax, surLeSol } from '../js/formes.js';
import { analyser } from '../js/parseur/index.js';
import { decrire } from '../js/parseur/decrire.js';
import { validerPlan } from '../js/schema.js';
import { changerForme, evaluerPose, redimensionner } from '../js/pose.js';
import { disposerPlan, cheminCouloir } from '../js/plan-donjon.js';
import { porteSous } from '../js/deplacement.js';
import * as p from '../js/presentation.js';
import { interpreterCommande } from '../js/parseur/commandes.js';

function verifier(condition, message) { if (!condition) throw new Error(message); }
function egal(obtenu, attendu, quoi) {
  const a = JSON.stringify(obtenu), b = JSON.stringify(attendu);
  if (a !== b) throw new Error(`${quoi} : attendu ${b}, obtenu ${a}`);
}
const plan = (forme, largeur, longueur, bras, position) => ({ forme, largeur, longueur, ...(bras ? { bras } : {}), ...(position ? { position } : {}) });

/** Toutes les cases de sol se touchent-elles ? Une forme ne doit jamais couper la salle en deux. */
function dunSeulTenant(q) {
  const sol = [];
  for (let y = 0; y < q.longueur; y++) for (let x = 0; x < q.largeur; x++) if (estSol(q, x, y)) sol.push(`${x},${y}`);
  const vus = new Set([sol[0]]), pile = [sol[0]];
  while (pile.length) {
    const [x, y] = pile.pop().split(',').map(Number);
    for (const [i, j] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      const k = `${i},${j}`;
      if (estSol(q, i, j) && !vus.has(k)) { vus.add(k); pile.push(k); }
    }
  }
  return vus.size === sol.length;
}

const TESTS = [
  ['une croix se règle en taille et en épaisseur : 8, 24, 46 ou 84 cases', () => {
    egal(nombreCases(plan('croix', 3, 3, 1)), 5, '3 × 3, bras de 1 : la plus petite');
    egal(nombreCases(plan('croix', 3, 6, 1)), 8, '3 × 6, bras de 1');
    egal(nombreCases(plan('croix', 12, 13, 1)), 24, '12 × 13, bras de 1');
    egal(nombreCases(plan('croix', 12, 13, 2)), 46, '12 × 13, bras de 2');
    egal(nombreCases(plan('croix', 12, 13, 4)), 84, '12 × 13, bras de 4');
  }],
  ['les bras d’une croix montent et descendent', () => {
    const rangee = (position) => { for (let y = 0; y < 13; y++) if (estSol(plan('croix', 12, 13, 1, position), 0, y)) return y; return null; };
    egal([rangee('haut'), rangee('milieu'), rangee('bas')], [4, 6, 8], 'rangée des bras');
  }],
  ['toute forme reste d’un seul tenant, et chaque mur porte une porte possible', () => {
    for (const forme of FORMES.filter((f) => f !== 'rectangle')) {
      for (const position of POSITIONS_FORMES[forme] || [undefined]) {
        for (const [W, L] of [[3, 3], [4, 7], [8, 8], [12, 13], [30, 9]]) {
          const q = plan(forme, W, L, undefined, position);
          for (let bras = 1; bras <= Math.max(1, brasMax(q)); bras++) {
            const r = { ...q, bras };
            const quoi = `${forme} ${position} ${W}×${L} bras ${bras}`;
            verifier(nombreCases(r) > 0 && dunSeulTenant(r), `${quoi} : coupée en deux`);
            for (let x = 0; x < W; x++) for (const mur of ['nord', 'sud']) {
              const d = retraitPorte(r, mur, x);
              verifier(estSol(r, x, mur === 'nord' ? d : L - 1 - d), `${quoi} : porte ${mur} ${x} dans le vide`);
            }
            for (let y = 0; y < L; y++) for (const mur of ['ouest', 'est']) {
              const d = retraitPorte(r, mur, y);
              verifier(estSol(r, mur === 'ouest' ? d : W - 1 - d, y), `${quoi} : porte ${mur} ${y} dans le vide`);
            }
          }
        }
      }
    }
  }],
  ['une salle trop petite pour sa forme reste un rectangle, sans plantage', () => {
    egal(casesRetirees(plan('croix', 2, 8)).size, 0, 'croix de 2 de large');
    egal(casesRetirees(plan('T', 1, 1)).size, 0, 'T d’une case');
    egal(brasDe(plan('croix', 12, 13, 50)), 10, 'une épaisseur trop grande est bornée');
    egal(casesRetirees({ largeur: 5, longueur: 2, sol: 'pierre' }).size, 0, 'plan sans champ forme (vignettes)');
  }],
  ['texte : les formes se lisent', () => {
    const lire = (t) => { const { forme, bras, position, largeur, longueur } = analyser(t).plan; return { forme, bras, position, largeur, longueur }; };
    egal(lire('Salle en croix de 12 par 13 cases, bras de 2 cases, bras en haut'), { forme: 'croix', bras: 2, position: 'haut', largeur: 12, longueur: 13 }, 'croix');
    egal(lire('Salle en U de 8 par 8 cases, ouverte au sud').position, 'sud', 'U');
    egal(lire('Salle en L de 8 par 8 cases, angle au nord-est').position, 'nord-est', 'L');
    egal(lire('Salle en T de 8 par 8 cases, barre au nord').forme, 'T', 'T');
    egal(lire('Salle octogonale de 9 par 9 cases, pans de 2 cases').bras, 2, 'octogone');
    egal(lire('Église cruciforme de 9 par 9 cases').forme, 'croix', 'cruciforme');
  }],
  ['texte : « en l » ou « en t » ne sont pas pris pour une forme ailleurs', () => {
    egal(analyser('Salle de 6 par 6 cases, un lustre suspendu en l air').plan.forme, 'rectangle', 'en l air');
    egal(analyser('Salle de 6 par 6 cases, un coffre en C4').plan.forme, 'rectangle', 'en C4');
    const { plan: q, ignores } = analyser('Salle de 6 par 6 cases, un coffre en L4');
    egal([q.forme, ignores], ['rectangle', []], 'colonne L');
  }],
  ['texte : l’aller-retour garde la forme, la porte et le mobilier', () => {
    for (const texte of [
      'Salle en croix de 12 par 13 cases, bras de 2 cases, bras en haut, une porte au mur nord en G, un coffre en G7, deux gobelins en F6 G6',
      'Salle en L de 8 par 6 cases, bras de 3 cases, angle au nord est, une porte au mur est en 6, un pilier en B5',
      'Salle en U de 9 par 9 cases, bras de 2 cases, ouverte au est, une porte au mur est en 1',
      'Salle en T de 9 par 7 cases, bras de 2 cases, barre au ouest',
      'Salle en octogone de 9 par 9 cases, pans de 2 cases, sol en marbre, une porte au mur nord en E',
    ]) {
      const un = analyser(texte).plan;
      const deux = analyser(decrire(un)).plan;
      const utile = ({ forme, bras, position, largeur, longueur, sol, portes, objets, creatures }) => ({ forme, bras, position, largeur, longueur, sol, portes, objets, creatures });
      egal(utile(deux), utile(un), `aller-retour de « ${texte} »`);
      egal(validerPlan(un).ok, true, `plan valide pour « ${texte} » : ${validerPlan(un).erreurs}`);
    }
  }],
  ['placement : rien ne tombe sur une case retirée', () => {
    const { plan: q, compris } = analyser('Salle en croix de 12 par 12 cases, bras de 2 cases, un coffre en A1, six gobelins, quatre torches, deux piliers, un autel au fond');
    for (const o of q.objets) verifier(surLeSol(q, o.x, o.y, o.l, o.h), `${o.type} en ${o.x},${o.y} sur une case retirée`);
    for (const k of q.creatures) verifier(surLeSol(q, k.x, k.y, k.taille, k.taille), `${k.type} en ${k.x},${k.y} sur une case retirée`);
    verifier(q.objets.some((o) => o.type === 'coffre'), `le coffre imposé en A1 est gardé, à côté : ${compris}`);
    egal(validerPlan(q).ok, true, 'plan valide');
  }],
  ['validation : un élément sur une case retirée est refusé, la forme est relue', () => {
    const q = { largeur: 8, longueur: 8, forme: 'croix', bras: 2, position: 'haut', objets: [{ type: 'coffre', x: 0, y: 0 }] };
    const res = validerPlan(q);
    egal(res.ok, false, 'coffre dans le vide');
    egal([res.plan.forme, res.plan.bras, res.plan.position], ['croix', 2, 'haut'], 'la forme reste');
    egal(validerPlan({ largeur: 8, longueur: 8, forme: 'étoile', bras: 'x' }).plan.forme, 'rectangle', 'forme inconnue');
    verifier(!('bras' in validerPlan({ largeur: 8, longueur: 8, forme: 'étoile', bras: 2 }).plan), 'pas de bras sur un rectangle');
  }],
  ['pose : les cases retirées refusent, le reste accepte', () => {
    const q = { ...analyser('Salle en croix de 8 par 8 cases, bras de 2 cases').plan };
    egal(evaluerPose(q, 'creature', { type: 'gobelin', taille: 1 }, 0, 0).raison, 'hors', 'pion dans un coin retiré');
    egal(evaluerPose(q, 'creature', { type: 'gobelin', taille: 1 }, 3, 3).ok, true, 'pion au centre');
    egal(evaluerPose(q, 'objet', { type: 'torche', l: 1, h: 1, rotation: 0 }, 0, 0).raison, 'hors', 'torche dans un coin retiré');
  }],
  ['changer de forme pousse ce qui gêne, puis redimensionner garde la forme', () => {
    const q = analyser('Salle de 8 par 8 cases, un coffre en A1, un gobelin en H8, un pilier en D4').plan;
    const res = changerForme(q, { forme: 'croix', bras: 2 });
    egal(res.deplaces, 2, 'le coffre et le gobelin se poussent');
    for (const o of [...res.plan.objets]) verifier(surLeSol(res.plan, o.x, o.y, o.l, o.h), `${o.type} reste sur le sol`);
    for (const k of res.plan.creatures) verifier(surLeSol(res.plan, k.x, k.y, 1, 1), `${k.type} reste sur le sol`);
    egal(res.plan.objets.find((o) => o.type === 'pilier').x, 3, 'le pilier ne bouge pas');
    const retour = changerForme(res.plan, { forme: 'rectangle' });
    verifier(!('bras' in retour.plan) && retour.plan.forme === 'rectangle', 'revenir au rectangle retire le bras');
    const grand = redimensionner(res.plan, 'est', 4);
    egal([grand.plan.forme, grand.plan.bras, grand.plan.largeur], ['croix', 2, 12], 'la forme suit les dimensions');
    const moinsPlace = changerForme(analyser('Salle de 3 par 3 cases, neuf gobelins').plan, { forme: 'croix', bras: 1 });
    verifier(moinsPlace.erreur, 'pas assez de sol : refus plutôt qu’une perte');
  }],
  ['portes : au fond de l’entaille, et cliquables à cet endroit', () => {
    const q = analyser('Salle en croix de 12 par 12 cases, bras de 2 cases, une porte au mur nord en A, une porte au mur nord en F').plan;
    egal(retraitPorte(q, 'nord', 0), 5, 'en A : au bout du bras ouest, à la rangée 5');
    egal(retraitPorte(q, 'nord', 5), 0, 'en F : au bout du bras nord');
    egal(porteSous(0.5, 5, q)?.position, 0, 'clic sur la porte au fond de l’entaille');
    egal(porteSous(0.5, 0, q), null, 'clic au bord du rectangle, là où il n’y a plus de mur');
  }],
  ['couloirs : ils rejoignent la porte au fond de l’entaille sans traverser le sol', () => {
    const d = m.creerDonjon({ nom: 'Église', texte: 'Salle en croix de 12 par 12 cases, bras de 2 cases, une porte au mur est en 2' });
    const nef = d.salleActive;
    const b = m.ajouterSalle(d, { nom: 'Sacristie', texte: 'Salle de 5 par 5 cases, une porte au mur ouest en 3' });
    const portes = d.salles[nef].plan.portes;
    m.relier(d, { salle: nef, mur: 'est', position: portes[0].position }, { salle: b.id, mur: 'ouest', position: 2 });
    const disp = disposerPlan(d);
    const c = disp.couloirs[0];
    const r = disp.positions[nef];
    egal(c.de.x, r.x + 12 - 5, 'le couloir part du mur de la croix, 5 cases en retrait du rectangle');
    for (const pt of cheminCouloir(c).slice(1, -1)) verifier(!estSol(d.salles[nef].plan, Math.floor(pt.x) - r.x, Math.floor(pt.y) - r.y), 'pas à travers le sol');
  }],
  ['table : la forme arrive à la table, et sur la mini-carte', () => {
    const d = m.creerDonjon({ nom: 'Église', texte: 'Salle en croix de 12 par 12 cases, bras de 2 cases, bras en haut' });
    const pres = p.creerPresentation(d, { salleDepart: d.salleActive });
    const vue = p.vueTable(pres);
    egal([vue.forme, vue.bras, vue.position], ['croix', 2, 'haut'], 'vue table');
    egal([p.recevoirVueTable(vue).forme, p.recevoirVueTable(vue).bras], ['croix', 2], 'relue par la fenêtre table');
    const mini = p.recevoirMiniPlan(p.miniPlanTable(pres));
    egal(mini.salles[0].vides.length, casesRetirees(d.salles[d.salleActive].plan).size, 'les cases retirées, sur la mini-carte');
    egal(p.recevoirMiniPlan({ ...mini, salles: [{ ...mini.salles[0], vides: 'x' }] }), null, 'vides invalides : refus');
    const { places } = p.placerPions(d.salles[d.salleActive].plan, [{ id: 'k', type: 'guerrier', taille: 1 }], { mur: 'nord', position: 0 });
    verifier(surLeSol(d.salles[d.salleActive].plan, places[0].x, places[0].y), 'un pion qui entre arrive sur le sol');
  }],
  ['une commande ne pose rien sur une case retirée', () => {
    const q = analyser('Salle en croix de 12 par 12 cases, bras de 2 cases').plan;
    const refus = interpreterCommande('ajoute un coffre en A1', q);
    verifier(refus.ok === false, `refus attendu, obtenu ${JSON.stringify(refus).slice(0, 120)}`);
    const ok = interpreterCommande('ajoute trois gobelins', q);
    verifier(ok.ok, `ajout attendu : ${JSON.stringify(ok).slice(0, 120)}`);
    for (const k of ok.plan.creatures) verifier(surLeSol(ok.plan, k.x, k.y, k.taille, k.taille), 'pions sur le sol');
    egal(ok.plan.forme, 'croix', 'la commande garde la forme');
  }],
];

export function executer() {
  return TESTS.map(([nom, test]) => {
    try {
      test();
      return { phrase: `formes : ${nom}`, ecarts: [], resultat: null };
    } catch (err) {
      return { phrase: `formes : ${nom}`, ecarts: [err.message], resultat: null };
    }
  });
}
