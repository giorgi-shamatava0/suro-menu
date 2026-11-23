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
    "--remote-debugging-port=9231",
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
        await (await fetch("http://127.0.0.1:9231/json/list")).json()
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


 async function waitFor(expression){const start=Date.now();while(Date.now()-start<20000){try{if(await evaluate(`Boolean(${expression})`))return}catch{}await new Promise(r=>setTimeout(r,100))}throw new Error('Page did not settle')}
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
 const result=JSON.parse(await readFile('/tmp/suro-browser-result.json','utf8'));
 await send('Page.navigate',{url:origin+result.path});await waitFor(`document.querySelector('.loyalty-qr')?.complete`);
 console.log('Card loaded; loading QR decoder');await evaluate(await readFile('node_modules/html5-qrcode/html5-qrcode.min.js','utf8'));
 const png=(await readFile('/tmp/suro-card-downloads/Suro-ka.png')).toString('base64');
 const decoded=await evaluate(`(async()=>{const box=document.createElement('div');box.id='qr-test';document.body.append(box);const data=await(await fetch('data:image/png;base64,${png}')).blob();try{return await new Html5Qrcode('qr-test').scanFile(new File([data],'card.png',{type:'image/png'}),false)}finally{box.remove()}})()`);
 assert.equal(decoded,origin+result.path);console.log('Downloaded card QR decodes to the full unique recovery URL');
 const token=await readFile('/tmp/suro-dev-test-session','utf8');
 await evaluate(`localStorage.setItem('suro-admin',${JSON.stringify(token)});document.cookie='lang=en;path=/'`);
 await send('Page.navigate',{url:origin+'/admin/loyalty'});await waitFor(`document.querySelectorAll('.loyalty-tabs button').length===3 && document.querySelector('.program-summary')`);
 assert.deepEqual(await evaluate(`[...document.querySelectorAll('.loyalty-tabs button')].map(b=>b.textContent)`),['Cards','Staff','Terms']);
 const admin=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile('.impeccable/review/reworked-admin-1440.png',Buffer.from(admin.data,'base64'));
 await evaluate(`document.querySelectorAll('.loyalty-tabs button')[1].click()`);await waitFor(`document.querySelector('.admin-disclosure')`);
 assert.equal(await evaluate(`document.querySelectorAll('select[name=role]').length`),0);
 assert.equal(await evaluate(`document.body.innerText.includes('Barista')||document.body.innerText.includes('Loyalty administrator')`),false);
 await evaluate(`window.confirm=()=>false;document.querySelector('.loyalty-admin-heading>button').click()`);assert.ok(await evaluate(`Boolean(localStorage.getItem('suro-admin'))`));
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 const mobile=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile('.impeccable/review/reworked-admin-390.png',Buffer.from(mobile.data,'base64'));
 assert.equal(await evaluate(`document.documentElement.scrollWidth>innerWidth+1`),false);
 console.log('Admin renders with three sections; staff reset has no role selector; logout cancellation keeps session; mobile has no overflow');
}finally{ws?.close();browser.kill();await new Promise(r=>setTimeout(r,400));await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200})}
