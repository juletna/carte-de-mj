/**
 * L'arbre unifié de l'atelier (module PUR, sans DOM) : monde → lieux → donjons → salles, puis le groupe « Donjons hors monde ».
 * Voir docs/conception-atelier.md §2. Il réutilise `arbreLieux` (js/univers-vue.js) pour les lieux et les feuilles donjon, et ajoute
 * sous chaque donjon ses salles, dans l'ordre du donjon.
 *
 * Nœud : { cle, type: 'monde'|'lieu'|'donjon'|'salle'|'groupe', id, nom, enfants, contexte, ... }
 *   - le nœud monde PORTE la carte du monde (le lieu racine) : il n'y a pas de nœud lieu pour la racine, ses enfants (lieux et donjons
 *     qu'elle relie) sont ceux du monde, suivis des lieux non reliés ; le nœud monde porte `racine` (l'identifiant de ce lieu, absent d'un monde
 *     sans carte) et choisir le monde ouvre cette carte. Une position { monde, lieu: racine } désigne donc le nœud monde ;
 *   - `cle` est stable (monde `m:<id>`, lieu `l:<monde>:<id>`, donjon `d:<lieu>:<id>` ou `d:<id>` hors monde, salle `s:<donjon>:<id>`,
 *     groupe `hors-monde`) ; `contexte` = le chemin { monde?, lieu?, donjon?, salle? } qui retrouve l'objet ;
 *   - un lieu porte `depart` (la partie y commence ; jamais sur la carte du monde, c'est le cas par défaut), `aussiDepuis`, `nonRelie` ; un donjon porte `aussiDepuis` (les autres lieux d'où l'on y va) et `salleVisee`
 *     (la salle d'arrivée du point, s'il en a une).
 * Un donjon n'apparaît qu'une fois dans tout l'arbre : sous le premier lieu qui y mène (dans l'ordre des mondes), les autres lieux
 * sont cités dans `aussiDepuis`. Un donjon qu'aucun point ne mène à lui va dans `horsMonde`.
 */
import { arbreLieux } from './univers-vue.js';

const nettoyer = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Les mondes en liste, qu'on donne un dictionnaire { id: univers } (le stockage), une liste ou un seul univers. */
export function listerMondes(univers) {
  if (!univers) return [];
  if (Array.isArray(univers)) return univers.filter(Boolean);
  if (univers.lieux && typeof univers.lieux === 'object') return [univers];
  return Object.values(univers).filter((u) => u && typeof u === 'object' && u.lieux);
}

/** Donjon avec ses salles (dans l'ordre du donjon, celui de `listerSalles`). `cle` : celle du nœud donjon. */
function completerDonjon(n, d, contexte) {
  n.contexte = contexte;
  n.enfants = Object.values(d?.salles ?? {}).map((s) => ({
    cle: `s:${n.cle.slice(2)}:${s.id}`, type: 'salle', id: s.id, nom: s.nom ?? s.id, enfants: [], contexte: { ...contexte, salle: s.id },
  }));
  return n;
}

/**
 * @param {{ univers: object|object[]|Record<string,object>, donjons: Record<string,object>, actif?: {monde?,lieu?,donjon?,salle?} }} p
 * @returns {{ mondes: object[], horsMonde: object, actif: { cle: string|null, chemin: string[] } }}
 *   `actif` : la clé du nœud le plus précis désigné par `p.actif` (null s'il n'existe plus) et les clés de ses ancêtres (à déplier).
 */
export function arbreAtelier({ univers, donjons = {}, actif = {} } = {}) {
  const places = new Map(); // idDonjon → nœud placé (pour y noter les autres lieux d'où l'on y va)
  const mondes = listerMondes(univers).map((u) => {
    const { racine, nonRelies } = arbreLieux(u, donjons);
    const contexteMonde = { monde: u.id };
    const lieux = [racine, ...nonRelies].filter(Boolean);
    if (racine) racine.depart = false; // la carte du monde est le nœud monde : le badge « départ » ne marque qu'un autre lieu
    // Clés et contextes d'abord, puis les donjons par lieu en largeur : le donjon reste sous le lieu le plus proche de la racine.
    const habiller = (n) => { n.cle = `l:${u.id}:${n.id}`; n.contexte = { ...contexteMonde, lieu: n.id }; n.enfants.filter((e) => e.type === 'lieu').forEach(habiller); };
    lieux.forEach(habiller);
    const file = [...lieux];
    for (let i = 0; i < file.length; i++) {
      const lieu = file[i];
      file.push(...lieu.enfants.filter((e) => e.type === 'lieu'));
      lieu.enfants = lieu.enfants.map((e) => {
        if (e.type === 'lieu') return e;
        const dejaPlace = places.get(e.id);
        if (dejaPlace) { if (!dejaPlace.aussiDepuis.includes(lieu.nom)) dejaPlace.aussiDepuis.push(lieu.nom); return null; }
        const { salle, lieu: _lieu, chemin: _chemin, ...reste } = e;
        const d = { ...reste, cle: `d:${lieu.id}:${e.id}`, ...(salle ? { salleVisee: salle } : {}) };
        places.set(e.id, d);
        return completerDonjon(d, donjons[e.id], { ...contexteMonde, lieu: lieu.id, donjon: e.id });
      }).filter(Boolean);
    }
    for (const l of nonRelies) l.nonRelie = true;
    const enfants = [...(racine?.enfants ?? []), ...nonRelies];
    return { cle: `m:${u.id}`, type: 'monde', id: u.id, nom: u.nom ?? u.id, ...(racine ? { racine: racine.id } : {}), enfants, contexte: contexteMonde };
  });
  const horsMonde = {
    cle: 'hors-monde', type: 'groupe', id: 'hors-monde', nom: 'Donjons hors monde', contexte: {},
    enfants: Object.values(donjons).filter((d) => d && !places.has(d.id)).map((d) => completerDonjon(
      { cle: `d:${d.id}`, type: 'donjon', id: d.id, nom: d.nom ?? d.id, aussiDepuis: [], enfants: [] }, d, { donjon: d.id })),
  };
  const arbre = { mondes, horsMonde };
  arbre.actif = trouverActif(arbre, actif);
  return arbre;
}

/** Tous les nœuds, en profondeur d'abord. */
export function* parcourir(arbre) {
  function* visite(n) { yield n; for (const e of n.enfants) yield* visite(e); }
  for (const m of arbre.mondes) yield* visite(m);
  yield* visite(arbre.horsMonde);
}

/** Le nœud d'une clé, ou null. */
export function noeudParCle(arbre, cle) {
  for (const n of parcourir(arbre)) if (n.cle === cle) return n;
  return null;
}

/**
 * Le nœud le plus précis que désigne `ctx` ({ monde?, lieu?, donjon?, salle? }), avec les clés de ses ancêtres ; ce qui n'existe plus
 * est ignoré (on retombe sur le niveau au-dessus). Un donjon relié est cherché sous le lieu cité, sinon là où il se trouve.
 */
export function trouverActif(arbre, ctx = {}) {
  const chemins = [];
  const descend = (n, chemin) => { chemins.push({ n, chemin }); for (const e of n.enfants) descend(e, [...chemin, n.cle]); };
  for (const m of arbre.mondes) descend(m, []);
  descend(arbre.horsMonde, []);
  const cherche = (pred) => chemins.find(({ n }) => pred(n));
  let trouve = null;
  if (ctx.donjon) {
    const d = cherche((n) => n.type === 'donjon' && n.id === ctx.donjon && ctx.lieu && n.contexte.lieu === ctx.lieu)
      || cherche((n) => n.type === 'donjon' && n.id === ctx.donjon);
    if (d) {
      const s = ctx.salle && d.n.enfants.find((e) => e.id === ctx.salle);
      trouve = s ? { n: s, chemin: [...d.chemin, d.n.cle] } : d;
    }
  }
  if (!trouve && ctx.lieu) {
    trouve = cherche((n) => n.type === 'lieu' && n.id === ctx.lieu && (!ctx.monde || n.contexte.monde === ctx.monde))
      || cherche((n) => n.type === 'monde' && n.racine === ctx.lieu && (!ctx.monde || n.id === ctx.monde)); // la carte du monde, c'est le nœud monde
  }
  if (!trouve && ctx.monde) trouve = cherche((n) => n.type === 'monde' && n.id === ctx.monde);
  return trouve ? { cle: trouve.n.cle, chemin: trouve.chemin } : { cle: null, chemin: [] };
}

/** Filtre l'arbre : ne garde que les nœuds (monde, lieu, donjon ou salle) dont le nom contient `texte` (sans accents ni casse) et leurs ancêtres. */
export function filtrerAtelier(arbre, texte) {
  const t = nettoyer(texte);
  if (!t) return arbre;
  const garde = (n) => {
    const enfants = n.enfants.map(garde).filter(Boolean);
    const trouve = nettoyer(n.nom).includes(t);
    return trouve || enfants.length ? { ...n, enfants, trouve } : null;
  };
  return { mondes: arbre.mondes.map(garde).filter(Boolean), horsMonde: garde(arbre.horsMonde) ?? { ...arbre.horsMonde, enfants: [] }, actif: arbre.actif };
}

/**
 * Mode jeu : la pastille d'un nœud, 'table' (c'est là que la table est), 'decouvert' (déjà montré) ou 'cache'.
 * `partie` : { univers?: partie d'univers (js/univers-partie.js), presentations?: { idDonjon: partie de donjon (js/partie.js) } }.
 */
export function etatJeu(noeud, partie = {}) {
  const pu = partie.univers ?? null;
  const pres = partie.presentations ?? {};
  switch (noeud.type) {
    case 'monde': // le nœud monde est aussi la carte du monde
      if (!pu || pu.univers !== noeud.id) return 'cache';
      if (noeud.racine && pu.lieuCourant === noeud.racine && !pu.dans) return 'table';
      return !noeud.racine || pu.decouverts?.includes(noeud.racine) ? 'decouvert' : 'cache';
    case 'lieu':
      if (!pu || pu.univers !== noeud.contexte.monde) return 'cache';
      if (pu.lieuCourant === noeud.id && !pu.dans) return 'table';
      return pu.decouverts?.includes(noeud.id) ? 'decouvert' : 'cache';
    case 'donjon':
      if (pu?.dans?.donjon === noeud.id) return 'table';
      return pres[noeud.id] ? 'decouvert' : 'cache';
    case 'salle': {
      const p = pres[noeud.contexte.donjon];
      if (!p) return 'cache';
      const iciLaTable = pu ? pu.dans?.donjon === noeud.contexte.donjon : true;
      if (p.salleCourante === noeud.id && iciLaTable) return 'table';
      return p.decouvertes?.includes(noeud.id) ? 'decouvert' : 'cache';
    }
    default: return 'cache';
  }
}
