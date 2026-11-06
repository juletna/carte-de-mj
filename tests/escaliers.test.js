/**
 * Tests des escaliers et des niveaux : un escalier se relie comme une porte, mais vers une salle d'un autre niveau.
 * Parseur (« qui monte »), modèle (donjon.js, niveaux.js), validation, plan du donjon par niveaux, passage à la table,
 * vue des joueurs et impression. Sans dépendance : marche sous Node et dans tests.html.
 */
import * as m from '../js/donjon.js';
import * as p from '../js/presentation.js';
import { validerDonjon } from '../js/donjon-validation.js';
import { analyser } from '../js/parseur/index.js';
import { decrire } from '../js/parseur/decrire.js';
import { disposerPlan, cleDisposition } from '../js/plan-donjon.js';
import { preparerImpression, phrasesFeuilleMJ } from '../js/impression.js';
import { verifier, egal, executerSuite } from './mini-test.js';

function leve(f, morceau, quoi) {
  try { f(); } catch (e) { verifier(e.message.includes(morceau), `${quoi} : message « ${e.message} » sans « ${morceau} »`); return; }
  throw new Error(`${quoi} : aucune erreur levée`);
}

const escalier = (s) => s.plan.objets.find((o) => o.type === 'escalier');
/** Un donjon d'une salle avec un escalier qui descend en A1 et deux personnages. */
function donjonAvecEscalier(texte = 'Salle de 6 par 6 cases, un escalier en A1, deux personnages en E5 F5, une porte au mur est en 3.') {
  const d = m.creerDonjon({ nom: 'Tour', texte });
  return { d, haut: d.salles[d.salleActive] };
}

const TESTS = [
  ['parseur : « qui monte », « montant », « qui descend » ; sans rien, l’escalier descend', () => {
    const sens = (t) => analyser(`Salle de 6 par 6 cases, ${t}`).plan.objets.filter((o) => o.type === 'escalier').map((o) => o.sens ?? 'descend');
    egal(sens('un escalier qui monte'), ['monte'], 'qui monte');
    egal(sens('un escalier montant'), ['monte'], 'montant');
    egal(sens('deux escaliers qui montent'), ['monte', 'monte'], 'qui montent');
    egal(sens('un escalier qui descend'), ['descend'], 'qui descend');
    egal(sens('un escalier'), ['descend'], 'par défaut');
    egal(analyser('Salle de 6 par 6 cases, un escalier qui monte dans le coin nord-est').ignores, [], 'aucun mot ignoré');
  }],

  ['parseur : la description redit « qui monte » et se relit à l’identique', () => {
    const plan = analyser('Salle de 6 par 6 cases, un escalier qui monte, un escalier caché').plan;
    const texte = decrire(plan);
    verifier(/un escalier qui monte en [A-F]\d/.test(texte), `texte : ${texte}`);
    verifier(!/caché qui monte|qui monte caché/.test(texte), 'l’escalier caché descend');
    egal(analyser(texte).plan.objets.map((o) => [o.x, o.y, o.sens, o.cache]), plan.objets.map((o) => [o.x, o.y, o.sens, o.cache]), 'relu');
  }],

  ['salle en bas d’un escalier : un escalier qui monte, relié, un niveau plus bas', () => {
    const { d, haut } = donjonAvecEscalier();
    const { salle, liaison } = m.creerSalleDerriere(d, { depuis: m.extremite(haut.id, escalier(haut)) });
    verifier(escalier(salle)?.sens === 'monte', 'l’escalier du retour monte');
    verifier(/escalier qui monte/.test(salle.texte), 'écrit dans la description');
    egal(liaison.a, { salle: haut.id, escalier: true, x: 0, y: 0 }, 'extrémité de départ');
    egal(liaison.b, { salle: salle.id, escalier: true, x: escalier(salle).x, y: escalier(salle).y }, 'extrémité d’arrivée');
    egal(m.niveaux(d), { [haut.id]: 0, [salle.id]: -1 }, 'niveaux');
    verifier(m.liaisonDePorte(d, haut.id, escalier(haut))?.autre.salle === salle.id, 'liaison retrouvée par l’objet');
    leve(() => m.creerSalleDerriere(d, { depuis: m.extremite(haut.id, escalier(haut)) }), 'déjà relié', 'deux fois');
  }],

  ['salle en haut d’un escalier qui monte : un étage plus haut ; une porte garde le niveau', () => {
    const { d, haut: rdc } = donjonAvecEscalier('Salle de 6 par 6 cases, un escalier qui monte en A1, une porte au mur est en 3.');
    const { salle: etage } = m.creerSalleDerriere(d, { depuis: m.extremite(rdc.id, escalier(rdc)) });
    verifier(escalier(etage).sens === undefined, 'le retour descend');
    const { salle: voisine } = m.creerSalleDerriere(d, { depuis: { salle: rdc.id, mur: 'est', position: 2 } });
    const isolee = m.ajouterSalle(d, {});
    egal(m.niveaux(d), { [rdc.id]: 0, [etage.id]: 1, [voisine.id]: 0, [isolee.id]: 0 }, 'niveaux');
    egal([m.nomNiveau(0), m.nomNiveau(1), m.nomNiveau(-2)], ['Rez-de-chaussée', 'Étage 1', 'Sous-sol 2'], 'noms');
  }],

  ['relier un escalier à une salle existante : l’escalier du retour y est ajouté, la description réécrite', () => {
    const { d, haut } = donjonAvecEscalier();
    const cave = m.ajouterSalle(d, { nom: 'Cave', texte: 'Salle de 5 par 5 cases, un tonneau en C3.' });
    const { liaison, texteAvant } = m.relierASalle(d, m.extremite(haut.id, escalier(haut)), cave.id);
    egal(texteAvant, 'Salle de 5 par 5 cases, un tonneau en C3.', 'texte d’avant');
    const retour = escalier(cave);
    verifier(retour?.sens === 'monte' && /escalier qui monte/.test(cave.texte), 'escalier qui monte ajouté et écrit');
    verifier(cave.plan.objets.some((o) => o.type === 'tonneau' && o.x === 2 && o.y === 2), 'le tonneau reste en place');
    egal(liaison.b, { salle: cave.id, escalier: true, x: retour.x, y: retour.y }, 'relié à cet escalier');
    egal(m.niveaux(d)[cave.id], -1, 'la cave est en dessous');
  }],

  ['relier : jamais une porte à un escalier ; un escalier disparu laisse une liaison orpheline', () => {
    const { d, haut } = donjonAvecEscalier();
    const autre = m.ajouterSalle(d, { texte: 'Salle de 6 par 6 cases, un escalier qui monte en B2, une porte au mur ouest en 3.' });
    leve(() => m.relier(d, m.extremite(haut.id, escalier(haut)), { salle: autre.id, mur: 'ouest', position: 2 }), 'un escalier se relie à un autre escalier', 'mélange');
    leve(() => m.relier(d, { salle: haut.id, escalier: true, x: 3, y: 3 }, m.extremite(autre.id, escalier(autre))), 'aucun escalier en D4', 'escalier absent');
    const l = m.relier(d, m.extremite(haut.id, escalier(haut)), m.extremite(autre.id, escalier(autre)));
    m.definirTexte(d, autre.id, 'Salle de 6 par 6 cases.', m.planDepuisTexte('Salle de 6 par 6 cases.', autre.id));
    const orph = m.liaisonsOrphelines(d);
    egal(orph.map((o) => [o.liaison.id, o.salle, o.escalier, o.x, o.y]), [[l.id, autre.id, true, 1, 1]], 'orpheline');
    egal(m.nomExtremite(orph[0]), 'l’escalier en B2', 'nom de l’extrémité');
    egal(m.niveaux(d)[autre.id], -1, 'le niveau tient par l’escalier qui reste');
  }],

  ['déplacer l’escalier : la liaison suit ; le supprimer retire sa liaison ; annuler rétablit l’ancre', () => {
    const { d, haut } = donjonAvecEscalier();
    const { salle: bas } = m.creerSalleDerriere(d, { depuis: m.extremite(haut.id, escalier(haut)) });
    const ancres = m.ancresDeSalle(d, haut.id);
    const avant = haut.plan;
    const apres = { ...avant, objets: avant.objets.map((o) => (o.type === 'escalier' ? { ...o, x: 2, y: 1 } : o)) };
    egal(m.suivrePortesDeplacees(d, haut.id, avant, apres), 1, 'une extrémité suit');
    egal(d.liaisons[0].a, { salle: haut.id, escalier: true, x: 2, y: 1 }, 'nouvelle case');
    m.restaurerAncres(d, ancres);
    egal(d.liaisons[0].a, { salle: haut.id, escalier: true, x: 0, y: 0 }, 'ancre rétablie');
    const res = m.supprimerElement(d, bas.id, { genre: 'objet', type: 'escalier', x: escalier(bas).x, y: escalier(bas).y });
    verifier(res.liaisonsRetirees.length === 1 && d.liaisons.length === 0, 'liaison retirée avec l’escalier');
  }],

  ['validation : une liaison d’escaliers se relit ; mêlée à une porte ou hors de la salle, elle est écartée', () => {
    const { d, haut } = donjonAvecEscalier();
    const { salle: bas } = m.creerSalleDerriere(d, { depuis: m.extremite(haut.id, escalier(haut)) });
    const brut = JSON.parse(JSON.stringify(d));
    const r = validerDonjon(brut);
    verifier(r.ok, r.erreurs.join(' ; '));
    egal(r.donjon.liaisons, d.liaisons, 'liaison gardée telle quelle');
    egal(r.donjon.salles[bas.id].plan.objets.find((o) => o.type === 'escalier').sens, 'monte', 'le sens survit à la relecture');
    const melange = JSON.parse(JSON.stringify(d));
    melange.liaisons[0].b = { salle: bas.id, mur: 'nord', position: 0 };
    verifier(validerDonjon(melange).avertissements.some((a) => a.includes('une porte reliée à un escalier')), 'porte et escalier');
    const dehors = JSON.parse(JSON.stringify(d));
    dehors.liaisons[0].a.x = 40;
    verifier(validerDonjon(dehors).avertissements.some((a) => a.includes('escalier hors de la salle')), 'hors de la salle');
  }],

  ['plan du donjon : un niveau par bloc, du plus haut au plus bas, nommé ; aucun couloir pour un escalier', () => {
    const { d, haut } = donjonAvecEscalier();
    const seul = disposerPlan(d);
    verifier(seul.etiquettes === undefined, 'un seul niveau : rien de plus qu’avant');
    m.creerSalleDerriere(d, { depuis: { salle: haut.id, mur: 'est', position: 2 } });
    const { salle: bas } = m.creerSalleDerriere(d, { depuis: m.extremite(haut.id, escalier(haut)) });
    const plan = disposerPlan(d);
    egal(plan.etiquettes.filter((e) => e.niveau !== undefined).map((e) => [e.texte, e.niveau]), [['Rez-de-chaussée', 0], ['Sous-sol 1', -1]], 'niveaux nommés');
    egal(plan.couloirs.length, 1, 'seule la porte a un couloir');
    verifier(Object.keys(plan.positions).length === 3, 'toutes les salles sont posées');
    const sousSol = plan.etiquettes.find((e) => e.niveau === -1);
    verifier(plan.positions[bas.id].y > sousSol.y && plan.positions[haut.id].y < sousSol.y, 'le sous-sol est sous le rez-de-chaussée');
    verifier(plan.longueur >= plan.positions[bas.id].y + plan.positions[bas.id].longueur, 'le plan englobe tout');
    egal(plan.etiquettes.filter((e) => e.niveau === undefined), [], 'aucune salle « non reliée » : elle tient par son escalier');
    const cle = cleDisposition(d);
    escalier(bas).sens = undefined;
    verifier(cleDisposition(d) !== cle, 'le sens d’un escalier change la clé du plan');
  }],

  ['partie : descendre l’escalier, le groupe suit et arrive près de l’escalier du retour', () => {
    const { d, haut } = donjonAvecEscalier();
    const { salle: bas } = m.creerSalleDerriere(d, { depuis: m.extremite(haut.id, escalier(haut)) });
    const partie = p.creerPresentation(d);
    const idEscalier = escalier(partie.donjon.salles[haut.id]).id;
    egal(p.destinationPorte(partie, haut.id, idEscalier)?.salle.id, bas.id, 'destination');
    const res = p.passerPorte(partie, haut.id, idEscalier);
    verifier(res.ok && res.vers === bas.id && res.deplaces === 2, `passage : ${JSON.stringify(res)}`);
    const arrivee = escalier(partie.donjon.salles[bas.id]);
    for (const k of partie.donjon.salles[bas.id].plan.creatures) {
      verifier(Math.hypot(k.x + 0.5 - (arrivee.x + arrivee.l / 2), k.y + 0.5 - (arrivee.y + arrivee.h / 2)) < 2.5, `pion ${k.id} loin de l’escalier`);
    }
    egal(partie.salleCourante, bas.id, 'salle à la table');
  }],

  ['partie : un escalier non relié crée la salle décrite, avec l’escalier du retour s’il manque', () => {
    const { d, haut } = donjonAvecEscalier('Salle de 6 par 6 cases, un escalier qui monte en A1, un personnage en F6.');
    const partie = p.creerPresentation(d);
    const id = escalier(partie.donjon.salles[haut.id]).id;
    const res = p.creerSalleEtPasser(partie, haut.id, id, 'Salle de 5 par 4 cases, un coffre', { nom: 'Grenier' });
    verifier(res.ok, res.message);
    const grenier = res.salle;
    verifier(grenier.nom === 'Grenier' && escalier(grenier) && escalier(grenier).sens === undefined, 'escalier qui descend ajouté');
    verifier(grenier.plan.objets.some((o) => o.type === 'coffre'), 'le coffre décrit est là');
    egal(m.niveaux(partie.donjon)[grenier.id], 1, 'à l’étage');
    egal(partie.salleCourante, grenier.id, 'le groupe y est');
    const vide = p.creerPresentation(donjonAvecEscalier().d);
    const r2 = p.creerSalleApresPorte(vide, vide.donjon.salleActive, escalier(vide.donjon.salles[vide.donjon.salleActive]).id, '');
    verifier(r2.ok && escalier(r2.salle).sens === 'monte', 'sans description : 6 × 6 avec un escalier qui monte');
  }],

  ['table et impression : la table sait qu’un escalier monte ; la feuille du MJ cite les escaliers et leur niveau', () => {
    const { d, haut } = donjonAvecEscalier('Salle de 6 par 6 cases, un escalier qui monte en A1.');
    const { salle: etage } = m.creerSalleDerriere(d, { depuis: m.extremite(haut.id, escalier(haut)) });
    m.renommerSalle(d, etage.id, 'Combles');
    const partie = p.creerPresentation(d);
    egal(p.vueTable(partie).objets.map((o) => o.sens), ['monte'], 'vue de la table');
    const prep = preparerImpression(d, { version: 'mj' });
    const s = prep.salles.find((x) => x.plan.objets.some((o) => o.sens === 'monte')) || prep.salles[0];
    egal(s.liaisons.map(phrasesFeuilleMJ.liaison), [`Escalier en A1 → Plan 2 « Combles » (étage 1, escalier en ${['A', 'B', 'C', 'D', 'E', 'F'][escalier(etage).x]}${escalier(etage).y + 1})`], 'phrase');
    egal(s.marques.escaliersRelies, [{ x: 0, y: 0, vers: 2 }], 'repère sur le plan imprimé');
    egal(s.marques.portesReliees, [], 'pas de porte');
  }],
];

export const executer = () => executerSuite('escaliers et niveaux : ', TESTS);
