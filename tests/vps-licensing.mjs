import assert from 'node:assert/strict';
import worker,{DeviceState} from '../worker/src/index.js';
import {normalizeFfproxy} from '../worker/src/ffproxy.js';
import {VPS_LICENSE_ORIGIN} from '../worker/src/license-vps.js';

const records=new Map(['VPS-A','VPS-B','VPS-FAIL'].map(key=>[key,{key,active:true,expirySeconds:3600}]));
let licenseRequests=0;
const licenseFetch=async(url,options)=>{
  assert.equal(url,VPS_LICENSE_ORIGIN+'/api/auth');licenseRequests++;
  const {key,deviceId}=JSON.parse(options.body);assert.match(deviceId,/^phone-/);
  const record=records.get(key);
  if(!record||key==='VPS-FAIL')return Response.json({valid:false,message:'Invalid key'},{status:401});
  if(record.banned)return Response.json({valid:true,banned:true,message:'Banned'});
  if(record.expiresAt&&Date.parse(record.expiresAt)<=Date.now())return Response.json({valid:false,message:'Key expired'},{status:403});
  if(record.deviceId&&record.deviceId!==deviceId)return Response.json({valid:false,message:'Device mismatch'},{status:403});
  if(!record.deviceId){record.deviceId=deviceId;record.expiresAt=new Date(Date.now()+3600000).toISOString();}
  return Response.json({ok:true,valid:true,key,expiresAt:record.expiresAt});
};
globalThis.fetch=licenseFetch;
const values=new Map(),objects=new Map();
const env={LICENSE_ORIGIN:VPS_LICENSE_ORIGIN,DEVICE_CONFIG:{async get(k){return values.has(k)?JSON.parse(values.get(k)):null;},async put(k,v){values.set(k,v);}},DEVICE_STATE:{idFromName:k=>k,get(k){
  if(!objects.has(k)){
    const map=new Map();let queue=Promise.resolve();
    const tx={async get(k){return map.get(k);},async put(k,v){map.set(k,v);},async delete(k){map.delete(k);}};
    objects.set(k,new DeviceState({storage:{...tx,transaction(fn){const r=queue.then(()=>fn(tx));queue=r.catch(()=>{});return r;}}}));
  }
  return {fetch:(url,options)=>objects.get(k).fetch(new Request(url,options))};
}}};
const call=(path,headers={},method='GET',body)=>worker.fetch(new Request('https://control.test'+path,{headers,method,...(body?{body:JSON.stringify(body)}:{})}),env);
const verify=(key,phone)=>call('/api/ff-menu/verify',{'X-FF-Key':key,'X-FF-HWID':phone,'User-Agent':'DHX-V2'}).then(r=>r.json());
const web=(path,code,method='GET',body)=>call(path,{Authorization:'Bearer '+code,Origin:'https://dragonhexplus.gt.tc'},method,body);
const poll=(token,phone)=>call('/api/ff-menu/state',{'X-FF-Session':token,'X-FF-HWID':phone}).then(r=>r.json());
assert.equal((await call('/api/auth',{},'POST',{key:'VPS-A',build:'22'})).status,401);assert.equal(licenseRequests,0);
const a=await verify('VPS-A','phone-aaaa111'),b=await verify('VPS-B','phone-bbbb222');assert.equal(a.ok,true);assert.equal(b.ok,true);
assert.match(a.menuSecret,/^[a-f0-9]{32}$/);assert.equal((await verify('VPS-A','phone-wrong00')).licensed,false);
assert.ok([...objects.keys()].every(k=>k.startsWith('user:vps:')));
const expiry=a.expiresAt;const renewed=await verify('VPS-A','phone-aaaa111');assert.equal(renewed.expiresAt,expiry);
assert.equal((await web('/api/device-config?build=22',a.menuSecret)).status,401);
const auth=await call('/api/auth',{},'POST',{key:renewed.menuSecret,build:'22'});assert.equal(auth.status,200);assert.equal((await auth.json()).key,undefined);
const config={...normalizeFfproxy({},2),espBox:true,aimWeaponStats:true};
assert.equal((await web('/api/device-config',renewed.menuSecret,'PUT',{build:'22',config})).status,200);
assert.equal((await poll(renewed.sessionToken,'phone-aaaa111')).aimWeaponStats,true);
assert.equal((await poll(b.sessionToken,'phone-bbbb222')).aimWeaponStats,false);
records.get('VPS-A').banned=true;assert.equal((await web('/api/device-config?build=22',renewed.menuSecret)).status,401);
assert.equal((await poll(renewed.sessionToken,'phone-aaaa111')).licensed,false);records.get('VPS-A').banned=false;
records.get('VPS-A').expiresAt=new Date(Date.now()-1000).toISOString();assert.equal((await verify('VPS-A','phone-aaaa111')).licensed,false);
assert.equal((await web('/api/device-config?build=22',renewed.menuSecret)).status,403);
assert.equal((await call('/api/ff-menu/logout',{'X-FF-Session':b.sessionToken,'X-FF-HWID':'phone-bbbb222'}).then(r=>r.json())).ok,true);
assert.equal((await web('/api/device-config?build=22',b.menuSecret)).status,401);
assert.equal((await call('/api/status?build=22')).status,200);assert.equal((await call('/api/runtime-config-v3')).status,410);
assert.equal((await call('/api/auth',{Origin:'https://evil.test'},'POST',{key:'VPS-A',build:'22'})).status,403);
assert.equal((await verify('VPS-FAIL','phone-fail000')).licensed,false);
console.log('PASS: VPS activation/device binding, stable expiry, isolated namespaces and controls, 32-character code login, bans, expired keys, logout and raw browser key rejection');

