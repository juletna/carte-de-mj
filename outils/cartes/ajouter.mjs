// Ajoute une carte à la liste de l'appli : node outils/cartes/ajouter.mjs entree.json   (ou JSON sur l'entrée standard avec « - »)
// Copie l'image vers <dossier de travail>/images/<id>.<ext> et ajoute l'entrée à images/index.json. N'écrase rien.
import { readFile, writeFile, mkdir, copyFile, readdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { construireEntree, ajouterALIndex, extensionDe, indexVide } from './entree.js';
import { dossierTravail } from './dossier.js';
import { taillePng } from './png.js';

function sortir(m) { console.error(m); process.exit(1); }
let dossier;
try {
  const r = dossierTravail(process.env);
  if (r.avertissement) console.error(`Attention : ${r.avertissement}`);
  dossier = r.dossier;
} catch (e) { sortir(e.message); }

const AIDE = `Ajoute une carte à la liste de l'appli : images/<id>.<ext> + images/index.json du dossier de travail (CARTE_DE_MJ_DOSSIER).

Usage : node outils/cartes/ajouter.mjs <entree.json | ->

  <entree.json>   fichier JSON : id, titre, fichier, niveau, milieux, tags, description, grille, origine, licence, credit…
                  « fichier » est le brouillon (chemin relatif au dossier de travail, ou absolu) ; largeur et hauteur
                  se lisent dans un PNG, sinon à donner dans l'entrée.
  -               lit l'entrée sur l'entrée standard
  --help, -h      cette aide

Un id déjà pris, un fichier images/<id>.* existant ou une entrée invalide est refusé avec ses raisons. L'appli voit la carte
au retour sur son onglet ou au rechargement.

Exemple :
  node outils/cartes/ajouter.mjs entree.json`;
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) { console.log(AIDE); process.exit(0); }
const inconnue = args.find((a) => a.startsWith('-') && a !== '-');
if (inconnue) sortir(`Option inconnue : ${inconnue}\n\n${AIDE}`);
const source = args[0];
if (!source) sortir(`Il manque le fichier d'entrée.\n\n${AIDE}`);
let brut;
try {
  const texte = source === '-' ? await new Promise((ok) => { let t = ''; process.stdin.on('data', (d) => (t += d)).on('end', () => ok(t)); }) : await readFile(source, 'utf8');
  brut = JSON.parse(texte);
} catch (e) { sortir(`Entrée illisible : ${e.message}`); }

if (typeof brut?.fichier !== 'string' || !brut.fichier) sortir('fichier : le chemin du brouillon est obligatoire.');
const brouillon = path.resolve(dossier, brut.fichier);
const extension = extensionDe(brouillon);
let octets;
try { octets = await readFile(brouillon); } catch { sortir(`Le brouillon ${brouillon} est illisible ou absent : rien n'a été ajouté.`); }
let taille = {};
if (extension === 'png') { try { taille = taillePng(octets); } catch { /* largeur et hauteur à donner dans l'entrée */ } }
const r = construireEntree(brut, { extension, ...taille });
if (r.problemes) sortir(`Entrée refusée :\n- ${r.problemes.join('\n- ')}`);

const fichierIndex = path.join(dossier, 'images', 'index.json');
let index;
try { index = JSON.parse(await readFile(fichierIndex, 'utf8')); } catch (e) {
  if (e.code !== 'ENOENT') sortir(`images/index.json illisible, non modifié : ${e.message}`);
  index = indexVide();
}
const fichiersExistants = (await readdir(path.join(dossier, 'images')).catch(() => [])).map((f) => `images/${f}`);
const a = ajouterALIndex(index, r.entree, { fichiersExistants });
if (a.problemes) sortir(`Entrée refusée :\n- ${a.problemes.join('\n- ')}`);

await mkdir(path.join(dossier, 'images'), { recursive: true });
await copyFile(brouillon, path.join(dossier, r.entree.fichier), 1); // COPYFILE_EXCL : ne jamais écraser
// Relecture juste avant l'écriture : l'appli a pu modifier l'index entre-temps.
let frais;
try { frais = JSON.parse(await readFile(fichierIndex, 'utf8')); } catch (e) { frais = e.code === 'ENOENT' ? indexVide() : null; }
const b = frais && ajouterALIndex(frais, r.entree);
if (!b || b.problemes) sortir(`L'index a changé pendant l'ajout : relancez. ${b?.problemes?.join(' ') ?? ''}`);
const temporaire = `${fichierIndex}.tmp`;
await writeFile(temporaire, JSON.stringify(b.index, null, 1));
await rename(temporaire, fichierIndex);
console.log(`Ajouté : ${r.entree.id} (${b.index.length} carte(s) dans images/index.json). L'appli la voit au retour sur son onglet ou au rechargement.`);
