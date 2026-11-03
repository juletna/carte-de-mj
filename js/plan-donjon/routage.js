/**
 * Plan du donjon, le tracé des couloirs : ils contournent les salles. Recherche de chemin de case en case, à angle droit (A*),
 * avec un coût pour les virages, les murs longés, les noms de salle, les autres couloirs et les portes. Le bilan sert à noter un plan.
 */
import { casesRetirees } from '../formes.js';
import { OPPOSE, VECTEUR } from '../murs.js';
import { sansPointsAlignes } from './couloirs.js';

const HAUTEUR_NOM = 1;            // rangées où s'écrit le nom d'une salle, au-dessus de celle qui touche son mur

const COUT_VIRAGE = 2;           // un couloir préfère les lignes droites
const COUT_LONGE_SALLE = 6;      // et garde ses distances avec les murs : le mur, dessiné à l'extérieur, le toucherait
const COUT_SOUS_NOM = 4;         // ni ne passe là où s'écrit le nom d'une salle
const COUT_LONGE_COULOIR = 4;    // ni avec les autres couloirs
const COUT_SORTIE_PORTE = 6;     // évite de passer devant une autre porte
const COUT_CROISEMENT = 40;      // un croisement ne se justifie que si le détour est vraiment très long
const PASSES_MAX = 3;            // retracés quand des couloirs se croisent encore : chacun réessaie, les autres étant posés
const ETATS_MAX = 400000;        // au-delà (plan immense), on garde le tracé simple plutôt que de figer la page
const ORDRE_DIRECTIONS = ['nord', 'est', 'sud', 'ouest'];
const DIRECTIONS = ORDRE_DIRECTIONS.map((mur) => VECTEUR[mur]);
const INDICE_DIRECTION = { nord: 0, est: 1, sud: 2, ouest: 3 };

/** Case juste devant une porte, côté extérieur de la salle (les points de porte tombent au milieu d'une case). */
const caseDevant = (p) => ({
  x: Math.floor(p.x) - (p.mur === 'ouest' ? 1 : 0),
  y: Math.floor(p.y) - (p.mur === 'nord' ? 1 : 0),
});

/**
 * Cherche le chemin le moins coûteux, de case en case, à angle droit (A*). Renvoie les cases, ou null.
 * Arriver de côté sur la dernière case compte comme un virage : le couloir entre dans la porte bien en face.
 */
function chercherChemin(depart, arrivee, dirDepart, dirArrivee, grille, largeur, longueur, coutCase) {
  const cle = (x, y, dir) => (y * largeur + x) * 4 + dir;
  const distance = (x, y) => Math.abs(x - arrivee.x) + Math.abs(y - arrivee.y);
  const couts = new Map([[cle(depart.x, depart.y, dirDepart), 0]]);
  const parents = new Map();
  // Tas binaire minimal : [priorité, x, y, direction].
  const tas = [[distance(depart.x, depart.y), depart.x, depart.y, dirDepart]];
  const pousser = (n) => {
    let i = tas.push(n) - 1;
    while (i > 0) {
      const h = (i - 1) >> 1;
      if (tas[h][0] <= tas[i][0]) break;
      [tas[h], tas[i]] = [tas[i], tas[h]];
      i = h;
    }
  };
  const retirer = () => {
    const haut = tas[0], fin = tas.pop();
    if (tas.length) {
      tas[0] = fin;
      for (let i = 0; ;) {
        const g = 2 * i + 1, d = g + 1;
        let m = i;
        if (g < tas.length && tas[g][0] < tas[m][0]) m = g;
        if (d < tas.length && tas[d][0] < tas[m][0]) m = d;
        if (m === i) break;
        [tas[m], tas[i]] = [tas[i], tas[m]];
        i = m;
      }
    }
    return haut;
  };
  for (let vus = 0; tas.length && vus < ETATS_MAX; vus++) {
    const [, x, y, dir] = retirer();
    const k = cle(x, y, dir);
    if (x === arrivee.x && y === arrivee.y) {
      const cases = [];
      for (let c = k; c !== undefined; c = parents.get(c)) {
        const v = Math.floor(c / 4);
        cases.unshift({ x: v % largeur, y: Math.floor(v / largeur) });
      }
      return cases;
    }
    DIRECTIONS.forEach(([dx, dy], nd) => {
      if (Math.abs(nd - dir) === 2) return; // pas de demi-tour
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= largeur || ny >= longueur || grille[ny * largeur + nx]) return;
      const deCote = nx === arrivee.x && ny === arrivee.y && nd !== dirArrivee;
      const cout = couts.get(k) + 1 + (nd === dir ? 0 : COUT_VIRAGE) + (deCote ? COUT_VIRAGE : 0) + coutCase(nx, ny);
      const nk = cle(nx, ny, nd);
      if (cout >= (couts.get(nk) ?? Infinity)) return;
      couts.set(nk, cout);
      parents.set(nk, k);
      pousser([cout + distance(nx, ny), nx, ny, nd]);
    });
  }
  return null;
}

/**
 * Ajoute à chaque couloir son `chemin` : une suite de points à angle droit qui ne traverse aucune salle, quitte à
 * s'allonger. Les couloirs sont tracés dans l'ordre des liaisons, en évitant autant que possible ceux déjà posés ;
 * s'il reste des croisements, chacun est retracé en connaissant tous les autres, car le premier tracé ignorait les suivants.
 * Pas de chemin possible (porte murée par une salle voisine, plan immense) : le couloir garde son tracé simple.
 * Renvoie le bilan : { croisements, frottements, virages, longueur } (les cases devant les portes ne frottent pas).
 */
export function tracerCouloirs(couloirs, positions, d, largeur, longueur) {
  const grille = new Uint8Array(largeur * longueur);     // 1 : une salle occupe cette case
  const proche = new Uint8Array(largeur * longueur);     // 1 : case qui touche une salle
  const sousNom = new Uint8Array(largeur * longueur);    // 1 : case où s'écrit le nom d'une salle, juste au-dessus d'elle
  const devantPorte = new Uint8Array(largeur * longueur);
  const pris = new Uint16Array(largeur * longueur);      // nombre de couloirs qui passent ici
  const indice = (x, y) => y * largeur + x;
  const dans = (x, y) => x >= 0 && y >= 0 && x < largeur && y < longueur;
  for (const [id, r] of Object.entries(positions)) {
    for (let y = r.y - 1 - HAUTEUR_NOM; y < r.y - 1; y++) {
      for (let x = r.x; x < r.x + r.largeur; x++) if (dans(x, y)) sousNom[indice(x, y)] = 1;
    }
    // Seul le sol bloque un couloir : il peut entrer dans l'entaille d'une salle en croix pour atteindre sa porte.
    const vides = casesRetirees(d.salles[id].plan);
    for (let y = 0; y < r.longueur; y++) {
      for (let x = 0; x < r.largeur; x++) {
        if (vides.has(`${x},${y}`)) continue;
        const X = r.x + x, Y = r.y + y;
        if (dans(X, Y)) grille[indice(X, Y)] = 1;
        for (let j = Y - 1; j <= Y + 1; j++) for (let i = X - 1; i <= X + 1; i++) if (dans(i, j)) proche[indice(i, j)] = 1;
      }
    }
  }
  const sorties = couloirs.flatMap((c) => [c.de, c.vers].map(caseDevant));
  for (const s of sorties) if (dans(s.x, s.y)) devantPorte[indice(s.x, s.y)] = 1;

  const trace = new Map(); // couloir → ses cases
  const marquer = (cases, n) => { for (const k of cases) pris[indice(k.x, k.y)] += n; };
  const tracer = (c) => {
    const depart = caseDevant(c.de), arrivee = caseDevant(c.vers);
    const libre = (s) => dans(s.x, s.y) && !grille[indice(s.x, s.y)];
    if (c.orpheline || !libre(depart) || !libre(arrivee)) return;
    const estExtremite = (x, y) => (x === depart.x && y === depart.y) || (x === arrivee.x && y === arrivee.y);
    const coutCase = (x, y) => {
      if (estExtremite(x, y)) return 0;
      const i = indice(x, y);
      const cole = DIRECTIONS.some(([dx, dy]) => dans(x + dx, y + dy) && pris[indice(x + dx, y + dy)]);
      return (proche[i] ? COUT_LONGE_SALLE : 0) + (sousNom[i] ? COUT_SOUS_NOM : 0) + (devantPorte[i] ? COUT_SORTIE_PORTE : 0)
        + (pris[i] ? COUT_CROISEMENT : 0) + (cole ? COUT_LONGE_COULOIR : 0);
    };
    const dirArrivee = INDICE_DIRECTION[OPPOSE[c.vers.mur]];
    const cases = chercherChemin(depart, arrivee, INDICE_DIRECTION[c.de.mur], dirArrivee, grille, largeur, longueur, coutCase);
    if (!cases) return;
    marquer(cases, 1);
    trace.set(c, cases);
    c.chemin = sansPointsAlignes([
      { x: c.de.x, y: c.de.y },
      ...cases.map((k) => ({ x: k.x + 0.5, y: k.y + 0.5 })),
      { x: c.vers.x, y: c.vers.y },
    ]);
  };
  couloirs.forEach(tracer);
  for (let passe = 1; passe < PASSES_MAX && pris.some((n) => n > 1); passe++) {
    for (const c of couloirs) {
      if (!trace.has(c)) continue;
      marquer(trace.get(c), -1);
      trace.delete(c);
      tracer(c);
    }
  }
  const bilan = { croisements: 0, frottements: 0, virages: 0, longueur: 0 };
  for (let i = 0; i < pris.length; i++) if (pris[i] > 1) bilan.croisements++;
  for (const [c, cases] of trace) {
    bilan.longueur += cases.length;
    bilan.virages += c.chemin.length - 2;
    for (const k of cases.slice(1, -1)) if (proche[indice(k.x, k.y)]) bilan.frottements++;
  }
  return bilan;
}
