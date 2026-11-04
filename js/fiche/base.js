/**
 * Données de la Fiche : les listes de la règle (compétences, états, effets, types d'objets), le personnage d'exemple et le personnage vierge,
 * la remise à niveau d'une fiche plus ancienne, et la base des personnages du navigateur ({ actif, persos }).
 * Module PUR (sans DOM) : le stockage est passé en paramètre (`chargerBase(lire)`), la Fiche n'importe jamais stockage.js.
 * La clé du navigateur et le format viennent de ./format.js, les caractéristiques de ./regles.js : le Donjon les lit au même endroit.
 */
import { CLE_FICHES, CLE_FICHE_ANCIENNE } from './format.js';
import { STATS, EDITIONS, EDITION_PAR_DEFAUT, reglesDe } from './regles.js';

export const SKILLS=[['Acrobaties','DEX'],['Arcanes','INT'],['Athlétisme','FOR'],['Discrétion','DEX'],['Dressage','SAG'],['Escamotage','DEX'],
 ['Histoire','INT'],['Intimidation','CHA'],['Intuition','SAG'],['Investigation','INT'],['Médecine','SAG'],['Nature','INT'],
 ['Perception','SAG'],['Persuasion','CHA'],['Religion','INT'],['Représentation','CHA'],['Survie','SAG'],['Tromperie','CHA']];
export const CONDS=['À terre','Agrippé','Assourdi','Aveuglé','Charmé','Effrayé','Empoisonné','Entravé','Étourdi','Inconscient','Invisible','Neutralisé','Paralysé','Pétrifié'];
/* Effet des états sur tes propres jets d20 : [portée, +1 avantage / -1 désavantage] */
export const COND_ADV={'À terre':[['atk',-1]],'Aveuglé':[['atk',-1]],'Effrayé':[['atk',-1],['chk',-1]],'Empoisonné':[['atk',-1],['chk',-1]],'Entravé':[['atk',-1]],'Invisible':[['atk',1]]};
export const SCOPES=[['atk','Attaque'],['dmg','Dégâts'],['save','Sauvegarde'],['chk','Test'],['ac','CA']];
export const KINDS_FX=[['die','Dé en plus'],['dieneg','Dé en moins'],['flat','Bonus / malus fixe'],['adv','Avantage'],['dis','Désavantage'],['reroll','Relance']];
export const PRESETS=[
 {n:'Bénédiction',sc:['atk','save'],kind:'die',val:'1d4',dur:'rounds',left:10},
 {n:'Inspiration bardique',sc:['atk','save','chk'],kind:'die',val:'1d6',dur:'once'},
 {n:'Assistance',sc:['chk'],kind:'die',val:'1d4',dur:'once'},
 {n:'Aide',sc:['atk','chk'],kind:'adv',dur:'once'},
 {n:'Bouclier de la foi',sc:['ac'],kind:'flat',val:2,dur:'rounds',left:100},
 {n:'Hâte',sc:['ac'],kind:'flat',val:2,dur:'rounds',left:10,haste:true,note:'Vitesse ×2, action supplémentaire, avantage aux sauvegardes de DEX'},
 {n:'Sort Bouclier',sc:['ac'],kind:'flat',val:5,dur:'rounds',left:1},
 {n:'Marque du chasseur',sc:['dmg'],kind:'die',val:'1d6',dur:'conc',note:'Seulement contre la cible marquée'},
 {n:'Inspiration',sc:['atk','save','chk'],kind:'adv',dur:'once',edition:'2014'},
 {n:'Inspiration héroïque',sc:['atk','save','chk'],kind:'reroll',dur:'once',edition:'2024'},
 {n:'Fléau',sc:['atk','save'],kind:'dieneg',val:'1d4',dur:'rounds',left:10},
];
/* Un effet propre à une édition n'est proposé qu'avec elle ; en mode libre, tout est proposé. */
export const presetDispo=(p,edition)=>!p.edition||edition==='libre'||p.edition===edition;
/* Les types d'objet du sac. `ressource` : l'objet apparaît dans « Ressources » de l'écran Jeu ; `sansCout` : pas de « Coûte » (action) à régler. */
export const TYPES_OBJET={
 objet:{nom:'Objet simple',sansCout:true},
 soin:{nom:'Soin (consommable)',ressource:true},
 conso:{nom:'Consommable',ressource:true},
 charges:{nom:'Objet à charges',ressource:true},
 equip:{nom:'Équipement (bonus CA)',sansCout:true},
};
export const ITYPES=Object.entries(TYPES_OBJET).map(([k,o])=>[k,o.nom]);
export const IACTS=[['action','Action'],['bonus','Action bonus'],['obj','Interaction'],['none','Aucune']];
export const ACT_L={action:'action',bonus:'action bonus',obj:'interaction',none:''};
export const KINDS=['Note','Idée','Quête','PNJ','Butin'];

export const slots=a=>a.map(m=>({max:m,used:0}));
export const freshTurn=()=>({action:false,bonus:false,react:false,obj:false,haste:false,move:0,dash:false});
export const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
export function sample(){return{example:true,edition:EDITION_PAR_DEFAUT,name:'Elwyn Brisevent',guild:'',race:'Demi-elfe',cls:'Rôdeur',lvl:3,hpMax:28,hp:28,tmp:0,ac:15,speed:9,init:3,prof:2,
 stats:{FOR:11,DEX:16,CON:13,INT:10,SAG:14,CHA:12},saves:{s:0,f:0},conds:[],exh:0,conc:false,
 saveProf:['FOR','DEX'],skills:{Perception:1,Discrétion:1,Survie:1},
 attacks:[{n:'Arc long',hit:7,dmg:'1d8+3',ammo:'Flèches',note:'45/180 m'},{n:'Épée courte',hit:5,dmg:'1d6+3',ammo:'',note:'Légère, finesse'}],
 res:[{n:'Marque du chasseur (gratuite)',max:2,used:0,rest:'long'}],hd:{die:10,used:0},
 ammo:[{n:'Flèches',q:20,spent:0}],slots:slots([3,0,0,0,0,0,0,0,0]),coins:{pp:0,po:15,pa:8,pc:0},
 inv:[{n:'Arc long',q:1,type:'objet'},{n:'Épée courte',q:2,type:'objet'},{n:'Armure de cuir clouté',q:1,type:'objet'},{n:'Corde de chanvre (15 m)',q:1,type:'objet'},
  {n:'Rations (1 jour)',q:5,type:'conso',act:'none'},{n:'Potion de soins',q:2,type:'soin',dice:'2d4+2',act:'action'},{n:'Fiole d\'acide',q:1,type:'conso',act:'action'}],
 log:[{t:Date.now(),k:'Idée',x:'Exemple : fouiller la tour nord avant de rejoindre le village.'}],
 fx:[],mode:'explo',phase:'wait',round:0,turn:freshTurn(),fxSrc:'',showCustom:false,
 fxD:{n:'',sc:['atk'],kind:'die',val:'1d4',dur:'rounds',left:10},openItem:-1,
 sheet:null,pad:'',concDD:0,pick:false,rbOpen:false,
 rolls:[],tab:'combat',dc:1,dm:0,adv:0,jk:'Note',draft:'',crit:false}}
export function blank(){return Object.assign(sample(),{example:false,name:'Nouveau personnage',race:'',cls:'',lvl:1,hpMax:10,hp:10,ac:10,init:0,
 stats:{FOR:10,DEX:10,CON:10,INT:10,SAG:10,CHA:10},saveProf:[],skills:{},attacks:[],res:[],hd:{die:8,used:0},
 ammo:[],slots:slots([0,0,0,0,0,0,0,0,0]),coins:{pp:0,po:0,pa:0,pc:0},inv:[],log:[]})}
/* Complète une fiche créée avec une version précédente (ou importée) */
/* Complète une fiche créée avec une version précédente (ou importée) */
export function complete(o){const d=o.example?sample():blank();
 for(const k in d){const a=d[k];if(o[k]==null||(Array.isArray(a)?!Array.isArray(o[k]):typeof a==='object'?typeof o[k]!=='object'||Array.isArray(o[k]):typeof a!==typeof o[k]))o[k]=a}
 if(!Object.hasOwn(EDITIONS,String(o.edition)))o.edition=EDITION_PAR_DEFAUT;
 STATS.forEach(s=>{if(!Number.isFinite(+o.stats[s]))o.stats[s]=10});
 ['attacks','res','ammo','inv','log','fx','slots'].forEach(k=>o[k]=o[k].filter(x=>x&&typeof x==='object'));
 if(o.slots.length!==9)o.slots=d.slots;
 o.inv.forEach(it=>{if(!it.type){if(/potion de soins/i.test(it.n)){it.type='soin';it.dice='2d4+2';it.act=reglesDe(o.edition).potion||'action'}else it.type='objet'}});
 o.sheet=null;return o}

/* État d'interface d'une fiche (feuille ouverte, pavé, objet déplié…) : remis à zéro quand on change de personnage, hors de l'empreinte. L'onglet (`tab`) s'y ajoute. */
export const ETAT_INTERFACE=Object.freeze({sheet:null,pad:'',openItem:-1,showCustom:false,rbOpen:false});
/* Empreinte d'une fiche sans son état d'interface, pour savoir si elle a bougé */
export const snapP=p=>JSON.stringify(Object.assign({},p,{tab:''},ETAT_INTERFACE));

/* Plusieurs personnages : { actif:id, persos:{id:fiche} }. `lire(cle)` rend le JSON rangé sous cette clé, ou rien s'il est absent ou illisible.
   Reprend l'ancienne clé si la nouvelle est absente.
   ATTENTION, perte connue et conservée : un personnage sans `stats` en objet est écarté ici, en silence, et la Fiche réécrit alors la base
   au premier rendu (save). À traiter à part (mise de côté, comme stockage.js pour les donjons), pas dans ce déplacement. */
export function chargerBase(lire){
 let DB=lire(CLE_FICHES);
 if(!DB||!DB.persos||typeof DB.persos!=='object')DB=null;
 else{for(const id in DB.persos){const p=DB.persos[id];if(!p||typeof p!=='object'||!p.stats||typeof p.stats!=='object')delete DB.persos[id]}
  if(!Object.keys(DB.persos).length)DB=null}
 if(!DB){const o=lire(CLE_FICHE_ANCIENNE);
  DB={actif:uid(),persos:{}};DB.persos[DB.actif]=o&&o.stats&&typeof o.stats==='object'?o:sample()}
 if(!DB.persos[DB.actif])DB.actif=Object.keys(DB.persos)[0];
 Object.values(DB.persos).forEach(complete);
 return DB;
}
