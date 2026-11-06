/**
 * Volumes en fausse 3D du thème peint : prismes (boîtes) et cylindres posés sur le sol, vus depuis le centre de la salle (perspective.js).
 * Ce sont les briques du lot 2 (objets) : un objet est un empilement de `prisme` et de `cylindre`, dessinés du plus loin au plus proche du centre.
 *
 *   const V = creerVolumes(vue);              vue : { cx, cy, kp, lum } de la salle (repère de la salle)
 *   const V = volumesLocaux(ctx);             idem, dans le repère local d'un objet (dessin appelé par le moteur : contexte translaté et tourné)
 *   V.haut(x, y, h)                           où tombe le point (x, y) monté à la hauteur h (1 = hauteur d'un mur)
 *   V.KP                                      facteur de perspective (0 : relief éteint, tout est à plat)
 *   V.auNiveau(ctx, h, dessin)                joue `dessin` à plat, agrandi comme tout ce qui est à la hauteur h (dessus d'un volume)
 *   V.prisme(ctx, r, pts, h0, h1, couleur, dessus, retrait)   boîte à base polygonale, de la hauteur h0 à h1 ; `dessus(ctx?)` dessine le plateau
 *   V.cylindre(ctx, r, cx, cy, rayon, h0, h1, couleur, dessus, cannelures)
 *   V.cerclage(ctx, cx, cy, rayon, h, h1)     trait en travers du flanc d'un cylindre
 *   V.ombrePied(ctx, tracer)                  ombre portée douce au pied d'un volume posé au sol
 *   V.lumiere(x, y, h, source)                déclare une source de lumière (ou une flamme) au point (x, y) monté à la hauteur h : elle est notée dans
 *                                             `etat.lumieres` en coordonnées de la salle (voir etat.js), pour la couche de lumière
 * `r` est le générateur de bruit.js (`alea(graine)`) ; `couleur` une teinte [h, s, l] (trait.js : `ton`).
 */
import { vueLocale, haut as hautVue, echelle as echelleVue, faceVisible, eclairage, composer, inverser, appliquer, IDENTITE } from '../../perspective.js';
import { etat } from './etat.js';
import { chemin, cercle, encre, trait, dl, dr, ton, centre } from './trait.js';

/**
 * Les volumes d'une vue. `versSalle` est la matrice qui ramène le repère de la vue à celui de la salle (l'identité quand la vue est celle de la salle) :
 * elle ne sert qu'à `lumiere`.
 */
export function creerVolumes(vue, versSalle = IDENTITE) {
  const echelle = (h) => echelleVue(vue, h);
  const haut = (x, y, h) => hautVue(vue, x, y, h);
  function auNiveau(ctx, h, dessin) {
    const s = echelle(h);
    ctx.save(); ctx.translate(vue.cx, vue.cy); ctx.scale(s, s); ctx.translate(-vue.cx, -vue.cy);
    dessin();
    ctx.restore();
  }
  function ombrePied(ctx, tracer) {
    ctx.save();
    ctx.shadowColor = 'rgba(6,4,2,0.6)'; ctx.shadowOffsetX = 4 * etat.dpr; ctx.shadowOffsetY = 5 * etat.dpr; ctx.shadowBlur = 6 * etat.dpr;
    tracer(); ctx.fillStyle = 'rgba(6,4,2,0.4)'; ctx.fill();
    ctx.restore();
  }
  // Volume à base polygonale : faces tournées vers le centre, puis le dessus (dessiné à plat puis mis à l'échelle de sa hauteur).
  function prisme(ctx, r, pts, h0, h1, c, dessus, retrait = 1) {
    const n = pts.length, g = centre(pts);
    const tp = pts.map(([x, y]) => [g[0] + (x - g[0]) * retrait, g[1] + (y - g[1]) * retrait]);
    const B = pts.map(([x, y]) => haut(x, y, h0)), S = tp.map(([x, y]) => haut(x, y, h1));
    if (h0 === 0) ombrePied(ctx, () => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); });
    if (vue.kp > 0) for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, [ax, ay] = pts[i], [bx, by] = pts[j];
      let nx = by - ay, ny = -(bx - ax);
      const l = Math.hypot(nx, ny) || 1;
      nx /= l; ny /= l;
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      if ((mx - g[0]) * nx + (my - g[1]) * ny < 0) { nx = -nx; ny = -ny; } // normale vers l'extérieur du volume
      if (!faceVisible(vue, pts[i], pts[j], [nx, ny])) continue;
      chemin(ctx, [B[i], B[j], S[j], S[i]], true, r, 0.3);
      const k = 0.8 + 0.3 * eclairage(vue, nx, ny);
      encre(ctx, dl(ctx, ...B[i], ...S[i], ton(c, k * 0.8), ton(c, k)), 1.2);
    }
    if (dessus && retrait === 1) auNiveau(ctx, h1, dessus);
    else {
      chemin(ctx, S, true, r, 0.4);
      encre(ctx, dl(ctx, S[0][0] - 10, S[0][1] - 10, S[0][0] + 20, S[0][1] + 20, ton(c, 1.25), ton(c, 0.95)), 1.4);
      if (dessus) dessus(S);
    }
  }
  // Cylindre debout : flanc ombré du côté du centre, puis le dessus.
  function cylindre(ctx, r, cx, cy, rad, h0, h1, c, dessus, cannelures = false) {
    const [bx, by] = haut(cx, cy, h0), [tx, ty] = haut(cx, cy, h1), rb = rad * echelle(h0), rt = rad * echelle(h1);
    if (h0 === 0) ombrePied(ctx, () => { ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 7); });
    const dx = tx - bx, dy = ty - by, L = Math.hypot(dx, dy);
    if (L > 0.4) {
      const a = Math.atan2(dy, dx), nx = -dy / L, ny = dx / L;
      ctx.beginPath(); ctx.arc(bx, by, rb, a + Math.PI / 2, a + Math.PI * 1.5); ctx.lineTo(tx - nx * rt, ty - ny * rt); ctx.lineTo(tx + nx * rt, ty + ny * rt); ctx.closePath();
      const kn = eclairage(vue, nx, ny), g = ctx.createLinearGradient(bx + nx * rb, by + ny * rb, bx - nx * rb, by - ny * rb);
      g.addColorStop(0, ton(c, 0.78 + 0.32 * kn)); g.addColorStop(0.5, ton(c, 0.95)); g.addColorStop(1, ton(c, 0.78 - 0.32 * kn));
      encre(ctx, g, 1.4);
      if (cannelures) {
        const a0 = a + Math.PI;
        ctx.beginPath();
        for (let k = -4; k <= 4; k++) { const b = a0 + k * 0.32; ctx.moveTo(bx + Math.cos(b) * rb, by + Math.sin(b) * rb); ctx.lineTo(tx + Math.cos(b) * rt, ty + Math.sin(b) * rt); }
        trait(ctx, 'rgba(40,36,30,0.35)', 0.8);
      }
    }
    auNiveau(ctx, h1, dessus || (() => { cercle(ctx, cx, cy, rad, r, 0.3); encre(ctx, dr(ctx, cx, cy, rad, ton(c, 1.3), ton(c, 0.9)), 1.4); }));
  }
  // Trait en travers du flanc d'un cylindre, à la hauteur h (cerclages des tonneaux).
  function cerclage(ctx, cx, cy, rad, h, h1) {
    const [bx, by] = haut(cx, cy, h), [tx, ty] = haut(cx, cy, h1), L = Math.hypot(tx - bx, ty - by);
    if (L < 0.4) return;
    const rr = rad * echelle(h), a = Math.atan2(ty - by, tx - bx);
    ctx.beginPath(); ctx.arc(bx, by, rr, a + Math.PI / 2, a + Math.PI * 1.5); trait(ctx, '#2e2a27', 2.4);
  }
  // Une source de lumière au point (x, y) élevé à la hauteur h ; (x, y) est dans le repère de la vue, la source notée dans celui de la salle.
  function lumiere(x, y, h, source) {
    const [px, py] = appliquer(versSalle, ...haut(x, y, h));
    etat.lumieres.push({ ...source, x: px, y: py });
  }
  return { vue, KP: vue.kp, echelle, haut, auNiveau, ombrePied, prisme, cylindre, cerclage, lumiere };
}

/**
 * Les volumes dans le repère LOCAL d'un objet (le contexte tel que le moteur le donne à `objets[type]`) : le centre de la salle et la lumière
 * y sont ramenés, les points élevés par `haut` sont donc des points de ce repère.
 */
export function volumesLocaux(ctx) {
  const m = ctx.getTransform?.();
  const courante = m && Number.isFinite(m.a) ? { a: m.a, b: m.b, c: m.c, d: m.d, e: m.e, f: m.f } : etat.base;
  const vers = composer(inverser(courante), etat.base); // repère de la salle → repère local
  return creerVolumes(vueLocale(etat.vue, etat.base, courante), inverser(vers));
}
