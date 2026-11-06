/**
 * Vocabulaire de la bibliothèque de cartes (pur) : les niveaux (zooms) et les milieux, avec leurs libellés français.
 * Source unique : l'appli le lit, et le skill generer-carte en recopie les valeurs dans son prompt.
 * Les identifiants (sans accents) sont ceux de bibliotheque/catalogue.json.
 */

/**
 * Zoom d'une carte (une seule valeur par carte, champ `niveau`), classé par phase de jeu et non par échelle géographique :
 * le monde (voyage), un lieu (exploration racontée), un plateau (jeu en cases avec figurines).
 */
export const NIVEAUX = [
  { id: 'monde', libelle: 'Monde' },
  { id: 'lieu', libelle: 'Lieu' },
  { id: 'plateau', libelle: 'Plateau' },
];

/** Sous-type d'un plateau (champ `sousType`, seulement sur un plateau) : il ne change que le prompt (chemins, murs, roche…). */
export const SOUS_TYPES = [
  { id: 'exterieur', libelle: 'Extérieur' },
  { id: 'interieur', libelle: 'Intérieur' },
  { id: 'souterrain', libelle: 'Souterrain' },
];
export const SOUS_TYPE_PAR_DEFAUT = 'exterieur';

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

/** Précision de ce que recouvre chaque zoom (aide à l'écran et dans le prompt du skill). */
export const NIVEAUX_AIDE = {
  monde: 'mappemonde, continent, archipel, pays : le voyage',
  lieu: 'désert, forêt, village, île : explorer et choisir où entrer',
  plateau: 'jeu en cases avec figurines, 1 case = 1,5 m',
};
export const SOUS_TYPES_AIDE = {
  exterieur: 'chemins, rochers, arbres, statues',
  interieur: 'toit retiré, murs, mobilier',
  souterrain: 'roche, galeries, salles',
};

export const IDS_NIVEAUX = NIVEAUX.map((n) => n.id);
export const IDS_SOUS_TYPES = SOUS_TYPES.map((t) => t.id);
export const IDS_MILIEUX = MILIEUX.map((m) => m.id);

/**
 * Anciens niveaux (six échelles) → zoom actuel, appliqués à la lecture de toute donnée venue d'avant : catalogue, images
 * importées, fichiers importés, entrées du skill. Rien n'est perdu : zone, bâtiment et souterrain deviennent un plateau
 * de sous-type extérieur, intérieur ou souterrain.
 */
export const ANCIENS_NIVEAUX = {
  region: { niveau: 'lieu' },
  localite: { niveau: 'lieu' },
  zone: { niveau: 'plateau', sousType: 'exterieur' },
  batiment: { niveau: 'plateau', sousType: 'interieur' },
  souterrain: { niveau: 'plateau', sousType: 'souterrain' },
};

/**
 * Ramène un couple { niveau, sousType } (ancien ou actuel) au vocabulaire actuel. Rend { niveau, sousType? } ou null si le niveau
 * est inconnu. Un plateau sans sous-type valide prend « extérieur » ; un autre zoom n'a jamais de sous-type.
 */
export function normaliserNiveau({ niveau, sousType } = {}) {
  const r = Object.hasOwn(ANCIENS_NIVEAUX, niveau) ? ANCIENS_NIVEAUX[niveau] : IDS_NIVEAUX.includes(niveau) ? { niveau } : null;
  if (!r) return null;
  if (r.niveau !== 'plateau') return { niveau: r.niveau };
  return { niveau: 'plateau', sousType: r.sousType ?? (IDS_SOUS_TYPES.includes(sousType) ? sousType : SOUS_TYPE_PAR_DEFAUT) };
}

/** Une entrée de carte dont le niveau est remis au vocabulaire actuel (copie), ou l'entrée telle quelle si le niveau est inconnu. */
export function migrerEntree(e) {
  if (!e || typeof e !== 'object') return e;
  const n = normaliserNiveau(e);
  if (!n) return e;
  const { sousType: _ancien, ...reste } = e;
  return { ...reste, ...n };
}

/** Libellé français d'un zoom (un ancien niveau est converti d'abord), ou l'identifiant lui-même s'il est inconnu. */
export const libelleNiveau = (id) => {
  const n = normaliserNiveau({ niveau: id })?.niveau ?? id;
  return NIVEAUX.find((x) => x.id === n)?.libelle ?? id;
};
/** Libellé du sous-type d'un plateau, ou l'identifiant lui-même. */
export const libelleSousType = (id) => SOUS_TYPES.find((t) => t.id === id)?.libelle ?? id;
/** Libellé complet du zoom d'une entrée : « Monde », « Lieu » ou « Plateau · Extérieur » (ancien niveau converti). */
export function libelleZoom(e) {
  const n = normaliserNiveau(e ?? {});
  if (!n) return libelleNiveau(e?.niveau);
  return n.sousType ? `${libelleNiveau(n.niveau)} · ${libelleSousType(n.sousType)}` : libelleNiveau(n.niveau);
}
/** Libellé français d'un milieu, ou l'identifiant lui-même s'il est inconnu. */
export const libelleMilieu = (id) => MILIEUX.find((m) => m.id === id)?.libelle ?? id;
