/**
 * Tests du modèle de donjon (donjon.js), et du stockage (migration)
 * (disposition). Sans dépendance : marche sous Node et dans tests.html.
 * Chaque test lève une Error au premier écart ; executer() renvoie la même forme
 * que les autres tests ({ phrase, ecarts }).
 */
import * as m from '../js/donjon.js';
import { analyser } from '../js/parseur/index.js';
import { decrire } from '../js/parseur/decrire.js';
import { validerPlan } from '../js/schema.js';
import { chargerTout, chargerDonjons, sauverDonjons, CLE_DONJONS, CLE_REGLAGES } from '../js/stockage.js';
import { verifier, egal, fauxStock, executerSuite } from './mini-test.js';

function leve(f, morceau, quoi) {
  try { f(); } catch (e) { verifier(e.message.includes(morceau), `${quoi} : message « ${e.message} » sans « ${morceau} »`); return; }
  throw new Error(`${quoi} : aucune erreur levée`);
}

const SALLE_2_PORTES = 'Salle de 6 par 6 cases, une porte au mur sud en B, une porte au mur est en 3, deux coffres en A1 C1.';
const donjonDeTest = () => m.creerDonjon({ nom: 'Test', texte: SALLE_2_PORTES });
const premiere = (d) => d.salles[d.salleActive];

const TESTS = [
  ['création : format, version, une salle active, identifiants', () => {
    const d = donjonDeTest();
    egal([d.format, d.version], ['carte-de-mj-donjon', 1], 'format et version');
    verifier(Object.keys(d.salles).length === 1, 'une seule salle attendue');
    const s = premiere(d);
    verifier(d.salleActive === s.id && s.plan.id === s.id, 'le plan porte l’identifiant de la salle');
    verifier(s.plan.largeur === 6 && s.plan.portes.length === 2, 'plan lu depuis le texte');
    verifier(s.notes === '', 'notes vides au départ');
    verifier(/^[\w-]+$/.test(d.id) && /^[\w-]+$/.test(s.id), 'identifiants sûrs');
  }],

  ['salles : ajouter, renommer, identifiants uniques', () => {
    const d = donjonDeTest();
    const ids = new Set([premiere(d).id]);
    for (let i = 0; i < 60; i++) ids.add(m.ajouterSalle(d, {}).id);
    verifier(ids.size === 61 && Object.keys(d.salles).length === 61, 'identifiants de salle uniques');
    const s = m.ajouterSalle(d, { nom: 'Crypte' });
    verifier(s.nom === 'Crypte' && s.plan.largeur === 8, 'salle isolée de 8 × 8 par défaut');
    m.renommerSalle(d, s.id, '  Grande crypte ');
    verifier(d.salles[s.id].nom === 'Grande crypte', 'renommage');
    m.renommerSalle(d, s.id, '   ');
    verifier(d.salles[s.id].nom === 'Grande crypte', 'un nom vide est refusé');
    verifier(d.salleActive !== s.id, 'ajouter ne change pas la salle active');
    const d2 = donjonDeTest();
    verifier(d2.id !== d.id, 'identifiants de donjon distincts');
  }],

  ['liaison : relier, retrouver depuis les deux bouts, refus des doublons', () => {
    const d = donjonDeTest();
    const a = premiere(d);
    const b = m.ajouterSalle(d, { texte: 'Salle de 5 par 5 cases, une porte au mur nord en C.' });
    const l = m.relier(d, { salle: a.id, mur: 'sud', position: 1 }, { salle: b.id, mur: 'nord', position: 2 });
    verifier(d.liaisons.length === 1 && l.id, 'liaison créée avec un identifiant');
    const vue = m.liaisonDePorte(d, a.id, { mur: 'sud', position: 1 });
    verifier(vue?.liaison === l && vue.cote === 'a' && vue.autre.salle === b.id, 'trouvée depuis le côté a');
    verifier(m.liaisonDePorte(d, b.id, { mur: 'nord', position: 2 })?.cote === 'b', 'trouvée depuis le côté b');
    verifier(m.liaisonDePorte(d, a.id, { mur: 'est', position: 2 }) === null, 'une autre porte n’est pas reliée');
    leve(() => m.relier(d, { salle: a.id, mur: 'sud', position: 1 }, { salle: b.id, mur: 'nord', position: 2 }), 'déjà reliée', 'porte déjà reliée');
    leve(() => m.relier(d, { salle: a.id, mur: 'est', position: 2 }, { salle: a.id, mur: 'sud', position: 1 }), 'elle-même', 'même salle');
    leve(() => m.relier(d, { salle: a.id, mur: 'nord', position: 0 }, { salle: b.id, mur: 'nord', position: 2 }), 'aucune porte', 'porte inexistante');
    verifier(m.delier(d, l.id) && d.liaisons.length === 0, 'délier');
    verifier(!m.delier(d, l.id), 'délier deux fois renvoie false');
  }],

  ['suppression : retire les liaisons, jamais la dernière salle sans en recréer une', () => {
    const d = donjonDeTest();
    const a = premiere(d);
    const { salle: b } = m.creerSalleDerriere(d, { depuis: { salle: a.id, mur: 'sud', position: 1 } });
    const { salle: c } = m.creerSalleDerriere(d, { depuis: { salle: a.id, mur: 'est', position: 2 } });
    verifier(d.liaisons.length === 2, 'deux liaisons');
    m.supprimerSalle(d, b.id);
    verifier(d.liaisons.length === 1 && d.liaisons[0].b.salle === c.id, 'la liaison de la salle supprimée est retirée');
    verifier(!(b.id in d.salles), 'salle retirée');
    d.salleActive = c.id;
    m.supprimerSalle(d, c.id);
    verifier(d.salleActive === a.id && d.liaisons.length === 0, 'la salle active suit');
    const r = m.supprimerSalle(d, a.id);
    verifier(r.recree === true && Object.keys(d.salles).length === 1, 'la dernière salle est remplacée par une salle vide');
    verifier(d.salles[d.salleActive] && d.salles[d.salleActive].plan.largeur === 8, 'nouvelle salle active et valide');
  }],

  ['salle derrière une porte : 6 × 6, porte de retour opposée, texte écrit par decrire', () => {
    const d = donjonDeTest();
    const a = premiere(d);
    const avant = d.salleActive;
    const { salle, liaison } = m.creerSalleDerriere(d, { depuis: { salle: a.id, mur: 'est', position: 2 } });
    verifier(d.salleActive === avant, 'la salle active ne change pas');
    egal([salle.plan.largeur, salle.plan.longueur], [6, 6], 'taille');
    egal(salle.plan.portes.map((p) => [p.mur, p.position]), [['ouest', 2]], 'porte de retour sur le mur opposé, même position');
    verifier(salle.texte === decrire(salle.plan), 'le texte est exactement celui de decrire(plan)');
    const relu = analyser(salle.texte).plan;
    egal(relu.portes.map((p) => [p.mur, p.position]), [['ouest', 2]], 'le texte relu redonne la porte');
    egal([liaison.a.salle, liaison.a.mur, liaison.b.salle, liaison.b.mur], [a.id, 'est', salle.id, 'ouest'], 'liaison aux deux bouts');
    // Position au-delà de la nouvelle salle : ramenée sur son mur.
    const grande = m.ajouterSalle(d, { texte: 'Salle de 12 par 12 cases, une porte au mur sud en K.' });
    const r2 = m.creerSalleDerriere(d, { depuis: { salle: grande.id, mur: 'sud', position: 10 } });
    egal(r2.salle.plan.portes.map((p) => [p.mur, p.position]), [['nord', 5]], 'position ramenée dans le mur');
    leve(() => m.creerSalleDerriere(d, { depuis: { salle: a.id, mur: 'est', position: 2 } }), 'déjà reliée', 'porte déjà reliée');
  }],

  ['relier à une salle existante : position libre, sinon première libre, mur plein', () => {
    const d = donjonDeTest();
    const a = premiere(d);
    const libre = m.ajouterSalle(d, { texte: 'Salle de 6 par 6 cases, une porte au mur est en 1.' });
    const r1 = m.relierASalle(d, { salle: a.id, mur: 'sud', position: 1 }, libre.id);
    egal([r1.liaison.b.mur, r1.liaison.b.position], ['nord', 1], 'même position, mur opposé');
    verifier(libre.texte === decrire(libre.plan) && libre.plan.portes.length === 2, 'texte de la salle d’arrivée réécrit par decrire');
    verifier(r1.texteAvant.includes('mur est en 1'), 'ancien texte renvoyé pour l’historique');

    const occupee = m.ajouterSalle(d, { texte: 'Salle de 6 par 6 cases, une porte au mur ouest en 3, une porte au mur ouest en 1.' });
    const r2 = m.relierASalle(d, { salle: a.id, mur: 'est', position: 2 }, occupee.id);
    egal([r2.liaison.b.mur, r2.liaison.b.position], ['ouest', 1], 'première position libre du mur (3 et 1 sont prises)');

    const pleine = m.ajouterSalle(d, { texte: 'Salle de 2 par 2 cases, une porte au mur nord en A, une porte au mur nord en B.' });
    const d2 = donjonDeTest();
    const a2 = premiere(d2);
    const p2 = m.ajouterSalle(d2, { texte: 'Salle de 2 par 2 cases, une porte au mur nord en A, une porte au mur nord en B.' });
    leve(() => m.relierASalle(d2, { salle: a2.id, mur: 'sud', position: 1 }, p2.id), 'plus de place', 'mur plein');
    verifier(d2.liaisons.length === 0 && d2.salles[p2.id].plan.portes.length === 2, 'rien n’est modifié en cas d’échec');
    verifier(pleine.plan.portes.length === 2, 'sanity');
    leve(() => m.relierASalle(d, { salle: a.id, mur: 'sud', position: 1 }, libre.id), 'déjà reliée', 'porte déjà reliée');
  }],

  ['suivre une porte déplacée : la liaison suit mur et position', () => {
    const d = donjonDeTest();
    const a = premiere(d);
    const { salle: b } = m.creerSalleDerriere(d, { depuis: { salle: a.id, mur: 'sud', position: 1 } });
    // Déplacement simulé comme le fait deplacement.js : même plan, une porte change de mur et de position.
    const ancien = a.plan;
    const porte = ancien.portes.find((p) => p.mur === 'sud');
    const nouveau = { ...ancien, portes: ancien.portes.map((p) => (p === porte ? { ...p, mur: 'nord', position: 4 } : p)) };
    const dep = m.elementDeplace(ancien, nouveau);
    egal(dep, { genre: 'porte', avant: { genre: 'porte', mur: 'sud', position: 1 }, apres: { genre: 'porte', mur: 'nord', position: 4 } }, 'élément déplacé');
    verifier(m.suivrePortesDeplacees(d, a.id, ancien, nouveau) === 1, 'une extrémité mise à jour');
    egal([d.liaisons[0].a.mur, d.liaisons[0].a.position], ['nord', 4], 'extrémité de la salle d’origine');
    egal([d.liaisons[0].b.salle, d.liaisons[0].b.mur], [b.id, 'nord'], 'l’autre bout ne bouge pas');
    // Texte réécrit puis relu : les identifiants de portes changent, la liaison tient toujours.
    m.definirTexte(d, a.id, decrire(nouveau), planDepuis(decrire(nouveau), a.id));
    verifier(m.liaisonsOrphelines(d).length === 0, 'aucune orpheline après relecture du texte');
    verifier(m.liaisonDePorte(d, a.id, { mur: 'nord', position: 4 }), 'la porte relue est retrouvée par mur + position');
  }],

  ['orphelines : une porte qui disparaît du texte est signalée, pas supprimée', () => {
    const d = donjonDeTest();
    const a = premiere(d);
    m.creerSalleDerriere(d, { depuis: { salle: a.id, mur: 'sud', position: 1 } });
    verifier(m.liaisonsOrphelines(d).length === 0, 'aucune au départ');
    const sans = 'Salle de 6 par 6 cases, une porte au mur est en 3.';
    m.definirTexte(d, a.id, sans, planDepuis(sans, a.id));
    const o = m.liaisonsOrphelines(d);
    verifier(o.length === 1 && d.liaisons.length === 1, 'liaison conservée et signalée');
    egal([o[0].salle, o[0].cote, o[0].mur, o[0].position], [a.id, 'a', 'sud', 1], 'extrémité orpheline');
    const avec = 'Salle de 6 par 6 cases, une porte au mur sud en B, une porte au mur est en 3.';
    m.definirTexte(d, a.id, avec, planDepuis(avec, a.id));
    verifier(m.liaisonsOrphelines(d).length === 0, 'rétablir la porte répare la liaison');
  }],

  ['historique : ancres restaurées, notes jamais touchées par un changement de texte', () => {
    const d = donjonDeTest();
    const a = premiere(d);
    a.notes = 'Le coffre est piégé.';
    m.creerSalleDerriere(d, { depuis: { salle: a.id, mur: 'sud', position: 1 } });
    const ancres = m.ancresDeSalle(d, a.id);
    d.liaisons[0].a = { salle: a.id, mur: 'nord', position: 4 };
    m.restaurerAncres(d, ancres);
    egal([d.liaisons[0].a.mur, d.liaisons[0].a.position], ['sud', 1], 'ancres rétablies');
    m.definirTexte(d, a.id, 'Salle de 3 par 3 cases.', planDepuis('Salle de 3 par 3 cases.', a.id));
    verifier(a.notes === 'Le coffre est piégé.', 'les notes ne sont jamais réécrites');
  }],

  ['éléments cachés : le plan, decrire, l’aller-retour et validerPlan', () => {
    const { plan } = analyser('salle de 6 par 6 cases, un coffre caché en A1, un coffre en B1, deux gobelins cachés, une porte secrète au mur nord en C');
    verifier(plan.objets.find((o) => o.x === 0).cache === true, 'coffre caché');
    verifier(plan.objets.find((o) => o.x === 1).cache === undefined, 'coffre visible : pas de champ cache');
    verifier(plan.creatures.length === 2 && plan.creatures.every((k) => k.cache === true), 'gobelins cachés');
    verifier(plan.portes[0].cache === true, 'porte secrète');
    const texte = decrire(plan);
    verifier(/un coffre caché en A1/.test(texte) && /un coffre en B1/.test(texte), `un caché et un visible ne sont pas regroupés : ${texte}`);
    verifier(/deux gobelins cachés/.test(texte) && /une porte secrète au mur nord/.test(texte), `texte inattendu : ${texte}`);
    const relu = analyser(texte).plan;
    egal(relu.objets.map((o) => !!o.cache).sort(), plan.objets.map((o) => !!o.cache).sort(), 'objets cachés après relecture');
    verifier(relu.portes[0].cache === true && relu.creatures.every((k) => k.cache === true), 'porte et pions cachés après relecture');
    const v = validerPlan(JSON.parse(JSON.stringify(plan)));
    verifier(v.plan.objets.filter((o) => o.cache).length === 1 && v.plan.portes[0].cache === true && v.plan.creatures.every((k) => k.cache), 'validerPlan conserve cache');
    const faux = validerPlan({ ...plan, objets: plan.objets.map((o) => ({ ...o, cache: 'oui' })) });
    verifier(faux.plan.objets.every((o) => !('cache' in o)), 'seul cache: true est conservé');
    // Toutes les graphies de l'adjectif.
    for (const mot of ['caché', 'cachée', 'cachés', 'cachées', 'secret', 'secrète', 'secrets', 'secrètes']) {
      const r = analyser(`salle de 6 par 6 cases, un coffre ${mot} en B2`);
      verifier(r.plan.objets[0].cache === true && !r.ignores.length, `« ${mot} » devrait cacher le coffre (ignorés : ${r.ignores})`);
    }
    // Basculer, via donjon.js.
    const bascule = m.basculerCache(plan, { genre: 'objet', type: 'coffre', x: 1, y: 0 });
    verifier(bascule.objets.find((o) => o.x === 1).cache === true && plan.objets.find((o) => o.x === 1).cache === undefined, 'basculer sans modifier l’original');
    const retour = m.basculerCache(bascule, { genre: 'objet', type: 'coffre', x: 1, y: 0 });
    verifier(!('cache' in retour.objets.find((o) => o.x === 1)), 'rebasculer retire le champ');
  }],

  ['migration : jdr-carte:v1 devient un donjon d’une salle, sans supprimer l’ancienne clé', () => {
    const ancien = JSON.stringify({ texte: 'Salle de 5 par 4 cases, une porte au mur est en 2.', plan: {}, reglages: { echelle: 2, taille: 70, grille: false } });
    const stock = fauxStock({ 'jdr-carte:v1': ancien });
    const etat = chargerTout({ texteInitial: 'Salle de 3 par 3 cases.', stock });
    verifier(etat.migre === true, 'migration signalée');
    const d = etat.donjons[etat.actif];
    verifier(Object.keys(d.salles).length === 1 && premiere(d).plan.largeur === 5 && premiere(d).plan.portes.length === 1, 'une salle issue du texte');
    egal(etat.reglages, { echelle: 2, taille: 70, grille: false }, 'réglages repris de l’ancienne clé');
    verifier(stock.donnees['jdr-carte:v1'] === ancien, 'l’ancienne clé est intacte');
    sauverDonjons(etat, stock);
    verifier(CLE_DONJONS in stock.donnees && !(CLE_REGLAGES in stock.donnees), 'les clés nouvelles sont écrites par la sauvegarde');
    const relu = chargerTout({ stock });
    verifier(relu.migre === false && relu.actif === etat.actif, 'au démarrage suivant : plus de migration, même donjon');
    // Les clés nouvelles priment sur l'ancienne.
    const autre = chargerTout({ stock: fauxStock({ 'jdr-carte:v1': ancien, [CLE_DONJONS]: stock.donnees[CLE_DONJONS] }) });
    verifier(autre.migre === false && autre.actif === etat.actif, 'les nouvelles clés priment');
    // Rien du tout : donjon neuf.
    const neuf = chargerTout({ texteInitial: 'Salle de 3 par 3 cases.', stock: fauxStock() });
    verifier(neuf.migre === false && premiere(neuf.donjons[neuf.actif]).plan.largeur === 3, 'donjon neuf');
    verifier(chargerDonjons(fauxStock({ [CLE_DONJONS]: '{pas du json' })) === null, 'JSON corrompu : traité comme absent');
  }],

  ['validation d’un import : refus propres', () => {
    const bon = JSON.parse(JSON.stringify(donjonDeTest()));
    verifier(m.validerDonjon(bon).ok, 'un donjon valide passe');
    const cas = [
      [null, 'objet JSON'], ['texte', 'objet JSON'], [[], 'objet JSON'],
      [{}, 'pas un donjon'], [{ ...bon, format: 'autre' }, 'pas un donjon'],
      [{ ...bon, version: 2 }, 'plus récente'], [{ ...bon, version: 0 }, 'version invalide'], [{ ...bon, version: '1' }, 'version invalide'],
      [{ ...bon, salles: null }, 'pas de salles'], [{ ...bon, salles: {} }, 'aucune salle'],
      [{ ...bon, salles: { x: { id: 'x', nom: 'X', plan: { largeur: 0, longueur: 3 } } } }, 'plan invalide'],
      [{ ...bon, salles: { 'a b': { plan: bon.salles[Object.keys(bon.salles)[0]].plan } } }, 'identifiant de salle invalide'],
      [{ ...bon, salles: { x: { id: 'y', plan: bon.salles[Object.keys(bon.salles)[0]].plan } } }, 'identifiant de salle invalide'],
      [{ ...bon, salles: { x: 42 } }, 'pas un objet'],
      [{ ...bon, salles: { x: { nom: 'sans plan ni texte' } } }, 'ni plan ni texte'],
    ];
    cas.forEach(([entree, attendu], i) => {
      const r = m.validerDonjon(entree);
      verifier(!r.ok && r.donjon === null && r.erreurs.join(' ').includes(attendu), `cas ${i + 1} : erreurs ${JSON.stringify(r.erreurs)} sans « ${attendu} »`);
    });
    // Liaisons invalides : écartées avec avertissement, le reste est importé.
    const s = Object.keys(bon.salles)[0];
    const sale = {
      ...bon,
      liaisons: [
        { id: 'l1', a: { salle: s, mur: 'sud', position: 1 }, b: { salle: 'inconnue', mur: 'nord', position: 0 } },
        { id: 'l2', a: { salle: s, mur: 'sud', position: 99 }, b: { salle: s, mur: 'est', position: 2 } },
        { id: 'l3', a: { salle: s, mur: 'sud', position: 1 }, b: { salle: s, mur: 'est', position: 2 } },
        'n’importe quoi',
      ],
    };
    const r = m.validerDonjon(sale);
    verifier(r.ok && r.donjon.liaisons.length === 0 && r.avertissements.length === 4, `liaisons invalides écartées : ${JSON.stringify(r.avertissements)}`);
    // Clés dangereuses, texte HTML : rien n'est interprété, tout est borné.
    const piege = JSON.parse(`{"format":"carte-de-mj-donjon","version":1,"nom":"<img src=x onerror=alert(1)>","salles":{"__proto__":{"nom":"${'N'.repeat(500)}","texte":"salle de 4 par 4 cases","notes":"<script>1</script>"}}}`);
    const rp = m.validerDonjon(piege);
    verifier(rp.ok && Object.keys(rp.donjon.salles).includes('__proto__') && ({}).nom === undefined, 'clé __proto__ sans effet sur les prototypes');
    verifier(rp.donjon.salles.__proto__.nom.length === 80, 'noms bornés à 80 caractères');
    verifier(rp.donjon.nom === '<img src=x onerror=alert(1)>', 'le nom reste du texte brut (l’interface utilise textContent)');
  }],

  ['import : nouveau format, ancien format, plan seul, version supérieure', () => {
    const d = donjonDeTest();
    m.creerSalleDerriere(d, { depuis: { salle: premiere(d).id, mur: 'sud', position: 1 } });
    const exporte = JSON.parse(JSON.stringify(d));
    const r = m.convertirImport(exporte);
    verifier(r.ok && r.donjon.id !== d.id, 'un nouvel identifiant de donjon est donné : jamais d’écrasement');
    verifier(Object.keys(r.donjon.salles).length === 2 && r.donjon.liaisons.length === 1, 'salles et liaisons conservées');
    egal(Object.keys(r.donjon.salles), Object.keys(d.salles), 'identifiants de salle conservés');

    const plan = analyser('salle de 4 par 4 cases, une porte au nord, un coffre caché').plan;
    const ancien = m.convertirImport({ format: 'jdr-carte', version: 1, salles: [plan], texte: 'salle de 4 par 4 cases, une porte au nord, un coffre caché', reglages: {} });
    verifier(ancien.ok && Object.keys(ancien.donjon.salles).length === 1, 'ancien format à une salle');
    verifier(premiere(ancien.donjon).plan.objets[0].cache === true && /caché/.test(premiere(ancien.donjon).texte), 'ancien format : texte et éléments cachés');
    const sansTexte = m.convertirImport({ format: 'jdr-carte', version: 1, salles: [plan] });
    verifier(sansTexte.ok && /Salle de 4 par 4 cases/.test(premiere(sansTexte.donjon).texte), 'ancien format sans texte : decrire(plan)');
    const seul = m.convertirImport(plan);
    verifier(seul.ok && premiere(seul.donjon).plan.largeur === 4, 'plan seul');

    for (const [entree, morceau] of [
      [{ format: 'jdr-carte', version: 2, salles: [plan] }, 'plus récente'],
      [{ format: 'jdr-carte', version: 1, salles: [] }, 'aucune salle'],
      [{ format: 'jdr-carte', version: 1, salles: [{ largeur: -1, longueur: 2 }] }, 'plan invalide'],
      [{ ...exporte, version: 3 }, 'plus récente'],
      [{ bonjour: 1 }, 'non reconnu'], [[1, 2]], [42], [null],
    ]) {
      const x = m.convertirImport(entree);
      verifier(!x.ok && x.donjon === null && (!morceau || x.erreurs.join(' ').includes(morceau)), `refus attendu (${morceau || 'objet JSON'}) : ${JSON.stringify(x.erreurs)}`);
    }
  }],
  ['estDebutant : vrai tant qu’aucun donjon n’a de liaison ni plus d’une salle', () => {
    const un = m.creerDonjon({ texte: 'Salle de 6 par 6' });
    egal(m.estDebutant({ [un.id]: un }), true, 'un donjon d’une salle');
    egal(m.estDebutant({}), true, 'aucun donjon');
    const deux = m.creerDonjon({ texte: 'Salle de 6 par 6' });
    m.ajouterSalle(deux);
    egal(m.estDebutant({ [un.id]: un, [deux.id]: deux }), false, 'un donjon de deux salles suffit');
    const relie = m.creerDonjon({ texte: 'Salle de 6 par 6, une porte au nord' });
    relie.liaisons = [{ id: 'l1', a: { salle: 'x', mur: 'nord', position: 1 }, b: { salle: 'y', mur: 'sud', position: 1 } }];
    egal(m.estDebutant({ [relie.id]: relie }), false, 'une liaison suffit');
  }],
];

/** Plan relu depuis un texte, avec l'identifiant de salle (comme le fait l'application). */
function planDepuis(texte, id) { return m.planDepuisTexte(texte, id); }

export const executer = () => executerSuite('donjon : ', TESTS);
