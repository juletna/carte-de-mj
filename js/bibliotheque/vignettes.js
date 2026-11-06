/**
 * Vignettes des cartes de choix de l'onglet « Générer une carte » (zooms et styles). Module pur (aucun DOM).
 * `assets/exemples-cartes/<cle>.webp` quand Julien y a déposé une vraie image générée (voir le README de ce dossier) ;
 * sinon une vignette de repli dessinée en SVG, simple et claire : vue cavalière pour le monde et le lieu, plateau en
 * trois-quarts avec une grille légère, palette ou trait pour chaque style. Clés : zoom-<niveau>, style-<id>.
 */

/** Les clés de vignette, dans l'ordre d'affichage. */
export const CLES_VIGNETTES = ['zoom-monde', 'zoom-lieu', 'zoom-plateau', 'style-peint-v2', 'style-parchemin-v1', 'style-peint-v1'];

/** Chemin de l'image d'exemple d'une clé (peut ne pas exister : l'appelant retombe alors sur le SVG). */
export const urlExemple = (cle) => `assets/exemples-cartes/${cle}.webp`;

/** Un pic de montagne vu de biais : flanc clair, flanc ombré, sommet enneigé. */
const pic = (x, y, l, h, c1 = '#8a8f9c', c2 = '#6c7280') => `<path d="M${x} ${y}l${l / 2} ${-h} ${l / 2} ${h}z" fill="${c1}"/><path d="M${x + l / 2} ${y - h}l${l / 2} ${h}h${-l / 3}z" fill="${c2}"/><path d="M${x + l / 2} ${y - h}l${-l * 0.14} ${h * 0.3} ${l * 0.14} ${-h * 0.08} ${l * 0.14} ${h * 0.08}z" fill="#fff"/>`;
/** Un arbre vu de biais : tronc et couronne ronde. */
const arbre = (x, y, r = 6, c = '#3f9a4a') => `<rect x="${x - 1.3}" y="${y}" width="2.6" height="${r * 0.9}" fill="#7a4e2a"/><circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/><circle cx="${x - r * 0.3}" cy="${y - r * 0.3}" r="${r * 0.45}" fill="#5cb85c" opacity=".7"/>`;
/** Une petite maison vue de biais : façade et toit. */
const maison = (x, y, l = 14) => `<rect x="${x}" y="${y}" width="${l}" height="${l * 0.6}" fill="#e8d3a8"/><path d="M${x - 2} ${y}l${l / 2 + 2} ${-l * 0.5} ${l / 2 + 2} ${l * 0.5}z" fill="#c8553d"/><rect x="${x + l * 0.4}" y="${y + l * 0.2}" width="${l * 0.2}" height="${l * 0.4}" fill="#7a4e2a"/>`;

const SVG = {
  'zoom-monde': `<rect width="160" height="90" fill="#7cc4e0"/>
    <path d="M18 62c-6-14 4-30 22-34 8-9 26-12 36-4 14-6 34 0 40 14 12 4 14 20 4 28-10 10-30 6-40 10-14 6-34 8-46 0-8-4-12-8-16-14z" fill="#7bbf6a" stroke="#2f6a3a" stroke-width="1.3"/>
    ${pic(52, 48, 18, 14)}${pic(66, 52, 16, 12)}${arbre(100, 40, 5)}${arbre(110, 46, 4.5)}${arbre(92, 52, 4.5)}${arbre(34, 54, 4.5)}
    <path d="M30 76q40 -8 60 -22t52 -14" fill="none" stroke="#c8553d" stroke-width="1.6" stroke-dasharray="3 3" stroke-linecap="round"/>
    <circle cx="142" cy="40" r="2.6" fill="#c8553d"/>`,
  'zoom-lieu': `<rect width="160" height="90" fill="#cfe9a8"/>
    <ellipse cx="38" cy="30" rx="30" ry="12" fill="#a9d47a"/>
    <path d="M0 62q30 -10 62 -2t98 -12v42h-160z" fill="#9ccc6a"/>
    <path d="M10 82q50 -26 100 -14t52 -20" fill="none" stroke="#e6c88a" stroke-width="6" stroke-linecap="round"/>
    ${pic(8, 34, 28, 20, '#a89a86', '#8a7c68')}${pic(30, 36, 22, 14, '#a89a86', '#8a7c68')}
    ${arbre(78, 36, 6)}${arbre(90, 42, 5.5)}${arbre(70, 46, 5.5)}${arbre(130, 60, 6)}${arbre(142, 66, 5)}
    ${maison(104, 38, 16)}${maison(124, 44, 13)}
    <path d="M60 60q8 -5 18 -1t14 6l-14 4z" fill="#7cc4e0"/>
    <circle cx="48" cy="72" r="3" fill="#c8553d"/>`,
  'zoom-plateau': `<rect width="160" height="90" fill="#9ccc6a"/>
    <path d="M0 55h160M0 70h160M0 85h160M0 40h160M0 25h160M0 10h160M20 0v90M40 0v90M60 0v90M80 0v90M100 0v90M120 0v90M140 0v90" stroke="#fff" stroke-opacity=".35" stroke-width=".8" fill="none"/>
    <rect x="0" y="40" width="160" height="20" fill="#e6c88a" opacity=".85"/>
    <rect x="8" y="6" width="40" height="22" fill="#e8d3a8" stroke="#6b4a2a" stroke-width="1.2"/><rect x="8" y="6" width="40" height="7" fill="#c8553d"/><rect x="24" y="17" width="8" height="11" fill="#7a4e2a"/>
    ${arbre(90, 20, 8)}${arbre(112, 18, 7)}${arbre(20, 72, 8)}${arbre(140, 74, 8)}
    <ellipse cx="70" cy="76" rx="9" ry="6" fill="#9a9a9a" stroke="#6a6a6a" stroke-width="1"/>    <rect x="102" y="64" width="9" height="14" fill="#c9c2b0" stroke="#7a7466" stroke-width="1"/>`,
  'style-peint-v2': `<rect width="160" height="90" fill="#bfe8f4"/>
    <path d="M0 64q40 -22 80 -6t80 -10v42h-160z" fill="#5cc05c" stroke="#1f2a44" stroke-width="2"/>
    <path d="M30 62l26 -34 26 34z" fill="#ff9f43" stroke="#1f2a44" stroke-width="2.4" stroke-linejoin="round"/><path d="M56 28l26 34h-14z" fill="#e0782a"/>
    <circle cx="116" cy="48" r="14" fill="#ffd93d" stroke="#1f2a44" stroke-width="2.4"/><rect x="113" y="60" width="6" height="14" fill="#a8683a" stroke="#1f2a44" stroke-width="2"/>
    <circle cx="116" cy="46" r="12" fill="#2fbf71" stroke="#1f2a44" stroke-width="2.4"/>
    <circle cx="20" cy="72" r="5" fill="#ff5d73" stroke="#1f2a44" stroke-width="2"/>`,
  'style-parchemin-v1': `<rect width="160" height="90" fill="#e8d5a6"/>
    <rect width="160" height="90" fill="#c9a96a" opacity=".18"/>
    <g fill="none" stroke="#5a3d1e" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round">
      <path d="M20 66l24 -34 22 34z"/><path d="M36 66l16 -22 22 22z" opacity=".8"/>
      <path d="M30 60l5 -8M38 60l6 -10M46 62l6 -9M54 62l5 -8M44 50l4 -6M58 54l4 -6" stroke-width="1"/>
      <path d="M96 70q18 -10 36 0t24 -6"/><path d="M98 78q18 -8 36 0t22 -4" opacity=".6"/>
      <path d="M104 40a8 8 0 1 0 0 .1z"/><path d="M104 48v10M124 36a7 7 0 1 0 0 .1z M124 43v9"/>
    </g>
    <path d="M0 0h160v90h-160z" fill="none" stroke="#a8884a" stroke-opacity=".5" stroke-width="6"/>`,
  'style-peint-v1': `<rect width="160" height="90" fill="#f3efe6"/>
    <path d="M0 60c20 -16 50 -8 70 -2s60 10 90 -6v38h-160z" fill="#7fae7a" opacity=".75"/>
    <path d="M0 46c30 -12 60 4 90 -4s50 -8 70 0v8c-30 -8 -50 2 -80 8s-60 -8 -80 -2z" fill="#7aa9c4" opacity=".6"/>
    <path d="M26 58l22 -30 22 30z" fill="#9a8a78" opacity=".8"/><path d="M48 28l22 30h-12z" fill="#6c5f52" opacity=".55"/>
    <circle cx="112" cy="44" r="13" fill="#4f8a4a" opacity=".8"/><circle cx="120" cy="50" r="9" fill="#6aa35c" opacity=".7"/>
    <ellipse cx="96" cy="26" rx="22" ry="8" fill="#e8b66a" opacity=".45"/>
    <path d="M10 76c30 -6 60 4 90 -2" fill="none" stroke="#3b5d78" stroke-opacity=".5" stroke-width="1.2"/>`,
};

/** Le SVG de repli d'une clé (une chaîne `<svg …>…</svg>`, de proportions 16:9), ou null si la clé est inconnue. */
export function svgVignette(cle) {
  const corps = SVG[cle];
  return corps ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${corps}</svg>` : null;
}
