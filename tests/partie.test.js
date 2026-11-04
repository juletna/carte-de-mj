/**
 * Tests de la partie en cours (js/partie.js, par la façade presentation.js) : création sur une copie du donjon, enregistrement et relecture,
 * révélations, masquage, notes de partie, état des pions, commandes improvisées, déplacement d'un pion depuis la table, salle de départ.
 * Sans dépendance : marche sous Node et dans tests.html.
 * Chaque test lève une Error au premier écart ; executer() renvoie la même forme que les autres.
 */
import * as m from '../js/donjon.js';
import * as p from '../js/presentation.js';
import { chargerPresentations, sauverPresentations } from '../js/stockage.js';
import { donjonDeTest, presentationAvecSecrets } from './aides-partie.js';
import { verifier, egal, fauxStock, executerSuite } from './mini-test.js';

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

  ['masquage : la table perd les monstres et/ou les objets, séparément ; la régie garde tout ; les pions des joueurs restent', () => {
    const { d, a } = donjonDeTest();
    const pres = p.creerPresentation(d);
    const plan = pres.donjon.salles[a.id].plan;
    plan.creatures.push({ id: 'c-pnj', type: 'garde', camp: 'pnj', x: 6, y: 6, taille: 1, numero: 1 });
    const avant = JSON.stringify(plan);
    const camps = () => [...new Set(p.vueTable(pres).creatures.map((k) => k.camp))].sort();
    const types = () => p.vueTable(pres).objets.map((o) => o.type);
    egal(camps(), ['monstre', 'pj', 'pnj'], 'au départ : tout est montré');
    egal(types(), ['pilier'], 'au départ : les objets visibles');

    verifier(p.definirMasque(pres, a.id, 'monstres', true), 'monstres masqués');
    egal(camps(), ['pj'], 'monstres et PNJ retirés, pions des joueurs gardés');
    egal(types(), ['pilier'], 'les objets ne bougent pas');
    verifier(p.definirMasque(pres, a.id, 'objets', true), 'objets masqués');
    egal(types(), [], 'objets retirés');
    egal(p.vueTable(pres).portes.length, 1, 'les portes restent');
    p.definirMasque(pres, a.id, 'monstres', false);
    egal(camps(), ['monstre', 'pj', 'pnj'], 'monstres remontrés seuls');
    egal(types(), [], 'les objets restent masqués');

    p.definirMasque(pres, a.id, 'monstres', true);
    egal(JSON.stringify(plan), avant, 'le plan de la régie n’est jamais touché');
    egal(p.planRegie(plan, []).creatures.length, plan.creatures.length, 'la régie dessine tous les pions');
    egal(p.planRegie(plan, []).objets.length, plan.objets.length, 'la régie dessine tous les objets');
    verifier(!p.definirMasque(pres, a.id, 'portes', true), 'catégorie inconnue refusée');
    verifier(!p.definirMasque(pres, 'salle-fantome', 'objets', true), 'salle inconnue refusée');
    p.definirMasque(pres, a.id, 'monstres', false);
    p.definirMasque(pres, a.id, 'objets', false);
    egal(pres.masques, {}, 'plus rien de masqué : plus d’entrée');
  }],

  ['masquage : chaque salle garde le sien et ses positions, jusque dans l’enregistrement ; une salle neuve montre tout', () => {
    const { d, a, b } = donjonDeTest();
    const pres = p.creerPresentation(d);
    const pion = pres.donjon.salles[a.id].plan.creatures.find((k) => k.camp === 'monstre');
    const place = (partie) => { const k = partie.donjon.salles[a.id].plan.creatures.find((c) => c.id === pion.id); return [k.x, k.y]; };
    verifier(p.deplacerPion(pres, a.id, pion.id, 5, 5), 'le pion bouge');
    p.definirMasque(pres, a.id, 'monstres', true);
    p.definirMasque(pres, a.id, 'objets', true);
    const vueDeA = JSON.stringify(p.vueTable(pres));

    p.afficherATable(pres, b.id);
    verifier(p.vueTable(pres).objets.length > 0, 'la salle B montre ses objets');
    p.definirMasque(pres, b.id, 'objets', true);
    egal(p.vueTable(pres).objets, [], 'masqués dans B');
    p.afficherATable(pres, a.id);
    egal(JSON.stringify(p.vueTable(pres)), vueDeA, 'retour dans A : comme au départ');
    egal(place(pres), [5, 5], 'le pion masqué garde sa place');

    const stock = fauxStock();
    verifier(sauverPresentations({ [d.id]: pres }, stock), 'enregistré');
    const relu = chargerPresentations(stock)[d.id];
    egal(relu.masques, { [a.id]: ['monstres', 'objets'], [b.id]: ['objets'] }, 'relu par salle');
    egal(JSON.stringify(p.vueTable(relu)), vueDeA, 'après rechargement : la même table');
    egal(place(relu), [5, 5], 'après rechargement : la même place');

    const secrete = pres.donjon.salles[a.id].plan.portes.find((q) => q.cache);
    const creee = p.creerSalleEtPasser(pres, a.id, secrete.id, '');
    verifier(creee.ok, 'salle créée derrière la porte');
    egal(p.estMasque(pres, creee.vers, 'monstres') || p.estMasque(pres, creee.vers, 'objets'), false, 'salle créée en jeu : rien de masqué');
  }],

  ['masquage : compat et valeurs absurdes (partie sans masques ; salle, catégorie ou forme inconnues écartées)', () => {
    const { d, a, b } = donjonDeTest();
    const ancienne = JSON.parse(JSON.stringify(p.creerPresentation(d)));
    delete ancienne.masques;
    const v = p.validerPresentation(ancienne);
    verifier(v.ok, v.erreurs.join(' '));
    egal(v.presentation.masques, {}, 'absent → rien de masqué');
    verifier(p.vueTable(v.presentation).objets.length > 0 && p.vueTable(ancienne).objets.length > 0, 'tout reste visible');
    egal(p.estMasque(ancienne, a.id, 'objets'), false, 'lu sans le champ');
    verifier(p.definirMasque(ancienne, a.id, 'objets', true), 'le champ se crée au premier masquage');
    const piege = JSON.parse(JSON.stringify(p.creerPresentation(d)));
    piege.masques = { [a.id]: ['objets', 'portes', 'objets', 3], [b.id]: 'monstres', 'salle-fantome': ['objets'] };
    egal(p.validerPresentation(piege).presentation.masques, { [a.id]: ['objets'] }, 'seul ce qui est valide reste');
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

  ['sauvegarde : les avertissements du donjon remontent, la liste est toujours là', () => {
    const { d } = donjonDeTest();
    const pres = p.creerPresentation(d);
    egal(p.validerPresentation(JSON.parse(JSON.stringify(pres))).avertissements, [], 'une partie normale : rien à dire');
    const abimee = JSON.parse(JSON.stringify(pres));
    abimee.donjon.personnages = 'tous';
    const v = p.validerPresentation(abimee);
    verifier(v.ok, 'relue malgré tout');
    egal(v.avertissements, ['personnages ignorés : ce n’est pas une liste'], 'l’avertissement du donjon est remonté');
    for (const refus of [null, { ...pres, format: 'autre' }, { ...pres, donjon: { format: 'x' } }]) {
      const r = p.validerPresentation(refus);
      verifier(!r.ok && Array.isArray(r.avertissements) && r.avertissements.length === 0, 'une partie refusée : liste vide, pas absente');
    }
  }],
];

export const executer = () => executerSuite('présentation : ', TESTS);
