/* Basketball trajectory in metres; question progress is controlled by the trusted host. */
(function(root){'use strict';const clamp=x=>Math.max(0,Math.min(1,x)),G=9.81,R=.12,T=1.18;
function flight(start,end,progress,miss=false){const u=clamp(progress),t=u*T,v=(end[1]-start[1]+.5*G*T*T)/T;const k=clamp((u-.5)*2),drift=miss?.22*k*k*(3-2*k):0;return [start[0]+(end[0]-start[0])*u+drift,start[1]+v*t-.5*G*t*t,start[2]+(end[2]-start[2])*u];}
function rebound(start,velocity,time){let t=Math.max(0,time),p=start.slice(),v=velocity.slice();for(let n=0;n<12;n++){const hit=(v[1]+Math.sqrt(v[1]*v[1]+2*G*Math.max(0,p[1]-R)))/G;if(t<=hit){return [p[0]+v[0]*t,Math.max(R,p[1]+v[1]*t-.5*G*t*t),p[2]+v[2]*t];}p=[p[0]+v[0]*hit,R,p[2]+v[2]*hit];t-=hit;v=[v[0]*.72,-(v[1]-G*hit)*.58,v[2]*.72];if(v[1]<.08)return p;}return p;}
function after(start,end,time,miss=false){const v=(end[1]-start[1]+.5*G*T*T)/T;return rebound([end[0]+(miss?.22:0),end[1],end[2]],miss?[1.3,1.7,1.6]:[(end[0]-start[0])/T,v-G*T,(end[2]-start[2])/T],time);}
function dribble(t){const phase=((t%.7)+.7)%.7/.7;return R+.88*4*(phase-.5)*(phase-.5);}
const api={flight,after,dribble,duration:T,radius:R};root.BasketballMotion=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
