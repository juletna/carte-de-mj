/** Exécute toutes les phrases de test et renvoie les résultats. */
import { analyser } from '../js/parseur/index.js';
import { comparer } from './mini-test.js';
import { PHRASES } from './phrases.js';
import { decrire } from '../js/parseur/decrire.js';
import { OBJETS, CREATURES } from '../js/catalogue.js';

const SYMETRIQUES = new Set(['pilier', 'colonne', 'tonneau', 'caisse', 'fosse', 'debris', 'puits', 'fontaine']);

export function executer() {
  return PHRASES.map(({ phrase, attendu }) => {
    try {
      const resultat = analyser(phrase, { echelle: 1.5 });
      return { phrase, ecarts: comparer(resultat, attendu), resultat };
    } catch (err) {
      return { phrase, ecarts: [`exception : ${err.message}`], resultat: null };
    }
  });
}

/** Résumé d'un plan, indépendant de l'ordre et des identifiants. */
function empreinte(plan) {
  const trier = (l) => l.sort();
  return JSON.stringify({
    taille: [plan.largeur, plan.longueur, plan.sol],
    portes: trier(plan.portes.map((p) => `${p.type} ${p.mur} ${p.position}${p.cache ? ' cache' : ''}`)),
    objets: trier(plan.objets.map((o) => `${o.type} ${o.x},${o.y} ${o.l}x${o.h} ${SYMETRIQUES.has(o.type) ? '' : o.rotation}${o.cache ? ' cache' : ''}`)),
    creatures: trier((plan.creatures || []).map((k) => `${k.type} ${k.numero} ${k.camp} ${k.x},${k.y} ${k.taille} ${k.couleur || ''}${k.cache ? ' cache' : ''}`)),
  }, null, 1);
}

/** Aller-retour : plan → description → plan doit redonner exactement le même plan. */
export function executerAllerRetour() {
  const toutes = [
    ...PHRASES.map((p) => p.phrase),
    // Un exemplaire de chaque type, pour vérifier que tous les noms se relisent.
    `salle de 20 par 20 cases, ${[...OBJETS, ...CREATURES].map((d) => `un ${d.mots[0]}`).join(', ')}`,
    'salle de 8 par 8 cases, deux dragons bleus hostiles, un nain hostile, un orque allié, une goule alliée, un bébé dragon',
    // Éléments cachés : l'aller-retour doit les conserver, sans jamais regrouper un caché et un visible.
    'salle de 8 par 8 cases, un coffre caché en A1, un coffre en B1, deux coffres cachés en C1 D1, un gobelin caché en E5, un gobelin en F5, deux elfes cachés, une porte secrète au mur nord en C, une porte au mur sud en B',
    'salle de 8 par 8 cases, une herse secrète à l’est, une arche cachée à l’ouest, un lit caché de A2 à B3 tourné vers l’est, un dragon rouge hostile caché',
    'salle de 8 par 8 cases, une porte au sud, trois statues secrètes, des gobelins cachés',
    'salle de 8 par 8 cases, une porte à l’est, une herse au nord, une arche au sud, un lit contre le mur nord, une table contre le mur ouest',
  ];
  return toutes.map((phrase) => {
    const avant = analyser(phrase, { echelle: 1.5 });
    const texte = decrire(avant.plan);
    const apres = analyser(texte, { echelle: 1.5 });
    const ecarts = [];
    if (empreinte(avant.plan) !== empreinte(apres.plan)) ecarts.push(`plan différent après relecture de : ${texte}`);
    if (apres.ignores.length) ecarts.push(`mots non compris à la relecture : ${apres.ignores.join(', ')}`);
    return { phrase: `aller-retour : ${phrase}`, ecarts, resultat: apres };
  });
}
