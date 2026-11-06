/**
 * Barre de navigation commune : les liens et la page courante (logique pure, testée sous Node).
 * Le DOM est dans navigation.js.
 */

/** Les liens de la barre, dans l'ordre. `id` sert à marquer la page courante. */
export const LIENS = [
  { id: 'monde', texte: 'Monde', href: 'donjon.html#monde', titre: 'Le monde : cartes imbriquées, continents, lieux' },
  { id: 'donjons', texte: 'Donjons', href: 'donjon.html', titre: 'Préparer un donjon, salle par salle' },
  { id: 'jouer', texte: 'Jouer', href: 'presentation.html', titre: 'Jouer à la table : régie du MJ et écran des joueurs' },
  { id: 'bibliotheque', texte: 'Bibliothèque', href: 'bibliotheque.html', titre: 'Les cartes illustrées et tes images importées' },
];
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
    case 'donjon.html': return /^#monde(?:$|[/?&=])/.test(hash) ? 'monde' : 'donjons';
    case 'impression.html': return 'donjons'; // on imprime un donjon
    case 'presentation.html': return 'jouer';
    case 'bibliotheque.html': return 'bibliotheque';
    default: return null;
  }
}
