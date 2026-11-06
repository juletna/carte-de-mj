/**
 * Les actions de l'élément sélectionné (porte, objet, créature, pion) : relier ou créer la salle derrière une porte, cacher, supprimer.
 * Ce n'est plus une bulle posée sur la carte : c'est le contenu de l'inspecteur de l'atelier (js/atelier/inspecteurs-donjon.js
 * l'enregistre pour les types porte, objet, creature et pion). Fabrique `creerBulle(ctx)` ; `ctx` est celui de main-mj.js (`etat`,
 * `donjon`, `salle`, `rendre`, `modifierPlan`, `deselectionner`, `historique`, `activerSalle`, `salles`, `coquille`), lu au moment de l'appel.
 *
 * Renvoie :
 *  - `maj()`    à rappeler après chaque rendu et chaque changement de `etat.selection` : l'inspecteur suit (le descripteur de donjon.js
 *               devient la sélection commune de la coquille, et inversement quand l'élément disparaît) ;
 *  - `placer()` ne fait plus rien (gardé pour vue-carte.js) ;
 *  - `etiquette()`, `titre()`, `resume()`, `actions()` (visibles), `menu()` et `destructives()` (dans « ⋯ »), `rendreDans(conteneur)` : ce que
 *    l'inspecteur affiche ; `typeDe(trouve)` : le type d'inspecteur.
 */
import * as modele from '../donjon.js';
import { libelleSelection } from '../coordonnees.js';
import { $, h } from '../dom.js';
import { OPPOSE } from '../murs.js';
import { variantesDe, varianteDe, varianteParDefaut, nomVariante } from '../catalogue.js';
import { selection as creerSelection, selectionElement, meme, TYPES_ELEMENT } from '../atelier-selection.js';
import { creerSection } from '../atelier/section.js';
import { creerVignette } from '../vignettes.js';
import { icone } from '../icones.js';
import { nomAffiche } from '../parseur/lexique.js';

export function creerBulle(ctx) {
  const { etat } = ctx;
  const r = etat.reglages;
  const donjon = () => ctx.donjon();
  const salle = () => ctx.salle();
  const rendre = () => ctx.rendre();

  /** Le type d'inspecteur d'un élément retrouvé : porte, objet, creature, ou pion (un personnage joueur). */
  const typeDe = (trouve) => (trouve.genre === 'creature' && trouve.element.type === 'personnage' ? 'pion' : trouve.genre);

  /** Supprime l'élément sélectionné (une porte reliée perd d'abord sa liaison) ; annulable avec « Annuler ». */
  function supprimerSelection() {
    const s = salle();
    const res = modele.supprimerElement(donjon(), s.id, etat.selection);
    if (!res) return;
    ctx.modifierPlan(res.plan, { liaisons: res.liaisonsRetirees });
  }

  /** Crée la salle derrière une porte (ou au-dessus / au-dessous d'un escalier) non reliée ; tu restes dans la salle courante. */
  function creerDerriere(el, escalier, depuis) {
    const d = donjon();
    const ou = escalier ? (el.sens === 'monte' ? 'en haut de cet escalier' : 'en bas de cet escalier') : 'derrière cette porte';
    try {
      const { salle: nouvelle } = modele.creerSalleDerriere(d, { depuis, echelle: r.echelle });
      etat.neuves.add(nouvelle.id);
      etat.message = `Salle « ${nouvelle.nom} » créée ${ou} (6 × 6 cases${escalier ? `, ${modele.nomNiveau(modele.niveaux(d)[nouvelle.id]).toLowerCase()}` : ''}). Tu restes ici.`;
      ctx.salles.majListe();
    } catch (err) { etat.message = err.message; }
    rendre();
  }

  /** Relie la porte (ou l'escalier) à une salle existante : l'extrémité de retour est ajoutée dans cette salle. */
  function relierA(cibleId, el, escalier, depuis) {
    const d = donjon();
    const cible = d.salles[cibleId];
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
  }

  /** Change l'objet sélectionné en gardant la sélection ; `f(objet)` rend le nouvel objet. Annulable comme tout changement du plan. */
  function modifierObjet(el, f) {
    const s = salle();
    ctx.modifierPlan({ ...s.plan, objets: s.plan.objets.map((o) => (o.id === el.id ? f(o) : o)) }, { garderSelection: true });
  }

  /**
   * Tout ce que l'inspecteur dit de l'élément sélectionné, ou null s'il n'y en a plus. Pas de DOM ici : `actions` (visibles),
   * `destructives` (rangées dans « ⋯ ») et les données du corps ; `rendreDans` construit le DOM.
   */
  function decrire() {
    const s = salle(), d = donjon();
    const trouve = etat.selection ? modele.retrouverElement(s.plan, etat.selection) : null;
    if (!trouve) return null;
    const el = trouve.element;
    // Une porte relie deux salles du même niveau, un escalier deux niveaux voisins : les mêmes actions pour les deux.
    const escalier = modele.estEscalier(el);
    const reliable = trouve.genre === 'porte' || escalier;
    const lien = reliable ? modele.liaisonDePorte(d, s.id, el) : null;
    const depuis = reliable ? modele.extremite(s.id, el) : null;
    const autre = lien ? d.salles[lien.autre.salle] : null;
    const actions = [], menu = [], destructives = [];

    if (reliable) {
      if (lien) {
        actions.push({ libelle: `Aller à « ${autre.nom} »`, icone: 'retour', executer: () => ctx.activerSalle(autre.id) });
        destructives.push({
          libelle: 'Délier', titre: `Retire la liaison avec « ${autre.nom} » (les deux portes restent)`,
          executer: () => { modele.delier(d, lien.liaison.id); etat.message = 'Liaison retirée.'; rendre(); },
        });
      } else {
        actions.push({ libelle: escalier ? `Créer la salle ${el.sens === 'monte' ? 'du dessus' : 'du dessous'}` : 'Créer la salle derrière', icone: 'plus', executer: () => creerDerriere(el, escalier, depuis) });
        // Le sens se change tant que l'escalier n'est pas relié : ensuite, il fixe le niveau de la salle d'arrivée.
        if (escalier) {
          menu.push({
            libelle: el.sens === 'monte' ? 'Il descend plutôt' : 'Il monte plutôt',
            executer: () => modifierObjet(el, (o) => { const { sens: _, ...sans } = o; return el.sens === 'monte' ? sans : { ...sans, sens: 'monte' }; }),
          });
        }
      }
    }
    // Cacher : une rangée « Visibilité » du corps (interrupteur) ; supprimer : un seul clic (« Annuler » rattrape une erreur), sauf une porte reliée qui demande confirmation.
    destructives.push(lien
      ? { libelle: 'Supprimer', confirmation: 'Retirer la liaison et supprimer ?', titre: `Supprime ${escalier ? 'cet escalier' : 'cette porte'} et retire sa liaison (annulable)`, executer: supprimerSelection }
      : { libelle: 'Supprimer', titre: 'Supprime cet élément (annulable)', executer: supprimerSelection });
    menu.push({ libelle: 'Fermer', icone: 'fermer', titre: 'Désélectionne cet élément', executer: () => { ctx.deselectionner(); rendre(); } });
    // « porte · mur sud, repère D » : le type devient l'étiquette de l'en-tête, la suite le nom ; « Gobelin 2 · C4 » : le nom, puis la case en résumé.
    const [debut, ...suite] = libelleSelection(trouve).split(' · ');
    const reste = suite.join(' · ');
    const majuscule = (t) => t.charAt(0).toUpperCase() + t.slice(1);
    const parType = { porte: 'Porte', objet: 'Objet', creature: 'Créature', pion: 'Pion' };
    const porte = trouve.genre === 'porte';
    const etiquette = escalier ? 'Escalier' : porte ? majuscule(debut) : parType[typeDe(trouve)];
    const nom = majuscule(porte ? reste : debut);
    const morceaux = [];
    if (!porte && reste) morceaux.push(`Case ${reste}`);
    if (reliable) {
      if (lien) morceaux.push(escalier ? `${el.sens === 'monte' ? 'monte' : 'descend'} à ${autre.nom}` : `reliée à ${autre.nom}`);
      else morceaux.push('ne mène nulle part');
    }
    if (el.cache === true) morceaux.push('caché');
    const resume = morceaux.length ? majuscule(morceaux.join(' · ')) : '';
    return { trouve, el, escalier, reliable, lien, depuis, autre, actions, menu, destructives, titre: nom, etiquette, resume, type: typeDe(trouve) };
  }

  const titre = () => decrire()?.titre ?? 'Élément';
  const etiquette = () => decrire()?.etiquette ?? 'Élément';
  const resume = () => decrire()?.resume ?? '';
  const actions = () => decrire()?.actions ?? [];
  const menu = () => decrire()?.menu ?? [];
  const destructives = () => decrire()?.destructives ?? [];

  /** Le corps de l'inspecteur : ce qu'est l'élément, la liaison de la porte, l'aspect de l'objet, les messages. */
  function rendreDans(conteneur) {
    const dec = decrire();
    if (!dec) { conteneur.append(h('p', { className: 'note', textContent: 'Cet élément n’existe plus.' })); return; }
    const { el, escalier, reliable, lien, depuis, autre, trouve } = dec;
    const s = salle(), d = donjon();
    const contenu = [];
    const liaison = [];

    if (reliable) {
      if (lien) {
        if (escalier) liaison.push(h('p', { className: 'note', textContent: `Mène au ${modele.nomNiveau(modele.niveaux(d)[autre.id]).toLowerCase()}.` }));
        if (modele.liaisonsOrphelines(d).some((o) => o.liaison === lien.liaison && o.cote !== lien.cote)) {
          liaison.push(h('p', { className: 'note erreur', textContent: `${escalier ? 'L’escalier' : 'La porte'} de retour a disparu dans cette salle : la liaison est orpheline là-bas.` }));
        }
      } else {
        const autres = modele.listerSalles(d).filter((x) => x.id !== s.id);
        if (autres.length) {
          const choix = h('select', { id: 'relier-choix', 'aria-label': 'Salle à relier' },
            ...autres.map((x) => h('option', { value: x.id, textContent: x.nom })));
          const relier = h('button', { type: 'button', className: 'btn', textContent: 'Relier' });
          relier.addEventListener('click', () => relierA(choix.value, el, escalier, depuis));
          relier.title = escalier
            ? 'Relier cet escalier à une salle existante (un escalier de retour y est ajouté)'
            : 'Relier cette porte à une salle existante (une porte est ajoutée sur son mur opposé)';
          liaison.push(h('p', { className: 'note', textContent: 'Ou la relier à une salle existante :' }), h('div', { className: 'ligne-relier' }, choix, relier));
        }
      }
    }

    // Sections du panneau (docs/design-panneaux.md) : la liaison d'une porte ou d'un escalier, l'aspect d'un objet.
    if (liaison.length) contenu.push(creerSection({ cle: `element:liaison-${escalier ? 'escalier' : 'porte'}`, titre: 'Liaison', enfants: liaison }).element);
    // Une variante (torche éteinte, flamme bleue…) : une liste de l'aspect de l'objet, annulable comme tout changement du plan.
    const variantes = trouve.genre === 'objet' ? variantesDe(el.type) : [];
    if (variantes.length > 1) {
      // Une rangée (aperçu · aspect actuel) ; un clic ouvre les vignettes (les mêmes dessins que la carte et le catalogue) en popover ancré dessous.
      const courant = varianteDe(el);
      const maj = (id) => modifierObjet(el, (o) => {
        const { variante: _, ...sans } = o;
        return id === varianteParDefaut(o.type) ? sans : { ...sans, variante: id };
      });
      const vignette = (id) => creerVignette({ genre: 'objet', type: el.type, ...(id === varianteParDefaut(el.type) ? {} : { variante: id }) });
      const majuscule = (t) => t.charAt(0).toUpperCase() + t.slice(1);
      const popover = h('div', { className: 'popover-aspect', role: 'group', 'aria-label': 'Aspect de l’objet', hidden: true },
        h('p', { className: 'popover-titre', textContent: `Aspect · ${nomAffiche(el.type)}` }),
        h('div', { className: 'aspect-grille' }, ...variantes.map((v) => {
          const nom = nomVariante(el.type, v.id);
          const b = h('button', { type: 'button', className: 'palette-item palette-aspect', title: nom, 'aria-label': nom, 'aria-pressed': String(v.id === courant), 'data-variante': v.id },
            h('span', { className: 'palette-vignette' }, vignette(v.id)), h('span', { className: 'palette-nom', textContent: majuscule(nom) }));
          b.addEventListener('click', () => { if (v.id !== courant) maj(v.id); else popover.hidden = true; });
          return b;
        })));
      const rangee = h('button', { type: 'button', className: 'rang-champ', 'aria-haspopup': 'true', 'aria-expanded': 'false', title: 'Choisir l’aspect' },
        h('span', { className: 'rang-aperce' }, vignette(courant)),
        h('span', { className: 'rang-texte' }, h('span', { className: 'rang-valeur', textContent: majuscule(nomVariante(el.type, courant)) }), h('span', { className: 'rang-etiquette', textContent: ' · aspect' })),
        h('span', { className: 'rang-fin', 'aria-hidden': 'true', textContent: '▾' }));
      const basculer = (ouvert) => { popover.hidden = !ouvert; rangee.setAttribute('aria-expanded', String(ouvert)); };
      rangee.addEventListener('click', () => basculer(popover.hidden));
      const hote = h('div', { className: 'rang-hote' }, rangee, popover);
      // Un clic ailleurs, ou Échap, referme le popover (l'écouteur disparaît avec l'inspecteur redessiné).
      const dehors = (e) => { if (!hote.isConnected) { document.removeEventListener('pointerdown', dehors, true); return; } if (!popover.hidden && !hote.contains(e.target)) basculer(false); };
      document.addEventListener('pointerdown', dehors, true);
      hote.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !popover.hidden) { e.preventDefault(); e.stopPropagation(); basculer(false); rangee.focus(); } });
      contenu.push(creerSection({ cle: 'element:aspect', titre: 'Aspect', enfants: [hote] }).element);
    }

    // Visibilité : visible aux joueurs ou caché (annulable comme tout changement du plan).
    const visible = el.cache !== true;
    const interrupteur = h('button', { type: 'button', className: 'rang-champ rang-interrupteur', role: 'switch', 'aria-checked': String(visible), title: visible ? 'Cacher aux joueurs' : 'Rendre visible aux joueurs' },
      h('span', { className: 'rang-aperce rang-icone' }, icone('oeil')),
      h('span', { className: 'rang-texte' }, h('span', { className: 'rang-valeur', textContent: visible ? 'Visible aux joueurs' : 'Caché aux joueurs' })),
      h('span', { className: 'interrupteur', 'aria-hidden': 'true' }));
    interrupteur.addEventListener('click', () => { const nouveau = modele.basculerCache(s.plan, etat.selection); if (nouveau) ctx.modifierPlan(nouveau, { garderSelection: true }); });
    contenu.push(creerSection({ cle: 'element:visibilite', titre: 'Visibilité', enfants: [interrupteur] }).element);

    if (etat.message) contenu.push(h('p', { className: 'note', role: 'status', textContent: etat.message }));
    conteneur.append(...contenu);
  }

  /**
   * L'inspecteur suit `etat.selection` (posée par la carte, qui reste maître du descripteur) : un élément trouvé devient la sélection
   * commune ; un élément disparu rend la main à la salle ; le même élément redessine l'inspecteur (ses boutons ont pu changer).
   */
  function majSelection() {
    const co = ctx.coquille;
    const trouve = etat.selection ? modele.retrouverElement(salle().plan, etat.selection) : null;
    if (!trouve) etat.selection = null;
    if (!co) return;
    const courante = co.selection();
    const contexte = { ...co.position(), donjon: donjon().id, salle: salle().id };
    if (!trouve) {
      if (courante && TYPES_ELEMENT.includes(courante.type)) co.selectionner(creerSelection('salle', salle().id, contexte));
      return;
    }
    const voulue = selectionElement(etat.selection, contexte, typeDe(trouve));
    if (!meme(courante, voulue)) co.selectionner(voulue); else co.inspecteur.rafraichir();
  }

  // Un clic dans le vide de la scène (hors carte) désélectionne, comme un clic dans le vide de la carte.
  $('scene').addEventListener('pointerdown', (e) => {
    if (!etat.selection || (e.target !== $('scene') && e.target !== $('support'))) return;
    ctx.deselectionner();
    rendre();
  });

  return { maj: majSelection, placer: () => {}, titre, etiquette, resume, actions, menu, destructives, rendreDans, typeDe };
}
