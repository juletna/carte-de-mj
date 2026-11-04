/**
 * Tests des fiches de personnage associées au donjon (js/personnages.js) et de leur pion en partie.
 * Sans dépendance : marche sous Node et dans tests.html.
 */
import * as m from '../js/donjon.js';
import { validerDonjon } from '../js/donjon-validation.js';
import * as p from '../js/presentation.js';
import { resumerFiche, ficheDepuisFichier, fichesDuNavigateur, validerPersonnages, validerJoueurs, ajouterPersonnage, retirerPersonnage, actualiserPersonnages } from '../js/personnages.js';
import { chargerFichesLocales, CLE_FICHES } from '../js/stockage.js';
import { validerPlan } from '../js/schema.js';
import { verifier, egal, executerSuite } from './mini-test.js';

const FICHE = {
  name: 'Elwyn', race: 'Demi-elfe', cls: 'Rôdeur', lvl: 3, hp: 20, hpMax: 28, tmp: 2, ac: 15, speed: 9, init: 3,
  stats: { FOR: 11, DEX: 16, CON: 13, INT: 10, SAG: 14, CHA: 12 }, conds: ['Empoisonné'],
  attacks: [{ n: 'Arc long', hit: 7, dmg: '1d8+3', note: '45 m', ammo: 'Flèches' }], inv: [{ n: 'Corde', q: 2, type: 'objet' }],
  log: [{ x: 'SECRET du joueur' }], rolls: [{ total: 12 }], sheet: 'x',
};
const donjon = () => m.creerDonjon({ nom: 'Crypte', texte: 'Salle de 6 par 6 cases, une porte au mur est en 3, un gobelin en A1.' });

const TESTS = [
  ['une fiche est résumée par liste blanche', () => {
    const f = resumerFiche(FICHE);
    egal([f.nom, f.classe, f.niveau, f.pv, f.pvMax, f.ca, f.stats.DEX, f.etats], ['Elwyn', 'Rôdeur', 3, 20, 28, 15, 16, ['Empoisonné']], 'les champs');
    egal(resumerFiche({ ...FICHE, hp: 10, exh: 4 }).pvMax, 14, 'épuisement 4 : le résumé garde les PV max réduits');
    egal(resumerFiche(resumerFiche({ ...FICHE, hp: 10, exh: 4 })).pvMax, 14, 'relire un résumé ne les divise pas deux fois');
    egal(resumerFiche({ ...FICHE, exh: 4, edition: '2024' }).pvMax, 28, 'en 2024, l’épuisement ne touche pas aux PV max');
    egal(resumerFiche({ ...FICHE, exh: 4, edition: 'libre' }).pvMax, 28, 'en mode libre non plus');
    egal(f.attaques, [{ nom: 'Arc long', toucher: 7, degats: '1d8+3', note: '45 m' }], 'les attaques');
    egal(f.sac, [{ nom: 'Corde', quantite: 2 }], 'le sac');
    verifier(!JSON.stringify(f).includes('SECRET'), 'le journal du joueur ne vient pas');
    egal(resumerFiche(f), f, 'relire un résumé le laisse tel quel');
    for (const brut of [null, 'x', {}, { name: 'Sans stats' }, { stats: 3 }]) egal(resumerFiche(brut), null, `refusé : ${JSON.stringify(brut)}`);
    egal(resumerFiche({ stats: {} }).nom, 'Personnage', 'nom par défaut');
    egal(resumerFiche({ stats: { FOR: 'x' } }).stats.FOR, 10, 'caractéristique illisible');
  }],
  ['les fichiers et le navigateur de l’outil Fiche sont lus', () => {
    egal(ficheDepuisFichier({ format: 'fiche-partie', version: 1, personnage: FICHE }).nom, 'Elwyn', 'fichier exporté');
    egal(ficheDepuisFichier(FICHE).nom, 'Elwyn', 'fiche brute');
    egal(ficheDepuisFichier({ format: 'fiche-partie', version: 2, personnage: FICHE }), null, 'version plus récente');
    const locales = fichesDuNavigateur({ actif: 'a', persos: { a: FICHE, b: { rien: 1 } } });
    egal(locales.map((l) => [l.source, l.fiche.nom]), [['a', 'Elwyn']], 'fiche abîmée écartée');
    egal(fichesDuNavigateur(null), [], 'rien');
    const stock = { getItem: (k) => (k === CLE_FICHES ? JSON.stringify({ persos: { a: FICHE } }) : null) };
    egal(chargerFichesLocales(stock).length, 1, 'lu dans le stockage');
    egal(chargerFichesLocales({ getItem: () => '{cassé' }), [], 'JSON cassé');
  }],
  ['les fiches restent avec le donjon : ajout, remplacement, actualisation, retrait', () => {
    const d = donjon();
    const a = ajouterPersonnage(d, resumerFiche(FICHE), 'loc1');
    egal(d.personnages.length, 1, 'ajoutée');
    ajouterPersonnage(d, resumerFiche({ ...FICHE, hp: 5 }), 'loc1');
    egal([d.personnages.length, d.personnages[0].fiche.pv], [1, 5], 'la même fiche est remplacée');
    const b = ajouterPersonnage(d, resumerFiche({ ...FICHE, name: 'Sans source' }));
    egal(d.personnages.length, 2, 'sans source : une de plus');
    egal(actualiserPersonnages(d, [{ source: 'loc1', fiche: resumerFiche({ ...FICHE, hp: 9 }) }]), 1, 'une actualisée');
    egal(d.personnages[0].fiche.pv, 9, 'nouvelle valeur');
    retirerPersonnage(d, b.id);
    retirerPersonnage(d, a.id);
    verifier(!('personnages' in d), 'plus aucune : le champ disparaît');
  }],
  ['un donjon garde ses fiches à la relecture, et un donjon sans fiche reste identique', () => {
    const d = donjon();
    verifier(!('personnages' in validerDonjon(JSON.parse(JSON.stringify(d))).donjon), 'pas de champ ajouté');
    ajouterPersonnage(d, resumerFiche(FICHE), 'loc1');
    const relu = validerDonjon(JSON.parse(JSON.stringify(d))).donjon;
    egal(relu.personnages, d.personnages, 'relues');
    const abime = { ...JSON.parse(JSON.stringify(d)), personnages: [3, { fiche: 'x' }, { id: '<b>', fiche: { name: 'Ok', stats: {} } }] };
    const propre = validerDonjon(abime).donjon.personnages;
    egal(propre.length, 1, 'seule la bonne reste');
    verifier(/^pj-/.test(propre[0].id), 'identifiant refait');
    egal(validerPersonnages('x'), [], 'mauvaise forme');
  }],
  ['aucune fiche ne part à la table', () => {
    const d = donjon();
    ajouterPersonnage(d, resumerFiche({ ...FICHE, name: 'SECRET-NOM' }), 'loc1');
    const pres = p.creerPresentation(d);
    egal(pres.donjon.personnages.length, 1, 'la partie les a');
    const idPerso = pres.donjon.personnages[0].id;
    p.poserPersonnage(pres, pres.salleCourante, idPerso);
    const vue = JSON.stringify([p.vueTable(pres), p.miniPlanTable(pres)]);
    verifier(!vue.includes('SECRET-NOM') && !vue.includes(idPerso) && !vue.includes('"fiche"'), 'ni nom, ni lien vers la fiche');
    verifier(p.vueTable(pres).creatures.some((k) => k.camp === 'pj'), 'mais le pion, oui');
  }],
  ['poser un personnage : sur le sol, une seule fois, et il change de salle', () => {
    const d = donjon();
    const b = m.ajouterSalle(d, { nom: 'Annexe', texte: 'Salle en croix de 8 par 8 cases, bras de 2 cases.' });
    ajouterPersonnage(d, resumerFiche(FICHE), 'loc1');
    const pres = p.creerPresentation(d);
    const id = pres.donjon.personnages[0].id;
    const depart = pres.salleCourante;
    egal(p.pionDuPersonnage(pres, id), null, 'pas encore posé');
    verifier(p.poserPersonnage(pres, depart, id).ok, 'posé');
    const pose = p.pionDuPersonnage(pres, id);
    egal([pose.salle, pose.pion.type, pose.pion.camp, pose.pion.taille], [depart, 'pj', 'pj', 1], 'un pion de joueur');
    verifier(p.poserPersonnage(pres, depart, id).ok, 'le reposer ne le double pas');
    egal(pres.donjon.salles[depart].plan.creatures.filter((k) => k.camp === 'pj').length, 1, 'un seul pion');
    verifier(p.poserPersonnage(pres, b.id, id).ok, 'dans une autre salle');
    egal(p.pionDuPersonnage(pres, id).salle, b.id, 'il a changé de salle');
    egal(pres.donjon.salles[depart].plan.creatures.filter((k) => k.camp === 'pj').length, 0, 'il a quitté la première');
    const plan = pres.donjon.salles[b.id].plan, k = plan.creatures[0];
    verifier(validerPlan(plan).ok, 'sur le sol de la croix');
    egal(validerPlan(plan).plan.creatures[0].fiche, id, 'le lien survit à la relecture');
    verifier(k.fiche === id, 'le lien');
    egal(p.poserPersonnage(pres, b.id, 'inconnu').ok, false, 'personnage inconnu');
    const pleine = m.creerDonjon({ texte: 'Salle de 1 par 1 cases, un gobelin en A1.' });
    ajouterPersonnage(pleine, resumerFiche(FICHE), 'x');
    const presPleine = p.creerPresentation(pleine);
    egal(p.poserPersonnage(presPleine, presPleine.salleCourante, presPleine.donjon.personnages[0].id).ok, false, 'plus de place');
  }],
  ['le pion suit le groupe et garde sa fiche ; la partie reprend les fiches du donjon', () => {
    const d = m.creerDonjon({ texte: 'Salle de 6 par 6 cases, une porte au mur est en 3.' });
    const a = d.salles[d.salleActive];
    const b = m.ajouterSalle(d, { texte: 'Salle de 6 par 6 cases, une porte au mur ouest en 3.' });
    m.relier(d, { salle: a.id, mur: 'est', position: 2 }, { salle: b.id, mur: 'ouest', position: 2 });
    ajouterPersonnage(d, resumerFiche(FICHE), 'loc1');
    const pres = p.creerPresentation(d);
    const id = pres.donjon.personnages[0].id;
    p.poserPersonnage(pres, a.id, id);
    p.passerPorte(pres, a.id, pres.donjon.salles[a.id].plan.portes[0].id, { groupe: true });
    egal(p.pionDuPersonnage(pres, id)?.salle, b.id, 'il a suivi');
    ajouterPersonnage(d, resumerFiche({ ...FICHE, name: 'Nouvelle' }), 'loc2');
    p.synchroniserPersonnages(pres, d);
    egal(pres.donjon.personnages.map((x) => x.fiche.nom), ['Elwyn', 'Nouvelle'], 'la partie voit la nouvelle fiche');
    verifier(pres.donjon.personnages !== d.personnages, 'copie');
    retirerPersonnage(d, d.personnages[1].id);
    retirerPersonnage(d, d.personnages[0].id);
    p.synchroniserPersonnages(pres, d);
    verifier(!('personnages' in pres.donjon), 'plus aucune');
    verifier(p.validerPresentation(JSON.parse(JSON.stringify(pres))).presentation, 'partie toujours valide');
  }],
  ['PV en régie : dégâts et soins bornés, PV temporaires d’abord, sans toucher à la fiche', () => {
    const d = donjon();
    ajouterPersonnage(d, resumerFiche(FICHE), 'loc1'); // 20/28, 2 temporaires
    const pres = p.creerPresentation(d);
    const id = pres.donjon.personnages[0].id;
    const avant = JSON.stringify(pres.donjon.personnages);
    egal(p.pvPersonnage(pres, id), { pv: 20, pvTemp: 2, pvMax: 28, enJeu: false }, 'au départ, ceux de la fiche');
    egal(p.changerPV(pres, id, -5), { pv: 17, pvTemp: 0, pvMax: 28, enJeu: true }, 'les temporaires partent d’abord');
    egal(p.changerPV(pres, id, -100).pv, 0, 'jamais sous 0');
    egal(p.changerPV(pres, id, 7).pv, 7, 'soins');
    egal(p.changerPV(pres, id, 100).pv, 28, 'jamais au-dessus du max');
    egal(JSON.stringify(pres.donjon.personnages), avant, 'la fiche n’est pas touchée');
    for (const montant of [0, 1.5, 'x', NaN]) egal(p.changerPV(pres, id, montant), null, `montant refusé : ${montant}`);
    egal(p.changerPV(pres, 'inconnu', -1), null, 'personnage inconnu');
    const [joueur] = p.ajouterJoueurs(pres, [{ nom: 'Mira' }]);
    egal(p.pvPersonnage(pres, joueur), null, 'un joueur sans fiche n’a pas de PV');
    egal(p.changerPV(pres, joueur, -1), null, 'ni de dégâts');
    p.changerPV(pres, id, -8);
    p.oublierPV(pres, id);
    egal(p.pvPersonnage(pres, id), { pv: 20, pvTemp: 2, pvMax: 28, enJeu: false }, 'retour aux PV de la fiche');
  }],
  ['PV en régie : ils survivent à la recopie des fiches et à la relecture, sans jamais partir à la table', () => {
    const d = donjon();
    ajouterPersonnage(d, resumerFiche({ ...FICHE, tmp: 0 }), 'loc1');
    const pres = p.creerPresentation(d);
    const id = pres.donjon.personnages[0].id;
    p.poserPersonnage(pres, pres.salleCourante, id);
    p.changerPV(pres, id, -7);
    p.synchroniserPersonnages(pres, d);
    egal(p.pvPersonnage(pres, id).pv, 13, 'la recopie des fiches ne les efface pas');
    const vue = JSON.stringify([p.vueTable(pres), p.miniPlanTable(pres)]);
    verifier(!vue.includes('pvEnJeu') && !vue.includes('"pv"') && !vue.includes(id), 'rien à la table');
    const brut = JSON.parse(JSON.stringify(pres));
    egal(p.pvPersonnage(p.validerPresentation(brut).presentation, id).pv, 13, 'relus');
    d.personnages[0].fiche = resumerFiche({ ...FICHE, hpMax: 10, hp: 10 });
    p.synchroniserPersonnages(pres, d);
    egal(p.pvPersonnage(pres, id).pv, 10, 'une fiche au max plus bas les plafonne');
    const ancienne = JSON.parse(JSON.stringify(pres));
    delete ancienne.pvEnJeu;
    egal(p.validerPresentation(ancienne).presentation.pvEnJeu, {}, 'partie sans PV en jeu');
    egal(p.pvPersonnage(ancienne, id).enJeu, false, 'lue sans le champ');
    verifier(p.changerPV(ancienne, id, -1), 'le champ se crée au premier changement');
    const piege = JSON.parse(JSON.stringify(pres));
    piege.pvEnJeu = { [id]: { pv: -3, pvTemp: 0 }, fantome: { pv: 1, pvTemp: 0 } };
    egal(p.validerPresentation(piege).presentation.pvEnJeu, {}, 'valeur absurde et personnage inconnu écartés');
  }],
  ['joueurs sans fiche : relus par liste blanche, avec un nom par défaut et des identifiants uniques', () => {
    egal(validerJoueurs('x'), [], 'mauvaise forme');
    const j = validerJoueurs([{ nom: '  Mira ', race: ' Elfe', classe: 'Barde ', secret: 'x' }, {}, 3, { nom: 42 }]);
    egal(j.map((x) => [x.nom, x.race, x.classe]), [['Mira', 'Elfe', 'Barde'], ['Joueur 2', '', ''], ['42', '', '']], 'les champs');
    egal(new Set(j.map((x) => x.id)).size, 3, 'identifiants uniques');
    verifier(!JSON.stringify(j).includes('secret'), 'champ inconnu écarté');
    const ids = validerJoueurs([{ id: 'joueur-1', nom: 'A' }, { id: 'joueur-1', nom: 'B' }, { id: '<b>', nom: 'C' }]).map((x) => x.id);
    egal(ids[0], 'joueur-1', 'identifiant valide gardé');
    verifier(new Set(ids).size === 3 && ids.every((id) => /^[A-Za-z0-9_-]+$/.test(id)), `doublon et identifiant piégé refaits : ${ids}`);
    egal(validerJoueurs(Array.from({ length: 50 }, () => ({}))).length, 30, 'nombre borné');
    egal(validerJoueurs([{ nom: 'x'.repeat(200) }])[0].nom.length, 80, 'texte borné');
  }],
  ['joueurs sans fiche : chacun a son pion, sans fiche créée, et rien ne part à la table', () => {
    const d = donjon();
    const avant = JSON.stringify(d);
    const pres = p.creerPresentation(d);
    egal(pres.joueurs, [], 'aucun au départ');
    const ids = p.ajouterJoueurs(pres, [{ nom: 'SECRET-NOM', race: 'SECRET-RACE', classe: 'SECRET-CLASSE' }, { nom: 'Bran' }, {}, {}]);
    egal(ids.length, 4, 'quatre joueurs');
    egal(p.poserAuDepart(pres, ids), { poses: 4, restes: [] }, 'quatre pions');
    const plan = pres.donjon.salles[pres.salleCourante].plan;
    const pions = plan.creatures.filter((k) => k.camp === 'pj');
    egal(pions.map((k) => [k.type, k.numero, k.fiche]), ids.map((id, i) => ['pj', i + 1, id]), 'P1 à P4, dans l’ordre de saisie');
    egal(p.nomPersonnage(pres, ids[1]), 'Bran', 'le nom vient du joueur');
    egal(p.nomPersonnage(pres, ids[3]), 'Joueur 4', 'nom par défaut');
    egal(p.nomPersonnage(pres, 'inconnu'), null, 'inconnu');
    verifier(!('personnages' in pres.donjon), 'aucune fiche créée');
    egal(JSON.stringify(d), avant, 'le donjon préparé n’est pas touché');
    verifier(validerPlan(plan).ok, 'plan valide');
    const vue = JSON.stringify([p.vueTable(pres), p.miniPlanTable(pres)]);
    verifier(!vue.includes('SECRET') && !vue.includes(ids[0]) && !vue.includes('"fiche"'), 'ni nom, ni race, ni classe, ni lien');
    egal(p.vueTable(pres).creatures.filter((k) => k.camp === 'pj').length, 4, 'mais les pions, oui');
  }],
  ['joueurs sans fiche : ils suivent le groupe, restent après relecture et après la mise à jour des fiches', () => {
    const d = m.creerDonjon({ texte: 'Salle de 6 par 6 cases, une porte au mur est en 3.' });
    const a = d.salles[d.salleActive];
    const b = m.ajouterSalle(d, { texte: 'Salle de 6 par 6 cases, une porte au mur ouest en 3.' });
    m.relier(d, { salle: a.id, mur: 'est', position: 2 }, { salle: b.id, mur: 'ouest', position: 2 });
    const pres = p.creerPresentation(d);
    const [id] = p.ajouterJoueurs(pres, [{ nom: 'Mira', race: 'Elfe', classe: 'Barde' }]);
    p.poserAuDepart(pres, [id]);
    p.passerPorte(pres, a.id, pres.donjon.salles[a.id].plan.portes[0].id, { groupe: true });
    egal(p.pionDuPersonnage(pres, id)?.salle, b.id, 'il a suivi');
    verifier(p.poserPersonnage(pres, a.id, id).ok, 'on peut le ramener');
    egal(p.pionDuPersonnage(pres, id)?.salle, a.id, 'revenu');
    p.synchroniserPersonnages(pres, d);
    egal(pres.joueurs.length, 1, 'la mise à jour des fiches ne les efface pas');
    const relu = p.validerPresentation(JSON.parse(JSON.stringify(pres))).presentation;
    egal(relu.joueurs, pres.joueurs, 'relus');
    egal(p.pionDuPersonnage(relu, id)?.salle, a.id, 'le lien survit à la relecture');
    const ancienne = JSON.parse(JSON.stringify(pres));
    delete ancienne.joueurs;
    egal(p.validerPresentation(ancienne).presentation.joueurs, [], 'partie sans joueurs : liste vide');
    const [autre] = p.ajouterJoueurs(ancienne, [{ nom: 'Tard' }]);
    verifier(autre && p.nomPersonnage(ancienne, autre) === 'Tard', 'ajout sur une ancienne partie');
  }],
  ['retardataire : ajouté en cours de partie, pion suivant posé dans la salle consultée, sans toucher au reste, relu après enregistrement', () => {
    const d = m.creerDonjon({ texte: 'Salle de 6 par 6 cases, une porte au mur est en 3.' });
    const a = d.salles[d.salleActive];
    const b = m.ajouterSalle(d, { texte: 'Salle de 6 par 6 cases, une porte au mur ouest en 3.' });
    m.relier(d, { salle: a.id, mur: 'est', position: 2 }, { salle: b.id, mur: 'ouest', position: 2 });
    const pres = p.creerPresentation(d);
    const [premier] = p.ajouterJoueurs(pres, [{ nom: 'Mira' }]);
    p.poserAuDepart(pres, [premier]);
    p.passerPorte(pres, a.id, pres.donjon.salles[a.id].plan.portes[0].id, { groupe: true });
    const salle = pres.salleCourante;
    const res = p.ajouterRetardataire(pres, b.id, { nom: '  Tard  ', race: 'Nain', classe: 'Clerc' });
    verifier(res.ok && res.pose.ok, 'ajouté et posé');
    egal(res.nom, 'Tard', 'nom nettoyé');
    egal(pres.joueurs.map((j) => j.nom), ['Mira', 'Tard'], 'ajouté à la suite, le premier est intact');
    egal(pres.salleCourante, salle, 'la partie n’a pas bougé');
    egal(p.pionDuPersonnage(pres, premier)?.salle, b.id, 'le premier joueur est toujours là');
    egal(p.pionDuPersonnage(pres, res.id).pion.numero, 2, 'numéro de pion suivant (P2)');
    const relu = p.validerPresentation(JSON.parse(JSON.stringify(pres))).presentation;
    egal(relu.joueurs, pres.joueurs, 'joueurs relus');
    egal(p.pionDuPersonnage(relu, res.id)?.pion.numero, 2, 'pion relu');
    const autre = p.ajouterRetardataire(pres, a.id, {});
    egal(autre.nom, 'Joueur 3', 'nom vide : nom par défaut');
    egal(p.pionDuPersonnage(pres, autre.id)?.salle, a.id, 'posé dans la salle demandée');
    verifier(!p.ajouterRetardataire(pres, 'inconnue', { nom: 'X' }).pose.ok, 'salle inconnue : pose refusée');
  }],
  ['retardataire : sans place, il reste ajouté sans pion ; au maximum de joueurs, rien n’est ajouté', () => {
    const d = m.creerDonjon({ texte: 'Salle de 1 par 1 cases, un gobelin en A1.' });
    const pres = p.creerPresentation(d);
    const res = p.ajouterRetardataire(pres, pres.salleCourante, { nom: 'Sans place' });
    verifier(res.ok && !res.pose.ok && res.pose.message, 'ajouté, pose refusée avec un message');
    egal(pres.joueurs.map((j) => j.nom), ['Sans place'], 'le joueur reste');
    egal(p.pionDuPersonnage(pres, res.id), null, 'pas de pion');
    const pleine = p.creerPresentation(donjon());
    p.ajouterJoueurs(pleine, Array.from({ length: 30 }, (_, i) => ({ nom: `J${i}` })));
    const refus = p.ajouterRetardataire(pleine, pleine.salleCourante, { nom: 'De trop' });
    egal([refus.ok, pleine.joueurs.length], [false, 30], 'refusé au maximum');
  }],
  ['poser au départ : les fiches choisies seulement ; sans place, le nom de ceux qui restent', () => {
    const d = donjon();
    ajouterPersonnage(d, resumerFiche(FICHE), 'loc1');
    ajouterPersonnage(d, resumerFiche({ ...FICHE, name: 'Absent' }), 'loc2');
    const pres = p.creerPresentation(d);
    const [choisi, absent] = pres.donjon.personnages.map((x) => x.id);
    egal(p.poserAuDepart(pres, [choisi]), { poses: 1, restes: [] }, 'un seul');
    verifier(p.pionDuPersonnage(pres, choisi), 'choisi : posé');
    egal(p.pionDuPersonnage(pres, absent), null, 'pas choisi : pas de pion');
    const pleine = p.creerPresentation(m.creerDonjon({ texte: 'Salle de 1 par 1 cases, un gobelin en A1.' }));
    egal(p.poserAuDepart(pleine, p.ajouterJoueurs(pleine, [{ nom: 'Mira' }])), { poses: 0, restes: ['Mira'] }, 'plus de place');
  }],
];

export const executer = () => executerSuite('personnages : ', TESTS);
