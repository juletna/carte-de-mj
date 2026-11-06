/**
 * Le panneau de la régie : blocs repliables dont l'état est mémorisé (`<details data-memo="nom">`). Les aides longues sont des
 * `<details class="aide">` communs (css/base.css), sans script.
 * `lierPanneau()` est appelée une fois par regie.js ; les écouteurs restent attachés quand un bloc change de place.
 */
const CLE_REPLIS = 'carte-de-mj:regie-replis-v1';

const stock = () => { try { return globalThis.localStorage || null; } catch { return null; } };

/** Les blocs ouverts (vrai) ou repliés (faux) mémorisés, par nom. Tout ce qui n'est pas un booléen est ignoré. */
export function lireReplis(texte) {
  let brut = null;
  try { brut = JSON.parse(texte); } catch { /* rien de mémorisé, ou illisible */ }
  const replis = {};
  if (brut && typeof brut === 'object' && !Array.isArray(brut)) {
    for (const [cle, ouvert] of Object.entries(brut)) if (typeof ouvert === 'boolean') replis[cle] = ouvert;
  }
  return replis;
}

export function lierPanneau(racine = document) {
  let replis = {};
  try { replis = lireReplis(stock()?.getItem(CLE_REPLIS)); } catch { /* stockage bloqué */ }
  for (const bloc of racine.querySelectorAll('details[data-memo]')) {
    const nom = bloc.dataset.memo;
    if (nom in replis) bloc.open = replis[nom];
    bloc.addEventListener('toggle', () => {
      replis[nom] = bloc.open;
      try { stock()?.setItem(CLE_REPLIS, JSON.stringify(replis)); } catch { /* sans mémoire */ }
    });
  }
}

/**
 * Les onglets de la régie rangés en sections de panneau (js/atelier/section.js, docs/design-panneaux.md) : chaque bloc de
 * presentation.html passe dans le corps d'une section, sous son titre ; un bloc <details> y est gardé ouvert (son résumé est masqué
 * en CSS, le pli est celui de la section), un titre <h2> interne fait doublon et est masqué de même. Les identifiants ne changent pas :
 * regie.js et regie-selection.js retrouvent leurs nœuds. Appelée une fois, après `lierPanneau`.
 */
export function sectionnerOnglets(creerSection, $ = (id) => document.getElementById(id)) {
  const salle = $('onglet-salle'), joueurs = $('onglet-joueurs'), table = $('onglet-table');
  if (!salle || !joueurs || !table) return;
  const section = (cle, titre, blocs, options = {}) => {
    for (const b of blocs) if (b.tagName === 'DETAILS') b.open = true;
    return creerSection({ cle: `regie:${cle}`, titre, enfants: blocs, ...options }).element;
  };
  // Les nœuds sont pris AVANT d'être déplacés : une fois dans une section pas encore posée, `getElementById` ne les trouve plus.
  const [projection, elements, compteElements] = [$('projection'), $('elements-salle'), $('nb-elements')];
  const cetteSalle = salle.querySelector('.cette-salle'), notes = salle.querySelector('.bloc-notes');
  salle.replaceChildren(
    section('visibilite', 'Visible à la table', [projection]),
    section('salle', 'Cette salle', [cetteSalle]),
    section('elements', 'Éléments', [elements], { compte: compteElements }),
    section('notes', 'Notes', [notes]));
  const persos = joueurs.querySelector('section');
  const ajout = joueurs.querySelector('.ajout-joueur');
  joueurs.replaceChildren(
    section('personnages', 'Personnages', [persos]),
    section('ajout-joueur', 'Ajouter un joueur', [ajout], { repliee: true }));
  const [ecran, defilement] = table.querySelectorAll('.bloc-table > details.defilement');
  const reglages = table.querySelector('details.reglages');
  const blocTable = table.querySelector('.bloc-table');
  const avant = [...table.children].filter((e) => e !== blocTable && e !== reglages && !e.matches('p.note:last-child'));
  const pied = table.querySelector(':scope > p.note:last-child');
  table.replaceChildren(...avant,
    section('table', 'Table', [blocTable]),
    ...(ecran ? [section('ecran', 'Régler l’écran de table', [ecran], { repliee: true })] : []),
    ...(defilement ? [section('defilement', 'Faire défiler la vue table', [defilement], { repliee: true })] : []),
    ...(reglages ? [section('reglages', 'Réglages', [reglages], { repliee: true })] : []),
    ...(pied ? [pied] : []));
}
