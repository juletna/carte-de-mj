/**
 * Placement : transforme les intentions du parseur (« 4 piliers, zone
 * grille », « 1 statue devant la porte ») en coordonnées de cases.
 *
 * Conventions (voir aussi schema.js) :
 *  - x va de l'ouest (0) vers l'est, y du nord (0) vers le sud ;
 *    le nord est en haut de l'écran.
 *  - rotation = direction vers laquelle l'objet « regarde » :
 *    0 nord, 90 est, 180 sud, 270 ouest.
 *  - l'entrée est le mur de la première porte (sud par défaut) ;
 *    « le fond » est le mur opposé.
 */
import { definition, nomAffiche } from './lexique.js';

const OPPOSE = { nord: 'sud', sud: 'nord', est: 'ouest', ouest: 'est' };
// Vu depuis l'entrée en regardant le fond.
const GAUCHE = { sud: 'ouest', nord: 'est', est: 'sud', ouest: 'nord' };
const DROITE = { sud: 'est', nord: 'ouest', est: 'nord', ouest: 'sud' };
// Orientation d'un objet adossé à un mur : il regarde vers l'intérieur.
const FACE = { nord: 180, sud: 0, est: 270, ouest: 90 };
const VECTEUR = { 0: [0, -1], 90: [1, 0], 180: [0, 1], 270: [-1, 0] };
// Types qu'on écarte d'une case du mur quand la pièce est assez large.
const AU_LARGE = new Set(['pilier', 'colonne', 'statue']);

/**
 * Répartit n éléments de façon symétrique sur une ligne de `long` cases.
 * Ex. : repartir(2, 3) → [0, 2] ; repartir(1, 5) → [2].
 */
export function repartir(n, long) {
  const res = new Array(n);
  for (let i = 0; i < Math.ceil(n / 2); i++) {
    const a = Math.max(0, Math.round((i + 0.5) * long / n - 0.5));
    res[i] = a;
    res[n - 1 - i] = long - 1 - a;
  }
  if (n % 2) res[(n - 1) / 2] = Math.floor((long - 1) / 2);
  return res;
}

/** Comme repartir, mais en laissant de l'espace contre les bords si possible. */
export function repartirInterieur(n, long) {
  if (long < 2 * n + 1) return repartir(n, long);
  const res = new Array(n);
  for (let i = 0; i < Math.ceil(n / 2); i++) {
    const a = Math.round((i + 1) * (long - 1) / (n + 1));
    res[i] = a;
    res[n - 1 - i] = long - 1 - a;
  }
  if (n % 2) res[(n - 1) / 2] = Math.floor((long - 1) / 2);
  return res;
}

/** Grille d'occupation de la pièce. */
class Grille {
  constructor(W, L) {
    this.W = W; this.L = L;
    this.occupe = new Set();  // cases prises par un objet
    this.reserve = new Set(); // cases devant les portes : à laisser libres si possible
  }
  dedans(x, y, l, h) { return x >= 0 && y >= 0 && x + l <= this.W && y + h <= this.L; }
  libre(x, y, l, h, ignorerReserve) {
    if (!this.dedans(x, y, l, h)) return false;
    for (let i = x; i < x + l; i++) for (let j = y; j < y + h; j++) {
      const k = `${i},${j}`;
      if (this.occupe.has(k) || (!ignorerReserve && this.reserve.has(k))) return false;
    }
    return true;
  }
  occuper(x, y, l, h) {
    for (let i = x; i < x + l; i++) for (let j = y; j < y + h; j++) this.occupe.add(`${i},${j}`);
  }
  /** Case libre la plus proche de (x, y), en spirale. */
  chercher(x, y, l, h, ignorerReserve = false) {
    const max = Math.max(this.W, this.L);
    for (let d = 0; d <= max; d++) {
      const anneau = [];
      for (let i = x - d; i <= x + d; i++) for (let j = y - d; j <= y + d; j++) {
        if (Math.max(Math.abs(i - x), Math.abs(j - y)) === d) anneau.push([i, j]);
      }
      anneau.sort((a, b) => Math.hypot(a[0] - x, a[1] - y) - Math.hypot(b[0] - x, b[1] - y));
      for (const [i, j] of anneau) if (this.libre(i, j, l, h, ignorerReserve)) return [i, j];
    }
    return null;
  }
}

/** Générateur pseudo-aléatoire reproductible (mêmes débris pour la même phrase). */
function aleatoire(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Case intérieure juste devant une porte. */
function devantPorte(p, W, L) {
  if (p.mur === 'nord') return [p.position, 0];
  if (p.mur === 'sud') return [p.position, L - 1];
  if (p.mur === 'ouest') return [0, p.position];
  return [W - 1, p.position];
}

/**
 * Construit le plan à partir des intentions.
 * @param {{largeur:number, longueur:number, sol:string, intentions:object[], graine:number}} entree
 * @returns {{plan:object, journal:string[]}}
 */
export function construirePlan({ largeur: W, longueur: L, sol, intentions, graine = 1 }) {
  const g = new Grille(W, L);
  const journal = [];
  const plan = { version: 1, id: 'salle-1', nom: 'Salle', forme: 'rectangle', largeur: W, longueur: L, sol, portes: [], objets: [], creatures: [], connexions: [] };

  // ---- 1. Portes --------------------------------------------------------
  const intPortes = intentions.filter((i) => i.genre === 'porte');
  // Une porte citée comme repère (« devant une porte ») existe forcément.
  const ciblesPorte = intentions.filter((i) => i.position.cible?.genre === 'porte');
  if (!intPortes.length && ciblesPorte.length) {
    intPortes.push({ genre: 'porte', type: ciblesPorte[0].position.cible.type, n: 1, position: { zone: null }, implicite: true });
  }

  plan.entree = null; // renseigné juste après
  const murExplicite = intPortes.find((i) => i.position.zone === 'mur')?.position.mur;
  const entree = murExplicite || 'sud';
  plan.entree = entree;
  const fond = OPPOSE[entree];
  const ordreDefaut = [entree, fond, GAUCHE[entree], DROITE[entree]];

  const parMur = { nord: [], sud: [], est: [], ouest: [] };
  let defaut = 0;
  for (const it of intPortes) {
    for (let k = 0; k < it.n; k++) {
      const pos = it.position;
      let mur;
      if (pos.zone === 'mur') mur = pos.mur;
      else if (pos.zone === 'fond') mur = fond;
      else if (pos.zone === 'entree') mur = entree;
      else if (pos.zone === 'lateral') mur = (pos.cote === 'gauche' ? GAUCHE : DROITE)[entree];
      else mur = ordreDefaut[Math.min(defaut++, 3)];
      parMur[mur].push({ type: it.type, position: pos.positionMur }); // position : seulement si précisée
    }
  }
  for (const [mur, liste] of Object.entries(parMur)) {
    const long = mur === 'nord' || mur === 'sud' ? W : L;
    const ajouter = (position, type) => plan.portes.push({ id: `p${plan.portes.length + 1}`, mur, position, type });
    const prises = new Set();
    for (const d of liste.filter((e) => e.position !== undefined)) {
      const position = Math.min(long - 1, d.position);
      prises.add(position);
      ajouter(position, d.type);
    }
    // Les autres portes se répartissent sur ce mur, sans tomber sur une porte déjà placée.
    const libres = liste.filter((e) => e.position === undefined);
    repartir(libres.length, long).forEach((voulue, k) => {
      let position = voulue;
      while (prises.has(position) && position < long - 1) position++;
      prises.add(position);
      ajouter(position, libres[k].type);
    });
  }
  for (const p of plan.portes) {
    const [x, y] = devantPorte(p, W, L);
    g.reserve.add(`${x},${y}`);
  }
  if (plan.portes.length) {
    const resume = plan.portes.map((p) => `${p.type} (mur ${p.mur})`).join(', ');
    journal.push(`${plan.portes.length} porte${plan.portes.length > 1 ? 's' : ''} : ${resume}${intPortes[0]?.implicite ? ' — ajoutée car citée comme repère' : ''}`);
  }

  // ---- 2. Objets --------------------------------------------------------
  const rnd = aleatoire(graine);
  const fixes = new Set(); // créatures à la case imposée : elles gardent leur numéro
  const versEntree = (FACE[entree] + 180) % 360;

  /** Pose un objet au plus près de (x, y). Renvoie l'objet posé ou null. */
  function poser(def, x, y, l, h, rotation, ignorerReserve = false) {
    const bloquant = def.bloquant !== false;
    let c = [x, y];
    if (bloquant) c = g.chercher(Math.round(x), Math.round(y), l, h, ignorerReserve);
    if (!c) return null;
    return inscrire(def, c[0], c[1], l, h, rotation);
  }

  /** Ajoute l'objet ou la créature au plan, à cet endroit précis. */
  function inscrire(def, x, y, l, h, rotation) {
    const c = [x, y];
    if (def.bloquant !== false) g.occuper(c[0], c[1], l, h);
    if (def.genre === 'creature') {
      // Les pions sont numérotés par type (gobelin 1, gobelin 2…) pour que le MJ s'y retrouve.
      const numero = plan.creatures.filter((k) => k.type === def.type).length + 1;
      const k = { id: `c${plan.creatures.length + 1}`, type: def.type, camp: def.camp, x: c[0], y: c[1], taille: l, numero };
      if (def.couleur) k.couleur = def.couleur;
      plan.creatures.push(k);
      return k;
    }
    const o = { id: `o${plan.objets.length + 1}`, type: def.type, x: c[0], y: c[1], l, h, rotation };
    plan.objets.push(o);
    return o;
  }

  /** Aligne n objets contre un mur (le long côté de l'objet suit le mur). */
  function leLongDuMur(def, mur, n, l, h, retrait = 0) {
    const vertical = mur === 'est' || mur === 'ouest';
    const [ll, hh] = vertical ? [h, l] : [l, h];
    const span = (vertical ? L - hh : W - ll) + 1;
    return repartir(n, Math.max(1, span)).map((k) => {
      const x = mur === 'ouest' ? retrait : mur === 'est' ? W - ll - retrait : k;
      const y = mur === 'nord' ? retrait : mur === 'sud' ? L - hh - retrait : k;
      return poser(def, x, y, ll, hh, FACE[mur]);
    });
  }

  /** Coordonnées d'un coin donné par ses deux murs. */
  function coin([ns, eo], l, h) {
    return [eo === 'ouest' ? 0 : W - l, ns === 'nord' ? 0 : L - h];
  }

  /** Repère d'une relation : objet existant ou case devant une porte. */
  function repere(cible) {
    if (cible.genre === 'porte') {
      const p = plan.portes.find((q) => q.type === cible.type) || plan.portes[0];
      if (!p) return null;
      const [x, y] = devantPorte(p, W, L);
      return { x, y, l: 1, h: 1, rotation: FACE[p.mur], porte: true };
    }
    const objet = plan.objets.find((o) => o.type === cible.type);
    if (objet) return objet;
    const k = plan.creatures.find((c) => c.type === cible.type);
    return k ? { x: k.x, y: k.y, l: k.taille, h: k.taille, rotation: versEntree } : null;
  }

  const placeurs = {
    fond: (def, n, l, h) => leLongDuMur(def, fond, n, l, h),
    entree(def, n, l, h) {
      // Des créatures « à l'entrée » se regroupent autour de la porte, comme si elles venaient d'entrer.
      const porte = plan.portes.find((p) => p.mur === entree);
      if (def.genre !== 'creature' || !porte) return leLongDuMur(def, entree, n, l, h);
      const [x, y] = devantPorte(porte, W, L);
      return Array.from({ length: n }, () => poser(def, x - (entree === 'est' ? l - 1 : 0), y - (entree === 'sud' ? h - 1 : 0), l, h, FACE[entree], true));
    },
    mur: (def, n, l, h, pos) => leLongDuMur(def, pos.mur, n, l, h),
    lateral: (def, n, l, h, pos) => leLongDuMur(def, (pos.cote === 'gauche' ? GAUCHE : DROITE)[entree], n, l, h),

    centre(def, n, l, h) {
      const cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
      const ecart = W >= cols * (l + 1) + 1 && L >= rows * (h + 1) + 1 ? 1 : 0;
      const x0 = Math.floor((W - (cols * l + (cols - 1) * ecart)) / 2);
      const y0 = Math.floor((L - (rows * h + (rows - 1) * ecart)) / 2);
      const res = [];
      for (let k = 0; k < n; k++) {
        const r = Math.floor(k / cols), c = k % cols;
        // La dernière rangée, si elle est incomplète, est recentrée.
        const nbRang = r === rows - 1 ? n - cols * (rows - 1) : cols;
        const decal = ((cols - nbRang) * (l + ecart)) / 2;
        res.push(poser(def, Math.round(x0 + decal + c * (l + ecart)), y0 + r * (h + ecart), l, h, versEntree));
      }
      return res;
    },

    // Répartition régulière : deux rangées de part et d'une allée centrale
    // dans le sens de la longueur, ou une grille proportionnelle à la pièce.
    grille(def, n, l, h, pos) {
      if (n === 1) return placeurs.centre(def, n, l, h);
      if (n === 3 && !pos.colonnes) return placeurs.ligne(def, n, l, h);
      let cols, rows;
      if (pos.colonnes || (n % 2 === 0 && n <= 12)) {
        if (W >= L && !pos.colonnes) { rows = 2; cols = n / 2; } else { cols = 2; rows = Math.ceil(n / 2); }
      } else {
        cols = Math.min(n, Math.max(1, Math.round(Math.sqrt(n * W / L))));
        rows = Math.ceil(n / cols);
      }
      const ys = repartirInterieur(rows, L - h + 1);
      const res = [];
      for (let r = 0; r < rows; r++) {
        const nb = r === rows - 1 ? n - cols * (rows - 1) : cols;
        for (const x of repartirInterieur(nb, W - l + 1)) res.push(poser(def, x, ys[r], l, h, versEntree));
      }
      return res;
    },

    ligne(def, n, l, h) {
      if (L >= W) {
        const x = Math.floor((W - l) / 2);
        return repartirInterieur(n, L - h + 1).map((y) => poser(def, x, y, l, h, versEntree));
      }
      const y = Math.floor((L - h) / 2);
      return repartirInterieur(n, W - l + 1).map((x) => poser(def, x, y, l, h, versEntree));
    },

    cercle(def, n, l, h) {
      const cx = (W - l) / 2, cy = (L - h) / 2;
      const r = Math.max(1, Math.min(W - l, L - h) / 2 - 0.5);
      // Arrondi symétrique par rapport au centre (sinon le cercle penche).
      const arrondir = (c, d) => (d >= 0 ? Math.floor(c + d + 0.5) : Math.ceil(c + d - 0.5));
      return Array.from({ length: n }, (_, k) => {
        const a = (k / n) * 2 * Math.PI - Math.PI / 2;
        const dx = r * Math.cos(a), dy = r * Math.sin(a);
        return poser(def, arrondir(cx, Math.abs(dx) < 1e-9 ? 0 : dx), arrondir(cy, Math.abs(dy) < 1e-9 ? 0 : dy), l, h, versEntree);
      });
    },

    // Symétrique sur les deux murs latéraux (vu depuis l'entrée).
    cotes(def, n, l, h) {
      const murG = GAUCHE[entree], murD = DROITE[entree];
      const retrait = AU_LARGE.has(def.type) && Math.min(W, L) >= 5 ? 1 : 0;
      const k = Math.ceil(n / 2);
      return [...leLongDuMur(def, murG, k, l, h, retrait), ...leLongDuMur(def, murD, n - k, l, h, retrait)];
    },

    coins(def, n, l, h, pos) {
      // Coins du fond d'abord, puis ceux de l'entrée.
      let liste = [['nord', 'ouest'], ['nord', 'est'], ['sud', 'est'], ['sud', 'ouest']];
      liste.sort((a, b) => b.includes(fond) - a.includes(fond));
      if (pos.filtre === 'fond') liste = liste.filter((c) => c.includes(fond));
      if (pos.filtre === 'entree') liste = liste.filter((c) => c.includes(entree));
      return Array.from({ length: n }, (_, k) => {
        const [x, y] = coin(liste[k % liste.length], l, h);
        return poser(def, x, y, l, h, versEntree);
      });
    },

    coin(def, n, l, h, pos) {
      const [x, y] = coin(pos.coin, l, h);
      return Array.from({ length: n }, () => poser(def, x, y, l, h, versEntree));
    },

    'coin-relatif'(def, n, l, h, pos) {
      const murs = [pos.mur === 'fond' ? fond : entree, (pos.cote === 'gauche' ? GAUCHE : DROITE)[entree]];
      const ns = murs.find((m) => m === 'nord' || m === 'sud');
      const eo = murs.find((m) => m === 'est' || m === 'ouest');
      return placeurs.coin(def, n, l, h, { coin: [ns, eo] });
    },

    // Le long de tous les murs, régulièrement (torches, etc.).
    // Le tour commence au milieu du mur nord pour que le résultat soit symétrique.
    // Les objets vont par paires sur des murs opposés, pour rester symétriques ;
    // un éventuel objet impair va au milieu du fond.
    perimetre(def, n, l, h) {
      const paires = Math.floor(n / 2);
      const pLat = Math.round(paires * L / (W + L));
      const pNS = paires - pLat;
      const res = [];
      const surMur = (mur, k) => {
        const long = mur === 'nord' || mur === 'sud' ? W : L;
        const portes = plan.portes.filter((p) => p.mur === mur).map((p) => p.position);
        for (let pos of repartirInterieur(k, long)) {
          if (portes.includes(pos)) pos = Math.min(long - 1, pos + 1); // pas sur une porte
          const x = mur === 'ouest' ? 0 : mur === 'est' ? W - 1 : pos;
          const y = mur === 'nord' ? 0 : mur === 'sud' ? L - 1 : pos;
          res.push(poser(def, x, y, l, h, FACE[mur]));
        }
      };
      surMur(GAUCHE[entree], pLat); surMur(DROITE[entree], pLat);
      surMur(fond, pNS); surMur(entree, pNS);
      if (n % 2) surMur(fond, 1);
      return res;
    },

    aleatoire(def, n, l, h) {
      return Array.from({ length: n }, () =>
        poser(def, Math.floor(rnd() * (W - l + 1)), Math.floor(rnd() * (L - h + 1)), l, h, Math.floor(rnd() * 4) * 90));
    },

    // Coordonnées exactes : pas de recherche de place, le MJ a décidé.
    // Une case hors de la pièce est ramenée au plus près.
    cases(def, n, l, h, pos) {
      const rotation = pos.rotation ?? versEntree;
      const exact = (x, y, ll, hh) => {
        const ok = inscrire(def, Math.max(0, Math.min(W - ll, x)), Math.max(0, Math.min(L - hh, y)), ll, hh, rotation);
        if (def.genre === 'creature') fixes.add(ok);
        return ok;
      };
      if (pos.etendue) {
        const [x1, y1, x2, y2] = pos.etendue;
        return [exact(x1, y1, Math.min(W, x2 - x1 + 1), Math.min(L, y2 - y1 + 1))];
      }
      const res = pos.cases.map(([x, y]) => exact(x, y, l, h));
      // « cinq gobelins en A1 B1 » : les suivants se placent autour de la dernière case.
      const [dx, dy] = pos.cases[pos.cases.length - 1];
      for (let k = pos.cases.length; k < n; k++) res.push(poser(def, dx, dy, l, h, rotation));
      return res;
    },

    relation(def, n, l, h, pos) {
      const r = repere(pos.cible);
      if (!r) return placeurs[def.zone](def, n, l, h, pos);
      let rel = pos.relation;
      if (rel === 'derriere' && r.porte) rel = 'devant'; // derrière une porte = hors de la pièce
      const [vx, vy] = VECTEUR[r.rotation] || [0, 1];
      const [px, py] = [-vy, vx]; // perpendiculaire (vers la droite de l'objet)
      const sens = rel === 'derriere' ? -1 : 1;
      // Case de départ juste au-delà du repère, du côté voulu.
      const depart = (dx, dy) => [
        dx > 0 ? r.x + r.l : dx < 0 ? r.x - l : r.x,
        dy > 0 ? r.y + r.h : dy < 0 ? r.y - h : r.y,
      ];
      const res = [];
      for (let k = 0; k < n; k++) {
        let x, y;
        if (rel === 'devant' || rel === 'derriere') {
          const [x0, y0] = depart(vx * sens, vy * sens);
          const decal = k === 0 ? 0 : (k % 2 ? 1 : -1) * Math.ceil(k / 2);
          [x, y] = [x0 + px * decal, y0 + py * decal];
        } else if (rel === 'flancs' || rel === 'cote') {
          const cote = rel === 'flancs' ? (k % 2 ? -1 : 1) : (k % 2 ? 1 : -1);
          const rang = rel === 'flancs' ? Math.floor(k / 2) : Math.floor(k / 2);
          const [x0, y0] = depart(px * cote, py * cote);
          [x, y] = [x0 + px * cote * rang, y0 + py * cote * rang];
        } else if (rel === 'face') {
          // Bout opposé de la pièce, dans l'axe du repère.
          [x, y] = [vx ? (vx > 0 ? W - l : 0) : r.x, vy ? (vy > 0 ? L - h : 0) : r.y];
        } else { // autour
          const a = (k / n) * 2 * Math.PI;
          [x, y] = [r.x + Math.round(Math.cos(a) * (r.l + 0.5)), r.y + Math.round(Math.sin(a) * (r.h + 0.5))];
        }
        const rot = rel === 'face' ? (r.rotation + 180) % 360 : r.rotation;
        res.push(poser(def, x, y, l, h, rot, true));
      }
      return res;
    },
  };

  const LIBELLES = {
    fond: 'au fond', entree: "à l'entrée", centre: 'au centre', grille: 'répartition régulière',
    ligne: 'en ligne', cercle: 'en cercle', cotes: 'de chaque côté', coins: 'dans les coins',
    coin: 'dans un coin', 'coin-relatif': 'dans un coin', perimetre: 'le long des murs',
    aleatoire: 'éparpillés', lateral: 'sur le côté',
  };
  const LIBELLES_REL = { devant: 'devant', derriere: 'derrière', cote: 'à côté de', autour: 'autour de', flancs: 'de chaque côté de', face: 'en face de' };

  // Ordre de placement : d'abord ce qui est contre les murs, puis les
  // dispositions régulières, puis le centre et le reste ; les objets placés
  // par rapport à un autre passent en dernier, pour que leur repère existe.
  // Les créatures viennent après tous les objets : elles s'installent dans le décor.
  // Une créature placée par rapport au décor (« de chaque côté de la porte ») passe
  // avant les autres créatures, qui sinon lui prendraient sa place.
  const PRIORITE = { grille: 1, ligne: 1, cercle: 1, centre: 2, aleatoire: 3, relation: 4 };
  const rang = (it) => {
    if (it.position.zone === 'cases') return -1; // les positions exactes d'abord : rien ne doit les déloger
    if (it.genre !== 'creature') return PRIORITE[it.position.zone || definition(it.type).zone] ?? 0;
    if (it.position.zone === 'relation' && it.position.cible.genre !== 'creature') return 10;
    return 11 + (PRIORITE[it.position.zone || definition(it.type).zone] ?? 0);
  };
  const objets = intentions.filter((i) => i.genre === 'objet' || i.genre === 'creature');
  objets.sort((a, b) => rang(a) - rang(b));

  for (const it of objets) {
    if (it.position.etendue) it.n = 1;
    if (it.position.cases) it.n = Math.max(it.n, it.position.cases.length);
    const def = { ...definition(it.type), camp: it.camp, couleur: it.couleur };
    const cote = Math.max(1, def.l + it.taille); // une créature reste carrée, même rapetissée
    const l = Math.min(W, def.genre === 'creature' ? cote : def.l + it.taille);
    const h = Math.min(L, def.genre === 'creature' ? cote : def.h + it.taille);
    const pos = it.position;
    const zone = pos.zone || def.zone;
    const poses = placeurs[zone](def, it.n, l, h, pos).filter(Boolean);

    let ou = LIBELLES[zone] || '';
    if (zone === 'mur') ou = `contre le mur ${pos.mur}`;
    if (zone === 'cases') ou = pos.libelle;
    if (zone === 'relation') ou = `${LIBELLES_REL[pos.relation]} ${nomAffiche(pos.cible.type)}`;
    if (!pos.zone) ou += ' (par défaut)';
    let nom = nomAffiche(it.type, it.n);
    if (it.couleur) nom += ` ${it.couleur}${it.n > 1 && !/s$/.test(it.couleur) ? 's' : ''}`;
    const definitionCamp = definition(it.type).camp;
    if (it.camp && it.camp !== definitionCamp) nom += it.camp === 'monstre' ? ' (hostile)' : ' (allié)';
    const cotePose = poses[0]?.taille ?? l; // « de D1 à E2 » impose une autre taille que celle par défaut
    if (def.genre === 'creature' && cotePose > 1) nom += ` (${cotePose}×${cotePose} cases)`;
    let ligne = `${it.n} ${nom} — ${ou}`;
    if (poses.length < it.n) ligne += ` ⚠ ${it.n - poses.length} sans place`;
    journal.push(ligne);
  }

  // Numérotation des pions dans l'ordre de lecture (haut → bas, gauche → droite),
  // pour que « gobelin 1, 2, 3 » se suivent sur la carte. Les pions à une case
  // imposée gardent le numéro de leur place dans le texte : déplacer le gobelin 2
  // n'en fait pas un autre gobelin.
  const parType = {};
  for (const k of fixes) parType[k.type] = (parType[k.type] || 0) + 1;
  plan.creatures.filter((k) => !fixes.has(k)).sort((a, b) => a.y - b.y || a.x - b.x).forEach((k) => {
    parType[k.type] = (parType[k.type] || 0) + 1;
    k.numero = parType[k.type];
  });

  return { plan, journal };
}
