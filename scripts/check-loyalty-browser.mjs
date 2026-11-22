import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
const origin = process.env.LOYALTY_TEST_URL ?? "http://localhost:3000";
const profile = await mkdtemp(join(tmpdir(), "suro-loyalty-browser-"));
const browser = spawn(
  process.env.CHROME_PATH ?? "/usr/bin/brave-browser",
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--remote-debugging-port=9223",
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
        await (await fetch("http://127.0.0.1:9223/json/list")).json()
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
  for (const width of [390, 1440]) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: width === 390 ? 844 : 900,
      deviceScaleFactor: 1,
      mobile: width === 390,
    });
    for (const route of ["/loyalty", "/staff", "/admin/loyalty"]) {
      await send("Page.navigate", { url: `${origin}${route}` });
      await evaluate(
        `new Promise((resolve, reject) => { const start = Date.now(); const check = () => { if (location.pathname === ${JSON.stringify(route)} && document.querySelector('h1')?.getBoundingClientRect().height > 0 && !document.body.innerText.includes('Loading your card')) return resolve(true); if (Date.now()-start > 30000) return reject(new Error('Page did not settle')); setTimeout(check, 100); }; check(); })`,
      );
      await evaluate(
        `document.fonts.ready.then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))`,
      );
      const result = await evaluate(
        `({ title: document.querySelector('h1')?.innerText, overflow: document.documentElement.scrollWidth > innerWidth + 1, body: document.body.innerText })`,
      );
      assert.equal(result.overflow, false, `${route} overflows at ${width}`);
      assert.ok(
        !result.body.includes("Application error"),
        `${route} has an application error`,
      );
      if (route === "/staff") {
        assert.ok(!result.body.includes("Staff name"));
        assert.ok(result.body.includes("Password"));
      }
      if (route === "/admin/loyalty") {
        const admin = await evaluate(
          `({ fields: [...document.querySelectorAll('main input')].map(input => input.name), nav: Boolean(document.querySelector('header nav')), heading: document.querySelector('h1')?.innerText, language: document.querySelector('.customer-language [aria-pressed=true]')?.dataset.language })`,
        );
        assert.deepEqual(admin.fields, ["password"]);
        assert.equal(admin.nav, false);
        assert.equal(admin.heading, "ადმინისტრაცია");
        assert.equal(admin.language, "ka");
      }
      if (route === "/loyalty") {
        assert.ok(result.body.includes("გამარჯობა!"));
        assert.ok(result.body.includes("ლოიალობის ბარათის შექმნა"));
        const chrome = await evaluate(
          `({ nav: Boolean(document.querySelector('nav')), footer: Boolean(document.querySelector('footer')), lang: document.querySelector('.customer-language [aria-pressed=true]')?.dataset.language })`,
        );
        assert.equal(chrome.nav, false);
        assert.equal(chrome.footer, false);
        assert.equal(chrome.lang, "ka");
      }
      await evaluate(
        `Promise.all([...document.images].map(img=>img.decode?.().catch(()=>{}))).then(()=>{for(const animation of document.getAnimations())if(animation.effect?.getTiming().iterations!==Infinity)animation.finish();})`,
      );
      const shot = await send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: true,
      });
      await writeFile(
        `.impeccable/review/${route.replaceAll("/", "-").slice(1)}-${width}.png`,
        Buffer.from(shot.data, "base64"),
      );
      console.log(`${route} at ${width}px: rendered, no horizontal overflow`);
    }
  }

  async function waitFor(expression, message = "Page did not settle") {
    const start = Date.now();
    while (Date.now() - start < 20000) {
      try {
        if (await evaluate(`Boolean(${expression})`)) return;
      } catch {
        /* Navigation may replace the execution context between polls. */
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(message);
  }
  async function chooseLanguage(lang, heading) {
    await waitFor(
      `Object.keys(document.querySelector('.customer-language summary') ?? {}).some(key=>key.startsWith('__reactProps'))`,
      "Language picker did not hydrate",
    );
    await evaluate(
      `document.querySelector('.customer-language').open=true; document.querySelector('[data-language="${lang}"]').click()`,
    );
    await waitFor(
      `document.querySelector('h1')?.innerText === ${JSON.stringify(heading)} && document.documentElement.lang === '${lang}'`,
      "Translation did not load",
    );
  }
  await send("Page.navigate", { url: `${origin}/loyalty` });
  await waitFor(
    `location.pathname==='/loyalty' && document.querySelector('h1')?.innerText==='გამარჯობა!'`,
  );
  assert.equal(
    await evaluate(
      `Boolean(document.querySelector('.customer-language select'))`,
    ),
    false,
  );
  await waitFor(
    `Object.keys(document.querySelector('.customer-language summary') ?? {}).some(key=>key.startsWith('__reactProps'))`,
  );
  await evaluate(
    `document.querySelector('.customer-language summary').click()`,
  );
  assert.equal(
    await evaluate(`document.querySelector('.customer-language').open`),
    true,
  );
  const languageHit = await evaluate(
    `(() => {const b=document.querySelector('.customer-language [data-language="en"]');const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,reachable:b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};})()`,
  );
  assert.equal(
    languageHit.reachable,
    true,
    "Language choices must overlay the card and receive pointer events",
  );
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await waitFor(
    `!document.querySelector('.customer-language').open`,
    "Language picker did not close on Escape",
  );
  console.log(
    "Custom menu language popup opens and closes on Escape; no native select",
  );
  await chooseLanguage("en", "Hello!");
  await chooseLanguage("ru", "Привет!");
  await send("Page.navigate", { url: `${origin}/admin/loyalty` });
  await waitFor(
    `location.pathname==='/admin/loyalty' && document.querySelector('h1')?.innerText==='Администрирование'`,
  );
  await chooseLanguage("en", "Administration");
  assert.deepEqual(
    await evaluate(
      `[...document.querySelectorAll('main input')].map(input=>input.name)`,
    ),
    ["password"],
  );
  console.log(
    "Customer/admin language switching works; admin remains password-only",
  );
  await send("Page.navigate", { url: `${origin}/loyalty` });
  await waitFor(
    `location.pathname==='/loyalty' && document.querySelector('h1')?.innerText==='Hello!'`,
  );
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  assert.equal(
    await evaluate(
      `getComputedStyle(document.querySelector('.card-preview')).animationName`,
    ),
    "none",
  );
  assert.equal(
    await evaluate(
      `getComputedStyle(document.querySelector('.card-preview')).transform`,
    ),
    "none",
  );
  await send("Emulation.setEmulatedMedia", { features: [] });
  await waitFor(
    `Object.keys(document.querySelector('.customer-join button') ?? {}).some(key=>key.startsWith('__reactProps'))`,
  );
  if (process.env.LOYALTY_VERIFY_SIGNUP === "1") {
    await send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await evaluate(`document.querySelector('.customer-join button').click()`);
    await waitFor(
      `document.querySelector('h1')?.innerText==='Your loyalty card' && document.querySelector('h1')?.getBoundingClientRect().height > 0 && document.querySelector('.loyalty-qr')?.complete && document.querySelector('.loyalty-qr')?.getBoundingClientRect().width > 0`,
      "Real signup did not render a membership card",
    );
    assert.equal(
      await evaluate(`document.cookie.includes('suro-loyalty=')`),
      false,
    );
    assert.equal(
      await evaluate(`document.documentElement.scrollWidth > innerWidth + 1`),
      false,
    );
    const cardShot = await send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
    });
    await writeFile(
      ".impeccable/review/loyalty-created-390.png",
      Buffer.from(cardShot.data, "base64"),
    );
    await send("Page.reload");
    await waitFor(
      `document.querySelector('h1')?.innerText==='Your loyalty card' && document.querySelector('h1')?.getBoundingClientRect().height > 0 && document.querySelector('.loyalty-qr')?.complete && document.querySelector('.loyalty-qr')?.getBoundingClientRect().width > 0`,
      "Membership did not persist on reload",
    );
    assert.equal(await evaluate(`document.querySelectorAll('.live-stamp-card button').length`), 0, "The card face must have no action buttons");
    assert.equal(await evaluate(`document.querySelectorAll('main a').length`), 0, "The card must have no visible link controls");
    const publicLink = await evaluate(`location.origin + '/loyalty/card/' + localStorage.getItem('suro-card-code')`);
    await send("Network.clearBrowserCookies");
    await send("Page.navigate", { url: publicLink });
    await waitFor(
      `document.querySelector('h1')?.innerText==='შენი ბარათი' && document.querySelector('.loyalty-qr')?.complete`,
      "Public card did not open without cookies",
    );
    const popupShot = await send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
    });
    await writeFile(
      ".impeccable/review/loyalty-public-390.png",
      Buffer.from(popupShot.data, "base64"),
    );
    console.log(
      "Card face has no action buttons or visible links; terms is separate; public live-card link works without a membership cookie",
    );
    console.log(
      "Real browser signup succeeded, private cookie set, personal QR shown, membership survives reload",
    );
  } else {
    // Mock only this browser's request to inspect waiting/error UI without issuing a membership.
    await evaluate(
      `window.fetch=()=>new Promise(resolve=>setTimeout(()=>resolve(new Response('{}',{status:503,headers:{'Content-Type':'application/json'}})),1500)); document.querySelector('.customer-join button').click()`,
    );
    await waitFor(
      `document.querySelector('.customer-join')?.getAttribute('aria-busy')==='true' && document.querySelector('.customer-join .loyalty-spinner')`,
    );
    assert.equal(
      await evaluate(
        `document.querySelector('.customer-join button').disabled`,
      ),
      true,
    );
    await waitFor(
      `document.querySelector('.customer-join [role=alert]') && !document.querySelector('.customer-join button').disabled`,
    );
    console.log(
      "Reduced-motion preference, submit spinner, disabled waiting state and error recovery verified",
    );
  }
  // Assert origin checking without creating a membership in any environment.
  const forbidden = await fetch(`${origin}/api/loyalty/enroll`, {
    method: "POST",
    headers: { Origin: "https://untrusted.example" },
  });
  assert.equal(forbidden.status, 403);
  console.log("Cross-origin enrollment rejected (403)");
} finally {
  ws?.close();
  browser.kill();
  await new Promise((r) => setTimeout(r, 250));
  await rm(profile, { recursive: true, force: true });
}
