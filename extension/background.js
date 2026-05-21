/**
 * wsc Browser Extension — Background Service Worker
 *
 * ページを再読み込みせずにキャプチャするため、Chrome DevTools Protocol の
 * chrome.debugger API を使用します。
 *
 * フロー:
 *   1. 現在のタブにデバッガを接続
 *   2. PC: 現在の状態のままフルページをキャプチャ（再ナビゲーションなし）
 *   3. Mobile: デバイスエミュレーションを適用 → キャプチャ → 元の状態に復元
 *   4. デバッガを切断
 *   5. base64 PNG を wsc サーバーの /capture-image へ POST
 */

const WSC_SERVER = 'http://127.0.0.1:4242';

const MOBILE_METRICS = {
  width: 390,
  height: 844,
  deviceScaleFactor: 3,
  mobile: true,
  screenWidth: 390,
  screenHeight: 844,
};

const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

// ── Debugger helpers ──────────────────────────────────────────────────────────

function dbgAttach(target) {
  return new Promise((resolve, reject) => {
    chrome.debugger.attach(target, '1.3', () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });
}

function dbgDetach(target) {
  return new Promise((resolve) => {
    chrome.debugger.detach(target, () => resolve()); // errors ignored on detach
  });
}

function dbgSend(target, method, params = {}) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand(target, method, params, (result) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(result);
    });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Full-page screenshot (no navigation) ─────────────────────────────────────

async function captureFullPage(target) {
  const metrics = await dbgSend(target, 'Page.getLayoutMetrics');
  const width   = Math.ceil(metrics.cssContentSize.width);
  const height  = Math.ceil(metrics.cssContentSize.height);

  const result = await dbgSend(target, 'Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width, height, scale: 1 },
  });

  return { imageData: result.data, width, height };
}

// ── Main capture handler ──────────────────────────────────────────────────────

async function handleCapture({ tabId, url, label }) {
  const target = { tabId };

  try {
    await dbgAttach(target);

    // ---- PC: capture current state as-is (no reload) ----
    const pc = await captureFullPage(target);

    // ---- Mobile: emulate → capture → restore ----
    await dbgSend(target, 'Emulation.setDeviceMetricsOverride', MOBILE_METRICS);
    await dbgSend(target, 'Emulation.setUserAgentOverride', { userAgent: MOBILE_UA });
    await sleep(600); // wait for responsive layout to reflow

    const mobile = await captureFullPage(target);

    // Restore original state
    await dbgSend(target, 'Emulation.clearDeviceMetricsOverride', {});
    await dbgSend(target, 'Emulation.setUserAgentOverride', { userAgent: '' });

    await dbgDetach(target);

    // ---- Send pre-captured images to wsc server ----
    const body = JSON.stringify({
      url,
      label: label || undefined,
      captures: [
        { deviceType: 'pc',     imageData: pc.imageData,     width: pc.width,     height: pc.height },
        { deviceType: 'mobile', imageData: mobile.imageData, width: mobile.width, height: mobile.height },
      ],
    });

    const res = await fetch(`${WSC_SERVER}/capture-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }

    const data = await res.json();
    return { success: true, results: data.results };

  } catch (err) {
    await dbgDetach(target).catch(() => {});
    return { success: false, error: err.message };
  }
}

// ── Message listener ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'CAPTURE') {
    handleCapture(msg)
      .then(sendResponse)
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // keep message channel open for async response
  }
});
