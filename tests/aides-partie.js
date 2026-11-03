/**
 * Aides communes aux tests d'une partie en cours (partie, passage, vue publique, stockage) : un donjon de trois salles
 * et une partie dont tout ce qui est secret porte une valeur sentinelle. Sans dépendance : marche sous Node et dans tests.html.
 */
import * as m from '../js/donjon.js';
import * as p from '../js/presentation.js';

const TEXTE_A = 'Salle de 8 par 8 cases, une porte au mur est en 3, une porte secrète au mur nord en B, un coffre caché en D4, deux personnages en B7 C7, un gobelin en F2, un pilier en E5.';
const TEXTE_B = 'Salle de 6 par 6 cases, une porte au mur ouest en 3, une porte au mur sud en C, un coffre en A1.';
const TEXTE_C = 'Salle de 4 par 4 cases, une porte au mur nord en B, un coffre en D4.';

/** Trois salles : A (entrée) —est/ouest— B —sud/nord— C. A a un coffre caché et une porte cachée. */
export function donjonDeTest() {
  const d = m.creerDonjon({ nom: 'Crypte', texte: TEXTE_A });
  const a = d.salles[d.salleActive];
  const b = m.ajouterSalle(d, { nom: 'Couloir', texte: TEXTE_B });
  const c = m.ajouterSalle(d, { nom: 'Trésor', texte: TEXTE_C });
  m.relier(d, { salle: a.id, mur: 'est', position: 2 }, { salle: b.id, mur: 'ouest', position: 2 });
  m.relier(d, { salle: b.id, mur: 'sud', position: 2 }, { salle: c.id, mur: 'nord', position: 1 });
  return { d, a, b, c };
}

/** Présentation dont tout ce qui est secret porte une valeur sentinelle. */
export function presentationAvecSecrets() {
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
