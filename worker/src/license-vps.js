export const VPS_LICENSE_ORIGIN='https://tonexcheat.duckdns.org';

// The VPS owns activation, expiry, bans and device binding. The browser never
// supplies its own device identity: web codes reuse the native session's ID.
export async function authenticateVps(key,deviceId,build,{digest}) {
  const denied=(message,status=401)=>({ok:false,status,body:{ok:false,valid:false,message}});
  if(typeof key!=='string'||!key||new TextEncoder().encode('key:'+key).length>512)return denied('Invalid key',400);
  if(!/^\d{1,12}$/.test(String(build||'')))return denied('App build number is required',400);
  if(typeof deviceId!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(deviceId)||/^(unknown|unsupported|n-a|0+)$/i.test(deviceId))return denied('Sign in to the game again to create a new WEB CONTROL code');
  const response=await fetch(VPS_LICENSE_ORIGIN+'/api/auth',{
    method:'POST',headers:{'content-type':'application/json',accept:'application/json'},
    body:JSON.stringify({key,deviceId,build}),signal:AbortSignal.timeout(10000)
  });
  const body=await response.json().catch(()=>({valid:false,message:'Invalid license API response'}));
  if(!response.ok||body.valid!==true||body.banned===true)return denied(body.banned?'Key banned':body.message||'Invalid key',response.ok?401:response.status);
  if(body.expiresAt&&(!Number.isFinite(Date.parse(body.expiresAt))||Date.now()>=Date.parse(body.expiresAt)))return denied('Key expired',403);
  const canonicalKey=body.key||key;
  return {ok:true,status:200,scope:`user:vps:${await digest(canonicalKey)}`,body:{...body,key:canonicalKey}};
}

