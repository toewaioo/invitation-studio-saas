import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const baseUrl = process.env.GUEST_COVER_BASE_URL || 'http://127.0.0.1:5175';
const outputDir = path.resolve('artifacts/guest-opening');
await mkdir(outputDir, { recursive: true });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const cases = [
  { name: 'mobile-390', width: 390, height: 844, design: 'thazin', screenshot: 'cover-mobile-initial.png', revealShot: 'cover-mobile-opening.png', openShot: 'cover-mobile-open.png', gallery: true, drag: true },
  { name: 'desktop-1440', width: 1440, height: 900, design: 'thazin', screenshot: 'cover-desktop-initial.png', revealShot: 'cover-desktop-opening.png', openShot: 'cover-desktop-open.png', keyboard: true },
  { name: 'small-320', width: 320, height: 568, design: 'thazin' },
  { name: 'mobile-360', width: 360, height: 640, design: 'thazin' },
  { name: 'mobile-375', width: 375, height: 667, design: 'rose' },
  { name: 'landscape-mobile', width: 844, height: 390, design: 'thazin' },
  { name: 'short-desktop', width: 1366, height: 620, design: 'thazin' },
  { name: 'rose-mobile', width: 390, height: 844, design: 'rose' },
  { name: 'rose-desktop', width: 1440, height: 900, design: 'rose' },
  { name: 'noir-mobile', width: 390, height: 844, design: 'noir' },
  { name: 'noir-desktop', width: 1440, height: 900, design: 'noir' },
  { name: 'blue-mobile', width: 390, height: 844, design: 'thazin', theme: 'blue' },
  { name: 'no-photo-mobile', width: 320, height: 568, design: 'rose', empty: '1', date: 'none' },
  { name: 'no-photo-desktop', width: 1440, height: 900, design: 'noir', empty: '1' },
  { name: 'long-names-mobile', width: 320, height: 568, design: 'thazin', long: '1' },
  { name: 'long-names-desktop', width: 1440, height: 900, design: 'rose', long: '1' },
  { name: 'reduced-mobile', width: 390, height: 844, design: 'thazin', reduced: true, keyboard: 'space' },
  { name: 'reduced-desktop', width: 1440, height: 900, design: 'noir', reduced: true },
];

async function verify(test) {
  const profile = await mkdtemp(path.join(tmpdir(), 'guest-cover-qa-'));
  const child = spawn('chromium', ['--headless', '--no-sandbox', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let socket;
  try {
    let port;
    for (let i = 0; i < 100; i++) {
      try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await delay(100); }
    }
    if (!port) throw new Error('Isolated test browser did not start');
    const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const tab = tabs.find(tab => tab.type === 'page');
    socket = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    let id = 0;
    const pending = new Map();
    const errors = [];
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
      const item = pending.get(message.id);
      if (item) { pending.delete(message.id); message.error ? item.reject(new Error(JSON.stringify(message.error))) : item.resolve(message.result); }
    });
    const cdp = (method, params = {}) => new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); });
    const evaluate = async expression => {
      const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
      return result.result?.value;
    };
    const until = async (expression, ms = 7000) => {
      const end = Date.now() + ms;
      while (Date.now() < end) { const value = await evaluate(expression); if (value) return value; await delay(70); }
      throw new Error(`Timed out waiting for ${expression}`);
    };
    const screenshot = async filename => {
      const result = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true });
      await writeFile(path.join(outputDir, filename), Buffer.from(result.data, 'base64'));
    };
    const point = async (selector, x = .5, y = .5) => evaluate(`(() => {const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:r.left+r.width*${x},y:r.top+r.height*${y}}})()`);
    const click = async p => {
      await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', ...p, button: 'left', clickCount: 1 });
      await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', ...p, button: 'left', clickCount: 1 });
    };
    await cdp('Page.enable');
    await cdp('Runtime.enable');
    await cdp('Emulation.setDeviceMetricsOverride', { width: test.width, height: test.height, deviceScaleFactor: 1, mobile: test.width < 700 });
    await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: test.reduced ? 'reduce' : 'no-preference' }] });
    const params = new URLSearchParams({ design: test.design });
    for (const key of ['theme', 'empty', 'long', 'date']) if (test[key]) params.set(key, test[key]);
    await cdp('Page.navigate', { url: `${baseUrl}/artifacts/guest-opening/preview.html?${params}` });
    await until("!!document.querySelector('#open-envelope') && !!document.querySelector('#share')");
    await evaluate('document.fonts.ready.then(() => Promise.all(Array.from(document.images, image => image.complete ? Promise.resolve() : new Promise(resolve => { image.onload=resolve; image.onerror=resolve; }))))');
    await delay(test.reduced ? 100 : 1550);
    const layout = await evaluate(`(() => {
      const root=document.querySelector('.invite'), arrival=document.querySelector('#arrival'), seal=document.querySelector('#open-envelope'), photo=document.querySelector('#arrival-photo');
      const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
      const s=seal.getBoundingClientRect(), centre=document.elementFromPoint(s.left+s.width/2,s.top+s.height/2);
      const names=document.querySelector('.to-guest').textContent;
      const essential=['.arrival-crest','.arrival-overline','.handwritten','.to-guest','#open-envelope','.open-whisper',...(document.querySelector('.arrival-date')?['.arrival-date']:[])];
      return {viewport:[innerWidth,innerHeight],overflow:document.documentElement.scrollWidth>innerWidth,
        essential:essential.map(selector=>({selector,...rect(selector)})),sealHit:centre?.closest('button')===seal,
        namesExact:names.includes(window.__guestCoverFixture.firstName)&&names.includes(window.__guestCoverFixture.secondName),
        hasPhoto:!photo.hidden,photoDisabled:photo.disabled,description:seal.getAttribute('aria-describedby')===document.querySelector('.open-whisper').id,
        pageCount:document.querySelectorAll('#right-leaves>.paper[data-page]').length,sharePresent:!!document.querySelector('#share'),
        animations:arrival.getAnimations({subtree:true}).map(animation=>({state:animation.playState,iterations:animation.effect.getTiming().iterations})),
        scene:rect('.envelope-scene'),envelope:rect('.envelope')};
    })()`);
    const checks = {
      exactViewport: layout.viewport[0] === test.width && layout.viewport[1] === test.height,
      noOverflow: !layout.overflow,
      essentialsVisible: layout.essential.every(r => r.left >= -1 && r.right <= test.width + 1 && r.top >= 8 && r.bottom <= test.height - 35),
      layersClearOfCopy: layout.envelope.top >= layout.essential.find(r => r.selector === '.to-guest').bottom && layout.envelope.bottom <= layout.essential.find(r => r.selector === '.open-whisper').top,
      sealReachable: layout.sealHit && layout.essential.find(r => r.selector === '#open-envelope').width >= 44,
      namesPreserved: layout.namesExact,
      instructionsLinked: layout.description,
      pagesAndShareIntact: layout.pageCount === 6 && layout.sharePresent,
      noInfiniteCoverAnimations: layout.animations.every(animation => Number.isFinite(animation.iterations)),
      reducedMotionStopped: !test.reduced || layout.animations.every(animation => animation.state !== 'running'),
      noPhotoState: test.empty !== '1' || (!layout.hasPhoto && layout.photoDisabled),
    };
    if (test.screenshot) await screenshot(test.screenshot);
    if (test.gallery) {
      const p = await point('#arrival-photo', .65, .2);
      await click(p);
      checks.galleryOpens = await until("document.querySelector('#photo-dialog').open");
      await evaluate("document.querySelector('.close-dialog').click()");
      checks.galleryRestoresFocus = await until("!document.querySelector('#photo-dialog').open && document.activeElement.id==='arrival-photo'");
    }
    const started = Date.now();
    if (test.keyboard) {
      await evaluate("document.querySelector('#open-envelope').focus()");
      const space = test.keyboard === 'space';
      const key = { key: space ? ' ' : 'Enter', code: space ? 'Space' : 'Enter', windowsVirtualKeyCode: space ? 32 : 13, nativeVirtualKeyCode: space ? 32 : 13 };
      await cdp('Input.dispatchKeyEvent', { type: 'keyDown', ...key, text: space ? ' ' : '\r', unmodifiedText: space ? ' ' : '\r' });
      await cdp('Input.dispatchKeyEvent', { type: 'keyUp', ...key });
    } else await click(await point('#open-envelope'));
    if (!test.reduced) {
      checks.busyDuringOpening = await until("document.querySelector('#arrival').getAttribute('aria-busy')==='true'", 700);
      if (test.revealShot) { await delay(1500); await screenshot(test.revealShot); }
    }
    await until("document.querySelector('#arrival').hidden && !document.querySelector('#reading-room').hidden && !document.querySelector('#arrival').hasAttribute('aria-busy') && document.activeElement.id==='next-page'");
    if (test.openShot) { await delay(1300); await screenshot(test.openShot); }
    const openingMs = Date.now() - started;
    checks.openingCompletes = true;
    checks.reducedMotionInstant = !test.reduced || openingMs < 500;
    await evaluate("document.querySelector('#next-page').click()");
    checks.innerPageNavigation = await until("document.querySelector('.paper.active')?.dataset.page==='1' && document.querySelector('#page-number').textContent.includes('၂')");
    await delay(test.reduced ? 30 : 850);
    await evaluate("document.querySelector('#rewrap').click()");
    checks.rewrapRestoresCover = await until("!document.querySelector('#arrival').hidden && document.querySelector('#reading-room').hidden && !document.querySelector('#open-envelope').disabled && document.activeElement.id==='open-envelope' && !document.querySelector('#arrival').classList.contains('opening')");
    if (test.drag) {
      await delay(1400);
      const p = await point('#open-envelope');
      await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', ...p, button: 'left', clickCount: 1 });
      await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x + 55, y: p.y - 18, button: 'left', buttons: 1 });
      await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x + 55, y: p.y - 18, button: 'left', clickCount: 1 });
      checks.dragOpens = await until("document.querySelector('#arrival').hidden && document.activeElement.id==='next-page'");
    }
    checks.noRuntimeErrors = errors.length === 0;
    const passed = Object.values(checks).every(Boolean);
    console.log(`${passed ? 'PASS' : 'FAIL'} ${test.name}: ${openingMs}ms opening; ${Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name).join(', ') || 'all checks'}`);
    return { ...test, passed, checks, openingMs, layout, errors };
  } catch (error) {
    console.log(`FAIL ${test.name}: ${error.message}`);
    return { ...test, passed: false, error: error.message };
  } finally {
    socket?.close(); child.kill('SIGTERM'); await delay(150);
    await rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }).catch(() => {});
  }
}
const reports = new Array(cases.length);
let cursor = 0;
await Promise.all(Array.from({ length: 3 }, async () => { while (cursor < cases.length) { const i = cursor++; reports[i] = await verify(cases[i]); } }));
await writeFile(path.join(outputDir, 'browser-qa.json'), JSON.stringify(reports, null, 2) + '\n');
const passed = reports.filter(report => report.passed).length;
console.log(`${passed}/${reports.length} guest-cover browser cases passed`);
if (passed !== reports.length) process.exitCode = 1;
