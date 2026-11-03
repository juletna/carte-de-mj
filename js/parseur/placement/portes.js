/**
 * Placement, les portes : sur quel mur chacune tombe, à quelle position, et quelle case devant elle reste libre.
 * Le mur d'entrée se décide ici (imposé, sinon celui de la première porte précisée, sinon le sud) ; le fond est son opposé.
 */
import { retraitPorte } from '../../formes.js';
import { OPPOSE, longueurMur } from '../../murs.js';
import { GAUCHE, DROITE, repartir } from './grille.js';

/** Case intérieure juste devant une porte. */
export function devantPorte(p, W, L, plan) {
  const d = retraitPorte(plan, p.mur, p.position);
  return { nord: [p.position, d], sud: [p.position, L - 1 - d], ouest: [d, p.position], est: [W - 1 - d, p.position] }[p.mur];
}

/**
 * Pose les portes demandées dans `plan.portes`, réserve la case devant chacune dans la grille `g`, et fixe `plan.entree`.
 * @returns {{entree:string, fond:string, implicite:boolean}} `implicite` : la seule porte existe parce qu'une phrase la cite comme repère.
 */
export function placerPortes({ plan, g, W, L, intentions, entreeImposee }) {
  const intPortes = intentions.filter((i) => i.genre === 'porte');
  // Une porte citée comme repère (« devant une porte ») existe forcément.
  const ciblesPorte = intentions.filter((i) => i.position.cible?.genre === 'porte');
  if (!intPortes.length && ciblesPorte.length) {
    // « devant la porte est » sans aucune porte : on la crée sur ce mur (sans en faire le mur d'entrée).
    const c = ciblesPorte[0].position.cible;
    intPortes.push({ genre: 'porte', type: c.type, n: 1, position: { zone: null }, implicite: true, murImpose: c.mur });
  }

  plan.entree = null; // renseigné juste après
  const murExplicite = intPortes.find((i) => i.position.zone === 'mur')?.position.mur;
  const entree = entreeImposee || murExplicite || 'sud';
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
      else mur = it.murImpose || ordreDefaut[Math.min(defaut++, 3)];
      parMur[mur].push({ type: it.type, position: pos.positionMur, cache: it.cache }); // position : seulement si précisée
    }
  }
  for (const [mur, liste] of Object.entries(parMur)) {
    const long = longueurMur(mur, W, L);
    const ajouter = (position, type, cache) => plan.portes.push({ id: `p${plan.portes.length + 1}`, mur, position, type, ...(cache ? { cache: true } : {}) });
    const prises = new Set();
    for (const d of liste.filter((e) => e.position !== undefined)) {
      const position = Math.min(long - 1, d.position);
      prises.add(position);
      ajouter(position, d.type, d.cache);
    }
    // Les autres portes se répartissent sur ce mur, sans tomber sur une porte déjà placée.
    const libres = liste.filter((e) => e.position === undefined);
    repartir(libres.length, long).forEach((voulue, k) => {
      let position = voulue;
      while (prises.has(position) && position < long - 1) position++;
      prises.add(position);
      ajouter(position, libres[k].type, libres[k].cache);
    });
  }
  for (const p of plan.portes) {
    const [x, y] = devantPorte(p, W, L, plan);
    g.reserve.add(`${x},${y}`);
  }
  return { entree, fond, implicite: Boolean(intPortes[0]?.implicite) };
}
