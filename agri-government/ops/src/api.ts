import axios from 'axios'
import { attachUnifiedAuth } from '../../frontend/src/sso'

export interface Subject { id:number;subjectName:string;creditCode:string;subjectType:string;legalPerson:string;address:string;contactPhone?:string;region:string;industry:string;creditScore:number;creditLevel:string;riskLevel:string;supervisionStatus:string;annualReportStatus:string;merchantId?:string;updatedAt:string }
export interface Rectification { id:number;rectificationNo:string;subjectId?:number;issueText:string;requirement:string;deadline:string;status:string;progress:number;feedbackText:string;submittedAt:string }
export interface CheckItem { id:number;itemName:string;note:string;sortOrder:number;status:string }
export interface IdentityCard { operatorName?:string;subjectId?:number;subjectName?:string;inspectorId?:number;inspectorName?:string;roles?:Record<string,boolean>;subjectError?:string;merchantError?:string }
export interface Warning { id:number;warningNo:string;type:string;level:string;subjectName:string;location:string;title:string;content:string;aiConfidence:number;status:string;assignedTo:string;handleNote:string;createdAt:string }
export interface Task { id:number;taskNo:string;taskType:string;subjectName:string;address:string;distanceKm:number;deadline:string;priority:string;status:string;checklistDone:number;checklistTotal:number;assignedTo:string;result:string;createdAt:string }
export interface Case { id:number;caseNo:string;subjectName:string;caseType:string;summary:string;legalBasis:string;status:string;progress:number;penaltyAmount:number;handler:string;filedAt:string;closedAt:string }
export interface Repair { id:number;repairNo:string;subjectName:string;repairType:string;reason:string;status:string;progress:number;reviewNote:string;submittedAt:string }
export interface Subsidy { id:number;applicationNo:string;subjectName:string;projectName:string;amount:number;status:string;progress:number;remoteCheckStatus:string;submittedAt:string }
export interface Complaint { id:number;complaintNo:string;type:string;title:string;content:string;anonymous:boolean;reporterName:string;targetName:string;status:string;priority:string;assignedOrg:string;handleNote:string;createdAt:string }
export interface Sampling { id:number;samplingNo:string;productName:string;subjectName:string;region:string;sampleDate:string;testItems:string;result:string;disposition:string }
export interface DataShare { id:number;resourceName:string;owner:string;receiver:string;shareType:string;sensitiveLevel:string;status:string;recordCount:number;updatedAt:string }
export interface Overview {
  metrics:{subjects:number;pendingWarnings:number;openCases:number;pendingTasks:number;samplingPassRate:number;aiAssistCount:number;tradeAmount:number}
  trend:Array<{date:string;subjects:number;warnings:number;inspections:number;samplingRate:number;cases:number;tradeAmount:number}>
  todos:Array<{route:string;title:string;count:number;description:string}>
  warnings:Warning[];aiBrief:string[]
}
interface Envelope<T>{code:number;message:string;data:T}
const client=axios.create({baseURL:'/api/v1/government',timeout:15000})
attachUnifiedAuth(client,'gov-ops')
async function req<T>(call:Promise<{data:Envelope<T>}>):Promise<T>{
  try{const r=await call;if(![0,200].includes(r.data.code))throw new Error(r.data.message);return r.data.data}
  catch(e){if(axios.isAxiosError(e)){const m=(e.response?.data as {message?:string}|undefined)?.message;throw new Error(m||'政府监管服务不可用')}throw e}
}
export const opsApi={
  overview:()=>req<Overview>(client.get('/ops/overview')),
  subjects:(keyword?:string,riskLevel?:string)=>req<Subject[]>(client.get('/ops/subjects',{params:{keyword,riskLevel}})),
  warnings:(status?:string)=>req<Warning[]>(client.get('/ops/warnings',{params:{status}})),
  handleWarning:(id:number,body:Record<string,unknown>)=>req<Warning>(client.post(`/ops/warnings/${id}/handle`,body)),
  tasks:(status?:string)=>req<Task[]>(client.get('/ops/tasks',{params:{status}})),
  createTask:(body:Record<string,unknown>)=>req<Task>(client.post('/ops/tasks',body)),
  cases:()=>req<Case[]>(client.get('/ops/cases')),
  advanceCase:(id:number,body:Record<string,unknown>)=>req<Case>(client.post(`/ops/cases/${id}/advance`,body)),
  repairs:()=>req<Repair[]>(client.get('/ops/repairs')),
  reviewRepair:(id:number,body:Record<string,unknown>)=>req<Repair>(client.post(`/ops/repairs/${id}/review`,body)),
  subsidies:()=>req<Subsidy[]>(client.get('/ops/subsidies')),
  reviewSubsidy:(id:number,body:Record<string,unknown>)=>req<Subsidy>(client.post(`/ops/subsidies/${id}/review`,body)),
  complaints:()=>req<Complaint[]>(client.get('/ops/complaints')),
  handleComplaint:(id:number,body:Record<string,unknown>)=>req<Complaint>(client.post(`/ops/complaints/${id}/handle`,body)),
  samplings:()=>req<Sampling[]>(client.get('/ops/samplings')),
  createSampling:(body:Record<string,unknown>)=>req<Sampling>(client.post('/ops/samplings',body)),
  dataShares:()=>req<DataShare[]>(client.get('/ops/data-shares')),
  reviewDataShare:(id:number,body:Record<string,unknown>)=>req<DataShare>(client.post(`/ops/data-shares/${id}/review`,body)),
  users:()=>req<Array<{id:number;name:string;role:string;organization:string;grid:string;status:string;certificateNo?:string;platformUserId?:string}>>(client.get('/ops/users')),
  /** 执法人员档案 ↔ 平台账号（移动执法端靠它认人；传空即解除） */
  bindUserPlatform:(id:number,platformUserId:string)=>req<Record<string,unknown>>(client.put(`/ops/users/${id}/platform-binding`,{platformUserId})),
  /** 监管档案 ↔ 平台经营主体（主体端能不能看到自己的档案取决于这条绑定） */
  bindSubjectMerchant:(id:number,merchantId:string)=>req<Subject>(client.put(`/ops/subjects/${id}/merchant-binding`,{merchantId})),
  rectifications:(status?:string)=>req<Rectification[]>(client.get('/ops/rectifications',{params:{status}})),
  reviewRectification:(id:number,body:Record<string,unknown>)=>req<Rectification>(client.post(`/ops/rectifications/${id}/review`,body)),
  checkItems:()=>req<CheckItem[]>(client.get('/ops/check-items')),
  createCheckItem:(body:Record<string,unknown>)=>req<CheckItem>(client.post('/ops/check-items',body)),
  updateCheckItem:(id:number,body:Record<string,unknown>)=>req<CheckItem>(client.put(`/ops/check-items/${id}`,body)),
  toggleCheckItem:(id:number,active:boolean)=>req<CheckItem>(client.post(`/ops/check-items/${id}/toggle`,null,{params:{active}})),
  identity:()=>req<IdentityCard>(client.get('/identity')),
  logs:()=>req<Array<{id:number;operator:string;role:string;action:string;target:string;detail:string;ip:string;createdAt:string}>>(client.get('/ops/logs')),
  statistics:()=>req<{trend:Overview['trend'];warningTypes:Array<{name:string;value:number}>;samplings:Sampling[];cases:Case[];subjects:Subject[]}>(client.get('/ops/statistics')),
}

export const STATUS:Record<string,{label:string;tone:string}>={
  pending:{label:'待处理',tone:'orange'},assigned:{label:'已分派',tone:'blue'},processing:{label:'处理中',tone:'orange'},closed:{label:'已办结',tone:'gray'},
  in_progress:{label:'进行中',tone:'green'},completed:{label:'已完成',tone:'gray'},filing:{label:'立案',tone:'blue'},investigating:{label:'调查中',tone:'orange'},
  evidence:{label:'取证阶段',tone:'purple'},decision:{label:'拟处罚',tone:'orange'},submitted:{label:'已提交',tone:'blue'},reviewing:{label:'审核中',tone:'orange'},
  approved:{label:'已通过',tone:'green'},rejected:{label:'已驳回',tone:'red'},county_review:{label:'区县复核',tone:'orange'},paid:{label:'已兑付',tone:'green'},
  accepted:{label:'已受理',tone:'blue'},resolved:{label:'已解决',tone:'green'},high:{label:'高',tone:'red'},normal:{label:'普通',tone:'blue'},low:{label:'低',tone:'gray'},
}
