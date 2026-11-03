/**
 * Fiches de personnage associées à un donjon. Module PUR (sans DOM ni stockage), testable sous Node.
 *
 * Une fiche vit dans l'outil Fiche, souvent sur le téléphone du joueur, et il n'y a pas de réseau : le donjon en garde donc
 * une COPIE résumée, relue par liste blanche. Elle part avec le donjon (export, copier-coller, modèle) ; le MJ l'actualise à la
 * demande si la fiche est dans le même navigateur, ou la remplace par un nouveau fichier.
 *
 *   donjon.personnages : [{ id, source?, fiche }]   source : identifiant de la fiche dans ce navigateur, pour l'actualiser
 *
 * SÉCURITÉ : rien de tout cela ne part à la table : `vueTable` et `miniPlanTable` ne lisent pas `personnages`.
 */
export const STATS = ['FOR', 'DEX', 'CON', 'INT', 'SAG', 'CHA'];
const MAX_PERSONNAGES = 30;
const MAX_LISTE = 60;     // attaques, objets, états : une fiche abîmée ne remplit pas le stockage
const MAX_TEXTE = 80;

const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const texte = (v, max = MAX_TEXTE) => (typeof v === 'string' || typeof v === 'number' ? String(v).slice(0, max) : '');
const nombre = (v, defaut = 0) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : defaut);
const liste = (v) => (Array.isArray(v) ? v.filter(estObjet).slice(0, MAX_LISTE) : []);

/** Résumé d'une fiche, par liste blanche. @returns {object|null}  null : ce n'est pas une fiche de personnage */
export function resumerFiche(brut) {
  if (!estObjet(brut) || !estObjet(brut.stats)) return null;
  return {
    nom: texte(brut.name ?? brut.nom).trim() || 'Personnage',
    race: texte(brut.race), classe: texte(brut.cls ?? brut.classe), niveau: nombre(brut.lvl ?? brut.niveau, 1),
    pv: nombre(brut.hp ?? brut.pv), pvMax: nombre(brut.hpMax ?? brut.pvMax), pvTemp: nombre(brut.tmp ?? brut.pvTemp),
    ca: nombre(brut.ac ?? brut.ca, 10), vitesse: nombre(brut.speed ?? brut.vitesse), initiative: nombre(brut.init ?? brut.initiative),
    stats: Object.fromEntries(STATS.map((s) => [s, nombre(brut.stats[s], 10)])),
    etats: (Array.isArray(brut.conds ?? brut.etats) ? brut.conds ?? brut.etats : []).map((c) => texte(c)).filter(Boolean).slice(0, MAX_LISTE),
    attaques: liste(brut.attacks ?? brut.attaques).map((a) => ({ nom: texte(a.n ?? a.nom), toucher: nombre(a.hit ?? a.toucher), degats: texte(a.dmg ?? a.degats), note: texte(a.note) })),
    sac: liste(brut.inv ?? brut.sac).map((o) => ({ nom: texte(o.n ?? o.nom), quantite: nombre(o.q ?? o.quantite, 1) })),
  };
}

/** Une fiche lue dans un fichier exporté par l'outil Fiche (`{format:'fiche-partie', personnage}`) ou brute. */
export function ficheDepuisFichier(brut) {
  if (brut?.format === 'fiche-partie') return Number(brut.version) > 1 ? null : resumerFiche(brut.personnage);
  return resumerFiche(brut);
}

/** Les fiches de l'outil Fiche, telles qu'enregistrées dans ce navigateur : [{ source, fiche }]. */
export function fichesDuNavigateur(brut) {
  if (!estObjet(brut?.persos)) return [];
  return Object.entries(brut.persos).flatMap(([source, p]) => { const fiche = resumerFiche(p); return fiche ? [{ source, fiche }] : []; });
}

const nouvelId = (pris) => {
  let id;
  do id = `pj-${Math.random().toString(36).slice(2, 8).padEnd(6, '0')}`; while (pris.includes(id));
  return id;
};

/** Relit les personnages d'un donjon (fichier, stockage) : ce qui n'est pas exploitable est écarté. */
export function validerPersonnages(brut) {
  if (!Array.isArray(brut)) return [];
  const pris = [];
  const res = [];
  for (const p of brut.slice(0, MAX_PERSONNAGES)) {
    if (!estObjet(p) || !estObjet(p.fiche)) continue;
    const fiche = resumerFiche(p.fiche);
    if (!fiche) continue;
    const id = typeof p.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(p.id) && !pris.includes(p.id) ? p.id : nouvelId(pris);
    pris.push(id);
    res.push({ id, ...(typeof p.source === 'string' && p.source ? { source: p.source.slice(0, 64) } : {}), fiche });
  }
  return res;
}

/**
 * Associe une fiche au donjon ; la même fiche du navigateur (même `source`) est remplacée, pas ajoutée deux fois.
 * @returns {object|null} le personnage, ou null si le donjon en a déjà le maximum
 */
export function ajouterPersonnage(d, fiche, source) {
  const persos = d.personnages || [];
  const existant = source ? persos.find((p) => p.source === source) : null;
  if (existant) { existant.fiche = fiche; return existant; }
  if (persos.length >= MAX_PERSONNAGES) return null;
  const p = { id: nouvelId(persos.map((x) => x.id)), ...(source ? { source } : {}), fiche };
  d.personnages = [...persos, p];
  return p;
}

export function retirerPersonnage(d, id) {
  const reste = (d.personnages || []).filter((p) => p.id !== id);
  if (reste.length) d.personnages = reste;
  else delete d.personnages;
}

/** Recopie les fiches encore présentes dans ce navigateur. @returns {number} le nombre de personnages actualisés */
export function actualiserPersonnages(d, locales) {
  let n = 0;
  for (const p of d.personnages || []) {
    const locale = p.source && locales.find((l) => l.source === p.source);
    if (locale) { p.fiche = locale.fiche; n++; }
  }
  return n;
}
