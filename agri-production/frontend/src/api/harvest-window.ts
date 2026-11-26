import { http } from '@/utils/request'

export type HarvestWindowStatus = 'DRAFT' | 'APPROVED' | 'PUBLISHED' | 'CLOSED'
export type DispatchStatus = 'PLANNED' | 'RUNNING' | 'DONE' | 'BLOCKED' | 'RESCHEDULED' | 'DEFERRED'
export type WorkerAttendanceStatus = 'PLANNED' | 'PRESENT' | 'ABSENT' | 'DONE'
export type MachineProgressStatus = 'PLANNED' | 'RUNNING' | 'DONE' | 'FAULT' | 'REPLACED'

export interface HarvestWindowPlot {
  plotId?: string
  plotName: string
  area: number
  maturity: number
  suggestedDate: string
  suggestedEndDate?: string
  category: 'IMMEDIATE' | 'WINDOW' | 'NEXT_CYCLE'
  reason: string
  sugarGain?: number
  gradeGain?: string
}

export interface HarvestWindowDispatchWorker {
  id: string
  workerId: string
  workerNo: string
  workerName: string
  sourceType: string
  skillType: string
  plannedHours: number
  actualHours: number
  attendanceStatus: WorkerAttendanceStatus
  actualArea: number
  note?: string
}

export interface HarvestWindowDispatchMachine {
  id: string
  machineType: 'HARVESTER' | 'TRUCK'
  machineNo: string
  machineName: string
  operatorWorkerId?: string
  operatorWorkerNo?: string
  operatorWorkerName?: string
  plannedHours: number
  actualHours: number
  plannedArea: number
  actualArea: number
  status: MachineProgressStatus
  note?: string
}

export interface HarvestWindowMachineFault {
  id: string
  machineId: string
  machineNo: string
  machineName: string
  severity: 'GENERAL' | 'CRITICAL'
  description: string
  status: 'OPEN' | 'RECOVERED' | 'REPLACED'
  reportedAt: string
  reportedBy: string
  resolvedAt?: string
  resolvedBy?: string
  resolution?: string
  replacementMachineId?: string
  replacementMachineNo?: string
}

export interface MachineFaultReportPayload {
  description: string
  severity: 'GENERAL' | 'CRITICAL'
  actualHours: number
  actualArea: number
}

export interface MachineFaultResolvePayload {
  action: 'RECOVER' | 'REPLACE'
  resolution: string
  replacementMachineNo?: string
  replacementMachineName?: string
}

export interface HarvestWindowDispatch {
  id?: string
  plotId?: string
  plotName: string
  dispatchDate: string
  area: number
  people: number
  assignedPeople: number
  unassignedPeople: number
  machines: number
  trucks: number
  laborSource: string
  teamName?: string
  weatherBlockReason?: string | null
  weatherSnapshotId?: string
  shiftStart?: string
  shiftEnd?: string
  plannedHours: number
  actualPeople: number
  actualHours: number
  status: DispatchStatus
  actualArea?: number
  note?: string
  workers?: HarvestWindowDispatchWorker[]
  machineDetails?: HarvestWindowDispatchMachine[]
  machineFaults?: HarvestWindowMachineFault[]
}

export interface HarvestWindowWeather {
  date: string
  label: string
  rainMm: number | null
  precipitationProbability?: number | null
  maxWindSpeedMs?: number | null
  minTemperature?: number | null
  weatherVerified?: boolean
  snapshotId?: string
  usable: boolean
  /** 整日天气与恢复期结果，不含默认班次小时校验；旧快照可能缺失。 */
  dailyUsable?: boolean
  note: string
}

export interface HarvestWeatherHour {
  time: string
  periodStart: string
  periodEnd: string
  temperature: number | null
  humidity: number | null
  rainMm: number | null
  precipitationProbability: number | null
  windSpeedMs: number | null
  windGustMs: number | null
  weatherCode: number | null
  usable: boolean
  weatherVerified: boolean
  note: string
  snapshotId?: string
}

export interface HarvestWeatherInfo {
  timezone?: string
  hourlyAvailable?: boolean
  hourlyStart?: string | null
  hourlyEnd?: string | null
  hours?: HarvestWeatherHour[]
  status: 'NOT_FOUND' | 'SUCCESS' | 'FAILED' | 'STALE' | 'LOCATION_CHANGED' | 'INVALID'
  provider: string
  snapshotId?: string
  fetchedAt?: string
  expiresAt?: string
  latitude?: number
  longitude?: number
  usable: boolean
  error?: string
  rules: string
  days: HarvestWindowWeather[]
}

export interface HarvestWindowPlan {
  id: string
  weatherInfo?: HarvestWeatherInfo
  planNo: string
  status: HarvestWindowStatus
  version: number
  windowStart: string
  windowEnd: string
  metrics: {
    totalArea: number
    immediateArea: number
    delayedArea: number
    nextCycleArea: number
    peoplePeak: number
    laborGap: number
    netBenefit: number
  }
  plots: HarvestWindowPlot[]
  dispatches: HarvestWindowDispatch[]
  reschedules?: Array<{ id: string; faultId?: string; baseVersion: number; newVersion: number; readyDate: string; fallbackMode?: string; fallbackStatus?: string; reason: string; confirmedBy: string; createdAt: string; snapshot: string }>
  events: Array<{ eventType: string; operator: string; createdAt: string; payload?: string }>
}

export interface HarvestWindowOverview {
  farmId: string
  source: 'LIVE' | 'SAMPLE'
  plots: HarvestWindowPlot[]
  weather: HarvestWindowWeather[]
  weatherInfo: HarvestWeatherInfo
  resources: {
    availablePeople: number
    dailyPeople: number
    machines: number
    trucks: number
    dailyWage: number
    villagePeople?: number
    neighboringPeople?: number
    laborSource?: string
  }
  latestPlan?: HarvestWindowPlan
}

export interface HarvestWindowSolvePayload {
  farmId: string
  windowStart: string
  windowEnd: string
  weather: HarvestWindowWeather[]
  resources: HarvestWindowOverview['resources']
  plots: HarvestWindowPlot[]
  note?: string
}

const BASE = '/harvest-window'

export const getHarvestWindowOverview = (farmId: string): Promise<HarvestWindowOverview> =>
  http.get(`${BASE}/overview`, { farmId })

export const solveHarvestWindow = (payload: HarvestWindowSolvePayload): Promise<HarvestWindowPlan> =>
  http.post(`${BASE}/plans/solve`, payload)

export const approveHarvestWindow = (id: string, reason: string): Promise<HarvestWindowPlan> =>
  http.post(`${BASE}/plans/${id}/approve`, { reason })

export const publishHarvestWindow = (id: string): Promise<HarvestWindowPlan> =>
  http.post(`${BASE}/plans/${id}/publish`)

export const updateHarvestWindowProgress = (
  planId: string,
  dispatchId: string,
  payload: { status: DispatchStatus; actualArea?: number; note?: string },
): Promise<HarvestWindowPlan> => http.post(`${BASE}/plans/${planId}/dispatches/${dispatchId}/progress`, payload)

export const updateHarvestWindowWorkerProgress = (
  planId: string,
  dispatchId: string,
  workerId: string,
  payload: { attendanceStatus: WorkerAttendanceStatus; actualHours: number; actualArea: number; note?: string },
): Promise<HarvestWindowPlan> => http.post(`${BASE}/plans/${planId}/dispatches/${dispatchId}/workers/${workerId}/progress`, payload)

export const updateHarvestWindowMachineProgress = (
  planId: string,
  dispatchId: string,
  machineId: string,
  payload: { status: MachineProgressStatus; actualHours: number; actualArea: number; note?: string },
): Promise<HarvestWindowPlan> => http.post(`${BASE}/plans/${planId}/dispatches/${dispatchId}/machines/${machineId}/progress`, payload)

export const reportHarvestWindowMachineFault = (
  planId: string, dispatchId: string, machineId: string, payload: MachineFaultReportPayload,
): Promise<HarvestWindowPlan> => http.post(`${BASE}/plans/${planId}/dispatches/${dispatchId}/machines/${machineId}/faults`, payload)

export const resolveHarvestWindowMachineFault = (
  planId: string, dispatchId: string, machineId: string, faultId: string, payload: MachineFaultResolvePayload,
): Promise<HarvestWindowPlan> => http.post(`${BASE}/plans/${planId}/dispatches/${dispatchId}/machines/${machineId}/faults/${faultId}/resolve`, payload)

export type FaultFallbackMode = 'EXTEND_WINDOW' | 'NEXT_CYCLE'

export interface FaultRescheduleRequest {
  benefitInputs?: Record<string, RescheduleBenefitInput>
  faultId: string
  readyDate: string
  fallbackMode: FaultFallbackMode
  fallbackDate?: string
}
export interface RescheduleComparisonSide {
  date?: string | null
  status?: string | null
  area?: number | null
  completedArea?: number | null
  remainingArea?: number | null
  people?: number | null
  assignedPeople?: number | null
  shiftStart?: string | null
  shiftEnd?: string | null
  plannedHours?: number | null
  workers: Array<{ workerId?: string | number | null; workerName?: string | null }>
  machines: Array<{ machineNo?: string | null; machineName?: string | null; machineType?: string | null; status?: string | null; operatorWorkerId?: string | number | null; operatorWorkerName?: string | null }>
  riskStatus: 'PASSED' | 'ATTENTION' | 'PENDING'
  riskReason: string
}
export interface RescheduleComparison {
  schemaVersion: 'RESCHEDULE_COMPARISON_V1'
  outcome: 'PROPOSED' | 'BLOCKED' | 'UNCHANGED' | 'DEFERRED'
  snapshotId?: string | number | null
  before: RescheduleComparisonSide
  after: RescheduleComparisonSide
  scope: string
}
export interface FaultReschedulePreview {
  benefitSummary?: RescheduleBenefitSummary
  faultId: string
  readyDate: string
  baseVersion: number
  fingerprint: string
  weatherInfo?: HarvestWeatherInfo
  canApply: boolean
  fallbackMode: FaultFallbackMode
  fallbackDate?: string
  outsideWindowUsed: boolean
  affectedArea: number
  blockers: string[]
  warnings: string[]
  changes: Array<{
    scheduleComparison?: RescheduleComparison
    continuationDispatchId?: string | null
    benefitComparison?: RescheduleBenefitComparison
    dispatchId: string
    plotName: string
    oldDate: string
    newDate?: string
    completedArea: number
    remainingArea: number
    people: number
    plannedHours: number
    delayDays?: number
    workers: Array<{ worker_name: string }>
    machines: Array<{ machine_no: string; machine_name: string; operator_worker_name: string }>
    constraints: string[]
    outsideWindow?: boolean
    fallbackStatus?: string
  }>
}
export const previewFaultReschedule = (planId: string, payload: FaultRescheduleRequest): Promise<FaultReschedulePreview> =>
  http.post(`${BASE}/plans/${planId}/fault-reschedule/preview`, payload)
export const applyFaultReschedule = (planId: string, payload: FaultRescheduleRequest & { fingerprint: string; reason: string }): Promise<HarvestWindowPlan> =>
  http.post(`${BASE}/plans/${planId}/fault-reschedule/apply`, payload)

export const refreshHarvestWeather = (farmId: string): Promise<HarvestWeatherInfo> =>
  http.post(`${BASE}/weather/refresh`, { farmId })
export const verifyHarvestWeather = (planId: string): Promise<HarvestWindowPlan> =>
  http.post(`${BASE}/plans/${planId}/weather/verify`)

export interface RescheduleBenefitInput {
  yieldKgPerMu?: number | null
  baselinePrice?: number | null
  candidatePrice?: number | null
  worstPrice?: number | null
  baselineLossPct?: number | null
  candidateLossPct?: number | null
  worstLossPct?: number | null
  baselineLaborCost?: number | null
  candidateLaborCost?: number | null
  baselineMachineCost?: number | null
  candidateMachineCost?: number | null
  baselineOtherCost?: number | null
  candidateOtherCost?: number | null
  adjustmentCost?: number | null
  sourceNote?: string
}
export interface BenefitAmounts {
  baselineRevenue: number; candidateRevenue: number; baselineCost: number; candidateCost: number
  baselineNet: number; candidateNet: number; netDelta: number; worstNet: number; worstDelta: number
  revenueDelta: number; costDelta: number
}
export interface RescheduleBenefitComparison extends Partial<BenefitAmounts> {
  status: 'CALCULATED' | 'MISSING_INPUT' | 'NOT_APPLICABLE'
  modelVersion: string
  assumptions: RescheduleBenefitInput
  missingFields: string[]
  message?: string
}
export interface RescheduleBenefitSummary {
  modelVersion: string; currency: string
  status: 'NOT_CALCULATED' | 'COMPLETE' | 'PARTIAL'
  eligibleCount: number; calculatedCount: number; missingCount: number
  totals: BenefitAmounts | null
  scope: string; rules: string
}
export interface RiskBatchPreviewRequest {
  dispatchIds: string[]
  benefitInputs?: Record<string, RescheduleBenefitInput>
  readyDate: string
  searchEnd: string
}
export interface RiskBatchPreviewRow {
  scheduleComparison?: RescheduleComparison
  continuationDispatchId?: string | null
  benefitComparison?: RescheduleBenefitComparison
  dispatchId: string
  plotName: string
  oldDate: string
  shiftStart: string
  shiftEnd: string
  remainingArea: number
  people: number
  plannedHours: number
  newDate?: string | null
  delayDays?: number
  outsideWindow: boolean
  status: 'PROPOSED' | 'BLOCKED' | 'UNCHANGED'
  message?: string
  riskReason?: string
  blockers: string[]
  rejectedDates: Array<{ date: string; reason: string }>
  workers: Array<{ workerId: string; workerName: string }>
  machines: Array<{ machineNo: string; machineName: string; operatorWorkerId: string; operatorWorkerName: string }>
}
export interface RiskBatchPreview {
  benefitSummary?: RescheduleBenefitSummary
  planId: string
  baseVersion: number
  snapshotId?: string
  weatherExpiresAt?: string
  generatedAt: string
  readyDate: string
  searchEnd: string
  previewOnly: boolean
  fingerprint: string
  previewToken: string
  previewExpiresAt: string
  canApply: boolean
  canConfirm: boolean
  selectedCount: number
  proposedCount: number
  blockedCount: number
  unchangedCount: number
  affectedArea: number
  warnings: string[]
  rows: RiskBatchPreviewRow[]
}
export const previewRiskBatchReschedule = (planId: string, payload: RiskBatchPreviewRequest): Promise<RiskBatchPreview> =>
  http.post(`${BASE}/plans/${planId}/risk-reschedule/preview`, payload)

export interface RiskBatchApplyResult {
  benefitSummary?: RescheduleBenefitSummary
  batchId: string
  newVersion: number
  appliedCount: number
  unchangedCount: number
  confirmedBy: string
  confirmedAt: string
  status: 'PENDING_REPUBLISH'
  changes: Array<{ sourceDispatchId: string; continuationDispatchId: string; plotName: string; newDate: string; area: number }>
}
export const applyRiskBatchReschedule = (planId: string, payload: RiskBatchPreviewRequest & {
  previewToken: string; reason: string; confirmed: boolean; outsideWindowConfirmed: boolean
}): Promise<RiskBatchApplyResult> => http.post(`${BASE}/plans/${planId}/risk-reschedule/apply`, payload)
