/**
 * L'arborescence des lieux de l'écran Monde (colonne de gauche, tiroir sous 760 px) : du DOM seulement, l'arbre lui-même vient de
 * `arbreLieux` (js/univers-vue.js, pur). Chaque ligne : vignette de l'image, nom, badge « départ » ; un clic ouvre le lieu, ou entre
 * dans le donjon. Les branches se plient (l'état est gardé le temps de la session). Au clavier : rôle tree, flèches haut/bas pour
 * parcourir, droite/gauche pour déplier/replier ou changer de niveau, Entrée pour ouvrir, Début/Fin.
 * Renvoie `{ element, maj({ univers, donjons, lieuId }) , ouvert, ouvrir, fermer }`.
 */
import { h, bouton } from '../dom.js';
import * as images from '../univers-images.js';
import { arbreLieux, filtrerArbre } from '../univers-vue.js';

const SEUIL_FILTRE = 10; // au-delà de ce nombre de lieux, un champ de filtre apparaît
const cleImage = (ref) => `${ref?.source}:${ref?.id}`;

export function creerArbre({ surLieu, surDonjon, surAjouter }) {
  const plies = new Set();           // clés des branches repliées, gardées le temps de la session
  const urls = new Map();            // clé d'image → URL déjà connue (pour ne pas faire clignoter les vignettes)
  let dernierLieu = null;
  let donnees = { univers: null, donjons: {}, lieuId: null };

  const filtre = h('input', { type: 'search', className: 'univers-arbre-filtre', placeholder: 'Filtrer les lieux…', 'aria-label': 'Filtrer les lieux', spellcheck: false, hidden: true });
  const liste = h('ul', { className: 'univers-arbre-liste', role: 'tree', 'aria-label': 'Lieux du monde' });
  const vide = h('p', { className: 'note', hidden: true });
  const ajouter = bouton('+ Lieu', () => surAjouter(), 'discret petit univers-arbre-ajout');
  ajouter.title = 'Ajouter un lieu : choisir une carte dans la bibliothèque';
  const element = h('nav', { className: 'univers-arbre', 'aria-label': 'Lieux' }, filtre, liste, vide, ajouter);

  function vignette(n, univers) {
    const boite = h('span', { className: `univers-vignette${n.type === 'donjon' ? ' donjon' : ''}`, 'aria-hidden': 'true' });
    if (n.type === 'donjon') { boite.textContent = '🏰'; return boite; }
    const ref = univers.lieux[n.id]?.image;
    const poser = (url) => { if (url) boite.replaceChildren(h('img', { src: url, alt: '', loading: 'lazy', decoding: 'async' })); };
    if (urls.has(cleImage(ref))) poser(urls.get(cleImage(ref)));
    else {
      boite.textContent = '🗺';
      images.urlImage(ref).then((url) => { if (url) { urls.set(cleImage(ref), url); poser(url); } });
    }
    return boite;
  }

  function noeud(n, niveau, forces) {
    const groupe = n.type === 'groupe';
    const aEnfants = n.enfants.length > 0;
    const replie = aEnfants && plies.has(n.cle) && !forces;
    const courant = n.type === 'lieu' && n.id === donnees.lieuId;
    const li = h('li', { role: 'treeitem', className: `univers-arbre-noeud${courant ? ' courant' : ''}` });
    li.dataset.cle = n.cle;
    li.tabIndex = -1;
    li.setAttribute('aria-level', String(niveau));
    if (aEnfants) li.setAttribute('aria-expanded', String(!replie));
    if (n.type === 'lieu') li.setAttribute('aria-selected', String(courant));
    const nomAffiche = h('span', { className: 'univers-arbre-nom', textContent: n.nom, title: n.nom });
    const texte = h('span', { className: 'univers-arbre-texte' }, nomAffiche);
    if (n.aussiDepuis?.length) {
      const m = `aussi depuis ${n.aussiDepuis.join(', ')}`;
      texte.append(h('span', { className: 'doux univers-arbre-aussi', textContent: m, title: m }));
    }
    const bascule = aEnfants
      ? h('span', { className: 'univers-arbre-bascule', textContent: replie ? '▸' : '▾', 'aria-hidden': 'true' })
      : h('span', { className: 'univers-arbre-bascule vide', 'aria-hidden': 'true' });
    const ligne = h('div', { className: 'univers-arbre-ligne' }, bascule, groupe ? '' : vignette(n, donnees.univers), texte,
      n.depart ? h('span', { className: 'univers-arbre-badge', textContent: 'départ', title: 'Lieu de départ du monde' }) : '');
    if (n.type === 'donjon') ligne.title = `Entrer dans le donjon ${n.nom}`;
    li.append(ligne);
    ligne.addEventListener('click', (e) => {
      li.focus({ preventScroll: true });
      if (e.target === bascule && aEnfants) basculer(n.cle, replie);
      else activer(n, replie);
    });
    if (aEnfants && !replie) li.append(h('ul', { role: 'group' }, ...n.enfants.map((e) => noeud(e, niveau + 1, forces))));
    return li;
  }

  function basculer(cle, deplier) {
    if (deplier) plies.delete(cle); else plies.add(cle);
    redessiner(cle);
  }
  function activer(n, replie) {
    if (n.type === 'lieu') surLieu(n.id);
    else if (n.type === 'donjon') surDonjon(n);
    else basculer(n.cle, replie);
  }

  const visibles = () => [...liste.querySelectorAll('[role="treeitem"]')];
  function redessiner(cleFocus = null) {
    const { univers, donjons } = donnees;
    if (!univers) { liste.replaceChildren(); return; }
    const actif = liste.contains(document.activeElement) ? document.activeElement.closest('[role="treeitem"]')?.dataset.cle : null;
    const garde = cleFocus ?? actif; // la ligne qui avait le focus le garde après le redessin
    const total = Object.keys(univers.lieux).length;
    filtre.hidden = total <= SEUIL_FILTRE;
    const texte = filtre.hidden ? '' : filtre.value;
    const arbre = filtrerArbre(arbreLieux(univers, donjons), texte);
    const tetes = [];
    if (arbre.racine) tetes.push(noeud(arbre.racine, 1, !!texte.trim()));
    if (arbre.nonRelies.length) {
      const g = { cle: 'g:non-relies', type: 'groupe', nom: `Non reliés (${arbre.nonRelies.length})`, enfants: arbre.nonRelies, depart: false, aussiDepuis: [] };
      tetes.push(noeud(g, 1, !!texte.trim()));
    }
    liste.replaceChildren(...tetes);
    vide.hidden = tetes.length > 0;
    vide.textContent = total ? 'Aucun lieu ne correspond.' : 'Aucun lieu : ajoute la première carte (le continent, la région, le village…).';
    const tous = visibles();
    const cible = (garde && tous.find((li) => li.dataset.cle === garde)) || liste.querySelector('.courant') || tous[0];
    tous.forEach((li) => { li.tabIndex = li === cible ? 0 : -1; });
    if (garde && cible?.dataset.cle === garde) cible.focus({ preventScroll: true });
  }
  filtre.addEventListener('input', () => redessiner());
  filtre.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && filtre.value) { e.stopPropagation(); e.preventDefault(); filtre.value = ''; redessiner(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); (liste.querySelector('.courant') ?? visibles()[0])?.focus(); }
  });

  liste.addEventListener('keydown', (e) => {
    const li = e.target.closest?.('[role="treeitem"]');
    if (!li || e.target !== li) return;
    const tous = visibles();
    const i = tous.indexOf(li);
    const aller = (cible) => { if (!cible) return; tous.forEach((x) => { x.tabIndex = x === cible ? 0 : -1; }); cible.focus(); };
    const ouverte = li.getAttribute('aria-expanded');
    switch (e.key) {
      case 'ArrowDown': aller(tous[i + 1]); break;
      case 'ArrowUp': aller(tous[i - 1]); break;
      case 'Home': aller(tous[0]); break;
      case 'End': aller(tous.at(-1)); break;
      case 'ArrowRight':
        if (ouverte === 'false') basculer(li.dataset.cle, true); else if (ouverte === 'true') aller(li.querySelector('[role="treeitem"]'));
        break;
      case 'ArrowLeft':
        if (ouverte === 'true') basculer(li.dataset.cle, false); else aller(li.parentElement.closest('[role="treeitem"]'));
        break;
      case 'Enter': case ' ': {
        li.firstElementChild.click();
        break;
      }
      default: return;
    }
    e.preventDefault();
  });

  // Tiroir sous 760 px : le CSS le montre quand l'élément porte `ouvert`.
  const voile = h('div', { className: 'univers-voile', hidden: true });
  voile.addEventListener('click', () => fermer());
  function ouvrir() { element.classList.add('ouvert'); voile.hidden = false; (liste.querySelector('.courant') ?? visibles()[0] ?? ajouter).focus({ preventScroll: true }); }
  function fermer() { element.classList.remove('ouvert'); voile.hidden = true; }

  function maj(d) {
    donnees = d;
    if (d.univers && d.lieuId && d.lieuId !== dernierLieu) { // un nouveau lieu ouvert : ses ancêtres se déplient
      const n = [...arbreLieuxPlat(d)].find((x) => x.id === d.lieuId);
      for (const cle of n?.chemin ?? []) plies.delete(cle);
    }
    dernierLieu = d.lieuId;
    redessiner();
  }
  const arbreLieuxPlat = function* (d) {
    const a = arbreLieux(d.univers, d.donjons);
    const pile = [a.racine, ...a.nonRelies].filter(Boolean);
    while (pile.length) { const n = pile.pop(); yield n; pile.push(...n.enfants); }
  };

  return { element, voile, maj, ouvrir, fermer, ouvert: () => element.classList.contains('ouvert') };
}
