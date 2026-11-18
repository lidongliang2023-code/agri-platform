import { logoutMobile } from '../../../../packages/agri-shared/src/auth/logoutMobile'
export interface Device{id:number;plotId:number;gatewayId:number;groupId:number;deviceCode:string;deviceName:string;typeName:string;protocol:string;onlineStatus:string;status:string;lastReport:string;rssi:number|null;battery:number;firmwareVersion:string;controlCapable:boolean;config:string;telemetry?:Telemetry[];controls?:ControlLog[]}
export interface Telemetry{key:string;name:string;value:number;unit:string;recordedAt:string}
export interface ControlLog{id:number;deviceName:string;action:string;operator:string;result:string;createdAt:string}
export interface Alert{id:number;alertNo:string;deviceId:number;deviceName:string;type:string;level:string;title:string;content:string;triggerValue:string;thresholdValue:string;status:string;handledBy?:string;handleNote?:string;createdAt:string}
export interface Plot{
  id:number;plotId?:string;plotCode:string;plotName:string;area:number;cropName:string;cropStage:string;
  deviceCount:number;onlineCount:number;deviceOnlineRate?:number;status:string;
  farmId?:number;farmCode?:string;farmName?:string;cropVariety?:string;
  plantingDate?:string;expectedHarvestDate?:string;productionStatus?:number;
  latitude?:number|null;longitude?:number|null;source?:string;sourceUpdatedAt?:string
}
export interface Scene{id:number;sceneCode:string;sceneName:string;icon:string;category:string;description:string;config:string;active:boolean;plotCount:number}
export interface AutomationRule{
  id:number;ruleCode:string;ruleName:string;trigger:string;action:string;enabled:boolean;
  lastTrigger:string;triggerCount:number;ruleType?:string;triggerMetric?:string;
  operator?:string;threshold?:string;durationSeconds?:number;schedule?:string;
  actionDeviceId?:number|null;actionDeviceName?:string;actionCommand?:string;
  actionValue?:string;cooldownSeconds?:number;config?:string
}
/** 移动端"立即同步"的返回：待办计数由服务端按当前经营主体实查。 */
export interface MobileSync{syncedAt:string;pendingWorkOrders:number;pendingAlerts:number;unreadMessages:number;message:string}
interface Overview{stats:{devices:number;online:number;offline:number;alerts:number;plots:number;gateways:number;todayControl:number;dataToday:number};farm:Record<string,unknown>;devices:Device[];alerts:Alert[];plots:Plot[];environment:Array<{name:string;value:number;unit:string;key:string;change:number;status:string}>;messages:Array<{id:number;type:string;title:string;content:string;read:boolean;createdAt:string}>}
export type Row = Record<string, any>
interface Envelope<T>{code:number;message:string;data:T}
const runtimePlatform=uni.getSystemInfoSync().uniPlatform
const configuredOrigin=(import.meta.env.VITE_IOT_API_BASE||'').replace(/\/$/,'')
const BASE=configuredOrigin
const AUTH_BASE=(import.meta.env.VITE_IOT_AUTH_BASE||configuredOrigin).replace(/\/$/,'')
let generation=0, redirecting=false
let ready:Promise<void>|null=null
let identityReady:Promise<void>|null=null
let permissions:string[]=[]
const PERMISSIONS_ENDPOINT='/api/v1/platform/permissions/mine'
let sessionProbe:{version:number;token:string;promise:Promise<boolean>}|null=null
export function clearIotSession(){generation++;ready=null;identityReady=null;sessionProbe=null;permissions=[];['iot_workspace','token','user','iot_session_expires','iot_subject','iot_status','iot_plot','iot_group'].forEach(k=>uni.removeStorageSync(k));uni.$emit('iot:session-reset')}
/** 统一认证中心的公开登录端点：401 表示凭据错误，不能当成“登录失效”去跳转。 */
const AUTH_ENDPOINTS=['/api/v1/sso/login-standalone','/api/v1/sso/login-standalone-mfa','/api/v1/sso/login-standalone-by-sms','/api/v1/sso/sms/code']
function loginRequired(){clearIotSession();if(!redirecting){redirecting=true;uni.reLaunch({url:'/pages/login/index',complete:()=>{redirecting=false}})}}
function toQuery(params?:Record<string,unknown>):string{
 const entries=Object.entries(params??{}).filter(([,value])=>value!==undefined&&value!==null&&value!=='')
 return entries.length?`?${entries.map(([key,value])=>`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join('&')}`:''
}
/** 兼容旧后端将失效令牌返回为403：只以认证中心明确的401判定失效。 */
function tokenInvalid(token:string,version:number):Promise<boolean>{
 if(sessionProbe?.version===version&&sessionProbe.token===token)return sessionProbe.promise
 const promise=new Promise<boolean>(resolve=>{
  uni.request({url:`${AUTH_BASE}${PERMISSIONS_ENDPOINT}`,method:'GET',timeout:10000,header:{Authorization:`Bearer ${token}`},
   success:(res:any)=>resolve(res.statusCode===401||res.data?.code===401),fail:()=>resolve(false)})
 })
 sessionProbe={version,token,promise}
 void promise.finally(()=>{if(sessionProbe?.promise===promise)sessionProbe=null})
 return promise
}
async function raw<T>(origin:string,url:string,method:'GET'|'POST'|'PUT'|'DELETE'='GET',data?:Record<string,unknown>,token=String(uni.getStorageSync('token')||'')):Promise<T>{
 if(runtimePlatform!=='web'&&!origin)throw new Error('请配置小程序 / APP 的 HTTPS 服务地址后重新构建')
 const authentication=AUTH_ENDPOINTS.includes(url)
 const storedToken=String(uni.getStorageSync('token')||'')
 const expires=Number(uni.getStorageSync('iot_session_expires')||0)
 if(!authentication&&token&&token===storedToken&&expires&&expires<=Date.now()){
  loginRequired();throw new Error('登录已失效，请重新登录')
 }
 const version=generation
 const sameSession=()=>version===generation&&String(uni.getStorageSync('token')||'')===storedToken
 return new Promise((resolve,reject)=>uni.request({url:`${origin}${url}`,method,data,timeout:15000,header:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},async success(res:any){
  if(!sameSession())return reject(new Error('账号或经营主体已改变，请重新加载'))
  const body=res.data as Envelope<T>|null
  if(res.statusCode===401||body?.code===401){if(!authentication)loginRequired();return reject(new Error(authentication?(body?.message||'账号、密码或验证码不正确'):'登录已失效，请重新登录'))}
  if(!authentication&&token&&url!==PERMISSIONS_ENDPOINT&&(res.statusCode===403||body?.code===403)){
   const invalid=await tokenInvalid(token,version)
   if(!sameSession())return reject(new Error('账号或经营主体已改变，请重新加载'))
   if(invalid){loginRequired();return reject(new Error('登录已失效，请重新登录'))}
  }
  if(!body||typeof body!=='object'||typeof body.code!=='number')return reject(new Error(`服务返回异常（HTTP ${res.statusCode}），请检查认证服务地址或网关转发`))
  if(res.statusCode>=400||![0,200].includes(body.code))return reject(new Error(body.message||`服务请求失败（HTTP ${res.statusCode}）`))
  resolve(body.data)
 },fail(err:any){reject(new Error(err?.errMsg?.includes('timeout')?'请求超时，请重试':err?.errMsg||'网络异常，请重试'))}}))
}
function granted(list:string[],code:string){return list.includes('*')||list.includes('iot:*')||list.includes(code)}
export function canWrite(){return granted(permissions,'iot:write')}
export function hasIotSession(){
 const expires=Number(uni.getStorageSync('iot_session_expires')||0)
 if(expires&&expires<=Date.now()){clearIotSession();return false}
 return Boolean(uni.getStorageSync('token'))
}
export function ensureIotSession(){if(hasIotSession())return true;loginRequired();return false}
export type Workspace = 'user' | 'ops'
export function canOperate(){return granted(permissions,'iot:admin')}
export function canUseUser(){return granted(permissions,'iot:read')}
export function currentWorkspace():Workspace{return uni.getStorageSync('iot_workspace')==='ops'?'ops':'user'}
export function workspaceHome(){return currentWorkspace()==='ops'?'/pages/ops/index':'/pages/index/index'}
export async function identitySessionReady(){
 if(!ensureIotSession())throw new Error('请先登录')
 if(!identityReady)identityReady=(async()=>{
  const result=await raw<{permissions:string[]}>(AUTH_BASE,'/api/v1/platform/permissions/mine')
  permissions=result.permissions||[]
  if(!canUseUser()&&!canOperate())throw new Error('当前账号未开通物联网访问权限，请联系平台运营')
  if(currentWorkspace()==='ops'&&!canOperate())uni.setStorageSync('iot_workspace','user')
  if(!canUseUser()&&canOperate())uni.setStorageSync('iot_workspace','ops')
 })().catch(e=>{identityReady=null;throw e})
 return identityReady
}
export async function switchWorkspace(mode:Workspace){
 identityReady=null
 await identitySessionReady()
 if(mode==='ops'?!canOperate():!canUseUser())throw new Error('当前账号没有该工作台权限')
 generation++;ready=null
 ;['iot_subject','iot_status','iot_plot','iot_group'].forEach(k=>uni.removeStorageSync(k))
 uni.setStorageSync('iot_workspace',mode)
 uni.$emit('iot:session-reset')
 uni.reLaunch({url:workspaceHome()})
}
export async function enterWorkspace(){await identitySessionReady();uni.reLaunch({url:workspaceHome()})}
export async function guardWorkspace(route:string){
 await identitySessionReady()
 if(route==='pages/account/index')return
 const ops=route.startsWith('pages/ops/')
 if(ops&&!canOperate()){uni.reLaunch({url:workspaceHome()});throw new Error('当前账号没有运营权限')}
 if(ops&&currentWorkspace()!=='ops'||!ops&&currentWorkspace()==='ops')uni.reLaunch({url:workspaceHome()})
}
export async function sessionReady(){
 await identitySessionReady()
 if(!canUseUser()||currentWorkspace()!=='user')throw new Error('请切换到用户工作台查看经营主体业务')
 if(!ready)ready=(async()=>{
  const summary=await accountSummary()
  const active=summary.merchants.find((x:Row)=>String(x.merchantId)===String(summary.activeMerchantId))
  if(!active)throw new Error('当前账号暂无可用经营主体，请前往账号页选择主体')
  uni.setStorageSync('iot_subject',active)
 })().catch(e=>{ready=null;throw e})
 return ready
}
export async function opsRequest<T>(url:string,method:'GET'|'POST'|'PUT'|'DELETE'='GET',data?:Record<string,unknown>):Promise<T>{
 await identitySessionReady()
 if(!canOperate()||currentWorkspace()!=='ops')throw new Error('当前账号未进入获授权的运营工作台')
 return raw<T>(BASE,`/api/v1/iot/ops${url}`,method,data)
}
async function request<T>(url:string,method:'GET'|'POST'|'PUT'|'DELETE'='GET',data?:Record<string,unknown>):Promise<T>{
 await sessionReady()
 if(method!=='GET'&&!canWrite())throw new Error('当前账号没有物联网写入权限')
 return raw<T>(BASE,`/api/v1/iot/app${url}`,method,data)
}
export async function accountSummary(){
 const value=await raw<Row>(AUTH_BASE,'/api/v1/sso/account/summary')
 value.merchants=(value.merchants||[]).filter((x:Row)=>x.status!==0&&String(x.merchantName||'').trim())
 return value
}
export async function activateSubject(id:string){
 const result=await raw<Row>(AUTH_BASE,`/api/v1/sso/account/businesses/${encodeURIComponent(id)}/activate`,'POST',{})
 if(String(result.activeMerchantId)!==id)throw new Error('主体切换结果不一致，请重新加载')
 generation++;ready=null;['iot_subject','iot_status','iot_plot','iot_group'].forEach(k=>uni.removeStorageSync(k))
 uni.reLaunch({url:'/pages/index/index'})
}
export async function logoutIotSession(){await logoutMobile(`${AUTH_BASE}/api/v1/auth/logout`,String(uni.getStorageSync('token')||''),()=>{clearIotSession();uni.reLaunch({url:'/pages/login/index'})})}
export interface UnifiedLoginResult{accessToken?:string;user?:Row;expiresIn?:number;mfaRequired?:boolean;challengeToken?:string}
async function acceptLogin(result:UnifiedLoginResult){
 if(result?.mfaRequired){
  if(!result.challengeToken)throw new Error('二次验证凭证缺失，请重新登录')
  return result
 }
 if(!result?.accessToken||!result.user)throw new Error('登录结果缺少有效凭证，请重新登录')
 const check=await raw<{permissions:string[]}>(AUTH_BASE,'/api/v1/platform/permissions/mine','GET',undefined,result.accessToken)
 if(!granted(check.permissions||[],'iot:read')&&!granted(check.permissions||[],'iot:admin'))throw new Error('当前账号未开通物联网访问权限，请联系平台运营')
 clearIotSession();permissions=check.permissions;uni.setStorageSync('token',result.accessToken);uni.setStorageSync('user',result.user)
 uni.setStorageSync('iot_session_expires',Date.now()+Number(result.expiresIn||7200)*1000)
 uni.setStorageSync('iot_workspace',canUseUser()?'user':'ops')
 return result
}
export const PHONE_PATTERN=/^1[3-9]\d{9}$/
/** 账号密码登录（统一认证中心，与生产管理、交易撮合同一个端点）。 */
export async function loginWithUnifiedAccount(account:string,password:string,remember=true){
 const value=account.trim()
 const identity=PHONE_PATTERN.test(value)?{phone:value}:{username:value}
 return acceptLogin(await raw<UnifiedLoginResult>(AUTH_BASE,'/api/v1/sso/login-standalone','POST',{...identity,password,marketId:1,remember},''))
}
/** 手机验证码登录；开启二次验证的账号同样返回挑战凭证。 */
export async function loginWithSmsCode(phone:string,code:string,remember=true){
 return acceptLogin(await raw<UnifiedLoginResult>(AUTH_BASE,'/api/v1/sso/login-standalone-by-sms','POST',{phone:phone.trim(),code:code.trim(),marketId:1,remember},''))
}
/** 发送登录验证码（只允许 login 场景）。 */
export async function sendLoginSmsCode(phone:string){
 return raw<{sent?:boolean;devMode?:boolean;hint?:string}>(AUTH_BASE,'/api/v1/sso/sms/code','POST',{phone:phone.trim(),scene:'login'},'')
}
export async function completeUnifiedMfa(challengeToken:string,code:string,remember=true){
 return acceptLogin(await raw<UnifiedLoginResult>(AUTH_BASE,'/api/v1/sso/login-standalone-mfa','POST',{challengeToken,code:code.trim(),marketId:1,remember},''))
}
export const api={
  monitor:()=>request<Row>('/overview'),
  deviceTypes:()=>request<Row[]>('/device-types'),
  farms:()=>request<Row[]>('/farms'),
  groups:()=>request<Row[]>('/groups'),
  createDevice:(body:Row)=>request<Device>('/devices','POST',body),
  updateDevice:(id:number,body:Row)=>request<Device>(`/devices/${id}`,'PUT',body),
  sampling:(id:number)=>request<Row>(`/devices/${id}/sampling`),
  saveSampling:(id:number,body:Row)=>request<Row>(`/devices/${id}/sampling`,'PUT',body),
  commandReceipts:(id:number,page=1)=>request<Row[]>(`/devices/${id}/commands?page=${page}&size=20`),
  gateways:()=>request<Row[]>('/gateways'),
  gateway:(id:number)=>request<Row>(`/gateways/${id}`),
  createGateway:(body:Row)=>request<Row>('/gateways','POST',body),
  updateGateway:(id:number,body:Row)=>request<Row>(`/gateways/${id}`,'PUT',body),
  deleteGateway:(id:number)=>request<Row>(`/gateways/${id}`,'DELETE'),
  restartGateway:(id:number)=>request<Row>(`/gateways/${id}/restart`,'POST',{}),
  gatewayCommands:(id:number,page=1)=>request<Row[]>(`/gateways/${id}/commands?page=${page}&size=20`),
  gatewayOta:(id:number,page=1)=>request<Row[]>(`/gateways/${id}/ota?page=${page}&size=20`),
  plotMonitoring:(id:number)=>request<Row>(`/plots/${id}/monitoring`),
  alertRuleView:()=>request<Row>('/alert-rules/view'),
  alertRuleOptions:()=>request<Row>('/alert-rules/options'),
  riskReadings:()=>request<Row[]>('/alert-rules/risk-readings'),
  createAlertRule:(body:Row)=>request<Row>('/alert-rules/custom','POST',body),
  updateAlertRule:(id:number,body:Row)=>request<Row>(`/alert-rules/custom/${id}`,'PUT',body),
  deleteAlertRule:(id:number)=>request<Row>(`/alert-rules/custom/${id}`,'DELETE'),
  toggleAlertRule:(id:number)=>request<Row>(`/alert-rules/custom/${id}/toggle`,'POST',{}),
  evaluateAlertRule:(params:Row)=>request<Row>(`/alert-rules/evaluate${toQuery(params)}`),
  reports:()=>request<Row>('/reports'),
  workOrders:()=>request<Row[]>('/work-orders'),
  createWorkOrder:(body:Row)=>request<Row>('/work-orders','POST',body),
  firmware:()=>request<Row[]>('/firmware'),
  ota:()=>request<Row[]>('/ota'),
  overview:()=>request<Overview>('/mobile/overview'),
  devices:(params?:{keyword?:string;status?:string;groupId?:number;plotId?:number})=>request<Device[]>(`/devices${toQuery(params)}`),
  device:(id:number)=>request<Device>(`/devices/${id}`),
  control:(id:number,action:string,requestNo:string)=>request<Record<string,unknown>>(`/devices/${id}/control`,'POST',{action,requestNo}),
  alerts:()=>request<Alert[]>('/alerts'),
  handleAlert:(id:number,note:string,status:'handling'|'resolved')=>request<Alert>(`/alerts/${id}/handle`,'POST',{status,note}),
  plots:()=>request<Plot[]>('/plots'),
  scenes:()=>request<Scene[]>('/scenes'),
  createScene:(data:Record<string,unknown>)=>request<Scene>('/scenes','POST',data),
  updateScene:(id:number,data:Record<string,unknown>)=>request<Scene>(`/scenes/${id}`,'PUT',data),
  deleteScene:(id:number)=>request(`/scenes/${id}`,'DELETE'),
  activateScene:(id:number)=>request<Scene>(`/scenes/${id}/activate`,'POST',{}),
  rules:()=>request<AutomationRule[]>('/rules'),
  createRule:(data:Record<string,unknown>)=>request<AutomationRule>('/rules','POST',data),
  updateRule:(id:number,data:Record<string,unknown>)=>request<AutomationRule>(`/rules/${id}`,'PUT',data),
  deleteRule:(id:number)=>request(`/rules/${id}`,'DELETE'),
  toggleRule:(id:number)=>request<AutomationRule>(`/rules/${id}/toggle`,'POST',{}),
  executeRule:(id:number)=>request<AutomationRule>(`/rules/${id}/execute`,'POST',{}),
  readMessage:(id:number)=>request(`/messages/${id}/read`,'POST',{}),
  readAllMessages:()=>request('/messages/read-all','POST',{}),
  messages:()=>request<Array<{id:number;type:string;title:string;content:string;read:boolean;createdAt:string}>>('/messages'),
  sync:()=>request<MobileSync>('/mobile/sync','POST',{}),
}
export const STATUS:Record<string,{label:string;tone:string}>={
  online:{label:'在线',tone:'green'},offline:{label:'离线',tone:'gray'},alert:{label:'告警中',tone:'red'},
  completed:{label:'已完成',tone:'green'},processing:{label:'处理中',tone:'blue'},assigned:{label:'已派单',tone:'blue'},scheduled:{label:'待执行',tone:'orange'},stable:{label:'已发布',tone:'green'},draft:{label:'草稿',tone:'gray'},deprecated:{label:'已废弃',tone:'gray'},pending:{label:'待处理',tone:'orange'},handling:{label:'处理中',tone:'blue'},resolved:{label:'已处理',tone:'green'},
  critical:{label:'紧急',tone:'red'},major:{label:'重要',tone:'orange'},normal:{label:'一般',tone:'blue'},running:{label:'运行中',tone:'green'}
}
export function statusMeta(value:string){return STATUS[value]??{label:value,tone:'gray'}}

export async function uploadIotFirmware(filePath:string,expectedSha256='',onProgress?:(progress:number)=>void):Promise<Row>{
 await identitySessionReady()
 if(!canOperate()||currentWorkspace()!=='ops')throw new Error('当前账号没有固件管理权限')
 if(!hasIotSession()){loginRequired();throw new Error('登录已失效，请重新登录')}
 if(!BASE)throw new Error('请配置物联网服务地址')
 const version=generation, token=String(uni.getStorageSync('token')||'')
 return new Promise((resolve,reject)=>{
  const task=uni.uploadFile({url:`${BASE}/api/v1/iot/ops/firmware/packages/upload`,filePath,name:'file',timeout:300000,header:{Authorization:`Bearer ${token}`},formData:expectedSha256?{expectedSha256}:{},
   async success(res){try{
    if(version!==generation||token!==String(uni.getStorageSync('token')||''))throw new Error('账号或经营主体已改变，请重新上传')
    let body:Envelope<Row>;try{body=JSON.parse(res.data)}catch{throw new Error(`上传响应异常（HTTP ${res.statusCode}）`)}
    if(res.statusCode===401||body.code===401){loginRequired();throw new Error('登录已失效，请重新登录')}
    if(res.statusCode===403||body.code===403){const invalid=await tokenInvalid(token,version);if(version!==generation)throw new Error('账号已改变');if(invalid){loginRequired();throw new Error('登录已失效，请重新登录')}}
    if(res.statusCode>=400||![0,200].includes(body.code))throw new Error(body.message||'上传失败')
    resolve(body.data)
   }catch(e){reject(e)}},fail:()=>reject(new Error('上传失败或超时，请检查网络后重试'))})
  task.onProgressUpdate(e=>onProgress?.(e.progress))
 })
}
