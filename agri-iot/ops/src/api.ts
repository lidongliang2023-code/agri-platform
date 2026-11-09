export interface FirmwarePackage {
  id: number
  firmwareName: string
  versionName: string
  firmwareType: 'gateway' | 'sensor' | 'controller'
  targetModel: string
  packageUrl: string
  fileSizeBytes: number
  status: 'draft' | 'stable' | 'deprecated'
  sha256Text: string
  releaseNotes?: string
  changelogText?: string
  publishedAt?: string
  deprecatedAt?: string
  createdAt: string
}

import type { CommandReceipt } from '../../shared-ui/CommandReceipts'
import axios from 'axios'
import { attachUnifiedAuth } from '../../shared-ui/sso'
export interface Tenant{id:number;tenantName:string;tenantCode:string;planName:string;deviceLimit:number;deviceCount:number;region:string;status:string;expireDate:string}
export interface Device{id:number;tenantName:string;farmName:string;deviceCode:string;deviceName:string;typeName:string;protocol:string;onlineStatus:string;lastReport:string;rssi:number|null;battery:number;firmwareVersion:string}
export interface Gateway{id:number;farmName:string;gatewayCode:string;gatewayName:string;model:string;protocol:string;firmwareVersion:string;onlineCount:number;totalCount:number;onlineStatus:string;cpuRate:number;memoryRate:number;lastOnline:string}
export interface Alert{id:number;alertNo:string;tenantName:string;deviceName:string;type:string;level:string;title:string;content:string;status:string;handledBy?:string;handleNote?:string;createdAt:string}
export interface Product{id:number;productName:string;productKey:string;category:string;protocol:string;model:string;propertyCount:number;deviceCount:number;status:string}
export interface Protocol{id:number;protocolName:string;protocolType:string;endpoint:string;port:string;status:string;connections:number}
export interface AccessAudit{id:number;deviceCode:string;deviceName:string;tenantName:string;requestType:string;status:string;submittedAt:string;auditor?:string;note?:string}
export interface AlertRule{id:number;source?:'platform'|'tenant';ruleName:string;deviceType?:string|null;metricKey:string;metricName:string;operator:string;threshold:number;durationSeconds:number;level:string;enabled:boolean;remark?:string|null;createdBy?:string|null;updatedAt?:string|null;overridden?:boolean;overriddenByRuleName?:string|null;tenantId?:string;tenantName?:string|null}
export interface OtaTask{id:number;firmwareId:number;taskNo:string;tenantName?:string|null;firmwareVersion:string;targetCount:number;successCount:number;failedCount:number;targetScope:string;status:string;executeWindow:string;createdAt:string}
export interface WorkOrder{id:number;orderNo:string;source:string;tenantName?:string|null;deviceName:string;type:string;priority:string;status:string;technician:string;description?:string|null;createdAt:string}
export interface OpsOverview{metrics:{tenants:number;devices:number;online:number;offline:number;openAlerts:number;gateways:number;todayControls:number;throughput:number;pendingAccess:number;dataPoints:number};tenants:Tenant[];devices:Device[];alerts:Alert[];gateways:Gateway[];onlineTrend:number[];typeDistribution:Array<{name:string;value:number}>}
interface Envelope<T>{code:number;message:string;data:T}
const client=axios.create({baseURL:'/api/v1/iot/ops',timeout:15000})
attachUnifiedAuth(client,'iot-admin')
async function req<T>(call:Promise<{data:Envelope<T>}>):Promise<T>{try{const r=await call;if(![0,200].includes(r.data.code))throw new Error(r.data.message);return r.data.data}catch(e){if(axios.isAxiosError(e)){const m=(e.response?.data as {message?:string}|undefined)?.message;throw new Error(m||'物联网运营服务不可用')}throw e}}
export const opsApi={
  uploadFirmwarePackage:(file:File,expectedSha256?:string)=>{const data=new FormData();data.append('file',file);if(expectedSha256)data.append('expectedSha256',expectedSha256);return req<{packageUrl:string;sha256Text:string;fileSizeBytes:number;originalName:string}>(client.post('/firmware/packages/upload',data,{timeout:300000}))},
  listFirmwarePackages:(params?:{type?:string;model?:string;status?:string})=>req<FirmwarePackage[]>(client.get('/firmware/packages',{params})),
  getFirmwarePackage:(id:number)=>req<FirmwarePackage>(client.get(`/firmware/packages/${id}`)),
  registerFirmwarePackage:(payload:Record<string,unknown>)=>req<{id:number;message:string}>(client.post('/firmware/packages',payload)),
  publishFirmwarePackage:(id:number)=>req<{id:number}>(client.post(`/firmware/packages/${id}/publish`)),
  deprecateFirmwarePackage:(id:number,reason:string)=>req<{id:number}>(client.post(`/firmware/packages/${id}/deprecate`,{reason})),

  otaReceipts:(id:number,page:number)=>req<CommandReceipt[]>(client.get(`/gateways/${id}/ota`,{params:{page,size:20}})),
  gatewayCommandReceipts:(id:number,page:number)=>req<CommandReceipt[]>(client.get(`/gateways/${id}/commands`,{params:{page,size:20}})),
  commandReceipts:(id:number,page:number)=>req<CommandReceipt[]>(client.get(`/devices/${id}/commands`,{params:{page,size:20}})),
  handleWorkOrder:(id:number,status:string,note:string)=>req<WorkOrder>(client.post(`/work-orders/${id}/handle`,{status,note})),
  overview:()=>req<OpsOverview>(client.get('/overview')),
  tenants:()=>req<Tenant[]>(client.get('/tenants')),
  updateQuota:(id:number,deviceLimit:number)=>req<Tenant>(client.post(`/tenants/${id}/quota`,{deviceLimit})),
  devices:(params?:{keyword?:string;status?:string})=>req<Device[]>(client.get('/devices',{params})),
  gateways:()=>req<Gateway[]>(client.get('/gateways')),
  restartGateway:(id:number)=>req<Record<string,unknown>>(client.post(`/gateways/${id}/restart`,{})),
  alerts:()=>req<Alert[]>(client.get('/alerts')),
  handleAlert:(id:number,note:string,status:string)=>req<Alert>(client.post(`/alerts/${id}/handle`,{status,note})),
  products:()=>req<Product[]>(client.get('/products')),
  protocols:()=>req<Protocol[]>(client.get('/protocols')),
  accessAudits:()=>req<AccessAudit[]>(client.get('/access-audits')),
  alertRules:()=>req<AlertRule[]>(client.get('/alert-rules')),
  toggleAlertRule:(id:number)=>req<AlertRule>(client.post(`/alert-rules/${id}/toggle`,{})),
  tenantAlertRules:()=>req<AlertRule[]>(client.get('/alert-rules/tenant')),
  reviewAccess:(id:number,status:string,note:string)=>req<AccessAudit>(client.post(`/access-audits/${id}/review`,{status,note})),
  ota:()=>req<OtaTask[]>(client.get('/ota')),
  executeOta:(id:number,gatewayIds:number[],firmwareUrl:string)=>req<OtaTask>(client.post(`/ota/${id}/execute`,{gatewayIds,firmwareUrl})),
  workOrders:()=>req<WorkOrder[]>(client.get('/work-orders')),
  logs:()=>req<Array<{id:number;operator:string;action:string;target:string;detail:string;ip?:string|null;createdAt:string}>>(client.get('/logs')),
  reports:()=>req<{summary:{tenants:number;devices:number;online:number;alerts:number;openAlerts:number;workOrders:number;openWorkOrders:number;controls:number;dataPoints:number};tenantRank:Tenant[];protocols:Protocol[];gateways:Gateway[];alerts:Alert[]}>(client.get('/reports')),
}
export const STATUS:Record<string,{label:string;tone:string}>={
  online:{label:'在线',tone:'green'},offline:{label:'离线',tone:'gray'},alert:{label:'告警中',tone:'red'},active:{label:'正常',tone:'green'},trial:{label:'试用',tone:'orange'},
  pending:{label:'待处理',tone:'orange'},resolved:{label:'已恢复',tone:'green'},critical:{label:'紧急',tone:'red'},major:{label:'重要',tone:'orange'},normal:{label:'一般',tone:'blue'},
  approved:{label:'已通过',tone:'green'},rejected:{label:'已驳回',tone:'red'},published:{label:'已发布',tone:'green'},running:{label:'运行中',tone:'green'},scheduled:{label:'待执行',tone:'orange'},
  completed:{label:'已完成',tone:'gray'},assigned:{label:'已派单',tone:'blue'},processing:{label:'处理中',tone:'orange'},high:{label:'高',tone:'red'},
}
