/**
 * Tests de la logique du calibrage côté régie (js/calibrage.js) : étapes, brouillon de taille, messages envoyés, annulation et fin.
 * Sans DOM ni stockage : marche sous Node et dans tests.html. Et un contrôle des pages : le mode est bien dans presentation.html.
 */
import { fautIlProposerCalibrage, actionOuvrirTable, bandeauCalibrageVisible, creerCalibrage, accrocherMm, graduationsMm, standardGrise, appliquerCaseMm, appliquerRotation, basculerMiroir, caseMmDe, texteTaille } from '../js/calibrage.js';
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
    c.demarrer('termine');
    egal(lireCalibrage(envois[0], { taille: 48 }), { etape: 'termine', taille: 61.5, caseMm: 30, rotation: 0, miroir: false }, 'relu');
  }],
  ['étapes : suivante et précédente parcourent orienter, mesurer, terminé ; précédente bute sur la première', () => {
    const { c, envois } = fabrique();
    c.demarrer('orienter');
    c.precedente();
    egal(c.etape(), 'orienter', 'la première reste la première');
    const vues = [];
    for (let i = 0; i < 2; i++) { c.suivante(); vues.push(c.etape()); }
    egal(vues, ['mesurer', 'termine'], 'dans l’ordre');
    c.precedente();
    egal(c.etape(), 'mesurer', 'retour');
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
    c.demarrer(); c.ajuster(5); c.aller('termine');
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
  ['terminer choisit le mode : échelle réelle par défaut, ou remplir', () => {
    const a = fabrique({ taille: 40 }); a.c.demarrer('termine'); a.c.terminer({ mode: 'remplir' });
    egal([a.r.calibre, a.r.modeTable], [true, 'remplir'], 'remplir');
    const b = fabrique({ taille: 40 }); b.c.demarrer('termine'); b.c.terminer({ mode: 'n’importe quoi' });
    egal(b.r.modeTable, 'reel', 'mode illisible : échelle réelle');
  }],
  ['curseur « Une case vaut » : la poignée s’accroche à 25 mm à ±1 mm, pas au-delà', () => {
    egal([accrocherMm(24), accrocherMm(25.4), accrocherMm(26), accrocherMm(24.5)], [25, 25, 25, 25], 'dans la zone');
    egal([accrocherMm(23.9), accrocherMm(26.1), accrocherMm(10), accrocherMm(50)], [23.9, 26.1, 10, 50], 'hors zone : inchangé');
    egal(Number.isNaN(accrocherMm(NaN)), true, 'illisible : inchangé');
  }],
  ['graduation : un repère tous les 5 mm de 10 à 50, le 25 marqué, positions en pourcent de la plage', () => {
    const g = graduationsMm();
    egal(g.map((x) => x.mm), [10, 15, 20, 25, 30, 35, 40, 45, 50], 'valeurs');
    egal(g.map((x) => x.pct), [0, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100], 'positions');
    egal(g.filter((x) => x.standard).map((x) => x.mm), [25], 'seul le 25 est le standard');
  }],
  ['bouton « Standard : 25 mm » : grisé à 25 mm, actif ailleurs', () => {
    egal([standardGrise(25), standardGrise(25.04)], [true, true], 'à 25');
    egal([standardGrise(25.5), standardGrise(30), standardGrise(10), standardGrise(24.9)], [false, false, false, false], 'ailleurs');
  }],
  ['appliquerCaseMm : bornes 10–50, au dixième, le standard n’est pas écrit', () => {
    const r = {};
    egal(appliquerCaseMm(r, 30.04), 30, 'arrondi'); egal(r.caseMm, 30, 'écrit');
    egal(appliquerCaseMm(r, 51), 30, 'trop grand : inchangé'); egal(appliquerCaseMm(r, 9.9), 30, 'trop petit : inchangé');
    egal(appliquerCaseMm(r, 'x'), 30, 'illisible : inchangé');
    egal(appliquerCaseMm(r, 10), 10, 'borne basse'); egal(appliquerCaseMm(r, 50), 50, 'borne haute');
    appliquerCaseMm(r, 25); egal('caseMm' in r, false, 'standard : effacé'); egal(caseMmDe(r), 25, 'relu');
  }],
  ['rotation et miroir : quarts de tour, 0 et faux ne sont pas écrits', () => {
    const r = {};
    egal(appliquerRotation(r, 90), 90, '90'); egal(appliquerRotation(r, 90), 180, '180'); egal(appliquerRotation(r, -90), 90, 'retour');
    egal(appliquerRotation(r, -90), 0, '0'); egal('rotationTable' in r, false, '0 effacé');
    egal(appliquerRotation(r, -90), 270, 'tour complet à gauche');
    egal(basculerMiroir(r), true, 'miroir'); egal(basculerMiroir(r), false, 'plus de miroir'); egal('miroirTable' in r, false, 'effacé');
  }],
  ['texte de la taille en pixels : un dixième, virgule française', () => {
    egal([texteTaille(48), texteTaille(47.96), texteTaille(52.3)], ['48,0 px', '48,0 px', '52,3 px'], 'format');
  }],
  ['ouverture guidée : la pastille n’existe que table ouverte et jamais calibrée', () => {
    egal(fautIlProposerCalibrage({ reglages: {}, tableOuverte: true }), true, 'ouverte, jamais calibrée');
    egal(fautIlProposerCalibrage({ reglages: {}, tableOuverte: false }), false, 'fermée');
    egal(fautIlProposerCalibrage({ reglages: { calibre: true }, tableOuverte: true }), false, 'calibrée');
    egal(fautIlProposerCalibrage({ reglages: { taille: 61 }, tableOuverte: true }), false, 'taille changée : calibrée aussi (comme modeTableDefaut)');
    egal(fautIlProposerCalibrage({ reglages: { taille: 48 }, tableOuverte: true }), true, 'taille par défaut seule : pas calibrée');
  }],
  ['ouverture guidée : ce que fait un clic sur « Ouvrir la table »', () => {
    egal(actionOuvrirTable({ reglages: {}, tableOuverte: false }), 'ouvrir-calibrer', 'premier lancement');
    egal(actionOuvrirTable({ reglages: {}, tableOuverte: true }), 'calibrer', 'ouverte, non calibrée : on relance le calibrage');
    egal(actionOuvrirTable({ reglages: { calibre: true }, tableOuverte: false }), 'ouvrir', 'calibrée, fermée');
    egal(actionOuvrirTable({ reglages: { calibre: true }, tableOuverte: true }), 'ouvrir', 'calibrée, ouverte');
  }],
  ['ouverture guidée : le bandeau ne dure que la première étape, et seulement s’il est proposé', () => {
    egal(bandeauCalibrageVisible({ propose: true, etape: 'orienter' }), true, 'proposé, étape 1');
    egal(bandeauCalibrageVisible({ propose: true, etape: 'mesurer' }), false, 'pendant le calibrage');
    egal(bandeauCalibrageVisible({ propose: true, etape: null }), false, 'fini ou annulé');
    egal(bandeauCalibrageVisible({ propose: false, etape: 'orienter' }), false, '« Plus tard » ou « Calibrer »');
  }],
  ['robustesse : fin de calibrage envoyée au repos, calibrage repris sinon', () => {
    const { c, envois } = fabrique();
    c.envoyer();
    egal(envois, [{ type: 'calibrage', etape: null }], 'au repos : « fin de calibrage » (démarrage de la régie, demande d’état)');
    c.demarrer('orienter'); c.annuler();
    egal(envois[envois.length - 1], { type: 'calibrage', etape: null }, 'annuler rend la table');
  }],
  ['pages : presentation.html porte le mode calibrage de la table, sans drapeau dans l’affichage', () => {
    for (const id of ['calibrage-table', 'calibrage-orienter', 'carte-calibrage', 'calibrage-termine', 'texte-calibrage']) verifier(sources.html.includes(`id="${id}"`), `#${id}`);
    verifier(sources.html.includes('id="bandeau-calibrage"'), '#bandeau-calibrage');
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
