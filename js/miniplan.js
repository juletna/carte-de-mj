/**
 * Les plans de donjon cliquables : la miniature (sidebar du Donjon, régie de la Présentation) et la vue Plan du Donjon.
 *
 * Il n'y a qu'une façon de dessiner un plan : `dessinerPlanDonjon`. Ce module n'ajoute que ce qu'il faut autour :
 * le survol, le clic, et une liste de boutons cachés à l'œil pour le clavier (Tab et Entrée ; le focus surligne la salle
 * sur le plan). `creerPlanInteractif` est ce comportement commun ; `creerMiniPlan` y ajoute la taille qui tient dans le cadre.
 */
import { dessinerPlanDonjon } from './rendu/plan.js';
import { tailleQuiTientPlan } from './affichage.js';
import { salleSous } from './plan-donjon.js';

/**
 * Le survol, le clic et la liste clavier d'un plan déjà dessiné par ailleurs.
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLElement} liste  la liste (ul) des boutons cachés ; ses éléments sont reconstruits par `majListe`
 * @param {{
 *   disposition: () => object|null,   disposition dessinée (null : rien à survoler)
 *   taille: () => number,             côté de case du dernier dessin (0 : rien à survoler)
 *   redessiner: () => void,           appelé quand la salle survolée change
 *   onChoisir: (id:string) => void,   clic sur une salle, ou Entrée sur son bouton
 *   titre?: (id:string) => string     infobulle du canvas sur la salle survolée (absente : le canvas n'a pas d'infobulle)
 * }} options
 * @returns {{
 *   survol: () => string|null,
 *   retirerSurvol: () => void,        oublie la salle survolée sans redessiner
 *   majListe: (entrees:{id:string, texte:string}[], signature:string, options?:{garderFocus?:boolean}) => void,
 *   oublierListe: () => void          la prochaine `majListe` reconstruit la liste même si la signature n'a pas changé
 * }}
 */
export function creerPlanInteractif(canvas, liste, { disposition, taille, redessiner, onChoisir, titre }) {
  let survol = null, signatureListe = '';

  function survoler(id) {
    if (survol === id) return;
    survol = id;
    if (titre) canvas.title = id ? titre(id) : '';
    canvas.classList.toggle('sur-salle', !!id);
    redessiner();
  }

  /** Salle sous un événement souris ou toucher, d'après la disposition et le côté de case du dernier dessin. */
  const salleDe = (e) => {
    const dispo = disposition(), t = taille();
    if (!dispo || !t) return null;
    const r = canvas.getBoundingClientRect();
    return salleSous(dispo, (e.clientX - r.left) / t, (e.clientY - r.top) / t);
  };
  canvas.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') survoler(salleDe(e)); });
  canvas.addEventListener('pointerleave', () => survoler(null));
  canvas.addEventListener('click', (e) => { const id = salleDe(e); if (id) onChoisir(id); });

  /**
   * Liste de boutons, un par salle. Elle n'est reconstruite que si `signature` change. `garderFocus` : si le focus était dans la
   * liste, il revient sur le bouton de la même salle (le bouton porte alors `data-salle`).
   */
  function majListe(entrees, signature, { garderFocus = false } = {}) {
    if (signature === signatureListe) return;
    signatureListe = signature;
    const focus = garderFocus && liste.contains(document.activeElement) ? document.activeElement.dataset.salle : null;
    liste.replaceChildren(...entrees.map(({ id, texte }) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      if (garderFocus) b.dataset.salle = id;
      b.textContent = texte;
      b.addEventListener('click', () => onChoisir(id));
      b.addEventListener('focus', () => survoler(id));
      b.addEventListener('blur', () => survoler(null));
      li.append(b);
      return li;
    }));
    if (focus) liste.querySelector(`[data-salle="${CSS.escape(focus)}"]`)?.focus({ preventScroll: true });
  }

  return { survol: () => survol, retirerSurvol: () => { survol = null; }, majListe, oublierListe: () => { signatureListe = ''; } };
}

const LARGEUR_DEFAUT = 240;  // px : tant que le cadre est masqué (il se redessine dès qu'il a une largeur)
const HAUTEUR_MAX = 320;     // px : un donjon tout en hauteur ne repousse pas le reste du panneau

/**
 * @param {HTMLElement} conteneur
 * @param {{onChoisir:(id:string)=>void, libelle:(salle:object)=>string}} rappels  libelle : texte du bouton clavier d'une salle
 * @returns {(donnees:{donjon:object, disposition:object, actif?:string, courante?:string, inconnues?:string[], portesFermees?:object[]})=>void} mise à jour
 */
export function creerMiniPlan(conteneur, { onChoisir, libelle }) {
  const canvas = document.createElement('canvas');
  canvas.className = 'miniplan';
  canvas.setAttribute('aria-hidden', 'true'); // au clavier et au lecteur d'écran : la liste de boutons
  const liste = document.createElement('ul');
  liste.className = 'cache-visuel';
  conteneur.replaceChildren(canvas, liste);

  let donnees = null, taille = 1, largeurVue = 0;

  const plan = creerPlanInteractif(canvas, liste, {
    disposition: () => (donnees ? donnees.disposition : null),
    taille: () => taille,
    redessiner: () => dessiner(),
    onChoisir,
    titre: (id) => donnees.donjon.salles[id].nom,
  });

  function dessiner() {
    if (!donnees) return;
    const { donjon, disposition, actif, courante, inconnues, portesFermees } = donnees;
    largeurVue = conteneur.clientWidth;
    taille = tailleQuiTientPlan(disposition, largeurVue || LARGEUR_DEFAUT, HAUTEUR_MAX);
    const res = dessinerPlanDonjon(canvas, donjon, disposition, { taille, actif, survol: plan.survol(), courante, inconnues, portesFermees, noms: false, pions: false, surbrillance: true });
    taille = res.taille;
  }

  function majListe() {
    const { donjon, actif } = donnees;
    const salles = Object.values(donjon.salles);
    const texte = salles.map((s) => [s.id, libelle(s)]);
    plan.majListe(texte.map(([id, t]) => ({ id, texte: t })), JSON.stringify([actif, texte]), { garderFocus: true });
  }

  // Le cadre peut être masqué au premier dessin (autre outil affiché) : on redessine quand sa largeur change.
  new ResizeObserver(() => { if (conteneur.clientWidth !== largeurVue) dessiner(); }).observe(conteneur);

  return (nouvelles) => {
    donnees = nouvelles;
    if (plan.survol() && !(plan.survol() in nouvelles.donjon.salles)) plan.retirerSurvol();
    majListe();
    dessiner();
  };
}
