/**
 * Micro-outil de test, sans dépendance : marche dans le navigateur
 * (tests.html) comme sous Node (node tests/node.mjs).
 *
 * Harnais commun des suites (`*.test.js`) :
 *   verifier(condition, message)    lève une Error si la condition est fausse
 *   egal(obtenu, attendu, quoi)     égalité profonde (par JSON), le message dit ce qui était comparé
 *   fauxStock(initial)              localStorage simulé, pour tester le stockage sans navigateur
 *   executerSuite(prefixe, tests)   joue des [nom, test] ; un test lève une Error au premier écart
 *
 * Les attentes sont PARTIELLES : on ne vérifie que les champs écrits.
 *   largeur, longueur, sol, nom      égalité stricte
 *   compter: { pilier: 4 }           nombre d'objets par type (et aucun autre type)
 *   portes: [{ mur: 'sud' }]         les portes, dans l'ordre, champs donnés
 *   objets: [{ type, x, y }]         chaque objet décrit doit exister dans le plan
 *   ignores: ['immobile']            mots signalés comme non compris
 *   compris: ['mur est']             morceaux de texte attendus dans le panneau « Compris »
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

  for (const morceau of attendu.compris || []) {
    if (!resultat.compris.some((l) => l.includes(morceau))) ecarts.push(`« compris » devrait contenir « ${morceau} » : ${resultat.compris.join(' | ')}`);
  }

  if (attendu.verifier) {
    const r = attendu.verifier(plan);
    if (r !== true) ecarts.push(typeof r === 'string' ? r : 'vérification libre échouée');
  }

  return ecarts;
}

/** Condition fausse : lève une Error avec le message donné. */
export function verifier(condition, message) { if (!condition) throw new Error(message); }

/** Égalité profonde (comparaison des JSON) ; `quoi` nomme ce qui est comparé. */
export function egal(obtenu, attendu, quoi) {
  const a = JSON.stringify(obtenu), b = JSON.stringify(attendu);
  if (a !== b) throw new Error(`${quoi} : attendu ${b}, obtenu ${a}`);
}

/** Faux localStorage : `donnees` expose le contenu pour les vérifications. */
export function fauxStock(initial = {}) {
  const donnees = { ...initial };
  return { donnees, getItem: (k) => (k in donnees ? donnees[k] : null), setItem: (k, v) => { donnees[k] = String(v); }, removeItem: (k) => { delete donnees[k]; } };
}

/** Un contexte 2D qui accepte tout (et rend des dégradés vides) : de quoi faire tourner le moteur de rendu sans écran. */
export function ctxPermissif() {
  const degrade = () => ({ addColorStop() {} });
  return new Proxy({}, {
    get: (_, nom) => (typeof nom === 'symbol' ? undefined : nom === 'createRadialGradient' || nom === 'createLinearGradient' ? degrade : nom === 'measureText' ? (s) => ({ width: String(s).length * 6 }) : nom === 'createImageData' || nom === 'getImageData' ? (...a) => ({ data: new Uint8ClampedArray(Math.max(1, a[0] * a[1] * 4)) }) : () => {}),
    set: () => true,
  });
}

/**
 * Joue `f` dans un « écran simulé » identique sous Node et dans le navigateur : un OffscreenCanvas factice (le moteur en demande pour garder le décor ou
 * cuire une couche ; le vrai refuserait de recevoir les canevas simulés des tests) et une densité d'écran donnée (`window` est créé sous Node,
 * `devicePixelRatio` est redéfini dans le navigateur). Tout est remis comme avant ensuite.
 */
export function avecEcranSimule(f, dpr = 1) {
  const g = globalThis, offscreen = g.OffscreenCanvas, aFenetre = typeof g.window !== 'undefined';
  g.OffscreenCanvas = class { constructor(w, h) { this.width = w; this.height = h; this.ctx = ctxPermissif(); } getContext() { return this.ctx; } };
  let restaurer = () => {};
  if (!aFenetre) { g.window = { devicePixelRatio: dpr }; restaurer = () => { delete g.window; }; } else {
    const avant = Object.getOwnPropertyDescriptor(g.window, 'devicePixelRatio');
    try { Object.defineProperty(g.window, 'devicePixelRatio', { value: dpr, configurable: true, writable: true }); restaurer = () => { if (avant) Object.defineProperty(g.window, 'devicePixelRatio', avant); else delete g.window.devicePixelRatio; }; } catch { /* densité réelle */ }
  }
  try { return f(); } finally {
    restaurer();
    if (offscreen === undefined) delete g.OffscreenCanvas; else g.OffscreenCanvas = offscreen;
  }
}

/** Joue une suite de [nom, test] ; chaque résultat a la forme des autres suites : { phrase, ecarts, resultat }. `enveloppe(f)` entoure chaque test (ex. avecEcranSimule). */
export function executerSuite(prefixe, tests, enveloppe = (f) => f()) {
  return tests.map(([nom, test]) => {
    try {
      enveloppe(test);
      return { phrase: `${prefixe}${nom}`, ecarts: [], resultat: null };
    } catch (err) {
      return { phrase: `${prefixe}${nom}`, ecarts: [err.message], resultat: null };
    }
  });
}
