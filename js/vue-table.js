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
import { $ } from './dom.js';

export function demarrerTable() {
  document.body.classList.add('vue-table');
  document.title = 'Table · Carte de MJ';
  $('ecran-table').hidden = false;
  const reglages = stockage.chargerReglages(); // seuls les réglages d'affichage : jamais les présentations
  const ecran = creerEcranTable({ affichage: affichageDeReglages(reglages) });
  const attendre = (texte) => ecran.attendre(texte);

  const canal = ouvrirCanal();
  if (!canal) { attendre('Ce navigateur ne permet pas de recevoir la présentation (BroadcastChannel indisponible).'); return; }
  let recu = false, regiePresente = false;
  canal.onmessage = (ev) => {
    const m = ev.data;
    if (!m || typeof m !== 'object') return;
    if (m.type === MESSAGES.ETAT) {
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
