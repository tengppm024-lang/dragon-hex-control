const UPSTREAM = 'https://dhx.dragonhex.workers.dev';
const WEB_ORIGIN = 'https://tengppm024-lang.github.io';

// One Durable Object per paired device gives config and acknowledgements
// consistent reads across the web browser and the phone's Worker location.
export class DeviceState {
  constructor(state) { this.storage = state.storage; }
  async fetch(request) {
    const field = new URL(request.url).pathname.slice(1);
    if (!['config', 'seen'].includes(field)) return new Response('Not found', {status:404});
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
  const allowed = !origin || origin === WEB_ORIGIN;
  return {
    allowed,
    headers: {
      'access-control-allow-origin': origin === WEB_ORIGIN ? WEB_ORIGIN : WEB_ORIGIN,
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
  if (typeof key !== 'string' || !key || key.length > 512 || typeof deviceId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(deviceId)) return { ok: false, status: 400, body: { ok: false, message: 'Valid key and deviceId are required' } };
  const response = await fetch(`${UPSTREAM}/api/auth`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ key, deviceId, build }),
    signal: AbortSignal.timeout(10000)
  });
  const body = await response.json().catch(() => ({ valid: false, message: 'Invalid upstream response' }));
  const ok = response.ok && body.valid === true;
  return { ok, status: ok ? response.status : (response.ok ? 401 : response.status), body };
}

function validConfig(input) {
  const targets = new Set(['head', 'neck', 'body', 'mixed']);
  const headshots = new Set([0, 25, 50, 75, 100]);
  return input && typeof input.aimSystem === 'boolean' && typeof input.noRecoil === 'boolean' &&
    (input.silentAim === undefined || typeof input.silentAim === 'boolean') &&
    targets.has(input.target) && typeof input.headshot === 'number' && headshots.has(input.headshot);
}

export function controlMask(config) {
  // These bit positions come from the supplied patch's menu and game methods.
  const target = config.target === 'head' || config.target === 'neck' ? 1 : config.target === 'body' ? 2 : 0;
  return (config.silentAim ? 1 << 15 : 0) | (target << 16) |
    (config.noRecoil ? 1 << 18 : 0) | ((4 - config.headshot / 25) << 19) |
    (config.aimSystem ? 1 << 22 : 0) | (config.target === 'head' ? 1 << 23 : 0);
}

const defaults = () => ({ aimSystem: false, silentAim: false, noRecoil: false, target: 'head', headshot: 0 });
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

    if (url.pathname === '/') return json({ ok: true, name: 'DRAGON HEX Control API', version: '1.1' }, 200, corsHeaders);
    if (url.pathname === '/keys') return Response.redirect(`${UPSTREAM}/keys`, 302);
    if (url.pathname === '/api/auth' && request.method === 'POST') return proxy('/api/auth', request, corsHeaders);
    if (url.pathname === '/api/status' && request.method === 'GET') return proxy('/api/status', request, corsHeaders);

    if (['/api/device-patch', '/api/runtime-config', '/api/runtime-status'].includes(url.pathname) && !env.DEVICE_CONFIG) return json({ ok: false, message: 'DEVICE_CONFIG KV binding is not configured' }, 503, corsHeaders);

    if (url.pathname === '/api/device-patch' && request.method === 'POST') {
      const data = await request.json().catch(() => null);
      const key = bearer(request);
      const auth = await authenticate(key, data?.deviceId, data?.build);
      if (!auth.ok) return json(auth.body, auth.status, corsHeaders);
      const template = await env.DEVICE_CONFIG.get('receiver:template:v1', 'json');
      if (!template) return json({ ok: false, message: 'Receiver template is not installed' }, 503, corsHeaders);
      const token = hex(crypto.getRandomValues(new Uint8Array(32)));
      const storageKey = `device:${await digest(`${key}:${data.deviceId}`)}`;
      const pkg = await personalize(template, token);
      // Only Cloudflare KV holds the original access key; the patch holds a scoped
      // receiver token. Runtime reads are reauthorized against the original API.
      await env.DEVICE_CONFIG.put(`receiver:${await digest(token)}`, JSON.stringify({ key, deviceId: data.deviceId, build: data.build, storageKey }));
      return new Response(pkg, { headers: { ...corsHeaders, 'content-type': 'application/octet-stream', 'content-disposition': 'attachment; filename="DRAGON_HEX_WEB_RECEIVER.3105"', 'cache-control': 'no-store' } });
    }

    if (url.pathname === '/api/runtime-config' && request.method === 'GET') {
      const token = bearer(request);
      if (!/^[a-f0-9]{64}$/.test(token)) return json({ ok: false, message: 'Invalid receiver token' }, 401, corsHeaders);
      const receiver = await env.DEVICE_CONFIG.get(`receiver:${await digest(token)}`, 'json');
      if (!receiver) return json({ ok: false, message: 'Receiver not paired' }, 401, corsHeaders);
      const auth = await authenticate(receiver.key, receiver.deviceId, receiver.build);
      if (!auth.ok) return json(auth.body, auth.status, corsHeaders);
      const config = await readState(env, receiver.storageKey, 'config') || defaults();
      const applied = request.headers.get('X-Dragonhex-Applied');
      if (/^\d{1,8}$/.test(applied || '') && Number(applied) <= 0xff8000 && (Number(applied) & ~0xff8000) === 0) {
        await writeState(env, receiver.storageKey, 'seen', { seenAt: new Date().toISOString(), appliedMask: Number(applied) });
      }
      return new Response(String(controlMask(config)), { headers: { ...corsHeaders, 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
    }

    if (url.pathname === '/api/runtime-status' && request.method === 'GET') {
      const key = bearer(request);
      const deviceId = url.searchParams.get('deviceId') || '';
      const auth = await authenticate(key, deviceId, url.searchParams.get('build') || '');
      if (!auth.ok) return json(auth.body, auth.status, corsHeaders);
      const storageKey = `device:${await digest(`${key}:${deviceId}`)}`;
      const seen = await readState(env, storageKey, 'seen');
      const config = await readState(env, storageKey, 'config') || defaults();
      const online = !!seen && Date.now() - Date.parse(seen.seenAt) < 30000;
      return json({ ok: true, online, seenAt: seen?.seenAt || null, applied: online && seen.appliedMask === controlMask(config) }, 200, corsHeaders);
    }

    if (url.pathname === '/api/device-config' && !env.DEVICE_CONFIG) return json({ ok: false, message: 'DEVICE_CONFIG KV binding is not configured' }, 503, corsHeaders);
    if (url.pathname === '/api/device-config' && request.method === 'GET') {
      const key = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim() || '';
      const deviceId = url.searchParams.get('deviceId')?.trim() || '';
      const auth = await authenticate(key, deviceId, url.searchParams.get('build') || '');
      if (!auth.ok) return json(auth.body, auth.status || 401, corsHeaders);
      const storageKey = `device:${await digest(`${key}:${deviceId}`)}`;
      const stored = await readState(env, storageKey, 'config');
      return json({ ok: true, config: stored || defaults() }, 200, corsHeaders);
    }

    if (url.pathname === '/api/device-config' && request.method === 'PUT') {
      const data = await request.json().catch(() => null);
      if (!data) return json({ ok: false, message: 'Invalid JSON' }, 400, corsHeaders);
      const key = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim() || '';
      const deviceId = String(data.deviceId || '').trim();
      const auth = await authenticate(key, deviceId, data.build);
      if (!auth.ok) return json(auth.body, auth.status || 401, corsHeaders);
      if (!validConfig(data.config)) return json({ ok: false, message: 'Invalid feature configuration' }, 400, corsHeaders);
      const storageKey = `device:${await digest(`${key}:${deviceId}`)}`;
      const config = { aimSystem: data.config.aimSystem, silentAim: data.config.silentAim || false, noRecoil: data.config.noRecoil, target: data.config.target, headshot: data.config.headshot, updatedAt: new Date().toISOString() };
      await writeState(env, storageKey, 'config', config);
      return json({ ok: true, config }, 200, corsHeaders);
    }

    return json({ ok: false, message: 'Not found' }, 404, corsHeaders);
    } catch {
      return json({ ok: false, message: 'API temporarily unavailable' }, 502, cors(request).headers);
    }
  }
};

