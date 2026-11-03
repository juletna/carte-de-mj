/**
 * Tests des formes de salle (js/formes.js) et de ce qui en dépend : texte, pose, portes, couloirs, table.
 * Sans dépendance : marche sous Node et dans tests.html.
 */
import * as m from '../js/donjon.js';
import { FORMES, POSITIONS_FORMES, casesRetirees, estSol, nombreCases, retraitPorte, brasDe, brasMax, surLeSol, contourSol } from '../js/formes.js';
import { analyser } from '../js/parseur/index.js';
import { decrire } from '../js/parseur/decrire.js';
import { validerPlan, SOLS } from '../js/schema.js';
import { changerForme, evaluerPose, redimensionner } from '../js/pose.js';
import { disposerPlan, cheminCouloir } from '../js/plan-donjon.js';
import { porteSous } from '../js/deplacement.js';
import * as p from '../js/presentation.js';
import { interpreterCommande } from '../js/parseur/commandes.js';
import { verifier, egal, executerSuite } from './mini-test.js';

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
  ['les lettres et le 8 ont la bonne silhouette', () => {
    const dessin = (forme, W, L) => {
      const q = plan(forme, W, L, 1);
      return Array.from({ length: L }, (_, y) => Array.from({ length: W }, (_, x) => (estSol(q, x, y) ? '#' : '.')).join('')).join(' ');
    };
    egal(dessin('O', 4, 4), '#### #..# #..# ####', 'O');
    egal(dessin('8', 3, 5), '### #.# ### #.# ###', '8');
    egal(dessin('E', 3, 5), '### #.. ### #.. ###', 'E');
    egal(dessin('F', 4, 5), '#### #... ###. #... #...', 'F');
    egal(dessin('H', 3, 3), '#.# ### #.#', 'H');
    egal(dessin('S', 3, 5), '### #.. ### ..# ###', 'S');
    egal(nombreCases(plan('O', 8, 8, 2)), 48, 'un O de 8 × 8, bras de 2');
    egal(nombreCases(plan('8', 3, 4, 1)), 12, 'trop petit pour un 8 : reste un rectangle');
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
    for (const f of ['8', 'E', 'F', 'H', 'O', 'S']) {
      egal(lire(`Salle en ${f} de 9 par 11 cases, bras de 2 cases`), { forme: f, bras: 2, largeur: 9, longueur: 11 }, `forme ${f}`);
      egal(lire(`Salle en forme de ${f} de 9 par 11 cases`).forme, f, `en forme de ${f}`);
    }
  }],
  ['texte : « en l » ou « en t » ne sont pas pris pour une forme ailleurs', () => {
    egal(analyser('Salle de 6 par 6 cases, un lustre suspendu en l air').plan.forme, 'rectangle', 'en l air');
    egal(analyser('Salle de 6 par 6 cases, un coffre en C4').plan.forme, 'rectangle', 'en C4');
    const { plan: q, ignores } = analyser('Salle de 6 par 6 cases, un coffre en L4');
    egal([q.forme, ignores], ['rectangle', []], 'colonne L');
    for (const [c, position] of [['L', 11], ['T', 19], ['U', 20]]) {
      const porte = analyser(`Salle de 30 par 30 cases, une porte au mur nord en ${c}, un coffre`).plan;
      egal([porte.forme, porte.portes[0].position], ['rectangle', position], `porte en colonne ${c}`);
      const dansLaForme = analyser(`Salle en croix de 30 par 30 cases, une porte au mur nord en ${c}`).plan;
      egal([dansLaForme.forme, dansLaForme.portes[0].position], ['croix', position], `porte en colonne ${c} d’une croix`);
      egal(analyser(`Salle de 30 par 30 cases, une porte en ${c}`).plan.forme, 'rectangle', `autre phrase en ${c}`);
    }
    egal(analyser('Salle de 8 par 8 cases en L').plan.forme, 'L', 'après les dimensions, dans la première phrase');
    for (const [c, position] of [['E', 4], ['F', 5], ['H', 7], ['O', 14], ['S', 18]]) {
      const porte = analyser(`Salle de 30 par 30 cases, une porte au mur nord en ${c}`).plan;
      egal([porte.forme, porte.portes[0].position], ['rectangle', position], `porte en colonne ${c}`);
      egal(analyser(`Une porte en ${c}, salle de 30 par 30 cases`).plan.forme, 'rectangle', `première phrase : porte en ${c}`);
      egal(analyser(`Un coffre en ${c}, salle de 30 par 30 cases`).plan.forme, 'rectangle', `première phrase : coffre en ${c}`);
    }
    const parHuit = analyser('Salle en 8 par 6').plan;
    egal([parHuit.forme, parHuit.largeur, parHuit.longueur], ['rectangle', 5, 4], '« en 8 par 6 » : des dimensions, en mètres');
    egal(analyser('Salle de 9 par 9 cases, une porte au mur est en 8').plan.forme, 'rectangle', 'porte à la rangée 8');
  }],
  ['texte : l’aller-retour garde la forme, la porte et le mobilier', () => {
    for (const texte of [
      'Salle en croix de 12 par 13 cases, bras de 2 cases, bras en haut, une porte au mur nord en G, un coffre en G7, deux gobelins en F6 G6',
      'Salle en L de 8 par 6 cases, bras de 3 cases, angle au nord est, une porte au mur est en 6, un pilier en B5',
      'Salle en U de 9 par 9 cases, bras de 2 cases, ouverte au est, une porte au mur est en 1',
      'Salle en T de 9 par 7 cases, bras de 2 cases, barre au ouest',
      'Salle en 8 de 9 par 11 cases, bras de 2 cases, une porte au mur nord en E, un coffre en A1',
      'Salle en E de 9 par 11 cases, une porte au mur est en 2, deux gobelins en A2 A3',
      'Salle en F de 9 par 11 cases, une porte au mur sud en A',
      'Salle en H de 9 par 9 cases, bras de 2 cases, une porte au mur nord en E',
      'Salle en O de 9 par 9 cases, bras de 2 cases, une porte au mur ouest en 5',
      'Salle en S de 9 par 11 cases, une porte au mur est en 9',
      'Salle en octogone de 9 par 9 cases, pans de 2 cases, sol en marbre, une porte au mur nord en E',
    ]) {
      const un = analyser(texte).plan;
      const deux = analyser(decrire(un)).plan;
      const utile = ({ forme, bras, position, largeur, longueur, sol, portes, objets, creatures }) => ({ forme, bras, position, largeur, longueur, sol, portes, objets, creatures });
      egal(utile(deux), utile(un), `aller-retour de « ${texte} »`);
      egal(validerPlan(un).ok, true, `plan valide pour « ${texte} » : ${validerPlan(un).erreurs}`);
    }
  }],
  ['le sol : chaque matière se réécrit et se relit, sans toucher au reste', () => {
    const q = analyser('Salle en croix de 12 par 13 cases, bras de 2 cases, une porte au mur nord en G, un coffre en G7, un gobelin en F6').plan;
    for (const sol of SOLS) {
      const relu = analyser(decrire({ ...q, sol })).plan;
      egal(relu.sol, sol, `sol en ${sol}`);
      egal([relu.forme, relu.portes, relu.objets, relu.creatures], [q.forme, q.portes, q.objets, q.creatures], `le reste de la salle, sol en ${sol}`);
      egal(analyser(decrire({ ...q, sol })).ignores, [], `mots non compris, sol en ${sol}`);
    }
  }],
  ['placement : rien ne tombe sur une case retirée', () => {
    const { plan: q, compris } = analyser('Salle en croix de 12 par 12 cases, bras de 2 cases, un coffre en A1, six gobelins, quatre torches, deux piliers, un autel au fond');
    for (const o of q.objets) verifier(surLeSol(q, o.x, o.y, o.l, o.h), `${o.type} en ${o.x},${o.y} sur une case retirée`);
    for (const k of q.creatures) verifier(surLeSol(q, k.x, k.y, k.taille, k.taille), `${k.type} en ${k.x},${k.y} sur une case retirée`);
    verifier(q.objets.some((o) => o.type === 'coffre'), `le coffre imposé en A1 est gardé, à côté : ${compris}`);
    egal(validerPlan(q).ok, true, 'plan valide');
  }],
  ['un O : les couloirs n’entrent pas dans sa cour, rien ne s’y pose', () => {
    const q = analyser('Salle en O de 9 par 9 cases, bras de 2 cases, huit gobelins, un coffre').plan;
    for (const k of q.creatures) verifier(surLeSol(q, k.x, k.y, 1, 1), 'pion sur le sol');
    egal(evaluerPose(q, 'creature', { type: 'gobelin', taille: 1 }, 4, 4).raison, 'hors', 'la cour est vide');
    const d = m.creerDonjon({ nom: 'Cloître', texte: 'Salle en O de 9 par 9 cases, bras de 2 cases, une porte au mur est en 5' });
    const b = m.ajouterSalle(d, { nom: 'Annexe', texte: 'Salle de 5 par 5 cases, une porte au mur ouest en 3' });
    m.relier(d, { salle: d.salleActive, mur: 'est', position: 4 }, { salle: b.id, mur: 'ouest', position: 2 });
    const disp = disposerPlan(d);
    const r = disp.positions[d.salleActive];
    for (const pt of cheminCouloir(disp.couloirs[0]).slice(1, -1)) verifier(pt.x > r.x + 9 - 1, 'le couloir reste dehors');
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
    egal(casesRetirees(mini.donjon.salles[mini.actif].plan).size, casesRetirees(d.salles[d.salleActive].plan).size, 'la croix, sur l’encart');
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
  ['le contour d’une salle suit sa forme, sans déborder sur les coins vides', () => {
    const cadre = (segments) => {
      const xs = segments.flatMap((s) => [s.x1, s.x2]), ys = segments.flatMap((s) => [s.y1, s.y2]);
      return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    };
    egal(cadre(contourSol(plan('rectangle', 3, 2), 10, 1)), [-1, -1, 31, 21], 'un rectangle : son cadre, décalé de d');
    const segments = contourSol(plan('L', 3, 3, 1, 'sud-ouest'), 10, 1);
    egal(cadre(segments), [-1, -1, 31, 31], 'le L tient dans son rectangle');
    const coin = (s, x, y) => (s.x1 === x && s.y1 === y) || (s.x2 === x && s.y2 === y);
    egal(segments.filter((s) => coin(s, 11, 19)).length, 2, 'le coin rentrant : deux segments raccourcis qui se rejoignent');
    verifier(!segments.some((s) => coin(s, 31, -1)), 'rien dans le coin vide');
    for (const forme of FORMES) {
      for (const position of POSITIONS_FORMES[forme] || [undefined]) {
        const q = plan(forme, 11, 11, undefined, position);
        const bouts = new Map();
        for (const s of contourSol(q, 10, 3)) for (const c of [`${s.x1},${s.y1}`, `${s.x2},${s.y2}`]) bouts.set(c, (bouts.get(c) || 0) + 1);
        const ouverts = [...bouts].filter(([, n]) => n % 2);
        egal(ouverts, [], `${forme} ${position || ''} : le contour est fermé`);
      }
    }
  }],
];

export const executer = () => executerSuite('formes : ', TESTS);
