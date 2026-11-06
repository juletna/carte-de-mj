/**
 * Recadrage d'un PNG sans dépendance (CompressionStream / DecompressionStream, présents dans Node 18+ et les navigateurs).
 * Sert à outils/cartes/generer.mjs pour passer l'image de l'API (3:2) au 16:9 du style. Prend en charge ce que rend l'API :
 * 8 bits par canal, non entrelacé, en niveaux de gris, RGB, gris + alpha ou RGBA. Le PNG produit est en RGB ou RGBA, filtre 0.
 */
import { crc32 } from '../../js/zip.js';

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const CANAUX = { 0: 1, 2: 3, 4: 2, 6: 4 };

async function flux(octets, transformation) {
  const sortie = new Response(new Blob([octets]).stream().pipeThrough(transformation));
  return new Uint8Array(await sortie.arrayBuffer());
}

function lireMorceaux(octets) {
  if (SIGNATURE.some((o, i) => octets[i] !== o)) throw new Error('ce fichier n’est pas un PNG');
  const vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
  const morceaux = [];
  for (let p = 8; p + 8 <= octets.length;) {
    const longueur = vue.getUint32(p);
    const type = String.fromCharCode(...octets.subarray(p + 4, p + 8));
    morceaux.push({ type, donnees: octets.subarray(p + 8, p + 8 + longueur) });
    p += 12 + longueur;
    if (type === 'IEND') break;
  }
  return morceaux;
}

function morceau(type, donnees) {
  const sortie = new Uint8Array(12 + donnees.length);
  const vue = new DataView(sortie.buffer);
  vue.setUint32(0, donnees.length);
  for (let i = 0; i < 4; i++) sortie[4 + i] = type.charCodeAt(i);
  sortie.set(donnees, 8);
  vue.setUint32(8 + donnees.length, crc32(sortie.subarray(4, 8 + donnees.length)));
  return sortie;
}

const paeth = (a, b, c) => {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** Lignes de pixels défiltrées : [Uint8Array de largeur × canaux] × hauteur. */
function defiltrer(brut, largeur, hauteur, canaux) {
  const pas = largeur * canaux, lignes = [];
  let prec = new Uint8Array(pas);
  for (let y = 0; y < hauteur; y++) {
    const debut = y * (pas + 1), filtre = brut[debut], ligne = brut.slice(debut + 1, debut + 1 + pas);
    for (let i = 0; i < pas; i++) {
      const a = i >= canaux ? ligne[i - canaux] : 0, b = prec[i], c = i >= canaux ? prec[i - canaux] : 0;
      ligne[i] = (ligne[i] + [0, a, b, (a + b) >> 1, paeth(a, b, c)][filtre]) & 255;
    }
    lignes.push(ligne);
    prec = ligne;
  }
  return lignes;
}

/** Recadre un PNG sur `cadre` { x, y, largeur, hauteur }. Rend les octets du nouveau PNG. */
export async function recadrerPng(octets, cadre) {
  const morceaux = lireMorceaux(octets);
  const ihdr = morceaux.find((m) => m.type === 'IHDR')?.donnees;
  if (!ihdr) throw new Error('PNG sans en-tête');
  const vue = new DataView(ihdr.buffer, ihdr.byteOffset, ihdr.byteLength);
  const largeur = vue.getUint32(0), hauteur = vue.getUint32(4), profondeur = ihdr[8], couleur = ihdr[9], entrelace = ihdr[12];
  const canaux = CANAUX[couleur];
  if (profondeur !== 8 || !canaux || entrelace) throw new Error('PNG non pris en charge (8 bits non entrelacé attendu)');
  const { x, y, largeur: l, hauteur: h } = cadre;
  if (x < 0 || y < 0 || l < 1 || h < 1 || x + l > largeur || y + h > hauteur) throw new Error('cadre hors de l’image');
  const idat = morceaux.filter((m) => m.type === 'IDAT');
  const compresse = new Uint8Array(idat.reduce((n, m) => n + m.donnees.length, 0));
  idat.reduce((p, m) => (compresse.set(m.donnees, p), p + m.donnees.length), 0);
  const lignes = defiltrer(await flux(compresse, new DecompressionStream('deflate')), largeur, hauteur, canaux);
  const alpha = canaux === 2 || canaux === 4, sortieCanaux = alpha ? 4 : 3;
  const brut = new Uint8Array(h * (l * sortieCanaux + 1));
  for (let j = 0; j < h; j++) {
    const source = lignes[y + j], debut = j * (l * sortieCanaux + 1) + 1;
    for (let i = 0; i < l; i++) {
      const s = (x + i) * canaux, d = debut + i * sortieCanaux;
      if (canaux <= 2) { brut[d] = brut[d + 1] = brut[d + 2] = source[s]; if (alpha) brut[d + 3] = source[s + 1]; }
      else for (let k = 0; k < sortieCanaux; k++) brut[d + k] = source[s + k];
    }
  }
  const entete = new Uint8Array(13);
  const ve = new DataView(entete.buffer);
  ve.setUint32(0, l); ve.setUint32(4, h);
  entete.set([8, alpha ? 6 : 2, 0, 0, 0], 8);
  const parties = [Uint8Array.from(SIGNATURE), morceau('IHDR', entete), morceau('IDAT', await flux(brut, new CompressionStream('deflate'))), morceau('IEND', new Uint8Array(0))];
  const sortie = new Uint8Array(parties.reduce((n, p) => n + p.length, 0));
  parties.reduce((p, m) => (sortie.set(m, p), p + m.length), 0);
  return sortie;
}

/** Largeur et hauteur d'un PNG, lues dans son en-tête. */
export function taillePng(octets) {
  const ihdr = lireMorceaux(octets).find((m) => m.type === 'IHDR')?.donnees;
  if (!ihdr) throw new Error('PNG sans en-tête');
  const vue = new DataView(ihdr.buffer, ihdr.byteOffset, ihdr.byteLength);
  return { largeur: vue.getUint32(0), hauteur: vue.getUint32(4) };
}
