/**
 * La VUE TABLE (presentation.html?vue=table) : uniquement la carte, alimentée par la régie par le canal.
 *
 * SÉCURITÉ : cette fenêtre ne lit jamais les présentations du localStorage (seuls les réglages d'affichage) et ne reçoit de la
 * régie que le résultat de vueTable() et de miniPlanTable() (voir vue-publique.js), relu par lireEtat (protocole-table.js).
 * Aucun secret n'arrive jusqu'ici. Elle n'importe ni la partie ni le parseur.
 */
import * as stockage from './stockage.js';
import * as table from './commande-table.js';
import { creerEcranTable } from './ecran-table.js';
import { MESSAGES, ouvrirCanal, lireEtat, lireDefilement, messageDemandeEtat, messageDeplacer, messageViser } from './protocole-table.js';
import { affichageDeReglages } from './affichage.js';
import { TYPE_UNIVERS, lireVueUnivers } from './univers-protocole.js';
import { creerTableUnivers } from './univers-table.js';
import { $ } from './dom.js';
import { poserIcones } from './regie-icones.js';

export function demarrerTable() {
  document.body.classList.add('vue-table');
  if (new URLSearchParams(location.search).get('apercu') === '1') document.body.classList.add('vue-apercu'); // encadrée dans la régie : sans boutons de coin
  document.title = 'Table · Carte de MJ';
  $('ecran-table').hidden = false;
  poserIcones(); // l'icône du bouton plein écran
  const reglages = stockage.chargerReglages(); // seuls les réglages d'affichage : jamais les présentations
  const ecran = creerEcranTable({ affichage: affichageDeReglages(reglages) });
  const universTable = creerTableUnivers(); // une carte d'univers à la place de la salle (js/univers-table.js)
  const attendre = (texte) => ecran.attendre(texte);

  const canal = ouvrirCanal();
  if (!canal) { attendre('Ce navigateur ne permet pas de recevoir la présentation (BroadcastChannel indisponible).'); return; }
  let recu = false, regiePresente = false;
  canal.onmessage = (ev) => {
    const m = ev.data;
    if (!m || typeof m !== 'object') return;
    if (m.type === TYPE_UNIVERS) {
      const lu = lireVueUnivers(m, ecran.affichage());
      if (!lu) return;
      recu = true;
      ecran.appliquer({ plan: null, mini: null, caseVisee: null, affichage: lu.affichage }, '');
      universTable.montrer(lu.vue, lu.affichage, lu.defilement);
    } else if (m.type === MESSAGES.ETAT) {
      universTable.masquer();
      recu = true;
      ecran.appliquer(lireEtat(m, ecran.affichage()), 'La présentation n’a pas commencé. Lance-la depuis la régie.');
    } else if (m.type === MESSAGES.DEFILER) {
      ecran.defiler(lireDefilement(m));
    } else if (m.type === table.PRESENCE) {
      regiePresente = true; // on continue à demander : la régie qui a la main, ou qui la reprendra, nous servira
      if (!ecran.aUnPlan()) attendre('En attente de la régie : lance une présentation, ou clique sur « Reprendre la main » dans une régie en retrait.');
    }
  };
  ecran.activerActions({
    deplacer: (id, x, y) => canal.postMessage(messageDeplacer(id, x, y)),
    viser: (x, y) => canal.postMessage(messageViser(x, y)),
  });
  attendre('En attente de la régie…');
  const demander = () => canal.postMessage(messageDemandeEtat());
  demander();
  const relance = setInterval(() => { if (recu) clearInterval(relance); else demander(); }, 2000);
  setTimeout(() => {
    if (!recu && !regiePresente) attendre('Aucune régie ne répond. Ouvre presentation.html dans une autre fenêtre de ce navigateur et lance une présentation.');
  }, 1500);
}
