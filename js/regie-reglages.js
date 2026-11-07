/**
 * Les réglages de la régie (partagés avec le Donjon : carte-de-mj:reglages-v1) : taille de case (groupe Régie du popover « Affichage »), plan du donjon, mode de la table, rotation, miroir,
 * calibrage, adaptation de la carte de la régie à la fenêtre. Le rendu de la carte (grille, thème, détails, relief, pénombre, flammes, repères)
 * n'est plus ici : un seul bouton « Affichage » le règle (js/atelier/affichage-popover.js). Fabrique `creerReglages(ctx)` ; `ctx` est celui de regie.js
 * (`etat`, `r`, `commande`, `rendre`, `diffuser`, `montrerIci`), lu au moment de l'appel. Renvoie `sauver` (à rappeler quand la régie reprend la main).
 *
 * Plusieurs régies peuvent être ouvertes : en retrait, un réglage reste propre à cet onglet, rien n'est enregistré. La régie qui a la main n'écrit
 * que ce qu'elle a changé elle-même (depuis `lu`), sur ce qui est enregistré à cet instant, et reprend ce que les autres ont réglé.
 */
import * as stockage from './stockage.js';
import { modeTable, ajusterTaille, caseMmValide, CASE_MM_PAR_DEFAUT } from './affichage.js';
import { $ } from './dom.js';

export function creerReglages(ctx) {
  const { etat, r, commande } = ctx;
  const rendre = () => ctx.rendre();
  const diffuser = () => ctx.diffuser();
  const montrerIci = () => ctx.montrerIci();
  let lu;
  function sauverReglages() {
    if (commande.retrait) return;
    const frais = stockage.enregistrerReglages(lu, r).reglages;
    for (const cle of Object.keys(r)) delete r[cle];
    Object.assign(r, frais);
    majControles();
  }

  // --- Réglages (partagés avec le Donjon : carte-de-mj:reglages-v1) ------------------------------------
  /** Les contrôles montrent `r`, et `lu` retient ce qui est enregistré : la prochaine différence sera un changement fait ici. */
  function majControles() {
    if (r.reperes === undefined) r.reperes = true;
    lu = { ...r };
    majTaille();
    majOrientation();
    $('case-mm').value = r.caseMm ?? CASE_MM_PAR_DEFAUT;
  }
  const NOMS_ROTATION = { 0: 'Aucune', 90: '90° à droite', 180: '180°', 270: '90° à gauche' };
  /** L'orientation de l'écran de table : la valeur écrite, l'interrupteur du miroir, et l'aperçu (un « F » tourné et retourné comme la carte le sera). */
  function majOrientation() {
    const rot = r.rotationTable || 0, miroir = r.miroirTable === true;
    $('rotation-val').textContent = NOMS_ROTATION[rot] ?? `${rot}°`;
    $('miroir-table').setAttribute('aria-checked', String(miroir));
    $('apercu-lettre').style.transform = `rotate(${rot}deg)${miroir ? ' scaleX(-1)' : ''}`;
  }
  /** Affiche la taille partout où on la règle. */
  function majTaille() {
    $('taille').value = r.taille;
    $('taille-val').textContent = `${r.taille} px`;
    $('calibrage-val').textContent = `${r.taille} px`;
  }
  majControles();
  $('taille').addEventListener('input', (e) => { r.taille = Number(e.target.value); majTaille(); sauverReglages(); rendre(); });

  // --- L'écran de table : orientation et calibrage ------------------------------------------------------
  for (const [id, pas] of [['rotation-gauche', -90], ['rotation-droite', 90]]) {
    $(id).addEventListener('click', () => {
      const v = (((r.rotationTable || 0) + pas) % 360 + 360) % 360;
      if (v) r.rotationTable = v; else delete r.rotationTable;
      majOrientation(); sauverReglages(); rendre();
    });
  }
  $('miroir-table').addEventListener('click', () => {
    if (r.miroirTable === true) delete r.miroirTable; else r.miroirTable = true;
    majOrientation(); sauverReglages(); rendre();
  });
  for (const [id, pas] of [['case-mm-moins', -1], ['case-mm-plus', 1]]) {
    $(id).addEventListener('click', () => {
      const v = Math.round(((r.caseMm ?? CASE_MM_PAR_DEFAUT) + pas) * 10) / 10;
      if (!caseMmValide(v)) return;
      if (v === CASE_MM_PAR_DEFAUT) delete r.caseMm; else r.caseMm = v;
      $('case-mm').value = v; sauverReglages(); rendre();
    });
  }
  $('case-mm').addEventListener('change', (e) => {
    const v = Number(String(e.target.value).replace(',', '.'));
    if (!caseMmValide(v)) { e.target.value = r.caseMm ?? CASE_MM_PAR_DEFAUT; return; }
    if (v === CASE_MM_PAR_DEFAUT) delete r.caseMm; else r.caseMm = v;
    sauverReglages(); rendre();
  });
  function basculerCalibrage(actif) {
    etat.calibrage = actif;
    $('calibrer-table').hidden = actif;
    $('reglage-calibrage').hidden = !actif;
    $('materiel-table').hidden = actif; // le calibrage se déplie dans le popover « Affichage », qui reste ouvert
    rendre();
  }
  $('calibrer-table').addEventListener('click', () => basculerCalibrage(true));
  $('calibrage-fini').addEventListener('click', () => {
    r.calibre = true; r.modeTable = 'reel'; // ce qui vient d'être mesuré sert à la table
    sauverReglages(); basculerCalibrage(false);
  });
  for (const b of document.querySelectorAll('[data-pas-taille]')) {
    b.addEventListener('click', () => { r.taille = ajusterTaille(r.taille, Number(b.dataset.pasTaille)); majTaille(); sauverReglages(); rendre(); });
  }
  $('ajuster').addEventListener('click', () => { etat.ajuster = $('ajuster').getAttribute('aria-checked') === 'true'; rendre(); }); // le popover bascule l'interrupteur avant ce clic-ci
  return { sauver: sauverReglages };
}
