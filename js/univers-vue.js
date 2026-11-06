/**
 * Petites règles pures de l'écran Monde (js/mj/univers-ui.js) : adresse d'ouverture directe, niveaux où l'on cale une grille,
 * genre d'une destination, nom d'un lieu créé depuis un point, durée d'une notification. Aucun DOM ici : testé sous Node.
 */

/** Niveaux de carte (identifiants de la bibliothèque) à l'échelle des figurines : seuls ceux-là reçoivent une grille calée. */
export const NIVEAUX_AVEC_GRILLE = ['zone', 'localite', 'batiment', 'souterrain'];

/** Peut-on caler une grille sur cette carte ? Un niveau absent (image importée) : oui ; continent et région : non. */
export function calagePossible(niveau) {
  if (niveau === undefined || niveau === null || niveau === '') return true;
  return NIVEAUX_AVEC_GRILLE.includes(niveau);
}

/** `#monde` → { id: null } ; `#monde=<id>` → { id } (un `&lieu=<id>` à la suite est ignoré ici : voir js/atelier-route.js) ; toute autre adresse → null. */
export function analyserHash(hash) {
  const m = /^#monde(?:=([^&]*))?(?:&.*)?$/.exec(String(hash ?? ''));
  if (!m) return null;
  let id = null;
  if (m[1]) { try { id = decodeURIComponent(m[1]) || null; } catch { id = null; } }
  return { id };
}

/** L'adresse qui ouvre l'écran Monde (sur ce monde si `id` est donné). */
export const hashMonde = (id) => (id ? `#monde=${encodeURIComponent(id)}` : '#monde');


/** Le genre d'une destination de point : '' (rien), 'carte' (un lieu) ou 'donjon'. */
export function genreDestination(vers) {
  if (!vers) return '';
  return vers.lieu !== undefined ? 'carte' : 'donjon';
}

/** Le nom d'un lieu créé depuis un point : celui du point s'il en a un, sinon le titre de l'image choisie. */
export function nomDuNouveauLieu(nomPoint, titreImage) {
  const p = String(nomPoint ?? '').trim();
  return p || String(titreImage ?? '').trim() || undefined;
}

/** Combien de temps une notification reste affichée (ms) : plus longtemps si elle propose une action ou signale une erreur. */
export function dureeNotification(texte, { erreur = false, action = false } = {}) {
  const lecture = 3000 + String(texte ?? '').length * 40 + (action ? 4000 : 0); // de quoi lire, et de quoi cliquer
  return Math.min(action ? 14000 : erreur ? 9000 : 6000, Math.max(3500, lecture));
}

const nettoyer = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * L'arbre des lieux d'un monde, construit depuis ses points. Un lieu est l'enfant de la carte d'où part un point qui y mène ;
 * les donjons sont des feuilles (un par donjon et par lieu qui y mène). La racine est la carte du monde (le haut de l'arbre) ; `depart` marque le lieu où la partie commence (la racine, sauf si le monde en désigne un autre). Un lieu atteint par plusieurs
 * points n'apparaît qu'une fois, sous le premier parent trouvé en largeur depuis la racine, avec `aussiDepuis` (les autres lieux d'où
 * l'on y va, sans compter ses ancêtres : un point de retour n'est pas une seconde entrée) ; il n'y a donc jamais de boucle.
 * Les lieux qu'aucun chemin depuis la racine n'atteint sont rendus à part, dans `nonRelies` (à plat, avec leurs donjons).
 * Nœud : { cle, type: 'lieu'|'donjon', id, nom, depart, aussiDepuis: [noms], chemin: [clés des ancêtres], enfants: [] }
 * (un donjon porte aussi `lieu`, le lieu d'où l'on y va, et `salle`). `donjons` : { idDonjon: donjon } (ceux du navigateur) ; un donjon
 * disparu n'est pas listé (le point reste signalé orphelin dans le panneau du lieu).
 */
export function arbreLieux(univers, donjons = {}) {
  const lieux = univers?.lieux ?? {};
  const ids = Object.keys(lieux);
  const racineId = univers?.racine in lieux ? univers.racine : ids[0];
  const departId = typeof univers?.depart === 'string' && univers.depart in lieux ? univers.depart : racineId;
  const noeuds = new Map();
  const feuillesDonjon = (id, chemin) => {
    const vus = new Set();
    const feuilles = [];
    for (const p of lieux[id].points) {
      const idD = p.vers?.donjon;
      const d = idD !== undefined ? donjons[idD] : null;
      if (!d || vus.has(idD)) continue;
      vus.add(idD);
      feuilles.push({ cle: `d:${id}:${idD}`, type: 'donjon', id: idD, nom: d.nom ?? idD, lieu: id, ...(p.vers.salle ? { salle: p.vers.salle } : {}), depart: false, aussiDepuis: [], chemin, enfants: [] });
    }
    return feuilles;
  };
  const creer = (id, chemin) => {
    const n = { cle: `l:${id}`, type: 'lieu', id, nom: lieux[id].nom, depart: id === departId, aussiDepuis: [], chemin, enfants: [] };
    noeuds.set(id, n);
    return n;
  };
  const parent = new Map();
  let racine = null;
  if (racineId !== undefined) {
    racine = creer(racineId, []);
    const file = [racineId];
    for (let i = 0; i < file.length; i++) {
      const pere = noeuds.get(file[i]);
      for (const p of lieux[file[i]].points) {
        const cible = p.vers?.lieu;
        if (!(cible in lieux) || noeuds.has(cible)) continue;
        const n = creer(cible, [...pere.chemin, pere.cle]);
        parent.set(cible, file[i]);
        pere.enfants.push(n);
        file.push(cible);
      }
    }
    // Les autres entrées d'un lieu : un point d'un lieu qui n'est ni son parent ni un de ses descendants.
    const estAncetre = (anc, id) => { for (let c = id; c !== undefined; c = parent.get(c)) if (c === anc) return true; return false; };
    for (const id of noeuds.keys()) {
      for (const p of lieux[id].points) {
        const cible = p.vers?.lieu;
        const n = noeuds.get(cible);
        if (!n || cible === id || estAncetre(cible, id) || parent.get(cible) === id) continue;
        if (!n.aussiDepuis.includes(lieux[id].nom)) n.aussiDepuis.push(lieux[id].nom);
      }
    }
    for (const [id, n] of [...noeuds]) n.enfants.push(...feuillesDonjon(id, [...n.chemin, n.cle]));
  }
  const nonRelies = ids.filter((id) => !noeuds.has(id)).map((id) => {
    const n = creer(id, []);
    n.enfants.push(...feuillesDonjon(id, [n.cle]));
    return n;
  });
  return { racine, nonRelies };
}

/** Ne garde de l'arbre que les nœuds dont le nom contient `texte` (sans accents ni casse) et leurs ancêtres ; un texte vide rend l'arbre tel quel. */
export function filtrerArbre(arbre, texte) {
  const t = nettoyer(texte);
  if (!t) return arbre;
  const garde = (n) => {
    const enfants = n.enfants.map(garde).filter(Boolean);
    const trouve = nettoyer(n.nom).includes(t);
    return trouve || enfants.length ? { ...n, enfants, trouve } : null;
  };
  return { racine: arbre.racine ? garde(arbre.racine) : null, nonRelies: arbre.nonRelies.map(garde).filter(Boolean) };
}
