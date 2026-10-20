/* Deterministic contact paths, in metres. Shared by rendering and regression tests. */
(()=>{'use strict';const clamp=x=>Math.max(0,Math.min(1,x));
function arc(a,b,t,h=0){t=clamp(t);return a.map((v,i)=>v+(b[i]-v)*t+(i===1?4*h*t*(1-t):0));}
function volley(S){const side=S.aim==='left'?-1:S.aim==='right'?1:0,serve=[-2.7,2.5,-6],setter=[0,1.7,4.6],strike=[side*1.7,3.05,2.4],net=[side*1.9,3.35,0],dig=[side*2.4,.95,-4.9],home=[-side*2.2,.11,5.7],away=[side*2.8,.11,-6.9];let ball=serve,contact='ready',r=0;
if(S.phase==='runup'){r=clamp(S.elapsed/4.8);if(r<.4){ball=arc(serve,setter,r/.4,1.6);contact='pass';}else{ball=arc(setter,strike,(r-.4)/.6,1.8);contact='set';}}
if(S.phase==='flight'){ball=arc(strike,net,S.flight*2,.3);contact='spike';}
if(S.phase==='question'||S.pending){ball=net;contact='question';}
if(['resolve','outcome'].includes(S.phase)&&!S.pending){r=S.phase==='outcome'?1:clamp(S.elapsed/4);if(S.correct){if(r<.55)ball=arc(net,away,r/.55,.15);else{ball=arc(away,[away[0]+.3,.11,-8.7],(r-.55)/.45,.65);}contact=r<.55?'attack':'point';}else{if(r<.3){ball=arc(net,dig,r/.3,.12);contact='receive';}else{ball=arc(dig,home,(r-.3)/.7,4);contact='return';}}}
return {ball,contact,net,strike,setter,dig,home,away,progress:r,side};}
function fish(S){const side=S.aim==='left'?-1:S.aim==='right'?1:0,target=[side*2.1,-.48,-2.8],waiting=[target[0]-.95,-.48,target[2]+.08],cast=[target[0]-.95,.05,target[2]+.08],tip=[.05,2.7,1.1];let hook=[tip[0],tip[1]-.75,tip[2]],fish=[...target],bobber=[...hook],caught=false,escape=0,angle=0;
if(S.phase==='flight'){const t=clamp(S.flight*2);hook=arc([tip[0],tip[1]-.75,tip[2]],waiting,t,1.5);bobber=[hook[0],Math.max(.06,hook[1]+.45),hook[2]];}
if(S.phase==='question'||S.pending){hook=[...waiting];bobber=[...cast];}
if(['resolve','outcome'].includes(S.phase)&&!S.pending){const r=S.phase==='outcome'?1:clamp(S.elapsed/4.2);if(S.correct){if(r<.25){hook=arc(waiting,[target[0]-.47,target[1],target[2]],r/.25);fish=[...target];}else{const t=(r-.25)/.75;hook=arc([target[0]-.47,target[1],target[2]],[-.65,1.1,2.1],t,1.25);angle=Math.min(1,t*3)*Math.PI/2;fish=[hook[0]+.47*Math.cos(angle),hook[1]-.47*Math.sin(angle),hook[2]];caught=true;}bobber=[hook[0],Math.max(.06,hook[1]+.45),hook[2]];}else{hook=arc(waiting,[waiting[0],-.4,waiting[2]+1],r);escape=r;fish=arc(target,[target[0]+6,-.75,-9],r,.0);bobber=[hook[0],.06,hook[2]];}}
return {hook,fish,bobber,target,tip,caught,escape,angle};}
const api={volley,fish,arc};if(typeof module!=='undefined')module.exports=api;else window.ExperienceMotion=api;})();
