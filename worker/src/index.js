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
      'access-control-allow-headers': 'content-type',
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

async function authenticate(key, deviceId, build = 'dragon-hex-control/1.0') {
  if (!key || !deviceId) return { ok: false, status: 400, body: { ok: false, message: 'Key and deviceId are required' } };
  const response = await fetch(`${UPSTREAM}/api/auth`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ key, deviceId, build })
  });
  const body = await response.json().catch(() => ({ valid: false, message: 'Invalid upstream response' }));
  return { ok: response.ok && body.valid === true, status: response.status, body };
}

function validConfig(input) {
  const targets = new Set(['head', 'neck', 'body', 'mixed']);
  const headshots = new Set([0, 25, 50, 75, 100]);
  return input && typeof input.aimSystem === 'boolean' && typeof input.noRecoil === 'boolean' &&
    targets.has(input.target) && headshots.has(Number(input.headshot));
}

async function proxy(path, request, corsHeaders) {
  const upstreamURL = new URL(path, UPSTREAM);
  upstreamURL.search = new URL(request.url).search;
  const response = await fetch(upstreamURL, {
    method: request.method,
    headers: { accept: 'application/json', 'content-type': request.headers.get('content-type') || 'application/json' },
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body
  });
  return new Response(response.body, { status: response.status, headers: { 'content-type': response.headers.get('content-type') || 'application/json; charset=utf-8', ...corsHeaders } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { allowed, headers: corsHeaders } = cors(request);
    if (request.method === 'OPTIONS') return new Response(null, { status: allowed ? 204 : 403, headers: corsHeaders });
    if (!allowed) return json({ ok: false, message: 'Origin not allowed' }, 403, corsHeaders);

    if (url.pathname === '/') return json({ ok: true, name: 'DRAGON HEX Control API', version: '1.0' }, 200, corsHeaders);
    if (url.pathname === '/keys') return Response.redirect(`${UPSTREAM}/keys`, 302);
    if (url.pathname === '/api/auth' && request.method === 'POST') return proxy('/api/auth', request, corsHeaders);
    if (url.pathname === '/api/status' && request.method === 'GET') return proxy('/api/status', request, corsHeaders);

    if (url.pathname === '/api/device-config' && request.method === 'GET') {
      const key = url.searchParams.get('key')?.trim() || '';
      const deviceId = url.searchParams.get('deviceId')?.trim() || '';
      const auth = await authenticate(key, deviceId);
      if (!auth.ok) return json(auth.body, auth.status || 401, corsHeaders);
      const storageKey = `device:${await digest(`${key}:${deviceId}`)}`;
      const stored = await env.DEVICE_CONFIG.get(storageKey, 'json');
      return json({ ok: true, config: stored || { aimSystem: false, noRecoil: false, target: 'head', headshot: 0 } }, 200, corsHeaders);
    }

    if (url.pathname === '/api/device-config' && request.method === 'PUT') {
      const data = await request.json().catch(() => null);
      if (!data) return json({ ok: false, message: 'Invalid JSON' }, 400, corsHeaders);
      const key = String(data.key || '').trim();
      const deviceId = String(data.deviceId || '').trim();
      const auth = await authenticate(key, deviceId);
      if (!auth.ok) return json(auth.body, auth.status || 401, corsHeaders);
      if (!validConfig(data.config)) return json({ ok: false, message: 'Invalid feature configuration' }, 400, corsHeaders);
      const storageKey = `device:${await digest(`${key}:${deviceId}`)}`;
      const config = { ...data.config, headshot: Number(data.config.headshot), updatedAt: new Date().toISOString() };
      await env.DEVICE_CONFIG.put(storageKey, JSON.stringify(config));
      return json({ ok: true, config }, 200, corsHeaders);
    }

    return json({ ok: false, message: 'Not found' }, 404, corsHeaders);
  }
};
