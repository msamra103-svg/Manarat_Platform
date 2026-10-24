const assert=require('node:assert/strict'),M=require('../games/basketball/motion.js');const s=[-.5,2.1,-.5],e=[0,3.05,-6.5];
assert.deepEqual(M.flight(s,e,0),s);M.flight(s,e,1).forEach((v,i)=>assert(Math.abs(v-e[i])<1e-8));
assert.deepEqual(M.flight(s,e,.5,true),M.flight(s,e,.5,false));
for(const miss of [false,true]){const finish=M.flight(s,e,1,miss),next=M.after(s,e,0,miss);finish.forEach((v,i)=>assert(Math.abs(v-next[i])<1e-8));for(let t=0;t<8;t+=.005)assert(M.after(s,e,t,miss)[1]>=M.radius-1e-8);}
const y=.5*M.duration,vy=(e[1]-s[1]+.5*9.81*M.duration**2)/M.duration;assert(Math.abs(M.flight(s,e,.5)[1]-(s[1]+vy*y-.5*9.81*y*y))<1e-8);
for(let t=0;t<5;t+=.01)assert(M.dribble(t)>=M.radius);console.log('PASS basketball gravity, question continuity, hoop contact, rebounds and floor collision');
