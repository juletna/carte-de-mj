/**
 * Tests de la Présentation (presentation.js), de son stockage et de l'option `deplacables`
 * de deplacement.js. Sans dépendance : marche sous Node et dans tests.html.
 * Chaque test lève une Error au premier écart ; executer() renvoie la même forme que les autres.
 */
import * as m from '../js/donjon.js';
import * as p from '../js/presentation.js';
import { disposerPlan } from '../js/plan-donjon.js';
import { activerDeplacement, porteSous, BANDE_PORTE } from '../js/deplacement.js';
import { modeTableDefaut, modeTable, tailleRemplir, tailleTable, TAILLE_MIN, TAILLE_MAX_REMPLIR } from '../js/affichage.js';
import { decrire } from '../js/parseur/decrire.js';
import { validerPlan } from '../js/schema.js';
import { chargerPresentations, sauverPresentations, chargerReglages, CLE_PRESENTATIONS, CLE_REGLAGES, CLE_PARTIE_OUVERTE, memoriserPartieOuverte, oublierPartieOuverte, partieAReprendre } from '../js/stockage.js';

function verifier(condition, message) { if (!condition) throw new Error(message); }
function egal(obtenu, attendu, quoi) {
  const a = JSON.stringify(obtenu), b = JSON.stringify(attendu);
  if (a !== b) throw new Error(`${quoi} : attendu ${b}, obtenu ${a}`);
}
function fauxStock(initial = {}) {
  const donnees = { ...initial };
  return { donnees, getItem: (k) => (k in donnees ? donnees[k] : null), setItem: (k, v) => { donnees[k] = String(v); }, removeItem: (k) => { delete donnees[k]; } };
}

const analyserPlanCroix = () => validerPlan({ largeur: 9, longueur: 9, forme: 'croix', bras: 3 }).plan;
const TEXTE_A = 'Salle de 8 par 8 cases, une porte au mur est en 3, une porte secrète au mur nord en B, un coffre caché en D4, deux personnages en B7 C7, un gobelin en F2, un pilier en E5.';
const TEXTE_B = 'Salle de 6 par 6 cases, une porte au mur ouest en 3, une porte au mur sud en C, un coffre en A1.';
const TEXTE_C = 'Salle de 4 par 4 cases, une porte au mur nord en B, un coffre en D4.';

/** Trois salles : A (entrée) —est/ouest— B —sud/nord— C. A a un coffre caché et une porte cachée. */
function donjonDeTest() {
  const d = m.creerDonjon({ nom: 'Crypte', texte: TEXTE_A });
  const a = d.salles[d.salleActive];
  const b = m.ajouterSalle(d, { nom: 'Couloir', texte: TEXTE_B });
  const c = m.ajouterSalle(d, { nom: 'Trésor', texte: TEXTE_C });
  m.relier(d, { salle: a.id, mur: 'est', position: 2 }, { salle: b.id, mur: 'ouest', position: 2 });
  m.relier(d, { salle: b.id, mur: 'sud', position: 2 }, { salle: c.id, mur: 'nord', position: 1 });
  return { d, a, b, c };
}
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

const SENTINELLES = [
  'SENT-NOTE-A', 'SENT-NOTE-B', 'SENT-NOTE-C', 'SENT-TEXTE-A', 'SENT-TEXTE-C', 'SENT-NOM-A', 'SENT-NOM-C', 'SENT-DONJON', 'SENT-PLAN-NOM',
  'SENT-ID-COFFRE', 'SENT-CHAMP-COFFRE', 'SENT-ID-PORTE', 'SENT-CHAMP-PORTE', 'SENT-ID-GOBELIN', 'SENT-CHAMP-GOBELIN',
  'SENT-LIAISON', 'SENT-CONNEXION', 'SENT-CONTENU-C', 'SENT-ID-PORTE-B', 'SENT-NOTE-PARTIE-A', 'SENT-NOTE-PARTIE-B',
];

/** Présentation dont tout ce qui est secret porte une valeur sentinelle. */
function presentationAvecSecrets() {
  const { d, a, b, c } = donjonDeTest();
  d.nom = 'SENT-DONJON';
  a.nom = 'SENT-NOM-A'; a.notes = 'SENT-NOTE-A'; a.texte += ' SENT-TEXTE-A'; a.plan.nom = 'SENT-PLAN-NOM';
  a.plan.connexions = [{ porte: 'p2', vers: 'SENT-CONNEXION' }];
  b.notes = 'SENT-NOTE-B';
  c.nom = 'SENT-NOM-C'; c.notes = 'SENT-NOTE-C'; c.texte += ' SENT-TEXTE-C';
  c.plan.objets[0].id = 'SENT-CONTENU-C';
  d.liaisons.forEach((l, i) => { l.id = `SENT-LIAISON-${i}`; });
  const coffre = a.plan.objets.find((o) => o.type === 'coffre');
  coffre.id = 'SENT-ID-COFFRE'; coffre.secret = 'SENT-CHAMP-COFFRE';
  const porteCachee = a.plan.portes.find((q) => q.cache);
  porteCachee.id = 'SENT-ID-PORTE'; porteCachee.secret = 'SENT-CHAMP-PORTE';
  a.plan.creatures.push({ id: 'SENT-ID-GOBELIN', type: 'gobelin', camp: 'monstre', x: 7, y: 7, taille: 1, numero: 2, cache: true, secret: 'SENT-CHAMP-GOBELIN' });
  b.plan.portes.push({ id: 'SENT-ID-PORTE-B', mur: 'nord', position: 4, type: 'porte', cache: true });
  a.plan.objets.find((o) => o.type === 'pilier').note = 'SENT-EXTRA-VISIBLE'; // champ inconnu sur un élément visible
  const pres = p.creerPresentation(d);
  p.definirNotePartie(pres, a.id, 'SENT-NOTE-PARTIE-A');
  p.definirNotePartie(pres, b.id, 'SENT-NOTE-PARTIE-B');
  return { pres, d, a, b, c };
}

const TESTS = [
  ['création : copie du donjon, le donjon d’origine n’est jamais modifié', () => {
    const { d, a, b } = donjonDeTest();
    const avant = JSON.stringify(d);
    const pres = p.creerPresentation(d);
    egal([pres.format, pres.version], ['carte-de-mj-presentation', 1], 'format et version');
    egal([pres.salleCourante, pres.decouvertes], [a.id, [a.id]], 'départ dans la salle active, découverte');
    egal(pres.reveles, {}, 'rien de révélé');
    verifier(pres.donjon !== d && pres.donjon.salles[a.id] !== a && pres.donjon.salles[a.id].plan !== a.plan, 'c’est une copie, pas le même objet');
    egal(pres.donjon.salles[a.id].texte, a.texte, 'même texte au départ');
    // On joue : pion déplacé, élément révélé, porte passée, salle changée.
    const copie = pres.donjon.salles[a.id].plan;
    const pion = copie.creatures.find((k) => k.camp === 'pj');
    p.appliquerDeplacement(pres, a.id, { ...copie, creatures: copie.creatures.map((k) => (k === pion ? { ...k, x: 4, y: 0 } : k)) });
    p.revelerToute(pres, a.id);
    p.passerPorte(pres, a.id, copie.portes.find((q) => !q.cache).id);
    pres.donjon.salles[b.id].notes = 'modifiée en jeu';
    egal(JSON.stringify(d), avant, 'le donjon préparé est identique octet pour octet');
    egal(pres.donjon.salles[a.id].texte, a.texte, 'le texte de la copie n’est jamais réécrit non plus');
    verifier(pres.donjon.salles[a.id].plan.creatures.every((k) => k.camp !== 'pj'), 'dans la copie, le groupe est parti');
    verifier(a.plan.creatures.filter((k) => k.camp === 'pj').length === 2, 'dans le donjon, les deux pions sont toujours là');
  }],

  ['sauvegarde : aller-retour JSON, entrées invalides écartées', () => {
    const { pres, a, b } = presentationAvecSecrets();
    p.revelerElement(pres, a.id, 'SENT-ID-COFFRE');
    p.afficherATable(pres, b.id);
    const relu = p.validerPresentation(JSON.parse(JSON.stringify(pres)));
    verifier(relu.ok, `relecture : ${relu.erreurs}`);
    egal([relu.presentation.salleCourante, relu.presentation.decouvertes], [b.id, [a.id, b.id]], 'salle courante et découvertes');
    egal(relu.presentation.reveles, { [a.id]: ['SENT-ID-COFFRE'] }, 'révélations');
    egal(relu.presentation.donjon.salles[a.id].plan.objets.map((o) => o.id), pres.donjon.salles[a.id].plan.objets.map((o) => o.id), 'identifiants d’éléments stables');
    // Données douteuses : id révélé qui n’est pas caché ou n’existe pas, salle inconnue, salle courante inconnue.
    const brut = JSON.parse(JSON.stringify(pres));
    brut.reveles = { [a.id]: ['SENT-ID-COFFRE', 'o2', 'inconnu'], 'salle-fantome': ['x'] };
    brut.decouvertes = [a.id, 'salle-fantome', a.id];
    brut.salleCourante = 'salle-fantome';
    const v = p.validerPresentation(brut).presentation;
    egal(v.reveles, { [a.id]: ['SENT-ID-COFFRE'] }, 'seuls les éléments réellement cachés restent révélés');
    egal([v.salleCourante, v.decouvertes], [a.id, [a.id]], 'salle courante et découvertes ramenées à des salles connues');
    verifier(!p.validerPresentation({ ...pres, format: 'autre' }).ok, 'mauvais format refusé');
    verifier(!p.validerPresentation({ ...pres, version: 2 }).ok, 'version plus récente refusée');
    verifier(!p.validerPresentation({ ...pres, donjon: { format: 'x' } }).ok, 'donjon invalide refusé');
    verifier(!p.validerPresentation(null).ok && !p.validerPresentation([]).ok, 'valeurs absurdes refusées');
  }],

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

  ['révélation : révéler, recacher, tout révéler ; la copie garde `cache`', () => {
    const { pres, a } = presentationAvecSecrets();
    egal(p.comptageCaches(pres, a.id), { total: 3, reveles: 0 }, 'trois éléments cachés dans la première salle');
    verifier(!p.revelerElement(pres, a.id, 'o2'), 'un pilier visible ne se « révèle » pas');
    verifier(!p.revelerElement(pres, a.id, 'inconnu') && !p.revelerElement(pres, 'inconnue', 'o1'), 'élément ou salle inconnus : false');
    verifier(p.revelerElement(pres, a.id, 'SENT-ID-COFFRE') && p.estRevele(pres, a.id, 'SENT-ID-COFFRE'), 'coffre révélé');
    verifier(p.revelerElement(pres, a.id, 'SENT-ID-COFFRE'), 'révéler deux fois est inoffensif');
    egal(pres.reveles[a.id], ['SENT-ID-COFFRE'], 'une seule entrée');
    verifier(pres.donjon.salles[a.id].plan.objets.find((o) => o.id === 'SENT-ID-COFFRE').cache === true, 'le plan de la copie garde cache : true');
    const coffreRegie = p.planRegie(pres.donjon.salles[a.id].plan, pres.reveles[a.id]).objets.find((o) => o.id === 'SENT-ID-COFFRE');
    verifier(!('cache' in coffreRegie), 'dans la régie un élément révélé n’est plus translucide');
    verifier(p.recacherElement(pres, a.id, 'SENT-ID-COFFRE') && !p.recacherElement(pres, a.id, 'SENT-ID-COFFRE'), 'recacher');
    egal(pres.reveles, {}, 'plus rien de révélé');
    egal(p.revelerToute(pres, a.id), 3, 'tout révéler : trois éléments');
    egal(p.revelerToute(pres, a.id), 0, 'rien de plus la deuxième fois');
    egal(p.comptageCaches(pres, a.id), { total: 3, reveles: 3 }, 'tout est révélé');
  }],

  ['déplacement d’un pion : seuls x et y changent dans la copie', () => {
    const { d, a } = donjonDeTest();
    const pres = p.creerPresentation(d);
    const plan = pres.donjon.salles[a.id].plan;
    const pion = plan.creatures[0];
    const avant = JSON.stringify(plan);
    // Une tentative de modifier autre chose (un objet déplacé, un pion renommé) est ignorée.
    const triche = { ...plan, objets: plan.objets.map((o) => ({ ...o, x: 0 })), creatures: plan.creatures.map((k, i) => (i ? k : { ...k, x: 5, y: 5, type: 'dragon' })) };
    verifier(p.appliquerDeplacement(pres, a.id, triche), 'un pion a bougé');
    const apres = pres.donjon.salles[a.id].plan;
    egal([pion.x, pion.y, pion.type], [5, 5, 'pj'], 'x et y pris, pas le type');
    egal(JSON.stringify(apres.objets), JSON.stringify(JSON.parse(avant).objets), 'les objets n’ont pas bougé');
    verifier(!p.appliquerDeplacement(pres, a.id, apres), 'aucun changement : false');
  }],

  ['vueTable : aucune valeur secrète ne sort (notes, cachés, autres salles, liaisons)', () => {
    const { pres, a } = presentationAvecSecrets();
    const sortie = JSON.stringify(p.vueTable(pres));
    for (const s of SENTINELLES) verifier(!sortie.includes(s), `« ${s} » est sorti dans la vue table : ${sortie.slice(0, 300)}`);
    verifier(!sortie.includes('cache'), 'aucun champ cache dans la vue table');
    verifier(!sortie.includes('liaison') && !sortie.includes('"vers"'), 'aucune information de liaison');
    const vue = p.vueTable(pres);
    verifier(vue.largeur === 8 && vue.objets.some((o) => o.type === 'pilier') && vue.creatures.length === 3, 'le visible est bien là (pilier, 2 pj et le gobelin visible)');
    verifier(!vue.objets.some((o) => o.type === 'coffre') && vue.portes.length === 1 && vue.portes[0].mur === 'est', 'ni le coffre caché, ni la porte secrète');
    verifier(!vue.creatures.some((k) => k.x === 7 && k.y === 7), 'ni le gobelin caché');
    // Dans une autre salle : rien de la première non plus.
    p.passerPorte(pres, a.id, 'p2', { groupe: false });
    const sortieB = JSON.stringify(p.vueTable(pres));
    for (const s of SENTINELLES.filter((x) => x !== 'SENT-ID-COFFRE')) verifier(!sortieB.includes(s), `« ${s} » est sorti depuis la deuxième salle`);
    verifier(!sortieB.includes('"pilier"'), 'rien de la première salle');
  }],

  ['case montrée : seulement une case de sol de la salle', () => {
    const plan = analyserPlanCroix();
    egal(p.recevoirCaseVisee({ x: 4, y: 4 }, plan), { x: 4, y: 4 }, 'au centre');
    egal(p.recevoirCaseVisee({ x: 4, y: 4, nom: 'SECRET' }, plan), { x: 4, y: 4 }, 'champ inconnu écarté');
    egal(p.recevoirCaseVisee({ x: 0, y: 0 }, plan), null, 'case retirée');
    egal(p.recevoirCaseVisee({ x: 99, y: 0 }, plan), null, 'hors de la salle');
    for (const brut of [null, undefined, 'x', {}, { x: 1.5, y: 1 }, { x: '1', y: 1 }]) egal(p.recevoirCaseVisee(brut, plan), null, `refusé : ${JSON.stringify(brut)}`);
    egal(p.recevoirCaseVisee({ x: 4, y: 4 }, null), null, 'pas de plan');
  }],

  ['déplacer un pion depuis la table : la régie applique les règles', () => {
    const { d, a } = donjonDeTest();
    const pres = p.creerPresentation(d, { salleDepart: a.id });
    const plan = pres.donjon.salles[a.id].plan;
    const [pj, autre] = plan.creatures.filter((k) => k.camp === 'pj');
    verifier(p.deplacerPion(pres, a.id, pj.id, 5, 5), 'un pion de joueur se déplace');
    egal([pj.x, pj.y], [5, 5], 'à la case demandée');
    egal(p.deplacerPion(pres, a.id, pj.id, 5, 5), false, 'même case : rien');
    egal(p.deplacerPion(pres, a.id, pj.id, autre.x, autre.y), false, 'sur un autre pion : refusé');
    egal(p.deplacerPion(pres, a.id, pj.id, 99, 0), false, 'hors de la salle : refusé');
    egal(p.deplacerPion(pres, a.id, pj.id, 1.5, 0), false, 'pas une case : refusé');
    egal(p.deplacerPion(pres, a.id, 'inconnu', 1, 1), false, 'pion inconnu');
    egal(p.deplacerPion(pres, 'inconnue', pj.id, 1, 1), false, 'salle inconnue');
    egal([pj.x, pj.y], [5, 5], 'les refus ne bougent rien');
  }],

  ['glisser à la souris : un filtre écarte le doigt, une case vide est signalée', () => {
    const ecouteurs = {};
    const canvas = { addEventListener: (t, f) => { ecouteurs[t] = f; }, getBoundingClientRect: () => ({ left: 0, top: 0 }), setPointerCapture() {}, style: {} };
    const plan = { largeur: 6, longueur: 6, portes: [], objets: [], creatures: [{ id: 'c1', type: 'pj', camp: 'pj', x: 1, y: 1, taille: 1 }] };
    const clics = [];
    activerDeplacement(canvas, {
      plan: () => plan, taille: () => 10, apercu() {}, deposer() {}, cliquer: (t, c) => clics.push([t?.element?.id ?? null, c ?? null]),
      deplacables: ['creature'], filtre: (e) => e.pointerType === 'mouse',
    });
    const appui = (x, y, pointerType) => ecouteurs.pointerdown({ button: 0, clientX: (x + 1) * 10 + 5, clientY: (y + 1) * 10 + 5, pointerType, pointerId: 1, preventDefault() {} });
    appui(3, 3, 'touch');
    egal(clics, [], 'un doigt ne déclenche rien');
    appui(3, 4, 'mouse');
    egal(clics, [[null, [3, 4]]], 'la souris sur une case vide : la case');
  }],

  ['Présenter : ouvre le donjon demandé, pas la dernière partie', () => {
    const { d, a } = donjonDeTest();
    const autre = donjonDeTest().d;
    const partieAutre = p.creerPresentation(autre);
    const presentations = { [autre.id]: partieAutre };
    const donjons = { [d.id]: d, [autre.id]: autre };
    const neuve = p.partieDemandee(d.id, donjons, presentations);
    egal([neuve.partie.donjon.id, neuve.reprise, neuve.partie.salleCourante], [d.id, false, a.id], 'pas de partie : une nouvelle, sur ce donjon');
    const reprise = p.partieDemandee(autre.id, donjons, presentations);
    verifier(reprise.partie === partieAutre && reprise.reprise, 'une partie en cours : on la reprend');
    egal(p.partieDemandee('inconnu', donjons, presentations), null, 'donjon absent');
    egal(p.partieDemandee('constructor', donjons, presentations), null, 'nom piégé');
    egal(p.partieDemandee(null, donjons, presentations), null, 'sans demande');
    egal(p.partieDemandee(d.id, undefined, presentations), null, 'aucun donjon dans ce navigateur');
  }],

  ['encart de la table : seulement les salles découvertes, sans nom, ni identifiant, ni pion', () => {
    const { d, a, b, c } = donjonDeTest();
    const pres = p.creerPresentation(d, { salleDepart: a.id });
    const debut = p.miniPlanTable(pres);
    egal(Object.keys(debut.plans).length, 1, 'au départ : la salle de départ seule');
    egal(debut.couloirs, [], 'aucun couloir vers une salle non découverte');
    const complet = disposerPlan(d);
    egal([debut.largeur, debut.longueur], [complet.largeur, complet.longueur], 'le cadre est celui du plan complet');
    egal(debut.plans[debut.actif].largeur, 8, 'elle est la salle active');
    p.afficherATable(pres, b.id);
    const deux = p.miniPlanTable(pres);
    egal(Object.keys(deux.plans).length, 2, 'deux salles découvertes');
    egal(deux.couloirs.length, 1, 'le couloir entre les deux');
    egal(deux.plans[deux.actif].largeur, 6, 'la surbrillance suit la salle en cours');
    egal(deux.positions.s0, debut.positions.s0, 'une salle ne bouge pas quand une autre se découvre');
    egal([deux.largeur, deux.longueur], [debut.largeur, debut.longueur], 'le cadre ne change pas non plus');
    const sortie = JSON.stringify(deux);
    for (const s of ['Crypte', 'Couloir', 'Trésor', a.id, b.id, c.id, 'liaison']) verifier(!sortie.includes(s), `« ${s} » est sorti dans l’encart`);
    for (const plan of Object.values(deux.plans)) egal([plan.nom, plan.creatures], ['', []], 'ni nom, ni pion');
    verifier(!Object.values(deux.plans).some((q) => q.largeur === 4), 'rien de la salle non découverte');
    verifier(!sortie.includes('"cache"'), 'aucun champ cache');
    p.afficherATable(pres, a.id);
    egal(Object.keys(p.miniPlanTable(pres).plans).length, 2, 'revenir en arrière n’oublie rien');
    egal(p.miniPlanTable({ donjon: { salles: {} }, salleCourante: 'x' }), null, 'pas de salle courante : pas d’encart');
  }],

  ['encart de la table : les portes pas encore ouvertes sont marquées, sans rien dire de ce qu’il y a derrière', () => {
    const { d, a, b } = donjonDeTest();
    const pres = p.creerPresentation(d, { salleDepart: a.id });
    const portes = (mini) => mini.portesFermees.map((q) => [mini.plans[q.salle].largeur, q.mur, q.position]);
    egal(portes(p.miniPlanTable(pres)), [[8, 'est', 2]], 'au départ : la porte est de A, pas la porte secrète');
    p.afficherATable(pres, b.id);
    egal(portes(p.miniPlanTable(pres)), [[6, 'sud', 2]], 'A et B sont reliées : leur porte est ouverte, reste celle vers C');
    const sans = m.ajouterSalle(d, { nom: 'Vide', texte: 'Salle de 5 par 5 cases, une porte au mur est en 2.' });
    const pres2 = p.creerPresentation(d, { salleDepart: sans.id });
    const mini = p.miniPlanTable(pres2);
    egal(portes(mini), [[5, 'est', 1]], 'une porte reliée à rien est marquée pareil');
    verifier(!JSON.stringify(mini.portesFermees).includes(sans.id), 'aucun identifiant de salle');
    const secrete = pres.donjon.salles[a.id].plan.portes.find((q) => q.cache);
    p.revelerElement(pres, a.id, secrete.id);
    p.afficherATable(pres, a.id);
    verifier(portes(p.miniPlanTable(pres)).some(([l, mur]) => l === 8 && mur === secrete.mur), 'révélée : elle compte comme non ouverte');
    egal(p.portesNonOuvertes(pres, disposerPlan(pres.donjon)).length, p.miniPlanTable(pres).portesFermees.length, 'la régie voit les mêmes');
    const relue = p.recevoirMiniPlan(p.miniPlanTable(pres));
    egal(relue.portesFermees, p.miniPlanTable(pres).portesFermees, 'la table les relit');
    const base = p.miniPlanTable(pres);
    for (const faux of [{ salle: 'autre', mur: 'est', position: 0 }, { salle: base.actif, mur: 'haut', position: 0 }, { salle: base.actif, mur: 'est', position: -1 }, { salle: 'constructor', mur: 'est', position: 0 }]) {
      egal(p.recevoirMiniPlan({ ...base, portesFermees: [faux] }), null, `refusé : ${JSON.stringify(faux)}`);
    }
    verifier(!JSON.stringify(p.recevoirMiniPlan({ ...base, portesFermees: [{ salle: base.actif, mur: 'est', position: 0, nom: 'SECRET' }] })).includes('SECRET'), 'champ inconnu écarté');
  }],

  ['encart de la table : un élément caché reste caché, révélé il apparaît', () => {
    const { d, a } = donjonDeTest();
    const pres = p.creerPresentation(d, { salleDepart: a.id });
    const types = () => { const m0 = p.miniPlanTable(pres); return m0.plans[m0.actif].objets.map((o) => o.type); };
    const coffre = pres.donjon.salles[a.id].plan.objets.find((o) => o.type === 'coffre');
    verifier(!types().includes('coffre'), 'coffre caché : absent');
    p.revelerElement(pres, a.id, coffre.id);
    verifier(types().includes('coffre'), 'révélé : présent');
    p.recacherElement(pres, a.id, coffre.id);
    verifier(!types().includes('coffre'), 'recaché : absent');
  }],

  ['encart de la table : un couloir derrière une porte secrète non révélée ne se devine pas', () => {
    const { d, a } = donjonDeTest();
    const caveau = m.ajouterSalle(d, { nom: 'Caveau', texte: 'Salle de 5 par 5 cases, une porte au mur sud en C.' });
    const secrete = d.salles[a.id].plan.portes.find((q) => q.mur === 'nord');
    m.relier(d, { salle: a.id, mur: 'nord', position: secrete.position }, { salle: caveau.id, mur: 'sud', position: 2 });
    const pres = p.creerPresentation(d, { salleDepart: a.id });
    const idPorte = pres.donjon.salles[a.id].plan.portes.find((q) => q.mur === 'nord').id;
    p.afficherATable(pres, caveau.id);
    egal(p.miniPlanTable(pres).couloirs, [], 'les deux salles sont connues, la porte reste secrète');
    p.revelerElement(pres, a.id, idPorte);
    egal(p.miniPlanTable(pres).couloirs.length, 1, 'révélée : le couloir apparaît');
    p.recacherElement(pres, a.id, idPorte);
    egal(p.miniPlanTable(pres).couloirs, [], 'recachée : il disparaît');
  }],

  ['encart de la table : la fenêtre table relit ce qu’elle reçoit, champ par champ', () => {
    const { d, a, b } = donjonDeTest();
    const pres = p.creerPresentation(d, { salleDepart: a.id });
    p.afficherATable(pres, b.id);
    const mini = p.miniPlanTable(pres);
    const relue = p.recevoirMiniPlan(mini);
    egal(relue.actif, mini.actif, 'la salle active');
    egal(relue.disposition.positions, mini.positions, 'les positions');
    egal(relue.disposition.couloirs, mini.couloirs, 'les couloirs');
    egal(Object.keys(relue.donjon.salles), Object.keys(mini.plans), 'les salles');
    const piegee = { ...mini, nom: 'SECRET', couloirs: [{ chemin: [{ x: 1, y: 1, nom: 'SECRET' }], nom: 'SECRET' }] };
    piegee.plans = { ...mini.plans, [mini.actif]: { ...mini.plans[mini.actif], nom: 'SECRET', notes: 'SECRET', creatures: [{ id: 'c', type: 'gobelin', camp: 'monstre', x: 0, y: 0, taille: 1, numero: 1 }], objets: [{ id: 'o', type: 'coffre', x: 0, y: 0, cache: true }] } };
    const propre = p.recevoirMiniPlan(piegee);
    verifier(!JSON.stringify(propre).includes('SECRET'), 'les champs inconnus sont écartés');
    egal(propre.donjon.salles[mini.actif].plan.creatures, [], 'aucun pion');
    egal(propre.donjon.salles[mini.actif].plan.objets, [], 'un objet marqué caché est écarté');
    for (const brut of [null, 'x', {}, { ...mini, largeur: 'grand' }, { ...mini, actif: 'absente' }, { ...mini, positions: { autre: mini.positions[mini.actif] } }, { ...mini, couloirs: [{ chemin: [{ x: -1, y: 0 }] }] }, { ...mini, plans: {} }]) {
      egal(p.recevoirMiniPlan(brut), null, `refusé : ${JSON.stringify(brut)?.slice(0, 40)}`);
    }
  }],

  ['réglage de la mini-carte : relu seulement si le MJ l’a éteinte', () => {
    verifier(chargerReglages(fauxStock({ [CLE_REGLAGES]: JSON.stringify({ miniTable: false }) })).miniTable === false, 'éteinte : relu');
    verifier(!('miniTable' in chargerReglages(fauxStock({ [CLE_REGLAGES]: JSON.stringify({ miniTable: 'non' }) }))), 'valeur inconnue : ignorée');
  }],

  ['vueTable : un élément révélé apparaît, recaché il disparaît ; salle absente → null', () => {
    const { pres, a } = presentationAvecSecrets();
    const types = () => p.vueTable(pres).objets.map((o) => o.type).sort().join(',');
    egal(types(), 'pilier', 'caché : absent');
    p.revelerElement(pres, a.id, 'SENT-ID-COFFRE');
    egal(types(), 'coffre,pilier', 'révélé : présent');
    const vue = p.vueTable(pres);
    verifier(!('cache' in vue.objets[0]) && !JSON.stringify(vue).includes('SENT-CHAMP-COFFRE'), 'sans cache, sans champ inconnu');
    verifier(!JSON.stringify(vue).includes('SENT-NOTE-A'), 'les notes restent chez le MJ');
    p.revelerElement(pres, a.id, 'SENT-ID-PORTE');
    egal(p.vueTable(pres).portes.length, 2, 'porte secrète révélée : visible');
    p.recacherElement(pres, a.id, 'SENT-ID-COFFRE');
    egal(types(), 'pilier', 'recaché : absent de nouveau');
    egal(p.vueTable({ donjon: { salles: {} }, salleCourante: 'x', reveles: {} }), null, 'pas de salle courante');
    // Valeur « cache » inattendue (1, "oui") : traitée comme cachée.
    pres.donjon.salles[a.id].plan.objets[1].cache = 'oui';
    verifier(!p.vueTable(pres).objets.some((o) => o.id === pres.donjon.salles[a.id].plan.objets[1].id), 'cache truthy : masqué');
  }],

  ['vueTable : côté table, un plan reçu est relu et tout élément caché écarté', () => {
    const { pres } = presentationAvecSecrets();
    const vue = p.vueTable(pres);
    const recu = p.recevoirVueTable(JSON.parse(JSON.stringify(vue)));
    egal(recu.objets.length, vue.objets.length, 'rien de perdu pour un plan légitime');
    const piege = JSON.parse(JSON.stringify(vue));
    piege.objets.push({ id: 'z', type: 'coffre', x: 0, y: 0, l: 1, h: 1, rotation: 0, cache: true });
    piege.nom = 'SENT-NOM';
    piege.connexions = [{ vers: 'SENT-CONNEXION' }];
    const sortie = JSON.stringify(p.recevoirVueTable(piege));
    verifier(!sortie.includes('SENT-') && !sortie.includes('"z"'), 'élément caché, nom et connexions écartés');
    egal(p.recevoirVueTable('n’importe quoi'), null, 'valeur absurde → null');
    egal(p.recevoirVueTable({ largeur: 0 }), null, 'plan invalide → null');
  }],

  // ===== Improvisation (étape 4) : notes de partie, état des pions, commandes, nouvelle salle =====

  ['D3 notes de partie : séparées des notes de préparation, enregistrées, jamais dans la vue table', () => {
    const { d, a } = donjonDeTest();
    a.notes = 'préparation : le coffre est piégé';
    const avant = JSON.stringify(d);
    const pres = p.creerPresentation(d);
    egal(p.notePartie(pres, a.id), '', 'aucune note de partie au départ');
    verifier(p.definirNotePartie(pres, a.id, 'les joueurs ont forcé la serrure'), 'note posée');
    egal(pres.donjon.salles[a.id].notes, 'préparation : le coffre est piégé', 'la note de préparation n’est jamais écrasée');
    egal(p.notePartie(pres, a.id), 'les joueurs ont forcé la serrure', 'la note de partie est à part');
    verifier(!p.definirNotePartie(pres, 'salle-fantome', 'x'), 'salle inconnue refusée');
    const sortie = JSON.stringify(p.vueTable(pres));
    verifier(!sortie.includes('forcé') && !sortie.includes('piégé') && !sortie.includes('notes'), 'aucune note dans la vue table');
    egal(JSON.stringify(d), avant, 'le donjon préparé n’est pas modifié');
    // Enregistrée et relue avec la partie.
    const stock = fauxStock();
    sauverPresentations({ [d.id]: pres }, stock);
    const relu = chargerPresentations(stock)[d.id];
    egal(relu.notesPartie[a.id], 'les joueurs ont forcé la serrure', 'relue après enregistrement');
    egal(relu.donjon.salles[a.id].notes, 'préparation : le coffre est piégé', 'préparation intacte après enregistrement');
    // Une note vide est retirée ; une note trop longue est bornée.
    p.definirNotePartie(pres, a.id, '');
    egal(pres.notesPartie, {}, 'note vide retirée');
    p.definirNotePartie(pres, a.id, 'x'.repeat(30000));
    egal(p.notePartie(pres, a.id).length, 20000, 'note bornée');
  }],

  ['D3 notes : une salle de la copie garde ses propres notes quand on change de salle', () => {
    const { pres, a, b } = presentationAvecSecrets();
    egal([p.notePartie(pres, a.id), p.notePartie(pres, b.id)], ['SENT-NOTE-PARTIE-A', 'SENT-NOTE-PARTIE-B'], 'une note par salle');
    p.passerPorte(pres, a.id, 'p2', { groupe: false });
    egal(p.notePartie(pres, a.id), 'SENT-NOTE-PARTIE-A', 'la note de la salle quittée est toujours là');
    for (const vue of [p.vueTable(pres)]) verifier(!JSON.stringify(vue).includes('SENT-NOTE-PARTIE'), 'jamais à la table');
  }],

  ['compat : une partie enregistrée avant l’étape 4 (sans notesPartie ni etat) se charge ; les nouveaux champs sont validés', () => {
    const { d, a } = donjonDeTest();
    const ancienne = JSON.parse(JSON.stringify(p.creerPresentation(d)));
    delete ancienne.notesPartie;
    const v = p.validerPresentation(ancienne);
    verifier(v.ok, v.erreurs.join(' '));
    egal(v.presentation.notesPartie, {}, 'notes de partie absentes → vides');
    verifier(v.presentation.donjon.salles[a.id].plan.creatures.every((k) => !('etat' in k)), 'aucun état inventé');
    // Valeurs absurdes : écartées sans refuser la partie.
    const piege = JSON.parse(JSON.stringify(p.creerPresentation(d)));
    piege.notesPartie = { [a.id]: 'ok', 'salle-fantome': 'x', [Object.keys(d.salles)[1]]: 42 };
    const pion = piege.donjon.salles[a.id].plan.creatures[0];
    pion.etat = 'zombie';
    piege.donjon.salles[a.id].plan.creatures[1].etat = 'mort';
    const w = p.validerPresentation(piege);
    verifier(w.ok, 'la partie se charge');
    egal(w.presentation.notesPartie, { [a.id]: 'ok' }, 'seules les notes de salles connues, en texte, sont gardées');
    const k = w.presentation.donjon.salles[a.id].plan.creatures;
    egal([k[0].etat, k[1].etat], [undefined, 'mort'], 'état inconnu écarté, état valide gardé');
    for (const mauvais of [null, 'texte', [], 7]) {
      piege.notesPartie = mauvais;
      verifier(p.validerPresentation(piege).ok, `notesPartie = ${JSON.stringify(mauvais)} : ignoré, pas fatal`);
    }
    piege.notesPartie = JSON.parse('{"__proto__": "x", "constructor": "y"}');
    const x = p.validerPresentation(piege);
    verifier(x.ok && Object.keys(x.presentation.notesPartie).length === 0 && ({}).x === undefined, 'clés dangereuses sans effet');
  }],

  ['D4 état des pions : blessé, mort, retour à normal ; visible à la table, enregistré', () => {
    const { d, a } = donjonDeTest();
    const pres = p.creerPresentation(d);
    const plan = pres.donjon.salles[a.id].plan;
    const gob = plan.creatures.find((k) => k.type === 'gobelin');
    egal(p.vueTable(pres).creatures.find((k) => k.id === gob.id).etat, undefined, 'normal : pas de champ');
    verifier(p.definirEtat(pres, a.id, gob.id, 'blesse'), 'blessé');
    egal(p.vueTable(pres).creatures.find((k) => k.id === gob.id).etat, 'blesse', 'la table voit « blessé »');
    p.definirEtat(pres, a.id, gob.id, 'mort');
    egal(p.vueTable(pres).creatures.find((k) => k.id === gob.id).etat, 'mort', 'la table voit « mort »');
    const stock = fauxStock();
    sauverPresentations({ [d.id]: pres }, stock);
    egal(chargerPresentations(stock)[d.id].donjon.salles[a.id].plan.creatures.find((k) => k.id === gob.id).etat, 'mort', 'enregistré');
    const recu = p.recevoirVueTable(JSON.parse(JSON.stringify(p.vueTable(pres))));
    egal(recu.creatures.find((k) => k.id === gob.id).etat, 'mort', 'la fenêtre table relit l’état');
    p.definirEtat(pres, a.id, gob.id, 'normal');
    verifier(!('etat' in plan.creatures.find((k) => k.id === gob.id)), 'retour à normal : champ retiré');
    verifier(!p.definirEtat(pres, a.id, gob.id, 'zombie') && !p.definirEtat(pres, a.id, 'inconnu', 'mort') && !p.definirEtat(pres, 'x', gob.id, 'mort'), 'état, pion ou salle inconnus refusés');
    // Un état écrit à la main dans la vue table reçue est borné.
    const piege = JSON.parse(JSON.stringify(p.vueTable(pres)));
    piege.creatures[0].etat = '<img src=x>';
    verifier(!('etat' in p.recevoirVueTable(piege).creatures[0]), 'état inconnu écarté côté table');
  }],

  ['D4 état : un pion caché non révélé reste absent de la table, état compris ; le groupe qui passe garde ses états', () => {
    const { pres, a } = presentationAvecSecrets();
    p.definirEtat(pres, a.id, 'SENT-ID-GOBELIN', 'mort');
    const sortie = JSON.stringify(p.vueTable(pres));
    verifier(!sortie.includes('mort') && !sortie.includes('SENT-'), 'le pion caché mort n’apparaît pas');
    p.revelerElement(pres, a.id, 'SENT-ID-GOBELIN');
    verifier(JSON.stringify(p.vueTable(pres)).includes('"etat":"mort"'), 'révélé : on voit qu’il est mort');
    // Le groupe suit avec son état.
    const pj = pres.donjon.salles[a.id].plan.creatures.find((k) => k.camp === 'pj');
    p.definirEtat(pres, a.id, pj.id, 'blesse');
    p.passerPorte(pres, a.id, pres.donjon.salles[a.id].plan.portes.find((q) => !q.cache).id, { groupe: true });
    const arrivee = pres.donjon.salles[pres.salleCourante].plan.creatures.find((k) => k.camp === 'pj' && k.numero === pj.numero);
    egal(arrivee.etat, 'blesse', 'le pion blessé a gardé son état dans la salle d’arrivée');
  }],

  ['schéma : etat est facultatif sur une créature, borné à blessé / mort ; un plan sans état ne change pas', () => {
    const base = { largeur: 4, longueur: 4, creatures: [{ type: 'gobelin', x: 0, y: 0 }, { type: 'gobelin', x: 1, y: 0, etat: 'blesse' }, { type: 'gobelin', x: 2, y: 0, etat: 'x' }] };
    const r = validerPlan(base).plan.creatures;
    egal(r.map((k) => k.etat), [undefined, 'blesse', undefined], 'états');
    verifier(!JSON.stringify(validerPlan({ ...base, creatures: [base.creatures[0]] }).plan).includes('etat'), 'aucun champ « etat » inventé');
  }],

  ['commandes en partie : le plan de la copie change, pas le donjon préparé ; texte et liaisons intacts', () => {
    const { d, a, b } = donjonDeTest();
    const avant = JSON.stringify(d);
    const pres = p.creerPresentation(d);
    const texteA = pres.donjon.salles[a.id].texte;
    const liaisons = JSON.stringify(pres.donjon.liaisons);
    const portesA = JSON.stringify(pres.donjon.salles[a.id].plan.portes);
    let r = p.appliquerCommande(pres, a.id, 'ajoute trois gobelins');
    verifier(r.ok, r.message);
    egal(pres.donjon.salles[a.id].plan.creatures.length, a.plan.creatures.length + 3, 'trois pions de plus dans la copie');
    r = p.appliquerCommande(pres, a.id, 'supprime le pilier');
    verifier(r.ok, r.message);
    r = p.appliquerCommande(pres, a.id, 'déplace le gobelin 1 en C1');
    verifier(r.ok, r.message);
    egal(JSON.stringify(d), avant, 'le donjon préparé est identique octet pour octet');
    egal(pres.donjon.salles[a.id].texte, texteA, 'le texte de préparation de la copie n’est pas réécrit (il n’est pas utilisé en partie)');
    egal(JSON.stringify(pres.donjon.liaisons), liaisons, 'liaisons intactes');
    egal(JSON.stringify(pres.donjon.salles[a.id].plan.portes), portesA, 'portes (id, mur, position) intactes');
    for (const q of pres.donjon.salles[a.id].plan.portes) {
      const dest = p.destinationPorte(pres, a.id, q.id);
      egal(!!dest, !!m.liaisonDePorte(d, a.id, q), `la porte ${q.id} est toujours reliée comme avant`);
    }
    egal(pres.donjon.salles[b.id].plan.creatures.length, b.plan.creatures.length, 'l’autre salle n’est pas touchée');
    // Une commande refusée ne change rien et le dit.
    const figee = JSON.stringify(pres);
    r = p.appliquerCommande(pres, a.id, 'supprime le gobelin 7');
    verifier(!r.ok && /pas de gobelin 7/.test(r.message), r.message);
    egal(JSON.stringify(pres), figee, 'rien n’a changé');
    verifier(!p.appliquerCommande(pres, 'salle-fantome', 'ajoute un gobelin').ok, 'salle inconnue refusée');
  }],

  ['commandes en partie : la copie se recharge (validation) avec ses ajouts, états et identifiants', () => {
    const { d, a } = donjonDeTest();
    const pres = p.creerPresentation(d);
    p.appliquerCommande(pres, a.id, 'ajoute deux gobelins caches');
    p.appliquerCommande(pres, a.id, 'ajoute un coffre en A1');
    const pion = pres.donjon.salles[a.id].plan.creatures.find((k) => k.type === 'gobelin');
    p.definirEtat(pres, a.id, pion.id, 'blesse');
    const brut = JSON.parse(JSON.stringify(pres));
    const v = p.validerPresentation(brut);
    verifier(v.ok, v.erreurs.join(' '));
    egal(v.presentation.donjon.salles[a.id].plan, pres.donjon.salles[a.id].plan, 'le plan relu est identique (ids, états, cachés)');
  }],

  ['commandes en partie : un élément ajouté « caché » reste invisible à la table jusqu’à sa révélation', () => {
    const { d, a } = donjonDeTest();
    const pres = p.creerPresentation(d);
    const avant = JSON.stringify(p.vueTable(pres));
    const comptageAvant = p.comptageCaches(pres, a.id).total;
    verifier(p.appliquerCommande(pres, a.id, 'ajoute un gobelin caché en B2').ok, 'ajout');
    verifier(p.appliquerCommande(pres, a.id, 'ajoute un coffre secret en C2').ok, 'ajout');
    egal(JSON.stringify(p.vueTable(pres)), avant, 'la table ne voit toujours rien de plus');
    const cache = pres.donjon.salles[a.id].plan.creatures.find((k) => k.cache);
    egal(p.comptageCaches(pres, a.id).total, comptageAvant + 2, 'la régie les compte parmi les cachés');
    p.revelerElement(pres, a.id, cache.id);
    egal(p.vueTable(pres).creatures.length, JSON.parse(avant).creatures.length + 1, 'révélé : il apparaît');
    verifier(!JSON.stringify(p.vueTable(pres)).includes('"cache"'), 'sans champ cache');
    p.recacherElement(pres, a.id, cache.id);
    egal(JSON.stringify(p.vueTable(pres)), avant, 'recaché : de nouveau invisible');
  }],

  ['commandes en partie : supprimer un élément révélé ne laisse pas sa révélation à son successeur', () => {
    const { d, a } = donjonDeTest();
    const pres = p.creerPresentation(d);
    p.appliquerCommande(pres, a.id, 'supprime le gobelin'); // un seul gobelin dans la salle de test
    p.appliquerCommande(pres, a.id, 'ajoute un gobelin caché en B2');
    const c = pres.donjon.salles[a.id].plan.creatures.find((k) => k.cache);
    p.revelerElement(pres, a.id, c.id);
    verifier(p.estRevele(pres, a.id, c.id), 'révélé');
    const r = p.appliquerCommande(pres, a.id, 'supprime le gobelin caché');
    verifier(r.ok, r.message);
    verifier(!p.estRevele(pres, a.id, c.id) && !(a.id in pres.reveles), 'sa révélation a été retirée avec lui');
    p.appliquerCommande(pres, a.id, 'ajoute un gobelin caché en B2'); // reprend le même identifiant libre
    const neuf = pres.donjon.salles[a.id].plan.creatures.find((k) => k.cache);
    egal(neuf.id, c.id, 'le même identifiant est réutilisé');
    verifier(!p.estRevele(pres, a.id, neuf.id), 'mais le nouveau n’est pas révélé');
    verifier(!JSON.stringify(p.vueTable(pres)).includes('"x":1,"y":1'), 'et la table ne le voit pas');
  }],

  ['secrets : après commandes, notes de partie et états, aucune sentinelle ne sort vers la table', () => {
    const { pres, a } = presentationAvecSecrets();
    for (const t of ['ajoute un gobelin caché', 'ajoute deux piliers', 'supprime le pilier 1', 'déplace le gobelin 1 en C1']) {
      const r = p.appliquerCommande(pres, a.id, t);
      verifier(r.ok, `${t} : ${r.message}`);
    }
    p.definirNotePartie(pres, a.id, 'SENT-NOTE-PARTIE-A');
    p.definirEtat(pres, a.id, pres.donjon.salles[a.id].plan.creatures[0].id, 'blesse');
    const sortie = JSON.stringify(p.vueTable(pres));
    for (const s of SENTINELLES) verifier(!sortie.includes(s), `« ${s} » est sorti dans la vue table`);
    verifier(!sortie.includes('"cache"') && sortie.includes('"etat":"blesse"'), 'pas de cache ; l’état, lui, est visible');
    const ajoute = pres.donjon.salles[a.id].plan.creatures.filter((k) => k.cache && k.id !== 'SENT-ID-GOBELIN');
    egal(ajoute.length, 1, 'le gobelin ajouté caché existe côté régie');
    verifier(!sortie.includes(`"id":"${ajoute[0].id}"`), 'mais pas côté table');
    // Les portes secrètes non révélées restent absentes, même après des commandes.
    egal(p.vueTable(pres).portes.map((q) => q.mur), ['est'], 'porte secrète toujours absente');
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

  ['déplacement : l’option `deplacables` limite aux pions, sans option tout bouge comme avant', () => {
    const raf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = (f) => { f(); return 1; };
    try {
      const plan = () => ({
        largeur: 8, longueur: 8,
        portes: [{ id: 'p1', mur: 'nord', position: 5, type: 'porte' }],
        objets: [{ id: 'o1', type: 'pilier', x: 2, y: 2, l: 1, h: 1, rotation: 0 }],
        creatures: [{ id: 'c1', type: 'pj', camp: 'pj', x: 5, y: 5, taille: 1, numero: 1 }],
      });
      const sonde = (options) => {
        const ecouteurs = {};
        const canvas = { style: {}, addEventListener: (t, f) => { ecouteurs[t] = f; }, getBoundingClientRect: () => ({ left: 0, top: 0 }), setPointerCapture() {} };
        const journal = { deposes: [], clics: [], apercus: 0 };
        let courant = plan();
        activerDeplacement(canvas, {
          plan: () => courant, taille: () => 10, apercu: () => { journal.apercus++; },
          deposer: (n) => { journal.deposes.push(n); courant = n; }, cliquer: (t) => journal.clics.push(t && t.genre), ...options,
        });
        const evt = (cx, cy) => ({ button: 0, pointerId: 1, clientX: (cx + 1) * 10, clientY: (cy + 1) * 10, type: 'pointerup', preventDefault() {} });
        const glisser = (de, vers) => { ecouteurs.pointerdown(evt(...de)); ecouteurs.pointermove(evt(...vers)); ecouteurs.pointerup(evt(...vers)); };
        return { glisser, journal };
      };
      // Option active : le pion bouge ; l’objet et la porte sont seulement cliquables.
      let t = sonde({ deplacables: ['creature'] });
      t.glisser([5.5, 5.5], [6.5, 5.5]);
      egal([t.journal.deposes.length, t.journal.deposes[0]?.creatures[0].x], [1, 6], 'le pion se déplace');
      t.glisser([2.5, 2.5], [4.5, 2.5]);
      egal(t.journal.deposes.length, 1, 'l’objet ne bouge pas');
      t.glisser([5.5, -0.2], [1.5, -0.2]);
      egal(t.journal.deposes.length, 1, 'la porte ne bouge pas');
      egal(t.journal.clics, ['objet', 'porte'], 'mais objet et porte restent cliquables (le pion déposé n’est pas un clic)');
      // Sans l’option (donjon.html) : tout se déplace.
      t = sonde({});
      t.glisser([2.5, 2.5], [4.5, 2.5]);
      t.glisser([5.5, -0.2], [1.5, -0.2]);
      egal(t.journal.deposes.length, 2, 'sans option, l’objet et la porte bougent encore');
    } finally {
      globalThis.requestAnimationFrame = raf;
    }
  }],

  // --- LOT 2 : taille à la table, porte / pion, salle de départ, reprise -------------------------------------

  ['table : « remplir » calcule la case sur la fenêtre (entière, bornée), « échelle réelle » garde exactement la taille calibrée', () => {
    const plan = { largeur: 6, longueur: 6 };
    egal(tailleRemplir(plan, 1920, 1080), 135, 'salle 6×6 sur 1920×1080 : 1080 / 8 = 135');
    egal(tailleRemplir(plan, 800, 1080), 100, 'limitée par la largeur : 800 / 8');
    egal(tailleRemplir({ largeur: 60, longueur: 60 }, 800, 600), TAILLE_MIN, 'salle trop grande : jamais sous la case minimale (elle défile)');
    egal(tailleRemplir({ largeur: 1, longueur: 1 }, 4000, 4000), TAILLE_MAX_REMPLIR, 'petite salle : plafonnée');
    egal(tailleRemplir(plan, 0, 0), null, 'fenêtre sans dimensions : pas de calcul');
    egal(Number.isInteger(tailleRemplir({ largeur: 7, longueur: 5 }, 1000, 777)), true, 'toujours un entier');
    // Le calcul tient dans la fenêtre : (6 + 2) cases ne dépassent ni la largeur ni la hauteur.
    verifier(8 * tailleRemplir(plan, 1366, 650) <= 650, 'la carte tient en hauteur');
    // Échelle réelle : la valeur calibrée, à l'identique, quelle que soit la fenêtre ou la salle.
    for (const [l, h] of [[1920, 1080], [300, 300], [0, 0]]) {
      egal(tailleTable({ mode: 'reel', plan, vue: { largeur: l, hauteur: h }, taille: 61 }), 61, `échelle réelle exacte (${l}×${h})`);
    }
    egal(tailleTable({ mode: 'remplir', plan, vue: { largeur: 1920, hauteur: 1080 }, taille: 61 }), 135, 'remplir : calculé');
    egal(tailleTable({ mode: 'remplir', plan, vue: { largeur: 0, hauteur: 0 }, taille: 61 }), 61, 'remplir sans fenêtre : repli sur la taille réglée');
  }],

  ['table : mode par défaut = échelle réelle si calibré (taille ≠ 48 ou indicateur), sinon remplir ; un choix explicite l’emporte', () => {
    egal(modeTableDefaut({ taille: 48 }), 'remplir', 'taille par défaut');
    egal(modeTableDefaut({ taille: 61 }), 'reel', 'taille changée');
    egal(modeTableDefaut({ taille: 48, calibre: true }), 'reel', 'indicateur de calibrage, même si la taille retombe sur 48');
    egal(modeTable({ taille: 61, modeTable: 'remplir' }), 'remplir', 'choix explicite remplir');
    egal(modeTable({ taille: 48, modeTable: 'reel' }), 'reel', 'choix explicite reel');
    egal(modeTable({ taille: 61, modeTable: 'nimporte' }), 'reel', 'valeur invalide : défaut');
  }],

  ['réglages : modeTable et calibre sont relus s’ils sont valides, absents sinon (le Donjon ne les voit pas)', () => {
    egal(chargerReglages(fauxStock({ [CLE_REGLAGES]: JSON.stringify({ taille: 60 }) })), { echelle: 1.5, taille: 60, grille: true }, 'rien de réglé : aucune clé ajoutée');
    const r = chargerReglages(fauxStock({ [CLE_REGLAGES]: JSON.stringify({ taille: 60, modeTable: 'reel', calibre: true }) }));
    egal([r.modeTable, r.calibre], ['reel', true], 'relus');
    const bad = chargerReglages(fauxStock({ [CLE_REGLAGES]: JSON.stringify({ modeTable: '<img>', calibre: 'oui' }) }));
    egal(['modeTable' in bad, 'calibre' in bad], [false, false], 'valeurs invalides écartées');
  }],

  ['table : le mode de taille ne contient aucun secret et ne passe pas par le plan (vueTable inchangée)', () => {
    const { pres } = presentationAvecSecrets();
    const vue = JSON.stringify(p.vueTable(pres));
    verifier(!/modeTable|"mode"|calibre/.test(vue), 'ni mode ni calibrage dans le plan envoyé à la table');
  }],

  ['porte / pion : zone de clic élargie vers l’intérieur ; clic = porte, glissement = pion ; sans option, rien ne change', () => {
    const raf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = (f) => { f(); return 1; };
    try {
      const plan8 = () => ({
        largeur: 8, longueur: 8,
        portes: [{ id: 'p1', mur: 'nord', position: 5, type: 'porte' }],
        objets: [],
        creatures: [{ id: 'c1', type: 'pj', camp: 'pj', x: 5, y: 0, taille: 1, numero: 1 }], // pion juste devant la porte
      });
      // Fonction pure : la zone de la porte s'étend de BANDE_PORTE case vers l'intérieur, pas au-delà, pas à côté.
      const p = plan8();
      egal(porteSous(5.5, 0.1, p)?.id, 'p1', 'porte : dans le mur élargi par défaut (0,2 case)');
      egal(porteSous(5.5, 0.4, p), null, 'sans bande : 0,4 case à l’intérieur n’est plus la porte');
      egal(porteSous(5.5, 0.4, p, BANDE_PORTE)?.id, 'p1', 'avec la bande : 0,4 case à l’intérieur est la porte');
      egal(porteSous(5.5, BANDE_PORTE + 0.05, p, BANDE_PORTE), null, 'au-delà de la bande : plus la porte');
      egal(porteSous(4.5, 0.3, p, BANDE_PORTE), null, 'à côté de la porte (autre case du mur) : rien');
      const sonde = (options) => {
        const ecouteurs = {};
        const canvas = { style: {}, addEventListener: (t, f) => { ecouteurs[t] = f; }, getBoundingClientRect: () => ({ left: 0, top: 0 }), setPointerCapture() {} };
        const journal = { deposes: [], clics: [] };
        let courant = plan8();
        activerDeplacement(canvas, {
          plan: () => courant, taille: () => 10, apercu: () => {},
          deposer: (n) => { journal.deposes.push(n); courant = n; }, cliquer: (t) => journal.clics.push(t && `${t.genre}:${t.element.id}`),
          deplacables: ['creature'], ...options,
        });
        const evt = (cx, cy) => ({ button: 0, pointerId: 1, clientX: (cx + 1) * 10, clientY: (cy + 1) * 10, type: 'pointerup', preventDefault() {} });
        return {
          journal,
          clic: (cx, cy) => { ecouteurs.pointerdown(evt(cx, cy)); ecouteurs.pointerup(evt(cx, cy)); },
          glisser: (de, vers) => { ecouteurs.pointerdown(evt(...de)); ecouteurs.pointermove(evt(...vers)); ecouteurs.pointerup(evt(...vers)); },
        };
      };
      // Avec l'option (régie) : dans la bande, le clic va à la porte même si un pion est dessous ; plus bas, au pion.
      let t = sonde({ portesLarges: true });
      t.clic(5.5, 0.3);
      t.clic(5.5, 0.8);
      egal(t.journal.clics, ['porte:p1', 'creature:c1'], 'bande de bord : porte ; reste de la case : pion');
      // Un glissement commencé dans la bande, sur le pion, déplace le pion (et ne clique pas la porte).
      t = sonde({ portesLarges: true });
      t.glisser([5.5, 0.3], [5.5, 3.5]);
      egal([t.journal.clics.length, t.journal.deposes[0]?.creatures[0].y], [0, 3], 'glissement : le pion bouge, aucun clic');
      egal(t.journal.deposes[0].portes[0].position, 5, 'la porte n’a pas bougé');
      // Sans l'option (Donjon) : comportement d'avant, le pion capte le clic dans la bande.
      t = sonde({ deplacables: undefined });
      t.clic(5.5, 0.3);
      egal(t.journal.clics, ['creature:c1'], 'sans option : le pion capte le clic comme avant');
      t.clic(5.5, -0.2);
      egal(t.journal.clics, ['creature:c1', 'porte:p1'], 'sans option : la porte reste cliquable dans le mur');
    } finally {
      globalThis.requestAnimationFrame = raf;
    }
  }],

  ['démarrage : salle de départ = la première du donjon, pas la dernière modifiée ; choix explicite respecté', () => {
    const { d, a, b, c } = donjonDeTest();
    d.salleActive = c.id; // dans le Donjon, la dernière salle modifiée (souvent la plus avancée)
    egal(p.salleDepart(d), a.id, 'salleDepart : la première');
    const pres = p.creerPresentation(d);
    egal([pres.salleCourante, pres.decouvertes], [a.id, [a.id]], 'par défaut : la première salle, découverte');
    const choisie = p.creerPresentation(d, { salleDepart: b.id });
    egal([choisie.salleCourante, choisie.decouvertes], [b.id, [b.id]], 'choix explicite');
    egal(p.creerPresentation(d, { salleDepart: 'inconnue' }).salleCourante, a.id, 'choix invalide : la première');
    egal(p.salleDepart({ salles: {} }), null, 'donjon sans salle');
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

export function executer() {
  return TESTS.map(([nom, test]) => {
    try {
      test();
      return { phrase: `présentation : ${nom}`, ecarts: [], resultat: null };
    } catch (err) {
      return { phrase: `présentation : ${nom}`, ecarts: [err.message], resultat: null };
    }
  });
}
