/**
 * Écriture et lecture minimales de fichiers ZIP, sans dépendance (pur, testable sous Node).
 * Écriture : méthode 0 (stockage, sans compression : les images sont déjà compressées), CRC32, noms en UTF-8, pas de zip64.
 * Lecture : répertoire central ; méthode 0 directe, méthode 8 (deflate) via DecompressionStream quand le navigateur l'a.
 */

export const MAX_ENTREES = 2000;
const MAX_4GO = 0xFFFFFFFF;
const SIG_LOCAL = 0x04034b50, SIG_CENTRAL = 0x02014b50, SIG_FIN = 0x06054b50;

const TABLE_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC32 d'un Uint8Array (entier non signé). */
export function crc32(octets) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < octets.length; i++) c = TABLE_CRC[(c ^ octets[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/** Date au format DOS { heure, jour } (1980 au plus tôt, 2107 au plus tard). */
function dateDos(date) {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const an = Math.min(2107, Math.max(1980, d.getFullYear()));
  return {
    heure: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    jour: ((an - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/**
 * Fabrique un zip (méthode 0) à partir de [{ nom, donnees: Uint8Array, date?: Date }].
 * @throws {Error} message en français si un nom est vide, si le zip dépasserait 4 Go ou 65 535 fichiers
 */
export function creerZip(fichiers) {
  if (fichiers.length > 0xFFFF) throw new Error('trop de fichiers pour un zip');
  const enc = new TextEncoder();
  const locaux = [], centraux = [];
  let decalage = 0;
  for (const f of fichiers) {
    if (typeof f.nom !== 'string' || !f.nom) throw new Error('fichier sans nom');
    const nom = enc.encode(f.nom);
    const donnees = f.donnees;
    if (!(donnees instanceof Uint8Array)) throw new Error(`« ${f.nom} » : contenu invalide`);
    const crc = crc32(donnees);
    const { heure, jour } = dateDos(f.date);
    const local = new Uint8Array(30 + nom.length);
    const vl = new DataView(local.buffer);
    vl.setUint32(0, SIG_LOCAL, true); vl.setUint16(4, 20, true); vl.setUint16(6, 0x0800, true); vl.setUint16(8, 0, true);
    vl.setUint16(10, heure, true); vl.setUint16(12, jour, true); vl.setUint32(14, crc, true);
    vl.setUint32(18, donnees.length, true); vl.setUint32(22, donnees.length, true); vl.setUint16(26, nom.length, true); vl.setUint16(28, 0, true);
    local.set(nom, 30);
    const central = new Uint8Array(46 + nom.length);
    const vc = new DataView(central.buffer);
    vc.setUint32(0, SIG_CENTRAL, true); vc.setUint16(4, 20, true); vc.setUint16(6, 20, true); vc.setUint16(8, 0x0800, true); vc.setUint16(10, 0, true);
    vc.setUint16(12, heure, true); vc.setUint16(14, jour, true); vc.setUint32(16, crc, true);
    vc.setUint32(20, donnees.length, true); vc.setUint32(24, donnees.length, true); vc.setUint16(28, nom.length, true);
    vc.setUint32(42, decalage, true);
    central.set(nom, 46);
    locaux.push(local, donnees);
    centraux.push(central);
    decalage += local.length + donnees.length;
    if (decalage > MAX_4GO) throw new Error('sauvegarde trop volumineuse pour un zip (4 Go au plus)');
  }
  const tailleCentral = centraux.reduce((n, c) => n + c.length, 0);
  if (decalage + tailleCentral + 22 > MAX_4GO) throw new Error('sauvegarde trop volumineuse pour un zip (4 Go au plus)');
  const fin = new Uint8Array(22);
  const vf = new DataView(fin.buffer);
  vf.setUint32(0, SIG_FIN, true); vf.setUint16(8, fichiers.length, true); vf.setUint16(10, fichiers.length, true);
  vf.setUint32(12, tailleCentral, true); vf.setUint32(16, decalage, true);
  const sortie = new Uint8Array(decalage + tailleCentral + 22);
  let p = 0;
  for (const morceau of [...locaux, ...centraux, fin]) { sortie.set(morceau, p); p += morceau.length; }
  return sortie;
}

/** Un nom d'entrée sûr : ni « .. », ni chemin absolu ni lecteur, ni antislash, ni caractère de contrôle. */
export function nomSur(nom) {
  if (!nom || nom.startsWith('/') || nom.includes('\\') || /^[a-zA-Z]:/.test(nom) || /[\u0000-\u001f]/.test(nom)) return false;
  return !nom.split('/').includes('..');
}

/** Décompresse du deflate brut, sans jamais produire plus de `attendu` octets. */
async function gonfler(donnees, attendu) {
  if (typeof DecompressionStream === 'undefined') throw new Error('ce zip est compressé et ce navigateur ne sait pas le décompresser : refais-le en « stockage » sans compression, ou utilise un navigateur récent');
  const flux = new DecompressionStream('deflate-raw');
  const ecrivain = flux.writable.getWriter();
  ecrivain.write(donnees).then(() => ecrivain.close()).catch(() => {});
  const lecteur = flux.readable.getReader();
  const morceaux = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await lecteur.read();
      if (done) break;
      total += value.length;
      if (total > attendu) { lecteur.cancel().catch(() => {}); throw new Error('fichier abîmé (taille incohérente)'); }
      morceaux.push(value);
    }
  } catch (e) {
    if (e.message.startsWith('fichier abîmé')) throw e;
    throw new Error('fichier abîmé (décompression impossible)');
  }
  const sortie = new Uint8Array(total);
  let p = 0;
  for (const m of morceaux) { sortie.set(m, p); p += m.length; }
  return sortie;
}

/**
 * Lit un zip : Map nom → Uint8Array. Les dossiers sont ignorés.
 * @throws {Error} message en français : pas un zip, abîmé (CRC), trop d'entrées, nom suspect, méthode inconnue
 */
export async function lireZip(octets) {
  if (!(octets instanceof Uint8Array)) throw new Error('ce fichier n’est pas un zip');
  const vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
  let fin = -1;
  for (let i = octets.length - 22; i >= Math.max(0, octets.length - 22 - 0xFFFF); i--) {
    if (vue.getUint32(i, true) === SIG_FIN) { fin = i; break; }
  }
  if (fin < 0) throw new Error('ce fichier n’est pas un zip');
  const total = vue.getUint16(fin + 10, true);
  const tailleCentral = vue.getUint32(fin + 12, true);
  let p = vue.getUint32(fin + 16, true);
  if (total === 0xFFFF || tailleCentral === MAX_4GO || p === MAX_4GO) throw new Error('zip64 non pris en charge');
  if (total > MAX_ENTREES) throw new Error(`trop de fichiers dans ce zip (${MAX_ENTREES} au plus)`);
  if (p + tailleCentral > fin) throw new Error('fichier abîmé (répertoire central incohérent)');
  const dec = new TextDecoder('utf-8');
  const resultat = new Map();
  for (let n = 0; n < total; n++) {
    if (p + 46 > octets.length || vue.getUint32(p, true) !== SIG_CENTRAL) throw new Error('fichier abîmé (répertoire central illisible)');
    const flags = vue.getUint16(p + 8, true), methode = vue.getUint16(p + 10, true), crc = vue.getUint32(p + 16, true);
    const taille = vue.getUint32(p + 20, true), tailleVraie = vue.getUint32(p + 24, true);
    const ln = vue.getUint16(p + 28, true), le = vue.getUint16(p + 30, true), lc = vue.getUint16(p + 32, true), decalage = vue.getUint32(p + 42, true);
    if (p + 46 + ln > octets.length) throw new Error('fichier abîmé (nom tronqué)');
    const nom = dec.decode(octets.subarray(p + 46, p + 46 + ln));
    p += 46 + ln + le + lc;
    if (nom.endsWith('/')) continue;
    if (!nomSur(nom)) throw new Error(`nom de fichier refusé dans le zip : « ${nom.slice(0, 60)} »`);
    if (resultat.has(nom)) throw new Error(`fichier en double dans le zip : « ${nom.slice(0, 60)} »`);
    if (flags & 1) throw new Error('ce zip est chiffré : il ne peut pas être lu ici');
    if (decalage + 30 > octets.length || vue.getUint32(decalage, true) !== SIG_LOCAL) throw new Error('fichier abîmé (en-tête illisible)');
    const debut = decalage + 30 + vue.getUint16(decalage + 26, true) + vue.getUint16(decalage + 28, true);
    if (debut + taille > octets.length) throw new Error('fichier abîmé (données tronquées)');
    const brut = octets.subarray(debut, debut + taille);
    let donnees;
    if (methode === 0) {
      if (taille !== tailleVraie) throw new Error('fichier abîmé (taille incohérente)');
      donnees = brut.slice();
    } else if (methode === 8) donnees = await gonfler(brut, tailleVraie);
    else throw new Error(`méthode de compression non prise en charge (${methode})`);
    if (donnees.length !== tailleVraie || crc32(donnees) !== crc) throw new Error('fichier abîmé (contrôle CRC)');
    resultat.set(nom, donnees);
  }
  return resultat;
}
