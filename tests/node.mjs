// Lance toutes les suites sans navigateur : node tests/node.mjs
import { readFile } from 'node:fs/promises';
import { executerTout } from './tous.js';

// Les moteurs de rendu lisent window.devicePixelRatio ; ici, un écran à densité 1.
globalThis.window ??= { devicePixelRatio: 1 };

const racine = new URL('../', import.meta.url);
const resultats = await executerTout({ lire: (chemin) => readFile(new URL(chemin, racine), 'utf8') });
let echecs = 0;
for (const r of resultats) {
  const ok = r.ecarts.length === 0;
  if (!ok) echecs++;
  console.log(`${ok ? '✔' : '✘'} ${r.phrase}`);
  for (const e of r.ecarts) console.log(`    ${e}`);
}
console.log(`\n${resultats.length - echecs}/${resultats.length} réussis`);
process.exit(echecs ? 1 : 0);
