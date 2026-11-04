/**
 * Tests du stockage (js/stockage.js) : rien de ce qui est enregistré ne se perd au chargement.
 * Un donjon ou un modèle qui ne se relit pas (version plus récente, texte abîmé…) est mis de côté AVANT que la clé soit réécrite ;
 * la mise de côté ne se répète pas, et si elle échoue (stockage plein) la clé d'origine n'est pas réécrite.
 * Puis, à la suite, le stockage d'une partie en cours : présentations, réglages relus (mini-carte, mode de taille à la table) et partie à reprendre.
 * Sans dépendance : marche sous Node et dans tests.html.
 */
import * as m from '../js/donjon.js';
import * as p from '../js/presentation.js';
import { chargerTout, chargerDonjons, sauverDonjons, chargerModeles, sauverModeles, enregistrerPartie, chargerPresentations, sauverPresentations, chargerReglages, sauverReglages, CLE_PARTIE_OUVERTE, memoriserPartieOuverte, oublierPartieOuverte, partieAReprendre, migrer, misDeCote, phraseMiseDeCote, CLE_DONJONS, CLE_MODELES, CLE_PRESENTATIONS, CLE_MIS_DE_COTE, CLE_REGLAGES } from '../js/stockage.js';
import * as miseDeCote from '../js/mise-de-cote.js';
import { donjonDeTest } from './aides-partie.js';
import { verifier, egal, fauxStock, executerSuite } from './mini-test.js';

const TEXTE = 'Salle de 5 par 4 cases, une porte au mur est en 2.';
const donjon = (nom) => JSON.parse(JSON.stringify(m.creerDonjon({ nom, texte: TEXTE })));
/** Un donjon écrit par une version plus récente : même format, version 2, un champ que celle-ci ne connaît pas. */
const futur = (nom) => ({ ...donjon(nom), version: 2, nouveaute: { cases: ['hexagonales'] } });
const enregistre = (...donjons) => JSON.stringify({ actif: donjons[0].id, donjons: Object.fromEntries(donjons.map((d) => [d.id, d])) });
/** Un stockage où l'écriture échoue (quota), pour `cles` seulement ou pour tout si `cles` est omis. */
function stockPlein(initial, cles) {
  const s = fauxStock(initial);
  const ecrire = s.setItem;
  s.setItem = (k, v) => { if (!cles || cles.includes(k)) throw new Error('QuotaExceededError'); ecrire(k, v); };
  return s;
}
/** Un démarrage de page : on charge, puis le premier dessin enregistre. */
function demarrer(stock) {
  const charge = chargerTout({ texteInitial: 'Salle de 3 par 3 cases.', stock });
  sauverDonjons(charge, stock);
  return charge;
}

const TESTS = [
  ['un donjon relu en partie : l’original est copié avant que la version nettoyée le remplace, et la copie ne se répète pas', () => {
    const d = donjon('Abîmé');
    d.liaisons = 'aucune';
    const stock = fauxStock({ [CLE_DONJONS]: enregistre(d) });
    const r = chargerTout({ stock });
    egal(r.miseDeCote, { nombre: 1, ok: true }, 'annoncé au chargement');
    egal(Object.keys(r.donjons), [d.id], 'le donjon reste utilisable');
    const copies = misDeCote(stock);
    egal(copies.length, 1, 'une copie');
    egal(copies[0].valeur, d, 'la copie est l’original');
    verifier(copies[0].raison.includes('liaisons ignorées'), 'la raison dit ce qui manque');
    chargerTout({ stock });
    egal(misDeCote(stock).length, 1, 'recharger n’ajoute rien');
    egal(chargerTout({ stock: fauxStock({ [CLE_DONJONS]: enregistre(donjon('Sain')) }) }).miseDeCote, null, 'un donjon complet : rien à dire');
  }],
  ['les réglages gardent ce que cette version ne connaît pas, et écartent toujours une valeur invalide', () => {
    const stock = fauxStock({ [CLE_REGLAGES]: JSON.stringify({ taille: 60, nouveaute: { a: 1 }, reperes: 'oui', miniTable: 'non' }) });
    const r = chargerReglages(stock);
    egal(r.nouveaute, { a: 1 }, 'champ inconnu gardé');
    verifier(!('reperes' in r) && !('miniTable' in r), 'valeurs invalides toujours écartées');
    sauverReglages({ ...r, grille: false }, stock);
    const relu = chargerReglages(stock);
    egal([relu.nouveaute, relu.grille], [{ a: 1 }, false], 'le champ survit à une sauvegarde');
    egal(chargerReglages(fauxStock({ [CLE_REGLAGES]: '[1,2]' })), { echelle: 1.5, taille: chargerReglages(fauxStock({})).taille, grille: true }, 'une liste n’est pas des réglages');
  }],
  ['un donjon de version plus récente est mis de côté, le valide est gardé, et la clé réécrite ne le détruit pas', () => {
    const bon = donjon('Crypte'), recent = futur('Futur');
    const stock = fauxStock({ [CLE_DONJONS]: enregistre(bon, recent) });
    const charge = chargerTout({ stock });
    egal(Object.keys(charge.donjons), [bon.id], 'le donjon valide est là');
    egal(charge.miseDeCote, { nombre: 1, ok: true }, 'la mise de côté est signalée');
    verifier(stock.donnees[CLE_DONJONS] === enregistre(bon, recent), 'le chargement lui-même n’écrit pas la clé des donjons');
    verifier(sauverDonjons(charge, stock), 'l’enregistrement suivant réussit');
    egal(Object.keys(JSON.parse(stock.donnees[CLE_DONJONS]).donjons), [bon.id], 'la clé ne garde plus que le valide');
    const copies = misDeCote(stock);
    egal(copies.length, 1, 'une copie');
    egal([copies[0].cle, copies[0].valeur], [CLE_DONJONS, recent], 'la copie est le donjon, octet pour octet, champ inconnu compris');
    verifier(/plus récente/.test(copies[0].raison), `raison : ${copies[0].raison}`);
  }],

  ['recharger la page plusieurs fois ne refait ni ne gonfle la copie', () => {
    const stock = fauxStock({ [CLE_DONJONS]: enregistre(donjon('Crypte'), futur('Futur')) });
    demarrer(stock);
    const apres1 = stock.donnees[CLE_MIS_DE_COTE];
    for (let i = 0; i < 4; i++) { const c = demarrer(stock); egal(c.miseDeCote, null, `rechargement ${i + 2} : plus rien à mettre de côté`); }
    verifier(stock.donnees[CLE_MIS_DE_COTE] === apres1, 'la copie est restée la même, au caractère près');
    // Même si la clé d'origine n'a pas été réécrite (page fermée avant le premier dessin), la copie n'est pas doublée.
    const stock2 = fauxStock({ [CLE_DONJONS]: enregistre(donjon('Crypte'), futur('Futur')) });
    for (let i = 0; i < 4; i++) chargerTout({ stock: stock2 });
    egal(misDeCote(stock2).length, 1, 'quatre chargements sans réécriture : une seule copie');
    // Un autre donjon illisible s'ajoute, sans toucher au premier.
    const stock3 = fauxStock({ [CLE_DONJONS]: enregistre(donjon('A'), futur('F1')) });
    demarrer(stock3);
    const d = JSON.parse(stock3.donnees[CLE_DONJONS]);
    const f2 = futur('F2');
    d.donjons[f2.id] = f2;
    stock3.donnees[CLE_DONJONS] = JSON.stringify(d);
    demarrer(stock3);
    egal(misDeCote(stock3).map((c) => c.valeur.nom), ['F1', 'F2'], 'les copies s’accumulent, jamais remplacées');
  }],

  ['un texte qui n’est pas du JSON, une forme inconnue, ou rien de lisible : tout est mis de côté, rien n’est écrasé sans copie', () => {
    const cas = [
      ['JSON cassé', '{"actif":"a","donjons":{"a":{', 'texte illisible'],
      ['forme inconnue', JSON.stringify({ version: 2, bibliotheque: [donjon('Autre forme')] }), 'forme inconnue'],
      ['donjons en texte', JSON.stringify({ actif: 'a', donjons: 'pas un objet' }), 'forme inconnue'],
    ];
    for (const [quoi, brut, raison] of cas) {
      const stock = fauxStock({ [CLE_DONJONS]: brut });
      const charge = demarrer(stock);
      egal(charge.miseDeCote, { nombre: 1, ok: true }, `${quoi} : signalé`);
      egal(Object.keys(charge.donjons).length, 1, `${quoi} : un donjon neuf pour travailler`);
      const copies = misDeCote(stock);
      verifier(copies.length === 1 && copies[0].raison === raison, `${quoi} : raison ${copies[0]?.raison}`);
      verifier(JSON.stringify(copies[0].valeur) === JSON.stringify(typeof copies[0].valeur === 'string' ? brut : JSON.parse(brut)), `${quoi} : contenu conservé`);
    }
    // Tous les donjons sont illisibles : le départ d'un donjon neuf ne les détruit pas.
    const stock = fauxStock({ [CLE_DONJONS]: enregistre(futur('F1'), futur('F2'), { format: 'autre' }) });
    const charge = demarrer(stock);
    egal(charge.miseDeCote.nombre, 3, 'trois mis de côté');
    egal(misDeCote(stock).length, 3, 'trois copies');
    verifier(!JSON.stringify(JSON.parse(stock.donnees[CLE_DONJONS])).includes('hexagonales'), 'la clé a été réécrite avec le donjon neuf');
    // Rien d'enregistré : rien à mettre de côté, aucune clé de plus.
    const vide = fauxStock();
    egal(demarrer(vide).miseDeCote, null, 'stockage vide');
    egal(Object.keys(vide.donnees), [CLE_DONJONS], 'seule la clé des donjons est écrite');
    const nul = fauxStock({ [CLE_DONJONS]: 'null' });
    egal(demarrer(nul).miseDeCote, null, '« null » ne contient rien à perdre');
  }],

  ['la mise de côté est celle de js/mise-de-cote.js, partagée avec la Fiche : même clé, mêmes copies', () => {
    egal(CLE_MIS_DE_COTE, miseDeCote.CLE_MIS_DE_COTE, 'même clé');
    const stock = fauxStock();
    egal(miseDeCote.mettreDeCote(stock, 'autre-cle', [{ valeur: { n: 1 }, raison: 'x' }]), true, 'copiée depuis le module commun');
    egal(misDeCote(stock).map((c) => [c.cle, c.valeur]), [['autre-cle', { n: 1 }]], 'misDeCote la relit');
  }],

  ['un identifiant en double : le dernier est gardé (comme avant), l’autre est mis de côté', () => {
    const a = donjon('A'), b = { ...donjon('B'), id: a.id };
    const stock = fauxStock({ [CLE_DONJONS]: JSON.stringify({ actif: a.id, donjons: { x: a, y: b } }) });
    const charge = chargerTout({ stock });
    egal(charge.donjons[a.id].nom, 'B', 'le dernier garde l’identifiant');
    egal(misDeCote(stock).map((c) => c.valeur.nom), ['A'], 'le premier est copié');
  }],

  ['si la copie échoue (stockage plein), la clé d’origine n’est jamais réécrite', () => {
    const original = enregistre(donjon('Crypte'), futur('Futur'));
    const stock = stockPlein({ [CLE_DONJONS]: original }, [CLE_MIS_DE_COTE]);
    const charge = chargerTout({ stock });
    egal(charge.miseDeCote, { nombre: 1, ok: false }, 'l’échec est signalé');
    egal(Object.keys(charge.donjons).length, 1, 'l’outil reste utilisable');
    egal(sauverDonjons(charge, stock), false, 'l’enregistrement refuse');
    verifier(stock.donnees[CLE_DONJONS] === original, 'la clé d’origine est intacte');
    verifier(!(CLE_MIS_DE_COTE in stock.donnees), 'aucune copie à moitié écrite');
    // Stockage entièrement plein : même résultat.
    const plein = stockPlein({ [CLE_DONJONS]: original });
    const c2 = chargerTout({ stock: plein });
    egal([c2.miseDeCote.ok, sauverDonjons(c2, plein), plein.donnees[CLE_DONJONS] === original], [false, false, true], 'quota partout');
    // Le verrou ne tient que pour la session : un rechargement avec de la place sauve tout.
    const place = fauxStock(plein.donnees);
    demarrer(place);
    egal(misDeCote(place).length, 1, 'copie faite au rechargement suivant');
    egal(Object.keys(JSON.parse(place.donnees[CLE_DONJONS]).donjons).length, 1, 'puis la clé est réécrite');
    // La clé de secours est abîmée : on n'y touche pas, et on n'écrase pas non plus l'original.
    const abimee = fauxStock({ [CLE_DONJONS]: original, [CLE_MIS_DE_COTE]: '{pas du json' });
    const c3 = chargerTout({ stock: abimee });
    egal([c3.miseDeCote.ok, sauverDonjons(c3, abimee), abimee.donnees[CLE_DONJONS] === original, abimee.donnees[CLE_MIS_DE_COTE]], [false, false, true, '{pas du json'], 'secours abîmé');
    // Un stockage refusé au verrou ne bloque pas un autre stockage.
    egal(sauverDonjons(charge, fauxStock()), true, 'un autre stockage écrit normalement');
  }],

  ['des donjons valides se chargent comme avant et ne créent aucune clé', () => {
    const a = donjon('A'), b = donjon('B');
    const brut = enregistre(a, b);
    const stock = fauxStock({ [CLE_DONJONS]: brut });
    const charge = chargerTout({ stock });
    egal(charge.miseDeCote, null, 'rien à signaler');
    egal([charge.actif, Object.keys(charge.donjons)], [a.id, [a.id, b.id]], 'donjons et actif');
    egal(chargerDonjons(stock).donjons, charge.donjons, 'chargerDonjons rend la même chose');
    sauverDonjons(charge, stock);
    egal(Object.keys(stock.donnees), [CLE_DONJONS], 'aucune clé nouvelle');
    egal(Object.keys(JSON.parse(stock.donnees[CLE_DONJONS]).donjons), [a.id, b.id], 'rien n’a bougé');
    egal(chargerDonjons(fauxStock({ [CLE_DONJONS]: JSON.stringify({ actif: 'inconnu', donjons: { [a.id]: a } }) })).actif, a.id, 'actif inconnu : le premier');
    // Les lecteurs seuls (Présentation, Impression) n'écrivent jamais, même devant une entrée illisible.
    const avecFutur = fauxStock({ [CLE_DONJONS]: enregistre(a, futur('F')) });
    const avant = JSON.stringify(avecFutur.donnees);
    egal(Object.keys(chargerDonjons(avecFutur).donjons), [a.id], 'le lecteur voit le valide');
    egal(JSON.stringify(avecFutur.donnees), avant, 'et n’écrit rien');
  }],

  ['les modèles abîmés sont mis de côté avant que la liste soit réécrite', () => {
    const bon = donjon('Mon modèle'), recent = futur('Modèle futur');
    const brut = JSON.stringify({ modeles: [bon, { pas: 'un donjon' }, recent, 'x'] });
    const stock = fauxStock({ [CLE_MODELES]: brut });
    egal(chargerModeles(stock).map((x) => x.id), [bon.id], 'lecture : seul le bon');
    verifier(stock.donnees[CLE_MODELES] === brut && !(CLE_MIS_DE_COTE in stock.donnees), 'lire n’écrit rien');
    const nouveau = donjon('Nouveau');
    verifier(sauverModeles([...chargerModeles(stock), nouveau], stock), 'écriture');
    egal(chargerModeles(stock).map((x) => x.id), [bon.id, nouveau.id], 'la liste est réécrite');
    egal(misDeCote(stock).map((c) => c.cle), [CLE_MODELES, CLE_MODELES, CLE_MODELES], 'trois éléments copiés');
    egal(misDeCote(stock).find((c) => c.valeur?.version === 2).valeur, recent, 'le modèle futur est intact');
    const copie = stock.donnees[CLE_MIS_DE_COTE];
    sauverModeles(chargerModeles(stock), stock);
    sauverModeles(chargerModeles(stock), stock);
    verifier(stock.donnees[CLE_MIS_DE_COTE] === copie, 'réécrire encore ne change pas la copie');
    // Échec de la copie : la liste n'est pas réécrite et l'écriture dit non.
    const plein = stockPlein({ [CLE_MODELES]: brut }, [CLE_MIS_DE_COTE]);
    egal(sauverModeles([bon], plein), false, 'refusé');
    verifier(plein.donnees[CLE_MODELES] === brut, 'liste d’origine intacte');
    // Texte cassé : copié tel quel.
    const casse = fauxStock({ [CLE_MODELES]: '{cassé' });
    verifier(sauverModeles([bon], casse), 'écriture');
    egal(misDeCote(casse).map((c) => c.valeur), ['{cassé'], 'texte cassé copié');
    // Rien d'abîmé : aucune clé de plus.
    const net = fauxStock();
    sauverModeles([bon], net);
    egal(Object.keys(net.donnees), [CLE_MODELES], 'aucune clé nouvelle');
  }],

  ['les parties : une partie illisible reste en place quand une autre est enregistrée', () => {
    const p = { format: 'carte-de-mj-presentation', version: 2, donjon: { id: 'autre' }, avenir: true };
    const stock = fauxStock({ [CLE_PRESENTATIONS]: JSON.stringify({ presentations: { autre: p } }) });
    egal(Object.keys(chargerPresentations(stock)), [], 'illisible ici');
    enregistrerPartie({ donjon: { id: 'nouvelle' }, a: 1 }, stock);
    egal(JSON.parse(stock.donnees[CLE_PRESENTATIONS]).presentations.autre, p, 'la partie illisible est conservée telle quelle');
  }],

  ['migrer : une chaîne d’étapes amène un donjon ancien à la version actuelle, le reste est laissé tel quel', () => {
    const v1 = { format: m.FORMAT, version: 1, nom: 'Ancien' };
    const etapes = { 1: (d) => ({ ...d, version: 2, a: 1 }), 2: (d) => ({ ...d, version: 3, b: 2 }) };
    egal(migrer(v1, etapes, 3), { format: m.FORMAT, version: 3, nom: 'Ancien', a: 1, b: 2 }, 'deux étapes');
    egal(v1, { format: m.FORMAT, version: 1, nom: 'Ancien' }, 'l’original n’est pas modifié');
    egal(migrer({ ...v1, version: 2 }, etapes, 3).version, 3, 'une seule étape quand on part de la version 2');
    const recent = { ...v1, version: 4 };
    verifier(migrer(recent, etapes, 3) === recent, 'plus récent que la version actuelle : rendu tel quel');
    verifier(migrer(v1, {}, 3) === v1, 'étape manquante : rendu tel quel');
    verifier(migrer(v1, { 1: (d) => ({ ...d }) }, 3).version === 1, 'une étape qui n’avance pas ne boucle pas');
    for (const x of [null, 'x', 4, [1], { format: 'autre', version: 1 }, { format: m.FORMAT, version: '1' }]) verifier(migrer(x, etapes, 3) === x, `rendu tel quel : ${JSON.stringify(x)}`);
    const actuel = donjon('Actuel');
    verifier(migrer(actuel) === actuel, 'version actuelle, étapes réelles : inchangé');
  }],

  ['le message dit ce qui s’est passé, et si rien n’est perdu', () => {
    const bien = phraseMiseDeCote({ nombre: 2, ok: true }), mal = phraseMiseDeCote({ nombre: 2, ok: false });
    verifier(/Rien n’est perdu/.test(bien) && !/exporte/.test(bien), bien);
    verifier(/ne seront pas enregistrées/.test(mal) && /exporte/.test(mal) && !/Rien n’est perdu/.test(mal), mal);
  }],

  ['les réglages et l’ancienne clé : le chargement n’y écrit rien', () => {
    const stock = fauxStock({ 'jdr-carte:v1': JSON.stringify({ texte: TEXTE }), [CLE_DONJONS]: enregistre(futur('F')) });
    const avant = { ...stock.donnees };
    const charge = chargerTout({ stock });
    egal(charge.miseDeCote, { nombre: 1, ok: true }, 'le donjon futur est mis de côté');
    verifier(charge.migre === true, 'rien de lisible : on repart de l’ancienne clé, comme avant');
    egal(Object.keys(stock.donnees).sort(), [CLE_DONJONS, CLE_MIS_DE_COTE, 'jdr-carte:v1'].sort(), 'seule la clé de secours est ajoutée');
    verifier(stock.donnees['jdr-carte:v1'] === avant['jdr-carte:v1'] && stock.donnees[CLE_DONJONS] === avant[CLE_DONJONS] && !(CLE_REGLAGES in stock.donnees), 'le reste est intact');
  }],
];

const TESTS_PRESENTATION = [
  ['stockage : présentations et réglages, sans toucher aux autres clés', () => {
    const { d } = donjonDeTest();
    const pres = p.creerPresentation(d);
    const stock = fauxStock({ 'carte-de-mj:donjons-v1': 'inchangé' });
    egal(chargerPresentations(stock), {}, 'rien au départ');
    verifier(sauverPresentations({ [d.id]: pres }, stock), 'sauvegarde');
    const lu = chargerPresentations(stock);
    egal(Object.keys(lu), [d.id], 'une présentation, rangée par identifiant de donjon');
    egal(lu[d.id].salleCourante, pres.salleCourante, 'relue à l’identique');
    stock.donnees[CLE_PRESENTATIONS] = JSON.stringify({ presentations: { bon: pres, mauvais: { format: 'x' } } });
    egal(Object.keys(chargerPresentations(stock)), [d.id], 'une entrée invalide est écartée sans casser les autres');
    stock.donnees[CLE_PRESENTATIONS] = '{pas du json';
    egal(chargerPresentations(stock), {}, 'JSON cassé : liste vide');
    verifier(stock.donnees['carte-de-mj:donjons-v1'] === 'inchangé', 'les donjons ne sont pas touchés');
    egal(chargerReglages(fauxStock({ [CLE_REGLAGES]: JSON.stringify({ taille: 60 }) })), { echelle: 1.5, taille: 60, grille: true }, 'repères absents des réglages : clé non ajoutée');
    verifier(chargerReglages(fauxStock({ [CLE_REGLAGES]: JSON.stringify({ reperes: false }) })).reperes === false, 'repères relus quand ils sont réglés');
  }],

  ['réglage de la mini-carte : relu seulement si le MJ l’a éteinte', () => {
    verifier(chargerReglages(fauxStock({ [CLE_REGLAGES]: JSON.stringify({ miniTable: false }) })).miniTable === false, 'éteinte : relu');
    verifier(!('miniTable' in chargerReglages(fauxStock({ [CLE_REGLAGES]: JSON.stringify({ miniTable: 'non' }) }))), 'valeur inconnue : ignorée');
  }],

  ['réglages : modeTable et calibre sont relus s’ils sont valides, absents sinon (le Donjon ne les voit pas)', () => {
    egal(chargerReglages(fauxStock({ [CLE_REGLAGES]: JSON.stringify({ taille: 60 }) })), { echelle: 1.5, taille: 60, grille: true }, 'rien de réglé : aucune clé ajoutée');
    const r = chargerReglages(fauxStock({ [CLE_REGLAGES]: JSON.stringify({ taille: 60, modeTable: 'reel', calibre: true }) }));
    egal([r.modeTable, r.calibre], ['reel', true], 'relus');
    const bad = chargerReglages(fauxStock({ [CLE_REGLAGES]: JSON.stringify({ modeTable: '<img>', calibre: 'oui' }) }));
    egal(['modeTable' in bad, 'calibre' in bad], [false, false], 'valeurs invalides écartées');
  }],

  ['reprise : l’identifiant de la partie ouverte est mémorisé ; rien à reprendre si absent, oublié ou disparu', () => {
    const { d } = donjonDeTest();
    const pres = p.creerPresentation(d);
    const parties = { [d.id]: pres };
    const stock = fauxStock();
    egal(partieAReprendre(parties, stock), null, 'rien de mémorisé : liste des donjons');
    memoriserPartieOuverte(d.id, stock);
    egal(partieAReprendre(parties, stock) === pres, true, 'la partie ouverte est rouverte');
    egal(JSON.parse(stock.donnees[CLE_PARTIE_OUVERTE]), { id: d.id }, 'on ne garde que l’identifiant (la partie est ailleurs)');
    egal(partieAReprendre({}, stock), null, 'partie disparue : liste des donjons');
    memoriserPartieOuverte('__proto__', stock);
    egal(partieAReprendre({}, stock), null, 'identifiant piégé : rien');
    memoriserPartieOuverte(d.id, stock);
    oublierPartieOuverte(stock);
    egal(partieAReprendre(parties, stock), null, '« Liste des donjons » oublie la partie ouverte');
    stock.donnees[CLE_PARTIE_OUVERTE] = '{pas du json';
    egal(partieAReprendre(parties, stock), null, 'donnée corrompue : liste des donjons');
  }],
];

export const executer = () => [...executerSuite('stockage : ', TESTS), ...executerSuite('présentation : ', TESTS_PRESENTATION)];
