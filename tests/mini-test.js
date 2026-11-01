/**
 * Micro-outil de test, sans dépendance : marche dans le navigateur
 * (tests.html) comme sous Node (node tests/node.mjs).
 *
 * Les attentes sont PARTIELLES : on ne vérifie que les champs écrits.
 *   largeur, longueur, sol, nom      égalité stricte
 *   compter: { pilier: 4 }           nombre d'objets par type (et aucun autre type)
 *   portes: [{ mur: 'sud' }]         les portes, dans l'ordre, champs donnés
 *   objets: [{ type, x, y }]         chaque objet décrit doit exister dans le plan
 *   ignores: ['immobile']            mots signalés comme non compris
 *   verifier(plan) → true | message  vérification libre
 */
export function comparer(resultat, attendu) {
  const { plan, ignores } = resultat;
  const ecarts = [];

  for (const champ of ['largeur', 'longueur', 'sol', 'nom']) {
    if (champ in attendu && plan[champ] !== attendu[champ]) {
      ecarts.push(`${champ} : attendu ${attendu[champ]}, obtenu ${plan[champ]}`);
    }
  }

  if (attendu.compter) {
    const reel = {};
    for (const o of plan.objets) reel[o.type] = (reel[o.type] || 0) + 1;
    const types = new Set([...Object.keys(reel), ...Object.keys(attendu.compter)]);
    for (const t of types) {
      if ((reel[t] || 0) !== (attendu.compter[t] || 0)) ecarts.push(`${t} : attendu ${attendu.compter[t] || 0}, obtenu ${reel[t] || 0}`);
    }
  }

  if (attendu.portes) {
    if (plan.portes.length !== attendu.portes.length) ecarts.push(`portes : attendu ${attendu.portes.length}, obtenu ${plan.portes.length}`);
    attendu.portes.forEach((p, i) => {
      for (const [k, v] of Object.entries(p)) {
        if (plan.portes[i]?.[k] !== v) ecarts.push(`porte ${i + 1}.${k} : attendu ${v}, obtenu ${plan.portes[i]?.[k]}`);
      }
    });
  }

  for (const o of attendu.objets || []) {
    const ok = plan.objets.some((r) => Object.entries(o).every(([k, v]) => r[k] === v));
    if (!ok) ecarts.push(`objet introuvable : ${JSON.stringify(o)}`);
  }

  if (attendu.ignores) {
    const a = [...attendu.ignores].sort().join(','), b = [...ignores].sort().join(',');
    if (a !== b) ecarts.push(`mots ignorés : attendu [${a}], obtenu [${b}]`);
  }

  if (attendu.verifier) {
    const r = attendu.verifier(plan);
    if (r !== true) ecarts.push(typeof r === 'string' ? r : 'vérification libre échouée');
  }

  return ecarts;
}
