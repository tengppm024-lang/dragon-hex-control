// Authenticated admin routes. Template bytes are an upload master with no live receiver credential.
async function studioAdmin(env,request){const user=await currentUser(env,request);return user&&(user.role==='super'||user.canManagePatches)?user:null;}
async function studioReadFile(request){const form=await request.formData(),file=form.get('file');if(!file||typeof file.arrayBuffer!=='function'||file.size>5*1024*1024)throw Error('เลือกไฟล์ 3105 ขนาดไม่เกิน 5 MB');return {form,file,bytes:new Uint8Array(await file.arrayBuffer())};}
async function studioRoute(env,request,url){
 if(url.pathname==='/api/studio/catalog'&&request.method==='GET'){
  const catalog=new Map();for(const p of await getPatches(env)){if(p.enabled===false)continue;for(const f of p.studioFeatures||[])if(f.supported)catalog.set(f.id,{id:f.id,label:f.label,group:f.group});}
  return json({ok:true,features:[...catalog.values()]},200);
 }
 const user=await studioAdmin(env,request);
 if(!user&&url.pathname==='/patch-studio'&&request.method==='GET')return loginPage('/patch-studio','เข้าสู่ Patch Studio');
 if(!user)return json({ok:false,message:'ต้องเข้าสู่ระบบผู้ดูแลที่มีสิทธิ์จัดการแพตช์'},401);
 if(url.pathname==='/api/studio/service-health'&&request.method==='GET'){
  if(!env.CONTROL_API)return json({ok:false,message:'ยังไม่ได้เชื่อม CONTROL_API'},503);
  try{const response=await env.CONTROL_API.fetch('https://dragon-hex-control-api.dragonhex.workers.dev/');return json({ok:response.ok,message:response.ok?'API เชื่อมพร้อม':'API ควบคุมยังไม่พร้อม'},response.ok?200:503);}catch{return json({ok:false,message:'ติดต่อ API ควบคุมไม่ได้'},503);}
 }
 if(url.pathname==='/patch-studio'&&request.method==='GET'){
  const groups=(await getResourceButtons(env)).filter(g=>g.kind==='patch');
  const boot=JSON.stringify({groups:groups.map(g=>({id:g.id,name:g.name,label:g.label||g.title||g.name}))}).replace(/</g,'\\u003c');
  const page=STUDIO_PAGE.replace('/*STUDIO_BOOT*/','window.STUDIO_BOOT='+boot+';').replace('/*STUDIO_CLIENT*/',STUDIO_CLIENT);
  return new Response(page,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
 }
 if(url.pathname==='/api/studio/download'&&request.method==='GET'){
  const id=url.searchParams.get('id')||'',patch=(await getPatches(env)).find(p=>p.id===id&&p.controllerUniversal);
  if(!patch)return json({ok:false,message:'ไม่พบแพตช์ที่ยืนยันแล้ว'},404);
  return new Response(Uint8Array.from(atob(STUDIO_MASTER),c=>c.charCodeAt(0)),{headers:{'content-type':'application/octet-stream','content-disposition':'attachment; filename="DRAGON_HEX_UNIVERSAL.3105"','cache-control':'no-store'}});
 }
 if(!['/api/studio/analyze','/api/studio/confirm'].includes(url.pathname)||request.method!=='POST')return json({ok:false,message:'Not found'},404);
 // Same-origin forms only; the API never accepts a customer key as admin authorization.
 const origin=request.headers.get('Origin');if(!origin||origin!==url.origin)return json({ok:false,message:'Invalid admin request origin'},403);
 try{
  const {form,file,bytes}=await studioReadFile(request),analysis=await studioAnalyze(bytes,file.name);
  if(url.pathname==='/api/studio/analyze')return json({ok:true,analysis},200);
  if(!analysis.supported)return json({ok:false,message:'เมนูนี้ยังไม่มีตัวเชื่อมที่ตรวจสอบแล้ว'},422);
  if(!env.CONTROL_API)return json({ok:false,message:'ยังไม่ได้เชื่อม CONTROL_API จึงยังสร้างแพตช์ไม่ได้'},503);
  if(form.get('digest')!==analysis.fileDigest)return json({ok:false,message:'ไฟล์เปลี่ยนหลังตรวจ กรุณาตรวจใหม่'},409);
  let ids;try{ids=JSON.parse(form.get('features'));}catch{throw Error('รายการฟังก์ชั่นไม่ถูกต้อง');}
  const supported=new Map(analysis.features.map(f=>[f.id,f]));if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!supported.has(id)))throw Error('เลือกรายการฟังก์ชั่นที่ตรวจพบ');
  const groupID=String(form.get('groupID')||''),group=(await getResourceButtons(env)).find(g=>g.id===groupID&&g.kind==='patch');if(!group)throw Error('เลือกหัวข้อปลายทาง');
  const name=String(form.get('name')||analysis.name).trim().slice(0,100);if(!name)throw Error('กรอกชื่อแพตช์');
  const importID=await studioDigest(new TextEncoder().encode(analysis.fileDigest+'\n'+groupID+'\n'+name+'\n'+ids.slice().sort().join(',')));
  const patches=await getPatches(env);let patch=patches.find(p=>p.studioImportID===importID);
  if(!patch){const id=crypto.randomUUID();await db(env).put('patch-file:'+id,Uint8Array.from(atob(STUDIO_MASTER),c=>c.charCodeAt(0)));patch={id,name,version:'WEB-1',enabled:true,groupID,password:null,patchURL:new URL('/patch-file/'+id+'.3105',url).toString(),storage:'imported',controllerUniversal:true,studioImportID:importID,studioFeatures:ids.map(id=>supported.get(id)),sourceDigest:analysis.fileDigest,createdBy:user.username,createdAt:new Date().toISOString()};patches.push(patch);await savePatches(env,patches);}
  return json({ok:true,patch:{id:patch.id,name:patch.name},features:patch.studioFeatures,downloadURL:new URL('/api/studio/download?id='+patch.id,url).toString()},200);
 }catch(error){return json({ok:false,message:error.message||'ตรวจไฟล์ไม่สำเร็จ'},400);}
}
