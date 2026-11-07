/**
 * Écran de table : ce que voient les joueurs, de la fenêtre `?vue=table` (vue-table.js). Il ne décide de rien : il dessine ce qu'on lui donne (`appliquer`, la seule façon de le changer)
 * et, à la souris, demande à la régie de déplacer un pion ou de montrer une case, car seule la régie a le plan complet.
 *
 * Ce qu'on lui donne est déjà filtré : le résultat de `lireEtat` (message reçu). Il ne lit ni le stockage ni les parties.
 *
 * C'est la seule vue où la lumière est pleine (pénombre du réglage) et où les flammes bougent (animation-carte.js) : `dessiner` reçoit `vue: 'table'`.
 */
import { dessiner } from './rendu/moteur.js';
import { themeParNom } from './rendu/themes/index.js';
import { dessinerPlanDonjon } from './rendu/plan.js';
import { animationActive } from './rendu/lumiere.js';
import { creerAnimation, mouvementReduit } from './animation-carte.js';
import { activerDeplacement } from './deplacement.js';
import { positionFractions, poserPosition } from './cadrage-table.js';
import { AFFICHAGE_PAR_DEFAUT, optionsRendu, tailleTable, tailleQuiTientPlan, carteDeCalibrage, transformOrientation, versCarte } from './affichage.js';
import { virgule } from './format.js';
import { $ } from './dom.js';

/** Boutons de coin : invisibles ET inactifs tant que la souris n'a pas bougé, puis quelques secondes. */
const DUREE_COINS = 3500;

/**
 * @param {{affichage?:object}} [options]
 *   affichage : l'affichage avant le premier message (par défaut AFFICHAGE_PAR_DEFAUT).
 */
export function creerEcranTable({ affichage = { ...AFFICHAGE_PAR_DEFAUT } } = {}) {
  const ecran = { plan: null, mini: null, caseVisee: null, affichage, calibrage: null };
  const animation = creerAnimation($('carte-table')); // une seule boucle, qui s'arrête quand la carte n'est plus affichée

  /** Côté de case à la table : « échelle réelle » = la taille calibrée, exacte ; « remplir » = calculé sur la fenêtre. */
  function tailleEcranTable() {
    const v = $('vue-table');
    return tailleTable({ mode: ecran.affichage.mode, plan: ecran.plan, vue: { largeur: v.clientWidth, hauteur: v.clientHeight }, taille: ecran.affichage.taille, zoom: ecran.affichage.zoom });
  }

  function optionsEcran(taille) {
    const { reperes } = ecran.affichage;
    const { grille, theme, details, relief, penombre, flammes } = optionsRendu(ecran.affichage);
    const animer = animationActive({ vue: 'table', flammes, mouvementReduit: mouvementReduit() });
    return { taille, grille, theme: themeParNom(theme), details, relief, penombre, vue: 'table', animer, reperes, marques: ecran.caseVisee ? { caseVisee: ecran.caseVisee } : {} };
  }

  /** Dessine la carte et confie la scène à la boucle d'animation (qui remplace la précédente). */
  function dessinerCarte(plan, taille) {
    animation.suivre(dessiner($('carte-table'), plan, optionsEcran(taille)));
  }

  /** Tourne ou retourne tout ce que voient les joueurs ; les boutons de coin restent à l'endroit. */
  function orienter() {
    const o = $('orientation-table'), orientation = ecran.calibrage ?? ecran.affichage, { rotation = 0 } = orientation; // en calibrage, l'orientation en cours de réglage
    o.style.transform = transformOrientation(orientation);
    o.classList.toggle('couche', rotation === 90 || rotation === 270);
  }

  const ETAPES = [['orienter', 'calibrage-orienter'], ['mesurer', 'carte-calibrage'], ['termine', 'calibrage-termine']];
  const CONSIGNES = {
    orienter: 'Mets la lettre dans le sens où tu veux lire la carte.',
    mesurer: 'Pose une carte bancaire sur le rectangle. Ajuste jusqu’à ce qu’elle coïncide.',
  };
  /**
   * Le mode calibrage (message `calibrage`) : fond uni et grille seule à la taille calibrée, par étape (orienter, mesurer,
   * termine). Prioritaire sur la salle et sur une carte d'univers, qu'il ne défait pas : `ecran.plan` et le reste sont gardés tels quels.
   */
  function montrerCalibrage() {
    const c = ecran.calibrage, racine = $('calibrage-table');
    racine.hidden = !c;
    if (!c) return;
    racine.style.setProperty('--case', `${c.taille}px`);
    for (const [etape, id] of ETAPES) $(id).hidden = c.etape !== etape;
    const { largeur, hauteur } = carteDeCalibrage(c.taille, c.caseMm);
    Object.assign($('carte-calibrage').style, { width: `${largeur}px`, height: `${hauteur}px` });
    $('texte-calibrage').textContent = CONSIGNES[c.etape] ?? `Table calibrée · 1 case = ${virgule(c.caseMm)} mm`;
  }

  // L'écran reste allumé tant que la table montre quelque chose, si le navigateur le permet (sinon, rien ne change).
  let eveil = null, demandeEveil = false;
  async function garderEveille() {
    if (eveil || demandeEveil || document.hidden || $('ecran-table').hidden || !navigator.wakeLock) return;
    demandeEveil = true;
    try {
      eveil = await navigator.wakeLock.request('screen');
      eveil.addEventListener('release', () => { eveil = null; });
    } catch { /* batterie faible, page en arrière-plan… */ }
    demandeEveil = false;
  }
  document.addEventListener('visibilitychange', () => { if (ecran.plan) garderEveille(); });

  function rendre() {
    const carte = $('carte-table');
    orienter();
    montrerCalibrage();
    if (ecran.calibrage) { animation.arreter(); return; } // la salle n'est pas redessinée sous le calibrage ; elle revient à sa fin
    $('attente').hidden = !!ecran.plan;
    carte.hidden = !ecran.plan;
    const mini = $('mini-table');
    mini.hidden = !ecran.plan || !ecran.mini;
    if (!ecran.plan) { animation.arreter(); return; }
    garderEveille();
    if (ecran.mini) {
      const { donjon, disposition, actif, portesFermees } = ecran.mini;
      const taille = tailleQuiTientPlan(disposition, Math.min(window.innerWidth * 0.28, 400), Math.min(window.innerHeight * 0.36, 340));
      dessinerPlanDonjon(mini, donjon, disposition, { taille, actif, portesFermees, noms: false, pions: false, surbrillance: true });
    }
    const taille = tailleEcranTable();
    carte.dataset.taille = String(taille); // mesurable (tests, vérification) ; aucun secret
    dessinerCarte(ecran.plan, taille); // aucun repère de liaison ni de sélection
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

  /** Entre dans le mode calibrage (contenu relu par lireCalibrage) ou en sort (null) : la table montre alors exactement ce qu'elle montrait. */
  function calibrer(contenu) {
    ecran.calibrage = contenu;
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
  function activerActions({ deplacer, viser, glisser = null, tactile = false, selectionner = null }) {
    activerDeplacement($('carte-table'), {
      plan: () => ecran.plan,
      taille: () => tailleEcranTable(),
      apercu: (plan) => dessinerCarte(plan, tailleEcranTable()),
      deposer: (nouveau) => {
        const pion = nouveau.creatures.find((k, i) => k.x !== ecran.plan.creatures[i].x || k.y !== ecran.plan.creatures[i].y);
        if (pion) deplacer(pion.id, pion.x, pion.y);
      },
      cliquer: (touche, caseVide, position) => {
        if (touche) selectionner?.(touche.genre, touche.element.id, position); // vue « Table » de la régie : le MJ choisit l'élément comme sur sa carte
        else if (caseVide) viser(caseVide[0], caseVide[1]);
      },
      deplacables: ['creature'],
      filtre: (e) => e.pointerType === 'mouse' || tactile, // un doigt de joueur ne déclenche rien ; dans la vue « Table » de la régie (`tactile`), le MJ touche aussi
      glisserVide: glisser ? { deplacer: (dx, dy) => $('vue-table').scrollBy({ left: dx, top: dy }), fin: () => glisser(positionFractions($('vue-table'))) } : null,
      versCanvas: (e) => {
        const c = $('carte-table'), r = c.getBoundingClientRect();
        const [x, y] = versCarte(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2), ecran.affichage);
        return [x + parseFloat(c.style.width) / 2, y + parseFloat(c.style.height) / 2];
      },
    });
  }

  /** Pose la position de la vue table (fractions 0–1 de la course) : le cadrage que la régie renvoie après un glissement dans sa vue « Table ». */
  function cadrer(position) { poserPosition($('vue-table'), position); }

  /** Fait défiler la vue table d'une part de l'écran (-1, 0 ou 1 par axe), ou la recentre. */
  function defiler({ dx = 0, dy = 0, recentrer = false }) {
    const v = $('vue-table');
    if (recentrer) v.scrollTo({ left: (v.scrollWidth - v.clientWidth) / 2, top: (v.scrollHeight - v.clientHeight) / 2 });
    else {
      const [x, y] = versCarte(dx, dy, ecran.affichage); // « vers le haut » veut dire vers le haut de l'écran, même carte tournée
      v.scrollBy({ left: x * Math.round(v.clientWidth * 0.6), top: y * Math.round(v.clientHeight * 0.6) });
    }
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
  function cacherCoins() { clearTimeout(minuteCoins); $('ecran-table').classList.remove('coins-visibles'); }
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
    const plein = !!document.fullscreenElement;
    const libelle = plein ? 'Quitter le plein écran' : 'Plein écran';
    $('plein-ecran-table').setAttribute('aria-label', libelle);
    $('plein-ecran-table').title = libelle;
    $('ecran-table').classList.toggle('plein-ecran', plein); // en plein écran, le bouton retrouve sa discrétion complète (css/presentation.css)
  });

  return {
    appliquer, attendre, calibrer, activerActions, defiler, cadrer,
    enCalibrage: () => !!ecran.calibrage,
    /** L'affichage en cours (la fenêtre table s'en sert de repli quand un message en porte un invalide). */
    affichage: () => ecran.affichage,
    aUnPlan: () => !!ecran.plan,
  };
}
