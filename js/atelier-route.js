/**
 * Les adresses de l'atelier (module PUR, sans DOM). Voir docs/conception-atelier.md §2.
 *   donjon.html#monde · #monde=<id> · #monde=<id>&lieu=<id> · #donjon=<id> · #donjon=<id>&salle=<id> · (rien : le donjon actif)
 * Route : { page: 'monde'|'donjon', monde?, lieu?, donjon?, salle? }. Les anciennes adresses (`#monde`, `#monde=<id>`) restent valides
 * et donnent les mêmes sorties qu'avant avec `analyserHash` / `hashMonde` (js/univers-vue.js).
 */
const decoder = (v) => { try { return decodeURIComponent(v) || null; } catch { return null; } };
const encoder = (v) => encodeURIComponent(v);

/**
 * Lit un hash. `#monde…` → page 'monde' (avec `monde` et `lieu` si présents), `#donjon…` → page 'donjon' (avec `donjon` et `salle`),
 * tout autre hash (vide, inconnu, mal formé) → { page: 'donjon' } : le donjon actif. Un champ mal encodé est ignoré.
 */
export function lireRoute(hash) {
  const t = String(hash ?? '').replace(/^#/, '');
  const champs = {};
  for (const morceau of t.split('&')) {
    if (!morceau) continue;
    const i = morceau.indexOf('=');
    const cle = i < 0 ? morceau : morceau.slice(0, i);
    if (!['monde', 'lieu', 'donjon', 'salle'].includes(cle) || cle in champs) continue;
    champs[cle] = i < 0 ? null : decoder(morceau.slice(i + 1));
  }
  const premier = t.split('&')[0].split('=')[0];
  if (premier === 'monde') {
    const r = { page: 'monde' };
    if (champs.monde) r.monde = champs.monde;
    if (champs.lieu && r.monde) r.lieu = champs.lieu;
    return r;
  }
  if (premier === 'donjon') {
    const r = { page: 'donjon' };
    if (champs.donjon) r.donjon = champs.donjon;
    if (champs.salle && r.donjon) r.salle = champs.salle;
    return r;
  }
  return { page: 'donjon' };
}

/** Écrit une route en hash. Une page 'donjon' sans donjon donne '' (l'adresse nue, `donjon.html`). Un lieu ou une salle sans parent est ignoré. */
export function ecrireRoute(route) {
  if (!route) return '';
  if (route.page === 'monde') {
    let h = '#monde';
    if (route.monde) { h += `=${encoder(route.monde)}`; if (route.lieu) h += `&lieu=${encoder(route.lieu)}`; }
    return h;
  }
  if (route.donjon) return `#donjon=${encoder(route.donjon)}${route.salle ? `&salle=${encoder(route.salle)}` : ''}`;
  return '';
}

/** Les routes sont-elles les mêmes ? */
export const memeRoute = (a, b) => ecrireRoute(a) === ecrireRoute(b);

/** La route d'une sélection ou d'une position { monde?, lieu?, donjon?, salle? } : monde/lieu → page monde, donjon/salle → page donjon. */
export function routeDe(pos = {}) {
  if (pos.donjon) return { page: 'donjon', donjon: pos.donjon, ...(pos.salle ? { salle: pos.salle } : {}) };
  if (pos.monde) return { page: 'monde', monde: pos.monde, ...(pos.lieu ? { lieu: pos.lieu } : {}) };
  return { page: 'donjon' };
}
