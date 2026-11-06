// Versions des fichiers (anti-cache) : node outils/versions.mjs [--verifier]
//
// GitHub Pages sert chaque fichier avec « Cache-Control: max-age=600 » : après un déploiement, un navigateur peut garder
// un ancien js/x.js à côté d'un nouveau js/y.js. Ici, chaque fichier JS et CSS est demandé sous une adresse qui change
// quand son contenu change (?v=<hash du contenu>). Pour chaque page racine, l'outil écrit :
//   - dans le <head>, entre <!-- versions:debut --> et <!-- versions:fin -->, une import map qui remappe chaque module
//     atteignable depuis les scripts de la page (« ./js/x.js » → « ./js/x.js?v=HASH »), une entrée par ligne ;
//   - les adresses d'entrée de la page (<script type="module" src>, <link rel="stylesheet" href>) avec le même ?v=HASH.
// Le hash d'un fichier ne dépend que de son contenu. Idempotent : relancé sans changement, il ne modifie rien.
// Sans --verifier, il écrit les pages ; avec, il n'écrit rien et sort en erreur si une page n'est pas à jour.
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, resolve, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Pages versionnées (tests.html, outil de développement, n'en fait pas partie). */
export const PAGES = ['index.html', 'donjon.html', 'presentation.html', 'bibliotheque.html', 'fiche.html', 'impression.html'];
export const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEBUT = '<!-- versions:debut (généré par outils/versions.mjs, ne pas modifier à la main) -->';
const FIN = '<!-- versions:fin -->';
const BLOC = /[ \t]*<!-- versions:debut[^>]*-->[\s\S]*?<!-- versions:fin -->[ \t]*\n?/;
const SCRIPT = /(<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["'])([^"'?#]+)(?:\?[^"']*)?(["'])/g;
const LIEN = /(<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["'])([^"'?#]+)(?:\?[^"']*)?(["'])/g;

/** Chemins (relatifs à la racine, séparés par « / ») des fichiers d'un dossier ayant l'extension donnée. */
function lister(racine, dossier, ext) {
  const sortie = [];
  for (const e of readdirSync(join(racine, dossier), { withFileTypes: true })) {
    const chemin = `${dossier}/${e.name}`;
    if (e.isDirectory()) sortie.push(...lister(racine, chemin, ext));
    else if (e.name.endsWith(ext)) sortie.push(chemin);
  }
  return sortie;
}

/** Les imports d'un module : fichiers relatifs à la racine, et `dynamique` si un import() n'a pas d'argument littéral. */
export function importsDe(racine, chemin) {
  const source = readFileSync(join(racine, chemin), 'utf8');
  const specifieurs = new Set();
  // import … from '…', export … from '…', import '…' (les listes peuvent s'étendre sur plusieurs lignes)
  for (const m of source.matchAll(/\b(?:import|export)\s*(?:[^'";]*?\bfrom\s*)?['"]([^'"\n]+)['"]/g)) specifieurs.add(m[1]);
  // import('…') à argument littéral
  for (const m of source.matchAll(/\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g)) specifieurs.add(m[1]);
  const dynamique = /\bimport\s*\(\s*(?!['"])/.test(source);
  const fichiers = [];
  for (const s of specifieurs) {
    if (!/^\.\.?\//.test(s)) continue; // spécifieur nu ou URL absolue : hors de notre graphe
    const cible = posix.normalize(posix.join(posix.dirname(chemin), s));
    const absolu = join(racine, cible);
    if (existsSync(absolu) && statSync(absolu).isFile()) fichiers.push(cible);
  }
  return { fichiers, dynamique };
}

/** Les modules atteignables depuis des points d'entrée (tous `tousLesJs` si un import() n'est pas littéral). */
export function atteignables(racine, entrees, tousLesJs) {
  const vus = new Set(), pile = [...entrees];
  let tout = false;
  while (pile.length) {
    const f = pile.pop();
    if (vus.has(f)) continue;
    vus.add(f);
    const { fichiers, dynamique } = importsDe(racine, f);
    if (dynamique) tout = true;
    pile.push(...fichiers);
  }
  return tout ? new Set(tousLesJs) : vus;
}

// Les hashes (SHA-1 tronqué à 8 caractères) de tous les fichiers .js de js/ et .css de css/, sous-dossiers compris.
export function hashes(racine = RACINE) {
  const h = {};
  for (const f of [...lister(racine, 'js', '.js'), ...lister(racine, 'css', '.css')]) {
    h[f] = createHash('sha1').update(readFileSync(join(racine, f))).digest('hex').slice(0, 8);
  }
  return h;
}

/** Les modules d'entrée d'une page (<script type="module" src="…"> locaux). */
export function entreesDe(html) {
  return [...html.matchAll(SCRIPT)].map((m) => m[2]).filter((u) => !/^([a-z]+:)?\/\//i.test(u) && !u.startsWith('/'));
}

/** Le texte attendu d'une page : import map + adresses d'entrée versionnées. */
export function attendu(racine, page, h) {
  const html = readFileSync(join(racine, page), 'utf8');
  const tousLesJs = Object.keys(h).filter((f) => f.endsWith('.js'));
  const modules = [...atteignables(racine, entreesDe(html), tousLesJs)].sort();
  const imports = {};
  for (const f of modules) imports[`./${f}`] = `./${f}?v=${h[f]}`;
  const carte = JSON.stringify({ imports }, null, 2).split('\n').join('\n  ');
  const bloc = `  ${DEBUT}\n  <script type="importmap">\n  ${carte}\n  </script>\n  ${FIN}\n`;
  const versionner = (_, avant, adresse, apres) => `${avant}${adresse}${h[adresse] ? `?v=${h[adresse]}` : ''}${apres}`;
  const sortie = html.replace(BLOC, '').replace(SCRIPT, versionner).replace(LIEN, versionner);
  // Dans le <head> ; fiche.html n'en écrit pas (head implicite) : le bloc va alors juste avant le premier module, qui suffit.
  const ou = /[ \t]*<\/head>/.test(sortie) ? /[ \t]*<\/head>/ : /[ \t]*<script\b[^>]*\btype=["']module["']/;
  if (!ou.test(sortie)) throw new Error(`${page} : ni </head> ni module où placer l'import map`);
  return sortie.replace(ou, (m) => `${bloc}${m}`);
}

/** Ce que doit contenir chaque page : { 'index.html': texte, … }. Ne lit que le disque, n'écrit rien. */
export function calculer(racine = RACINE) {
  const h = hashes(racine), sortie = {};
  for (const p of PAGES) sortie[p] = attendu(racine, p, h);
  return sortie;
}

/** Les pages dont le contenu n'est pas celui attendu. */
export function pagesAMettreAJour(racine = RACINE) {
  return Object.entries(calculer(racine)).filter(([p, texte]) => readFileSync(join(racine, p), 'utf8') !== texte).map(([p]) => p);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const verifier = process.argv.includes('--verifier');
  let ecarts = 0;
  for (const [page, texte] of Object.entries(calculer())) {
    if (readFileSync(join(RACINE, page), 'utf8') === texte) continue;
    ecarts++;
    if (!verifier) writeFileSync(join(RACINE, page), texte);
    console.log(`${verifier ? 'à mettre à jour' : 'mis à jour'} : ${page}`);
  }
  if (!ecarts) console.log('Versions à jour.');
  else if (verifier) { console.error('Fichiers modifiés sans mise à jour des versions : lance `node outils/versions.mjs`'); process.exit(1); }
}
