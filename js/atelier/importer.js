/**
 * « Importer un fichier… », l'entrée unique du menu « + Nouveau » de l'arbre : un seul choix de fichier, qu'il contienne un monde ou un donjon.
 * Le champ `format` du JSON tranche (`genreDuFichier`, pur, testé sous Node) : un monde va à js/mj/univers-ui.js (`importerMondeLu`), tout le
 * reste au donjon (js/mj/menu-donjon.js, `importerDonjonLu`), qui sait aussi relire les anciens fichiers et dit pourquoi il refuse.
 * Appelée une fois par js/main-mj.js, après inscrireDonjon et inscrireMonde. Rien n'est écrasé : l'import s'ajoute, comme avant.
 */
import { h } from '../dom.js';
import { FORMAT as FORMAT_MONDE } from '../univers.js';
import { lireFichierJson } from '../stockage.js';
import { telephone } from '../telephone.js';

/** 'monde' quand le JSON lu se dit monde (`format: 'carte-de-mj-univers'`), 'donjon' sinon (le donjon reconnaît ou refuse le reste). */
export function genreDuFichier(brut) {
  return brut && typeof brut === 'object' && brut.format === FORMAT_MONDE ? 'monde' : 'donjon';
}

export function inscrireImport(coquille, ctx) {
  const fichier = h('input', { type: 'file', id: 'atelier-importer', accept: '.json,application/json', hidden: true, 'aria-label': 'Importer un monde ou un donjon (fichier JSON)' });
  document.body.append(fichier);
  fichier.addEventListener('change', async () => {
    const f = fichier.files?.[0];
    fichier.value = '';
    if (!f) return;
    let brut;
    try { brut = await lireFichierJson(f); } catch (err) { ctx.menu.messageFichier('', [`Import refusé : ${err.message}`]); return; }
    if (genreDuFichier(brut) === 'monde') {
      const u = ctx.univers.importerMondeLu(brut);
      if (u) coquille.naviguer({ page: 'monde', monde: u.id });
    } else ctx.menu.importerDonjonLu(brut);
  });
  coquille.arbre.ajouterAction({
    groupe: 'apporter', ordre: 1, libelle: 'Importer un fichier…', icone: 'importer', aide: 'Importer un monde ou un donjon (fichier JSON)',
    executer: () => { if (telephone()) coquille.fermerTiroir({ rendreFocus: false }); fichier.click(); },
  });
}
