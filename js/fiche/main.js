/**
 * Page de la Fiche (fiche.html) : le rendu des écrans (Jeu, Jets, Sac, Journal, Fiche), les feuilles (PV, personnages, « Sur moi »),
 * les clics et les saisies, la sauvegarde dans ce navigateur. Module : la page ne s'ouvre plus en file://, il faut la servir.
 * Les règles sont dans ./jeu.js et ./des.js, les données dans ./base.js, la clé et le format du fichier dans ./format.js
 * (le Donjon les lit au même endroit). La Fiche n'importe jamais stockage.js : pour mettre de côté ce qui ne se relit pas, elle prend
 * ../mise-de-cote.js, que le Donjon partage (il ne tire rien d'autre).
 *
 * Une fonction appelée depuis le HTML devrait être globale : il n'y en a aucune, tout passe par les attributs data-a / data-tab
 * et les écouteurs de document ci-dessous.
 */
import { CLE_FICHES, FORMAT_FICHE, VERSION_FICHE } from './format.js';
import { STATS } from './regles.js';
import { lireBrut, mettreDeCote } from '../mise-de-cote.js';
import { EDITIONS, reglesDe } from './regles.js';
import { rnd, mod, sg, profFor, rollExpr } from './des.js';
import { iconeHtml as I } from '../icones.js';
import { SKILLS, CONDS, SCOPES, KINDS_FX, PRESETS, presetDispo, TYPES_OBJET, ITYPES, IACTS, ACT_L, KINDS, freshTurn, uid, sample, blank, complete,
  ETAT_INTERFACE, snapP, relireBase } from './base.js';
import { skB, svB, hdLeft, hasHaste, fxOf, negFx, acTotal, speedNow, hpMaxNow, effetsEpuisement, soinDV, dvRendus, changerEdition, note, fxVal, manualFx, dropFx, d20, push, spend,
  damage, heal, startTurn, addFx } from './jeu.js';

/* Plusieurs personnages : { actif:id, persos:{id:fiche} } (js/fiche/base.js). */
const lireJson=cle=>{try{return JSON.parse(localStorage.getItem(cle))}catch(e){}};
const stock=()=>{try{return localStorage}catch(e){return null}};
/* Ce qui ne se relit pas est copié AVANT la première sauvegarde, qui réécrit la clé des fiches. Si la copie échoue, `verrou` : on n'écrit plus rien
   (la clé d'origine reste intacte) et le joueur est prévenu qu'il doit exporter ses fiches. */
const lu=relireBase(lireJson,cle=>lireBrut(stock(),cle).texte);
const copie=mettreDeCote(stock(),CLE_FICHES,lu.ecartes);
const verrou=!copie;
let armed=false,DB=lu.base,S=DB.persos[DB.actif];
/* Change de personnage en remettant à zéro l'état d'interface (feuilles, pavé, objet ouvert…) */
function setActive(id,tab){const t=tab||S.tab;DB.actif=id;S=DB.persos[id];Object.assign(S,{tab:t},ETAT_INTERFACE);armed=false}
function addP(p,tab){const id=uid();DB.persos[id]=p;setActive(id,tab)}
const save=()=>{DB.persos[DB.actif]=S;if(verrou)return;try{localStorage.setItem(CLE_FICHES,JSON.stringify(DB))}catch(e){}};
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const m15=n=>String(n).replace('.',',');
const hhmm=t=>new Date(t).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
let tt,undo=null,shownSheet=null;
/* Toast court ; avec act (libellé du bouton), il reste plus longtemps et porte un bouton data-a="undo" */
function toast(m,act){const e=document.getElementById('toast');e.textContent=m;e.hidden=false;clearTimeout(tt);if(!act)undo=null;
 if(act){const b=document.createElement('button');b.dataset.a='undo';b.textContent=act;e.appendChild(b)}
 tt=setTimeout(()=>{e.hidden=true;undo=null},act?7000:2200)}

/* L'avis du haut de page (fiche.html #avis) : reste affiché jusqu'au clic sur « Compris » */
function avertir(n,ok){const e=document.getElementById('avis'),au=n>1?'Certaines':'Une';
 e.textContent=ok?`${au} de tes fiches enregistrées dans ce navigateur ${n>1?'n’ont':'n’a'} pas pu être relue${n>1?'s':''} (abîmée${n>1?'s':''}, ou écrite${n>1?'s':''} par une autre version). Rien n’est perdu : une copie est gardée à part, dans le Donjon : menu du donjon, « Copies mises de côté ».`
  :`${au} de tes fiches enregistrées dans ce navigateur ${n>1?'n’ont':'n’a'} pas pu être relue${n>1?'s':''}, et la copie de sécurité n’a pas pu être faite (plus de place, ou accès bloqué). Pour ne rien écraser, tes modifications ne seront pas enregistrées ici : exporte tes fiches.`;
 const b=document.createElement('button');b.dataset.a='avisok';b.textContent='Compris';e.appendChild(b);e.hidden=false}

/* ---------- Rendu ---------- */
function vHeader(){
 const C=S.mode==='combat',pct=Math.max(0,Math.min(100,S.hp/Math.max(1,hpMaxNow(S))*100)),ac=acTotal(S);
 return`<div class="idrow"><h1><button class="who" data-a="sheet" data-v="perso" aria-haspopup="dialog" aria-label="${esc((S.name||'Sans nom')+' : changer de personnage ou en créer un')}"><span>${esc(S.name||'Sans nom')}</span><i aria-hidden="true">${I('chevron-bas')}</i></button></h1><p>${esc([S.cls&&`${S.cls} niv. ${S.lvl}`,S.race,S.guild].filter(Boolean).join(' · '))}</p></div>
 <div class="vitals ${C?'':'two'}">
  <button class="hpbtn" data-a="sheet" data-v="hp" aria-label="Modifier les points de vie">
   <span class="n"><b>${S.hp}</b>/ ${hpMaxNow(S)} PV${S.tmp?` <em>+${S.tmp} temp</em>`:''}<small>± PV</small></span>
   <span class="bar"><i style="width:${pct}%"></i></span></button>
  <div class="vt ${ac>S.ac?'up':''}"><span class="lbl">CA</span><b>${ac}</b></div>
  ${C?`<div class="vt cb"><span class="lbl">Round</span><b>${S.round||'–'}</b></div>`:''}
 </div>`;
}
function vRbar(){
 const r=S.rolls[0];
 if(!r)return`<div class="in"><span class="rt muted">–</span><span class="muted">Le résultat de tes jets s'affiche ici.</span></div>`;
 let cls='',tag='';if(r.d20&&r.nat===20){cls='crit';tag='Critique'}else if(r.d20&&r.nat===1){cls='fumble';tag='Échec critique'}
 if(r.critDmg){cls='crit';tag='Critique'}
 document.getElementById('rbar').className='rbar '+cls;
 const ex=[];
 if(r.scope){S.fx.filter(f=>manualFx(f)&&f.sc.includes(r.scope)).forEach(f=>ex.push(`<button data-a="fxadd" data-id="${f.id}">${f.kind==='dieneg'?'−':'+'}${esc(f.val)} ${esc(f.n)}</button>`));
  if(r.d20)S.fx.filter(f=>f.kind==='reroll'&&f.sc.includes(r.scope)).forEach(f=>ex.push(`<button data-a="fxre" data-id="${f.id}">Relancer · ${esc(f.n)}</button>`))}
 return`<div class="in"><b class="rt">${r.tot}</b><button class="rtx" data-a="rbx" aria-label="Afficher le détail"><span class="rl">${esc(r.l)}${tag?`<i>${tag}</i>`:''}</span><span class="rd ${S.rbOpen?'open':''}">${esc(r.det)}</span></button>${ex.length?`<div class="ex">${ex.join('')}</div>`:''}</div>`;
}
function advSeg(){return`<div class="seg light" style="--n:3">${['Normal','Avantage','Désavant.'].map((l,i)=>`<button class="a${i} ${S.adv===i?'on':''}" data-a="adv" data-v="${i}">${l}</button>`).join('')}</div>`}
function fxShort(f){return f.dur==='rounds'?`${f.left} r`:f.dur==='once'?'1×':'∞'}
function fxSummary(f){
 const sc=f.sc.map(s=>SCOPES.find(x=>x[0]===s)[1].toLowerCase()).join(', ');
 const v={die:'+'+f.val,dieneg:'−'+f.val,flat:sg(+f.val||0),adv:'avantage',dis:'désavantage',reroll:'relance d\'un d20'}[f.kind];
 const d=f.dur==='rounds'?`${f.left} round${f.left>1?'s':''}`:f.dur==='once'?(manualFx(f)?'1 usage, à ajouter après le jet':'1 usage'):'jusqu\'à retrait';
 return`${v}${f.kind==='reroll'?'':' · '+sc} · ${d}`;
}

function vAlerts(){
 const out=[];
 if(S.example)out.push(`<div class="notice"><span>Personnage d'exemple. Crée le tien, ou modifie celui-ci dans l'onglet Fiche.</span><span class="row"><button class="btn" data-a="newp">Créer mon personnage</button><button class="btn" data-tab="fiche">Fiche</button></span></div>`);
 if(S.hp===0)out.push(`<section class="card alert danger"><h2>À terre, 0 PV <small>jets contre la mort</small></h2>
  <div class="lines"><div class="ln"><span class="t">Succès</span><div class="pips">${[0,1,2].map(i=>`<button class="pip s ${i<S.saves.s?'on':''}" data-a="ds" data-k="s" data-i="${i}" aria-label="Succès ${i+1}"></button>`).join('')}</div></div>
  <div class="ln"><span class="t">Échecs</span><div class="pips">${[0,1,2].map(i=>`<button class="pip f ${i<S.saves.f?'on':''}" data-a="ds" data-k="f" data-i="${i}" aria-label="Échec ${i+1}"></button>`).join('')}</div></div></div>
  <button class="red" data-a="dsroll">Jet contre la mort</button></section>`);
 if(S.concDD)out.push(`<section class="card alert"><h2>Concentration <small>sauvegarde CON DD ${S.concDD}</small></h2>
  <div class="grid3"><button class="btn" data-a="concroll">Lancer ${sg(svB(S,'CON'))}</button><button data-a="concok">Maintenue</button><button data-a="conclost">Perdue</button></div></section>`);
 if(S.pick&&S.mode==='explo'){const sp=S.ammo.filter(a=>a.spent);if(sp.length)out.push(`<section class="card alert"><h2>Après le combat</h2>
  ${sp.map(a=>{const i=S.ammo.indexOf(a);return`<button data-a="pick" data-i="${i}">Ramasser la moitié : +${Math.floor(a.spent/2)} ${esc(a.n.toLowerCase())}</button>`}).join('')}
  <button class="linkbtn" data-a="nopick">Ignorer</button></section>`)}
 return out.join('');
}
function vOnMe(){
 const p=[];
 S.conds.forEach(c=>p.push(`<button class="pill cond" data-a="sheet" data-v="add">${c}</button>`));
 if(S.conc)p.push(`<button class="pill conc" data-a="sheet" data-v="add">Concentration</button>`);
 if(S.exh)p.push(`<button class="pill cond" data-a="sheet" data-v="add">Épuisement ${S.exh}</button>`);
 S.fx.forEach(f=>p.push(`<button class="pill ${negFx(f)?'neg':'fx'}" data-a="sheet" data-v="add">${esc(f.n)} · ${fxShort(f)}</button>`));
 return`<div class="onme">${p.length?'':'<span class="muted">Rien sur toi.</span>'}${p.join('')}<button class="pill add" data-a="sheet" data-v="add">+ État / effet</button></div>`;
}
function vRes(){
 const rows=[];
 S.slots.forEach((s,l)=>{if(s.max)rows.push(`<div class="ln"><span class="t">Sorts niv. ${l+1}<small>${s.max-s.used}/${s.max}</small></span><div class="pips">${Array.from({length:s.max},(_,j)=>`<button class="pip sp ${j>=s.used?'on':''}" data-a="slot" data-l="${l}" data-j="${j}" aria-label="Emplacement niveau ${l+1}"></button>`).join('')}</div></div>`)});
 S.res.forEach((r,i)=>{if(r.max>0)rows.push(`<div class="ln"><span class="t">${esc(r.n)}<small>${r.max-r.used}/${r.max} · repos ${r.rest}</small></span><div class="pips">${Array.from({length:r.max},(_,j)=>`<button class="pip rs ${j>=r.used?'on':''}" data-a="res" data-i="${i}" data-j="${j}" aria-label="Charge ${j+1}"></button>`).join('')}</div></div>`)});
 S.inv.forEach((it,i)=>{if(!TYPES_OBJET[it.type]?.ressource)return;const left=it.type==='charges'?(+it.ch||0):it.q;
  const sub=[it.type==='soin'?`soin ${it.dice}`:'',it.type==='charges'?`${left}/${it.chMax||0} charges`:`× ${it.q}`,ACT_L[it.act||'action']].filter(Boolean).join(' · ');
  rows.push(`<div class="ln"><span class="t">${esc(it.n)}<small>${esc(sub)}</small></span><button class="${it.type==='soin'?'heal':''}" data-a="use" data-i="${i}" ${left>0?'':'disabled'}>Utiliser</button></div>`)});
 if(!rows.length)return'';
 return`<section class="card"><h2>Ressources <small>touche pour dépenser</small></h2><div class="lines">${rows.join('')}</div></section>`;
}
function vMine(){
 const T=S.turn,sp=speedNow(S),left=Math.max(0,sp-T.move);
 const b=(k,l,c='')=>`<button class="act ${c} ${T[k]?'spent':''}" data-a="tact" data-k="${k}" aria-pressed="${T[k]}">${l}</button>`;
 const atks=S.attacks.map((a,i)=>{const am=a.ammo?S.ammo.find(x=>x.n===a.ammo):null;
   return`<div class="atk"><div class="an"><b>${esc(a.n)}</b><small>${[am?`${am.q} ${am.n.toLowerCase()}`:'',a.note].filter(Boolean).map(esc).join(' · ')}</small></div>
   <button class="hit" data-a="atk" data-i="${i}" aria-label="Jet d'attaque ${esc(a.n)}">${sg(+a.hit||0)}</button>
   <button class="dmgb ${S.crit?'crit':''}" data-a="adm" data-i="${i}" aria-label="Dégâts ${esc(a.n)}">${esc(a.dmg)}${S.crit?' ×2':''}</button></div>`}).join('');
 const linked=S.ammo.filter(am=>S.attacks.some(a=>a.ammo===am.n));
 return`<section class="card focus">
  <div class="acts">${b('action','Action')}${b('bonus','Bonus')}${b('react','Réaction')}${b('obj','Objet')}${hasHaste(S)?b('haste','Hâte','haste'):''}</div>
  <div class="move"><div class="mv"><span class="lbl">Mouvement · ${m15(left)} / ${m15(sp)} m${T.dash?' · Foncer':''}</span><span class="bar"><i style="width:${sp?left/sp*100:0}%;background:var(--texte)"></i></span></div>
   <button data-a="mv" data-v="1.5" ${left>=1.5?'':'disabled'}>−1,5</button><button data-a="mv" data-v="-1.5" ${T.move>0?'':'disabled'}>+1,5</button><button data-a="dash" ${T.dash?'disabled':''}>Foncer</button></div>
 </section>
 <section class="card"><h2>Attaques <small>${S.crit?'critique : dégâts ×2':'toucher · dégâts'}</small></h2>
  ${advSeg()}
  <div>${atks||'<small class="muted">Ajoute tes armes dans l\'onglet Fiche.</small>'}</div>
  ${linked.map(am=>{const i=S.ammo.indexOf(am);return`<div class="spread"><span class="muted">${esc(am.n)}</span><div class="qty"><button data-a="aq" data-i="${i}" data-v="-1" aria-label="Retirer">${I('moins')}</button><b>${am.q}</b><button data-a="aq" data-i="${i}" data-v="1" aria-label="Ajouter">${I('plus')}</button></div></div>`}).join('')}
 </section>
 ${vRes()}
 <button class="btn btn-primaire big" data-a="endturn">Fin de mon tour</button>`;
}
function vWait(){
 return`<button class="red big" data-a="newturn">Début de mon tour</button>
 <section class="card">
  <div class="spread"><span><span class="lbl">Réaction</span><br><span class="muted">attaque d'opportunité, sort Bouclier…</span></span>
   <button class="act ${S.turn.react?'spent':''}" style="flex:0 0 auto;min-width:130px" data-a="tact" data-k="react">${S.turn.react?'Utilisée':'Disponible'}</button></div>
 </section>
 <section class="card"><h2>Sauvegardes</h2>
  ${advSeg()}
  <div class="tests">${STATS.map(s=>`<button class="${S.saveProf.includes(s)?'pr':''}" data-a="save" data-s="${s}"><span>${s}</span><b>${sg(svB(S,s))}</b></button>`).join('')}</div>
 </section>
 ${vRes()}`;
}
function vExplo(){
 const quickSk=[...new Set([...SKILLS.filter(([n])=>S.skills[n]).map(s=>s[0]),'Perception','Investigation','Intuition'])];
 return`<button class="red big" data-a="fight">Combat ! · initiative ${sg(S.init)}</button>
 <section class="card"><h2>Tests rapides <small><button class="linkbtn mini" data-tab="jets">Tous les jets</button></small></h2>
  <div class="sk">${quickSk.map(n=>`<button class="${S.skills[n]?'pr':''} ${S.skills[n]===2?'ex':''}" data-a="skill" data-n="${n}"><span>${n}</span><b>${sg(skB(S,n))}</b></button>`).join('')}</div>
 </section>
 ${vRes()}
 ${S.ammo.length?`<section class="card"><h2>Munitions</h2><div class="lines">${S.ammo.map((a,i)=>`<div class="ln"><span class="t">${esc(a.n)}${a.spent?`<small>${a.spent} tirée${a.spent>1?'s':''} · <button class="linkbtn mini" style="text-decoration:underline" data-a="pick" data-i="${i}">ramasser ½</button></small>`:''}</span>
   <div class="qty"><button data-a="aq" data-i="${i}" data-v="-1" aria-label="Retirer">${I('moins')}</button><b>${a.q}</b><button data-a="aq" data-i="${i}" data-v="1" aria-label="Ajouter">${I('plus')}</button></div></div>`).join('')}</div></section>`:''}
 <section class="card"><h2>Repos</h2>
  <div class="spread"><span><span class="lbl">Dés de vie</span><br><b style="font-size:1.2rem">${hdLeft(S)}/${S.lvl}</b> <span class="muted">d${S.hd.die} ${sg(mod(S.stats.CON))}</span></span>
   <button data-a="hd" ${hdLeft(S)&&S.hp<hpMaxNow(S)?'':'disabled'}>Dépenser 1 DV</button></div>
  <div class="grid2"><button data-a="short">Repos court</button><button data-a="long">Repos long</button></div>
 </section>`;
}
function vCombat(){
 const C=S.mode==='combat';
 return vAlerts()+(C?`<div class="phase"><div class="seg" style="--n:2"><button class="${S.phase==='mine'?'on':''}" data-a="phase" data-v="mine">Mon tour</button><button class="${S.phase!=='mine'?'on':''}" data-a="phase" data-v="wait">En attente</button></div>
  <button class="linkbtn" data-a="endfight">Fin du combat</button></div>`:'')
  +vOnMe()+(C?(S.phase==='mine'?vMine():vWait()):vExplo());
}

function vJets(){
 return `<section class="card">${advSeg()}<small class="muted">Le résultat s'affiche dans la barre en bas.</small></section>
 <section class="card"><h2>Compétences <small>● maîtrise · ◆ expertise</small></h2>
  <div class="sk">${SKILLS.map(([n,s])=>{const p=S.skills[n]||0;return`<button class="${p?'pr':''} ${p===2?'ex':''}" data-a="skill" data-n="${n}"><span>${n}<small>${s}</small></span><b>${sg(skB(S,n))}</b></button>`}).join('')}</div>
 </section>
 <section class="card"><h2>Sauvegardes</h2>
  <div class="tests">${STATS.map(s=>`<button class="${S.saveProf.includes(s)?'pr':''}" data-a="save" data-s="${s}"><span>${s}</span><b>${sg(svB(S,s))}</b></button>`).join('')}</div>
 </section>
 <section class="card"><h2>Caractéristiques</h2>
  <div class="tests">${STATS.map(s=>`<button data-a="chk" data-s="${s}"><span>${s}</span><b>${sg(mod(S.stats[s]))}</b></button>`).join('')}</div>
  <button data-a="ini">Initiative ${sg(S.init)}</button>
 </section>
 <section class="card"><h2>Dés libres</h2>
  <div class="grid2">
   <div class="field"><span class="lbl">Nombre de dés</span><div class="step"><button data-a="dc" data-v="-1" aria-label="Moins">${I('moins')}</button><b>${S.dc}</b><button data-a="dc" data-v="1" aria-label="Plus">${I('plus')}</button></div></div>
   <div class="field"><span class="lbl">Modificateur</span><div class="step"><button data-a="dm" data-v="-1" aria-label="Moins">${I('moins')}</button><b>${sg(S.dm)}</b><button data-a="dm" data-v="1" aria-label="Plus">${I('plus')}</button></div></div>
  </div>
  <div class="dice">${[4,6,8,10,12,100].map(d=>`<button data-a="roll" data-d="${d}">d${d}</button>`).join('')}<button class="d20" data-a="roll" data-d="20">d20</button></div>
 </section>
 <section class="card"><h2>Historique</h2><div class="hist">
  ${S.rolls.slice(0,20).map(r=>`<div><span>${hhmm(r.t)} · ${esc(r.l)} <small>(${esc(r.det)})</small></span><b>${r.tot}</b></div>`).join('')||'<span>Aucun jet.</span>'}
 </div></section>`;
}

function fld(label,f,v,type='text',extra=''){return`<label class="field"><span class="lbl">${label}</span><input id="f_${f.replace(/\./g,'_')}" data-f="${f}" type="${type}" ${type==='number'?'inputmode="numeric"':''} value="${esc(v)}" ${extra}></label>`}
function sel(label,f,v,opts){return`<label class="field"><span class="lbl">${label}</span><select id="f_${f.replace(/\./g,'_')}" data-f="${f}">${opts.map(([val,l])=>`<option value="${esc(val)}" ${String(val)===String(v)?'selected':''}>${esc(l)}</option>`).join('')}</select></label>`}
function plist(){return Object.entries(DB.persos).map(([id,p])=>`<button class="pc ${id===DB.actif?'on':''}" data-a="psw" data-id="${esc(id)}" aria-pressed="${id===DB.actif}"><b>${esc(p.name||'Sans nom')}</b><small>${esc((p.cls||'Sans classe')+' · niv. '+p.lvl)}</small></button>`).join('')}
function vFiche(){
 const ammoOpts=[['','Aucune'],...S.ammo.map(a=>[a.n,a.n])];
 return `<section class="card"><h2>Identité</h2>
  ${fld('Nom','name',S.name)}
  ${fld('Guilde','guild',S.guild||'')}
  <div class="grid2">${fld('Classe','cls',S.cls)}${fld('Race / espèce','race',S.race)}</div>
  <div class="grid2">${fld('Niveau','lvl',S.lvl,'number')}${fld('Bonus de maîtrise','prof',S.prof,'number')}</div>
  ${sel('Règles','edition',S.edition,Object.entries(EDITIONS).map(([e,r])=>[e,r.nom]))}
  <small class="muted">Elles changent l'épuisement, la potion de soins, l'Inspiration, la concentration et les dés de vie. Le tirage au hasard reste en 2014.</small>
 </section>
 <section class="card"><h2>Combat</h2>
  <div class="grid2">${fld('PV max','hpMax',S.hpMax,'number')}${fld('PV actuels','hp',S.hp,'number')}</div>
  <div class="grid2">${fld('CA de base','ac',S.ac,'number')}${fld('Initiative','init',S.init,'number')}</div>
  <div class="grid2">${fld('Vitesse (m)','speed',S.speed,'number')}${sel('Dé de vie','hd.die',S.hd.die,[6,8,10,12].map(d=>[d,'d'+d]))}</div>
  <small class="muted">CA de base sans bouclier ni sort : les objets équipés du sac et les effets actifs s'ajoutent tout seuls.</small>
 </section>
 <section class="card"><h2>Caractéristiques</h2>
  <div class="ab">${STATS.map(s=>`<label class="field"><span class="lbl">${s}</span><input id="f_st_${s}" data-f="stats.${s}" type="number" inputmode="numeric" value="${S.stats[s]}"><span class="m" id="m_${s}">${sg(mod(S.stats[s]))}</span></label>`).join('')}</div>
 </section>
 <section class="card"><h2>Maîtrises <small>touche pour changer</small></h2>
  <h3>Jets de sauvegarde</h3>
  <div class="prof" style="grid-template-columns:repeat(3,1fr)">${STATS.map(s=>{const on=S.saveProf.includes(s);return`<button class="${on?'p1':''}" data-a="psave" data-s="${s}">${s}<i>${on?'●':'○'}</i></button>`}).join('')}</div>
  <h3>Compétences <span class="muted">○ aucune · ● maîtrise · ◆ expertise</span></h3>
  <div class="prof">${SKILLS.map(([n])=>{const p=S.skills[n]||0;return`<button class="p${p}" data-a="pskill" data-n="${n}">${n}<i>${['○','●','◆'][p]}</i></button>`}).join('')}</div>
 </section>
 <section class="card"><h2>Attaques</h2>
  ${S.attacks.map((a,i)=>`<div class="edit">
   <div class="head"><input id="f_at_${i}_n" data-f="attacks.${i}.n" value="${esc(a.n)}" aria-label="Nom de l'arme"><button class="btn btn-icone btn-danger x" data-a="atdel" data-i="${i}" aria-label="Supprimer" title="Supprimer">${I('supprimer')}</button></div>
   <div class="grid3">${fld('Toucher','attacks.'+i+'.hit',a.hit,'number')}${fld('Dégâts','attacks.'+i+'.dmg',a.dmg,'text','placeholder="1d8+3"')}${sel('Munition','attacks.'+i+'.ammo',a.ammo,ammoOpts)}</div>
   ${fld('Note','attacks.'+i+'.note',a.note||'','text','placeholder="Portée, propriétés…"')}
  </div>`).join('')}
  <button data-a="atadd">Ajouter une attaque</button>
 </section>
 <section class="card"><h2>Munitions</h2>
  <div class="lines">${S.ammo.map((a,i)=>`<div class="ln"><span class="t">${esc(a.n)} <span class="muted">× ${a.q}</span></span><button class="btn btn-icone btn-danger x" data-a="adel" data-i="${i}" aria-label="Supprimer" title="Supprimer">${I('supprimer')}</button></div>`).join('')}</div>
  <div class="row"><input id="newAmmo" placeholder="Flèches, carreaux, billes…" aria-label="Nouvelle munition"><button data-a="aadd">Ajouter</button></div>
 </section>
 <section class="card"><h2>Capacités à charges</h2>
  ${S.res.map((r,i)=>`<div class="edit">
   <div class="head"><input id="f_rs_${i}_n" data-f="res.${i}.n" value="${esc(r.n)}" aria-label="Nom de la capacité"><button class="btn btn-icone btn-danger x" data-a="rsdel" data-i="${i}" aria-label="Supprimer" title="Supprimer">${I('supprimer')}</button></div>
   <div class="grid2">${fld('Charges','res.'+i+'.max',r.max,'number','min="0" max="20"')}${sel('Recharge','res.'+i+'.rest',r.rest,[['court','Repos court'],['long','Repos long']])}</div>
  </div>`).join('')}
  <button data-a="rsadd">Ajouter une capacité</button>
 </section>
 <section class="card"><h2>Emplacements de sorts <small>max par niveau</small></h2>
  <div class="slotsEdit">${S.slots.map((s,l)=>`<label class="field"><span class="lbl">N${l+1}</span><input id="f_sl_${l}" data-f="slots.${l}" type="number" inputmode="numeric" min="0" value="${s.max}"></label>`).join('')}</div>
 </section>
 <section class="card"><h2>Personnage</h2>
  <div class="plist">${plist()}</div>
  <div class="grid2"><button class="btn" data-a="newp">${I('plus')} Nouveau personnage</button><button class="btn" data-a="hasard">${I('de')} Au hasard</button></div>
  <button class="btn" data-a="demo">Ajouter l'exemple</button>
  <div class="grid2"><button class="btn" data-a="exp">${I('exporter')} Exporter</button><button class="btn" data-a="imp">${I('importer')} Importer</button></div>
  <div class="zone-danger">
  <button class="btn btn-danger ${armed?'armed':''}" data-a="pdel">${I('supprimer')} ${armed?`Confirmer : supprimer « ${esc(S.name||'Sans nom')} »`:'Supprimer ce personnage'}</button>
  ${armed?'<small class="confirm">Touche encore une fois pour confirmer. Tu pourras annuler quelques secondes.</small>':''}
  </div>
  <small class="muted">Les données restent sur cet appareil, dans ce navigateur. « Exporter » enregistre ce personnage dans un fichier.</small>
 </section>`;
}

function itemTag(it){
 const t=it.type||'objet';
 if(t==='soin')return`Soin ${it.dice||'?'} · ${ACT_L[it.act||'action']||'sans action'}`;
 if(t==='conso')return`Consommable${it.act&&it.act!=='none'?' · '+ACT_L[it.act]:''}`;
 if(t==='charges')return`${+it.ch||0}/${+it.chMax||0} charges · ${ACT_L[it.act||'action']||'sans action'}`;
 if(t==='equip')return it.eq?`Équipé · ${sg(+it.acb||0)} CA`:`Non équipé · ${sg(+it.acb||0)} CA`;
 return'';
}
function vSac(){
 const c=S.coins;
 return `<section class="card"><h2>Bourse</h2><div class="coins">
  ${[['pp','PP'],['po','PO'],['pa','PA'],['pc','PC']].map(([k,l])=>`<label class="field"><span class="lbl">${l}</span><input id="f_c_${k}" data-f="coins.${k}" type="number" inputmode="numeric" value="${c[k]}"></label>`).join('')}
 </div></section>
 <section class="card"><h2>Équipement <small>touche un objet pour régler son usage</small></h2>
  <div>${S.inv.map((it,i)=>{const t=it.type||'objet',open=S.openItem===i,tag=itemTag(it);return`<div class="item">
   <button class="nm" data-a="iopen" data-i="${i}" aria-expanded="${open}"><span>${esc(it.n)}</span>${tag?`<small class="${t==='equip'&&it.eq?'eq':''}">${esc(tag)}</small>`:''}</button>
   ${t==='equip'?`<button data-a="ieq" data-i="${i}">${it.eq?'Retirer':'Équiper'}</button>`:`<div class="qty"><button data-a="iq" data-i="${i}" data-v="-1" aria-label="Moins">${I('moins')}</button><b>${it.q}</b><button data-a="iq" data-i="${i}" data-v="1" aria-label="Plus">${I('plus')}</button></div>`}
   <button class="btn btn-icone btn-danger x" data-a="idel" data-i="${i}" aria-label="Supprimer" title="Supprimer">${I('supprimer')}</button>
   ${open?`<div class="edit">
    ${fld('Nom','inv.'+i+'.n',it.n)}
    <div class="grid2">${sel('Type','inv.'+i+'.type',t,ITYPES)}${TYPES_OBJET[t]?.sansCout?'<span></span>':sel('Coûte','inv.'+i+'.act',it.act||'action',IACTS)}</div>
    ${t==='soin'?fld('Dés de soin','inv.'+i+'.dice',it.dice||'2d4+2','text','placeholder="2d4+2"'):''}
    ${t==='charges'?`<div class="grid2">${fld('Charges restantes','inv.'+i+'.ch',it.ch||0,'number')}${fld('Charges max','inv.'+i+'.chMax',it.chMax||0,'number')}</div>`:''}
    ${t==='equip'?fld('Bonus de CA','inv.'+i+'.acb',it.acb||0,'number'):''}
    <small class="muted">Soins, consommables et objets à charges apparaissent dans « Ressources » sur l'écran Jeu.</small>
   </div>`:''}
  </div>`}).join('')||'<small class="muted">Sac vide.</small>'}</div>
  <div class="row"><input id="newItem" placeholder="Nouvel objet" aria-label="Nouvel objet"><button data-a="iadd">Ajouter</button></div>
 </section>`;
}

function vJournal(){
 return `<section class="card"><h2>Noter</h2>
  <div class="chips">${KINDS.map(k=>`<button class="chip ${S.jk===k?'on':''}" data-a="jk" data-n="${k}">${k}</button>`).join('')}</div>
  <textarea id="jtxt" placeholder="Une idée, un nom de PNJ, un indice…">${esc(S.draft)}</textarea>
  <button class="btn btn-primaire" data-a="jadd">Ajouter au journal</button>
 </section>
 <section class="card"><h2>Journal <small>${S.log.length} entrée${S.log.length>1?'s':''}</small></h2>
  ${S.log.map((e,i)=>`<article class="entry" data-k="${esc(e.k)}"><div class="eh"><span><b>${esc(e.k)}</b> · ${hhmm(e.t)}</span><button class="btn btn-icone btn-danger x" data-a="jdel" data-i="${i}" aria-label="Supprimer" title="Supprimer">${I('supprimer')}</button></div><p>${esc(e.x)}</p></article>`).join('')||'<small class="muted">Rien pour l\'instant.</small>'}
 </section>`;
}

/* Feuilles : pavé PV et « Sur moi » */
function vSheetHp(){
 const v=S.pad;
 return`<h2>Points de vie <button class="btn btn-icone btn-discret x" data-a="close" aria-label="Fermer" title="Fermer">${I('fermer')}</button></h2>
 <div class="muted" style="text-align:center">${S.hp} / ${hpMaxNow(S)} PV${S.tmp?` · ${S.tmp} temporaires`:''}</div>
 <div class="padv ${v?'':'ph'}">${v||'0'}</div>
 <div class="keys">${[1,2,3,4,5,6,7,8,9].map(n=>`<button data-a="key" data-v="${n}">${n}</button>`).join('')}<button data-a="key" data-v="c" aria-label="Effacer tout">C</button><button data-a="key" data-v="0">0</button><button data-a="key" data-v="b" aria-label="Effacer un chiffre">${I('retour')}</button></div>
 <div class="padact"><button class="red" data-a="padgo" data-v="dmg">Dégâts</button><button class="heal" data-a="padgo" data-v="heal">Soins</button><button data-a="padgo" data-v="tmp">Temp</button></div>`;
}
/* Personnage au hasard (js/fiche-hasard.js, le même que dans le Donjon) : chargé à la demande, le reste de la page n'en dépend pas. */
let H=null,dernierTirage=null;const tirage={ouvert:false,classe:'',race:'',niveau:'1',graine:'',msg:''};
function vTirage(){if(!tirage.ouvert||!H)return'';
 const opts=(table,v)=>`<option value="">Au hasard</option>${Object.entries(table).map(([k,o])=>`<option value="${esc(k)}" ${k===v?'selected':''}>${esc(o.nom)}</option>`).join('')}`;
 return`<div class="edit">
  <div class="grid2"><label class="field"><span class="lbl">Classe</span><select id="tg_classe">${opts(H.CLASSES,tirage.classe)}</select></label>
  <label class="field"><span class="lbl">Race / espèce</span><select id="tg_race">${opts(H.RACES,tirage.race)}</select></label></div>
  <div class="grid2"><label class="field"><span class="lbl">Niveau</span><input id="tg_niveau" type="number" inputmode="numeric" min="${H.BORNES.niveau[1]}" max="${H.BORNES.niveau[2]}" value="${esc(tirage.niveau)}"></label>
  <label class="field"><span class="lbl">Numéro de tirage</span><input id="tg_graine" type="number" inputmode="numeric" min="1" max="${H.GRAINE_MAX}" placeholder="Vide : un nouveau" value="${esc(tirage.graine)}"></label></div>
  <small class="muted">Tirage aux règles de D&amp;D 2014.</small>
  <button class="btn" data-a="tgo">Générer</button>
  ${tirage.msg?`<small class="muted" role="status">${esc(tirage.msg)}</small>`:''}
 </div>`}
function vSheetPerso(){
 return`<h2>Personnages <button class="btn btn-icone btn-discret x" data-a="close" aria-label="Fermer" title="Fermer">${I('fermer')}</button></h2>
 <div class="plist">${plist()}</div>
 <button class="btn btn-primaire" data-a="newp">${I('plus')} Nouveau personnage</button>
 <button class="btn" data-a="hasard" aria-expanded="${tirage.ouvert}">${I('de')} Au hasard</button>
 ${vTirage()}
 <button class="btn" data-a="imp">${I('importer')} Importer un fichier</button>
 <small class="muted">Exporter et supprimer : onglet Fiche, tout en bas.</small>`;
}
function vSheetAdd(){
 const D=S.fxD;
 return`<h2>Sur moi <button class="btn btn-icone btn-discret x" data-a="close" aria-label="Fermer" title="Fermer">${I('fermer')}</button></h2>
 ${S.fx.length?`<span class="lbl">Effets actifs</span>${S.fx.map(f=>`<div class="fx ${negFx(f)?'neg':''}"><b>${esc(f.n)}${f.src?` <span class="muted">· ${esc(f.src)}</span>`:''}</b>
   <button class="btn btn-icone btn-danger x" data-a="fxdel" data-id="${f.id}" aria-label="Retirer ${esc(f.n)}" title="Retirer">${I('supprimer')}</button><small>${esc(fxSummary(f))}${f.note?' · '+esc(f.note):''}</small></div>`).join('')}`:''}
 <span class="lbl">Ajouter un effet</span>
 <input id="fx_src" data-f="fxSrc" value="${esc(S.fxSrc)}" placeholder="De la part de (facultatif)" aria-label="De la part de">
 <div class="presets">${PRESETS.map((p,i)=>presetDispo(p,S.edition)?`<button class="${['dieneg','dis'].includes(p.kind)?'neg':''}" data-a="fxpre" data-i="${i}">${p.n}</button>`:'').join('')}
  <button data-a="custom" aria-expanded="${S.showCustom}">${I(S.showCustom?'moins':'plus')} Personnalisé</button></div>
 ${S.showCustom?`<div class="edit">
  <input id="fx_n" data-f="fxD.n" value="${esc(D.n)}" placeholder="Nom de l'effet" aria-label="Nom de l'effet">
  <div class="chips">${SCOPES.map(([k,l])=>`<button class="chip ${D.sc.includes(k)?'on':''}" data-a="fxsc" data-k="${k}">${l}</button>`).join('')}</div>
  <div class="grid2">${sel('Type','fxD.kind',D.kind,KINDS_FX)}${['adv','dis','reroll'].includes(D.kind)?'<span></span>':fld(D.kind==='flat'?'Valeur':'Dé','fxD.val',D.val,'text',D.kind==='flat'?'placeholder="2 ou -2"':'placeholder="1d4"')}</div>
  <div class="grid2">${sel('Durée','fxD.dur',D.dur,[['rounds','En rounds'],['once','Un seul usage'],['conc','Jusqu\'à retrait']])}${D.dur==='rounds'?fld('Rounds','fxD.left',D.left,'number','min="1"'):'<span></span>'}</div>
  <button class="btn" data-a="fxcustom">Ajouter cet effet</button>
 </div>`:''}
 <span class="lbl">États</span>
 <div class="chips">${CONDS.map(c=>`<button class="chip ${S.conds.includes(c)?'on':''}" data-a="cond" data-n="${c}">${c}</button>`).join('')}
  <button class="chip ${S.conc?'on':''}" data-a="conc">Concentration</button></div>
 <div class="spread"><span><span class="lbl">Épuisement</span><br><small class="muted">${reglesDe(S.edition).epuisement?(S.exh?effetsEpuisement(S.exh,S.edition).join(' · '):'Les effets s’ajoutent à chaque niveau'):'Aucun effet automatique'}</small></span>
  <div class="step"><button data-a="exh" data-v="-1" aria-label="Moins">${I('moins')}</button><b>${S.exh}</b><button data-a="exh" data-v="1" aria-label="Plus">${I('plus')}</button></div></div>
 <small class="muted">${reglesDe(S.edition).auto?'Les états à avantage ou désavantage (Empoisonné, À terre, Invisible…) s\'appliquent tout seuls à tes jets.':'Règles libres : les états servent de pense-bête et ne changent aucun jet.'}</small>
 <button class="btn btn-primaire" data-a="close">Terminé</button>`;
}

function render(){
 document.getElementById('hdr').innerHTML=vHeader();
 const v={combat:vCombat,jets:vJets,fiche:vFiche,sac:vSac,journal:vJournal}[S.tab]||vCombat;
 const y=window.scrollY;
 document.getElementById('view').innerHTML=v();
 window.scrollTo(0,y);
 const rb=document.getElementById('rbar');rb.className='rbar';rb.innerHTML=vRbar();
 const sr=document.getElementById('sheetRoot');
 if(S.sheet){const prev=sr.querySelector('.sheet');const sy=prev?prev.scrollTop:0;
  sr.innerHTML=`<div class="scrim" data-a="close"></div><div class="sheet" role="dialog" aria-modal="true"><div class="in">${S.sheet==='hp'?vSheetHp():S.sheet==='perso'?vSheetPerso():vSheetAdd()}</div></div>`;
  sr.querySelector('.sheet').scrollTop=sy;document.body.style.overflow='hidden'}
 else{sr.innerHTML='';document.body.style.overflow=''}
 document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===S.tab));
 /* Focus : dans la liste à l'ouverture, de retour sur le nom à la fermeture */
 if(S.sheet==='perso'&&shownSheet!=='perso')sr.querySelector('.pc.on')?.focus({preventScroll:true});
 else if(shownSheet==='perso'&&!S.sheet)document.querySelector('.who')?.focus({preventScroll:true});
 shownSheet=S.sheet;
 save();
}


document.addEventListener('click',e=>{
 const t=e.target.closest('[data-a],[data-tab]');if(!t)return;
 if(t.dataset.tab){S.tab=t.dataset.tab;S.sheet=null;armed=false;render();window.scrollTo(0,0);return}
 const a=t.dataset.a;
 if(a==='avisok'){document.getElementById('avis').hidden=true;return}
 const i=+t.dataset.i,v=+t.dataset.v,id=t.dataset.id;
 if(a!=='pdel')armed=false;
 switch(a){
  case 'sheet':S.sheet=t.dataset.v;S.pad='';break;
  case 'close':S.sheet=null;break;
  case 'key':{const k=t.dataset.v;if(k==='c')S.pad='';else if(k==='b')S.pad=S.pad.slice(0,-1);else if(S.pad.length<3)S.pad=(S.pad+k).replace(/^0+/,'');break}
  case 'padgo':{const n=parseInt(S.pad,10)||0,k=t.dataset.v;if(!n&&k!=='tmp')return toast('Tape une valeur');
   if(k==='dmg'){const m=damage(S,n);if(m)toast(m);toast(`−${n} PV`)}else if(k==='heal'){heal(S,n);toast(`+${n} PV`)}else{if(!n){S.tmp=0;toast('PV temporaires retirés')}else{S.tmp=Math.max(S.tmp,n);toast(`${S.tmp} PV temporaires`)}}
   S.pad='';S.sheet=null;break}
  case 'rbx':S.rbOpen=!S.rbOpen;break;
  case 'phase':S.phase=t.dataset.v;window.scrollTo(0,0);break;
  case 'fight':{S.mode='combat';S.round=0;S.turn=freshTurn();S.phase='wait';S.pick=false;push(S,d20(S,S.init,'Initiative','chk'));window.scrollTo(0,0);break}
  case 'newturn':{const fin=startTurn(S);if(fin.length)toast(`Terminé : ${fin.map(f=>f.n).join(', ')}`);window.scrollTo(0,0);break}
  case 'endturn':S.phase='wait';S.crit=false;window.scrollTo(0,0);break;
  case 'endfight':{S.mode='explo';S.round=0;S.turn=freshTurn();S.crit=false;S.phase='wait';S.pick=S.ammo.some(x=>x.spent);note(S,'Note','Fin du combat');toast('Combat terminé');window.scrollTo(0,0);break}
  case 'nopick':S.pick=false;break;
  case 'tact':{const k=t.dataset.k;S.turn[k]=!S.turn[k];break}
  case 'mv':S.turn.move=Math.max(0,Math.min(speedNow(S),S.turn.move+v));break;
  case 'dash':S.turn.dash=true;spend(S,'action');break;
  case 'concroll':{const r=d20(S,svB(S,'CON'),`Concentration DD ${S.concDD}`,'save');push(S,r);
   if(r.tot>=S.concDD)toast('Concentration maintenue');else{S.conc=false;toast('Concentration perdue')}S.concDD=0;break}
  case 'concok':S.concDD=0;break;
  case 'conclost':S.conc=false;S.concDD=0;break;
  case 'ds':{const k=t.dataset.k;S.saves[k]=i<S.saves[k]?i:i+1;if(S.saves.s===3)toast('Stabilisé');if(S.saves.f===3)toast('Trois échecs…');break}
  case 'dsroll':{const r=d20(S,0,'Sauvegarde contre la mort','save');push(S,r);const n=r.nat;
   if(n===20){S.hp=1;S.saves={s:0,f:0};toast('20 naturel : tu reviens à 1 PV')}
   else if(n===1){S.saves.f=Math.min(3,S.saves.f+2);toast('1 naturel : deux échecs')}
   else if(r.tot>=10){S.saves.s=Math.min(3,S.saves.s+1);toast(S.saves.s===3?'Stabilisé':'Succès')}
   else{S.saves.f=Math.min(3,S.saves.f+1);toast(S.saves.f===3?'Trois échecs…':'Échec')}break}
  case 'atk':{const at=S.attacks[i];
   if(at.ammo){const am=S.ammo.find(x=>x.n===at.ammo);if(am){if(!am.q)return toast(`Plus de ${am.n.toLowerCase()}`);am.q--;am.spent++}}
   const r=d20(S,+at.hit||0,at.n,'atk');push(S,r);S.crit=r.nat===20;if(!S.turn.action)spend(S,'action');break}
  case 'adm':{const at=S.attacks[i],x=rollExpr(at.dmg,S.crit);let tot=x.tot;const parts=[x.det];
   fxOf(S,'dmg').forEach(f=>{if(manualFx(f))return;const v=fxVal(f,S.crit);if(v===null)return;tot+=v;parts.push(`${sg(v)} ${f.n}`)});
   push(S,{t:Date.now(),l:`Dégâts ${at.n}`,tot:Math.max(0,tot),det:parts.join(' '),critDmg:S.crit,scope:'dmg'});S.crit=false;break}
  case 'fxadd':{const r=S.rolls[0],f=S.fx.find(x=>x.id===id);if(!r||!f)break;const v=fxVal(f,!!r.critDmg);r.tot+=v;r.m=(r.m||0)+v;r.det+=` ${sg(v)} ${f.n}`;dropFx(S,[id]);toast(`${f.n} : ${sg(v)}`);break}
  case 'fxre':{const r=S.rolls[0],f=S.fx.find(x=>x.id===id);if(!r||!f)break;const n=rnd(20);
   push(S,{t:Date.now(),l:`${r.l} (relance)`,tot:n+(r.m||0),det:`${n} ${sg(r.m||0)} · relance ${f.n}`,d20:true,nat:n,m:r.m,scope:r.scope});
   if(r.scope==='atk')S.crit=n===20;dropFx(S,[id]);break}
  case 'custom':S.showCustom=!S.showCustom;break;
  case 'fxpre':addFx(S,PRESETS[i]);toast(`${PRESETS[i].n} ajouté`);break;
  case 'fxsc':{const k=t.dataset.k,D=S.fxD;D.sc=D.sc.includes(k)?D.sc.filter(x=>x!==k):[...D.sc,k];break}
  case 'fxcustom':{const D=S.fxD;if(!D.n.trim())return toast('Donne un nom à l\'effet');if(!D.sc.length&&D.kind!=='reroll')return toast('Choisis sur quoi il joue');
   if(['die','dieneg'].includes(D.kind)&&!/d\d+/i.test(D.val))return toast('Indique un dé, par exemple 1d4');
   const fx={n:D.n.trim(),sc:D.kind==='reroll'&&!D.sc.length?['atk','save','chk']:D.sc,kind:D.kind,val:D.kind==='flat'?parseInt(D.val,10)||0:D.val,dur:D.dur,left:Math.max(1,+D.left||1)};
   addFx(S,fx);toast(`${fx.n} ajouté`);
   S.fxD={n:'',sc:['atk'],kind:'die',val:'1d4',dur:'rounds',left:10};S.showCustom=false;break}
  case 'fxdel':dropFx(S,[id]);break;
  case 'ini':push(S,d20(S,S.init,'Initiative','chk'));break;
  case 'use':{const it=S.inv[i];if(!it)break;const ac=it.act||'action';
   if(it.type==='charges'){if(!(+it.ch>0))return;it.ch=+it.ch-1}else{if(!(it.q>0))return;it.q--}
   if(it.type==='soin'){const x=rollExpr(it.dice||'2d4+2');const g=Math.max(0,x.tot);heal(S,g);push(S,{t:Date.now(),l:it.n,tot:g,det:`${x.det} PV rendus`})}
   else toast(`${it.n} utilisé`);
   spend(S,ac);note(S,'Butin',`Utilisé : ${it.n}`);break}
  case 'aq':{const am=S.ammo[i];if(v<0){if(!am.q)return toast('Plus de munitions');am.q--;am.spent++}else{am.q++;if(am.spent)am.spent--}break}
  case 'pick':{const am=S.ammo[i],g=Math.floor(am.spent/2);am.q+=g;am.spent=0;toast(`+${g} ${am.n.toLowerCase()} récupérée${g>1?'s':''}`);if(!S.ammo.some(x=>x.spent))S.pick=false;break}
  case 'adel':S.ammo.splice(i,1);break;
  case 'aadd':{const n=document.getElementById('newAmmo').value.trim();if(!n)return;S.ammo.push({n,q:20,spent:0});break}
  case 'slot':{const s=S.slots[+t.dataset.l],j=+t.dataset.j;s.used=j>=s.used?j+1:j;break}
  case 'res':{const r=S.res[i],j=+t.dataset.j;r.used=j>=r.used?j+1:j;break}
  case 'cond':{const n=t.dataset.n;S.conds=S.conds.includes(n)?S.conds.filter(c=>c!==n):[...S.conds,n];break}
  case 'conc':S.conc=!S.conc;if(!S.conc)S.concDD=0;break;
  case 'exh':S.exh=Math.max(0,Math.min(6,S.exh+v));S.hp=Math.min(S.hp,hpMaxNow(S));if(S.exh===6&&v>0&&reglesDe(S.edition).epuisement)toast('Épuisement 6 : le personnage meurt');break;
  case 'hd':{if(!hdLeft(S))return;const r=rnd(S.hd.die),c=mod(S.stats.CON),g=soinDV(S,r);S.hd.used++;heal(S,g);
   push(S,{t:Date.now(),l:'Dé de vie',tot:g,det:`${r} ${sg(c)} PV rendus`});break}
  case 'short':S.res.forEach(r=>{if(r.rest==='court')r.used=0});note(S,'Note','Repos court');toast('Repos court : capacités « court » rechargées');break;
  case 'long':if(reglesDe(S.edition).auto)S.exh=Math.max(0,S.exh-1);S.hp=hpMaxNow(S);S.tmp=0;S.saves={s:0,f:0};S.slots.forEach(s=>s.used=0);S.res.forEach(r=>r.used=0);
   S.hd.used=Math.max(0,S.hd.used-dvRendus(S));note(S,'Note','Repos long');toast('Repos long : PV, sorts et capacités restaurés');break;
  case 'skill':{const n=t.dataset.n;push(S,d20(S,skB(S,n),n,'chk'));break}
  case 'save':{const s=t.dataset.s;push(S,d20(S,svB(S,s),`Sauvegarde ${s}`,'save'));break}
  case 'chk':{const s=t.dataset.s;push(S,d20(S,mod(S.stats[s]),`Test ${s}`,'chk'));break}
  case 'psave':{const s=t.dataset.s;S.saveProf=S.saveProf.includes(s)?S.saveProf.filter(x=>x!==s):[...S.saveProf,s];S.example=false;break}
  case 'pskill':{const n=t.dataset.n;S.skills[n]=((S.skills[n]||0)+1)%3;S.example=false;break}
  case 'atadd':S.attacks.push({n:'Nouvelle arme',hit:S.prof+mod(S.stats.FOR),dmg:'1d6',ammo:'',note:''});S.example=false;break;
  case 'atdel':S.attacks.splice(i,1);break;
  case 'rsadd':S.res.push({n:'Nouvelle capacité',max:1,used:0,rest:'long'});S.example=false;break;
  case 'rsdel':S.res.splice(i,1);break;
  case 'psw':if(DB.persos[id])setActive(id);break;
  case 'newp':addP(blank(),'fiche');toast('Nouveau personnage');break;
  case 'demo':addP(sample(),'combat');toast('Exemple ajouté');window.scrollTo(0,0);break;
  case 'hasard':{const fermer=S.sheet==='perso'&&tirage.ouvert;
   if(!H){import('../fiche-hasard.js').then(m=>{H=m;tirage.ouvert=true;S.sheet='perso';render()}).catch(()=>toast('Tirage indisponible : cette page doit être ouverte depuis le site'));return}
   tirage.ouvert=!fermer;S.sheet='perso';break}
  case 'tgo':{Object.assign(tirage,{classe:document.getElementById('tg_classe').value,race:document.getElementById('tg_race').value,niveau:document.getElementById('tg_niveau').value,graine:document.getElementById('tg_graine').value});
   /* Un nouveau tirage remplace le précédent tant qu'on n'y a pas touché, plutôt que d'empiler les essais. */
   if(dernierTirage&&DB.persos[dernierTirage.id]&&snapP(DB.persos[dernierTirage.id])===dernierTirage.snap)delete DB.persos[dernierTirage.id];
   const r=H.genererFiches({nombre:1,niveau:tirage.niveau,classe:tirage.classe,race:tirage.race,graine:tirage.graine});
   addP(complete(r.fiches[0]),'fiche');S.sheet='perso';dernierTirage={id:DB.actif,snap:snapP(S)};
   tirage.msg=`Tirage ${r.graine} : ${H.decrireTirage(r.resume[0])}. Tu peux tout retoucher ; un nouveau tirage remplace celui-ci tant que tu n'y touches pas.`;break}
  case 'pdel':{if(!armed){armed=true;break}armed=false;
   const gone=DB.actif,u={id:gone,p:DB.persos[gone],order:Object.keys(DB.persos),auto:null,snap:''};
   delete DB.persos[gone];const ids=Object.keys(DB.persos);
   if(ids.length)setActive(ids[0]);else{addP(blank(),'fiche');u.auto=DB.actif;u.snap=snapP(S)}
   toast(`« ${u.p.name||'Sans nom'} » supprimé`,'Annuler');undo=u;break}
  case 'undo':{const u=undo;if(!u)break;
   if(u.auto&&DB.persos[u.auto]&&snapP(DB.persos[u.auto])===u.snap)delete DB.persos[u.auto];
   const back={};u.order.forEach(k=>{if(k===u.id)back[k]=u.p;else if(DB.persos[k])back[k]=DB.persos[k]});
   for(const k in DB.persos)if(!(k in back))back[k]=DB.persos[k];
   DB.persos=back;setActive(u.id,S.tab);toast('Personnage restauré');break}
  case 'exp':{const n=(S.name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'').toLowerCase()||'personnage';
   const u=URL.createObjectURL(new Blob([JSON.stringify({format:FORMAT_FICHE,version:VERSION_FICHE,personnage:S},null,1)],{type:'application/json'}));
   const l=document.createElement('a');l.href=u;l.download=n+'.json';document.body.appendChild(l);l.click();l.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);toast('Fichier exporté');return}
  case 'imp':document.getElementById('impf').click();return;
  case 'iopen':S.openItem=S.openItem===i?-1:i;break;
  case 'ieq':S.inv[i].eq=!S.inv[i].eq;break;
  case 'iq':S.inv[i].q=Math.max(0,S.inv[i].q+v);break;
  case 'idel':S.inv.splice(i,1);S.openItem=-1;break;
  case 'iadd':{const n=document.getElementById('newItem').value.trim();if(!n)return;S.inv.push({n,q:1,type:'objet'});break}
  case 'jk':S.jk=t.dataset.n;break;
  case 'jadd':{const x=(document.getElementById('jtxt').value||'').trim();if(!x)return toast('Écris quelque chose');note(S,S.jk,x);S.draft='';break}
  case 'jdel':S.log.splice(i,1);break;
  case 'adv':S.adv=v;break;
  case 'dc':S.dc=Math.max(1,Math.min(20,S.dc+v));break;
  case 'dm':S.dm=Math.max(-20,Math.min(30,S.dm+v));break;
  case 'roll':{const d=+t.dataset.d;
   if(d===20&&S.dc===1)push(S,d20(S,S.dm,`d20${S.dm?sg(S.dm):''}`));
   else{const rs=Array.from({length:S.dc},()=>rnd(d));const sum=rs.reduce((x,y)=>x+y,0);
    push(S,{t:Date.now(),l:`${S.dc}d${d}${S.dm?sg(S.dm):''}`,tot:sum+S.dm,det:rs.join(' + ')+(S.dm?` ${sg(S.dm)}`:'')})}
   break}
  default:return;
 }
 render();
 if(a==='newp'){window.scrollTo(0,0);const n=document.getElementById('f_name');if(n){n.focus({preventScroll:true});n.select()}}
});
document.getElementById('impf').addEventListener('change',async e=>{
 const f=e.target.files[0];e.target.value='';if(!f)return;
 try{if(f.size>2e6)return toast('Fichier trop gros pour une fiche');
  const j=JSON.parse(await f.text()),env=!!j&&j.format===FORMAT_FICHE;
  if(env&&j.version>VERSION_FICHE)return toast('Fichier d\'une version plus récente de la fiche');
  const p=env?j.personnage:j;
  if(!p||typeof p!=='object'||!p.stats||typeof p.stats!=='object')return toast('Fichier invalide : ce n\'est pas une fiche de personnage');
  addP(complete(p),S.tab);render();toast(`${p.name||'Personnage'} importé`)}
 catch(err){toast('Fichier illisible ou invalide, rien n\'a été changé')}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&S.sheet){S.sheet=null;render()}});
document.addEventListener('input',e=>{
 if(e.target.id==='jtxt'){S.draft=e.target.value;save()}
 const f=e.target.dataset.f;
 if(f==='fxSrc'){S.fxSrc=e.target.value;save()}
 if(f==='fxD.n'||f==='fxD.val'){S.fxD[f.split('.')[1]]=e.target.value;save()}
});
document.addEventListener('change',e=>{
 const f=e.target.dataset.f;if(!f)return;
 const raw=e.target.value,num=parseInt(raw,10)||0,p=f.split('.'),k=p[0];
 if(k==='fxSrc'){S.fxSrc=raw;save();return}
 if(k==='fxD'){if(p[1]==='left')S.fxD.left=Math.max(1,num);else S.fxD[p[1]]=raw;
  if(p[1]==='kind'){S.fxD.val=raw==='flat'?'2':'1d4'}
  if(p[1]==='kind'||p[1]==='dur')render();else save();return}
 if(k==='inv'){const it=S.inv[+p[1]];if(!it)return;const fk=p[2];
  if(['ch','chMax','acb'].includes(fk))it[fk]=num;else it[fk]=raw.trim();
  if(fk==='type'){if(raw==='soin'&&!it.dice){it.dice='2d4+2';it.act=it.act||reglesDe(S.edition).potion||'action'}if(raw==='charges'&&!it.chMax){it.chMax=3;it.ch=3}}
  render();return}
 if(k==='stats'){S.stats[p[1]]=num;const m=document.getElementById('m_'+p[1]);if(m)m.textContent=sg(mod(num))}
 else if(k==='edition')changerEdition(S,raw);
 else if(k==='coins')S.coins[p[1]]=Math.max(0,num);
 else if(k==='slots'){const s=S.slots[+p[1]];s.max=Math.max(0,Math.min(9,num));s.used=Math.min(s.used,s.max)}
 else if(k==='hd')S.hd.die=num||8;
 else if(k==='attacks'){const at=S.attacks[+p[1]];at[p[2]]=p[2]==='hit'?num:raw.trim()}
 else if(k==='res'){const r=S.res[+p[1]];if(p[2]==='max'){r.max=Math.max(0,Math.min(20,num));r.used=Math.min(r.used,r.max)}else r[p[2]]=raw.trim()}
 else if(k==='lvl'){
  /* Niveau vide ou illisible : on garde l'ancien. Le bonus suit seulement s'il valait celui de l'ancien niveau. */
  if(!/^\s*-?\d/.test(raw)){e.target.value=S.lvl;return}
  const old=S.lvl,n=Math.max(1,Math.min(20,num));S.lvl=n;e.target.value=n;S.hd.used=Math.min(S.hd.used,n);
  if(S.prof===profFor(old)&&profFor(n)!==S.prof){S.prof=profFor(n);const pf=document.getElementById('f_prof');if(pf)pf.value=S.prof;toast(`Bonus de maîtrise : +${S.prof}`)}}
 else if(['name','cls','race','guild'].includes(k))S[k]=raw.trim();
 else S[k]=num;
 if(k==='hpMax')S.hpMax=Math.max(1,S.hpMax);
 S.hp=Math.max(0,Math.min(S.hp,hpMaxNow(S)));
 S.example=false;
 document.getElementById('hdr').innerHTML=vHeader();save();
});
render();
/* Dit après le premier rendu, dans un avis qui reste jusqu'à ce qu'on le ferme : un toast de deux secondes passerait inaperçu pour une fiche qui ne se relit pas */
if(lu.ecartes.length)avertir(lu.ecartes.length,copie);
