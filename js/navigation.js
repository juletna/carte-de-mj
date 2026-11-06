/**
 * Barre de navigation commune à toutes les pages : chaque élément `[data-navigation]` est rempli avec la même barre
 * (accueil, Monde, Donjons, Jouer, Bibliothèque, puis à droite Fiche joueur et Sauvegarde). Sous 760 px, elle se réduit au nom
 * et à un bouton ☰ qui ouvre ces mêmes liens. La page courante porte aria-current="page" (Monde : quand le hash est #monde).
 * Chaque emplacement est un <header class="menu-site" data-navigation> posé tout en haut de la page, hors de toute colonne : la barre est
 * donc au même endroit partout. Elle n'est jamais montée dans la vue table (?vue=table) : l'emplacement vide reste caché.
 * La Sauvegarde ouvre un dialogue chargé à la demande (mj/sauvegarde-ui.js).
 */
import { LIENS, LIEN_ACCUEIL, LIEN_FICHE, pageCourante } from './navigation-donnees.js';

let compteur = 0;

function el(tag, attrs = {}, ...enfants) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...enfants);
  return e;
}
const lien = (l, classe) => el('a', { class: classe, href: l.href, ...(l.titre ? { title: l.titre } : {}), 'data-nav': l.id }, l.texte);

function monter(conteneur) {
  const id = `menu-corps-${++compteur}`;
  const nav = el('nav', { 'aria-label': 'Navigation principale' }, ...LIENS.map((l) => lien(l, 'menu-lien')));
  const sauvegarde = el('button', { type: 'button', class: 'menu-lien menu-sauvegarde', 'aria-haspopup': 'dialog', title: 'Tout sauvegarder ou tout restaurer : donjons, personnages, univers, images importées' }, 'Sauvegarde');
  const droite = el('div', { class: 'menu-droite' }, lien(LIEN_FICHE, 'menu-lien'), sauvegarde);
  const corps = el('div', { class: 'menu-corps', id }, nav, droite);
  const burger = el('button', { type: 'button', class: 'menu-burger', 'aria-expanded': 'false', 'aria-controls': id, 'aria-label': 'Menu' }, '☰');
  const nom = lien(LIEN_ACCUEIL, 'menu-nom');
  const fermer = () => { burger.setAttribute('aria-expanded', 'false'); corps.classList.remove('ouvert'); };
  burger.addEventListener('click', () => {
    const ouvrir = burger.getAttribute('aria-expanded') !== 'true';
    burger.setAttribute('aria-expanded', String(ouvrir));
    corps.classList.toggle('ouvert', ouvrir);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && corps.classList.contains('ouvert')) { fermer(); burger.focus(); } });
  document.addEventListener('click', (e) => { if (corps.classList.contains('ouvert') && !conteneur.contains(e.target)) fermer(); });
  sauvegarde.addEventListener('click', async () => {
    fermer();
    try { (await import('./mj/sauvegarde-ui.js')).ouvrirSauvegarde(); } catch (err) { alert(`Sauvegarde indisponible : ${err.message}`); }
  });
  conteneur.replaceChildren(el('div', { class: 'menu-int' }, nom, burger, corps));
}

/** Pose aria-current sur le lien de la page (et le retire des autres) dans toutes les barres. */
export function marquerCourant() {
  const courant = pageCourante(location.pathname, location.hash);
  for (const a of document.querySelectorAll('[data-navigation] [data-nav]')) {
    if (a.dataset.nav === courant) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
}

export function monterNavigation() {
  if (new URLSearchParams(location.search).get('vue') === 'table') return;
  for (const c of document.querySelectorAll('[data-navigation]')) monter(c);
  marquerCourant();
}

if (typeof document !== 'undefined') {
  addEventListener('hashchange', marquerCourant);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', monterNavigation); else monterNavigation();
}
