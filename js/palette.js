/**
 * Palette du Donjon : ajouter des portes, du mobilier et des créatures à la souris ou au doigt.
 * C'est un catalogue de VIGNETTES (un petit canvas par élément, voir vignettes.js) rangées en grille, avec une recherche.
 * Sur ordinateur, il remplit le panneau de gauche (l'outil Portes, Mobilier ou Créatures du rail choisit le groupe) ;
 * sur téléphone, c'est un tiroir en bas d'écran (ses onglets de catégorie y sont visibles).
 *
 * Deux gestes (Pointer Events) :
 *  - un CLIC sur une vignette l'« arme » : elle reste armée, chaque clic sur une case de la carte en pose un ;
 *    Échap, un nouveau clic sur la vignette ou sur la pastille d'état désarme ;
 *  - un GLISSER-DÉPOSER de la vignette jusqu'à la carte en pose un seul, à l'endroit du lâcher (le fantôme est la vignette).
 * Le module ne sait rien du plan : il appelle `onArmer(item | null)` et `onDeposer(item, clientX, clientY)` ;
 * c'est l'appelant qui pose (js/pose.js), écrit la description et annonce le résultat.
 * Les éléments viennent du lexique (elementsPalette dans js/pose.js).
 */
import { filtrerElements } from './pose.js';
import { creerVignette, copierVignette } from './vignettes.js';
import { h as el } from './dom.js';
import { LIBELLE_FERMER } from './format.js';

const SEUIL_GLISSEMENT_PALETTE = 5; // px : en dessous, c'est un clic

/**
 * @param {HTMLElement} racine  conteneur du catalogue (vide)
 * @param {{
 *   elements: {groupe:string, genre:string, type:string, libelle:string, mots?:string[], sousGroupe?:string}[],
 *   groupes: {id:string, titre:string}[],
 *   sousGroupes?: Object<string, {id:string, titre:string}[]>,   intertitres par groupe
 *   pastille: HTMLButtonElement,               pastille d'état « Pose : … ✕ », ailleurs sur la page
 *   onFermer?: () => void,                     bouton « Fermer » du tiroir (téléphone)
 *   onArmer: (item: object|null) => void,
 *   onDeposer: (item: object, x: number, y: number) => void,
 *   survol?: (x: number, y: number) => boolean  vrai si ce point est sur la carte (le fantôme change de couleur)
 * }} options
 * @returns {{ desarmer: () => void, arme: () => object|null, afficherGroupe: (id: string) => void, groupe: () => string,
 *             annulerGlisser: () => boolean }}
 */
export function creerPalette(racine, { elements, groupes, sousGroupes = {}, pastille, onFermer, onArmer, onDeposer, survol }) {
  let arme = null;
  let groupeCourant = groupes[0].id;
  let glisse = null;        // { item, fantome } pendant un glisser-déposer
  let apresGlisser = false; // le clic qui suit un glisser ne doit pas armer
  const dessines = new Set(); // groupes dont les vignettes sont déjà dessinées (au premier affichage, une seule fois)

  // --- Structure ---
  const fermer = el('button', { type: 'button', className: 'discret palette-fermer', textContent: LIBELLE_FERMER, title: 'Fermer la palette' });
  fermer.addEventListener('click', () => onFermer?.());
  const tete = el('div', { className: 'palette-tete' }, el('strong', { textContent: 'Ajouter à la carte' }), fermer);
  const onglets = el('div', { className: 'palette-groupes', role: 'group', 'aria-label': 'Catégorie' });
  const recherche = el('input', { type: 'search', className: 'palette-recherche', placeholder: 'Rechercher…', autocomplete: 'off', spellcheck: false, 'aria-label': 'Rechercher un élément' });
  const vide = el('p', { className: 'palette-vide', textContent: 'Aucun élément ne correspond.', hidden: true });
  const liste = el('div', { className: 'palette-liste' });
  const aide = el('p', { className: 'palette-aide', textContent: 'Clique une vignette puis une case de la carte (elle reste armée : pose-en plusieurs), ou glisse-la sur la carte. Une porte se pose sur le mur le plus proche.' });
  racine.replaceChildren(tete, onglets, recherche, liste, vide, aide);

  const boutonsGroupes = groupes.map((g) => {
    const b = el('button', { type: 'button', className: 'discret', textContent: g.titre, 'data-groupe': g.id });
    b.addEventListener('click', () => afficherGroupe(g.id));
    onglets.append(b);
    return b;
  });

  // Un bloc par groupe ; dans chaque bloc, des grilles (une par intertitre, ou une seule).
  const blocs = new Map();     // id de groupe -> élément
  const boutons = [];          // { b, item, grille }
  for (const g of groupes) {
    const bloc = el('div', { className: 'palette-groupe', 'data-groupe': g.id });
    const items = elements.filter((e) => e.groupe === g.id);
    const parties = sousGroupes[g.id] || [{ id: '', titre: '' }];
    for (const sg of parties) {
      const duSousGroupe = items.filter((e) => (e.sousGroupe || '') === sg.id);
      if (!duSousGroupe.length) continue;
      const titre = sg.titre ? el('h3', { className: 'palette-intertitre', textContent: sg.titre }) : null;
      const grille = el('div', { className: 'palette-grille' });
      for (const item of duSousGroupe) {
        const b = el('button', { type: 'button', className: 'palette-item', title: item.libelle, 'aria-label': item.libelle, 'aria-pressed': 'false', 'data-groupe': item.groupe, 'data-type': item.type },
          el('span', { className: 'palette-vignette' }), el('span', { className: 'palette-nom', textContent: item.libelle }));
        grille.append(b);
        boutons.push({ b, item, grille, titre });
        brancher(b, item);
      }
      bloc.append(...(titre ? [titre, grille] : [grille]));
    }
    blocs.set(g.id, bloc);
    liste.append(bloc);
  }

  /** Dessine les vignettes d'un groupe, la première fois qu'il est affiché (elles ne sont jamais redessinées). */
  function dessinerGroupe(id) {
    if (dessines.has(id)) return;
    dessines.add(id);
    for (const { b, item } of boutons) if (item.groupe === id) b.querySelector('.palette-vignette').append(creerVignette(item));
  }

  function afficherGroupe(id) {
    if (!blocs.has(id)) return;
    groupeCourant = id;
    recherche.value = '';
    for (const b of boutonsGroupes) b.setAttribute('aria-pressed', String(b.dataset.groupe === id));
    for (const [gid, bloc] of blocs) bloc.hidden = gid !== id;
    dessinerGroupe(id);
    filtrer();
    liste.scrollTop = 0;
  }

  /** Cache les vignettes qui ne répondent pas à la recherche (et les intertitres qui se retrouvent vides). */
  function filtrer() {
    const gardes = new Set(filtrerElements(elements.filter((e) => e.groupe === groupeCourant), recherche.value));
    let visibles = 0;
    for (const x of boutons) if (x.item.groupe === groupeCourant) { x.b.hidden = !gardes.has(x.item); if (!x.b.hidden) visibles++; }
    for (const x of boutons) if (x.titre) { const reste = boutons.some((y) => y.grille === x.grille && !y.b.hidden); x.titre.hidden = x.grille.hidden = !reste; }
    vide.hidden = visibles > 0;
  }
  recherche.addEventListener('input', filtrer);
  // Échap dans le champ : efface la recherche d'abord (l'élément armé reste armé).
  recherche.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && recherche.value) { recherche.value = ''; filtrer(); e.preventDefault(); e.stopPropagation(); }
  });

  function majEtat() {
    for (const { b, item } of boutons) b.setAttribute('aria-pressed', String(!!arme && item.type === arme.type && item.groupe === arme.groupe));
    pastille.hidden = !arme;
    pastille.textContent = arme ? `Pose : ${arme.libelle} ✕` : '';
    racine.classList.toggle('arme', !!arme);
    document.body.classList.toggle('pose-armee', !!arme);
  }

  function armer(item) {
    arme = item;
    majEtat();
    onArmer(item);
  }
  function desarmer() { if (arme) armer(null); }
  pastille.title = 'Arrêter la pose (Échap)';
  pastille.addEventListener('click', desarmer);

  // --- Une vignette : clic = armer / désarmer, glisser = déposer ---
  function brancher(b, item) {
    let depart = null;
    // Une fois l'appui fait, on suit le pointeur sur toute la fenêtre (pas seulement sur le bouton) : un mouvement rapide
    // qui quitte le bouton avant le premier événement ne perd pas le glisser.
    const bouger = (e) => {
      if (!depart || e.pointerId !== depart.id) return;
      if (!glisse) {
        if (Math.hypot(e.clientX - depart.x, e.clientY - depart.y) < SEUIL_GLISSEMENT_PALETTE) return;
        const fantome = el('div', { className: 'palette-fantome' });
        const canvas = b.querySelector('canvas');
        if (canvas) fantome.append(copierVignette(canvas));
        glisse = { item, fantome };
        document.body.append(fantome);
        document.body.classList.add('palette-glisse');
      }
      glisse.fantome.style.left = `${e.clientX}px`;
      glisse.fantome.style.top = `${e.clientY}px`;
      glisse.fantome.classList.toggle('sur-carte', !!survol?.(e.clientX, e.clientY));
    };
    const finir = (e) => {
      if (!depart || e.pointerId !== depart.id) return;
      depart = null;
      window.removeEventListener('pointermove', bouger);
      window.removeEventListener('pointerup', finir);
      window.removeEventListener('pointercancel', finir);
      if (!glisse) return; // un simple clic : l'événement « click » armera
      const g = glisse;
      glisse = null;
      g.fantome.remove();
      document.body.classList.remove('palette-glisse');
      apresGlisser = true;
      setTimeout(() => { apresGlisser = false; }, 0);
      if (e.type === 'pointerup') onDeposer(g.item, e.clientX, e.clientY);
    };
    b.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !e.isPrimary) return;
      depart = { x: e.clientX, y: e.clientY, id: e.pointerId };
      window.addEventListener('pointermove', bouger);
      window.addEventListener('pointerup', finir);
      window.addEventListener('pointercancel', finir);
    });
    b.addEventListener('click', () => {
      if (apresGlisser) return;
      armer(arme && arme.type === item.type && arme.groupe === item.groupe ? null : item);
    });
  }

  /** Échap pendant un glisser : abandonne sans rien poser. Renvoie vrai s'il y en avait un. */
  function annulerGlisser() {
    if (!glisse) return false;
    glisse.fantome.remove();
    document.body.classList.remove('palette-glisse');
    glisse = null;
    apresGlisser = true;
    setTimeout(() => { apresGlisser = false; }, 0);
    return true;
  }

  afficherGroupe(groupeCourant);
  majEtat();
  return { desarmer, arme: () => arme, afficherGroupe, groupe: () => groupeCourant, annulerGlisser };
}
