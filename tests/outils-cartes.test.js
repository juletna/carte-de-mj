/**
 * Tests des fonctions pures de outils/cartes/ : composition du prompt (styles × formats), format par niveau, cadrage,
 * recadrage PNG, validation et ajout d'une entrée du catalogue. Les styles sont lus par `lire` (assets/styles-cartes/).
 */
import { composerPrompt, extraireSections, formatCarte, promptACopier, cadrageCentre, STYLES, FORMATS, STYLE_PAR_DEFAUT } from '../outils/cartes/prompt.js';
import { recadrerPng, taillePng } from '../outils/cartes/png.js';
import { crc32 } from '../js/zip.js';
import { validerEntree, ajouterAuCatalogue, catalogueVide } from '../outils/cartes/entree.js';
import { NIVEAUX } from '../outils/cartes/vocabulaire.js';
import { verifier, egal, executerSuite } from './mini-test.js';

const entree = (o = {}) => ({ id: 'foret-01', titre: 'Forêt', fichier: 'cartes/foret-01.webp', largeur: 1024, hauteur: 1536, niveau: 'zone', milieux: ['foret'], tags: ['chemin'], description: 'Un chemin.', grille: { case: 51.2, dx: 0, dy: 0 }, ...o });

/** PNG RGB de `l` × `h` dont le pixel (x, y) vaut [x, y, 7], filtre Sub sur chaque ligne (pour tester le défiltrage). */
async function pngDeTest(l, h) {
  const brut = new Uint8Array(h * (l * 3 + 1));
  for (let y = 0; y < h; y++) {
    const d = y * (l * 3 + 1);
    brut[d] = 1;
    for (let x = 0; x < l; x++) for (let k = 0; k < 3; k++) {
      const v = [x, y, 7][k], avant = x ? [x - 1, y, 7][k] : 0;
      brut[d + 1 + x * 3 + k] = (v - avant) & 255;
    }
  }
  const z = new Uint8Array(await new Response(new Blob([brut]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
  const morceau = (type, donnees) => {
    const m = new Uint8Array(12 + donnees.length), v = new DataView(m.buffer);
    v.setUint32(0, donnees.length); for (let i = 0; i < 4; i++) m[4 + i] = type.charCodeAt(i); m.set(donnees, 8);
    v.setUint32(8 + donnees.length, crc32(m.subarray(4, 8 + donnees.length))); return m;
  };
  const ihdr = new Uint8Array(13), vi = new DataView(ihdr.buffer); vi.setUint32(0, l); vi.setUint32(4, h); ihdr.set([8, 2, 0, 0, 0], 8);
  const parties = [Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), morceau('IHDR', ihdr), morceau('IDAT', z), morceau('IEND', new Uint8Array(0))];
  const sortie = new Uint8Array(parties.reduce((n, p) => n + p.length, 0));
  parties.reduce((p, m) => (sortie.set(m, p), p + m.length), 0);
  return sortie;
}

/** Données d'image décompressées (lignes précédées de leur octet de filtre) d'un PNG à un seul IDAT. */
async function idatBrut(png) {
  const v = new DataView(png.buffer, png.byteOffset, png.byteLength);
  for (let p = 8; p < png.length;) {
    const n = v.getUint32(p);
    if (String.fromCharCode(...png.subarray(p + 4, p + 8)) === 'IDAT') {
      return new Uint8Array(await new Response(new Blob([png.subarray(p + 8, p + 8 + n)]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
    }
    p += 12 + n;
  }
  return new Uint8Array(0);
}

export async function executer({ lire }) {
  const styles = Object.fromEntries(await Promise.all(STYLES.map(async (s) => [s.id, await lire(`assets/styles-cartes/${s.id}.md`)])));
  const style = styles[STYLE_PAR_DEFAUT];
  const recadre = await recadrerPng(await pngDeTest(6, 4), { x: 1, y: 1, largeur: 4, hauteur: 2 });
  const pixels = await idatBrut(recadre);
  return executerSuite('outils cartes : ', [
    ['chaque style × format × niveau donne un prompt complet, sans texte écrit ni repère oublié', () => {
      for (const s of STYLES) for (const f of FORMATS) for (const n of NIVEAUX) {
        const p = composerPrompt({ style: styles[s.id], niveau: n, scene: 'une clairière', format: f.id });
        verifier(p.includes('une clairière') && p.includes('top-down') && p.includes('1.5 meters') && p.includes('No text of any kind')
          && p.includes('Image format:') && !/\{(scene|cases)\}/.test(p), `prompt incomplet : ${s.id} ${f.id} ${n}`);
      }
    }],
    ['niveau, format inconnus ou scène vide : refusés', () => {
      let leve = 0;
      for (const a of [{ niveau: 'lune', scene: 'x' }, { niveau: 'zone', scene: '  ' }, { niveau: 'zone', scene: 'x', format: 'rond' }]) { try { composerPrompt({ style, ...a }); } catch { leve++; } }
      egal(leve, 3, 'refus');
    }],
    ['paysage par défaut : 3:2 demandé puis 16:9, cases écrites, rappel final en dernier', () => {
      const z = composerPrompt({ style, niveau: 'zone', scene: 'une clairière' });
      verifier(z.includes('1536 × 1024') && z.includes('16:9') && z.includes('about 32 squares wide and 18 squares tall') && z.includes('32 × 18 squares'), 'zone');
      verifier(z.trim().endsWith('never at an angle.'), 'le rappel final n’est pas en dernier');
      const m = composerPrompt({ style, niveau: 'monde', scene: 'un archipel' });
      verifier(m.includes('1536 × 1024') && !m.includes('The picture covers'), 'monde');
      egal(promptACopier({ style, niveau: 'zone', scene: 'x' }), composerPrompt({ style, niveau: 'zone', scene: 'x' }), 'skill et appli : même prompt');
    }],
    ['styles : les sections attendues existent, plus de format écrit dans un style', () => {
      for (const [id, texte] of Object.entries(styles)) {
        const s = extraireSections(texte);
        verifier(s['Bloc de style'] && s['Échelle'] && !s.Format, `sections de ${id}`);
      }
    }],
    ['formats : grilles, taille demandée et image finale', () => {
      egal(formatCarte('paysage', 'monde').grille, null, 'monde');
      egal(formatCarte('paysage', 'region').grille, null, 'region');
      egal(formatCarte('paysage', 'zone').grille, { case: 48, colonnes: 32, lignes: 18 }, 'zone paysage');
      egal([formatCarte('paysage', 'zone').taille, formatCarte('paysage', 'zone').largeur, formatCarte('paysage', 'zone').hauteur, formatCarte('paysage', 'zone').recadre], ['1536x1024', 1536, 864, true], 'paysage');
      egal(formatCarte('portrait', 'zone').grille, { case: 51.2, colonnes: 20, lignes: 30 }, 'zone portrait');
      egal(formatCarte('carre', 'localite').recadre, false, 'carré');
      for (const f of FORMATS) for (const [n, [c, l]] of Object.entries(f.grilles)) {
        verifier(Math.abs(c / l - f.finale.largeur / f.finale.hauteur) < 0.01, `grille ${f.id} ${n} aux proportions de l’image`);
      }
    }],
    ['cadrage centré : 3:2 → 16:9 retire une bande en haut et en bas ; déjà aux proportions → rien', () => {
      egal(cadrageCentre(1536, 1024, 1536, 864), { x: 0, y: 80, largeur: 1536, hauteur: 864 }, '3:2');
      egal(cadrageCentre(1920, 1080, 1536, 864), null, 'déjà 16:9');
      egal(cadrageCentre(1024, 1536, 1536, 864), { x: 0, y: 480, largeur: 1024, hauteur: 576 }, 'portrait vers paysage');
      egal(cadrageCentre(2000, 864, 1536, 864), { x: 232, y: 0, largeur: 1536, hauteur: 864 }, 'trop large');
    }],
    ['recadrage PNG : bonne taille, lignes commençant aux pixels (1, 1) et (1, 2), filtre 0', () => {
      egal(taillePng(recadre), { largeur: 4, hauteur: 2 }, 'taille');
      egal([...pixels.subarray(0, 13)], [0, 1, 1, 7, 2, 1, 7, 3, 1, 7, 4, 1, 7], 'ligne 1');
      egal([...pixels.subarray(13, 17)], [0, 1, 2, 7], 'ligne 2');
    }],
    ['une entrée valide passe, une entrée abîmée est refusée avec ses raisons', () => {
      egal(validerEntree(entree()), [], 'valide');
      const p = validerEntree(entree({ id: 'Foret 1', niveau: 'x', milieux: [], fichier: '../a.webp' }));
      verifier(p.length === 4, `4 problèmes attendus, ${p.length} : ${p.join(' | ')}`);
    }],
    ['ajout : id en double refusé, catalogue non modifié, valeurs par défaut posées', () => {
      const vide = catalogueVide();
      const r = ajouterAuCatalogue(vide, entree());
      egal(r.catalogue.cartes.length, 1, 'ajoutée');
      egal(vide.cartes.length, 0, 'original intact');
      egal(r.catalogue.cartes[0].origine.style, STYLE_PAR_DEFAUT, 'origine');
      verifier(ajouterAuCatalogue(r.catalogue, entree()).problemes[0].includes('déjà pris'), 'doublon accepté');
      verifier(ajouterAuCatalogue({ format: 'autre' }, entree()).problemes, 'catalogue illisible accepté');
    }],
  ]);
}
