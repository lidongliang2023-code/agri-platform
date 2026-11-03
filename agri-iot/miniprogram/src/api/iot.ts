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
interface Envelope<T>{code:number;message:string;data:T}
const runtimePlatform=uni.getSystemInfoSync().uniPlatform
const configuredOrigin=import.meta.env.VITE_IOT_API_BASE||''
const BASE=configuredOrigin||(runtimePlatform==='web'?'':'http://localhost:8091')
const AUTH_BASE=import.meta.env.VITE_IOT_AUTH_BASE||configuredOrigin||(runtimePlatform==='web'?'':'http://localhost:8093')
function toQuery(params?:Record<string,unknown>):string{
  const entries=Object.entries(params??{}).filter(([,value])=>value!==undefined&&value!==null&&value!=='')
  return entries.length?`?${entries.map(([key,value])=>`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join('&')}`:''
}
function request<T>(url:string,method:'GET'|'POST'|'PUT'|'DELETE'='GET',data?:Record<string,unknown>):Promise<T>{
  return new Promise((resolve,reject)=>uni.request({url:`${BASE}/api/v1/iot/app${url}`,method,data,header:{'Content-Type':'application/json',...(uni.getStorageSync('token')?{Authorization:`Bearer ${uni.getStorageSync('token')}`}:{})},success(res:any){const body=res.data as Envelope<T>;if(res.statusCode===401){uni.removeStorageSync('token');uni.removeStorageSync('user');uni.reLaunch({url:'/pages/login/index'});return reject(new Error('登录已失效，请重新使用统一账号登录'))}if(res.statusCode>=400||![0,200].includes(body?.code))return reject(new Error(body?.message||'物联网请求失败'));resolve(body.data)},fail(err:any){reject(new Error(err?.errMsg||'网络异常'))}}))
}
export function hasIotSession(){return Boolean(uni.getStorageSync('token'))}
export function ensureIotSession(){if(hasIotSession())return true;uni.reLaunch({url:'/pages/login/index'});return false}
export function logoutIotSession(){uni.removeStorageSync('token');uni.removeStorageSync('user');uni.reLaunch({url:'/pages/login/index'})}
export function loginWithUnifiedAccount(username:string,password:string):Promise<{accessToken:string;user:{id:number;username:string;nickname?:string;roles?:string[]}}>{
  return new Promise((resolve,reject)=>uni.request({url:`${AUTH_BASE}/api/v1/sso/login-standalone`,method:'POST',data:{username,password,marketId:1,remember:true},header:{'Content-Type':'application/json'},success:async(res:any)=>{
    const body=res.data as {code:number;message?:string;data?:{accessToken:string;user:{id:number;username:string;nickname?:string;roles?:string[]}}}
    if(res.statusCode>=400||![0,200].includes(body?.code)||!body.data?.accessToken){reject(new Error(body?.message||'统一账号登录失败'));return}
    uni.request({url:`${AUTH_BASE}/api/v1/platform/permissions/mine`,method:'GET',header:{Authorization:`Bearer ${body.data.accessToken}`},success(permissionRes:any){
      const permissions=permissionRes.data?.data?.permissions as string[]|undefined
      const allowed=permissions?.some(code=>code==='*'||code==='iot:read'||code==='iot:*')
      if(permissionRes.statusCode>=400||!allowed){reject(new Error('当前统一账号未开通物联网访问权限，请联系平台运营'));return}
      uni.setStorageSync('token',body.data!.accessToken);uni.setStorageSync('user',body.data!.user);resolve(body.data!)
    },fail(err:any){reject(new Error(err?.errMsg||'权限校验失败'))}})
  },fail(err:any){reject(new Error(err?.errMsg||'统一认证中心连接失败'))}}))
}
export const api={
  overview:()=>request<Overview>('/mobile/overview'),
  devices:(params?:{status?:string})=>request<Device[]>(`/devices${toQuery(params)}`),
  device:(id:number)=>request<Device>(`/devices/${id}`),
  control:(id:number,action:string)=>request<Record<string,unknown>>(`/devices/${id}/control`,'POST',{action}),
  alerts:()=>request<Alert[]>('/alerts'),
  handleAlert:(id:number,note:string)=>request<Alert>(`/alerts/${id}/handle`,'POST',{status:'resolved',note}),
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
  messages:()=>request<Array<{id:number;type:string;title:string;content:string;read:boolean;createdAt:string}>>('/messages'),
  sync:()=>request<MobileSync>('/mobile/sync','POST',{}),
}
export const STATUS:Record<string,{label:string;tone:string}>={
  online:{label:'在线',tone:'green'},offline:{label:'离线',tone:'gray'},alert:{label:'告警中',tone:'red'},
  pending:{label:'待处理',tone:'orange'},handling:{label:'处理中',tone:'blue'},resolved:{label:'已恢复',tone:'green'},
  critical:{label:'紧急',tone:'red'},major:{label:'重要',tone:'orange'},normal:{label:'一般',tone:'blue'},running:{label:'运行中',tone:'green'}
}
export function statusMeta(value:string){return STATUS[value]??{label:value,tone:'gray'}}
