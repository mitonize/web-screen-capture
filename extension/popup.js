const WSC_SERVER = 'http://127.0.0.1:4242';
const GALLERY_URL = 'http://127.0.0.1:4242/';

const badge    = document.getElementById('server-badge');
const urlBox   = document.getElementById('url-box');
const labelEl  = document.getElementById('label');
const devicePcEl = document.getElementById('device-pc');
const deviceMobileEl = document.getElementById('device-mobile');
const windowSizeEl = document.getElementById('window-size');
const captureBtn = document.getElementById('capture-btn');
const statusEl = document.getElementById('status');
const progress = document.getElementById('progress');
const progressBar = document.getElementById('progress-bar');
const galleryLink = document.getElementById('gallery-link');

let currentTabId  = null;
let currentTabUrl = '';
let serverReady = false;

// ── Utilities ──────────────────────────────────────────────────────────────

function setStatus(msg, type = '') {
  statusEl.textContent = msg;
  statusEl.className   = type;
}

function setProgress(pct) {
  if (pct == null) {
    progress.classList.remove('active');
    progressBar.style.width = '0%';
  } else {
    progress.classList.add('active');
    progressBar.style.width = `${pct}%`;
  }
}

function getSelectedDevices() {
  const devices = [];
  if (devicePcEl.checked) devices.push('pc');
  if (deviceMobileEl.checked) devices.push('mobile');
  return devices;
}

function formatDeviceLabel(devices, windowSize) {
  const labels = [];
  if (devices.includes('pc')) labels.push('PC');
  if (devices.includes('mobile')) labels.push('モバイル');
  const base = labels.join('・');
  return windowSize ? `${base}（ウィンドウサイズ制限）` : base;
}

function updateCaptureButton() {
  const devices = getSelectedDevices();
  captureBtn.textContent = devices.length
    ? `${formatDeviceLabel(devices, windowSizeEl.checked)} キャプチャ`
    : '対象デバイスを選択してください';
  captureBtn.disabled = !serverReady || devices.length === 0;
}

// ── Server status ───────────────────────────────────────────────────────────

async function checkServer() {
  try {
    const res = await fetch(`${WSC_SERVER}/status`, { signal: AbortSignal.timeout(1500) });
    if (res.ok) {
      badge.textContent = 'サーバー稼働中';
      badge.className   = 'online';
      serverReady = true;
      updateCaptureButton();
      return true;
    }
  } catch { /* fall through */ }
  badge.textContent = 'サーバー停止中';
  badge.className   = 'offline';
  setStatus('wsc serve が起動していません。\nターミナルで wsc serve を実行してください。', 'error');
  serverReady = false;
  updateCaptureButton();
  return false;
}

// ── Device state persistence ───────────────────────────────────────────────

async function saveDeviceState() {
  const state = {
    pc: devicePcEl.checked,
    mobile: deviceMobileEl.checked,
    windowSize: windowSizeEl.checked,
  };
  return new Promise((resolve) => {
    chrome.storage.local.set({ deviceState: state }, resolve);
  });
}

async function loadDeviceState() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['deviceState'], (result) => {
      const state = result.deviceState || { pc: true, mobile: true, windowSize: false };
      devicePcEl.checked = state.pc ?? true;
      deviceMobileEl.checked = state.mobile ?? true;
      windowSizeEl.checked = state.windowSize ?? false;
      resolve(state);
    });
  });
}

// ── Capture ──────────────────────────────────────────────────────────────────

captureBtn.addEventListener('click', async () => {
  const label = labelEl.value.trim() || undefined;
  const devices = getSelectedDevices();
  const deviceLabel = formatDeviceLabel(devices, windowSizeEl.checked);

  if (!devices.length) {
    setStatus('対象デバイスを1つ以上選択してください', 'error');
    return;
  }

  captureBtn.disabled = true;
  setStatus(`キャプチャ中... (${deviceLabel})`, 'loading');
  setProgress(10);

  chrome.runtime.sendMessage(
    {
      type: 'CAPTURE',
      tabId: currentTabId,
      url: currentTabUrl,
      label,
      devices,
      windowSize: windowSizeEl.checked,
    },
    (response) => {
      setProgress(null);

      if (chrome.runtime.lastError) {
        setStatus(`エラー: ${chrome.runtime.lastError.message}`, 'error');
        updateCaptureButton();
        return;
      }

      if (!response || !response.success) {
        setStatus(`キャプチャ失敗: ${response?.error ?? '不明なエラー'}`, 'error');
        updateCaptureButton();
        return;
      }

      const ok = response.results.filter((r) => r.status === 'success').length;
      const total = response.results.length;
      setStatus(`✓ ${ok}/${total} 件保存完了`, 'success');
      labelEl.value = '';
      updateCaptureButton();
    },
  );

  // Simulate progress while waiting
  let pct = 10;
  const timer = setInterval(() => {
    pct = Math.min(pct + 8, 85);
    setProgress(pct);
    if (pct >= 85) clearInterval(timer);
  }, 400);

});

// ── Gallery link ───────────────────────────────────────────────────────────

galleryLink.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: GALLERY_URL });
});

// ── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  console.log('[wsc popup] Initializing...');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId  = tab?.id ?? null;
  currentTabUrl = tab?.url ?? '';

  urlBox.textContent = currentTabUrl || '(URLを取得できません)';
  urlBox.title       = currentTabUrl;

  // Load device state
  console.log('[wsc popup] Loading device state...');
  await loadDeviceState();

  // Save state on device change
  devicePcEl.addEventListener('change', () => {
    updateCaptureButton();
    saveDeviceState();
  });
  deviceMobileEl.addEventListener('change', () => {
    updateCaptureButton();
    saveDeviceState();
  });
  windowSizeEl.addEventListener('change', () => {
    updateCaptureButton();
    saveDeviceState();
  });
  updateCaptureButton();

  console.log('[wsc popup] Checking server...');
  const serverOk = await checkServer();
  console.log('[wsc popup] Server check result:', serverOk);
}

init();
