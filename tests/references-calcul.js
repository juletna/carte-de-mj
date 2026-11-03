/**
 * Calcul des références de non-régression : ce que dessinent les moteurs de rendu et comment `disposerPlan`
 * place un donjon. Module commun à tests/references.test.js (qui compare) et à tests/regenerer-references.mjs
 * (qui réécrit tests/references.js) : aucune API propre à Node ni au navigateur.
 *
 * Le but est de prouver qu'un découpage de code ne change RIEN au résultat. Plutôt qu'un gros fichier de référence,
 * chaque cas est résumé par une EMPREINTE (hachage du résultat complet) et deux chiffres lisibles pour voir d'un coup
 * d'œil de quel côté ça a bougé. Les cas sont déterministes : graines fixées, identifiants de salles remplacés par leur
 * rang, nombres arrondis au millième (les fonctions trigonométriques varient d'un moteur JS à l'autre au dernier bit).
 */
import * as m from '../js/donjon.js';
import { genererDonjon } from '../js/generateur.js';
import { MODELES, donjonDepuisModele } from '../js/modeles.js';
import { analyser } from '../js/parseur/index.js';
import { OBJETS, CREATURES } from '../js/parseur/lexique.js';
import { disposerPlan } from '../js/plan-donjon.js';
import { dessiner, dessinerFenetre, dessinerPlanDonjon } from '../js/rendu/moteur.js';
import * as vectoriel from '../js/rendu/themes/vectoriel.js';
import * as papier from '../js/rendu/themes/papier.js';

/** Hachage de texte sur 53 bits (cyrb53), en hexadécimal : court, stable, sans API de plateforme. */
export function empreinte(texte) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < texte.length; i++) {
    const c = texte.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

// --- Journal d'appels d'un contexte canvas simulé ---------------------------------------------------------

const arrondi = (v) => Math.round(v * 1000) / 1000;

/** Contexte 2D simulé qui note tout : appels de méthodes et affectations de propriétés, dans l'ordre. */
function creerJournal() {
  const lignes = [];
  const proprietes = {};
  let degrades = 0;
  const texte = (v) => {
    if (typeof v === 'number') return String(arrondi(v));
    if (Array.isArray(v)) return `[${v.map(texte).join(',')}]`;
    if (v && typeof v === 'object') return v.etiquette ?? '{}';
    return String(v);
  };
  const degrade = (type) => {
    const etiquette = `degrade#${++degrades}`;
    return { etiquette, addColorStop: (...args) => lignes.push(`${etiquette}.addColorStop(${args.map(texte).join(',')})`) };
  };
  const ctx = new Proxy({}, {
    get: (_, nom) => {
      if (nom in proprietes) return proprietes[nom];
      if (typeof nom === 'symbol') return undefined;
      if (nom === 'measureText') return (s) => { lignes.push(`measureText(${s})`); return { width: String(s).length * 6 }; };
      if (nom === 'createRadialGradient' || nom === 'createLinearGradient') {
        return (...args) => { const g = degrade(nom); lignes.push(`${nom}(${args.map(texte).join(',')}) -> ${g.etiquette}`); return g; };
      }
      return (...args) => { lignes.push(`${nom}(${args.map(texte).join(',')})`); };
    },
    set: (_, nom, valeur) => { proprietes[nom] = valeur; lignes.push(`${nom} = ${texte(valeur)}`); return true; },
  });
  const canvas = { width: 0, height: 0, style: {}, getContext: () => ctx };
  return { ctx, canvas, lignes };
}

/** Joue un dessin sur un contexte simulé. `densite` : le premier appel dépend de window.devicePixelRatio, on l'efface. */
function journaliser(dessin, { densite = false } = {}) {
  const { canvas, lignes } = creerJournal();
  dessin(canvas);
  if (densite) {
    if (!lignes[0]?.startsWith('setTransform(')) throw new Error(`premier appel inattendu : ${lignes[0]}`);
    lignes[0] = 'setTransform(densité)';
  }
  return lignes;
}

const resume = (lignes) => ({ appels: lignes.length, empreinte: empreinte(lignes.join('\n')) });

// --- Les cas ------------------------------------------------------------------------------------------------

/** Un exemplaire de chaque objet et de chaque pion, des éléments cachés, des portes de chaque sorte. */
const TEXTE_TOUT = `salle de 20 par 20 cases, sol en pierre, une porte au mur sud en D, une porte secrète au mur nord en B, une arche au mur est en 3, une porte au mur ouest en 5, ${
  [...OBJETS, ...CREATURES].map((d) => `un ${d.mots[0]}`).join(', ')}, un coffre caché, un gobelin caché, deux gobelins en A1 B1`;
const TEXTES_FORMES = [
  'Salle en croix de 12 par 12 cases, bras de 3 cases, sol en marbre, une porte au mur nord en F, une table, 4 colonnes, un gobelin.',
  'Salle en L de 10 par 9 cases, bras de 4 cases, angle au sud ouest, sol en bois, une arche au mur sud en C, 3 tonneaux, un ogre.',
  'Salle en octogone de 9 par 9 cases, sol en glace, une porte au mur est en 4, une fontaine, 2 statues.',
];

function plansDeRendu() {
  const tout = analyser(TEXTE_TOUT, { echelle: 1.5 }).plan;
  const formes = TEXTES_FORMES.map((t) => analyser(t, { echelle: 1.5 }).plan);
  return { tout, formes };
}

/** Un donjon de rendu : le tirage 3 de 6 salles, lu par rang. */
function donjonDeRendu() {
  const { donjon } = genererDonjon({ graine: 3, salles: 6, boucles: 1, secretes: 1, familles: ['morts'] });
  return donjon;
}

/** Ce que font `dessiner`, `dessinerFenetre` et `dessinerPlanDonjon` avec les deux thèmes, par cas. */
export function calculerRendu() {
  const { tout, formes } = plansDeRendu();
  const d = donjonDeRendu();
  const ids = Object.keys(d.salles), disposition = disposerPlan(d);
  const marques = {
    portesReliees: [{ mur: 'sud', position: 3 }],
    selection: { genre: 'objet', element: tout.objets[0] },
    caseVisee: { x: 2, y: 2 },
  };
  const fenetre = { fenetre: { x0: 2, y0: 2, x1: 9, y1: 8 }, bords: { nord: false, sud: false, est: false, ouest: true }, taille: 60 };
  const cas = {
    'vectoriel · dessiner : un exemplaire de tout, grille et repères': () => journaliser((c) => dessiner(c, tout, { taille: 48, theme: vectoriel }), { densite: true }),
    'vectoriel · dessiner : marques d’interface, sans grille': () => journaliser((c) => dessiner(c, tout, { taille: 32, grille: false, theme: vectoriel, marques }), { densite: true }),
    'papier · dessiner : un exemplaire de tout': () => journaliser((c) => dessiner(c, tout, { taille: 48, theme: papier }), { densite: true }),
    'vectoriel · dessinerFenetre : une fenêtre de la salle': () => journaliser((c) => dessinerFenetre(c, tout, { ...fenetre, theme: vectoriel, marques })),
    'papier · dessinerFenetre : une fenêtre de la salle': () => journaliser((c) => dessinerFenetre(c, tout, { ...fenetre, theme: papier, marques })),
    'vectoriel · dessiner : croix, L, octogone': () => formes.flatMap((p) => journaliser((c) => dessiner(c, p, { taille: 40, theme: vectoriel }), { densite: true })),
    'papier · dessiner : croix, L, octogone': () => formes.flatMap((p) => journaliser((c) => dessiner(c, p, { taille: 40, theme: papier }), { densite: true })),
    'vectoriel · dessinerPlanDonjon : tous les repères': () => journaliser((c) => dessinerPlanDonjon(c, d, disposition, {
      taille: 16, actif: ids[1], survol: ids[2], courante: ids[3], inconnues: [ids[4]], grille: true,
      portesFermees: [{ salle: ids[0], mur: 'sud', position: 1 }, { salle: ids[1], mur: 'nord', position: 2 }],
    }), { densite: true }),
    'vectoriel · dessinerPlanDonjon : miniature teintée, sans noms ni pions': () => journaliser((c) => dessinerPlanDonjon(c, d, disposition, {
      taille: 4, actif: ids[0], noms: false, pions: false, surbrillance: true,
    }), { densite: true }),
    'papier · dessinerPlanDonjon : plan seul': () => journaliser((c) => dessinerPlanDonjon(c, d, disposition, { taille: 12, theme: papier }), { densite: true }),
  };
  return Object.fromEntries(Object.entries(cas).map(([nom, f]) => [nom, resume(f())]));
}

/** Remplace les identifiants (aléatoires) de salles et de liaisons par leur rang, pour une empreinte reproductible. */
function sansIdentifiants(d, disposition) {
  let json = JSON.stringify(disposition);
  Object.keys(d.salles).forEach((id, i) => { json = json.split(`"${id}"`).join(`"S${i + 1}"`); });
  d.liaisons.forEach((l, i) => { json = json.split(`"${l.id}"`).join(`"L${i + 1}"`); });
  return json;
}

/** Cas de disposition : des donjons au hasard à graine fixe, les modèles de l'outil, et des cas limites. */
function donjonsDeDisposition() {
  const hasard = (nom, options) => [nom, () => genererDonjon(options).donjon];
  const cas = [
    hasard('tirage 1 : 8 salles, 2 boucles', { graine: 1 }),
    hasard('tirage 7 : 14 salles, 4 boucles, 2 secrètes, formes', { graine: 7, salles: 14, boucles: 4, secretes: 2 }),
    hasard('tirage 42 : une seule salle', { graine: 42, salles: 1 }),
    hasard('tirage 5 : 25 salles, 6 boucles', { graine: 5, salles: 25, boucles: 6 }),
    hasard('tirage 31 : 12 salles sans boucle', { graine: 31, salles: 12, boucles: 0 }),
    ...MODELES.map((modele) => [`modèle ${modele.id}`, () => donjonDepuisModele(modele)]),
    ['salles non reliées', () => {
      const d = genererDonjon({ graine: 11, salles: 4 }).donjon;
      m.ajouterSalle(d, { nom: 'Seule', texte: 'Salle de 5 par 5 cases.' });
      m.ajouterSalle(d, { nom: 'Seule aussi', texte: 'Salle de 7 par 4 cases, une porte au mur nord en C.' });
      return d;
    }],
    ['liaison orpheline : une porte disparue', () => {
      const d = genererDonjon({ graine: 11, salles: 4, boucles: 0, secretes: 0 }).donjon;
      const { b } = d.liaisons[0];
      const s = d.salles[b.salle];
      s.plan.portes = s.plan.portes.filter((p) => p.mur !== b.mur || p.position !== b.position);
      return d;
    }],
  ];
  return cas;
}

/** L'empreinte de la disposition de chaque donjon, avec son nombre de salles et de couloirs. */
export function calculerDispositions() {
  const resultat = {};
  for (const [nom, creer] of donjonsDeDisposition()) {
    const d = creer();
    const disposition = disposerPlan(d);
    resultat[nom] = {
      salles: Object.keys(d.salles).length,
      couloirs: disposition.couloirs.length,
      empreinte: empreinte(sansIdentifiants(d, disposition)),
    };
  }
  return resultat;
}

export const calculerReferences = () => ({ disposition: calculerDispositions(), rendu: calculerRendu() });
