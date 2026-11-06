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
 *
 * Ce fichier orchestre ; le détail est dans js/parseur/placement/ :
 *  - grille.js   la grille d'occupation et la répartition régulière (`repartir`, `repartirInterieur`) ;
 *  - portes.js   le mur d'entrée, les portes et la case réservée devant chacune ;
 *  - placeurs.js une disposition par zone (« au fond », « en cercle », « devant la porte »...) ;
 *  - journal.js  les phrases du journal de placement.
 * L'ordre compte : les portes d'abord (« devant la porte » en dépend), puis les objets par priorité, puis les créatures.
 */
import { normaliserForme, casesRetirees, surLeSol } from '../formes.js';
import { definition } from './lexique.js';
import { VERSION_PLAN } from '../schema.js';
import { Grille } from './placement/grille.js';
import { placerPortes } from './placement/portes.js';
import { creerPlaceurs } from './placement/placeurs.js';
import { lignePortes, ligneObjet, ligneSansPlace } from './placement/journal.js';

// Les répartitions restent importables d'ici, comme avant le découpage.
export { repartir, repartirInterieur } from './placement/grille.js';

/**
 * Construit le plan à partir des intentions.
 * @param {{largeur:number, longueur:number, sol:string, intentions:object[], graine:number, entree?:string}} entree
 *        `entree` impose le mur d'entrée (sinon : mur de la première porte précisée, ou sud).
 * @returns {{plan:object, journal:string[]}}
 */
export function construirePlan({ largeur: W, longueur: L, sol, forme, intentions, graine = 1, entree: entreeImposee }) {
  const g = new Grille(W, L);
  const journal = [];
  const plan = { version: VERSION_PLAN, id: 'salle-1', nom: 'Salle', ...normaliserForme(forme), largeur: W, longueur: L, sol, portes: [], objets: [], creatures: [], connexions: [] };
  for (const k of casesRetirees(plan)) g.occupe.add(k); // une case retirée n'est jamais libre

  // ---- 1. Portes --------------------------------------------------------
  const { entree, fond, implicite } = placerPortes({ plan, g, W, L, intentions, entreeImposee });
  const lignePorte = lignePortes(plan.portes, implicite);
  if (lignePorte) journal.push(lignePorte);

  // ---- 2. Objets --------------------------------------------------------
  const fixes = new Set(); // créatures à la case imposée : elles gardent leur numéro
  const placeurs = creerPlaceurs({ plan, g, W, L, entree, fond, graine, fixes });

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
    const def = { ...definition(it.type), camp: it.camp, couleur: it.couleur, cache: it.cache, sens: it.sens, variante: it.variante };
    const cote = Math.max(1, def.l + it.taille); // une créature reste carrée, même rapetissée
    const l = Math.min(W, def.genre === 'creature' ? cote : def.l + it.taille);
    const h = Math.min(L, def.genre === 'creature' ? cote : def.h + it.taille);
    const pos = it.position;
    const zone = pos.zone || def.zone;
    const poses = placeurs[zone](def, it.n, l, h, pos).filter(Boolean);
    journal.push(ligneObjet(it, zone, poses, l, plan));
  }

  // Ce qui est tombé sur une case retirée (case imposée, torche au mur) rejoint la case de sol libre la plus proche.
  if (casesRetirees(plan).size) {
    for (const [liste, largeur, hauteur] of [[plan.objets, (o) => o.l, (o) => o.h], [plan.creatures, (k) => k.taille, (k) => k.taille]]) {
      for (const e of [...liste]) {
        if (surLeSol(plan, e.x, e.y, largeur(e), hauteur(e))) continue;
        const c = g.chercher(e.x, e.y, largeur(e), hauteur(e), true);
        if (c) { [e.x, e.y] = c; g.occuper(c[0], c[1], largeur(e), hauteur(e)); continue; }
        liste.splice(liste.indexOf(e), 1);
        journal.push(ligneSansPlace(e.type));
      }
    }
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
