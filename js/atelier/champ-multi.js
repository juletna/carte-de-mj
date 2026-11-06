/**
 * Un champ « à choix multiples » de l'inspecteur (docs/design-panneaux.md, rangées de champ) : une rangée [icône · résumé ▾] qui ouvre, au clic,
 * la liste des choix en popover ancré dessous, avec une case à cocher par choix. Même habillage que `creerChampChoix` (js/atelier/champ-choix.js),
 * mais le popover reste ouvert pendant qu'on coche ; un clic ailleurs, Échap ou la rangée le referme.
 *
 *   const champ = creerChampMulti({ titre, icone: 'creature', auto: 'Auto', autoDetail: 'comme le donjon (…)', options: [{ valeur, libelle }], valeurs: [], surChangement: (valeurs) => … });  → { element, valeurs }
 *
 * « Auto » est la première ligne : cochée quand rien d'autre ne l'est ; la cocher vide la sélection, cocher un choix la décoche, décocher le dernier y revient.
 */
import { h } from '../dom.js';
import { icone } from '../icones.js';

export function creerChampMulti({ titre, icone: nomIcone, auto = 'Auto', autoDetail = '', options, valeurs = [], surChangement }) {
  let choisies = options.map((o) => o.valeur).filter((v) => valeurs.includes(v)); // dans l'ordre des options
  const resume = h('span', { className: 'rang-valeur' });
  const detail = h('span', { className: 'rang-etiquette' }); // « comme le donjon (…) » : en discret après « Auto », sur la même ligne
  const rangee = h('button', { type: 'button', className: 'rang-champ', 'aria-haspopup': 'listbox', 'aria-expanded': 'false' },
    h('span', { className: 'rang-icone-nue' }, icone(nomIcone)),
    h('span', { className: 'rang-texte rang-une-ligne' }, resume, detail),
    h('span', { className: 'rang-fin', 'aria-hidden': 'true', textContent: '▾' }));
  const liste = h('div', { className: 'popover-aspect popover-choix', role: 'listbox', 'aria-multiselectable': 'true', 'aria-label': titre, hidden: true });
  const hote = h('div', { className: 'rang-hote' }, rangee, liste);
  const libelleDe = (v) => options.find((o) => o.valeur === v)?.libelle ?? v;

  function majResume() {
    const texte = choisies.length ? choisies.map(libelleDe).join(', ') : auto;
    const plus = !choisies.length && autoDetail ? ` · ${autoDetail}` : '';
    resume.textContent = texte;
    detail.textContent = plus;
    rangee.title = `${titre} : ${texte}${plus}`;
    rangee.setAttribute('aria-label', `${titre} : ${texte}${plus}`);
  }
  const ligne = (libelle, coche, agir) => {
    const b = h('button', { type: 'button', className: 'rang-choix', role: 'option', 'aria-selected': String(coche) },
      h('span', { className: 'rang-case', 'aria-hidden': 'true' }), h('span', { textContent: libelle })); // la coche est dessinée en CSS : aucune icône à charger, la liste s'ouvre même si icones.js est une version plus ancienne en cache
    b.addEventListener('click', agir);
    return b;
  };
  function dessinerListe() {
    liste.replaceChildren(
      h('p', { className: 'popover-titre', textContent: titre }),
      ligne(autoDetail ? `${auto} · ${autoDetail}` : auto, choisies.length === 0, () => changer([])),
      ...options.map((o) => ligne(o.libelle, choisies.includes(o.valeur), () => changer(choisies.includes(o.valeur) ? choisies.filter((v) => v !== o.valeur) : [...choisies, o.valeur]))));
  }
  function changer(nouvelles) {
    choisies = options.map((o) => o.valeur).filter((v) => nouvelles.includes(v));
    majResume();
    dessinerListe();
    surChangement?.([...choisies]);
  }
  function ouvrir(oui) {
    if (oui) dessinerListe();
    liste.hidden = !oui;
    rangee.setAttribute('aria-expanded', String(oui));
  }
  rangee.addEventListener('click', () => ouvrir(liste.hidden));
  hote.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !liste.hidden) { e.preventDefault(); e.stopPropagation(); ouvrir(false); rangee.focus(); } });
  document.addEventListener('pointerdown', (e) => { if (!liste.hidden && !hote.contains(e.target)) ouvrir(false); }, true);
  majResume();
  return { element: hote, valeurs: () => [...choisies] };
}
