/**
 * Tests de la Présentation (presentation.js), de son stockage et de l'option `deplacables`
 * de deplacement.js. Sans dépendance : marche sous Node et dans tests.html.
 * Chaque test lève une Error au premier écart ; executer() renvoie la même forme que les autres.
 */
import * as m from '../js/donjon.js';
import * as p from '../js/presentation.js';
import { activerDeplacement } from '../js/deplacement.js';
import { chargerPresentations, sauverPresentations, chargerReglages, CLE_PRESENTATIONS, CLE_REGLAGES } from '../js/stockage.js';

function verifier(condition, message) { if (!condition) throw new Error(message); }
function egal(obtenu, attendu, quoi) {
  const a = JSON.stringify(obtenu), b = JSON.stringify(attendu);
  if (a !== b) throw new Error(`${quoi} : attendu ${b}, obtenu ${a}`);
}
function fauxStock(initial = {}) {
  const donnees = { ...initial };
  return { donnees, getItem: (k) => (k in donnees ? donnees[k] : null), setItem: (k, v) => { donnees[k] = String(v); } };
}

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
  'SENT-LIAISON', 'SENT-CONNEXION', 'SENT-CONTENU-C', 'SENT-ID-PORTE-B',
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
  return { pres: p.creerPresentation(d), d, a, b, c };
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
