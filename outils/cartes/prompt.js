/**
 * Composition du prompt d'une carte : bloc de style + gabarit du niveau (avec la scène) + règles d'échelle.
 * Module pur (aucune API Node), le style est lu par l'appelant : `style/peint-v1.md` du skill.
 */
import { NIVEAUX } from './vocabulaire.js';

/** Découpe le fichier de style en sections `## Titre` → texte. */
export function extraireSections(markdown) {
  const sections = {};
  let titre = null;
  for (const ligne of String(markdown).split('\n')) {
    const m = /^## (.+?)\s*$/.exec(ligne);
    if (m) { titre = m[1]; sections[titre] = ''; } else if (titre) sections[titre] += ligne + '\n';
  }
  for (const t of Object.keys(sections)) sections[t] = sections[t].trim();
  return sections;
}

/** Taille d'image demandée et grille associée, d'après le tableau « Format » du style. Rend { taille, grille }. */
export function formatDuNiveau(sections, niveau) {
  const ligne = (sections.Format || '').split('\n').find((l) => l.startsWith(`| ${niveau} |`));
  const cellules = ligne ? ligne.split('|').map((c) => c.trim()) : [];
  const cases = /(\d+)\s*×\s*(\d+)/.exec(cellules[2] || '');
  const px = parseFloat((cellules[3] || '').replace(',', '.'));
  const grille = cases && px ? { case: Math.round(px * 100) / 100, colonnes: +cases[1], lignes: +cases[2] } : null;
  return { taille: '1024x1536', largeur: 1024, hauteur: 1536, grille };
}

/** Prompt complet. `style` : texte de peint-v1.md ; `niveau` : un des NIVEAUX ; `scene` : la description du MJ. */
export function composerPrompt({ style, niveau, scene }) {
  if (!NIVEAUX.includes(niveau)) throw new Error(`Niveau inconnu « ${niveau} » (attendu : ${NIVEAUX.join(', ')}).`);
  const texte = String(scene || '').trim();
  if (!texte) throw new Error('La scène est vide.');
  const s = extraireSections(style);
  const gabarit = s[`Gabarit : ${niveau}`];
  if (!s['Bloc de style'] || !s['Échelle'] || !gabarit) throw new Error('Le fichier de style est incomplet (Bloc de style, Échelle, Gabarit).');
  return [s['Bloc de style'], gabarit.replace('{scene}', texte), s['Échelle']].join('\n\n');
}
