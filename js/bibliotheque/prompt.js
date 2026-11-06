/**
 * Composition du prompt d'une carte, la même pour la page Bibliothèque (volet « Générer une illustration IA », prompt à copier dans ChatGPT…)
 * et pour le skill generer-carte (outils/cartes/generer.mjs, API) : bloc de style + vue du zoom + gabarit (scène, cases) + échelle
 * + format + rappel final. Le ZOOM (monde, lieu, plateau + sous-type) impose la vue, sans choix (VUES, ici) ; le STYLE (l'allure,
 * un fichier assets/styles-cartes/<id>.md) et le FORMAT (la forme de l'image et la grille, décrits ici) sont deux choix indépendants. Module pur (aucune API Node ni DOM) : l'appelant lit le fichier de style.
 */
import { IDS_NIVEAUX as NIVEAUX, normaliserNiveau } from './vocabulaire.js';

/**
 * La vue de chaque zoom, imposée (aucun choix) et écrite ici, jamais dans les fichiers de style : `vue` ouvre le bloc de vue
 * du prompt, `rappel` le referme en dernière ligne. Monde et lieu : vue cavalière ; plateau : dessus en trois-quarts, cases égales.
 */
export const VUES = {
  monde: {
    vue: 'View: bird\'s-eye oblique view, taken from very high above so that the whole set is seen at once, looking down at about 45 degrees, always the same angle across the picture. '
      + 'Mountains, hills, forests and cities show their volume, with their sides visible, and the depth stays shallow. At most a thin band of sky or haze at the very top. '
      + 'Every important place must stay clearly visible, never hidden behind a relief or a building.',
    rappel: 'View check: oblique bird\'s-eye view at about 45 degrees from very high up; not a flat map seen from straight above, not a side view; every important place visible.',
  },
  lieu: {
    vue: 'View: bird\'s-eye oblique view. The landscape is seen from above, looking down at about 45 degrees, always the same angle across the picture. '
      + 'Reliefs, buildings and trees show their volume, with their sides visible, and the depth stays shallow. At most a thin band of sky or haze at the very top. '
      + 'Every important place must stay clearly visible, never hidden behind a relief or a building.',
    rappel: 'View check: oblique bird\'s-eye view at about 45 degrees; not a flat map seen from straight above, not a side view; every important place visible.',
  },
  plateau: {
    vue: 'View: top-down three-quarter view, as in a 2D action role-playing video game. The ground is flat and seen from directly above, and every square has the same size everywhere in the picture, so that a grid fits exactly. '
      + 'Each object (house, tree, rock, statue, piece of furniture) is drawn slightly from the front: its facade, trunk or side is visible. '
      + 'It reads clearly as a game board, with walkable ground clearly distinct from obstacles. No sky, no horizon, no perspective that shrinks the background.',
    rappel: 'View check: flat ground seen from above with equal squares everywhere, objects drawn slightly from the front; no sky, no horizon, no shrinking perspective.',
  },
};

/** Le gabarit d'un zoom dans le fichier de style : monde, lieu, ou plateau-<sous-type>. */
export const gabaritDe = ({ niveau, sousType }) => (niveau === 'plateau' ? `plateau-${sousType}` : niveau);

/** Styles proposés, dans l'ordre des menus. `id` = nom du fichier de style, recopié dans `origine.style` des cartes. */
export const STYLES = [
  { id: 'peint-v2', libelle: 'Dessin animé coloré', aide: 'couleurs franches, trait d’encre, ombres en aplats' },
  { id: 'parchemin-v1', libelle: 'Vieille carte sur parchemin', aide: 'encre sépia, hachures, couleurs passées' },
  { id: 'peint-v1', libelle: 'Aquarelle peinte', aide: 'aquarelle et gouache, tons naturels' },
];
export const STYLE_PAR_DEFAUT = 'peint-v2';

/**
 * Formats proposés. `demandee` : taille demandée au générateur (une des trois de gpt-image-1, ce que ChatGPT sait faire) ;
 * `finale` : l'image gardée, recadrée au centre quand elle diffère ; `grilles` : cases sur la largeur × la hauteur de l'image finale.
 * Aucun générateur courant ne fait du 16:9 : on demande du 3:2 et on retire une bande en haut et en bas.
 */
export const FORMATS = [
  { id: 'paysage', libelle: 'Paysage 16:9', aide: 'écran, table de jeu', demandee: { largeur: 1536, hauteur: 1024 }, finale: { largeur: 1536, hauteur: 864 },
    grilles: { plateau: [32, 18] },
    consigne: 'Image format: landscape, 1536 × 1024 pixels (3:2 ratio), later cropped to 16:9. The top and bottom eighths of the picture will be cut off: keep them as plain ground, plain sea or plain rock, with nothing important in them.' },
  { id: 'portrait', libelle: 'Portrait 2:3', aide: 'impression, téléphone', demandee: { largeur: 1024, hauteur: 1536 }, finale: { largeur: 1024, hauteur: 1536 },
    grilles: { plateau: [20, 30] },
    consigne: 'Image format: portrait, 1024 × 1536 pixels (2:3 ratio).' },
  { id: 'carre', libelle: 'Carré', aide: 'pièce, petite rencontre', demandee: { largeur: 1024, hauteur: 1024 }, finale: { largeur: 1024, hauteur: 1024 },
    grilles: { plateau: [20, 20] },
    consigne: 'Image format: square, 1024 × 1024 pixels (1:1 ratio).' },
];
export const FORMAT_PAR_DEFAUT = 'paysage';

const trouver = (liste, id, quoi) => {
  const r = liste.find((x) => x.id === id);
  if (!r) throw new Error(`${quoi} inconnu « ${id} » (attendu : ${liste.map((x) => x.id).join(', ')}).`);
  return r;
};

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

/**
 * Taille d'image et grille pour un format et un niveau (un ancien niveau est converti d'abord). Rend { taille, largeur, hauteur, demandee, recadre, grille } :
 * `taille` est le paramètre de l'API (`demandee`), `largeur` × `hauteur` l'image finale, `recadre` vrai quand elles diffèrent,
 * `grille` { case, colonnes, lignes } ou null (monde, lieu : seul le plateau a une grille). `case` = largeur finale ÷ colonnes ; à l'import, la largeur réelle la remplace.
 */
export function formatCarte(format, niveau) {
  const f = trouver(FORMATS, format, 'Format');
  const g = f.grilles[normaliserNiveau({ niveau })?.niveau];
  return {
    taille: `${f.demandee.largeur}x${f.demandee.hauteur}`, largeur: f.finale.largeur, hauteur: f.finale.hauteur, demandee: f.demandee,
    recadre: f.finale.largeur !== f.demandee.largeur || f.finale.hauteur !== f.demandee.hauteur,
    grille: g ? { case: Math.round((f.finale.largeur / g[0]) * 100) / 100, colonnes: g[0], lignes: g[1] } : null,
  };
}

/**
 * Plus grand rectangle centré aux proportions `largeurCible` : `hauteurCible` dans une image `largeur` × `hauteur`.
 * Rend { x, y, largeur, hauteur } en pixels entiers, ou null quand l'image a déjà ces proportions (à un pixel près).
 */
export function cadrageCentre(largeur, hauteur, largeurCible, hauteurCible) {
  const ratio = largeurCible / hauteurCible;
  let l = largeur, h = Math.round(largeur / ratio);
  if (h > hauteur) { h = hauteur; l = Math.round(hauteur * ratio); }
  if (Math.abs(l - largeur) <= 1 && Math.abs(h - hauteur) <= 1) return null;
  return { x: Math.floor((largeur - l) / 2), y: Math.floor((hauteur - h) / 2), largeur: l, hauteur: h };
}

/**
 * Prompt complet, identique pour l'API et pour un générateur en conversation.
 * `style` : texte du fichier de style ; `niveau` : un des NIVEAUX (ou un ancien, converti) ; `sousType` : celui d'un plateau ; `scene` : la description du MJ ; `format` : un des FORMATS.
 * Dans les gabarits, `{scene}` reçoit la scène et `{cases}` la taille en cases (« about 32 squares wide and 18 squares tall »).
 */
export function composerPrompt({ style, niveau: niveauBrut, sousType, scene, format = FORMAT_PAR_DEFAUT }) {
  const zoom = normaliserNiveau({ niveau: niveauBrut, sousType });
  if (!zoom) throw new Error(`Niveau inconnu « ${niveauBrut} » (attendu : ${NIVEAUX.join(', ')}).`);
  const { niveau } = zoom;
  const texte = String(scene || '').trim();
  if (!texte) throw new Error('La scène est vide.');
  const f = trouver(FORMATS, format, 'Format');
  const s = extraireSections(style);
  const gabarit = s[`Gabarit : ${gabaritDe(zoom)}`];
  if (!s['Bloc de style'] || !s['Échelle'] || !gabarit) throw new Error('Le fichier de style est incomplet (Bloc de style, Échelle, Gabarit).');
  const { grille } = formatCarte(format, niveau);
  const cases = grille ? `about ${grille.colonnes} squares wide and ${grille.lignes} squares tall` : '';
  const consigne = f.consigne + (grille ? ` The picture covers ${grille.colonnes} × ${grille.lignes} squares; do not draw the grid.` : '');
  const vue = VUES[niveau];
  return [s['Bloc de style'], vue.vue, gabarit.replace('{scene}', texte).replace('{cases}', cases), grille ? s['Échelle'] : '', consigne,
    [s['Rappel final'], vue.rappel].filter(Boolean).join('\n')].filter(Boolean).join('\n\n');
}

/** Le prompt à copier depuis la page Bibliothèque : le même que celui du skill (le format y est déjà écrit en clair). */
export const promptACopier = composerPrompt;
