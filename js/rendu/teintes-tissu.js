/**
 * Les teintes des étoffes (bannière, tapis) : un même motif, seule la couleur change selon la variante. Module sans état ni DOM, lu par les trois thèmes.
 * Les variantes elles-mêmes (id, noms, mots) sont dans catalogue.js (COULEURS_TISSU) : ici, seulement leur aspect, indexé par ces mêmes `id`.
 *
 * Une teinte :
 *   s   le style « sobres » du thème peint et le thème vectoriel : c (clair) et d (foncé) pour l'étoffe, x le trait intérieur le plus sombre,
 *       p les perles du galon, acc le deuxième losange du tapis, ctr son cœur, g l'or du galon et de l'emblème (foncé sur une étoffe dorée)
 *   r   le style « riches » : fond, lis (liseré clair), om (bande d'ombre), ombre (ton foncé du trait et des perles), acc, ctr, g
 *   gris   le niveau de gris du thème papier (noir et blanc)
 */
export const TEINTES_TISSU = {
  rouge: {
    s: { c: '#a5302a', d: '#5b1513', x: '#3a0f0e', p: '#5a1614', acc: '#26335f', ctr: '#7a1e1c', g: '#d8b257' },
    r: { fond: '#cf4a3c', lis: 'rgba(255,170,150,0.7)', om: 'rgba(90,20,14,0.4)', ombre: '#8e2a22', acc: '#5a89cf', ctr: '#cf4a3c', g: '#f0c648' }, gris: '#e4e4e4',
  },
  bleue: {
    s: { c: '#2f4f9a', d: '#17274f', x: '#0f1a38', p: '#14224a', acc: '#7a1e1c', ctr: '#1f3a7a', g: '#d8b257' },
    r: { fond: '#5a89cf', lis: 'rgba(200,225,255,0.7)', om: 'rgba(20,40,100,0.4)', ombre: '#36609f', acc: '#cf4a3c', ctr: '#36609f', g: '#f0c648' }, gris: '#c8c8c8',
  },
  verte: {
    s: { c: '#3f7a3a', d: '#1f3d1c', x: '#142a12', p: '#1a3418', acc: '#7a1e1c', ctr: '#2f5f2c', g: '#d8b257' },
    r: { fond: '#58a54a', lis: 'rgba(210,255,190,0.65)', om: 'rgba(20,70,20,0.4)', ombre: '#3b7a30', acc: '#cf4a3c', ctr: '#3b7a30', g: '#f0c648' }, gris: '#d6d6d6',
  },
  noire: {
    s: { c: '#3c3c46', d: '#16161c', x: '#08080b', p: '#101015', acc: '#7a1e1c', ctr: '#26262e', g: '#d8b257' },
    r: { fond: '#505064', lis: 'rgba(210,210,235,0.55)', om: 'rgba(0,0,16,0.45)', ombre: '#2c2c3a', acc: '#cf4a3c', ctr: '#2c2c3a', g: '#f0c648' }, gris: '#5a5a5a',
  },
  doree: {
    s: { c: '#d8b257', d: '#8a6a20', x: '#5a4210', p: '#7a5a18', acc: '#26335f', ctr: '#a5302a', g: '#7a2a24' },
    r: { fond: '#f0c648', lis: 'rgba(255,246,190,0.8)', om: 'rgba(140,90,20,0.4)', ombre: '#b8862a', acc: '#5a89cf', ctr: '#cf4a3c', g: '#cf4a3c' }, gris: '#b4b4b4',
  },
  violette: {
    s: { c: '#7b3fa0', d: '#3f1d5a', x: '#2a1040', p: '#35184f', acc: '#e8dcb0', ctr: '#55297a', g: '#d8b257' },
    r: { fond: '#9a6bc8', lis: 'rgba(235,210,255,0.7)', om: 'rgba(60,24,96,0.4)', ombre: '#6a3f98', acc: '#f8f2e2', ctr: '#6a3f98', g: '#f0c648' }, gris: '#a8a8a8',
  },
  blanche: {
    s: { c: '#f1ece0', d: '#a9a393', x: '#6b665a', p: '#8c8676', acc: '#26335f', ctr: '#cbbf9c', g: '#d8b257' },
    r: { fond: '#fbf6ea', lis: 'rgba(255,255,255,0.9)', om: 'rgba(120,108,84,0.35)', ombre: '#cdbf98', acc: '#5a89cf', ctr: '#e6d6a0', g: '#f0c648' }, gris: '#ffffff',
  },
};
