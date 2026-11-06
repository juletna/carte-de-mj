/**
 * Vocabulaire de la bibliothèque de cartes (pur) : les niveaux et les milieux, avec leurs libellés français.
 * Source unique : l'appli le lit, et le skill generer-carte en recopie les valeurs dans son prompt.
 * Les identifiants (sans accents) sont ceux de bibliotheque/catalogue.json.
 */

/** Niveau d'une carte (une seule valeur par carte) : l'échelle dans les poupées russes. */
export const NIVEAUX = [
  { id: 'monde', libelle: 'Continent' },
  { id: 'region', libelle: 'Région' },
  { id: 'zone', libelle: 'Zone' },
  { id: 'localite', libelle: 'Localité' },
  { id: 'batiment', libelle: 'Bâtiment' },
  { id: 'souterrain', libelle: 'Souterrain' },
];

/** Milieux d'une carte (plusieurs possibles). */
export const MILIEUX = [
  { id: 'foret', libelle: 'Forêt' },
  { id: 'plaine', libelle: 'Plaine' },
  { id: 'montagne', libelle: 'Montagne' },
  { id: 'desert', libelle: 'Désert' },
  { id: 'eau', libelle: 'Eau' },
  { id: 'cote', libelle: 'Côte' },
  { id: 'marais', libelle: 'Marais' },
  { id: 'neige', libelle: 'Neige' },
  { id: 'ville', libelle: 'Ville' },
  { id: 'ruines', libelle: 'Ruines' },
  { id: 'souterrain', libelle: 'Souterrain' },
];

/** Précision de ce que recouvre chaque niveau (aide à l'écran et dans le prompt du skill). */
export const NIVEAUX_AIDE = {
  monde: 'continent ou monde entier',
  region: 'forêt, vallée, massif, royaume',
  zone: 'lieu extérieur à l’échelle des figurines',
  localite: 'village, ville, port',
  batiment: 'intérieur d’un bâtiment',
  souterrain: 'grotte, cave, galeries',
};

export const IDS_NIVEAUX = NIVEAUX.map((n) => n.id);
export const IDS_MILIEUX = MILIEUX.map((m) => m.id);

/** Libellé français d'un niveau, ou l'identifiant lui-même s'il est inconnu. */
export const libelleNiveau = (id) => NIVEAUX.find((n) => n.id === id)?.libelle ?? id;
/** Libellé français d'un milieu, ou l'identifiant lui-même s'il est inconnu. */
export const libelleMilieu = (id) => MILIEUX.find((m) => m.id === id)?.libelle ?? id;
