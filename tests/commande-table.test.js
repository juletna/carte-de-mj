/**
 * Tests de commande-table.js (quelle régie commande la table) et de l'enregistrement d'une partie quand plusieurs onglets sont ouverts.
 * Sans dépendance : marche sous Node et dans tests.html.
 */
import * as t from '../js/commande-table.js';
import * as m from '../js/donjon.js';
import * as p from '../js/presentation.js';
import { chargerPresentations, sauverPresentations, enregistrerPartie, supprimerPartie, empreintePartie, memoriserRetrait, oublierRetrait, retraitMemorise, partieDuRetrait, CLE_PRESENTATIONS, CLE_RETRAIT } from '../js/stockage.js';
import { verifier, egal, fauxStock, executerSuite } from './mini-test.js';

/** Une partie d'un donjon d'une salle, avec un identifiant choisi. */
function partie(id) {
  const d = m.creerDonjon({ texte: 'Salle de 4 par 4 cases.' });
  d.id = id;
  return p.creerPresentation(d);
}
/** Ce que chaque régie répond à la table : la seule chose que la table voit d'elles. */
const reponses = (...regies) => regies.map((c) => t.surMessage(c, { type: 'demande-etat' }));

const TESTS = [
  ['une régie qui démarre ne commande pas la table : elle signale sa présence, sans rien diffuser', () => {
    const a = t.creerCommande('a');
    egal(reponses(a), ['presence'], 'réponse à la table');
    egal(t.surMessage(a, { type: 'table-viser', x: 1, y: 1 }), null, 'geste ignoré');
    egal(t.messageDepart(a), null, 'pas de départ à annoncer');
  }],
  ['la dernière régie qui ouvre une partie a la main, et l’autre passe en retrait', () => {
    const a = t.creerCommande('a'), b = t.creerCommande('b');
    t.surMessage(b, t.prendreMain(a, 1000));
    verifier(a.main && !b.main, 'a commande');
    egal(reponses(a, b), ['diffuser', 'presence'], 'a seule sert la table');
    egal(t.surMessage(a, t.prendreMain(b, 2000)), 'retrait', 'a est prévenue');
    verifier(b.main && !a.main && a.retrait && !b.retrait, 'b commande, a en retrait');
    egal(reponses(a, b), ['presence', 'diffuser'], 'b seule sert la table');
    egal(a.titulaire, 'b', 'a sait qui a la main');
  }],
  ['en retrait : les gestes de la table sont ignorés ; à la main : ils sont appliqués', () => {
    const a = t.creerCommande('a'), b = t.creerCommande('b');
    t.surMessage(a, t.prendreMain(b, 1000));
    for (const type of ['table-deplacer', 'table-viser']) {
      egal(t.surMessage(a, { type }), null, `${type} en retrait`);
      egal(t.surMessage(b, { type }), 'appliquer', `${type} à la main`);
    }
  }],
  ['reprendre la main renverse les rôles', () => {
    const a = t.creerCommande('a'), b = t.creerCommande('b');
    t.surMessage(b, t.prendreMain(a, 1000));
    t.surMessage(a, t.prendreMain(b, 2000));
    t.surMessage(b, t.prendreMain(a, 3000));
    verifier(a.main && !a.retrait && b.retrait && !b.main, 'a a repris la main');
  }],
  ['deux prises de main simultanées laissent exactement une régie aux commandes', () => {
    for (const [ta, tb] of [[1000, 1000], [1000, 1001], [1001, 1000]]) {
      const a = t.creerCommande('a'), b = t.creerCommande('b');
      const ma = t.prendreMain(a, ta), mb = t.prendreMain(b, tb);
      t.surMessage(a, mb); t.surMessage(b, ma);
      egal([a.main, b.main].filter(Boolean).length, 1, `une seule à ${ta}/${tb}`);
    }
  }],
  ['une annonce plus ancienne que la dernière entendue, la sienne ou un message abîmé ne changent rien', () => {
    const a = t.creerCommande('a'), b = t.creerCommande('b');
    t.prendreMain(a, 5000);
    egal(t.surMessage(a, { type: t.PRISE_MAIN, regie: 'b', quand: 4000 }), null, 'plus ancienne');
    egal(t.surMessage(a, { type: t.PRISE_MAIN, regie: 'a', quand: 9000 }), null, 'la sienne');
    for (const brut of [null, 42, {}, { type: t.PRISE_MAIN }, { type: t.PRISE_MAIN, regie: 'b', quand: 'x' }, { type: t.PRISE_MAIN, regie: 7, quand: 9000 }, { type: t.PRISE_MAIN, regie: 'x'.repeat(65), quand: 9000 }]) {
      egal(t.surMessage(a, brut), null, `message ${JSON.stringify(brut)}`);
    }
    verifier(a.main, 'a garde la main');
    egal(t.surMessage(b, { type: 'etat', plan: null }), null, 'l’état d’une autre régie ne la concerne pas');
    verifier(t.prendreMain(a, 1).quand > 5000, 'une prise de main dépasse toujours la dernière entendue, même si l’horloge recule');
  }],
  ['la régie active qui se ferme le dit ; la régie en retrait ne reprend pas la main d’elle-même', () => {
    const a = t.creerCommande('a'), b = t.creerCommande('b'), c = t.creerCommande('c');
    const prise = t.prendreMain(a, 1000);
    t.surMessage(b, prise); t.surMessage(c, prise);
    egal(t.messageDepart(c), null, 'une régie en retrait n’annonce pas de départ');
    egal(t.surMessage(b, { type: t.DEPART, regie: 'c' }), null, 'le départ d’une autre régie est sans effet');
    verifier(!b.titulaireParti, 'titulaire toujours là');
    egal(t.surMessage(b, t.messageDepart(a)), 'retrait', 'départ de la régie active');
    verifier(b.titulaireParti && b.retrait && !b.main, 'prévenue, toujours en retrait');
    egal(reponses(b), ['presence'], 'la table n’est pas servie sans geste du MJ');
    const repris = t.prendreMain(b, 2000);
    verifier(b.main && !b.titulaireParti, 'le bouton suffit');
    egal(reponses(b), ['diffuser'], 'la table qui redemande est servie');
    t.surMessage(c, repris);
    egal(c.titulaire, 'b', 'les autres suivent');
  }],
  ['la régie active qui se recharge reprend la main, et l’autre redevient simplement en retrait', () => {
    const a = t.creerCommande('a'), b = t.creerCommande('b');
    t.surMessage(b, t.prendreMain(a, 1000));
    t.surMessage(b, t.messageDepart(a));
    const rechargee = t.creerCommande('a2'); // même onglet, nouvelle page : rien de mémorisé en retrait
    t.surMessage(b, t.prendreMain(rechargee, 2000));
    verifier(rechargee.main && b.retrait && !b.titulaireParti, 'titulaire de nouveau là');
  }],
  ['une régie en retrait rechargée reste en retrait, sans savoir qui a la main', () => {
    const b = t.creerCommande('b2', { retrait: true });
    verifier(b.retrait && !b.main, 'en retrait');
    egal(reponses(b), ['presence'], 'ne répond pas avec son état');
    t.prendreMain(b, 1000);
    verifier(b.main && !b.retrait, 'mais peut reprendre la main');
  }],
  ['SÉCURITÉ : les messages de commande ne portent qu’un identifiant et une date', () => {
    const a = t.creerCommande('a');
    egal(Object.keys(t.prendreMain(a, 1000)).sort(), ['quand', 'regie', 'type'], 'prise de main');
    egal(Object.keys(t.messageDepart(a)).sort(), ['regie', 'type'], 'départ');
  }],
  ['stockage : enregistrer une partie ne ramène pas une vieille copie des autres', () => {
    const stock = fauxStock();
    sauverPresentations({ x: partie('x'), y: partie('y') }, stock);
    // L'onglet A joue x, l'onglet B joue y, chacun avec la copie en mémoire lue au démarrage.
    const memoireB = chargerPresentations(stock);
    const xA = chargerPresentations(stock).x;
    const salle = xA.salleCourante;
    p.definirNotePartie(xA, salle, 'plus récent');
    verifier(enregistrerPartie(xA, stock), 'A enregistre');
    p.definirNotePartie(memoireB.y, memoireB.y.salleCourante, 'de B');
    verifier(enregistrerPartie(memoireB.y, stock), 'B enregistre');
    const lu = chargerPresentations(stock);
    egal(p.notePartie(lu.x, salle), 'plus récent', 'la partie de A n’a pas reculé');
    egal(p.notePartie(lu.y, lu.y.salleCourante), 'de B', 'la partie de B est écrite');
    verifier(supprimerPartie('y', stock), 'suppression');
    egal(Object.keys(chargerPresentations(stock)), ['x'], 'seule y disparaît');
    const abime = fauxStock({ [CLE_PRESENTATIONS]: '{pas du json' });
    verifier(enregistrerPartie(partie('z'), abime), 'donnée corrompue : on écrit quand même');
    egal(Object.keys(chargerPresentations(abime)), ['z'], 'et on relit');
  }],
  ['stockage : l’empreinte révèle qu’un autre onglet a fait avancer la même partie', () => {
    const stock = fauxStock();
    const x = partie('x');
    egal(empreintePartie('x', stock), null, 'absente');
    enregistrerPartie(x, stock);
    const empreinte = JSON.stringify(x); // ce que retient la régie après avoir écrit
    egal(empreintePartie('x', stock), empreinte, 'identique à ce qui a été écrit : pas de faux conflit');
    const autre = chargerPresentations(stock).x;
    p.definirNotePartie(autre, autre.salleCourante, 'autre onglet');
    enregistrerPartie(autre, stock);
    verifier(empreintePartie('x', stock) !== empreinte, 'changement détecté');
    const apres = empreintePartie('x', stock);
    enregistrerPartie(partie('y'), stock);
    egal(empreintePartie('x', stock), apres, 'une autre partie ne change pas l’empreinte');
    egal(empreintePartie('__proto__', stock), null, 'identifiant piégé : rien');
  }],
  ['stockage : le retrait est retenu pour l’onglet, avec sa propre partie', () => {
    const onglet = fauxStock();
    egal(retraitMemorise(onglet), null, 'rien au départ');
    memoriserRetrait('x', onglet);
    egal(retraitMemorise(onglet), { partie: 'x' }, 'avec sa partie');
    const parties = { x: partie('x') };
    egal(partieDuRetrait(retraitMemorise(onglet), parties)?.donjon.id, 'x', 'partie retrouvée');
    memoriserRetrait(undefined, onglet);
    egal(retraitMemorise(onglet), { partie: null }, 'sur la liste des donjons');
    egal(partieDuRetrait(retraitMemorise(onglet), parties), null, 'la liste reste la liste');
    egal(partieDuRetrait({ partie: '__proto__' }, parties), null, 'identifiant piégé : rien');
    egal(partieDuRetrait({ partie: 'disparue' }, parties), null, 'partie disparue : rien');
    onglet.donnees[CLE_RETRAIT] = '{pas du json';
    egal(retraitMemorise(onglet), null, 'donnée corrompue : pas de retrait');
    memoriserRetrait('x', onglet);
    oublierRetrait(onglet);
    egal(retraitMemorise(onglet), null, 'oublié en reprenant la main');
  }],
];

export const executer = () => executerSuite('commande de la table : ', TESTS);
