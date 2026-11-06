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
import { $ } from '../dom.js';
import { telephone } from '../telephone.js';
import { creerCoquille } from './coquille.js';
import { etatJeu, parcourir } from '../atelier-arbre.js';

const TYPES = ['monde', 'lieu', 'donjon', 'salle'];
const ONGLETS = {
  donjon: ['salle', 'joueurs', 'table'],
  monde: ['lieu', 'table'],
};

export function creerJouer({ racine, donnees, partie, surChoix }) {
  let enCours = false;
  let modeCourant = 'donjon';
  let derniere = null;
  let signature = '';

  const coquille = creerCoquille({
    racine, mode: 'jouer', donnees, scene: $('principal'), bouton: $('arbre-bouton'),
    pastille: (n) => etatJeu(n, partie()),
    surNavigation: (route, noeud) => {
      if (enCours || !noeud) return;
      // La coquille écrit l'adresse après ce rappel : on la retire ensuite (la régie se rouvre par le stockage, pas par l'adresse).
      queueMicrotask(() => { if (location.hash) history.replaceState(null, '', `${location.pathname}${location.search}`); });
      enCours = true;
      try { surChoix(noeud); } finally { enCours = false; }
      synchroniser();
    },
  });

  // L'inspecteur de l'atelier n'a rien à montrer en jeu : chaque onglet a son contenu. Un type enregistré à vide évite que la colonne se cache.
  for (const type of TYPES) coquille.inspecteur.enregistrer(type, { titre: () => '', rendre: () => {} });

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

  function changements() {
    const arbre = coquille.donneesArbre();
    if (!arbre) return false;
    const s = [...parcourir(arbre)].map((n) => `${n.cle}:${n.type === 'groupe' ? '' : etatJeu(n, partie())}`).join('|') + `|${arbre.actif?.cle}`;
    if (s === signature) return false;
    signature = s;
    return true;
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
      coquille.naviguer(route, { ecrireHash: false });
      if (changements()) coquille.arbre.vue.maj({ arbre: coquille.donneesArbre() });
    } finally { enCours = deja; }
    colonne.hidden = false; // la coquille cache la colonne quand aucun inspecteur ne répond : ici les onglets répondent toujours
    document.body.classList.add('atelier-avec-inspecteur');
  }

  return { coquille, mode, synchroniser, choisirOnglet: (id) => coquille.onglets.choisir(id), position: () => derniere };
}
