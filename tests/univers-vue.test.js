/**
 * Tests des règles pures de l'écran Monde (js/univers-vue.js).
 */
import * as v from '../js/univers-vue.js';
import { verifier, egal, executerSuite } from './mini-test.js';

const TESTS = [
  ['calage : proposé à l’échelle des figurines ou sans niveau connu, pas pour un continent ni une région', () => {
    for (const n of ['zone', 'localite', 'batiment', 'souterrain', undefined, null, '']) verifier(v.calagePossible(n), `calage possible : ${n}`);
    for (const n of ['monde', 'region']) verifier(!v.calagePossible(n), `calage refusé : ${n}`);
  }],
  ['adresse d’ouverture : #monde, #monde=<id>, rien d’autre', () => {
    egal(v.analyserHash('#monde'), { id: null }, '#monde');
    egal(v.analyserHash('#monde=u-12'), { id: 'u-12' }, 'avec identifiant');
    egal(v.analyserHash('#monde=a%20b'), { id: 'a b' }, 'décodé');
    egal(v.analyserHash('#monde=%E0%A4%A'), { id: null }, 'mal encodé : ouvre sans choisir');
    for (const h of ['', '#', '#mondes', '#autre', undefined, null]) egal(v.analyserHash(h), null, `ignorée : ${h}`);
    egal(v.analyserHash(v.hashMonde('u 1')), { id: 'u 1' }, 'aller-retour');
    egal(v.hashMonde(null), '#monde', 'sans id');
  }],
  ['lien Jouer et genre de destination', () => {
    egal(v.lienJouer('u-1'), 'presentation.html?univers=u-1', 'lien');
    egal(v.lienJouer('a&b'), 'presentation.html?univers=a%26b', 'encodé');
    egal(v.genreDestination(null), '', 'rien');
    egal(v.genreDestination({ lieu: 'l1' }), 'carte', 'carte');
    egal(v.genreDestination({ donjon: 'd1', salle: 's' }), 'donjon', 'donjon');
  }],
  ['nom du lieu créé depuis un point : celui du point, sinon le titre de l’image', () => {
    egal(v.nomDuNouveauLieu('  Port-Sel ', 'Village côtier'), 'Port-Sel', 'nom du point');
    egal(v.nomDuNouveauLieu('', 'Village côtier'), 'Village côtier', 'titre de l’image');
    egal(v.nomDuNouveauLieu('', ''), undefined, 'rien');
  }],
  ['durée d’une notification : bornée, plus longue avec une action', () => {
    verifier(v.dureeNotification('Ok.') >= 3500, 'minimum');
    verifier(v.dureeNotification('x'.repeat(2000)) <= 6000, 'maximum simple');
    verifier(v.dureeNotification('Retiré.', { action: true }) > v.dureeNotification('Retiré.'), 'action plus longue');
    verifier(v.dureeNotification('Erreur longue '.repeat(30), { erreur: true }) <= 9000, 'maximum erreur');
  }],
];

export const executer = () => executerSuite('univers (écran Monde) : ', TESTS);
