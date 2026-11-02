/**
 * Écran étroit (moins de 760 px) : onglets « Texte / Carte » (Donjon) et « Actions / Carte » (régie), et défilement
 * au doigt d'une carte plus grande que sa zone. Aucune règle de mise en page ici : tout est dans le CSS, sous la media
 * query de 760 px, et ne s'applique qu'une fois l'attribut `data-onglet` posé sur <body>. Au-dessus de 760 px (et sans
 * script) rien ne change : la barre d'onglets reste masquée et les deux zones sont affichées côte à côte.
 * Ne touche jamais aux réglages enregistrés : la carte est réduite par la taille de case, au moment de dessiner.
 */

export const LARGEUR_TELEPHONE = 760;
export const telephone = () => matchMedia(`(max-width: ${LARGEUR_TELEPHONE}px)`).matches;

/**
 * Branche la barre d'onglets : les boutons portent `data-onglet`, l'actif a `aria-pressed="true"`.
 * Chaque onglet retrouve sa position de défilement quand on y revient.
 * @param {HTMLElement} barre
 * @param {{ defaut: string, onChange?: (nom: string) => void }} options
 *   onChange : appelé après chaque changement, zone déjà affichée (pour redessiner la carte à la bonne taille)
 * @returns {{ afficher: (nom: string) => void, courant: () => string }}
 */
export function activerOnglets(barre, { defaut, onChange }) {
  const boutons = [...barre.querySelectorAll('button[data-onglet]')];
  const noms = boutons.map((b) => b.dataset.onglet);
  const positions = {};
  let courant = noms.includes(defaut) ? defaut : noms[0];

  function afficher(nom, { force = false } = {}) {
    if (!noms.includes(nom) || (nom === courant && !force)) return;
    positions[courant] = window.scrollY;
    courant = nom;
    document.body.dataset.onglet = nom;
    for (const b of boutons) b.setAttribute('aria-pressed', String(b.dataset.onglet === nom));
    window.scrollTo(0, positions[nom] || 0);
    onChange?.(nom);
  }
  for (const b of boutons) b.addEventListener('click', () => afficher(b.dataset.onglet));
  afficher(courant, { force: true });
  return { afficher, courant: () => courant };
}

/**
 * Au doigt, un glissement sur le canvas déplace un pion (`touch-action: none`) : il ne doit pas non plus empêcher de
 * faire défiler une carte qui dépasse sa zone. Quand elle dépasse, on rend donc le défilement au navigateur (classe
 * `defile`, `touch-action: pan-x pan-y` dans le CSS) ; quand elle tient, le glissement reste pour les pions.
 */
export function marquerDefilement(canvas, zone) {
  const depasse = zone.scrollWidth > zone.clientWidth + 1 || zone.scrollHeight > zone.clientHeight + 1;
  canvas.classList.toggle('defile', telephone() && depasse);
}

/**
 * Taille de case pour que la salle (`largeur` × `longueur` cases, plus une case de roche autour) tienne dans `zone`,
 * moins `marge` px de chaque côté, sans jamais dépasser `taille` (le réglage) ni descendre sous 16 px.
 * Zone masquée (onglet non affiché) : le réglage tel quel, un redessin suivra à l'affichage.
 */
export function tailleQuiTient(zone, largeur, longueur, taille, marge) {
  const l = zone.clientWidth - 2 * marge, ha = zone.clientHeight - 2 * marge;
  if (l <= 0 || ha <= 0) return taille;
  return Math.max(16, Math.min(taille, Math.floor(Math.min(l / (largeur + 2), ha / (longueur + 2)))));
}
