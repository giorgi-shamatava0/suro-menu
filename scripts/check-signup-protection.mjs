import { build } from "esbuild";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
const origin = process.env.LOYALTY_TEST_URL ?? "http://localhost:3012";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname), "Use localhost only");
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
    "--remote-debugging-port=9233",
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
        await (await fetch("http://127.0.0.1:9233/json/list")).json()
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
  const bundle = await build({
    stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import Join from './app/(loyalty)/loyalty/Join';createRoot(document.querySelector('#pin-fixture')).render(<Join lang="en"/>);`, resolveDir: process.cwd(), loader: 'tsx' },
    bundle: true, write: false, format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
  });
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send("Page.navigate", { url: origin + '/loyalty' });
  await waitFor(`document.querySelector('h1')`);
  await evaluate(`document.body.innerHTML='<main style="max-width:360px;margin:48px auto;padding:16px"><h1>Signup PIN check</h1><div id="pin-fixture"></div></main>';window.pinAttempts=0;window.pinRequestCount=0;window.fetch=async()=>{window.pinRequestCount++;return new Response(JSON.stringify({code:'STAFF_PIN_REQUIRED'}),{status:409,headers:{'Content-Type':'application/json'}})};`);
  await evaluate(bundle.outputFiles[0].text);
  await waitFor(`document.querySelector('.activation-consent input')`);
  await evaluate(`document.querySelector('.activation-consent input').click()`);
  await waitFor(`!document.querySelector('.customer-join > .loyalty-primary').disabled`);
  await evaluate(`document.querySelector('.customer-join > .loyalty-primary').click()`);
  await waitFor(`document.querySelector('.signup-pin-dialog').open`);
  await waitFor(`document.activeElement.id==='signup-staff-pin'`);
  assert.match(await evaluate(`document.querySelector('.signup-pin-dialog').innerText`),/spam protection/);
  await mkdir('.impeccable/review/signup-pin',{recursive:true});
  const screenshot = await send('Page.captureScreenshot',{format:'png'});
  await writeFile('.impeccable/review/signup-pin/mobile-dialog.png',Buffer.from(screenshot.data,'base64'));
  await evaluate(`window.fetch=async()=>{window.pinRequestCount++;window.pinAttempts++;return new Response(JSON.stringify({code:window.pinAttempts>=4?'STAFF_PIN_LOCKED':'STAFF_PIN_INVALID',resetsAt:Date.now()+3600000}),{status:window.pinAttempts>=4?429:401,headers:{'Content-Type':'application/json'}})};`);
  for(let i=1;i<=4;i++) {
    await evaluate(`{const input=document.querySelector('#signup-staff-pin');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'000000');input.dispatchEvent(new Event('input',{bubbles:true}));}`);
    await waitFor(`!document.querySelector('.signup-pin-dialog button[type="submit"]').disabled`);
    await evaluate(`document.querySelector('.signup-pin-dialog button[type="submit"]').click()`);
    await waitFor(`document.querySelector('#signup-pin-error') && !document.querySelector('.signup-pin-dialog input').disabled`);
    assert.match(await evaluate(`document.querySelector('#signup-pin-error').innerText`),i===4?/blocked/:/Incorrect PIN/);
    assert.equal(await evaluate(`document.querySelector('#signup-staff-pin').value`),'');
  }
  assert.equal(await evaluate(`document.documentElement.scrollWidth>innerWidth`),false);
  await evaluate(`document.querySelector('.signup-pin-cancel').click()`);
  assert.equal(await evaluate(`document.querySelector('.signup-pin-dialog').open`),false);
  const consent = await fetch(origin+'/api/loyalty/enroll',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:'{}'});
  assert.equal(consent.status,400);
  const csrf = await fetch(origin+'/api/loyalty/enroll',{method:'POST',headers:{origin:'https://unrelated.example','Content-Type':'application/json'},body:JSON.stringify({consent:'2026-11-23'})});
  assert.equal(csrf.status,403);
  console.log('PASS: actual signup component opens staff PIN dialog, focuses input, clears wrong PINs, shows fourth-attempt lock, cancels and fits mobile; real consent/origin checks pass. Enrollment responses were mocked; no cards or counters changed.');
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
