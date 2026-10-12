import fs from 'node:fs';
import assert from 'node:assert/strict';
const source = fs.readFileSync(new URL('../worker/src/index.js', import.meta.url), 'utf8');
const module = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const worker = module.default;
globalThis.fetch = async () => new Response(JSON.stringify({valid:false}), {status:200});
let accessed = false;
const env = {DEVICE_CONFIG:{get(){accessed=true;},put(){accessed=true;}}};
for (const method of ['GET','PUT']) {
  const request = method === 'GET'
    ? new Request('https://example.com/api/device-config?deviceId=test&build=123',{headers:{Authorization:'Bearer test'}})
    : new Request('https://example.com/api/device-config',{method,headers:{Authorization:'Bearer test'},body:JSON.stringify({deviceId:'test',build:'123',config:{}})});
  assert.equal((await worker.fetch(request, env)).status,401);
}
assert.equal(accessed,false);
assert.equal((await worker.fetch(new Request('https://example.com/',{headers:{Origin:'https://other.example'}}),env)).status,403);
assert.equal((await worker.fetch(new Request('https://example.com/',{method:'OPTIONS',headers:{Origin:'https://tengppm024-lang.github.io'}}),env)).status,204);
console.log('PASS: rejected keys return 401 without KV access; CORS checks pass');
globalThis.fetch = async () => new Response(JSON.stringify({valid:true}), {status:200});
const values = new Map();
const kv={DEVICE_CONFIG:{async get(k){return values.has(k)?JSON.parse(values.get(k)):null;},async put(k,v){values.set(k,v);}}};
const config={aimSystem:true,noRecoil:false,target:'head',headshot:25};
const put=(c)=>new Request('https://example.com/api/device-config',{method:'PUT',headers:{Authorization:'Bearer test'},body:JSON.stringify({deviceId:'paired-device',build:'123',config:c})});
assert.equal((await worker.fetch(put({...config,headshot:'25'}),kv)).status,400);
assert.equal((await worker.fetch(put(config),kv)).status,200);
let response=await worker.fetch(new Request('https://example.com/api/device-config?deviceId=paired-device&build=123',{headers:{Authorization:'Bearer test'}}),kv);
assert.equal((await response.json()).config.aimSystem,true);
response=await worker.fetch(new Request('https://example.com/api/device-config?deviceId=another-device&build=123',{headers:{Authorization:'Bearer test'}}),kv);
assert.equal((await response.json()).config.aimSystem,false);
assert.equal((await worker.fetch(new Request('https://example.com/api/device-config?key=test&deviceId=paired-device'),kv)).status,400);
assert.equal((await worker.fetch(new Request('https://example.com/api/device-config'),{})).status,503);
console.log('PASS: config round trip, device isolation, type checks, header-only keys, missing KV');

const allOff = {aimSystem:false,silentAim:false,noRecoil:false,target:'neck',headshot:100};
assert.equal(module.controlMask(allOff),1<<16);
assert.equal(module.controlMask({...allOff,aimSystem:true}), (1<<16)|(1<<22));
assert.equal(module.controlMask({...allOff,noRecoil:true}), (1<<16)|(1<<18));
assert.equal(module.controlMask({...allOff,silentAim:true,target:'body',headshot:0}), (1<<15)|(2<<16)|(4<<19));
const token='a'.repeat(64);
const sha=async s=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))).toString('hex');
const storageKey='device:'+await sha('test:paired-device');
values.set('receiver:'+await sha(token),JSON.stringify({key:'test',deviceId:'paired-device',build:'123',storageKey}));
let poll=await worker.fetch(new Request('https://example.com/api/runtime-config',{headers:{Authorization:'Bearer '+token,'X-Dragonhex-Applied':String(module.controlMask(config))}}),kv);
assert.equal(poll.status,200);
assert.equal(await poll.text(),String(module.controlMask(config)));
let status=await worker.fetch(new Request('https://example.com/api/runtime-status?deviceId=paired-device&build=123',{headers:{Authorization:'Bearer test'}}),kv);
assert.equal((await status.json()).applied,true);
assert.equal((await worker.fetch(new Request('https://example.com/api/runtime-config',{headers:{Authorization:'Bearer '+'b'.repeat(64)}}),kv)).status,401);
globalThis.fetch=async()=>new Response(JSON.stringify({valid:false}),{status:200});
assert.equal((await worker.fetch(new Request('https://example.com/api/runtime-config',{headers:{Authorization:'Bearer '+token}}),kv)).status,401);
assert.equal((await worker.fetch(new Request('https://example.com/api/device-patch',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({deviceId:'paired-device',build:'123'})}),kv)).status,401);
console.log('PASS: original bitmask mappings, scoped receiver polling, device acknowledgement, invalid tokens and revoked keys');

globalThis.fetch=async()=>new Response(JSON.stringify({valid:true}),{status:200});
const instances=new Map();
const durableEnv={...kv,DEVICE_STATE:{idFromName:k=>k,get(k){
  if(!instances.has(k)){const storage=new Map();instances.set(k,new module.DeviceState({storage:{async get(x){return storage.get(x);},async put(x,v){storage.set(x,v);}}}));}
  return {fetch:(u,o)=>instances.get(k).fetch(new Request(u,o))};
}}};
assert.equal((await worker.fetch(put({...config,silentAim:true}),durableEnv)).status,200);
response=await worker.fetch(new Request('https://example.com/api/device-config?deviceId=paired-device&build=123',{headers:{Authorization:'Bearer test'}}),durableEnv);
assert.equal((await response.json()).config.silentAim,true);
response=await worker.fetch(new Request('https://example.com/api/device-config?deviceId=isolated&build=123',{headers:{Authorization:'Bearer test'}}),durableEnv);
assert.equal((await response.json()).config.silentAim,false);
poll=await worker.fetch(new Request('https://example.com/api/runtime-config',{headers:{Authorization:'Bearer '+token,'X-Dragonhex-Applied':String(module.controlMask({...config,silentAim:true}))}}),durableEnv);
assert.equal(await poll.text(),String(module.controlMask({...config,silentAim:true})));
status=await worker.fetch(new Request('https://example.com/api/runtime-status?deviceId=paired-device&build=123',{headers:{Authorization:'Bearer test'}}),durableEnv);
assert.equal((await status.json()).applied,true);
console.log('PASS: Durable Object config consistency, per-device isolation and acknowledgement round trip');
