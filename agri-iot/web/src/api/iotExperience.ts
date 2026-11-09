import type { CommandReceipt } from '../../../shared-ui/CommandReceipts'
import axios from 'axios'
import { attachUnifiedAuth } from '../../../shared-ui/sso'

export interface IotFarm { id:number;farmName:string;manager:string;phone:string;address:string;area:number;deviceCount:number;onlineCount:number;alertCount:number;status:string }
export interface IotDevice { id:number;tenantId:number;farmId:number;plotId:number|null;gatewayId:number|null;groupId:number|null;deviceCode:string;deviceName:string;typeId:number;typeName:string;protocol:string;onlineStatus:string;status:string;lastReport:string;rssi:number|null;battery:number;firmwareVersion:string;latitude?:number|null;longitude?:number|null;controlCapable:boolean;config:string;telemetry?:Telemetry[];history?:Array<{time:string;temperature:number|null;humidity:number|null;soilMoisture:number|null}>;controls?:ControlLog[] }
export interface Telemetry { key:string;name:string;value:number;unit:string;recordedAt:string }
export interface ControlLog { id:number;deviceName:string;action:string;operator:string;result:string;createdAt:string }
export interface IotAlert { id:number;alertNo:string;deviceId:number;deviceName:string;type:string;level:string;title:string;content:string;triggerValue:string;thresholdValue:string;status:string;handledBy?:string;handleNote?:string;createdAt:string;handledAt?:string }
export interface IotPlot {
  id:number;plotCode:string;plotName:string;area:number;cropName:string;cropStage:string;
  deviceCount:number;onlineCount:number;deviceOnlineRate?:number;status:string;
  farmId?:number;farmCode?:string;farmName?:string;tenantId?:string;cropVariety?:string;
  plantingDate?:string;expectedHarvestDate?:string;productionStatus?:number;
  latitude?:number|null;longitude?:number|null;boundary?:string|null;
  source?:string;sourceService?:string;sourceUpdatedAt?:string
}
export interface IotGroup { id:number;name:string;icon:string;color:string;deviceCount:number;isDefault:boolean }
export interface IotGateway { id:number;farmId:number;farmName?:string;farmCode?:string;tenantId?:string;gatewayCode:string;gatewayName:string;model:string;protocol:string;firmwareVersion:string;ipAddress:string;onlineCount:number;totalCount:number;onlineStatus:string;cpuRate:number;memoryRate:number;lastOnline:string;source?:string }
export interface IotDeviceType { id:number;name:string;category:string;protocol:string;icon:string;manufacturer:string;model:string;properties:string[];status:string }
export interface IotProductionFarm { id:number;farmId:string;farmCode:string;farmName:string;tenantId:string;managerName?:string;managerPhone?:string;address?:string;totalArea:number;plotCount:number;status:number;source:string }
export interface IotScene { id:number;sceneCode:string;sceneName:string;icon:string;category:string;description:string;config:string;active:boolean;plotCount:number }
export interface IotRule {
  id:number;ruleCode:string;ruleName:string;trigger:string;action:string;enabled:boolean;
  lastTrigger:string;triggerCount:number;ruleType?:string;triggerMetric?:string;
  operator?:string;threshold?:string;durationSeconds?:number;schedule?:string;
  actionDeviceId?:number|null;actionDeviceName?:string;actionCommand?:string;
  actionValue?:string;cooldownSeconds?:number;config?:string;configUpdatedAt?:string
}
export interface AlertRule { id:number;ruleName:string;deviceType?:string|null;metricKey:string;metricName:string;operator:string;threshold:string;durationSeconds:number;level:string;enabled:boolean;tenantScope?:string;source?:'platform'|'tenant';remark?:string|null;sourceRuleId?:number|null;createdBy?:string|null;updatedAt?:string|null;overridden?:boolean;overriddenByRuleId?:number|null;overriddenByRuleName?:string|null }
export interface AlertRuleView{tenantId:string;tenantName?:string|null;platform:AlertRule[];tenant:AlertRule[];effective:AlertRule[];operatorOptions:string[];levelOptions:string[]}
export interface AlertMetricOption{key:string;name:string;unit:string;deviceTypes:string[]}
export interface AlertRuleOptions{metrics:AlertMetricOption[];deviceTypes:string[];operators:string[];levels:string[]}
export interface AlertJudgement{metricKey:string;metricName:string;value:number;level:string;levelName:string;breached:boolean;matchedRules:AlertRule[];note:string;evaluatedAt:string}
export interface RiskReading{deviceId:number;deviceName:string;deviceCode:string;typeName:string;metricKey:string;metricName:string;value:number;unit:string;recordedAt:string;operator:string;threshold:number;durationSeconds:number;sustained:boolean|null;level:string;ruleId:number;ruleName:string;ruleSource:'platform'|'tenant'}
export interface IotOverview {
  farm:IotFarm
  stats:{devices:number;online:number;offline:number;alerts:number;plots:number;gateways:number;todayControl:number;dataToday:number}
  alerts:IotAlert[];plots:IotPlot[];groups:IotGroup[];deviceTypes:Array<{name:string;icon:string;value:number}>
  environment:Array<{name:string;value:number;unit:string;key:string;change:number;status:string;level?:string}>
  series:Array<{time:string;temperature:number;humidity:number;soilMoisture:number}>
  activeScene:IotScene;recentControls:ControlLog[]
}
interface Envelope<T>{code:number;message:string;data:T}
const client=axios.create({baseURL:'/api/v1/iot/app',timeout:15000})
attachUnifiedAuth(client,'iot')
async function req<T>(call:Promise<{data:Envelope<T>}>):Promise<T>{
  try{const r=await call;if(![0,200].includes(r.data.code))throw new Error(r.data.message);return r.data.data}
  catch(e){if(axios.isAxiosError(e)){const m=(e.response?.data as {message?:string}|undefined)?.message;throw new Error(m||'物联网服务暂时不可用')}throw e}
}
export const iotApi={
  otaReceipts:(id:number,page:number)=>req<CommandReceipt[]>(client.get(`/gateways/${id}/ota`,{params:{page,size:20}})),
  gatewayCommandReceipts:(id:number,page:number)=>req<CommandReceipt[]>(client.get(`/gateways/${id}/commands`,{params:{page,size:20}})),
  commandReceipts:(id:number,page:number)=>req<CommandReceipt[]>(client.get(`/devices/${id}/commands`,{params:{page,size:20}})),
  overview:()=>req<IotOverview>(client.get('/overview')),
  devices:(params?:{keyword?:string;status?:string;groupId?:number;plotId?:number})=>req<IotDevice[]>(client.get('/devices',{params})),
  device:(id:number)=>req<IotDevice>(client.get(`/devices/${id}`)),
  deviceTypes:()=>req<IotDeviceType[]>(client.get('/device-types')),
  createDevice:(body:Record<string,unknown>)=>req<IotDevice>(client.post('/devices',body)),
  control:(id:number,action:string)=>req<Record<string,unknown>>(client.post(`/devices/${id}/control`,{action})),
  plots:()=>req<IotPlot[]>(client.get('/plots')),
  farms:()=>req<IotProductionFarm[]>(client.get('/farms')),
  groups:()=>req<IotGroup[]>(client.get('/groups')),
  gateways:()=>req<IotGateway[]>(client.get('/gateways')),
  gateway:(id:number)=>req<IotGateway&{devices:IotDevice[]}>(client.get(`/gateways/${id}`)),
  createGateway:(body:Record<string,unknown>)=>req<IotGateway>(client.post('/gateways',body)),
  updateGateway:(id:number,body:Record<string,unknown>)=>req<IotGateway>(client.put(`/gateways/${id}`,body)),
  deleteGateway:(id:number)=>req<Record<string,unknown>>(client.delete(`/gateways/${id}`)),
  restartGateway:(id:number)=>req<IotGateway>(client.post(`/gateways/${id}/restart`,{})),
  alerts:(status?:string)=>req<IotAlert[]>(client.get('/alerts',{params:{status}})),
  handleAlert:(id:number,note:string,status:string)=>req<IotAlert>(client.post(`/alerts/${id}/handle`,{status,note})),
  /** 阈值规则是平台预置的，用户端只读；主体自己的阈值走下面的 custom 系列。 */
  alertRules:()=>req<AlertRule[]>(client.get('/alert-rules')),
  alertRuleView:()=>req<AlertRuleView>(client.get('/alert-rules/view')),
  alertRuleOptions:()=>req<AlertRuleOptions>(client.get('/alert-rules/options')),
  createAlertRule:(body:Record<string,unknown>)=>req<AlertRule>(client.post('/alert-rules/custom',body)),
  updateAlertRule:(id:number,body:Record<string,unknown>)=>req<AlertRule>(client.put(`/alert-rules/custom/${id}`,body)),
  deleteAlertRule:(id:number)=>req<Record<string,unknown>>(client.delete(`/alert-rules/custom/${id}`)),
  toggleAlertRule:(id:number)=>req<AlertRule>(client.post(`/alert-rules/custom/${id}/toggle`,{})),
  evaluateAlertRule:(params:{metricKey:string;value:string;deviceType?:string})=>req<AlertJudgement>(client.get('/alert-rules/evaluate',{params})),
  riskReadings:()=>req<RiskReading[]>(client.get('/alert-rules/risk-readings')),
  scenes:()=>req<IotScene[]>(client.get('/scenes')),
  createScene:(body:Record<string,unknown>)=>req<IotScene>(client.post('/scenes',body)),
  updateScene:(id:number,body:Record<string,unknown>)=>req<IotScene>(client.put(`/scenes/${id}`,body)),
  deleteScene:(id:number)=>req<Record<string,unknown>>(client.delete(`/scenes/${id}`)),
  activateScene:(id:number)=>req<IotScene>(client.post(`/scenes/${id}/activate`,{})),
  rules:()=>req<IotRule[]>(client.get('/rules')),
  createRule:(body:Record<string,unknown>)=>req<IotRule>(client.post('/rules',body)),
  updateRule:(id:number,body:Record<string,unknown>)=>req<IotRule>(client.put(`/rules/${id}`,body)),
  deleteRule:(id:number)=>req<Record<string,unknown>>(client.delete(`/rules/${id}`)),
  toggleRule:(id:number)=>req<IotRule>(client.post(`/rules/${id}/toggle`,{})),
  executeRule:(id:number)=>req<IotRule>(client.post(`/rules/${id}/execute`,{})),
  reports:()=>req<{summary:{dataPoints:number;onlineRate:number;alerts:number;controls:number};daily:Array<{date:string;data:number;control:number}>;rank:Array<{name:string;type:string;readings:number}>}>(client.get('/reports')),
  workOrders:()=>req<Array<{id:number;orderNo:string;source:string;deviceName:string;type:string;priority:string;status:string;technician:string;description?:string|null;createdAt:string}>>(client.get('/work-orders')),
  createWorkOrder:(body:Record<string,unknown>)=>req(client.post('/work-orders',body)),
  firmware:()=>req<Array<{id:number;productName:string;version:string;fileSize:string;sha256:string;status:string;releaseAt:string}>>(client.get('/firmware')),
  ota:()=>req<Array<{id:number;taskNo:string;firmwareVersion:string;targetCount:number;successCount:number;failedCount:number;targetScope:string;status:string;executeWindow:string;createdAt:string}>>(client.get('/ota')),
  messages:()=>req<Array<{id:number;type:string;title:string;content:string;read:boolean;createdAt:string}>>(client.get('/messages')),
  readMessage: (id: number) => req<Record<string, unknown>>(client.post(`/messages/${id}/read`, {})),
  readAll:()=>req(client.post('/messages/read-all',{})),
}

export const STATUS:Record<string,{label:string;tone:string}>={
  online:{label:'在线',tone:'green'},offline:{label:'离线',tone:'gray'},alert:{label:'告警中',tone:'red'},disabled:{label:'已停用',tone:'gray'},
  pending:{label:'待处理',tone:'orange'},handling:{label:'处理中',tone:'blue'},resolved:{label:'已恢复',tone:'green'},
  critical:{label:'紧急',tone:'red'},major:{label:'重要',tone:'orange'},normal:{label:'一般',tone:'blue'},
  completed:{label:'已完成',tone:'gray'},assigned:{label:'已派单',tone:'blue'},processing:{label:'处理中',tone:'orange'},
  running:{label:'执行中',tone:'blue'},scheduled:{label:'待执行',tone:'orange'},stable:{label:'稳定版',tone:'green'},beta:{label:'测试版',tone:'orange'},
}
