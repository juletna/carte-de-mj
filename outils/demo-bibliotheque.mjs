// Ajoute à la liste de l'appli quelques cartes de démonstration dessinées en SVG, pour l'essayer sans clé d'API.
// Usage :  CARTE_DE_MJ_DOSSIER=/chemin/du/dossier-de-travail node outils/demo-bibliotheque.mjs
// Écrit images/<id>.svg + images/index.json du dossier de travail. N'écrase rien : un fichier ou un identifiant déjà présent est laissé tel quel.
import { mkdir, readFile, writeFile, readdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { dossierTravail } from './cartes/dossier.js';
import { construireEntree, ajouterALIndex, indexVide } from './cartes/entree.js';

let dossier;
try {
  const r = dossierTravail(process.env);
  if (r.avertissement) console.error(`Attention : ${r.avertissement}`);
  dossier = r.dossier;
} catch (e) { console.error(e.message); process.exit(1); }
const L = 800, H = 1200;

// Hasard reproductible (mulberry32) : la même démo à chaque lancement.
const hasard = (graine) => () => { graine |= 0; graine = graine + 0x6D2B79F5 | 0; let t = Math.imul(graine ^ graine >>> 15, 1 | graine); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const svg = (fond, corps) => `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${H}" viewBox="0 0 ${L} ${H}"><rect width="${L}" height="${H}" fill="${fond}"/>${corps}</svg>\n`;
const semis = (n, graine, f) => { const r = hasard(graine); return Array.from({ length: n }, () => f(r() * L, r() * H, r)).join(''); };
const arbres = (n, g, couleur = '#2f5d34', rayon = 18) => semis(n, g, (x, y, r) => `<circle cx="${x | 0}" cy="${y | 0}" r="${(rayon * (0.6 + r() * 0.8)) | 0}" fill="${couleur}" stroke="#1b3a20" stroke-width="2"/>`);
const grille = (pas = 50, couleur = '#00000022') => Array.from({ length: L / pas + 1 }, (_, i) => `<path d="M${i * pas} 0V${H}" stroke="${couleur}"/>`).join('') + Array.from({ length: H / pas + 1 }, (_, i) => `<path d="M0 ${i * pas}H${L}" stroke="${couleur}"/>`).join('');
const bloc = (x, y, l, h, c = '#a8643a') => `<rect x="${x}" y="${y}" width="${l}" height="${h}" fill="${c}" stroke="#3a2412" stroke-width="3"/><path d="M${x} ${y}L${x + l / 2} ${y - h / 3}L${x + l} ${y}" fill="#7a3f22" stroke="#3a2412" stroke-width="3"/>`;

const CARTES = [
  { id: 'demo-monde-marches', titre: 'Les Marches (continent)', niveau: 'monde', milieux: ['montagne', 'foret', 'cote', 'plaine'], tags: ['continent', 'royaume', 'carte du monde'], description: 'Un continent aux côtes découpées, des montagnes au nord, une grande forêt au centre.',
    dessin: svg('#2d5f8a', `<path d="M120 200C300 80 560 120 680 300C760 460 700 700 620 860C540 1040 360 1100 220 960C100 840 60 600 90 420C100 320 100 260 120 200Z" fill="#c8b87a" stroke="#5a4a20" stroke-width="5"/><path d="M200 260L260 170L320 260L380 190L440 270L500 200L560 290" fill="#8a8a92" stroke="#444" stroke-width="4"/>${arbres(70, 3, '#2f5d34', 16).replace(/cx="(\d+)" cy="(\d+)"/g, (m, x, y) => `cx="${200 + (x % 400)}" cy="${420 + (y % 380)}"`)}<path d="M330 330C380 520 340 700 420 900" fill="none" stroke="#4a8fc0" stroke-width="8"/>`) },
  { id: 'demo-region-foret-brume', titre: 'Forêt de Brume', niveau: 'region', milieux: ['foret', 'eau'], tags: ['forêt', 'rivière', 'sentier', 'brume'], description: 'Une vaste forêt traversée par une rivière et un sentier sinueux.',
    dessin: svg('#3d6b3a', `${arbres(260, 7, '#2a5230', 22)}<path d="M-20 300C250 380 300 600 520 700C660 770 740 1000 840 1100" fill="none" stroke="#4a8fc0" stroke-width="40" stroke-linecap="round" opacity="0.95"/><path d="M400 1220C380 1000 520 880 440 700C380 560 300 440 360 -20" fill="none" stroke="#b79a64" stroke-width="14" stroke-dasharray="26 14"/>`) },
  { id: 'demo-zone-clairiere-ruines', titre: 'Clairière aux ruines', niveau: 'zone', milieux: ['foret', 'ruines'], tags: ['chemin', 'colonnes', 'sanctuaire', 'jour'], description: 'Clairière traversée par un chemin, colonnes brisées, petit sanctuaire circulaire à l’est.', grille: { case: 50, dx: 0, dy: 0 },
    dessin: svg('#5b8c4a', `${arbres(90, 11, '#2f5d34', 40).replace(/<circle[^>]*cx="(\d+)"[^>]*\/>/g, (m, x) => (x > 160 && x < 640 ? '' : m))}<path d="M400 1250C380 1000 330 900 400 700C470 520 360 380 400 -50" fill="none" stroke="#c4a871" stroke-width="70" stroke-linecap="round"/>${[[250, 500], [330, 420], [470, 460], [250, 640], [520, 680]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 2 ? 16 : 22}" fill="#b9b4a6" stroke="#55524a" stroke-width="3"/>`).join('')}<circle cx="590" cy="540" r="75" fill="#c9c4b4" stroke="#55524a" stroke-width="5"/><circle cx="590" cy="540" r="40" fill="#8aa0b8" stroke="#55524a" stroke-width="4"/>${grille()}`) },
  { id: 'demo-zone-col-montagne', titre: 'Col de la Dent Grise', niveau: 'zone', milieux: ['montagne', 'neige'], tags: ['col', 'pont', 'falaise', 'neige'], description: 'Un col enneigé entre deux falaises, franchi par un pont de cordes.', grille: { case: 50, dx: 0, dy: 0 },
    dessin: svg('#e8eef2', `<path d="M0 0H240C300 300 200 600 260 1200H0Z" fill="#7a7a84" stroke="#3a3a42" stroke-width="5"/><path d="M800 0H580C500 300 640 700 540 1200H800Z" fill="#6c6c76" stroke="#3a3a42" stroke-width="5"/><rect x="250" y="560" width="300" height="70" fill="#9a7440" stroke="#4a3418" stroke-width="4"/>${Array.from({ length: 10 }, (_, i) => `<path d="M${280 + i * 28} 560V630" stroke="#4a3418" stroke-width="3"/>`).join('')}<path d="M400 0C420 300 380 800 400 1200" stroke="#cfd8de" stroke-width="90" fill="none"/>${semis(40, 5, (x, y) => `<circle cx="${x | 0}" cy="${y | 0}" r="6" fill="#fff"/>`)}${grille()}`) },
  { id: 'demo-localite-port-aux-brumes', titre: 'Le Port-aux-Brumes', niveau: 'localite', milieux: ['ville', 'cote', 'eau'], tags: ['port', 'quai', 'village', 'bateaux'], description: 'Un petit port de pêche : quais de bois, entrepôts et maisons serrées autour de la place.',
    dessin: svg('#c9b88a', `<rect x="0" y="780" width="${L}" height="${H - 780}" fill="#2f6a94"/><path d="M180 780V1000M360 780V1050M540 780V1000M700 780V1060" stroke="#6b4a26" stroke-width="30"/>${[[120, 640], [300, 650], [480, 630], [620, 650], [150, 480], [560, 470]].map(([x, y]) => bloc(x, y, 110, 90)).join('')}<circle cx="400" cy="380" r="90" fill="#b7a67a" stroke="#6b5a30" stroke-width="4"/>${bloc(340, 150, 120, 110, '#8a8a92')}<ellipse cx="290" cy="960" rx="70" ry="26" fill="#6b4a26" stroke="#2a1a0a" stroke-width="4"/><ellipse cx="600" cy="1010" rx="60" ry="22" fill="#7a5530" stroke="#2a1a0a" stroke-width="4"/>${grille(50, '#00000014')}`) },
  { id: 'demo-batiment-taverne', titre: 'Taverne du Sanglier Rieur', niveau: 'batiment', milieux: ['ville'], tags: ['taverne', 'salle commune', 'comptoir', 'cheminée'], description: 'Salle commune d’une taverne : comptoir, tables, grande cheminée et escalier vers les chambres.', grille: { case: 50, dx: 0, dy: 0 },
    dessin: svg('#7a5a38', `<rect x="40" y="40" width="720" height="1120" fill="#9a7448" stroke="#2a1a0a" stroke-width="14"/><rect x="80" y="100" width="420" height="70" fill="#5a3a1c" stroke="#2a1a0a" stroke-width="4"/><rect x="620" y="60" width="110" height="170" fill="#55524a" stroke="#222" stroke-width="5"/><rect x="640" y="90" width="70" height="110" fill="#d9701f"/>${[[150, 400], [450, 380], [170, 700], [470, 720], [300, 960]].map(([x, y]) => `<rect x="${x}" y="${y}" width="120" height="70" fill="#6b4a26" stroke="#2a1a0a" stroke-width="4"/><circle cx="${x - 20}" cy="${y + 35}" r="14" fill="#4a3018"/><circle cx="${x + 140}" cy="${y + 35}" r="14" fill="#4a3018"/>`).join('')}<path d="M600 800H730M600 840H730M600 880H730M600 920H730M600 960H730" stroke="#2a1a0a" stroke-width="5"/><rect x="600" y="800" width="130" height="160" fill="none" stroke="#2a1a0a" stroke-width="5"/><rect x="340" y="1140" width="120" height="30" fill="#4a3018"/>${grille()}`) },
  { id: 'demo-souterrain-crypte', titre: 'Crypte oubliée', niveau: 'souterrain', milieux: ['souterrain', 'ruines'], tags: ['crypte', 'sarcophages', 'couloir', 'obscur'], description: 'Un couloir voûté desservant une salle à quatre sarcophages et un autel.', grille: { case: 50, dx: 0, dy: 0 },
    dessin: svg('#1c1b21', `<rect x="330" y="700" width="140" height="500" fill="#4a4852" stroke="#0c0b0e" stroke-width="6"/><rect x="130" y="150" width="540" height="560" fill="#55535e" stroke="#0c0b0e" stroke-width="8"/>${[[200, 230], [200, 450], [540, 230], [540, 450]].map(([x, y]) => `<rect x="${x}" y="${y}" width="60" height="150" rx="10" fill="#8b8794" stroke="#0c0b0e" stroke-width="4"/>`).join('')}<rect x="350" y="180" width="100" height="70" fill="#a09ba8" stroke="#0c0b0e" stroke-width="4"/><circle cx="400" cy="440" r="40" fill="#2a2830" stroke="#8b8794" stroke-width="3"/>${grille(50, '#ffffff14')}`) },
];

const dossierImages = path.join(dossier, 'images');
const fichierIndex = path.join(dossierImages, 'index.json');
const lireIndex = async () => {
  try { return JSON.parse(await readFile(fichierIndex, 'utf8')); } catch (e) {
    if (e.code === 'ENOENT') return indexVide();
    console.error(`images/index.json existe mais est illisible (${e.message}) : rien n'est modifié.`); process.exit(1);
  }
};

await mkdir(dossierImages, { recursive: true });
let index = await lireIndex();
if (!Array.isArray(index)) { console.error('images/index.json n\'est pas une liste : rien n\'est modifié.'); process.exit(1); }
let ajoutees = 0;
for (const { dessin, ...brut } of CARTES) {
  const fichiersExistants = (await readdir(dossierImages)).map((f) => `images/${f}`);
  const origine = { type: 'generee', outil: 'demo-bibliotheque', style: 'demo-svg', le: new Date().toISOString().slice(0, 10) };
  const { entree, problemes } = construireEntree({ ...brut, origine }, { extension: 'svg', largeur: L, hauteur: H });
  if (!entree) { console.error(`${brut.id} : ${problemes.join(' ; ')}`); process.exit(1); }
  const r = ajouterALIndex(index, entree, { fichiersExistants });
  if (r.problemes) { console.log(`déjà là, laissée : ${brut.id}`); continue; }
  await writeFile(path.join(dossier, entree.fichier), dessin, { flag: 'wx' });
  index = r.index;
  ajoutees++;
}
if (ajoutees) {
  const temporaire = `${fichierIndex}.tmp`;
  await writeFile(temporaire, JSON.stringify(index, null, 1));
  await rename(temporaire, fichierIndex);
}
console.log(`${ajoutees} carte(s) de démonstration ajoutée(s) ; images/index.json compte ${index.length} carte(s). L'appli les voit au retour sur son onglet ou au rechargement.`);
