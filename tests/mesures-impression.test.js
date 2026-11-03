/**
 * Concordance des mesures d'impression entre js/impression.js (le découpage en cases) et css/impression.css (la mise en page) :
 * `@page` ne lit pas de variable, donc sa marge et son format sont écrits dans la feuille de style et comparés ici aux
 * constantes ; les autres mesures passent par les variables CSS de `variablesCss()`, que la feuille doit toutes lire.
 * Marche sous Node et dans tests.html.
 */
import { MARGE_PAGE_MM, FEUILLE, ZONE, JEU_PAGE_MM, ENTETE_MM, REPERE_COLONNES_MM, REPERE_LIGNES_MM, REGLE_MM, variablesCss } from '../js/impression.js';
import { verifier, egal, executerSuite } from './mini-test.js';

/** Le corps d'une règle `@page` (avec ou sans nom), ou undefined. */
const regleDePage = (css, nom = '') => css.match(new RegExp(`@page${nom ? ` ${nom}` : ''}\\s*\\{([^}]*)\\}`))?.[1];
/** Les déclarations d'un corps de règle : { propriété: valeur }. */
const declarations = (corps) => Object.fromEntries(corps.split(';').map((d) => d.split(/:(.*)/s).map((x) => x?.trim())).filter(([p]) => p));

const TESTS = (css) => [
  ['@page : la marge et le format de la feuille de style sont ceux des constantes', () => {
    const portrait = declarations(regleDePage(css) ?? ''), paysage = declarations(regleDePage(css, 'paysage') ?? '');
    egal([portrait.margin, paysage.margin], [`${MARGE_PAGE_MM}mm`, `${MARGE_PAGE_MM}mm`], 'marge de @page');
    egal([portrait.size, paysage.size], ['A4', 'A4 landscape'], 'format de @page');
    egal([FEUILLE.portrait.l, FEUILLE.portrait.h, FEUILLE.paysage.l, FEUILLE.paysage.h], [210, 297, 297, 210], 'le format A4 des constantes');
  }],
  ['variablesCss : les mesures sont celles des constantes, dans l’unité du millimètre', () => {
    const v = variablesCss();
    egal(v, {
      '--marge-page': `${MARGE_PAGE_MM}mm`,
      '--page-portrait-l': `${ZONE.portrait.l}mm`, '--page-portrait-h': `${ZONE.portrait.h - JEU_PAGE_MM}mm`,
      '--page-paysage-l': `${ZONE.paysage.l}mm`, '--page-paysage-h': `${ZONE.paysage.h - JEU_PAGE_MM}mm`,
      '--entete': `${ENTETE_MM}mm`, '--repere-colonnes': `${REPERE_COLONNES_MM}mm`, '--repere-lignes': `${REPERE_LIGNES_MM}mm`,
      '--regle': `${REGLE_MM}mm`,
    }, 'variables');
    egal([v['--page-portrait-l'], v['--page-portrait-h'], v['--page-paysage-l'], v['--page-paysage-h']], ['190mm', '276.5mm', '277mm', '189.5mm'], 'les pages gardent leurs dimensions d’origine');
  }],
  ['la feuille de style lit chaque variable posée par variablesCss, et n’en lit pas d’autre qui manquerait', () => {
    const posees = Object.keys(variablesCss());
    const lues = new Set([...css.matchAll(/var\((--[a-z-]+)/g)].map((m) => m[1]));
    for (const nom of posees) verifier(lues.has(nom), `${nom} est posée mais la feuille ne la lit pas`);
    // Les jetons du site (--fond, --bord, --accent…) viennent de base.css ; les mesures d'impression sont les seules à porter ces préfixes.
    for (const nom of lues) {
      if (/^--(page-|repere-|entete$|regle$|marge-page$)/.test(nom)) verifier(posees.includes(nom), `${nom} est lue par la feuille mais personne ne la pose`);
    }
  }],
  ['la feuille ne répète plus les mesures qui viennent des constantes (page, en-tête, repères, règle)', () => {
    verifier(!/\b(190|276\.5|277|189\.5)mm\b/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'une dimension de page est écrite en dur');
    const corps = (selecteur) => css.match(new RegExp(`(?:^|\\n)${selecteur.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
    verifier(/height:\s*var\(--entete\)/.test(corps('.page .entete')), 'hauteur de l’en-tête');
    verifier(/width:\s*var\(--repere-lignes\)/.test(corps('.page .numeros')), 'largeur des numéros');
    verifier(/height:\s*var\(--repere-colonnes\)/.test(corps('.page .lettres')), 'hauteur des lettres');
    verifier(/width:\s*var\(--regle\)/.test(corps('.page .regle')), 'largeur de la règle');
  }],
];

export async function executer({ lire }) {
  return executerSuite('mesures d’impression : ', TESTS(await lire('css/impression.css')));
}
