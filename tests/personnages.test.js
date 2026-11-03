/**
 * Tests des fiches de personnage associées au donjon (js/personnages.js) et de leur pion en partie.
 * Sans dépendance : marche sous Node et dans tests.html.
 */
import * as m from '../js/donjon.js';
import * as p from '../js/presentation.js';
import { resumerFiche, ficheDepuisFichier, fichesDuNavigateur, validerPersonnages, ajouterPersonnage, retirerPersonnage, actualiserPersonnages } from '../js/personnages.js';
import { chargerFichesLocales, CLE_FICHES } from '../js/stockage.js';
import { validerPlan } from '../js/schema.js';

function verifier(condition, message) { if (!condition) throw new Error(message); }
function egal(obtenu, attendu, quoi) {
  const a = JSON.stringify(obtenu), b = JSON.stringify(attendu);
  if (a !== b) throw new Error(`${quoi} : attendu ${b}, obtenu ${a}`);
}
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
    verifier(!('personnages' in m.validerDonjon(JSON.parse(JSON.stringify(d))).donjon), 'pas de champ ajouté');
    ajouterPersonnage(d, resumerFiche(FICHE), 'loc1');
    const relu = m.validerDonjon(JSON.parse(JSON.stringify(d))).donjon;
    egal(relu.personnages, d.personnages, 'relues');
    const abime = { ...JSON.parse(JSON.stringify(d)), personnages: [3, { fiche: 'x' }, { id: '<b>', fiche: { name: 'Ok', stats: {} } }] };
    const propre = m.validerDonjon(abime).donjon.personnages;
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
];

export function executer() {
  return TESTS.map(([nom, test]) => {
    try {
      test();
      return { phrase: `personnages : ${nom}`, ecarts: [], resultat: null };
    } catch (err) {
      return { phrase: `personnages : ${nom}`, ecarts: [err.message], resultat: null };
    }
  });
}
