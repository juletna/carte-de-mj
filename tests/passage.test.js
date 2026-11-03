/**
 * Tests du passage d'une porte (js/passage.js, par la façade presentation.js) : le groupe suit et se place près de la porte d'arrivée,
 * la salle retrouvée, la pose des pions, et la salle créée derrière une porte non reliée.
 * Sans dépendance : marche sous Node et dans tests.html.
 * Chaque test lève une Error au premier écart ; executer() renvoie la même forme que les autres.
 */
import * as m from '../js/donjon.js';
import * as p from '../js/presentation.js';
import { decrire } from '../js/parseur/decrire.js';
import { validerPlan } from '../js/schema.js';
import { chargerPresentations, sauverPresentations } from '../js/stockage.js';
import { donjonDeTest } from './aides-partie.js';
import { verifier, egal, fauxStock, executerSuite } from './mini-test.js';

const chevauche = (k, l) => k.x < l.x + (l.taille || 1) && l.x < k.x + (k.taille || 1) && k.y < l.y + (l.taille || 1) && l.y < k.y + (k.taille || 1);
function aucunePosition(plan) {
  for (const k of plan.creatures) {
    verifier(k.x >= 0 && k.y >= 0 && k.x + k.taille <= plan.largeur && k.y + k.taille <= plan.longueur, `le pion ${k.id} sort de la pièce`);
  }
  for (let i = 0; i < plan.creatures.length; i++) for (let j = i + 1; j < plan.creatures.length; j++) {
    verifier(!chevauche(plan.creatures[i], plan.creatures[j]), `les pions ${plan.creatures[i].id} et ${plan.creatures[j].id} se superposent`);
  }
}

/** Salle de départ avec deux pions pj et une porte à l'est, à relier à la salle d'essai. */
function salleDeDepart(d) {
  return m.ajouterSalle(d, { nom: 'Départ', texte: 'Salle de 6 par 6 cases, une porte au mur est en 3, deux personnages en A1 B1.' });
}

/** Salle de `l` × `h` cases remplie d'objets (pas de pion), avec une porte. */
function salleDePiliers(d, l, h, nom = 'Pleine') {
  const plan = {
    version: 1, nom, forme: 'rectangle', largeur: l, longueur: h, sol: 'pierre', entree: 'sud', connexions: [],
    portes: [{ id: 'p1', mur: 'nord', position: 0, type: 'porte' }],
    objets: Array.from({ length: l * h }, (_, i) => ({ id: `o${i + 1}`, type: 'pilier', x: i % l, y: Math.floor(i / l), l: 1, h: 1, rotation: 0 })),
    creatures: [],
  };
  return m.ajouterSalle(d, { nom, plan });
}

const TESTS = [
  ['porte : le groupe suit, placé près de la porte d’arrivée sans superposition', () => {
    const { d, a, b } = donjonDeTest();
    // Une créature déjà dans B, tout près de la porte d’arrivée (ouest, position 3).
    b.plan.creatures.push({ id: 'c1', type: 'gobelin', camp: 'monstre', x: 0, y: 2, taille: 1, numero: 1 });
    const pres = p.creerPresentation(d);
    const porte = pres.donjon.salles[a.id].plan.portes.find((q) => q.mur === 'est');
    const r = p.passerPorte(pres, a.id, porte.id);
    egal([r.ok, r.vers, r.deplaces, r.restes], [true, b.id, 2, 0], 'passage réussi, deux pions déplacés');
    egal([pres.salleCourante, pres.decouvertes], [b.id, [a.id, b.id]], 'la salle d’arrivée est courante et découverte');
    const planB = pres.donjon.salles[b.id].plan;
    const pj = planB.creatures.filter((k) => k.camp === 'pj');
    verifier(pj.length === 2 && planB.creatures.length === 3, 'deux pions pj arrivés, le gobelin est resté');
    aucunePosition(planB);
    verifier(pj.every((k) => k.x <= 1 && Math.abs(k.y - 2) <= 1), `les pions sont près de la porte ouest : ${JSON.stringify(pj.map((k) => [k.x, k.y]))}`);
    verifier(new Set(planB.creatures.map((k) => k.id)).size === 3, 'identifiants de pions uniques dans la salle d’arrivée');
    egal(pres.donjon.salles[a.id].plan.creatures.map((k) => k.camp), ['monstre'], 'seul le gobelin reste dans la première salle');
    egal(pres.donjon.salles[b.id].texte, b.texte, 'le texte de la salle d’arrivée n’est pas réécrit');
  }],

  ['porte : sans « le groupe suit », porte non reliée, porte inconnue', () => {
    const { d, a, b } = donjonDeTest();
    const pres = p.creerPresentation(d);
    const est = pres.donjon.salles[a.id].plan.portes.find((q) => q.mur === 'est');
    const r = p.passerPorte(pres, a.id, est.id, { groupe: false });
    egal([r.ok, r.deplaces], [true, 0], 'passage seul');
    verifier(pres.donjon.salles[a.id].plan.creatures.filter((k) => k.camp === 'pj').length === 2, 'les pions n’ont pas bougé');
    // La porte cachée de A n’est reliée à rien : message simple, rien ne change.
    const nord = pres.donjon.salles[a.id].plan.portes.find((q) => q.mur === 'nord');
    p.afficherATable(pres, a.id);
    const avant = JSON.stringify(pres);
    const r2 = p.passerPorte(pres, a.id, nord.id);
    verifier(r2.ok === false && /ne mène nulle part/.test(r2.message), 'porte non reliée : message');
    egal(JSON.stringify(pres), avant, 'rien n’a changé');
    verifier(p.passerPorte(pres, a.id, 'zzz').ok === false && p.passerPorte(pres, 'zzz', 'p1').ok === false, 'porte ou salle inconnue : refus sans exception');
    verifier(b.id in pres.donjon.salles, 'salle intacte');
  }],

  ['porte : aller-retour A → B → C → B → A, le groupe suit à chaque fois', () => {
    const { d, a, b, c } = donjonDeTest();
    const pres = p.creerPresentation(d);
    // Aller-retour A → B → C → B → A : les pions suivent à chaque fois, jamais de superposition.
    const porte = (id, mur) => pres.donjon.salles[id].plan.portes.find((q) => q.mur === mur).id;
    for (const [de, mur, vers] of [[a.id, 'est', b.id], [b.id, 'sud', c.id], [c.id, 'nord', b.id], [b.id, 'ouest', a.id]]) {
      const r = p.passerPorte(pres, de, porte(de, mur));
      egal([r.ok, r.vers, r.restes], [true, vers, 0], `de ${de} vers ${vers}`);
      aucunePosition(pres.donjon.salles[vers].plan);
      verifier(pres.donjon.salles[vers].plan.creatures.filter((k) => k.camp === 'pj').length === 2, 'les deux pions sont arrivés');
    }
    egal(pres.decouvertes, [a.id, b.id, c.id], 'trois salles découvertes, sans doublon');
  }],

  ['placement : salle pleine d’objets, pions sur les objets mais jamais l’un sur l’autre', () => {
    const { d } = donjonDeTest();
    const a = salleDeDepart(d);
    const pleine = salleDePiliers(d, 3, 3);
    m.relier(d, { salle: a.id, mur: 'est', position: 2 }, { salle: pleine.id, mur: 'nord', position: 0 });
    const pres = p.creerPresentation(d);
    const r = p.passerPorte(pres, a.id, pres.donjon.salles[a.id].plan.portes.find((q) => q.mur === 'est').id);
    egal([r.ok, r.deplaces, r.restes], [true, 2, 0], 'les deux pions trouvent une case');
    const plan = pres.donjon.salles[pleine.id].plan;
    aucunePosition(plan);
    verifier(plan.creatures.length === 2, 'deux pions dans la salle pleine');
    const n = p.placerPions(plan, [{ taille: 1, id: 'x1' }, { taille: 1, id: 'x2' }, { taille: 1, id: 'x3' }], { mur: 'nord', position: 0 });
    egal([n.places.length, n.restes.length], [3, 0], 'trois pions de plus tiennent encore (9 cases, 2 occupées)');
  }],

  ['placement : plus de place pour un pion, il reste où il est ; pion large', () => {
    const { d } = donjonDeTest();
    const a = salleDeDepart(d);
    const petite = m.ajouterSalle(d, { nom: 'Placard', plan: {
      version: 1, nom: 'Placard', forme: 'rectangle', largeur: 2, longueur: 2, sol: 'pierre', entree: 'sud', connexions: [],
      portes: [{ id: 'p1', mur: 'nord', position: 0, type: 'porte' }], objets: [],
      creatures: [{ id: 'c1', type: 'gobelin', camp: 'monstre', x: 0, y: 0, taille: 1, numero: 1 }, { id: 'c2', type: 'gobelin', camp: 'monstre', x: 1, y: 0, taille: 1, numero: 2 }, { id: 'c3', type: 'gobelin', camp: 'monstre', x: 0, y: 1, taille: 1, numero: 3 }],
    } });
    m.relier(d, { salle: a.id, mur: 'est', position: 2 }, { salle: petite.id, mur: 'nord', position: 0 });
    const pres = p.creerPresentation(d);
    const r = p.passerPorte(pres, a.id, pres.donjon.salles[a.id].plan.portes.find((q) => q.mur === 'est').id);
    egal([r.ok, r.deplaces, r.restes], [true, 1, 1], 'un pion entre, l’autre reste faute de place');
    aucunePosition(pres.donjon.salles[petite.id].plan);
    verifier(pres.donjon.salles[a.id].plan.creatures.filter((k) => k.camp === 'pj').length === 1, 'le pion sans place est resté dans la salle d’origine');
    // Un pion de 3 cases passe devant les petits, au plus près de la porte, et reste dans la pièce.
    const vide = { largeur: 8, longueur: 8, objets: [], creatures: [] };
    const g = p.placerPions(vide, [{ taille: 1, id: 'a' }, { taille: 3, id: 'g' }], { mur: 'sud', position: 4 });
    const grand = g.places.find((x) => x.pion.id === 'g'), petit = g.places.find((x) => x.pion.id === 'a');
    verifier(grand.y + 3 === 8 && grand.x >= 2 && grand.x <= 4, `le grand pion touche la porte sud : ${JSON.stringify(grand)}`);
    verifier(!chevauche({ ...petit, taille: 1 }, { x: grand.x, y: grand.y, taille: 3 }), 'pas de superposition');
  }],

  ['salle retrouvée : pions déplacés et révélations restent en revenant', () => {
    const { d, a, b } = donjonDeTest();
    const pres = p.creerPresentation(d);
    const planA = pres.donjon.salles[a.id].plan;
    const gob = planA.creatures.find((k) => k.type === 'gobelin');
    p.appliquerDeplacement(pres, a.id, { ...planA, creatures: planA.creatures.map((k) => (k === gob ? { ...k, x: 0, y: 0 } : k)) });
    verifier(p.revelerElement(pres, a.id, 'o1'), 'coffre révélé');
    const vuAvant = JSON.stringify(p.vueTable(pres));
    p.passerPorte(pres, a.id, planA.portes.find((q) => q.mur === 'est').id, { groupe: false });
    verifier(JSON.stringify(p.vueTable(pres)) !== vuAvant, 'la table montre l’autre salle');
    p.afficherATable(pres, a.id);
    egal(JSON.stringify(p.vueTable(pres)), vuAvant, 'revenue dans la salle : exactement le même état');
    const g2 = pres.donjon.salles[a.id].plan.creatures.find((k) => k.type === 'gobelin');
    egal([g2.x, g2.y, b.id in pres.donjon.salles], [0, 0, true], 'pion à sa nouvelle place');
  }],

  ['D1 créer une salle derrière une porte non reliée : reliée, découverte, courante, le groupe suit', () => {
    const { d } = donjonDeTest();
    const depart = salleDeDepart(d);
    d.salleActive = depart.id;
    const avant = JSON.stringify(d);
    const pres = p.creerPresentation(d, { salleDepart: depart.id });
    const porte = pres.donjon.salles[depart.id].plan.portes[0];
    const idsAvant = pres.donjon.salles[depart.id].plan.portes.map((q) => q.id);
    const nbSalles = Object.keys(pres.donjon.salles).length;
    const nbLiaisons = pres.donjon.liaisons.length;
    verifier(!p.destinationPorte(pres, depart.id, porte.id), 'la porte n’est pas reliée');
    const creee = p.creerSalleApresPorte(pres, depart.id, porte.id, '');
    verifier(creee.ok, creee.message);
    egal(pres.donjon.salles[creee.salle.id].texte, decrire(pres.donjon.salles[creee.salle.id].plan), 'texte de la salle créée = decrire(plan)');
    const res = { ...p.passerPorte(pres, depart.id, porte.id, { groupe: true }), salle: creee.salle };
    verifier(res.ok, res.message);
    egal(Object.keys(pres.donjon.salles).length, nbSalles + 1, 'une salle de plus');
    egal(pres.donjon.liaisons.length, nbLiaisons + 1, 'une liaison de plus');
    egal(res.vers, res.salle.id, 'on y est passé');
    egal([pres.salleCourante, p.estDecouverte(pres, res.salle.id)], [res.salle.id, true], 'courante et découverte');
    const dest = p.destinationPorte(pres, depart.id, porte.id);
    verifier(dest && dest.salle.id === res.salle.id, 'la porte d’origine mène à la nouvelle salle');
    egal(dest.arrivee.mur, 'ouest', 'porte de retour sur le mur opposé');
    const retour = pres.donjon.salles[res.salle.id].plan.portes.find((q) => q.mur === 'ouest');
    verifier(retour, 'porte de retour dessinée');
    egal(p.destinationPorte(pres, res.salle.id, retour.id).salle.id, depart.id, 'et elle ramène au départ');
    egal(pres.donjon.salles[depart.id].plan.portes.map((q) => q.id), idsAvant, 'les identifiants de portes de la salle d’origine sont inchangés');
    // Le groupe a suivi, sans superposition ni sortie de la pièce.
    const ici = pres.donjon.salles[res.salle.id].plan;
    egal([res.deplaces, ici.creatures.filter((k) => k.camp === 'pj').length], [2, 2], 'les deux pj ont suivi');
    egal(pres.donjon.salles[depart.id].plan.creatures.filter((k) => k.camp === 'pj').length, 0, 'et ont quitté la salle d’origine');
    aucunePosition(ici);
    egal(JSON.stringify(d), avant, 'le donjon préparé n’est pas modifié');
    // Une porte reliée ne peut pas recevoir une seconde salle.
    verifier(!p.creerSalleEtPasser(pres, depart.id, porte.id, '').ok, 'porte déjà reliée : refusé');
    egal(Object.keys(pres.donjon.salles).length, nbSalles + 1, 'aucune salle de plus après le refus');
  }],

  ['D1 sans « le groupe suit » : les pions restent ; porte inconnue refusée', () => {
    const { d } = donjonDeTest();
    const depart = salleDeDepart(d);
    const pres = p.creerPresentation(d, { salleDepart: depart.id });
    const porte = pres.donjon.salles[depart.id].plan.portes[0];
    const res = p.creerSalleEtPasser(pres, depart.id, porte.id, '', { groupe: false });
    verifier(res.ok, res.message);
    egal([pres.donjon.salles[depart.id].plan.creatures.length, pres.donjon.salles[res.salle.id].plan.creatures.length], [2, 0], 'les pions restent');
    verifier(!p.creerSalleEtPasser(pres, depart.id, 'p99', '').ok && !p.creerSalleEtPasser(pres, 'x', 'p1', '').ok, 'porte ou salle inconnue refusée');
  }],

  ['D1 avec une description : lue par le parseur, reliée à la porte, éléments cachés invisibles à la table', () => {
    const { d } = donjonDeTest();
    const depart = salleDeDepart(d);
    const pres = p.creerPresentation(d, { salleDepart: depart.id });
    const porte = pres.donjon.salles[depart.id].plan.portes[0]; // mur est, position 2
    const res = p.creerSalleEtPasser(pres, depart.id, porte.id, 'Salle du trône de 8 par 6 cases, quatre piliers, un autel au fond, un coffre caché en B2, deux gobelins en E3 F3', { groupe: true });
    verifier(res.ok, res.message);
    const salle = pres.donjon.salles[res.salle.id];
    egal([salle.plan.largeur, salle.plan.longueur], [8, 6], 'dimensions lues');
    egal(salle.nom, 'Salle du trône', 'le nom de la description sert de nom');
    egal(salle.plan.objets.filter((o) => o.type === 'pilier').length, 4, 'quatre piliers');
    egal(salle.plan.creatures.filter((k) => k.type === 'gobelin').length, 2, 'deux gobelins');
    const retour = salle.plan.portes.find((q) => q.mur === 'ouest');
    verifier(retour && !retour.cache, 'porte de retour visible sur le mur opposé');
    egal(salle.plan.entree, 'ouest', 'les joueurs entrent par la porte de retour');
    verifier(p.destinationPorte(pres, depart.id, porte.id).salle.id === salle.id, 'reliée à la porte cliquée');
    aucunePosition(salle.plan);
    const vue = p.vueTable(pres);
    verifier(!vue.objets.some((o) => o.type === 'coffre'), 'le coffre caché de la description est invisible à la table');
    const plusieurs = p.creerSalleApresPorte(pres, res.salle.id, retour.id, 'une salle');
    verifier(!plusieurs.ok, 'la porte de retour est déjà reliée : on ne crée pas une autre salle');
    // Mots non compris : signalés, pas devinés.
    const p2 = p.creerPresentation(donjonDeTest().d);
    const sal = Object.values(p2.donjon.salles)[0];
    const porteLibre = sal.plan.portes.find((q) => q.cache) || sal.plan.portes[0];
    const r2 = p.creerSalleApresPorte(p2, sal.id, porteLibre.id, 'petite pièce avec un machin');
    verifier(r2.ok && r2.ignores.includes('machin'), 'mot non compris signalé');
  }],

  ['D1 : « au fond » se lit depuis la porte de retour, quel que soit le mur franchi', () => {
    for (const [murFranchi, fondCoffre] of [['sud', (o) => o.y >= 3], ['nord', (o) => o.y < 3], ['ouest', (o) => o.x < 3], ['est', (o) => o.x >= 3]]) {
      const pres = p.creerPresentation(m.creerDonjon({ texte: `Salle de 6 par 6 cases, une porte au mur ${murFranchi} en 3` }));
      const depart = Object.values(pres.donjon.salles)[0];
      const res = p.creerSalleApresPorte(pres, depart.id, depart.plan.portes[0].id, 'Salle de 6 par 6 cases, un coffre au fond');
      verifier(res.ok, `création derrière le mur ${murFranchi}`);
      const coffre = res.salle.plan.objets.find((o) => o.type === 'coffre');
      verifier(coffre && fondCoffre(coffre), `coffre loin de la porte de retour (mur ${murFranchi} franchi) : ${coffre?.x},${coffre?.y}`);
    }
  }],

  ['D1 : description sans porte sur le mur opposé → porte ajoutée à la même position ; mur opposé avec porte secrète → porte visible en plus', () => {
    const { d } = donjonDeTest();
    const depart = salleDeDepart(d);
    const pres = p.creerPresentation(d, { salleDepart: depart.id });
    const porte = pres.donjon.salles[depart.id].plan.portes[0]; // est, position 2
    const r1 = p.creerSalleApresPorte(pres, depart.id, porte.id, 'Salle de 6 par 6 cases, une porte secrète au mur ouest en A, un coffre en C3');
    verifier(r1.ok, r1.message);
    const plan = pres.donjon.salles[r1.salle.id].plan;
    const ouest = plan.portes.filter((q) => q.mur === 'ouest');
    egal(ouest.length, 2, 'la porte secrète du texte est gardée, une porte visible est ajoutée');
    const lien = m.liaisonDePorte(pres.donjon, depart.id, porte);
    const visible = ouest.find((q) => !q.cache);
    egal([lien.autre.salle, lien.autre.position], [r1.salle.id, visible.position], 'la liaison désigne la porte visible (salle + mur + position)');
    verifier(plan.portes.every((q, i, l) => l.findIndex((o) => o.id === q.id) === i), 'identifiants de portes uniques');
  }],

  ['D1 : la partie se recharge avec la salle créée et sa liaison', () => {
    const { d } = donjonDeTest();
    const depart = salleDeDepart(d);
    const pres = p.creerPresentation(d, { salleDepart: depart.id });
    const porte = pres.donjon.salles[depart.id].plan.portes[0];
    const res = p.creerSalleEtPasser(pres, depart.id, porte.id, 'Salle de 5 par 5 cases, trois piliers, un gobelin caché');
    verifier(res.ok, res.message);
    const stock = fauxStock();
    sauverPresentations({ [d.id]: pres }, stock);
    const relu = chargerPresentations(stock)[d.id];
    verifier(relu, 'la partie se recharge');
    egal([relu.salleCourante, Object.keys(relu.donjon.salles).length, relu.donjon.liaisons.length], [res.salle.id, Object.keys(pres.donjon.salles).length, pres.donjon.liaisons.length], 'salle courante, salles et liaisons');
    egal(relu.donjon.salles[res.salle.id].plan, validerPlan(pres.donjon.salles[res.salle.id].plan).plan, 'plan de la salle créée identique (à l’ordre des champs près)');
  }],
];

export const executer = () => executerSuite('présentation : ', TESTS);
