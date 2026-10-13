import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.ok(!html.includes('/keys'));assert.ok(!html.includes('สร้างคีย์'));
const elems=new Map();
const element=id=>{if(!elems.has(id))elems.set(id,{hidden:id==='dashboard',value:'',textContent:'',disabled:false,dataset:{},classList:{toggle(){}},replaceChildren(){}});return elems.get(id);};
const groups={'.feature-toggle':[], '[data-target]':[], '[data-headshot]':[], '[data-aim-target]':[]};
for(const [name,selector] of [['feature','.feature-toggle'],['target','[data-target]'],['headshot','[data-headshot]'],['aim-target','[data-aim-target]']]){
 const pattern=new RegExp(`data-${name}="([^"]+)"`,'g');
 for(const m of html.matchAll(pattern)){const e=element(name+':'+m[1]);e.dataset[name.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=m[1];groups[selector].push(e);}
}
assert.equal(groups['.feature-toggle'].length,11);assert.equal(groups['[data-target]'].length,3);assert.equal(groups['[data-aim-target]'].length,2);
let sent,expired=false;
const timers=[];const context={Date,URL,AbortSignal,crypto,localStorage:{getItem:()=>null,setItem(){}},window:{location:{hash:''},DRAGON_HEX_CONFIG:{apiBase:'https://test.local',buildNumber:'22'}},document:{getElementById:element,querySelectorAll:selector=>groups[selector] || (selector.includes('.feature-toggle,')?[...groups['.feature-toggle'],...groups['[data-target]'],...groups['[data-headshot]'],...groups['[data-aim-target]'],element('fov-radius')]:[]),createElement:()=>({}),createTextNode:v=>v},setInterval:(fn,ms)=>timers.push({fn,ms}),setTimeout(){},fetch:async(url,opt={})=>{
 const path=new URL(url).pathname;
 if(path==='/api/auth')return new Response(JSON.stringify({valid:true,expiresAt:new Date(Date.now()+(expired?-1000:90000000)).toISOString()}));
 if(opt.method==='PUT')sent=JSON.parse(opt.body).config;
 return new Response(JSON.stringify({ok:true,version:'2.0',config:{},online:false}));
}};
vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('../app.js',import.meta.url),'utf8'),context);
element('key').value='TEST_KEY';await element('login-form').onsubmit({preventDefault(){}});
assert.equal(element('dashboard').hidden,false);assert.equal(element('login-view').hidden,true);assert.equal(context.window.location.hash,'control');
assert.match(element('key-countdown').textContent,/วัน/);assert.match(element('key-expiry').textContent,/หมดอายุ/);
for(const control of groups['.feature-toggle']){control.checked=true;control.onchange();}
groups['[data-target]'].find(b=>b.dataset.target==='body').onclick();groups['[data-aim-target]'].find(b=>b.dataset.aimTarget==='neck').onclick();
groups['[data-headshot]'].find(b=>b.dataset.headshot==='75').onclick();element('fov-radius').value='31';element('fov-radius').oninput();
await element('save').onclick();assert.equal(sent.target,'body');assert.equal(sent.aimSystemTarget,'neck');assert.equal(sent.headshot,75);assert.equal(sent.fovRadius,400);
for(const control of groups['.feature-toggle'])assert.equal(sent[control.dataset.feature],true);
await element('reset-all').onclick();
for(const control of groups['.feature-toggle']){assert.equal(sent[control.dataset.feature],false);assert.equal(control.checked,false);}
assert.equal(sent.target,'head');assert.equal(sent.aimSystemTarget,'head');assert.equal(sent.headshot,0);assert.equal(sent.fovRadius,197);assert.equal(element('reset-all').disabled,false);
element('logout').onclick();assert.equal(element('reset-all').disabled,true);assert.equal(element('dashboard').hidden,true);assert.equal(context.window.location.hash,'login');assert.equal(element('key').value,'');
expired=true;element('key').value='EXPIRED';await element('login-form').onsubmit({preventDefault(){}});assert.equal(element('dashboard').hidden,true);assert.match(element('login-feedback').textContent,/หมดอายุ/);
console.log('PASS: 11 controls, independent targets, FOV slider and rates reach PUT payload; separated views; countdown; expired login rejected; no key-admin navigation');
