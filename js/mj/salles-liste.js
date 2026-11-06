/**
 * Les salles du donjon : onglets au-dessus de la description, liste de l'outil Plan (renommer, afficher, supprimer), liaisons
 * orphelines, miniature du plan, bouton « Ajouter une salle ». Fabrique `creerSalles(ctx)` ; `ctx` est celui de main-mj.js
 * (`etat`, `donjon`, `salle`, `rendre`, `historique`, `activerSalle`, `afficherSalleActive`, `dispositionDuDonjon`), lu au
 * moment de l'appel. Renvoie `majListe` (onglets et liste, à rappeler quand les salles changent), `majOrphelines` et
 * `majMiniCarte` (à rappeler après chaque rendu).
 */
import * as modele from '../donjon.js';
import { creerMiniPlan } from '../miniplan.js';
import { nomCase, reperePorte } from '../coordonnees.js';
import { $, h, deuxTemps } from '../dom.js';

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

  // --- Liste des salles et mini-carte ----------------------------------------------
  /** Onglets des salles, au-dessus de la description : un clic affiche la salle. */
  function majOnglets() {
    const d = donjon();
    $('salles-onglets').replaceChildren(...modele.listerSalles(d).map((s) => {
      const actif = s.id === d.salleActive;
      const b = h('button', { type: 'button', className: `btn btn-discret onglet-salle${actif ? ' actif' : ''}`, textContent: s.nom, title: s.nom, role: 'tab', 'aria-selected': String(actif) });
      b.addEventListener('click', () => { if (!actif || etat.plan) activerSalle(s.id); }); // cliquer un onglet quitte aussi le plan
      return h('li', { role: 'presentation' }, b);
    }));
    $('salles-onglets').querySelector('.actif')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function majListe() {
    const d = donjon();
    majOnglets();
    $('salles-liste').replaceChildren(...modele.listerSalles(d).map((s) => {
      const actif = s.id === d.salleActive;
      const nom = h('input', { type: 'text', value: s.nom, maxLength: 80, spellcheck: false, 'aria-label': `Nom de la salle ${s.nom}` });
      nom.addEventListener('change', () => {
        modele.renommerSalle(d, s.id, nom.value);
        nom.value = s.nom;
        majOnglets();
        rendre(); // le titre de la salle affichée suit
      });
      const aller = h('button', { type: 'button', className: 'btn', textContent: actif ? 'Affichée' : 'Afficher', disabled: actif });
      aller.addEventListener('click', () => activerSalle(s.id));
      const suppr = h('button', { type: 'button', className: 'btn btn-danger' });
      deuxTemps(suppr, 'Supprimer', 'Confirmer ?', () => {
        const etaitActive = actif;
        modele.supprimerSalle(d, s.id, { echelle: r.echelle });
        ctx.historique.oublierSalle(donjon().id, s.id);
        if (etaitActive) afficherSalleActive();
        else { majListe(); rendre(); }
      });
      suppr.title = 'Supprime la salle et ses liaisons';
      return h('li', { className: actif ? 'actif' : '' }, nom, aller, suppr);
    }));
  }

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

  return { majListe, majOrphelines, majMiniCarte };
}
