import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const elements=new Map();
const element=id=>{if(!elements.has(id))elements.set(id,{hidden:id==='dashboard',value:'',textContent:'',disabled:false,classList:{toggle(){}},replaceChildren(){},append(){}});return elements.get(id);};
const timers=[];let expiry=new Date(Date.now()+60000).toISOString(),unauthorized=false;
const context={TextEncoder,URL,Date,AbortSignal,crypto,localStorage:{getItem:()=>null,setItem(){}},window:{location:{hash:''},DRAGON_HEX_CONFIG:{apiBase:'https://control.test',buildNumber:'22'}},document:{getElementById:element,querySelectorAll:()=>[],createElement:()=>({}),createTextNode:x=>x},setInterval:(fn,ms)=>timers.push({fn,ms}),setTimeout(){},fetch:async url=>{
 const path=new URL(url).pathname;
 if(path==='/api/auth')return new Response(JSON.stringify({ok:true,valid:true,expiresAt:expiry}));
 if(path==='/api/runtime-status' && unauthorized)return new Response(JSON.stringify({ok:false,message:'Key expired'}),{status:403});
 return new Response(JSON.stringify({ok:true,version:'1.2',config:{},online:false}));
}};
vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('../app.js',import.meta.url),'utf8'),context);
async function login(){element('key').value='KEY_A';await element('login-form').onsubmit({preventDefault(){}});assert.equal(element('dashboard').hidden,false);}
await login();expiry=new Date(Date.now()-1000).toISOString();vm.runInContext('state.expiresAt = '+JSON.stringify(expiry),context);
timers.find(t=>t.ms===1000).fn();assert.equal(element('dashboard').hidden,true);assert.equal(element('key').value,'');assert.equal(element('save').disabled,true);
expiry=new Date(Date.now()+60000).toISOString();await login();unauthorized=true;
await timers.find(t=>t.ms===5000).fn();assert.equal(element('dashboard').hidden,true);assert.equal(element('login-feedback').textContent,'Key expired');
console.log('PASS: web logs out at exact expiry timer and on API 403, clears key and disables controls');
