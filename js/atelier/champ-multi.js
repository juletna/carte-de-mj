/**
 * Un champ « à choix multiples » (ou, avec `unique`, à choix unique) de l'inspecteur (docs/design-panneaux.md, rangées de champ) : une rangée [icône · résumé ▾] qui ouvre, au clic,
 * la liste des choix en popover ancré dessous, avec une case à cocher par choix. Même habillage que `creerChampChoix` (js/atelier/champ-choix.js),
 * mais le popover reste ouvert pendant qu'on coche ; un clic ailleurs, Échap ou la rangée le referme.
 *
 *   const champ = creerChampMulti({ titre, icone: 'creature', auto: 'Auto', autoDetail: 'comme le donjon (…)', options: [{ valeur, libelle }], valeurs: [], surChangement: (valeurs) => … });  → { element, valeurs }
 *
 * « Auto » est la première ligne : cochée quand rien d'autre ne l'est ; la cocher vide la sélection, cocher un choix la décoche, décocher le dernier y revient.
 *
 * `unique: true` : UN choix à la fois (« Forme »). Le popover se ferme au choix, qui est marqué par la surbrillance de sa ligne (`aria-selected`) ;
 * `surChangement` reçoit toujours un tableau (vide : Auto, sinon la seule valeur). Chaque ligne peut montrer une miniature à la place de la case :
 * `miniature` sur l'option, `miniatureAuto` pour la ligne Auto (des fonctions qui rendent un élément) ; sans elle, l'icône `icone` de la rangée
 * et, pour les lignes, la case à cocher. La rangée montre la miniature du choix courant.
 */
import { h } from '../dom.js';
import { icone } from '../icones.js';

export function creerChampMulti({ titre, icone: nomIcone, auto = 'Auto', autoDetail = '', options, valeurs = [], surChangement, unique = false, miniatureAuto = null }) {
  let choisies = options.map((o) => o.valeur).filter((v) => valeurs.includes(v)); // dans l'ordre des options
  if (unique) choisies = choisies.slice(0, 1);
  const resume = h('span', { className: 'rang-valeur' });
  const detail = h('span', { className: 'rang-etiquette' }); // « comme le donjon (…) » : en discret après « Auto », sur la même ligne
  const apercu = h('span', { className: 'rang-icone-nue' }); // l'icône du champ, sans cadre ; une miniature (choix unique) la remplace dans un cadre
  const rangee = h('button', { type: 'button', className: 'rang-champ', 'aria-haspopup': 'listbox', 'aria-expanded': 'false' },
    apercu,
    h('span', { className: 'rang-texte rang-une-ligne' }, resume, detail),
    h('span', { className: 'rang-fin', 'aria-hidden': 'true', textContent: '▾' }));
  const liste = h('div', { className: 'popover-aspect popover-choix', role: 'listbox', ...(unique ? {} : { 'aria-multiselectable': 'true' }), 'aria-label': titre, hidden: true });
  const hote = h('div', { className: 'rang-hote' }, rangee, liste);
  const libelleDe = (v) => options.find((o) => o.valeur === v)?.libelle ?? v;

  /** Le pictogramme de la rangée (un icône récent absent d'un icones.js ancien en cache ne casse pas le champ). */
  const pictogramme = () => { try { return icone(nomIcone); } catch { return ''; } };
  /** La miniature d'un choix (`null` : Auto), ou null si le champ n'en montre pas. */
  const miniatureDe = (valeur) => {
    const f = valeur === null ? miniatureAuto : options.find((o) => o.valeur === valeur)?.miniature;
    try { return f?.() ?? null; } catch (err) { console.error(`Miniature de « ${titre} » :`, err); return null; }
  };

  function majResume() {
    const mini = unique ? miniatureDe(choisies[0] ?? null) : null;
    apercu.className = mini ? 'rang-aperce rang-icone rang-mini' : 'rang-icone-nue';
    apercu.replaceChildren(...(mini ? [mini] : [pictogramme()]));
    const texte = choisies.length ? choisies.map(libelleDe).join(', ') : auto;
    const plus = !choisies.length && autoDetail ? ` · ${autoDetail}` : '';
    resume.textContent = texte;
    detail.textContent = plus;
    rangee.title = `${titre} : ${texte}${plus}`;
    rangee.setAttribute('aria-label', `${titre} : ${texte}${plus}`);
  }
  const ligne = (libelle, coche, agir, valeur) => {
    const mini = unique ? miniatureDe(valeur) : null; // en choix unique : la miniature, et la ligne choisie est en surbrillance
    const b = h('button', { type: 'button', className: 'rang-choix', role: 'option', 'aria-selected': String(coche) },
      mini ? h('span', { className: 'rang-aperce rang-icone rang-mini', 'aria-hidden': 'true' }, mini) : h('span', { className: 'rang-case', 'aria-hidden': 'true' }), h('span', { textContent: libelle })); // la coche est dessinée en CSS : aucune icône à charger, la liste s'ouvre même si icones.js est une version plus ancienne en cache
    b.addEventListener('click', agir);
    return b;
  };
  function dessinerListe() {
    liste.replaceChildren(
      h('p', { className: 'popover-titre', textContent: titre }),
      ligne(autoDetail ? `${auto} · ${autoDetail}` : auto, choisies.length === 0, () => changer([]), null),
      ...options.map((o) => ligne(o.libelle, choisies.includes(o.valeur), () => changer(unique ? [o.valeur] : choisies.includes(o.valeur) ? choisies.filter((v) => v !== o.valeur) : [...choisies, o.valeur]), o.valeur)));
  }
  function changer(nouvelles) {
    choisies = options.map((o) => o.valeur).filter((v) => nouvelles.includes(v));
    majResume();
    surChangement?.([...choisies]);
    if (unique) { ouvrir(false); rangee.focus(); } else dessinerListe(); // un choix unique referme la liste
  }
  function ouvrir(oui) {
    if (oui) dessinerListe();
    liste.hidden = !oui;
    rangee.setAttribute('aria-expanded', String(oui));
    if (oui) liste.scrollIntoView?.({ block: 'nearest' }); // près du bas du panneau : la liste défile dans la vue au lieu de déborder
  }
  rangee.addEventListener('click', () => ouvrir(liste.hidden));
  hote.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !liste.hidden) { e.preventDefault(); e.stopPropagation(); ouvrir(false); rangee.focus(); } });
  document.addEventListener('pointerdown', (e) => { if (!liste.hidden && !hote.contains(e.target)) ouvrir(false); }, true);
  majResume();
  return { element: hote, valeurs: () => [...choisies] };
}
