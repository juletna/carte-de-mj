/**
 * Les réglages du rendu de la carte, communs au Donjon et à la régie : Thème (peint / vectoriel), Détails des sols (riches / sobres), Relief (fausse 3D
 * des murs), Pénombre (obscurité de la salle à la table, 0–100 %) et Flammes animées (à la table seulement). Les contrôles ont les mêmes identifiants dans
 * donjon.html et presentation.html : #theme (liste), #details (liste), #relief (case à cocher), #penombre (curseur),
 * #penombre-val (sa valeur), #flammes (case à cocher).
 *
 * `r` est l'objet des réglages (carte-de-mj:reglages-v1) ; chaque contrôle le modifie puis appelle `surChangement` (enregistrer, redessiner).
 * Une valeur par défaut n'est pas écrite (voir stockage.js). La grille (`cases`) n'est pas ici : un seul bouton la règle, dans la barre de la scène (js/atelier/grille-affichage.js). Renvoie `maj()`, à appeler quand `r` a été relu.
 */
import { themeDeReglages, detailsDeReglages, reliefDeReglages, penombreDeReglages, flammesDeReglages, THEME_PAR_DEFAUT, DETAILS_PAR_DEFAUT, PENOMBRE_PAR_DEFAUT } from './affichage.js';
import { $ } from './dom.js';

export function lierReglagesRendu(r, surChangement) {
  const maj = () => {
    $('theme').value = themeDeReglages(r);
    $('details').value = detailsDeReglages(r);
    $('relief').checked = reliefDeReglages(r);
    $('penombre').value = String(penombreDeReglages(r));
    $('penombre-val').textContent = `${penombreDeReglages(r)} %`;
    $('flammes').checked = flammesDeReglages(r);
  };
  $('theme').addEventListener('change', (e) => {
    if (e.target.value === THEME_PAR_DEFAUT) delete r.theme; else r.theme = e.target.value;
    surChangement();
  });
  $('details').addEventListener('change', (e) => {
    if (e.target.value === DETAILS_PAR_DEFAUT) delete r.details; else r.details = e.target.value;
    surChangement();
  });
  $('relief').addEventListener('change', (e) => {
    if (e.target.checked) delete r.relief; else r.relief = false;
    surChangement();
  });
  $('penombre').addEventListener('input', (e) => {
    const v = Math.max(0, Math.min(100, Math.round(Number(e.target.value))));
    if (v === PENOMBRE_PAR_DEFAUT) delete r.penombre; else r.penombre = v;
    $('penombre-val').textContent = `${v} %`;
    surChangement();
  });
  $('flammes').addEventListener('change', (e) => {
    if (e.target.checked) delete r.flammes; else r.flammes = false;
    surChangement();
  });
  maj();
  return { maj };
}
