/**
 * Le branchement du côté Monde sur la coquille (lot C), appelé une fois par js/main-mj.js après la création de la coquille et de `ctx`.
 *   coquille : js/atelier/coquille.js ; ctx.univers : js/mj/univers-ui.js (la carte du lieu et les données du monde).
 * Le Monde n'est plus un écran par-dessus la page : c'est une scène de l'atelier.
 *   - inspecteurs monde, lieu et point (js/atelier/inspecteurs-monde.js) ;
 *   - barre d'outils Sélection · Point · Calage (js/atelier/barre-lieu.js) ;
 *   - arbre : vignettes des lieux, et dans son « ⋯ » Nouveau monde, Importer un monde, Nouveau lieu ;
 *   - « Jouer ce monde » (le seul bouton doré de l'écran) au bout de la ligne d'outils, à la place de « Jouer » du donjon ; pas d'en-tête « Monde · nom » ;
 *   - le point choisi est la sélection commune (type 'point') ; sur téléphone, l'inspecteur se déplie quand on choisit un point.
 */
import { $, h } from '../dom.js';
import { icone } from '../icones.js';
import { lienBtn } from '../univers-boutons.js';
import { lienJouer } from '../univers-vue.js';
import { selection } from '../atelier-selection.js';
import { telephone } from '../telephone.js';
import { enregistrerInspecteursMonde, vignetteLieu } from './inspecteurs-monde.js';
import { creerBarreLieu } from './barre-lieu.js';
import { creerCartouche, cartoucheLieu } from './cartouche.js';
import { grilleEffective } from '../univers-grille.js';
import { chargerReglages } from '../stockage.js';

export function inscrireMonde(coquille, ctx) {
  const U = ctx.univers;
  enregistrerInspecteursMonde(coquille, U);
  creerBarreLieu(coquille, U);

  // --- Le point choisi est la sélection commune ----------------------------------------------------------------------
  const contexte = () => ({ monde: U.donnees().actif, lieu: U.lieu() });
  U.surPoint((id) => {
    if (id) coquille.selectionner(selection('point', id, contexte()));
    else if (coquille.selection()?.type === 'point' && U.lieu()) coquille.selectionner(selection('lieu', U.lieu(), contexte()));
  });
  /** Sous 760 px, choisir un point sur la carte déplie le panneau bas (replié, il ne montrerait que son titre). */
  const bascule = (plie) => {
    const el = coquille.inspecteur.element;
    if (el.classList.contains('replie') !== plie) el.querySelector('.atelier-inspecteur-plier')?.click();
  };
  const deplier = () => bascule(false);
  // Sous 760 px : le point, le monde et le calage se règlent dans le panneau ouvert ; changer de lieu le replie, pour que la carte reste grande.
  coquille.surSelection((sel) => {
    U.synchroniser(sel);
    if (!telephone()) return; // (un monde, un lieu ou un point ne se choisissent que dans le Monde : il est ouvert ou sur le point de l'être)
    if (sel?.type === 'point' || sel?.type === 'monde') deplier();
    else if (sel?.type === 'lieu' && !U.calage.actif()) bascule(true);
  });
  U.surChangement((options = {}) => {
    if (U.ouvert()) coquille.rafraichir({ inspecteur: options.inspecteur !== false });
    if (U.ouvert() && telephone() && U.mode() === 'grille') deplier();
  });

  // --- Arbre : vignettes et « ⋯ » -------------------------------------------------------------------------------------
  coquille.arbre.vue.definirVignette((n) => (n.type === 'lieu' ? vignetteLieu(U.donnees().univers[n.contexte?.monde]?.lieux[n.id]?.image, '') : null));
  coquille.arbre.vue.maj({ arbre: coquille.donneesArbre() });

  const fichier = h('input', { type: 'file', id: 'monde-importer', accept: '.json,application/json', hidden: true, 'aria-label': 'Importer un monde (fichier JSON)' });
  document.body.append(fichier);
  fichier.addEventListener('change', async (e) => {
    const u = await U.importerMonde(e);
    fichier.value = '';
    if (u) coquille.naviguer({ page: 'monde', monde: u.id });
  });
  coquille.arbre.ajouterAction({ libelle: 'Nouveau monde', icone: 'plus', executer: () => { U.creerMondeNeuf(); } });
  coquille.arbre.ajouterAction({ libelle: 'Importer un monde…', icone: 'importer', executer: () => fichier.click() });
  coquille.arbre.ajouterAction({
    libelle: 'Nouveau lieu…', icone: 'monde',
    executer: async () => {
      const actif = U.donnees().actif;
      if (!actif) { U.dire('Crée d’abord un monde : un lieu est une carte de ce monde.', { erreur: true }); return; }
      if (!U.ouvert()) coquille.naviguer({ page: 'monde', monde: actif });
      await U.ajouterLieuLibre();
    },
  });

  // --- Le cartouche d'échelle : en bas à gauche de la carte du lieu (le fil d'Ariane tient le haut). Rien sans grille, ni pendant le calage ---------
  const cartouche = creerCartouche();
  cartouche.element.classList.add('cartouche-monde');
  $('scene-monde').append(cartouche.element);
  let versionCartouche = 0;
  async function majCartouche() {
    const moi = ++versionCartouche;
    const l = U.ouvert() && !U.calage.actif() ? U.lieuCourant() : null;
    if (!l) { cartouche.definir(null); return; }
    const infos = await U.infosDe(l.image);
    if (moi !== versionCartouche) return;
    cartouche.definir(cartoucheLieu(grilleEffective(l, infos ?? null).grille, infos?.largeur, infos?.hauteur, chargerReglages().echelle));
  }
  U.surChangement(majCartouche);
  majCartouche();

  // --- « Jouer ce monde » : le seul bouton doré, au bout de la ligne d'outils (après « Grille »), à la place du « Jouer » du donjon ---------------
  // Plus d'en-tête « Monde · nom » : le nom est déjà dans l'arbre (nœud surligné) et dans l'en-tête de l'inspecteur.
  const jouer = lienBtn('Jouer ce monde', null, { icone: 'jouer', classe: 'btn-primaire barre-monde-jouer', titre: 'Ouvre la Présentation sur ce monde, pour le jouer à la table' });
  jouer.replaceChildren(icone('jouer'), h('span', { className: 'libelle' }, 'Jouer', h('span', { className: 'suite', textContent: ' ce monde' }))); // sous 760 px : « Jouer » seul
  jouer.setAttribute('aria-label', 'Jouer ce monde');
  jouer.hidden = true;
  coquille.barreFin.append(jouer);
  function majEntete() {
    const u = U.monde();
    jouer.hidden = !U.ouvert() || !u;
    if (!u) return;
    jouer.href = lienJouer(u.id);
    const calage = U.mode() === 'grille'; // pendant le calage, « Enregistrer » est l'unique bouton doré
    jouer.classList.toggle('btn-primaire', !calage);
    jouer.classList.toggle('btn-discret', calage);
  }
  U.surChangement(majEntete);
  majEntete();
}
