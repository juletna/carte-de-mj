/**
 * Tests de l'arbre unifié de l'atelier (js/atelier-arbre.js, pur).
 */
import * as u from '../js/univers.js';
import { creerDonjon, ajouterSalle } from '../js/donjon.js';
import { arbreAtelier, filtrerAtelier, noeudParCle, parcourir, etatJeu, trouverActif } from '../js/atelier-arbre.js';
import { verifier, egal, executerSuite } from './mini-test.js';

const IMG = (id = 'monde-01') => ({ source: 'bibliotheque', id });
const noms = (n) => n.enfants.map((e) => e.nom);
const dico = (...ds) => Object.fromEntries(ds.map((d) => [d.id, d]));

/** Monde → Forêt → Clairière ; un donjon (3 salles) relié depuis la Forêt ET la Clairière ; un lieu non relié ; un donjon libre. */
function exemple() {
  const univ = u.creerUnivers({ nom: 'Marches' });
  const continent = u.ajouterLieu(univ, { nom: 'Continent', image: IMG() });
  const foret = u.ajouterLieu(univ, { nom: 'Forêt', image: IMG('f') });
  const clairiere = u.ajouterLieu(univ, { nom: 'Clairière', image: IMG('c') });
  const perdu = u.ajouterLieu(univ, { nom: 'Lieu perdu', image: IMG('p') });
  u.ajouterPoint(univ, continent.id, { vers: { lieu: foret.id } });
  u.ajouterPoint(univ, foret.id, { vers: { lieu: clairiere.id } });
  const crypte = creerDonjon({ nom: 'Crypte' });
  ajouterSalle(crypte, { nom: 'Ossuaire' });
  ajouterSalle(crypte, { nom: 'Trésor' });
  const libre = creerDonjon({ nom: 'Cave libre' });
  const vide = creerDonjon({ nom: 'Vide' });
  u.ajouterPoint(univ, foret.id, { vers: { donjon: crypte.id } });
  u.ajouterPoint(univ, clairiere.id, { vers: { donjon: crypte.id, salle: Object.keys(crypte.salles)[1] } });
  u.ajouterPoint(univ, perdu.id, { vers: { donjon: vide.id } });
  return { univ, continent, foret, clairiere, perdu, crypte, libre, vide, donjons: dico(crypte, libre, vide) };
}

const TESTS = [
  ['monde avec lieux imbriqués, donjon et salles dans l’ordre', () => {
    const e = exemple();
    const a = arbreAtelier({ univers: e.univ, donjons: e.donjons });
    egal(a.mondes.length, 1, 'un monde');
    const m = a.mondes[0];
    egal([m.type, m.nom, m.cle, m.contexte], ['monde', 'Marches', `m:${e.univ.id}`, { monde: e.univ.id }], 'monde');
    egal(noms(m), ['Continent', 'Lieu perdu'], 'racine puis lieu non relié');
    const continent = m.enfants[0];
    egal([continent.type, continent.depart], ['lieu', true], 'racine');
    const foret = continent.enfants[0];
    egal(foret.contexte, { monde: e.univ.id, lieu: e.foret.id }, 'contexte du lieu');
    egal(noms(foret), ['Clairière', 'Crypte'], 'lieux puis donjons');
    const crypte = foret.enfants[1];
    egal(crypte.type, 'donjon', 'donjon');
    egal(crypte.contexte, { monde: e.univ.id, lieu: e.foret.id, donjon: e.crypte.id }, 'contexte du donjon');
    egal(noms(crypte), Object.values(e.crypte.salles).map((s) => s.nom), 'salles dans l’ordre du donjon');
    egal(crypte.enfants[0].contexte, { ...crypte.contexte, salle: Object.keys(e.crypte.salles)[0] }, 'contexte de salle');
    egal(crypte.enfants.every((s) => s.type === 'salle' && s.enfants.length === 0), true, 'les salles sont des feuilles');
  }],
  ['donjon relié par deux lieux : une seule fois, l’autre lieu cité', () => {
    const e = exemple();
    const a = arbreAtelier({ univers: e.univ, donjons: e.donjons });
    const lesCryptes = [...parcourir(a)].filter((n) => n.type === 'donjon' && n.id === e.crypte.id);
    egal(lesCryptes.length, 1, 'une seule fois');
    egal(lesCryptes[0].aussiDepuis, ['Clairière'], 'aussi depuis');
    const cles = [...parcourir(a)].map((n) => n.cle);
    egal(new Set(cles).size, cles.length, 'clés uniques');
  }],
  ['lieu non relié et son donjon ; donjon hors monde', () => {
    const e = exemple();
    const a = arbreAtelier({ univers: e.univ, donjons: e.donjons });
    const perdu = a.mondes[0].enfants[1];
    egal([perdu.nom, perdu.nonRelie, noms(perdu)], ['Lieu perdu', true, ['Vide']], 'lieu non relié avec son donjon');
    egal(a.mondes[0].enfants[0].nonRelie, undefined, 'la racine est reliée');
    egal([a.horsMonde.nom, a.horsMonde.type, noms(a.horsMonde)], ['Donjons hors monde', 'groupe', ['Cave libre']], 'hors monde');
    const libre = a.horsMonde.enfants[0];
    egal([libre.cle, libre.contexte, noms(libre)], [`d:${e.libre.id}`, { donjon: e.libre.id }, [Object.values(e.libre.salles)[0].nom]], 'donjon libre');
  }],
  ['sans monde : tous les donjons hors monde ; sans rien : arbre vide ; dictionnaire, liste et univers seul acceptés', () => {
    const e = exemple();
    const sans = arbreAtelier({ univers: null, donjons: e.donjons });
    egal([sans.mondes.length, sans.horsMonde.enfants.length], [0, 3], 'sans monde');
    egal(arbreAtelier({}).horsMonde.enfants, [], 'vide');
    for (const forme of [e.univ, [e.univ], { [e.univ.id]: e.univ }]) egal(arbreAtelier({ univers: forme, donjons: e.donjons }).mondes.length, 1, 'forme');
  }],
  ['donjon disparu : le point est ignoré ; univers sans lieu : monde sans enfants', () => {
    const e = exemple();
    const a = arbreAtelier({ univers: e.univ, donjons: dico(e.libre) });
    egal([...parcourir(a)].some((n) => n.id === e.crypte.id), false, 'crypte absente');
    const vide = u.creerUnivers({ nom: 'Rien' });
    egal(arbreAtelier({ univers: vide }).mondes[0].enfants, [], 'monde vide');
  }],
  ['filtre sur les quatre types, avec les ancêtres', () => {
    const e = exemple();
    const a = arbreAtelier({ univers: e.univ, donjons: e.donjons });
    const f = filtrerAtelier(a, 'ossuaire');
    egal(f.mondes.length, 1, 'le monde reste');
    const crypte = f.mondes[0].enfants[0].enfants[0].enfants[0];
    egal([crypte.nom, noms(crypte)], ['Crypte', ['Ossuaire']], 'salle trouvée sous ses ancêtres');
    egal(noms(filtrerAtelier(a, 'CLAIRIERE').mondes[0].enfants[0].enfants[0]), ['Clairière'], 'lieu, sans accents ni casse');
    egal(filtrerAtelier(a, 'cave').horsMonde.enfants.map((n) => n.nom), ['Cave libre'], 'donjon hors monde');
    egal(filtrerAtelier(a, 'marches').mondes.map((n) => n.nom), ['Marches'], 'monde');
    const rien = filtrerAtelier(a, 'zzz');
    egal([rien.mondes.length, rien.horsMonde.enfants.length], [0, 0], 'rien');
    egal(filtrerAtelier(a, '  ') === a, true, 'texte vide : tel quel');
  }],
  ['nœud actif : salle, donjon, lieu, monde ; ce qui a disparu retombe au-dessus', () => {
    const e = exemple();
    const s1 = Object.keys(e.crypte.salles)[1];
    const ctx = { monde: e.univ.id, lieu: e.foret.id, donjon: e.crypte.id, salle: s1 };
    const a = arbreAtelier({ univers: e.univ, donjons: e.donjons, actif: ctx });
    egal(a.actif.cle, `s:${e.foret.id}:${e.crypte.id}:${s1}`, 'salle');
    egal(a.actif.chemin, [`m:${e.univ.id}`, `l:${e.univ.id}:${e.continent.id}`, `l:${e.univ.id}:${e.foret.id}`, `d:${e.foret.id}:${e.crypte.id}`], 'ancêtres');
    egal(trouverActif(a, { ...ctx, salle: 'fantome' }).cle, `d:${e.foret.id}:${e.crypte.id}`, 'salle disparue : le donjon');
    egal(trouverActif(a, { donjon: 'fantome', lieu: e.foret.id, monde: e.univ.id }).cle, `l:${e.univ.id}:${e.foret.id}`, 'donjon disparu : le lieu');
    egal(trouverActif(a, { donjon: e.crypte.id }).cle, `d:${e.foret.id}:${e.crypte.id}`, 'donjon relié, sans lieu cité');
    egal(trouverActif(a, { donjon: e.libre.id }).chemin, ['hors-monde'], 'hors monde');
    egal(trouverActif(a, { monde: 'x' }), { cle: null, chemin: [] }, 'monde inconnu');
    egal(noeudParCle(a, 'hors-monde').nom, 'Donjons hors monde', 'noeudParCle');
    egal(noeudParCle(a, 'nope'), null, 'clé inconnue');
  }],
  ['mode jeu : pastille table / découvert / caché', () => {
    const e = exemple();
    const a = arbreAtelier({ univers: e.univ, donjons: e.donjons });
    const [sa, sb] = Object.keys(e.crypte.salles).slice(0, 2);
    const partie = {
      univers: { univers: e.univ.id, lieuCourant: e.foret.id, chemin: [e.continent.id], decouverts: [e.continent.id, e.foret.id], reveles: {} },
      presentations: { [e.crypte.id]: { salleCourante: sa, decouvertes: [sa] } },
    };
    const etat = (cle) => etatJeu(noeudParCle(a, cle), partie);
    egal(etat(`l:${e.univ.id}:${e.foret.id}`), 'table', 'lieu courant');
    egal(etat(`l:${e.univ.id}:${e.continent.id}`), 'decouvert', 'lieu découvert');
    egal(etat(`l:${e.univ.id}:${e.clairiere.id}`), 'cache', 'lieu caché');
    egal(etat(`d:${e.foret.id}:${e.crypte.id}`), 'decouvert', 'donjon commencé');
    egal(etat(`d:${e.libre.id}`), 'cache', 'donjon jamais joué');
    partie.univers.dans = { donjon: e.crypte.id };
    egal(etat(`d:${e.foret.id}:${e.crypte.id}`), 'table', 'donjon où est la table');
    egal(etat(`s:${e.foret.id}:${e.crypte.id}:${sa}`), 'table', 'salle courante');
    egal(etat(`s:${e.foret.id}:${e.crypte.id}:${sb}`), 'cache', 'salle jamais montrée');
    egal(etat(`l:${e.univ.id}:${e.foret.id}`), 'decouvert', 'le lieu n’est plus « table » dans un donjon');
    verifier(etatJeu(noeudParCle(a, `m:${e.univ.id}`), {}) === 'cache', 'sans partie');
  }],
];

export async function executer() {
  return executerSuite('atelier (arbre) : ', TESTS);
}
