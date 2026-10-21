import {ffproxyPacket} from './ffproxy.js';

// Native WWW clients inspect JSON fields rather than HTTP error bodies.
// A denied native session must explicitly send licensed:false to close its gate.
export async function ffproxyNativeRoute(request,env,{authenticate,digest,json}) {
  const url=new URL(request.url);
  if(!['/api/ff-menu/verify','/api/ff-menu/state'].includes(url.pathname))return null;
  const denied=message=>json({ok:false,licensed:false,message},200);
  if(request.method!=='GET')return denied('Unsupported method');
  if(!env.DEVICE_CONFIG||!env.DEVICE_STATE)return denied('Control storage unavailable');
  const hwid=request.headers.get('X-FF-HWID')||'';
  if(!/^[A-Za-z0-9_-]{8,128}$/.test(hwid)||/^(unknown|unsupported|n-a|0+)$/i.test(hwid))return denied('Valid device identity required');
  const deviceHash=await digest(hwid);
  if(url.pathname.endsWith('/verify')){
    const key=(request.headers.get('X-FF-Key')||'').trim();
    const auth=await authenticate(key,null,'22');
    if(!auth.ok)return denied(auth.body.message||'Invalid key');
    const canonicalKey=auth.body.key||key;
    const agent=request.headers.get('User-Agent')||'';
    const receiverRevision=agent.includes('DHX-VIDEOS')?3:agent.includes('DHX-V2')?2:1;
    const storageKey=`user:${await digest(canonicalKey)}`;
    const token=Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('');
    const tokenHash=await digest(token);
    const stub=env.DEVICE_STATE.get(env.DEVICE_STATE.idFromName(storageKey));
    const activation=await stub.fetch('https://state/ffproxy-activate',{method:'POST',body:JSON.stringify({tokenHash,deviceHash,receiverRevision})});
    if(!activation.ok)return denied(await activation.text());
    const keyExpiry=auth.body.expiresAt?Date.parse(auth.body.expiresAt):null;
    const expiresAt=Math.min(keyExpiry||Infinity,Date.now()+86400000);
    await env.DEVICE_CONFIG.put(`ffproxy:session:${tokenHash}`,JSON.stringify({key:canonicalKey,deviceHash,storageKey,expiresAt,receiverRevision}),{expirationTtl:Math.max(60,Math.ceil((expiresAt-Date.now())/1000))});
    return json({ok:true,licensed:true,menuSecret:tokenHash.slice(0,32),sessionToken:token,expiresAt:auth.body.expiresAt||'Unlimited'},200);
  }
  const token=request.headers.get('X-FF-Session')||'';
  if(!/^[a-f0-9]{48}$/.test(token))return denied('Invalid session');
  const tokenHash=await digest(token);
  const receiver=await env.DEVICE_CONFIG.get(`ffproxy:session:${tokenHash}`,'json');
  if(!receiver||receiver.expiresAt<=Date.now()||receiver.deviceHash!==deviceHash)return denied('Session expired or device mismatch');
  const auth=await authenticate(receiver.key,null,'22');
  if(!auth.ok)return denied(auth.body.message||'Key expired');
  const storageKey=`user:${await digest(auth.body.key||receiver.key)}`;
  const stub=env.DEVICE_STATE.get(env.DEVICE_STATE.idFromName(storageKey));
  const runtime=await stub.fetch('https://state/runtime',{method:'POST',body:JSON.stringify({tokenHash,deviceHash,protocolVersion:4,receiverVariant:'ffproxy',appliedMask:null,appliedValues:null,readback:false,hookFlags:null})});
  if(!runtime.ok)return denied(await runtime.text());
  return json(ffproxyPacket(await runtime.json(),receiver.receiverRevision||1),200);
}

