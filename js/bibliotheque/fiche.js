/**
 * Morceaux partagés par la fenêtre « Choisir une carte » (index.js) et la page Bibliothèque (page-bibliotheque.js) :
 * la fiche d'une carte (détail), les champs du formulaire d'import, le message d'une liste vide.
 */
import { h } from '../dom.js';
import { creditAffiche } from './catalogue.js';
import { NIVEAUX, SOUS_TYPES, MILIEUX, libelleMilieu, libelleZoom, normaliserNiveau, SOUS_TYPE_PAR_DEFAUT } from './vocabulaire.js';

export const MESSAGE_VIDE = 'Aucune carte pour l’instant. Importe une image (webp, png, jpg ou svg), fais-la illustrer par une IA (« Générer une illustration IA » sur la page Bibliothèque), ou lance le skill « generer-carte » de Claude Code : ses cartes arrivent ici par le dossier de travail (bouton « Sauvegarde »).';

/**
 * Titre, niveau et milieux, taille, description, tags, crédit et licence d'une carte.
 * `titreDe(ref)` (facultatif) : le titre de l'image d'une référence { source, id } ou rien si elle n'existe plus, pour écrire « D'après : … ».
 */
export function ficheCarte(e, { titreDe } = {}) {
  const lignes = [h('strong', { textContent: e.titre }), h('span', { textContent: `${libelleZoom(e)}${e.milieux?.length ? ' · ' + e.milieux.map(libelleMilieu).join(', ') : ''}` })];
  if (e.largeur && e.hauteur) lignes.push(h('span', { className: 'bib-doux', textContent: `${e.largeur} × ${e.hauteur} px` }));
  if (e.description) lignes.push(h('span', { textContent: e.description }));
  if (e.tags?.length) lignes.push(h('span', { className: 'bib-doux', textContent: 'Tags : ' + e.tags.join(', ') }));
  if (e.origine?.type === 'generee') lignes.push(h('span', { className: 'bib-doux', textContent: `Illustration IA${e.origine.le ? ` · ${e.origine.le}` : ''}` }));
  const ref = e.origine?.reference;
  if (ref && titreDe) lignes.push(h('span', { className: 'bib-doux', textContent: titreDe(ref) ? `D’après : ${titreDe(ref)}` : 'D’après : image disparue' }));
  const credit = creditAffiche(e);
  if (credit) lignes.push(h('span', { className: 'bib-credit', textContent: `Crédit : ${credit}` }));
  else if (e.licence) lignes.push(h('span', { className: 'bib-doux', textContent: `Licence : ${e.licence}` }));
  return h('div', { className: 'bib-fiche' }, ...lignes);
}

/**
 * Les champs du formulaire d'import : { titre, niveau, sousType (d'un plateau), milieux, tags, description, credit, licence, elements }.
 * `elements` : étiquettes et champs dans l'ordre d'affichage. `pre` : valeurs de départ (niveau, sousType, titre, milieux, tags, description, credit, licence) ; à la modification d'une image, `fichier` n'est que { name }.
 */
export function champsImport(fichier, pre = {}) {
  const titre = h('input', { type: 'text', value: pre.titre ?? fichier.name.replace(/\.[^.]+$/, '').slice(0, 120), maxLength: 120, id: 'bib-f-titre' });
  const niveau = h('select', { id: 'bib-f-niveau' }, ...NIVEAUX.map((n) => h('option', { value: n.id, textContent: n.libelle })));
  const depart = normaliserNiveau({ niveau: pre.niveau || 'lieu', sousType: pre.sousType }) ?? { niveau: 'lieu' };
  niveau.value = depart.niveau;
  const sousType = h('select', { id: 'bib-f-sous-type' }, ...SOUS_TYPES.map((t) => h('option', { value: t.id, textContent: t.libelle })));
  sousType.value = depart.sousType ?? SOUS_TYPE_PAR_DEFAUT;
  const etiqSousType = h('label', { htmlFor: 'bib-f-sous-type', textContent: 'Plateau : extérieur, intérieur ou souterrain' });
  const majSousType = () => { sousType.hidden = etiqSousType.hidden = niveau.value !== 'plateau'; };
  niveau.addEventListener('change', majSousType);
  majSousType();
  const milieux = MILIEUX.map((m) => h('label', { className: 'bib-case' }, h('input', { type: 'checkbox', value: m.id, checked: !!pre.milieux?.includes(m.id) }), ` ${m.libelle}`));
  const tags = h('input', { type: 'text', placeholder: 'tags séparés par des virgules', id: 'bib-f-tags', value: (pre.tags ?? []).join(', ') });
  const description = h('textarea', { rows: 2, maxLength: 600, id: 'bib-f-description', value: pre.description ?? '' });
  const credit = h('input', { type: 'text', maxLength: 200, id: 'bib-f-credit', value: pre.credit ?? '', placeholder: 'auteur ou source, si ce n’est pas toi' });
  const licence = h('input', { type: 'text', maxLength: 80, id: 'bib-f-licence', value: pre.licence ?? '', placeholder: 'par exemple CC BY 4.0' });
  const elements = [
    h('label', { htmlFor: 'bib-f-titre', textContent: 'Titre' }), titre,
    h('label', { htmlFor: 'bib-f-niveau', textContent: 'Zoom' }), niveau,
    etiqSousType, sousType,
    h('fieldset', {}, h('legend', { textContent: 'Milieux' }), h('div', { className: 'bib-cases' }, ...milieux)),
    h('label', { htmlFor: 'bib-f-tags', textContent: 'Tags' }), tags,
    h('label', { htmlFor: 'bib-f-description', textContent: 'Description' }), description,
    h('label', { htmlFor: 'bib-f-credit', textContent: 'Crédit' }), credit,
    h('label', { htmlFor: 'bib-f-licence', textContent: 'Licence' }), licence,
  ];
  return { titre, niveau, sousType, milieux, tags, description, credit, licence, elements };
}

/** Le menu de filtre par zoom (Bibliothèque et fenêtre de choix) : tous, monde, lieu, plateau, puis chaque sous-type de plateau. Valeur : « niveau » ou « plateau/sous-type ». */
export function menuFiltreZoom(valeur = '') {
  const m = h('select', { 'aria-label': 'Zoom' }, h('option', { value: '', textContent: 'Tous les zooms' }),
    ...NIVEAUX.flatMap((n) => [h('option', { value: n.id, textContent: n.libelle }),
      ...(n.id === 'plateau' ? SOUS_TYPES.map((t) => h('option', { value: `plateau/${t.id}`, textContent: `Plateau · ${t.libelle}` })) : [])]));
  m.value = valeur;
  return m;
}
/** Valeur du menu de filtre → { niveau, sousType } pour `selectionner`. */
export function filtreDepuis(valeur) {
  const [niveau, sousType] = String(valeur || '').split('/');
  return { niveau: niveau || '', sousType: sousType || '' };
}

/** Les métadonnées saisies, pour importerImage. */
export function metaImport(c) {
  return {
    titre: c.titre.value, niveau: c.niveau.value, sousType: c.niveau.value === 'plateau' ? c.sousType.value : undefined, tags: c.tags.value.split(',').map((t) => t.trim()).filter(Boolean),
    milieux: c.milieux.filter((l) => l.firstChild.checked).map((l) => l.firstChild.value),
    description: c.description.value, credit: c.credit.value, licence: c.licence.value,
  };
}
