/**
 * Tests des modèles de donjon (js/modeles.js) et de leur stockage.
 * Sans dépendance : marche sous Node et dans tests.html.
 */
import * as m from '../js/donjon.js';
import { MODELES, donjonDepuisModele, copieDonjon } from '../js/modeles.js';
import { chargerModeles, sauverModeles, CLE_MODELES } from '../js/stockage.js';
import { analyser } from '../js/parseur/index.js';
import { disposerPlan } from '../js/plan-donjon.js';
import { surLeSol } from '../js/formes.js';
import { verifier, egal, fauxStock, executerSuite } from './mini-test.js';

const TESTS = [
  ['chaque modèle de l’outil donne un donjon valide, entièrement relié et compris', () => {
    for (const modele of MODELES) {
      const d = donjonDepuisModele(modele);
      egal(Object.keys(d.salles).length, modele.salles.length, `${modele.nom} : salles`);
      egal(d.liaisons.length, modele.liens.length, `${modele.nom} : liaisons`);
      egal(m.liaisonsOrphelines(d).length, 0, `${modele.nom} : orphelines`);
      verifier(m.validerDonjon(JSON.parse(JSON.stringify(d))).donjon, `${modele.nom} : refusé`);
      egal(Object.values(d.salles).map((s) => s.nom), modele.salles.map((s) => s.nom), `${modele.nom} : noms`);
      for (const s of Object.values(d.salles)) {
        egal(analyser(s.texte).ignores, [], `${modele.nom} : mots non compris dans « ${s.texte} »`);
        for (const e of [...s.plan.objets, ...s.plan.creatures]) verifier(surLeSol(s.plan, e.x, e.y, e.taille ?? e.l, e.taille ?? e.h), `${e.type} hors du sol dans ${s.nom}`);
      }
      egal(disposerPlan(d).ponts.length, 0, `${modele.nom} : aucun croisement`);
    }
  }],
  ['un modèle tient ses promesses : la croix, le O, la porte secrète', () => {
    const salle = (id, nom) => Object.values(donjonDepuisModele(MODELES.find((x) => x.id === id)).salles).find((s) => s.nom === nom);
    egal(salle('eglise', 'Nef').plan.forme, 'croix', 'église');
    egal(salle('cloitre', 'Cloître').plan.forme, 'O', 'cloître');
    verifier(salle('crypte', 'Ossuaire').plan.portes[0].cache, 'la porte de l’ossuaire est secrète');
    verifier(salle('crypte', 'Galerie').plan.portes.some((q) => q.mur === 'est' && q.cache), 'de l’autre côté aussi');
  }],
  ['partir d’un modèle ne le modifie pas, et deux départs sont indépendants', () => {
    const avant = JSON.stringify(MODELES);
    const a = donjonDepuisModele(MODELES[0]), b = donjonDepuisModele(MODELES[0]);
    verifier(a.id !== b.id, 'identifiants différents');
    Object.values(a.salles)[0].nom = 'Changé';
    verifier(Object.values(b.salles)[0].nom !== 'Changé', 'b ne bouge pas');
    egal(JSON.stringify(MODELES), avant, 'le modèle est intact');
  }],
  ['copie : un identifiant neuf, rien de partagé, le contenu complet', () => {
    const d = donjonDepuisModele(MODELES[1]);
    const c = copieDonjon(d, { nom: 'Ma crypte', idsPris: [d.id] });
    verifier(c.id !== d.id, 'identifiant neuf');
    egal(c.nom, 'Ma crypte', 'nom');
    egal(c.liaisons, d.liaisons, 'liaisons');
    egal(Object.values(c.salles).map((s) => s.texte), Object.values(d.salles).map((s) => s.texte), 'textes');
    Object.values(c.salles)[0].texte = 'x';
    verifier(Object.values(d.salles)[0].texte !== 'x', 'rien de partagé');
    egal(copieDonjon(d).nom, d.nom, 'sans nom : le même');
  }],
  ['stockage : les modèles du MJ reviennent, un modèle abîmé est écarté', () => {
    const stock = fauxStock();
    egal(chargerModeles(stock), [], 'rien au départ');
    const d = donjonDepuisModele(MODELES[2]);
    verifier(sauverModeles([d], stock), 'écriture');
    egal(chargerModeles(stock).map((x) => [x.id, x.nom, Object.keys(x.salles).length]), [[d.id, d.nom, 3]], 'relecture');
    const abime = fauxStock({ [CLE_MODELES]: JSON.stringify({ modeles: [{ pas: 'un donjon' }, d, 'x'] }) });
    egal(chargerModeles(abime).length, 1, 'seul le bon reste');
    egal(chargerModeles(fauxStock({ [CLE_MODELES]: '{cassé' })), [], 'JSON cassé');
    egal(chargerModeles(fauxStock({ [CLE_MODELES]: '{"modeles":3}' })), [], 'mauvaise forme');
  }],
];

export const executer = () => executerSuite('modèles : ', TESTS);
