/**
 * La régie (presentation.html) sur la coquille de l'atelier, mode « jouer » : l'arbre en lecture à gauche (pastilles : à la table, découvert,
 * pas encore montré), la carte au centre, et à droite les onglets Salle · Joueurs · Table (+ Lieu pour une carte de monde).
 * Voir docs/conception-atelier.md, lot D. Ce module ne contient aucune logique de partie : regie.js et regie-univers.js lui disent où l'on est
 * (`synchroniser`) et lui demandent de réagir au clic sur l'arbre (`surChoix`).
 *
 *   const jouer = creerJouer({ racine, donnees, partie, surChoix });
 *   donnees() → { univers: { id: univers }, donjons: { id: donjon }, donjonActif?, mondeActif? }   (voir coquille.js)
 *   partie()  → { univers?: partie d'univers, presentations?: { idDonjon: partie } }               (voir etatJeu, atelier-arbre.js)
 *   surChoix(noeud)  le MJ a choisi un nœud de l'arbre ; la position de l'arbre est ensuite remise sur la vraie position
 *   jouer.mode('donjon'|'monde')  quelle composition : les onglets Salle et Joueurs, ou l'onglet Lieu
 *   jouer.synchroniser(position?)  { donjon, salle } ou { monde, lieu } : l'arbre, les pastilles et l'onglet suivent
 */
import { $, h } from '../dom.js';
import { telephone } from '../telephone.js';
import { creerCoquille } from './coquille.js';
import { creerVuesRegie } from './vue-table-regie.js';
import { etatJeu } from '../atelier-arbre.js';
import { creerCartouche } from './cartouche.js';
import { vignetteLieu } from './vignette-lieu.js';

const ONGLETS = {
  donjon: ['salle', 'joueurs', 'table'],
  monde: ['lieu', 'table'],
};

export function creerJouer({ racine, donnees, partie, surChoix, affichage }) {
  let enCours = false;
  let modeCourant = 'donjon';
  let derniere = null;

  const coquille = creerCoquille({
    racine, mode: 'jouer', donnees, scene: $('principal'), bouton: $('arbre-bouton'), affichage,
    pastille: (n) => etatJeu(n, partie()),
    surNavigation: (route, noeud) => {
      if (enCours || !noeud) return;
      enCours = true;
      try { surChoix(noeud); } finally { enCours = false; }
      synchroniser();
    },
  });

  // Deux vues en haut de la scène : « Régie » (carte et commande) et « Table » (ce que voient les joueurs, en grand), pour régler l'écran de table en voyant le résultat.
  const vues = creerVuesRegie({ scene: $('principal'), barre: coquille.barreOutils, avant: coquille.barreFin });

  // Les lieux de l'arbre montrent leur carte en vignette (comme dans le Monde), pas le globe ; le monde, celle de sa carte.
  coquille.arbre.vue.definirVignette((n) => (n.type === 'lieu' || n.racine ? vignetteLieu(donnees().univers?.[n.contexte?.monde]?.lieux?.[n.racine ?? n.id]?.image, '') : null));

  // Le cartouche d'échelle (js/atelier/cartouche.js) : en haut à gauche de la carte, sous le bandeau d'état. Une ancre sans hauteur, posée juste avant la scène
  // du donjon (et donc avant la carte du monde, qui la remplace), porte le cartouche sans rien décaler. regie.js et regie-univers.js le renseignent.
  const cartouche = creerCartouche();
  cartouche.element.classList.add('cartouche-regie');
  $('scene').before(h('div', { className: 'cartouche-ancre' }, cartouche.element));

  const defs = [['salle', 'Salle'], ['joueurs', 'Joueurs'], ['lieu', 'Lieu'], ['table', 'Table']];
  for (const [id, libelle] of defs) coquille.onglets.ajouter({ id, libelle, contenu: $(`onglet-${id}`) });
  // Sous 760 px : un onglet touché ouvre le panneau bas replié ; toucher l'onglet déjà ouvert le replie (la carte reprend la place).
  const colonne = coquille.inspecteur.element;
  const plier = colonne.querySelector('.atelier-inspecteur-plier');
  let avant = null;
  colonne.addEventListener('click', (e) => { avant = coquille.onglets.courant(); }, true);
  colonne.addEventListener('click', (e) => {
    const b = e.target.closest?.('.atelier-onglet');
    if (!b || !telephone()) return;
    if (colonne.classList.contains('replie') || b.id === `atelier-onglet-${avant}`) plier.click();
  });
  if (telephone()) plier.click(); // sous 760 px : replié au départ, la carte d'abord

  const bouton = (id) => $(`atelier-onglet-${id}`);

  function afficherOnglets() {
    const visibles = ONGLETS[modeCourant];
    for (const [id] of defs) { bouton(id).hidden = !visibles.includes(id); }
    if (!visibles.includes(coquille.onglets.courant())) coquille.onglets.choisir(visibles[0]);
  }

  /** La composition : donjon (Salle · Joueurs · Table) ou monde (Lieu · Table). Les deux partagent l'arbre, le bandeau et l'onglet Table. */
  function mode(m) {
    modeCourant = m === 'monde' ? 'monde' : 'donjon';
    racine.dataset.regie = modeCourant;
    afficherOnglets();
  }

  /** `pos` : { donjon, salle } ou { monde, lieu } (par défaut la dernière position donnée). Redessine l'arbre si une pastille a changé. */
  function synchroniser(pos = derniere) {
    if (!pos) return;
    derniere = pos;
    const deja = enCours;
    enCours = true;
    try {
      coquille.rafraichir();
      const route = pos.donjon ? { page: 'donjon', donjon: pos.donjon, salle: pos.salle } : { page: 'monde', monde: pos.monde, lieu: pos.lieu };
      coquille.naviguer(route); // l'adresse reste vierge : la coquille du mode jouer n'en écrit pas
    } finally { enCours = deja; }
  }

  /** Sous 760 px : replie le panneau bas (la carte et la bulle de sélection reprennent la place). */
  function replier() { if (telephone() && !colonne.classList.contains('replie')) plier.click(); }

  return { coquille, cartouche, mode, replier, synchroniser, choisirOnglet: (id) => coquille.onglets.choisir(id), position: () => derniere };
}
