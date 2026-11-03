/**
 * Modèles de donjon : des départs prêts à l'emploi. Module PUR (sans DOM ni stockage), testable sous Node.
 *
 * Deux sortes de modèles :
 *  - ceux de l'outil (`MODELES`), écrits ici comme le ferait un MJ : du texte et des liaisons ;
 *  - ceux du MJ : la copie d'un de ses donjons, gardée dans ce navigateur (voir stockage.js).
 * Partir d'un modèle crée toujours un donjon NEUF : le modèle n'est jamais modifié.
 */
import * as modele from './donjon.js';

/** `liens` : [salle, mur, position, salle, mur, position], positions comptées depuis 0 comme dans le plan. */
export const MODELES = [
  {
    id: 'eglise', nom: 'Église en croix', description: '3 salles : une nef en croix, sa sacristie et son clocher.',
    salles: [
      { nom: 'Nef', texte: 'Salle en croix de 12 par 16 cases, bras de 3 cases, bras en haut, une arche au mur sud en F, une porte au mur est en 6, une porte au mur nord en F, un autel au fond, 6 chaises, 4 colonnes, 4 torches.' },
      { nom: 'Sacristie', texte: 'Salle de 5 par 5 cases, une porte au mur ouest en 3, une table, une bibliotheque, un coffre.' },
      { nom: 'Clocher', texte: 'Salle en octogone de 7 par 7 cases, une porte au mur sud en D, un escalier.' },
    ],
    liens: [[0, 'est', 5, 1, 'ouest', 2], [0, 'nord', 5, 2, 'sud', 3]],
  },
  {
    id: 'crypte', nom: 'Petite crypte', description: '4 salles : des morts-vivants, un trésor et une porte secrète.',
    salles: [
      { nom: 'Descente', texte: 'Salle de 5 par 5 cases, une arche au mur nord en C, une porte au mur sud en C, un escalier, 2 torches.' },
      { nom: 'Galerie', texte: 'Salle en H de 9 par 9 cases, bras de 2 cases, une porte au mur nord en E, une porte secrète au mur est en 2, une porte au mur sud en E, 3 sarcophages, 4 squelettes.' },
      { nom: 'Caveau', texte: 'Salle de 7 par 6 cases, une porte au mur nord en D, un sarcophage, 2 statues, une goule, 2 coffres.' },
      { nom: 'Ossuaire', texte: 'Salle de 5 par 5 cases, une porte secrète au mur ouest en 2, 3 debris, un coffre.' },
    ],
    liens: [[0, 'sud', 2, 1, 'nord', 4], [1, 'sud', 4, 2, 'nord', 3], [1, 'est', 1, 3, 'ouest', 1]],
  },
  {
    id: 'cloitre', nom: 'Cloître', description: '3 salles : une galerie en O autour de sa cour, un réfectoire et un dortoir.',
    salles: [
      { nom: 'Cloître', texte: 'Salle en O de 12 par 12 cases, bras de 3 cases, une arche au mur sud en F, une porte au mur est en 6, une porte au mur nord en F, 2 statues, 4 torches.' },
      { nom: 'Réfectoire', texte: 'Salle de 8 par 5 cases, sol en bois, une porte au mur ouest en 3, 2 tables, 4 chaises, 2 tonneaux.' },
      { nom: 'Dortoir', texte: 'Salle de 8 par 5 cases, sol en bois, une porte au mur sud en D, 4 lits.' },
    ],
    liens: [[0, 'est', 5, 1, 'ouest', 2], [0, 'nord', 5, 2, 'sud', 3]],
  },
  {
    id: 'repaire', nom: 'Repaire gobelin', description: '3 salles : une entrée gardée, une salle commune en L et le trésor du chef.',
    salles: [
      { nom: 'Entrée gardée', texte: 'Salle de 6 par 5 cases, une arche au mur sud en C, une porte au mur nord en C, 2 torches, 2 gobelins.' },
      { nom: 'Salle commune', texte: 'Salle en L de 10 par 9 cases, bras de 4 cases, angle au sud ouest, une porte au mur sud en C, une porte au mur est en 7, une table, 4 tonneaux, 5 gobelins.' },
      { nom: 'Trésor du chef', texte: 'Salle de 6 par 6 cases, une porte au mur ouest en 3, un trone, 2 coffres, un hobgobelin, 2 orques.' },
    ],
    liens: [[0, 'nord', 2, 1, 'sud', 2], [1, 'est', 6, 2, 'ouest', 2]],
  },
];

/** Crée un donjon neuf à partir d'un modèle de l'outil. */
export function donjonDepuisModele(m) {
  const [premiere, ...suite] = m.salles;
  const d = modele.creerDonjon({ nom: m.nom, texte: premiere.texte });
  const ids = [d.salleActive];
  modele.renommerSalle(d, ids[0], premiere.nom);
  for (const s of suite) ids.push(modele.ajouterSalle(d, { nom: s.nom, texte: s.texte }).id);
  for (const [a, murA, posA, b, murB, posB] of m.liens) {
    modele.relier(d, { salle: ids[a], mur: murA, position: posA }, { salle: ids[b], mur: murB, position: posB });
  }
  return d;
}

/** Copie indépendante d'un donjon, sous un identifiant neuf : c'est ainsi qu'on garde un modèle et qu'on en repart. */
export function copieDonjon(d, { nom, idsPris = [] } = {}) {
  const copie = JSON.parse(JSON.stringify(d));
  copie.id = modele.idUnique('donjon', idsPris);
  if (nom) copie.nom = nom;
  return copie;
}
