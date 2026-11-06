/**
 * La forme, le sol, l'ambiance, l'état, l'éclairage et les dimensions de la salle affichée : boutons de forme avec leur épaisseur et leur position (js/formes.js),
 * sol, ambiance / état / éclairage (champs facultatifs du plan : schema.js), bandes autour de la carte (glisser, ou boutons − et +). Chaque changement passe par `modifierPlan` : la description suit.
 * Fabrique `creerSalleForme(ctx)` ; `ctx` est celui de main-mj.js (`salle`, `modifierPlan`, `annoncerCarte`,
 * `carte`), lu au moment de l'appel. Renvoie `majForme` : à rappeler après chaque rendu.
 */
import { SOLS, NOMS_SOLS, CHAMPS_AMBIANCE, NOMS_AMBIANCES, NOMS_ETATS_SALLE, NOMS_ECLAIRAGES } from '../schema.js';
import { redimensionner, changerForme } from '../pose.js';
import { FORMES, LIBELLES_FORMES, POSITIONS_FORMES, LIBELLES_POSITIONS, NOMS_POSITIONS, libelleDesBras, casesRetirees, brasDe, brasMax, nombreCases } from '../formes.js';
import { $, h } from '../dom.js';
import { icone } from '../icones.js';

/** Champ du plan → sélecteur de l'onglet Salle (donjon.html). */
const SELECTEURS_AMBIANCE = { ambiance: 'salle-ambiance', etat: 'salle-etat', eclairage: 'salle-eclairage' };

export function creerSalleForme(ctx) {
  const salle = () => ctx.salle();
  const modifierPlan = (plan, options) => ctx.modifierPlan(plan, options);
  const annoncerCarte = (...a) => ctx.annoncerCarte(...a);
  let enGlissementForme = false; // le curseur d'épaisseur est en cours de glissement : une seule entrée d'annulation

  // --- Forme de la salle : boutons, épaisseur et position (js/formes.js) ---

  /** Petit dessin de la forme, tiré du même calcul que la vraie salle. */
  function iconeForme(forme) {
    const plan = { largeur: 5, longueur: 5, forme, bras: forme === 'rectangle' ? undefined : 1 };
    const vides = casesRetirees(plan);
    let cases = '';
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (!vides.has(`${x},${y}`)) cases += `<rect x="${x}" y="${y}" width="1.02" height="1.02"/>`;
    return `<svg viewBox="-0.5 -0.5 6 6" aria-hidden="true" fill="currentColor">${cases}</svg>`;
  }

  for (const forme of FORMES) {
    const b = h('button', { type: 'button', className: 'btn', title: LIBELLES_FORMES[forme] });
    b.dataset.forme = forme;
    b.innerHTML = iconeForme(forme); // uniquement nos propres rectangles
    b.append(h('span', { textContent: LIBELLES_FORMES[forme] }));
    b.addEventListener('click', () => appliquerForme({ forme }));
    $('formes').append(b);
  }

  /** Applique une forme : la description suit. `sansMemoire` : le curseur en cours de glissement ne remplit pas « Annuler ». */
  function appliquerForme(champs, { sansMemoire = false } = {}) {
    const s = salle();
    const res = changerForme(s.plan, champs);
    if (res.erreur) { annoncerCarte(res.erreur, true); return; }
    modifierPlan(res.plan, { memoire: !sansMemoire });
    if (res.deplaces) annoncerCarte(`${res.deplaces} élément${res.deplaces > 1 ? 's poussés' : ' poussé'} sur le sol de la nouvelle forme.`);
  }

  function majForme() {
    const plan = salle().plan;
    $('salle-sol').value = plan.sol;
    for (const [champ, id] of Object.entries(SELECTEURS_AMBIANCE)) $(id).value = plan[champ] ?? CHAMPS_AMBIANCE[champ][0];
    $('salle-largeur').value = String(plan.largeur);
    $('salle-longueur').value = String(plan.longueur);
    for (const id of ['salle-sol', ...Object.values(SELECTEURS_AMBIANCE)]) $(id).dispatchEvent(new Event('synchro')); // les rangées de l'inspecteur (js/atelier/champ-choix.js) relisent
    const forme = plan.forme || 'rectangle';
    for (const b of $('formes').children) b.setAttribute('aria-pressed', String(b.dataset.forme === forme));
    const max = brasMax(plan);
    const decoupable = forme !== 'rectangle';
    $('forme-reglages').hidden = !decoupable;
    $('forme-ligne-bras').hidden = !max;
    if (max) {
      $('forme-nom-bras').textContent = libelleDesBras(forme);
      $('forme-bras').max = String(max);
      if (document.activeElement !== $('forme-bras') || !enGlissementForme) $('forme-bras').value = String(brasDe(plan));
      $('forme-bras-val').textContent = `${brasDe(plan)} case${brasDe(plan) > 1 ? 's' : ''}`;
    }
    const positions = POSITIONS_FORMES[forme];
    $('forme-ligne-position').hidden = !positions;
    if (positions) {
      $('forme-nom-position').textContent = LIBELLES_POSITIONS[forme];
      if ($('forme-position').dataset.forme !== forme) {
        $('forme-position').dataset.forme = forme;
        $('forme-position').replaceChildren(...positions.map((p) => h('option', { value: p, textContent: NOMS_POSITIONS[p] })));
      }
      $('forme-position').value = positions.includes(plan.position) ? plan.position : positions[0];
    }
    const n = nombreCases(plan);
    $('forme-compte').textContent = decoupable && !max
      ? `Salle de ${plan.largeur} × ${plan.longueur} : trop petite pour cette forme, agrandis-la avec les bandes autour de la carte.`
      : `${plan.largeur} × ${plan.longueur}, soit ${n} case${n > 1 ? 's' : ''} de sol.`;
  }

  // Le sol : la description suit, comme si « sol en bois » y avait été écrit.
  $('salle-sol').replaceChildren(...SOLS.map((sol) => h('option', { value: sol, textContent: NOMS_SOLS[sol] })));
  $('salle-sol').addEventListener('change', (e) => {
    modifierPlan({ ...salle().plan, sol: e.target.value });
  });

  // Ambiance, état et éclairage : la valeur par défaut (la première) n'écrit rien dans le plan, comme un champ absent.
  const NOMS_CHAMPS = { ambiance: NOMS_AMBIANCES, etat: NOMS_ETATS_SALLE, eclairage: NOMS_ECLAIRAGES };
  for (const [champ, id] of Object.entries(SELECTEURS_AMBIANCE)) {
    $(id).replaceChildren(...CHAMPS_AMBIANCE[champ].map((v) => h('option', { value: v, textContent: NOMS_CHAMPS[champ][v] })));
    $(id).addEventListener('change', (e) => {
      const { [champ]: _ancien, ...plan } = salle().plan;
      modifierPlan(e.target.value === CHAMPS_AMBIANCE[champ][0] ? plan : { ...plan, [champ]: e.target.value });
    });
  }

  const champsForme = () => ({ forme: salle().plan.forme, bras: Number($('forme-bras').value), position: salle().plan.position });
  $('forme-bras').addEventListener('input', () => {
    appliquerForme(champsForme(), { sansMemoire: enGlissementForme });
    enGlissementForme = true;
  });
  $('forme-bras').addEventListener('change', () => { enGlissementForme = false; });
  $('forme-position').addEventListener('change', () => appliquerForme({ ...salle().plan, position: $('forme-position').value }));

  // --- Dimensions de la salle : bandes autour de la carte (glisser, ou boutons − et +) ---
  /** Applique de nouvelles dimensions : la description suit, et une liaison suit sa porte si elle s'est décalée. */
  function appliquerDimensions(cote, delta) {
    const s = salle();
    const res = redimensionner(s.plan, cote, delta);
    if (res.erreur) { annoncerCarte(res.erreur, true); return; }
    modifierPlan(res.plan, { suivrePortes: true });
    annoncerCarte(`Salle de ${res.plan.largeur} × ${res.plan.longueur} cases.`);
  }

  // Largeur et longueur en champs : un changement est un redimensionnement par le bord est (largeur) ou sud (longueur), comme les bandes de la carte.
  for (const [id, cote, champ] of [['salle-largeur', 'est', 'largeur'], ['salle-longueur', 'sud', 'longueur']]) {
    $(id).addEventListener('change', (e) => {
      const voulu = Math.round(Number(e.target.value));
      const delta = voulu - salle().plan[champ];
      if (!Number.isFinite(voulu) || !delta) { majForme(); return; }
      appliquerDimensions(cote, delta);
      majForme(); // refus (taille impossible) : le champ reprend la valeur du plan
    });
  }

  let annulerBord = null; // abandonne le glissement de bord en cours, s'il y en a un

  const NOMS_COTES = { nord: 'au nord', sud: 'au sud', ouest: 'à l’ouest', est: 'à l’est' };
  for (const bande of document.querySelectorAll('.bord-salle')) {
    const cote = bande.dataset.cote;
    const bouton = (nom, delta, titre) => {
      const b = h('button', { type: 'button', className: 'btn btn-icone btn-discret', title: titre, 'aria-label': titre }, icone(nom));
      b.addEventListener('click', () => appliquerDimensions(cote, delta));
      return b;
    };
    bande.title = `Glisse pour changer la taille de la salle ${NOMS_COTES[cote]}`;
    bande.append(
      bouton('moins', -1, `Retirer une rangée ${NOMS_COTES[cote]}`),
      h('span', { className: 'lettre-cote', textContent: bande.dataset.lettre }),
      bouton('plus', 1, `Ajouter une rangée ${NOMS_COTES[cote]}`),
    );

    // Glisser : aperçu sans rien enregistrer, à taille de case constante ; le lâcher applique. Si la réduction est
    // impossible, l'aperçu reste au dernier résultat valable et le message dit ce qui gêne.
    let prise = null; // { depart, taille, delta, plan }
    const deltaDe = (e) => {
      const px = { nord: prise.depart[1] - e.clientY, sud: e.clientY - prise.depart[1], ouest: prise.depart[0] - e.clientX, est: e.clientX - prise.depart[0] }[cote];
      return Math.round(px / prise.taille);
    };
    bande.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('button')) return;
      e.preventDefault();
      bande.setPointerCapture(e.pointerId);
      bande.classList.add('tiree');
      prise = { depart: [e.clientX, e.clientY], taille: ctx.carte.taille(salle().plan), delta: 0, plan: salle().plan };
      annulerBord = () => {
        prise = null;
        annulerBord = null;
        bande.classList.remove('tiree');
        if (bande.hasPointerCapture(e.pointerId)) bande.releasePointerCapture(e.pointerId);
        ctx.carte.redessiner(salle().plan);
        annoncerCarte(`Salle de ${salle().plan.largeur} × ${salle().plan.longueur} cases.`);
      };
    });
    bande.addEventListener('pointermove', (e) => {
      if (!prise) return;
      const delta = deltaDe(e);
      if (delta === prise.delta) return;
      const res = redimensionner(salle().plan, cote, delta);
      if (res.erreur) { annoncerCarte(res.erreur, true); return; }
      prise.delta = delta;
      prise.plan = res.plan;
      ctx.carte.apercu(res.plan, prise.taille);
      annoncerCarte(`Salle de ${res.plan.largeur} × ${res.plan.longueur} cases.`);
    });
    const lacher = (e) => {
      if (!prise) return;
      const { delta } = prise;
      prise = null;
      annulerBord = null;
      bande.classList.remove('tiree');
      if (delta && e.type === 'pointerup') appliquerDimensions(cote, delta);
      else ctx.carte.redessiner(salle().plan);
    };
    bande.addEventListener('pointerup', lacher);
    bande.addEventListener('pointercancel', lacher);
  }

  /** Échap pendant le glissement d'un bord : la salle reste telle quelle. Renvoie vrai s'il y en avait un. */
  function annulerGlisserBord() {
    if (!annulerBord) return false;
    annulerBord();
    return true;
  }

  return { majForme, annulerGlisserBord };
}
