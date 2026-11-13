import { http } from '@/utils/request'
import type { PageResult } from '@/types'
import type { AdminInspectionRow, QualityLab } from './trace'
export interface QualityRecord { unrevokedCodeCount?:number;traceTotal?:number; sales?:{offers?:{offerNo:string;tradeStatus:string;availableQty?:string;unit?:string}[];subscriptions?:{id?:string;orderNo?:string;eventType?:string;writebackStatus?:string}[]}; inspection: AdminInspectionRow & {farmId?:string;tenantId?:string;remark?:string}; farmName?:string; batch?:{batchId:string;batchNo:string;status:number;remark?:string}; inventoryCount?:number; frozenInventoryCount?:number; traceCodes:{code:string;status:string}[] }
export interface QualityFilter {pageNum?:number;pageSize?:number;keyword?:string;result?:string;status?:string;labName?:string;farmId?:string;batchId?:string;tenantId?:string;startDate?:string;endDate?:string}
const base='/admin/quality/workbench'
export const qualityRecords=(params:QualityFilter)=>http.get<PageResult<QualityRecord>>(`${base}/inspections`,params)
export const qualityRecord=(id:string)=>http.get<QualityRecord>(`${base}/inspections/${id}`)
export const controlQualityBatch=(inspectionId:string,reason:string)=>http.post<QualityRecord>(`${base}/recalls`,{inspectionId,reason})
export interface LabForm {labName:string;labCode?:string;labLevel?:1|2|3;contactName?:string;contactPhone?:string;region?:string;certNo?:string;remark?:string;status?:number}
export const saveQualityLab=(id:string|undefined,data:LabForm)=>id?http.put<QualityLab>(`${base}/labs/${id}`,data):http.post<QualityLab>(`${base}/labs`,data)
