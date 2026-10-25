import {DRAGONX_CONTROLS,DRAGONX_IDS,normalizeDragonx,validDragonx,dragonxPacket,parseDragonxReadback} from './dragonx.js';
import {FFPROXY_CONTROLS,ffproxyControls,normalizeFfproxy,validFfproxy} from './ffproxy.js';
import {ffproxyNativeRoute,authenticateControlCode} from './ffproxy-runtime.js';
const UPSTREAM = 'https://dhx.dragonhex.workers.dev';
const WEB_ORIGIN = 'https://tengppm024-lang.github.io';
const WEB_ORIGINS = new Set([WEB_ORIGIN, 'https://dragonhexplus.gt.tc']);

// One Durable Object per paired device gives config and acknowledgements
// consistent reads across the web browser and the phone's Worker location.
export class DeviceState {
  constructor(state) { this.storage = state.storage; }
  async fetch(request) {
    const field = new URL(request.url).pathname.slice(1);
    if (['ffproxy-session','ffproxy-logout'].includes(field) && request.method==='POST') {
      const data=await request.json();
      return this.storage.transaction(async tx=>{
        const owner=await tx.get('receiver');
        if(!owner||owner.tokenHash!==data.tokenHash||owner.deviceHash!==data.deviceHash)return new Response('Session replaced',{status:401});
        if(field==='ffproxy-logout'){
          await tx.delete('receiver');await tx.delete('seen');
          const profile=await tx.get('profile');
          await tx.put('config',normalizeFfproxy({},profile?.receiverRevision||1));
        }
        return new Response(null,{status:204});
      });
    }
    if (field === 'ffproxy-activate' && request.method === 'POST') {
      const {tokenHash,deviceHash,receiverRevision=1}=await request.json();
      if(![1,2,3].includes(receiverRevision))return new Response('Invalid receiver revision',{status:400});
      if(!/^[a-f0-9]{64}$/.test(tokenHash||'')||!/^[a-f0-9]{64}$/.test(deviceHash||''))return new Response('Invalid device claim',{status:400});
      return this.storage.transaction(async tx=>{
        const previous=await tx.get('receiver');
        if(previous?.deviceHash&&previous.deviceHash!==deviceHash)return new Response('Key already connected to another game device',{status:409});
        const profile=await tx.get('profile');
        await tx.put('config',normalizeFfproxy(profile?.receiverVariant==='ffproxy'?(await tx.get('config')||{}):{},receiverRevision));
        await tx.put('receiver',{tokenHash,deviceHash});
        await tx.put('profile',{receiverVariant:'ffproxy',protocolVersion:4,receiverRevision});
        await tx.delete('seen');
        return new Response(null,{status:204});
      });
    }
    if (field === 'activate' && request.method === 'POST') {
      const {tokenHash,receiverVariant='legacy',protocolVersion=2} = await request.json();
      await this.storage.transaction(async tx => {
        await tx.put('receiver', {tokenHash, deviceHash:null});
        await tx.put('profile', {receiverVariant,protocolVersion});
        await tx.delete('seen');
      });
      return new Response(null, {status:204});
    }
    if (field === 'runtime' && request.method === 'POST') {
      const data = await request.json();
      return this.storage.transaction(async tx => {
        const owner = await tx.get('receiver');
        if (!owner || owner.tokenHash !== data.tokenHash) return new Response('Receiver replaced', {status:409});
        if (owner.deviceHash && owner.deviceHash !== data.deviceHash) return new Response('Key already connected to another game device', {status:409});
        if (!owner.deviceHash) await tx.put('receiver', {...owner,deviceHash:data.deviceHash});
        if (data.protocolVersion===4 || data.appliedMask !== null || data.appliedValues) await tx.put('seen', {seenAt:new Date().toISOString(),appliedMask:data.appliedMask,appliedValues:data.appliedValues || null,protocolVersion:data.protocolVersion || 1,receiverVariant:data.receiverVariant || 'legacy',readback:data.readback===true,hookFlags:data.hookFlags ?? null});
        return new Response(JSON.stringify(await tx.get('config') || (data.protocolVersion===4?normalizeFfproxy():data.protocolVersion===3?normalizeDragonx():defaults())), {headers:{'content-type':'application/json'}});
      });
    }
    if (!['config', 'seen', 'profile'].includes(field)) return new Response('Not found', {status:404});
    if (request.method === 'PUT') {
      await this.storage.put(field, await request.json());
      return new Response(null, {status:204});
    }
    return new Response(JSON.stringify(await this.storage.get(field) || null), {headers:{'content-type':'application/json'}});
  }
}

async function readState(env, storageKey, field) {
  if (env.DEVICE_STATE) {
    const stub = env.DEVICE_STATE.get(env.DEVICE_STATE.idFromName(storageKey));
    const value = await (await stub.fetch(`https://state/${field}`)).json();
    if (value || field === 'seen') return value;
  }
  return env.DEVICE_CONFIG.get(field === 'config' ? storageKey : `runtime:${storageKey}`, 'json');
}

async function writeState(env, storageKey, field, value) {
  if (env.DEVICE_STATE) {
    const stub = env.DEVICE_STATE.get(env.DEVICE_STATE.idFromName(storageKey));
    const response = await stub.fetch(`https://state/${field}`, {method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(value)});
    if (!response.ok) throw new Error('Device storage unavailable');
  } else await env.DEVICE_CONFIG.put(field === 'config' ? storageKey : `runtime:${storageKey}`, JSON.stringify(value));
}

const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...extra
  }
});

function cors(request) {
  const origin = request.headers.get('Origin');
  const allowed = !origin || WEB_ORIGINS.has(origin);
  return {
    allowed,
    headers: {
      'access-control-allow-origin': origin && WEB_ORIGINS.has(origin) ? origin : WEB_ORIGIN,
      'access-control-allow-methods': 'GET, PUT, POST, OPTIONS',
      'access-control-allow-headers': 'content-type, authorization',
      'access-control-max-age': '86400',
      'vary': 'Origin'
    }
  };
}

async function digest(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function authenticate(key, deviceId, build = '') {
  if (typeof build !== 'string' || !/^\d{1,12}$/.test(build)) return { ok: false, status: 400, body: { ok: false, message: 'App build number is required' } };
  if (typeof key !== 'string' || !key) return { ok: false, status: 400, body: { ok: false, message: 'กรุณากรอก Access Key ที่ใช้ล็อกอิน IPA' } };
  if (new TextEncoder().encode('key:'+key).length > 512) return { ok: false, status: 400, body: { ok: false, message: 'คีย์ยาวเกินรูปแบบที่ระบบรองรับ กรุณาวางเฉพาะ Access Key เดียวกับที่ใช้ล็อกอิน IPA' } };
  const response = await fetch(`${UPSTREAM}/api/control-auth`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ key, build }),
    signal: AbortSignal.timeout(10000)
  });
  const body = await response.json().catch(() => ({ valid: false, message: 'Invalid upstream response' }));
  if(body.expiresAt && (!Number.isFinite(Date.parse(body.expiresAt)) || Date.now()>=Date.parse(body.expiresAt)))return {ok:false,status:403,body:{ok:false,valid:false,message:'คีย์หมดอายุ'}};
  const ok = response.ok && body.valid === true && body.banned !== true;
  return { ok, status: ok ? response.status : (response.ok ? 401 : response.status), body };
}

// Use the existing DHX activation policy only after its read-only check says
// the key has never been activated. Repeated game logins cannot extend expiry.
async function activateGameKey(key,deviceId,build) {
  const response=await fetch(`${UPSTREAM}/api/auth`,{
    method:'POST',headers:{'content-type':'application/json',accept:'application/json'},
    body:JSON.stringify({key,deviceId,build}),signal:AbortSignal.timeout(10000)
  });
  const body=await response.json().catch(()=>({valid:false,message:'Invalid activation response'}));
  if(!response.ok||body.valid!==true||body.banned===true)return {ok:false,status:response.ok?401:response.status,body};
  // Re-read through the regular policy rather than trusting a local timer.
  return authenticate(key,null,build);
}

const FEATURES = ['aimSystem','silentAim','noRecoil','espMaster','skeleton','distance','playerName','healthBar','topTracer','playerBox','fovCircle'];
function validConfig(input) {
  return input && typeof input.aimSystem === 'boolean' && typeof input.noRecoil === 'boolean' &&
    FEATURES.every(k => input[k] === undefined || typeof input[k] === 'boolean') &&
    ['head','neck','body','mixed'].includes(input.target) && [0,25,50,75,100].includes(input.headshot) &&
    (input.aimSystemTarget === undefined || ['neck','head'].includes(input.aimSystemTarget)) &&
    (input.fovRadius === undefined || (Number.isInteger(input.fovRadius) && input.fovRadius >= 50 && input.fovRadius <= 400));
}
const defaults = () => ({aimSystem:false,silentAim:false,noRecoil:false,espMaster:false,skeleton:false,distance:false,playerName:false,healthBar:false,topTracer:false,playerBox:false,fovCircle:false,target:'head',headshot:0,aimSystemTarget:'head',fovRadius:197});
const normalize = c => ({...defaults(),...c,aimSystemTarget:c.aimSystemTarget || (c.target==='head'?'head':'neck')});
export function controlMask(input, version=1, variant='legacy') {
  const c=normalize(input);
  const target=c.target==='head' || c.target==='neck'?1:c.target==='body'?2:0;
  const aim=(c.silentAim?1<<15:0)|(target<<16)|(c.noRecoil?1<<18:0)|((4-c.headshot/25)<<19)|(c.aimSystem?1<<22:0)|(c.aimSystemTarget==='head'?1<<23:0);
  if(version===1)return aim;
  // OnGUI gates the whole ESP block with x bit 0, and the bone rendering
  // block with y bit 0. Bind functional roles rather than swapped menu labels.
  const esp=['espMaster','distance','playerName','healthBar','topTracer','playerBox','fovCircle'].reduce((m,k,i)=>m|(c[k]?1<<i:0),0);
  const radius=Math.max(0,Math.min(31,Math.round((c.fovRadius-50)/11.29)));
  const result=aim|esp|(radius<<24)|(c.skeleton?1<<29:0);
  return variant==='dragonx' ? result & 0x3f44807f : result;
}
const bearer = request => /^Bearer\s+(.+)$/i.exec(request.headers.get('Authorization') || '')?.[1]?.trim() || '';
const bytes = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
const hex = value => [...value].map(b => b.toString(16).padStart(2, '0')).join('');

export async function personalize(template, token) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Invalid receiver token');
  const plain = bytes(template.plaintext);
  plain.set(new TextEncoder().encode(token), template.tokenOffset);
  const hash = await crypto.subtle.digest('SHA-256', plain.slice(template.patchOffset, template.patchOffset + template.patchLength));
  plain.set(new Uint8Array(hash), template.digestOffset);
  const key = await crypto.subtle.importKey('raw', bytes(template.contentKey), 'AES-GCM', false, ['encrypt']);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: new TextEncoder().encode(template.aad) }, key, plain));
  if (nonce.length + encrypted.length !== template.encryptedLength) throw new Error('Receiver template size mismatch');
  const pkg = bytes(template.package);
  pkg.set(nonce, template.encryptedOffset);
  pkg.set(encrypted, template.encryptedOffset + nonce.length);
  return pkg;
}

async function proxy(path, request, corsHeaders) {
  const upstreamURL = new URL(path, UPSTREAM);
  upstreamURL.search = new URL(request.url).search;
  const response = await fetch(upstreamURL, {
    method: request.method,
    headers: { accept: 'application/json', 'content-type': request.headers.get('content-type') || 'application/json' },
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    signal: AbortSignal.timeout(10000)
  });
  const body = await response.json().catch(() => null);
  if (!body) return json({ ok: false, message: 'Key API returned an invalid response' }, 502, corsHeaders);
  return json(body, response.status, corsHeaders);
}

export default {
  async fetch(request, env) {
    try {
    const url = new URL(request.url);
    const { allowed, headers: corsHeaders } = cors(request);
    if (request.method === 'OPTIONS') return new Response(null, { status: allowed ? 204 : 403, headers: corsHeaders });
    if (!allowed) return json({ ok: false, message: 'Origin not allowed' }, 403, corsHeaders);

    if(['/api/ff-menu/verify','/api/ff-menu/state','/api/ff-menu/logout'].includes(url.pathname)){
      const native=await ffproxyNativeRoute(request,env,{authenticate,activateGameKey,digest,json});
      return new Response(native.body,{status:native.status,headers:{...Object.fromEntries(native.headers),...corsHeaders}});
    }

    const authenticateWeb=(credential,device,build)=>/^[a-f0-9]{32}$/i.test(credential||'')
      ?authenticateControlCode(credential,build,env,{authenticate,digest})
      :authenticate(credential,device,build);

    if (url.pathname === '/') return json({ ok: true, name: 'DRAGON HEX Control API', version: '3.0' }, 200, corsHeaders);
    if (url.pathname === '/keys') return Response.redirect(`${UPSTREAM}/keys`, 302);
    if (url.pathname === '/api/auth' && request.method === 'POST') {
      const data=await request.json().catch(()=>null);
      const auth=await authenticateWeb(data?.key?.trim(), null, data?.build);
      const {key:privateKey,...publicBody}=auth.body;
      return json(publicBody,auth.status,corsHeaders);
    }
    if (url.pathname === '/api/status' && request.method === 'GET') return proxy('/api/status', request, corsHeaders);
    if (url.pathname === '/api/feature-catalog' && request.method === 'GET') {
      const auth = await authenticateWeb(bearer(request), null, url.searchParams.get('build'));
      if (!auth.ok) return json(auth.body, auth.status, corsHeaders);
      const profile=await readState(env,`user:${await digest(auth.body.key || bearer(request))}`,'profile');
      if(profile?.receiverVariant==='ffproxy'&&profile.protocolVersion===4)return json({ok:true,receiverVariant:'ffproxy',protocolVersion:4,ready:true,features:ffproxyControls(profile.receiverRevision||1)},200,corsHeaders);
      if(profile?.receiverVariant==='dragonx'&&profile.protocolVersion===3)return json({ok:true,receiverVariant:'dragonx',protocolVersion:3,ready:true,features:DRAGONX_CONTROLS.map(({slot,...f})=>f)},200,corsHeaders);
      return json({ok:true,receiverVariant:'ffproxy',protocolVersion:4,receiverRevision:3,ready:false,features:ffproxyControls(3)},200,corsHeaders);
    }

    if (['/api/device-patch', '/api/runtime-config', '/api/runtime-config-v2','/api/runtime-config-v3', '/api/runtime-status'].includes(url.pathname) && !env.DEVICE_CONFIG) return json({ ok: false, message: 'DEVICE_CONFIG KV binding is not configured' }, 503, corsHeaders);

    if (url.pathname === '/api/device-patch' && request.method === 'POST') {
      const data = await request.json().catch(() => null);
      const key = bearer(request);
      const auth = await authenticate(key, data?.deviceId, data?.build);
      if (!auth.ok) return json(auth.body, auth.status, corsHeaders);
      const receiverVariant=data.receiverVariant || 'legacy';
      if(!['legacy','dragonx'].includes(receiverVariant))return json({ok:false,message:'Unsupported receiver variant'},400,corsHeaders);
      const fullTemplate=receiverVariant==='dragonx'?await env.DEVICE_CONFIG.get('receiver:template:dragonx:v3','json'):null;
      const protocolVersion=fullTemplate?3:2;
      const template = fullTemplate || await env.DEVICE_CONFIG.get(receiverVariant==='dragonx'?'receiver:template:dragonx:v1':'receiver:template:v2', 'json');
      if (!template) return json({ ok: false, message: 'Receiver template is not installed' }, 503, corsHeaders);
      const token = hex(crypto.getRandomValues(new Uint8Array(32)));
      const storageKey = `user:${await digest(auth.body.key || key)}`;
      if (!env.DEVICE_STATE) return json({ok:false,message:'Per-key control storage is unavailable'},503,corsHeaders);
      const pkg = await personalize(template, token);
      // Only Cloudflare KV holds the original access key; the patch holds a scoped
      // receiver token. Runtime reads are reauthorized against the original API.
      await env.DEVICE_CONFIG.put(`receiver:${await digest(token)}`, JSON.stringify({ key, deviceId: data.deviceId, build: data.build, storageKey, protocolVersion,receiverVariant }));
      const stub=env.DEVICE_STATE.get(env.DEVICE_STATE.idFromName(storageKey));
      const activation=await stub.fetch('https://state/activate',{method:'POST',body:JSON.stringify({tokenHash:await digest(token),receiverVariant,protocolVersion})});
      if (!activation.ok) throw new Error('Receiver activation failed');
      return new Response(pkg, { headers: { ...corsHeaders, 'content-type': 'application/octet-stream', 'content-disposition': `attachment; filename="${receiverVariant==='dragonx'?'DRAGONx_WEB_RECEIVER':'DRAGON_HEX_READBACK_FIX'}.3105"`, 'cache-control': 'no-store' } });
    }

    if (['/api/runtime-config','/api/runtime-config-v2','/api/runtime-config-v3'].includes(url.pathname) && request.method === 'GET') {
      const token = bearer(request);
      if (!/^[a-f0-9]{64}$/.test(token)) return json({ ok: false, message: 'Invalid receiver token' }, 401, corsHeaders);
      const receiver = await env.DEVICE_CONFIG.get(`receiver:${await digest(token)}`, 'json');
      if (!receiver) return json({ ok: false, message: 'Receiver not paired' }, 401, corsHeaders);
      const protocolVersion=url.pathname.endsWith('-v3')?3:url.pathname.endsWith('-v2')?2:1;
      if((receiver.protocolVersion || 1)!==protocolVersion)return json({ok:false,message:'Receiver version mismatch'},409,corsHeaders);
      const auth = await authenticate(receiver.key, receiver.deviceId, receiver.build);
      if (!auth.ok) return json(auth.body, auth.status, corsHeaders);
      if (!env.DEVICE_STATE) return json({ok:false,message:'Per-key control storage is unavailable'},503,corsHeaders);
      const runtimeDevice=request.headers.get('X-Dragonhex-Device') || '';
      if (!/^[A-Za-z0-9_-]{8,128}$/.test(runtimeDevice) || /^(unknown|unsupported|n-a|0+)$/i.test(runtimeDevice)) return json({ok:false,message:'Valid game device identity is required'},400,corsHeaders);
      const applied = request.headers.get('X-Dragonhex-Applied');
      const hooks=request.headers.get('X-Dragonhex-Hooks');
      const hookFlags=/^[0-7]$/.test(hooks || '')?Number(hooks):null;
      const allowedMask=protocolVersion===2?0x3fff807f:0xff8000;
      const appliedMask=/^\d{1,10}$/.test(applied || '') && Number(applied)<=allowedMask && (Number(applied)&~allowedMask)===0 ? Number(applied) : null;
      const appliedValues=protocolVersion===3?parseDragonxReadback(request.headers.get('X-Dragonhex-Values')):null;
      const storageKey=`user:${await digest(auth.body.key || receiver.key)}`;
      const stub=env.DEVICE_STATE.get(env.DEVICE_STATE.idFromName(storageKey));
      const runtime=await stub.fetch('https://state/runtime',{method:'POST',body:JSON.stringify({tokenHash:await digest(token),deviceHash:await digest(runtimeDevice),appliedMask,appliedValues,protocolVersion,receiverVariant:receiver.receiverVariant || 'legacy',readback:protocolVersion>=2 && hookFlags!==null,hookFlags})});
      if (!runtime.ok) return json({ok:false,message:await runtime.text()},runtime.status,corsHeaders);
      const config=await runtime.json();
      return new Response(protocolVersion===3?dragonxPacket(config):String(controlMask(config,protocolVersion,receiver.receiverVariant)), { headers: { ...corsHeaders, 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
    }

    if (url.pathname === '/api/runtime-status' && request.method === 'GET') {
      const key = bearer(request);
      const deviceId = url.searchParams.get('deviceId') || '';
      const auth = await authenticateWeb(key, deviceId, url.searchParams.get('build') || '');
      if (!auth.ok) return json(auth.body, auth.status, corsHeaders);
      const storageKey = `user:${await digest(auth.body.key || key)}`;
      const seen = await readState(env, storageKey, 'seen');
      const profile=await readState(env,storageKey,'profile');
      if(profile?.receiverVariant==='ffproxy'&&profile.protocolVersion===4){
        const online=seen?.receiverVariant==='ffproxy'&&Date.now()-Date.parse(seen.seenAt)<30000;
        return json({ok:true,online,seenAt:seen?.seenAt||null,receiverVariant:'ffproxy',receiverVersion:4,upgradeRequired:false,readback:false,deliveryOnly:true,applied:false},200,corsHeaders);
      }
      const config = await readState(env, storageKey, 'config') || (seen?.protocolVersion===3?normalizeDragonx():defaults());
      const online = !!seen && Date.now() - Date.parse(seen.seenAt) < 30000;
      return json({ ok: true, online, seenAt: seen?.seenAt || null, receiverVariant:seen?.receiverVariant || 'legacy',receiverVersion:seen?.protocolVersion || 1, upgradeRequired:online && !seen.readback, readback:seen?.readback===true,hookFlags:seen?.hookFlags ?? null, applied: online && seen?.readback===true && (seen.protocolVersion===3?seen.appliedValues===dragonxPacket(config):seen.appliedMask === controlMask(config,seen.protocolVersion || 1,seen.receiverVariant)) }, 200, corsHeaders);
    }

    if (url.pathname === '/api/device-config' && !env.DEVICE_CONFIG) return json({ ok: false, message: 'DEVICE_CONFIG KV binding is not configured' }, 503, corsHeaders);
    if (url.pathname === '/api/device-config' && request.method === 'GET') {
      const key = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim() || '';
      const deviceId = url.searchParams.get('deviceId')?.trim() || '';
      const auth = await authenticateWeb(key, deviceId, url.searchParams.get('build') || '');
      if (!auth.ok) return json(auth.body, auth.status || 401, corsHeaders);
      const storageKey = `user:${await digest(auth.body.key || key)}`;
      const stored = await readState(env, storageKey, 'config');
      const profile=await readState(env,storageKey,'profile');
      return json({ ok: true, config: profile?.protocolVersion===4?normalizeFfproxy(stored||{},profile.receiverRevision||1):profile?.protocolVersion===3?normalizeDragonx(stored || {}):normalize(stored || {}) }, 200, corsHeaders);
    }

    if (url.pathname === '/api/device-config' && request.method === 'PUT') {
      const data = await request.json().catch(() => null);
      if (!data) return json({ ok: false, message: 'Invalid JSON' }, 400, corsHeaders);
      const key = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim() || '';
      const deviceId = String(data.deviceId || '').trim();
      const auth = await authenticateWeb(key, deviceId, data.build);
      if (!auth.ok) return json(auth.body, auth.status || 401, corsHeaders);
      const storageKey = `user:${await digest(auth.body.key || key)}`;
      const profile=await readState(env,storageKey,'profile');
      if (!(profile?.protocolVersion===4?validFfproxy(data.config,profile.receiverRevision||1):profile?.protocolVersion===3?validDragonx(data.config):validConfig(data.config))) return json({ ok: false, message: 'Invalid feature configuration' }, 400, corsHeaders);
      const config=profile?.protocolVersion===4?normalizeFfproxy(data.config,profile.receiverRevision||1):profile?.protocolVersion===3?normalizeDragonx(data.config):normalize(Object.fromEntries([...FEATURES,'target','headshot','aimSystemTarget','fovRadius'].filter(k=>data.config[k]!==undefined).map(k=>[k,data.config[k]])));
      config.updatedAt=new Date().toISOString();
      await writeState(env, storageKey, 'config', config);
      return json({ ok: true, config }, 200, corsHeaders);
    }

    return json({ ok: false, message: 'Not found' }, 404, corsHeaders);
    } catch {
      if(['/api/ff-menu/verify','/api/ff-menu/state'].includes(new URL(request.url).pathname))return json({ok:false,licensed:false,message:'Control service unavailable'},200,cors(request).headers);
      return json({ ok: false, message: 'API temporarily unavailable' }, 502, cors(request).headers);
    }
  }
};


