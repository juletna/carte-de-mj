/**
 * L'AFFICHAGE est UNE préférence, commune aux salles de donjon, aux cartes image et à la régie, réglable à tout moment : les champs de
 * carte-de-mj:reglages-v1 (aucune nouvelle clé). Un seul contrôle les règle, le bouton « Affichage » de la barre d'outils de la scène
 * (js/atelier/coquille.js, option `affichage`) : un popover, le même en Préparer et en Jouer, avec
 *   Grille          (bouton direct à côté, `elementGrille`) afficher / masquer d'un clic, et le chevron : opacité des lignes (`cases`, 0–100 %) ;
 *   Carte           thème (peint / vectoriel), détails des sols (riches / sobres), relief des murs ;
 *   À la table      pénombre (0–100 %), flammes animées, repères de cases (A, B… et 1, 2…).
 * Jouer ajoute un groupe « Régie » (taille d'une case, adapter la carte à la fenêtre : option `regie`).
 * Ce qui touche à la table physique (mode remplir / échelle réelle, rotation, miroir, calibrage, plan du donjon, défilement) reste dans l'onglet
 * Écran de la régie ; l'échelle (m par case) reste dans l'inspecteur du donjon, car elle sert à écrire et à créer les salles.
 *
 *   const a = creerAffichagePopover({ lire: () => r, surChangement: () => { sauver; redessiner; diffuser } });
 *   a.element  le bouton et son popover ; a.elementGrille  le bouton de grille et son chevron (à poser dans la barre) ; a.maj()  relit `lire()` ; a.fermer()
 *
 * `lire()` rend l'objet des réglages de la page : un contrôle y écrit (une valeur par défaut n'est pas écrite, voir stockage.js), puis appelle
 * `surChangement`. Sous 760 px, le popover est une feuille du bas aux cibles de 44 px (css/atelier.css).
 * Les fonctions pures (`appliquerCases`, `casesApresBascule`, `appliquerRendu`) se testent sous Node.
 */
import { h } from '../dom.js';
import { icone } from '../icones.js';
import {
  casesDeReglages, casesValides, CASES_PAR_DEFAUT, themeDeReglages, detailsDeReglages, reliefDeReglages, penombreDeReglages, flammesDeReglages,
  THEME_PAR_DEFAUT, DETAILS_PAR_DEFAUT, PENOMBRE_PAR_DEFAUT, THEMES_RENDU, DETAILS_SOLS, TAILLE_MIN, TAILLE_MAX, TAILLE_PAR_DEFAUT,
} from '../affichage.js';

/**
 * Écrit l'opacité (0–100, entier) dans les réglages ; `grille` suit (vrai dès que les lignes se voient). Rend la valeur retenue.
 * La dernière opacité visible survit au masquage dans le champ facultatif `casesAvant` (même clé de réglages) : écrit seulement quand la grille
 * est masquée et que cette opacité n'est pas celle par défaut (60 %), effacé dès que les lignes réapparaissent.
 */
export function appliquerCases(r, v) {
  const avant = casesDeReglages(r);
  const n = Math.max(0, Math.min(100, Math.round(Number(v)) || 0));
  r.cases = n;
  r.grille = n > 0;
  if (n > 0) delete r.casesAvant;
  else if (avant > 0 && avant !== CASES_PAR_DEFAUT) r.casesAvant = avant;
  else if (avant > 0) delete r.casesAvant;
  return n;
}
/** La valeur après un clic sur l'interrupteur : 0 si la grille se voyait, sinon la dernière opacité visible (`casesAvant`, puis `derniere`, puis 60 %). */
export function casesApresBascule(r, derniere = 0) {
  if (casesDeReglages(r) > 0) return 0;
  return casesValides(r.casesAvant) && r.casesAvant > 0 ? r.casesAvant : (derniere > 0 ? derniere : CASES_PAR_DEFAUT);
}

/**
 * Écrit un réglage de rendu dans `r` : une valeur par défaut est effacée plutôt qu'écrite. `champ` : theme, details, relief, penombre,
 * flammes ou reperes. Rend la valeur retenue (une valeur illisible laisse `r` intact et rend la valeur actuelle).
 */
export function appliquerRendu(r, champ, valeur) {
  switch (champ) {
    case 'theme':
      if (!THEMES_RENDU.includes(valeur)) return themeDeReglages(r);
      if (valeur === THEME_PAR_DEFAUT) delete r.theme; else r.theme = valeur;
      return valeur;
    case 'details':
      if (!DETAILS_SOLS.includes(valeur)) return detailsDeReglages(r);
      if (valeur === DETAILS_PAR_DEFAUT) delete r.details; else r.details = valeur;
      return valeur;
    case 'relief': if (valeur) delete r.relief; else r.relief = false; return !!valeur;
    case 'flammes': if (valeur) delete r.flammes; else r.flammes = false; return !!valeur;
    case 'reperes': r.reperes = !!valeur; return !!valeur;
    case 'penombre': {
      const v = Math.max(0, Math.min(100, Math.round(Number(valeur)) || 0));
      if (v === PENOMBRE_PAR_DEFAUT) delete r.penombre; else r.penombre = v;
      return v;
    }
    default: throw new Error(`Réglage de rendu inconnu : « ${champ} »`);
  }
}

export function creerAffichagePopover({ lire, surChangement, regie = false, garderOuvert = () => false }) {
  let derniere = 0; // la dernière opacité visible vue ici ; `casesAvant` (réglages) la garde d'une page à l'autre
  const bouton = h('button', { type: 'button', className: 'btn btn-icone btn-discret atelier-affichage-bouton', 'aria-label': 'Affichage', title: 'Affichage : style, détails, relief, pénombre, flammes, repères, écran de la table', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' }, icone('affichage'));
  const curseur = h('input', { type: 'range', min: '0', max: '100', step: '5', id: 'cases', 'aria-label': 'Opacité des lignes de la grille' });
  const valeur = h('output', { className: 'atelier-affichage-valeur' });

  // Un contrôle adapté à chaque réglage : boutons segmentés (deux choix), curseurs avec leur valeur, interrupteurs (oui / non).
  const segmente = (id, libelle, options) => {
    const boutons = options.map(([v, t]) => h('button', { type: 'button', role: 'radio', 'aria-checked': 'false', 'data-valeur': v, textContent: t }));
    const el = h('div', { id, className: 'pop-seg', role: 'radiogroup', 'aria-label': libelle }, ...boutons);
    el.choisir = (v) => { for (const b of boutons) b.setAttribute('aria-checked', String(b.dataset.valeur === v)); };
    el.surChoix = (f) => { for (const b of boutons) b.addEventListener('click', () => f(b.dataset.valeur)); };
    return el;
  };
  const interrupteur = (id, libelle) => h('button', { type: 'button', id, className: 'pop-interrupteur', role: 'switch', 'aria-checked': 'false', 'aria-label': libelle });
  const basculer = (el, f) => el.addEventListener('click', () => f(el.getAttribute('aria-checked') !== 'true'));
  const regle = (el, vrai) => el.setAttribute('aria-checked', String(!!vrai));
  const theme = segmente('theme', 'Style', [['peint', 'Peint'], ['vectoriel', 'Vectoriel']]);
  const details = segmente('details', 'Détails des sols', [['riches', 'Riches'], ['sobres', 'Sobres']]);
  const relief = interrupteur('relief', 'Relief des murs');
  const penombre = h('input', { type: 'range', min: '0', max: '100', step: '5', id: 'penombre', 'aria-label': 'Pénombre' });
  const penombreVal = h('output', { className: 'pop-valeur', id: 'penombre-val' });
  const flammes = interrupteur('flammes', 'Flammes animées');
  const reperes = interrupteur('reperes', 'Repères de cases');
  // Groupe « Régie » (Jouer seulement) : la taille d'une case et l'adaptation de la carte à la fenêtre. Réglages propres à la régie, lus et écrits par
  // js/regie-reglages.js (qui retrouve ces contrôles et ceux de l'écran de table par leur identifiant) : ce module ne fait que les poser.
  const taille = h('input', { type: 'range', min: String(TAILLE_MIN), max: String(TAILLE_MAX), step: '0.1', value: String(TAILLE_PAR_DEFAUT), id: 'taille', 'aria-label': 'Taille d’une case' });
  const tailleVal = h('output', { className: 'pop-valeur', id: 'taille-val', textContent: `${TAILLE_PAR_DEFAUT} px` });
  const ajuster = interrupteur('ajuster', 'Adapter la carte à la fenêtre');
  regle(ajuster, true);
  const rang = (libelle, controle, aide, titre) => h('div', { className: 'pop-rang', title: titre ?? '' },
    h('span', { className: 'pop-lib' }, libelle, ...(aide ? [h('small', { textContent: aide })] : [])), controle);
  const curseurRang = (libelle, champ, sortie, titre) => h('div', { className: 'pop-rang', title: titre ?? '' }, h('span', { className: 'pop-lib', textContent: libelle }), h('span', { className: 'pop-curseur' }, champ, sortie));
  const groupe = (titre, aide, ...enfants) => h('div', { className: 'atelier-affichage-groupe' }, h('p', { className: 'atelier-affichage-sous-titre' }, titre, ...(aide ? [h('small', { textContent: aide })] : [])), ...enfants);

  // L'écran de la table (Jouer seulement), réglé une fois : orientation par quarts de tour avec son aperçu, miroir, taille réelle d'une case, calibrage.
  const pasBouton = (id, texte, etiquette) => h('button', { type: 'button', id, className: 'pop-ib', 'aria-label': etiquette, title: etiquette, textContent: texte });
  const ecranTable = regie ? groupe('Écran de la table', 'réglé une fois',
    h('div', { id: 'materiel-table', className: 'pop-materiel' },
      h('div', { className: 'pop-rang pop-orientation' },
        h('div', { className: 'pop-apercu', title: 'Comment la carte apparaît à la table' }, h('div', { className: 'pop-apercu-cadre' }, h('span', { id: 'apercu-lettre', className: 'pop-apercu-lettre', textContent: 'F' }))),
        h('span', { className: 'pop-lib' }, 'Orientation', h('small', { id: 'rotation-val', textContent: 'Aucune' })),
        h('span', { className: 'pop-duo' }, pasBouton('rotation-gauche', '↺', 'Tourner à gauche'), pasBouton('rotation-droite', '↻', 'Tourner à droite'),
          h('button', { type: 'button', id: 'miroir-table', className: 'pop-ib pop-bascule', role: 'switch', 'aria-checked': 'false', 'aria-label': 'Image en miroir (symétrie)', title: 'Image en miroir : pour un projecteur sous la table dont le montage n’a pas de miroir', textContent: '⇋' }))),
      rang('Taille réelle d’une case', h('span', { className: 'pop-stepper' }, pasBouton('case-mm-moins', '−', 'Une case de moins'),
        h('input', { id: 'case-mm', type: 'number', inputmode: 'decimal', min: '10', max: '50', step: '0.1', 'aria-label': 'Taille réelle d’une case, en millimètres' }), h('span', { className: 'pop-unite', textContent: 'mm' }),
        pasBouton('case-mm-plus', '+', 'Une case de plus'))),
      h('button', { id: 'calibrer-table', type: 'button', className: 'btn pop-calibrer', textContent: 'Calibrer sur la table', title: 'Pose une carte bancaire sur la table et ajuste jusqu’à ce que la case la recouvre. Ouvre d’abord la table (sur un seul écran : en plein écran ici).' })),
    h('div', { id: 'reglage-calibrage', className: 'pop-calibrage', hidden: true },
      h('p', { className: 'pop-note', textContent: 'Pose une carte bancaire sur la table et ajuste jusqu’à ce que la case la recouvre.' }),
      h('div', { className: 'pop-rang pop-pas', role: 'group', 'aria-label': 'Ajuster la taille d’une case' },
        ...[['-1', '−1'], ['-0.1', '−0,1']].map(([v, t]) => h('button', { type: 'button', className: 'pop-ib', 'data-pas-taille': v, textContent: t })),
        h('output', { id: 'calibrage-val', 'aria-live': 'polite', textContent: `${TAILLE_PAR_DEFAUT} px` }),
        ...[['0.1', '+0,1'], ['1', '+1']].map(([v, t]) => h('button', { type: 'button', className: 'pop-ib', 'data-pas-taille': v, textContent: t }))),
      h('div', { className: 'pop-rang pop-fin' }, h('button', { id: 'calibrage-fini', type: 'button', className: 'btn btn-primaire', textContent: 'Terminer le calibrage' })))) : null;

  const carte = [rang('Style', theme), rang('Détails', details, null, 'Sols dessinés et détaillés, ou sols simples (style peint).'), rang('Relief', relief, null, 'Relief des murs')];
  const repereRang = rang('Repères', reperes, 'A, B… et 1, 2…');
  const tailleRegieRang = curseurRang('Taille d’une case', taille, tailleVal, 'Quand la carte n’est pas adaptée à la fenêtre : la taille d’une case à l’écran de la régie. C’est aussi la taille calibrée de la table (à régler avec « Calibrer sur la table »).');
  const penombreRang = curseurRang('Pénombre', penombre, penombreVal, 'Obscurité de la salle : toute à la table, une part seulement à la régie (pour tout voir).');
  const groupeDonjon = groupe('Donjon', 'régie et table', ...carte, repereRang, penombreRang, rang('Flammes animées', flammes, 'à la table'));
  groupeDonjon.classList.add('pop-donjon'); // ces réglages ne touchent que les salles de donjon, mais restent toujours là, réglables
  const panneau = h('div', { className: 'atelier-affichage-panneau pop-affichage', role: 'dialog', 'aria-label': 'Affichage', hidden: true },
    h('p', { className: 'atelier-affichage-titre', textContent: 'Affichage' }),
    ...(regie
      // Jouer : ce qui touche la carte d'un donjon (régie ET table), l'écran de la table (matériel, une fois), puis la régie elle-même. Un monde n'a que les deux derniers groupes.
      ? [groupeDonjon,
        ecranTable,
        groupe('Régie', 'cette fenêtre seulement',
          rang('Adapter la carte à la fenêtre', ajuster, null, 'La carte de la régie remplit la place disponible. Ne change rien à la table.'),
          tailleRegieRang)]
      : [groupe('Carte', null, ...carte), groupe('À la table', null, penombreRang, rang('Flammes animées', flammes), repereRang)]));
  const racine = h('div', { className: 'atelier-affichage' }, bouton, panneau);

  // La grille : un bouton direct (afficher / masquer, en temps réel) et, à côté, un chevron qui ouvre l'opacité des lignes.
  const boutonGrille = h('button', { type: 'button', className: 'btn btn-icone btn-discret atelier-grille-bouton', 'aria-label': 'Afficher la grille', title: 'Afficher ou masquer la grille', 'aria-pressed': 'true' }, icone('grille'));
  const chevronGrille = h('button', { type: 'button', className: 'btn btn-icone btn-discret atelier-grille-chevron', 'aria-label': 'Réglages de la grille', title: 'Réglages de la grille', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' }, icone('chevron-bas'));
  const panneauGrille = h('div', { className: 'atelier-affichage-panneau atelier-grille-panneau', role: 'dialog', 'aria-label': 'Grille', hidden: true },
    h('p', { className: 'atelier-affichage-titre', textContent: 'Grille' }),
    h('label', { className: 'atelier-affichage-ligne' }, h('span', { textContent: 'Opacité des lignes' }), curseur, valeur));
  const racineGrille = h('div', { className: 'atelier-affichage atelier-grille' }, boutonGrille, chevronGrille, panneauGrille);

  function maj() {
    const r = lire() ?? {};
    const n = casesDeReglages(r);
    if (n > 0) derniere = n;
    boutonGrille.setAttribute('aria-pressed', String(n > 0));
    boutonGrille.title = n > 0 ? 'Masquer la grille' : 'Afficher la grille';
    curseur.value = String(n);
    valeur.textContent = `${n} %`;
    theme.choisir(themeDeReglages(r));
    details.choisir(detailsDeReglages(r));
    regle(relief, reliefDeReglages(r));
    penombre.value = String(penombreDeReglages(r));
    penombreVal.textContent = `${penombreDeReglages(r)} %`;
    regle(flammes, flammesDeReglages(r));
    regle(reperes, r.reperes !== false);
  }
  function ecrire(v) { appliquerCases(lire(), v); maj(); surChangement(); }
  /** Un réglage de rendu : écrit dans les réglages de la page, les contrôles se remettent d'accord, la page enregistre et redessine. */
  function ecrireRendu(champ, v) { appliquerRendu(lire(), champ, v); maj(); surChangement(); }
  function ouvrir() { fermerGrille(); maj(); panneau.hidden = false; bouton.setAttribute('aria-expanded', 'true'); }
  function fermer({ rendreFocus = false } = {}) {
    if (panneau.hidden) return;
    panneau.hidden = true; bouton.setAttribute('aria-expanded', 'false');
    if (rendreFocus) bouton.focus();
  }
  bouton.addEventListener('click', () => { if (panneau.hidden) ouvrir(); else fermer(); });
  function fermerGrille({ rendreFocus = false } = {}) {
    if (panneauGrille.hidden) return;
    panneauGrille.hidden = true; chevronGrille.setAttribute('aria-expanded', 'false');
    if (rendreFocus) chevronGrille.focus();
  }
  chevronGrille.addEventListener('click', () => {
    if (!panneauGrille.hidden) { fermerGrille(); return; }
    fermer(); maj(); panneauGrille.hidden = false; chevronGrille.setAttribute('aria-expanded', 'true');
  });
  boutonGrille.addEventListener('click', () => ecrire(casesApresBascule(lire() ?? {}, derniere)));
  curseur.addEventListener('input', () => ecrire(curseur.value));
  theme.surChoix((v) => ecrireRendu('theme', v));
  details.surChoix((v) => ecrireRendu('details', v));
  basculer(relief, (v) => ecrireRendu('relief', v));
  penombre.addEventListener('input', () => ecrireRendu('penombre', penombre.value));
  basculer(flammes, (v) => ecrireRendu('flammes', v));
  basculer(reperes, (v) => ecrireRendu('reperes', v));
  basculer(ajuster, (v) => { regle(ajuster, v); });
  document.addEventListener('pointerdown', (e) => {
    if (!panneau.hidden && !racine.contains(e.target) && !garderOuvert()) fermer(); // pendant un calibrage, un clic ailleurs ne ferme pas
    if (!panneauGrille.hidden && !racineGrille.contains(e.target)) fermerGrille();
  });
  racine.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panneau.hidden) { e.preventDefault(); e.stopPropagation(); fermer({ rendreFocus: true }); } });
  racineGrille.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panneauGrille.hidden) { e.preventDefault(); e.stopPropagation(); fermerGrille({ rendreFocus: true }); } });
  maj();
  return { bouton, element: racine, elementGrille: racineGrille, maj, fermer: (o) => { fermer(o); fermerGrille(); } };
}
