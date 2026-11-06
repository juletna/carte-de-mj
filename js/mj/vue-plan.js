/**
 * La vue Plan : tout le donjon d'un coup, les salles à leur vraie taille (js/plan-donjon.js, rendu/plan.js, dessinerPlanDonjon). Elle
 * remplace la carte de la salle dans la scène ; son zoom est à part (`zoomPlan`). Survol à la souris ou au focus clavier d'une
 * liste de boutons cachés à l'œil ; cliquer une salle quitte le plan et l'ouvre. Fabrique `creerVuePlan(ctx)` ; `ctx` est celui de
 * main-mj.js (`etat`, `donjon`, `salle`, `deselectionner`, `activerSalle`, `dispositionDuDonjon`, `bulle`, `carte`, `onglets`), lu
 * au moment de l'appel. Renvoie `ouvrir(ouvert)`, `dessiner()` et `cibleZoom` (voir zoom.js).
 */
import { dessinerPlanDonjon } from '../rendu/plan.js';
import { creerPlanInteractif } from '../miniplan.js';
import { PLAN_ZOOM_MIN, PLAN_ZOOM_MAX, zoomBorne, tailleAfficheePlan as tailleDuPlan } from '../mise-en-page.js';
import * as modele from '../donjon.js';
import { $ } from '../dom.js';

export function creerVuePlan(ctx) {
  const { etat } = ctx;
  const r = etat.reglages;
  const donjon = () => ctx.donjon();
  const salle = () => ctx.salle();

  // Le survol, le clic sur une salle et la liste clavier sont ceux de la miniature (miniplan.js) ; l'état du survol y est gardé.
  const interactif = creerPlanInteractif($('plan-donjon'), $('plan-salles'), {
    disposition: () => etat.planDispo,
    taille: () => etat.planTaille,
    redessiner: () => dessinerPlan(),
    onChoisir: (id) => ctx.activerSalle(id),
  });

  // --- Vue Plan : tout le donjon d'un coup, les salles à leur vraie taille (js/plan-donjon.js, rendu/plan.js, dessinerPlanDonjon) ---
  // Elle remplace la carte de la salle dans la scène (#support, donc les bandes de dimensions et la bulle, est masqué). Son zoom
  // est à part (`zoomPlan`) : la carte de la salle garde le sien. Cliquer une salle quitte le plan et l'ouvre.

  /** Côté de case du plan : le zoom choisi, sinon le plan remplit la scène (jamais sous 4 px : au-delà, la scène défile). */
  function tailleAfficheePlan() {
    const scene = $('scene');
    return tailleDuPlan({ zoom: etat.zoomPlan, dispo: etat.planDispo, largeur: scene.clientWidth, hauteur: scene.clientHeight });
  }

  function dessinerPlan() {
    if (!etat.plan) return;
    const d = donjon();
    if (d.id !== etat.clePlan) { etat.clePlan = d.id; etat.zoomPlan = null; }
    ctx.dispositionDuDonjon(d);
    const t = tailleAfficheePlan();
    const res = dessinerPlanDonjon($('plan-donjon'), d, etat.planDispo, {
      taille: t, actif: d.salleActive, survol: interactif.survol(), grille: r.grille && t >= 24,
    });
    etat.planTaille = res.taille;
    const n = Object.keys(d.salles).length;
    $('plan-donjon').setAttribute('aria-label', `Plan du donjon « ${d.nom} » : ${n} salle${n > 1 ? 's' : ''}. Clique une salle pour l’ouvrir.`);
    majListePlan();
    majZoomPlan();
  }

  /** Liste de boutons cachés à l'œil : chaque salle est atteignable au clavier (Tab, Entrée) ; le focus la surligne sur le plan. */
  function majListePlan() {
    const d = donjon();
    const salles = modele.listerSalles(d);
    const signature = JSON.stringify([d.id, d.salleActive, salles.map((s) => [s.id, s.nom])]);
    interactif.majListe(salles.map((s) => ({ id: s.id, texte: `Ouvrir la salle ${s.nom}${s.id === d.salleActive ? ' (affichée)' : ''}` })), signature);
  }

  function majZoomPlan() {
    const t = etat.planTaille || tailleAfficheePlan();
    $('zoom-pct').textContent = `${Math.round((t / r.taille) * 100)} %`;
    for (const id of ['zoom-moins', 'zoom-plus', 'zoom-ajuster']) $(id).disabled = false;
    $('zoom').title = '';
    $('zoom-ajuster').setAttribute('aria-pressed', String(!etat.zoomPlan));
  }

  /** La cible du zoom (voir zoom.js) : le plan, sans marge de roche, avec ses bornes. */
  const cibleZoom = {
    marge: 0,
    taille: () => etat.planTaille || tailleAfficheePlan(),
    peut: () => true,
    definir: (t) => { etat.zoomPlan = zoomBorne(t, PLAN_ZOOM_MIN, PLAN_ZOOM_MAX); },
    canvas: () => $('plan-donjon'),
    redessiner: dessinerPlan,
    afficher: majZoomPlan,
  };

  /** Affiche (ou quitte) la vue Plan. Quitter ramène à la salle active. Sur téléphone, passe d'abord à l'onglet Carte. */
  function ouvrirPlan(ouvert) {
    if (etat.plan === ouvert) return;
    etat.plan = ouvert;
    $('plan-bouton').setAttribute('aria-pressed', String(ouvert));
    document.body.classList.toggle('vue-plan', ouvert);
    $('support').hidden = ouvert;
    $('plan-donjon').hidden = !ouvert;
    $('plan-salles').hidden = !ouvert;
    $('zoom-reel').hidden = ouvert; // « Taille réelle » n'a pas de sens pour un plan entier
    interactif.retirerSurvol();
    interactif.oublierListe();
    if (ouvert) {
      ctx.carte.palette.desarmer(); // un élément armé ne doit pas rester pendant qu'on regarde le plan
      ctx.carte.ouvrirTiroir(false);
      if (etat.selection) { ctx.deselectionner(); ctx.bulle.maj(); }
      $('message-carte').hidden = true;
      etat.zoomPlan = null;
      ctx.onglets?.afficher('carte'); // téléphone : le plan est dans l'onglet Carte (sans effet sur ordinateur)
      dessinerPlan();
    } else {
      ctx.carte.redessiner(salle().plan);
    }
  }
  $('plan-bouton').addEventListener('click', () => ouvrirPlan(!etat.plan));
  $('plan-complet').addEventListener('click', () => ouvrirPlan(true));

  return { ouvrir: ouvrirPlan, dessiner: dessinerPlan, cibleZoom };
}
