/**
 * Placement, les dispositions : pour chaque zone d'une phrase (« au fond », « en cercle », « devant la porte »...), le placeur qui
 * pose n objets ou créatures sur la grille et les inscrit au plan. `creerPlaceurs` les lie à la pièce en cours de construction.
 * Un placeur renvoie la liste de ce qu'il a posé (null pour ce qui n'a pas trouvé de place).
 */
import { estAuLarge } from '../../catalogue.js';
import { REGARD, REGARD_VERS, estHorizontal, longueurMur } from '../../murs.js';
import { GAUCHE, DROITE, repartir, repartirInterieur } from './grille.js';
import { devantPorte } from './portes.js';
import { regardAdosse } from '../../pose.js';

const VECTEUR = { 0: [0, -1], 90: [1, 0], 180: [0, 1], 270: [-1, 0] };

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

/**
 * Les placeurs d'une pièce. `fixes` reçoit les créatures posées à la case imposée (elles gardent leur numéro).
 * @param {{plan:object, g:object, W:number, L:number, entree:string, fond:string, graine:number, fixes:Set}} piece
 */
export function creerPlaceurs({ plan, g, W, L, entree, fond, graine, fixes }) {
  const rnd = aleatoire(graine);
  const versEntree = REGARD_VERS[entree];
  const couvertes = new Set(); // cases où traîne déjà un objet non bloquant (bougie, ossements, flaque…) : le hasard évite de les empiler

  /** Pose un objet au plus près de (x, y). Renvoie l'objet posé ou null. */
  function poser(def, x, y, l, h, rotation, ignorerReserve = false) {
    const bloquant = def.bloquant !== false;
    let c = [x, y];
    if (bloquant) c = g.chercher(Math.round(x), Math.round(y), l, h, ignorerReserve);
    if (!c) return null;
    return inscrire(def, c[0], c[1], l, h, rotation);
  }

  /** Un objet orienté posé contre un mur sans orientation imposée s'y adosse (voir pose.js) ; sinon il garde la sienne. */
  function adosser(o) {
    const r = o && o.l !== undefined ? regardAdosse(plan, o, o.x, o.y) : null;
    if (r !== null) o.rotation = r;
    return o;
  }

  /** Ajoute l'objet ou la créature au plan, à cet endroit précis. */
  function inscrire(def, x, y, l, h, rotation) {
    const c = [x, y];
    if (def.bloquant !== false) g.occuper(c[0], c[1], l, h);
    else if (def.genre !== 'creature') for (let i = c[0]; i < c[0] + l; i++) for (let j = c[1]; j < c[1] + h; j++) couvertes.add(`${i},${j}`);
    if (def.genre === 'creature') {
      // Les pions sont numérotés par type (gobelin 1, gobelin 2…) pour que le MJ s'y retrouve.
      const numero = plan.creatures.filter((k) => k.type === def.type).length + 1;
      const k = { id: `c${plan.creatures.length + 1}`, type: def.type, camp: def.camp, x: c[0], y: c[1], taille: l, numero };
      if (def.couleur) k.couleur = def.couleur;
      if (def.cache) k.cache = true;
      plan.creatures.push(k);
      return k;
    }
    const o = { id: `o${plan.objets.length + 1}`, type: def.type, x: c[0], y: c[1], l, h, rotation };
    if (def.cache) o.cache = true;
    if (def.sens === 'monte') o.sens = 'monte';
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
      return poser(def, x, y, ll, hh, REGARD[mur]);
    });
  }

  /** Coordonnées d'un coin donné par ses deux murs. */
  function coin([ns, eo], l, h) {
    return [eo === 'ouest' ? 0 : W - l, ns === 'nord' ? 0 : L - h];
  }

  /** Repère d'une relation : objet existant ou case devant une porte. */
  function repere(cible) {
    if (cible.genre === 'porte') {
      // « devant la porte est » : la porte de ce mur ; sinon (le journal le signale) la première porte du type.
      const p = (cible.mur && (plan.portes.find((q) => q.mur === cible.mur && q.type === cible.type) || plan.portes.find((q) => q.mur === cible.mur)))
        || plan.portes.find((q) => q.type === cible.type) || plan.portes[0];
      if (!p) return null;
      const [x, y] = devantPorte(p, W, L, plan);
      return { x, y, l: 1, h: 1, rotation: REGARD[p.mur], porte: true };
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
      const [x, y] = devantPorte(porte, W, L, plan);
      return Array.from({ length: n }, () => poser(def, x - (entree === 'est' ? l - 1 : 0), y - (entree === 'sud' ? h - 1 : 0), l, h, REGARD[entree], true));
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
      const retrait = estAuLarge(def.type) && Math.min(W, L) >= 5 ? 1 : 0;
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
      const ns = murs.find(estHorizontal);
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
        const long = longueurMur(mur, W, L);
        const portes = plan.portes.filter((p) => p.mur === mur).map((p) => p.position);
        for (let pos of repartirInterieur(k, long)) {
          if (portes.includes(pos)) pos = Math.min(long - 1, pos + 1); // pas sur une porte
          const x = mur === 'ouest' ? 0 : mur === 'est' ? W - 1 : pos;
          const y = mur === 'nord' ? 0 : mur === 'sud' ? L - 1 : pos;
          res.push(poser(def, x, y, l, h, REGARD[mur]));
        }
      };
      surMur(GAUCHE[entree], pLat); surMur(DROITE[entree], pLat);
      surMur(fond, pNS); surMur(entree, pNS);
      if (n % 2) surMur(fond, 1);
      return res;
    },

    aleatoire(def, n, l, h) {
      const tirer = () => [Math.floor(rnd() * (W - l + 1)), Math.floor(rnd() * (L - h + 1)), Math.floor(rnd() * 4) * 90];
      if (def.bloquant !== false || def.genre === 'creature') return Array.from({ length: n }, () => { const [x, y, r] = tirer(); return adosser(poser(def, x, y, l, h, r)); });
      // Un objet non bloquant ne cherche pas de place libre (poser) : on évite ici les cases déjà prises par un objet ou par un autre semis,
      // tant qu'il en reste ; sinon (salle pleine) il se pose où le hasard l'a mis.
      const prise = (x, y) => { for (let i = x; i < x + l; i++) for (let j = y; j < y + h; j++) if (g.occupe.has(`${i},${j}`) || couvertes.has(`${i},${j}`)) return true; return false; };
      return Array.from({ length: n }, () => {
        let [x, y, rotation] = tirer();
        if (prise(x, y)) {
          let libre = null;
          for (let essai = 0; essai < 12 && !libre; essai++) { const [a, b] = tirer(); if (!prise(a, b)) libre = [a, b]; }
          for (let b = 0; b <= L - h && !libre; b++) for (let a = 0; a <= W - l && !libre; a++) if (!prise(a, b)) libre = [a, b];
          if (libre) [x, y] = libre;
        }
        return inscrire(def, x, y, l, h, rotation);
      });
    },

    // Coordonnées exactes : pas de recherche de place, le MJ a décidé.
    // Une case hors de la pièce est ramenée au plus près.
    cases(def, n, l, h, pos) {
      const rotation = pos.rotation ?? versEntree;
      const exact = (x, y, ll, hh) => {
        const ok = inscrire(def, Math.max(0, Math.min(W - ll, x)), Math.max(0, Math.min(L - hh, y)), ll, hh, rotation);
        if (pos.rotation === undefined) adosser(ok);
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
          const rang = Math.floor(k / 2);
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

  return placeurs;
}
