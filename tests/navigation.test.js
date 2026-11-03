/**
 * Parité du bloc de navigation entre les pages HTML : chaque page répète à la main le même menu
 * (nom du site + liens vers les outils). Ce test garde ces copies identiques, au lien courant près.
 * Les pages sont lues par `lire(chemin)` (disque sous Node, fetch dans tests.html).
 */
import { verifier, egal, executerSuite } from './mini-test.js';

const PAGES = ['index.html', 'fiche.html', 'donjon.html', 'presentation.html', 'impression.html'];
const LIENS = ['fiche.html', 'donjon.html', 'presentation.html'];

/** Les menus d'une page : le nom du site et les liens de <nav aria-label="Navigation principale">, sans espaces superflus. */
function menus(html) {
  return [...html.matchAll(/<a class="menu-nom"[^>]*>[^<]*<\/a>\s*<nav aria-label="Navigation principale">([\s\S]*?)<\/nav>/g)].map((m) => ({
    liens: [...m[1].matchAll(/<a\b([^>]*)>([^<]*)<\/a>/g)].map((a) => ({ attrs: a[1].replace(/\s*aria-current="page"/, '').replace(/\s+/g, ' ').trim(), texte: a[2].trim(), courant: /aria-current="page"/.test(a[1]) })),
  }));
}
const cible = (attrs) => attrs.match(/href="([^"]*)"/)?.[1];

export async function executer({ lire }) {
  const pages = {};
  for (const page of PAGES) pages[page] = menus(await lire(page));
  const TESTS = [
    ['chaque page a au moins un menu, avec les trois outils dans le même ordre', () => {
      for (const page of PAGES) {
        verifier(pages[page].length > 0, `${page} : aucun bloc de navigation`);
        for (const menu of pages[page]) egal(menu.liens.map((l) => cible(l.attrs)), LIENS, `${page} : liens du menu`);
      }
    }],
    ['tous les menus sont identiques, au lien courant près', () => {
      const [reference, ...autres] = PAGES.flatMap((page) => pages[page].map((m) => ({ page, signature: m.liens.map((l) => `${l.attrs}|${l.texte}`) })));
      for (const m of autres) egal(m.signature, reference.signature, `menu de ${m.page} comparé à celui de ${reference.page}`);
    }],
    ['le lien courant est celui de la page, jamais un autre', () => {
      for (const page of PAGES) {
        for (const menu of pages[page]) {
          const courants = menu.liens.filter((l) => l.courant).map((l) => cible(l.attrs));
          egal(courants.filter((c) => c !== page), [], `${page} : lien courant vers une autre page`);
          verifier(courants.length <= 1, `${page} : plusieurs liens courants`);
        }
      }
    }],
  ];
  return executerSuite('navigation : ', TESTS);
}
