// Génère une image de carte : node outils/cartes/generer.mjs --niveau zone --id foret-ruines-01 --scene "…" [--ref image]… [--format webp|png] [--essai]
// Écrit bibliotheque/cartes/<id>.<format> (+ <id>.prompt.txt) sans jamais écraser. La clé OPENAI_API_KEY n'est jamais affichée.
import { readFile, writeFile, mkdir, readdir, access } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { composerPrompt, extraireSections, formatDuNiveau } from './prompt.js';
import { construireRequete, appeler } from './fournisseur-openai.js';
import { NIVEAUX } from './vocabulaire.js';

const racine = fileURLToPath(new URL('../../', import.meta.url));
const FICHIER_STYLE = (style) => path.join(racine, '.claude/skills/generer-carte/style', `${style}.md`);
const TYPES = { '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const MAX_REFERENCES = 3;

const { values: o } = parseArgs({ options: {
  niveau: { type: 'string' }, scene: { type: 'string' }, id: { type: 'string' }, style: { type: 'string', default: 'peint-v1' },
  ref: { type: 'string', multiple: true }, 'sans-reference': { type: 'boolean' }, format: { type: 'string', default: 'webp' },
  qualite: { type: 'string', default: 'high' }, essai: { type: 'boolean' }, aide: { type: 'boolean' },
} });

function sortir(message) { console.error(message); process.exit(1); }
if (o.aide || !o.niveau || !o.scene || !o.id) sortir(`Usage : node outils/cartes/generer.mjs --niveau <${NIVEAUX.join('|')}> --id <id> --scene "<description>" [--ref image]… [--sans-reference] [--format webp|png] [--style peint-v1] [--essai]`);
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(o.id) || o.id.length > 64) sortir('id : minuscules, chiffres et tirets, 64 caractères au plus.');
if (!['webp', 'png'].includes(o.format)) sortir('format : webp ou png.');

/** Références explicites, sinon les premières images de bibliotheque/references/<style>/ (point de départ du style). */
async function lireReferences() {
  let chemins = (o.ref ?? []).map((r) => path.resolve(r));
  if (!chemins.length && !o['sans-reference']) {
    const dossier = path.join(racine, 'bibliotheque/references', o.style);
    chemins = (await readdir(dossier).catch(() => [])).filter((f) => TYPES[path.extname(f).toLowerCase()]).sort().slice(0, MAX_REFERENCES).map((f) => path.join(dossier, f));
  }
  return Promise.all(chemins.map(async (c) => {
    const type = TYPES[path.extname(c).toLowerCase()];
    if (!type) sortir(`Référence non prise en charge (png, webp, jpg) : ${path.basename(c)}`);
    return { nom: path.basename(c), type, octets: await readFile(c).catch(() => sortir(`Référence illisible : ${c}`)) };
  }));
}

let style;
try { style = await readFile(FICHIER_STYLE(o.style), 'utf8'); } catch { sortir(`Style inconnu : ${o.style}`); }
let prompt;
try { prompt = composerPrompt({ style, niveau: o.niveau, scene: o.scene }); } catch (e) { sortir(e.message); }
const format = formatDuNiveau(extraireSections(style), o.niveau);
const references = await lireReferences();
const requete = construireRequete({ prompt, taille: format.taille, format: o.format, qualite: o.qualite, references });
const dossierSortie = path.join(racine, 'bibliotheque/cartes');
const sortie = path.join(dossierSortie, `${o.id}.${o.format}`);

if (o.essai) {
  console.log(JSON.stringify({ essai: true, requete: { ...requete, champs: { ...requete.champs, prompt: undefined } }, prompt, references: references.map((r) => r.nom), sortie: path.relative(racine, sortie), cle: process.env.OPENAI_API_KEY ? 'présente' : 'absente' }, null, 2));
  process.exit(0);
}

if (!process.env.OPENAI_API_KEY) sortir('OPENAI_API_KEY absente de l\'environnement : exportez-la (export OPENAI_API_KEY=…) puis relancez. Rien n\'a été envoyé.');
if (await access(sortie).then(() => true, () => false)) sortir(`${path.relative(racine, sortie)} existe déjà : choisissez un autre id (par exemple ${o.id}-b).`);

let octets;
try { octets = await appeler(requete, { cle: process.env.OPENAI_API_KEY, references }); } catch (e) { sortir(`Échec de la génération : ${e.message}`); }
await mkdir(dossierSortie, { recursive: true });
await writeFile(sortie, octets, { flag: 'wx' });
await writeFile(path.join(dossierSortie, `${o.id}.prompt.txt`), prompt + '\n', { flag: 'wx' });
console.log(JSON.stringify({ fichier: `cartes/${o.id}.${o.format}`, largeur: format.largeur, hauteur: format.hauteur, grille: format.grille ? { case: format.grille.case, dx: 0, dy: 0 } : null, references: references.map((r) => r.nom), octets: octets.length }, null, 2));
