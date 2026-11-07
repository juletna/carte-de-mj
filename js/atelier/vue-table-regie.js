/**
 * Les deux vues de la régie, en haut de la scène : « En régie » (la carte et la commande) et « À la table » (ce que voient les joueurs, en grand).
 * Le MJ règle l'écran de table dans le panneau de droite et voit tout de suite le résultat, sans tourner la tête vers l'écran de la table.
 *
 *   const vues = creerVuesRegie({ scene, barre, avant, cadrage });   // `scene` : #principal (colonne), `barre` : la barre d'outils, `avant` : le nœud devant lequel poser le sélecteur
 *   vues.afficher('table' | 'regie');  vues.courante();  vues.majCadrage()
 *   `cadrage` (facultatif) : { lire() → { zoom, reel, reelPossible }, zoomer(facteur), remplir(), reel() } : le contrôle « − 160 % +  Remplir  Réel » posé sur la vue « À la table ».
 *
 * La vue Table est la vraie vue table (presentation.html?vue=table&apercu=1) dans un cadre : elle reçoit les messages du même canal que la
 * fenêtre des joueurs. Interactive comme la vue Régie (un point de la carte du monde se choisit, un pion se glisse : les gestes passent par le canal) ; chargée à la première ouverture seulement.
 */
import { h } from '../dom.js';

/** Taille (px) à laquelle la vue table est dessinée avant d'être réduite à la place disponible : un écran de salon en 16 : 9. */
const ECRAN = { largeur: 1600, hauteur: 900 };

export function creerVuesRegie({ scene, barre, avant = null, doc = document, cadrage = null }) {
  let courante = 'regie';
  let cadre = null;
  const boutons = {};
  const fabriquer = (cle, libelle, titre) => {
    const b = h('button', { type: 'button', className: `btn btn-discret regie-vue vue-${cle === 'table' ? 'a-la-table' : 'en-regie'}`, role: 'tab', 'aria-selected': 'false', title: titre, textContent: libelle });
    b.addEventListener('click', () => afficher(cle));
    boutons[cle] = b;
    return b;
  };
  const selecteur = h('div', { className: 'regie-vues', role: 'tablist', 'aria-label': 'Vue' },
    fabriquer('regie', 'En régie', 'Ta carte et la commande : ce que tu vois, toi'),
    fabriquer('table', 'À la table', 'Ce que voient les joueurs, en grand : règle l’écran de table et vois le résultat'));
  barre.insertBefore(selecteur, avant);

  const zone = h('div', { id: 'apercu-scene', className: 'apercu-scene', hidden: true });
  scene.append(zone);

  // Le contrôle de cadrage : − · zoom · + · Remplir · Réel. La régie garde le zoom ; ici on ne fait que le montrer et envoyer les gestes.
  const valeur = h('output', { className: 'cadrage-valeur', 'aria-live': 'polite' });
  const bouton = (texte, titre, action, classe = '') => { const b = h('button', { type: 'button', className: `btn btn-discret cadrage-bouton ${classe}`.trim(), title: titre, 'aria-label': titre, textContent: texte }); b.addEventListener('click', action); return b; };
  const moins = bouton('−', 'Zoom arrière', () => cadrage.zoomer(1 / 1.25));
  const plus = bouton('+', 'Zoom avant', () => cadrage.zoomer(1.25));
  const remplir = bouton('Remplir', 'La carte remplit l’écran de la table', () => cadrage.remplir());
  const reel = bouton('Réel', 'Échelle réelle : chaque case a la taille calibrée (figurines)', () => cadrage.reel());
  const barreCadrage = h('div', { className: 'cadrage-table', role: 'group', 'aria-label': 'Cadrage de la vue table', hidden: true }, moins, valeur, plus, remplir, reel);
  if (cadrage) zone.append(barreCadrage);
  function majCadrage() {
    if (!cadrage) return;
    const { zoom, reel: estReel, reelPossible } = cadrage.lire();
    valeur.textContent = estReel ? 'Réel' : `${Math.round(zoom * 100)} %`;
    reel.disabled = !reelPossible;
    reel.title = reelPossible ? 'Échelle réelle : chaque case a la taille calibrée (figurines)' : 'Cette carte n’a pas de grille';
    reel.setAttribute('aria-pressed', String(estReel));
    remplir.setAttribute('aria-pressed', String(!estReel && zoom === 1));
    barreCadrage.hidden = courante !== 'table';
  }

  function ajuster() {
    if (!cadre || zone.hidden) return;
    const l = zone.clientWidth, hh = zone.clientHeight;
    if (!l || !hh) return;
    const echelle = Math.min(l / ECRAN.largeur, hh / ECRAN.hauteur);
    cadre.style.transform = `translate(${(l - ECRAN.largeur * echelle) / 2}px, ${(hh - ECRAN.hauteur * echelle) / 2}px) scale(${echelle})`;
  }
  if (typeof ResizeObserver === 'function') new ResizeObserver(ajuster).observe(zone);

  function afficher(cle) {
    courante = cle === 'table' ? 'table' : 'regie';
    for (const [k, b] of Object.entries(boutons)) b.setAttribute('aria-selected', String(k === courante));
    scene.classList.toggle('vue-table-active', courante === 'table');
    zone.hidden = courante !== 'table';
    if (courante === 'table' && !cadre) {
      cadre = h('iframe', { title: 'Ce que voient les joueurs', tabIndex: -1, 'aria-hidden': 'true', src: new URL('presentation.html?vue=table&apercu=1', doc.baseURI).href });
      Object.assign(cadre.style, { width: `${ECRAN.largeur}px`, height: `${ECRAN.hauteur}px` });
      zone.append(cadre);
    }
    majCadrage();
    ajuster();
  }
  afficher('regie');
  /** Où se trouve, dans la fenêtre, un point touché dans le cadre (fractions de sa largeur et de sa hauteur) : null si le cadre n'est pas affiché. */
  function ancre(pos) {
    if (!cadre || !pos || zone.hidden) return null;
    const r = cadre.getBoundingClientRect();
    return { x: r.left + pos.x * r.width, y: r.top + pos.y * r.height };
  }
  return { afficher, courante: () => courante, element: selecteur, ancre, majCadrage };
}
