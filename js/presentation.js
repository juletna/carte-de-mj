/**
 * Présentation : façade. L'état d'une partie en cours, ce que voit la table et le passage des portes sont dans trois modules,
 * réexportés ici pour que les écrans et les tests gardent un seul point d'entrée :
 *  - partie.js        la partie (format, création, validation, révélations, masquage, notes, PV, commandes, case montrée) ;
 *  - passage.js       le passage d'une porte (le groupe suit), la salle créée derrière une porte, la pose des pions ;
 *  - vue-publique.js  la règle de visibilité à la table, `vueTable()`, `planPublic()`, l'encart du plan et leur relecture côté table.
 *
 * Le Donjon et l'impression n'ont pas besoin du reste : l'impression importe vue-publique.js seul (sans le parseur), le stockage partie.js.
 */
export { ETATS } from './schema.js';
export * from './partie.js';
export * from './passage.js';
export * from './vue-publique.js';
