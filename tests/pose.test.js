/**
 * Tests de la pose et de la suppression d'éléments (js/pose.js, et leur usage dans donjon.js) :
 * règles de pose, porte sur le bon mur, pose refusée, numérotation, annulation d'une liaison, et surtout
 * l'aller-retour plan → decrire() → analyser() (le texte reste la référence : ce qu'on ajoute doit survivre à la relecture).
 * Sans dépendance : marche sous Node et dans tests.html.
 */
import * as m from '../js/donjon.js';
import { ajouterElement, elementsPalette, evaluerPose, filtrerElements, GROUPES_PALETTE, SOUS_GROUPES, redimensionner, sansAccents } from '../js/pose.js';
import { etatDepuis, outilAffiche } from '../js/rail.js';
import { analyser } from '../js/parseur/index.js';
import { decrire } from '../js/parseur/decrire.js';
import { OBJETS, CREATURES } from '../js/parseur/lexique.js';
import { verifier, egal, executerSuite } from './mini-test.js';

const BASE = 'Salle de 6 par 6 cases, une porte au mur sud en B, deux coffres en A1 C1, un gobelin en D4';
const planDe = (texte = BASE) => analyser(texte, { echelle: 1.5 }).plan;

/** Ce qui doit survivre au texte : mêmes éléments aux mêmes endroits (les identifiants sont régénérés à la relecture). */
function empreinte(plan) {
  // Les numéros sont ceux que donne le parseur : sans trou, par type, dans l'ordre du texte (donc de l'ancien numéro).
  const parType = {};
  const creatures = [...plan.creatures].sort((a, b) => a.type.localeCompare(b.type) || a.numero - b.numero)
    .map((k) => `${k.type} ${(parType[k.type] = (parType[k.type] || 0) + 1)} ${k.x},${k.y} ${k.taille}`);
  return JSON.stringify({
    portes: plan.portes.map((p) => `${p.type} ${p.mur} ${p.position}`).sort(),
    objets: plan.objets.map((o) => `${o.type} ${o.x},${o.y} ${o.l}x${o.h}`).sort(),
    creatures: creatures.sort(),
  });
}

/** Ajoute, passe par le texte, relit : renvoie le plan relu. Échoue si la relecture diffère du plan ajouté. */
function allerRetour(plan, quoi) {
  const texte = decrire(plan);
  const relu = analyser(texte, { echelle: 1.5 });
  verifier(relu.ignores.length === 0, `${quoi} : mots non compris à la relecture (${relu.ignores.join(', ')}) dans « ${texte} »`);
  egal(JSON.parse(empreinte(relu.plan)), JSON.parse(empreinte(plan)), `${quoi} : plan relu ≠ plan ajouté (« ${texte} »)`);
  return relu.plan;
}

const TESTS = [
  ['palette : portes, mobilier et créatures viennent du lexique, avec des libellés français', () => {
    const els = elementsPalette();
    egal(GROUPES_PALETTE.map((g) => g.id), ['portes', 'mobilier', 'creatures'], 'groupes');
    egal(els.filter((e) => e.groupe === 'portes').map((e) => e.type), ['porte', 'herse', 'arche'], 'types de portes');
    egal(els.filter((e) => e.groupe === 'mobilier').length, OBJETS.length, 'un élément par objet du lexique');
    egal(els.filter((e) => e.groupe === 'creatures').length, CREATURES.length, 'un élément par créature du lexique');
    verifier(els.find((e) => e.type === 'bibliotheque').libelle === 'Bibliothèque', 'accent du libellé');
    verifier(els.find((e) => e.type === 'pj').libelle === 'Personnage', 'libellé du personnage');
    verifier(els.every((e) => /^[A-ZÉ]/.test(e.libelle)), 'majuscule initiale');
  }],

  ['palette : recherche sans accents ni casse, sur le libellé et les mots du lexique', () => {
    const els = elementsPalette();
    const types = (q) => filtrerElements(els, q).map((e) => e.type);
    egal(sansAccents('  Élémentaire '), 'elementaire', 'sansAccents');
    egal(filtrerElements(els, ''), els, 'recherche vide : tout');
    egal(filtrerElements(els, '   '), els, 'espaces seuls : tout');
    verifier(types('ELEMENTAIRE').includes('elementaire') && types('élémentaire').includes('elementaire'), 'accents et casse');
    verifier(types('orc').includes('orque'), 'un mot du lexique trouve l’élément (« orc » → orque)');
    verifier(types('sorcier').includes('mage'), 'synonyme : « sorcier » → mage');
    verifier(types('bibli').includes('bibliotheque'), 'début de mot');
    verifier(types('passage').includes('arche'), 'synonyme de porte : « passage » → arche');
    egal(types('zzzz'), [], 'rien ne correspond');
    verifier(types('loup garou').includes('loup-garou'), 'plusieurs mots : tous correspondent');
    verifier(!types('loup garou').includes('rat'), 'plusieurs mots : « rat » ne répond pas à « loup garou »');
    const creatures = els.filter((e) => e.groupe === 'creatures');
    verifier(filtrerElements(creatures, 'squelette').every((e) => e.groupe === 'creatures'), 'la recherche respecte la liste donnée');
  }],

  ['palette : chaque créature a un camp qui figure dans les intertitres', () => {
    const camps = SOUS_GROUPES.creatures.map((g) => g.id);
    egal(camps, ['monstre', 'pnj', 'pj'], 'ordre des intertitres : monstres, peuples, personnage');
    verifier(elementsPalette().filter((e) => e.groupe === 'creatures').every((e) => camps.includes(e.sousGroupe)), 'camp connu');
  }],

  ['rail : l’état mémorisé se relit sans jamais échouer', () => {
    const valides = ['salle', 'portes', 'mobilier', 'creatures', 'notes', 'plan', 'reglages'];
    egal(etatDepuis(null, valides), { outil: 'salle', replie: false }, 'rien de mémorisé : Salle ouverte');
    egal(etatDepuis('pas du json', valides), { outil: 'salle', replie: false }, 'texte abîmé');
    egal(etatDepuis('{"outil":"inconnu","replie":true}', valides), { outil: 'salle', replie: true }, 'outil inconnu');
    egal(etatDepuis('{"outil":"creatures","replie":true}', valides), { outil: 'creatures', replie: true }, 'état valide');
    egal(etatDepuis('{"outil":"plan","replie":"oui"}', valides), { outil: 'plan', replie: false }, 'replie doit être vrai');
    egal(etatDepuis('null', valides), { outil: 'salle', replie: false }, 'null');
    egal(outilAffiche('portes', true), 'salle', 'téléphone : un outil de catalogue montre la Salle');
    egal(outilAffiche('notes', true), 'notes', 'téléphone : un outil de texte reste');
    egal(outilAffiche('portes', false), 'portes', 'ordinateur : inchangé');
  }],

  ['ajouter un objet : posé sur la case visée, sans toucher au plan reçu', () => {
    const plan = planDe();
    const copie = JSON.stringify(plan);
    const r = ajouterElement(plan, { genre: 'objet', type: 'tonneau' }, 4.5, 2.5); // milieu de la case E3
    verifier(!r.erreur, r.erreur);
    egal([r.element.x, r.element.y, r.element.l, r.element.h], [4, 2, 1, 1], 'case du tonneau');
    verifier(r.plan.objets.length === plan.objets.length + 1 && JSON.stringify(plan) === copie, 'le plan reçu est inchangé');
    verifier(new Set(r.plan.objets.map((o) => o.id)).size === r.plan.objets.length, 'identifiants uniques');
    verifier(r.message.includes('E3'), `message : ${r.message}`);
    allerRetour(r.plan, 'tonneau');
  }],

  ['ajouter un objet de 2 cases : centré sur le point visé', () => {
    const plan = planDe('Salle de 6 par 6 cases, une porte au mur sud en B');
    const r = ajouterElement(plan, { genre: 'objet', type: 'table' }, 3, 2.5); // table 2×1 : de B3 à C3 ... (x = 2)
    egal([r.element.x, r.element.y, r.element.l, r.element.h], [2, 2, 2, 1], 'table');
    allerRetour(r.plan, 'table');
    const lit = ajouterElement(plan, { genre: 'objet', type: 'lit' }, 0.5, 1); // lit 1×2 contre le bord ouest
    egal([lit.element.x, lit.element.y, lit.element.l, lit.element.h], [0, 0, 1, 2], 'lit');
    allerRetour(lit.plan, 'lit');
  }],

  ['ajouter une torche : tourne le dos au mur le plus proche, et la relecture la garde', () => {
    const plan = planDe('Salle de 6 par 6 cases, une porte au mur sud en B');
    const r = ajouterElement(plan, { genre: 'objet', type: 'torche' }, 0.5, 2.5);
    verifier(!r.erreur, r.erreur);
    egal([r.element.x, r.element.rotation], [0, 90], 'torche contre le mur ouest, regard vers l’est');
    const relu = allerRetour(r.plan, 'torche');
    egal(relu.objets.find((o) => o.type === 'torche').rotation, 90, 'rotation conservée');
  }],

  ['ajouter une créature : numéro à la suite, même si un pion a été retiré', () => {
    let plan = planDe('Salle de 6 par 6 cases, une porte au mur sud en B, trois gobelins en A1 B1 C1');
    egal(plan.creatures.map((k) => k.numero), [1, 2, 3], 'numéros de départ');
    // On retire le gobelin 2 : le suivant doit prendre le numéro 4, pas le 3 (déjà pris).
    plan = { ...plan, creatures: plan.creatures.filter((k) => k.numero !== 2) };
    const r = ajouterElement(plan, { genre: 'creature', type: 'gobelin' }, 4.5, 4.5);
    verifier(!r.erreur, r.erreur);
    egal([r.element.numero, r.element.camp, r.element.taille], [4, 'monstre', 1], 'numéro, camp et taille');
    // Autre type : sa propre numérotation.
    const e = ajouterElement(r.plan, { genre: 'creature', type: 'elfe' }, 0.5, 5.5);
    egal(e.element.numero, 1, 'premier elfe');
    const relu = allerRetour(e.plan, 'gobelin + elfe');
    // La relecture renumérote sans trou, dans l'ordre du texte : 3 gobelins (1, 2, 3).
    egal(relu.creatures.filter((k) => k.type === 'gobelin').map((k) => k.numero).sort(), [1, 2, 3], 'numérotation sans trou');
  }],

  ['ajouter un grand pion (dragon 3×3) : calé sur le point visé et relu à l’identique', () => {
    const plan = planDe('Salle de 8 par 8 cases, une porte au mur sud en B');
    const r = ajouterElement(plan, { genre: 'creature', type: 'dragon' }, 4, 3.5);
    verifier(!r.erreur, r.erreur);
    egal([r.element.taille, r.element.x, r.element.y], [3, 3, 2], 'dragon');
    allerRetour(r.plan, 'dragon');
  }],

  ['pose refusée : hors de la salle, sans modifier le plan', () => {
    const plan = planDe();
    for (const [cx, cy] of [[-0.5, 2.5], [6.4, 2.5], [2.5, -0.4], [2.5, 6.7]]) {
      const r = ajouterElement(plan, { genre: 'objet', type: 'pilier' }, cx, cy);
      verifier(r.erreur && r.erreur.includes('hors de la salle') && !r.plan, `(${cx}, ${cy}) devrait être refusé : ${JSON.stringify(r)}`);
    }
    const g = ajouterElement(plan, { genre: 'creature', type: 'orque' }, 9, 9);
    verifier(g.erreur?.includes('hors de la salle'), 'un pion hors de la salle est refusé');
    // Un dragon (3×3) visé trop près du bord ne tient pas.
    const d = ajouterElement(plan, { genre: 'creature', type: 'dragon' }, 0.5, 0.5);
    verifier(d.erreur?.includes('hors de la salle'), 'un grand pion qui déborde est refusé');
  }],

  ['pose refusée : case gênée par un objet ou un pion', () => {
    const plan = planDe();
    const coffre = plan.objets.find((o) => o.type === 'coffre');
    const surCoffre = ajouterElement(plan, { genre: 'objet', type: 'tonneau' }, coffre.x + 0.5, coffre.y + 0.5);
    verifier(surCoffre.erreur?.includes('déjà prise'), `objet sur objet : ${JSON.stringify(surCoffre.erreur)}`);
    const gob = plan.creatures[0];
    const surPion = ajouterElement(plan, { genre: 'objet', type: 'tonneau' }, gob.x + 0.5, gob.y + 0.5);
    verifier(surPion.erreur?.includes('déjà prise'), 'objet sur pion refusé');
    const pionSurPion = ajouterElement(plan, { genre: 'creature', type: 'orque' }, gob.x + 0.5, gob.y + 0.5);
    verifier(pionSurPion.erreur?.includes('déjà prise'), 'pion sur pion refusé');
    // Mais, comme au déplacement, un pion peut monter sur un objet.
    const pionSurCoffre = ajouterElement(plan, { genre: 'creature', type: 'orque' }, coffre.x + 0.5, coffre.y + 0.5);
    verifier(!pionSurCoffre.erreur, 'un pion peut se poser sur un coffre');
  }],

  ['règle de pose commune : le déplacement et l’ajout donnent le même verdict', () => {
    const plan = planDe();
    const coffre = plan.objets[0], gob = plan.creatures[0];
    // Déplacer le coffre sur son propre emplacement : il ne se gêne pas lui-même.
    verifier(evaluerPose(plan, 'objet', coffre, coffre.x, coffre.y, coffre).ok, 'un objet ne se gêne pas lui-même');
    verifier(!evaluerPose(plan, 'objet', coffre, coffre.x, coffre.y).ok, 'mais le même emplacement gêne un nouvel objet');
    egal(evaluerPose(plan, 'creature', gob, -1, 0, gob).raison, 'hors', 'raison hors');
    egal(evaluerPose(plan, 'objet', coffre, gob.x, gob.y, coffre).raison, 'gene', 'raison gêne');
  }],

  ['ajouter une porte : sur le mur le plus proche du point visé', () => {
    const plan = planDe();
    const cas = [
      [2.5, 0.2, 'nord', 2], [1.5, 5.8, 'sud', 1 + 0], [0.2, 3.5, 'ouest', 3], [5.9, 1.2, 'est', 1],
      [0.4, 0.3, 'nord', 0], // dans le coin, le plus proche des deux murs gagne
      [3.5, -0.5, 'nord', 3], // un clic sur la roche, à côté du mur
    ];
    for (const [cx, cy, mur, position] of cas) {
      const r = ajouterElement(plan, { genre: 'porte', type: 'porte' }, cx, cy);
      if (cx === 1.5 && cy === 5.8) { verifier(r.erreur?.includes('déjà une porte'), 'la case B du mur sud est prise'); continue; }
      verifier(!r.erreur, `(${cx}, ${cy}) : ${r.erreur}`);
      egal([r.element.mur, r.element.position], [mur, position], `porte visée en (${cx}, ${cy})`);
      allerRetour(r.plan, `porte ${mur}`);
    }
    const herse = ajouterElement(plan, { genre: 'porte', type: 'herse' }, 4.5, 0.1);
    egal([herse.element.type, herse.element.mur, herse.element.position], ['herse', 'nord', 4], 'herse');
    const relu = allerRetour(herse.plan, 'herse');
    verifier(relu.portes.some((p) => p.type === 'herse' && p.mur === 'nord' && p.position === 4), 'la herse survit à la relecture');
  }],

  ['porte refusée : mur déjà pris ou point trop loin de la salle', () => {
    const plan = planDe();
    verifier(ajouterElement(plan, { genre: 'porte', type: 'porte' }, 1.5, 5.9).erreur?.includes('déjà une porte'), 'porte sur porte');
    verifier(ajouterElement(plan, { genre: 'porte', type: 'porte' }, 3, 9).erreur?.includes('bord de la salle'), 'trop loin sous la salle');
    verifier(ajouterElement(plan, { genre: 'porte', type: 'porte' }, -3, 2).erreur?.includes('bord de la salle'), 'trop loin à gauche');
    verifier(ajouterElement(plan, { genre: 'porte', type: 'plafond' }, 3, 0).erreur, 'type de porte inconnu');
  }],

  ['porte dans une salle sans porte : devient la porte d’entrée, les objets existants restent', () => {
    const plan = planDe('Salle de 6 par 6 cases, deux coffres en A1 C1, un gobelin en D4');
    const r = ajouterElement(plan, { genre: 'porte', type: 'porte' }, 2.5, 0.1);
    egal([r.element.mur, r.element.position], ['nord', 2], 'porte au nord');
    allerRetour(r.plan, 'première porte au nord');
    // Un objet ajouté ensuite garde l'orientation attendue par decrire() (regard vers l'entrée) : pas de « tourné vers ».
    const o = ajouterElement(r.plan, { genre: 'objet', type: 'statue' }, 4.5, 1.5);
    verifier(!o.erreur, o.erreur);
    verifier(!/tourn/.test(decrire(o.plan).split('statue')[1] || ''), 'pas de « tourné vers » inutile');
    allerRetour(o.plan, 'statue');
  }],

  ['tout ce que propose la palette survit à l’aller-retour (un exemplaire de chaque, salle 20 × 20)', () => {
    let plan = planDe('Salle de 20 par 20 cases, une porte au mur sud en B');
    let n = 0;
    for (const item of elementsPalette().filter((e) => e.genre !== 'porte')) {
      // Chaque élément sur sa propre case, en quinconce : 2 rangées de 8 par ligne, hors du chemin de la porte.
      const cx = 2 + (n % 6) * 3 + 1.5, cy = 2 + Math.floor(n / 6) * 3 + 1.5;
      n++;
      if (cy + 2 > 20) break;
      const r = ajouterElement(plan, item, cx, cy);
      verifier(!r.erreur, `${item.type} : ${r.erreur}`);
      plan = r.plan;
    }
    verifier(n > 20, `au moins vingt éléments posés (${n})`);
    allerRetour(plan, 'palette entière');
  }],

  ['supprimer : objet, pion et porte libre, puis aller-retour', () => {
    const d = m.creerDonjon({ texte: BASE });
    const s = d.salles[d.salleActive];
    const coffre = m.descripteur('objet', s.plan.objets[0]);
    const r = m.supprimerElement(d, s.id, coffre);
    verifier(r.plan.objets.length === s.plan.objets.length - 1 && r.liaisonsRetirees.length === 0, 'un coffre de moins');
    verifier(s.plan.objets.length === 2, 'le plan de la salle n’est pas modifié par supprimerElement');
    allerRetour(r.plan, 'sans coffre');
    const gob = m.descripteur('creature', s.plan.creatures[0]);
    const r2 = m.supprimerElement(d, s.id, gob);
    egal(r2.plan.creatures.length, 0, 'plus de gobelin');
    allerRetour(r2.plan, 'sans gobelin');
    const porte = m.descripteur('porte', s.plan.portes[0]);
    const r3 = m.supprimerElement(d, s.id, porte);
    egal(r3.plan.portes.length, 0, 'plus de porte');
    allerRetour(r3.plan, 'sans porte');
    verifier(m.supprimerElement(d, s.id, { genre: 'objet', type: 'coffre', x: 5, y: 5 }) === null, 'élément inconnu : null');
  }],

  ['supprimer une porte reliée : la liaison est retirée d’abord, et rétablie si on annule', () => {
    const d = m.creerDonjon({ texte: 'Salle de 6 par 6 cases, une porte au mur sud en B' });
    const s = d.salles[d.salleActive];
    const { salle: autre } = m.creerSalleDerriere(d, { depuis: { salle: s.id, mur: 'sud', position: 1 } });
    egal(d.liaisons.length, 1, 'une liaison');
    const desc = m.descripteur('porte', s.plan.portes[0]);
    const r = m.supprimerElement(d, s.id, desc);
    egal(d.liaisons.length, 0, 'liaison retirée');
    egal(r.liaisonsRetirees.length, 1, 'liaison renvoyée');
    // Nulle part de liaison orpheline : la porte de retour de l'autre salle redevient une porte ordinaire.
    egal(m.liaisonsOrphelines(d).length, 0, 'aucune liaison orpheline');
    verifier(autre.plan.portes.length === 1, 'la porte de la salle d’en face existe toujours');
    // Annulation : la porte revient avec le texte d'avant, la liaison avec elle.
    m.retablirLiaisons(d, r.liaisonsRetirees);
    egal(d.liaisons.length, 1, 'liaison rétablie');
    m.retablirLiaisons(d, r.liaisonsRetirees);
    egal(d.liaisons.length, 1, 'rétablir deux fois ne duplique pas');
    egal(m.liaisonsOrphelines(d).length, 0, 'et la porte existe encore : pas d’orpheline');
  }],
  ['dimensions : agrandir à l’est ou au sud ne déplace rien', () => {
    const p = planDe();
    const r = redimensionner(p, 'est', 2);
    egal([r.plan.largeur, r.plan.longueur], [8, 6], 'dimensions');
    egal(r.plan.objets.map((o) => [o.x, o.y]), p.objets.map((o) => [o.x, o.y]), 'objets immobiles');
    egal(r.plan.portes[0].position, p.portes[0].position, 'porte immobile');
    egal(empreinte(analyser(decrire(r.plan), { echelle: 1.5 }).plan), empreinte(r.plan), 'aller-retour');
  }],
  ['dimensions : agrandir à l’ouest ou au nord décale tout, porte comprise', () => {
    const p = planDe();
    const o = redimensionner(p, 'ouest', 1).plan;
    egal(o.objets[0].x, p.objets[0].x + 1, 'objet décalé vers l’est');
    egal(o.portes[0].position, p.portes[0].position + 1, 'porte du mur sud décalée');
    const n = redimensionner(p, 'nord', 2).plan;
    egal(n.creatures[0].y, p.creatures[0].y + 2, 'pion décalé vers le sud');
    egal(n.portes[0].position, p.portes[0].position, 'porte du mur sud : même position le long du mur');
    egal(empreinte(analyser(decrire(n), { echelle: 1.5 }).plan), empreinte(n), 'aller-retour');
  }],
  ['dimensions : réduire est refusé si un élément ou une porte sortirait', () => {
    const p = planDe();
    verifier(redimensionner(p, 'nord', -1).erreur, 'coffres en rangée 1');
    verifier(redimensionner(p, 'ouest', -1).erreur, 'coffre en colonne A');
    verifier(!redimensionner(p, 'sud', -1).erreur, 'la rangée 6 est libre');
    verifier(redimensionner(planDe('Salle de 6 par 6 cases, une porte au mur est en 6'), 'sud', -1).erreur, 'porte du mur est');
    verifier(redimensionner(p, 'est', 60).erreur, 'plafond de 60 cases');
    verifier(redimensionner(planDe('Salle de 1 par 1 cases'), 'est', -1).erreur, 'au moins une case');
  }],
  ['dimensions : une liaison suit sa porte décalée', () => {
    const d = m.creerDonjon({ texte: 'Salle de 6 par 6 cases, une porte au mur sud en B' });
    const s = Object.values(d.salles)[0];
    const porte = s.plan.portes[0];
    m.creerSalleDerriere(d, { depuis: { salle: s.id, mur: porte.mur, position: porte.position }, echelle: 1.5 });
    const n = redimensionner(s.plan, 'ouest', 1).plan;
    m.suivrePortesDeplacees(d, s.id, s.plan, n);
    s.plan = n;
    egal(m.liaisonsOrphelines(d).length, 0, 'pas de liaison orpheline');
    egal(m.liaisonDePorte(d, s.id, n.portes[0]) !== null, true, 'la liaison retrouve la porte');
  }],
];

export const executer = () => executerSuite('pose : ', TESTS);
