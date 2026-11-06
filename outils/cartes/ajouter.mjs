// Ajoute une entrée à bibliotheque/catalogue.json : node outils/cartes/ajouter.mjs entree.json   (ou JSON sur l'entrée standard avec « - »)
// Crée le catalogue s'il manque, refuse un id en double ou une entrée invalide, n'écrase rien (le fichier image doit exister).
import { readFile, writeFile, mkdir, access, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ajouterAuCatalogue, catalogueVide } from './entree.js';

const racine = fileURLToPath(new URL('../../', import.meta.url));
const dossier = path.join(racine, 'bibliotheque');
const fichierCatalogue = path.join(dossier, 'catalogue.json');
function sortir(m) { console.error(m); process.exit(1); }

const AIDE = `Ajoute une carte à bibliotheque/catalogue.json (le crée s'il manque, n'écrase rien).

Usage : node outils/cartes/ajouter.mjs <entree.json | ->

  <entree.json>   fichier JSON d'une entrée du catalogue (id, titre, fichier, largeur, hauteur, niveau, milieux, tags, description, grille…)
  -               lit l'entrée sur l'entrée standard
  --help, -h      cette aide

L'image (bibliotheque/<fichier>) doit déjà exister ; un id déjà pris ou une entrée invalide est refusé avec ses raisons.

Exemple :
  node outils/cartes/ajouter.mjs entree.json`;
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) { console.log(AIDE); process.exit(0); }
const inconnue = args.find((a) => a.startsWith('-') && a !== '-');
if (inconnue) sortir(`Option inconnue : ${inconnue}\n\n${AIDE}`);
const source = args[0];
if (!source) sortir(`Il manque le fichier d'entrée.\n\n${AIDE}`);
let entree;
try {
  const texte = source === '-' ? await new Promise((ok) => { let t = ''; process.stdin.on('data', (d) => (t += d)).on('end', () => ok(t)); }) : await readFile(source, 'utf8');
  entree = JSON.parse(texte);
} catch (e) { sortir(`Entrée illisible : ${e.message}`); }

let catalogue;
try { catalogue = JSON.parse(await readFile(fichierCatalogue, 'utf8')); } catch (e) {
  if (e.code !== 'ENOENT') sortir(`catalogue.json illisible, non modifié : ${e.message}`);
  catalogue = catalogueVide();
}
if (typeof entree?.fichier === 'string' && !(await access(path.join(dossier, entree.fichier)).then(() => true, () => false))) sortir(`Le fichier image bibliotheque/${entree.fichier} n'existe pas : rien n'a été ajouté.`);
const r = ajouterAuCatalogue(catalogue, entree);
if (r.problemes) sortir(`Entrée refusée :\n- ${r.problemes.join('\n- ')}`);
await mkdir(dossier, { recursive: true });
const temporaire = `${fichierCatalogue}.tmp`;
await writeFile(temporaire, JSON.stringify(r.catalogue, null, 2) + '\n');
await rename(temporaire, fichierCatalogue);
console.log(`Ajouté : ${entree.id} (${r.catalogue.cartes.length} carte(s) au catalogue).`);
