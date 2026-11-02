/**
 * Palette flottante du Donjon : ajouter des portes, du mobilier et des créatures à la souris ou au doigt.
 *
 * Deux gestes (Pointer Events) :
 *  - un CLIC sur un élément l'« arme » : il reste armé, chaque clic sur une case de la carte en pose un ;
 *    Échap ou un nouveau clic sur l'élément (ou sur la pastille d'état) désarme ;
 *  - un GLISSER-DÉPOSER de l'élément jusqu'à la carte en pose un seul, à l'endroit du lâcher.
 * Le module ne sait rien du plan : il appelle `onArmer(item | null)` et `onDeposer(item, clientX, clientY)` ;
 * c'est l'appelant qui pose (js/pose.js), écrit la description et annonce le résultat.
 * Les éléments viennent du lexique (elementsPalette dans js/pose.js).
 */

const SEUIL_GLISSEMENT = 5; // px : en dessous, c'est un clic

/**
 * @param {HTMLElement} racine  conteneur de la palette (vide)
 * @param {{
 *   elements: {groupe:string, genre:string, type:string, libelle:string}[],
 *   groupes: {id:string, titre:string}[],
 *   replie?: boolean,                          état de départ
 *   onReplier?: (replie: boolean) => void,     pour mémoriser le choix
 *   onArmer: (item: object|null) => void,
 *   onDeposer: (item: object, x: number, y: number) => void,
 *   survol?: (x: number, y: number) => boolean  vrai si ce point est sur la carte (le fantôme change de couleur)
 * }} options
 * @returns {{ desarmer: () => void, arme: () => object|null, replier: (r: boolean) => void, annulerGlisser: () => boolean }}
 */
export function creerPalette(racine, { elements, groupes, replie = false, onReplier, onArmer, onDeposer, survol }) {
  let arme = null;
  let groupeCourant = groupes[0].id;
  let glisse = null;      // { item, fantome, boutonId } pendant un glisser-déposer
  let apresGlisser = false; // le clic qui suit un glisser ne doit pas armer

  const el = (tag, props = {}, ...enfants) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) { if (k.startsWith('aria-') || k.startsWith('data-')) e.setAttribute(k, v); else e[k] = v; }
    e.append(...enfants);
    return e;
  };

  // --- Structure ---
  const bascule = el('button', { type: 'button', className: 'palette-titre', id: 'palette-bascule' });
  const pastille = el('button', { type: 'button', className: 'palette-pastille', hidden: true, title: 'Arrêter la pose (Échap)' });
  const entete = el('div', { className: 'palette-entete' }, bascule, pastille);
  const onglets = el('div', { className: 'palette-groupes', role: 'group', 'aria-label': 'Catégorie' });
  const liste = el('div', { className: 'palette-liste' });
  const aide = el('p', { className: 'palette-aide', textContent: 'Clique un élément puis une case de la carte (il reste armé : pose-en plusieurs), ou glisse-le sur la carte. Une porte se pose sur le mur le plus proche.' });
  const corps = el('div', { className: 'palette-corps', id: 'palette-corps' }, onglets, liste, aide);
  racine.replaceChildren(entete, corps);

  const boutonsGroupes = groupes.map((g) => {
    const b = el('button', { type: 'button', className: 'discret petit', textContent: g.titre, 'data-groupe': g.id });
    b.addEventListener('click', () => { groupeCourant = g.id; afficherGroupe(); });
    onglets.append(b);
    return b;
  });

  const boutonsElements = elements.map((item) => {
    const b = el('button', { type: 'button', className: 'palette-item discret', textContent: item.libelle, 'data-groupe': item.groupe, 'data-type': item.type, 'aria-pressed': 'false' });
    liste.append(b);
    brancher(b, item);
    return b;
  });

  function afficherGroupe() {
    for (const b of boutonsGroupes) b.setAttribute('aria-pressed', String(b.dataset.groupe === groupeCourant));
    for (const b of boutonsElements) b.hidden = b.dataset.groupe !== groupeCourant;
  }

  function majEtat() {
    for (const b of boutonsElements) b.setAttribute('aria-pressed', String(!!arme && b.dataset.type === arme.type && b.dataset.groupe === arme.groupe));
    pastille.hidden = !arme;
    pastille.textContent = arme ? `Pose : ${arme.libelle} ✕` : '';
    racine.classList.toggle('arme', !!arme);
  }

  function replier(r) {
    racine.classList.toggle('replie', r);
    corps.hidden = r;
    bascule.setAttribute('aria-expanded', String(!r));
    bascule.textContent = r ? '＋ Ajouter' : '− Ajouter';
    bascule.title = r ? 'Ouvrir la palette : portes, mobilier, créatures' : 'Replier la palette';
  }
  bascule.addEventListener('click', () => { const r = !racine.classList.contains('replie'); replier(r); onReplier?.(r); });

  function armer(item) {
    arme = item;
    majEtat();
    onArmer(item);
  }
  function desarmer() { if (arme) armer(null); }
  pastille.addEventListener('click', desarmer);

  // --- Un bouton d'élément : clic = armer / désarmer, glisser = déposer ---
  function brancher(b, item) {
    let depart = null;
    // Une fois l'appui fait, on suit le pointeur sur toute la fenêtre (pas seulement sur le bouton) : un mouvement rapide
    // qui quitte le bouton avant le premier événement ne perd pas le glisser.
    const bouger = (e) => {
      if (!depart || e.pointerId !== depart.id) return;
      if (!glisse) {
        if (Math.hypot(e.clientX - depart.x, e.clientY - depart.y) < SEUIL_GLISSEMENT) return;
        glisse = { item, fantome: el('div', { className: 'palette-fantome', textContent: item.libelle }) };
        document.body.append(glisse.fantome);
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

  afficherGroupe();
  majEtat();
  replier(replie);
  return { desarmer, arme: () => arme, replier, annulerGlisser };
}
