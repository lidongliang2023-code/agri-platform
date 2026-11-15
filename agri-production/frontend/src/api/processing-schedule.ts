import { http } from '@/utils/request'
export const SCHEDULE_OPERATIONS = [
  ['SPREADING', '摊青'], ['FIXATION', '杀青'], ['ROLLING', '揉捻'], ['DRYING', '烘干'], ['SORTING', '分选清洗'], ['GRADING', '分级'], ['PACKAGING', '分装'], ['PRECOOL', '预冷'], ['CUTING', '净切'],
].map(([value, label]) => ({ value, label }))
export type ScheduleData = Record<string, any>
const BASE = '/processing-schedules'
export const getScheduleConfig = () => http.get<ScheduleData>(`${BASE}/config`)
export const saveScheduleConfig = (v: ScheduleData) => http.put<ScheduleData>(`${BASE}/config`, v)
export const getScheduleSources = () => http.get<{ orders: ScheduleData[]; batches: ScheduleData[] }>(`${BASE}/sources`)
export const listSchedules = (pageNum = 1) => http.get<{ list: ScheduleData[]; total: number }>(BASE, { pageNum, pageSize: 20 })
export const getSchedule = (id: string) => http.get<ScheduleData>(`${BASE}/${encodeURIComponent(id)}`)
export const solveSchedule = (v: ScheduleData) => http.post<ScheduleData>(`${BASE}/solve`, v)
export const scheduleAction = (id: string, action: string, v: ScheduleData = {}) => http.post<ScheduleData>(`${BASE}/${encodeURIComponent(id)}/${action}`, v)
