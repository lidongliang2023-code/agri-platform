import { http } from '@/utils/request'
import type { Farm, PageResult } from '@/types'
export interface CheckRecord { checkId:string; farmId:string; farmName:string; checkType:string; checkItem:string; result:number; problem?:string; rectifyRequirement?:string; rectifyDeadline?:string; checkerName?:string; checkedAt?:string; rectifyStatus:string; rectifyRemark?:string; rectifiedAt?:string; tenantId:string }
export interface SupervisionDetail { farm:Farm; plotCount:number; checkCount:number; openCount:number; reviewCount:number }
const base='/admin/farm-supervision'
export const supervisionFarms=(args:Record<string,unknown>)=>http.get<PageResult<Farm>>(base,args)
export const supervisionDetail=(id:string)=>http.get<SupervisionDetail>(`${base}/farms/${id}`)
export const supervisionChecks=(args:Record<string,unknown>,user=false)=>http.get<PageResult<CheckRecord>>(user?'/farm-rectifications':`${base}/checks`,args)
export const readCheck=(id:string,user=false)=>http.get<CheckRecord>(user?`/farm-rectifications/${id}`:`${base}/checks/${id}`)
export const registerCheck=(data:Record<string,unknown>)=>http.post<CheckRecord>(`${base}/checks`,data)
export const submitRectification=(id:string,remark:string)=>http.post<CheckRecord>(`/farm-rectifications/${id}/submit`,{remark})
export const reviewRectification=(id:string,approved:boolean,remark:string)=>http.post<CheckRecord>(`${base}/checks/${id}/review`,{approved,remark})
export const checkStates:Record<string,string>={none:'无需整改',pending:'待整改',processing:'继续整改',reviewing:'待运营复核',rectified:'复核通过',overdue:'逾期未整改'}
