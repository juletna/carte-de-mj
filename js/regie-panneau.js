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
