/**
 * Les personnages du donjon (outil « Personnages ») : les fiches associées au donjon, ajoutées depuis ce navigateur, depuis un
 * fichier ou tirées au hasard (js/fiche-hasard.js), actualisées, retirées. Fabrique `creerPersonnages(ctx)` ; `ctx` est celui de
 * main-mj.js (`donjon`, `rendre`), lu au moment de l'appel. Renvoie `maj()` : à rappeler après chaque rendu.
 */
import * as stockage from '../stockage.js';
import { ajouterPersonnage, retirerPersonnage, actualiserPersonnages, ficheDepuisFichier, resumerFiche } from '../personnages.js';
import { genererFiches, decrireTirage, BORNES as BORNES_FICHE, CLASSES, RACES } from '../fiche-hasard.js';
import { carteFiche } from '../carte-personnage.js';
import { $, h, deuxTemps, fichierChoisi } from '../dom.js';

export function creerPersonnages(ctx) {
  const donjon = () => ctx.donjon();
  const rendre = () => ctx.rendre();

  // --- Personnages : les fiches associées au donjon (js/personnages.js) ---
  function messagePersonnages(texte) {
    const m = $('personnages-message');
    m.hidden = !texte;
    m.textContent = texte;
  }
  function majPersonnages() {
    const d = donjon();
    const persos = d.personnages || [];
    $('personnages-vide').hidden = persos.length > 0;
    $('personnages-liste').replaceChildren(...persos.map((p) => {
      const retirer = h('button', { type: 'button', className: 'discret petit' });
      deuxTemps(retirer, 'Retirer', 'Confirmer', () => { retirerPersonnage(d, p.id); messagePersonnages(`${p.fiche.nom} retiré de ce donjon.`); rendre(); });
      return carteFiche(p.fiche, [retirer]);
    }));
    const locales = stockage.chargerFichesLocales();
    const valeur = $('personnages-locales').value;
    $('personnages-locales').replaceChildren(...locales.map((l) => {
      const deja = persos.some((p) => p.source === l.source);
      return h('option', { value: l.source, textContent: `${l.fiche.nom}${deja ? ' (déjà ajoutée)' : ''}` });
    }));
    if (locales.some((l) => l.source === valeur)) $('personnages-locales').value = valeur;
    $('personnages-locales').disabled = $('personnages-ajouter').disabled = locales.length === 0;
    $('personnages-actualiser').disabled = !persos.some((p) => p.source && locales.some((l) => l.source === p.source));
  }
  $('personnages-ajouter').addEventListener('click', () => {
    const locale = stockage.chargerFichesLocales().find((l) => l.source === $('personnages-locales').value);
    if (!locale) return;
    const p = ajouterPersonnage(donjon(), locale.fiche, locale.source);
    messagePersonnages(p ? `${p.fiche.nom} est associé à ce donjon.` : 'Ce donjon a déjà le maximum de fiches.');
    rendre();
  });
  $('personnages-actualiser').addEventListener('click', () => {
    const n = actualiserPersonnages(donjon(), stockage.chargerFichesLocales());
    messagePersonnages(`${n} fiche${n > 1 ? 's actualisées' : ' actualisée'} depuis ce navigateur.`);
    rendre();
  });
  $('personnages-fichier').addEventListener('change', async (e) => {
    const fichier = fichierChoisi(e);
    if (!fichier) return;
    try {
      const fiche = ficheDepuisFichier(await stockage.lireFichierJson(fichier));
      if (!fiche) throw new Error('fiche illisible');
      const p = ajouterPersonnage(donjon(), fiche);
      messagePersonnages(p ? `${p.fiche.nom} est associé à ce donjon.` : 'Ce donjon a déjà le maximum de fiches.');
      rendre();
    } catch {
      messagePersonnages('Ce fichier n’est pas une fiche de personnage : rien n’a été ajouté.');
    }
  });

  // --- Fiches au hasard (js/fiche-hasard.js) ---
  $('personnages-hasard').addEventListener('click', () => {
    const ouvert = $('fiche-hasard').hidden;
    $('fiche-hasard').hidden = !ouvert;
    $('personnages-hasard').setAttribute('aria-pressed', String(ouvert));
  });
  for (const [cle, [defaut, min, max]] of Object.entries(BORNES_FICHE)) {
    Object.assign($(`fiche-hasard-${cle}`), { value: String(defaut), min: String(min), max: String(max), step: '1' });
  }
  const optionsTirage = (table) => [h('option', { value: '', textContent: 'Au hasard' }), ...Object.entries(table).map(([cle, { nom }]) => h('option', { value: cle, textContent: nom }))];
  $('fiche-hasard-classe').replaceChildren(...optionsTirage(CLASSES));
  $('fiche-hasard-race').replaceChildren(...optionsTirage(RACES));

  /** Les dernières fiches tirées : un nouveau tirage les remplace tant que le MJ ne les a pas gardées, plutôt que d'empiler les essais. */
  let dernieresFiches = null;
  function oublierTirageFiches() {
    dernieresFiches = null;
    $('fiche-hasard-garder').hidden = true;
  }
  $('fiche-hasard-generer').addEventListener('click', () => {
    const d = donjon();
    if (dernieresFiches?.donjon === d.id) for (const id of dernieresFiches.ids) retirerPersonnage(d, id);
    oublierTirageFiches();
    const { fiches, graine, resume } = genererFiches({
      nombre: $('fiche-hasard-nombre').value, niveau: $('fiche-hasard-niveau').value,
      classe: $('fiche-hasard-classe').value, race: $('fiche-hasard-race').value, graine: $('fiche-hasard-graine').value,
    });
    const ajoutes = fiches.map((fiche) => ajouterPersonnage(d, resumerFiche(fiche))).filter(Boolean);
    const message = $('fiche-hasard-message');
    message.hidden = false;
    if (ajoutes.length) {
      dernieresFiches = { donjon: d.id, ids: ajoutes.map((p) => p.id) };
      $('fiche-hasard-garder').hidden = false;
    }
    message.textContent = `Tirage ${graine} : ${resume.slice(0, ajoutes.length).map(decrireTirage).join(', ') || 'aucune fiche'}.`
      + (ajoutes.length < fiches.length ? ' Ce donjon a atteint le maximum de fiches.' : '')
      + (ajoutes.length ? ' Un nouveau tirage remplace celui-ci tant que tu ne le gardes pas.' : '');
    rendre();
  });
  $('fiche-hasard-garder').addEventListener('click', () => {
    oublierTirageFiches();
    $('fiche-hasard-message').textContent = 'Gardé : le prochain tirage s’ajoutera à ces fiches.';
  });

  return { maj: majPersonnages };
}
