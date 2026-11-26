import type { HarvestWindowDispatch } from '@/api/harvest-window'

export interface WeatherShift {
  key: string
  label: string
  start: number
  end: number
}

export function weatherDispatchKey(dispatch: HarvestWindowDispatch, index: number): string {
  return dispatch.id ?? `${dispatch.dispatchDate}-${index}`
}

/** 北京时间同日班次，与后端一致：不推断缺失时间，不接受跨夜班次。坐标单位为小时。 */
export function shiftHour(value: string | undefined): number | undefined {
  if (!value || !/^\d{2}:\d{2}(:\d{2})?$/.test(value)) return undefined
  const [hour, minute, second = 0] = value.split(':').map(Number)
  if (hour > 23 || minute > 59 || second > 59) return undefined
  return hour + minute / 60 + second / 3600
}

export function weatherShifts(date: string, dispatches: HarvestWindowDispatch[]) {
  const shifts: WeatherShift[] = []
  let invalidCount = 0
  dispatches.forEach((dispatch, index) => {
    if (dispatch.dispatchDate !== date || ['RESCHEDULED', 'DEFERRED'].includes(dispatch.status)) return
    const start = shiftHour(dispatch.shiftStart)
    const end = shiftHour(dispatch.shiftEnd)
    if (start === undefined || end === undefined || end <= start) {
      invalidCount += 1
      return
    }
    shifts.push({
      key: weatherDispatchKey(dispatch, index),
      label: `${dispatch.plotName} · ${dispatch.shiftStart}–${dispatch.shiftEnd}`,
      start,
      end,
    })
  })
  return { shifts, invalidCount }
}

/** 合并重叠范围，避免多个派单叠色被误读为风险等级。 */
export function mergeWeatherShifts(shifts: WeatherShift[]): Array<{ start: number; end: number }> {
  const merged: Array<{ start: number; end: number }> = []
  shifts.slice().sort((a, b) => a.start - b.start).forEach(({ start, end }) => {
    const previous = merged[merged.length - 1]
    if (previous && start <= previous.end) previous.end = Math.max(previous.end, end)
    else merged.push({ start, end })
  })
  return merged
}

/** 半开区间 [开始, 结束)，班次结束整点不纳入下一个小时。 */
export function overlappingWeatherShifts(periodStart: string, date: string, shifts: WeatherShift[]): WeatherShift[] {
  if (periodStart.slice(0, 10) !== date) return []
  const start = shiftHour(periodStart.slice(11))
  if (start === undefined) return []
  return shifts.filter((shift) => shift.start < start + 1 && shift.end > start)
}
