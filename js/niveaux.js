/**
 * Les niveaux d'un donjon : une porte relie deux salles du même niveau, un escalier deux niveaux voisins.
 * Module PUR, sans DOM et sans parseur : le plan du donjon (plan-donjon.js), la table et l'impression le lisent ;
 * donjon.js le réexporte.
 *
 * Le niveau d'une salle n'est écrit nulle part : il se déduit des liaisons, en partant de la première salle (niveau 0).
 * Un escalier qui monte (`sens: 'monte'` dans le plan) mène au niveau du dessus ; sinon, il descend.
 */

/** Une extrémité de liaison d'escalier ({escalier: true, x, y}) ou un objet escalier du plan. */
export const estEscalier = (e) => !!e && (e.escalier === true || e.type === 'escalier');

/** L'objet escalier qui commence à la case (x, y) du plan, ou undefined. */
export const escalierEn = (plan, x, y) => (plan?.objets || []).find((o) => o.type === 'escalier' && o.x === x && o.y === y);

/**
 * Écart de niveau entre les deux salles d'une liaison, de `a` vers `b` : 0 pour une porte ; pour un escalier, +1 s'il
 * monte, −1 s'il descend. C'est l'escalier de `a` qui décide ; s'il a disparu (liaison orpheline), celui de `b`.
 */
export function ecartDeNiveau(d, l) {
  if (!estEscalier(l.a)) return 0;
  const ea = escalierEn(d.salles[l.a.salle]?.plan, l.a.x, l.a.y);
  if (ea) return ea.sens === 'monte' ? 1 : -1;
  const eb = escalierEn(d.salles[l.b.salle]?.plan, l.b.x, l.b.y);
  return eb ? (eb.sens === 'monte' ? -1 : 1) : 0;
}

/**
 * Le niveau de chaque salle : 0 pour la première salle, puis on suit les liaisons (une porte garde le niveau, un escalier
 * en change). Une salle qu'aucune liaison ne rattache à la première part de 0, comme le groupe qu'elle ouvre. Si deux
 * chemins ne s'accordent pas (deux escaliers qui descendent l'un vers l'autre), le premier trouvé l'emporte.
 * @returns {Object<string, number>}
 */
export function niveaux(d) {
  const res = {};
  const voisins = {};
  for (const l of d.liaisons || []) {
    if (!d.salles[l.a.salle] || !d.salles[l.b.salle]) continue;
    const e = ecartDeNiveau(d, l);
    (voisins[l.a.salle] ||= []).push([l.b.salle, e]);
    (voisins[l.b.salle] ||= []).push([l.a.salle, -e]);
  }
  for (const depart of Object.keys(d.salles)) {
    if (depart in res) continue;
    res[depart] = 0;
    const file = [depart];
    while (file.length) {
      const id = file.shift();
      for (const [vers, e] of voisins[id] || []) {
        if (vers in res) continue;
        res[vers] = res[id] + e;
        file.push(vers);
      }
    }
  }
  return res;
}

/** Le nom d'un niveau : « Rez-de-chaussée », « Étage 1 », « Sous-sol 2 ». */
export const nomNiveau = (n) => (n === 0 ? 'Rez-de-chaussée' : n > 0 ? `Étage ${n}` : `Sous-sol ${-n}`);
