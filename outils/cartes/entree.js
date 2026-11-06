/**
 * Entrées de la liste de cartes de l'appli : `images/index.json` du dossier de travail (format : docs/conception-univers.md, section 2).
 * Construction et validation d'une entrée, ajout à un index sans rien écraser. Module pur ; les champs descriptifs sont validés
 * par `validerCarte` de js/bibliotheque/catalogue.js, la même règle que l'appli.
 */
import { validerCarte } from '../../js/bibliotheque/catalogue.js';
import { STYLE_PAR_DEFAUT } from './prompt.js';

const RE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RE_FICHIER = /^images\/[A-Za-z0-9_.-]+$/;
/** Types admis, par extension du fichier (jpeg est écrit jpg, comme le fait l'appli). */
export const TYPES_PAR_EXTENSION = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', svg: 'image/svg+xml' };

export function indexVide() { return []; }

/** L'extension normalisée (webp, png, jpg, svg) d'un chemin, ou null. */
export function extensionDe(chemin) {
  const e = typeof chemin === 'string' ? chemin.split('.').pop().toLowerCase() : '';
  const n = e === 'jpeg' ? 'jpg' : e;
  return TYPES_PAR_EXTENSION[n] ? n : null;
}

/**
 * Construit l'entrée complète de l'index à partir de l'entrée du skill.
 * `contexte` : { extension, largeur, hauteur } (déduits du fichier image), `maintenant` (Date, pour `ajoute`).
 * Rend { entree } ou { problemes }.
 */
export function construireEntree(brut, { extension, largeur, hauteur, maintenant = new Date() } = {}) {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return { problemes: ['entrée absente'] };
  const p = [];
  if (typeof brut.id !== 'string' || !RE_ID.test(brut.id) || brut.id.length > 64) p.push('id : minuscules, chiffres et tirets, 64 caractères au plus');
  if (!TYPES_PAR_EXTENSION[extension]) p.push(`fichier : extension parmi ${Object.keys(TYPES_PAR_EXTENSION).join(', ')}`);
  const l = brut.largeur ?? largeur, h = brut.hauteur ?? hauteur;
  if (!Number.isInteger(l) || l <= 0 || !Number.isInteger(h) || h <= 0) p.push('largeur et hauteur : entiers positifs (à donner dans l\'entrée si elles ne se lisent pas dans le fichier)');
  const avecOrigine = { ...brut, origine: brut.origine ?? { type: 'generee', outil: 'gpt-image-1', style: STYLE_PAR_DEFAUT, le: maintenant.toISOString().slice(0, 10) } };
  const { carte, erreur } = validerCarte({ ...avecOrigine, licence: brut.licence ?? 'libre', credit: brut.credit ?? '' }, { avecFichier: false });
  if (erreur) p.push(erreur);
  else if (brut.grille !== undefined && !carte.grille) p.push('grille : { case entre 4 et 2000, dx, dy }');
  else if (brut.origine !== undefined && !carte.origine) p.push('origine.type : generee, importee ou externe');
  if (p.length) return { problemes: p };
  const { titre, niveau, milieux, tags, description, licence, credit, grille, origine } = carte;
  const entree = { id: brut.id, nom: `${brut.id}.${extension}`, type: TYPES_PAR_EXTENSION[extension], largeur: l, hauteur: h, ajoute: maintenant.toISOString(), titre, niveau, milieux, tags, description, licence, credit };
  if (grille) entree.grille = grille;
  entree.origine = origine;
  entree.fichier = `images/${brut.id}.${extension}`;
  return { entree };
}

/**
 * Ajoute l'entrée à l'index sans rien écraser (les entrées déjà là, même étrangères, sont gardées telles quelles).
 * `fichiersExistants` : chemins déjà présents dans images/ (« images/x.png »). Rend { index } ou { problemes }.
 */
export function ajouterALIndex(index, entree, { fichiersExistants = [] } = {}) {
  if (!Array.isArray(index)) return { problemes: ['index illisible : non modifié'] };
  const p = [];
  if (!entree || typeof entree.id !== 'string' || !RE_ID.test(entree.id) || entree.id.length > 64) p.push('id invalide');
  if (!entree || typeof entree.fichier !== 'string' || !RE_FICHIER.test(entree.fichier)) p.push('fichier : images/<id>.<extension>');
  if (p.length) return { problemes: p };
  if (index.some((c) => c?.id === entree.id)) p.push(`id « ${entree.id} » déjà pris dans l'index`);
  if (index.some((c) => c?.fichier === entree.fichier)) p.push(`fichier « ${entree.fichier} » déjà dans l'index`);
  if (fichiersExistants.some((f) => f === entree.fichier || f.startsWith(`images/${entree.id}.`))) p.push(`un fichier images/${entree.id}.* existe déjà : rien n'est écrasé`);
  if (p.length) return { problemes: p };
  return { index: [...index, entree] };
}
