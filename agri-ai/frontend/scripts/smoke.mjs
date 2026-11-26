import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { existsSync, readFileSync, mkdtempSync, rmSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

// Real browser against the production bundle with isolated API fixtures; never calls an external model.
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/main/resources/static/ai-ops')
const browserPath=process.env.AGRI_BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
assert.ok(existsSync(browserPath),'Set AGRI_BROWSER_PATH to a Chromium browser')
const profile=mkdtempSync(path.join(os.tmpdir(),'agri-ai-vue-smoke-'))
const scene={code:'farm.crop.schedule',name:'农事计划',domain:'生产管理',bizSystem:'production',description:'生产计划建议',exampleJson:'{"crop":"水稻"}',enabled:true,revision:1,publishedVersion:1,versions:[{number:1,note:'测试版本',publishedAt:'2026-11-26T00:00:00Z',systemPrompt:'你是农业助手',userPrompt:'{{input}}'}],events:[]}
const provider={id:'test',name:'测试模型',model:'test-model',baseUrl:'https://example.invalid/v1',configured:true,keyConfigured:true,selected:true,inferenceEnabled:true,fallbackToRuleTemplate:true,revision:1,custom:true}
const overview={sceneCount:1,systemCount:1,callCount:0,successCount:0,averageLatencyMs:0,status:'UP',auditWritable:true,modelConfigured:true,recent:[]}
const requests=[],errors=[]
let denied=false, failCalls=false
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost')
 if(url.pathname.startsWith('/api/')){
  let body='';for await(const chunk of req)body+=chunk
  requests.push({path:url.pathname,method:req.method,body,client:req.headers['x-sso-client']})
  let data
  if(url.pathname==='/api/v1/auth/refresh')data={accessToken:'test-only-token',user:{username:'tester',nickname:'测试管理员'}}
  else if(url.pathname==='/api/v1/platform/permissions/mine')data={permissions:denied?[]:['ai:admin']}
  else if(url.pathname==='/api/ai/admin/scenes')data=[scene]
  else if(url.pathname==='/api/ai/admin/scenes/'+scene.code)data=scene
  else if(url.pathname==='/api/ai/admin/overview')data=overview
  else if(url.pathname==='/api/ai/admin/providers')data=[provider]
  else if(url.pathname==='/api/ai/admin/calls'){
   if(failCalls){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({message:'日志服务暂不可用'}));return}
   data={records:[],total:0,page:1,pageSize:20}
  }
  else if(url.pathname==='/api/ai/admin/circuit-alerts/summary')data={latestId:'1',unreadCount:1,writable:true}
  else if(url.pathname==='/api/ai/admin/circuit-alerts')data={latestId:'1',unreadCount:1,writable:true,retained:0,total:0,providers:[],records:[]}
  else if(url.pathname==='/api/ai/admin/debug')data={ok:true,result:{advice:'测试建议'},usage:{latency_ms:1,execution_mode:'REAL_MODEL'}}
  else {res.writeHead(404);res.end(JSON.stringify({message:'Unmocked API '+url.pathname}));return}
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({code:0,data}));return
 }
 let rel=decodeURIComponent(url.pathname).replace(/^\/ai-ops\/?/,'')||'index.html'
 const file=path.resolve(base,rel)
 if(!file.startsWith(base+path.sep)||!existsSync(file)){res.writeHead(404);res.end();return}
 const type=file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'
 res.writeHead(200,{'Content-Type':type});res.end(readFileSync(file))
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const origin=`http://127.0.0.1:${server.address().port}`
const browser=spawn(browserPath,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--disable-gpu','--window-size=1440,1000','about:blank'],{stdio:'ignore',windowsHide:true})
let ws,sequence=0
const pending=new Map()
async function until(fn,label){for(let i=0;i<100;i++){if(await fn())return;await delay(100)}throw Error('Timed out: '+label)}
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));setTimeout(()=>{if(pending.delete(id))reject(Error('CDP timeout: '+method))},10000).unref()})}
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result?.value}
const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)
async function page(id,selector){await click(`[data-nav="${id}"]`);await until(()=>evaluate(`document.querySelector('#crumb').textContent===${JSON.stringify({overview:'运行概览',scenes:'场景中心',prompts:'提示词管理',debug:'调试工作台',calls:'调用日志',providers:'模型接入',governance:'权限与审计'}[id])} && Boolean(document.querySelector(${JSON.stringify(selector)}))`),id);assert.equal(await evaluate("document.querySelector('#notice').hidden"),true)}
try{
 const portFile=path.join(profile,'DevToolsActivePort')
 await until(()=>existsSync(portFile),'browser startup')
 const port=readFileSync(portFile,'utf8').split(/\r?\n/)[0]
 const tab=await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json()
 ws=new WebSocket(tab.webSocketDebuggerUrl)
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})})
 ws.addEventListener('message',event=>{const msg=JSON.parse(event.data);if(msg.id){const item=pending.get(msg.id);if(item){pending.delete(msg.id);msg.error?item.reject(Error(msg.error.message)):item.resolve(msg.result)}}else if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.text)})
 await send('Runtime.enable');await send('Page.enable')
 await send('Page.navigate',{url:origin+'/ai-ops/'})
 await until(()=>evaluate("document.querySelector('#app') && !document.querySelector('#app').hidden && document.querySelector('#content h1')?.textContent==='运行概览'"),'authenticated boot')
 assert.equal(await evaluate("document.querySelector('#root').hasAttribute('data-v-app')"),true)
 assert.equal(await evaluate("document.querySelector('#username').textContent"),'测试管理员')
 await until(()=>evaluate("document.querySelector('#model-notifications').textContent.includes('1')"),'notification badge')
 await click('#side-user-trigger');assert.equal(await evaluate("document.querySelector('#side-user-trigger').getAttribute('aria-expanded')"),'true')
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape'});assert.equal(await evaluate("document.querySelector('#side-user-menu').hidden"),true)
 await page('scenes','#scene-search')
 await click('.agri-vue-table tbody td.is-selection input[type="checkbox"]');assert.equal(await evaluate("document.querySelector('#batch-bind-model').disabled"),false)
 await click('#batch-bind-model');await until(()=>evaluate("!document.querySelector('#drawer').hidden && Boolean(document.querySelector('#batch-model-form'))"),'batch model dialog')
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape'})
 await click('#add-scene');assert.equal(await evaluate("Boolean(document.querySelector('#create-scene-form')) && !document.querySelector('#drawer').hidden"),true)
 await click('#close-create-scene')
 await page('prompts','#prompt-draft')
 assert.equal(await evaluate("document.querySelector('#user-prompt').value.includes('{{input}}')"),true)
 await page('debug','#debug-form')
 await click('#run');await until(()=>evaluate("document.querySelector('#result').textContent.includes('测试建议')"),'debug result')
 assert.ok(requests.some(r=>r.path.endsWith('/debug')&&JSON.parse(r.body).sceneCode===scene.code))
 await page('calls','#query-calls')
 await page('providers','#add-provider');await click('#add-provider')
 assert.equal(await evaluate("Boolean(document.querySelector('#provider-config-form')) && !document.querySelector('#drawer').hidden"),true)
 await click('#close-provider')
 await page('governance','#content .governance')
 await click('#model-notifications');await until(()=>evaluate("document.querySelector('#alert-summary')?.textContent.includes('筛选结果')"),'notification dialog')
 await click('#close-circuit-alerts')
 await click('#refresh');await until(()=>evaluate("document.querySelector('#toast').textContent==='数据已刷新'"),'refresh')
 failCalls=true;await click('[data-nav="calls"]');await until(()=>evaluate("!document.querySelector('#notice').hidden && document.querySelector('#notice').textContent.includes('日志服务暂不可用')"),'API error handling')
 denied=true;await send('Page.navigate',{url:origin+'/ai-ops/'})
 await until(()=>evaluate("document.querySelector('#boot-message')?.textContent.includes('没有 AI 中台管理权限')"),'permission gate')
 assert.equal(await evaluate("document.querySelector('#app').hidden"),true)
 assert.ok(requests.some(r=>r.path==='/api/v1/auth/refresh'&&r.client==='ai-ops'))
 assert.deepEqual(errors,[])
 console.log('PASS: Vue mount, session/permission gate, all 7 pages, menus, scene dialogs, prompt literals, debug submission, model dialog, notifications, refresh and API failure handling')
}finally{
 ws?.close();browser.kill();await new Promise(resolve=>server.close(resolve))
 await delay(500)
 if(path.dirname(profile)===os.tmpdir()&&path.basename(profile).startsWith('agri-ai-vue-smoke-'))try{rmSync(profile,{recursive:true,force:true})}catch{}
}
