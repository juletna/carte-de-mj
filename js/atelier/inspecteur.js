/**
 * L'inspecteur de l'atelier : la colonne de droite (panneau bas sous 760 px) qui ne montre que la sélection.
 * Voir docs/conception-atelier.md §2 « Contrat de l'inspecteur ». Chaque lot y enregistre ses types :
 *
 *   inspecteur.enregistrer(type, {
 *     titre(sel, ctx) → string,                             // le nom de l'élément
 *     etiquette?(sel, ctx) → string,                        // le type, en petit au-dessus du nom (défaut : LIBELLES_TYPE[type])
 *     renommer?(sel, valeur, ctx),                          // présent : le nom se modifie sur place, comme un titre
 *     nomCle?, nomVide?,                                    // clé de focus du champ du nom ; texte d'invite quand il est vide
 *     resume?(sel, ctx) → string,                           // une ligne sous le nom (« 3 salles · 2 personnages »)
 *     rendre(conteneur, sel, ctx),                          // remplit le corps ; rappelée à chaque changement de sélection ou de données
 *     actions?(sel, ctx) → [{ libelle, icone?, executer }], // actions courantes, en boutons en tête du corps
 *     menu?(sel, ctx) → [{ libelle, icone?, executer }],    // actions secondaires du menu « ⋯ »
 *     destructives?(sel, ctx) → [{ libelle, executer }]     // en dernier dans le menu « ⋯ », après un séparateur, en rouge
 *   });
 * Chaque action accepte aussi `titre` (infobulle) et `confirmation` (libellé du second clic : le premier arme la ligne, le second,
 * dans les 4 secondes, exécute ; le menu reste ouvert entre les deux).
 *
 * L'en-tête (type, nom, résumé, « ⋯ ») reste collé en haut quand le corps défile. Le menu est un popover de la couche supérieure :
 * le défilement de l'inspecteur ne le rogne pas ; sans l'API popover, un menu positionné en `fixed` en tient lieu.
 * Un seul lot enregistre un type (un second enregistrement lève une Error). `rendre` ne garde aucun état entre deux appels.
 * Sans sélection, l'inspecteur montre le nœud actif (`parDefaut()`), jamais un panneau vide.
 * Le DOM est fabriqué par `fabrique` (`h` de js/dom.js par défaut) : le module s'importe et se teste sous Node avec une fabrique simulée.
 */
import { h as hDom } from '../dom.js';
import { icone as iconeDom } from '../icones.js';

export const TYPES_INSPECTEUR = ['monde', 'lieu', 'point', 'donjon', 'salle', 'porte', 'objet', 'creature', 'pion'];

/** L'étiquette de chaque type, quand la définition n'en fournit pas. */
/** L'icône du type, devant son nom dans l'en-tête (les types sans icône n'en ont pas). */
export const ICONES_TYPE = { salle: 'salle', porte: 'porte', objet: 'objet', creature: 'creature', pion: 'creature', donjon: 'donjon', monde: 'monde' };
export const LIBELLES_TYPE = { monde: 'Monde', lieu: 'Lieu', point: 'Point', donjon: 'Donjon', salle: 'Salle', porte: 'Porte', objet: 'Objet', creature: 'Créature', pion: 'Pion' };

/**
 * @param {{ racine: HTMLElement, ctx?: () => object, parDefaut?: () => object|null, fabrique?: Function, icone?: Function }} options
 *   racine   : l'élément (ex. `.atelier-inspecteur`) que l'inspecteur remplit
 *   ctx      : le contexte passé à titre / rendre / actions (lu à chaque appel)
 *   parDefaut: la sélection à montrer quand il n'y en a pas (le nœud actif de l'arbre)
 */
export function creerInspecteur({ racine, ctx = () => ({}), parDefaut = () => null, fabrique = hDom, icone = iconeDom } = {}) {
  const h = fabrique;
  const definitions = new Map();
  const avantEffacer = []; // appelés juste avant que le corps soit vidé : un lot qui y a posé des nœuds vivants les reprend
  let courante = null;
  let nomCourant = '';

  // --- L'en-tête : type, nom, résumé à gauche ; « ⋯ » à droite. Il reste collé en haut (css/atelier.css). ---
  const etiquette = h('p', { className: 'atelier-inspecteur-type' });
  const champNom = h('input', { type: 'text', className: 'atelier-inspecteur-nom', maxLength: 80, spellcheck: false, 'aria-label': 'Nom' });
  const titreFixe = h('h2', { className: 'atelier-inspecteur-titre' });
  const resume = h('p', { className: 'atelier-inspecteur-resume' });
  const identite = h('div', { className: 'atelier-inspecteur-id' }, etiquette, champNom, titreFixe, resume);
  const declencheur = h('button', { type: 'button', className: 'btn btn-icone btn-discret atelier-inspecteur-menu-bouton', title: 'Actions', 'aria-label': 'Actions', 'aria-haspopup': 'menu', 'aria-expanded': 'false', hidden: true });
  try { declencheur.append(icone('plus-d-actions')); } catch { declencheur.append('⋯'); }
  const menu = h('div', { className: 'atelier-inspecteur-menu', role: 'menu', 'aria-label': 'Actions' });
  const natif = typeof menu.showPopover === 'function';
  if (natif) { menu.popover = 'auto'; declencheur.popoverTargetElement = menu; } else menu.hidden = true;
  const tete = h('div', { className: 'atelier-inspecteur-tete' }, identite, declencheur, menu);
  const actions = h('div', { className: 'atelier-inspecteur-actions' });
  const corps = h('div', { className: 'atelier-inspecteur-corps' });
  racine.append(tete, corps);

  // Le nom : un champ qui ressemble à un titre quand le type sait se renommer, un titre simple sinon.
  let renommerCourant = null;
  function poserNom(texte, def) {
    nomCourant = texte;
    const editable = !!def?.renommer;
    champNom.hidden = !editable; titreFixe.hidden = editable;
    champNom.value = texte; titreFixe.textContent = texte;
    champNom.placeholder = def?.nomVide ?? '';
    if (champNom.dataset) champNom.dataset.cle = def?.nomCle ?? '';
  }
  champNom.addEventListener('change', () => { if (renommerCourant) renommerCourant(champNom.value); });
  champNom.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') champNom.blur();
    else if (e.key === 'Escape') { champNom.value = nomCourant; champNom.blur(); }
  });
  // Pour les tests et les lots qui ajustent le nom sans tout redessiner.
  const titre = { get textContent() { return nomCourant; }, set textContent(v) { nomCourant = v; champNom.value = v; titreFixe.textContent = v; } };

  // --- Le menu « ⋯ » -----------------------------------------------------------------------------------------------
  const fermerMenu = () => {
    if (natif) { try { menu.hidePopover(); } catch { /* déjà fermé */ } } else { menu.hidden = true; declencheur.setAttribute?.('aria-expanded', 'false'); }
  };
  function placerMenu() {
    const r = declencheur.getBoundingClientRect();
    const largeurPage = document.documentElement.clientWidth;
    Object.assign(menu.style, { position: 'fixed', inset: 'auto', margin: '0', top: `${Math.round(r.bottom + 4)}px`, bottom: 'auto', right: `${Math.max(8, Math.round(largeurPage - r.right))}px`, left: 'auto' });
    const m = menu.getBoundingClientRect();
    if (m.height && r.bottom + 4 + m.height > window.innerHeight - 8) menu.style.top = `${Math.max(8, Math.round(r.top - 4 - m.height))}px`; // pas la place en dessous : au-dessus
  }
  if (natif) {
    menu.addEventListener('beforetoggle', (e) => { if (e.newState === 'open') placerMenu(); });
    menu.addEventListener('toggle', (e) => {
      declencheur.setAttribute('aria-expanded', String(e.newState === 'open'));
      if (e.newState === 'open') { placerMenu(); menu.querySelector('button')?.focus(); }
    });
  } else {
    declencheur.addEventListener('click', () => { menu.hidden = !menu.hidden; declencheur.setAttribute?.('aria-expanded', String(!menu.hidden)); if (!menu.hidden) placerMenu(); });
    globalThis.document?.addEventListener('pointerdown', (e) => { if (!menu.hidden && !tete.contains(e.target)) fermerMenu(); });
  }
  menu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !natif) { fermerMenu(); declencheur.focus(); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const lignes = [...menu.querySelectorAll('button')];
    const i = lignes.indexOf(document.activeElement);
    lignes[(i + (e.key === 'ArrowDown' ? 1 : -1) + lignes.length) % lignes.length]?.focus();
    e.preventDefault();
  });

  /** Une ligne du menu, ou (hors menu) un bouton du corps. `confirmation` : deux temps. */
  function ligne(a, { dansMenu, danger = false }) {
    const classe = dansMenu ? `atelier-menu-ligne${danger ? ' destructif' : ''}` : 'btn';
    const b = h('button', { type: 'button', className: classe });
    if (dansMenu && b.setAttribute) b.setAttribute('role', 'menuitem');
    if (a.icone) { try { b.append(icone(a.icone)); } catch { /* icône inconnue : le libellé suffit */ } }
    if (a.titre) b.title = a.titre;
    const texte = h('span', { textContent: a.libelle });
    b.append(texte);
    const agir = () => { if (dansMenu) fermerMenu(); a.executer(); };
    if (!a.confirmation) { b.addEventListener('click', agir); return b; }
    // Avec `confirmation` : le premier clic arme la ligne (elle change de libellé et le menu reste ouvert), le second, dans les 4 secondes, agit.
    let arme = false, attente;
    const repos = () => { clearTimeout(attente); if (!arme) return; arme = false; texte.textContent = a.libelle; b.className = classe; };
    b.addEventListener('click', () => {
      if (!arme) { arme = true; texte.textContent = a.confirmation; b.className = `${classe} arme`; attente = setTimeout(repos, 4000); return; }
      repos();
      agir();
    });
    b.addEventListener('blur', repos);
    return b;
  }

  function enregistrer(type, definition) {
    if (!TYPES_INSPECTEUR.includes(type)) throw new Error(`type d’inspecteur inconnu : ${type}`);
    if (definitions.has(type)) throw new Error(`le type « ${type} » est déjà enregistré`);
    if (!definition || typeof definition.titre !== 'function' || typeof definition.rendre !== 'function') throw new Error(`le type « ${type} » doit fournir titre() et rendre()`);
    definitions.set(type, definition);
    if (courante && courante.type === type) rafraichir();
  }

  /** Affiche la sélection (ou, sans elle, le nœud actif). Renvoie le type affiché, ou null s'il n'y a rien à montrer. */
  function afficher(sel = null) {
    courante = sel ?? null;
    return dessiner();
  }

  function dessiner() {
    const sel = courante ?? parDefaut();
    const def = sel && definitions.get(sel.type);
    const c = ctx();
    racine.hidden = false;
    fermerMenu();
    if (!def) {
      renommerCourant = null;
      etiquette.textContent = ''; resume.textContent = ''; resume.hidden = true;
      poserNom('Rien à régler', null);
      menu.replaceChildren();
      declencheur.hidden = true;
      for (const f of avantEffacer) f();
      corps.replaceChildren(h('p', { className: 'note', textContent: 'Choisis un élément dans l’arbre ou sur la carte pour le régler ici.' }));
      return null;
    }
    const nomType = def.etiquette?.(sel, c) ?? LIBELLES_TYPE[sel.type] ?? '';
    const iconeType = ICONES_TYPE[sel.type];
    etiquette.textContent = nomType;
    etiquette.hidden = !nomType; // un type sans mot (la salle : son onglet le dit) ne laisse pas de ligne vide
    if (iconeType && nomType) etiquette.append(icone(iconeType)); // passe devant le mot (CSS : order)
    renommerCourant = def.renommer ? ((valeur) => def.renommer(sel, valeur, c)) : null;
    poserNom(def.titre(sel, c) ?? '', def);
    const texteResume = def.resume?.(sel, c) ?? '';
    resume.textContent = texteResume; resume.hidden = !texteResume;
    const secondaires = (def.menu?.(sel, c) ?? []).map((a) => ligne(a, { dansMenu: true }));
    const destructives = (def.destructives?.(sel, c) ?? []).map((a) => ligne(a, { dansMenu: true, danger: true }));
    const separateur = secondaires.length && destructives.length ? [h('hr', { className: 'atelier-inspecteur-separateur', role: 'separator' })] : [];
    menu.replaceChildren(...secondaires, ...separateur, ...destructives);
    declencheur.hidden = !(secondaires.length || destructives.length);
    const visibles = (def.actions?.(sel, c) ?? []).map((a) => ligne(a, { dansMenu: false }));
    actions.replaceChildren(...visibles);
    for (const f of avantEffacer) f();
    corps.replaceChildren(...(visibles.length ? [actions] : []));
    def.rendre(corps, sel, c);
    return sel.type;
  }

  /** Remet à jour le seul résumé (et le nom, s'il n'a pas le focus) : un compte a changé, le corps ne doit pas bouger (focus, saisie en cours). */
  function majTete() {
    const sel = courante ?? parDefaut();
    const def = sel && definitions.get(sel.type);
    if (!def) return;
    const c = ctx();
    const texteResume = def.resume?.(sel, c) ?? '';
    resume.textContent = texteResume; resume.hidden = !texteResume;
    if (globalThis.document?.activeElement !== champNom) poserNom(def.titre(sel, c) ?? '', def);
  }

  /** Redessine la sélection courante (les données ont changé). */
  function rafraichir() { return dessiner(); }

  return {
    enregistrer, afficher, rafraichir, majTete, surEffacement: (f) => { avantEffacer.push(f); },
    courante: () => courante,
    enregistres: () => [...definitions.keys()],
    a: (type) => definitions.has(type),
    corps, titre, nom: champNom, element: racine,
  };
}
