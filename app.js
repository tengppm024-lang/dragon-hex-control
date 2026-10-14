'use strict';

const API_BASE = window.DRAGON_HEX_CONFIG.apiBase.replace(/\/$/, '');
const BUILD = window.DRAGON_HEX_CONFIG.buildNumber;
const $ = id => document.getElementById(id);

const defaultConfig=()=>({aimSystem:false,silentAim:false,noRecoil:false,espMaster:false,skeleton:false,distance:false,playerName:false,healthBar:false,topTracer:false,playerBox:false,fovCircle:false,target:'head',headshot:0,aimSystemTarget:'head',fovRadius:197});
const state = {
  key: '',
  expiresAt: null,
  deviceId: localStorage.getItem('dragonhex.web.device') || crypto.randomUUID(),
  config: defaultConfig(),
  catalogIds: null,
  nativeCatalog: null,
  nativeReady: false,
  presetScope: '',
  refreshing: false,
  nativeElements: new Map(),
  controlSupported: false
};
localStorage.setItem('dragonhex.web.device', state.deviceId);

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    signal: AbortSignal.timeout(15000),
    headers: { Accept: 'application/json', ...options.headers }
  });
  const data = await response.json().catch(() => { throw new Error('API ไม่ได้ส่งข้อมูล JSON'); });
  if (!response.ok || data.ok === false) throw Object.assign(new Error(data.message || `HTTP ${response.status}`), { status: response.status });
  return data;
}

function setApiStatus(mode, text) {
  $('api-state').className = `api-state ${mode}`;
  $('api-state').replaceChildren(document.createElement('i'), document.createTextNode(` ${text}`));
}

function setControlsEnabled(enabled) {
  document.querySelectorAll('.feature-toggle, .segmented button, #fov-radius').forEach(control => { control.disabled = !enabled || Boolean(control.dataset?.feature && state.catalogIds && !state.catalogIds.has(control.dataset.feature)); });
  state.nativeElements.forEach(({input})=>{input.disabled=!enabled || !state.nativeReady;});
  $('save').disabled = !enabled;
  $('reset-all').disabled = !enabled;
}

function renderConfig() {
  state.nativeElements.forEach(({input,field})=>{if(field.kind==='boolean')input.checked=Boolean(state.config[field.id]);else input.value=String(state.config[field.id]);if(field.id==='fovRadius' && $('native-fov-value'))$('native-fov-value').textContent=input.value+' px';});
  document.querySelectorAll('[data-aim-target]').forEach(button=>button.classList.toggle('active',button.dataset.aimTarget===state.config.aimSystemTarget));
  const radius=Math.max(0,Math.min(31,Math.round((state.config.fovRadius-50)/11.29)));
  $('fov-radius').value=String(radius);$('fov-value').textContent=`${Math.round(50+radius*11.29)} px`;
  document.querySelectorAll('.feature-toggle').forEach(input => { input.checked = Boolean(state.config[input.dataset.feature]); });
  document.querySelectorAll('[data-target]').forEach(button => button.classList.toggle('active', button.dataset.target === state.config.target));
  document.querySelectorAll('[data-headshot]').forEach(button => button.classList.toggle('active', Number(button.dataset.headshot) === Number(state.config.headshot)));
}

function renderNativeCatalog(catalog) {
  const root=$('native-controls');root.replaceChildren();root.hidden=false;
  document.querySelectorAll('.side-nav').forEach(nav=>{nav.hidden=true;});
  state.nativeCatalog=catalog.features;state.nativeReady=catalog.ready===true;
  state.controlSupported=state.controlSupported && state.nativeReady;
  state.nativeElements.clear();
  document.querySelectorAll('#esp-section,#aim-section,#tuning-section').forEach(section=>{section.hidden=true;});
  const nav=document.createElement('nav');nav.className='native-nav';nav.setAttribute('aria-label','หมวดฟังก์ชั่น');
  for(const group of ['ESP','AIM','MISC','COLORS','ONLINE','SETTINGS']){const link=document.createElement('a');link.href='#native-'+group.toLowerCase();link.textContent=group;nav.append(link);}root.append(nav);
  for(const group of ['ESP','AIM','MISC','COLORS','ONLINE','SETTINGS']){
    const section=document.createElement('section');section.className='control-section';section.id='native-'+group.toLowerCase();
    const title=document.createElement('div');title.className='section-title';const heading=document.createElement('h2');heading.textContent=group;title.append(heading);section.append(title);
    if(group==='ONLINE'){const info=document.createElement('p');info.id='native-online-state';info.className='muted';info.textContent='สถานะการเชื่อมต่อจะอัปเดตจากเกม';section.append(info);root.append(section);continue;}
    const cards=document.createElement('div');cards.className='native-grid native-grid--toggles';
    const settings=document.createElement('div');settings.className='native-grid native-grid--settings';
    for(const field of catalog.features.filter(f=>f.group===group)){
      const card=document.createElement('label');card.className='native-card '+(field.kind==='boolean'?'native-switch-card':'native-setting-card');
      const name=document.createElement('strong');name.textContent=field.label;card.append(name);
      let input;
      if(field.kind==='select'){
        input=document.createElement('select');for(const option of field.options){const o=document.createElement('option');o.value=String(option.value);o.textContent=option.label;input.append(o);}
      }else{input=document.createElement('input');input.type=field.kind==='boolean'?'checkbox':field.id==='fovRadius'?'range':'number';if(field.kind==='integer'){input.min=String(field.min);input.max=String(field.max);input.step='1';input.required=true;}}
      input.setAttribute('aria-label',field.label);input.dataset.nativeSetting=field.id;
      const existing=state.config[field.id];state.config[field.id]=field.kind==='boolean'?(typeof existing==='boolean'?existing:field.default):Number.isInteger(existing)?Math.max(field.min,Math.min(field.max,existing)):field.default;
      input.onchange=()=>{if(field.kind==='boolean')state.config[field.id]=input.checked;else if(input.validity.valid)state.config[field.id]=Number(input.value);$('save-status').textContent='UNSAVED CHANGES';};
      card.append(input);if(field.kind==='boolean'){const track=document.createElement('span');track.className='native-switch';track.setAttribute('aria-hidden','true');card.append(track);const note=document.createElement('small');note.className='native-switch-state';note.setAttribute('aria-hidden','true');card.append(note);}if(field.id==='fovRadius'){card.classList.add('native-fov-card');const value=document.createElement('output');value.id='native-fov-value';value.textContent=state.config[field.id]+' px';card.append(value);input.oninput=()=>{state.config[field.id]=Number(input.value);value.textContent=input.value+' px';$('save-status').textContent='ยังไม่ได้บันทึก';};}if(field.kind==='integer'){const bounds=document.createElement('small');bounds.textContent=field.min+' – '+field.max;card.append(bounds);}(field.kind==='boolean'?cards:settings).append(card);state.nativeElements.set(field.id,{input,field});
    }
    if(cards.childElementCount)section.append(cards);if(settings.childElementCount)section.append(settings);root.append(section);
  }
  document.querySelectorAll('a[href="#esp-section"],a[href="#aim-section"],a[href="#tuning-section"]').forEach(link=>{link.dataset.originalHref=link.getAttribute('href');link.href=link.dataset.originalHref==='#esp-section'?'#native-esp':link.dataset.originalHref==='#aim-section'?'#native-aim':'#native-settings';});
  $('imported-catalog').hidden=true;$('imported-catalog').textContent='';
  $('control-warning').hidden=true;
  $('control-warning').textContent='';
  renderConfig();
}

async function probe() {
  try {
    const root = await request('/');
    $('api-version').textContent = root.version || 'ONLINE';
    setApiStatus('online', 'API ONLINE');
  } catch {
    setApiStatus('offline', 'API OFFLINE');
  }
}

async function authenticate(key) {
  return request('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, deviceId: state.deviceId, build: BUILD })
  });
}

async function loadDashboard() {
  const sessionKey=state.key;
  const status = await request(`/api/status?build=${encodeURIComponent(BUILD)}`).catch(() => null);
  if(state.key!==sessionKey)return;
  if (status?.maintenance) {
    $('maintenance').hidden = false;
    $('maintenance').textContent = `MAINTENANCE — ${status.message || 'ระบบกำลังปิดปรับปรุง'}`;
  }

  // Load configuration for the same device identity embedded in its downloaded patch.
  try {
    const data = await request(`/api/device-config?deviceId=${encodeURIComponent(state.deviceId)}&build=${encodeURIComponent(BUILD)}`, { headers: { Authorization: `Bearer ${state.key}` } });
    if(state.key!==sessionKey)return;
    state.config = { ...defaultConfig(), ...data.config };
    if(state.config.target==='neck')state.config.target='head';
    state.controlSupported = true;
    $('sync-label').textContent = 'WAITING FOR GAME';
    $('control-warning').hidden = true;
  } catch (error) {
    if(state.key!==sessionKey)return;
    if([401,403].includes(error.status)){endSession(error.message);return;}
    state.controlSupported = false;
    $('sync-label').textContent = error.status === 404 ? 'ยังไม่พร้อมใช้งาน' : 'UNAVAILABLE';
    $('control-warning').hidden = false;
    $('control-warning').textContent = error.status === 404
      ? 'ไม่สามารถเชื่อมต่ออุปกรณ์ได้ กรุณาลองใหม่อีกครั้ง'
      : 'โหลดสถานะอุปกรณ์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
  }
  renderConfig();
  setControlsEnabled(state.controlSupported && !status?.maintenance);
  try {
    const catalog = await request(`/api/feature-catalog?build=${encodeURIComponent(BUILD)}`, { headers: { Authorization: `Bearer ${sessionKey}` } });
    if (state.key === sessionKey && Array.isArray(catalog.features) && catalog.features.length) {
      if(catalog.receiverVariant==='dragonx' && catalog.features.every(f=>f.kind)){renderNativeCatalog(catalog);setControlsEnabled(state.controlSupported && !status?.maintenance);await refreshRuntime();return;}
      const known = defaultConfig();
      const imported = catalog.features.filter(f => typeof known[f.id] === 'boolean');
      if (imported.length) {
        state.catalogIds = new Set(imported.map(f => f.id));
        document.querySelectorAll('.feature-toggle').forEach(input => {
          const available = state.catalogIds.has(input.dataset.feature);
          const card = input.closest?.('.control-card');
          if (card) card.hidden = !available;
          if(card && catalog.receiverVariant==='dragonx'){
            const title=card.querySelector('strong');
            if(title){card.dataset.originalTitle ||= title.textContent;title.textContent=imported.find(f=>f.id===input.dataset.feature)?.label || title.textContent;}
            const description=card.querySelector('small');
            if(description){card.dataset.originalDescription ||= description.textContent;description.textContent='สถานะจากเมนู DRAGONx';}
          }
          if (!available) state.config[input.dataset.feature] = false;
        });
        renderConfig();
        setControlsEnabled(state.controlSupported && !status?.maintenance);
        if(catalog.receiverVariant==='dragonx')document.querySelectorAll('#tuning-section .setting').forEach(setting=>{setting.hidden=!setting.querySelector('#fov-radius');});
      }
      $('imported-catalog').hidden = true;
      $('imported-catalog').textContent = '';
    }
  } catch (error) { if (state.key === sessionKey && [401,403].includes(error.status)) endSession(error.message); }
  await refreshRuntime();
}

async function refreshRuntime() {
  if (!state.key || $('dashboard').hidden) return;
  const sessionKey=state.key;
  try {
    const data = await request(`/api/runtime-status?deviceId=${encodeURIComponent(state.deviceId)}&build=${encodeURIComponent(BUILD)}`, { headers: { Authorization: `Bearer ${state.key}` } });
    if(state.key!==sessionKey)return;
    if(state.nativeCatalog && !state.nativeReady){if(data.receiverVersion===3){await loadDashboard();return;}$('runtime-state').textContent='กรุณาเปิดแอปเพื่อเชื่อมต่ออุปกรณ์';$('sync-label').textContent='รอเชื่อมต่ออุปกรณ์';if($('native-online-state'))$('native-online-state').textContent=$('runtime-state').textContent;return;}
    if(data.upgradeRequired){$('runtime-state').textContent='กรุณาเชื่อมต่ออุปกรณ์ก่อนใช้งาน';$('sync-label').textContent='รอเชื่อมต่ออุปกรณ์';return;}
    $('runtime-state').textContent = data.online ? (data.applied ? 'เกมรับและใช้ค่าล่าสุดแล้ว' : 'เกมเชื่อมต่อแล้ว กำลังรอใช้ค่าล่าสุด') : 'ยังไม่มีการตอบกลับจากเกม';
    $('sync-label').textContent = data.online ? (data.applied ? 'GAME STATE CONFIRMED' : 'STATE NOT MATCHED') : 'WAITING FOR GAME';
    if(data.online && data.applied)$('runtime-state').textContent='อุปกรณ์ยืนยันค่าตรงกับการตั้งค่าล่าสุดแล้ว';
    if($('native-online-state'))$('native-online-state').textContent=$('runtime-state').textContent;
  } catch (error) {
    if(state.key!==sessionKey)return;
    if([401,403].includes(error.status)){endSession(error.message);return;}
    $('runtime-state').textContent = 'ตรวจสอบการเชื่อมเกมไม่ได้';
  }
}

setInterval(refreshRuntime, 5000);
function updateExpiry(){
  if(!state.key)return;
  if(!state.expiresAt){$('key-countdown').textContent='ไม่จำกัดเวลา';$('key-expiry').textContent='คีย์ไม่มีวันหมดอายุ';return;}
  const expires=Date.parse(state.expiresAt),left=expires-Date.now();
  if(!Number.isFinite(expires) || left<=0){endSession('คีย์หมดอายุ ไม่สามารถใช้คีย์นี้เข้าสู่ระบบได้อีก');return;}
  const total=Math.ceil(left/1000),days=Math.floor(total/86400),hours=Math.floor(total%86400/3600),minutes=Math.floor(total%3600/60),seconds=total%60;
  $('key-countdown').textContent=(days?`${days} วัน `:'')+[hours,minutes,seconds].map(v=>String(v).padStart(2,'0')).join(':');
  $('key-expiry').textContent='หมดอายุ '+new Date(expires).toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'medium'});
  $('key-status').textContent=left<3600000?'ใกล้หมดอายุ':'ACTIVE';
  $('key-countdown').classList.toggle('expiring',left<3600000);
}
setInterval(updateExpiry,1000);

function endSession(message='') {
  state.key='';state.expiresAt=null;state.controlSupported=false;state.catalogIds=null;
  state.presetScope='';$('preset-name').value='';$('preset-feedback').textContent='';renderPresetList();
  state.nativeCatalog=null;state.nativeReady=false;state.nativeElements.clear();$('native-controls').replaceChildren();$('native-controls').hidden=true;
  document.querySelectorAll('.side-nav').forEach(nav=>{nav.hidden=false;});
  document.querySelectorAll('a[data-original-href]').forEach(link=>{link.href=link.dataset.originalHref;});
  document.querySelectorAll('#esp-section,#aim-section,#tuning-section').forEach(section=>{section.hidden=false;});
  document.querySelectorAll('.feature-toggle').forEach(input=>{const card=input.closest?.('.control-card');if(card){card.hidden=false;if(card.dataset.originalTitle)card.querySelector('strong').textContent=card.dataset.originalTitle;if(card.dataset.originalDescription)card.querySelector('small').textContent=card.dataset.originalDescription;}});
  document.querySelectorAll('#tuning-section .setting').forEach(setting=>{setting.hidden=false;});
  $('imported-catalog').hidden=true;$('imported-catalog').textContent='';
  state.config={aimSystem:false,silentAim:false,noRecoil:false,target:'head',headshot:0};
  $('key').value='';$('dashboard').hidden=true;$('login-view').hidden=false;
  $('login-feedback').textContent=message;
  window.location.hash='login';$('key-countdown').textContent='—';$('key-expiry').textContent='—';
  setControlsEnabled(false);renderConfig();
}

$('show-key').onclick = () => {
  const input = $('key');
  input.type = input.type === 'password' ? 'text' : 'password';
  $('show-key').textContent = input.type === 'password' ? 'SHOW' : 'HIDE';
};

$('login-form').onsubmit = async event => {
  event.preventDefault();
  const button = $('login-button');
  const feedback = $('login-feedback');
  state.config = defaultConfig();
  state.controlSupported = false;
  $('maintenance').hidden = true;
  $('save-status').textContent = 'READY TO SAVE';
  state.key = $('key').value.trim();
  button.disabled = true;
  feedback.textContent = 'กำลังตรวจสอบคีย์…';
  try {
    if(new TextEncoder().encode('key:'+state.key).length>512)throw new Error('คีย์ยาวเกินรูปแบบที่ระบบรองรับ กรุณาวางเฉพาะ Access Key เดียวกับที่ใช้ล็อกอิน IPA');
    const auth = await authenticate(state.key);
    if(auth.expiresAt && (!Number.isFinite(Date.parse(auth.expiresAt)) || Date.now()>=Date.parse(auth.expiresAt)))throw new Error('คีย์หมดอายุ');
    if (!auth.valid) throw new Error(auth.message || 'คีย์ไม่ถูกต้อง');
    state.presetScope=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(state.key)))).map(b=>b.toString(16).padStart(2,'0')).join('');
    renderPresetList();
    state.expiresAt=auth.expiresAt || null;
    $('key-status').textContent = auth.expiresAt ? `ACTIVE · ${new Date(auth.expiresAt).toLocaleDateString('th-TH')}` : 'ACTIVE';
    $('device-label').textContent = '1 KEY · 1 USER';
    $('login-view').hidden = true;
    $('dashboard').hidden = false;
    feedback.textContent = '';
    window.location.hash='control';updateExpiry();
    await loadDashboard();
  } catch (error) {
    feedback.textContent = error.message || 'เชื่อมต่อไม่สำเร็จ';
    state.key = '';
  } finally {
    button.disabled = false;
  }
};

document.querySelectorAll('.feature-toggle').forEach(input => {
  input.onchange = () => { state.config[input.dataset.feature] = input.checked; $('save-status').textContent = 'UNSAVED CHANGES'; };
});
document.querySelectorAll('[data-target]').forEach(button => {
  button.onclick = () => { state.config.target = button.dataset.target; renderConfig(); $('save-status').textContent = 'UNSAVED CHANGES'; };
});
$('fov-radius').oninput=()=>{state.config.fovRadius=Math.round(50+Number($('fov-radius').value)*11.29);renderConfig();$('save-status').textContent='UNSAVED CHANGES';};
document.querySelectorAll('[data-aim-target]').forEach(button=>{button.onclick=()=>{state.config.aimSystemTarget=button.dataset.aimTarget;renderConfig();$('save-status').textContent='UNSAVED CHANGES';};});

document.querySelectorAll('[data-headshot]').forEach(button => {
  button.onclick = () => { state.config.headshot = Number(button.dataset.headshot); renderConfig(); $('save-status').textContent = 'UNSAVED CHANGES'; };
});

async function persistConfig(reset = false) {
  if (!state.key || !state.controlSupported || $('save').disabled || !$('maintenance').hidden) return;
  if(!reset && [...state.nativeElements.values()].some(({input})=>input.validity && !input.validity.valid)){$('save-status').textContent='กรุณาตรวจค่าที่อยู่นอกช่วง';return;}
  if(!reset)state.nativeElements.forEach(({input,field})=>{state.config[field.id]=field.kind==='boolean'?input.checked:Number(input.value);});
  if (reset) { state.config = state.nativeCatalog?Object.fromEntries(state.nativeCatalog.map(f=>[f.id,f.default])):defaultConfig(); renderConfig(); }
  const sessionKey=state.key;
  const button = $('save');
  button.disabled = true;
  $('reset-all').disabled = true;
  $('save-status').textContent = reset ? 'กำลังรีเซ็ตทุกฟังก์ชั่น…' : 'SYNCING…';
  try {
    await request('/api/device-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.key}` },
      body: JSON.stringify({ deviceId: state.deviceId, build: BUILD, config: state.config })
    });
    if(state.key!==sessionKey)return;
    $('save-status').textContent = reset ? 'รีเซ็ตและบันทึกแล้ว' : 'บันทึกและส่งแล้ว';
    if(!reset)storePreset('บันทึก '+new Date().toLocaleString('th-TH')); 
    await refreshRuntime();
  } catch (error) {
    if(state.key!==sessionKey)return;
    if([401,403].includes(error.status)){endSession(error.message);return;}
    $('save-status').textContent = `SYNC FAILED · ${error.message}`;
  } finally {
    button.disabled = !state.key || !state.controlSupported || !$('maintenance').hidden;
    $('reset-all').disabled = button.disabled;
  }
}
$('save').onclick = () => persistConfig();
$('reset-all').onclick = () => persistConfig(true);


function collectCurrentConfig(){
  if([...state.nativeElements.values()].some(({input})=>input.validity&&!input.validity.valid))throw new Error('กรุณาตรวจค่าที่อยู่นอกช่วง');
  state.nativeElements.forEach(({input,field})=>{state.config[field.id]=field.kind==='boolean'?input.checked:Number(input.value);});
  return JSON.parse(JSON.stringify(state.config));
}
function readPresets(){try{const value=JSON.parse(localStorage.getItem('dragonhex.presets.'+state.presetScope)||'[]');return Array.isArray(value)?value.filter(x=>x&&typeof x.id==='string'&&typeof x.name==='string'&&x.config&&typeof x.config==='object').slice(0,10):[];}catch{return [];}}
function renderPresetList(){
  const select=$('preset-list');if(!select)return;select.replaceChildren();
  const empty=document.createElement('option');empty.value='';empty.textContent='เลือกชุดการตั้งค่า';select.append(empty);
  if(state.presetScope)for(const item of readPresets()){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;select.append(option);}
  $('restore-preset').disabled=!state.key||!state.presetScope;
  $('save-preset').disabled=!state.key||!state.presetScope;
}
function storePreset(name){
  if(!state.presetScope)return;
  try{const item={id:crypto.randomUUID(),name:name.slice(0,60),savedAt:Date.now(),config:collectCurrentConfig(),native:Boolean(state.nativeCatalog)};const list=[item,...readPresets()].slice(0,10);localStorage.setItem('dragonhex.presets.'+state.presetScope,JSON.stringify(list));renderPresetList();$('preset-list').value=item.id;$('preset-feedback').textContent='เก็บชุดการตั้งค่าแล้ว';}
  catch{$('preset-feedback').textContent='เก็บชุดการตั้งค่าไม่ได้ กรุณาตรวจค่าหรือพื้นที่เบราว์เซอร์';}
}
$('save-preset').onclick=()=>{if(!state.key)return;const name=$('preset-name').value.trim()||'ชุดการตั้งค่า '+new Date().toLocaleString('th-TH');storePreset(name);};
$('restore-preset').onclick=()=>{
  if(!state.key)return;const item=readPresets().find(x=>x.id===$('preset-list').value);if(!item){$('preset-feedback').textContent='กรุณาเลือกชุดการตั้งค่า';return;}
  if(item.native!==Boolean(state.nativeCatalog)){$('preset-feedback').textContent='ชุดนี้ไม่ตรงกับเมนูปัจจุบัน';return;}
  const next=state.nativeCatalog?Object.fromEntries(state.nativeCatalog.map(f=>[f.id,f.kind==='boolean'?(typeof item.config[f.id]==='boolean'?item.config[f.id]:f.default):(Number.isInteger(item.config[f.id])?Math.max(f.min,Math.min(f.max,item.config[f.id])):f.default)])):{...defaultConfig(),...item.config};
  state.config=next;renderConfig();$('save-status').textContent='เรียกคืนแล้ว · ยังไม่ได้ส่ง';$('preset-feedback').textContent='เรียกคืนแล้ว กดบันทึกและส่งเพื่อใช้งาน';
};
$('refresh-status').onclick=async()=>{
  if(!state.key||state.refreshing)return;state.refreshing=true;const button=$('refresh-status');button.disabled=true;button.classList.add('refreshing');$('status-updated').textContent='กำลังตรวจสถานะ…';
  try{await probe();await refreshRuntime();if(state.key)$('status-updated').textContent='ตรวจล่าสุด '+new Date().toLocaleTimeString('th-TH');}finally{state.refreshing=false;button.disabled=!state.key;button.classList.remove('refreshing');}
};

$('logout').onclick = () => {
  endSession();
};

window.location.hash='login';
setControlsEnabled(false);
probe();


