/**
 * Tests de js/dossier-travail-logique.js (pur) : noms de fichiers des clés (aller-retour), comparaison navigateur / dossier,
 * décision au démarrage (pousser, tirer, conflit), plan d'écriture des images, cartes ajoutées hors de l'appli (skill generer-carte),
 * migration de l'ancien catalogue, marqueurs, textes d'état.
 * Les accès au dossier (File System Access API) ne se testent pas sous Node : voir README, « Dossier de travail ».
 */
import {
  nomFichierCle, cleDuFichier, donneesDuStock, comparer, signatureImage, planImages, lireMarqueur, texteMarqueur, lireLocal, decider, texteEtat, heure, nomCopie,
  FORMAT_DOSSIER, entreeDuDossier, ajoutsDuDossier, etrangeres, planDossierImages, noterSuppressions, cartesAMigrer, entreeDeCarte, lireMigrees, typeDuFichier,
} from '../js/dossier-travail-logique.js';
import { nomsImages } from '../js/sauvegarde.js';
import { verifier, egal, fauxStock, executerSuite } from './mini-test.js';

const stock = (d) => fauxStock(d);
const local = (o = {}) => ({ dernierSync: null, sale: false, ...o });
const plein = { vide: false };
const dossier = (modifie = 'T1', o = {}) => ({ vide: false, modifie, ...o });
const meta = (id, o = {}) => ({ id, nom: `${id}.png`, type: 'image/png', largeur: 1536, hauteur: 864, ajoute: '2026-11-06T10:00:00.000Z', titre: `Forêt ${id}`, niveau: 'zone', milieux: ['foret'], tags: [], description: '', licence: 'libre', credit: '', fichier: `images/${id}.png`, ...o });
/** Une image du navigateur pour planDossierImages : `version` change sa signature. */
const nav = (id, version = 'v1') => { const { fichier, ...m } = meta(id); return { meta: m, sig: `${id}-${version}`, fichier }; };
/** Ce que lireImagesDossier rend, réduit à ce que planDossierImages utilise. */
const dossierImages = (index, version = 'v1') => ({ index, etat: new Map(index.filter((m) => m.id && m.fichier).map((m) => [m.id, { sig: `${m.id}-${version}`, fichier: m.fichier }])) });
const lance = (f) => { try { f(); } catch (e) { return e; } return null; };

export async function executer() {
  return executerSuite('dossier de travail : ', [
    ['nom de fichier d’une clé : « : » devient « __ »', () => {
      egal(nomFichierCle('carte-de-mj:donjons-v1'), 'carte-de-mj__donjons-v1.json', 'clé du donjon');
      egal(nomFichierCle('dd-fiche-personnages-v1'), 'dd-fiche-personnages-v1.json', 'clé de la fiche');
      egal(nomFichierCle('jdr-carte:v1'), 'jdr-carte__v1.json', 'ancienne clé');
    }],
    ['le nom se relit en la même clé, y compris avec des caractères inhabituels', () => {
      for (const cle of ['carte-de-mj:donjons-v1', 'dd-fiche-personnages-v1', 'jdr-carte:v1', 'carte-de-mj:a_b', 'carte-de-mj:Maj/é x', 'carte-de-mj::', 'carte-de-mj:5f', 'carte-de-mj:_5f_']) {
        egal(cleDuFichier(nomFichierCle(cle)), cle, `aller-retour de « ${cle} »`);
      }
    }],
    ['un nom qui ne correspond pas à une clé retenue est refusé', () => {
      for (const nom of ['autre__chose.json', 'carte-de-mj__donjons-v1.txt', 'carte-de-mj__donjons-v1', 'Carte-de-mj__x.json', '../carte-de-mj__x.json', 'carte-de-mj/x.json', 'carte-de-mj__x_zz_.json', 'carte-de-mj__x_5f.json', '']) {
        egal(cleDuFichier(nom), null, `« ${nom} » refusé`);
      }
      egal(cleDuFichier(undefined), null, 'sans nom');
      egal(cleDuFichier('cdm-dossier-local-v1.json'), null, 'le marqueur local n’est pas une donnée retenue');
    }],
    ['les données du stock : clés retenues seulement, texte tel quel', () => {
      const s = stock({ 'carte-de-mj:donjons-v1': '{ "a":1 }', 'dd-fiche-x': 'y', 'autre': 'z', 'cdm-dossier-local-v1': '{}' });
      const m = donneesDuStock(s);
      egal([...m.keys()], ['carte-de-mj:donjons-v1', 'dd-fiche-x'], 'clés');
      egal(m.get('carte-de-mj:donjons-v1'), '{ "a":1 }', 'valeur brute');
    }],
    ['comparer : identique, différentes, d’un seul côté', () => {
      egal(comparer(new Map([['a', '1']]), new Map([['a', '1']])).identique, true, 'identiques');
      egal(comparer(new Map(), new Map()).identique, true, 'vides');
      const c = comparer(new Map([['a', '1'], ['b', '2'], ['c', '3']]), new Map([['a', '1'], ['b', 'X'], ['d', '4']]));
      egal(c, { identique: false, differentes: ['b'], seulA: ['c'], seulB: ['d'] }, 'écarts');
    }],
    ['signature d’image : change avec les métadonnées et la taille, pas avec l’ordre des champs ni le blob', () => {
      const m = { id: 'i', nom: 'a.png', type: 'image/png', largeur: 1, hauteur: 2, ajoute: 'T', titre: 't', niveau: 'zone', milieux: ['foret'], tags: [], description: '' };
      const s = signatureImage(m, 10);
      egal(signatureImage({ ...m, blob: 'x' }, 10), s, 'le blob ne compte pas');
      egal(signatureImage({ description: '', tags: [], ...m }, 10), s, 'ordre des champs');
      verifier(signatureImage(m, 11) !== s, 'taille');
      verifier(signatureImage({ ...m, titre: 'u' }, 10) !== s, 'titre');
    }],
    ['plan des images : écrire le neuf et le changé, supprimer le disparu', () => {
      const avant = new Map([['a', { sig: '1', fichier: 'images/a.png' }], ['b', { sig: '2', fichier: 'images/b.png' }], ['c', { sig: '3', fichier: 'images/c.png' }]]);
      const apres = new Map([['a', { sig: '1', fichier: 'images/a.png' }], ['b', { sig: '9', fichier: 'images/b.png' }], ['d', { sig: '4', fichier: 'images/d.png' }]]);
      egal(planImages(avant, apres), { ecrire: ['b', 'd'], supprimer: ['images/c.png'] }, 'plan');
      egal(planImages(avant, avant), { ecrire: [], supprimer: [] }, 'rien à faire');
      const renomme = new Map([['a', { sig: '1', fichier: 'images/a-2.png' }]]);
      egal(planImages(new Map([['a', { sig: '1', fichier: 'images/a.png' }]]), renomme), { ecrire: ['a'], supprimer: ['images/a.png'] }, 'fichier renommé');
    }],
    ['noms d’images : sans collision, partagés avec le zip', () => {
      egal(nomsImages([{ id: 'x', type: 'image/png' }, { id: 'x', type: 'image/png' }, { id: 'y/z', type: 'image/svg+xml' }]), ['images/x.png', 'images/x-2.png', 'images/y_z.svg'], 'noms');
    }],
    ['marqueur du dossier : aller-retour, version trop récente refusée, texte étranger ignoré', () => {
      const t = texteMarqueur({ modifie: '2026-11-06T10:00:00.000Z', appareil: 'app-1' });
      egal(lireMarqueur(t), { modifie: '2026-11-06T10:00:00.000Z', appareil: 'app-1' }, 'relu');
      egal(JSON.parse(t).format, FORMAT_DOSSIER, 'format');
      egal(lireMarqueur('pas du json'), null, 'illisible');
      egal(lireMarqueur('{"format":"autre","version":1}'), null, 'autre format');
      const e = lance(() => lireMarqueur(JSON.stringify({ format: FORMAT_DOSSIER, version: 2 })));
      verifier(e && /plus récente/.test(e.message), 'version trop récente');
    }],
    ['marqueur local : valeurs par défaut et relecture', () => {
      let n = 0;
      const id = () => `app-${++n}`;
      egal(lireLocal(null, id), { appareil: 'app-1', dernierSync: null, sale: false, supprimees: [] }, 'absent');
      egal(lireLocal('{abîmé', id), { appareil: 'app-2', dernierSync: null, sale: false, supprimees: [] }, 'abîmé');
      egal(lireLocal(JSON.stringify({ appareil: 'moi', dernierSync: 'T', sale: true, supprimees: ['a', 3] }), id), { appareil: 'moi', dernierSync: 'T', sale: true, supprimees: ['a'] }, 'relu');
      egal(lireLocal('{"sale":"oui","dernierSync":3,"supprimees":"a"}', id).sale, false, 'types invalides');
      egal(noterSuppressions(['a'], ['b', 'a']), ['a', 'b'], 'suppressions sans doublon');
    }],
    ['décision : contenus identiques → rien', () => {
      egal(decider({ dossier: dossier(), navigateur: plein, identique: true, local: local({ sale: true }) }).action, 'rien', 'identique');
    }],
    ['décision : dossier vide → pousser le navigateur', () => {
      const d = decider({ dossier: { vide: true, modifie: '' }, navigateur: plein, identique: false, local: local() });
      egal([d.action, d.sauvegarderAvant], ['pousser', false], 'pousser');
    }],
    ['décision : navigateur vide, dossier plein → tirer sans zip (rien à perdre)', () => {
      const d = decider({ dossier: dossier(), navigateur: { vide: true }, identique: false, local: local() });
      egal([d.action, d.sauvegarderAvant], ['tirer', false], 'tirer');
    }],
    ['décision : le dossier n’a pas bougé depuis la dernière synchro → le navigateur est plus récent, pousser', () => {
      const d = decider({ dossier: dossier('T5'), navigateur: plein, identique: false, local: local({ dernierSync: 'T5', sale: true }) });
      egal(d.action, 'pousser', 'même si sale');
      egal(decider({ dossier: dossier('T5'), navigateur: plein, identique: false, local: local({ dernierSync: 'T5' }) }).action, 'pousser', 'pas sale');
    }],
    ['décision : dossier plus récent et navigateur propre → tirer, avec le zip d’avant', () => {
      const d = decider({ dossier: dossier('T6'), navigateur: plein, identique: false, local: local({ dernierSync: 'T5' }) });
      egal([d.action, d.sauvegarderAvant], ['tirer', true], 'tirer');
    }],
    ['décision : les deux ont changé → conflit (avec zip d’avant)', () => {
      const d = decider({ dossier: dossier('T6'), navigateur: plein, identique: false, local: local({ dernierSync: 'T5', sale: true }) });
      egal([d.action, d.sauvegarderAvant], ['conflit', true], 'conflit');
    }],
    ['décision : navigateur jamais synchronisé et contenus différents → conflit, jamais d’écrasement silencieux', () => {
      const d = decider({ dossier: dossier('T6'), navigateur: plein, identique: false, local: local() });
      egal(d.action, 'conflit', 'conflit');
      egal(decider({ dossier: dossier('', { marqueur: null }), navigateur: plein, identique: false, local: local({ dernierSync: 'T5' }) }).action, 'tirer', 'dossier sans date mais synchro déjà faite et navigateur propre');
    }],
    ['entrée de images/index.json : normalisée pour IndexedDB, ou refusée', () => {
      const e = entreeDuDossier(meta('foret-01', { inconnu: 1, grille: { case: 48, dx: 0, dy: 0 } }));
      egal([e.id, e.type, e.titre, e.nom, e.credit, e.licence, e.inconnu, e.grille.case], ['foret-01', 'image/png', 'Forêt foret-01', 'foret-01.png', '', 'libre', 1, 48], 'normalisée');
      verifier(!('fichier' in e), 'le chemin dans le dossier ne va pas dans IndexedDB');
      egal(entreeDuDossier({ ...meta('x'), nom: undefined }).nom, 'x.png', 'nom tiré du fichier');
      for (const [mauvais, quoi] of [[meta('x', { niveau: 'galaxie' }), 'niveau'], [meta('x', { type: 'text/html' }), 'type'], [meta('x', { fichier: '../x.png' }), 'chemin'], [meta('x', { fichier: 'images/a/b.png' }), 'sous-dossier'], [{ ...meta('x'), id: 4 }, 'id'], [null, 'rien'], [[], 'tableau']]) {
        egal(entreeDuDossier(mauvais), null, quoi);
      }
      egal(entreeDuDossier(meta('x', { largeur: 'grand' })).largeur, undefined, 'dimension invalide retirée (mesurée à l’import)');
    }],
    ['cartes ajoutées hors de l’appli (skill) : importées, sauf si le MJ les a supprimées ici', () => {
      const index = [meta('img-a'), meta('foret-01'), meta('foret-02'), meta('foret-01'), { id: 'casse', fichier: 'images/casse.png', type: 'image/png', niveau: '???' }];
      const ajouts = ajoutsDuDossier({ index, navigateur: new Set(['img-a']), supprimees: new Set(['foret-02']) });
      egal(ajouts.map((a) => [a.entree.id, a.fichier]), [['foret-01', 'images/foret-01.png']], 'seule la carte nouvelle, une fois');
      egal(etrangeres(index, new Set(['img-a']), new Set(['foret-02'])).map((m) => m.id), ['foret-01', 'foret-01', 'casse'], 'à garder telles quelles');
      egal(etrangeres('pas un tableau', new Set(), new Set()), [], 'index illisible');
    }],
    ['réécriture de l’index : une carte ajoutée par le skill entre deux sauvegardes n’est jamais effacée', () => {
      // Le navigateur ne connaît que img-a (l'import a échoué ou n'a pas encore eu lieu) ; le skill a ajouté foret-01 au dossier.
      const index = [meta('img-a'), meta('foret-01')];
      const p = planDossierImages({ dossier: dossierImages(index), images: [nav('img-a', 'v2')], supprimees: new Set() });
      verifier(!p.supprimer.includes('images/foret-01.png'), 'le fichier du skill reste');
      verifier(p.index.some((m) => m.id === 'foret-01'), 'l’entrée du skill reste dans l’index');
      egal(p.ecrire, ['img-a'], 'seule l’image changée est réécrite');
      // Même cas, l'entrée du skill étant invalide pour l'appli : gardée quand même, telle quelle.
      const bizarre = { id: 'bizarre', fichier: 'images/bizarre.png', type: 'image/png', niveau: '???' };
      const p2 = planDossierImages({ dossier: dossierImages([meta('img-a'), bizarre]), images: [nav('img-a')], supprimees: new Set() });
      egal(p2.index.at(-1), bizarre, 'entrée étrangère recopiée à l’identique');
      verifier(!p2.supprimer.length, 'aucun fichier retiré');
    }],
    ['réécriture de l’index : après import, la carte du skill est une carte comme les autres', () => {
      const index = [meta('img-a'), meta('foret-01')];
      const p = planDossierImages({ dossier: dossierImages(index), images: [nav('img-a'), nav('foret-01')], supprimees: new Set() });
      egal([p.ecrire, p.supprimer], [[], []], 'rien à recopier');
      egal(p.index.map((m) => m.id), ['img-a', 'foret-01'], 'index');
    }],
    ['réécriture de l’index : seule une suppression faite dans l’appli retire une carte du dossier', () => {
      const index = [meta('img-a'), meta('foret-01'), meta('foret-02')];
      const p = planDossierImages({ dossier: dossierImages(index), images: [nav('img-a')], supprimees: new Set(['foret-02']) });
      egal(p.supprimer, ['images/foret-02.png'], 'la carte supprimée ici part');
      egal(p.index.map((m) => m.id), ['img-a', 'foret-01'], 'celle du skill reste');
      verifier(p.aEcrire, 'l’index est réécrit');
    }],
    ['réécriture de l’index : rien ne change, rien n’est écrit ; une image du navigateur absente de l’index y revient', () => {
      const index = [{ ...nav('img-a').meta, fichier: 'images/img-a.png' }];
      egal(planDossierImages({ dossier: dossierImages(index, 'v1'), images: [nav('img-a')], supprimees: new Set() }).aEcrire, false, 'identique');
      // Le skill a réécrit l'index pendant que l'appli ajoutait img-b : img-b manque à l'index, l'appli la remet.
      const p = planDossierImages({ dossier: dossierImages([...index, meta('foret-01')], 'v1'), images: [nav('img-a'), nav('img-b')], supprimees: new Set() });
      egal(p.ecrire, ['img-b'], 'img-b réécrite');
      egal(p.index.map((m) => m.id), ['img-a', 'img-b', 'foret-01'], 'les deux gardées');
    }],
    ['ancien catalogue : ses cartes rejoignent la liste une seule fois, avec le même id', () => {
      const cartes = [{ id: 'foret-01', titre: 'Forêt', fichier: 'cartes/foret-01.webp', niveau: 'zone', milieux: [], tags: [], description: '', licence: 'libre', credit: 'Moi' }, { id: 'port', fichier: 'cartes/port.png' }, { id: 'deja', fichier: 'cartes/deja.png' }, { id: 'bizarre', fichier: 'cartes/x.gif' }];
      egal(cartesAMigrer(cartes, { dejaMigrees: new Set(['deja']), navigateur: new Set(['port']) }).map((c) => c.id), ['foret-01'], 'à migrer');
      const e = entreeDeCarte(cartes[0], 'T');
      egal([e.id, e.nom, e.type, e.ajoute, e.credit], ['foret-01', 'foret-01.webp', 'image/webp', 'T', 'Moi'], 'entrée');
      verifier(!('fichier' in e), 'pas de chemin');
      egal(lireMigrees('{"ids":["a",1]}'), ['a'], 'ids migrés');
      egal(lireMigrees(null), [], 'aucun fichier');
      egal([typeDuFichier('a.JPG'), typeDuFichier('a.gif')], ['image/jpeg', null], 'type d’après l’extension');
    }],
    ['textes d’état du dialogue', () => {
      egal(texteEtat({ etat: 'indisponible' }), 'Non disponible dans ce navigateur (Chrome ou Edge sur ordinateur)', 'indisponible');
      egal(texteEtat({ etat: 'aucun' }), 'Aucun dossier', 'aucun');
      egal(texteEtat({ etat: 'connecte', nom: 'Jeu', quand: new Date(2026, 10, 6, 9, 5) }), 'Enregistré dans « Jeu » à 09:05', 'connecté');
      verifier(/échec : espace disque plein/.test(texteEtat({ etat: 'connecte', nom: 'Jeu', erreur: 'espace disque plein' })), 'erreur d’écriture visible');
      verifier(/À reconnecter/.test(texteEtat({ etat: 'a-reconnecter', nom: 'Jeu' })), 'à reconnecter');
      verifier(/Conflit/.test(texteEtat({ etat: 'conflit', nom: 'Jeu' })), 'conflit');
      egal(texteEtat({ etat: '?' }), '', 'état inconnu');
      egal(heure(new Date(2026, 0, 1, 14, 3)), '14:03', 'heure');
      egal(nomCopie(new Date(2026, 10, 6, 9, 5)), '2026-11-06-09h05', 'nom de la copie');
    }],
  ]);
}
