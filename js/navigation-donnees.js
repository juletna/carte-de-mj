/**
 * Barre de navigation commune : les liens et la page courante (logique pure, testée sous Node).
 * Le DOM est dans navigation.js.
 */

/** Les liens de la barre, dans l'ordre. `id` sert à marquer la page courante. */
export const LIENS = [
  { id: 'preparer', texte: 'Préparer', href: 'donjon.html', titre: 'Préparer : ton monde, ses lieux, tes donjons et tes salles' },
  { id: 'jouer', texte: 'Jouer', href: 'presentation.html', titre: 'Jouer à la table : régie du MJ et écran des joueurs' },
  { id: 'bibliotheque', texte: 'Bibliothèque', href: 'bibliotheque.html', titre: 'Les cartes illustrées et tes images importées' },
];

/** Clé du stockage local où l'atelier garde le dernier élément ouvert (le hash : `#monde=…&lieu=…` ou `#donjon=…&salle=…`). */
export const CLE_DERNIERE_ROUTE = 'carte-de-mj:atelier-derniere-route';
const CLE_UNIVERS = 'carte-de-mj:univers-v1';

/**
 * Où mène « Préparer » : le dernier élément ouvert de l'atelier (monde/lieu ou donjon/salle) ; sans historique, le premier monde
 * (le monde actif s'il existe) ; sinon `donjon.html` (le donjon actif). `lire(cle)` rend le texte stocké ou null (jamais d'exception ici).
 */
export function hrefPreparer(lire) {
  const sur = (cle) => { try { return lire(cle); } catch { return null; } };
  const derniere = sur(CLE_DERNIERE_ROUTE);
  if (typeof derniere === 'string' && /^#(?:monde|donjon)=[^&=]+(?:&(?:lieu|salle)=[^&=]+)?$/.test(derniere)) return `donjon.html${derniere}`;
  try {
    const u = JSON.parse(sur(CLE_UNIVERS) ?? 'null');
    const ids = u && typeof u.univers === 'object' && u.univers ? Object.keys(u.univers) : [];
    if (ids.length) return `donjon.html#monde=${encodeURIComponent(ids.includes(u.actif) ? u.actif : ids[0])}`;
  } catch { /* données illisibles : l'atelier se débrouille avec le donjon actif */ }
  return 'donjon.html';
}

export const LIEN_ACCUEIL = { id: 'accueil', texte: 'Carte de MJ', href: 'index.html' };
export const LIEN_FICHE = { id: 'fiche', texte: 'Fiche joueur', href: 'fiche.html', titre: 'La fiche de personnage d\'un joueur' };

/**
 * Quel lien est la page courante ? `chemin` : location.pathname ; `hash` : location.hash.
 * Renvoie un id de LIENS, 'accueil', 'fiche', ou null (page hors de la barre).
 */
export function pageCourante(chemin, hash = '') {
  const fichier = String(chemin).split('/').pop() || 'index.html';
  switch (fichier) {
    case 'index.html': return 'accueil';
    case 'fiche.html': return 'fiche';
    case 'donjon.html': return 'preparer'; // quel que soit le hash (#monde…, #donjon…)
    case 'impression.html': return 'preparer'; // on imprime un donjon
    case 'presentation.html': return 'jouer';
    case 'bibliotheque.html': return 'bibliotheque';
    default: return null;
  }
}
