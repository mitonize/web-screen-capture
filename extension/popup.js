const WSC_SERVER = 'http://127.0.0.1:4242';

const badge    = document.getElementById('server-badge');
const urlBox   = document.getElementById('url-box');
const labelEl  = document.getElementById('label');
const noScrollEl = document.getElementById('no-scroll');
const captureBtn = document.getElementById('capture-btn');
const statusEl = document.getElementById('status');
const progress = document.getElementById('progress');
const progressBar = document.getElementById('progress-bar');
const capturesList = document.getElementById('captures-list');

let currentTabId  = null;
let currentTabUrl = '';

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

function formatTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

// ── Server status ───────────────────────────────────────────────────────────

async function checkServer() {
  try {
    const res = await fetch(`${WSC_SERVER}/status`, { signal: AbortSignal.timeout(1500) });
    if (res.ok) {
      badge.textContent = 'サーバー稼働中';
      badge.className   = 'online';
      return true;
    }
  } catch { /* fall through */ }
  badge.textContent = 'サーバー停止中';
  badge.className   = 'offline';
  setStatus('wsc serve が起動していません。\nターミナルで wsc serve を実行してください。', 'error');
  return false;
}

// ── Recent captures ─────────────────────────────────────────────────────────

async function loadRecent() {
  try {
    const res = await fetch(`${WSC_SERVER}/captures`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return;
    const { captures } = await res.json();
    renderRecent(captures ?? []);
  } catch {
    capturesList.innerHTML = '<li><span id="empty-msg">サーバーに接続できません</span></li>';
  }
}

function renderRecent(captures) {
  if (!captures.length) {
    capturesList.innerHTML = '<li><span id="empty-msg">まだキャプチャがありません</span></li>';
    return;
  }
  capturesList.innerHTML = captures.slice(0, 10).map((c) => `
    <li>
      <span class="device-badge ${c.device_type}">${c.device_type === 'mobile' ? '📱' : '🖥️'} ${c.device_type}</span>
      <span class="cap-url" title="${c.url}">${c.url}</span>
      <span class="cap-time">${formatTime(c.captured_at)}</span>
    </li>
  `).join('');
}

// ── Capture ──────────────────────────────────────────────────────────────────

captureBtn.addEventListener('click', async () => {
  const label = labelEl.value.trim() || undefined;
  const noScroll = noScrollEl.checked;

  captureBtn.disabled = true;
  setStatus('キャプチャ中... (PC)', 'loading');
  setProgress(10);

  chrome.runtime.sendMessage(
    { type: 'CAPTURE', tabId: currentTabId, url: currentTabUrl, label, noScroll },
    (response) => {
      setProgress(null);

      if (chrome.runtime.lastError) {
        setStatus(`エラー: ${chrome.runtime.lastError.message}`, 'error');
        captureBtn.disabled = false;
        return;
      }

      if (!response || !response.success) {
        setStatus(`キャプチャ失敗: ${response?.error ?? '不明なエラー'}`, 'error');
        captureBtn.disabled = false;
        return;
      }

      const ok = response.results.filter((r) => r.status === 'success').length;
      const total = response.results.length;
      setStatus(`✓ ${ok}/${total} 件保存完了`, 'success');
      captureBtn.disabled = false;
      labelEl.value = '';
      loadRecent();
    },
  );

  // Simulate progress while waiting
  let pct = 10;
  const timer = setInterval(() => {
    pct = Math.min(pct + 8, 85);
    setProgress(pct);
    if (pct >= 85) clearInterval(timer);
  }, 400);

  // Update status label when mobile phase likely starts
  setTimeout(() => setStatus('キャプチャ中... (モバイル)', 'loading'), 3000);
});

// ── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId  = tab?.id ?? null;
  currentTabUrl = tab?.url ?? '';

  urlBox.textContent = currentTabUrl || '(URLを取得できません)';
  urlBox.title       = currentTabUrl;

  const serverOk = await checkServer();
  if (serverOk) {
    captureBtn.disabled = false;
    await loadRecent();
  }
}

init();
