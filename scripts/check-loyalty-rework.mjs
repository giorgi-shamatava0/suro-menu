import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
const origin = process.env.LOYALTY_TEST_URL ?? "http://localhost:3000";
assert.ok(
  !origin.includes("suro-menu.vercel.app"),
  "Never create test cards on production",
);
const profile = await mkdtemp(join(tmpdir(), "suro-loyalty-browser-"));
const browser = spawn(
  process.env.CHROME_PATH ?? "/usr/bin/brave-browser",
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--remote-debugging-port=9227",
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);
let ws;
try {
  let target;
  for (let i = 0; i < 100; i++) {
    try {
      target = (
        await (await fetch("http://127.0.0.1:9227/json/list")).json()
      )[0];
      if (target) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(target, "Browser did not start");
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const data = JSON.parse(String(event.data));
    const entry = pending.get(data.id);
    if (entry) {
      pending.delete(data.id);
      data.error
        ? entry.reject(new Error(data.error.message))
        : entry.resolve(data.result);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const key = ++id;
      pending.set(key, { resolve, reject });
      ws.send(JSON.stringify({ id: key, method, params }));
    });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails)
      throw new Error(
        result.exceptionDetails.exception?.description ??
          result.exceptionDetails.text,
      );
    return result.result.value;
  };
  await send("Page.enable");
  await send("Runtime.enable");
  await mkdir(".impeccable/review", { recursive: true });

  async function waitFor(expression, message = "Page did not settle") {
    const start = Date.now();
    while (Date.now() - start < 25000) {
      try {
        if (await evaluate(`Boolean(${expression})`)) return;
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(message);
  }
  await send("Browser.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: "/tmp/suro-card-downloads",
  });
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await send("Page.navigate", { url: `${origin}/loyalty` });
  await waitFor(`document.querySelector('.activation-consent input')`);
  await waitFor(
    `Object.keys(document.querySelector('.activation-consent input')).some(k=>k.startsWith('__reactProps'))`,
  );
  assert.equal(
    await evaluate(`document.querySelector('.customer-join button').disabled`),
    true,
  );
  const unconsented = await evaluate(
    `fetch('/api/loyalty/enroll',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>r.status)`,
  );
  assert.equal(unconsented, 400);
  await evaluate(
    `document.querySelector('.activation-consent input').click();document.querySelector('.customer-join button').click()`,
  );
  await waitFor(
    `location.pathname.startsWith('/c/') && document.querySelector('.stage-thanks')`,
    "Signup did not reach unique card URL",
  );
  await waitFor(`document.querySelector('.stage-stamp')`);
  const stampTime = Date.now();
  assert.equal(
    await evaluate(
      `document.querySelector('.stamp-card-total').innerText.replace(/\\s/g,'')`,
    ),
    "1/8",
  );
  const first = await send("Page.captureScreenshot", { format: "png" });
  await writeFile(
    ".impeccable/review/welcome-first-stamp.png",
    Buffer.from(first.data, "base64"),
  );
  await waitFor(`document.querySelector('.stage-gift')`);
  assert.ok(
    Date.now() - stampTime >= 2700,
    "Gift did not wait three seconds after first stamp",
  );
  await waitFor(`document.querySelector('.stage-pick')`);
  assert.equal(
    await evaluate(
      `document.querySelectorAll('.welcome-cups button:not(:disabled)').length`,
    ),
    3,
  );
  await evaluate(
    `document.querySelectorAll('.welcome-cups button')[1].click()`,
  );
  await waitFor(`document.querySelector('.stage-won')`);
  assert.equal(
    await evaluate(
      `document.querySelector('.stamp-card-total').innerText.replace(/\\s/g,'')`,
    ),
    "2/8",
  );
  await evaluate(
    `document.querySelector('.stage-won .loyalty-primary').click()`,
  );
  await waitFor(
    `!document.querySelector('.welcome-celebration') && document.querySelector('.loyalty-qr')?.complete`,
  );
  const path = await evaluate("location.pathname");
  assert.equal(
    await evaluate(`document.documentElement.scrollWidth>innerWidth+1`),
    false,
  );
  assert.equal(
    await evaluate(`document.querySelectorAll('.stamp-reward-photo').length`),
    0,
  );
  assert.equal(
    await evaluate(
      `document.querySelectorAll('.stamp-card-terms-button').length`,
    ),
    0,
  );
  await evaluate(`document.fonts.ready`);
  const shot = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
  await writeFile(
    ".impeccable/review/reworked-card-390.png",
    Buffer.from(shot.data, "base64"),
  );
  await evaluate(`document.querySelector('.card-recovery button').click()`);
  await waitFor(
    `!document.querySelector('.card-recovery button').disabled`,
    "Download never finished",
  );
  assert.equal(
    await evaluate(
      `document.querySelectorAll('.card-recovery [role=alert]').length`,
    ),
    0,
  );
  console.log(
    "Consent enforced; unique URL; first stamp, three-second pause, three cups, guaranteed second stamp; card PNG downloaded",
  );
  for (const lang of ["en", "ru"]) {
    await evaluate(
      `document.querySelector('.customer-language').open=true;document.querySelector('[data-language="${lang}"]').click()`,
    );
    await waitFor(`document.documentElement.lang==='${lang}'`);
    await evaluate(`document.querySelector('.card-recovery button').click()`);
    await waitFor(`!document.querySelector('.card-recovery button').disabled`);
    assert.equal(
      await evaluate(
        `document.querySelectorAll('.card-recovery [role=alert]').length`,
      ),
      0,
    );
  }
  await send("Network.clearBrowserCookies");
  await evaluate("localStorage.clear();sessionStorage.clear()");
  await send("Page.navigate", { url: origin + path });
  await waitFor(
    `document.querySelector('.stamp-card-total')?.innerText.replace(/\\s/g,'')==='2/8'`,
    "QR URL did not recover card",
  );
  assert.equal(
    await evaluate(`document.querySelectorAll('.welcome-celebration').length`),
    0,
  );
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await evaluate(`document.fonts.ready`);
  const desktop = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
  await writeFile(
    ".impeccable/review/reworked-card-1440.png",
    Buffer.from(desktop.data, "base64"),
  );
  const manifest = await evaluate(
    `fetch(document.querySelector('link[rel=manifest]').href).then(r=>r.json())`,
  );
  assert.equal(manifest.start_url, path);
  console.log(
    "Georgian, English and Russian image downloads; card recovers without cookies or storage; manifest opens unique live card",
  );
  for (const route of ["/staff", "/admin/loyalty", "/loyalty/legal?lang=ru"]) {
    await send("Page.navigate", { url: origin + route });
    await waitFor(`document.querySelector('h1')`);
    assert.equal(
      await evaluate(`document.documentElement.scrollWidth>innerWidth+1`),
      false,
    );
  }
  await writeFile(
    "/tmp/suro-browser-result.json",
    JSON.stringify({ path, origin }),
  );
} finally {
  ws?.close();
  browser.kill();
  await new Promise((r) => setTimeout(r, 250));
  await rm(profile, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 200,
  });
}
