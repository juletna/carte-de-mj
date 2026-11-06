/**
 * Tests de js/zip.js : aller-retour (noms accentués, fichier vide, binaire), CRC faux détecté, noms dangereux refusés,
 * zip deflate lu quand DecompressionStream existe. Sans dépendance : marche sous Node et dans tests.html.
 */
import { creerZip, lireZip, crc32 } from '../js/zip.js';
import { verifier, egal, executerSuite } from './mini-test.js';

const enc = (t) => new TextEncoder().encode(t);
const dec = (o) => new TextDecoder().decode(o);
const refuse = async (octets, motif) => {
  try { await lireZip(octets); } catch (e) { verifier(motif.test(e.message), `message inattendu : ${e.message}`); return; }
  throw new Error('devrait être refusé');
};

/** Un zip à une entrée en méthode 8, fabriqué avec CompressionStream('deflate-raw'). */
async function zipDeflate(nom, texte) {
  const brut = enc(texte);
  const flux = new Blob([brut]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const comp = new Uint8Array(await new Response(flux).arrayBuffer());
  const n = enc(nom);
  const local = new Uint8Array(30 + n.length + comp.length), vl = new DataView(local.buffer);
  vl.setUint32(0, 0x04034b50, true); vl.setUint16(4, 20, true); vl.setUint16(8, 8, true);
  vl.setUint32(14, crc32(brut), true); vl.setUint32(18, comp.length, true); vl.setUint32(22, brut.length, true); vl.setUint16(26, n.length, true);
  local.set(n, 30); local.set(comp, 30 + n.length);
  const central = new Uint8Array(46 + n.length), vc = new DataView(central.buffer);
  vc.setUint32(0, 0x02014b50, true); vc.setUint16(4, 20, true); vc.setUint16(6, 20, true); vc.setUint16(10, 8, true);
  vc.setUint32(16, crc32(brut), true); vc.setUint32(20, comp.length, true); vc.setUint32(24, brut.length, true); vc.setUint16(28, n.length, true);
  central.set(n, 46);
  const fin = new Uint8Array(22), vf = new DataView(fin.buffer);
  vf.setUint32(0, 0x06054b50, true); vf.setUint16(8, 1, true); vf.setUint16(10, 1, true); vf.setUint32(12, central.length, true); vf.setUint32(16, local.length, true);
  return Uint8Array.from([...local, ...central, ...fin]);
}

export async function executer() {
  const binaire = Uint8Array.from({ length: 256 }, (_, i) => i);
  const tests = [
    ['CRC32 connu', () => egal(crc32(enc('123456789')), 0xCBF43926, 'crc32')],
    ['aller-retour : accents, vide, binaire, sous-dossier', async () => {
      const zip = creerZip([{ nom: 'été/œuvre.txt', donnees: enc('Ça marche — déjà') }, { nom: 'vide.bin', donnees: new Uint8Array(0) }, { nom: 'images/x.png', donnees: binaire }]);
      const m = await lireZip(zip);
      egal([...m.keys()], ['été/œuvre.txt', 'vide.bin', 'images/x.png'], 'noms');
      egal(dec(m.get('été/œuvre.txt')), 'Ça marche — déjà', 'texte');
      egal(m.get('vide.bin').length, 0, 'fichier vide');
      egal([...m.get('images/x.png')], [...binaire], 'binaire');
    }],
    ['zip sans fichier', async () => egal((await lireZip(creerZip([]))).size, 0, 'entrées')],
    ['pas un zip', () => refuse(enc('bonjour tout le monde, ceci est un texte'), /n’est pas un zip/)],
    ['CRC faux détecté', async () => {
      const zip = creerZip([{ nom: 'a.txt', donnees: enc('contenu') }]);
      zip[30 + 5] ^= 0xFF; // un octet des données (après l'en-tête local de 30 octets et le nom de 5)
      await refuse(zip, /CRC/);
    }],
    ['nom avec « .. » refusé', () => refuse(creerZip([{ nom: '../evil.txt', donnees: enc('x') }]), /refusé/)],
    ['nom absolu refusé', () => refuse(creerZip([{ nom: '/etc/x', donnees: enc('x') }]), /refusé/)],
    ['fichier en double refusé', () => refuse(creerZip([{ nom: 'a', donnees: enc('1') }, { nom: 'a', donnees: enc('2') }]), /double/)],
    ['trop d’entrées refusé', () => refuse(creerZip(Array.from({ length: 2001 }, (_, i) => ({ nom: `f${i}`, donnees: new Uint8Array(0) }))), /trop de fichiers/)],
    ['zip tronqué refusé', async () => { const z = creerZip([{ nom: 'a', donnees: enc('abc') }]); await refuse(z.slice(0, z.length - 10), /zip/); }],
  ];
  if (typeof DecompressionStream !== 'undefined' && typeof CompressionStream !== 'undefined') {
    tests.push(['zip deflate lu (zip recompressé)', async () => {
      const m = await lireZip(await zipDeflate('d.txt', 'répété répété répété répété '.repeat(20)));
      egal(dec(m.get('d.txt')), 'répété répété répété répété '.repeat(20), 'décompressé');
    }]);
  }
  // executerSuite est synchrone : on attend les tests asynchrones un par un.
  const resultats = [];
  for (const t of tests) {
    let ecarts = [];
    try { await t[1](); } catch (e) { ecarts = [e.message]; }
    resultats.push({ phrase: `zip : ${t[0]}`, ecarts, resultat: null });
  }
  return resultats;
}
