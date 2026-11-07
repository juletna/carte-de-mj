/**
 * Catalogue de la bibliothèque de cartes (pur, sans DOM) : validation de bibliotheque/catalogue.json,
 * filtres par niveau et milieux, recherche texte. Format : docs/conception-univers.md, section 2.
 */
import { sansAccents } from '../format.js';
import { IDS_NIVEAUX, IDS_MILIEUX, libelleMilieu, libelleNiveau, normaliserNiveau } from './vocabulaire.js';

export const FORMAT_CATALOGUE = 'carte-de-mj-bibliotheque';
const EXTENSIONS = ['webp', 'png', 'jpg', 'jpeg', 'svg'];
const ORIGINES = ['generee', 'importee', 'externe'];
const SOURCES_IMAGE = ['navigateur', 'bibliotheque'];
const MAX_TAGS = 40;
const texte = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const dimension = (v) => (Number.isFinite(v) && v >= 1 && v <= 20000 ? Math.round(v) : undefined);

/** Un chemin relatif au dossier bibliotheque/, qui n'en sort pas, avec une extension d'image admise. */
export function fichierValide(fichier) {
  if (typeof fichier !== 'string' || !fichier || fichier.length > 200) return false;
  if (fichier.startsWith('/') || fichier.includes('\\') || fichier.includes(':') || fichier.includes('?') || fichier.includes('#') || fichier.includes('%')) return false;
  const morceaux = fichier.split('/');
  if (morceaux.some((m) => m === '' || m === '.' || m === '..')) return false;
  const ext = morceaux.at(-1).split('.').pop().toLowerCase();
  return morceaux.at(-1).includes('.') && EXTENSIONS.includes(ext);
}

export const idValide = (id) => typeof id === 'string' && /^[a-z0-9-]{1,64}$/.test(id);

/**
 * Valide une entrée de carte (du catalogue ou des métadonnées d'une image importée, qui n'a pas de `fichier`).
 * Rend { carte } ou { erreur }. Les champs inconnus sont ignorés ; niveau et milieux inconnus sont refusés ; un ancien niveau est converti (vocabulaire.js).
 */
export function validerCarte(brut, { avecFichier = true } = {}) {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return { erreur: 'entrée qui n\u2019est pas un objet' };
  if (avecFichier && !idValide(brut.id)) return { erreur: `identifiant « ${texte(String(brut.id ?? ''), 40)} » invalide (minuscules, chiffres, tirets, 64 caractères au plus)` };
  if (avecFichier && !fichierValide(brut.fichier)) return { erreur: `fichier « ${texte(String(brut.fichier ?? ''), 60)} » refusé (chemin dans bibliotheque/, extension ${EXTENSIONS.join(', ')})` };
  const zoom = normaliserNiveau({ niveau: brut.niveau, sousType: brut.sousType }); // un ancien niveau (six échelles) est converti sans rien dire
  if (!zoom) return { erreur: `niveau « ${texte(String(brut.niveau ?? ''), 30)} » inconnu (${IDS_NIVEAUX.join(', ')})` };
  const titre = texte(brut.titre, 120);
  if (!titre) return { erreur: 'titre absent' };
  const milieuxBruts = Array.isArray(brut.milieux) ? brut.milieux : [];
  const inconnu = milieuxBruts.find((m) => !IDS_MILIEUX.includes(m));
  if (inconnu !== undefined) return { erreur: `milieu « ${texte(String(inconnu), 30)} » inconnu (${IDS_MILIEUX.join(', ')})` };
  const carte = {
    titre,
    ...zoom,
    milieux: [...new Set(milieuxBruts)],
    tags: (Array.isArray(brut.tags) ? brut.tags : []).map((t) => texte(t, 40)).filter(Boolean).slice(0, MAX_TAGS),
    description: texte(brut.description, 600),
    licence: texte(brut.licence, 80),
    credit: texte(brut.credit, 200),
  };
  if (avecFichier) { carte.id = brut.id; carte.fichier = brut.fichier; }
  const largeur = dimension(brut.largeur), hauteur = dimension(brut.hauteur);
  if (largeur && hauteur) { carte.largeur = largeur; carte.hauteur = hauteur; }
  const g = brut.grille;
  if (g && typeof g === 'object' && Number.isFinite(g.case) && g.case >= 4 && g.case <= 2000) {
    carte.grille = { case: g.case, dx: Number.isFinite(g.dx) ? g.dx : 0, dy: Number.isFinite(g.dy) ? g.dy : 0 };
  }
  const o = brut.origine;
  if (o && typeof o === 'object' && ORIGINES.includes(o.type)) {
    carte.origine = { type: o.type };
    for (const c of ['outil', 'style', 'le']) if (texte(o[c], 80)) carte.origine[c] = texte(o[c], 80);
    // `reference` : l'image jointe au générateur pour rester cohérent avec elle ({ source, id }, comme la référence d'une carte de lieu) ; ignorée si mal formée.
    const r = o.reference;
    if (r && typeof r === 'object' && SOURCES_IMAGE.includes(r.source) && idValide(r.id)) carte.origine.reference = { source: r.source, id: r.id };
  }
  return { carte };
}

/**
 * Lit le contenu (déjà analysé) de catalogue.json. Rend { cartes, avertissements }.
 * Une entrée invalide ou en double est écartée avec un avertissement ; le reste du catalogue est gardé.
 * Un catalogue inutilisable (pas un objet, mauvais format, pas de liste) rend aucune carte et un avertissement.
 */
export function validerCatalogue(brut) {
  const avertissements = [];
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return { cartes: [], avertissements: ['catalogue illisible : un objet JSON est attendu'] };
  if (brut.format !== FORMAT_CATALOGUE) return { cartes: [], avertissements: [`catalogue d\u2019un autre format (« ${texte(String(brut.format ?? ''), 40)} »)`] };
  if (!Array.isArray(brut.cartes)) return { cartes: [], avertissements: ['catalogue sans liste « cartes »'] };
  const cartes = [], vus = new Set();
  brut.cartes.forEach((entree, i) => {
    const r = validerCarte(entree, { avecFichier: true });
    const nom = entree && typeof entree === 'object' && typeof entree.id === 'string' ? ` « ${texte(entree.id, 40)} »` : '';
    if (r.erreur) { avertissements.push(`carte n° ${i + 1}${nom} écartée : ${r.erreur}`); return; }
    if (vus.has(r.carte.id)) { avertissements.push(`carte n° ${i + 1}${nom} écartée : identifiant en double`); return; }
    vus.add(r.carte.id);
    cartes.push(r.carte);
  });
  return { cartes, avertissements };
}

/** Garde les cartes du niveau demandé (aucun niveau : toutes) qui ont TOUS les milieux demandés. */
export function filtrer(cartes, { niveau, sousType, milieux = [] } = {}) {
  return cartes.filter((c) => (!niveau || c.niveau === niveau) && (!sousType || c.sousType === sousType) && milieux.every((m) => c.milieux.includes(m)));
}

/** Le texte où chercher : titre, tags, description, noms des milieux (et libellé du niveau). */
const meule = (c) => sansAccents([c.titre, ...c.tags, c.description, ...c.milieux.map(libelleMilieu), libelleNiveau(c.niveau)].join(' '));

/** Recherche sans accents ni casse : chaque mot saisi doit apparaître quelque part. Texte vide : tout. */
export function chercher(cartes, requete) {
  const mots = sansAccents(requete).split(/\s+/).filter(Boolean);
  if (!mots.length) return cartes;
  return cartes.filter((c) => { const m = meule(c); return mots.every((mot) => m.includes(mot)); });
}

/** Filtres puis recherche. */
export function selectionner(cartes, { niveau, sousType, milieux, requete } = {}) {
  return chercher(filtrer(cartes, { niveau, sousType, milieux }),requete ?? '');
}

/** Ligne de crédit à afficher avec une carte (vide si rien à créditer). */
export function creditAffiche(carte) {
  if (!carte?.credit) return '';
  return carte.licence ? `${carte.credit} — ${carte.licence}` : carte.credit;
}
