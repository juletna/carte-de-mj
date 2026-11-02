/**
 * Mini-carte : schéma des salles d'un donjon et de leurs liaisons, en SVG inline.
 *
 * Sans échelle : une salle = une case du schéma, quelle que soit sa taille réelle.
 * `disposerSalles` (pur, testable sous Node) place les salles : parcours depuis la
 * première salle en suivant la direction des portes (porte au nord → salle au-dessus).
 * Si la place est prise, la salle de départ et ce qui est de son côté reculent d'un cran :
 * une salle ne change jamais de côté. Salles non reliées à part, en dessous.
 * `dessinerMiniCarte` en fait un SVG focusable au clavier (Tab, Entrée ; les flèches passent à la salle voisine).
 * Un schéma plus grand que son cadre se déplace en le glissant à la souris (au doigt, le cadre défile déjà tout seul).
 */
import { liaisonsOrphelines } from './donjon.js';

const VECTEUR = { nord: [0, -1], sud: [0, 1], est: [1, 0], ouest: [-1, 0] };
const NS = 'http://www.w3.org/2000/svg';
const PAS_X = 120, PAS_Y = 70, LARG = 100, HAUT = 44, MARGE = 14, ETIQUETTE = 22;
const PAR_LIGNE_ISOLEES = 5;
const CIBLE = 44;          // taille tactile visée, en pixels écran (donc CIBLE / échelle en unités du schéma)
const ECHELLE_MIN = 0.65;  // en dessous, une zone de 70 unités (le pas entre deux lignes) ferait moins de 44 px

/** Salles voisines d'une salle : [{ vers, mur }] dans l'ordre des liaisons. */
function voisins(d, id) {
  const res = [];
  for (const l of d.liaisons) {
    if (l.a.salle === id) res.push({ vers: l.b.salle, mur: l.a.mur });
    else if (l.b.salle === id) res.push({ vers: l.a.salle, mur: l.b.mur });
  }
  return res.filter((v) => v.vers in d.salles);
}

/** Dispose les salles d'une composante connexe, relativement à sa racine. */
function disposerComposante(d, racine) {
  const pos = { [racine]: [0, 0] };
  const file = [racine];
  for (let i = 0; i < file.length; i++) {
    const id = file[i];
    for (const { vers, mur } of voisins(d, id)) {
      if (vers in pos) continue;
      const dir = VECTEUR[mur];
      const axe = dir[0] ? 0 : 1, sens = dir[axe];
      const cible = () => [pos[id][0] + dir[0], pos[id][1] + dir[1]];
      if (Object.values(pos).some((p) => p[0] === cible()[0] && p[1] === cible()[1])) {
        // Place prise : tout ce qui est du côté de la salle de départ recule d'un cran.
        const coupure = pos[id][axe];
        for (const p of Object.values(pos)) if (p[axe] * sens <= coupure * sens) p[axe] -= sens;
      }
      pos[vers] = cible();
      file.push(vers);
    }
  }
  return { ids: file, pos };
}

/**
 * @returns {{positions:Object<string,{col:number,ligne:number}>, colonnes:number, lignes:number, isolees:string[], ligneIsolees:number|null}}
 */
export function disposerSalles(d) {
  const ids = Object.keys(d.salles);
  const vus = new Set();
  const composantes = [];
  for (const id of ids) {
    if (vus.has(id)) continue;
    const c = disposerComposante(d, id);
    c.ids.forEach((x) => vus.add(x));
    composantes.push(c);
  }

  const positions = {};
  let ligne = 0, colonnes = 1;
  const reliees = composantes.filter((c, i) => i === 0 || c.ids.length > 1);
  const isolees = composantes.filter((c, i) => i > 0 && c.ids.length === 1).map((c) => c.ids[0]);
  for (const c of reliees) {
    const cols = c.ids.map((id) => c.pos[id][0]), lignes = c.ids.map((id) => c.pos[id][1]);
    const minC = Math.min(...cols), minL = Math.min(...lignes);
    for (const id of c.ids) positions[id] = { col: c.pos[id][0] - minC, ligne: c.pos[id][1] - minL + ligne };
    colonnes = Math.max(colonnes, Math.max(...cols) - minC + 1);
    ligne += Math.max(...lignes) - minL + 2; // une ligne vide entre deux blocs
  }
  let ligneIsolees = null;
  if (isolees.length) {
    ligneIsolees = ligne;
    isolees.forEach((id, i) => { positions[id] = { col: i % PAR_LIGNE_ISOLEES, ligne: ligne + Math.floor(i / PAR_LIGNE_ISOLEES) }; });
    colonnes = Math.max(colonnes, Math.min(isolees.length, PAR_LIGNE_ISOLEES));
    ligne += Math.ceil(isolees.length / PAR_LIGNE_ISOLEES);
  } else {
    ligne = Math.max(1, ligne - 1);
  }
  return { positions, colonnes, lignes: ligne, isolees, ligneIsolees };
}

/**
 * Salle la plus proche de `id` dans la direction d'une flèche, d'après les positions du schéma, ou null.
 * Une salle compte si elle est plus loin dans cette direction que de côté ; à distance égale, la mieux alignée gagne.
 * @param {Object<string,{col:number,ligne:number}>} positions
 * @param {string} id
 * @param {'nord'|'sud'|'est'|'ouest'} direction
 */
export function salleVoisine(positions, id, direction) {
  const [vx, vy] = VECTEUR[direction];
  const depart = positions[id];
  if (!depart) return null;
  let meilleure = null, score = Infinity;
  for (const [autre, p] of Object.entries(positions)) {
    if (autre === id) continue;
    const dx = p.col - depart.col, dy = p.ligne - depart.ligne;
    const avance = dx * vx + dy * vy, cote = Math.abs(dx * vy) + Math.abs(dy * vx);
    if (avance <= 0 || cote > avance) continue;
    const s = avance * 10 + cote;
    if (s < score) { score = s; meilleure = autre; }
  }
  return meilleure;
}

const FLECHES = { ArrowUp: 'nord', ArrowDown: 'sud', ArrowLeft: 'ouest', ArrowRight: 'est' };
const SEUIL_GLISSEMENT = 5; // px : en dessous, c'est un clic sur une salle

/** Déplace le schéma en glissant à la souris. Une seule fois par cadre : le schéma est redessiné, pas le cadre. */
function activerGlissement(conteneur) {
  if (conteneur.dataset.glissement) return;
  conteneur.dataset.glissement = 'oui';
  let prise = null;
  let ignorerClic = false;
  const bouger = (e) => {
    const dx = e.clientX - prise.x, dy = e.clientY - prise.y;
    if (!prise.glisse && Math.hypot(dx, dy) < SEUIL_GLISSEMENT) return;
    prise.glisse = true;
    conteneur.classList.add('glisse');
    conteneur.scrollLeft = prise.gauche - dx;
    conteneur.scrollTop = prise.haut - dy;
  };
  const lacher = () => {
    window.removeEventListener('pointermove', bouger);
    window.removeEventListener('pointerup', lacher);
    window.removeEventListener('pointercancel', lacher);
    conteneur.classList.remove('glisse');
    ignorerClic = prise.glisse; // le clic qui suit le lâcher ne doit pas ouvrir une salle
    prise = null;
  };
  conteneur.addEventListener('pointerdown', (e) => {
    const deborde = conteneur.scrollWidth > conteneur.clientWidth || conteneur.scrollHeight > conteneur.clientHeight;
    if (e.pointerType !== 'mouse' || e.button !== 0 || !deborde) return;
    ignorerClic = false;
    prise = { x: e.clientX, y: e.clientY, gauche: conteneur.scrollLeft, haut: conteneur.scrollTop, glisse: false };
    window.addEventListener('pointermove', bouger);
    window.addEventListener('pointerup', lacher);
    window.addEventListener('pointercancel', lacher);
  });
  conteneur.addEventListener('click', (e) => {
    if (!ignorerClic) return;
    ignorerClic = false;
    e.stopPropagation();
  }, true);
}

const el = (nom, attrs = {}, texte) => {
  const e = document.createElementNS(NS, nom);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (texte !== undefined) e.textContent = texte; // jamais de innerHTML : les noms peuvent venir d'un fichier importé
  return e;
};
const tronque = (s, n = 13) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * Remplace le contenu de `conteneur` par le schéma.
 * @param {HTMLElement} conteneur
 * @param {object} donjon
 * @param {{actif:string, onChoisir:(id:string)=>void, focus?:string, decouvertes?:string[], courante?:string}} options
 *        focus = salle à qui rendre le focus clavier après le redessin
 *        decouvertes (Présentation) : salles déjà montrées ; les autres sont dessinées en pointillés,
 *          avec la mention « non découverte » (le MJ les voit et les clique quand même)
 *        courante (Présentation) : salle actuellement à la table, repérée par une étiquette « TABLE »
 */
export function dessinerMiniCarte(conteneur, donjon, { actif, onChoisir, focus, decouvertes, courante }) {
  const vues = decouvertes ? new Set(decouvertes) : null;
  const { positions, colonnes, lignes, isolees, ligneIsolees } = disposerSalles(donjon);
  const extra = isolees.length ? ETIQUETTE : 0;
  const L = colonnes * PAS_X + 2 * MARGE - (PAS_X - LARG);
  const H = lignes * PAS_Y + 2 * MARGE - (PAS_Y - HAUT) + extra;
  const centre = (id) => {
    const p = positions[id];
    const decalage = ligneIsolees !== null && p.ligne >= ligneIsolees ? extra : 0;
    return [MARGE + p.col * PAS_X + LARG / 2, MARGE + p.ligne * PAS_Y + HAUT / 2 + decalage];
  };

  // Lisible même avec beaucoup de salles : réduit un peu si besoin, défile sinon (dans le conteneur).
  const echelle = Math.max(ECHELLE_MIN, Math.min(1, (conteneur.clientWidth || 320) / L));
  const svg = el('svg', {
    viewBox: `0 0 ${L} ${H}`, width: Math.round(L * echelle), height: Math.round(H * echelle),
    role: 'group', 'aria-label': 'Plan du donjon : salles et liaisons',
  });
  svg.classList.add('minicarte-svg');

  const orphelines = new Set(liaisonsOrphelines(donjon).map((o) => o.liaison.id));
  const liens = el('g');
  for (const l of donjon.liaisons) {
    if (!(l.a.salle in positions) || !(l.b.salle in positions)) continue;
    const [x1, y1] = centre(l.a.salle), [x2, y2] = centre(l.b.salle);
    const ligneLien = el('line', { x1, y1, x2, y2, class: orphelines.has(l.id) ? 'lien orpheline' : 'lien' });
    ligneLien.append(el('title', {}, orphelines.has(l.id) ? 'Liaison orpheline : une porte a disparu' : 'Liaison'));
    liens.append(ligneLien);
  }
  svg.append(liens);

  if (ligneIsolees !== null) {
    svg.append(el('text', { x: MARGE, y: MARGE + ligneIsolees * PAS_Y + 8, class: 'etiquette' }, 'Salles non reliées'));
  }

  let aFocaliser = null;
  for (const [id, salle] of Object.entries(donjon.salles)) {
    const [cx, cy] = centre(id);
    const inconnue = vues && !vues.has(id);
    const surTable = courante === id;
    const etats = [id === actif ? 'salle affichée' : '', surTable ? 'à la table' : '', inconnue ? 'non découverte' : vues ? 'découverte' : ''].filter(Boolean);
    const g = el('g', {
      class: ['salle', id === actif ? 'actif' : '', inconnue ? 'inconnue' : '', surTable ? 'table' : ''].filter(Boolean).join(' '),
      tabindex: '0', role: 'button', 'data-salle': id,
      'aria-label': `${salle.nom}${etats.length ? ` (${etats.join(', ')})` : ''}`,
    });
    if (id === actif) g.setAttribute('aria-current', 'true');
    g.append(el('title', {}, `${salle.nom}${etats.length ? ` : ${etats.join(', ')}` : ''}`));
    // Zone cliquable invisible : au moins 44 px à l'écran, sans dépasser le pas entre salles (pas de chevauchement).
    const zoneL = Math.max(LARG, CIBLE / echelle), zoneH = Math.min(PAS_Y, Math.max(HAUT, CIBLE / echelle));
    g.append(el('rect', { x: cx - zoneL / 2, y: cy - zoneH / 2, width: zoneL, height: zoneH, style: 'fill: transparent; stroke: none' }));
    g.append(el('rect', { x: cx - LARG / 2, y: cy - HAUT / 2, width: LARG, height: HAUT, rx: 8 }));
    g.append(el('text', { x: cx, y: cy + (vues ? 1 : 5), 'text-anchor': 'middle' }, tronque(salle.nom)));
    if (vues) g.append(el('text', { x: cx, y: cy + 16, 'text-anchor': 'middle', class: 'statut' }, inconnue ? 'non découverte' : 'découverte'));
    if (surTable) g.append(el('text', { x: cx - LARG / 2 + 6, y: cy - HAUT / 2 - 4, class: 'etiquette-table' }, '▶ TABLE'));
    // Repères de portes : un point sur le mur de chaque liaison.
    for (const l of donjon.liaisons) {
      for (const e of [l.a, l.b]) {
        if (e.salle !== id) continue;
        const [vx, vy] = VECTEUR[e.mur];
        g.append(el('circle', { cx: cx + vx * LARG / 2, cy: cy + vy * HAUT / 2, r: 4, class: 'porte' }));
      }
    }
    g.addEventListener('click', () => onChoisir(id));
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChoisir(id); return; }
      if (!FLECHES[e.key]) return;
      e.preventDefault(); // sinon le cadre défilerait au lieu de changer de salle
      const voisine = salleVoisine(positions, id, FLECHES[e.key]);
      if (voisine) svg.querySelector(`[data-salle="${CSS.escape(voisine)}"]`)?.focus();
    });
    svg.append(g);
    if (id === focus) aFocaliser = g;
  }

  conteneur.replaceChildren(svg);
  activerGlissement(conteneur);
  aFocaliser?.focus();
}
