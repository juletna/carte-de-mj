/**
 * Morceaux partagés par la fenêtre « Choisir une carte » (index.js) et la page Bibliothèque (page-bibliotheque.js) :
 * la fiche d'une carte (détail), les champs du formulaire d'import, le message d'une liste vide.
 */
import { h } from '../dom.js';
import { creditAffiche } from './catalogue.js';
import { NIVEAUX, MILIEUX, libelleNiveau, libelleMilieu } from './vocabulaire.js';

export const MESSAGE_VIDE = 'Aucune carte pour l’instant. Importe une image (webp, png, jpg ou svg), fais-la illustrer par une IA (« Générer une illustration IA » sur la page Bibliothèque), ou lance le skill « generer-carte » de Claude Code : ses cartes arrivent ici par le dossier de travail (bouton « Sauvegarde »).';

/** Titre, niveau et milieux, taille, description, tags, crédit et licence d'une carte. */
export function ficheCarte(e) {
  const lignes = [h('strong', { textContent: e.titre }), h('span', { textContent: `${libelleNiveau(e.niveau)}${e.milieux?.length ? ' · ' + e.milieux.map(libelleMilieu).join(', ') : ''}` })];
  if (e.largeur && e.hauteur) lignes.push(h('span', { className: 'bib-doux', textContent: `${e.largeur} × ${e.hauteur} px` }));
  if (e.description) lignes.push(h('span', { textContent: e.description }));
  if (e.tags?.length) lignes.push(h('span', { className: 'bib-doux', textContent: 'Tags : ' + e.tags.join(', ') }));
  if (e.origine?.type === 'generee') lignes.push(h('span', { className: 'bib-doux', textContent: `Illustration IA${e.origine.le ? ` · ${e.origine.le}` : ''}` }));
  const credit = creditAffiche(e);
  if (credit) lignes.push(h('span', { className: 'bib-credit', textContent: `Crédit : ${credit}` }));
  else if (e.licence) lignes.push(h('span', { className: 'bib-doux', textContent: `Licence : ${e.licence}` }));
  return h('div', { className: 'bib-fiche' }, ...lignes);
}

/**
 * Les champs du formulaire d'import : { titre, niveau, milieux, tags, description, credit, licence, elements }.
 * `elements` : étiquettes et champs dans l'ordre d'affichage. `pre` : valeurs de départ (niveau, description).
 */
export function champsImport(fichier, pre = {}) {
  const titre = h('input', { type: 'text', value: fichier.name.replace(/\.[^.]+$/, '').slice(0, 120), maxLength: 120, id: 'bib-f-titre' });
  const niveau = h('select', { id: 'bib-f-niveau' }, ...NIVEAUX.map((n) => h('option', { value: n.id, textContent: n.libelle })));
  niveau.value = pre.niveau || 'zone';
  const milieux = MILIEUX.map((m) => h('label', { className: 'bib-case' }, h('input', { type: 'checkbox', value: m.id }), ` ${m.libelle}`));
  const tags = h('input', { type: 'text', placeholder: 'tags séparés par des virgules', id: 'bib-f-tags' });
  const description = h('textarea', { rows: 2, maxLength: 600, id: 'bib-f-description', value: pre.description ?? '' });
  const credit = h('input', { type: 'text', maxLength: 200, id: 'bib-f-credit', placeholder: 'auteur ou source, si ce n’est pas toi' });
  const licence = h('input', { type: 'text', maxLength: 80, id: 'bib-f-licence', placeholder: 'par exemple CC BY 4.0' });
  const elements = [
    h('label', { htmlFor: 'bib-f-titre', textContent: 'Titre' }), titre,
    h('label', { htmlFor: 'bib-f-niveau', textContent: 'Niveau' }), niveau,
    h('fieldset', {}, h('legend', { textContent: 'Milieux' }), h('div', { className: 'bib-cases' }, ...milieux)),
    h('label', { htmlFor: 'bib-f-tags', textContent: 'Tags' }), tags,
    h('label', { htmlFor: 'bib-f-description', textContent: 'Description' }), description,
    h('label', { htmlFor: 'bib-f-credit', textContent: 'Crédit' }), credit,
    h('label', { htmlFor: 'bib-f-licence', textContent: 'Licence' }), licence,
  ];
  return { titre, niveau, milieux, tags, description, credit, licence, elements };
}

/** Les métadonnées saisies, pour importerImage. */
export function metaImport(c) {
  return {
    titre: c.titre.value, niveau: c.niveau.value, tags: c.tags.value.split(',').map((t) => t.trim()).filter(Boolean),
    milieux: c.milieux.filter((l) => l.firstChild.checked).map((l) => l.firstChild.value),
    description: c.description.value, credit: c.credit.value, licence: c.licence.value,
  };
}
