import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const outputDir = path.resolve('artifacts/parent-names');
await mkdir(outputDir, { recursive: true });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const cases = ['thazin', 'noir', 'rose'].flatMap(design =>
  [[320,568], [360,640], [390,844], [1440,900]].map(([width,height]) => ({ design,width,height,kind:'long' }))
);
cases.push({design:'rose',width:320,height:568,kind:'breaks'}, {design:'rose',width:320,height:568,kind:'oversize'});

async function verify(test) {
  const profile = await mkdtemp(path.join(tmpdir(), 'parent-text-qa-'));
  const child = spawn('chromium', ['--headless','--no-sandbox','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check', '--hide-scrollbars', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], {stdio:'ignore'});
  let socket;
  try {
    let port;
    for (let i=0;i<100;i++) {
      try { port=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]; break; } catch { await delay(100); }
    }
    if (!port) throw new Error('Isolated test browser did not start');
    const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const tab = tabs.find(tab=>tab.type==='page');
    socket = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
    let id=0;
    const pending=new Map();
    socket.addEventListener('message',event=>{const message=JSON.parse(event.data);const item=pending.get(message.id);if(item){pending.delete(message.id);message.error?item.reject(new Error(JSON.stringify(message.error))):item.resolve(message.result);}});
    const cdp=(method,params={})=>new Promise((resolve,reject)=>{const next=++id;pending.set(next,{resolve,reject});socket.send(JSON.stringify({id:next,method,params}));});
    await cdp('Page.enable');
    await cdp('Emulation.setDeviceMetricsOverride',{width:test.width,height:test.height,deviceScaleFactor:2,mobile:false});
    await cdp('Page.navigate',{url:`http://localhost:5174/artifacts/parent-name-preview.html?design=${test.design}&case=${test.kind}`});
    let report;
    const deadline=Date.now()+45000;
    while(Date.now()<deadline) {
      const result=await cdp('Runtime.evaluate',{expression:"(() => {const result=document.getElementById('parent-qa-results');return result ? JSON.parse(result.textContent) : null;})()",returnByValue:true});
      report=result.result?.value;
      if(report)break;
      await delay(180);
    }
    if(!report)throw new Error('Invitation did not reach the formal-card page');
    report.viewportExact=report.viewport[0]===test.width && report.viewport[1]===test.height;
    report.passed=report.passed && report.viewportExact;
    const shot = test.design==='rose' && test.kind==='long' && [320,390,1440].includes(test.width);
    if(shot){const result=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true});const name=test.width===1440?'desktop-1440.png':`mobile-${test.width}.png`;await writeFile(path.join(outputDir,name),Buffer.from(result.data,'base64'));report.screenshot=name;}
    console.log(`${report.passed?'PASS':'FAIL'} ${test.design} ${test.width}x${test.height} ${test.kind}; fit=${report.fit}; parent text exact=${report.textExact}; weight=${report.parents.map(p=>p.weight).join('/')}`);
    return report;
  } catch(error) {
    console.log(`FAIL ${test.design} ${test.width}x${test.height} ${test.kind}: ${error.message}`);
    return {...test,passed:false,error:error.message};
  } finally {
    socket?.close(); child.kill('SIGTERM');
    await delay(150);
    await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100}).catch(()=>{});
  }
}
const reports = new Array(cases.length);
let cursor=0;
await Promise.all(Array.from({length:3},async()=>{while(cursor<cases.length){const i=cursor++;reports[i]=await verify(cases[i]);}}));
await writeFile(path.join(outputDir,'browser-qa.json'),JSON.stringify(reports,null,2)+'\n');
const passed=reports.filter(report=>report.passed).length;
console.log(`${passed}/${reports.length} browser layout cases passed`);
if(passed!==reports.length)process.exitCode=1;
