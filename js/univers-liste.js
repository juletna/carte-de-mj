/**
 * Règles pures de la liste déroulante maison (js/mj/univers-liste.js) : quelle option prend le focus quand on tape une touche,
 * ou une lettre. Sans DOM, testé sous Node. Une option désactivée (« lieu disparu ») se voit mais ne se choisit pas.
 *   indexApresTouche('ArrowDown', 2, [false, false, true, false]) → 3
 *   indexParFrappe(['Auberge', 'Bois'], 'bo')                       → 1
 */

const sansAccent = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** L'index visé par ArrowDown/ArrowUp/Home/End parmi les options non désactivées, ou -1 s'il n'y en a aucune. Sans bouclage. */
export function indexApresTouche(touche, courant, desactives) {
  const libres = [];
  for (let i = 0; i < desactives.length; i++) if (!desactives[i]) libres.push(i);
  if (!libres.length) return -1;
  if (touche === 'Home') return libres[0];
  if (touche === 'End') return libres.at(-1);
  if (touche === 'ArrowDown') return libres.find((i) => i > courant) ?? libres.at(-1);
  if (touche === 'ArrowUp') return [...libres].reverse().find((i) => i < courant) ?? libres[0];
  return courant;
}

/** La première option dont le libellé commence par `frappe` (sans accents ni casse), en partant après `depuis` puis en bouclant. -1 si aucune. */
export function indexParFrappe(libelles, frappe, desactives = [], depuis = -1) {
  const f = sansAccent(frappe).trim();
  if (!f) return -1;
  const n = libelles.length;
  for (let k = 1; k <= n; k++) {
    const i = (depuis + k + n) % n;
    if (!desactives[i] && sansAccent(libelles[i]).startsWith(f)) return i;
  }
  return -1;
}
