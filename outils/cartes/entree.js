/**
 * Validation d'une entrée du catalogue (`bibliotheque/catalogue.json`), format de docs/conception-univers.md section 2.
 * Module pur. Mêmes règles que la validation de l'appli (js/bibliotheque), recopiées tant que ce module n'existe pas.
 */
import { NIVEAUX, MILIEUX, ORIGINES, EXTENSIONS } from './vocabulaire.js';
import { STYLE_PAR_DEFAUT } from './prompt.js';

export const FORMAT_CATALOGUE = 'carte-de-mj-bibliotheque';
const RE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function catalogueVide() { return { format: FORMAT_CATALOGUE, version: 1, cartes: [] }; }

/** Rend la liste des problèmes (vide si l'entrée est valide). `idsExistants` : ids déjà au catalogue. */
export function validerEntree(e, idsExistants = []) {
  const p = [];
  if (!e || typeof e !== 'object') return ['entrée absente'];
  if (typeof e.id !== 'string' || !RE_ID.test(e.id) || e.id.length > 64) p.push('id : minuscules, chiffres et tirets, 64 caractères au plus');
  else if (idsExistants.includes(e.id)) p.push(`id « ${e.id} » déjà pris`);
  if (typeof e.titre !== 'string' || !e.titre.trim()) p.push('titre manquant');
  const ext = typeof e.fichier === 'string' ? e.fichier.split('.').pop().toLowerCase() : '';
  if (typeof e.fichier !== 'string' || !e.fichier || e.fichier.includes('..') || e.fichier.startsWith('/') || !EXTENSIONS.includes(ext)) p.push(`fichier : chemin relatif sans « .. », extension parmi ${EXTENSIONS.join(', ')}`);
  for (const c of ['largeur', 'hauteur']) if (!Number.isInteger(e[c]) || e[c] <= 0) p.push(`${c} : entier positif`);
  if (!NIVEAUX.includes(e.niveau)) p.push(`niveau : un parmi ${NIVEAUX.join(', ')}`);
  if (!Array.isArray(e.milieux) || !e.milieux.length || e.milieux.some((m) => !MILIEUX.includes(m))) p.push(`milieux : au moins un parmi ${MILIEUX.join(', ')}`);
  if (!Array.isArray(e.tags) || e.tags.some((t) => typeof t !== 'string' || !t.trim())) p.push('tags : liste de mots');
  if (e.description !== undefined && typeof e.description !== 'string') p.push('description : texte');
  if (e.grille !== undefined && !(e.grille && e.grille.case > 0 && Number.isFinite(e.grille.dx) && Number.isFinite(e.grille.dy))) p.push('grille : { case > 0, dx, dy }');
  if (e.origine !== undefined && !(e.origine && ORIGINES.includes(e.origine.type))) p.push(`origine.type : un parmi ${ORIGINES.join(', ')}`);
  return p;
}

/** Normalise l'entrée (champs connus seulement, valeurs par défaut) avant validation et écriture. */
export function normaliserEntree(e) {
  const sortie = {
    id: e.id, titre: typeof e.titre === 'string' ? e.titre.trim() : e.titre, fichier: e.fichier, largeur: e.largeur, hauteur: e.hauteur,
    niveau: e.niveau, milieux: e.milieux, tags: e.tags ?? [], description: e.description ?? '',
  };
  if (e.grille) sortie.grille = e.grille;
  sortie.origine = e.origine ?? { type: 'generee', outil: 'gpt-image-1', style: STYLE_PAR_DEFAUT, le: new Date().toISOString().slice(0, 10) };
  sortie.licence = e.licence ?? 'libre';
  sortie.credit = e.credit ?? '';
  return sortie;
}

/** Ajoute l'entrée au catalogue sans rien écraser. Rend { catalogue } ou { problemes }. */
export function ajouterAuCatalogue(catalogue, entree) {
  if (!catalogue || catalogue.format !== FORMAT_CATALOGUE || !Array.isArray(catalogue.cartes)) return { problemes: ['catalogue illisible : non modifié'] };
  const e = normaliserEntree(entree);
  const problemes = validerEntree(e, catalogue.cartes.map((c) => c.id));
  if (problemes.length) return { problemes };
  return { catalogue: { ...catalogue, cartes: [...catalogue.cartes, e] } };
}
