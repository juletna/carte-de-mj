/**
 * Tests des règles pures de l'écran Monde (js/univers-vue.js).
 */
import * as v from '../js/univers-vue.js';
import { indexApresTouche, indexParFrappe } from '../js/univers-liste.js';
import { classesBouton } from '../js/univers-boutons.js';
import { verifier, egal, executerSuite } from './mini-test.js';

const FICHIERS = ['js/mj/univers-ui.js', 'js/mj/univers-menu.js', 'js/mj/univers-calage.js', 'js/mj/univers-liste.js', 'js/regie-univers.js',
  'js/atelier/inscrire-monde.js', 'js/atelier/inspecteurs-monde.js', 'js/atelier/barre-lieu.js',
  'js/bibliotheque/index.js', 'js/page-bibliotheque.js', 'bibliotheque.html', 'index.html', 'impression.html', 'js/main-impression.js'];
const sources = {};

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
  ['genre de destination', () => {
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
  ['liste déroulante : Bas/Haut/Début/Fin sautent les options désactivées, sans boucler', () => {
    const d = [false, true, false, false, true];
    egal(indexApresTouche('ArrowDown', 0, d), 2, 'bas saute le désactivé');
    egal(indexApresTouche('ArrowDown', 3, d), 3, 'bas à la fin : reste sur la dernière libre');
    egal(indexApresTouche('ArrowUp', 2, d), 0, 'haut saute le désactivé');
    egal(indexApresTouche('ArrowUp', 0, d), 0, 'haut au début : reste');
    egal(indexApresTouche('Home', 3, d), 0, 'début');
    egal(indexApresTouche('End', 0, d), 3, 'fin : dernière libre');
    egal(indexApresTouche('ArrowDown', -1, d), 0, 'depuis rien : première');
    egal(indexApresTouche('Home', 0, [true, true]), -1, 'tout désactivé');
  }],
  ['liste déroulante : une lettre saute à l’option qui commence ainsi (sans accents ni casse), en bouclant', () => {
    const l = ['Auberge', 'Écurie', 'Bois', 'Bourg', 'Nouvelle carte…'];
    egal(indexParFrappe(l, 'e', [], -1), 1, 'sans accent');
    egal(indexParFrappe(l, 'b', [], -1), 2, 'première');
    egal(indexParFrappe(l, 'b', [], 2), 3, 'suivante');
    egal(indexParFrappe(l, 'b', [], 3), 2, 'boucle');
    egal(indexParFrappe(l, 'bou', [], -1), 3, 'plusieurs lettres');
    egal(indexParFrappe(l, 'z', [], -1), -1, 'aucune');
    egal(indexParFrappe(l, ' ', [], -1), -1, 'espace seul');
    egal(indexParFrappe(l, 'bo', [false, false, true, false, false], -1), 3, 'désactivée ignorée');
  }],
  ['boutons du système visuel : classes btn, btn-icone pour une icône seule', () => {
    egal(classesBouton(), 'btn');
    egal(classesBouton({ classe: 'btn-primaire' }), 'btn btn-primaire');
    egal(classesBouton({ iconeSeule: true, classe: 'btn-discret' }), 'btn btn-icone btn-discret');
  }],
  ['écran Monde, bibliothèque, accueil, impression : plus d’emoji ni de caractère-icône (flèches ← ↑ ↓, ⋯, ✕, ＋…) dans le code et le balisage', () => {
    // « → » reste permis dans un texte (« Forêt → Village » : mène à), jamais comme icône de bouton.
    const INTERDITS = /[\u{1F300}-\u{1FAFF}\u2190\u2191\u2193-\u21FF\u2600-\u27BF\u2B00-\u2BFF\u22EF\u2715\uFF0B]/u;
    for (const [f, texte] of Object.entries(sources)) {
      const code = texte.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
      const m = code.match(INTERDITS);
      verifier(!m, `${f} : caractère-icône « ${m?.[0]} »`);
    }
  }],
];

export async function executer({ lire }) {
  for (const f of FICHIERS) sources[f] = await lire(f);
  return executerSuite('univers (écran Monde) : ', TESTS);
}
