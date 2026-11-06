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
  ['arbre des lieux : parents, doublons, boucles, non reliés, donjons en feuilles', () => {
    const l = (id, nom, ...vers) => ({ id, nom, points: vers.map((x, i) => ({ id: `p${i}`, nom: '', x: 0.5, y: 0.5, vers: x })) });
    const u = { racine: 'a', lieux: {
      a: l('a', 'Monde', { lieu: 'b' }, { lieu: 'c' }, { donjon: 'd1' }),
      b: l('b', 'Région', { lieu: 'd' }, { lieu: 'a' }),                // retour vers la racine : pas de « aussi depuis »
      c: l('c', 'Côte', { lieu: 'd' }, { lieu: 'c' }, { lieu: 'zz' }), // d atteint aussi par c ; boucle sur soi ; cible disparue
      d: l('d', 'Village', { donjon: 'd1' }, { donjon: 'd1' }, { donjon: 'perdu' }),
      e: l('e', 'Île isolée', { lieu: 'f' }),
      f: l('f', 'Grotte', { donjon: 'd2' }),
    } };
    const donjons = { d1: { id: 'd1', nom: 'Crypte' }, d2: { id: 'd2', nom: 'Repaire' } };
    const t = v.arbreLieux(u, donjons);
    egal(t.racine.id, 'a', 'racine');
    verifier(t.racine.depart && !t.racine.enfants[0].depart, 'badge départ sur la racine seule');
    egal(t.racine.enfants.map((n) => `${n.type}:${n.id}`), ['lieu:b', 'lieu:c', 'donjon:d1'], 'enfants de la racine, dans l’ordre des points');
    const b = t.racine.enfants[0];
    egal(b.enfants.map((n) => n.id), ['d'], 'd est sous son premier parent (b), en largeur');
    egal(b.enfants[0].aussiDepuis, ['Côte'], 'aussi depuis c');
    egal(b.enfants[0].enfants.map((n) => `${n.type}:${n.id}`), ['donjon:d1'], 'donjon en feuille, une fois ; donjon disparu absent');
    egal(t.racine.aussiDepuis, [], 'un retour vers l’ancêtre n’est pas une autre entrée');
    egal(t.racine.enfants[1].enfants, [], 'pas de boucle sur soi, cible disparue ignorée');
    egal(b.chemin, ['l:a'], 'chemin des ancêtres');
    egal(t.nonRelies.map((n) => n.id), ['e', 'f'], 'non reliés');
    egal(t.nonRelies[1].enfants.map((n) => n.id), ['d2'], 'leurs donjons aussi');
    egal(v.arbreLieux({ racine: null, lieux: {} }), { racine: null, nonRelies: [] }, 'monde vide');
    const sans = v.arbreLieux({ racine: 'x', lieux: { a: l('a', 'A', { lieu: 'b' }), b: l('b', 'B', { lieu: 'a' }) } });
    egal([sans.racine.id, sans.racine.enfants[0].id, sans.racine.enfants[0].enfants.length], ['a', 'b', 0], 'racine inconnue : le premier lieu, sans boucle');
  }],
  ['filtre de l’arbre : sans accents ni casse, garde les ancêtres', () => {
    const l = (id, nom, ...vers) => ({ id, nom, points: vers.map((x, i) => ({ id: `p${i}`, x: 0, y: 0, vers: x })) });
    const u = { racine: 'a', lieux: { a: l('a', 'Monde', { lieu: 'b' }), b: l('b', 'Région', { lieu: 'c' }), c: l('c', 'Épée-du-Roi'), z: l('z', 'Zone') } };
    const t = v.arbreLieux(u, {});
    egal(v.filtrerArbre(t, ''), t, 'vide : inchangé');
    const f = v.filtrerArbre(t, ' epee ');
    egal([f.racine.id, f.racine.enfants[0].id, f.racine.enfants[0].enfants[0].id, f.nonRelies.length], ['a', 'b', 'c', 0], 'ancêtres gardés');
    egal(v.filtrerArbre(t, 'REGION').racine.enfants[0].enfants, [], 'région trouvée, sa branche non montrée');
    egal(v.filtrerArbre(t, 'zon').nonRelies.map((n) => n.id), ['z'], 'non reliés filtrés');
    egal(v.filtrerArbre(t, 'rien').racine, null, 'aucun résultat');
  }],
];

export const executer = () => executerSuite('univers (écran Monde) : ', TESTS);
