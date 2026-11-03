/**
 * Les quatre murs d'une salle et ce qui en découle : une seule source pour tout le site (pur, sans dépendance).
 * Les murs se nomment par leur point cardinal ; le nord est en haut de la carte, l'est à droite.
 */

export const MURS = ['nord', 'sud', 'est', 'ouest'];

/** Le mur d'en face. */
export const OPPOSE = { nord: 'sud', sud: 'nord', est: 'ouest', ouest: 'est' };

/** Rotation d'un objet qui regarde vers ce mur (0 nord, 90 est, 180 sud, 270 ouest) : « tourné vers le nord », vers l'entrée… */
export const REGARD_VERS = { nord: 0, est: 90, sud: 180, ouest: 270 };

/** Rotation d'un objet adossé à ce mur : dos au mur, il regarde vers l'intérieur de la salle (= REGARD_VERS du mur opposé). */
export const REGARD = { nord: 180, sud: 0, est: 270, ouest: 90 };

/** Pas en cases (x, y) pour s'éloigner d'une salle par ce mur : l'axe y descend vers le sud. */
export const VECTEUR = { nord: [0, -1], sud: [0, 1], est: [1, 0], ouest: [-1, 0] };

/** Les murs nord et sud courent le long de la largeur (leurs positions sont des colonnes) ; est et ouest, le long de la longueur. */
export const estHorizontal = (mur) => mur === 'nord' || mur === 'sud';

/** Les portes d'un plan, celles du mur d'entrée d'abord (à égalité, l'ordre du plan) : la première définit l'entrée pour le parseur. */
export const portesEntreeDabord = (plan) => [...plan.portes].sort((a, b) => (b.mur === plan.entree) - (a.mur === plan.entree));

/** Mur d'entrée tel que `decrire` le comprend : celui de la première porte (celle du mur d'entrée d'abord), sinon le sud. */
export const murEntree = (plan) => portesEntreeDabord(plan)[0]?.mur || 'sud';

/** Nombre de cases le long d'un mur, pour une salle de `largeur` × `longueur`. */
export const longueurMur = (mur, largeur, longueur) => (estHorizontal(mur) ? largeur : longueur);
