/**
 * Tests de la partie d'univers (js/univers-partie.js) et du stockage des univers (js/stockage.js).
 */
import * as u from '../js/univers.js';
import * as p from '../js/univers-partie.js';
import { creerDonjon } from '../js/donjon.js';
import { messageUnivers, lireVueUnivers, TYPE_UNIVERS } from '../js/univers-protocole.js';
import { AFFICHAGE_PAR_DEFAUT } from '../js/affichage.js';
import { chargerUnivers, sauverUnivers, chargerPartiesUnivers, enregistrerPartieUnivers, supprimerPartieUnivers, misDeCote, CLE_UNIVERS, CLE_UNIVERS_PARTIES } from '../js/stockage.js';
import { verifier, egal, fauxStock, executerSuite } from './mini-test.js';

const IMG = (id) => ({ source: 'bibliotheque', id });
function monde() {
  const univ = u.creerUnivers({ nom: 'Test' });
  const m = u.ajouterLieu(univ, { nom: 'Monde', image: IMG('m') });
  const r = u.ajouterLieu(univ, { nom: 'Région', image: IMG('r') });
  const z = u.ajouterLieu(univ, { nom: 'Zone', image: IMG('z') });
  const d = creerDonjon({ nom: 'Crypte' });
  const salle = Object.keys(d.salles)[0];
  const pr = u.ajouterPoint(univ, m.id, { nom: 'Région', x: 0.2, y: 0.2, vers: { lieu: r.id } });
  const pc = u.ajouterPoint(univ, m.id, { nom: 'Secret', x: 0.8, y: 0.8, vers: { lieu: z.id }, cache: true });
  const pz = u.ajouterPoint(univ, r.id, { nom: 'Zone', x: 0.5, y: 0.5, vers: { lieu: z.id } });
  const pd = u.ajouterPoint(univ, z.id, { nom: 'Entrée', x: 0.4, y: 0.4, vers: { donjon: d.id, salle } });
  return { univ, m, r, z, d, salle, pr, pc, pz, pd, donjons: { [d.id]: d } };
}

const TESTS = [
  ['une partie neuve commence à la racine, découverte', () => {
    const { univ, m } = monde();
    const pa = p.creerPartieUnivers(univ);
    egal(pa, { univers: univ.id, lieuCourant: m.id, chemin: [], decouverts: [m.id], reveles: {} }, 'départ');
    egal(p.creerPartieUnivers(u.creerUnivers()).lieuCourant, null, 'univers vide');
  }],
  ['monde → région → zone → donjon, puis Remonter jusqu’à la racine', () => {
    const { univ, m, r, z, d, salle, pr, pz, pd, donjons } = monde();
    const pa = p.creerPartieUnivers(univ);
    egal(p.franchir(pa, univ, pr.id, donjons), { lieu: r.id }, 'vers la région');
    egal(p.franchir(pa, univ, pz.id, donjons), { lieu: z.id }, 'vers la zone');
    egal(p.franchir(pa, univ, pd.id, donjons), { donjon: d.id, salle }, 'vers le donjon');
    egal(pa.dans, { donjon: d.id, salle, depuis: pd.id }, 'la table est dans le donjon');
    egal([pa.lieuCourant, pa.chemin], [z.id, [m.id, r.id]], 'le lieu courant n’a pas bougé');
    egal(p.filDAriane(pa, univ).map((x) => x.nom), ['Monde', 'Région', 'Zone'], 'fil d’Ariane');
    egal(p.remonter(pa), true, 'sort du donjon');
    verifier(!pa.dans && pa.lieuCourant === z.id, 'de retour sur la zone');
    egal([p.remonter(pa), pa.lieuCourant], [true, r.id], 'remonte à la région');
    egal([p.remonter(pa), pa.lieuCourant], [true, m.id], 'remonte au monde');
    egal(p.remonter(pa), false, 'rien au-dessus de la racine');
    egal(pa.decouverts.sort(), [m.id, r.id, z.id].sort(), 'lieux découverts');
  }],
  ['une destination disparue n’emmène nulle part et ne change rien', () => {
    const { univ, r, pr, pd, donjons } = monde();
    const pa = p.creerPartieUnivers(univ);
    u.supprimerLieu(univ, r.id);
    const avant = JSON.stringify(pa);
    egal(p.franchir(pa, univ, pr.id, donjons), null, 'lieu supprimé');
    egal(p.franchir(pa, univ, 'pt-inconnu', donjons), null, 'point inconnu');
    egal(JSON.stringify(pa), avant, 'partie intacte');
    verifier(pd, 'pd');
  }],
  ['ce que voit la table : points non cachés ou révélés, noms masquables, référence d’image seulement', () => {
    const { univ, m, pr, pc } = monde();
    const pa = p.creerPartieUnivers(univ);
    egal(p.pointsPourLaTable(pa, univ).map((x) => x.id), [pr.id], 'le point caché est absent');
    p.reveler(pa, m.id, pc.id);
    p.reveler(pa, m.id, pc.id);
    egal(p.pointsPourLaTable(pa, univ).map((x) => x.nom), ['Région', 'Secret'], 'révélé, une seule fois');
    const vue = p.vueDeLaTable(pa, univ);
    egal(vue.image, { source: 'bibliotheque', id: 'm' }, 'la référence');
    verifier(!JSON.stringify(vue).includes('blob:') && !JSON.stringify(vue).includes('data:'), 'jamais l’image');
    pa.masquerNoms = true;
    egal(p.vueDeLaTable(pa, univ).points.every((x) => !('nom' in x)) && !('nom' in p.vueDeLaTable(pa, univ)), true, 'noms masqués');
    p.recacher(pa, m.id, pc.id);
    egal([pa.reveles, p.pointsPourLaTable(pa, univ).length], [{}, 1], 'recaché');
    verifier(p.vueDeLaTable({ ...pa, lieuCourant: 'x' }, univ) === null, 'lieu disparu');
  }],
  ['franchir un point caché le révèle', () => {
    const { univ, m, pc, donjons } = monde();
    const pa = p.creerPartieUnivers(univ);
    p.franchir(pa, univ, pc.id, donjons);
    egal(pa.reveles[m.id], [pc.id], 'révélé');
  }],
  ['fil d’Ariane : revenir à un lieu du chemin, ou sauter à un lieu', () => {
    const { univ, m, r, z, pr, pz, donjons } = monde();
    const pa = p.creerPartieUnivers(univ);
    p.franchir(pa, univ, pr.id, donjons); p.franchir(pa, univ, pz.id, donjons);
    egal(p.allerAuChemin(pa, 1), true, 'index 1 = la région');
    egal([pa.lieuCourant, pa.chemin], [r.id, [m.id]], 'tronqué');
    egal(p.allerAuChemin(pa, 5), false, 'index hors du fil');
    egal(p.allerAuLieu(pa, univ, z.id), true, 'saut');
    egal([pa.lieuCourant, pa.chemin], [z.id, [m.id, r.id]], 'l’ancien lieu rejoint le chemin');
    egal(p.allerAuLieu(pa, univ, m.id), true, 'saut vers un lieu du chemin');
    egal([pa.lieuCourant, pa.chemin], [m.id, []], 'comme un retour');
    egal(p.allerAuLieu(pa, univ, 'l-nulle'), false, 'lieu inconnu');
  }],
  ['reconcilier : ce qui a disparu est corrigé en le disant', () => {
    const { univ, m, r, z, pc, pr, donjons, d } = monde();
    const pa = p.creerPartieUnivers(univ);
    p.franchir(pa, univ, pr.id, donjons);
    p.reveler(pa, m.id, pc.id);
    egal(p.reconcilier(pa, univ, donjons), [], 'rien à dire quand tout existe');
    u.supprimerLieu(univ, m.id);
    const notes = p.reconcilier(pa, univ, donjons);
    verifier(notes.length === 0 || notes.length >= 1, 'notes');
    verifier(pa.chemin.every((id) => id in univ.lieux), 'chemin sans lieu disparu');
    verifier(!(m.id in pa.reveles), 'révélés du lieu disparu retirés');
    u.supprimerLieu(univ, r.id);
    const n2 = p.reconcilier(pa, univ, donjons);
    verifier(n2.join().includes('n’existe plus') && pa.lieuCourant === z.id, `retour à un lieu existant : ${n2}`);
    pa.dans = { donjon: d.id };
    egal(p.reconcilier(pa, univ, {}).length, 1, 'donjon disparu');
    verifier(!pa.dans, 'sorti du donjon');
  }],
  ['validerPartieUnivers : refus du n’importe quoi, nettoyage en le disant', () => {
    for (const mauvais of [null, [], {}, { univers: 'u1' }, { univers: '../x', lieuCourant: 'l' }]) verifier(!p.validerPartieUnivers(mauvais).partie, `refusée : ${JSON.stringify(mauvais)}`);
    const v = p.validerPartieUnivers({ univers: 'u1', lieuCourant: 'l1', chemin: ['a', 3, 'a'], decouverts: 'x', reveles: { l1: ['p1', {}], '': ['z'] }, dans: { donjon: 7 }, masquerNoms: true });
    verifier(v.partie && !v.ok, 'relue avec avertissements');
    egal([v.partie.chemin, v.partie.decouverts, v.partie.reveles, 'dans' in v.partie, v.partie.masquerNoms], [['a'], ['l1'], { l1: ['p1'] }, false, true], 'nettoyée');
    egal(v.avertissements.length >= 4, true, 'avertissements');
    const bonne = { univers: 'u1', lieuCourant: 'l1', chemin: [], decouverts: ['l1'], reveles: {}, dans: { donjon: 'd1', salle: 's1', depuis: 'pt-1' } };
    egal(p.validerPartieUnivers(bonne).partie, bonne, 'une bonne partie ne change pas');
  }],
  ['message de table : référence d’image, points visibles, aucun secret ; relu champ par champ', () => {
    const { univ, m, pc, pr } = monde();
    u.modifierPoint(univ, m.id, pr.id, { nom: 'Forêt' });
    const pa = p.creerPartieUnivers(univ);
    u.definirNotesLieu(univ, m.id, 'SECRET : le dragon dort ici');
    const msg = messageUnivers(p.vueDeLaTable(pa, univ), { ...AFFICHAGE_PAR_DEFAUT });
    const texte = JSON.stringify(msg);
    verifier(!texte.includes('SECRET') && !texte.includes(pc.id) && !texte.includes('Secret') && !texte.includes('"vers"') && !texte.includes('"donjon"') && !texte.includes('"cache"') && !texte.includes('"notes"'), `rien de caché dans le message : ${texte}`);
    const lu = lireVueUnivers(JSON.parse(texte), AFFICHAGE_PAR_DEFAUT);
    egal(lu.vue, { image: { source: 'bibliotheque', id: 'm' }, points: [{ id: pr.id, x: 0.2, y: 0.2, nom: 'Forêt' }], nom: 'Monde' }, 'relu');
    egal(msg.type, TYPE_UNIVERS, 'type');
    for (const mauvais of [null, {}, { type: TYPE_UNIVERS }, { type: TYPE_UNIVERS, vue: { image: { source: 'http', id: 'x' }, points: [] } }, { type: TYPE_UNIVERS, vue: { image: { source: 'bibliotheque', id: '../x' }, points: [] } }, { type: 'etat', vue: msg.vue }]) {
      egal(lireVueUnivers(mauvais, AFFICHAGE_PAR_DEFAUT), null, `refusé : ${JSON.stringify(mauvais)}`);
    }
    const sale = lireVueUnivers({ type: TYPE_UNIVERS, vue: { image: msg.vue.image, nom: 'x'.repeat(500), points: [{ id: 'ok', x: 0.5, y: 0.5, nom: '<b>x</b>' }, { id: 'a b', x: 0.5, y: 0.5 }, { id: 'hors', x: 2, y: 0 }, 'x', { id: 'nan', x: NaN, y: 0 }] }, affichage: 'n’importe quoi' }, AFFICHAGE_PAR_DEFAUT);
    egal(sale.vue.points, [{ id: 'ok', x: 0.5, y: 0.5, nom: '<b>x</b>' }], 'points mal formés écartés (le nom reste un texte)');
    egal(sale.vue.nom.length, 80, 'nom borné');
    egal(JSON.stringify(sale.affichage, Object.keys(AFFICHAGE_PAR_DEFAUT).sort()), JSON.stringify(AFFICHAGE_PAR_DEFAUT, Object.keys(AFFICHAGE_PAR_DEFAUT).sort()), 'affichage invalide : valeur sûre');
  }],
  ['stockage des univers : aller-retour, actif corrigé, abîmés mis de côté AVANT réécriture', () => {
    const { univ } = monde();
    const stock = fauxStock();
    egal(chargerUnivers(stock), { etat: null, miseDeCote: null }, 'rien au départ');
    verifier(sauverUnivers({ actif: univ.id, univers: { [univ.id]: univ } }, stock), 'écriture');
    const { etat, miseDeCote } = chargerUnivers(stock);
    egal([etat.actif, Object.keys(etat.univers), miseDeCote], [univ.id, [univ.id], null], 'relecture');
    egal(JSON.parse(JSON.stringify(etat.univers[univ.id])), JSON.parse(JSON.stringify(univ)), 'identique');
    const abime = fauxStock({ [CLE_UNIVERS]: JSON.stringify({ actif: 'nulle', univers: { a: { pas: 'un univers' }, [univ.id]: univ, b: 'x' } }) });
    const lu = chargerUnivers(abime);
    egal([lu.etat.actif, Object.keys(lu.etat.univers), lu.miseDeCote], [univ.id, [univ.id], { nombre: 2, ok: true }], 'seul le bon reste, 2 copies');
    egal(misDeCote(abime).length, 2, 'copies en sécurité');
    egal(misDeCote(abime).map((e) => e.cle), [CLE_UNIVERS, CLE_UNIVERS], 'clé d’origine notée');
    chargerUnivers(abime);
    egal(misDeCote(abime).length, 2, 'recharger ne refait pas la copie');
    egal(chargerUnivers(fauxStock({ [CLE_UNIVERS]: '{cassé' })).miseDeCote, { nombre: 1, ok: true }, 'JSON cassé copié');
    egal(chargerUnivers(fauxStock({ [CLE_UNIVERS]: '{"univers":3}' })).etat, null, 'mauvaise forme');
  }],
  ['stockage des univers : si la copie échoue, la clé n’est pas réécrite', () => {
    const { univ } = monde();
    const stock = fauxStock({ [CLE_UNIVERS]: JSON.stringify({ univers: { a: { pas: 'un univers' } } }) });
    const vrai = stock.setItem.bind(stock);
    stock.setItem = () => { throw new Error('plein'); };
    egal(chargerUnivers(stock).miseDeCote, { nombre: 1, ok: false }, 'copie impossible');
    stock.setItem = vrai;
    egal(sauverUnivers({ actif: univ.id, univers: { [univ.id]: univ } }, stock), false, 'refus d’écrire');
    verifier(stock.getItem(CLE_UNIVERS).includes('pas'), 'l’original est intact');
  }],
  ['stockage des parties d’univers : enregistrer une partie ne touche pas aux autres', () => {
    const stock = fauxStock();
    egal(chargerPartiesUnivers(stock), {}, 'rien au départ');
    const a = { univers: 'u1', lieuCourant: 'l1', chemin: [], decouverts: ['l1'], reveles: {} };
    const b = { univers: 'u2', lieuCourant: 'l9', chemin: ['l8'], decouverts: ['l8', 'l9'], reveles: { l9: ['p1'] } };
    verifier(enregistrerPartieUnivers(a, stock) && enregistrerPartieUnivers(b, stock), 'écritures');
    egal(chargerPartiesUnivers(stock), { u1: a, u2: b }, 'deux parties');
    verifier(supprimerPartieUnivers('u1', stock), 'suppression');
    egal(Object.keys(chargerPartiesUnivers(stock)), ['u2'], 'l’autre reste');
    const sale = fauxStock({ [CLE_UNIVERS_PARTIES]: JSON.stringify({ parties: { u1: a, u3: { n: 'importe quoi' } } }) });
    verifier(enregistrerPartieUnivers(b, sale), 'écriture avec une partie abîmée');
    egal(misDeCote(sale).length, 1, 'la partie abîmée est mise de côté');
    egal(Object.keys(chargerPartiesUnivers(sale)).sort(), ['u1', 'u2'], 'les bonnes restent');
  }],
];

export const executer = () => executerSuite('univers (partie, stockage) : ', TESTS);
