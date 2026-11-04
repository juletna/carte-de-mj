/**
 * Les réglages de la régie (partagés avec le Donjon : carte-de-mj:reglages-v1) : taille de case, grille, repères, mini-carte et
 * mode de la table, adaptation de la carte de la régie à la fenêtre. Fabrique `creerReglages(ctx)` ; `ctx` est celui de regie.js
 * (`etat`, `r`, `rendre`, `diffuser`, `montrerIci`), lu au moment de l'appel.
 */
import * as stockage from './stockage.js';
import { modeTable, ajusterTaille, caseMmValide, CASE_MM_PAR_DEFAUT } from './affichage.js';
import { $ } from './dom.js';

export function creerReglages(ctx) {
  const { etat, r } = ctx;
  const rendre = () => ctx.rendre();
  const diffuser = () => ctx.diffuser();
  const montrerIci = () => ctx.montrerIci();
  const sauverReglages = () => stockage.sauverReglages(r);

  // --- Réglages (partagés avec le Donjon : carte-de-mj:reglages-v1) ------------------------------------
  if (r.reperes === undefined) r.reperes = true;
  $('grille').checked = r.grille;
  $('reperes').checked = r.reperes !== false;
  $('ajuster').checked = etat.ajuster;
  $('mini-active').checked = r.miniTable !== false;
  $('mini-active').addEventListener('change', (e) => { r.miniTable = e.target.checked; sauverReglages(); diffuser(); montrerIci(); });
  function majModeTable() {
    const mode = modeTable(r);
    $('mode-remplir').checked = mode === 'remplir';
    $('mode-reel').checked = mode === 'reel';
    $('aide-mode-table').textContent = mode === 'remplir'
      ? 'La case s’adapte à la fenêtre de la table : la salle occupe tout l’écran. Les figurines ne sont plus à l’échelle.'
      : `Chaque case garde sa taille calibrée (${r.taille} px) : les figurines restent à l’échelle. Une grande salle défile.`;
  }
  majModeTable();
  for (const radio of [$('mode-remplir'), $('mode-reel')]) {
    radio.addEventListener('change', () => { r.modeTable = radio.value; sauverReglages(); majModeTable(); diffuser(); montrerIci(); });
  }
  /** Affiche la taille partout où on la règle. */
  function majTaille() {
    $('taille').value = r.taille;
    $('taille-val').textContent = `${r.taille} px`;
    $('calibrage-val').textContent = `${r.taille} px`;
  }
  majTaille();
  $('taille').addEventListener('input', (e) => { r.taille = Number(e.target.value); majTaille(); sauverReglages(); majModeTable(); rendre(); });

  // --- L'écran de table : orientation et calibrage ------------------------------------------------------
  $('rotation-table').value = String(r.rotationTable || 0);
  $('miroir-table').checked = r.miroirTable === true;
  $('case-mm').value = r.caseMm ?? CASE_MM_PAR_DEFAUT;
  $('rotation-table').addEventListener('change', (e) => {
    const v = Number(e.target.value);
    if (v) r.rotationTable = v; else delete r.rotationTable;
    sauverReglages(); rendre();
  });
  $('miroir-table').addEventListener('change', (e) => {
    if (e.target.checked) r.miroirTable = true; else delete r.miroirTable;
    sauverReglages(); rendre();
  });
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
    rendre();
  }
  $('calibrer-table').addEventListener('click', () => basculerCalibrage(true));
  $('calibrage-fini').addEventListener('click', () => {
    r.calibre = true; r.modeTable = 'reel'; // ce qui vient d'être mesuré sert à la table
    sauverReglages(); majModeTable(); basculerCalibrage(false);
  });
  for (const b of document.querySelectorAll('[data-pas-taille]')) {
    b.addEventListener('click', () => { r.taille = ajusterTaille(r.taille, Number(b.dataset.pasTaille)); majTaille(); sauverReglages(); majModeTable(); rendre(); });
  }
  $('grille').addEventListener('change', (e) => { r.grille = e.target.checked; sauverReglages(); rendre(); });
  $('reperes').addEventListener('change', (e) => { r.reperes = e.target.checked; sauverReglages(); rendre(); });
  $('ajuster').addEventListener('change', (e) => { etat.ajuster = e.target.checked; rendre(); });
}
