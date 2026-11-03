/**
 * Écran de table : ce que voient les joueurs, partagé par la fenêtre `?vue=table` (vue-table.js) et par « Plein écran ici »
 * de la régie (regie.js). Il ne décide de rien : il dessine ce qu'on lui donne (`appliquer`, la seule façon de le changer)
 * et, à la souris, demande à la régie de déplacer un pion ou de montrer une case, car seule la régie a le plan complet.
 *
 * Ce qu'on lui donne est déjà filtré : le résultat de `lireEtat` (message reçu) ou, en plein écran ici, celui de vueTable()
 * et de miniPlanTable() relu par recevoirMiniPlan (voir vue-publique.js). Il ne lit ni le stockage ni les parties.
 */
import { dessiner } from './rendu/moteur.js';
import { dessinerPlanDonjon } from './rendu/plan.js';
import { activerDeplacement } from './deplacement.js';
import { AFFICHAGE_PAR_DEFAUT, tailleTable, tailleQuiTientPlan } from './affichage.js';
import { $ } from './dom.js';

/** Boutons de coin : invisibles ET inactifs tant que la souris n'a pas bougé, puis quelques secondes. */
const DUREE_COINS = 3500;

/**
 * @param {{affichage?:object, surCoinsCaches?:()=>void}} [options]
 *   affichage : l'affichage avant le premier message (par défaut AFFICHAGE_PAR_DEFAUT) ;
 *   surCoinsCaches : appelé quand les boutons de coin se cachent (la régie y remet son bouton « Retour » au repos).
 */
export function creerEcranTable({ affichage = { ...AFFICHAGE_PAR_DEFAUT }, surCoinsCaches } = {}) {
  const ecran = { plan: null, mini: null, caseVisee: null, affichage };

  /** Côté de case à la table : « échelle réelle » = la taille calibrée, exacte ; « remplir » = calculé sur la fenêtre. */
  function tailleEcranTable() {
    const v = $('vue-table');
    return tailleTable({ mode: ecran.affichage.mode, plan: ecran.plan, vue: { largeur: v.clientWidth, hauteur: v.clientHeight }, taille: ecran.affichage.taille });
  }

  function optionsEcran(taille) {
    const { grille, reperes } = ecran.affichage;
    return { taille, grille, reperes, marques: ecran.caseVisee ? { caseVisee: ecran.caseVisee } : {} };
  }

  function rendre() {
    const carte = $('carte-table');
    $('attente').hidden = !!ecran.plan;
    carte.hidden = !ecran.plan;
    const mini = $('mini-table');
    mini.hidden = !ecran.plan || !ecran.mini;
    if (!ecran.plan) return;
    if (ecran.mini) {
      const { donjon, disposition, actif, portesFermees } = ecran.mini;
      const taille = tailleQuiTientPlan(disposition, Math.min(window.innerWidth * 0.28, 400), Math.min(window.innerHeight * 0.36, 340));
      dessinerPlanDonjon(mini, donjon, disposition, { taille, actif, portesFermees, noms: false, pions: false, surbrillance: true });
    }
    const taille = tailleEcranTable();
    carte.dataset.taille = String(taille); // mesurable (tests, vérification) ; aucun secret
    dessiner(carte, ecran.plan, optionsEcran(taille)); // aucun repère de liaison ni de sélection
  }

  /**
   * Remplace ce que montre l'écran et le redessine. Sans plan, l'écran attend : `texteAttente` (facultatif) dit pourquoi,
   * et l'encart et la case montrée sont tout de même mémorisés.
   * @param {{plan:object|null, mini:object|null, caseVisee:{x:number,y:number}|null, affichage:object}} contenu
   */
  function appliquer({ plan, mini, caseVisee, affichage: nouvelAffichage }, texteAttente) {
    ecran.affichage = nouvelAffichage;
    ecran.mini = mini;
    ecran.caseVisee = caseVisee;
    ecran.plan = plan;
    if (!plan && texteAttente !== undefined) $('attente').textContent = texteAttente;
    rendre();
  }

  /** Plus rien à montrer (la présentation n'a pas commencé, aucune régie ne répond…) : le texte d'attente prend la place de la carte. */
  function attendre(texte) {
    ecran.plan = null;
    $('attente').textContent = texte;
    rendre();
  }

  /**
   * À la souris, le MJ agit aussi depuis l'écran de table : glisser un pion, montrer une case. Un doigt de joueur sur la carte
   * ne déclenche rien. L'écran de table ne décide de rien : il demande à la régie, qui seule a le plan complet.
   */
  function activerActions({ deplacer, viser }) {
    activerDeplacement($('carte-table'), {
      plan: () => ecran.plan,
      taille: () => tailleEcranTable(),
      apercu: (plan) => dessiner($('carte-table'), plan, optionsEcran(tailleEcranTable())),
      deposer: (nouveau) => {
        const pion = nouveau.creatures.find((k, i) => k.x !== ecran.plan.creatures[i].x || k.y !== ecran.plan.creatures[i].y);
        if (pion) deplacer(pion.id, pion.x, pion.y);
      },
      cliquer: (touche, caseVide) => { if (!touche && caseVide) viser(caseVide[0], caseVide[1]); },
      deplacables: ['creature'],
      filtre: (e) => e.pointerType === 'mouse',
    });
  }

  /** Fait défiler la vue table d'une part de l'écran (-1, 0 ou 1 par axe), ou la recentre. */
  function defiler({ dx = 0, dy = 0, recentrer = false }) {
    const v = $('vue-table');
    if (recentrer) v.scrollTo({ left: (v.scrollWidth - v.clientWidth) / 2, top: (v.scrollHeight - v.clientHeight) / 2 });
    else v.scrollBy({ left: dx * Math.round(v.clientWidth * 0.6), top: dy * Math.round(v.clientHeight * 0.6) });
  }

  // Recalculé quand la fenêtre change de taille (le mode « remplir » suit ; « échelle réelle » ne bouge pas).
  let minuteTaille;
  window.addEventListener('resize', () => {
    clearTimeout(minuteTaille);
    minuteTaille = setTimeout(() => { if (ecran.plan && !$('ecran-table').hidden) rendre(); }, 120);
  });

  // Boutons de coin : invisibles ET inactifs (pointer-events: none) tant que la souris n'a pas bougé, puis quelques
  // secondes. Un toucher (joueur qui pose le doigt sur la carte) ne les réveille jamais.
  let minuteCoins;
  function cacherCoins() { clearTimeout(minuteCoins); $('ecran-table').classList.remove('coins-visibles'); surCoinsCaches?.(); }
  function montrerCoins() {
    $('ecran-table').classList.add('coins-visibles');
    clearTimeout(minuteCoins);
    minuteCoins = setTimeout(cacherCoins, DUREE_COINS);
  }
  $('ecran-table').addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') montrerCoins(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Tab' && !$('ecran-table').hidden) montrerCoins(); });

  function basculerPleinEcran() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else $('ecran-table').requestFullscreen?.().catch(() => {});
  }
  $('plein-ecran-table').addEventListener('click', basculerPleinEcran);
  document.addEventListener('fullscreenchange', () => {
    $('plein-ecran-table').textContent = document.fullscreenElement ? '⛶ Quitter le plein écran' : '⛶ Plein écran';
  });

  return {
    appliquer, attendre, activerActions, defiler,
    /** L'affichage en cours (la fenêtre table s'en sert de repli quand un message en porte un invalide). */
    affichage: () => ecran.affichage,
    aUnPlan: () => !!ecran.plan,
  };
}
