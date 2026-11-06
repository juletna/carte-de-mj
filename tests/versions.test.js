/**
 * Tests des versions de fichiers (outils/versions.mjs) : chaque page racine porte l'import map et les adresses d'entrée
 * à jour (?v=<hash du contenu>), chaque adresse de l'import map pointe un fichier qui existe, l'outil est idempotent.
 * Lit le disque : sous Node seulement (tests.html n'a pas de système de fichiers, la suite s'y réduit à une ligne).
 */
import { verifier, egal, executerSuite } from './mini-test.js';

const MESSAGE = 'Fichiers modifiés sans mise à jour des versions : lance `node outils/versions.mjs`';

export async function executer() {
  if (typeof process === 'undefined' || !process.versions?.node) {
    return [{ phrase: 'versions : vérifiées sous Node seulement (node tests/node.mjs)', ecarts: [], resultat: null }];
  }
  const { calculer, pagesAMettreAJour, entreesDe, PAGES, RACINE } = await import('../outils/versions.mjs');
  const { readFileSync, existsSync } = await import('node:fs');
  const { join } = await import('node:path');
  const lire = (p) => readFileSync(join(RACINE, p), 'utf8');
  const carteDe = (html) => JSON.parse(/<script type="importmap">([\s\S]*?)<\/script>/.exec(html)[1]).imports;

  const tests = [
    ['les pages sont à jour', () => {
      const anciennes = pagesAMettreAJour();
      verifier(!anciennes.length, `${MESSAGE} (pages : ${anciennes.join(', ')})`);
    }],
    ['chaque page a son bloc, avant le premier module', () => {
      for (const p of PAGES) {
        const html = lire(p), debut = html.indexOf('<!-- versions:debut'), fin = html.indexOf('<!-- versions:fin -->');
        verifier(debut >= 0 && fin > debut, `${p} : bloc de versions absent. ${MESSAGE}`);
        verifier(debut < html.indexOf('<script type="module"'), `${p} : l'import map doit précéder le premier module`);
      }
    }],
    ['chaque adresse de l\'import map pointe un fichier existant, de même chemin, trié', () => {
      for (const p of PAGES) {
        const carte = carteDe(lire(p)), cles = Object.keys(carte);
        verifier(cles.length > 0, `${p} : import map vide`);
        egal(cles, [...cles].sort(), `${p} : clés triées`);
        for (const [cle, url] of Object.entries(carte)) {
          verifier(/^\.\/js\/.+\.js$/.test(cle) && /^\.\/js\/.+\.js\?v=[0-9a-f]{8}$/.test(url) && url.startsWith(`${cle}?v=`), `${p} : entrée incohérente ${cle} → ${url}`);
          verifier(existsSync(join(RACINE, cle)), `${p} : ${cle} n'existe pas`);
        }
      }
    }],
    ['les adresses d\'entrée portent le même hash que l\'import map', () => {
      for (const p of PAGES) {
        const html = lire(p), carte = carteDe(html);
        const modules = [...html.matchAll(/<script type="module" src="([^"]+)"/g)].map((m) => m[1]);
        verifier(modules.length > 0 && modules.length === entreesDe(html).length, `${p} : modules d'entrée non lus`);
        for (const src of modules) verifier(carte[`./${src.replace(/\?.*/, '')}`] === `./${src}`, `${p} : ${src} diffère de l'import map. ${MESSAGE}`);
        for (const m of html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)) {
          const [chemin, v] = m[1].split('?v=');
          verifier(/^[0-9a-f]{8}$/.test(v || '') && existsSync(join(RACINE, chemin)), `${p} : feuille ${m[1]} sans version valide. ${MESSAGE}`);
        }
      }
    }],
    ['idempotent : deux calculs donnent le même texte, qui est celui des pages', () => {
      const a = calculer(), b = calculer();
      for (const p of PAGES) {
        verifier(a[p] === b[p], `${p} : deux calculs différents`);
        verifier(a[p] === lire(p), `${p} : pas à jour. ${MESSAGE}`);
      }
    }],
  ];
  return executerSuite('versions : ', tests);
}
