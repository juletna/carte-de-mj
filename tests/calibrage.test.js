/**
 * Tests de la logique du calibrage côté régie (js/calibrage.js) : étapes, brouillon de taille, messages envoyés, annulation et fin.
 * Sans DOM ni stockage : marche sous Node et dans tests.html. Et un contrôle des pages : le mode est bien dans presentation.html.
 */
import { creerCalibrage } from '../js/calibrage.js';
import { lireCalibrage } from '../js/protocole-table.js';
import { verifier, egal, executerSuite } from './mini-test.js';

/** Un calibrage branché sur des réglages et un canal simulés. */
function fabrique(r = { taille: 48 }) {
  const envois = [], ecritures = [];
  const c = creerCalibrage({ r, envoyer: (m) => envois.push(JSON.parse(JSON.stringify(m))), enregistrer: () => ecritures.push({ ...r }) });
  return { c, r, envois, ecritures };
}

const TESTS = [
  ['au repos : pas de calibrage, rien d’envoyé, la taille est celle des réglages', () => {
    const { c, envois } = fabrique({ taille: 52 });
    egal([c.actif(), c.etape(), c.taille(), c.message()], [false, null, 52, null], 'état initial');
    egal(envois, [], 'aucun message');
    c.ajuster(1); c.suivante(); c.terminer(); c.annuler();
    egal(envois, [], 'les actions hors calibrage ne font rien');
  }],
  ['démarrer : commence à « mesurer », envoie le message avec l’orientation et la taille visée des réglages', () => {
    const { c, envois } = fabrique({ taille: 52, rotationTable: 90, miroirTable: true, caseMm: 28 });
    c.demarrer();
    egal(envois, [{ type: 'calibrage', etape: 'mesurer', taille: 52, caseMm: 28, rotation: 90, miroir: true }], 'message');
    c.demarrer('orienter');
    egal(envois.length, 1, 'déjà en cours : sans effet');
    const autre = fabrique(); autre.c.demarrer('orienter');
    egal(autre.c.etape(), 'orienter', 'départ au choix');
    const bidon = fabrique(); bidon.c.demarrer('piratage');
    egal(bidon.c.etape(), 'mesurer', 'départ inconnu : mesurer');
  }],
  ['les messages envoyés se relisent à l’identique côté table, sans rien de la partie', () => {
    const { c, envois } = fabrique({ taille: 61.5, caseMm: 30 });
    c.demarrer('verifier');
    egal(lireCalibrage(envois[0], { taille: 48 }), { etape: 'verifier', taille: 61.5, caseMm: 30, rotation: 0, miroir: false }, 'relu');
  }],
  ['étapes : suivante et précédente parcourent orienter, mesurer, vérifier, terminé ; précédente bute sur la première', () => {
    const { c, envois } = fabrique();
    c.demarrer('orienter');
    c.precedente();
    egal(c.etape(), 'orienter', 'la première reste la première');
    const vues = [];
    for (let i = 0; i < 3; i++) { c.suivante(); vues.push(c.etape()); }
    egal(vues, ['mesurer', 'verifier', 'termine'], 'dans l’ordre');
    c.precedente();
    egal(c.etape(), 'verifier', 'retour');
    c.aller('orienter'); c.aller('inconnue');
    egal(c.etape(), 'orienter', 'aller : étape inconnue ignorée');
    egal(envois.at(-1).etape, 'orienter', 'chaque changement est envoyé à la table');
  }],
  ['ajuster : le brouillon bouge au dixième dans les bornes, sans rien enregistrer', () => {
    const { c, r, ecritures, envois } = fabrique({ taille: 48 });
    c.demarrer();
    c.ajuster(0.1); c.ajuster(0.1); c.ajuster(1);
    egal(c.taille(), 49.2, 'trois pas');
    egal(r.taille, 48, 'les réglages ne bougent pas');
    egal(ecritures, [], 'rien d’écrit');
    egal(envois.at(-1).taille, 49.2, 'la table suit');
    c.ajuster(-1000); egal(c.taille(), 16, 'borne basse');
    c.ajuster(1000); egal(c.taille(), 160, 'borne haute');
    c.definirTaille(70.04); egal(c.taille(), 70, 'taille fixée, au dixième');
    c.definirTaille(5); c.definirTaille(NaN); egal(c.taille(), 70, 'hors bornes : ignorée');
  }],
  ['annuler : rien d’enregistré, la table reçoit la fin du calibrage', () => {
    const { c, r, ecritures, envois } = fabrique({ taille: 48 });
    c.demarrer(); c.ajuster(5); c.aller('verifier');
    c.annuler();
    egal([c.actif(), c.taille()], [false, 48], 'plus de calibrage, taille d’origine');
    egal(r, { taille: 48 }, 'réglages intacts (ni calibre ni mode)');
    egal(ecritures, [], 'aucune écriture');
    egal(envois.at(-1), { type: 'calibrage', etape: null }, 'fin envoyée');
  }],
  ['terminer : enregistre la taille mesurée, calibre et mode « échelle réelle », puis rend la table à la présentation', () => {
    const { c, r, ecritures, envois } = fabrique({ taille: 48, modeTable: 'remplir' });
    c.demarrer(); c.ajuster(2.5);
    c.terminer();
    egal(r, { taille: 50.5, modeTable: 'reel', calibre: true }, 'réglages');
    egal(ecritures.length, 1, 'une seule écriture');
    egal(envois.at(-1), { type: 'calibrage', etape: null }, 'fin envoyée');
    egal(c.actif(), false, 'terminé');
    c.terminer();
    egal(ecritures.length, 1, 'deuxième fin : sans effet');
  }],
  ['suivante depuis « terminé » enregistre ; envoyer répète l’état courant (diffuser) ou la fin', () => {
    const { c, r, envois } = fabrique({ taille: 40 });
    c.demarrer('termine');
    c.envoyer();
    egal(envois.at(-1).etape, 'termine', 'état répété');
    c.suivante();
    egal([r.calibre, r.modeTable, c.actif()], [true, 'reel', false], 'fin enregistrée');
    c.envoyer();
    egal(envois.at(-1), { type: 'calibrage', etape: null }, 'sans calibrage : la fin');
  }],
  ['l’orientation et la taille visée sont lues dans les réglages à chaque envoi (source unique, pas de copie)', () => {
    const { c, r, envois } = fabrique({ taille: 48 });
    c.demarrer('orienter');
    r.rotationTable = 180; r.miroirTable = true; r.caseMm = 32;
    c.envoyer();
    egal(envois.at(-1), { type: 'calibrage', etape: 'orienter', taille: 48, caseMm: 32, rotation: 180, miroir: true }, 'valeurs du moment');
  }],
  ['pages : presentation.html porte le mode calibrage de la table, sans drapeau dans l’affichage', () => {
    for (const id of ['calibrage-table', 'calibrage-orienter', 'carte-calibrage', 'calibrage-verifier', 'calibrage-termine', 'texte-calibrage']) verifier(sources.html.includes(`id="${id}"`), `#${id}`);
    verifier(!/calibrage:\s*true/.test(sources.regie), 'regie.js : plus de drapeau calibrage dans l’affichage');
    verifier(!/calibrer-table/.test(sources.univers), 'regie-univers.js : le calibrage n’est plus grisé dans un monde');
  }],
];

const sources = {};
export async function executer({ lire }) {
  sources.html = await lire('presentation.html');
  sources.regie = await lire('js/regie.js');
  sources.univers = await lire('js/regie-univers.js');
  return executerSuite('calibrage : ', TESTS);
}
