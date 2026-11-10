import assert from 'node:assert/strict'
const base=process.env.AI_TEST_URL||'http://localhost:18201'
const platform=process.env.PLATFORM_URL||'http://localhost:8093'
let count=0
function check(value,label){assert.ok(value,label);count++;console.log('✓ '+label)}
async function http(path,method='GET',payload,token){const res=await fetch(base+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(payload?{'Content-Type':'application/json'}:{})},body:payload?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(15000)});return {status:res.status,body:await res.json()}}
async function login(username){const r=await fetch(platform+'/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:process.env.AI_TEST_PASSWORD||'Admin@123'}),signal:AbortSignal.timeout(15000)});const b=await r.json();assert.ok(b.data?.accessToken,'登录失败 '+username);return b.data.accessToken}
for(let i=0;i<30;i++){try{const r=await http('/actuator/health');if(r.body.status==='UP')break}catch{}await new Promise(r=>setTimeout(r,500))}
const admin=await login('admin'),farmer=await login('farmer'),path='/api/ai/admin/scenes/info.digest.extract'
check((await http(path)).status===401,'匿名读取被拒绝')
check((await http(path,'GET',undefined,'invalid')).status===401,'伪造令牌被拒绝')
check((await http(path,'GET',undefined,farmer)).status===403,'普通账号读取配置被拒绝')
check((await http(path,'PUT',{revision:0,name:'x'},farmer)).status===403,'普通账号修改配置被拒绝')
const list=await http('/api/ai/admin/scenes','GET',undefined,admin);check(list.body.data.length===16,'16个场景元数据完整')
let c=(await http(path,'GET',undefined,admin)).body.data
assert.equal(c.revision,0,'此脚本只允许使用全新隔离配置，禁止在正式场景运行')
const original={name:c.name,description:c.description,exampleJson:c.exampleJson,enabled:c.enabled}
async function mutate(suffix,payload,method='POST'){const r=await http(path+suffix,method,{...payload,revision:c.revision},admin);check(r.status===200&&r.body.code===0,suffix+' 成功');c=r.body.data;return c}
await mutate('',{...original,name:'资讯摘要管理回归'},'PUT')
check(c.name==='资讯摘要管理回归'&&c.revision===1,'元数据保存和修订号更新')
check((await http(path,'PUT',{...original,revision:0},admin)).status===409,'过期修订号返回409')
check((await http(path,'PUT',{...original,revision:c.revision,exampleJson:'[]'},admin)).status===400,'非法参数示例返回400')
await mutate('/versions',{systemPrompt:'基于事实 {{text}}',userPrompt:'输入 {{input}} 业务 {{bizId}}',note:'版本一'})
check(c.versions.length===1&&c.publishedVersion===null,'保存草稿不自动发布')
let preview=await http(path+'/preview','POST',{version:1,input:{text:'绿色农业'},bizId:'TEST'},admin)
check(preview.body.data.systemPrompt==='基于事实 绿色农业'&&preview.body.data.userPrompt.includes('TEST'),'变量按输入正确渲染')
check(preview.body.data.modelInvoked===false,'变量预览不调用外部模型')
preview=await http(path+'/preview','POST',{version:1,input:{text:'{{bizId}}'},bizId:'SECRET'},admin)
check(preview.body.data.systemPrompt==='基于事实 {{bizId}}','变量值只渲染一次，不递归展开')
await mutate('/publish',{version:1})
check(c.publishedVersion===1&&!!c.versions[0].publishedAt,'发布版本标记持久化')
check((await http(path+'/publish','POST',{revision:c.revision,version:1},admin)).status===400,'重复发布被拒绝')
await mutate('/versions',{systemPrompt:'缺少 {{missing}}',userPrompt:'{{input}}',note:'缺失变量版本'})
check((await http(path+'/publish','POST',{revision:c.revision,version:2},admin)).status===400,'缺少示例变量禁止发布')
preview=await http(path+'/preview','POST',{version:2,input:{}},admin)
check(preview.body.data.missingVariables.includes('missing'),'预览指出缺失变量')
check((await http(path+'/rollback','POST',{revision:c.revision,version:2},admin)).status===400,'未发布草稿不能作为回滚目标')
check((await http(path+'/versions','POST',{revision:c.revision,systemPrompt:'{{a.b}}',userPrompt:'x',note:'x'},admin)).status===400,'非法变量语法被拒绝')
await mutate('/versions',{systemPrompt:'新版本 {{text}}',userPrompt:'{{input}}',note:'版本三'})
await mutate('/publish',{version:3})
await mutate('/rollback',{version:1})
check(c.publishedVersion===1&&c.versions.length===3,'回滚保留全部历史版本')
check(c.events.some(e=>e.action==='ROLLBACK')&&c.events.every(e=>/^\d+$/.test(e.operator)),'配置操作记录真实固定账号')
await mutate('',{...original,enabled:false},'PUT')
let debug=await http('/api/ai/admin/debug','POST',{sceneCode:c.code,input:{text:'demo'}},admin)
check(debug.body.data.ok===false,'停用场景拒绝调试执行')
let invoke=await http('/api/ai/invoke','POST',{sceneCode:c.code,bizSystem:'info_news',input:{}},undefined)
check(invoke.body.ok===false,'停用场景拒绝业务调度入口执行')
await mutate('',original,'PUT')
debug=await http('/api/ai/admin/debug','POST',{sceneCode:c.code,input:{text:'demo'}},admin)
check(debug.body.data.ok===true,'重新启用后规则调试正常')
check(debug.body.data.usage.prompt_version===1&&debug.body.data.usage.prompt_applied===false,'调用结果记录版本且明确提示词未应用')
invoke=await http('/api/ai/invoke','POST',{sceneCode:c.code,bizSystem:'farm_prod',input:{text:'x'}})
check(invoke.body.ok===false,'业务系统与场景不匹配被拒绝')
check((await http(path+'/preview','POST',{input:{text:'ok'}},admin)).body.data.version===1,'未指定版本预览当前发布版本')
console.log(`完成：${count}项通过，0失败；仅写入隔离测试配置`)
