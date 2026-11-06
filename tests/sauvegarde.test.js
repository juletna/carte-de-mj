/**
 * Tests de js/sauvegarde.js : le contenu du zip (clés retenues, valeurs brutes, images, références de bibliothèque),
 * la lecture validée, et la restauration (remplace, supprime les clés en trop, épargne les clés étrangères, remet l'état d'avant en cas de quota).
 * Sans dépendance : marche sous Node et dans tests.html.
 */
import { cleRetenue, contenuSauvegarde, fabriquerSauvegarde, lireSauvegarde, restaurer, resumeSauvegarde, bibliothequeManquante, referencesBibliotheque, entreesImages, nomSauvegarde } from '../js/sauvegarde.js';
import { lireZip, creerZip } from '../js/zip.js';
import { verifier, egal, fauxStock } from './mini-test.js';

const trie = (o) => Object.entries(o).sort(([a], [b]) => a.localeCompare(b));
const enc = (t) => new TextEncoder().encode(t);
const MAINTENANT = new Date(2026, 10, 6, 12, 0, 0);
/** Texte volontairement « bizarre » : espaces, ordre des champs, identifiants : rien ne doit être réécrit. */
const DONJONS = '{"actif":"d-1","donjons":{"d-1":{"id":"d-1","nom":"Crypte","image":{"source":"bibliotheque","id":"carte-a"}},"d-2":{"id":"d-2","nom":"Cave"}}}';
const UNIVERS = '{ "actif":"u-1", "univers":{"u-1":{"points":[{"carte":{"source":"bibliotheque","id":"carte-b"}},{"carte":{"source":"navigateur","id":"img-zz"}}]}} }';
const PERSOS = '{"actif":"p1","persos":{"p1":{"nom":"Élodie"},"p2":{"nom":"Bob"}}}';
const initial = () => ({ 'carte-de-mj:donjons-v1': DONJONS, 'carte-de-mj:univers-v1': UNIVERS, 'dd-fiche-personnages-v1': PERSOS, 'jdr-carte:v1': 'ancien', 'autre-appli': 'ne pas toucher' });
/** Un faux stock qui sait énumérer ses clés comme localStorage. */
function stock(d) {
  const s = fauxStock(d);
  Object.defineProperty(s, 'length', { get: () => Object.keys(s.donnees).length });
  s.key = (i) => Object.keys(s.donnees)[i] ?? null;
  return s;
}
function stockPlein(d, apres = 0) {
  const s = stock(d);
  const ecrire = s.setItem;
  let n = 0;
  s.setItem = (k, v) => { if (n++ === apres) { const e = new Error('plein'); e.name = 'QuotaExceededError'; throw e; } ecrire(k, v); };
  return s;
}
const image = (id, octets = [1, 2, 3]) => ({ id, nom: `${id}.png`, type: 'image/png', blob: new Blob([Uint8Array.from(octets)], { type: 'image/png' }), largeur: 10, hauteur: 20, ajoute: '2026-01-01T00:00:00.000Z', titre: id, niveau: 'zone', milieux: ['donjon'], tags: ['a'], description: 'd' });

export async function executer() {
  const tests = [
    ['cleRetenue : préfixes connus seulement', () => {
      verifier(cleRetenue('carte-de-mj:donjons-v1') && cleRetenue('dd-fiche-personnages-v1') && cleRetenue('jdr-carte:v1'), 'retenues');
      verifier(!cleRetenue('autre-appli') && !cleRetenue('') && !cleRetenue(undefined), 'étrangères');
    }],
    ['contenu : valeurs brutes identiques, clés étrangères exclues', async () => {
      const { manifeste, fichiers } = await contenuSauvegarde({ stock: stock(initial()), images: [], maintenant: MAINTENANT });
      egal(Object.keys(manifeste.cles).sort(), ['carte-de-mj:donjons-v1', 'carte-de-mj:univers-v1', 'dd-fiche-personnages-v1', 'jdr-carte:v1'], 'clés');
      verifier(manifeste.cles['carte-de-mj:univers-v1'] === UNIVERS && manifeste.cles['carte-de-mj:donjons-v1'] === DONJONS, 'valeur modifiée');
      egal([manifeste.format, manifeste.version, manifeste.cree], ['carte-de-mj-sauvegarde', 1, MAINTENANT.toISOString()], 'en-tête');
      egal(fichiers.map((f) => f.nom), ['sauvegarde.json'], 'fichiers');
    }],
    ['références de bibliothèque trouvées (récursif), sans les images du navigateur', async () => {
      const { manifeste } = await contenuSauvegarde({ stock: stock(initial()), maintenant: MAINTENANT });
      egal(manifeste.bibliotheque, ['carte-a', 'carte-b'], 'bibliothèque');
      egal([...referencesBibliotheque({ a: [{ source: 'bibliotheque', id: 'x' }], b: { source: 'navigateur', id: 'y' } })], ['x'], 'récursif');
    }],
    ['images : un fichier par image, métadonnées gardées', async () => {
      const { manifeste, fichiers } = await contenuSauvegarde({ stock: stock({}), images: [image('img-1', [9, 8])], maintenant: MAINTENANT });
      egal(fichiers.map((f) => f.nom), ['sauvegarde.json', 'images/img-1.png'], 'fichiers');
      egal([...fichiers[1].donnees], [9, 8], 'octets');
      egal(manifeste.images[0], { id: 'img-1', nom: 'img-1.png', type: 'image/png', largeur: 10, hauteur: 20, ajoute: '2026-01-01T00:00:00.000Z', titre: 'img-1', niveau: 'zone', milieux: ['donjon'], tags: ['a'], description: 'd', fichier: 'images/img-1.png' }, 'meta');
    }],
    ['aller-retour complet par zip (images comprises)', async () => {
      const zip = await fabriquerSauvegarde({ stock: stock(initial()), images: [image('img-1'), image('img-2', [])], maintenant: MAINTENANT });
      const lecture = lireSauvegarde(await lireZip(zip));
      egal(lecture.manifeste.cles['carte-de-mj:univers-v1'], UNIVERS, 'valeur brute');
      egal(lecture.images.map((i) => i.meta.id), ['img-1', 'img-2'], 'images');
      const entrees = entreesImages(lecture);
      egal([entrees[0].id, entrees[0].titre, 'fichier' in entrees[0], entrees[0].blob.size], ['img-1', 'img-1', false, 3], 'entrée IndexedDB');
      egal(nomSauvegarde(MAINTENANT), 'sauvegarde-carte-de-mj-2026-11-06.zip', 'nom');
    }],
    ['lecture : version 2 refusée', () => {
      const f = new Map([['sauvegarde.json', enc(JSON.stringify({ format: 'carte-de-mj-sauvegarde', version: 2, cles: {} }))]]);
      try { lireSauvegarde(f); } catch (e) { verifier(/version plus récente/.test(e.message), e.message); return; }
      throw new Error('devrait être refusé');
    }],
    ['lecture : format inconnu et zip sans manifeste refusés', () => {
      for (const f of [new Map([['sauvegarde.json', enc('{"format":"autre","version":1,"cles":{}}')]]), new Map([['x.txt', enc('x')]]), new Map([['sauvegarde.json', enc('pas du json')]])]) {
        try { lireSauvegarde(f); } catch { continue; }
        throw new Error('devrait être refusé');
      }
    }],
    ['lecture : clés étrangères et valeurs non texte signalées, image manquante signalée', () => {
      const m = { format: 'carte-de-mj-sauvegarde', version: 1, cles: { 'autre-appli': 'x', 'carte-de-mj:a': 5, 'carte-de-mj:b': 'ok' }, images: [{ id: 'i', type: 'image/png', fichier: 'images/i.png' }] };
      const l = lireSauvegarde(new Map([['sauvegarde.json', enc(JSON.stringify(m))]]));
      egal(Object.keys(l.manifeste.cles), ['carte-de-mj:b'], 'clés gardées');
      egal([l.ignorees, l.manquantes], [['autre-appli'], ['images/i.png']], 'signalées');
      verifier(l.avertissements.length === 3, `avertissements : ${l.avertissements.join(' | ')}`);
    }],
    ['résumé lisible', async () => {
      const { manifeste } = await contenuSauvegarde({ stock: stock({ ...initial(), 'carte-de-mj:donjons-v1': DONJONS, 'carte-de-mj:mauvais': '{' }), images: [image('a')], maintenant: MAINTENANT });
      egal(resumeSauvegarde(manifeste), '2 donjons, 2 personnages, 1 univers, 1 image importée', 'résumé');
      egal(resumeSauvegarde({ cles: { 'carte-de-mj:donjons-v1': 'abîmé' }, images: [] }), '1 donnée (réglages)', 'abîmé');
    }],
    ['bibliothèque manquante', () => egal(bibliothequeManquante(['a', 'b', 'c'], new Set(['b'])), ['a', 'c'], 'manquantes')],
    ['restaurer : remplace, supprime les clés retenues en trop, épargne les étrangères', () => {
      const s = stock({ ...initial(), 'carte-de-mj:reglages-v1': '{"taille":9}', 'carte-de-mj:modeles-v1': 'en trop' });
      const r = restaurer({ manifeste: { cles: { 'carte-de-mj:donjons-v1': '{"neuf":1}', 'carte-de-mj:reglages-v1': '{"taille":9}' } }, stock: s });
      egal([r.ok, r.ecrites, r.supprimees], [true, 1, 4], 'bilan');
      egal(trie(s.donnees), trie({ 'carte-de-mj:donjons-v1': '{"neuf":1}', 'carte-de-mj:reglages-v1': '{"taille":9}', 'autre-appli': 'ne pas toucher' }), 'état final');
    }],
    ['restaurer : quota dépassé, l’état d’avant est remis exactement', () => {
      const avant = initial();
      const s = stockPlein({ ...avant }, 1); // la première écriture passe, la deuxième échoue (puis l'espace revient)
      const r = restaurer({ manifeste: { cles: { 'carte-de-mj:donjons-v1': 'N1', 'carte-de-mj:univers-v1': 'N2', 'carte-de-mj:neuve': 'N3' } }, stock: s });
      verifier(!r.ok && /espace de stockage plein/.test(r.erreur), `résultat : ${JSON.stringify(r)}`);
      egal(trie(s.donnees), trie(avant), 'état après échec');
    }],
  ];
  const resultats = [];
  for (const [nom, test] of tests) {
    let ecarts = [];
    try { await test(); } catch (e) { ecarts = [e.message]; }
    resultats.push({ phrase: `sauvegarde : ${nom}`, ecarts, resultat: null });
  }
  return resultats;
}
