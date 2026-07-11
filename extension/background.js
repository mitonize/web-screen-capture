/**
 * wsc Browser Extension — Background Service Worker
 *
 * ページを再読み込みせずにキャプチャするため、Chrome DevTools Protocol の
 * chrome.debugger API を使用します。
 *
 * フロー:
 *   1. 現在のタブにデバッガを接続
 *   2. PC: オートスクロール → fixed要素変換 → フルページキャプチャ（再ナビゲーションなし）
 *   3. Mobile: デバイスエミュレーション適用 → オートスクロール → fixed要素変換 → キャプチャ → 復元
 *   4. デバッガを切断
 *   5. base64 JPEG を wsc サーバーの /capture-image へ POST
 */

const WSC_SERVER = 'http://127.0.0.1:4242';

const MOBILE_METRICS = {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
  screenWidth: 390,
  screenHeight: 844,
};

const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const MOBILE_WINDOW_SIZE_HEIGHT = 852;

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

// ── Lazy-load preparation ─────────────────────────────────────────────────────

/**
 * ページをビューポート高さ刻みでスクロールして IntersectionObserver を発火させ、
 * トップに戻った後 position:fixed / position:sticky 要素を変換する。
 * これにより lazy-load コンテンツが重複なく表示され、fixed/sticky ヘッダーも
 * フルページ画像内で正しい位置に一度だけ現れる。
 */
async function preparePageForCapture(target, viewportHeight) {
  // Step 0: restore any elements converted in a previous capture pass so that
  // scrollHeight is measured against the natural page layout.
  // (PC capture converts fixed→absolute; without this, the subsequent mobile
  //  capture would measure an inflated scrollHeight, producing a too-tall image.)
  await dbgSend(target, 'Runtime.evaluate', {
    expression: `
      (function() {
        for (const el of document.querySelectorAll('[data-wsc-orig-pos]')) {
          el.style.setProperty('position', el.getAttribute('data-wsc-orig-pos'), 'important');
          el.removeAttribute('data-wsc-orig-pos');
        }
      })()
    `,
  });

  // Record the initial page height BEFORE scrolling.
  // Pages with infinite scroll or dynamic content injection will grow as we
  // scroll; we cap scrolling and the final clip to this pre-scroll height so
  // dynamically appended content is never included in the screenshot.
  const { result: { value: initialHeight } } = await dbgSend(target, 'Runtime.evaluate', {
    expression: 'document.documentElement.scrollHeight',
    returnByValue: true,
  });

  // Step 1: scroll down in viewport-height steps, but only up to initialHeight
  await dbgSend(target, 'Runtime.evaluate', {
    expression: `
      new Promise((resolve) => {
        const step  = ${viewportHeight};
        const limit = ${initialHeight};
        let pos = 0;
        function tick() {
          pos += step;
          window.scrollTo(0, pos);
          if (pos < limit) { requestAnimationFrame(tick); }
          else { resolve(); }
        }
        tick();
      })
    `,
    awaitPromise: true,
    timeout: 15000,
  });

  // Step 2: short pause for async content triggered by scroll
  await sleep(400);

  // Step 3: scroll back to top
  await dbgSend(target, 'Runtime.evaluate', {
    expression: 'window.scrollTo(0, 0)',
  });

  // Step 4: wait briefly for any newly-triggered network requests
  await sleep(300);

  // Step 5: convert fixed→absolute and sticky→relative so headers/footers
  // appear only once at their natural position in the full-page screenshot.
  // Tag each converted element so Step 0 can restore it in the next pass.
  await dbgSend(target, 'Runtime.evaluate', {
    expression: `
      (function() {
        for (const el of document.querySelectorAll('*')) {
          const pos = getComputedStyle(el).position;
          if (pos === 'fixed') {
            el.setAttribute('data-wsc-orig-pos', 'fixed');
            el.style.setProperty('position', 'absolute', 'important');
          } else if (pos === 'sticky') {
            el.setAttribute('data-wsc-orig-pos', 'sticky');
            el.style.setProperty('position', 'relative', 'important');
          }
        }
      })()
    `,
  });

  return initialHeight;
}

async function getCurrentViewportMetrics(target) {
  const metrics = await dbgSend(target, 'Page.getLayoutMetrics');
  const viewport = metrics.visualViewport ?? metrics.layoutViewport ?? {};
  const width = Math.max(1, Math.ceil(Number(viewport.clientWidth) || 0));
  const height = Math.max(1, Math.ceil(Number(viewport.clientHeight) || 0));
  return { width, height };
}

async function captureVisibleTabScreenshot(tabId) {
  const tab = await chrome.tabs.get(tabId);
  const windowId = tab.windowId;
  if (typeof windowId !== 'number' || windowId < 0) {
    throw new Error('Unable to determine the current window');
  }

  const dataUrl = await new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(
      windowId,
      { format: 'jpeg', quality: 80 },
      (capturedDataUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(capturedDataUrl);
      },
    );
  });

  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    throw new Error('Unexpected screenshot data');
  }

  const base64 = dataUrl.split(',', 2)[1];
  if (!base64) {
    throw new Error('Unexpected screenshot payload');
  }

  return Buffer.from(base64, 'base64');
}

async function scrollToTop(target) {
  await dbgSend(target, 'Runtime.evaluate', {
    expression: 'window.scrollTo(0, 0)',
  });
  await sleep(100);
}

// ── Full-page screenshot (no navigation) ─────────────────────────────────────

async function captureFullPage(target, viewportHeight) {
  // preparePageForCapture returns the pre-scroll height; use that as clip
  // so dynamically appended content (infinite scroll, recommendations) is excluded.
  const clipHeight = await preparePageForCapture(target, viewportHeight);

  const metrics = await dbgSend(target, 'Page.getLayoutMetrics');
  const width   = Math.ceil(metrics.cssContentSize.width);
  // Use pre-scroll height to exclude dynamically added content.
  const height  = clipHeight ?? Math.ceil(metrics.cssContentSize.height);

    const result = await dbgSend(target, 'Page.captureScreenshot', {
      format: 'jpeg',
      quality: 80,
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width, height, scale: 1 },
    });

  return { imageData: result.data, width, height };
}

// ── Mobile screenshot helpers ────────────────────────────────────────────────

async function captureMobileFullPage(target) {
  const { width: mobileWidth } = MOBILE_METRICS;

  // Scroll to trigger lazy load and convert fixed/sticky elements.
  const clipHeight = await preparePageForCapture(target, MOBILE_METRICS.height);

  const metrics = await dbgSend(target, 'Page.getLayoutMetrics');
  const pageHeight = clipHeight ?? Math.ceil(metrics.cssContentSize.height);

  // Expand the viewport to the full page height to avoid GPU tiling artifacts.
  await dbgSend(target, 'Emulation.setDeviceMetricsOverride', {
    ...MOBILE_METRICS,
    height: pageHeight,
    screenHeight: pageHeight,
  });
  await sleep(200); // let layout settle after viewport resize

  const result = await dbgSend(target, 'Page.captureScreenshot', {
    format: 'jpeg',
    quality: 80,
    captureBeyondViewport: false,
    clip: { x: 0, y: 0, width: mobileWidth, height: pageHeight, scale: 1 },
  });

  return { imageData: result.data, width: mobileWidth, height: pageHeight };
}

async function captureMobileViewport(target, viewportHeight) {
  const { width: mobileWidth } = MOBILE_METRICS;

  await dbgSend(target, 'Emulation.setDeviceMetricsOverride', {
    ...MOBILE_METRICS,
    height: viewportHeight,
    screenHeight: viewportHeight,
  });
  await sleep(200);

  const result = await dbgSend(target, 'Page.captureScreenshot', {
    format: 'jpeg',
    quality: 80,
    captureBeyondViewport: false,
    clip: { x: 0, y: 0, width: mobileWidth, height: viewportHeight, scale: 1 },
  });

  return { imageData: result.data, width: mobileWidth, height: viewportHeight };
}

function normalizeDevices(devices) {
  const selected = Array.isArray(devices)
    ? devices.filter((device) => device === 'pc' || device === 'mobile')
    : [];
  return selected.length > 0 ? selected : ['pc', 'mobile'];
}

// ── Main capture handler ──────────────────────────────────────────────────────

async function handleCapture({ tabId, url, label, devices, windowSize }) {
  const target = { tabId };
  const selectedDevices = normalizeDevices(devices);
  const results = [];
  let attached = false;

  try {
    await dbgAttach(target);
    attached = true;

    if (selectedDevices.includes('pc')) {
      // ---- PC: scroll to trigger lazy load, or clip to the visible viewport ----
      const pcViewport = await getCurrentViewportMetrics(target);
      const pc = windowSize
        ? (await scrollToTop(target), {
            imageData: (await captureVisibleTabScreenshot(tabId)).toString('base64'),
            width: pcViewport.width,
            height: pcViewport.height,
          })
        : await captureFullPage(target, pcViewport.height);
      results.push({ deviceType: 'pc', imageData: pc.imageData, width: pc.width, height: pc.height });
    }

    if (selectedDevices.includes('mobile')) {
      const mobileViewportHeight = windowSize ? MOBILE_WINDOW_SIZE_HEIGHT : MOBILE_METRICS.height;
      const mobileMetrics = windowSize
        ? { ...MOBILE_METRICS, height: mobileViewportHeight, screenHeight: mobileViewportHeight }
        : MOBILE_METRICS;

      // ---- Mobile: emulate → capture full page, or clip to viewport → restore ----
      await dbgSend(target, 'Emulation.setDeviceMetricsOverride', mobileMetrics);
      await dbgSend(target, 'Emulation.setUserAgentOverride', { userAgent: MOBILE_UA });
      await sleep(700); // wait for responsive layout to reflow

      const mobile = windowSize
        ? (await scrollToTop(target), await captureMobileViewport(target, mobileViewportHeight))
        : await captureMobileFullPage(target);
      results.push({ deviceType: 'mobile', imageData: mobile.imageData, width: mobile.width, height: mobile.height });

      // Restore original viewport and user-agent
      await dbgSend(target, 'Emulation.clearDeviceMetricsOverride', {});
      await dbgSend(target, 'Emulation.setUserAgentOverride', { userAgent: '' });
    }

    // ---- Send pre-captured images to wsc server ----
    const body = JSON.stringify({
      url,
      label: label || undefined,
      captures: results,
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
    return { success: false, error: err.message };
  } finally {
    if (attached) {
      await dbgDetach(target).catch(() => {});
    }
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
