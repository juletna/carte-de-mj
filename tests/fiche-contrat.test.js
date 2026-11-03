/**
 * Contrat entre l'outil Fiche et le Donjon : la clé, le format du fichier exporté, les caractéristiques et ce qu'est une fiche
 * viennent de js/fiche/format.js et js/fiche/regles.js ; le script de fiche.html (classique, en ligne pour l'instant) en garde
 * une copie, que ce test compare. Il fait aussi passer l'exemple et la fiche vierge de fiche.html, et des fiches au hasard,
 * dans resumerFiche(), la lecture que le Donjon fait d'une fiche. Les pages sont lues par `lire(chemin)` (disque sous Node, fetch dans tests.html).
 */
import { CLE_FICHES, CLE_FICHE_ANCIENNE, FORMAT_FICHE, VERSION_FICHE, estFiche } from '../js/fiche/format.js';
import { STATS } from '../js/fiche/regles.js';
import { resumerFiche, ficheDepuisFichier, fichesDuNavigateur } from '../js/personnages.js';
import { genererFiches, CLASSES } from '../js/fiche-hasard.js';
import { CLE_FICHES as CLE_FICHES_STOCKAGE, chargerFichesLocales } from '../js/stockage.js';
import { verifier, egal, executerSuite } from './mini-test.js';

/** Le morceau de texte de `source` entre deux repères, ou une erreur claire si la page a changé de forme. */
function entre(source, debut, fin, quoi) {
  const i = source.indexOf(debut), j = source.indexOf(fin, i);
  verifier(i >= 0 && j > i, `fiche.html : repères introuvables pour ${quoi} (« ${debut} » … « ${fin} »)`);
  return source.slice(i, j);
}
const trouver = (source, re, quoi) => {
  const m = source.match(re);
  verifier(m, `fiche.html : ${quoi} introuvable (${re})`);
  return m;
};

export async function executer({ lire }) {
  const html = await lire('fiche.html');
  const feuilles = { 'js/fiche/format.js': await lire('js/fiche/format.js'), 'js/fiche/regles.js': await lire('js/fiche/regles.js') };
  const script = html.slice(html.indexOf('<script>'), html.lastIndexOf('</script>'));
  verifier(script.length > 1000, 'fiche.html : script en ligne introuvable');
  // L'exemple et la fiche vierge, tels que la page les construit.
  const pageFiche = () => new Function(`${entre(script, 'const slots=', '/* Complète', 'sample() et blank()')}; return { sample, blank };`)();

  const TESTS = [
    ['fiche.html garde les mêmes clés, le même format de fichier et les mêmes caractéristiques que js/fiche/', () => {
      const [, ancienne, actuelle] = trouver(script, /const KEY='([^']+)',KEY2='([^']+)'/, 'les clés');
      egal([actuelle, ancienne], [CLE_FICHES, CLE_FICHE_ANCIENNE], 'clés (actuelle, ancienne)');
      const [, stats] = trouver(script, /const STATS=\[([^\]]*)\]/, 'STATS');
      egal(stats.split(',').map((s) => s.trim().replace(/'/g, '')), STATS, 'caractéristiques et leur ordre');
      const [, formatExport, versionExport] = trouver(script, /format:'([^']+)',version:(\d+),personnage:/, 'l’export');
      egal([formatExport, Number(versionExport)], [FORMAT_FICHE, VERSION_FICHE], 'format et version exportés');
      const [, formatImport] = trouver(script, /j\.format==='([^']+)'/, 'le format importé');
      const [, versionMax] = trouver(script, /env&&j\.version>(\d+)/, 'la version importée au plus');
      egal([formatImport, Number(versionMax)], [FORMAT_FICHE, VERSION_FICHE], 'format et version acceptés');
      egal(CLE_FICHES_STOCKAGE, CLE_FICHES, 'le stockage du Donjon lit la même clé');
    }],

    ['l’exemple et la fiche vierge de fiche.html passent dans resumerFiche, comme un fichier exporté', () => {
      const { sample, blank } = pageFiche();
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

    ['la Fiche n’importe pas stockage.js, et js/fiche/ ne dépend de rien d’autre que du test d’objet', () => {
      verifier(!/stockage\.js/.test(html), 'fiche.html ne doit pas parler de stockage.js');
      for (const [fichier, source] of Object.entries(feuilles)) {
        const imports = [...source.matchAll(/^\s*import\b[^;]*from\s+'([^']+)'/gm)].map((m) => m[1]);
        verifier(imports.every((i) => i === '../format.js'), `${fichier} : importe ${imports.join(', ')}`);
        verifier(!/stockage/.test(source.replace(/\/\*\*[\s\S]*?\*\//g, '')), `${fichier} : ne doit pas toucher à stockage.js`);
      }
    }],
  ];
  return executerSuite('fiche (contrat) : ', TESTS);
}
