import { opsRequest, type Row } from './iot'
export interface OpsMenu { key:string; title:string; group:string; mark:string; path:string; titleKey:string; fields:Array<[string,string]> }
export const opsMenus:OpsMenu[]=[
 {key:'devices',title:'平台设备',group:'设备与接入',mark:'设',path:'/devices',titleKey:'deviceName',fields:[['deviceCode','设备编码'],['tenantName','所属主体'],['farmName','农场'],['typeName','类型'],['protocol','协议'],['lastReport','最近上报'],['firmwareVersion','固件版本']]},
 {key:'gateways',title:'网关运维',group:'设备与接入',mark:'网',path:'/gateways',titleKey:'gatewayName',fields:[['gatewayCode','网关编码'],['farmName','农场'],['model','型号'],['onlineCount','在线设备'],['totalCount','设备总数'],['firmwareVersion','固件版本'],['lastOnline','最近在线']]},
 {key:'products',title:'产品与协议',group:'设备与接入',mark:'产',path:'/products',titleKey:'productName',fields:[['productKey','产品标识'],['category','分类'],['model','型号'],['protocol','协议'],['propertyCount','属性数量'],['deviceCount','设备数量']]},
 {key:'access',title:'接入审核',group:'设备与接入',mark:'审',path:'/access-audits',titleKey:'deviceName',fields:[['deviceCode','设备编码'],['tenantName','申请主体'],['requestType','申请类型'],['submittedAt','申请时间'],['auditor','审核人'],['note','审核意见']]},
 {key:'alerts',title:'告警运营',group:'告警治理',mark:'警',path:'/alerts',titleKey:'title',fields:[['alertNo','告警编号'],['tenantName','所属主体'],['deviceName','设备'],['level','等级'],['content','告警内容'],['handleNote','处理记录'],['handledBy','处理人'],['createdAt','发生时间']]},
 {key:'rules',title:'阈值规则治理',group:'告警治理',mark:'阈',path:'/alert-rules',titleKey:'ruleName',fields:[['tenantName','所属主体'],['deviceType','设备类型'],['metricName','指标'],['operator','比较方式'],['threshold','阈值'],['durationSeconds','持续秒数'],['level','等级'],['remark','说明']]},
 {key:'workorders',title:'运维工单',group:'运维与升级',mark:'维',path:'/work-orders',titleKey:'orderNo',fields:[['tenantName','所属主体'],['deviceName','设备'],['type','工单类型'],['priority','优先级'],['technician','处理人'],['description','处理记录'],['createdAt','创建时间']]},
 {key:'firmwares',title:'固件包',group:'运维与升级',mark:'固',path:'/firmware/packages',titleKey:'firmwareName',fields:[['versionName','版本'],['firmwareType','固件类型'],['targetModel','适配型号'],['fileSizeBytes','文件大小（字节）'],['sha256Text','SHA-256'],['releaseNotes','发布说明'],['publishedAt','发布时间']]},
 {key:'ota',title:'OTA 升级',group:'运维与升级',mark:'升',path:'/ota',titleKey:'taskNo',fields:[['tenantName','所属主体'],['firmwareVersion','目标版本'],['targetScope','目标范围'],['targetCount','目标数量'],['successCount','成功数量'],['failedCount','失败数量'],['executeWindow','执行窗口'],['createdAt','创建时间']]},
 {key:'tenants',title:'主体与配额',group:'主体与审计',mark:'主',path:'/tenants',titleKey:'tenantName',fields:[['tenantCode','主体编码'],['planName','套餐'],['deviceCount','已接入设备'],['deviceLimit','设备上限'],['region','区域'],['expireDate','到期时间']]},
 {key:'logs',title:'操作审计',group:'主体与审计',mark:'志',path:'/logs',titleKey:'action',fields:[['operator','操作人'],['target','操作对象'],['detail','操作内容'],['createdAt','操作时间']]},
 {key:'reports',title:'统计分析',group:'运营总览',mark:'析',path:'/reports',titleKey:'tenantName',fields:[['tenantCode','主体编码'],['deviceCount','设备数量'],['deviceLimit','设备上限'],['region','区域']]},
]
export const opsLabels:Record<string,string>={all:'全部',online:'在线',offline:'离线',alert:'告警中',pending:'待处理',handling:'处理中',resolved:'已解决',processing:'处理中',completed:'已完成',approved:'已通过',rejected:'已驳回',active:'正常',trial:'试用',critical:'紧急',major:'重要',normal:'一般',high:'高',low:'低',medium:'中',draft:'草稿',stable:'已发布',deprecated:'已废弃',running:'执行中',scheduled:'待执行',failed:'失败',partial:'部分成功',success:'成功',gateway:'网关',sensor:'传感器',controller:'控制器',enabled:'已启用',disabled:'已停用',published:'已发布',assigned:'已派单'}
export function opsLabel(value:unknown):string{if(value===null||value===undefined||value==='')return '—';return opsLabels[String(value)]||String(value)}
export const reportLabels:Record<string,string>={tenants:'经营主体',devices:'设备总数',online:'在线设备',offline:'离线设备',openAlerts:'未解决告警',gateways:'网关数量',todayControls:'今日控制次数',throughput:'今日遥测记录',pendingAccess:'待审核接入',dataPoints:'累计数据点',alerts:'累计告警',workOrders:'累计工单',openWorkOrders:'未完成工单',controls:'累计控制次数'}
export const opsTodoLabels: Record<string, string> = { alerts: '未解决', access: '待审核', workorders: '未完成' }
export function isOpsTodo(kind: string, row: Row): boolean {
  if (kind === 'alerts') return row.status !== 'resolved'
  if (kind === 'access') return row.status === 'pending'
  if (kind === 'workorders') return row.status !== 'completed'
  return false
}
export const opsApi={
 overview:()=>opsRequest<Row>('/overview'),
 list:(path:string)=>opsRequest<Row[]>(path),
 reports:()=>opsRequest<Row>('/reports'),
 action:(path:string,data:Row={})=>opsRequest<Row>(path,'POST',data),
 receipts:(kind:string,id:number,page:number)=>opsRequest<Row[]>(`/${kind==='device'?'devices':'gateways'}/${id}/${kind==='ota'?'ota':'commands'}?page=${page}&size=20`),
}
