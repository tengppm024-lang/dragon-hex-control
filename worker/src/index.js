const UPSTREAM = 'https://dhx.dragonhex.workers.dev';
const WEB_ORIGIN = 'https://tengppm024-lang.github.io';

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
    targets.has(input.target) && typeof input.headshot === 'number' && headshots.has(input.headshot);
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

    if (url.pathname === '/') return json({ ok: true, name: 'DRAGON HEX Control API', version: '1.0' }, 200, corsHeaders);
    if (url.pathname === '/keys') return Response.redirect(`${UPSTREAM}/keys`, 302);
    if (url.pathname === '/api/auth' && request.method === 'POST') return proxy('/api/auth', request, corsHeaders);
    if (url.pathname === '/api/status' && request.method === 'GET') return proxy('/api/status', request, corsHeaders);

    if (url.pathname === '/api/device-config' && !env.DEVICE_CONFIG) return json({ ok: false, message: 'DEVICE_CONFIG KV binding is not configured' }, 503, corsHeaders);
    if (url.pathname === '/api/device-config' && request.method === 'GET') {
      const key = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim() || '';
      const deviceId = url.searchParams.get('deviceId')?.trim() || '';
      const auth = await authenticate(key, deviceId, url.searchParams.get('build') || '');
      if (!auth.ok) return json(auth.body, auth.status || 401, corsHeaders);
      const storageKey = `device:${await digest(`${key}:${deviceId}`)}`;
      const stored = await env.DEVICE_CONFIG.get(storageKey, 'json');
      return json({ ok: true, config: stored || { aimSystem: false, noRecoil: false, target: 'head', headshot: 0 } }, 200, corsHeaders);
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
      const config = { aimSystem: data.config.aimSystem, noRecoil: data.config.noRecoil, target: data.config.target, headshot: data.config.headshot, updatedAt: new Date().toISOString() };
      await env.DEVICE_CONFIG.put(storageKey, JSON.stringify(config));
      return json({ ok: true, config }, 200, corsHeaders);
    }

    return json({ ok: false, message: 'Not found' }, 404, corsHeaders);
    } catch {
      return json({ ok: false, message: 'API temporarily unavailable' }, 502, cors(request).headers);
    }
  }
};

