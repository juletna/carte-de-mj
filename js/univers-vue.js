/**
 * Petites règles pures de l'écran Monde (js/mj/univers-ui.js) : adresse d'ouverture directe, niveaux où l'on cale une grille,
 * genre d'une destination, nom d'un lieu créé depuis un point, durée d'une notification. Aucun DOM ici : testé sous Node.
 */

/** Niveaux de carte (identifiants de la bibliothèque) à l'échelle des figurines : seuls ceux-là reçoivent une grille calée. */
export const NIVEAUX_AVEC_GRILLE = ['zone', 'localite', 'batiment', 'souterrain'];

/** Peut-on caler une grille sur cette carte ? Un niveau absent (image importée) : oui ; continent et région : non. */
export function calagePossible(niveau) {
  if (niveau === undefined || niveau === null || niveau === '') return true;
  return NIVEAUX_AVEC_GRILLE.includes(niveau);
}

/** `#monde` → { id: null } ; `#monde=<id>` → { id } ; toute autre adresse → null. */
export function analyserHash(hash) {
  const m = /^#monde(?:=(.*))?$/.exec(String(hash ?? ''));
  if (!m) return null;
  let id = null;
  if (m[1]) { try { id = decodeURIComponent(m[1]) || null; } catch { id = null; } }
  return { id };
}

/** L'adresse qui ouvre l'écran Monde (sur ce monde si `id` est donné). */
export const hashMonde = (id) => (id ? `#monde=${encodeURIComponent(id)}` : '#monde');

/** L'adresse de la Présentation qui joue ce monde. */
export const lienJouer = (id) => `presentation.html?univers=${encodeURIComponent(id)}`;

/** Le genre d'une destination de point : '' (rien), 'carte' (un lieu) ou 'donjon'. */
export function genreDestination(vers) {
  if (!vers) return '';
  return vers.lieu !== undefined ? 'carte' : 'donjon';
}

/** Le nom d'un lieu créé depuis un point : celui du point s'il en a un, sinon le titre de l'image choisie. */
export function nomDuNouveauLieu(nomPoint, titreImage) {
  const p = String(nomPoint ?? '').trim();
  return p || String(titreImage ?? '').trim() || undefined;
}

/** Combien de temps une notification reste affichée (ms) : plus longtemps si elle propose une action ou signale une erreur. */
export function dureeNotification(texte, { erreur = false, action = false } = {}) {
  const lecture = 3000 + String(texte ?? '').length * 40 + (action ? 4000 : 0); // de quoi lire, et de quoi cliquer
  return Math.min(action ? 14000 : erreur ? 9000 : 6000, Math.max(3500, lecture));
}
