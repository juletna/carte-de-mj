/**
 * La carte de la salle affichée : taille d'affichage, dessin, repères (portes reliées, élément sélectionné), déplacement et sélection
 * à la souris ou au doigt, pose d'un élément de la palette, zoom. La palette (panneau sur ordinateur,
 * tiroir sur téléphone) vit ici avec la pose. Fabrique `creerVueCarte(ctx)` ; `ctx` est celui de main-mj.js (`etat`, `donjon`, `salle`,
 * `rendre`, `modifierPlan`, `deselectionner`, `annoncerCarte`, `bulle`, `plan`, `zoom`), lu au moment de l'appel.
 *
 * Renvoie : `taille(plan)`, `apercu(plan, taille?)` (dessin sans rien enregistrer), `redessiner(plan)`, `oublierZoomSiAutreCarte()`,
 * `cibleZoom` (voir zoom.js), `palette`, `ouvrirTiroir(ouvert)` et `tiroirOuvert()`.
 */
import { dessiner } from '../rendu/moteur.js';
import { themeParNom } from '../rendu/themes/index.js';
import { MARGE } from '../rendu/geometrie.js';
import { tailleRemplir, optionsRendu } from '../affichage.js';
import { ZOOM_MIN, ZOOM_MAX, zoomBorne } from '../mise-en-page.js';
import { ajouterElement, elementsPalette, GROUPES_PALETTE, SOUS_GROUPES } from '../pose.js';
import { creerPalette } from '../palette.js';
import { activerDeplacement } from '../deplacement.js';
import * as modele from '../donjon.js';
import { telephone, marquerDefilement } from '../telephone.js';
import { $ } from '../dom.js';

export function creerVueCarte(ctx) {
  const { etat } = ctx;
  const r = etat.reglages;
  const donjon = () => ctx.donjon();
  const salle = () => ctx.salle();
  const rendre = () => ctx.rendre();
  const annoncerCarte = (...a) => ctx.annoncerCarte(...a);

  /** Repères dessinés sur la carte : portes reliées et élément sélectionné. */
  function marques(planAffiche) {
    const d = donjon(), s = salle();
    const reel = s.plan;
    // Pendant un glissement, la porte déplacée garde son repère : on la retrouve par son id dans le plan réel.
    const portesReliees = planAffiche.portes
      .filter((p) => modele.liaisonDePorte(d, s.id, reel.portes.find((q) => q.id === p.id) || p))
      .map((p) => ({ mur: p.mur, position: p.position }));
    const escaliersRelies = planAffiche.objets
      .filter((o) => o.type === 'escalier' && modele.liaisonDePorte(d, s.id, reel.objets.find((q) => q.id === o.id) || o))
      .map((o) => ({ x: o.x, y: o.y }));
    const trouve = modele.retrouverElement(reel, etat.selection);
    const element = trouve && planAffiche[trouve.liste][trouve.index];
    return { portesReliees, escaliersRelies, selection: element ? { genre: trouve.genre, element } : null };
  }

  // --- Taille de la carte : ajustement automatique et zoom -------------------------------------

  /**
   * Côté de case affiché :
   *  - après un zoom manuel (temporaire) : le zoom ;
   *  - sinon la salle remplit la scène (tailleRemplir, comme la Présentation en mode « remplir »). Scène masquée (onglet
   *    Texte du téléphone) : `r.taille`, un redessin suit à l'affichage.
   * `r.taille` est la taille calibrée dans la Présentation : rien ici ne l'écrit.
   */
  function tailleAffichee(plan) {
    if (etat.zoom) return etat.zoom;
    const scene = $('scene');
    const retrait = 2 * (parseFloat(getComputedStyle($('support')).paddingLeft) || 0); // la place des bandes de dimensions
    return tailleRemplir(plan, scene.clientWidth - retrait, scene.clientHeight - retrait) ?? r.taille;
  }
  const optionsDessin = (plan) => {
    const { grille, theme, details, relief, penombre } = optionsRendu(r);
    return { taille: tailleAffichee(plan), grille, theme: themeParNom(theme), details, relief, penombre, vue: 'mj', marques: marques(plan) };
  };

  /** Dessine `plan` sur la carte sans rien enregistrer (aperçu d'un glissement), à la taille donnée ou à celle de l'affichage. */
  function apercuCarte(plan, taille) {
    dessiner($('carte'), plan, taille ? { ...optionsDessin(plan), taille } : optionsDessin(plan));
  }

  function dessinerCarte(plan) {
    dessiner($('carte'), plan, optionsDessin(plan));
    marquerDefilement($('carte'), $('scene'));
    ctx.zoom.afficher(plan);
    ctx.bulle.placer();
  }

  /** Le zoom manuel ne survit ni à un changement de donjon ou de salle, ni de dimensions ; il survit à tout le reste. */
  function oublierZoomSiAutreCarte() {
    const s = salle();
    const cle = `${donjon().id}/${s.id}/${s.plan.largeur}x${s.plan.longueur}`;
    if (cle === etat.cleAjuste) return;
    etat.cleAjuste = cle;
    etat.zoom = null;
  }

  // --- Palette : catalogue de vignettes (panneau sur ordinateur, tiroir sur téléphone) ------------------------
  /** Tiroir du bas (téléphone) : ouvert par « + Ajouter », refermé tout seul quand un élément est armé. */
  function ouvrirTiroir(ouvert) {
    $('palette').classList.toggle('tiroir-ouvert', ouvert);
    $('ajouter').setAttribute('aria-expanded', String(ouvert));
    if (ouvert) $('palette').querySelector('.palette-groupes [aria-pressed="true"]')?.focus({ preventScroll: true });
  }
  const tiroirOuvert = () => $('palette').classList.contains('tiroir-ouvert');
  $('ajouter').addEventListener('click', () => ouvrirTiroir(!tiroirOuvert()));

  const palette = creerPalette($('palette'), {
    elements: elementsPalette(),
    groupes: GROUPES_PALETTE,
    sousGroupes: SOUS_GROUPES,
    pastille: $('pose-pastille'),
    onFermer: () => { ouvrirTiroir(false); $('ajouter').focus(); },
    onArmer: (item) => {
      $('carte').classList.toggle('arme', !!item);
      if (item) {
        etat.selection = null; // la bulle se ferme : le prochain clic sur la carte pose
        ctx.bulle.maj();
        if (telephone()) ouvrirTiroir(false); // au doigt, le tiroir libère la carte une fois l'élément choisi
        annoncerCarte(`${item.libelle} : clique une case de la carte pour le poser. Échap pour arrêter.`);
      } else $('message-carte').hidden = true;
    },
    onDeposer: (item, x, y) => { poserSurCarte(item, x, y); },
    survol: (x, y) => {
      const cv = $('carte').getBoundingClientRect(), sc = $('scene').getBoundingClientRect();
      return x >= Math.max(cv.left, sc.left) && x <= Math.min(cv.right, sc.right) && y >= Math.max(cv.top, sc.top) && y <= Math.min(cv.bottom, sc.bottom);
    },
  });

  // --- Carte : poser (palette), déplacer, cliquer ----------------------------------
  // Élément de la palette armé : un appui sur la carte POSE. Cet écouteur est posé AVANT celui du déplacement (et en phase de
  // capture) pour que le déplacement ne voie jamais cet appui : ni sélection, ni glissement tant qu'un élément est armé.
  $('carte').addEventListener('pointerdown', (e) => {
    const item = palette.arme();
    if (!item || e.button !== 0) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    poserSurCarte(item, e.clientX, e.clientY);
  }, true);

  // Un élément déplacé réécrit la description, qui régénère la carte et le JSON.
  // Un appui sans glissement sélectionne l'élément : ses actions s'ouvrent dans une bulle à côté de lui.
  activerDeplacement($('carte'), {
    plan: () => salle().plan,
    taille: () => tailleAffichee(salle().plan),
    apercu: (plan) => apercuCarte(plan),
    portesLarges: true, // zone de clic des portes élargie vers l'intérieur ; un glissement sur un pion déplace toujours le pion
    commencer: () => { // un glissement commence : la bulle se ferme
      if (!etat.selection) return;
      ctx.deselectionner();
      ctx.bulle.maj();
    },
    deposer: (nouveau) => {
      const deplace = modele.elementDeplace(salle().plan, nouveau);
      if (deplace && modele.memeDescripteur(etat.selection, deplace.avant)) etat.selection = deplace.apres;
      ctx.modifierPlan(nouveau, { suivrePortes: true, garderSelection: true }); // la liaison d'une porte déplacée la suit
    },
    cliquer: (touche) => {
      etat.selection = touche ? modele.descripteur(touche.genre, touche.element) : null;
      etat.message = '';
      rendre();
    },
  });

  /** Pose l'élément de la palette au point écran donné, si ce point est sur la carte visible. Renvoie vrai si posé. */
  function poserSurCarte(item, clientX, clientY) {
    const scene = $('scene').getBoundingClientRect(), cv = $('carte').getBoundingClientRect();
    const dansScene = clientX >= scene.left && clientX <= scene.right && clientY >= scene.top && clientY <= scene.bottom;
    const dansCarte = clientX >= cv.left && clientX <= cv.right && clientY >= cv.top && clientY <= cv.bottom;
    if (!dansScene || !dansCarte) { annoncerCarte('Lâche l’élément sur la carte pour le poser.', true); return false; }
    const t = tailleAffichee(salle().plan);
    const res = ajouterElement(salle().plan, item, (clientX - cv.left) / t - MARGE, (clientY - cv.top) / t - MARGE);
    if (res.erreur) { annoncerCarte(res.erreur, true); return false; }
    ctx.modifierPlan(res.plan);
    annoncerCarte(res.message);
    return true;
  }

  // --- Zoom : son affichage et sa cible (le calcul est dans zoom.js) ---------------------------------
  /** Affiche le zoom courant (pourcentage de la taille réelle : 100 % = une case à la taille calibrée). */
  function majZoom(plan) {
    const t = tailleAffichee(plan || salle().plan);
    $('zoom-pct').textContent = `${Math.round((t / r.taille) * 100)} %`;
    for (const id of ['zoom-moins', 'zoom-plus', 'zoom-ajuster']) $(id).disabled = false;
    $('zoom').title = '';
    $('zoom-ajuster').setAttribute('aria-pressed', String(!etat.zoom));
  }
  const cibleZoom = {
    marge: MARGE,
    taille: () => tailleAffichee(salle().plan),
    peut: () => true,
    definir: (t) => { etat.zoom = zoomBorne(t, ZOOM_MIN, ZOOM_MAX); },
    canvas: () => $('carte'),
    redessiner: () => dessinerCarte(salle().plan),
    apres: () => ctx.bulle.placer(),
    afficher: majZoom,
  };

  // La carte se réajuste quand la scène change de taille (fenêtre, plein écran, passage à l'onglet Carte du téléphone).
  let derniereScene = '';
  new ResizeObserver(() => {
    const scene = $('scene');
    const cle = `${scene.clientWidth}x${scene.clientHeight}`;
    if (cle === derniereScene) return;
    derniereScene = cle;
    if (!scene.clientWidth) return; // masquée : le redessin suivra à l'affichage
    if (etat.plan) { ctx.plan.dessiner(); return; }
    dessinerCarte(salle().plan);
  }).observe($('scene'));

  // Un appui dans le vide de la scène ferme le tiroir de la palette. Posé avant l'écouteur de la bulle (même cible, même ordre qu'avant).
  $('scene').addEventListener('pointerdown', (e) => {
    if (tiroirOuvert() && (e.target === $('scene') || e.target === $('support'))) ouvrirTiroir(false);
  });

  return { taille: tailleAffichee, apercu: apercuCarte, redessiner: dessinerCarte, oublierZoomSiAutreCarte, cibleZoom, palette, ouvrirTiroir, tiroirOuvert };
}
