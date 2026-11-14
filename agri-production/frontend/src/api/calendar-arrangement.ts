import { http } from '@/utils/request'
export interface CalendarDaySupply { date: string; people: number; machineSlots: number; rain: boolean; strongWind: boolean; weatherVerified: boolean; minTemperature?: number; greenhouseTemperature?: number; note?: string }
export interface CalendarOperation {
  key: string; planId?: number; stageId?: number; taskName: string; taskType: string; mandatory: boolean; priority: number; earliest: string; latest: string; people: number; machineSlots: number; memberId?: number; standardRef: string; requiredSkill?: string; skillEvidence?: string; greenhouse: boolean; weatherSensitive: boolean; minimumTemperature?: number; floweringStart?: string; floweringEnd?: string; harvestDate?: string; safetyIntervalDays?: number; registrationRef?: string
}
export interface CalendarArrangeInput { farmId: string; requestId: string; weekStart: string; source: string; weatherIssuedAt?: string; weatherSource?: string; days: CalendarDaySupply[]; operations: CalendarOperation[] }
export interface CalendarStageOption { planId: number; stageId: number; planName: string; plotName: string; cropName: string; variety?: string; stageName: string; earliest?: string; latest?: string; source?: string; taskType?: string }
export interface CalendarWeatherDay { date: string; rain: boolean; strongWind: boolean; weatherVerified: boolean; minTemperature?: number; precipitationProbability?: number; precipitationMillimeters?: number; maxWindSpeedMs?: number; weatherCode?: number; note?: string }
export interface CalendarWeather { status: 'SUCCESS' | 'FAILED' | 'NOT_FOUND'; provider?: string; sourceUrl?: string; issuedAt?: string; weekStart: string; latitude?: number; longitude?: number; days: CalendarWeatherDay[]; error?: string }
export interface CalendarContext { stages: CalendarStageOption[]; members: { id: number; memberName: string; memberType: string; roleCode: string }[]; notice: string }
export interface CalendarScheduleItem { key: string; taskName: string; planId: number; stageId: number; plotName?: string; cropName?: string; variety?: string; stageName?: string; date?: string; status: 'SCHEDULED' | 'BLOCKED'; mandatory: boolean; priority: number; people: number; machineSlots: number; memberId: number; reasons: string[]; windowWarning: boolean; crossMonth: boolean; standardRef: string }
export interface CalendarArrangementSummary { id: string; weekStart: string; status: string; revision: number; createdAt: string }
export interface CalendarArrangement extends CalendarArrangementSummary { input: CalendarArrangeInput; items: CalendarScheduleItem[]; approvedBy?: string; crossMonthBy?: string; acceptedCount: number; tasks: { itemKey: string; taskId: number; taskName: string; scheduledDate: string; status?: string; acceptStatus?: number; deleted?: number; actualScheduledStart?: string; actualScheduledEnd?: string }[]; ai?: { status: string; message?: string; result?: Record<string, unknown>; traceId?: string }; events: { type: string; payload: string; operator: string; createdAt: string }[] }
export interface CalendarIntervention { id: string; plotId: number; weekStart: string; state: string; taskIds: string; note?: string; resolvedBy?: string }
const BASE = '/calendar-arrangements'
export const calendarContext = (farmId: string): Promise<CalendarContext> => http.get(`${BASE}/context`, { farmId })
export const listArrangements = (farmId: string): Promise<CalendarArrangementSummary[]> => http.get(BASE, { farmId })
export const getArrangement = (id: string): Promise<CalendarArrangement> => http.get(`${BASE}/${id}`)
export const createArrangement = (input: CalendarArrangeInput): Promise<CalendarArrangement> => http.post(BASE, input)
export const reviseArrangement = (id: string, revision: number, reason: string, input: CalendarArrangeInput): Promise<CalendarArrangement> => http.put(`${BASE}/${id}`, { revision, reason, input })
export const actOnArrangement = (id: string, action: 'approve' | 'publish' | 'close' | 'explain', revision: number, reason: string, crossMonthConfirmed = false): Promise<CalendarArrangement> => http.post(`${BASE}/${id}/${action}`, { revision, reason, crossMonthConfirmed })
export const listCalendarInterventions = (farmId: string): Promise<CalendarIntervention[]> => http.get(`${BASE}/interventions`, { farmId })
export const resolveCalendarIntervention = (id: string, reason: string): Promise<boolean> => http.post(`${BASE}/interventions/${id}/resolve`, { reason })

export const rescheduleArrangement = (id: string, revision: number, reason: string, input: CalendarArrangeInput, crossMonthConfirmed: boolean): Promise<CalendarArrangement> => http.post(`${BASE}/${id}/reschedule`, { revision, reason, input, crossMonthConfirmed })

export const getCalendarWeather = (farmId: string, weekStart: string): Promise<CalendarWeather> => http.get(`${BASE}/weather`, { farmId, weekStart })
export const refreshCalendarWeather = (farmId: string, weekStart: string): Promise<CalendarWeather> => http.post(`${BASE}/weather/refresh`, { farmId, weekStart })
