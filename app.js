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
  $('save').disabled = !enabled;
  $('reset-all').disabled = !enabled;
}

function renderConfig() {
  document.querySelectorAll('[data-aim-target]').forEach(button=>button.classList.toggle('active',button.dataset.aimTarget===state.config.aimSystemTarget));
  const radius=Math.max(0,Math.min(31,Math.round((state.config.fovRadius-50)/11.29)));
  $('fov-radius').value=String(radius);$('fov-value').textContent=`${Math.round(50+radius*11.29)} px`;
  document.querySelectorAll('.feature-toggle').forEach(input => { input.checked = Boolean(state.config[input.dataset.feature]); });
  document.querySelectorAll('[data-target]').forEach(button => button.classList.toggle('active', button.dataset.target === state.config.target));
  document.querySelectorAll('[data-headshot]').forEach(button => button.classList.toggle('active', Number(button.dataset.headshot) === Number(state.config.headshot)));
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
    $('sync-label').textContent = error.status === 404 ? 'API UPDATE NEEDED' : 'UNAVAILABLE';
    $('control-warning').hidden = false;
    $('control-warning').textContent = error.status === 404
      ? 'API นี้ยังไม่มี /api/device-config จึงปิดสวิตช์ไว้เพื่อไม่ให้แสดงผลสำเร็จปลอม ต้องเพิ่ม endpoint และให้แพตช์อ่านค่านี้ก่อนจึงจะควบคุมเครื่องจริงได้'
      : `โหลดสถานะอุปกรณ์ไม่สำเร็จ: ${error.message}`;
  }
  renderConfig();
  setControlsEnabled(state.controlSupported && !status?.maintenance);
  try {
    const catalog = await request(`/api/feature-catalog?build=${encodeURIComponent(BUILD)}`, { headers: { Authorization: `Bearer ${sessionKey}` } });
    if (state.key === sessionKey && Array.isArray(catalog.features) && catalog.features.length) {
      const known = defaultConfig();
      const imported = catalog.features.filter(f => typeof known[f.id] === 'boolean');
      if (imported.length) {
        state.catalogIds = new Set(imported.map(f => f.id));
        document.querySelectorAll('.feature-toggle').forEach(input => {
          const available = state.catalogIds.has(input.dataset.feature);
          const card = input.closest?.('.control-card');
          if (card) card.hidden = !available;
          if (!available) state.config[input.dataset.feature] = false;
        });
        renderConfig();
        setControlsEnabled(state.controlSupported && !status?.maintenance);
      }
      $('imported-catalog').hidden = false;
      $('imported-catalog').textContent = 'รายการนำเข้าจากแพตช์: ' + catalog.features.map(f => f.label).join(' · ');
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
    if(data.upgradeRequired){$('runtime-state').textContent='ตัวรับเดิมยืนยันได้เฉพาะการรับค่า เปิดตัวรับรุ่นใหม่จากรายการแพตช์ใน IPA';$('sync-label').textContent='UPDATE RECEIVER';return;}
    $('runtime-state').textContent = data.online ? (data.applied ? 'เกมรับและใช้ค่าล่าสุดแล้ว' : 'เกมเชื่อมต่อแล้ว กำลังรอใช้ค่าล่าสุด') : 'ยังไม่มีการตอบกลับจากเกม';
    $('sync-label').textContent = data.online ? (data.applied ? 'GAME STATE CONFIRMED' : 'STATE NOT MATCHED') : 'WAITING FOR GAME';
    if(data.online && data.applied){const h=data.hookFlags || 0;$('runtime-state').textContent=`อ่านค่ากลับตรงกับเว็บ · โค้ดเกม AIM ${(h&3)?'ถูกเรียกแล้ว':'ยังไม่ถูกเรียก'} / RECOIL ${(h&4)?'ถูกเรียกแล้ว':'ยังไม่ถูกเรียก'}`;}
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
  document.querySelectorAll('.feature-toggle').forEach(input=>{const card=input.closest?.('.control-card');if(card)card.hidden=false;});
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
    const auth = await authenticate(state.key);
    if(auth.expiresAt && (!Number.isFinite(Date.parse(auth.expiresAt)) || Date.now()>=Date.parse(auth.expiresAt)))throw new Error('คีย์หมดอายุ');
    if (!auth.valid) throw new Error(auth.message || 'คีย์ไม่ถูกต้อง');
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
  if (reset) { state.config = defaultConfig(); renderConfig(); }
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
    $('save-status').textContent = reset ? 'รีเซ็ตและบันทึกแล้ว' : 'SAVED TO API';
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

$('logout').onclick = () => {
  endSession();
};

window.location.hash='login';
setControlsEnabled(false);
probe();

