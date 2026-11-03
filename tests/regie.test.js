/**
 * Tests de ce que la régie calcule pour la case montrée à la table et pour l'écran de départ (presentation.js, pur) :
 * `caseATable`, `viserCase`, `oublierCaseSiResolue`, `resumePartie`. Sans dépendance : marche sous Node et dans tests.html.
 */
import * as p from '../js/presentation.js';
import { verifier, egal, executerSuite } from './mini-test.js';

/** Deux salles de 6 × 6 : « Entrée » (un pion de taille 2 en B2) et « Crypte » (un pion en D4). */
function partieDeTest() {
  const salle = (id, nom, creatures) => ({
    id, nom, texte: '', notes: '',
    plan: { version: 1, id, nom, largeur: 6, longueur: 6, sol: 'pierre', entree: 'sud', connexions: [], portes: [], objets: [], creatures },
  });
  const pion = (id, x, y, taille) => ({ id, type: 'gobelin', camp: 'monstre', x, y, taille, numero: 1 });
  return p.creerPresentation({
    nom: 'Donjon', salleActive: 's1', liaisons: [],
    salles: { s1: salle('s1', 'Entrée', [pion('c1', 1, 1, 2)]), s2: salle('s2', 'Crypte', [pion('c2', 3, 3, 1)]) },
  });
}

const TESTS = [
  ['caseATable : la case montrée seulement si elle est dans la salle que voient les joueurs', () => {
    const pres = partieDeTest();
    egal(p.caseATable(pres, { salle: 's1', x: 4, y: 5 }), { x: 4, y: 5 }, 'dans la salle courante : sans le nom de la salle');
    egal(p.caseATable(pres, { salle: 's2', x: 4, y: 5 }), null, 'dans une autre salle');
    egal(p.caseATable(pres, null), null, 'aucune case');
    egal(p.caseATable(null, { salle: 's1', x: 0, y: 0 }), null, 'aucune partie');
  }],
  ['viserCase : un clic montre la case, un second clic au même endroit l’enlève, une autre case la déplace', () => {
    const pres = partieDeTest();
    const premiere = p.viserCase(null, pres, 's1', 4, 4);
    egal(premiere, { salle: 's1', x: 4, y: 4 }, 'première case');
    egal(p.viserCase(premiere, pres, 's1', 4, 4), null, 'même case : enlevée');
    egal(p.viserCase(premiere, pres, 's1', 5, 4), { salle: 's1', x: 5, y: 4 }, 'autre case : déplacée');
    egal(p.viserCase(premiere, pres, 's2', 4, 4), { salle: 's2', x: 4, y: 4 }, 'même case dans une autre salle : montrée');
  }],
  ['viserCase : hors du sol, hors de la grille ou dans une salle inconnue, rien n’est montré (et l’ancienne case est effacée)', () => {
    const pres = partieDeTest();
    const avant = { salle: 's1', x: 1, y: 1 };
    egal(p.viserCase(avant, pres, 's1', 6, 0), null, 'hors de la grille');
    egal(p.viserCase(avant, pres, 's1', -1, 2), null, 'négative');
    egal(p.viserCase(avant, pres, 'inconnue', 1, 1), null, 'salle inconnue');
    egal(p.viserCase(avant, pres, 's1', 1.5, 1), null, 'non entière');
  }],
  ['oublierCaseSiResolue : un pion qui s’y pose l’efface (même un grand pion), et une salle que plus personne ne regarde', () => {
    const pres = partieDeTest();
    const libre = { salle: 's1', x: 4, y: 4 };
    egal(p.oublierCaseSiResolue(libre, pres, 's1'), libre, 'case libre : gardée');
    egal(p.oublierCaseSiResolue(null, pres, 's1'), null, 'aucune case');
    egal(p.oublierCaseSiResolue({ salle: 's1', x: 1, y: 1 }, pres, 's1'), null, 'pion de taille 2 : coin');
    egal(p.oublierCaseSiResolue({ salle: 's1', x: 2, y: 2 }, pres, 's1'), null, 'pion de taille 2 : case opposée');
    egal(p.oublierCaseSiResolue({ salle: 's1', x: 3, y: 2 }, pres, 's1'), { salle: 's1', x: 3, y: 2 }, 'à côté du pion : gardée');
    const crypte = { salle: 's2', x: 0, y: 0 };
    egal(p.oublierCaseSiResolue(crypte, pres, 's1'), null, 'ni la régie (s1) ni la table (s1) ne regardent s2');
    egal(p.oublierCaseSiResolue(crypte, pres, 's2'), crypte, 'la régie consulte s2 : gardée');
    pres.salleCourante = 's2';
    egal(p.oublierCaseSiResolue(crypte, pres, 's1'), crypte, 'la table est en s2 : gardée');
    egal(p.oublierCaseSiResolue({ salle: 'inconnue', x: 0, y: 0 }, pres, 'inconnue'), { salle: 'inconnue', x: 0, y: 0 }, 'salle absente de la partie : aucun pion, la régie la consulte');
  }],
  ['resumePartie : la salle courante, les salles découvertes sur le total, au singulier ou au pluriel', () => {
    const pres = partieDeTest();
    pres.decouvertes = ['s1'];
    egal(p.resumePartie(pres), 'Partie en cours : salle « Entrée », 1 salle découverte sur 2.', 'une découverte');
    pres.decouvertes = ['s1', 's2'];
    pres.salleCourante = 's2';
    egal(p.resumePartie(pres), 'Partie en cours : salle « Crypte », 2 salles découvertes sur 2.', 'deux découvertes');
    verifier(p.resumePartie(pres).startsWith('Partie en cours'), 'début de phrase');
  }],
];

export const executer = () => executerSuite('régie : ', TESTS);
