/**
 * Tests des fonctions pures de outils/cartes/ : composition du prompt, format par niveau, validation et ajout d'une entrée du catalogue.
 * Le style est lu par `lire` (assets/styles-cartes/), sans API propre à Node.
 */
import { composerPrompt, extraireSections, formatDuNiveau, promptACopier } from '../outils/cartes/prompt.js';
import { validerEntree, ajouterAuCatalogue, catalogueVide } from '../outils/cartes/entree.js';
import { NIVEAUX } from '../outils/cartes/vocabulaire.js';
import { verifier, egal, executerSuite } from './mini-test.js';

const STYLE = 'assets/styles-cartes/peint-v1.md';
const entree = (o = {}) => ({ id: 'foret-01', titre: 'Forêt', fichier: 'cartes/foret-01.webp', largeur: 1024, hauteur: 1536, niveau: 'zone', milieux: ['foret'], tags: ['chemin'], description: 'Un chemin.', grille: { case: 51.2, dx: 0, dy: 0 }, ...o });

export async function executer({ lire }) {
  const style = await lire(STYLE);
  return executerSuite('outils cartes : ', [
    ['chaque niveau a un gabarit et un prompt avec style, scène et échelle', () => {
      for (const n of NIVEAUX) {
        const p = composerPrompt({ style, niveau: n, scene: 'une clairière' });
        verifier(p.includes('une clairière') && p.includes('top-down') && p.includes('1.5 meters') && !p.includes('{scene}'), `prompt incomplet pour ${n}`);
      }
    }],
    ['niveau inconnu ou scène vide : refusés', () => {
      let leve = 0;
      for (const a of [{ niveau: 'lune', scene: 'x' }, { niveau: 'zone', scene: '  ' }]) { try { composerPrompt({ style, ...a }); } catch { leve++; } }
      egal(leve, 2, 'refus');
    }],
    ['prompt à copier : format en clair, cases pour un niveau à grille, aucune pour un monde', () => {
      const z = promptACopier({ style, niveau: 'zone', scene: 'une clairière' });
      verifier(z.startsWith(composerPrompt({ style, niveau: 'zone', scene: 'une clairière' })) && z.includes('1024 × 1536') && z.includes('20 × 30 squares'), 'zone');
      const m = promptACopier({ style, niveau: 'monde', scene: 'un archipel' });
      verifier(m.includes('1024 × 1536') && !m.includes('The picture covers'), 'monde');
    }],
    ['style : les sections attendues existent', () => {
      const s = extraireSections(style);
      verifier(s['Bloc de style'] && s['Échelle'] && s.Format, 'sections manquantes');
    }],
    ['format : monde et région sans grille, zone 20×30 à 51,2 px', () => {
      const s = extraireSections(style);
      egal(formatDuNiveau(s, 'monde').grille, null, 'monde');
      egal(formatDuNiveau(s, 'region').grille, null, 'region');
      egal(formatDuNiveau(s, 'zone').grille, { case: 51.2, colonnes: 20, lignes: 30 }, 'zone');
      egal(formatDuNiveau(s, 'zone').taille, '1024x1536', 'taille');
    }],
    ['une entrée valide passe, une entrée abîmée est refusée avec ses raisons', () => {
      egal(validerEntree(entree()), [], 'valide');
      const p = validerEntree(entree({ id: 'Foret 1', niveau: 'x', milieux: [], fichier: '../a.webp' }));
      verifier(p.length === 4, `4 problèmes attendus, ${p.length} : ${p.join(' | ')}`);
    }],
    ['ajout : id en double refusé, catalogue non modifié, valeurs par défaut posées', () => {
      const vide = catalogueVide();
      const r = ajouterAuCatalogue(vide, entree());
      egal(r.catalogue.cartes.length, 1, 'ajoutée');
      egal(vide.cartes.length, 0, 'original intact');
      egal(r.catalogue.cartes[0].origine.style, 'peint-v1', 'origine');
      verifier(ajouterAuCatalogue(r.catalogue, entree()).problemes[0].includes('déjà pris'), 'doublon accepté');
      verifier(ajouterAuCatalogue({ format: 'autre' }, entree()).problemes, 'catalogue illisible accepté');
    }],
  ]);
}
