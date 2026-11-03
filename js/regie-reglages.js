/**
 * Les réglages de la régie (partagés avec le Donjon : carte-de-mj:reglages-v1) : taille de case, grille, repères, mini-carte et
 * mode de la table, adaptation de la carte de la régie à la fenêtre. Fabrique `creerReglages(ctx)` ; `ctx` est celui de regie.js
 * (`etat`, `r`, `rendre`, `diffuser`, `montrerIci`), lu au moment de l'appel.
 */
import * as stockage from './stockage.js';
import { modeTable } from './affichage.js';
import { $ } from './dom.js';

export function creerReglages(ctx) {
  const { etat, r } = ctx;
  const rendre = () => ctx.rendre();
  const diffuser = () => ctx.diffuser();
  const montrerIci = () => ctx.montrerIci();
  const sauverReglages = () => stockage.sauverReglages(r);

  // --- Réglages (partagés avec le Donjon : carte-de-mj:reglages-v1) ------------------------------------
  if (r.reperes === undefined) r.reperes = true;
  $('taille').value = r.taille;
  $('taille-val').textContent = `${r.taille} px`;
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
  $('taille').addEventListener('input', (e) => { r.taille = Number(e.target.value); $('taille-val').textContent = `${r.taille} px`; sauverReglages(); majModeTable(); rendre(); });
  $('grille').addEventListener('change', (e) => { r.grille = e.target.checked; sauverReglages(); rendre(); });
  $('reperes').addEventListener('change', (e) => { r.reperes = e.target.checked; sauverReglages(); rendre(); });
  $('ajuster').addEventListener('change', (e) => { etat.ajuster = e.target.checked; rendre(); });
}
