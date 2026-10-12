// Integration with the existing dhx Worker; no credentials in this source.
const UNIVERSAL_RECEIVER_SHA = '8fdb5526f80b3d6a7716d6df3c5da6413f819def968fe5b7689229f2e7a828ae';
async function universalHash(buffer) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buffer)), b => b.toString(16).padStart(2, '0')).join('');
}
async function universalPatchURL(env, url, patch, record, deviceId, request) {
  if (!patch.controllerUniversal) return patch.patchURL;
  if (!record.deviceId || !deviceId || record.deviceId !== deviceId) throw new Error('IPA device identity is required');
  const token = crypto.randomUUID() + crypto.randomUUID();
  const hash = await universalHash(new TextEncoder().encode(token));
  const expiresAt = Date.now() + 300000;
  await db(env).put('control-delivery:' + hash, JSON.stringify({ key: record.key, deviceId, patchId: patch.id, build: String(buildFromRequest(url, request) || 22), expiresAt }), { expirationTtl: 300 });
  const target = new URL('/patch-file/' + patch.id + '.3105', url);
  target.searchParams.set('delivery', token);
  return target.toString();
}
async function universalPatchFile(env, id, request, url) {
  const token = url.searchParams.get('delivery') || '';
  if (!/^[a-f0-9-]{72}$/.test(token)) return json({ ok: false, message: 'Open this patch from your logged-in IPA' }, 401);
  const hash = await universalHash(new TextEncoder().encode(token));
  const delivery = await db(env).get('control-delivery:' + hash, 'json');
  if (!delivery || delivery.patchId !== id || delivery.expiresAt <= Date.now()) return json({ ok: false, message: 'Patch delivery expired; refresh the IPA patch list' }, 403);
  const record = await getKey(env, delivery.key);
  if (!record || record.active === false || record.banned === true || isExpired(record) || record.deviceId !== delivery.deviceId) return json({ ok: false, message: 'Key is no longer valid for this device' }, 403);
  const response = await fetch('https://dragon-hex-control-api.dragonhex.workers.dev/api/device-patch', {
    method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + delivery.key },
    body: JSON.stringify({ build: delivery.build }), signal: AbortSignal.timeout(20000)
  });
  return new Response(response.body, { status: response.status, headers: { 'content-type': response.headers.get('content-type') || 'application/octet-stream', 'cache-control': 'no-store', ...corsHeaders() } });
}
