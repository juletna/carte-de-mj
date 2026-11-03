/**
 * Règles de jeu de la Fiche : bonus de compétence et de sauvegarde, CA totale, vitesse, effets actifs, jet d'un d20 avec avantage,
 * dégâts et soins, début de tour. Module PUR (sans DOM) : la fiche active `S` est le premier paramètre de chaque fonction, et aucune
 * ne fait apparaître de message : celles qui en avaient un le rendent (`damage`, `startTurn`), à la page de l'afficher.
 * Les dés viennent de ./des.js ; `tirer` (dernier paramètre de `d20`) permet à un test d'imposer les tirages.
 */
import { SKILLS, COND_ADV, freshTurn, uid } from './base.js';
import { rnd, rollExpr, mod, sg } from './des.js';

export const skB=(S,n)=>{const st=SKILLS.find(s=>s[0]===n)[1];return mod(S.stats[st])+S.prof*(S.skills[n]||0)};
export const svB=(S,s)=>mod(S.stats[s])+(S.saveProf.includes(s)?S.prof:0);
export const hdLeft=S=>Math.max(0,S.lvl-S.hd.used);
export const hasHaste=S=>S.fx.some(f=>f.haste);
export const fxOf=(S,sc)=>S.fx.filter(f=>f.sc.includes(sc));
export const negFx=f=>['dieneg','dis'].includes(f.kind)||(f.kind==='flat'&&f.val<0);
export const acTotal=S=>S.ac+S.inv.reduce((s,it)=>s+(it.type==='equip'&&it.eq?(+it.acb||0):0),0)+fxOf(S,'ac').reduce((s,f)=>s+(f.kind==='flat'?+f.val||0:0),0);
export function baseSpeed(S){if(S.conds.includes('Agrippé')||S.conds.includes('Entravé'))return 0;return Math.max(0,S.speed*(hasHaste(S)?2:1)-1.5*S.exh)}
export const speedNow=S=>baseSpeed(S)*(S.turn.dash?2:1);
export function note(S,k,x){S.log.unshift({t:Date.now(),k,x})}

export function fxVal(f,crit,tirer=rnd){
 if(f.kind==='die')return rollExpr(f.val,crit,tirer).tot;
 if(f.kind==='dieneg')return -rollExpr(f.val,crit,tirer).tot;
 if(f.kind==='flat')return +f.val||0;
 return null;
}
export const manualFx=f=>f.dur==='once'&&['die','dieneg','flat'].includes(f.kind);
export function dropFx(S,ids){S.fx=S.fx.filter(f=>!ids.includes(f.id))}

/* Jet d20 avec avantage, effets actifs, états et épuisement */
export function d20(S,m,label,scope,tirer=rnd){
 const fx=scope?fxOf(S,scope):[];
 const src=[];
 if(S.adv===1)src.push([1,'choisi']);if(S.adv===2)src.push([-1,'choisi']);
 fx.forEach(f=>{if(f.kind==='adv')src.push([1,f.n]);if(f.kind==='dis')src.push([-1,f.n])});
 S.conds.forEach(c=>(COND_ADV[c]||[]).forEach(([sc,v])=>{if(sc===scope)src.push([v,c])}));
 const up=src.filter(x=>x[0]>0),dn=src.filter(x=>x[0]<0);
 const a=tirer(20),b=tirer(20);let nat=a,det=String(a);
 if(up.length&&!dn.length){nat=Math.max(a,b);det=`${a}|${b} avantage (${up.map(x=>x[1]).join(', ')})`}
 else if(dn.length&&!up.length){nat=Math.min(a,b);det=`${a}|${b} désavantage (${dn.map(x=>x[1]).join(', ')})`}
 else if(up.length&&dn.length)det=`${a} (avantage et désavantage s'annulent)`;
 let add=m;const parts=m?[sg(m)]:[];
 fx.forEach(f=>{if(manualFx(f))return;const v=fxVal(f,false,tirer);if(v===null)return;add+=v;parts.push(`${sg(v)} ${f.n}`)});
 if(S.exh){add-=2*S.exh;parts.push(`−${2*S.exh} épuisement`)}
 dropFx(S,fx.filter(f=>f.dur==='once'&&(f.kind==='adv'||f.kind==='dis')).map(f=>f.id));
 return{t:Date.now(),l:label,tot:nat+add,det:[det,...parts].join(' '),d20:true,nat,m:add,scope};
}
export function push(S,r){S.rolls.unshift(r);S.rolls=S.rolls.slice(0,40);S.rbOpen=false}
export function spend(S,k){if(S.mode==='combat'&&k&&k!=='none'){if(k==='action'&&S.turn.action&&hasHaste(S)&&!S.turn.haste)S.turn.haste=true;else S.turn[k]=true}}

/* Dégâts : les PV temporaires partent d'abord. Rend le message à montrer (un échec de plus contre la mort à 0 PV), ou null. */
export function damage(S,n){
 let msg=null;
 if(S.tmp){const t=Math.min(S.tmp,n);S.tmp-=t;n-=t}
 if(S.hp===0&&n>0){S.saves.f=Math.min(3,S.saves.f+1);msg='PV à 0 : un échec de sauvegarde contre la mort'}
 S.hp=Math.max(0,S.hp-n);
 if(S.conc&&n>0)S.concDD=Math.max(S.concDD||0,Math.min(30,Math.max(10,Math.floor(n/2))));
 return msg;
}
export function heal(S,n){if(S.hp===0&&n>0)S.saves={s:0,f:0};S.hp=Math.min(S.hpMax,S.hp+n)}
/* Début de tour : nouveau round, actions rendues, effets en rounds décomptés. Rend les effets arrivés à leur terme (la page les annonce). */
export function startTurn(S){
 S.round++;S.turn=freshTurn();S.phase='mine';
 const ended=[];S.fx.forEach(f=>{if(f.dur==='rounds'){f.left--;if(f.left<=0)ended.push(f)}});
 dropFx(S,ended.map(f=>f.id));
 return ended;
}
export function addFx(S,p){S.fx.push(Object.assign({},p,{id:uid(),src:S.fxSrc.trim(),sc:[...p.sc]}))}
