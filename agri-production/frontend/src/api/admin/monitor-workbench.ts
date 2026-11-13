import { http } from '@/utils/request'
import type { MonitorEnvVO } from '@/api/monitor'
export interface MonitorPage<T> { list:T[]; total:number; pageNum:number; pageSize:number; online?:number; offline?:number; fault?:number }
export interface MonitorTask { id:string; taskCode:string; taskName:string; taskType:string; farmId?:string; plotId?:string; executorName?:string; status:string; planStartTime?:string; planEndTime?:string; actualStartTime?:string; actualEndTime?:string; taskDesc?:string; resultDesc?:string; qualityRequirement?:string; inputMaterials?:string; urgeCount?:number; lastUrgeTime?:string; lastUrgeBy?:string; acceptStatus?:number }
export interface TaskRow { task:MonitorTask; farmName?:string; plotName?:string }
export interface UsageRow { usage:{usageId:string; farmId?:string; taskId?:string; inputName:string; dosage:number; unit?:string; method?:string; usedAt?:string; safetyIntervalDays?:number; remark?:string }; farmName?:string; plotName?:string }
export interface AlertRow { alert:{id:string; farmId?:string; title:string; content?:string; alertType?:string; level:string; status:string; createTime?:string; handleTime?:string; handleUser?:string; handleResult?:string }; farmName?:string; plotName?:string }
const base='/admin/monitor'
export const monitorTasks=(params:Record<string,unknown>)=>http.get<MonitorPage<TaskRow>>(`${base}/task-page`,params)
export const monitorInputs=(params:Record<string,unknown>)=>http.get<MonitorPage<UsageRow>>(`${base}/input-page`,params)
export const monitorAlerts=(params:Record<string,unknown>)=>http.get<MonitorPage<AlertRow>>(`${base}/alert-page`,params)
export const monitorDevices=(params:Record<string,unknown>)=>http.get<MonitorPage<import('@/types').IotDevice>>(`${base}/device-page`,params)
export const monitorEnvironment=(farmId:string,hours:number)=>http.get<MonitorEnvVO>(`${base}/environment`,{farmId,hours})
