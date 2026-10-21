import assert from 'node:assert/strict';
import worker,{DeviceState} from '../worker/src/index.js';
import {FFPROXY_CONTROLS,normalizeFfproxy,validFfproxy,ffproxyPacket} from '../worker/src/ffproxy.js';

const values=new Map(),objects=new Map(),blocked=new Set();
globalThis.fetch=async(url,options)=>{
  assert.equal(url,'https://dhx.dragonhex.workers.dev/api/control-auth');
  const {key,build}=JSON.parse(options.body);assert.equal(build,'22');
  return new Response(JSON.stringify(key&&['KEY_A_VALID','KEY_B_VALID'].includes(key)&&!blocked.has(key)?{ok:true,valid:true,key,expiresAt:new Date(Date.now()+3600000).toISOString()}:{ok:false,valid:false,message:'Invalid or expired key'}),{status:key&&!blocked.has(key)&&['KEY_A_VALID','KEY_B_VALID'].includes(key)?200:401});
};
const env={DEVICE_CONFIG:{async get(k){return values.has(k)?JSON.parse(values.get(k)):null;},async put(k,v){values.set(k,v);}},DEVICE_STATE:{idFromName:k=>k,get(k){
  if(!objects.has(k)){
    const map=new Map();let queue=Promise.resolve();
    const tx={async get(k){return map.get(k);},async put(k,v){map.set(k,v);},async delete(k){map.delete(k);}};
    const storage={...tx,transaction(fn){const result=queue.then(()=>fn(tx));queue=result.catch(()=>{});return result;}};
    objects.set(k,new DeviceState({storage}));
  }
  return {fetch:(url,options)=>objects.get(k).fetch(new Request(url,options))};
}}};
const call=(path,headers={},method='GET',body)=>worker.fetch(new Request('https://control.test'+path,{method,headers,body:body?JSON.stringify(body):undefined}),env);
const verify=(key,device)=>call('/api/ff-menu/verify',{'X-FF-Key':key,'X-FF-HWID':device}).then(r=>r.json());
const poll=(token,device)=>call('/api/ff-menu/state',{'X-FF-Session':token,'X-FF-HWID':device}).then(r=>r.json());
const web=(path,key,method='GET',body)=>call(path,{Authorization:'Bearer '+key,Origin:'https://dragonhexplus.gt.tc'},method,body);

assert.equal(validFfproxy(normalizeFfproxy()),true);
assert.equal(validFfproxy({...normalizeFfproxy(),speedScale:151}),false);
assert.equal(validFfproxy({...normalizeFfproxy(),spoofText:'bad"name'}),false);
assert.equal((await verify('NOT_A_KEY','phone-111111')).ok,false);
assert.equal(values.size,0);
assert.equal((await verify('KEY_A_VALID','unknown')).ok,false);
const a=await verify('KEY_A_VALID','phone-111111'),b=await verify('KEY_B_VALID','phone-222222');
assert.equal(a.ok,true);assert.match(a.sessionToken,/^[a-f0-9]{48}$/);assert.match(a.menuSecret,/^[a-f0-9]{32}$/);
assert.notEqual(a.sessionToken,b.sessionToken);
const config={...normalizeFfproxy(),espBox:true,hideDamage:true,headRate:100,aimSilent:true,speedHack:true,speedScale:125,highJump:true,spoofName:true,spoofText:'DRAGON',espCustomColor:'#11ee22'};
assert.equal((await web('/api/device-config','KEY_A_VALID','PUT',{build:'22',deviceId:'browser-A',config})).status,200);
const packet=await poll(a.sessionToken,'phone-111111');
assert.equal(packet.licensed,true);assert.equal(packet.state,ffproxyPacket(config).state);assert.ok(packet.state<0);
assert.equal(packet.speedScale,125);assert.equal(packet.highJump,true);assert.equal(packet.spoofText,'DRAGON');
assert.equal((await poll(b.sessionToken,'phone-222222')).speedScale,100);
assert.equal((await poll(a.sessionToken,'phone-222222')).licensed,false);
assert.equal((await verify('KEY_A_VALID','phone-222222')).ok,false);
assert.equal((await poll(a.sessionToken,'phone-111111')).licensed,true);
const renewed=await verify('KEY_A_VALID','phone-111111');
assert.equal((await poll(a.sessionToken,'phone-111111')).licensed,false);
assert.equal((await poll(renewed.sessionToken,'phone-111111')).speedScale,125);
const catalog=await (await web('/api/feature-catalog?build=22','KEY_A_VALID')).json();
assert.equal(catalog.receiverVariant,'ffproxy');assert.equal(catalog.features.length,FFPROXY_CONTROLS.length);
const status=await (await web('/api/runtime-status?build=22','KEY_A_VALID')).json();
assert.equal(status.online,true);assert.equal(status.deliveryOnly,true);assert.equal(status.applied,false);assert.equal(status.upgradeRequired,false);
// V2 authenticates on the same key/device but exposes only its own controls.
const v2=await (await call('/api/ff-menu/verify',{'X-FF-Key':'KEY_A_VALID','X-FF-HWID':'phone-111111','User-Agent':'UnityPlayer/2018.4.12f1 DHX-V2'})).json();
assert.equal(v2.ok,true);
assert.equal((await poll(renewed.sessionToken,'phone-111111')).licensed,false);
const v2catalog=await (await web('/api/feature-catalog?build=22','KEY_A_VALID')).json();
assert.equal(v2catalog.features.length,56);
assert.ok(v2catalog.features.some(f=>f.id==='aimWeaponStats'));
assert.ok(!v2catalog.features.some(f=>['highJump','flyAura'].includes(f.id)));
const v2config=(await (await web('/api/device-config?build=22','KEY_A_VALID')).json()).config;
assert.equal(v2config.speedScale,125);v2config.aimWeaponStats=true;
assert.equal((await web('/api/device-config','KEY_A_VALID','PUT',{build:'22',config:v2config})).status,200);
const v2packet=await poll(v2.sessionToken,'phone-111111');
assert.equal(v2packet.aimWeaponStats,true);assert.equal(v2packet.highJump,undefined);assert.equal(v2packet.flyAura,undefined);
assert.equal((await poll(b.sessionToken,'phone-222222')).aimWeaponStats,undefined);
const videos=await (await call('/api/ff-menu/verify',{'X-FF-Key':'KEY_A_VALID','X-FF-HWID':'phone-111111','User-Agent':'UnityPlayer/2018.4.12f1 DHX-V2 DHX-VIDEOS'})).json();
assert.equal(videos.ok,true);assert.equal((await poll(v2.sessionToken,'phone-111111')).licensed,false);
const videosCatalog=await (await web('/api/feature-catalog?build=22','KEY_A_VALID')).json();
assert.equal(videosCatalog.features.length,59);
const videosConfig=(await (await web('/api/device-config?build=22','KEY_A_VALID')).json()).config;
assert.equal(videosConfig.aimWeaponStats,true);videosConfig.hitFly=true;videosConfig.noClip=true;videosConfig.grenadeThrowScale=250;
assert.equal((await web('/api/device-config','KEY_A_VALID','PUT',{build:'22',config:videosConfig})).status,200);
const videosPacket=await poll(videos.sessionToken,'phone-111111');assert.equal(videosPacket.hitFly,true);assert.equal(videosPacket.noClip,true);assert.equal(videosPacket.grenadeThrowScale,250);
assert.equal((await poll(b.sessionToken,'phone-222222')).hitFly,undefined);
assert.equal((await web('/api/device-config','KEY_A_VALID','PUT',{build:'22',config:{...videosConfig,grenadeThrowScale:301}})).status,400);
blocked.add('KEY_A_VALID');
assert.equal((await poll(renewed.sessionToken,'phone-111111')).licensed,false);
assert.equal((await poll(b.sessionToken,'phone-222222')).licensed,true);
assert.equal((await web('/api/device-config?build=22','KEY_A_VALID')).status,401);
assert.equal((await call('/api/runtime-config-v3',{'Authorization':'Bearer '+renewed.sessionToken})).status,401);
for(const value of Object.values(ffproxyPacket({...normalizeFfproxy(),hideDamage:true,aimKill:true,aimKillDamage:3,espColor:true,espThickness:7})))if(typeof value==='number')assert.ok(Number.isInteger(value)&&value>=-2147483648&&value<=2147483647);
console.log(`PASS: ${FFPROXY_CONTROLS.length} typed controls; signed native masks; DHX authentication; isolated keys; one game device per key; token renewal/revocation; revoked key rejected; truthful delivery status; native/web config round trip`);

