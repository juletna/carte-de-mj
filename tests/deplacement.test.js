/**
 * Tests du glisser-déposer (js/deplacement.js) : le filtre du pointeur, l'option `deplacables` et la zone de clic élargie d'une porte.
 * Sans dépendance : marche sous Node et dans tests.html (le canvas et ses événements sont simulés).
 * Chaque test lève une Error au premier écart ; executer() renvoie la même forme que les autres.
 */
import { activerDeplacement, porteSous, BANDE_PORTE } from '../js/deplacement.js';
import { passageVise } from '../js/zone-passage.js';
import { egal, executerSuite } from './mini-test.js';

const TESTS = [
  ['glisser à la souris : un filtre écarte le doigt, une case vide est signalée', () => {
    const ecouteurs = {};
    const canvas = { addEventListener: (t, f) => { ecouteurs[t] = f; }, getBoundingClientRect: () => ({ left: 0, top: 0 }), setPointerCapture() {}, style: {} };
    const plan = { largeur: 6, longueur: 6, portes: [], objets: [], creatures: [{ id: 'c1', type: 'pj', camp: 'pj', x: 1, y: 1, taille: 1 }] };
    const clics = [];
    activerDeplacement(canvas, {
      plan: () => plan, taille: () => 10, apercu() {}, deposer() {}, cliquer: (t, c) => clics.push([t?.element?.id ?? null, c ?? null]),
      deplacables: ['creature'], filtre: (e) => e.pointerType === 'mouse',
    });
    const appui = (x, y, pointerType) => ecouteurs.pointerdown({ button: 0, clientX: (x + 1) * 10 + 5, clientY: (y + 1) * 10 + 5, pointerType, pointerId: 1, preventDefault() {} });
    appui(3, 3, 'touch');
    egal(clics, [], 'un doigt ne déclenche rien');
    appui(3, 4, 'mouse');
    egal(clics, [[null, [3, 4]]], 'la souris sur une case vide : la case');
  }],

  ['déplacement : l’option `deplacables` limite aux pions, sans option tout bouge comme avant', () => {
    const raf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = (f) => { f(); return 1; };
    try {
      const plan = () => ({
        largeur: 8, longueur: 8,
        portes: [{ id: 'p1', mur: 'nord', position: 5, type: 'porte' }],
        objets: [{ id: 'o1', type: 'pilier', x: 2, y: 2, l: 1, h: 1, rotation: 0 }],
        creatures: [{ id: 'c1', type: 'pj', camp: 'pj', x: 5, y: 5, taille: 1, numero: 1 }],
      });
      const sonde = (options) => {
        const ecouteurs = {};
        const canvas = { style: {}, addEventListener: (t, f) => { ecouteurs[t] = f; }, getBoundingClientRect: () => ({ left: 0, top: 0 }), setPointerCapture() {} };
        const journal = { deposes: [], clics: [], apercus: 0 };
        let courant = plan();
        activerDeplacement(canvas, {
          plan: () => courant, taille: () => 10, apercu: () => { journal.apercus++; },
          deposer: (n) => { journal.deposes.push(n); courant = n; }, cliquer: (t) => journal.clics.push(t && t.genre), ...options,
        });
        const evt = (cx, cy) => ({ button: 0, pointerId: 1, clientX: (cx + 1) * 10, clientY: (cy + 1) * 10, type: 'pointerup', preventDefault() {} });
        const glisser = (de, vers) => { ecouteurs.pointerdown(evt(...de)); ecouteurs.pointermove(evt(...vers)); ecouteurs.pointerup(evt(...vers)); };
        return { glisser, journal };
      };
      // Option active : le pion bouge ; l’objet et la porte sont seulement cliquables.
      let t = sonde({ deplacables: ['creature'] });
      t.glisser([5.5, 5.5], [6.5, 5.5]);
      egal([t.journal.deposes.length, t.journal.deposes[0]?.creatures[0].x], [1, 6], 'le pion se déplace');
      t.glisser([2.5, 2.5], [4.5, 2.5]);
      egal(t.journal.deposes.length, 1, 'l’objet ne bouge pas');
      t.glisser([5.5, -0.2], [1.5, -0.2]);
      egal(t.journal.deposes.length, 1, 'la porte ne bouge pas');
      egal(t.journal.clics, ['objet', 'porte'], 'mais objet et porte restent cliquables (le pion déposé n’est pas un clic)');
      // Sans l’option (donjon.html) : tout se déplace.
      t = sonde({});
      t.glisser([2.5, 2.5], [4.5, 2.5]);
      t.glisser([5.5, -0.2], [1.5, -0.2]);
      egal(t.journal.deposes.length, 2, 'sans option, l’objet et la porte bougent encore');
    } finally {
      globalThis.requestAnimationFrame = raf;
    }
  }],

  ['passage : zone de clic élargie (case du mur + marges, 44 px au doigt), la porte gagne près d’un objet ou d’un pion', () => {
    const plan = {
      largeur: 10, longueur: 8,
      portes: [{ id: 'pn', mur: 'nord', position: 4, type: 'porte' }, { id: 'pe', mur: 'est', position: 3, type: 'porte' }],
      objets: [{ id: 'esc', type: 'escalier', x: 7, y: 5, l: 1, h: 1, rotation: 0 }, { id: 'coffre', type: 'coffre', x: 1, y: 1, l: 1, h: 1, rotation: 0 }],
      creatures: [],
    };
    const id = (r) => r && r.element.id;
    // Noyau : toute la case du mur, de 0,6 case dehors à 0,5 dedans.
    egal(id(passageVise(4.5, -0.5, plan)), 'pn', 'noyau : à l’extérieur du mur');
    egal(id(passageVise(4.5, 0.4, plan)), 'pn', 'noyau : à l’intérieur');
    egal(passageVise(4.5, 0.4, plan).noyau, true, 'noyau signalé');
    // Étendue : une case vers l’intérieur ou l’extérieur, 0,35 case sur les côtés ; rien au-delà.
    egal(id(passageVise(4.5, 0.9, plan)), 'pn', 'étendue : 0,9 case à l’intérieur (à 1 case du bord de l’ouverture)');
    egal(id(passageVise(4.5, -0.95, plan)), 'pn', 'étendue : presque une case dehors');
    egal(id(passageVise(3.7, 0.3, plan)), 'pn', 'étendue : sur le côté, le long du mur');
    egal(passageVise(3.5, 0.3, plan), null, 'au-delà de la marge latérale : rien');
    egal(passageVise(4.5, 1.3, plan), null, 'trop loin à l’intérieur : rien');
    egal(id(passageVise(9.4, 3.5, plan)), 'pe', 'mur est : noyau (retrait 0, mur à x = 10)');
    egal(id(passageVise(9.1, 3.5, plan)), 'pe', 'mur est : étendue vers l’intérieur');
    // Priorité : dans l’étendue, un pion ou un objet déjà sous le pointeur garde son clic ; dans le noyau, la porte gagne.
    const pion = { id: 'k' };
    egal(passageVise(4.5, 0.9, plan, { occupant: pion }), null, 'étendue : un pion dessous garde son clic');
    egal(id(passageVise(4.5, 0.4, plan, { occupant: pion })), 'pn', 'noyau : la porte gagne malgré le pion');
    // Escalier : sa case, plus une demi-case autour.
    egal(id(passageVise(7.5, 5.5, plan)), 'esc', 'escalier : sa case');
    egal(id(passageVise(8.3, 5.5, plan)), 'esc', 'escalier : demi-case autour');
    egal(passageVise(8.7, 5.5, plan), null, 'escalier : au-delà de la demi-case');
    egal(id(passageVise(8.55, 5.5, plan, { taille: 20, tactile: true })), 'esc', 'escalier au doigt : 44 px minimum (2,2 cases à 20 px)');
    // Au doigt : zone d’au moins 44 px dans chaque sens, même quand les cases sont petites.
    egal(passageVise(4.5, 1.05, plan, { taille: 20, tactile: false }), null, 'souris : 1,05 case dedans, hors zone');
    egal(id(passageVise(4.5, 1.05, plan, { taille: 20, tactile: true })), 'pn', 'doigt, cases de 20 px : zone de 44 px (2,2 cases) au moins');
    egal(id(passageVise(3.45, 0.3, plan, { taille: 20, tactile: true })), 'pn', 'doigt, cases de 20 px : élargie le long du mur aussi');
    // Deux portes voisines : la plus proche l’emporte.
    const deux = { ...plan, portes: [{ id: 'a', mur: 'nord', position: 4, type: 'porte' }, { id: 'b', mur: 'nord', position: 5, type: 'porte' }], objets: [] };
    egal([id(passageVise(4.95, 0.3, deux)), id(passageVise(5.05, 0.3, deux))], ['a', 'b'], 'noyaux voisins : la case sous le pointeur');
    egal(id(passageVise(5.2, 0.8, deux)), 'b', 'étendues qui se chevauchent : la plus proche');
  }],

  ['porte / pion : zone de clic élargie vers l’intérieur ; clic = porte, glissement = pion ; sans option, rien ne change', () => {
    const raf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = (f) => { f(); return 1; };
    try {
      const plan8 = () => ({
        largeur: 8, longueur: 8,
        portes: [{ id: 'p1', mur: 'nord', position: 5, type: 'porte' }],
        objets: [],
        creatures: [{ id: 'c1', type: 'pj', camp: 'pj', x: 5, y: 0, taille: 1, numero: 1 }], // pion juste devant la porte
      });
      // Fonction pure : la zone de la porte s'étend de BANDE_PORTE case vers l'intérieur, pas au-delà, pas à côté.
      const p = plan8();
      egal(porteSous(5.5, 0.1, p)?.id, 'p1', 'porte : dans le mur élargi par défaut (0,2 case)');
      egal(porteSous(5.5, 0.4, p), null, 'sans bande : 0,4 case à l’intérieur n’est plus la porte');
      egal(porteSous(5.5, 0.4, p, BANDE_PORTE)?.id, 'p1', 'avec la bande : 0,4 case à l’intérieur est la porte');
      egal(porteSous(5.5, BANDE_PORTE + 0.05, p, BANDE_PORTE), null, 'au-delà de la bande : plus la porte');
      egal(porteSous(4.5, 0.3, p, BANDE_PORTE), null, 'à côté de la porte (autre case du mur) : rien');
      const sonde = (options) => {
        const ecouteurs = {};
        const canvas = { style: {}, addEventListener: (t, f) => { ecouteurs[t] = f; }, getBoundingClientRect: () => ({ left: 0, top: 0 }), setPointerCapture() {} };
        const journal = { deposes: [], clics: [] };
        let courant = plan8();
        activerDeplacement(canvas, {
          plan: () => courant, taille: () => 10, apercu: () => {},
          deposer: (n) => { journal.deposes.push(n); courant = n; }, cliquer: (t) => journal.clics.push(t && `${t.genre}:${t.element.id}`),
          deplacables: ['creature'], ...options,
        });
        const evt = (cx, cy) => ({ button: 0, pointerId: 1, clientX: (cx + 1) * 10, clientY: (cy + 1) * 10, type: 'pointerup', preventDefault() {} });
        return {
          journal,
          clic: (cx, cy) => { ecouteurs.pointerdown(evt(cx, cy)); ecouteurs.pointerup(evt(cx, cy)); },
          glisser: (de, vers) => { ecouteurs.pointerdown(evt(...de)); ecouteurs.pointermove(evt(...vers)); ecouteurs.pointerup(evt(...vers)); },
        };
      };
      // Avec l'option (régie) : dans la bande, le clic va à la porte même si un pion est dessous ; plus bas, au pion.
      let t = sonde({ portesLarges: true });
      t.clic(5.5, 0.3);
      t.clic(5.5, 0.8);
      egal(t.journal.clics, ['porte:p1', 'creature:c1'], 'bande de bord : porte ; reste de la case : pion');
      // Un glissement commencé dans la bande, sur le pion, déplace le pion (et ne clique pas la porte).
      t = sonde({ portesLarges: true });
      t.glisser([5.5, 0.3], [5.5, 3.5]);
      egal([t.journal.clics.length, t.journal.deposes[0]?.creatures[0].y], [0, 3], 'glissement : le pion bouge, aucun clic');
      egal(t.journal.deposes[0].portes[0].position, 5, 'la porte n’a pas bougé');
      // Sans l'option (Donjon) : comportement d'avant, le pion capte le clic dans la bande.
      t = sonde({ deplacables: undefined });
      t.clic(5.5, 0.3);
      egal(t.journal.clics, ['creature:c1'], 'sans option : le pion capte le clic comme avant');
      t.clic(5.5, -0.2);
      egal(t.journal.clics, ['creature:c1', 'porte:p1'], 'sans option : la porte reste cliquable dans le mur');
    } finally {
      globalThis.requestAnimationFrame = raf;
    }
  }],
];

export const executer = () => executerSuite('présentation : ', TESTS);
