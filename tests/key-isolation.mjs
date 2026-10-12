import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../worker/src/index.js',import.meta.url),'utf8');
const mod=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const worker=mod.default,values=new Map(),objects=new Map(),rejected=new Set();
globalThis.fetch=async(url,options)=>{
  assert.equal(url,'https://dhx.dragonhex.workers.dev/api/control-auth');
  const body=JSON.parse(options.body);assert.equal(body.deviceId,undefined);
  return new Response(JSON.stringify(rejected.has(body.key)?{valid:false,message:'Key expired'}:{ok:true,valid:true,key:body.key,expiresAt:new Date(Date.now()+60000).toISOString()}),{status:rejected.has(body.key)?403:200});
};
const kv={async get(k){return values.has(k)?JSON.parse(values.get(k)):null;},async put(k,v){values.set(k,v);}};
const env={DEVICE_CONFIG:kv,DEVICE_STATE:{idFromName:k=>k,get(k){
  if(!objects.has(k)){
    const map=new Map();let queue=Promise.resolve();
    const tx={async get(x){return map.get(x);},async put(x,v){map.set(x,v);},async delete(x){map.delete(x);}};
    const storage={...tx,transaction(fn){const result=queue.then(()=>fn(tx));queue=result.catch(()=>{});return result;}};
    objects.set(k,new mod.DeviceState({storage}));
  }
  return {fetch:(u,o)=>objects.get(k).fetch(new Request(u,o))};
}}};
const sha=async s=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))).toString('hex');
const config={aimSystem:true,silentAim:true,noRecoil:true,target:'body',headshot:75};
const req=(path,key,method='GET',body)=>new Request('https://example.com'+path,{method,headers:{Authorization:'Bearer '+key,Origin:'https://tengppm024-lang.github.io'},body:body?JSON.stringify(body):undefined});
const put=(key,c,deviceId)=>worker.fetch(req('/api/device-config',key,'PUT',{config:c,build:'22',deviceId}),env);
const get=(key,deviceId)=>worker.fetch(req('/api/device-config?build=22&deviceId='+deviceId,key),env);
assert.equal((await put('KEY_A',config,'same-browser')).status,200);
assert.equal((await (await get('KEY_A','different-browser')).json()).config.aimSystem,true);
assert.equal((await (await get('KEY_B','same-browser')).json()).config.aimSystem,false);
const configB={...config,aimSystem:false,noRecoil:false};
assert.equal((await put('KEY_B',configB,'same-browser')).status,200);
assert.equal((await (await get('KEY_A','same-browser')).json()).config.noRecoil,true);
assert.equal((await put('KEY_A',{...config,headshot:'75'},'same-browser')).status,400);
console.log('PASS: different keys remain isolated with identical browser IDs; same key has one channel across browsers; strict validation');
const tokenA='a'.repeat(64),tokenB='b'.repeat(64),newToken='c'.repeat(64);
async function activate(key,token){const id='user:'+await sha(key);await kv.put('receiver:'+await sha(token),JSON.stringify({key,build:'22',storageKey:'untrusted-client-value'}));return env.DEVICE_STATE.get(id).fetch('https://state/activate',{method:'POST',body:JSON.stringify({tokenHash:await sha(token)})});}
async function poll(token,device='phone-one-123456',applied=mod.controlMask(config)){return worker.fetch(new Request('https://example.com/api/runtime-config',{headers:{Authorization:'Bearer '+token,'X-Dragonhex-Device':device,'X-Dragonhex-Applied':String(applied)}}),env);}
await activate('KEY_A',tokenA);await activate('KEY_B',tokenB);
assert.equal(await (await poll(tokenA)).text(),String(mod.controlMask(config)));
assert.equal(await (await poll(tokenB,'phone-two-123456')).text(),String(mod.controlMask(configB)));
assert.equal((await (await worker.fetch(req('/api/runtime-status?build=22&deviceId=other','KEY_A'),env)).json()).applied,true);
assert.equal((await poll(tokenA,'second-phone-123456')).status,409);
await activate('KEY_A',newToken);assert.equal((await poll(tokenA)).status,409);
const races=await Promise.all([poll(newToken,'race-phone-one-123456'),poll(newToken,'race-phone-two-123456')]);
assert.deepEqual(races.map(r=>r.status).sort(),[200,409]);
assert.equal((await poll('d'.repeat(64))).status,401);
rejected.add('KEY_A');
assert.equal((await get('KEY_A','same-browser')).status,403);
assert.equal((await put('KEY_A',config,'same-browser')).status,403);
assert.equal((await poll(newToken,'race-phone-one-123456')).status,403);
assert.equal((await get('KEY_B','same-browser')).status,200);
assert.equal((await worker.fetch(req('/api/device-patch','KEY_A','POST',{build:'22'}),env)).status,403);
assert.equal((await worker.fetch(new Request('https://example.com/',{headers:{Origin:'https://other.example'}}),env)).status,403);
console.log('PASS: server-derived key scope; atomic one-device claim; old token revoked on replacement; expired keys rejected without affecting other users');

if(process.env.DHX_RECEIVER_TEMPLATE){
  rejected.delete('KEY_A');
  const template=JSON.parse(fs.readFileSync(process.env.DHX_RECEIVER_TEMPLATE,'utf8'));
  await kv.put('receiver:template:v1',JSON.stringify(template));
  const response=await worker.fetch(req('/api/device-patch','KEY_A','POST',{build:'22',deviceId:'arbitrary-browser'}),env);
  assert.equal(response.status,200);
  const pkg=new Uint8Array(await response.arrayBuffer());
  const enc=pkg.slice(template.encryptedOffset,template.encryptedOffset+template.encryptedLength);
  const aes=await crypto.subtle.importKey('raw',Buffer.from(template.contentKey,'base64'),'AES-GCM',false,['decrypt']);
  const plain=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:enc.slice(0,12),additionalData:new TextEncoder().encode(template.aad)},aes,enc.slice(12)));
  const newToken=new TextDecoder().decode(plain.slice(template.tokenOffset,template.tokenOffset+64));
  assert.equal((await poll(newToken,'download-phone-123456')).status,200);
  assert.equal((await poll(tokenA)).status,409);
  assert.equal((await poll(tokenB,'phone-two-123456')).status,200);
  assert.equal((await poll(newToken,'other-copy-phone-123456')).status,409);
  console.log('PASS: full download → decrypt → registered token → isolated runtime; replacement affects only its own key');
}
