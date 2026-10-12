'use strict';

const API_BASE = window.DRAGON_HEX_CONFIG.apiBase.replace(/\/$/, '');
const BUILD = window.DRAGON_HEX_CONFIG.buildNumber;
const $ = id => document.getElementById(id);

const state = {
  key: '',
  deviceId: localStorage.getItem('dragonhex.web.device') || crypto.randomUUID(),
  config: { aimSystem: false, noRecoil: false, target: 'head', headshot: 0 },
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
  document.querySelectorAll('.feature-toggle, .segmented button').forEach(control => { control.disabled = !enabled; });
  $('save').disabled = !enabled;
}

function renderConfig() {
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
  const status = await request(`/api/status?build=${encodeURIComponent(BUILD)}`).catch(() => null);
  if (status?.maintenance) {
    $('maintenance').hidden = false;
    $('maintenance').textContent = `MAINTENANCE — ${status.message || 'ระบบกำลังปิดปรับปรุง'}`;
  }

  // This is the feature-control contract required by the web panel and the device patch.
  // The current Worker returns 404 until that backend/device integration is deployed.
  try {
    const data = await request(`/api/device-config?deviceId=${encodeURIComponent(state.deviceId)}&build=${encodeURIComponent(BUILD)}`, { headers: { Authorization: `Bearer ${state.key}` } });
    state.config = { ...state.config, ...data.config };
    state.controlSupported = true;
    $('sync-label').textContent = 'API CONNECTED';
    $('control-warning').hidden = true;
  } catch (error) {
    state.controlSupported = false;
    $('sync-label').textContent = error.status === 404 ? 'API UPDATE NEEDED' : 'UNAVAILABLE';
    $('control-warning').hidden = false;
    $('control-warning').textContent = error.status === 404
      ? 'API นี้ยังไม่มี /api/device-config จึงปิดสวิตช์ไว้เพื่อไม่ให้แสดงผลสำเร็จปลอม ต้องเพิ่ม endpoint และให้แพตช์อ่านค่านี้ก่อนจึงจะควบคุมเครื่องจริงได้'
      : `โหลดสถานะอุปกรณ์ไม่สำเร็จ: ${error.message}`;
  }
  renderConfig();
  setControlsEnabled(state.controlSupported && !status?.maintenance);
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
  state.config = { aimSystem: false, noRecoil: false, target: 'head', headshot: 0 };
  state.controlSupported = false;
  $('maintenance').hidden = true;
  $('save-status').textContent = 'READY TO SAVE';
  state.key = $('key').value.trim();
  button.disabled = true;
  feedback.textContent = 'กำลังตรวจสอบคีย์…';
  try {
    const auth = await authenticate(state.key);
    if (!auth.valid) throw new Error(auth.message || 'คีย์ไม่ถูกต้อง');
    $('key-status').textContent = auth.expiresAt ? `ACTIVE · ${new Date(auth.expiresAt).toLocaleDateString('th-TH')}` : 'ACTIVE';
    $('device-label').textContent = state.deviceId.slice(0, 8).toUpperCase();
    $('login-view').hidden = true;
    $('dashboard').hidden = false;
    feedback.textContent = '';
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
document.querySelectorAll('[data-headshot]').forEach(button => {
  button.onclick = () => { state.config.headshot = Number(button.dataset.headshot); renderConfig(); $('save-status').textContent = 'UNSAVED CHANGES'; };
});

$('save').onclick = async () => {
  const button = $('save');
  button.disabled = true;
  $('save-status').textContent = 'SYNCING…';
  try {
    await request('/api/device-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.key}` },
      body: JSON.stringify({ deviceId: state.deviceId, build: BUILD, config: state.config })
    });
    $('save-status').textContent = 'SAVED TO API';
  } catch (error) {
    $('save-status').textContent = `SYNC FAILED · ${error.message}`;
  } finally {
    button.disabled = !state.controlSupported || !$('maintenance').hidden;
  }
};

$('logout').onclick = () => {
  state.key = '';
  $('key').value = '';
  $('dashboard').hidden = true;
  $('login-view').hidden = false;
  setControlsEnabled(false);
};

setControlsEnabled(false);
probe();

