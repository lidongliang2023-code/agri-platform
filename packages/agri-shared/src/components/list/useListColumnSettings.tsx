import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Button, Checkbox, Popover, Space } from 'antd'
import type { TableColumnsType } from 'antd'
import { columnSettingsTrigger } from '../MemberListToolbar'
import { parseHiddenColumnKeys, resolveColumnKey, sanitizeHiddenColumnKeys } from './listColumnUtils'

export interface UseListColumnSettingsResult<T> {
  visibleColumns: TableColumnsType<T>
  hiddenKeys: string[]
  setHiddenKeys: (next: string[]) => void
  resetColumns: () => void
  columnSettings: ReactNode
}

export interface UseListColumnSettingsOptions {
  /** 点击「恢复默认」时的额外回调（例如同步重置自定义拖拽列宽）。 */
  onReset?: () => void
}

/**
 * 标准 Ant Design Table 的列显隐偏好管理与「列设置」弹层构建器。
 * 适用于无 ProTable 的子系统列表（如物联网、交易撮合、资讯、SSO、政务、社会化服务等）。
 */
export function useListColumnSettings<T>(
  storageKey: string | false,
  columns: TableColumnsType<T>,
  lockedKeys: string[] = ['actions', 'action', 'option'],
  options?: UseListColumnSettingsOptions,
): UseListColumnSettingsResult<T> {
  const [hiddenState, setHiddenState] = useState<{ key: string | false; values: string[] }>(() => {
    if (!storageKey) return { key: storageKey, values: [] }
    try {
      return {
        key: storageKey,
        values: sanitizeHiddenColumnKeys(parseHiddenColumnKeys(localStorage.getItem(storageKey)), lockedKeys),
      }
    } catch {
      return { key: storageKey, values: [] }
    }
  })

  const hiddenKeys = useMemo(() => {
    if (hiddenState.key === storageKey) return sanitizeHiddenColumnKeys(hiddenState.values, lockedKeys)
    if (!storageKey) return []
    try {
      return sanitizeHiddenColumnKeys(parseHiddenColumnKeys(localStorage.getItem(storageKey)), lockedKeys)
    } catch {
      return []
    }
  }, [hiddenState, storageKey, lockedKeys])

  const lockedSet = useMemo(() => new Set(lockedKeys), [lockedKeys])
  const canHide = (key: string) => !lockedSet.has(key)

  const setHiddenKeys = (next: string[]) => {
    const clean = sanitizeHiddenColumnKeys(next, lockedKeys)
    setHiddenState({ key: storageKey, values: clean })
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(clean))
      } catch {
        // 存储不可用时仅保留本次会话内切换结果
      }
    }
  }

  const resetColumns = () => {
    setHiddenKeys([])
    options?.onReset?.()
  }

  const visibleColumns = useMemo(
    () =>
      columns.filter((col, idx) => {
        const key = resolveColumnKey(col as { key?: unknown; dataIndex?: unknown }, idx)
        return !canHide(key) || !hiddenKeys.includes(key)
      }),
    [columns, hiddenKeys, lockedSet],
  )

  const columnSettings = (
    <Popover
      placement="bottomRight"
      trigger="click"
      title="显示列"
      content={
        <Space direction="vertical" size={6}>
          {columns.map((column, idx) => {
            const key = resolveColumnKey(column as { key?: unknown; dataIndex?: unknown }, idx)
            const titleText = typeof column.title === 'string' || typeof column.title === 'number'
              ? String(column.title)
              : key
            return (
              <Checkbox
                key={key}
                disabled={!canHide(key)}
                checked={!canHide(key) || !hiddenKeys.includes(key)}
                onChange={(event) =>
                  setHiddenKeys(
                    event.target.checked
                      ? hiddenKeys.filter((item) => item !== key)
                      : [...hiddenKeys, key],
                  )
                }
              >
                {titleText}
              </Checkbox>
            )
          })}
          <Button type="link" size="small" onClick={resetColumns}>
            恢复默认
          </Button>
        </Space>
      }
    >
      {columnSettingsTrigger()}
    </Popover>
  )

  return {
    visibleColumns,
    hiddenKeys,
    setHiddenKeys,
    resetColumns,
    columnSettings,
  }
}
