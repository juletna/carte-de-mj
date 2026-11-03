/**
 * Point d'entrée de la Présentation (outil indépendant : ni Fiche, ni réseau).
 *
 * Deux modes, selon l'adresse :
 *  - presentation.html            la RÉGIE du MJ (regie.js) : choix du donjon, carte complète, révélations, portes ;
 *  - presentation.html?vue=table  la VUE TABLE (vue-table.js) : uniquement la carte, alimentée par la régie.
 *
 * Les deux partagent l'écran de table (ecran-table.js) et le protocole du canal (protocole-table.js). Un seul HTML.
 */
import { demarrerTable } from './vue-table.js';
import { demarrerRegie } from './regie.js';

if (new URLSearchParams(location.search).get('vue') === 'table') demarrerTable();
else demarrerRegie();
