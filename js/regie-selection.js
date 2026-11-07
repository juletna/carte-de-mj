/**
 * Le panneau « Sélection » de la régie et ce qu'on y fait : révéler ou recacher un élément caché, l'état d'un pion, passer une
 * porte (le groupe suit) ou créer la salle derrière une porte non reliée. Fabrique `creerSelection(ctx)` ; `ctx` est celui de regie.js
 * (`etat`, `r`, `rendre`, `modifie`, `salleConsultee`), lu au moment de l'appel : rien n'est demandé à `ctx` avant la fin du câblage.
 */
import * as pres from './presentation.js';
import { LISTES } from './schema.js';
import { niveaux, nomNiveau } from './niveaux.js';
import { libelleSelection } from './coordonnees.js';
import { nomAffiche } from './parseur/lexique.js';
import { h, bouton, $ } from './dom.js';
import { pluriel } from './format.js';
import { icone } from './icones.js';
import { telephone } from './telephone.js';
import { positionBulle } from './mise-en-page.js';

export function creerSelection(ctx) {
  const { etat, r } = ctx;
  const salleConsultee = () => ctx.salleConsultee();
  const rendre = () => ctx.rendre();
  const modifie = () => ctx.modifie();

  const trouver = (plan, sel) => {
    const e = sel && (plan[LISTES[sel.genre]] || []).find((x) => x.id === sel.id);
    return e ? { genre: sel.genre, element: e } : null;
  };

  /** Un pion, à la régie : le nom de son personnage s'il en a un (la table n'a que « P1 »). */
  const nomPion = (k) => {
    const nom = k.fiche && pres.nomPersonnage(etat.p, k.fiche);
    return nom ? `${nom} (P${k.numero})` : `${nomAffiche(k.type)} ${k.numero}`;
  };

  const libelleElement = (trouve) => libelleSelection(trouve, nomPion);

  /** Phrases communes à tout passage de porte : le groupe qui suit, les pions restés faute de place. */
  function phrasesGroupe(res, depart) {
    const parts = [];
    if (etat.groupeSuit && res.deplaces) parts.push(`${pluriel(res.deplaces, 'pion du groupe a suivi', 'pions du groupe ont suivi')}.`);
    if (res.restes) parts.push(`${pluriel(res.restes, 'pion n’a pas trouvé', 'pions n’ont pas trouvé')} de place et ${res.restes > 1 ? 'restent' : 'reste'} dans « ${depart} ».`);
    return parts;
  }

  function passer(porte) {
    const s = salleConsultee();
    const depart = s.nom;
    const res = pres.passerPorte(etat.p, s.id, porte.id, { groupe: etat.groupeSuit });
    if (!res.ok) { etat.message = res.message; rendre(); return; }
    const arrivee = etat.p.donjon.salles[res.vers].nom;
    etat.consultee = res.vers;
    etat.selection = null;
    etat.messageCommande = null;
    const passage = porte.type === 'escalier' ? `${porte.sens === 'monte' ? 'Montée' : 'Descente'} vers « ${arrivee} »` : `Passage dans « ${arrivee} »`;
    etat.message = [`${passage} : la salle est maintenant à la table.`, ...phrasesGroupe(res, depart)].join(' ');
    modifie();
  }

  /** Porte non reliée : crée la salle décrite (ou une salle de 6 × 6), la relie à cette porte et y passe. */
  function creerEtPasser(porte) {
    const s = salleConsultee();
    const depart = s.nom;
    const b = etat.brouillon;
    const res = pres.creerSalleEtPasser(etat.p, s.id, porte.id, b?.texte || '', { nom: b?.nom || '', echelle: r.echelle, groupe: etat.groupeSuit });
    if (!res.ok) { etat.message = res.message; rendre(); return; }
    const ou = porte.type === 'escalier' ? `${porte.sens === 'monte' ? 'en haut' : 'en bas'} de l’escalier` : 'derrière la porte';
    const parts = [`Salle « ${res.salle.nom} » créée ${ou}, reliée à « ${depart} » : elle est maintenant à la table.`, ...phrasesGroupe(res, depart)];
    if (res.ignores?.length) parts.push(`Mots non compris dans la description : ${res.ignores.join(', ')}.`);
    etat.consultee = res.vers;
    etat.selection = null;
    etat.brouillon = null;
    etat.messageCommande = null;
    etat.message = parts.join(' ');
    modifie();
  }

  function changerEtat(pion, valeur) {
    const s = salleConsultee();
    pres.definirEtat(etat.p, s.id, pion.id, valeur);
    const qui = nomPion(pion);
    const devoile = pres.estDevoile(etat.p, s.id, pion);
    const masquee = pres.categorieMasquee(etat.p, s.id, 'creature', pion);
    const ou = !devoile ? ' (pion caché : la table ne le voit pas)' : masquee ? ` (${masquee} masqués : la table ne le voit pas)` : s.id === etat.p.salleCourante ? ' : visible sur la table' : ' (cette salle n’est pas à la table)';
    etat.message = valeur === pres.ETAT_NORMAL ? `${qui} est de nouveau normal${ou}.` : `${qui} est ${pres.LIBELLES_ETAT[valeur]}${ou}.`;
    modifie();
  }

  /** Case « Le groupe suit » (partagée par le passage normal et la création de salle). */
  function caseGroupe(s) {
    const nbPj = s.plan.creatures.filter((k) => k.camp === 'pj').length;
    const suit = h('input', { type: 'checkbox', id: 'groupe-suit', checked: etat.groupeSuit });
    suit.addEventListener('change', () => { etat.groupeSuit = suit.checked; });
    return h('label', { className: 'suit' }, suit, `Le groupe suit (${pluriel(nbPj, 'pion de joueur', 'pions de joueurs')} dans cette salle)`);
  }

  function formulaireNouvelleSalle(s, porte) {
    const escalier = porte.type === 'escalier';
    const ou = escalier ? (porte.sens === 'monte' ? 'en haut de cet escalier' : 'en bas de cet escalier') : '';
    const cle = `${s.id}|${porte.id}`;
    if (etat.brouillon?.cle !== cle) etat.brouillon = { cle, texte: '', nom: '' };
    const brouillon = etat.brouillon;
    const description = h('textarea', { id: 'description-nouvelle', rows: 3, spellcheck: false, value: brouillon.texte,
      placeholder: 'Ex. : salle de 8 par 6 cases, quatre piliers, un autel au fond, deux gobelins' });
    description.addEventListener('input', () => { brouillon.texte = description.value; });
    const nom = h('input', { type: 'text', id: 'nom-nouvelle', value: brouillon.nom, maxLength: 80, placeholder: 'Nom de la salle (facultatif)' });
    nom.addEventListener('input', () => { brouillon.nom = nom.value; });
    return [
      h('p', { className: 'note', textContent: escalier
        ? `Cet escalier n’est relié à aucune salle. Tu peux créer la salle ${ou} maintenant : elle sera reliée à cet escalier, et le groupe peut y passer.`
        : 'Cette porte n’est reliée à aucune salle. Tu peux créer la salle d’à côté maintenant : elle sera reliée à cette porte, et le groupe peut y passer.' }),
      h('div', { className: 'nouvelle-salle' },
        h('label', { htmlFor: 'description-nouvelle', textContent: 'Décrire la nouvelle salle (facultatif)' }), description,
        h('p', { className: 'note', textContent: escalier
          ? `Même langage que dans Préparer. Laisse vide pour une salle de 6 × 6 cases. Un escalier qui ${porte.sens === 'monte' ? 'descend' : 'monte'} est ajouté si la description n’en place pas.`
          : 'Même langage que dans Préparer. Laisse vide pour une salle de 6 × 6 cases. Une porte de retour est ajoutée sur le mur opposé si la description n’en place pas.' }),
        nom),
      caseGroupe(s),
      h('div', { className: 'actions' }, bouton('Créer la salle et y passer', () => creerEtPasser(porte), 'btn')),
    ];
  }

  /** Sélectionne un élément. `clavier` : on vient d'une liste, le focus passe au panneau pour agir sans souris. */
  function selectionner(genre, id, { clavier = false } = {}) {
    etat.selection = { genre, id };
    etat.focusSelection = clavier;
    etat.message = '';
    ctx.jouer?.replier(); // sous 760 px : la bulle de sélection se pose au-dessus des onglets, elle ne recouvre pas l'onglet ouvert
    rendre();
  }
  /** Ferme la sélection (bouton, Échap ou clic dans le vide) ; le focus revient à l'élément dans la liste. */
  function deselectionner() {
    const zone = $('selection');
    const sel = etat.selection;
    const avaitFocus = !!sel && zone.contains(document.activeElement);
    etat.selection = null;
    etat.message = '';
    rendre();
    if (avaitFocus) $('carte').focus?.({ preventScroll: true });
  }

  /** Le popover de l'élément : à côté du point touché sur la carte (à droite, sinon à gauche, dessous, dessus), sans sortir de la scène. Sous 760 px : feuille en bas (CSS). */
  function placerPopover(zone) {
    const a = etat.ancreSelection;
    if (telephone() || !a) { zone.style.left = zone.style.top = zone.style.right = zone.style.bottom = ''; return; }
    const sc = $('scene').getBoundingClientRect();
    const vue = { g: sc.left, h: sc.top, d: sc.right, b: sc.bottom };
    zone.style.right = zone.style.bottom = 'auto';
    zone.style.maxHeight = `${Math.max(160, vue.b - vue.h - 16)}px`;
    const { x, y } = positionBulle({ g: a.x - 14, h: a.y - 14, d: a.x + 14, b: a.y + 14 }, vue, zone.offsetWidth, zone.offsetHeight);
    zone.style.left = `${x}px`; zone.style.top = `${y}px`;
  }

  function majSelection() {
    const zone = $('selection');
    const p = etat.p, s = salleConsultee();
    const trouve = trouver(s.plan, etat.selection);
    if (!trouve) { etat.selection = null; zone.hidden = true; zone.replaceChildren(); return; }
    zone.hidden = false;
    const el = trouve.element;
    const fermer = h('button', { type: 'button', className: 'btn btn-discret' }, icone('fermer'), ' Fermer');
    fermer.addEventListener('click', deselectionner);
    fermer.setAttribute('aria-label', 'Fermer la sélection (Échap)');
    const contenu = [h('div', { className: 'selection-entete' }, h('h2', { textContent: 'Sélection' }), fermer),
      h('p', { className: 'selection-titre', textContent: libelleElement(trouve) })];
    const sur = s.id === p.salleCourante;
    const masquee = pres.categorieMasquee(p, s.id, trouve.genre, el);

    if (el.cache) {
      const revele = pres.estRevele(p, s.id, el.id);
      contenu.push(h('p', { className: 'note', textContent: revele
        ? `Révélé${masquee ? '' : ` : visible sur la table${sur ? '' : ' dès que la salle y sera affichée'}`}.`
        : 'Caché : les joueurs ne le voient pas. Tu le vois ici en translucide, contour en pointillés.' }));
      contenu.push(h('div', { className: 'actions' }, revele
        ? bouton('Recacher', () => { pres.recacherElement(p, s.id, el.id); etat.message = 'Recaché : il disparaît de la table.'; modifie(); }, 'btn btn-discret')
        : bouton('Révéler', () => { pres.revelerElement(p, s.id, el.id); etat.message = `Révélé${masquee ? `, mais les ${masquee} sont masqués à la table` : sur ? ' : il apparaît sur la table' : ', mais cette salle n’est pas à la table'}.`; modifie(); }, 'btn')));
    }
    if (masquee) contenu.push(h('p', { className: 'note', textContent: `Les ${masquee} de cette salle sont masqués à la table : les joueurs ne le voient pas.` }));

    if (trouve.genre === 'creature') {
      const actuel = el.etat || pres.ETAT_NORMAL;
      contenu.push(h('p', { className: 'note', id: 'etat-pion', textContent: `État : ${pres.LIBELLES_ETAT[actuel]}. Un pion blessé porte une croix rouge, un pion mort est grisé et barré ; la table les voit.` }));
      const boutons = h('div', { className: 'etats' });
      boutons.setAttribute('role', 'group');
      boutons.setAttribute('aria-label', 'État du pion');
      for (const valeur of pres.ETATS_DE_PION) {
        const libelle = pres.LIBELLES_ETAT[valeur];
        const b = bouton(libelle.charAt(0).toUpperCase() + libelle.slice(1), () => changerEtat(el, valeur), 'btn btn-discret');
        b.setAttribute('aria-pressed', String(actuel === valeur));
        boutons.append(b);
      }
      contenu.push(boutons);
    }

    // Une porte et un escalier se franchissent de la même façon ; l'escalier change de niveau.
    const escalier = trouve.genre === 'objet' && el.type === 'escalier';
    if (trouve.genre === 'porte' || escalier) {
      const dest = pres.destinationPorte(p, s.id, el.id);
      if (dest) {
        const niveau = escalier ? ` · ${nomNiveau(niveaux(p.donjon)[dest.salle.id])}` : '';
        contenu.push(h('p', {}, 'Mène à ', h('strong', { textContent: dest.salle.nom }), `${niveau}${pres.estDecouverte(p, dest.salle.id) ? ' (déjà découverte).' : ' (non découverte).'}`));
        contenu.push(caseGroupe(s));
        const action = escalier ? `${el.sens === 'monte' ? 'Monter' : 'Descendre'} à « ${dest.salle.nom} »` : `Passer dans la salle « ${dest.salle.nom} »`;
        contenu.push(h('div', { className: 'actions' }, bouton(action, () => passer(el), 'btn')));
      } else {
        contenu.push(...formulaireNouvelleSalle(s, el));
      }
    }
    zone.replaceChildren(...contenu);
    placerPopover(zone);
    if (etat.focusSelection) { etat.focusSelection = false; zone.focus({ preventScroll: true }); }
  }

  return { maj: majSelection, selectionner, deselectionner, nomPion, trouver };
}
