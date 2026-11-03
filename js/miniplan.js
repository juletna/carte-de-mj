/**
 * Miniature cliquable du plan du donjon (sidebar du Donjon, régie de la Présentation).
 *
 * Il n'y a qu'une façon de dessiner un plan : `dessinerPlanDonjon`. Cette miniature n'ajoute que ce qu'il faut autour :
 * la taille qui tient dans le cadre, le survol, le clic, et une liste de boutons cachés à l'œil pour le clavier
 * (Tab et Entrée ; le focus surligne la salle sur le plan).
 */
import { dessinerPlanDonjon } from './rendu/moteur.js';
import { tailleQuiTientPlan } from './affichage.js';
import { salleSous } from './plan-donjon.js';

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

  let donnees = null, taille = 1, survol = null, signature = '', largeurVue = 0;

  function dessiner() {
    if (!donnees) return;
    const { donjon, disposition, actif, courante, inconnues, portesFermees } = donnees;
    largeurVue = conteneur.clientWidth;
    taille = tailleQuiTientPlan(disposition, largeurVue || LARGEUR_DEFAUT, HAUTEUR_MAX);
    const res = dessinerPlanDonjon(canvas, donjon, disposition, { taille, actif, survol, courante, inconnues, portesFermees, noms: false, pions: false, surbrillance: true });
    taille = res.taille;
  }

  function majListe() {
    const { donjon, actif } = donnees;
    const salles = Object.values(donjon.salles);
    const texte = salles.map((s) => [s.id, libelle(s)]);
    const sig = JSON.stringify([actif, texte]);
    if (sig === signature) return;
    signature = sig;
    const focus = liste.contains(document.activeElement) ? document.activeElement.dataset.salle : null;
    liste.replaceChildren(...salles.map((s, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.salle = s.id;
      b.textContent = texte[i][1];
      b.addEventListener('click', () => onChoisir(s.id));
      b.addEventListener('focus', () => survoler(s.id));
      b.addEventListener('blur', () => survoler(null));
      li.append(b);
      return li;
    }));
    if (focus) liste.querySelector(`[data-salle="${CSS.escape(focus)}"]`)?.focus({ preventScroll: true });
  }

  function survoler(id) {
    if (survol === id) return;
    survol = id;
    canvas.title = id ? donnees.donjon.salles[id].nom : '';
    canvas.classList.toggle('sur-salle', !!id);
    dessiner();
  }

  const salleDe = (e) => {
    if (!donnees) return null;
    const r = canvas.getBoundingClientRect();
    return salleSous(donnees.disposition, (e.clientX - r.left) / taille, (e.clientY - r.top) / taille);
  };
  canvas.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') survoler(salleDe(e)); });
  canvas.addEventListener('pointerleave', () => survoler(null));
  canvas.addEventListener('click', (e) => { const id = salleDe(e); if (id) onChoisir(id); });

  // Le cadre peut être masqué au premier dessin (autre outil affiché) : on redessine quand sa largeur change.
  new ResizeObserver(() => { if (conteneur.clientWidth !== largeurVue) dessiner(); }).observe(conteneur);

  return (nouvelles) => {
    donnees = nouvelles;
    if (survol && !(survol in nouvelles.donjon.salles)) survol = null;
    majListe();
    dessiner();
  };
}
