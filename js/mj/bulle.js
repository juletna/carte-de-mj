/**
 * La bulle d'actions de l'élément sélectionné (`#selection`) : relier ou créer la salle derrière une porte, cacher, supprimer ;
 * sa position à côté de l'élément. Fabrique `creerBulle(ctx)` ; `ctx` est celui de main-mj.js (`etat`, `donjon`, `salle`, `rendre`,
 * `modifierPlan`, `deselectionner`, `historique`, `activerSalle`, `salles`, `carte`), lu au moment de l'appel. Renvoie `maj`
 * (à rappeler après chaque rendu et chaque changement de sélection) et `placer` (après un redessin, un zoom ou un défilement).
 */
import * as modele from '../donjon.js';
import { libelleSelection } from '../coordonnees.js';
import { MARGE, rectDe } from '../rendu/geometrie.js';
import { hauteurMaxBulle, positionBulle } from '../mise-en-page.js';
import { telephone } from '../telephone.js';
import { $, h, bouton, deuxTemps } from '../dom.js';
import { OPPOSE } from '../murs.js';
import { LIBELLE_FERMER } from '../format.js';

export function creerBulle(ctx) {
  const { etat } = ctx;
  const r = etat.reglages;
  const donjon = () => ctx.donjon();
  const salle = () => ctx.salle();
  const rendre = () => ctx.rendre();

  // --- Bulle d'actions de l'élément sélectionné -------------------------------------------------
  // Sur ordinateur, `#selection` est une bulle posée à côté de l'élément, dans `#support` (elle défile avec la carte) ;
  // sous 760 px, c'est le bandeau fixe en bas de l'écran (CSS). Le contenu est le même.
  /** Supprime l'élément sélectionné (une porte reliée perd d'abord sa liaison) ; annulable avec « Annuler ». */
  function supprimerSelection() {
    const s = salle();
    const res = modele.supprimerElement(donjon(), s.id, etat.selection);
    if (!res) return;
    ctx.modifierPlan(res.plan, { liaisons: res.liaisonsRetirees });
  }

  function majSelection() {
    const zone = $('selection');
    const s = salle(), d = donjon();
    const trouve = modele.retrouverElement(s.plan, etat.selection);
    if (!trouve) {
      etat.selection = null;
      zone.hidden = true;
      zone.replaceChildren();
      return;
    }
    zone.hidden = false;
    const el = trouve.element;
    const contenu = [
      bouton(LIBELLE_FERMER, () => { ctx.deselectionner(); rendre(); }, 'discret petit fermer-selection'),
      h('p', { className: 'selection-titre', textContent: libelleSelection(trouve) }),
    ];

    // Une porte relie deux salles du même niveau, un escalier deux niveaux voisins : les mêmes actions pour les deux.
    const escalier = modele.estEscalier(el);
    const reliable = trouve.genre === 'porte' || escalier;
    const lien = reliable ? modele.liaisonDePorte(d, s.id, el) : null;
    if (reliable) {
      if (lien) {
        const autre = d.salles[lien.autre.salle];
        contenu.push(escalier
          ? h('p', {}, `${el.sens === 'monte' ? 'Monte' : 'Descend'} à `, h('strong', { textContent: autre.nom }), ` (${modele.nomNiveau(modele.niveaux(d)[autre.id])}).`)
          : h('p', {}, 'Reliée à ', h('strong', { textContent: autre.nom }), '.'));
        if (modele.liaisonsOrphelines(d).some((o) => o.liaison === lien.liaison && o.cote !== lien.cote)) {
          contenu.push(h('p', { className: 'note erreur', textContent: `${escalier ? 'L’escalier' : 'La porte'} de retour a disparu dans cette salle : la liaison est orpheline là-bas.` }));
        }
        contenu.push(h('div', { className: 'actions' },
          bouton(`Aller à « ${autre.nom} »`, () => ctx.activerSalle(autre.id)),
          bouton('Délier', () => { modele.delier(d, lien.liaison.id); etat.message = 'Liaison retirée.'; rendre(); }, 'discret')));
      } else {
        const depuis = modele.extremite(s.id, el);
        const ou = escalier ? (el.sens === 'monte' ? 'en haut de cet escalier' : 'en bas de cet escalier') : 'derrière cette porte';
        const creer = bouton(escalier ? `Créer la salle ${el.sens === 'monte' ? 'du dessus' : 'du dessous'}` : 'Créer la salle derrière', () => {
          try {
            const { salle: nouvelle } = modele.creerSalleDerriere(d, { depuis, echelle: r.echelle });
            etat.neuves.add(nouvelle.id);
            etat.message = `Salle « ${nouvelle.nom} » créée ${ou} (6 × 6 cases${escalier ? `, ${modele.nomNiveau(modele.niveaux(d)[nouvelle.id]).toLowerCase()}` : ''}). Tu restes ici.`;
            ctx.salles.majListe();
          } catch (err) { etat.message = err.message; }
          rendre();
        });
        const actions = [creer];
        if (escalier) {
          // Le sens se change tant que l'escalier n'est pas relié : ensuite, il fixe le niveau de la salle d'arrivée.
          const sens = bouton(el.sens === 'monte' ? 'Il descend plutôt' : 'Il monte plutôt', () => {
            const objets = s.plan.objets.map((o) => {
              if (o.id !== el.id) return o;
              const { sens: _, ...sans } = o;
              return el.sens === 'monte' ? sans : { ...sans, sens: 'monte' };
            });
            ctx.modifierPlan({ ...s.plan, objets }, { garderSelection: true });
          }, 'discret');
          actions.push(sens);
        }
        contenu.push(h('div', { className: 'actions' }, ...actions));
        const autres = modele.listerSalles(d).filter((x) => x.id !== s.id);
        if (autres.length) {
          const choix = h('select', { id: 'relier-choix', 'aria-label': 'Salle à relier' },
            ...autres.map((x) => h('option', { value: x.id, textContent: x.nom })));
          const relier = bouton('Relier', () => {
            const cible = d.salles[choix.value];
            if (!cible) return;
            const ancres = modele.ancresDeSalle(d, cible.id);
            const texteAvant = cible.texte;
            try {
              modele.relierASalle(d, depuis, cible.id, { echelle: r.echelle });
              ctx.historique.pile(donjon().id, cible.id).push({ texte: texteAvant, ancres, liaisons: [] }); // annulable depuis la salle d'arrivée
              etat.message = escalier
                ? `Relié à « ${cible.nom} » : un escalier qui ${el.sens === 'monte' ? 'descend' : 'monte'} y a été ajouté.`
                : `Reliée à « ${cible.nom} » : une porte a été ajoutée sur son mur ${OPPOSE[el.mur]}.`;
            } catch (err) { etat.message = err.message; }
            rendre();
          }, 'discret');
          relier.title = escalier
            ? 'Relier cet escalier à une salle existante (un escalier de retour y est ajouté)'
            : 'Relier cette porte à une salle existante (une porte est ajoutée sur son mur opposé)';
          contenu.push(h('div', { className: 'ligne-relier' }, choix, relier));
        }
      }
    }

    // Cacher / supprimer : sur toute la sélection. Un seul clic pour supprimer (« Annuler » rattrape une erreur), sauf une
    // porte reliée : il faut confirmer en deux temps, car la liaison est retirée avec elle.
    const basculer = bouton(el.cache === true ? 'Rendre visible' : 'Marquer comme caché', () => {
      const nouveau = modele.basculerCache(s.plan, etat.selection);
      if (!nouveau) return;
      ctx.modifierPlan(nouveau, { garderSelection: true });
    }, 'discret');
    let supprimer;
    if (lien) {
      supprimer = h('button', { type: 'button', className: 'discret', title: `Supprime ${escalier ? 'cet escalier' : 'cette porte'} et retire sa liaison (annulable)` });
      deuxTemps(supprimer, 'Supprimer', 'Retirer la liaison et supprimer ?', supprimerSelection);
    } else {
      supprimer = bouton('Supprimer', supprimerSelection, 'discret');
      supprimer.title = 'Supprime cet élément (annulable)';
    }
    contenu.push(h('div', { className: 'actions' }, basculer, supprimer));
    if (el.cache === true) contenu.push(h('p', { className: 'note', textContent: 'Caché aux joueurs. Tu le vois ici, en translucide avec un contour en pointillés.' }));
    if (etat.message) contenu.push(h('p', { className: 'note', textContent: etat.message }));
    zone.replaceChildren(...contenu);
    placerBulle();
  }

  /**
   * Pose la bulle à côté de l'élément sélectionné : à droite, sinon à gauche, sinon dessous, sinon dessus, puis recalée pour ne
   * jamais dépasser de la zone visible de la scène (même si la carte zoomée la déborde). Rappelée à chaque redessin, zoom,
   * défilement et redimensionnement. Sous 760 px la bulle est le bandeau du bas : rien à placer.
   */
  function placerBulle() {
    const bulle = $('selection');
    if (bulle.hidden) return;
    if (telephone()) { bulle.style.left = bulle.style.top = bulle.style.maxHeight = ''; return; }
    const plan = salle().plan;
    const trouve = modele.retrouverElement(plan, etat.selection);
    const scene = $('scene');
    if (!trouve || !scene.clientWidth) return;
    const t = ctx.carte.taille(plan);
    const rc = rectDe(trouve.genre, trouve.element, plan);
    const cv = $('carte').getBoundingClientRect(), sc = scene.getBoundingClientRect();
    const ancre = { g: cv.left + (MARGE + rc.x) * t, h: cv.top + (MARGE + rc.y) * t };
    ancre.d = ancre.g + rc.l * t;
    ancre.b = ancre.h + rc.h * t;
    const vue = { g: sc.left + scene.clientLeft + 8, h: sc.top + scene.clientTop + 8 };
    vue.d = sc.left + scene.clientLeft + scene.clientWidth - 8;
    vue.b = Math.min(sc.top + scene.clientTop + scene.clientHeight - 8, $('zoom').getBoundingClientRect().top - 8); // au-dessus du zoom, qui reste visible
    bulle.style.maxHeight = `${hauteurMaxBulle(vue)}px`;
    const { x, y } = positionBulle(ancre, vue, bulle.offsetWidth, bulle.offsetHeight);
    const sp = $('support').getBoundingClientRect();
    bulle.style.left = `${Math.round(x - sp.left)}px`;
    bulle.style.top = `${Math.round(y - sp.top)}px`;
  }
  $('scene').addEventListener('scroll', placerBulle, { passive: true });

  $('scene').addEventListener('scroll', placerBulle, { passive: true });

  // Un clic dans le vide de la scène (hors carte et hors bulle) ferme la bulle, comme un clic dans le vide de la carte.
  $('scene').addEventListener('pointerdown', (e) => {
    if (!etat.selection || (e.target !== $('scene') && e.target !== $('support'))) return;
    ctx.deselectionner();
    rendre();
  });

  return { maj: majSelection, placer: placerBulle };
}
