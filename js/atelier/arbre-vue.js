/**
 * Le rendu DOM de l'arbre unifié de l'atelier (l'arbre lui-même vient de js/atelier-arbre.js, pur) : monde → lieux → donjons → salles,
 * puis « Donjons hors monde ». Éditable (mode 'preparer') ou en lecture avec pastilles (mode 'jouer' : `pastille(noeud)` rend
 * 'table' | 'decouvert' | 'cache').
 * Rôle `tree` : flèches haut/bas, droite/gauche (déplier/replier, changer de niveau), Début/Fin, Entrée ou Espace pour choisir.
 * Les branches se plient ; les salles d'un donjon replié ne sont pas rendues (gros donjons générés) avant son ouverture.
 * Renvoie `{ element, maj({ arbre, actifCle, filtre? }), definirVignette(f), definirAjout(f), toutReplier(), focus(), filtre }`.
 */
import { h } from '../dom.js';
import { icone } from '../icones.js';
import { filtrerAtelier, parcourir } from '../atelier-arbre.js';

const SEUIL_FILTRE = 12; // au-delà de ce nombre de nœuds, un champ de filtre apparaît
const ICONE = { monde: 'monde', lieu: 'monde', donjon: 'donjon', salle: 'donjon', groupe: 'donjon' };
const LIBELLE_PASTILLE = { table: 'à la table', decouvert: 'découvert', cache: 'pas encore montré' };

/**
 * @param {{ mode?: 'preparer'|'jouer', surChoix: (noeud) => void, pastille?: (noeud) => string, titre?: string }} options
 *   surChoix : appelé quand on choisit un nœud (clic, Entrée) ; un groupe (« hors monde ») ne se choisit pas, il se plie.
 */
export function creerArbreVue({ mode = 'preparer', surChoix, pastille = null, titre = 'Arbre de l’atelier' } = {}) {
  // Les nœuds dépliés / repliés par le MJ, gardés le temps de la session (sessionStorage, par clé de nœud et par mode).
  const CLE_PLIS = `carte-de-mj:atelier-arbre-plis:${mode}`;
  const lirePlis = () => { try { const p = JSON.parse(sessionStorage.getItem(CLE_PLIS)); return { o: Array.isArray(p?.o) ? p.o : [], f: Array.isArray(p?.f) ? p.f : [] }; } catch { return { o: [], f: [] }; } };
  const plisLus = lirePlis();
  const ouverts = new Set(plisLus.o); // clés dépliées par le MJ (en plus des défauts)
  const fermes = new Set(plisLus.f);  // clés repliées par le MJ
  const garderPlis = () => { try { sessionStorage.setItem(CLE_PLIS, JSON.stringify({ o: [...ouverts], f: [...fermes] })); } catch { /* stockage indisponible : les plis ne durent que cette page */ } };
  let donnees = { arbre: null, actifCle: null };
  let filtreTexte = '';
  let vignette = null; // (noeud) → élément qui remplace l'icône du nœud (l'image d'un lieu), ou null : voir `definirVignette`
  let ajoutDe = null;  // (noeud) → { libelle, executer } pour une ligne « + … » en fin de branche (mode 'preparer'), ou null : voir `definirAjout`

  const filtre = h('input', { type: 'search', className: 'atelier-arbre-filtre', placeholder: 'Filtrer…', 'aria-label': 'Filtrer l’arbre', spellcheck: false, hidden: true });
  const liste = h('ul', { className: 'atelier-arbre-liste', role: 'tree', 'aria-label': titre });
  const vide = h('p', { className: 'note', hidden: true });
  const element = h('div', { className: 'atelier-arbre-vue' }, filtre, liste, vide);

  /** Un nœud est-il déplié ? Défaut : tout sauf les donjons (leurs salles se montrent à l'ouverture), sauf les ancêtres du nœud actif. */
  const deplie = (n, forcer, ancetres) => {
    if (forcer) return true;
    if (fermes.has(n.cle)) return false;
    if (ouverts.has(n.cle) || ancetres.has(n.cle)) return true;
    return n.type !== 'donjon';
  };

  /** La ligne discrète « + Ajouter un lieu » en fin de branche : un treeitem comme les autres (flèches, Entrée), qui agit au lieu d'aller quelque part. */
  function ligneAjout(n, a, niveau) {
    const li = h('li', { role: 'treeitem', className: 'atelier-noeud type-ajout' });
    li.dataset.cle = `${n.cle}:ajout`;
    li.tabIndex = -1;
    li.setAttribute('aria-level', String(niveau));
    const ligne = h('div', { className: 'atelier-ligne', title: `${a.libelle} à ${n.nom}` },
      h('span', { className: 'atelier-bascule vide', 'aria-hidden': 'true' }), h('span', { className: 'atelier-icone', 'aria-hidden': 'true' }, icone('plus')),
      h('span', { className: 'atelier-noeud-texte' }, h('span', { className: 'atelier-noeud-nom', textContent: a.libelle })));
    ligne.addEventListener('click', () => { li.focus({ preventScroll: true }); a.executer(); });
    li.append(ligne);
    return li;
  }

  function noeud(n, niveau, forcer, ancetres) {
    const ajout = mode === 'preparer' && !forcer ? ajoutDe?.(n) ?? null : null; // pas pendant un filtre : on cherche, on n'ajoute pas
    const aEnfants = n.enfants.length > 0 || !!ajout;
    const ouvert = aEnfants && deplie(n, forcer, ancetres);
    const courant = n.cle === donnees.actifCle;
    const li = h('li', { role: 'treeitem', className: `atelier-noeud type-${n.type}${courant ? ' courant' : ''}` });
    li.dataset.cle = n.cle;
    li.tabIndex = -1;
    li.setAttribute('aria-level', String(niveau));
    if (aEnfants) li.setAttribute('aria-expanded', String(ouvert));
    if (n.type !== 'groupe') li.setAttribute('aria-selected', String(courant));
    const bascule = h('span', { className: `atelier-bascule${aEnfants ? '' : ' vide'}${aEnfants && !ouvert ? ' replie' : ''}`, 'aria-hidden': 'true' }, aEnfants ? h('span', { className: 'atelier-chevron' }) : '');
    const texte = h('span', { className: 'atelier-noeud-texte' }, h('span', { className: 'atelier-noeud-nom', textContent: n.nom, title: n.nom }));
    if (n.aussiDepuis?.length) {
      const m = `aussi depuis ${n.aussiDepuis.join(', ')}`;
      texte.append(h('span', { className: 'doux atelier-noeud-aussi', textContent: m, title: m }));
    }
    const image = vignette?.(n) ?? null;
    const ligne = h('div', { className: 'atelier-ligne', title: [n.nom, ...(n.aussiDepuis?.length ? [`aussi depuis ${n.aussiDepuis.join(', ')}`] : [])].join(' · ') }, bascule, image ?? h('span', { className: 'atelier-icone', 'aria-hidden': 'true' }, icone(ICONE[n.type] ?? 'donjon')), texte);
    if (n.depart) ligne.append(h('span', { className: 'atelier-badge', textContent: 'départ', title: 'Lieu de départ du monde' }));
    if (n.nonRelie) ligne.append(h('span', { className: 'atelier-badge discret', textContent: 'non relié', title: 'Aucun chemin depuis le lieu de départ' }));
    if (mode === 'jouer' && pastille && n.type !== 'groupe') {
      const etat = pastille(n);
      ligne.append(h('span', { className: `atelier-pastille ${etat}`, title: LIBELLE_PASTILLE[etat] ?? '', 'aria-label': LIBELLE_PASTILLE[etat] ?? '' }));
    }
    li.append(ligne);
    ligne.addEventListener('click', (e) => {
      li.focus({ preventScroll: true });
      if ((bascule.contains(e.target) || n.type === 'groupe') && aEnfants) basculer(n.cle, !ouvert); // `basculer(cle, ouvrir)`
      else if (n.type !== 'groupe') surChoix(n);
    });
    if (ouvert) li.append(h('ul', { role: 'group' }, ...n.enfants.map((e) => noeud(e, niveau + 1, forcer, ancetres)), ...(ajout ? [ligneAjout(n, ajout, niveau + 1)] : [])));
    return li;
  }

  function basculer(cle, ouvrir) {
    if (ouvrir) { fermes.delete(cle); ouverts.add(cle); } else { ouverts.delete(cle); fermes.add(cle); }
    garderPlis();
    dessiner(cle);
  }

  /** Replie toutes les branches (le MJ rouvre ce qu'il veut ; aller quelque part déplie le chemin). */
  function toutReplier() {
    ouverts.clear();
    if (donnees.arbre) for (const n of parcourir(donnees.arbre)) if (n.enfants?.length) fermes.add(n.cle);
    garderPlis();
    dessiner();
  }

  const visibles = () => [...liste.querySelectorAll('[role="treeitem"]')];

  function dessiner(cleFocus = null) {
    const { arbre } = donnees;
    if (!arbre) { liste.replaceChildren(); return; }
    const focusAvant = liste.contains(document.activeElement) ? document.activeElement.closest('[role="treeitem"]')?.dataset.cle : null;
    const garde = cleFocus ?? focusAvant; // la ligne qui avait le focus le garde après le redessin
    const total = [...parcourir(arbre)].length;
    filtre.hidden = total <= SEUIL_FILTRE && !filtreTexte;
    const forcer = !!filtreTexte.trim();
    const vue = filtrerAtelier(arbre, filtreTexte);
    const ancetres = new Set([...(arbre.actif?.chemin ?? []), ...(arbre.actif?.cle ? [arbre.actif.cle] : [])]); // le donjon choisi montre ses salles
    const tetes = [...vue.mondes.map((m) => noeud(m, 1, forcer, ancetres))];
    if (vue.horsMonde.enfants.length) tetes.push(noeud(vue.horsMonde, 1, forcer, ancetres));
    liste.replaceChildren(...tetes);
    vide.hidden = tetes.length > 0;
    vide.textContent = total > 1 || filtreTexte ? 'Rien ne correspond.' : 'Rien ici pour l’instant.';
    const tous = visibles();
    const cible = (garde && tous.find((li) => li.dataset.cle === garde)) || liste.querySelector('.courant') || tous[0];
    tous.forEach((li) => { li.tabIndex = li === cible ? 0 : -1; });
    if (garde && cible?.dataset.cle === garde) cible.focus({ preventScroll: true });
    liste.querySelector('.courant')?.scrollIntoView?.({ block: 'nearest' });
  }

  filtre.addEventListener('input', () => { filtreTexte = filtre.value; dessiner(); });
  filtre.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && filtre.value) { e.stopPropagation(); e.preventDefault(); filtre.value = ''; filtreTexte = ''; dessiner(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); (liste.querySelector('.courant') ?? visibles()[0])?.focus(); }
  });

  liste.addEventListener('keydown', (e) => {
    const li = e.target.closest?.('[role="treeitem"]');
    if (!li || e.target !== li) return;
    const tous = visibles();
    const i = tous.indexOf(li);
    const aller = (cible) => { if (!cible) return; tous.forEach((x) => { x.tabIndex = x === cible ? 0 : -1; }); cible.focus(); };
    const ouvert = li.getAttribute('aria-expanded');
    switch (e.key) {
      case 'ArrowDown': aller(tous[i + 1]); break;
      case 'ArrowUp': aller(tous[i - 1]); break;
      case 'Home': aller(tous[0]); break;
      case 'End': aller(tous.at(-1)); break;
      case 'ArrowRight':
        if (ouvert === 'false') basculer(li.dataset.cle, true); else if (ouvert === 'true') aller(li.querySelector('[role="treeitem"]'));
        break;
      case 'ArrowLeft':
        if (ouvert === 'true') basculer(li.dataset.cle, false); else aller(li.parentElement.closest('[role="treeitem"]'));
        break;
      case 'Enter': case ' ': li.firstElementChild.click(); break;
      default: return;
    }
    e.preventDefault();
  });

  /** `arbre` : le résultat d'`arbreAtelier` ; `actifCle` : le nœud à marquer (par défaut `arbre.actif.cle`). */
  function maj({ arbre, actifCle = arbre?.actif?.cle ?? null }) {
    // Aller vers un NOUVEAU nœud déplie son chemin ; un simple rafraîchissement (mêmes nœuds) ne défait jamais un pli du MJ.
    if (actifCle !== donnees.actifCle) { for (const cle of arbre?.actif?.chemin ?? []) fermes.delete(cle); garderPlis(); } // les ancêtres seulement : le nœud lui-même garde son pli
    donnees = { arbre, actifCle };
    dessiner();
  }

  /** `f(noeud)` rend une vignette (un élément) à la place de l'icône d'un nœud, ou null pour garder l'icône ; à redessiner ensuite avec `maj`. */
  function definirVignette(f) { vignette = f; if (donnees.arbre) dessiner(); }
  /** `f(noeud)` rend `{ libelle, executer }` pour finir la branche du nœud par une ligne d'ajout (« + Ajouter un lieu »), ou null ; mode 'preparer' seulement. */
  function definirAjout(f) { ajoutDe = f; if (donnees.arbre) dessiner(); }

  return { element, maj, definirVignette, definirAjout, toutReplier, focus: () => (liste.querySelector('.courant') ?? visibles()[0])?.focus({ preventScroll: true }), filtre };
}
