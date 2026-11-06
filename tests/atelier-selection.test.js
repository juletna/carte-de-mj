/**
 * Tests de la sélection commune (js/atelier-selection.js, pur) et du contrat de l'inspecteur (js/atelier/inspecteur.js, avec une fabrique simulée).
 */
import * as u from '../js/univers.js';
import { creerDonjon, descripteur, supprimerElement } from '../js/donjon.js';
import { selection, selectionElement, meme, parent, position, retrouver, selectionValide } from '../js/atelier-selection.js';
import { creerInspecteur, TYPES_INSPECTEUR } from '../js/atelier/inspecteur.js';
import { verifier, egal, executerSuite } from './mini-test.js';

function exemple() {
  const univ = u.creerUnivers({ nom: 'Monde' });
  const lieu = u.ajouterLieu(univ, { nom: 'Forêt', image: { source: 'bibliotheque', id: 'f' } });
  const donjon = creerDonjon({ nom: 'Crypte', texte: 'Salle de 6 par 6 cases, une porte au nord, deux coffres, un gobelin' });
  const salle = donjon.salles[donjon.salleActive];
  const point = u.ajouterPoint(univ, lieu.id, { nom: 'Entrée', vers: { donjon: donjon.id } });
  const etat = { univers: { [univ.id]: univ }, donjons: { [donjon.id]: donjon } };
  const ctx = { monde: univ.id, lieu: lieu.id, donjon: donjon.id, salle: salle.id };
  return { univ, lieu, donjon, salle, point, etat, ctx };
}

/** Un élément minimal pour l'inspecteur, sans navigateur. */
function faux(tag) {
  const e = { tag, props: {}, enfants: [], ecouteurs: {}, hidden: false, textContent: '', open: false,
    append(...x) { this.enfants.push(...x); }, replaceChildren(...x) { this.enfants = x; },
    addEventListener(t, f) { this.ecouteurs[t] = f; }, click() { this.ecouteurs.click?.(); } };
  return e;
}
const fabrique = (tag, props = {}, ...enfants) => { const e = faux(tag); Object.assign(e, props); e.append(...enfants); return e; };
const textes = (e) => (typeof e === 'string' ? [e] : [e.textContent, ...e.enfants.flatMap(textes)]).filter(Boolean);

const TESTS = [
  ['meme : type, identifiant et contexte ; null seulement égal à null', () => {
    const { ctx } = exemple();
    verifier(meme(null, null), 'null = null');
    verifier(!meme(null, selection('salle', 's')), 'null ≠ sélection');
    verifier(meme(selection('salle', ctx.salle, ctx), selection('salle', ctx.salle, { ...ctx })), 'mêmes');
    verifier(!meme(selection('salle', 'a', ctx), selection('salle', 'b', ctx)), 'id différents');
    verifier(!meme(selection('salle', 'a', ctx), selection('donjon', 'a', ctx)), 'types différents');
    verifier(!meme(selection('salle', 'a', ctx), selection('salle', 'a', { ...ctx, lieu: 'autre' })), 'contextes différents');
    const porte = { genre: 'porte', mur: 'nord', position: 3 };
    verifier(meme(selectionElement(porte, ctx), selectionElement({ ...porte }, ctx)), 'descripteurs égaux');
    verifier(!meme(selectionElement(porte, ctx), selectionElement({ ...porte, position: 4 }, ctx)), 'descripteurs différents');
  }],
  ['parent : élément → salle → donjon → lieu → monde → rien ; point → lieu', () => {
    const { ctx } = exemple();
    const objet = selectionElement({ genre: 'objet', type: 'coffre', x: 1, y: 1 }, ctx);
    const salle = parent(objet);
    egal([salle.type, salle.id], ['salle', ctx.salle], 'objet → salle');
    const donjon = parent(salle);
    egal([donjon.type, donjon.id, donjon.contexte.salle], ['donjon', ctx.donjon, undefined], 'salle → donjon');
    const lieu = parent(donjon);
    egal([lieu.type, lieu.id], ['lieu', ctx.lieu], 'donjon → lieu');
    const monde = parent(lieu);
    egal([monde.type, monde.id], ['monde', ctx.monde], 'lieu → monde');
    egal(parent(monde), null, 'monde → rien');
    egal(parent(selection('donjon', 'd', {})), null, 'donjon hors monde → rien');
    egal(parent(selection('point', 'p', ctx)).id, ctx.lieu, 'point → son lieu');
    egal(parent(null), null, 'null');
    egal(position(salle), { ...ctx, salle: ctx.salle }, 'position');
    egal(position(monde), { monde: ctx.monde }, 'position du monde');
  }],
  ['retrouver : monde, lieu, point, donjon, salle et éléments du plan', () => {
    const { etat, univ, lieu, donjon, salle, point, ctx } = exemple();
    egal(retrouver(selection('monde', univ.id, { monde: univ.id }), etat) === univ, true, 'monde');
    egal(retrouver(selection('lieu', lieu.id, ctx), etat) === lieu, true, 'lieu');
    egal(retrouver(selection('point', point.id, ctx), etat) === point, true, 'point');
    egal(retrouver(selection('donjon', donjon.id, ctx), etat) === donjon, true, 'donjon');
    egal(retrouver(selection('salle', salle.id, ctx), etat) === salle, true, 'salle');
    const coffre = salle.plan.objets.find((o) => o.type === 'coffre');
    const sel = selectionElement(descripteur('objet', coffre), ctx);
    egal(retrouver(sel, etat).element === coffre, true, 'objet par descripteur');
    const porte = selectionElement(descripteur('porte', salle.plan.portes[0]), ctx);
    egal(retrouver(porte, etat).genre, 'porte', 'porte');
    const gobelin = salle.plan.creatures[0];
    egal(retrouver(selectionElement(descripteur('creature', gobelin), ctx, 'pion'), etat).element === gobelin, true, 'pion');
  }],
  ['objet disparu : déplacé puis supprimé, la sélection n’est plus valide', () => {
    const { etat, donjon, salle, ctx } = exemple();
    const coffre = salle.plan.objets.find((o) => o.type === 'coffre');
    const sel = selectionElement(descripteur('objet', coffre), ctx);
    verifier(selectionValide(sel, etat), 'valide au départ');
    const ancien = { ...salle.plan.objets[0] };
    // le plan est relu : de nouveaux objets, mais le même descripteur reste valable
    salle.plan = { ...salle.plan, objets: salle.plan.objets.map((o) => ({ ...o, id: `neuf-${o.id}` })) };
    verifier(selectionValide(sel, etat), 'valide après relecture du plan (ids changés)');
    // l'objet est déplacé : l'ancien descripteur ne désigne plus rien
    salle.plan = { ...salle.plan, objets: salle.plan.objets.map((o) => (o.type === 'coffre' && o.x === coffre.x && o.y === coffre.y ? { ...o, x: o.x + 1 } : o)) };
    verifier(!selectionValide(sel, etat), 'déplacé : plus valide');
    void ancien; void donjon; void supprimerElement;
    const sel2 = selectionElement(descripteur('objet', salle.plan.objets.find((o) => o.type === 'coffre')), ctx);
    verifier(selectionValide(sel2, etat), 'nouveau descripteur valide');
    salle.plan = { ...salle.plan, objets: [] };
    verifier(!selectionValide(sel2, etat), 'supprimé : plus valide');
  }],
  ['sélection invalide : null, type inconnu, salle ou donjon disparus', () => {
    const { etat, donjon, salle, ctx } = exemple();
    verifier(!selectionValide(null, etat), 'null');
    verifier(!selectionValide({ type: 'machin', id: 'x' }, etat), 'type inconnu');
    verifier(selectionValide(selection('salle', salle.id, ctx), etat), 'salle');
    verifier(!selectionValide(selection('salle', 'fantome', ctx), etat), 'salle disparue');
    delete etat.donjons[donjon.id];
    verifier(!selectionValide(selection('donjon', donjon.id, ctx), etat), 'donjon disparu');
    verifier(!selectionValide(selection('salle', salle.id, ctx), etat), 'salle d’un donjon disparu');
    verifier(!selectionValide(selection('point', 'fantome', ctx), etat), 'point disparu');
    verifier(!selectionValide(selection('lieu', 'fantome', ctx), etat), 'lieu disparu');
  }],
  ['inspecteur : en-tête (type, nom, résumé), actions visibles, menu « ⋯ » (secondaires, séparateur, destructives), défaut, doublon refusé', () => {
    const racine = faux('aside');
    let rendus = 0;
    const appels = [];
    const insp = creerInspecteur({ racine, fabrique, icone: () => faux('svg'), ctx: () => ({ donnee: 42 }), parDefaut: () => selection('donjon', 'd1') });
    egal(insp.corps.enfants.length, 0, 'au départ rien');
    egal(insp.afficher(null), null, 'rien d’enregistré : pas de panneau vide, un message');
    verifier(textes(insp.corps).join(' ').includes('Choisis'), 'message d’aide');
    insp.enregistrer('donjon', {
      titre: (sel, ctx) => `Donjon ${sel.id} ${ctx.donnee}`,
      resume: () => '3 salles · 2 personnages',
      renommer: (sel, valeur) => appels.push(`nom ${valeur}`),
      rendre: (conteneur) => { rendus++; conteneur.append(fabrique('p', { textContent: 'contenu' })); },
      actions: () => [{ libelle: 'Jouer', icone: 'jouer', executer: () => appels.push('jouer') }],
      menu: () => [{ libelle: 'Exporter', executer: () => appels.push('exporter') }],
      destructives: () => [{ libelle: 'Supprimer', executer: () => appels.push('supprimer') }],
    });
    egal(insp.afficher(null), 'donjon', 'sans sélection : le nœud actif');
    const [tete] = racine.enfants;
    const [identite, declencheur, menu] = tete.enfants;
    const [etiquette, champNom, titreFixe, resume] = identite.enfants;
    egal(etiquette.textContent, 'Donjon', 'étiquette de type, une seule fois');
    egal(insp.titre.textContent, 'Donjon d1 42', 'nom');
    egal([champNom.hidden, titreFixe.hidden], [false, true], 'renommable : le champ remplace le titre');
    egal(resume.textContent, '3 salles · 2 personnages', 'résumé');
    champNom.value = 'Crypte';
    champNom.ecouteurs.change();
    egal(rendus, 1, 'rendu');
    insp.rafraichir();
    egal([rendus, insp.corps.enfants.length], [2, 2], 'rafraîchi sans accumulation (actions, contenu)');
    const [actions] = insp.corps.enfants;
    egal(actions.enfants.length, 1, 'une action visible');
    actions.enfants[0].click();
    egal(declencheur.hidden, false, '« ⋯ » visible');
    egal(menu.enfants.map((e) => e.role ?? e.className.split(' ')[0]), ['atelier-menu-ligne', 'separator', 'atelier-menu-ligne'], 'secondaires, séparateur, destructives');
    const detruire = menu.enfants[2];
    verifier(detruire.className.includes('destructif'), 'destructif en rouge, en dernier');
    menu.enfants[0].click();
    detruire.click();
    egal(appels, ['nom Crypte', 'jouer', 'exporter', 'supprimer'], 'actions appelées');
    egal(insp.afficher(selection('salle', 's')), null, 'type non enregistré : message');
    egal(insp.titre.textContent, 'Rien à régler', 'titre du message');
    egal(declencheur.hidden, true, 'pas de « ⋯ » sans type');
    let leve = false;
    try { insp.enregistrer('donjon', { titre: () => '', rendre: () => {} }); } catch (e) { leve = /déjà enregistré/.test(e.message); }
    verifier(leve, 'un second enregistrement du même type est refusé');
    leve = false;
    try { insp.enregistrer('inconnu', { titre: () => '', rendre: () => {} }); } catch { leve = true; }
    verifier(leve, 'type inconnu refusé');
    egal(insp.enregistres(), ['donjon'], 'enregistrés');
    egal(TYPES_INSPECTEUR.length, 9, 'neuf types');
  }],
  ['inspecteur : une suppression se confirme en deux temps dans le menu', () => {
    const racine = faux('aside');
    const appels = [];
    const insp = creerInspecteur({ racine, fabrique, icone: () => faux('svg') });
    insp.enregistrer('salle', { titre: () => 'S', rendre: () => {}, destructives: () => [{ libelle: 'Supprimer la salle', confirmation: 'Sûr ?', executer: () => appels.push('x') }] });
    insp.afficher(selection('salle', 's'));
    const ligne = racine.enfants[0].enfants[2].enfants[0];
    ligne.click();
    egal(appels, [], 'le premier clic arme seulement');
    egal(ligne.enfants.at(-1).textContent, 'Sûr ?', 'le libellé de confirmation');
    ligne.click();
    egal(appels, ['x'], 'le second clic exécute');
  }],
  ['inspecteur : enregistrer le type affiché le redessine ; sans actions pas de « ⋯ » ; sans renommer, un titre', () => {
    const racine = faux('aside');
    const insp = creerInspecteur({ racine, fabrique, icone: () => faux('svg') });
    insp.afficher(selection('lieu', 'l1'));
    insp.enregistrer('lieu', { titre: () => 'Forêt', etiquette: () => 'Région', rendre: (c) => c.append(fabrique('p', { textContent: 'ok' })) });
    egal(insp.titre.textContent, 'Forêt', 'redessiné à l’enregistrement');
    const [identite, declencheur] = racine.enfants[0].enfants;
    egal(identite.enfants[0].textContent, 'Région', 'étiquette de la définition');
    egal([identite.enfants[1].hidden, identite.enfants[2].hidden], [true, false], 'pas renommable : titre simple');
    egal(declencheur.hidden, true, 'pas de « ⋯ »');
  }],
];

export async function executer() {
  return executerSuite('atelier (sélection, inspecteur) : ', TESTS);
}
