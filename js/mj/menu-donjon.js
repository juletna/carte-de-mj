/**
 * Ce que faisait le menu du donjon (barre du haut), réparti dans l'atelier : le nom, l'export, la copie et la suppression du donjon
 * sont dans l'inspecteur « donjon » (js/atelier/inspecteurs-donjon.js) ; un donjon neuf (vide, au hasard ou d'un modèle), l'import
 * (fichier ou texte collé) et les copies mises de côté sont dans la feuille « Ajouter un donjon » (`#feuille-donjons`), qu'ouvre le
 * menu « + Nouveau » de l'arbre ; l'éditeur du plan JSON et « Copier pour signaler » sont dans l'inspecteur « salle » (bloc Avancé). Le choix du
 * donjon est l'arbre. Fabrique `creerMenu(ctx)` ; `ctx` est celui de main-mj.js (`etat`, `donjon`, `salle`, `rendre`, `modifierPlan`,
 * `annoncerCarte`, `historique`, `afficherSalleActive`, `sauvegarder`, `plan`, `coquille`), lu au moment de l'appel.
 * Renvoie `fermer` et `ouvert` (la feuille, pour Échap), `ouvrir(section)`, `majDonjons` (à rappeler quand on change de donjon ou de
 * salle), `messageFichier` (l'avertissement du démarrage), `exporter`, `copierDonjon`, `supprimerDonjon`, `annonceSuppression`, `nombreCopies`,
 * `importerDonjonLu(brut)` (un donjon déjà lu en JSON : l'import unique de l'atelier, js/atelier/importer.js).
 */
import { validerPlan } from '../schema.js';
import { genererDonjon, BORNES, FAMILLES } from '../generateur.js';
import { MODELES, donjonDepuisModele, copieDonjon } from '../modeles.js';
import * as stockage from '../stockage.js';
import { rapport } from '../rapport.js';
import * as modele from '../donjon.js';
import { convertirImport } from '../donjon-validation.js';
import { $, h, deuxTemps, fichierChoisi } from '../dom.js';
import { pluriel } from '../format.js';

export function creerMenu(ctx) {
  const { etat } = ctx;
  const r = etat.reglages;
  const donjon = () => ctx.donjon();
  const salle = () => ctx.salle();
  const afficherSalleActive = () => ctx.afficherSalleActive();
  const annoncerCarte = (...a) => ctx.annoncerCarte(...a);

  // --- La feuille « Ajouter un donjon » : nouveau, importer, coller, copies mises de côté ----------------------
  let declencheur = null;
  const feuilleOuverte = () => !$('feuille-donjons').hidden;
  /** Ouvre la feuille ; `section` : 'nouveau' (par défaut), 'importer', 'coller' ou 'copies' (le bloc voulu est déplié et vu). */
  function ouvrirFeuille(section = 'nouveau') {
    if (!feuilleOuverte()) declencheur = document.activeElement;
    $('feuille-donjons').hidden = false;
    if (section === 'coller') $('donjon-colle').closest('details').open = true;
    if (section === 'copies') $('copies').open = true;
    const cible = { nouveau: 'nouveau-vide', importer: 'importer', coller: 'donjon-colle', copies: 'copies-titre' }[section] ?? 'nouveau-vide';
    const el = section === 'importer' ? $('importer').closest('label') : $(cible);
    if (section === 'importer') el.tabIndex = -1;
    el.scrollIntoView?.({ block: 'nearest' });
    el.focus?.();
  }
  function fermerMenu() {
    if (!feuilleOuverte()) return;
    $('feuille-donjons').hidden = true;
    if (declencheur?.isConnected) declencheur.focus();
    declencheur = null;
  }
  $('feuille-fermer').addEventListener('click', fermerMenu);
  $('feuille-donjons').querySelector('.feuille-voile').addEventListener('click', fermerMenu);

  // --- Donjons : nom, suppression ---------------------------------------------------
  function majDonjons() {
    if (document.activeElement !== $('donjon-nom')) $('donjon-nom').value = donjon().nom;
    ctx.coquille?.rafraichir();
  }

  $('donjon-nom').addEventListener('change', (e) => {
    donjon().nom = e.target.value.trim().slice(0, 80) || donjon().nom;
    e.target.value = donjon().nom;
    majDonjons();
    ctx.sauvegarder();
    ctx.coquille?.rafraichir({ inspecteur: true }); // le titre de l'inspecteur suit le nom
  });
  // --- Nouveau donjon : vide, au hasard ou à partir d'un modèle ---
  function choixNouveau(quoi) {
    const ouvrir = (bouton, zone, actif) => { $(bouton).setAttribute('aria-pressed', String(actif)); $(zone).hidden = !actif; };
    ouvrir('nouveau-hasard', 'hasard', quoi === 'hasard');
    ouvrir('nouveau-modele', 'modeles', quoi === 'modele');
    if (quoi === 'modele') majModeles();
  }
  /** Affiche le donjon `d` ; depuis l'écran Monde (qui peut recevoir un import), l'atelier y va aussi. */
  function montrerDonjon(d) {
    afficherSalleActive();
    if (ctx.univers?.ouvert()) ctx.coquille.naviguer({ page: 'donjon', donjon: d.id, salle: d.salleActive });
  }
  /** Le donjon neuf prend la place : il devient le donjon affiché, et le menu se referme sur lui. */
  function accueillirDonjon(d, { plan = true } = {}) {
    etat.donjons[d.id] = d;
    etat.actif = d.id;
    montrerDonjon(d);
    if (plan) ctx.plan.ouvrir(true);
    fermerMenu();
  }
  $('nouveau-vide').addEventListener('click', () => {
    const d = modele.creerDonjon({ nom: `Donjon ${Object.keys(etat.donjons).length + 1}`, echelle: r.echelle });
    etat.neuves.add(d.salleActive);
    accueillirDonjon(d, { plan: false });
  });
  $('nouveau-hasard').addEventListener('click', () => choixNouveau($('hasard').hidden ? 'hasard' : null));
  $('nouveau-modele').addEventListener('click', () => choixNouveau($('modeles').hidden ? 'modele' : null));

  function ligneModele(nom, description, partir, supprimer) {
    const bouton = h('button', { type: 'button', className: 'btn btn-discret modele-choix' }, h('b', { textContent: nom }), h('span', { className: 'doux', textContent: description }));
    bouton.addEventListener('click', partir);
    return h('li', {}, bouton, ...(supprimer ? [supprimer] : []));
  }
  /** La liste des modèles : ceux de l'outil, puis ceux gardés par le MJ dans ce navigateur. */
  function majModeles() {
    const gardes = stockage.chargerModeles();
    $('modeles-liste').replaceChildren(
      ...MODELES.map((m) => ligneModele(m.nom, m.description, () => accueillirDonjon(donjonDepuisModele(m)))),
      ...gardes.map((g) => {
        const retirer = h('button', { type: 'button', className: 'btn btn-danger' });
        deuxTemps(retirer, 'Retirer', 'Confirmer', () => {
          stockage.sauverModeles(stockage.chargerModeles().filter((x) => x.id !== g.id));
          majModeles();
        });
        return ligneModele(g.nom, `Ton modèle · ${pluriel(Object.keys(g.salles).length, 'salle', 'salles')}`,
          () => accueillirDonjon(copieDonjon(g, { idsPris: Object.keys(etat.donjons) })), retirer);
      }),
    );
  }
  $('modele-garder').addEventListener('click', () => {
    const copie = copieDonjon(donjon());
    const message = $('modele-message');
    message.hidden = false;
    const ok = stockage.sauverModeles([...stockage.chargerModeles(), copie]);
    message.textContent = ok ? `« ${copie.nom} » est gardé comme modèle, dans ce navigateur.` : 'Impossible de garder ce modèle : le stockage de ce navigateur est plein ou bloqué.';
    majModeles();
  });
  // --- Donjon au hasard (js/generateur.js) ---
  for (const [cle, [defaut, min, max]] of Object.entries(BORNES)) {
    const champ = $(`hasard-${cle}`);
    Object.assign(champ, { value: String(defaut), min: String(min), max: String(max), step: '1' });
  }
  $('hasard-familles').replaceChildren(...Object.entries(FAMILLES).map(([cle, f]) => {
    const c = h('input', { type: 'checkbox', value: cle });
    return h('label', { className: 'ligne case' }, c, ` ${f.libelle}`);
  }));

  /** Le dernier donjon tiré : un nouveau tirage le remplace s'il n'a pas été retouché, plutôt que d'empiler les essais. */
  let dernierTirage = null;
  $('hasard-generer').addEventListener('click', () => {
    const options = Object.fromEntries(Object.keys(BORNES).map((cle) => [cle, $(`hasard-${cle}`).value]));
    options.familles = [...$('hasard-familles').querySelectorAll('input:checked')].map((c) => c.value);
    options.boss = $('hasard-boss').checked;
    options.formes = $('hasard-formes').checked;
    options.graine = $('hasard-graine').value;
    const { donjon: d, graine, resume } = genererDonjon(options);
    const remplace = dernierTirage && etat.donjons[dernierTirage.id] && JSON.stringify(etat.donjons[dernierTirage.id]) === dernierTirage.signature;
    if (remplace) {
      delete etat.donjons[dernierTirage.id];
      ctx.historique.oublierDonjon(dernierTirage.id);
    }
    dernierTirage = { id: d.id, signature: JSON.stringify(d) };
    accueillirDonjon(d);
    const message = $('hasard-message');
    message.hidden = false;
    message.textContent = `Tirage ${graine} : ${resume.salles} salle${resume.salles > 1 ? 's' : ''}, ${resume.monstres} monstre${resume.monstres > 1 ? 's' : ''}, ${resume.coffres} coffre${resume.coffres > 1 ? 's' : ''}, ${resume.pieges} piège${resume.pieges > 1 ? 's' : ''}. Tu peux tout retoucher ; un nouveau tirage remplace celui-ci tant que tu n'y touches pas.`;
    annoncerCarte(`« ${d.nom} » : ${resume.salles} salles, ${resume.monstres} monstres, ${resume.coffres} coffres.`);
  });

  /** Ce que la confirmation annonce : le nom, le nombre de salles, et le sort d'une partie en cours. */
  function annonceSuppression() {
    const d = donjon();
    const n = Object.keys(d.salles).length;
    const partie = d.id in stockage.chargerPresentations();
    return `Supprimer « ${d.nom} » et ${n > 1 ? `ses ${n} salles` : 'sa salle'} ?`
      + (partie ? ' Sa partie en cours reste dans la Présentation.' : '');
  }
  /** Supprime le donjon affiché (le dernier est remplacé par un donjon vide) ; un autre s'affiche. L'inspecteur demande la confirmation. */
  function supprimerDonjon() {
    ctx.historique.oublierDonjon(etat.actif);
    delete etat.donjons[etat.actif];
    if (!Object.keys(etat.donjons).length) {
      const d = modele.creerDonjon({ echelle: r.echelle });
      etat.donjons[d.id] = d;
    }
    etat.actif = Object.keys(etat.donjons)[0];
    stockage.sauverDonjons(etat); // écrit d'abord : un souci d'affichage ensuite ne doit jamais ressusciter le donjon supprimé
    afficherSalleActive();
  }

  // --- Copier pour signaler -----------------------------------------------------
  $('copier-rapport').addEventListener('click', async () => {
    const texte = rapport({ texte: salle().texte, ...etat.retour, plan: salle().plan });
    const message = $('message-copie');
    message.hidden = false;
    try {
      await navigator.clipboard.writeText(texte);
      message.textContent = 'Copié ! Colle-le dans ton message.';
    } catch {
      // Presse-papiers refusé (page non sécurisée…) : on montre le texte à copier à la main.
      for (let d = $('json').closest('details'); d; d = d.parentElement?.closest('details')) d.open = true;
      $('json').value = texte;
      $('json').select();
      message.textContent = 'Copie automatique impossible : le texte est sélectionné dans la zone JSON, fais Cmd+C.';
    }
    clearTimeout(message.minuterie);
    message.minuterie = setTimeout(() => { message.hidden = true; }, 4000);
  });

  // --- Fichiers -----------------------------------------------------------------
  const exporter = () => stockage.exporterDonjon(donjon());

  /** Le retour d'un import ou d'une copie : dans la feuille, et sur la carte quand la feuille est fermée (jamais en HTML). */
  function messageFichier(texte, erreurs = []) {
    const ok = $('message-fichier'), ko = $('erreurs-fichier');
    ok.hidden = !texte;
    ok.textContent = texte || '';
    ko.hidden = erreurs.length === 0;
    ko.textContent = erreurs.join(' · '); // textContent : le contenu du fichier n'est jamais interprété comme du HTML
    if (!feuilleOuverte()) {
      if (erreurs.length) annoncerCarte(erreurs.join(' · '), true, 9000);
      else if (texte) annoncerCarte(texte, false, 4500);
    }
  }

  // --- Copies mises de côté : ce qui ne s'est pas relu, à récupérer (le bloc n'apparaît que s'il y en a) ---
  function majCopies() {
    const copies = stockage.misDeCote();
    $('copies').hidden = copies.length === 0;
    $('copies-titre').textContent = `Copies mises de côté (${copies.length})`;
    $('copies-liste').replaceChildren(...copies.map((copie) => {
      const date = new Date(copie.le);
      const telecharger = h('button', { type: 'button', className: 'btn', textContent: 'Télécharger' });
      telecharger.addEventListener('click', () => stockage.telechargerCopie(copie));
      const supprimer = h('button', { type: 'button', className: 'btn btn-danger' });
      deuxTemps(supprimer, 'Supprimer', 'Supprimer pour de bon ?', () => {
        if (!stockage.supprimerCopie(copie)) messageFichier('', ['Copie non supprimée : le navigateur a refusé l’écriture.']);
        majCopies();
      });
      return h('li', { className: 'fiche-carte' },
        h('p', {}, h('strong', { textContent: stockage.libelleCopie(copie.cle) }), Number.isNaN(date.getTime()) ? '' : `, ${date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`),
        h('p', { className: 'note', textContent: copie.raison || '' }),
        h('div', { className: 'actions' }, telecharger, supprimer));
    }));
  }
  majCopies();

  /** Ajoute le donjon lu dans un fichier ou un texte collé. Renvoie true s'il a été ajouté. */
  function ajouterDonjonLu(brut) {
    // Le donjon importé s'AJOUTE aux autres : il garde l'identifiant de son fichier, sauf s'il est déjà pris (alors il en reçoit un neuf) ; rien n'est écrasé.
    const resultat = convertirImport(brut, { echelle: r.echelle, idsPris: Object.keys(etat.donjons) });
    if (!resultat.donjon) { messageFichier('', [`Import refusé : ${resultat.erreurs.join(' · ')}`]); return false; }
    const d = resultat.donjon;
    etat.donjons[d.id] = d;
    etat.actif = d.id;
    montrerDonjon(d);
    const n = Object.keys(d.salles).length;
    messageFichier(`Donjon « ${d.nom} » importé (${n} salle${n > 1 ? 's' : ''}).${resultat.avertissements.length ? ` À noter : ${resultat.avertissements.join(' · ')}` : ''}`);
    return true;
  }

  $('importer').addEventListener('change', async (e) => {
    const fichier = fichierChoisi(e);
    if (!fichier) return;
    try {
      ajouterDonjonLu(await stockage.lireFichierJson(fichier));
    } catch (err) {
      messageFichier('', [`Import refusé : ${err.message}`]);
    }
  });

  async function copierDonjon() {
    const texte = stockage.texteDonjon(donjon());
    try {
      await navigator.clipboard.writeText(texte);
      messageFichier('Donjon copié, notes et éléments cachés compris. Colle-le où tu veux.');
    } catch {
      // Presse-papiers refusé (page non sécurisée…) : on montre le texte à copier à la main, dans la feuille.
      const zone = $('donjon-colle');
      ouvrirFeuille('coller');
      zone.value = texte;
      zone.select();
      messageFichier('Copie automatique impossible : le texte est sélectionné ci-dessous, fais Cmd+C. Notes et éléments cachés compris.');
    }
  }

  $('donjon-coller').addEventListener('click', () => {
    const zone = $('donjon-colle');
    if (!zone.value.trim()) { messageFichier('', ['Colle d’abord le texte du donjon.']); return; }
    try {
      if (ajouterDonjonLu(stockage.lireTexteJson(zone.value))) zone.value = '';
    } catch (err) {
      messageFichier('', [`Import refusé : ${err.message}`]);
    }
  });

  $('appliquer-json').addEventListener('click', () => {
    try {
      appliquerPlan(JSON.parse($('json').value), null);
    } catch (err) {
      afficherErreursJson([`JSON invalide : ${err.message}`]);
    }
  });

  /** Remplace le plan de la salle affichée par un plan venu de l'éditeur JSON (ou d'un fichier de plan seul). */
  function appliquerPlan(brut, texte) {
    const { ok, erreurs, plan } = validerPlan(brut);
    afficherErreursJson(erreurs);
    if (!plan) return;
    // Le JSON modifié réécrit la description, qui régénère la carte : tout reste aligné.
    ctx.modifierPlan(plan, { garderSelection: true, texte });
    if (!ok) $('compris').prepend(h('li', { textContent: 'plan chargé, avec des éléments écartés' }));
  }

  function afficherErreursJson(erreurs) {
    const zone = $('erreurs-json');
    zone.hidden = erreurs.length === 0;
    zone.textContent = erreurs.join(' · ');
  }

  return {
    fermer: fermerMenu, ouvert: feuilleOuverte, ouvrir: ouvrirFeuille, majDonjons, messageFichier, exporter, copierDonjon,
    supprimerDonjon, annonceSuppression, nombreCopies: () => stockage.misDeCote().length, importerDonjonLu: ajouterDonjonLu,
  };
}
