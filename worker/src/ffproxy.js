// Contract audited against the supplied IFix receiver and its public menu.
const boolean = (id,label,group) => ({id,label,group,kind:'boolean',default:false});
const integer = (id,label,group,min,max,value,step=1) => ({id,label,group,kind:'integer',min,max,default:value,step});
const select = (id,label,group,labels,value=0) => ({id,label,group,kind:'select',min:0,max:labels.length-1,default:value,options:labels.map((label,value)=>({label,value}))});
export const FFPROXY_CONTROLS = [
  ...[
    ['espBox','Player Box'],['espLine','Top Tracer'],['espHealth','Health Bar'],['espName','Player Name'],['espDistance','Distance'],['espSkeleton','Skeleton'],['espCount','Enemy Count'],['espAlert','Enemy Alert'],['espRadar','Radar'],['espRadarMove','Move Radar'],['bombEsp','Bomb / Mine ESP'],['skillCdEsp','Skill Cooldown ESP']
  ].map(([id,label])=>boolean(id,label,'ESP')),
  ...[['aimSilent','Silent Aim'],['aimSystem','Aim System'],['aimBot','Aimbot'],['showFov','FOV Circle'],['aimLine','Aim Line'],['skipKnocked','Skip Knocked Players'],['wallCheck','Wall Check'],['noSpread','No Spread']].map(([id,label])=>boolean(id,label,'AIM')),
  {...boolean('checkHacker','Player Detection','ESP'),disabled:true,note:'ยังไม่มีข้อมูลจากระบบตรวจจับ'},
  select('aimTarget','Aim Target','AIM',['Head','Neck','Chest']),
  select('aimMode','Aim Activation','AIM',['Sighting','Firing','Always']),
  select('aimPriority','Target Priority','AIM',['Crosshair','Nearest','Farthest']),
  integer('headRate','Headshot Rate','AIM',1,100,75),
  integer('fovRadius','Silent Aim FOV','AIM',50,500,150,10),
  integer('aimbotFovRadius','Aimbot FOV','AIM',50,500,150,10),
  integer('aimDistance','Aim Distance','AIM',0,150,150,5),
  ...[['highJump','High Jump'],['autoSwap','Auto Weapon Swap'],['flyAura','Fly Aura'],['spinBot','Spin Bot'],['fastSwitch','Fast Weapon Switch'],['aimKill','Aim Kill'],['hideDamage','Hide Damage Numbers'],['fastFire','Fast Fire'],['fastMedikit','Fast Medikit'],['speedHack','Speed'],['spoofName','Custom Player Name']].map(([id,label])=>boolean(id,label,'MISC')),
  select('fastFireLevel','Fast Fire Level','MISC',['Off','Level 1','Level 2','Level 3']),
  select('aimKillLevel','Aim Kill Level','MISC',['Level 1','Level 2','Level 3','Level 4'],2),
  select('aimKillDamage','Aim Kill Damage','MISC',['100','300','600','999']),
  integer('speedScale','Speed Scale','MISC',100,150,100),
  {id:'spoofText',label:'Player Name',group:'MISC',kind:'text',maxLength:24,default:''},
  boolean('espColor','Custom ESP Style','COLORS'),
  {id:'espCustomColor',label:'ESP Color',group:'COLORS',kind:'color',default:'#00ff64'},
  select('espThickness','ESP Line Width','COLORS',['1.5 px','1.8 px','2.1 px','2.4 px','2.7 px','3.0 px','3.3 px','3.6 px']),
  ...[['skinLook','Character Look'],['skinTitle','Title'],['skinEmote','Emote'],['skinWeapon','Weapon Skin'],['skinFinalShot','Final Shot']].map(([id,label])=>boolean(id,label,'SKINS')),
  ...[['lookId','Character ID'],['titleId','Title ID'],['emoteId','Emote ID'],['weaponId','Weapon Skin ID'],['finalShotId','Final Shot ID']].map(([id,label])=>integer(id,label,'SKINS',0,2147483647,0))
];
export const FFPROXY_V2_CONTROLS = [...FFPROXY_CONTROLS.filter(f=>!['highJump','flyAura'].includes(f.id)),boolean('aimWeaponStats','Aim Weapon Stats','AIM')];
export const ffproxyControls = revision => revision===2?FFPROXY_V2_CONTROLS:FFPROXY_CONTROLS;
const validValue = (f,v) => f.disabled?v===f.default:f.kind==='boolean'?typeof v==='boolean':f.kind==='color'?typeof v==='string'&&/^#[a-f0-9]{6}$/i.test(v):f.kind==='text'?typeof v==='string'&&v.length<=f.maxLength&&!/["\\\r\n\[\]]/.test(v):Number.isInteger(v)&&v>=f.min&&v<=f.max&&(f.kind!=='select'||f.options.some(o=>o.value===v));
export const normalizeFfproxy = (input={},revision=1) => Object.fromEntries(ffproxyControls(revision).map(f=>[f.id,validValue(f,input[f.id])?input[f.id]:f.default]));
export const validFfproxy = (input,revision=1) => !!input&&typeof input==='object'&&!Array.isArray(input)&&ffproxyControls(revision).every(f=>validValue(f,input[f.id]));
export function ffproxyPacket(input,revision=1) {
  const c=normalizeFfproxy(input,revision);
  let state=0,aux=0;
  const stateBits={espBox:1,espLine:2,espHealth:3,espName:4,espDistance:5,showFov:6,espCount:7,aimLine:8,spinBot:9,fastSwitch:12,aimKill:14,aimSilent:15,espAlert:19,espRadar:20,checkHacker:27,noSpread:18,hideDamage:31};
  for(const [id,bit] of Object.entries(stateBits))if(c[id])state|=1<<bit;
  if(['espBox','espLine','espHealth','espName','espDistance','espSkeleton','espCount','espAlert','bombEsp','skillCdEsp','espColor'].some(id=>c[id]))state|=1;
  if(c.aimSilent)state|=2<<16;
  if(c.espRadar&&c.espRadarMove)state|=1<<21;
  if(c.aimSystem||c.aimBot){
    state|=1<<22;
    if(c.aimTarget===0)state|=1<<23;
    if(c.aimTarget===1)state|=1<<24;
    if(c.aimSystem)state|=(1<<25)|(1<<26);
    else if(c.aimMode===1)state|=1<<26;
    else if(c.aimMode===2)state|=1<<25;
  }
  if(c.espSkeleton)aux|=1;
  if(c.skipKnocked)aux|=4;
  aux|=Math.round((c.fovRadius-50)/10)<<3;
  aux|=Math.round((c.aimbotFovRadius-50)/10)<<15;
  if(c.fastMedikit)aux|=1<<14;
  if(c.fastFire)aux|=(1<<11)|(c.fastFireLevel<<12);
  if(c.espColor)aux|=c.espThickness<<25;
  if(c.aimKill)aux|=((c.aimKillLevel&1)<<10)|(((c.aimKillLevel>>1)&1)<<28)|((c.aimKillDamage&1)<<29)|(((c.aimKillDamage>>1)&1)<<30);
  // The original receiver uses the same bit for wall checking and far priority.
  if(c.wallCheck||(c.aimBot&&c.aimPriority===2))aux|=1<<9;
  if(c.aimBot&&c.aimPriority===1)aux|=1<<24;
  const flags=['skinLook','skinTitle','skinEmote','skinWeapon','skinFinalShot'].reduce((mask,id,i)=>mask|(c[id]?1<<i:0),0);
  // Its parser uses Int32.TryParse, so high-bit masks must be signed.
  const packet={licensed:true,state:state|0,aux:aux|0,headRate:c.headRate,fovRadius:c.fovRadius,aimbotFovRadius:c.aimbotFovRadius,aimDistance:c.aimDistance,aimChest:c.aimTarget===2,bombEsp:c.bombEsp,skillCdEsp:c.skillCdEsp,highJump:c.highJump,autoSwap:c.autoSwap,flyAura:c.flyAura,fastFireLevel:c.fastFire?c.fastFireLevel:0,fastReloadPercent:0,speedScale:c.speedHack?c.speedScale:100,spoofName:c.spoofName,spoofText:c.spoofName?c.spoofText:'',espCustomColor:c.espCustomColor,hackerCount:0,hackers:'',flags,lookId:c.lookId,titleId:c.titleId,emoteId:c.emoteId,weaponId:c.weaponId,finalShotId:c.finalShotId};
  if(revision===2){delete packet.highJump;delete packet.flyAura;packet.aimWeaponStats=c.aimWeaponStats;}
  return packet;
}

