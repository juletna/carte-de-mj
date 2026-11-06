/**
 * Mode « Caler la grille » de l'écran Monde, sur la carte image d'un lieu d'univers (F4, voir docs/conception-univers.md §6).
 * La grille est superposée à l'image ; le MJ règle la taille de case et le décalage jusqu'à ce qu'elle tombe sur une porte ou un pilier :
 *  - curseurs et champs numériques (en pixels de l'image), boutons − et + ;
 *  - un geste : glisser sur la carte déplace la grille (souris ou doigt) ;
 *  - ou « Mesurer » : deux clics qui encadrent N cases donnent la taille de case et le décalage ;
 *  - au clavier : les flèches décalent d'un pixel (Maj : dix), + et − changent la case.
 * L'aperçu est en direct. Rien n'est écrit tant que le MJ n'a pas cliqué « Enregistrer » (ou un des deux choix de repli).
 * Les calculs sont dans js/univers-grille.js (pur) ; ici, seulement le DOM.
 * Fabrique `creerCalage({ carte, enregistrer, quitter, surMarqueurs })` :
 *  - `enregistrer(grille, dims)` : grille = objet, `null` (pas de grille) ou `undefined` (revenir au catalogue) ; l'appelant écrit et redessine ;
 *  - `quitter()` : le MJ sort sans enregistrer ;
 *  - `surMarqueurs()` : les repères des deux clics ont changé, l'appelant redessine la carte avec `marqueurs()`.
 */
import { h } from '../dom.js';
import { btn } from '../univers-boutons.js';
import { creerSection } from '../atelier/section.js';
import * as g from '../univers-grille.js';

const OPACITE_REGLAGE = 0.75; // pendant le calage, la grille se voit bien quel que soit le réglage « Cases » de la table
const virgule = (v) => String(v).replace('.', ',');

export function creerCalage({ carte, enregistrer, quitter, surMarqueurs }) {
  let s = null; // { depart, courante, origine, catalogue, dims, mode, n, premier }
  let champs = null;
  let panneau = null;

  const dims = () => s.dims;
  const ancre = () => ({ x: s.dims.largeur / 2, y: s.dims.hauteur / 2 });

  /** Applique une nouvelle grille : champs, aperçu, texte. Jamais de reconstruction du DOM : le geste en cours n'est pas coupé. */
  function appliquer(grille) {
    s.courante = g.normaliserGrille(grille, s.dims) ?? s.courante;
    const c = s.courante;
    champs.case.value = champs.caseNum.value = String(c.case);
    for (const axe of ['dx', 'dy']) {
      champs[axe].max = String(c.case);
      champs[axe].value = champs[`${axe}Num`].value = String(c[axe]);
    }
    champs.caseNum.max = champs.case.max = String(g.caseMax(s.dims));
    const n = g.nombreDeCases(c, s.dims.largeur, s.dims.hauteur);
    champs.resume.textContent = `Case de ${virgule(c.case)} px · environ ${virgule(n.colonnes)} × ${virgule(n.lignes)} cases sur l’image (${s.dims.largeur} × ${s.dims.hauteur} px).`;
    carte.majGrille(c, OPACITE_REGLAGE);
  }

  function reglerCase(valeur) { appliquer(g.changerCase(s.courante, valeur, ancre(), s.dims)); }

  // --- Le geste sur la carte : glisser = décaler, ou deux clics en mode « mesurer » -----------------------------
  let geste = null;
  const surBas = (e) => {
    if (!s || e.button) return;
    const p = carte.pixelsImage(e);
    if (!p) return;
    carte.cadre.setPointerCapture?.(e.pointerId);
    geste = { depart: p, grille: s.courante, bouge: false, x: e.clientX, y: e.clientY };
    e.preventDefault();
  };
  const surDeplace = (e) => {
    if (!s || !geste) return;
    if (!geste.bouge && Math.hypot(e.clientX - geste.x, e.clientY - geste.y) < 5) return;
    geste.bouge = true;
    if (s.mode !== 'glisser') return;
    const p = carte.pixelsImage(e);
    if (p) appliquer(g.decalerGrille(geste.grille, p.x - geste.depart.x, p.y - geste.depart.y));
  };
  const surHaut = (e) => {
    if (!s || !geste) return;
    const vu = geste; geste = null;
    if (e.type === 'pointercancel' || vu.bouge || s.mode !== 'mesurer') return;
    const p = carte.pixelsImage(e);
    if (!p) return;
    if (!s.premier) { s.premier = p; champs.etatMesure.textContent = 'Premier coin posé. Clique maintenant le coin d’une case, à N cases de là.'; surMarqueurs(); return; }
    const nouvelle = g.grilleDeuxClics(s.premier, p, s.n, s.courante, s.dims);
    if (!nouvelle) { champs.etatMesure.textContent = 'Ces deux clics sont trop proches pour ce nombre de cases : recommence en les éloignant.'; }
    else { appliquer(nouvelle); champs.etatMesure.textContent = `Calé : ${s.n} cases sur ce trajet. Affine avec les curseurs si besoin.`; }
    s.premier = null;
    surMarqueurs();
  };
  const surTouche = (e) => {
    if (!s || e.target !== carte.cadre) return;
    const pas = e.shiftKey ? 10 : 1;
    const dir = { ArrowLeft: [-pas, 0], ArrowRight: [pas, 0], ArrowUp: [0, -pas], ArrowDown: [0, pas] }[e.key];
    if (dir) appliquer(g.decalerGrille(s.courante, dir[0], dir[1]));
    else if (e.key === '+' || e.key === '=') reglerCase(s.courante.case + pas);
    else if (e.key === '-') reglerCase(s.courante.case - pas);
    else return;
    e.preventDefault();
  };
  carte.cadre.addEventListener('pointerdown', surBas);
  carte.cadre.addEventListener('pointermove', surDeplace);
  carte.cadre.addEventListener('pointerup', surHaut);
  carte.cadre.addEventListener('pointercancel', surHaut);
  carte.cadre.addEventListener('keydown', surTouche);

  // --- Le panneau ------------------------------------------------------------------------------------------
  function curseur(libelle, cle, { min, max, step, apres }) {
    const num = h('input', { type: 'number', min, max, step, inputMode: 'decimal', 'aria-label': `${libelle} (px de l’image)` });
    const cur = h('input', { type: 'range', min, max, step, 'aria-label': `${libelle}, curseur` });
    const moins = btn(`${libelle} : moins un pixel`, () => apres(Number(num.value) - 1), { icone: 'moins', iconeSeule: true, classe: 'btn-discret' });
    const plus = btn(`${libelle} : plus un pixel`, () => apres(Number(num.value) + 1), { icone: 'plus', iconeSeule: true, classe: 'btn-discret' });
    cur.addEventListener('input', () => apres(Number(cur.value)));
    num.addEventListener('change', () => { if (num.value !== '' && Number.isFinite(Number(num.value))) apres(Number(num.value)); else appliquer(s.courante); });
    champs[cle] = cur; champs[`${cle}Num`] = num;
    return h('div', { className: 'calage-champ' }, h('span', { className: 'calage-nom', textContent: libelle }), h('div', { className: 'calage-ligne' }, moins, cur, plus, num, h('span', { className: 'doux', textContent: 'px' })));
  }

  function construire(origine) {
    champs = {};
    const dec = (axe) => (v) => appliquer({ ...s.courante, [axe]: v });
    const mode = (valeur) => {
      s.mode = valeur; s.premier = null;
      champs.glisser.setAttribute('aria-pressed', String(valeur === 'glisser'));
      champs.mesurer.setAttribute('aria-pressed', String(valeur === 'mesurer'));
      champs.n.disabled = valeur !== 'mesurer';
      carte.cadre.classList.toggle('calage-mesure', valeur === 'mesurer');
      champs.etatMesure.textContent = valeur === 'mesurer'
        ? 'Clique un coin de case, puis un coin de case à N cases de là (en ligne, en colonne ou presque : le trajet le plus long compte).'
        : 'Glisse la carte (souris ou doigt) pour déplacer la grille.';
      surMarqueurs();
    };
    champs.glisser = btn('Glisser', () => mode('glisser'), { icone: 'fleches' });
    champs.mesurer = btn('Mesurer', () => mode('mesurer'), { icone: 'grille' });
    champs.n = h('input', { type: 'number', min: 1, max: g.NB_CASES_MAX, step: 1, value: String(s.n), inputMode: 'numeric', 'aria-label': 'Nombre de cases entre les deux clics' });
    champs.n.addEventListener('change', () => { const v = Math.round(Number(champs.n.value)); s.n = v >= 1 && v <= g.NB_CASES_MAX ? v : s.n; champs.n.value = String(s.n); s.premier = null; surMarqueurs(); });
    champs.etatMesure = h('p', { className: 'note', role: 'status' });
    champs.resume = h('p', { className: 'note', role: 'status' });
    const catalogue = g.normaliserGrille(s.catalogue);
    const revenir = btn('Revenir à la grille du catalogue', () => enregistrer(undefined, s.dims), { icone: 'retour', classe: 'btn-discret' });
    revenir.disabled = !catalogue;
    if (!catalogue) revenir.title = 'Cette image n’a pas de grille dans le catalogue.';
    const enonce = {
      lieu: 'Cette carte a une grille calée à la main.',
      catalogue: 'Cette carte utilise la grille du catalogue (celle que demandait la génération, souvent approximative).',
      aucune: 'Cette carte est réglée « pas de grille ».',
      ambiance: 'Cette carte n’a pas de grille : c’est une carte d’ambiance. Pose-en une si tu veux jouer dessus à l’échelle.',
    }[origine];
    // Sections du panneau (js/atelier/section.js, docs/design-panneaux.md) ; le titre « Grille » est dans l'en-tête de l'inspecteur.
    const section = (cle, titre, enfants, options = {}) => creerSection({ cle: `calage:${cle}`, titre, enfants, ...options }).element;
    panneau = h('div', { className: 'univers-calage', 'aria-label': 'Caler la grille' },
      h('div', { className: 'actions calage-enregistrer' },
        btn('Enregistrer', () => enregistrer(s.courante, s.dims), { icone: 'sauvegarde', classe: 'btn-primaire' }),
        btn('Quitter sans enregistrer', () => quitter(), { icone: 'fermer', classe: 'btn-discret' })),
      section('reglage', 'Taille et décalage', [
        h('p', { className: 'note', textContent: enonce }),
        curseur('Taille de case', 'case', { min: g.CASE_MIN, max: g.caseMax(s.dims), step: 0.5, apres: reglerCase }),
        curseur('Décalage horizontal', 'dx', { min: 0, max: 100, step: 0.5, apres: dec('dx') }),
        curseur('Décalage vertical', 'dy', { min: 0, max: 100, step: 0.5, apres: dec('dy') }),
        champs.resume], { aide: 'Règle la taille de case et le décalage jusqu’à ce que les lignes tombent sur une porte ou un pilier.' }),
      section('geste', 'Geste sur la carte', [
        h('div', { className: 'calage-geste', role: 'group', 'aria-label': 'Geste sur la carte' },
          champs.glisser, champs.mesurer,
          h('label', { className: 'calage-n' }, 'sur ', champs.n, ' cases')),
        champs.etatMesure], { aide: 'Au clavier : sélectionne la carte, puis les flèches décalent d’un pixel (Maj : dix), + et − changent la case. Les points du lieu restent visibles en transparence, sans pouvoir être touchés.' }),
      section('autres', 'Autres choix', [
        h('div', { className: 'actions' }, revenir, btn('Pas de grille', () => enregistrer(null, s.dims), { classe: 'btn-discret' }))], { repliee: true }));
    mode('glisser');
  }

  return {
    /**
     * Entre dans le calage.
     * @param {{lieu:object, infos:object|null, dims:{largeur:number,hauteur:number}}} o  `dims` : taille de l'image chargée
     * @returns {boolean} faux si l'image n'est pas chargée (rien à caler)
     */
    ouvrir({ lieu, infos, dims: taille }) {
      if (!taille) return false;
      const eff = g.grilleEffective(lieu, infos);
      const depart = eff.grille ?? g.normaliserGrille({ case: Math.max(g.CASE_MIN, Math.round(Math.min(taille.largeur, taille.hauteur) / 20)), dx: 0, dy: 0 }, taille);
      s = { depart, courante: depart, origine: eff.origine, catalogue: infos?.grille ?? null, dims: taille, mode: 'glisser', n: 8, premier: null };
      construire(eff.origine);
      carte.cadre.classList.add('calage');
      carte.cadre.tabIndex = 0;
      carte.cadre.setAttribute('role', 'application');
      carte.cadre.setAttribute('aria-label', 'Carte : flèches pour décaler la grille, plus et moins pour la taille de case');
      appliquer(depart);
      return true;
    },
    actif: () => !!s,
    /** Ce que la carte montre pendant le calage : la grille réglée, bien visible. */
    grilleAffichee: () => ({ grille: s.courante, opacite: OPACITE_REGLAGE }),
    panneau: () => panneau,
    /** Les repères des deux clics de « Mesurer », au format des points de la carte. */
    marqueurs() {
      if (!s?.premier) return [];
      return [{ id: 'mesure', x: s.premier.x / s.dims.largeur, y: s.premier.y / s.dims.hauteur, nom: '1', aria: 'Premier coin mesuré', classes: ['libre'] }];
    },
    fermer() {
      s = null; champs = null; panneau = null; geste = null;
      carte.cadre.classList.remove('calage', 'calage-mesure');
      carte.cadre.removeAttribute('tabindex');
      carte.cadre.removeAttribute('role');
      carte.cadre.removeAttribute('aria-label');
    },
    focaliser: () => panneau?.querySelector('input[type="range"]')?.focus({ preventScroll: true }),
  };
}
