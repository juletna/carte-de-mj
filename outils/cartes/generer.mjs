// Génère une image de carte : node outils/cartes/generer.mjs --niveau zone --id foret-ruines-01 --scene "…" [--style …] [--format paysage|portrait|carre] [--ref image]… [--essai]
// Même prompt que le panneau « Générer une carte » de la Bibliothèque (js/bibliotheque/prompt.js : STYLES, FORMATS).
// Écrit le brouillon <dossier de travail>/generees/<id>.<type> (+ <id>.prompt.txt) sans jamais écraser : il n'entre dans la liste de l'appli qu'avec ajouter.mjs. La clé OPENAI_API_KEY n'est jamais affichée.
// Quand le format recadre (paysage : 3:2 demandé, 16:9 gardé), l'image est demandée en PNG, recadrée au centre et écrite en PNG.
import { readFile, writeFile, mkdir, readdir, access } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { composerPrompt, formatCarte, cadrageCentre, STYLES, FORMATS, STYLE_PAR_DEFAUT, FORMAT_PAR_DEFAUT } from './prompt.js';
import { recadrerPng, taillePng } from './png.js';
import { construireRequete, appeler } from './fournisseur-openai.js';
import { NIVEAUX } from './vocabulaire.js';
import { dossierTravail } from './dossier.js';

const racine = fileURLToPath(new URL('../../', import.meta.url));
let dossier; // dossier de travail de l'appli (CARTE_DE_MJ_DOSSIER) ; null sans variable, ce qui n'est admis qu'avec --essai
let erreurDossier;
try {
  const r = dossierTravail(process.env);
  if (r.avertissement) console.error(`Attention : ${r.avertissement}`);
  dossier = r.dossier;
} catch (e) { erreurDossier = e.message; dossier = null; }
const FICHIER_STYLE = (style) => path.join(racine, 'assets/styles-cartes', `${style}.md`);
const TYPES = { '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const MAX_REFERENCES = 3;

const AIDE = `Génère le brouillon d'une carte dans <dossier de travail>/generees/ (gpt-image-1, clé dans OPENAI_API_KEY, dossier dans CARTE_DE_MJ_DOSSIER).

Usage : node outils/cartes/generer.mjs --niveau <${NIVEAUX.join('|')}> --id <id> --scene "<description>" [options]

Options :
  --niveau <niveau>     niveau de la carte (obligatoire)
  --id <id>             identifiant et nom de fichier : minuscules, chiffres, tirets (obligatoire)
  --scene "<texte>"     ce que la carte montre, de préférence en anglais (obligatoire)
  --style <id>          ${STYLES.map((s) => `${s.id} (${s.libelle})`).join(', ')} ; défaut : ${STYLE_PAR_DEFAUT}
  --format <id>         ${FORMATS.map((f) => `${f.id} (${f.libelle})`).join(', ')} ; défaut : ${FORMAT_PAR_DEFAUT}
  --ref <image>         image de référence de style, répétable (png, webp, jpg)
  --sans-reference      ne pas utiliser references/<style>/ du dossier de travail
  --type webp|png       type de fichier (défaut : png si le format recadre, sinon webp)
  --qualite <q>         qualité demandée à l'API (défaut : high)
  --essai               montre la requête et le prompt sans appeler l'API
  --help, -h            cette aide

Exemple :
  node outils/cartes/generer.mjs --niveau zone --id foret-ruines-01 --scene "forest clearing with a broken-column shrine" --essai`;

let o;
try {
  ({ values: o } = parseArgs({ options: {
    niveau: { type: 'string' }, scene: { type: 'string' }, id: { type: 'string' }, style: { type: 'string', default: STYLE_PAR_DEFAUT },
    format: { type: 'string', default: FORMAT_PAR_DEFAUT }, type: { type: 'string' },
    ref: { type: 'string', multiple: true }, 'sans-reference': { type: 'boolean' },
    qualite: { type: 'string', default: 'high' }, essai: { type: 'boolean' }, help: { type: 'boolean', short: 'h' }, aide: { type: 'boolean' },
  } }));
} catch (e) { console.error(`${/Unknown option '([^']+)'/.exec(e.message)?.[0].replace(/Unknown option '([^']+)'/, 'Option inconnue : $1') ?? e.message}\n\n${AIDE}`); process.exit(1); }

function sortir(message) { console.error(message); process.exit(1); }
if (o.help || o.aide) { console.log(AIDE); process.exit(0); }
if (!o.niveau || !o.scene || !o.id) sortir(`Il manque --niveau, --id ou --scene.\n\n${AIDE}`);
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(o.id) || o.id.length > 64) sortir('id : minuscules, chiffres et tirets, 64 caractères au plus.');
if (!STYLES.some((s) => s.id === o.style)) sortir(`style : ${STYLES.map((s) => s.id).join(', ')}.`);
if (!FORMATS.some((f) => f.id === o.format)) sortir(`format : ${FORMATS.map((f) => f.id).join(', ')} (le type de fichier se choisit avec --type).`);
if (o.type && !['webp', 'png'].includes(o.type)) sortir('type : webp ou png.');

/** Références explicites, sinon les premières images de <dossier>/references/<style>/ (point de départ du style). */
async function lireReferences() {
  let chemins = (o.ref ?? []).map((r) => path.resolve(r));
  if (!chemins.length && !o['sans-reference']) {
    if (!dossier) return [];
    const dossierRef = path.join(dossier, 'references', o.style);
    chemins = (await readdir(dossierRef).catch(() => [])).filter((f) => TYPES[path.extname(f).toLowerCase()]).sort().slice(0, MAX_REFERENCES).map((f) => path.join(dossierRef, f));
  }
  return Promise.all(chemins.map(async (c) => {
    const type = TYPES[path.extname(c).toLowerCase()];
    if (!type) sortir(`Référence non prise en charge (png, webp, jpg) : ${path.basename(c)}`);
    return { nom: path.basename(c), type, octets: await readFile(c).catch(() => sortir(`Référence illisible : ${c}`)) };
  }));
}

let style;
try { style = await readFile(FICHIER_STYLE(o.style), 'utf8'); } catch { sortir(`Style illisible : ${o.style}`); }
let prompt;
try { prompt = composerPrompt({ style, niveau: o.niveau, scene: o.scene, format: o.format }); } catch (e) { sortir(e.message); }
const format = formatCarte(o.format, o.niveau);
if (format.recadre && o.type === 'webp') sortir(`Le format ${o.format} recadre l'image en ${format.largeur} × ${format.hauteur} : la sortie est en png (le webp ne se recadre pas sans dépendance).`);
o.type ??= format.recadre ? 'png' : 'webp';
const references = await lireReferences();
const requete = construireRequete({ prompt, taille: format.taille, format: o.type, qualite: o.qualite, references });
const dossierSortie = dossier ? path.join(dossier, 'generees') : path.join('<CARTE_DE_MJ_DOSSIER>', 'generees');
const sortie = path.join(dossierSortie, `${o.id}.${o.type}`);

if (o.essai) {
  console.log(JSON.stringify({ essai: true, requete: { ...requete, champs: { ...requete.champs, prompt: undefined } }, prompt, references: references.map((r) => r.nom), sortie: sortie, dossier: dossier ?? 'non défini (export CARTE_DE_MJ_DOSSIER)', cle: process.env.OPENAI_API_KEY ? 'présente' : 'absente' }, null, 2));
  process.exit(0);
}

if (!dossier) sortir(erreurDossier);
if (!process.env.OPENAI_API_KEY) sortir('OPENAI_API_KEY absente de l\'environnement : exportez-la (export OPENAI_API_KEY=…) puis relancez. Rien n\'a été envoyé.');
if (await access(sortie).then(() => true, () => false)) sortir(`${sortie} existe déjà : choisissez un autre id (par exemple ${o.id}-b).`);

let octets;
try { octets = await appeler(requete, { cle: process.env.OPENAI_API_KEY, references }); } catch (e) { sortir(`Échec de la génération : ${e.message}`); }
if (format.recadre) {
  try {
    const recue = taillePng(octets);
    const cadre = cadrageCentre(recue.largeur, recue.hauteur, format.largeur, format.hauteur);
    if (cadre) octets = Buffer.from(await recadrerPng(octets, cadre));
  } catch (e) { sortir(`Recadrage impossible (${e.message}) : rien n'a été écrit.`); }
}
await mkdir(dossierSortie, { recursive: true });
await writeFile(sortie, octets, { flag: 'wx' });
await writeFile(path.join(dossierSortie, `${o.id}.prompt.txt`), prompt + '\n', { flag: 'wx' });
console.log(JSON.stringify({ brouillon: sortie, fichier: path.relative(dossier, sortie), style: o.style, format: o.format, largeur: format.largeur, hauteur: format.hauteur, grille: format.grille ? { case: format.grille.case, dx: 0, dy: 0 } : null, references: references.map((r) => r.nom), octets: octets.length }, null, 2));
