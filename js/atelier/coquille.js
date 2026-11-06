/**
 * La coquille de l'atelier : trois colonnes (arbre · scène · inspecteur), la sélection commune et l'adresse. Voir docs/conception-atelier.md §2.
 *
 *   const coquille = creerCoquille({ racine, mode: 'preparer'|'jouer', donnees, scene?, bouton?, surNavigation? });
 *
 *   donnees() → { univers: { id: univers }, donjons: { id: donjon }, donjonActif?: { donjon, salle? }, mondeActif?: id }  (lu à chaque rafraîchissement)
 *   coquille.arbre          { element, ajouterAction({ libelle, icone?, executer, groupe?, ordre?, aide?, danger? }), rafraichir() }  (menu « + Nouveau » de l'en-tête)
 *   coquille.scene          l'élément du centre (les cartes s'y posent)
 *   coquille.barreOutils    la barre d'outils de la scène : UNE seule ligne (vide et cachée tant que personne n'y met rien) ; le bouton de l'arbre
 *                           au début, les outils au milieu, puis `barreFin` (le bouton « Affichage » et le seul bouton doré, « Jouer »)
 *   coquille.barreFin       le groupe de droite de cette ligne (caché tant qu'il est vide)
 *   coquille.inspecteur     { enregistrer(type, définition), afficher(sel), rafraichir(), a(type) } (js/atelier/inspecteur.js)
 *   coquille.selectionner(sel) / selection()   la sélection commune (js/atelier-selection.js) ; jamais en double ailleurs
 *   coquille.naviguer(route, { ecrireHash? })   va à un nœud ({ page: 'monde'|'donjon', monde?, lieu?, donjon?, salle? }), écrit l'adresse et prévient
 *                              `surNavigation(route, noeud)` : c'est lui qui change la scène
 *   coquille.positionner(pos, { ecrireHash? })  la scène a changé d'elle-même (pos : { monde?, lieu?, donjon?, salle? }) : l'arbre et l'adresse suivent, sans rappel
 *                              `ecrireHash` (vrai par défaut, faux si l'option `adresse` de la coquille est fausse) : n'écrit pas l'adresse ce coup-ci
 *
 * Options : `inspecteurToujoursVisible` (la colonne de droite reste affichée même sans type enregistré : le mode jouer, dont les onglets ont leur
 * contenu), `inspecteurGenerique: false` (masque l'en-tête et le corps génériques de l'inspecteur : seuls les onglets restent), `adresse: false`
 * (la coquille n'écrit ni ne lit l'adresse : la régie se rouvre par le stockage). Par défaut, le mode jouer prend les trois : voir plus bas.
 * `affichage: { lire, surChangement }` pose le bouton « Affichage » (grille, thème, détails, relief, pénombre, flammes, repères : une préférence commune) dans la barre d'outils ;
 * `coquille.affichage.maj()` le remet d'accord avec les réglages relus.
 * La racine porte `data-atelier="preparer"|"jouer"` : css/atelier.css place les colonnes selon ce mode.
 *   coquille.position()        la position courante
 *   coquille.rafraichir({ inspecteur? })   les données ont changé : l'arbre (si ses noms ont changé) et la validité de la sélection ; l'inspecteur seulement si `inspecteur: true`
 *   coquille.surSelection(f)   f(sel) après chaque changement de sélection
 *   coquille.onglets           (mode jouer) { ajouter({ id, libelle, contenu }), choisir(id), courant() } : Salle · Joueurs · Table
 *   coquille.ouvrirTiroir() / fermerTiroir()   l'arbre en tiroir (sous 760 px)
 *
 * Sous 760 px : l'arbre est un tiroir (fond cliquable, Échap le ferme et rend le focus) et l'inspecteur un panneau bas repliable.
 * Sur ordinateur, l'arbre se replie (état mémorisé). L'inspecteur n'occupe de la place que si un type est enregistré pour la sélection.
 */
import { h } from '../dom.js';
import { icone } from '../icones.js';
import { telephone } from '../telephone.js';
import { arbreAtelier, noeudParCle, parcourir } from '../atelier-arbre.js';
import { ecrireRoute, lireRoute, routeDe, memeRoute } from '../atelier-route.js';
import { selection as creerSelection, selectionValide, meme } from '../atelier-selection.js';
import { creerArbreVue } from './arbre-vue.js';
import { creerInspecteur } from './inspecteur.js';
import { marquerCourant } from '../navigation.js';
import { CLE_DERNIERE_ROUTE } from '../navigation-donnees.js';
import { creerAffichagePopover } from './affichage-popover.js';

const CLE_ARBRE_REPLIE = 'carte-de-mj:atelier-arbre-replie';
const lire = (cle) => { try { return localStorage.getItem(cle); } catch { return null; } };
const ecrire = (cle, v) => { try { localStorage.setItem(cle, v); } catch { /* stockage indisponible : l'état n'est pas gardé */ } };

/** La sélection d'un nœud de l'arbre (monde, lieu, donjon ou salle). */
export const selectionDuNoeud = (n) => (n && n.type !== 'groupe' ? creerSelection(n.type, n.id, n.contexte) : null);

export function creerCoquille({
  racine, mode = 'preparer', donnees, scene = null, bouton = null, surNavigation = null, pastille = null,
  inspecteurToujoursVisible = mode === 'jouer', inspecteurGenerique = mode !== 'jouer', adresse = mode !== 'jouer', affichage = null,
} = {}) {
  racine.dataset.atelier = mode;
  let pos = {};
  let sel = null;
  let arbre = null;
  let derniereRoute = null;
  let declencheur = null;
  const ecouteursSelection = [];
  const actionsArbre = [];

  // --- Colonne de gauche : l'arbre ---------------------------------------------------------------------------------
  const vue = creerArbreVue({ mode, pastille: pastille ? (n) => pastille(n) : null, surChoix: (n) => { naviguer(routeDuNoeud(n)); if (telephone()) fermerTiroir({ rendreFocus: false }); } });
  const replier = h('button', { type: 'button', className: 'btn btn-icone btn-discret atelier-replier', 'aria-label': 'Replier l’arbre', title: 'Replier l’arbre : la carte prend la place' }, icone('chevron-gauche'));
  const fermer = h('button', { type: 'button', className: 'btn btn-icone btn-discret atelier-fermer-tiroir', 'aria-label': 'Fermer l’arbre', title: 'Fermer l’arbre' }, icone('fermer'));
  const menuCorps = h('div', { className: 'atelier-menu-corps' });
  const menu = h('details', { className: 'atelier-menu', hidden: true },
    h('summary', { className: 'btn btn-discret atelier-menu-bouton', title: 'Créer un lieu, un monde ou un donjon, importer un fichier, coller un donjon' }, icone('plus'), 'Nouveau'), menuCorps);
  const toutReplier = h('button', { type: 'button', className: 'btn btn-icone btn-discret atelier-tout-replier', 'aria-label': 'Tout replier', title: 'Tout replier : seules les têtes de l’arbre restent' }, icone('tout-replier'));
  toutReplier.addEventListener('click', () => vue.toutReplier());
  const tete = h('div', { className: 'atelier-arbre-tete' }, h('h2', { className: 'atelier-arbre-titre', textContent: mode === 'jouer' ? 'La table' : 'L’atelier' }), toutReplier, menu, replier, fermer);
  const colonneArbre = h('aside', { className: 'atelier-arbre', 'aria-label': 'Arbre : monde, lieux, donjons, salles' }, tete, vue.element);
  const voile = h('div', { className: 'atelier-voile', hidden: true });

  // Le menu « + Nouveau » : des groupes titrés, dans l'ordre de l'arbre (le monde avant le donjon), quel que soit l'ordre d'inscription.
  const GROUPES = [['creer', 'Créer'], ['apporter', 'Apporter'], ['signal', null]];
  function majMenu() {
    menu.hidden = actionsArbre.length === 0;
    const blocs = GROUPES.map(([id, titre]) => {
      const actions = actionsArbre.filter((a) => (a.groupe ?? 'creer') === id && (a.visible?.() ?? true)).sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
      if (!actions.length) return null;
      return [...(titre ? [h('p', { className: 'atelier-menu-groupe', textContent: titre })] : []), ...actions.map((a) => {
        const b = h('button', { type: 'button', className: `btn ${a.danger ? 'btn-danger' : 'btn-discret'} atelier-menu-item`, ...(a.aide ? { 'aria-label': a.aide, title: a.aide } : {}) }, ...(a.icone ? [icone(a.icone)] : []), typeof a.libelle === 'function' ? a.libelle() : a.libelle);
        b.addEventListener('click', () => { menu.open = false; a.executer(); });
        return b;
      })];
    }).filter(Boolean);
    menuCorps.replaceChildren(...blocs.flatMap((bloc, i) => (i ? [h('hr', { className: 'atelier-menu-separateur' }), ...bloc] : bloc)));
  }
  /**
   * Une entrée du menu « + Nouveau » de l'en-tête de l'arbre. `groupe` : 'creer' (défaut), 'apporter' ou 'signal' (sans titre, en dernier) ;
   * `ordre` range les entrées d'un groupe ; `libelle` peut être une fonction et `visible` une fonction (recalculées à l'ouverture du menu) ; `aide` sert d'étiquette accessible quand le libellé seul est trop court (« Monde » sous « Créer »).
   */
  function ajouterAction(a) { actionsArbre.push(a); majMenu(); }
  menu.addEventListener('toggle', () => { if (menu.open) majMenu(); }); // les entrées qui dépendent de la sélection (« Lieu dans… ») se recalculent à l'ouverture
  // Un clic ailleurs referme le menu ; Échap aussi (plus bas, avec le tiroir), et rend le focus au bouton.
  document.addEventListener('click', (e) => { if (menu.open && !menu.contains(e.target)) menu.open = false; });

  // --- Colonne de droite : l'inspecteur ----------------------------------------------------------------------------
  const colonneInspecteur = h('aside', { className: `atelier-inspecteur${inspecteurGenerique ? '' : ' sans-generique'}`, 'aria-label': 'Inspecteur : la sélection', hidden: !inspecteurToujoursVisible });
  if (inspecteurToujoursVisible) document.body.classList.add('atelier-avec-inspecteur');
  const plier = h('button', { type: 'button', className: 'btn btn-icone btn-discret atelier-inspecteur-plier', 'aria-label': 'Replier le panneau', 'aria-expanded': 'true', title: 'Replier le panneau : la carte reste visible' }, icone('chevron-bas'));
  colonneInspecteur.append(plier);
  plier.addEventListener('click', () => {
    const replie = colonneInspecteur.classList.toggle('replie');
    plier.setAttribute('aria-expanded', String(!replie));
  });
  const inspecteur = creerInspecteur({
    racine: colonneInspecteur,
    ctx: () => ({ coquille, ...(donnees?.() ?? {}), position: pos }),
    parDefaut: () => (arbre?.actif?.cle ? selectionDuNoeud(noeudParCle(arbre, arbre.actif.cle)) : null),
  });
  const appliquerInspecteur = () => {
    const type = inspecteur.afficher(sel);
    if (!inspecteurToujoursVisible) {
      colonneInspecteur.hidden = type === null;
      document.body.classList.toggle('atelier-avec-inspecteur', type !== null);
    }
    return type;
  };

  // --- Centre : scène et barre d'outils ----------------------------------------------------------------------------
  const barreOutils = h('div', { className: 'atelier-barre', role: 'toolbar', 'aria-label': 'Outils de la scène' });
  const sceneEl = scene ?? h('div', { className: 'atelier-scene' });
  sceneEl.prepend(barreOutils);
  // Le bouton « Affichage » : la préférence d'affichage commune (js/atelier/affichage-popover.js). `affichage: { lire, surChangement }` ; absent, pas de bouton.
  const affichagePopover = affichage ? creerAffichagePopover(affichage) : null;
  // Le bout droit de la ligne : « Affichage », puis ce que la page y range (le bouton doré « Jouer »).
  const barreFin = h('div', { className: 'atelier-barre-fin' });
  barreOutils.append(barreFin);
  if (affichagePopover) barreFin.append(affichagePopover.elementGrille, affichagePopover.element);

  racine.prepend(colonneArbre, voile);
  racine.append(colonneInspecteur);

  // --- Onglets de l'inspecteur (mode jouer) ------------------------------------------------------------------------
  const onglets = (() => {
    const liste = h('div', { className: 'atelier-onglets', role: 'tablist', 'aria-label': 'Panneaux' });
    const panneaux = new Map();
    let courant = null;
    function choisir(id) {
      if (!panneaux.has(id)) return;
      courant = id;
      for (const [cle, p] of panneaux) {
        p.bouton.setAttribute('aria-selected', String(cle === id));
        p.bouton.tabIndex = cle === id ? 0 : -1;
        p.contenu.hidden = cle !== id;
      }
    }
    function ajouter({ id, libelle, contenu }) {
      const b = h('button', { type: 'button', role: 'tab', className: 'btn btn-discret atelier-onglet', textContent: libelle, id: `atelier-onglet-${id}` });
      b.addEventListener('click', () => choisir(id));
      contenu.setAttribute('role', 'tabpanel');
      contenu.setAttribute('aria-labelledby', b.id);
      panneaux.set(id, { bouton: b, contenu });
      liste.append(b);
      colonneInspecteur.append(contenu);
      if (mode === 'jouer') colonneInspecteur.prepend(liste);
      choisir(courant ?? id);
    }
    liste.addEventListener('keydown', (e) => {
      const ids = [...panneaux.keys()];
      const i = ids.indexOf(courant);
      const va = e.key === 'ArrowRight' ? ids[(i + 1) % ids.length] : e.key === 'ArrowLeft' ? ids[(i - 1 + ids.length) % ids.length] : null;
      if (!va) return;
      e.preventDefault(); choisir(va); panneaux.get(va).bouton.focus();
    });
    return { ajouter, choisir, courant: () => courant, element: liste };
  })();

  // --- Données, position, adresse ----------------------------------------------------------------------------------
  const etatDonnees = () => { const d = donnees?.() ?? {}; return { univers: d.univers ?? {}, donjons: d.donjons ?? {}, donjonActif: d.donjonActif ?? null, mondeActif: d.mondeActif ?? null }; };

  function calculer() {
    const d = etatDonnees();
    arbre = arbreAtelier({ univers: d.univers, donjons: d.donjons, actif: pos });
    return d;
  }

  const routeDuNoeud = (n) => routeDe(n.contexte);

  /** Écrit l'adresse (remplace l'entrée d'historique : les retours du navigateur ne se remplissent pas de salles) et marque la barre. */
  function ecrireAdresse() {
    const route = routeDe(pos);
    const hash = ecrireRoute(route);
    if (pos.monde === undefined && pos.donjon === undefined) return; // rien de précis : on ne force pas d'adresse
    if (location.hash !== hash) history.replaceState(null, '', `${location.pathname}${location.search}${hash}`);
    derniereRoute = route;
    if (hash) ecrire(CLE_DERNIERE_ROUTE, hash); // le lien « Préparer » de la barre rouvre cet élément
    marquerCourant();
  }

  /** Redessine l'arbre ; rend faux si rien n'avait changé (mêmes nœuds, mêmes noms, même nœud actif, mêmes pastilles) et que rien n'a été fait. */
  let signature = '';
  function peindre({ force = false } = {}) {
    const s = `${arbre.actif?.cle}\n${[...parcourir(arbre)].map((n) => `${n.cle}|${n.nom}|${n.depart ? 'D' : ''}${n.nonRelie ? 'N' : ''}${n.racine ?? ''}|${(n.aussiDepuis ?? []).join(',')}|${pastille && n.type !== 'groupe' ? pastille(n) : ''}`).join('\n')}`;
    if (!force && s === signature) return false;
    signature = s;
    vue.maj({ arbre });
    return true;
  }

  function repeindre() {
    peindre({ force: true });
    const valide = !sel || selectionValide(sel, etatDonnees());
    if (!valide) sel = null;
    appliquerInspecteur();
  }

  function definirPosition(p) {
    const d = etatDonnees();
    const a = arbreAtelier({ univers: d.univers, donjons: d.donjons, actif: p });
    const noeud = a.actif.cle ? noeudParCle(a, a.actif.cle) : null;
    pos = noeud ? { ...noeud.contexte } : {};
    arbre = a;
    return noeud;
  }

  /** La sélection devient le nœud de la position, sauf si la sélection en cours est plus précise (un élément de cette salle). */
  function suivreNoeud(noeud) {
    const nouvelle = selectionDuNoeud(noeud);
    if (sel && ['porte', 'objet', 'creature', 'pion'].includes(sel.type) && noeud?.type === 'salle' && meme(creerSelection('salle', sel.contexte?.salle, sel.contexte), nouvelle)) return;
    if (!meme(sel, nouvelle)) selectionnerInterne(nouvelle);
  }

  function selectionnerInterne(s) {
    sel = s;
    appliquerInspecteur();
    for (const f of ecouteursSelection) f(sel);
  }

  /**
   * Va quelque part. `route` : { page, monde?, lieu?, donjon?, salle? } (ce que rend `lireRoute`). Une route périmée retombe sur le niveau
   * au-dessus (puis sur le donjon actif) sans erreur. `surNavigation(routeEffective, noeud)` change la scène.
   */
  function naviguer(route, { ecrireHash = adresse } = {}) {
    const d = etatDonnees();
    let demande = route?.page === 'monde' ? { monde: route.monde ?? d.mondeActif ?? undefined, lieu: route.lieu } : { donjon: route?.donjon, salle: route?.salle };
    if (route?.page !== 'monde' && !route?.donjon && d.donjonActif) demande = { ...d.donjonActif };
    let noeud = definirPosition(demande);
    if (!noeud && route?.page === 'monde') noeud = definirPosition({ monde: Object.keys(d.univers)[0] });
    if (!noeud && d.donjonActif) noeud = definirPosition(d.donjonActif);
    const effective = routeDe(pos);
    if (route?.page === 'monde' && !effective.monde) effective.page = 'monde';
    peindre();
    suivreNoeud(noeud);
    surNavigation?.(effective, noeud);
    if (ecrireHash) ecrireAdresse();
    return noeud;
  }

  /** La scène a changé d'elle-même : l'arbre, la sélection et l'adresse suivent, sans rappeler `surNavigation`. */
  function positionner(p, { ecrireHash = adresse } = {}) {
    const avant = JSON.stringify(pos);
    const noeud = definirPosition(p);
    peindre();
    if (JSON.stringify(pos) !== avant || !sel) suivreNoeud(noeud);
    if (ecrireHash) ecrireAdresse();
  }

  /**
   * Les données ont changé (frappe, salle ajoutée ou renommée, donjon importé…). L'arbre n'est redessiné que si ses nœuds ou leurs noms
   * ont changé ; l'inspecteur seulement si la sélection n'existe plus, ou si `inspecteur: true` (jamais à chaque frappe : le champ perdrait le focus).
   */
  function rafraichir({ inspecteur: aussi = false } = {}) {
    calculer();
    peindre();
    if (sel && !selectionValide(sel, etatDonnees())) { sel = null; appliquerInspecteur(); for (const f of ecouteursSelection) f(sel); } else if (aussi) appliquerInspecteur();
  }

  function selectionner(s) {
    selectionnerInterne(s ?? null);
  }

  // --- Tiroir (sous 760 px) et repli (ordinateur) ------------------------------------------------------------------
  function ouvrirTiroir() {
    declencheur = document.activeElement;
    colonneArbre.classList.add('ouvert');
    voile.hidden = false;
    bouton?.setAttribute('aria-expanded', 'true');
    vue.focus();
  }
  function fermerTiroir({ rendreFocus = true } = {}) {
    colonneArbre.classList.remove('ouvert');
    voile.hidden = true;
    bouton?.setAttribute('aria-expanded', 'false');
    if (rendreFocus && declencheur?.isConnected) declencheur.focus();
    declencheur = null;
  }
  const tiroirOuvert = () => colonneArbre.classList.contains('ouvert');
  function appliquerRepli(replie) {
    document.body.classList.toggle('arbre-replie', replie);
    bouton?.setAttribute('aria-expanded', String(!replie));
    ecrire(CLE_ARBRE_REPLIE, replie ? '1' : '0');
  }
  const replie = () => document.body.classList.contains('arbre-replie');
  voile.addEventListener('click', () => fermerTiroir());
  fermer.addEventListener('click', () => fermerTiroir());
  replier.addEventListener('click', () => { appliquerRepli(true); bouton?.focus(); });
  bouton?.addEventListener('click', () => {
    if (telephone()) { if (tiroirOuvert()) fermerTiroir(); else ouvrirTiroir(); } else { appliquerRepli(!replie()); if (!replie()) vue.focus(); }
  });
  if (lire(CLE_ARBRE_REPLIE) === '1') document.body.classList.add('arbre-replie');
  bouton?.setAttribute('aria-expanded', String(!replie()));
  bouton?.setAttribute('aria-controls', 'atelier-arbre');
  colonneArbre.id = 'atelier-arbre';
  matchMedia('(max-width: 760px)').addEventListener('change', () => fermerTiroir({ rendreFocus: false }));

  // Échap ferme le tiroir (puis le panneau bas) avant tout autre Échap de la page.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    if (menu.open) { e.preventDefault(); menu.open = false; menu.querySelector('summary').focus(); return; } // le menu « + Nouveau » d'abord, le tiroir ensuite
    if (tiroirOuvert()) { e.preventDefault(); fermerTiroir(); return; }
    if (telephone() && !colonneInspecteur.hidden && !colonneInspecteur.classList.contains('replie') && colonneInspecteur.contains(document.activeElement)) {
      e.preventDefault(); plier.click(); plier.focus();
    }
  }, true);

  // --- Adresse : lue au chargement par l'appelant (`naviguer(lireRoute(location.hash))`), et sur hashchange ------------
  if (adresse) addEventListener('hashchange', () => {
    const route = lireRoute(location.hash);
    if (derniereRoute && memeRoute(route, derniereRoute)) return; // nous l'avons écrite nous-mêmes
    naviguer(route, { ecrireHash: false });
    derniereRoute = routeDe(pos);
    marquerCourant();
  });

  const coquille = {
    arbre: { element: colonneArbre, ajouterAction, rafraichir, vue }, scene: sceneEl, barreOutils, barreFin, inspecteur, onglets,
    selectionner, selection: () => sel, naviguer, positionner, position: () => ({ ...pos }), rafraichir,
    surSelection: (f) => { ecouteursSelection.push(f); },
    ouvrirTiroir, fermerTiroir, tiroirOuvert, mode, affichage: affichagePopover,
    donneesArbre: () => arbre,
  };
  calculer();
  repeindre();
  return coquille;
}
