// Insert into the existing dhx Worker. This checks its existing key record;
// it does not activate, rebind, extend, or reset the IPA login key.
async function authenticateControl(env, request, url) {
  const body = await readBody(request);
  const key = String(body.key || '').trim();
  if (!key || new TextEncoder().encode('key:'+key).length > 512) return json({ok:false,valid:false,message:'กรุณาวางเฉพาะ Access Key เดียวกับที่ใช้ล็อกอิน IPA'},400);
  const maintenance = await getMaintenance(env);
  if (maintenanceApplies(maintenance,buildFromRequest(url,request,body))) return json({ok:false,valid:false,maintenance:true,message:maintenance.message},503);
  const record = await getKey(env,key);
  if (!record || record.active === false || record.banned === true) return json({ok:false,valid:false,message:record?.banned ? 'Key banned' : 'Invalid key'},401);
  if (isExpired(record)) return json({ok:false,valid:false,message:'Key expired'},403);
  if (!record.activatedAt && !record.boundAt) return json({ok:false,valid:false,message:'กรุณาเข้าสู่ระบบ IPA ด้วยคีย์นี้ก่อน'},403);
  const expiry = expiryTime(record);
  return json({ok:true,valid:true,key:record.key || key,userName:record.label || null,expiresAt:expiry ? new Date(expiry).toISOString() : null,message:'Authenticated'},200);
}
