/**
 * Les salles du donjon : le nom de la salle affichée (inspecteur « salle »), les liaisons orphelines, la miniature du plan, « Ajouter une
 * salle », et la suppression d'une salle. La liste des salles, elle, est l'arbre de l'atelier (js/atelier/coquille.js : les salles sont les
 * nœuds sous le donjon) ; les onglets de salles ont disparu. Fabrique `creerSalles(ctx)` ; `ctx` est celui de main-mj.js (`etat`,
 * `donjon`, `salle`, `rendre`, `historique`, `activerSalle`, `afficherSalleActive`, `dispositionDuDonjon`, `coquille`), lu au moment
 * de l'appel. Renvoie `majListe` (le nom et l'arbre, à rappeler quand les salles changent), `majOrphelines` et `majMiniCarte` (à rappeler
 * après chaque rendu), `supprimer(id)` (la salle et ses liaisons, annulable seulement par l'historique des salles restantes).
 */
import * as modele from '../donjon.js';
import { creerMiniPlan } from '../miniplan.js';
import { nomCase, reperePorte } from '../coordonnees.js';
import { $, h } from '../dom.js';

export function creerSalles(ctx) {
  const { etat } = ctx;
  const r = etat.reglages;
  const donjon = () => ctx.donjon();
  const salle = () => ctx.salle();
  const rendre = () => ctx.rendre();
  const activerSalle = (id) => ctx.activerSalle(id);
  const afficherSalleActive = () => ctx.afficherSalleActive();

  // --- Liaisons orphelines --------------------------------------------------------
  function majOrphelines() {
    const zone = $('orphelines');
    const d = donjon(), s = salle();
    const orphelines = modele.liaisonsOrphelines(d).filter((o) => o.salle === s.id);
    zone.hidden = orphelines.length === 0;
    zone.replaceChildren(...orphelines.map((o) => {
      const autreExt = o.liaison[o.cote === 'a' ? 'b' : 'a'];
      const autre = d.salles[autreExt.salle];
      const b = h('button', { type: 'button', className: 'btn btn-danger', textContent: 'Retirer la liaison' });
      b.addEventListener('click', () => { modele.delier(d, o.liaison.id); rendre(); });
      return h('div', { className: 'orpheline' },
        h('p', { className: 'note erreur' },
          (modele.estEscalier(o) ? `Liaison orpheline : il n’y a plus d’escalier en ${nomCase(o.x, o.y)}, `
            : `Liaison orpheline : il n’y a plus de porte au mur ${o.mur} (repère ${reperePorte(o.mur, o.position)}), `)
          + 'qui menait à « ', h('strong', { textContent: autre?.nom ?? '?' }), ' ». Rétablis la porte dans le texte, ou retire la liaison.'),
        b);
    }));
  }

  // --- Nom de la salle affichée et arbre ---------------------------------------------
  /** Le champ « Nom de la salle » de l'inspecteur suit la salle affichée ; l'arbre ne se redessine que si un nom a changé. */
  function majListe() {
    const champ = $('salle-nom');
    if (document.activeElement !== champ) champ.value = salle().nom;
    ctx.coquille?.rafraichir();
  }
  $('salle-nom').addEventListener('change', (e) => {
    modele.renommerSalle(donjon(), salle().id, e.target.value);
    e.target.value = salle().nom;
    rendre(); // le titre de la salle affichée et l'arbre suivent
    ctx.coquille?.rafraichir({ inspecteur: true }); // le titre de l'inspecteur aussi
  });

  /** Supprime la salle `id` et ses liaisons (la dernière est remplacée par une salle vide) ; si c'était la salle affichée, une autre s'affiche. */
  function supprimer(id) {
    const d = donjon();
    const etaitActive = id === d.salleActive;
    modele.supprimerSalle(d, id, { echelle: r.echelle });
    ctx.historique.oublierSalle(donjon().id, id);
    if (etaitActive) afficherSalleActive();
    else { majListe(); rendre(); }
  }

  // --- Miniature du plan (dans l'inspecteur « donjon ») ---------------------------------
  const majMiniPlan = creerMiniPlan($('minicarte'), {
    onChoisir: (id) => activerSalle(id),
    libelle: (s) => `Afficher la salle ${s.nom}`,
  });
  function majMiniCarte() {
    const d = donjon();
    majMiniPlan({ donjon: d, disposition: ctx.dispositionDuDonjon(d), actif: d.salleActive });
  }

  $('salle-ajouter').addEventListener('click', () => {
    const d = donjon();
    const nouvelle = modele.ajouterSalle(d, { echelle: r.echelle });
    etat.neuves.add(nouvelle.id);
    activerSalle(nouvelle.id); // la salle isolée s'affiche, prête à être décrite
  });

  return { majListe, majOrphelines, majMiniCarte, supprimer };
}
