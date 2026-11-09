import { getGovToken,handleGovUnauthorized } from './auth'

export interface Task{id:number;taskNo:string;taskType:string;subjectId?:number;subjectName:string;address:string;distanceKm:number;deadline:string;priority:string;status:string;checklistDone:number;checklistTotal:number;assignedTo:string;result:string;createdAt:string}
export interface Warning{id:number;warningNo:string;type:string;level:string;subjectName:string;location:string;title:string;content:string;aiConfidence:number;status:string;assignedTo:string;handleNote:string;createdAt:string}
export interface Case{id:number;caseNo:string;subjectId?:number;subjectName:string;caseType:string;summary:string;legalBasis:string;status:string;progress:number;penaltyAmount:number;handler:string;filedAt:string;closedAt:string}
export interface CheckItem{id:number;itemId?:number;itemName:string;note:string;done:boolean;checkedAt?:string}
export interface Evidence{id:number;evidenceNo:string;taskId?:number;taskNo:string;caseId?:number;subjectId?:number;evidenceType:string;description:string;evidenceHash:string;capturedBy:string;capturedById?:number;capturedAt:string;uploaded:boolean}
export interface Message{id:number;type:string;title:string;content:string;bizType?:string;bizNo?:string;read:boolean;createdAt:string}
export interface SubjectBrief{id:number;subjectName:string;creditCode:string;contactPhone?:string;address?:string;creditScore?:number;creditLevel?:string;riskLevel?:string}
interface Workbench{inspector:{name:string;team:string;certificateNo:string;grid:string;organization:string};stats:{todayTasks:number;pendingTasks:number;warnings:number;openCases:number};tasks:Task[];warnings:Warning[];recentCases:Case[];offlineRecords:number;evidenceCount:number}
interface Envelope<T>{code:number;message:string;data:T}
const runtimePlatform=uni.getSystemInfoSync().uniPlatform
const BASE=import.meta.env.VITE_GOVERNMENT_API_BASE||import.meta.env.VITE_SERVICE_API_BASE||(runtimePlatform==='web'?'':'http://localhost:8095')
function request<T>(url:string,method:'GET'|'POST'='GET',data?:Record<string,unknown>):Promise<T>{
  return new Promise((resolve,reject)=>uni.request({url:`${BASE}/api/v1/government${url}`,method,data,header:{'Content-Type':'application/json',...(getGovToken()?{Authorization:`Bearer ${getGovToken()}`}:{})},success(res:any){const body=res.data as Envelope<T>;if(res.statusCode===401){handleGovUnauthorized();return reject(new Error('登录已失效，请重新使用统一账号登录'))}if(res.statusCode>=400||![0,200].includes(body?.code))return reject(new Error(body?.message||'请求失败'));resolve(body.data)},fail(err:any){reject(new Error(err?.errMsg||'网络异常'))}}))
}
export interface AuthorizationStatus {serverDate:string;bound:boolean;personnelName:string;grants:Array<{id:string;organizationName:string;validFrom:string;validUntil:string;effective:boolean;reason:string;regions:Array<{code:string;name:string;includeChildren:boolean;duties:string[]}>}>}
export const api={
  authorizationStatus:()=>request<AuthorizationStatus>('/mobile/authorization-status'),
  workbench:()=>request<Workbench>('/mobile/workbench'),
  tasks:()=>request<Task[]>('/mobile/tasks'),
  task:(id:number)=>request<Task&{checklist:CheckItem[];subject?:SubjectBrief}>(`/mobile/tasks/${id}`),
  submitTask:(id:number,body:{checks:Array<{itemId?:number;itemName:string;done:boolean;note:string}>;result:string})=>request<Task&{checklist:CheckItem[]}>(`/mobile/tasks/${id}/submit`,'POST',body),
  /**
   * 扫码核验：主体走本域监管档案，溯源码走**生产域**真实存证。
   *
   * 事件里没有"地点"（生产域链路节点没有这一列），`chainHash` 在没有交易哈希时
   * 放的是"未上链/存证未生成交易哈希"这样的说明文字，页面要按 `attested/onChain/chainStatus` 判断显示。
   */
  scan:(code:string)=>request<{type:string;verified:boolean;subject?:SubjectBrief;traceCode?:string;productName?:string;batchNo?:string;subjectName?:string;status?:string;verifiable?:boolean;chainSummary?:string;nodeCount?:number;onChainCount?:number;attestedCount?:number;chainedNodes?:string;events?:Array<{seq?:number;stage?:string;stageName:string;eventTitle:string;evidence:string;eventTime:string;location?:string;chainHash:string;attested?:boolean;onChain?:boolean;chainStatus?:string;recordNo?:string;chainTime?:string;failedReason?:string;operatorName?:string}>}>('/mobile/scan','POST',{code}),
  cases:()=>request<Case[]>('/mobile/cases'),
  createCase:(body:Record<string,unknown>)=>request<Case>('/mobile/cases','POST',body),
  evidence:(body:Record<string,unknown>)=>request<Evidence>('/mobile/evidence','POST',body),
  evidenceList:()=>request<Evidence[]>('/mobile/evidence'),
  messages:()=>request<Message[]>('/mobile/messages'),
  readMessages:()=>request<{updated:number}>('/mobile/messages/read-all','POST'),
}
export const STATUS:Record<string,{label:string;tone:string}>={
  pending:{label:'待检查',tone:'orange'},in_progress:{label:'检查中',tone:'green'},completed:{label:'已完成',tone:'gray'},
  filing:{label:'立案',tone:'blue'},investigating:{label:'调查中',tone:'orange'},evidence:{label:'取证阶段',tone:'purple'},decision:{label:'拟处罚',tone:'orange'},closed:{label:'已办结',tone:'gray'},
  red:{label:'高风险',tone:'red'},orange:{label:'中风险',tone:'orange'},yellow:{label:'提示',tone:'blue'}
}
export function statusMeta(v:string){return STATUS[v]??{label:v,tone:'gray'}}
