import { describe, expect, it } from 'vitest'
import {
  TASK_FINAL_STATUSES,
  TASK_STATUS_COLOR_MAP,
  TASK_STATUS_COMPLETED,
  TASK_STATUS_DOING,
  TASK_STATUS_DONE,
  TASK_STATUS_EXECUTING,
  TASK_STATUS_LABEL_MAP,
  TASK_STATUS_OPTIONS,
  isTaskDone,
  isTaskExecuting,
  isTaskOverdue,
} from '../src/types/task'

/**
 * 任务状态词表的契约测试。
 *
 * <p>这批断言锁的是「迁移窗口」行为：后端数据切换完成前，`executing/doing` 与
 * `completed/done` 两套值同时存在于库里，前端判定与展示映射必须同时认新值和旧值，
 * 否则列表里会出现「执行中的任务被判为未执行」这类静默错误。</p>
 */
describe('任务状态判定（兼容 PRD 新值与迁移前旧值）', () => {
  it('isTaskDone：completed 与 done 都算完成', () => {
    expect(isTaskDone(TASK_STATUS_COMPLETED)).toBe(true)
    expect(isTaskDone(TASK_STATUS_DONE)).toBe(true)
  })

  it('isTaskExecuting：executing 与 doing 都算执行中', () => {
    expect(isTaskExecuting(TASK_STATUS_EXECUTING)).toBe(true)
    expect(isTaskExecuting(TASK_STATUS_DOING)).toBe(true)
  })

  it('完成与执行中互不误判', () => {
    expect(isTaskDone(TASK_STATUS_EXECUTING)).toBe(false)
    expect(isTaskExecuting(TASK_STATUS_COMPLETED)).toBe(false)
    expect(isTaskExecuting(TASK_STATUS_DONE)).toBe(false)
    expect(isTaskDone(TASK_STATUS_DOING)).toBe(false)
  })

  it('未知值 / 空值 / 非字符串一律判否且不抛异常', () => {
    const weird = [undefined, null, '', 'unknown', 0, 1, {}, [], 'DONE', 'Done', 'COMPLETED']
    for (const v of weird) {
      expect(isTaskDone(v)).toBe(false)
      expect(isTaskExecuting(v)).toBe(false)
    }
  })

  it('终结态集合：含全部完成/取消/过期/驳回词，不含执行中', () => {
    expect([...TASK_FINAL_STATUSES]).toEqual([
      'completed',
      'done',
      'cancelled',
      'expired',
      'rejected',
    ])
    expect(TASK_FINAL_STATUSES).not.toContain(TASK_STATUS_EXECUTING)
  })
})

describe('isTaskOverdue（派生口径，非后端状态字段）', () => {
  const now = new Date('2026-10-11T12:00:00+08:00')

  it('计划结束时间早于当前时间 → 逾期', () => {
    expect(isTaskOverdue({ planEndDate: '2026-10-10T00:00:00+08:00', status: 'executing' }, now)).toBe(true)
  })

  it('计划结束时间晚于当前时间 → 不逾期', () => {
    expect(isTaskOverdue({ planEndDate: '2026-10-12T00:00:00+08:00', status: 'executing' }, now)).toBe(false)
  })

  it('缺少计划结束时间 → 不逾期', () => {
    expect(isTaskOverdue({ planEndDate: null, status: 'executing' }, now)).toBe(false)
    expect(isTaskOverdue({ status: 'executing' }, now)).toBe(false)
  })

  it('日期无法解析 → 不逾期且不抛异常', () => {
    expect(isTaskOverdue({ planEndDate: 'not-a-date', status: 'executing' }, now)).toBe(false)
  })

  it('已终结状态即使超期也不算逾期', () => {
    for (const status of TASK_FINAL_STATUSES) {
      expect(isTaskOverdue({ planEndDate: '2026-01-01T00:00:00+08:00', status }, now)).toBe(false)
    }
  })
})

describe('任务状态下拉与展示映射', () => {
  it('旧词不下拉，只保留在映射里（避免同一状态两个选项）', () => {
    const values = TASK_STATUS_OPTIONS.map((o) => String(o.value))
    expect(values).not.toContain('doing')
    expect(values).not.toContain('done')
    expect(new Set(values).size).toBe(values.length)
    expect(TASK_STATUS_LABEL_MAP.doing).toBe('执行中')
    expect(TASK_STATUS_LABEL_MAP.done).toBe('已完成')
  })

  it('每个下拉选项都能取到文案与颜色', () => {
    for (const o of TASK_STATUS_OPTIONS) {
      const key = String(o.value)
      expect(TASK_STATUS_LABEL_MAP[key]).toBeTruthy()
      expect(TASK_STATUS_COLOR_MAP[key]).toBeTruthy()
    }
  })

  it('每个终结态都能取到文案与颜色（列表渲染不落空）', () => {
    for (const status of TASK_FINAL_STATUSES) {
      expect(TASK_STATUS_LABEL_MAP[status]).toBeTruthy()
      expect(TASK_STATUS_COLOR_MAP[status]).toBeTruthy()
    }
  })

  it('旧值与新值展示一致：doing↔executing、done↔completed 文案与颜色相同', () => {
    expect(TASK_STATUS_LABEL_MAP.doing).toBe(TASK_STATUS_LABEL_MAP.executing)
    expect(TASK_STATUS_LABEL_MAP.done).toBe(TASK_STATUS_LABEL_MAP.completed)
    expect(TASK_STATUS_COLOR_MAP.doing).toBe(TASK_STATUS_COLOR_MAP.executing)
    expect(TASK_STATUS_COLOR_MAP.done).toBe(TASK_STATUS_COLOR_MAP.completed)
  })
})
