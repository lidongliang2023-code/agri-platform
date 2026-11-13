const $ = (q) => document.querySelector(q)
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const state = { token:'', user:null, permissions:[], scenes:[], overview:null, providers:[], providerChanges:{}, page:1, keyword:'', status:'', domain:'', sceneSearch:'', sceneModelSource:'', sceneModelProvider:'', sceneSelection:new Set(), sceneBatchSaving:false, selected:'farm.crop.schedule', result:null, running:false, providerTests:{}, providerTesting:{}, providerSwitching:false, sceneCreating:false }
const CLIENT='ai-ops', PREFIX='agri_ai_ops_', landing='/ai-ops/'
const sso = ['localhost','127.0.0.1'].includes(location.hostname) ? `${location.protocol}//${location.hostname}:8090` : 'https://sso.agri-platform.com'
const navs = [['overview','运行概览','M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z'],['scenes','场景中心','M12 3l9 5-9 5-9-5z M3 12l9 5 9-5 M3 16l9 5 9-5'],['prompts','提示词管理','M5 3h14v18H5z M8 8h8 M8 12h8 M8 16h5'],['debug','调试工作台','M8 7l-5 5 5 5 M16 7l5 5-5 5 M14 4l-4 16'],['calls','调用日志','M5 3h14v18H5z M8 8h8 M8 12h8 M8 16h5'],['providers','模型接入','M8 3v4 M16 3v4 M5 7h14v6a7 7 0 01-14 0z M12 20v3'],['governance','权限与审计','M12 2l8 4v6c0 5-8 10-8 10S4 17 4 12V6z M8 12l3 3 5-6']]
const icons=['♧','⌁','⇄','▦','◇','◷','≋','✧']
let toastTimer
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,4200)}
async function request(path, options={}){
 const {timeoutMs=20000,...fetchOptions}=options
 const res=await fetch(path,{...fetchOptions,credentials:'include',headers:{...(state.token?{Authorization:`Bearer ${state.token}`} : {}),...(options.body?{'Content-Type':'application/json'}:{}),...(path.startsWith('/api/v1/auth/')?{'X-Sso-Client':CLIENT}:{}),...options.headers},signal:AbortSignal.timeout(timeoutMs)})
 const body=await res.json().catch(()=>({message:'服务返回格式不正确'}))
 if(res.status===401 && !path.includes('/auth/')){state.token='';throw new Error('统一登录已过期，请刷新页面重新登录')}
 if(!res.ok || (typeof body.code==='number' && body.code!==0 && body.code!==200))throw new Error(body.message || `请求失败（${res.status}）`)
 return body.data ?? body
}
const api=(path,options)=>request(`/api/ai/admin/${path}`,options)
const granted=(p)=>state.permissions.some(x=>x==='*'||x==='ai:*'||x===p)
const b64=(bytes)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
async function login(){
 const verifier=b64(crypto.getRandomValues(new Uint8Array(32))), nonce=b64(crypto.getRandomValues(new Uint8Array(16)))
 sessionStorage.setItem(PREFIX+'verifier',verifier);sessionStorage.setItem(PREFIX+'state',nonce)
 sessionStorage.setItem(PREFIX+'return',location.pathname==='/sso/callback'?landing:location.pathname+location.hash)
 const challenge=b64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))))
 const params=new URLSearchParams({client_id:CLIENT,redirect_uri:location.origin+'/sso/callback',state:nonce,code_challenge:challenge,code_challenge_method:'S256'})
 location.assign(sso+'/authorize?'+params)
}
async function boot(){
 try{
  let session
  if(location.pathname==='/sso/callback'){
   const p=new URLSearchParams(location.search), expected=sessionStorage.getItem(PREFIX+'state'), verifier=sessionStorage.getItem(PREFIX+'verifier')
   if(!expected || p.get('state')!==expected || !verifier || !p.get('code'))throw new Error('登录回跳校验失败，请重新登录')
   session=await request('/api/v1/sso/token',{method:'POST',body:JSON.stringify({code:p.get('code'),clientId:CLIENT,codeVerifier:verifier})})
   sessionStorage.removeItem(PREFIX+'state');sessionStorage.removeItem(PREFIX+'verifier')
   const target=sessionStorage.getItem(PREFIX+'return');sessionStorage.removeItem(PREFIX+'return')
   history.replaceState({},'',target?.startsWith(landing)?target:landing)
  }else{try{session=await request('/api/v1/auth/refresh',{method:'POST',body:'{}'})}catch{}}
  if(!session?.accessToken){$('#boot-message').textContent='使用产业互联网平台账号，统一登录 AI 中台管理工作空间。';$('#login').hidden=false;return}
  state.token=session.accessToken;state.user=session.user
  const permissions=await request('/api/v1/platform/permissions/mine');state.permissions=permissions.permissions ?? []
  if(!granted('ai:admin'))throw new Error('当前账号没有 AI 中台管理权限，请使用平台管理员账号或联系运营开通 ai:admin。')
  const [scenes,overview,providers]=await Promise.all([api('scenes'),api('overview'),api('providers')])
  state.scenes=scenes;state.overview=overview;state.providers=providers
  $('#username').textContent=state.user?.nickname || state.user?.username || '平台管理员'
  $('#avatar').textContent=($('#username').textContent)[0]
  $('#nav').innerHTML=navs.map(([id,name,path])=>`<a href="#${id}" data-nav="${id}"><svg viewBox="0 0 24 24"><path d="${path}"/></svg><span>${name}</span></a>`).join('')
  $('#boot').hidden=true;$('#app').hidden=false;await render();startCircuitNotifications()
 }catch(e){$('#boot-message').textContent=e.message;$('#login').hidden=false}
}
function head(title,desc,action=''){return `<div class="page-head"><div><div class="eyebrow">AI CAPABILITY CONSOLE</div><h1>${title}</h1><p>${desc}</p></div>${action}</div>`}
function domains(){return [...new Set(state.scenes.map(s=>s.domain))]}
function nameOf(code){return state.scenes.find(s=>s.code===code)?.name || code}
function time(value){return value?new Date(value).toLocaleString('zh-CN',{hour12:false}):'—'}
function pill(text,cls=''){return `<span class="pill ${cls}">${esc(text)}</span>`}
function rows(records,full=false){return records.length?records.map(e=>`<tr><td><div class="cell-title">${esc(nameOf(e.sceneCode))}</div><div class="mono">${esc(e.sceneCode)}</div></td>${full?`<td><div class="mono">${esc(e.taskId)}</div><div class="cell-sub">${esc(e.source)}${e.failover?' · 已故障切换':''}</div>${e.modelAttempts?.length?`<div class="cell-sub">${e.modelAttempts.map(a=>esc(a.provider_name)+'：'+esc(a.status==='SUCCESS'?'成功':a.reason||'失败')).join(' → ')}</div>`:''}</td>`:''}<td>${pill(e.status==='SUCCESS'?'调用成功':'调用失败',e.status==='SUCCESS'?'':'red')}</td><td>${e.latencyMs} <span class="cell-sub">ms</span></td><td>${esc(time(e.time))}</td>${full?`<td><button class="link" data-trace="${esc(e.traceId)}">复制追踪号</button></td>`:''}</tr>`).join(''):`<tr><td colspan="${full?6:4}" class="empty">暂无调用记录<br><span class="cell-sub">前往调试工作台发起一次场景调用</span></td></tr>`}
function overview(){const o=state.overview, count=o.callCount, rate=count?`${((o.successCount/count)*100).toFixed(1)}`:'—';return head('运行概览','统一管理农业 AI 能力，洞察业务场景与调用运行状态。','<a class="primary" href="#debug">＋ 发起场景调试</a>')+`
<section class="hero"><div><div class="eyebrow"><span class="live-dot"></span> AGRICULTURE · INTELLIGENCE HUB</div><h2>连接产业场景，释放智能价值</h2><p>汇聚农事生产、物联网、交易与服务能力。以统一场景协议连接业务，让每一次调用有据可查。</p><span class="hero-tag">${o.sceneCount} 个已接入场景 · ${o.systemCount} 个业务子系统</span></div><div class="hero-orbit"><div class="orbit-core">AI</div><div class="orbit-label">CONNECTED INTELLIGENCE</div></div></section>
<div class="stats"><div class="stat"><div class="stat-top">已接入业务场景 <span class="stat-icon">▦</span></div><div class="stat-value">${o.sceneCount}<small>个</small></div><div class="stat-foot">覆盖 <b>${o.systemCount} 个业务子系统</b></div></div><div class="stat"><div class="stat-top">保留调用总量 <span class="stat-icon">↗</span></div><div class="stat-value">${count}<small>次</small></div><div class="stat-foot">最近 1000 条持久化调用记录</div></div><div class="stat"><div class="stat-top">调用成功率 <span class="stat-icon">✓</span></div><div class="stat-value">${rate}<small>${count?'%':''}</small></div><div class="stat-foot">${count?`成功 ${o.successCount} 次 / 共 ${count} 次`:'暂无调用，不计算成功率'}</div></div><div class="stat"><div class="stat-top">平均响应耗时 <span class="stat-icon">◷</span></div><div class="stat-value">${count?Number(o.averageLatencyMs).toFixed(1):'—'}<small>ms</small></div><div class="stat-foot">仅统计当前保留记录的执行耗时</div></div></div>
<div class="split"><section class="panel"><div class="panel-head"><h2>业务能力矩阵<small>场景驱动 · 统一接入</small></h2><a class="link" href="#scenes">全部场景 ↗</a></div><div class="domain-grid">${domains().map((d,i)=>`<button class="domain" data-domain="${esc(d)}"><span class="domain-icon">${icons[i]}</span><b>${esc(d)}</b><small>${state.scenes.filter(s=>s.domain===d).length} 个业务场景</small></button>`).join('')}</div></section><section class="panel"><div class="panel-head"><h2>服务运行状态</h2>${pill('运行正常')}</div><div class="health-list"><div class="health-row"><span>AI 调度服务</span>${pill(o.status)}</div><div class="health-row"><span>统一认证中心</span>${pill('已连接')}</div><div class="health-row"><span>调用审计持久化</span>${pill(o.auditWritable?'可写入':'写入异常',o.auditWritable?'':'red')}</div><div class="health-row"><span>模型服务通道</span>${pill(o.modelConfigured?'已配置 · 未探测':'待配置','amber')}</div></div></section></div>
<div class="banner">能力说明：发布提示词并配置模型密钥后，场景调度会进入真实推理并记录服务端返回的 token；模型未配置或调用失败时按策略降级，结果会明确标记。</div>
<section class="panel"><div class="panel-head"><h2>最近调用<small>真实服务记录</small></h2><a class="link" href="#calls">查看全部 ↗</a></div><div class="table-scroll"><table><thead><tr><th>业务场景</th><th>执行状态</th><th>响应耗时</th><th>调用时间</th></tr></thead><tbody>${rows(o.recent)}</tbody></table></div></section>`}
function sceneProviderId(scene){return scene.providerId||state.providers.find(p=>p.selected)?.id||''}
function filteredScenes(){
 const keyword=state.sceneSearch.trim().toLowerCase()
 return state.scenes.filter(s=>(!state.domain||s.domain===state.domain)
  &&(!keyword||(s.name+' '+s.code+' '+s.domain).toLowerCase().includes(keyword))
  &&(!state.sceneModelSource||(s.providerId?'SCENE':'GLOBAL')===state.sceneModelSource)
  &&(!state.sceneModelProvider||sceneProviderId(s)===state.sceneModelProvider))
}
function sceneModelOptions(){
 const options=state.providers.map(p=>({id:p.id,label:p.name+' / '+p.model+(p.selected?'（当前全局）':'')+(!p.configured?'（待配置）':'')}))
 const ids=new Set(options.map(p=>p.id))
 for(const scene of state.scenes){if(scene.providerId&&!ids.has(scene.providerId)){ids.add(scene.providerId);options.push({id:scene.providerId,label:'不可用通道 / '+scene.providerId})}}
 if(state.sceneModelProvider&&!ids.has(state.sceneModelProvider))options.push({id:state.sceneModelProvider,label:'已移除通道 / '+state.sceneModelProvider})
 return options
}
function resetSceneFilters(){state.sceneSelection.clear();state.domain='';state.sceneSearch='';state.sceneModelSource='';state.sceneModelProvider=''}
function scenePage(){const list=filteredScenes();const visible=new Set(list.map(s=>s.code));state.sceneSelection=new Set([...state.sceneSelection].filter(code=>visible.has(code)));return head('场景中心','管理内置与自定义场景、模型路由及提示词发布版本。','<button id="add-scene" class="primary">＋ 新增自定义场景</button>')+`<section class="panel"><div class="toolbar scene-filters"><div class="search"><input id="scene-search" aria-label="搜索场景" placeholder="搜索场景名称、编码或业务域" value="${esc(state.sceneSearch)}"></div><select id="scene-domain" aria-label="筛选业务域"><option value="">全部业务子系统</option>${domains().map(d=>`<option ${state.domain===d?'selected':''}>${esc(d)}</option>`).join('')}</select><select id="scene-model-source" aria-label="筛选模型来源"><option value="">全部模型来源</option><option value="GLOBAL" ${state.sceneModelSource==='GLOBAL'?'selected':''}>跟随全局模型</option><option value="SCENE" ${state.sceneModelSource==='SCENE'?'selected':''}>场景专属模型</option></select><select id="scene-model-filter" aria-label="筛选模型通道"><option value="">全部模型通道</option>${sceneModelOptions().map(p=>`<option value="${esc(p.id)}" ${state.sceneModelProvider===p.id?'selected':''}>${esc(p.label)}</option>`).join('')}</select><button id="reset-scene-filters" class="text-button" ${state.domain||state.sceneSearch||state.sceneModelSource||state.sceneModelProvider?'':'disabled'}>重置</button><span class="muted" role="status">匹配 ${list.length} / ${state.scenes.length} 个场景</span></div><div class="toolbar scene-batch-bar"><span id="scene-selection-count" role="status">已选择 ${state.sceneSelection.size} 个场景</span><button id="batch-bind-model" class="primary" ${state.sceneSelection.size?'':'disabled'}>批量绑定模型</button><button id="clear-scene-selection" class="text-button" ${state.sceneSelection.size?'':'disabled'}>清空选择</button><small class="muted">全选仅作用于当前筛选结果；变更筛选会清空选择</small></div><div class="table-scroll"><table><thead><tr><th class="scene-select-cell"><input type="checkbox" id="select-visible-scenes" aria-label="全选当前筛选结果" ${list.length?'':'disabled'}></th><th>场景名称 / 编码</th><th>业务子系统</th><th>状态 / 提示词版本</th><th>模型路由 / 应用说明</th><th>操作</th></tr></thead><tbody>${list.map(s=>`<tr><td class="scene-select-cell"><input type="checkbox" data-scene-select="${esc(s.code)}" aria-label="选择${esc(s.name)}" ${state.sceneSelection.has(s.code)?'checked':''}></td><td><div class="cell-title">${esc(s.name)} ${s.custom?pill('自定义','gray'):''}</div><div class="mono">${esc(s.code)}</div></td><td>${esc(s.domain)}</td><td>${pill(s.enabled?'已启用':'已停用',s.enabled?'':'gray')} ${pill(s.publishedVersion?'v'+s.publishedVersion:'未发布','amber')}</td><td><div class="cell-title">${esc(sceneModelText(s))}</div><div class="cell-sub">${esc(s.description)}</div></td><td><button class="link" data-manage="${s.code}">配置与提示词</button> <button class="link" data-detail="${s.code}">详情</button> <button class="link" data-debug="${s.code}" style="margin-left:12px">调试 ↗</button></td></tr>`).join('')||'<tr><td colspan="6" class="empty">没有匹配的场景，请调整筛选条件</td></tr>'}</tbody></table></div></section><div class="inline-note">模型通道按当前配置路由筛选，跟随全局的场景计入当前全局通道；实际调用以回执为准。可新增自定义场景；保存后场景编码与业务子系统固定，停用后统一调度拒绝执行。自定义场景使用已发布提示词调用模型，无内置规则降级。提示词支持版本发布与回滚，真实模型推理使用已发布版本，规则降级不消费提示词正文。</div>`}
function createSceneDrawer(){
 if(state.sceneCreating)return
 const systems=[...new Map(state.scenes.map(s=>[s.bizSystem,{id:s.bizSystem,name:s.domain}])).values()]
 const drawer=$('#drawer')
 drawer.innerHTML=`<section class="drawer" role="dialog" aria-modal="true" aria-labelledby="create-scene-title"><div class="panel-head"><h2 id="create-scene-title">新增自定义场景</h2><button id="close-create-scene" type="button" class="text-button">关闭 ✕</button></div><form id="create-scene-form" class="form"><div class="field"><label for="new-scene-name">场景名称</label><input id="new-scene-name" maxlength="80" required placeholder="如：采收品质分析"></div><div class="field"><label for="new-scene-code">场景编码</label><input id="new-scene-code" maxlength="100" required placeholder="如：custom.harvest.quality"><small>小写字母开头，以点、下划线或短横线分段；编码唯一，保存后不可更改。</small></div><div class="field"><label for="new-scene-system">业务子系统</label><select id="new-scene-system" required><option value="" disabled selected>请选择业务子系统</option>${systems.map(s=>`<option value="${esc(s.id)}">${esc(s.name)} / ${esc(s.id)}</option>`).join('')}</select></div><div class="field"><label for="new-scene-description">应用说明</label><textarea id="new-scene-description" maxlength="500" required style="min-height:75px" placeholder="说明场景用途与预期结果"></textarea></div><div class="field"><label for="new-scene-enabled">运行状态</label><select id="new-scene-enabled"><option value="true">启用（发布后可调用）</option><option value="false">停用</option></select></div><div class="field"><label for="new-scene-provider">模型通道</label><select id="new-scene-provider"><option value="">跟随全局模型</option>${state.providers.map(p=>`<option value="${esc(p.id)}" ${p.configured?'':'disabled'}>${esc(p.name)} / ${esc(p.model)}${p.configured?'':'（待配置）'}</option>`).join('')}</select><small>可保存后再配置模型；专属通道须先完成接入配置。</small></div><div class="field"><label for="new-scene-example">JSON 参数示例</label><textarea id="new-scene-example" maxlength="16000" required style="min-height:110px">${esc(JSON.stringify({query:'请输入需要分析的内容'},null,2))}</textarea><small>JSON 对象，最多50个顶层字段、16000个字符。</small></div><div class="field"><label for="new-scene-system-prompt">系统提示词</label><textarea id="new-scene-system-prompt" maxlength="8000" required style="min-height:100px">你是农业产业互联网的专业助手。请依据输入数据返回结构化建议与风险说明，信息不足时明确说明，不编造事实。</textarea></div><div class="field"><label for="new-scene-user-prompt">用户提示词</label><textarea id="new-scene-user-prompt" maxlength="12000" required style="min-height:100px">业务编号：{{bizId}}
业务输入：{{input}}
请返回一个合法 JSON 对象。</textarea><small>{{input}} 为完整输入，{{bizId}} 为业务编号；也可使用示例中的顶层字段变量，如 {{query}}。</small></div><div class="field"><label for="new-scene-note">首版说明</label><input id="new-scene-note" maxlength="300" required value="自定义场景初始提示词"></div><div class="banner">保存时创建场景与 v1 草稿，不调用模型。请在“配置与提示词”发布版本，并开启真实推理后调试。自定义场景没有内置规则，模型全部失败时返回失败。</div><div id="create-scene-error" class="banner error" role="alert" hidden></div><div class="form-actions"><button class="primary" id="save-create-scene">创建场景并配置提示词</button></div></form></section>`
 drawer.hidden=false
 $('#close-create-scene').onclick=()=>{if(!state.sceneCreating){drawer.hidden=true;drawer.innerHTML=''}}
 $('#create-scene-form').onsubmit=async e=>{
  e.preventDefault();if(state.sceneCreating)return
  const box=$('#create-scene-error'), form=$('#create-scene-form'), button=$('#save-create-scene')
  box.hidden=true
  const value=id=>$('#new-scene-'+id).value.trim()
  let example
  try{example=JSON.parse(value('example'));if(!example||Array.isArray(example)||typeof example!=='object'||Object.keys(example).length>50||value('example').length>16000)throw Error();}catch{box.textContent='参数示例须为16000个字符以内、最多50个字段的 JSON 对象';box.hidden=false;return}
  const code=value('code')
  if(!/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+$/.test(code)){box.textContent='请填写小写字母开头、使用点、下划线或短横线分段的场景编码';box.hidden=false;return}
  if(state.scenes.some(s=>s.code===code)){box.textContent='场景编码已存在，请更换编码';box.hidden=false;return}
  const payload={code,name:value('name'),bizSystem:value('system'),description:value('description'),exampleJson:value('example'),enabled:value('enabled')==='true',providerId:value('provider'),systemPrompt:value('system-prompt'),userPrompt:value('user-prompt'),note:value('note')}
  state.sceneCreating=true;form.querySelectorAll('input,textarea,select,button').forEach(x=>x.disabled=true);$('#close-create-scene').disabled=true;button.textContent='正在创建…'
  try{
   const created=await api('scenes',{method:'POST',body:JSON.stringify(payload)})
   state.scenes.push({...created,versionCount:created.versions.length,mode:'PROMPT_MODEL'})
   if(state.overview)state.overview.sceneCount=state.scenes.length
   resetSceneFilters();state.selected=created.code;state.result=null;drawer.hidden=true;drawer.innerHTML=''
   location.hash='prompts';toast('自定义场景已创建，v1 草稿尚未发布，请检查后发布')
  }catch(err){box.textContent=err.message;box.hidden=false}
  finally{state.sceneCreating=false;form.querySelectorAll('input,textarea,select,button').forEach(x=>x.disabled=false);const close=$('#close-create-scene');if(close)close.disabled=false;button.textContent='创建场景并配置提示词'}
 }
 $('#new-scene-name').focus()
}

function syncSceneSelection(){
 const list=filteredScenes(), count=state.sceneSelection.size, all=$('#select-visible-scenes')
 if(!all)return
 all.checked=list.length>0&&list.every(s=>state.sceneSelection.has(s.code));all.indeterminate=count>0&&!all.checked
 $('#scene-selection-count').textContent=`已选择 ${count} 个场景`
 $('#batch-bind-model').disabled=!count||state.sceneBatchSaving;$('#clear-scene-selection').disabled=!count||state.sceneBatchSaving
 document.querySelectorAll('[data-scene-select]').forEach(input=>{input.checked=state.sceneSelection.has(input.dataset.sceneSelect)})
}
function batchModelDrawer(){
 if(state.sceneBatchSaving)return
 const selected=filteredScenes().filter(s=>state.sceneSelection.has(s.code)).map(s=>({...s}))
 if(!selected.length){toast('请先选择场景');return}
 const drawer=$('#drawer')
 drawer.innerHTML=`<section class="drawer" role="dialog" aria-modal="true" aria-labelledby="batch-model-title"><div class="panel-head"><h2 id="batch-model-title">批量绑定场景模型</h2><button id="close-batch-model" class="text-button" type="button">关闭 ✕</button></div><form id="batch-model-form" class="form"><div class="field"><label for="batch-model-provider">目标模型通道</label><select id="batch-model-provider" required><option value="" disabled selected>请选择目标模型</option><option value="GLOBAL">跟随全局模型</option>${state.providers.map(p=>`<option value="${esc(p.id)}" ${p.configured?'':'disabled'}>${esc(p.name)} / ${esc(p.model)}${p.configured?'':'（待配置）'}</option>`).join('')}</select><small>统一覆盖以下场景的模型路由；跟随全局会随全局通道切换。未配置通道不可选择。</small></div><div class="banner">共 ${selected.length} 个场景。整批校验通过后一次保存；任一场景冲突时整批不生效。相同绑定无需变更。提示词发布状态、启停状态与全局推理策略保持原样。</div><div class="batch-scene-list"><table><thead><tr><th>场景</th><th>当前模型路由</th></tr></thead><tbody>${selected.map(s=>`<tr><td>${esc(s.name)}<div class="mono">${esc(s.code)}</div></td><td>${esc(sceneModelText(s))}</td></tr>`).join('')}</tbody></table></div><div id="batch-model-error" class="banner error" role="alert" hidden></div><div class="form-actions batch-model-actions"><button type="button" id="reload-batch-scenes" class="secondary">刷新配置并重新选择</button><button class="primary" id="save-batch-model">确认绑定 ${selected.length} 个场景</button></div><small class="muted">保存仅变更模型路由并记录操作，不发起模型调用。</small></form></section>`
 drawer.hidden=false
 const close=()=>{if(!state.sceneBatchSaving){drawer.hidden=true;drawer.innerHTML=''}}
 $('#close-batch-model').onclick=close
 $('#reload-batch-scenes').onclick=async()=>{
  const button=$('#reload-batch-scenes');button.disabled=true
  try{const [scenes,providers]=await Promise.all([api('scenes'),api('providers')]);state.scenes=scenes;state.providers=providers;state.sceneSelection.clear();close();await render();toast('配置已刷新，请重新选择场景')}
  catch(err){const box=$('#batch-model-error');box.textContent=err.message;box.hidden=false}finally{button.disabled=false}
 }
 $('#batch-model-form').onsubmit=async e=>{
  e.preventDefault();if(state.sceneBatchSaving)return
  const chosen=$('#batch-model-provider').value;if(!chosen){toast('请选择目标模型');return}
  state.sceneBatchSaving=true
  const button=$('#save-batch-model'), box=$('#batch-model-error'), select=$('#batch-model-provider')
  button.disabled=true;button.textContent='正在绑定…';select.disabled=true;$('#reload-batch-scenes').disabled=true;box.hidden=true
  try{
   const data=await api('scenes/models/batch',{method:'PUT',body:JSON.stringify({providerId:chosen==='GLOBAL'?'':chosen,scenes:selected.map(s=>({code:s.code,revision:s.revision}))})})
   const updates=new Map(data.scenes.map(s=>[s.code,s]));state.scenes=state.scenes.map(s=>updates.get(s.code)||s)
   state.sceneSelection.clear();state.result=null;drawer.hidden=true;drawer.innerHTML='';await render()
   toast(`批量绑定完成：已变更 ${data.changed} 个，无需变更 ${data.unchanged} 个`)
  }catch(err){box.textContent=err.message;box.hidden=false}
  finally{state.sceneBatchSaving=false;button.disabled=false;button.textContent=`确认绑定 ${selected.length} 个场景`;select.disabled=false;const reload=$('#reload-batch-scenes');if(reload)reload.disabled=false;syncSceneSelection()}
 }
}
function sceneModelText(scene){
 const id=scene?.providerId, p=id?state.providers.find(x=>x.id===id):state.providers.find(x=>x.selected)
 return `${id?'场景专属模型':'跟随全局模型'} · ${p?p.name+' / '+p.model:'通道不可用'}${p&&!p.configured?' · 待配置':''}`
}
function sceneModelView(scene){return `<section class="panel"><div class="panel-head"><h2>当前场景模型</h2><button class="link" data-manage="${esc(scene.code)}">配置场景模型 ↗</button></div><div class="form"><strong>${esc(sceneModelText(scene))}</strong><p class="muted">${scene.publishedVersion?'提示词 v'+scene.publishedVersion:'尚未发布提示词'} · ${state.providers[0]?.inferenceEnabled===false?'真实推理已关闭':'按全局推理及降级策略执行'}；实际使用通道以本次调用回执为准。${scene.custom?'自定义场景无内置规则，真实推理关闭、未发布提示词或模型全部失败时返回失败。':''}</p></div></section>`}
function sceneModelForm(c){
 const id=c.providerId||''
 return `<section class="panel"><div class="panel-head"><h2>场景专属模型</h2>${pill(id?'独立指定':'跟随全局',id?'':'gray')}</div><form id="scene-model-form" class="form"><div class="field"><label for="scene-model-provider">模型通道</label><select id="scene-model-provider"><option value="" ${!id?'selected':''}>跟随全局模型</option>${state.providers.map(p=>`<option value="${esc(p.id)}" ${p.id===id?'selected':''} ${!p.configured&&p.id!==id?'disabled':''}>${esc(p.name)} / ${esc(p.model)}${p.configured?'':'（待配置）'}</option>`).join('')}${id&&!state.providers.some(p=>p.id===id)?`<option selected value="${esc(id)}">通道已不可用，请重新选择</option>`:''}</select><small>专属模型只影响当前场景，不切换全局通道；跟随全局会随全局模型切换。请先在模型接入中配置并验证通道。需发布提示词并开启真实推理后生效；失败时按绑定主通道的故障切换策略尝试备用模型；自定义场景全部失败后返回失败，内置场景按全局降级策略处理。</small></div><p class="muted">${esc(sceneModelText(c))}</p><div id="scene-model-error" class="banner error" role="alert" hidden></div><button class="primary">保存场景模型</button> <a class="link" href="#providers">管理模型通道 ↗</a></form></section>`
}
function debugPage(){const s=state.scenes.find(x=>x.code===state.selected)||state.scenes[0];return head('调试工作台','选择业务场景、编辑结构化参数，查看服务端原始响应。')+sceneModelView(s)+`<div class="banner">启用真实推理、配置模型通道并发布提示词后，调试将调用外部模型，可能产生模型用量；内置场景的其他情况按配置执行规则降级，自定义场景无内置规则且必须发布后调用。调试不写入业务单据，请勿输入敏感业务资料。</div><div class="debug-grid"><section class="panel"><div class="panel-head"><h2>请求配置</h2>${pill('POST · 场景调度','gray')}</div><form id="debug-form" class="form"><div class="field"><label for="debug-scene">业务场景</label><select id="debug-scene">${state.scenes.map(x=>`<option value="${x.code}" ${x.code===s.code?'selected':''}>${esc(x.domain)} / ${esc(x.name)}</option>`).join('')}</select><small id="scene-hint">${esc(s.description)} · ${esc(s.code)}</small></div><div class="field"><a class="link" href="#prompts">管理当前场景提示词版本 ↗</a></div><div class="field"><label for="biz-id">业务参考编号 <span class="muted">（选填）</span></label><input id="biz-id" maxlength="100" placeholder="例如 DEMO-001，不影响业务数据库"></div><div class="field"><label for="json-input" style="display:flex;justify-content:space-between">JSON 结构化参数<button type="button" id="load-example" class="link">重置为示例</button></label><textarea id="json-input" spellcheck="false" aria-describedby="input-hint">${esc(JSON.stringify(JSON.parse(s.exampleJson),null,2))}</textarea><small id="input-hint">仅支持 JSON 对象，最多 50 个字段、16KB 字符。</small></div><div class="form-actions"><span class="muted" style="font-size:10px">输入正文不会写入调用审计</span><button class="primary" id="run" ${state.running?'disabled':''}>${state.running?'执行中…':'▷ 执行调试'}</button></div></form></section><section class="panel"><div class="panel-head"><h2>执行结果</h2><button id="copy-result" class="link" ${state.result?'':'disabled'}>复制 JSON</button></div><div id="result">${state.result?resultView(state.result):'<div class="empty" style="padding:115px 25px"><div style="font-size:30px;color:#b0c8b6;margin-bottom:14px">⌘</div>等待场景执行<br><span class="cell-sub">结果、耗时与追踪编号将在这里展示</span></div>'}</div></section></div>`}
function resultView(r){return `<div class="result-meta">${pill(r.ok?'执行成功':'执行失败',r.ok?'':'red')}<span>耗时 ${r.usage?.latency_ms ?? '—'} ms</span><span>${esc(r.usage?.execution_mode==='REAL_MODEL'?'真实模型':r.usage?.execution_mode==='FAILED'?'执行失败':'规则降级')}</span></div>${r.usage?.model_attempts?.length?`<div class="banner">${r.usage.failover?'已切换至备用模型 · ':''}${r.usage.model_attempts.map(a=>esc(a.provider_name)+'：'+esc(a.status==='SUCCESS'?'成功':a.reason||'失败')).join(' → ')}</div>`:''}<pre class="code-result">${esc(JSON.stringify(r,null,2))}</pre>`}
async function callPage(){const p=new URLSearchParams({page:state.page,pageSize:15,keyword:state.keyword,status:state.status});const data=await api('calls?'+p);return head('调用日志','查看真实调用元数据，按场景、任务编号或追踪编号定位请求。')+`<section class="panel"><div class="toolbar"><div class="search"><input id="call-search" placeholder="搜索场景编码、任务或追踪编号" aria-label="搜索调用日志" value="${esc(state.keyword)}"></div><select id="call-status" aria-label="筛选调用状态"><option value="">全部执行状态</option><option value="SUCCESS" ${state.status==='SUCCESS'?'selected':''}>调用成功</option><option value="FAILED" ${state.status==='FAILED'?'selected':''}>调用失败</option></select><button id="query-calls" class="secondary">查询</button><span class="muted">共 ${data.total} 条记录</span></div><div class="table-scroll"><table><thead><tr><th>场景</th><th>任务编号 / 来源</th><th>状态</th><th>耗时</th><th>时间</th><th>追踪</th></tr></thead><tbody>${rows(data.records,true)}</tbody></table></div><div class="pagination"><span>第 ${state.page} / ${Math.max(1,Math.ceil(data.total/15))} 页</span><button id="prev" ${state.page<=1?'disabled':''}>上一页</button><button id="next" ${state.page*15>=data.total?'disabled':''}>下一页</button></div></section><div class="inline-note">最近 1000 条记录持久化保留。为减少业务数据暴露，日志不保存请求或响应正文、令牌、密钥。未经管理鉴权的兼容业务调用会标注为“未核验调用方”。</div>`}
function changeLabel(key){return ({circuit:'熔断恢复策略',circuitState:'熔断运行状态',failover:'故障切换策略',id:'通道标识',name:'通道名称',authType:'鉴权方式',baseUrl:'服务地址',model:'模型名称',keyConfigured:'API Key 状态',selected:'当前通道',inferenceEnabled:'真实推理',fallbackToRuleTemplate:'失败处理'})[key]||key}
function changeValue(key,value){
 if(key==='circuitState')return circuitLabel(value)
 if(key==='circuit')return value?(value.enabled?'已开启':'已关闭')+' / 连续失败 '+value.failureThreshold+' 次 / 冷却 '+value.cooldownSeconds+' 秒':'—'
 if(key==='failover')return value?(value.enabled?'已开启':'已关闭')+' / 超时 '+value.timeoutMs+'ms / '+(value.providerIds||[]).map(id=>state.providers.find(p=>p.id===id)?.name||id).join(' → '):'—'
 if(key==='authType')return value==='NONE'?'无需 API Key':'API Key 鉴权'
 if(key==='keyConfigured')return value?'已设置':'未设置'
 if(key==='selected')return value?'当前通道':'备用通道'
 if(key==='inferenceEnabled')return value?'开启':'关闭'
 if(key==='fallbackToRuleTemplate')return value?'允许规则降级':'返回调用失败'
 return value==null||value===''?'—':String(value)
}
async function showProviderChanges(id){
 const p=state.providers.find(x=>x.id===id);if(!p)return
 $('#drawer').innerHTML='<section class="drawer" role="dialog" aria-modal="true" aria-labelledby="provider-changes-title"><div class="panel-head"><h2 id="provider-changes-title">配置变更记录</h2><button type="button" id="close-provider-changes" class="text-button">关闭 ✕</button></div><div class="drawer-body"><div class="loading">正在读取记录…</div></div></section>'
 $('#drawer').hidden=false
 const close=()=>{$('#drawer').hidden=true;$('#drawer').innerHTML=''};$('#close-provider-changes').onclick=close
 try{
  const data=await api('providers/'+encodeURIComponent(id)+'/changes?limit=50');state.providerChanges[id]=data.records||[]
  const records=state.providerChanges[id]
  const body=records.length?records.map(e=>{const fields=(e.changedFields||[]).map(changeLabel).join('、')||'未检测到字段变化';const before=e.before||{},after=e.after||{};const keys=[...new Set([...(e.changedFields||[]),...Object.keys(before),...Object.keys(after)])];return `<article class="change-item"><div class="change-head"><div><b>${esc({CREATE_PROVIDER:'新增通道',UPDATE_PROVIDER:'修改配置',DELETE_PROVIDER:'删除通道',SWITCH_PROVIDER:'切换模型',UPDATE_CIRCUIT:'修改熔断策略',PROBE_CIRCUIT:'提前探测熔断通道',UPDATE_FAILOVER:'修改故障切换'}[e.action]||'修改配置')} · 修订 ${esc(e.revision)}</b><span class="cell-sub"> · ${esc(time(e.time))}</span></div><span class="pill gray">${esc(e.operator||'未核验操作人')}</span></div><p class="change-fields">变更：${esc(fields)}</p><div class="change-values">${keys.filter(k=>k in before||k in after).map(k=>`<div class="change-value"><span>${esc(changeLabel(k))}</span><span><em>${esc(changeValue(k,before[k]))}</em> → <strong>${esc(changeValue(k,after[k]))}</strong></span></div>`).join('')}</div></article>`}).join(''):'<div class="empty">暂无配置变更记录<br><span class="cell-sub">保存模型通道配置后会在这里留下审计记录</span></div>'
  const note=data.writable?'记录保留最近 1000 条，API Key 只记录“已设置 / 未设置”，不会保存密钥值。':'审计文件当前不可写，新变更可能无法持久化。'
  $('.drawer-body').innerHTML=`<span class="eyebrow">${esc(p.name)} · CHANGE AUDIT</span><p class="muted">${esc(note)}</p>${body}`
 }catch(e){$('.drawer-body').innerHTML=`<div class="banner error">${esc(e.message)}</div>`}
}

function circuitLabel(value){return ({DISABLED:'未开启',CLOSED:'正常放行',OPEN:'熔断冷却',PROBE_READY:'待恢复探测',HALF_OPEN:'恢复探测中'})[value]||value||'未开启'}
function circuitStatusView(p){
 const c=p.circuitStatus||{state:'DISABLED'}, active=p.circuit?.enabled
 return `<div class="setting-row"><span>熔断恢复</span>${pill(circuitLabel(c.state),['OPEN','HALF_OPEN','PROBE_READY'].includes(c.state)?'amber':active?'':'gray')}</div>${active?`<p class="muted">连续故障 ${esc(c.consecutiveFailures||0)} / ${esc(p.circuit.failureThreshold)} 次 · 冷却 ${esc(p.circuit.cooldownSeconds)} 秒${c.state==='OPEN'?' · 剩余约 '+Math.ceil(c.remainingMs/1000)+' 秒':''}${c.lastReason?'<br>'+esc(c.lastReason):''}</p>`:''}`
}
async function configureCircuit(id){
 try{state.providers=await api('providers')}catch(err){toast(err.message);return}
 const p=state.providers.find(x=>x.id===id);if(!p)return
 const drawer=$('#drawer'), policy=p.circuit||{enabled:false,failureThreshold:3,cooldownSeconds:30}
 const c=p.circuitStatus||{state:'DISABLED'};let saving=false
 drawer.innerHTML=`<section class="drawer" role="dialog" aria-modal="true" aria-labelledby="circuit-title"><div class="panel-head"><h2 id="circuit-title">模型熔断恢复 · ${esc(p.name)}</h2><button id="close-circuit" class="text-button" type="button">关闭 ✕</button></div><form id="circuit-form" class="form"><div class="banner">此通道在全局、场景专属及备用调用中共用熔断状态。连续故障达阈值后暂停调用；冷却后仅放行一个真实请求探测，成功恢复，失败重新冷却。</div><label class="provider-check"><input type="checkbox" id="circuit-enabled" ${policy.enabled?'checked':''}>开启熔断与自动恢复</label><div class="field"><label for="circuit-threshold">连续失败阈值（次）</label><input type="number" id="circuit-threshold" required min="1" max="20" step="1" value="${policy.failureThreshold}"><small>网络、超时、鉴权、限流、服务异常及无效回复计入；普通参数错误中断连续失败计数。</small></div><div class="field"><label for="circuit-cooldown">冷却时间（秒）</label><input type="number" id="circuit-cooldown" required min="5" max="600" step="1" value="${policy.cooldownSeconds}"><small>5～600 秒。到期后等待下一次真实请求探测，不发送后台模型请求。</small></div><section class="panel"><div class="panel-head"><h2>当前运行状态</h2><button class="link" type="button" id="refresh-circuit">刷新状态</button></div><div class="form">${circuitStatusView(p)}<p class="muted">本次运行熔断 ${esc(c.tripCount||0)} 次 · 恢复 ${esc(c.recoveryCount||0)} 次<br>状态更新时间：${esc(time(c.changedAt))}</p><button class="secondary" type="button" id="channel-circuit-alerts">查看此通道告警</button><button class="secondary" type="button" id="probe-circuit" ${c.state==='OPEN'?'':'disabled'}>提前结束冷却，等待探测</button></div></section><p class="muted">提前探测不会标记健康，由下一次业务请求单独验证；其他并发请求继续跳过该通道。没有可用备用时沿用失败或规则降级策略。保存策略变更会重置此通道运行状态。运行计数在服务重启后清空。</p><div id="circuit-error" class="banner error" role="alert" hidden></div><button class="primary" id="save-circuit">保存熔断恢复策略</button></form></section>`
 drawer.hidden=false
 $('#close-circuit').onclick=()=>{if(!saving){drawer.hidden=true;drawer.innerHTML=''}}
 const error=err=>{const box=$('#circuit-error');if(box){box.textContent=err.message;box.hidden=false}}
 $('#channel-circuit-alerts').onclick=()=>{if(!saving)showCircuitAlerts(id)}
 $('#refresh-circuit').onclick=()=>{if(!saving)configureCircuit(id)}
 $('#probe-circuit').onclick=async()=>{
  if(saving)return;saving=true;const b=$('#probe-circuit');b.disabled=true
  try{await api('providers/'+encodeURIComponent(id)+'/circuit/probe',{method:'POST',body:JSON.stringify({revision:p.revision})});await configureCircuit(id);toast('已允许下一次真实请求进行恢复探测')}
  catch(err){error(err);b.disabled=false}finally{saving=false}
 }
 $('#circuit-form').onsubmit=async e=>{
  e.preventDefault();if(saving)return
  const payload={revision:p.revision,enabled:$('#circuit-enabled').checked,failureThreshold:Number($('#circuit-threshold').value),cooldownSeconds:Number($('#circuit-cooldown').value)}
  const controls=[...$('#circuit-form').elements];saving=true;controls.forEach(x=>x.disabled=true);$('#circuit-error').hidden=true
  let saved=false
  try{await api('providers/'+encodeURIComponent(id)+'/circuit',{method:'PUT',body:JSON.stringify(payload)});saved=true;state.providers=await api('providers');drawer.hidden=true;drawer.innerHTML='';await render();toast('熔断恢复策略已保存')}
  catch(err){error(new Error(saved?'策略已保存，状态刷新失败，请重新刷新页面':err.message))}
  finally{saving=false;controls.forEach(x=>x.disabled=false)}
 }
}

async function configureFailover(id){
 let p=state.providers.find(x=>x.id===id);if(!p)return
 const drawer=$('#drawer'), policy=p.failover||{enabled:false,providerIds:[],timeoutMs:10000}
 drawer.innerHTML=`<section class="drawer" role="dialog" aria-modal="true" aria-labelledby="failover-title"><div class="panel-head"><h2 id="failover-title">模型故障切换 · ${esc(p.name)}</h2><button type="button" id="close-failover" class="text-button">关闭 ✕</button></div><form id="failover-form" class="form"><div class="banner">适用于全局及绑定此主通道的场景。失败后按顺序尝试备用，每个通道最多调用一次；不改变当前模型选择。每次请求优先尝试主模型；已熔断通道会跳过，冷却后只放行一个恢复探测。</div><label class="provider-check"><input type="checkbox" id="failover-enabled" ${policy.enabled?'checked':''}>开启故障切换</label>${[0,1,2].map(i=>`<div class="field"><label for="failover-${i}">第 ${i+1} 备用通道</label><select id="failover-${i}"><option value="">不使用</option>${state.providers.filter(x=>x.id!==id).map(x=>`<option value="${esc(x.id)}" ${policy.providerIds[i]===x.id?'selected':''} ${!x.configured?'disabled':''}>${esc(x.name)} / ${esc(x.model)}${!x.configured?'（待配置）':''}</option>`).join('')}</select></div>`).join('')}<div class="field"><label for="failover-timeout">每通道超时（秒）</label><input id="failover-timeout" type="number" min="1" max="15" step="1" required value="${policy.timeoutMs/1000}"><small>开启时生效，连接与读取分别限制；切换请求总等待预算45秒，临近截止会缩短后续通道等待。最多3个备用通道，按顺序串行尝试。关闭时使用原有服务超时。</small></div><p class="muted">网络失败、超时、401/403/404/408/429、5xx及无效回复会切换；普通参数错误不切换。可能向指定备用服务发送同一输入并产生用量。场景全部失败后按全局规则降级开关处理；连接验证始终只测指定通道。</p><div id="failover-error" class="banner error" role="alert" hidden></div><button id="save-failover" class="primary">保存故障切换策略</button></form></section>`
 drawer.hidden=false;let saving=false
 $('#close-failover').onclick=()=>{if(!saving){drawer.hidden=true;drawer.innerHTML=''}}
 $('#failover-form').onsubmit=async e=>{
  e.preventDefault();if(saving)return
  const providerIds=[0,1,2].map(i=>$('#failover-'+i).value).filter(Boolean), enabled=$('#failover-enabled').checked
  const box=$('#failover-error'), button=$('#save-failover');box.hidden=true
  if(new Set(providerIds).size!==providerIds.length||enabled&&!providerIds.length){box.textContent='请至少选择一个备用通道，且不能重复';box.hidden=false;return}
  saving=true;button.disabled=true;button.textContent='保存中…'
  const controls=[...$('#failover-form').elements];controls.forEach(x=>x.disabled=true)
  try{await api('providers/'+encodeURIComponent(id)+'/failover',{method:'PUT',body:JSON.stringify({revision:p.revision,enabled,providerIds,timeoutMs:Number($('#failover-timeout').value)*1000})});state.providers=await api('providers');state.result=null;drawer.hidden=true;drawer.innerHTML='';await render();toast('故障切换策略已保存')}
  catch(err){box.textContent=err.message;box.hidden=false}
  finally{saving=false;controls.forEach(x=>x.disabled=false);button.textContent='保存故障切换策略'}
 }
}

function configureProvider(id){
 const creating=!id, current=state.providers[0]||{}
 const p=creating?{name:'',baseUrl:'',model:'',authType:'BEARER',custom:true,revision:current.revision||0,inferenceEnabled:current.inferenceEnabled!==false,fallbackToRuleTemplate:current.fallbackToRuleTemplate!==false}:state.providers.find(x=>x.id===id);if(!p)return
 $('#drawer').innerHTML=`<section class="drawer" role="dialog" aria-modal="true" aria-labelledby="provider-config-title"><div class="panel-head"><h2 id="provider-config-title">${creating?'新增自定义模型':'配置'+esc(p.name)}</h2><button type="button" id="close-provider" class="text-button">关闭 ✕</button></div><form id="provider-config-form" class="form" autocomplete="off"><div class="banner">保存后立即生效。密钥在服务端加密存储，不会回显；留空保留已有密钥。管理端保存的配置优先于部署环境。</div>${p.custom?`<div class="field"><label for="provider-name">通道名称</label><input id="provider-name" required maxlength="80" value="${esc(p.name)}" placeholder="如：企业私有模型、生产推理服务"></div><div class="field"><label for="provider-protocol">接入协议</label><select id="provider-protocol" disabled><option>Chat Completions 兼容协议</option></select><small>适用于提供该协议的云服务、自建服务与本地部署模型。</small></div><div class="field"><label for="provider-auth">鉴权方式</label><select id="provider-auth"><option value="BEARER" ${p.authType!=='NONE'?'selected':''}>API Key（Bearer Token）</option><option value="NONE" ${p.authType==='NONE'?'selected':''}>无需 API Key（本地 / 内网服务）</option></select><small>无需鉴权时不发送 Authorization 请求头。</small></div>`:''}<div class="field"><label for="provider-url">Base URL <span class="muted">（兼容 Chat Completions）</span></label><input id="provider-url" type="url" maxlength="2048" required value="${esc(p.baseUrl)}" placeholder="输入服务商提供的 API 基础地址"><small>填写基础地址，例如服务商提供的 /v1 地址，勿附加 /chat/completions、密钥或查询参数。</small></div><div class="field"><label for="provider-model">模型名称</label><div class="model-fetch-row"><input id="provider-model" maxlength="200" required value="${esc(p.model)}" placeholder="输入或从服务列表选择模型标识"><button id="fetch-provider-models" class="secondary" type="button">获取模型列表</button></div><small>使用当前表单地址和鉴权获取，留空可复用原地址已保存的密钥。获取不会保存配置或发起推理。</small><div id="provider-model-status" role="status" aria-live="polite" class="model-catalog-status" hidden></div><div id="provider-model-picker" class="model-catalog-picker" hidden><label for="provider-model-search">搜索模型</label><input id="provider-model-search" type="search" maxlength="200" placeholder="输入模型标识关键字"><label for="provider-model-list">可用模型</label><select id="provider-model-list" size="6" aria-label="可用模型列表"></select><small id="provider-model-count"></small><small>选择后填入模型名称；仍可手动修改。列表可能包含非对话模型，请保存后验证连接。</small></div></div><div class="field"><label for="provider-key">API Key · ${p.keyConfigured?'已设置':'未设置'}</label><input id="provider-key" type="password" maxlength="4096" autocomplete="new-password" placeholder="${p.keyConfigured?'留空保留已有密钥':'输入 API Key'}"><small>不会读取或展示已有密钥；更新后需重新验证连接。</small></div><label class="provider-check"><input id="provider-clear-key" type="checkbox">清除已有密钥（API Key 鉴权时需重新填写密钥）</label><div class="field"><label for="provider-selected">通道用途</label><select id="provider-selected"><option value="false" ${p.selected?'':'selected'}>备用通道</option><option value="true" ${p.selected?'selected':''}>设为当前通道</option></select><small>${p.selected?'当前通道需通过将另一个通道设为当前来切换。':'保存为备用通道时不会切换当前通道。'}</small></div><div class="field"><label for="provider-inference">全局真实推理</label><select id="provider-inference"><option value="true" ${p.inferenceEnabled?'selected':''}>开启</option><option value="false" ${p.inferenceEnabled?'':'selected'}>关闭（使用规则模板）</option></select></div><div class="field"><label for="provider-fallback">模型调用失败处理</label><select id="provider-fallback"><option value="true" ${p.fallbackToRuleTemplate?'selected':''}>允许规则降级</option><option value="false" ${p.fallbackToRuleTemplate?'':'selected'}>返回调用失败</option></select><small>推理和失败处理开关对所有通道生效。验证连接仍可单独执行。</small></div><div id="provider-save-error" class="banner error" role="alert" hidden></div><div class="form-actions"><button class="secondary" type="submit">保存配置</button><button class="primary" type="submit" data-verify="true">保存并验证</button></div></form></section>`
 $('#drawer').hidden=false
 const returnFocus=()=>{ $('#drawer').hidden=true;$('#drawer').innerHTML='';document.querySelector(`[data-config-provider="${id}"]`)?.focus() }
 $('#close-provider').onclick=returnFocus
 if(p.selected)$('#provider-selected').disabled=true
 $('#provider-clear-key').onchange=e=>{const key=$('#provider-key');key.value='';key.disabled=e.target.checked}
 const auth=$('#provider-auth');if(auth)auth.onchange=()=>{const none=auth.value==='NONE';$('#provider-key').disabled=none||$('#provider-clear-key').checked;$('#provider-clear-key').disabled=none};auth?.onchange()
 const catalogForm=$('#provider-config-form'), fetchModels=$('#fetch-provider-models'), catalogStatus=$('#provider-model-status'), catalogPicker=$('#provider-model-picker'), catalogSearch=$('#provider-model-search'), catalogList=$('#provider-model-list'), catalogCount=$('#provider-model-count')
 let models=[]
 const renderModels=()=>{
  const keyword=catalogSearch.value.trim().toLowerCase(), filtered=models.filter(x=>x.toLowerCase().includes(keyword))
  catalogList.innerHTML=filtered.length?filtered.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join(''):'<option disabled>没有匹配的模型</option>'
  catalogList.value=$('#provider-model').value;catalogCount.textContent=`匹配 ${filtered.length} / 已获取 ${models.length} 个模型`
 }
 const invalidateModels=()=>{models=[];catalogPicker.hidden=true;catalogStatus.hidden=true;catalogSearch.value='';catalogList.innerHTML=''}
 for(const selector of ['#provider-url','#provider-key','#provider-auth','#provider-clear-key'])$(selector)?.addEventListener(selector.includes('auth')||selector.includes('clear')?'change':'input',invalidateModels)
 catalogSearch.oninput=renderModels
 catalogList.onchange=()=>{if(catalogList.value){$('#provider-model').value=catalogList.value;$('#provider-model').dispatchEvent(new Event('input',{bubbles:true}))}}
 fetchModels.onclick=async()=>{
  if(catalogForm.dataset.fetching||catalogForm.dataset.saving)return
  const url=$('#provider-url');if(!url.reportValidity())return
  const query={providerId:creating?null:id,revision:p.revision,baseUrl:url.value.trim(),authType:$('#provider-auth')?.value||'BEARER',apiKey:$('#provider-key').value.trim(),clearKey:$('#provider-clear-key').checked}
  invalidateModels();catalogForm.dataset.fetching='true';fetchModels.textContent='正在获取…';catalogStatus.textContent='正在读取服务可用模型…';catalogStatus.className='model-catalog-status';catalogStatus.hidden=false
  const controls=[...catalogForm.elements].map(x=>[x,x.disabled]);controls.forEach(([x])=>x.disabled=true)
  try{
   const result=await api('providers/models',{method:'POST',body:JSON.stringify(query),timeoutMs:15000})
   if(!catalogForm.isConnected)return
   models=result.models||[];catalogStatus.textContent=result.message;catalogStatus.className='model-catalog-status'+(result.ok?'':' catalog-error')
   catalogPicker.hidden=!models.length;renderModels()
  }catch(err){if(catalogForm.isConnected){catalogStatus.textContent=err.name==='TimeoutError'?'获取等待超时，请稍后重试或手动填写模型标识':err.message;catalogStatus.className='model-catalog-status catalog-error'}}
  finally{query.apiKey='';delete catalogForm.dataset.fetching;controls.forEach(([x,disabled])=>x.disabled=disabled);fetchModels.textContent='获取模型列表'}
 }
 $(p.custom?'#provider-name':'#provider-url').focus()
 $('#provider-config-form').onsubmit=async e=>{
  e.preventDefault();const form=e.currentTarget;if(form.dataset.saving||form.dataset.fetching)return
  const verify=e.submitter?.dataset.verify==='true'
  const edit={name:$('#provider-name')?.value.trim()||p.name,authType:$('#provider-auth')?.value||'BEARER',revision:p.revision,baseUrl:$('#provider-url').value.trim(),model:$('#provider-model').value.trim(),apiKey:$('#provider-key').value.trim(),clearKey:$('#provider-clear-key').checked,selected:$('#provider-selected').value==='true',inferenceEnabled:$('#provider-inference').value==='true',fallbackToRuleTemplate:$('#provider-fallback').value==='true'}
  form.dataset.saving='true';const disabled=[...form.elements].map(x=>[x,x.disabled]);disabled.forEach(([x])=>x.disabled=true);$('#provider-save-error').hidden=true
  let saved=false
  try{
   const result=await api(creating?'providers':'providers/'+encodeURIComponent(id),{method:creating?'POST':'PUT',body:JSON.stringify(edit)});id=result.id
   saved=true;edit.apiKey='';$('#provider-key').value='';returnFocus();state.providerTests={}
   state.providers=await api('providers')
   await render();toast(creating?'自定义模型已新增，请验证连接':'配置已保存并生效，请重新验证连接')
   if(verify)await testProvider(id)
   try{[state.overview,state.providers]=await Promise.all([api('overview'),api('providers')]);if(location.hash.slice(1)==='providers')await render()}catch{toast('配置已保存，数据刷新失败，请点击刷新')}
  }catch(err){if(saved){toast('配置已保存，页面更新失败，请刷新')}else{$('#provider-save-error').textContent=err.message;$('#provider-save-error').hidden=false}}
  finally{edit.apiKey='';delete form.dataset.saving;disabled.forEach(([x,value])=>x.disabled=value)}
 }
}

function deleteProvider(id){
 const p=state.providers.find(x=>x.id===id);if(!p||!p.custom)return
 $('#drawer').innerHTML=`<section class="drawer" role="dialog" aria-modal="true" aria-labelledby="delete-provider-title"><div class="panel-head"><h2 id="delete-provider-title">删除自定义模型</h2><button id="cancel-delete-provider" class="text-button">取消 ✕</button></div><div class="drawer-body"><h2>${esc(p.name)}</h2><p>删除后将移除此通道及其保存的密钥。已有变更记录继续保留。</p><div id="delete-provider-error" class="banner error" hidden></div><button id="confirm-delete-provider" class="primary">确认删除</button></div></section>`
 $('#drawer').hidden=false;$('#cancel-delete-provider').onclick=()=>{$('#drawer').hidden=true;$('#drawer').innerHTML=''}
 $('#confirm-delete-provider').onclick=async e=>{const button=e.currentTarget;button.disabled=true;let deleted=false;try{await api('providers/'+encodeURIComponent(id)+'?revision='+p.revision,{method:'DELETE'});deleted=true;$('#drawer').hidden=true;$('#drawer').innerHTML='';delete state.providerTests[id];state.providers=await api('providers');await render();toast('自定义模型已删除，变更记录已保留')}catch(err){if(deleted)toast('模型已删除，列表刷新失败，请点击刷新');else{$('#delete-provider-error').textContent=err.message;$('#delete-provider-error').hidden=false;button.disabled=false}}}
}

function providerTestView(p){
 const result=state.providerTests[p.id]||p.lastTest, testing=state.providerTesting[p.id]||p.testing
 if(testing)return '<div class="banner" role="status">正在发送最小测试请求，等待模型响应…</div>'
 if(!result)return '<p class="muted">尚未验证。配置完成后点击下方按钮检查实际推理可用性。</p>'
 return `<div class="provider-test-result" role="status"><div>${pill(result.ok?'验证成功':result.status==='CLIENT_ERROR'?'验证未完成':'验证失败',result.ok?'':'red')} <span class="muted">${result.latencyMs==null?'耗时未获取':esc(result.latencyMs)+' ms'}${result.httpStatus?' · HTTP '+esc(result.httpStatus):''}</span></div><p>${esc(result.message)}</p><div class="cell-sub">验证时间：${esc(time(result.testedAt))}${result.inputTokens!=null||result.outputTokens!=null?`<br>服务端回执：输入 ${result.inputTokens==null?'未返回':esc(result.inputTokens)} / 输出 ${result.outputTokens==null?'未返回':esc(result.outputTokens)} token`:''}</div></div>`
}
function currentModelView(){
 const p=state.providers.find(x=>x.selected)
 return `<section class="panel current-model" aria-label="当前模型"><div><span class="eyebrow">当前模型</span><strong>${esc(p?.name||'尚未选择')} <span class="mono">${esc(p?.model||'')}</span></strong><small>${p?.inferenceEnabled===false?'真实推理已关闭，切换不会自动开启':p?.configured?'用于后续真实模型请求，实际执行以调用回执为准':'当前模型待完善配置'}</small></div><a class="link" href="#providers">管理与切换模型 ↗</a></section>`
}
function switchProvider(id){
 const target=state.providers.find(x=>x.id===id), previous=state.providers.find(x=>x.selected)
 if(!target||target.selected||state.providerSwitching)return
 if(!target.configured){configureProvider(id);toast('请先完善目标模型配置');return}
 $('#drawer').innerHTML=`<section class="drawer" role="dialog" aria-modal="true" aria-labelledby="switch-provider-title"><div class="panel-head"><h2 id="switch-provider-title">切换当前模型</h2><button type="button" id="close-switch-provider" class="text-button">关闭 ✕</button></div><div class="drawer-body"><dl class="definition"><dt>当前模型</dt><dd>${esc(previous?.name||'未选择')} / ${esc(previous?.model||'—')}</dd><dt>切换为</dt><dd>${esc(target.name)} / ${esc(target.model)}</dd><dt>服务地址</dt><dd>${esc(target.baseUrl)}</dd></dl><div class="banner">切换后新发起的模型请求使用目标通道，进行中的请求继续使用原模型。不会发起推理，不改变密钥、真实推理开关和失败降级策略。${target.inferenceEnabled===false?' 当前真实推理已关闭，可在配置通道中开启。':''}</div><p>${target.lastTest?.ok?'目标通道最近一次连接验证成功，实际可用性仍以调用回执为准。':'目标通道尚无成功的连接验证结果，建议先验证连接。'}</p><div id="switch-provider-error" class="banner error" role="alert" hidden></div><button type="button" class="primary" id="confirm-switch-provider">确认切换</button></div></section>`
 $('#drawer').hidden=false
 $('#close-switch-provider').onclick=()=>{if(!state.providerSwitching){$('#drawer').hidden=true;$('#drawer').innerHTML=''}}
 $('#confirm-switch-provider').onclick=async e=>{
  if(state.providerSwitching)return
  const button=e.currentTarget;state.providerSwitching=true;button.disabled=true;button.textContent='切换中…';let saved=false
  try{
   const selected=await api('providers/'+encodeURIComponent(id)+'/select',{method:'POST',body:JSON.stringify({revision:target.revision})});saved=true
   state.providers=state.providers.map(p=>({...p,selected:p.id===id,revision:selected.revision,updatedAt:selected.updatedAt,updatedBy:selected.updatedBy,configurationSource:selected.configurationSource}))
   state.overview={...state.overview,provider:id,modelConfigured:selected.configured};state.providerChanges={}
   $('#drawer').hidden=true;$('#drawer').innerHTML='';await render();toast('已切换为 '+target.name+' / '+target.model+'，后续请求生效')
  }catch(err){if(saved)toast('模型已切换，页面更新失败，请刷新查看');else{const box=$('#switch-provider-error');if(box){box.textContent=err.message;box.hidden=false}else toast(err.message)}}
  finally{state.providerSwitching=false;button.disabled=false;button.textContent='确认切换'}
 }
}
const failoverFilters={hours:'24',provider:'',outcome:'ALL',page:1}
let failoverLoadVersion=0
const percentage=v=>v==null?'—':Number(v).toFixed(1)+'%'
async function showFailoverStatistics(provider){
 if(typeof provider==='string'){failoverFilters.provider=provider;failoverFilters.page=1}
 const drawer=$('#drawer'), version=++failoverLoadVersion
 drawer.innerHTML=`<section class="drawer statistics-drawer" role="dialog" aria-modal="true" aria-labelledby="statistics-title"><div class="panel-head"><h2 id="statistics-title">故障切换统计</h2><button type="button" id="close-statistics" class="text-button">关闭 ✕</button></div><div class="toolbar statistics-filters"><select id="statistics-hours" aria-label="统计时间范围">${[['1','最近1小时'],['24','最近24小时'],['168','最近7天'],['720','最近30天'],['0','全部保留记录']].map(([id,label])=>`<option value="${id}" ${failoverFilters.hours===id?'selected':''}>${label}</option>`).join('')}</select><select id="statistics-provider" aria-label="筛选统计主通道"></select><select id="statistics-outcome" aria-label="筛选路由结果">${[['ALL','全部路由结果'],['SWITCHED','发生故障切换'],['FAILED','模型最终失败'],['PRIMARY','主模型直接成功']].map(([id,label])=>`<option value="${id}" ${failoverFilters.outcome===id?'selected':''}>${label}</option>`).join('')}</select><button type="button" class="secondary" id="refresh-statistics">刷新统计</button></div><div id="statistics-body" class="drawer-body"><div class="loading">正在汇总模型路由记录…</div></div></section>`
 drawer.hidden=false
 $('#close-statistics').onclick=()=>{++failoverLoadVersion;drawer.hidden=true;drawer.innerHTML=''}
 const options=new Map(state.providers.map(p=>[p.id,p.name]))
 const setOptions=()=>{if(failoverFilters.provider&&!options.has(failoverFilters.provider))options.set(failoverFilters.provider,failoverFilters.provider+'（历史通道）');$('#statistics-provider').innerHTML='<option value="">全部主通道</option>'+[...options].map(([id,name])=>`<option value="${esc(id)}" ${id===failoverFilters.provider?'selected':''}>${esc(name)}</option>`).join('')}
 setOptions()
 for(const [selector,key] of [['#statistics-hours','hours'],['#statistics-provider','provider'],['#statistics-outcome','outcome']])$(selector).onchange=e=>{failoverFilters[key]=e.target.value;failoverFilters.page=1;showFailoverStatistics()}
 $('#refresh-statistics').onclick=()=>showFailoverStatistics()
 try{
  const data=await api('failover/statistics?'+new URLSearchParams({...failoverFilters,pageSize:15}))
  if(version!==failoverLoadVersion||!$('#statistics-body'))return
  for(const p of data.providers||[])if(!options.has(p.id))options.set(p.id,p.name+'（历史通道）');setOptions()
  $('#statistics-body').innerHTML=failoverStatisticsView(data)
  $('#statistics-previous').onclick=()=>{failoverFilters.page--;showFailoverStatistics()}
  $('#statistics-next').onclick=()=>{failoverFilters.page++;showFailoverStatistics()}
 }catch(err){if(version===failoverLoadVersion&&$('#statistics-body'))$('#statistics-body').innerHTML=`<div class="banner error" role="alert">${esc(err.message)}，可点击刷新统计重试。</div>`}
}
function failoverStatisticsView(d){
 const metric=(title,value,note)=>`<div class="stat"><div class="stat-top">${title}</div><div class="stat-value">${esc(value)}</div><div class="stat-foot">${esc(note)}</div></div>`
 const table=(headers,body,cols)=>`<div class="table-scroll"><table><thead><tr>${headers.map(h=>'<th>'+h+'</th>').join('')}</tr></thead><tbody>${body||`<tr><td class="empty" colspan="${cols}">暂无符合条件的记录</td></tr>`}</tbody></table></div>`
 const section=(title,body)=>`<section class="panel"><div class="panel-head"><h2>${title}</h2></div>${body}</section>`
 const trend=d.trend||[],max=Math.max(1,...trend.map(x=>x.total))
 return `<div class="banner ${d.writable?'':'error'}">统计覆盖场景真实推理及普通聊天；连接验证、模型列表获取和纯规则执行不计入。切换指已进入第二或后续通道（含熔断跳过）；切换成功率 = 备用成功接管 / 发生切换。规则降级成功仍计为模型失败。</div><p class="muted">保留最近 ${esc(d.capacity)} 条，当前 ${esc(d.retained)} 条；筛选后 ${esc(d.total)} 条。${d.oldestRetainedAt?'最早保留 '+esc(time(d.oldestRetainedAt))+'。':''}从功能启用后采集，不补算旧日志。更新时间 ${esc(time(d.generatedAt))} · ${esc(d.zone)}。${d.writable?'持久化正常，重启可恢复。':'统计文件不可写，新增记录仅暂存内存。'}</p>
 <div class="stats">${metric('真实模型路由',d.total,'按当前时间、主通道和结果筛选')}${metric('发生故障切换',d.switched,'占路由总量 '+percentage(d.switchRate))}${metric('备用接管成功',d.rescued,'切换成功率 '+percentage(d.switchSuccessRate))}${metric('模型最终失败',d.failed,'真实模型成功率 '+percentage(d.successRate))}</div>
 <p class="statistics-summary">主模型直接成功 <b>${esc(d.primarySuccess)}</b> 次 · 切换后失败 <b>${esc(d.switchFailed)}</b> 次 · 熔断跳过 <b>${esc(d.skipped)}</b> 次 · 平均路由耗时 <b>${d.total?Number(d.averageLatencyMs).toFixed(1):'—'}</b> ms · 切换平均耗时 <b>${d.switched?Number(d.switchAverageLatencyMs).toFixed(1):'—'}</b> ms</p>
 ${section('切换趋势',trend.length?`<div class="statistics-trend" aria-label="蓝色为主模型成功，绿色为备用接管，红色为模型最终失败">${trend.map(t=>`<div class="trend-row"><span>${esc(t.time)}</span><div class="trend-bar" role="img" aria-label="${esc(t.time)}：总计${t.total}，备用接管${t.rescued}，失败${t.failed}"><i class="trend-primary" style="width:${t.primarySuccess/max*100}%"></i><i class="trend-rescued" style="width:${t.rescued/max*100}%"></i><i class="trend-failed" style="width:${t.failed/max*100}%"></i></div><small>${t.total} 次 / 切换 ${t.switched}</small></div>`).join('')}<p class="muted">蓝：主模型成功 · 绿：备用接管 · 红：模型最终失败；按 ${esc(d.zone)} 分桶，首尾可能为部分时段。</p></div>`:'<div class="empty">暂无趋势数据</div>')}
 ${section('通道运行表现',table(['通道','实际尝试','成功 / 失败','熔断跳过','备用接管','成功率','平均耗时'],(d.channels||[]).map(c=>`<tr><td>${esc(c.name)}<div class="mono">${esc(c.id)}</div></td><td>${c.requests}</td><td>${c.success} / ${c.failed}</td><td>${c.skipped}</td><td>${c.takeovers}</td><td>${percentage(c.successRate)}</td><td>${c.requests?Number(c.averageLatencyMs).toFixed(1):'—'} ms</td></tr>`).join(''),7))}
 ${section('失败与跳过原因',table(['原因','通道次数'],(d.reasons||[]).map(r=>`<tr><td>${esc(r.reason)}</td><td>${r.count}</td></tr>`).join(''),2))}
 ${section('最近路由记录',table(['时间 / 场景','主通道','模型结果','尝试顺序','总耗时'],(d.records||[]).map(r=>`<tr><td>${esc(time(r.time))}<div class="cell-sub">${esc(r.sceneCode?nameOf(r.sceneCode):'普通聊天 / 通用调用')}</div></td><td>${esc(r.primaryName)}</td><td>${pill(r.success?(r.switched?'备用接管成功':'主模型成功'):'模型最终失败',r.success?'':'red')}</td><td>${r.attempts.map(a=>`<div class="cell-sub">${esc(a.name)} / ${esc(a.model)}：${esc(a.status==='SUCCESS'?'成功':a.reason)} · ${esc(a.latencyMs)} ms</div>`).join('')||'未进入通道尝试'}</td><td>${esc(r.latencyMs)} ms</td></tr>`).join(''),5)+`<div class="pagination"><span>第 ${d.page} / ${Math.max(1,Math.ceil(d.total/d.pageSize))} 页 · 共 ${d.total} 条</span><button type="button" id="statistics-previous" ${d.page<=1?'disabled':''}>上一页</button><button type="button" id="statistics-next" ${d.page*d.pageSize>=d.total?'disabled':''}>下一页</button></div>`)}`
}
function providerPage(){return head('模型接入','管理内置与自定义模型，统一配置、验证连接并追踪变更。','<div class="form-actions"><button class="secondary" type="button" id="circuit-alerts">熔断告警通知</button><button class="secondary" type="button" id="failover-statistics">故障切换统计</button><button class="primary" type="button" id="add-provider">＋ 新增自定义模型</button></div>')+`
 ${currentModelView()}<div class="banner">连接验证会向指定通道发送一次固定的最小推理请求，可能产生少量模型用量；不携带业务数据，不切换当前通道，不触发规则降级。业务场景执行效果请在调试工作台验证。</div>
 <div class="providers">${state.providers.map((p,i)=>{const testing=state.providerTesting[p.id]||p.testing, result=state.providerTests[p.id]||p.lastTest;return `<section class="panel provider"><div class="provider-top"><div class="provider-badge">${p.custom?'＋':i===0?'A':'B'}</div>${pill(p.selected?'当前配置通道':'备用通道',p.selected?'':'gray')}</div><h3>${esc(p.name)}</h3><p>${p.custom?'自定义模型 · Chat Completions':'内置模型服务通道'} · ${esc(p.configurationSource||'部署环境')}</p><div class="setting-row"><span>鉴权方式</span><span>${p.authType==='NONE'?'无需 API Key':'API Key'}</span></div><div class="setting-row"><span>凭据与模型配置</span>${pill(p.configured?'已配置':'待配置',p.configured?'':'amber')}</div><div class="setting-row"><span>服务地址</span><span class="mono provider-url">${esc(p.baseUrl||'未配置')}</span></div><div class="setting-row"><span>模型名称</span><span class="mono">${esc(p.model||'未配置')}</span></div><div class="setting-row"><span>连接验证</span>${pill(testing?'验证中':result?(result.ok?'验证成功':result.status==='CLIENT_ERROR'?'未完成':'验证失败'):'尚未执行',testing?'amber':result?(result.ok?'':'red'):'gray')}</div><div class="setting-row"><span>故障切换</span><span>${p.failover?.enabled?"已开启 · "+p.failover.providerIds.length+" 个备用":"未开启"}</span></div>${circuitStatusView(p)}<div class="setting-row"><span>场景执行模式</span><span class="muted">${p.inferenceEnabled===false?'真实推理开关已关闭':'以场景调用回执为准'}</span></div><div data-provider-result="${esc(p.id)}" aria-live="polite">${providerTestView(p)}</div>${!p.configured?`<p class="muted">待配置：${esc((p.missingFields||['API Key']).join('、'))}。点击“配置通道”完善后即可保存生效。</p>`:''}<div class="form-actions provider-actions"><button class="secondary" type="button" data-select-provider="${esc(p.id)}" ${p.selected||testing||state.providerSwitching?'disabled':''}>${p.selected?'当前模型':p.configured?'切换为当前模型':'配置后切换'}</button><button class="primary" type="button" data-config-provider="${esc(p.id)}" ${testing?'disabled':''}>配置通道</button><button class="secondary" type="button" data-failover-provider="${esc(p.id)}">故障切换</button><button class="secondary" type="button" data-circuit-provider="${esc(p.id)}">熔断恢复</button><button class="secondary" type="button" data-statistics-provider="${esc(p.id)}">切换统计</button><button class="secondary" type="button" data-change-provider="${esc(p.id)}">变更记录</button><button class="secondary" type="button" data-test-provider="${esc(p.id)}" ${testing?'disabled':''}>${testing?'验证中…':result?'重新验证':'验证连接'}</button>${p.custom?`<button class="text-button danger-button" type="button" data-delete-provider="${esc(p.id)}" ${p.selected||testing?'disabled':''} title="${p.selected?'先切换到其他通道再删除':'删除此自定义模型'}">删除</button>`:''}</div><p>密钥：${p.keyConfigured?'已设置 · 不回显':'未设置'}${p.updatedAt?' · 保存于 '+esc(time(p.updatedAt)):''}。配置保存后立即生效。</p></section>`}).join('')||'<section class="panel empty">暂无模型通道，请刷新或检查服务配置</section>'}</div>
 <section class="panel"><div class="panel-head"><h2>模型接入说明</h2></div><div class="governance"><h3>自定义模型接入</h3><p>新增后填写通道名称、API 基础地址及模型标识，选择 API Key 或无需鉴权。兼容 Chat Completions 的云服务、自建和本地部署服务均可配置；基础地址须为 AI 服务所在机器可访问的地址。保存为当前通道后应用于统一场景推理，配置故障切换策略后才会自动尝试指定备用通道。</p><h3>多模型切换</h3><p>为不同模型分别保存通道后，可直接切换为当前模型，无需重新填写密钥。切换只影响后续请求，保留全局推理及降级策略；切换前后通道的变更记录均可查看。配置不完整时先补齐配置，切换不会自动验证；自动故障转移需单独开启。</p><h3>故障切换</h3><p>为主通道显式开启后，按顺序最多尝试3个备用通道。网络超时、鉴权失败、限流、服务异常及无效响应触发切换；普通参数错误直接返回。每次请求优先主通道；已开启熔断时跳过冷却中的通道，不永久切换全局配置，不递归执行备用通道策略。单通道连接与读取分别受超时限制，切换可能增加耗时与模型用量；全部失败后场景按全局规则降级开关处理。</p><h3>熔断与自动恢复</h3><p>按通道独立开启，主模型与备用模型共用该通道状态。连续失败达到阈值后跳过此通道；冷却到期，由下一次真实请求单独探测，成功恢复正常，失败继续冷却。普通参数错误不累计故障。无备用通道时按原有失败策略处理。可提前结束冷却，但仍需真实请求验证恢复。策略持久化；运行计数重启后清空，修改通道配置或策略后重置。连接验证与模型列表获取不改变熔断状态。状态在打开配置或刷新数据时更新。</p><h3>场景专属模型</h3><p>在场景中心的“配置与提示词”中为场景指定独立模型，或选择跟随全局。全局切换不会影响专属绑定；正在被场景引用的通道需先解除绑定再删除。</p><h3>获取服务模型列表</h3><p>配置表单支持获取兼容 /models 接口返回的模型列表，搜索并选择模型后再保存；接口不支持或没有权限时可手动填写。获取不会保存配置、切换通道或发起推理，不计入业务调用统计。</p><h3>有效模型回复才算验证成功</h3><p>验证会检查配置完整性、访问鉴权及 Chat Completions 响应内容。未配置、鉴权失败、限流、超时及响应格式异常分别提示，不以规则模板降级结果代替连接成功。</p><h3>验证结果与真实场景分开判断</h3><p>验证可独立测试当前和备用通道，不改变真实推理开关。最近一次服务端验证结果在本次服务运行期间保留，重启后清空；每个通道两次验证至少间隔 10 秒。</p><h3>用量以服务端回执为准</h3><p>仅展示上游实际返回的 token 数，未返回时明确标注，不估算费用或用量。验证请求不计入业务场景调用统计。</p></div></section>`}
async function testProvider(id){
 if(state.providerTesting[id])return
 state.providerTesting[id]=true
 if(location.hash.slice(1)==='providers')await render()
 try{
  const result=await api('providers/'+encodeURIComponent(id)+'/test',{method:'POST',body:'{}',timeoutMs:40000})
  state.providerTests[id]=result
  const provider=state.providers.find(p=>p.id===id);if(provider){provider.lastTest=result;provider.testing=false;provider.connectionTested=true}
  toast(result.ok?'模型连接验证成功':'验证失败：'+result.message)
 }catch(e){
  state.providerTests[id]={ok:false,status:'CLIENT_ERROR',message:e.name==='TimeoutError'?'请求等待超时，服务端可能仍在验证；请刷新查看最新结果':e.message,testedAt:new Date().toISOString(),latencyMs:null}
  toast(state.providerTests[id].message)
 }finally{
  state.providerTesting[id]=false
  if(location.hash.slice(1)==='providers')await render()
 }
}
function governancePage(){return head('权限与审计','管理端使用统一账号与后端实时权限校验，保留可追踪的调用元数据。')+`<section class="panel"><div class="panel-head"><h2>当前统一账号</h2>${pill('认证已核验')}</div><div class="governance"><div class="setting-row"><span>用户名</span><span>${esc(state.user?.username)}</span></div><div class="setting-row"><span>显示名称</span><span>${esc(state.user?.nickname || state.user?.username)}</span></div><div class="setting-row"><span>管理端准入</span><span>ai:admin / ai:* / 平台通配权限</span></div><div class="setting-row"><span>审计状态</span>${pill(state.overview.auditWritable?'持久化写入正常':'写入异常',state.overview.auditWritable?'':'red')}</div><h3>统一身份认证</h3><p>沿用平台授权码与 PKCE 登录，访问令牌仅保留在页面内存。管理接口每次回查认证中心权限，不接受昵称、主体或角色请求头代替真实认证。</p><h3>调用审计与业务数据边界</h3><p>保留最近 1000 条调用的场景、任务、耗时、状态、时间及追踪编号。管理端调试记录核验后的账号标识；历史兼容业务端点尚未纳入此管理权限边界，调用身份标注为未核验。</p><h3>本期已接入范围</h3><p>运行概览、16 个业务场景、结构化调试、日志筛选及脱敏模型配置。场景启停、元数据维护、提示词草稿、发布、回滚与变量预览已接入。知识库、租户配额与计费功能尚未实现。</p></div></section>`}

let promptConfig=null
async function promptPage(){
 const scene=state.scenes.find(s=>s.code===state.selected)||state.scenes[0];state.selected=scene.code
 promptConfig=await api('scenes/'+encodeURIComponent(scene.code));const c=promptConfig
 const options=c.versions.map(v=>`<option value="${v.number}" ${v.number===(c.publishedVersion||c.versions.at(-1)?.number)?'selected':''}>v${v.number} · ${v.number===c.publishedVersion?'当前发布':v.publishedAt?'历史发布':'草稿'} · ${esc(v.note)}</option>`).join('')
 return head('提示词管理','维护场景配置与不可变版本，发布、回滚和调试均可追溯。')+`
 <section class="panel"><div class="toolbar"><label for="manage-scene">业务场景</label><select id="manage-scene">${state.scenes.map(s=>`<option value="${s.code}" ${s.code===c.code?'selected':''}>${esc(s.domain)} / ${esc(s.name)}</option>`).join('')}</select><span class="muted">修订 ${c.revision} · ${esc(c.code)}</span></div></section>
 <div class="banner">发布后的提示词在真实模型推理时生效；是否实际应用以调试回执 prompt_applied 和 execution_mode 为准。下方变量预览不调用外部模型。</div>
 ${sceneModelForm(c)}
 <div class="debug-grid"><section class="panel"><div class="panel-head"><h2>场景配置</h2>${pill(c.enabled?'已启用':'已停用',c.enabled?'':'gray')}</div><form id="scene-edit" class="form"><div class="field"><label>场景名称</label><input id="manage-name" maxlength="80" required value="${esc(c.name)}"></div><div class="field"><label>应用说明</label><input id="manage-description" maxlength="500" required value="${esc(c.description)}"></div><div class="field"><label>运行状态</label><select id="manage-enabled"><option value="true" ${c.enabled?'selected':''}>启用</option><option value="false" ${c.enabled?'':'selected'}>停用（拒绝场景调用）</option></select></div><div class="field"><label>JSON 参数示例</label><textarea id="manage-example" style="min-height:150px">${esc(JSON.stringify(JSON.parse(c.exampleJson),null,2))}</textarea></div><button class="primary">保存场景配置</button></form></section>
 <section class="panel"><div class="panel-head"><h2>创建提示词草稿</h2>${pill(c.publishedVersion?'发布版本 v'+c.publishedVersion:'尚未发布','amber')}</div><form id="prompt-draft" class="form"><div class="field"><label>系统提示词</label><textarea id="system-prompt" maxlength="8000" required style="min-height:135px">${esc('你是农业产业互联网的'+c.name+'助手。请基于提供的数据给出审慎、可解释的建议，不编造事实。')}</textarea></div><div class="field"><label>用户提示词</label><textarea id="user-prompt" maxlength="12000" required style="min-height:135px">${esc('业务编号：{{bizId}}\n业务输入：{{input}}\n请返回结构化建议与必要的风险说明。'.replaceAll('\\n','\n'))}</textarea><small>变量：{{input}} 为完整 JSON，{{bizId}} 为业务编号；也可使用 {{crop}} 等顶层输入字段。缺少变量时禁止发布。</small></div><div class="field"><label>版本说明</label><input id="prompt-note" maxlength="300" required placeholder="填写本次调整与预期效果"></div><button class="primary">保存为新草稿</button></form></section></div>
 <section class="panel"><div class="panel-head"><h2>版本记录</h2><span class="muted">正文保存后不可覆盖，修改时复制为新草稿</span></div><div class="table-scroll"><table><thead><tr><th>版本</th><th>状态</th><th>版本说明</th><th>创建账号 / 时间</th><th>操作</th></tr></thead><tbody>${[...c.versions].reverse().map(v=>`<tr><td>v${v.number}</td><td>${pill(v.number===c.publishedVersion?'当前发布':v.publishedAt?'历史发布':'草稿',v.publishedAt?'':'amber')}</td><td>${esc(v.note)}</td><td>${esc(v.createdBy)}<div class="cell-sub">${esc(time(v.createdAt))}</div></td><td><button class="link" data-load-version="${v.number}">复制编辑 / 预览</button> ${v.number===c.publishedVersion?'':`<button class="link" style="margin-left:12px" data-activate="${v.number}" data-rollback="${Boolean(v.publishedAt)}">${v.publishedAt?'回滚到此版本':'发布'}</button>`}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">尚无提示词版本，先创建一个草稿</td></tr>'}</tbody></table></div></section>
 <section class="panel"><div class="panel-head"><h2>提示词变量预览</h2>${pill('不调用模型','gray')}</div><div class="debug-grid"><form id="prompt-preview" class="form"><div class="field"><label>选择版本</label><select id="preview-version" ${options?'':'disabled'}>${options||'<option>暂无版本</option>'}</select></div><div class="field"><label>业务编号</label><input id="preview-biz-id" value="DEMO-001" maxlength="100"></div><div class="field"><label>JSON 输入</label><textarea id="preview-input" style="min-height:160px">${esc(JSON.stringify(JSON.parse(c.exampleJson),null,2))}</textarea></div><button class="secondary" ${options?'':'disabled'}>渲染预览</button><a class="link" href="#debug" style="margin-left:14px">进入场景调试 ↗</a></form><div><pre id="prompt-output" class="code-result">选择版本并输入参数，预览渲染后的系统与用户提示词。</pre></div></div></section>
 <section class="panel"><div class="panel-head"><h2>最近配置操作</h2><small>最多保留100条</small></div><div class="table-scroll"><table><thead><tr><th>动作</th><th>版本</th><th>操作账号</th><th>时间</th></tr></thead><tbody>${[...c.events].reverse().slice(0,20).map(e=>`<tr><td>${esc({CREATE_SCENE:'新增自定义场景',EDIT_SCENE:'修改场景',BIND_MODEL:'变更场景模型',BATCH_BIND_MODEL:'批量绑定模型',CREATE_DRAFT:'创建草稿',PUBLISH:'发布版本',ROLLBACK:'回滚版本'}[e.action]||e.action)}</td><td>${['BIND_MODEL','BATCH_BIND_MODEL'].includes(e.action)?esc((e.beforeProviderId||'跟随全局')+' → '+(e.afterProviderId||'跟随全局')):(e.version?'v'+e.version:'—')}</td><td>${esc(e.operator)}</td><td>${esc(time(e.time))}</td></tr>`).join('')||'<tr><td colspan="4" class="empty">暂无配置操作</td></tr>'}</tbody></table></div></section>`
}
function jsonObject(value){const data=JSON.parse(value);if(!data||typeof data!=='object'||Array.isArray(data))throw Error('请输入JSON对象');return data}
function bindPrompts(){
 $('#manage-scene').onchange=e=>{state.selected=e.target.value;render()}
 async function mutate(path,method,payload,button){button.disabled=true;try{await api('scenes/'+encodeURIComponent(promptConfig.code)+path,{method,body:JSON.stringify({...payload,revision:promptConfig.revision})});state.scenes=await api('scenes');await render();toast('配置已保存')}catch(e){toast(e.message)}finally{button.disabled=false}}
 $('#scene-model-form').onsubmit=async e=>{
  e.preventDefault();const button=e.submitter;if(button.disabled)return;button.disabled=true;$('#scene-model-error').hidden=true
  try{await api('scenes/'+encodeURIComponent(promptConfig.code)+'/model',{method:'PUT',body:JSON.stringify({revision:promptConfig.revision,providerId:$('#scene-model-provider').value})});state.scenes=await api('scenes');state.result=null;await render();toast('场景模型配置已保存，后续调用生效')}
  catch(err){const box=$('#scene-model-error');if(box){box.textContent=err.message;box.hidden=false}else toast(err.message)}finally{button.disabled=false}
 }
 $('#scene-edit').onsubmit=e=>{e.preventDefault();try{jsonObject($('#manage-example').value);mutate('','PUT',{name:$('#manage-name').value,description:$('#manage-description').value,exampleJson:$('#manage-example').value,enabled:$('#manage-enabled').value==='true'},e.submitter)}catch(err){toast(err.message)}}
 $('#prompt-draft').onsubmit=e=>{e.preventDefault();mutate('/versions','POST',{systemPrompt:$('#system-prompt').value,userPrompt:$('#user-prompt').value,note:$('#prompt-note').value},e.submitter)}
 document.querySelectorAll('[data-activate]').forEach(b=>b.onclick=()=>mutate(b.dataset.rollback==='true'?'/rollback':'/publish','POST',{version:Number(b.dataset.activate)},b))
 document.querySelectorAll('[data-load-version]').forEach(b=>b.onclick=()=>{const v=promptConfig.versions.find(v=>v.number===Number(b.dataset.loadVersion));$('#system-prompt').value=v.systemPrompt;$('#user-prompt').value=v.userPrompt;$('#prompt-note').value='基于 v'+v.number+' 调整：';$('#preview-version').value=String(v.number);toast('已加载版本，可预览或编辑后保存为新草稿')})
 $('#prompt-preview').onsubmit=async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;try{const result=await api('scenes/'+encodeURIComponent(promptConfig.code)+'/preview',{method:'POST',body:JSON.stringify({version:Number($('#preview-version').value),input:jsonObject($('#preview-input').value),bizId:$('#preview-biz-id').value})});$('#prompt-output').textContent=JSON.stringify(result,null,2);if(result.missingVariables.length)toast('缺少变量：'+result.missingVariables.join('、'))}catch(err){toast(err.message)}finally{button.disabled=false}}
}

let circuitNotificationTimer, circuitNotificationBusy=false, circuitLatestId=null, circuitAlertVersion=0
function updateCircuitNotificationBadge(summary){
 const b=$('#model-notifications');if(!b)return
 b.textContent='熔断通知'+(summary.unreadCount?' · '+summary.unreadCount:'')
 b.classList.toggle('has-unread',summary.unreadCount>0)
 b.title=summary.writable?'查看熔断和恢复通知':'通知记录持久化异常，请检查存储'
 b.setAttribute('aria-label','熔断通知，'+summary.unreadCount+'条未读')
}
async function pollCircuitNotifications(){
 if(!state.token||document.hidden||circuitNotificationBusy)return
 circuitNotificationBusy=true
 try{
  const summary=await api('circuit-alerts/summary');updateCircuitNotificationBadge(summary)
  if(circuitLatestId!==null&&summary.latestId!==circuitLatestId&&summary.unreadCount>0)toast('收到新的模型熔断或恢复通知，请查看顶部熔断通知')
  circuitLatestId=summary.latestId
 }catch{const b=$('#model-notifications');if(b)b.title='通知暂时无法刷新，点击重试'}
 finally{circuitNotificationBusy=false}
}
function startCircuitNotifications(){
 if(!$('#model-notifications')){
  const b=document.createElement('button');b.id='model-notifications';b.type='button';b.className='alert-notification-button';b.textContent='熔断通知';b.onclick=()=>showCircuitAlerts();$('.top-actions').prepend(b)
 }
 clearInterval(circuitNotificationTimer);pollCircuitNotifications();circuitNotificationTimer=setInterval(pollCircuitNotifications,30000)
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)pollCircuitNotifications()})
const circuitEventLabel=type=>({OPEN:'通道熔断',REOPEN:'探测失败',RECOVERED:'恢复成功'})[type]||type
async function showCircuitAlerts(initialProvider=''){
 const drawer=$('#drawer');const session=++circuitAlertVersion
 let provider=initialProvider,type='ALL',unreadOnly=false,page=1,busy=false,data
 drawer.innerHTML=`<section class="drawer" role="dialog" aria-modal="true" aria-labelledby="circuit-alert-title" style="width:min(1180px,96vw)"><div class="panel-head"><h2 id="circuit-alert-title">熔断告警通知</h2><button type="button" id="close-circuit-alerts" class="text-button">关闭 ✕</button></div><div class="form"><div class="banner">通道首次熔断、恢复探测失败及恢复成功时生成站内通知。同一轮冷却中的跳过请求不重复提醒；已读状态按账号分别保存。标记已读不影响熔断恢复。</div><div class="circuit-alert-filters"><select id="alert-provider" aria-label="告警通道"></select><select id="alert-type" aria-label="告警事件"><option value="ALL">全部事件</option><option value="OPEN">通道熔断</option><option value="REOPEN">探测失败</option><option value="RECOVERED">恢复成功</option></select><label class="provider-check"><input type="checkbox" id="alert-unread">仅看未读</label><button class="secondary" id="alert-refresh" type="button">刷新通知</button><button class="secondary" id="alert-read-all" type="button">全部标为已读</button></div><p class="muted" id="alert-summary">正在加载通知…</p><div class="banner error" id="alert-error" role="alert" hidden></div><div class="table-wrap"><table class="circuit-alert-table"><thead><tr><th>时间 / 阅读状态</th><th>模型通道</th><th>告警事件</th><th>故障与恢复信息</th><th>处理</th></tr></thead><tbody id="alert-records"></tbody></table></div><div class="pagination"><span id="alert-page"></span><button class="secondary" id="alert-prev" type="button">上一页</button><button class="secondary" id="alert-next" type="button">下一页</button></div><p class="muted">保留最近1000条事件，重启后恢复通知历史与已读状态；通道配置重置和服务重启不代表真实恢复，不发送恢复成功通知。控制台打开且页面可见时每30秒检查新通知，列表通过“刷新通知”更新。</p></div></section>`
 drawer.hidden=false
 const active=()=>session===circuitAlertVersion&&!drawer.hidden&&!!$('#alert-records')
 const showError=e=>{if(active()){$('#alert-error').textContent=e.message;$('#alert-error').hidden=false}}
 const setBusy=value=>{busy=value;if(active())drawer.querySelectorAll('button,select,input').forEach(b=>{if(b.id!=='close-circuit-alerts')b.disabled=value})}
 $('#close-circuit-alerts').onclick=()=>{circuitAlertVersion++;drawer.hidden=true;drawer.innerHTML=''}
 async function load(){
  if(!active())return
  setBusy(true);$('#alert-error').hidden=true
  try{
   const query=new URLSearchParams({provider,type,unreadOnly:String(unreadOnly),page:String(page),pageSize:'15'})
   const result=await api('circuit-alerts?'+query);if(!active())return
   data=result;updateCircuitNotificationBadge(data)
   const options=new Map(state.providers.map(p=>[p.id,p.name]));for(const p of data.providers)options.set(p.id,p.name);if(provider&&!options.has(provider))options.set(provider,provider)
   $('#alert-provider').innerHTML='<option value="">全部通道</option>'+[...options].map(([id,name])=>`<option value="${esc(id)}" ${id===provider?'selected':''}>${esc(name)}</option>`).join('')
   $('#alert-summary').textContent=`共保留 ${data.retained} 条通知，当前账号未读 ${data.unreadCount} 条，筛选结果 ${data.total} 条。${data.writable?'持久化正常。':'持久化异常，新增通知可能仅保留在内存中。'}`
   $('#alert-records').innerHTML=data.records.length?data.records.map(({event:e,read})=>`<tr class="${read?'':'circuit-alert-unread'}"><td>${esc(time(e.time))}<div class="cell-sub">${read?'已读':'未读'}</div></td><td><div class="cell-title">${esc(e.providerName)}</div><div class="cell-sub">${esc(e.model)}</div></td><td>${pill(circuitEventLabel(e.type),e.type==='RECOVERED'?'':'amber')}<div class="cell-sub">${esc(e.title)}</div></td><td>${esc(e.reason)}<div class="cell-sub">连续故障 ${esc(e.failures)} 次 · 阈值 ${esc(e.threshold)} 次 · 冷却 ${esc(e.cooldownSeconds)} 秒</div><div class="cell-sub">事件组 ${esc(e.incidentId)}</div></td><td><div class="circuit-alert-actions">${read?'':`<button class="link" data-alert-read="${esc(e.id)}" type="button">标为已读</button>`}${state.providers.some(p=>p.id===e.providerId)?`<button class="link" data-alert-channel="${esc(e.providerId)}" type="button">查看通道</button>`:'<span class="muted">通道已移除</span>'}</div></td></tr>`).join(''):'<tr><td colspan="5" class="empty">暂无符合条件的熔断通知</td></tr>'
   $('#alert-page').textContent=`第 ${page} / ${Math.max(1,Math.ceil(data.total/15))} 页 · 共 ${data.total} 条`
   drawer.querySelectorAll('[data-alert-read]').forEach(b=>b.onclick=()=>markRead({ids:[b.dataset.alertRead]}))
   drawer.querySelectorAll('[data-alert-channel]').forEach(b=>b.onclick=()=>{circuitAlertVersion++;configureCircuit(b.dataset.alertChannel)})
  }catch(e){showError(e)}finally{
   setBusy(false)
   if(active()){$('#alert-prev').disabled=page<=1;$('#alert-next').disabled=!data||page*15>=data.total;$('#alert-read-all').disabled=!data?.unreadCount}
  }
 }
 async function markRead(payload){
  if(busy)return;setBusy(true);$('#alert-error').hidden=true
  try{const summary=await api('circuit-alerts/read',{method:'POST',body:JSON.stringify(payload)});updateCircuitNotificationBadge(summary);if(active()){if(unreadOnly)page=1;await load()}}
  catch(e){showError(e);setBusy(false)}
 }
 $('#alert-provider').onchange=e=>{provider=e.target.value;page=1;load()}
 $('#alert-type').onchange=e=>{type=e.target.value;page=1;load()}
 $('#alert-unread').onchange=e=>{unreadOnly=e.target.checked;page=1;load()}
 $('#alert-refresh').onclick=()=>load()
 $('#alert-prev').onclick=()=>{if(!busy&&page>1){page--;load()}}
 $('#alert-next').onclick=()=>{if(!busy&&data&&page*15<data.total){page++;load()}}
 $('#alert-read-all').onclick=()=>{if(data?.latestId)markRead({ids:[],throughId:data.latestId})}
 await load()
}

let renderVersion=0
async function render(){const current=++renderVersion;const id=location.hash.slice(1)||'overview', nav=navs.find(x=>x[0]===id)||navs[0];$('#crumb').textContent=nav[1];document.querySelectorAll('#nav a').forEach(a=>a.classList.toggle('active',a.dataset.nav===nav[0]));$('#notice').hidden=true
 try{let html;if(nav[0]==='overview')html=overview();else if(nav[0]==='scenes')html=scenePage();else if(nav[0]==='prompts')html=await promptPage();else if(nav[0]==='debug')html=debugPage();else if(nav[0]==='calls')html=await callPage();else if(nav[0]==='providers')html=providerPage();else html=governancePage();if(current!==renderVersion)return;$('#content').innerHTML=html;bind(nav[0])}catch(e){if(current!==renderVersion)return;$('#notice').className='banner error';$('#notice').textContent=e.message;$('#notice').hidden=false}}
function showScene(code){const s=state.scenes.find(x=>x.code===code);if(!s)return;$('#drawer').innerHTML=`<section class="drawer" role="dialog" aria-modal="true" aria-label="场景详情"><div class="panel-head"><h2>场景详情</h2><button id="close-drawer" class="text-button">关闭 ✕</button></div><div class="drawer-body"><span class="eyebrow">SCENE CAPABILITY</span><h2>${esc(s.name)}</h2>${pill(s.publishedVersion?'提示词已发布':'待发布提示词',s.publishedVersion?'':'amber')}<p>${esc(s.description)}</p><dl class="definition"><dt>场景编码</dt><dd class="mono">${esc(s.code)}</dd><dt>业务子系统</dt><dd>${esc(s.domain)}</dd><dt>业务标识</dt><dd class="mono">${esc(s.bizSystem)}</dd><dt>模型路由</dt><dd>${esc(sceneModelText(s))}</dd><dt>执行类型</dt><dd>按场景模型配置和全局推理策略执行</dd></dl><h3 style="font-size:13px">JSON 入参示例</h3><pre>${esc(JSON.stringify(JSON.parse(s.exampleJson),null,2))}</pre><p>发布提示词后可进入调试工作台验证；金融、监管和生产结果仍需业务人员复核。</p><button class="primary" id="drawer-debug">进入调试工作台 ↗</button></div></section>`;$('#drawer').hidden=false;$('#close-drawer').onclick=()=>$('#drawer').hidden=true;$('#drawer-debug').onclick=()=>{state.selected=code;state.result=null;$('#drawer').hidden=true;location.hash='debug'}}
async function copy(value){try{await navigator.clipboard.writeText(value);toast('已复制')}catch{toast('当前浏览器未允许复制，请从结果区域手动选择')}}
function bind(id){if(id==='providers'){$('#circuit-alerts').onclick=()=>showCircuitAlerts();$('#failover-statistics').onclick=()=>showFailoverStatistics('');document.querySelectorAll('[data-statistics-provider]').forEach(b=>b.onclick=()=>showFailoverStatistics(b.dataset.statisticsProvider));document.querySelectorAll('[data-circuit-provider]').forEach(b=>b.onclick=()=>configureCircuit(b.dataset.circuitProvider));document.querySelectorAll('[data-failover-provider]').forEach(b=>b.onclick=()=>configureFailover(b.dataset.failoverProvider));document.querySelectorAll('[data-select-provider]').forEach(b=>b.onclick=()=>switchProvider(b.dataset.selectProvider));$('#add-provider').onclick=()=>configureProvider();document.querySelectorAll('[data-delete-provider]').forEach(b=>b.onclick=()=>deleteProvider(b.dataset.deleteProvider));document.querySelectorAll('[data-test-provider]').forEach(b=>b.onclick=()=>testProvider(b.dataset.testProvider));document.querySelectorAll('[data-config-provider]').forEach(b=>b.onclick=()=>configureProvider(b.dataset.configProvider));document.querySelectorAll('[data-change-provider]').forEach(b=>b.onclick=()=>showProviderChanges(b.dataset.changeProvider));}if(id==='prompts')bindPrompts();document.querySelectorAll('[data-manage]').forEach(b=>b.onclick=()=>{state.selected=b.dataset.manage;location.hash='prompts'});document.querySelectorAll('[data-domain]').forEach(b=>b.onclick=()=>{resetSceneFilters();state.domain=b.dataset.domain;location.hash='scenes'});document.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>showScene(b.dataset.detail));document.querySelectorAll('[data-debug]').forEach(b=>b.onclick=()=>{state.selected=b.dataset.debug;state.result=null;location.hash='debug'});document.querySelectorAll('[data-trace]').forEach(b=>b.onclick=()=>copy(b.dataset.trace));
 if(id==='scenes'){
 $('#add-scene').onclick=createSceneDrawer
 syncSceneSelection()
 document.querySelectorAll('[data-scene-select]').forEach(input=>input.onchange=()=>{if(input.checked)state.sceneSelection.add(input.dataset.sceneSelect);else state.sceneSelection.delete(input.dataset.sceneSelect);syncSceneSelection()})
 $('#select-visible-scenes').onchange=e=>{for(const s of filteredScenes()){if(e.target.checked)state.sceneSelection.add(s.code);else state.sceneSelection.delete(s.code)}syncSceneSelection()}
 $('#clear-scene-selection').onclick=()=>{state.sceneSelection.clear();syncSceneSelection()}
 $('#batch-bind-model').onclick=batchModelDrawer
 let timer;$('#scene-search').oninput=e=>{state.sceneSelection.clear();state.sceneSearch=e.target.value;syncSceneSelection();clearTimeout(timer);timer=setTimeout(async()=>{const pos=$('#scene-search')?.selectionStart;await render();$('#scene-search')?.focus();$('#scene-search')?.setSelectionRange(pos,pos)},220)};$('#scene-domain').onchange=e=>{state.sceneSelection.clear();state.domain=e.target.value;render()};$('#scene-model-source').onchange=e=>{state.sceneSelection.clear();state.sceneModelSource=e.target.value;render()};$('#scene-model-filter').onchange=e=>{state.sceneSelection.clear();state.sceneModelProvider=e.target.value;render()};$('#reset-scene-filters').onclick=()=>{resetSceneFilters();render()}}
 if(id==='debug'){$('#debug-scene').onchange=e=>{state.selected=e.target.value;state.result=null;render()};$('#load-example').onclick=()=>$('#json-input').value=JSON.stringify(JSON.parse(state.scenes.find(s=>s.code===state.selected).exampleJson),null,2);$('#copy-result').onclick=()=>copy(JSON.stringify(state.result,null,2));$('#debug-form').onsubmit=async e=>{e.preventDefault();if(state.running)return;let input;try{input=JSON.parse($('#json-input').value);if(!input||Array.isArray(input)||typeof input!=='object')throw Error('参数必须是 JSON 对象');if(Object.keys(input).length>50||$('#json-input').value.length>16000)throw Error('参数超过 50 个字段或 16KB 限制')}catch(err){toast('参数错误：'+err.message);return}state.running=true;const button=$('#run');button.disabled=true;button.textContent='执行中…';try{state.result=await api('debug',{method:'POST',timeoutMs:105000,body:JSON.stringify({sceneCode:state.selected,bizId:$('#biz-id').value,input})});$('#result').innerHTML=resultView(state.result);$('#copy-result').disabled=false;state.overview=await api('overview');toast(state.result.ok?'场景执行成功，调用已记录':'场景执行失败，请查看响应')}catch(err){toast(err.message)}finally{state.running=false;button.disabled=false;button.textContent='▷ 执行调试'}}}
 if(id==='calls'){const query=()=>{state.keyword=$('#call-search').value;state.status=$('#call-status').value;state.page=1;render()};$('#query-calls').onclick=query;$('#call-search').onkeydown=e=>{if(e.key==='Enter')query()};$('#call-status').onchange=query;$('#prev').onclick=()=>{state.page--;render()};$('#next').onclick=()=>{state.page++;render()}}
}
$('#login').onclick=()=>login().catch(e=>toast(e.message));
let logoutPending=false
$('#logout').onclick=async()=>{
 if(logoutPending)return
 logoutPending=true;$('#logout').disabled=true
 try{
  await request('/api/v1/auth/logout',{method:'POST',body:'{}',timeoutMs:10000})
  state.token='';['verifier','state','return'].forEach(key=>sessionStorage.removeItem(PREFIX+key))
  location.assign(sso+'/api/v1/sso/logout/complete?client_id='+CLIENT)
 }catch{toast('未完成全局退出，登录状态已保留，请重试');logoutPending=false;$('#logout').disabled=false}
}
$('#refresh').onclick=async()=>{try{[state.overview,state.providers,state.scenes]=await Promise.all([api('overview'),api('providers'),api('scenes')]);state.providerTests={};state.sceneSelection.clear();await render();toast('数据已刷新')}catch(e){toast(e.message)}}
$('#drawer').onclick=e=>{if(!state.sceneCreating&&e.target===$('#drawer'))$('#drawer').hidden=true};document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!state.sceneCreating)$('#drawer').hidden=true})
window.addEventListener('hashchange',()=>{if(state.token){render();window.scrollTo(0,0)}})
boot()
