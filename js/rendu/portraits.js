/**
 * Portraits de monstres pour les pions : de petits dessins vectoriels faits pour ce projet (aucune image extérieure,
 * donc aucun souci de droits, et ça marche hors ligne).
 *
 * Chaque portrait se dessine dans un cercle de rayon 1 centré sur l'origine (x vers la droite, y vers le bas) ;
 * dessinerPortrait() s'occupe de l'échelle et du détourage. Un type sans portrait garde son abréviation.
 */

/** Trace un polygone, ou une forme aux coins arrondis par des courbes (`courbe`). */
function forme(ctx, points, remplissage, trait, epaisseur = 0.05) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  if (remplissage) { ctx.fillStyle = remplissage; ctx.fill(); }
  if (trait) { ctx.strokeStyle = trait; ctx.lineWidth = epaisseur; ctx.lineJoin = 'round'; ctx.stroke(); }
}
function ovale(ctx, x, y, rx, ry, remplissage, trait, epaisseur = 0.05) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  if (remplissage) { ctx.fillStyle = remplissage; ctx.fill(); }
  if (trait) { ctx.strokeStyle = trait; ctx.lineWidth = epaisseur; ctx.stroke(); }
}
function ligne(ctx, points, couleur, epaisseur = 0.05) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = couleur;
  ctx.lineWidth = epaisseur;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}
/** La même forme à gauche et, en miroir, à droite. */
function miroir(ctx, dessin) {
  dessin();
  ctx.save();
  ctx.scale(-1, 1);
  dessin();
  ctx.restore();
}
const ENCRE = '#17130f';

const PORTRAITS = {
  gobelin(ctx) {
    miroir(ctx, () => forme(ctx, [[0.32, -0.28], [0.95, -0.52], [0.5, 0.08]], '#5f8f3a', ENCRE));
    forme(ctx, [[-0.5, -0.42], [0.5, -0.42], [0.58, 0.05], [0.28, 0.6], [0, 0.72], [-0.28, 0.6], [-0.58, 0.05]], '#76a848', ENCRE);
    miroir(ctx, () => {
      forme(ctx, [[0.1, -0.12], [0.44, -0.24], [0.4, 0.02], [0.14, 0.05]], '#f0d13c', ENCRE, 0.04);
      ovale(ctx, 0.27, -0.09, 0.05, 0.07, ENCRE);
    });
    forme(ctx, [[0, -0.05], [0.1, 0.25], [-0.1, 0.25]], '#5f8f3a', ENCRE, 0.035);
    forme(ctx, [[-0.3, 0.36], [0.3, 0.36], [0.16, 0.52], [-0.16, 0.52]], ENCRE);
    miroir(ctx, () => forme(ctx, [[0.08, 0.36], [0.2, 0.36], [0.14, 0.47]], '#f4efe4'));
  },
  squelette(ctx) {
    forme(ctx, [[-0.3, 0.28], [0.3, 0.28], [0.24, 0.72], [-0.24, 0.72]], '#ded7c3', ENCRE);
    ovale(ctx, 0, -0.14, 0.6, 0.6, '#efe9d6', ENCRE);
    miroir(ctx, () => ovale(ctx, 0.25, -0.12, 0.17, 0.2, ENCRE));
    forme(ctx, [[0, 0.08], [0.09, 0.26], [-0.09, 0.26]], ENCRE);
    for (const x of [-0.16, -0.05, 0.06, 0.17]) ligne(ctx, [[x, 0.42], [x, 0.7]], ENCRE, 0.035);
    ligne(ctx, [[-0.26, 0.42], [0.26, 0.42]], ENCRE, 0.035);
    ligne(ctx, [[0.3, -0.56], [0.2, -0.42], [0.28, -0.34]], '#8d8672', 0.03);
  },
  orque(ctx) {
    miroir(ctx, () => forme(ctx, [[0.5, -0.18], [0.84, -0.3], [0.62, 0.08]], '#4f6b34', ENCRE));
    forme(ctx, [[-0.2, -0.86], [0.2, -0.86], [0.42, -0.4], [-0.42, -0.4]], ENCRE);
    forme(ctx, [[-0.55, -0.5], [0.55, -0.5], [0.66, 0.1], [0.55, 0.6], [0.2, 0.76], [-0.2, 0.76], [-0.55, 0.6], [-0.66, 0.1]], '#667f3e', ENCRE);
    miroir(ctx, () => {
      forme(ctx, [[0.05, -0.1], [0.5, -0.34], [0.5, -0.17], [0.08, 0.02]], '#3b4d24');
      ovale(ctx, 0.27, -0.03, 0.09, 0.06, '#e8592a', ENCRE, 0.025);
    });
    ovale(ctx, 0, 0.2, 0.2, 0.11, '#4f6b34', ENCRE, 0.035);
    forme(ctx, [[-0.38, 0.42], [0.38, 0.42], [0.3, 0.6], [-0.3, 0.6]], ENCRE);
    miroir(ctx, () => forme(ctx, [[0.16, 0.56], [0.32, 0.56], [0.28, 0.2]], '#f4efe4', ENCRE, 0.025));
  },
  araignee(ctx) {
    // Vue de dessus : huit pattes articulées, abdomen marqué, yeux rouges.
    miroir(ctx, () => {
      ligne(ctx, [[0.2, -0.28], [0.58, -0.62], [0.82, -0.42]], '#b7a6cc', 0.075);
      ligne(ctx, [[0.24, -0.16], [0.68, -0.26], [0.92, -0.04]], '#b7a6cc', 0.075);
      ligne(ctx, [[0.24, -0.04], [0.66, 0.08], [0.86, 0.36]], '#b7a6cc', 0.075);
      ligne(ctx, [[0.2, 0.06], [0.52, 0.36], [0.62, 0.68]], '#b7a6cc', 0.075);
    });
    ovale(ctx, 0, 0.32, 0.36, 0.44, '#3b2f45', ENCRE);
    forme(ctx, [[0, 0.1], [0.13, 0.32], [0, 0.56], [-0.13, 0.32]], '#c93a2f');
    ovale(ctx, 0, -0.2, 0.25, 0.25, '#4a3b55', ENCRE);
    miroir(ctx, () => {
      ovale(ctx, 0.08, -0.33, 0.055, 0.055, '#ff4b3a');
      ovale(ctx, 0.17, -0.23, 0.035, 0.035, '#ff4b3a');
      ligne(ctx, [[0.05, -0.44], [0.08, -0.56]], '#d8d0c0', 0.04);
    });
  },
  minotaure(ctx) {
    miroir(ctx, () => {
      forme(ctx, [[0.32, -0.42], [0.72, -0.42], [0.9, -0.8], [0.98, -0.34], [0.72, -0.16], [0.36, -0.2]], '#e6dcc1', ENCRE);
      forme(ctx, [[0.42, -0.14], [0.82, -0.04], [0.48, 0.1]], '#6d4525', ENCRE);
    });
    forme(ctx, [[-0.42, -0.54], [0.42, -0.54], [0.52, -0.05], [0.4, 0.34], [-0.4, 0.34], [-0.52, -0.05]], '#85562f', ENCRE);
    forme(ctx, [[-0.16, -0.56], [0.16, -0.56], [0.08, -0.26], [-0.08, -0.26]], '#3b2513');
    miroir(ctx, () => {
      forme(ctx, [[0.1, -0.2], [0.4, -0.3], [0.36, -0.08], [0.14, -0.06]], '#f0d13c', ENCRE, 0.035);
      ovale(ctx, 0.25, -0.15, 0.04, 0.06, ENCRE);
    });
    ovale(ctx, 0, 0.42, 0.4, 0.3, '#c9a27a', ENCRE);
    miroir(ctx, () => ovale(ctx, 0.17, 0.36, 0.07, 0.09, ENCRE));
    ctx.beginPath();
    ctx.arc(0, 0.56, 0.12, 0, Math.PI);
    ctx.strokeStyle = '#e8c547';
    ctx.lineWidth = 0.05;
    ctx.stroke();
  },
  spectre(ctx) {
    forme(ctx, [[-0.52, -0.3], [-0.3, -0.72], [0.3, -0.72], [0.52, -0.3], [0.62, 0.4], [0.82, 0.86], [0.42, 0.62], [0.22, 0.95], [0, 0.62], [-0.22, 0.95], [-0.42, 0.62], [-0.82, 0.86], [-0.62, 0.4]], '#bcd8e6', '#5d8aa3');
    forme(ctx, [[-0.3, -0.42], [0.3, -0.42], [0.36, 0.05], [0, 0.36], [-0.36, 0.05]], '#1d2a33');
    miroir(ctx, () => ovale(ctx, 0.15, -0.14, 0.085, 0.11, '#9ff0ff'));
    ovale(ctx, 0, 0.12, 0.07, 0.1, '#0a1014');
  },
};

export const aPortrait = (type) => Object.prototype.hasOwnProperty.call(PORTRAITS, type);

/** Dessine le portrait du type dans le cercle (cx, cy, r). @returns {boolean} faux si ce type n'a pas de portrait */
export function dessinerPortrait(ctx, type, cx, cy, r) {
  if (!aPortrait(type)) return false;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#2b2622';
  ctx.fill();
  ctx.translate(cx, cy);
  ctx.scale(r * 0.92, r * 0.92);
  PORTRAITS[type](ctx);
  ctx.restore();
  return true;
}
