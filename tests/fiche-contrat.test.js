/**
 * Contrat entre l'outil Fiche et le Donjon : la clé, le format du fichier exporté, les caractéristiques et ce qu'est une fiche
 * viennent de js/fiche/format.js et js/fiche/regles.js ; la page de la Fiche (js/fiche/main.js, module) les importe et n'en garde
 * aucune copie, ce que ce test vérifie. Il fait aussi passer l'exemple et la fiche vierge de la Fiche (js/fiche/base.js), et des fiches
 * au hasard, dans resumerFiche(), la lecture que le Donjon fait d'une fiche. Les sources sont lues par `lire(chemin)` (disque sous Node, fetch dans tests.html).
 */
import { CLE_FICHES, CLE_FICHE_ANCIENNE, FORMAT_FICHE, VERSION_FICHE, estFiche } from '../js/fiche/format.js';
import { STATS } from '../js/fiche/regles.js';
import { sample, blank } from '../js/fiche/base.js';
import { resumerFiche, ficheDepuisFichier, fichesDuNavigateur } from '../js/personnages.js';
import { genererFiches, CLASSES } from '../js/fiche-hasard.js';
import { CLE_FICHES as CLE_FICHES_STOCKAGE, chargerFichesLocales } from '../js/stockage.js';
import { verifier, egal, executerSuite } from './mini-test.js';

const trouver = (source, re, quoi) => {
  const m = source.match(re);
  verifier(m, `${quoi} introuvable (${re})`);
  return m;
};

export async function executer({ lire }) {
  const html = await lire('fiche.html');
  const page = await lire('js/fiche/main.js');
  const sources = { 'js/fiche/main.js': page, 'js/fiche/base.js': await lire('js/fiche/base.js'), 'js/fiche/jeu.js': await lire('js/fiche/jeu.js'), 'js/fiche/des.js': await lire('js/fiche/des.js') };
  const feuilles = { 'js/fiche/format.js': await lire('js/fiche/format.js'), 'js/fiche/regles.js': await lire('js/fiche/regles.js') };
  verifier(/<script type="module" src="js\/fiche\/main\.js"><\/script>/.test(html), 'fiche.html : doit charger js/fiche/main.js en module');
  verifier(!/<script>/.test(html), 'fiche.html : plus de script en ligne');
  verifier(page.length > 1000, 'js/fiche/main.js : page introuvable');

  const feuillesCss = (await lire('css/base.css')) + (await lire('css/fiche.css'));

  const TESTS = [
    ['jetons : chaque var(--x) de la Fiche est défini, dans le socle commun, dans css/fiche.css ou en ligne', () => {
      const code = [feuillesCss, ...Object.values(sources)].join('\n');
      const definis = new Set([...code.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
      const inconnus = [...code.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]).filter((j) => !definis.has(j));
      egal([...new Set(inconnus)], [], 'jetons utilisés sans définition (la propriété CSS est alors ignorée en silence)');
    }],
    ['la Fiche prend sa clé, son format de fichier et ses caractéristiques de js/fiche/, sans en garder de copie', () => {
      for (const [fichier, source] of Object.entries(sources)) {
        verifier(!source.includes(CLE_FICHES) && !source.includes(CLE_FICHE_ANCIENNE), `${fichier} : recopie une clé du navigateur`);
        verifier(!/const STATS\s*=/.test(source), `${fichier} : recopie STATS`);
        verifier(!source.includes(`'${FORMAT_FICHE}'`), `${fichier} : recopie le format du fichier`);
      }
      trouver(page, /import \{[^}]*\bCLE_FICHES\b[^}]*\bFORMAT_FICHE\b[^}]*\bVERSION_FICHE\b[^}]*\} from '\.\/format\.js'/, 'l’import de la clé et du format');
      trouver(page, /import \{ STATS \} from '\.\/regles\.js'/, 'l’import de STATS');
      trouver(sources['js/fiche/base.js'], /import \{ CLE_FICHES, CLE_FICHE_ANCIENNE \} from '\.\/format\.js'/, 'l’import des clés dans base.js');
      trouver(page, /format:FORMAT_FICHE,version:VERSION_FICHE,personnage:/, 'l’export');
      trouver(page, /j\.format===FORMAT_FICHE/, 'le format importé');
      trouver(page, /env&&j\.version>VERSION_FICHE/, 'la version importée au plus');
      egal(CLE_FICHES_STOCKAGE, CLE_FICHES, 'le stockage du Donjon lit la même clé');
    }],

    ['l’exemple et la fiche vierge de la Fiche passent dans resumerFiche, comme un fichier exporté', () => {
      const exemple = resumerFiche(sample());
      verifier(exemple, 'l’exemple doit être une fiche');
      egal([exemple.nom, exemple.race, exemple.classe, exemple.niveau, exemple.pv, exemple.pvMax, exemple.ca], ['Elwyn Brisevent', 'Demi-elfe', 'Rôdeur', 3, 28, 28, 15], 'résumé de l’exemple');
      egal(Object.keys(exemple.stats), STATS, 'toutes les caractéristiques, dans l’ordre');
      egal([exemple.attaques.length, exemple.sac.length, exemple.etats], [2, 7, []], 'attaques, sac, états');
      const vierge = resumerFiche(blank());
      verifier(vierge, 'la fiche vierge doit être une fiche');
      egal([vierge.nom, vierge.niveau, vierge.pvMax, vierge.ca, vierge.sac], ['Nouveau personnage', 1, 10, 10, []], 'résumé de la fiche vierge');
      for (const perso of [sample(), blank()]) {
        verifier(estFiche(perso), 'estFiche');
        const fichier = JSON.parse(JSON.stringify({ format: FORMAT_FICHE, version: VERSION_FICHE, personnage: perso }));
        egal(ficheDepuisFichier(fichier), resumerFiche(perso), 'le fichier exporté par la Fiche se relit comme la fiche');
        egal(ficheDepuisFichier({ ...fichier, version: VERSION_FICHE + 1 }), null, 'version plus récente refusée');
      }
      // Ce que la Fiche a rangé dans le navigateur se relit côté Donjon.
      const rangement = { actif: 'a', persos: { a: sample(), b: blank() } };
      egal(fichesDuNavigateur(rangement).map((l) => l.fiche.nom), ['Elwyn Brisevent', 'Nouveau personnage'], 'fiches du navigateur');
      const stock = { getItem: (cle) => (cle === CLE_FICHES ? JSON.stringify(rangement) : null) };
      egal(chargerFichesLocales(stock).length, 2, 'lues par la clé commune');
    }],

    ['des fiches au hasard passent dans resumerFiche, et le résumé dit la même chose que le tirage', () => {
      for (const cle of Object.keys(CLASSES)) {
        const { fiches, resume } = genererFiches({ graine: 11, classe: cle, niveau: 5, nombre: 2 });
        fiches.forEach((f, i) => {
          verifier(estFiche(f), `${cle} : estFiche`);
          const r = resumerFiche(f);
          verifier(r, `${cle} : la fiche tirée doit être lue`);
          egal([r.nom, r.race, r.classe, r.niveau], [resume[i].nom, resume[i].race, resume[i].classe, resume[i].niveau], `${cle} : résumé`);
          egal(Object.keys(r.stats), STATS, `${cle} : caractéristiques`);
          egal(r.pv, f.hp, `${cle} : points de vie`);
        });
      }
    }],

    ['estFiche : un objet qui a des caractéristiques, rien d’autre', () => {
      for (const ok of [{ stats: {} }, { stats: { FOR: 10 }, name: 'x' }]) verifier(estFiche(ok), JSON.stringify(ok));
      for (const non of [null, undefined, 'x', 3, [], {}, { stats: null }, { stats: [] }, { stats: 3 }]) verifier(!estFiche(non), JSON.stringify(non));
    }],

    ['la Fiche n’importe pas stockage.js (seulement mise-de-cote.js), et js/fiche/format.js et regles.js ne dépendent de rien d’autre que du test d’objet', () => {
      verifier(!/stockage\.js/.test(html), 'fiche.html ne doit pas parler de stockage.js');
      for (const [fichier, source] of Object.entries(sources)) {
        const imports = [...source.matchAll(/^\s*import\b[^;]*from\s+'([^']+)'/gm)].map((m) => m[1]);
        verifier(imports.every((i) => /^\.\/(format|regles|base|des|jeu)\.js$|^\.\.\/(fiche-hasard|mise-de-cote|icones)\.js$/.test(i)), `${fichier} : importe ${imports.join(', ')}`);
        verifier(!/stockage/.test(source.replace(/\/\*[\s\S]*?\*\//g, '')), `${fichier} : ne doit pas toucher à stockage.js`);
      }
      for (const [fichier, source] of Object.entries(feuilles)) {
        const imports = [...source.matchAll(/^\s*import\b[^;]*from\s+'([^']+)'/gm)].map((m) => m[1]);
        verifier(imports.every((i) => i === '../format.js'), `${fichier} : importe ${imports.join(', ')}`);
        verifier(!/stockage/.test(source.replace(/\/\*\*[\s\S]*?\*\//g, '')), `${fichier} : ne doit pas toucher à stockage.js`);
      }
    }],
  ];
  return executerSuite('fiche (contrat) : ', TESTS);
}
