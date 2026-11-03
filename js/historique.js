/**
 * Historique d'annulation du Donjon : une pile par salle, en mémoire le temps de la session (pur, sans DOM).
 *
 * Chaque salle a sa pile d'anciennes descriptions. Une entrée { texte, ancres, liaisons } garde aussi la position des portes
 * reliées de la salle et les liaisons retirées, pour qu'annuler le déplacement ou la suppression d'une porte reliée ramène sa
 * liaison avec elle. La pile d'une salle est vidée quand le MJ reprend la main sur son texte, ou oubliée quand la salle (ou son
 * donjon) est supprimée ; changer de salle ne la perd pas, et ne peut jamais effacer un texte : annuler ne fait que remettre une
 * description que cette salle avait vraiment.
 */

/** Nombre d'entrées gardées par salle : au-delà, la plus ancienne est oubliée. */
export const PROFONDEUR_MAX = 100;

export function creerHistorique() {
  const piles = new Map();
  const cle = (idDonjon, idSalle) => `${idDonjon}/${idSalle}`;

  /** La pile (tableau, créé au besoin) d'une salle : `pop()` annule, `length = 0` la vide. */
  function pile(idDonjon, idSalle) {
    const k = cle(idDonjon, idSalle);
    if (!piles.has(k)) piles.set(k, []);
    return piles.get(k);
  }

  return {
    pile,
    /** Empile une entrée ; garde au plus PROFONDEUR_MAX entrées par salle. */
    memoriser(idDonjon, idSalle, entree) {
      const p = pile(idDonjon, idSalle);
      p.push(entree);
      if (p.length > PROFONDEUR_MAX) p.shift();
    },
    /** La salle n'existe plus : sa pile disparaît. */
    oublierSalle(idDonjon, idSalle) { piles.delete(cle(idDonjon, idSalle)); },
    /** Le donjon n'existe plus : les piles de toutes ses salles disparaissent. */
    oublierDonjon(idDonjon) {
      for (const k of [...piles.keys()]) if (k.startsWith(`${idDonjon}/`)) piles.delete(k);
    },
  };
}
