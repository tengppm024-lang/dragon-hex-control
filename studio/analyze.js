const studioKnownFeatures = [
 ['espMaster','ESP Master','ESP'],['skeleton','Skeleton','ESP'],['distance','Distance','ESP'],
 ['playerName','Player Name','ESP'],['healthBar','Health Bar','ESP'],['topTracer','Top Tracer','ESP'],
 ['playerBox','Player Box','ESP'],['silentAim','Silent Aim','AIM'],['aimSystem','Aim System','AIM'],
 ['fovCircle','FOV Circle','AIM'],['noRecoil','No Recoil','AIM']
];
export async function studioDigest(bytes) {
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
}
export function studioPlist(bytes) {
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),n=bytes.length;
 if(n<40 || new TextDecoder().decode(bytes.slice(0,8))!=='bplist00')throw Error('ไม่ใช่ binary plist ที่รองรับ');
 const uint=(p,s)=>{if(s<1||s>8||p<0||p+s>n)throw Error('ขนาดข้อมูลไม่ถูกต้อง');let x=0n;for(let i=0;i<s;i++)x=x*256n+BigInt(bytes[p+i]);if(x>BigInt(Number.MAX_SAFE_INTEGER))throw Error('ข้อมูลเกินขนาด');return Number(x)};
 const os=bytes[n-26],rs=bytes[n-25],count=uint(n-24,8),root=uint(n-16,8),table=uint(n-8,8);
 if(count>100000||!count||root>=count||table+count*os>n-32)throw Error('ตารางข้อมูลไม่ถูกต้อง');
 const cache=new Map(),active=new Set();
 function object(id,depth=0){
  if(id>=count||depth>40||active.has(id))throw Error('โครงสร้างไฟล์ไม่ถูกต้อง');if(cache.has(id))return cache.get(id);
  active.add(id);let p=uint(table+id*os,os),m=bytes[p++],type=m>>4,len=m&15,out;
  if([4,5,6,10,13].includes(type)&&len===15){const lm=bytes[p++];if(lm>>4!==1)throw Error('ขนาดข้อมูลไม่ถูกต้อง');const size=2**(lm&15);len=uint(p,size);p+=size;}
  if(len>1000000)throw Error('ข้อมูลยาวเกินไป');
  const range=size=>{if(p+size>table)throw Error('ข้อมูลไฟล์ไม่ครบ')};
  if(type===0)out=m===9?true:m===8?false:null;
  else if(type===1||type===8)out=uint(p,type===8?len+1:2**len);
  else if(type===2){range(2**len);out=len===2?v.getFloat32(p):len===3?v.getFloat64(p):null;}
  else if(type===3){range(8);out=new Date((v.getFloat64(p)+978307200)*1000);}
  else if(type===4){range(len);out=bytes.slice(p,p+len);}
  else if(type===5||type===6){const size=len*(type===6?2:1);range(size);out=new TextDecoder(type===6?'utf-16be':'utf-8',{fatal:true,ignoreBOM:false}).decode(bytes.slice(p,p+size));}
  else if(type===10){range(len*rs);out=Array.from({length:len},(_,i)=>object(uint(p+i*rs,rs),depth+1));}
  else if(type===13){range(len*rs*2);out=Object.create(null);for(let i=0;i<len;i++){const key=object(uint(p+i*rs,rs),depth+1);if(typeof key!=='string')throw Error('ชื่อข้อมูลไม่ถูกต้อง');out[key]=object(uint(p+(len+i)*rs,rs),depth+1);}}
  else throw Error('ชนิดข้อมูล plist ไม่รองรับ');
  active.delete(id);cache.set(id,out);return out;
 }
 return object(root);
}
export function studioIFixStrings(bytes) {
 let p=8;const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.length);
 const need=n=>{if(p+n>bytes.length)throw Error('ข้อมูล IFix ไม่ครบ')};
 const num=()=>{need(4);const n=view.getInt32(p,true);p+=4;return n};
 const count=()=>{const n=num();if(n<0||n>100000)throw Error('จำนวนข้อมูล IFix ไม่ถูกต้อง');return n};
 const flag=()=>{need(1);return !!bytes[p++]};
 const str=()=>{let n=0,m=1,b;for(let i=0;i<5;i++){need(1);b=bytes[p++];n+=(b&127)*m;if(b<128)break;m*=128;}if(b>=128||n>1000000)throw Error('ข้อความ IFix ไม่ถูกต้อง');need(n);const s=new TextDecoder('utf-8',{fatal:true,ignoreBOM:false}).decode(bytes.slice(p,p+n));p+=n;return s};
 str();for(let n=count();n--;)str();
 for(let n=count();n--;){const c=count();need(c*8);p+=c*8;const h=count();need(h*24);p+=h*24;}
 for(let n=count();n--;){const generic=flag();num();str();if(generic)for(let g=count();g--;)num();for(let a=count();a--;)generic&&flag()?str():num();}
 return Array.from({length:count()},str);
}
export async function studioAnalyze(bytes,fileName='patch.3105') {
 if(bytes.length>5*1024*1024)throw Error('ไฟล์ต้องไม่เกิน 5 MB');
 if(new TextDecoder().decode(bytes.slice(0,10))!=='3105PATCH\0')throw Error('ไฟล์นี้ไม่ใช่แพ็กเกจ 3105 ที่รองรับ');
 const envelope=studioPlist(bytes.slice(10));
 if(envelope.isPasswordProtected)throw Error('ไฟล์มีรหัสผ่าน ต้องส่งรูปแบบการถอดรหัสของเมนูนี้ก่อน ระบบจะไม่ข้ามรหัสผ่าน');
 if(!(envelope.publicContentKey instanceof Uint8Array)||!(envelope.encryptedPayload instanceof Uint8Array))throw Error('ไม่มีข้อมูลถอดรหัสสาธารณะที่รองรับ');
 let plain;try{const key=await crypto.subtle.importKey('raw',envelope.publicContentKey,'AES-GCM',false,['decrypt']);const e=envelope.encryptedPayload;plain=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:e.slice(0,12),additionalData:new TextEncoder().encode(`3105PATCH/v1/payload/${envelope.packageID}`)},key,e.slice(12)));}catch{throw Error('รูปแบบการเข้ารหัสต่างจากที่รองรับ หรือไฟล์เสีย');}
 const payload=studioPlist(plain),rules=payload.project?.rules;
 if(!Array.isArray(rules))throw Error('ไม่พบรายการไฟล์แพตช์');
 let supported=false,labels=[],patches=[];
 for(const rule of rules){if(!(rule.replacementData instanceof Uint8Array))continue;const hash=await studioDigest(rule.replacementData);patches.push({name:rule.replacementFilename,digest:hash});
  if(rule.replacementFilename==='Assembly-CSharp-patch.bytes'){
   supported=['d80ae0aa4d80d96a2c4297a2cd128176022cd97769f7e07cf2a22beb2de8c083','5bc543a031366d85abfda95684b87550e812eb9ee7f56457f500651517d7165f'].includes(hash); // Filled from verified local artifacts during preparation.
   try{labels.push(...studioIFixStrings(rule.replacementData));}catch{ /* Unknown interpreter remains unsupported. */ }
  }
 }
 supported = supported && rules.length===2 && rules.every(r=>r.bundleID==='com.dts.freefireth' && r.relativePath==='Documents/'+r.replacementFilename) && patches.some(p=>p.name==='localConfig.json'&&p.digest==='5976a001cb412cc300aa343d36b8bb113d7c3122daf22306e69cb43677f88c29');
 const features=supported?studioKnownFeatures.map(([id,label,group])=>({id,label,group,supported:true})):
 [...new Set(labels.filter(s=>s.length<=80&&/\b(?:ESP|AIM|AIMBOT|FOV|RECOIL|SKELETON|TRACER|HEALTH|DISTANCE|CHAMS|WALLHACK|SPEED|PLAYER BOX|PLAYER NAME)\b/i.test(s)&&!/^__/.test(s)))].slice(0,60).map((label,i)=>({id:`detected_${i}`,label,group:'DETECTED',supported:false}));
 return {fileName,fileDigest:await studioDigest(bytes),packageID:envelope.packageID,name:payload.project.name||fileName,patches,features,supported,message:supported?'พบตัวเชื่อมที่ตรวจสอบแล้ว':'ตรวจชื่อได้บางส่วน แต่ยังไม่มีตัวเชื่อมสถานะสำหรับเมนูนี้ จึงยังสร้างไฟล์ควบคุมจริงไม่ได้'};
}
