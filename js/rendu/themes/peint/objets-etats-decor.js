/**
 * Les variantes du DÉCOR dans le thème peint : l'eau d'une fontaine (à sec, sombre, sacrée), l'état d'un autel (rituel, ensanglanté, sacré) et la
 * couverture d'un puits (couvert, à treuil). Ce sont des variantes déclarées au catalogue (catalogue.js : VARIANTES_FONTAINE, VARIANTES_AUTEL,
 * VARIANTES_PUITS) ; la première de chaque type (l'eau, l'autel simple, le puits ouvert) reste le dessin d'origine, dans objets.js et objets-dessines.js.
 * (Les couleurs de la bannière et du tapis ne sont pas ici : leur dessin lit sa teinte dans rendu/teintes-tissu.js.)
 *
 * Comme objets-etats.js, chaque variante est écrite UNE fois pour un « kit » de style (`K`, voir `creerKit` : sobres ou riches) : mêmes pièces, mêmes
 * hauteurs, même ordre de dessin et mêmes tirages de la graine de l'objet dans les deux styles ; seuls les tons et les détails changent.
 * Les sources de lumière (`V.lumiere`) sont déclarées dans les deux styles ; aucun Math.random.
 */
import { encre, trait, dr, rectPts, ENCRE } from './trait.js';
import { preparerObjet, face, COTES, traits, flamme } from './objets.js';
import { BRIQUES as B } from './objets-dessines.js';
import { rectC } from './objets-etats.js';

const TAU = Math.PI * 2;

/** Les points d'un polygone régulier à `n` côtés, de rayon R, centré en (cx, cy) : un disque assez rond pour un couvercle. */
const rond = (cx, cy, R, n = 20) => Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * TAU) * R, cy + Math.sin((i / n) * TAU) * R]);

/** Un disque plat en matière `mat` du kit (le dessus d'une vasque, d'une margelle). */
function disquePlat(K, ctx, V, cx, cy, R, mat, ep) {
  if (K.riche) { B.plaque(ctx, V, B.disque(cx, cy, R), K.MAT[mat].d, { ep }); return; }
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); encre(ctx, dr(ctx, cx, cy, R, K.MAT[mat].d[0], K.MAT[mat].d[1]), ep);
}

/** Trois reflets nets sur une surface : de petits arcs clairs dans le disque (cx, cy, R). */
function reflets(ctx, K, cx, cy, R, couleur) {
  for (const [a, b, l] of [[-0.5, -0.3, 0.5], [0.05, 0.25, 0.4], [-0.25, 0.5, 0.28]]) {
    ctx.beginPath(); ctx.moveTo(cx + a * R, cy + b * R * 0.8); ctx.quadraticCurveTo(cx + (a + l / 2) * R, cy + (b - 0.1) * R * 0.8, cx + (a + l) * R, cy + b * R * 0.8);
    ctx.lineCap = 'round'; trait(ctx, couleur, K.riche ? 1.4 : 1); ctx.lineCap = 'butt';
  }
}

/** Une étincelle à quatre branches (eau sacrée, lueur). */
function etincelle(ctx, x, y, R, couleur) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU - Math.PI / 2, rr = i % 2 ? R * 0.28 : R; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fillStyle = couleur; ctx.fill();
}

// --- La fontaine ----------------------------------------------------------------------------------------------

/** Les liquides : `fond` / `lis` / `om` pour les riches, `s` (dégradé) pour les sobres, un ton de reflet et de jet. */
const LIQUIDES = {
  sombre: { fond: '#8f8ac8', lis: 'rgba(238,228,255,0.5)', om: 'rgba(62,42,116,0.45)', s: ['#6e6aa6', '#2c3256'], reflet: '#d9d2f6', jet: '#a39ed4', tache: '#74b47e' },
  sacree: { fond: '#82ebe0', lis: 'rgba(255,255,255,0.75)', om: 'rgba(24,134,144,0.4)', s: ['#a4f4ec', '#2f9ea6'], reflet: '#ffffff', jet: '#f2fffc', tache: '#d8fff8' },
};

/** Une fontaine dont l'eau a changé : `mode` 'asec' | 'sombre' | 'sacree'. */
function fontaine(K, mode) {
  const L = LIQUIDES[mode], sec = mode === 'asec';
  return (ctx, w, h, t, o) => {
    const { V, r } = preparerObjet(ctx, o), R = Math.min(w, h) * 0.45, ri = R * 0.82, H1 = 0.16, niveau = H1 - (sec ? 0.1 : 0.05), ep = K.riche ? B.EP * 1.3 : 1.5;
    if (mode === 'sacree') { // la lueur au pied : deux anneaux clairs, avant tout le reste
      for (const [k, a] of [[1.32, 0.16], [1.12, 0.2]]) { ctx.beginPath(); ctx.arc(0, 0, R * k, 0, TAU); ctx.fillStyle = `rgba(160,248,238,${a})`; ctx.fill(); }
      V.lumiere(0, 0, 0.45, { r: t * 1.8, c: '120,232,226', k: 0.4 });
    }
    V.cylindre(ctx, r, 0, 0, R, 0, H1, K.MAT.marbre.f, () => {
      const rel = V.echelle(niveau) / V.echelle(H1), wx = V.vue.cx * (1 - rel), wy = V.vue.cy * (1 - rel);
      disquePlat(K, ctx, V, 0, 0, R, 'marbre', ep);
      ctx.beginPath(); ctx.arc(0, 0, R * 0.93, 0.2, 1.5); trait(ctx, K.riche ? B.MARBRE_VEINE : 'rgba(80,76,70,0.5)', 0.9);
      ctx.save(); ctx.beginPath(); ctx.arc(0, 0, ri, 0, TAU); ctx.clip();
      if (sec) {
        // Le bassin vide : la paroi de marbre, un fond de pierre sèche craquelé, des feuilles mortes.
        ctx.beginPath(); ctx.arc(0, 0, ri, 0, TAU); ctx.fillStyle = K.riche ? '#e0d6bf' : '#8a8578'; ctx.fill();
        const rf = ri * 0.95 * rel;
        if (K.riche) B.plaque(ctx, V, B.disque(wx, wy, rf), '#d2c3a0', { ep: B.EP, ombre: 'rgba(110,84,44,0.4)' });
        else { ctx.beginPath(); ctx.arc(wx, wy, rf, 0, TAU); encre(ctx, dr(ctx, wx, wy, rf, '#a9a190', '#6b665a'), 0.8); }
        ctx.beginPath();
        for (let i = 0; i < 4; i++) { // des fissures en zigzag, du bord vers le centre
          const a = r() * TAU + i * 1.5; let px = wx + Math.cos(a) * rf * 0.95, py = wy + Math.sin(a) * rf * 0.95;
          ctx.moveTo(px, py);
          for (let k = 0; k < 4; k++) { const b = a + Math.PI + (r() - 0.5) * 1.1, d = rf * (0.16 + r() * 0.12); px += Math.cos(b) * d; py += Math.sin(b) * d; ctx.lineTo(px, py); }
        }
        trait(ctx, K.riche ? B.JOINT : 'rgba(30,26,20,0.65)', K.riche ? 1.1 : 1);
        const feuilles = K.riche ? ['#d9822f', '#e8a63e', '#b8602a'] : ['#8a5a2a', '#6a4420', '#7a4a1e'];
        for (let i = 0; i < 5; i++) { // des feuilles mortes
          const a = r() * TAU, d = rf * (0.2 + r() * 0.55), fx = wx + Math.cos(a) * d, fy = wy + Math.sin(a) * d, ang = r() * 3;
          ctx.beginPath(); ctx.ellipse(fx, fy, R * 0.085, R * 0.045, ang, 0, TAU); encre(ctx, feuilles[i % 3], 0.6);
          ctx.beginPath(); ctx.moveTo(fx - Math.cos(ang) * R * 0.085, fy - Math.sin(ang) * R * 0.085); ctx.lineTo(fx + Math.cos(ang) * R * 0.07, fy + Math.sin(ang) * R * 0.07); trait(ctx, ENCRE, 0.5);
        }
      } else {
        const rw = ri * 0.95 * rel;
        if (K.riche) B.plaque(ctx, V, B.disque(wx, wy, rw), L.fond, { ep: B.EP, lisere: L.lis, ombre: L.om });
        else { ctx.beginPath(); ctx.arc(wx, wy, rw, 0, TAU); encre(ctx, dr(ctx, wx, wy, rw, L.s[0], L.s[1]), 0.8); }
        ctx.save(); ctx.beginPath(); ctx.arc(wx, wy, rw, 0, TAU); ctx.clip();
        if (mode === 'sombre') {
          for (let i = 0; i < 3; i++) { // des plaques de vase verdâtres, qui flottent
            const a = r() * TAU, d = rw * (0.2 + r() * 0.5), cx = wx + Math.cos(a) * d, cy = wy + Math.sin(a) * d, n = 8, pts = [];
            for (let k = 0; k < n; k++) { const b = (k / n) * TAU, rr = rw * (0.16 + r() * 0.12); pts.push([cx + Math.cos(b) * rr, cy + Math.sin(b) * rr * 0.7]); }
            K.poly2(ctx, pts, K.riche ? L.tache : '#4f7a58', 0.5);
          }
          for (let i = 0; i < 6; i++) { // des bulles
            const a = r() * TAU, d = rw * (0.15 + r() * 0.65), bx = wx + Math.cos(a) * d, by = wy + Math.sin(a) * d, br = R * (0.06 + r() * 0.06);
            ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fill(); trait(ctx, K.riche ? 'rgba(50,34,92,0.7)' : 'rgba(20,16,40,0.7)', 0.8);
            ctx.beginPath(); ctx.arc(bx - br * 0.3, by - br * 0.3, br * 0.25, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
          }
        } else {
          for (const k of [0.5, 0.78]) { ctx.beginPath(); ctx.arc(wx, wy, rw * k, 0.3, 4.2); trait(ctx, 'rgba(255,255,255,0.55)', 1); } // des cercles de lumière
          for (let i = 0; i < 4; i++) { const a = r() * TAU, d = rw * (0.25 + r() * 0.55); etincelle(ctx, wx + Math.cos(a) * d, wy + Math.sin(a) * d, R * (0.08 + r() * 0.05), '#fff'); }
        }
        reflets(ctx, K, wx, wy, rw, L.reflet);
        ctx.restore();
      }
      ctx.restore();
      ctx.beginPath(); ctx.arc(0, 0, ri, 0, TAU); trait(ctx, ENCRE, K.riche ? B.EP : 1.2);
    });
    V.cylindre(ctx, r, 0, 0, R * 0.14, niveau, 0.36, K.MAT.marbre.f, () => disquePlat(K, ctx, V, 0, 0, R * 0.14, 'marbre', 1));
    V.cylindre(ctx, r, 0, 0, R * 0.38, 0.36, 0.42, K.MAT.marbre.f, () => {
      disquePlat(K, ctx, V, 0, 0, R * 0.38, 'marbre', K.riche ? B.EP : 1.2);
      if (sec) { ctx.beginPath(); ctx.arc(0, 0, R * 0.3, 0, TAU); encre(ctx, K.riche ? '#d2c3a0' : '#8f8878', 0.8); ctx.beginPath(); ctx.moveTo(-R * 0.2, -R * 0.05); ctx.lineTo(-R * 0.05, R * 0.04); ctx.lineTo(R * 0.12, -R * 0.06); trait(ctx, K.riche ? B.JOINT : 'rgba(30,26,20,0.6)', 0.9); return; }
      if (K.riche) B.plaque(ctx, V, B.disque(0, 0, R * 0.3), L.fond, { ep: 0.9, bande: 1.6, lisere: L.lis, ombre: L.om });
      else { ctx.beginPath(); ctx.arc(0, 0, R * 0.3, 0, TAU); encre(ctx, dr(ctx, 0, 0, R * 0.3, L.s[0], L.s[1]), 0.8); }
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; ctx.beginPath(); ctx.arc(Math.cos(a) * R * 0.14, Math.sin(a) * R * 0.14, 1.3, 0, 7); ctx.fillStyle = L.reflet; ctx.fill(); }
    });
    if (sec) return; // plus de jet
    const [jx, jy] = V.haut(0, 0, 0.55);
    ctx.beginPath(); ctx.arc(jx, jy + R * 0.2, R * 0.2, Math.PI * 1.1, Math.PI * 1.9); trait(ctx, K.riche ? L.fond : L.s[1], mode === 'sombre' ? 2.6 : 3.4); trait(ctx, L.jet, mode === 'sombre' ? 1.1 : 1.4);
    if (mode === 'sacree') { etincelle(ctx, jx, jy - R * 0.1, R * 0.12, '#fff'); etincelle(ctx, jx + R * 0.26, jy + R * 0.08, R * 0.07, '#fff'); }
  };
}

// --- L'autel --------------------------------------------------------------------------------------------------

/** Les joints et les arêtes d'une maçonnerie, sur les quatre flancs de la forme (x, y, w, h) de z0 à z1. */
function maconnerie(K, ctx, V, x, y, w, h, z0, z1) {
  for (const c of COTES) {
    const F = face(V, x, y, w, h, c);
    if (K.riche) { B.joints(ctx, F, z0, z1, 3, 4); B.aretes(ctx, V, F, c, z0, z1); } else traits(ctx, F, z0, z1, 3, 'rgba(20,18,14,0.5)', 0.9);
  }
}

/** Un chandelier : un cierge crème de la hauteur z0 à z1 en (cx, cy), sa flamme et sa petite lumière si `allume`. */
function cierge(K, ctx, V, r, cx, cy, z0, z1, rr, t, allume) {
  V.cylindre(ctx, r, cx, cy, rr, z0, z1, [44, 40, 88], () => K.disque(ctx, cx, cy, rr, '#fffaf0', 0.8));
  if (!allume) return;
  V.lumiere(cx, cy, z1, { s: t * 0.06, r: t * 1.3, c: '255,190,110', k: 0.22, petite: true });
  flamme(ctx, V, cx, cy, z1, t * 0.045);
}

/** Les quatre états du dessus d'un autel ; `mode` 'rituel' | 'ensanglante' | 'sacre'. */
function autel(K, mode) {
  return (ctx, w, h, t, o) => {
    const { V, r } = preparerObjet(ctx, o), aw = w - t * 0.14, ah = h - t * 0.3, x = -aw / 2, y = -ah / 2, e0 = 0.24, e1 = 0.32;
    const sang = K.riche ? '#d6404a' : '#8e1c22', sangClair = K.riche ? '#ee7a7e' : '#b5383a';
    const tissu = mode === 'rituel' ? (K.riche ? '#9a6bc8' : '#5c3a7e') : (K.riche ? '#fbf6ea' : '#efe9da');
    if (mode === 'ensanglante') { // la flaque, sur le sol devant l'autel (avant les volumes, qui la recouvrent en partie)
      const fl = [];
      for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU, k = 0.8 + r() * 0.35; fl.push([-aw * 0.12 + Math.cos(a) * aw * 0.2 * k, ah / 2 + t * 0.06 + Math.sin(a) * t * 0.1 * k]); }
      K.poly2(ctx, fl, sang, K.riche ? 1 : 0.8);
      K.ligne(ctx, [[-aw * 0.2, ah / 2 + t * 0.09], [-aw * 0.1, ah / 2 + t * 0.07]], K.riche ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)', 1.3);
    }
    K.bloc(ctx, V, r, rectPts(x + t * 0.05, y + t * 0.04, aw - t * 0.1, ah - t * 0.08), 0, e0, mode === 'sacre' ? 'marbre' : 'pierre', undefined);
    maconnerie(K, ctx, V, x + t * 0.05, y + t * 0.04, aw - t * 0.1, ah - t * 0.08, 0, e0);
    // La dalle. Rituel et sacré y étendent une nappe ; l'autel ensanglanté reste de pierre nue, taché.
    K.bloc(ctx, V, r, rectPts(x, y, aw, ah), e0, e1, mode === 'sacre' ? 'marbre' : 'pierreClaire', () => {
      if (mode === 'ensanglante') {
        for (const [u, v, R, k] of [[0.3, 0.45, 0.2, 1], [0.58, 0.55, 0.14, 0.8], [0.8, 0.4, 0.1, 0.7]]) { // trois flaques, de la plus grande à la plus petite
          const n = 9, pts = [];
          for (let i = 0; i < n; i++) { const a = (i / n) * TAU, rr = R * ah * (0.7 + r() * 0.5); pts.push([x + aw * u + Math.cos(a) * rr * 1.5, y + ah * v + Math.sin(a) * rr]); }
          K.poly2(ctx, pts, sang, K.riche ? 0.9 : 0.7);
          ctx.beginPath(); ctx.ellipse(x + aw * u - R * ah * 0.4, y + ah * v - R * ah * 0.3, R * ah * 0.35 * k, R * ah * 0.17 * k, -0.3, 0, TAU); ctx.fillStyle = sangClair; ctx.fill();
        }
        return;
      }
      const bw = mode === 'rituel' ? 0.68 : 0.46;
      K.poly2(ctx, rectPts(x + aw * (1 - bw) / 2, y, aw * bw, ah), tissu, K.riche ? 1 : 0.9);
      K.ligne(ctx, [[x + aw * (1 - bw) / 2 + 2, y + 1], [x + aw * (1 - bw) / 2 + 2, y + ah - 1]], K.pal.or, 1.2);
      K.ligne(ctx, [[x + aw * (1 + bw) / 2 - 2, y + 1], [x + aw * (1 + bw) / 2 - 2, y + ah - 1]], K.pal.or, 1.2);
      if (mode === 'rituel') { // un cercle d'or et son étoile à cinq branches, tracés sur la nappe
        const Rr = Math.min(ah * 0.34, aw * 0.2);
        ctx.beginPath(); ctx.arc(0, 0, Rr, 0, TAU); trait(ctx, K.pal.or, K.riche ? 1.4 : 1.2);
        ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = ((i * 2) % 5 / 5) * TAU - Math.PI / 2, px = Math.cos(a) * Rr, py = Math.sin(a) * Rr; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
        trait(ctx, K.pal.or, K.riche ? 1.4 : 1.2);
      }
      if (mode === 'sacre') {
        const Rs = Math.min(ah * 0.17, aw * 0.1);
        for (let i = 0; i < 8; i++) { // le soleil : huit rayons pointus autour d'un disque d'or
          const a = (i / 8) * TAU + 0.2, dA = 0.26;
          K.poly2(ctx, [[Math.cos(a - dA) * Rs * 1.1, Math.sin(a - dA) * Rs * 1.1], [Math.cos(a) * Rs * 2, Math.sin(a) * Rs * 2], [Math.cos(a + dA) * Rs * 1.1, Math.sin(a + dA) * Rs * 1.1]], K.pal.or, 0.7);
        }
        K.disque(ctx, 0, 0, Rs, K.pal.or, K.riche ? 0.9 : 0.8);
        ctx.beginPath(); ctx.arc(0, 0, Rs * 0.55, 0, TAU); trait(ctx, K.pal.orOmbre, 0.9);
        ctx.beginPath(); ctx.arc(-Rs * 0.3, -Rs * 0.3, Rs * 0.22, 0, TAU); ctx.fillStyle = K.pal.orClair; ctx.fill();
      }
    });
    const Fs = face(V, x, y, aw, ah, 'sud'), Fb = face(V, x + t * 0.05, y + t * 0.04, aw - t * 0.1, ah - t * 0.08, 'sud');
    if (mode === 'rituel' || mode === 'sacre') { // la nappe retombe devant : sur la dalle, puis sur le socle, bordée d'or
      const u0 = mode === 'rituel' ? 0.16 : 0.27, u1 = 1 - u0;
      K.bandeUnie(ctx, Fs, u0, u1, e0, e1, tissu);
      if (Fb.visible) { K.bandeUnie(ctx, Fb, u0, u1, 0.07, e0, tissu); K.bandeUnie(ctx, Fb, u0, u1, 0.045, 0.07, K.pal.or); }
    }
    if (mode === 'ensanglante') { // des coulures le long du devant de la dalle, puis du socle
      for (const [u, l] of [[0.22, 0.2], [0.34, 0.12], [0.55, 0.24], [0.7, 0.1], [0.82, 0.17]]) {
        K.bandeUnie(ctx, Fs, u, u + 0.03, e0 - 0.0, e1, sang);
        K.bandeUnie(ctx, Fb, u, u + 0.03, e0 - l, e0, sang);
        if (Fb.visible) { const [px, py] = Fb.P(u + 0.015, e0 - l); ctx.beginPath(); ctx.arc(px, py, Math.max(1.2, t * 0.022), 0, TAU); encre(ctx, sang, 0.6); }
      }
    }
    if (mode === 'sacre' && Fs.visible) K.bandeUnie(ctx, Fs, 0.02, 0.98, e0 + 0.005, e0 + 0.02, K.pal.or); // un filet d'or autour de la dalle
    if (mode === 'rituel') {
      for (const [cx, cy] of [[-aw * 0.43, -ah * 0.28], [aw * 0.43, -ah * 0.28], [-aw * 0.43, ah * 0.28], [aw * 0.43, ah * 0.28]]) cierge(K, ctx, V, r, cx, cy, e1, 0.42, t * 0.04, t, true);
      // La coupe, au milieu de la nappe : un pied, un bol doré, le vin rouge à la surface.
      V.cylindre(ctx, r, 0, 0, t * 0.035, e1, 0.37, [43, 60, 50], () => K.disque(ctx, 0, 0, t * 0.035, K.pal.or, 0.6));
      V.cylindre(ctx, r, 0, 0, t * 0.075, 0.37, 0.43, [43, 60, 50], () => { K.disque(ctx, 0, 0, t * 0.075, K.pal.or, K.riche ? 0.9 : 0.8); K.disque(ctx, 0, 0, t * 0.055, K.pal.vin, 0.5); ctx.beginPath(); ctx.arc(-t * 0.02, -t * 0.02, t * 0.014, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill(); });
    }
    if (mode === 'ensanglante') { // un poignard cérémoniel posé de travers sur la pierre
      V.auNiveau(ctx, e1, () => {
        K.poly2(ctx, rectC(aw * 0.26, ah * 0.02, t * 0.3, t * 0.05, 0.45), K.riche ? '#e3e9f2' : '#b7bec8', 0.7);
        K.poly2(ctx, rectC(aw * 0.26 - Math.cos(0.45) * t * 0.19, ah * 0.02 - Math.sin(0.45) * t * 0.19, t * 0.1, t * 0.06, 0.45), K.pal.boisFonce, 0.7);
        K.poly2(ctx, rectC(aw * 0.26 + Math.cos(0.45) * t * 0.1, ah * 0.02 + Math.sin(0.45) * t * 0.1, t * 0.08, t * 0.03, 0.45), sang, 0.3);
      });
    }
    if (mode === 'sacre') { // deux chandeliers d'or, éteints (la lueur vient de l'autel lui-même)
      for (const sg of [-1, 1]) {
        V.cylindre(ctx, r, sg * aw * 0.42, 0, t * 0.05, e1, 0.42, [43, 60, 50], () => { K.disque(ctx, sg * aw * 0.42, 0, t * 0.05, K.pal.or, 0.8); K.disque(ctx, sg * aw * 0.42, 0, t * 0.03, K.pal.orClair, 0.4); });
      }
      V.lumiere(0, 0, e1, { r: t * 1.6, c: '255,214,118', k: 0.24 });
    }
  };
}

// --- Le puits -------------------------------------------------------------------------------------------------

/** La margelle d'un puits : un cylindre de pierre, son dessus à joints rayonnants ; `trou(R, ri, wx, wy, rel)` dessine ce qu'il y a au milieu (ou rien). */
function margelle(K, ctx, V, r, R, ri, H1, trou) {
  V.cylindre(ctx, r, 0, 0, R, 0, H1, K.MAT.pierreClaire.f, () => {
    disquePlat(K, ctx, V, 0, 0, R, 'pierreClaire', K.riche ? B.EP * 1.3 : 1.6);
    ctx.beginPath(); // les pierres de la margelle : joints en rayons
    for (let i = 0; i < 10; i++) { const a = (i / 10) * 7 + 0.3; ctx.moveTo(Math.cos(a) * ri * 1.05, Math.sin(a) * ri * 1.05); ctx.lineTo(Math.cos(a) * R * 0.97, Math.sin(a) * R * 0.97); }
    trait(ctx, K.riche ? B.JOINT : 'rgba(50,46,40,0.5)', K.riche ? B.EP_FIN : 0.9);
    trou?.();
  });
}

/** Le puits couvert d'un couvercle de planches (deux traverses, des clous, un anneau de fer) ou à treuil (portique de bois, corde et seau). */
function puits(K, mode) {
  return (ctx, w, h, t, o) => {
    const { V, r } = preparerObjet(ctx, o), R = Math.min(w, h) * 0.42, ri = R * 0.66, H1 = 0.22;
    if (mode === 'couvert') {
      margelle(K, ctx, V, r, R, ri, H1, () => { ctx.beginPath(); ctx.arc(0, 0, ri, 0, TAU); trait(ctx, ENCRE, K.riche ? B.EP : 1.4); });
      // Le couvercle : cinq planches posées en travers du trou, chacune un peu de travers et d'une longueur à elle, clouées sur deux traverses.
      const hl = 0.05, n = 5, lp = ri * 2.3 / n, tons = ['bois', 'boisClair', 'bois', 'boisSombre', 'boisClair'];
      for (let k = 0; k < n; k++) {
        const px = -ri * 1.15 + lp * (k + 0.5), demi = Math.sqrt(Math.max(0.2, (ri * 1.42) ** 2 - px * px)) * (0.9 + r() * 0.15), a = (r() - 0.5) * 0.14;
        K.bloc(ctx, V, r, rectC(px, (r() - 0.5) * ri * 0.12, lp * 0.94, demi * 2, a), H1, H1 + hl, tons[k], () => {
          if (K.riche) for (const sg of [-1, 1]) B.clou(ctx, [px, sg * demi * 0.7], Math.max(0.8, t * 0.015));
        });
      }
      V.auNiveau(ctx, H1 + hl, () => {
        for (const dy of [-0.5, 0.5]) { // les traverses, par-dessus les planches
          K.poly2(ctx, rectC(0, dy * ri, ri * 2.3, ri * 0.2, 0.03 * dy), K.pal.boisFonce, K.riche ? 0.8 : 0.6);
          for (const sg of [-1, 0, 1]) { if (K.riche) B.clou(ctx, [sg * ri * 0.85, dy * ri], Math.max(0.8, t * 0.016)); else K.disque(ctx, sg * ri * 0.85, dy * ri, 1, K.pal.ferClair, 0.4); }
        }
      });
      return;
    }
    // Le puits à treuil : la margelle et l'eau noire, un portique, la corde et le seau suspendu au-dessus.
    margelle(K, ctx, V, r, R, ri, H1, () => {
      const bas = K.riche ? -0.14 : -0.3, rel = V.echelle(bas) / V.echelle(H1), wx = V.vue.cx * (1 - rel), wy = V.vue.cy * (1 - rel), rw = ri * 0.88 * rel;
      if (K.riche) B.plaque(ctx, V, B.disque(0, 0, ri), '#c4b08c', { ep: B.EP, ombre: 'rgba(80,56,30,0.4)' });
      else { ctx.beginPath(); ctx.arc(0, 0, ri, 0, TAU); encre(ctx, dr(ctx, 0, 0, ri, '#3a3b3c', '#1a1b1c'), 1.2); }
      ctx.save(); ctx.beginPath(); ctx.arc(0, 0, ri, 0, TAU); ctx.clip();
      if (K.riche) B.plaque(ctx, V, B.disque(wx, wy, rw), '#6cbdee', { ep: B.EP, lisere: 'rgba(255,255,255,0.55)', ombre: 'rgba(38,104,168,0.4)' });
      else { ctx.beginPath(); ctx.arc(wx, wy, rw, 0, TAU); encre(ctx, dr(ctx, wx, wy, rw, '#4f7f9a', '#0f2230'), 0.8); }
      reflets(ctx, K, wx, wy, rw, K.riche ? '#f4fbff' : 'rgba(190,225,240,0.5)');
      ctx.restore();
      ctx.beginPath(); ctx.arc(0, 0, ri, 0, TAU); trait(ctx, ENCRE, K.riche ? B.EP : 1.4);
    });
    // Vu depuis le centre de la salle, un portique haut se couche quand le puits est près d'un bord : sa hauteur est bornée pour que le décalage de son sommet reste
    // sous 0,22 case (les montants restent à peu près droits), jamais sous 0,46 mur ; le seau et la corde gardent leurs proportions (`f`).
    const [ux, uy] = V.haut(0, 0, 1), penche = Math.hypot(ux, uy), hp = penche > 0 ? Math.max(0.46, Math.min(0.78, (t * 0.22) / penche)) : 0.78, f = hp / 0.78, xp = R * 0.9, p = t * 0.055;
    for (const sg of [-1, 1]) K.bloc(ctx, V, r, rectPts(sg * xp - p, -p, p * 2, p * 2), H1, hp, 'bois', undefined); // les deux montants
    const A = V.haut(-xp, 0, hp - 0.04), Bp = V.haut(xp, 0, hp - 0.04), M = V.haut(0, 0, hp - 0.04), T = V.haut(0, 0, 0.5 * f);
    ctx.lineCap = 'round';
    if (Math.hypot(T[0] - M[0], T[1] - M[1]) > 0.6) { ctx.beginPath(); ctx.moveTo(...M); ctx.lineTo(...T); trait(ctx, ENCRE, 2.4); trait(ctx, K.riche ? '#e8d8a8' : '#b09a68', 1.2); } // la corde
    V.cylindre(ctx, r, 0, 0, R * 0.2, 0.34 * f, 0.5 * f, K.MAT.bois.f, () => { // le seau, vu du dessus : de l'eau jusqu'au bord, un cerceau de fer
      K.disque(ctx, 0, 0, R * 0.2, K.pal.boisFonce, K.riche ? 0.9 : 0.8); K.disque(ctx, 0, 0, R * 0.14, K.riche ? '#6cbdee' : '#4f7f9a', 0.5);
      ctx.beginPath(); ctx.arc(-R * 0.05, -R * 0.05, R * 0.04, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
    });
    V.cerclage(ctx, 0, 0, R * 0.2, 0.4 * f, 0.5 * f);
    // La poutre, de montant à montant, au-dessus de tout, avec la manivelle au bout.
    ctx.beginPath(); ctx.moveTo(...A); ctx.lineTo(...Bp); trait(ctx, ENCRE, Math.max(5.4, t * 0.09)); trait(ctx, K.pal.bois, Math.max(3.4, t * 0.06)); ctx.beginPath(); ctx.moveTo(A[0], A[1] - 0.8); ctx.lineTo(Bp[0], Bp[1] - 0.8); trait(ctx, K.riche ? B.PLANCHES[2] : '#d6a56a', 1);
    const Ch = V.haut(xp + p * 1.4, 0, hp - 0.04);
    ctx.beginPath(); ctx.moveTo(Bp[0], Bp[1]); ctx.lineTo(Ch[0] + t * 0.07, Ch[1] + t * 0.05); trait(ctx, ENCRE, 3.2); trait(ctx, K.pal.ferClair, 1.6);
    ctx.beginPath(); ctx.arc(Ch[0] + t * 0.07, Ch[1] + t * 0.05, Math.max(1.6, t * 0.03), 0, TAU); encre(ctx, K.pal.boisFonce, 0.6);
    ctx.beginPath(); ctx.arc(M[0], M[1], Math.max(1.8, t * 0.035), 0, TAU); encre(ctx, K.pal.ferClair, 0.6); // la poulie
    ctx.lineCap = 'butt';
  };
}

/** Les variantes du décor d'un kit : `{ type: { variante: dessin(ctx, w, h, t, o) } }`. */
export function etatsDecor(K) {
  return {
    fontaine: { asec: fontaine(K, 'asec'), sombre: fontaine(K, 'sombre'), sacree: fontaine(K, 'sacree') },
    autel: { rituel: autel(K, 'rituel'), ensanglante: autel(K, 'ensanglante'), sacre: autel(K, 'sacre') },
    puits: { couvert: puits(K, 'couvert'), treuil: puits(K, 'treuil') },
  };
}
