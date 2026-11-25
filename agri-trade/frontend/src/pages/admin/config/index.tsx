import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Input, Select, Tag, Typography, message } from 'antd'
import { ListRowActions } from '@agri/shared'
import { getConfigs, updateConfig, type ConfigRow } from '@/api/config'
import { TradeFilters, TradeList } from '@/components/TradeList'

const GROUP_NAME: Record<string, string> = {
  settlement: '结算与分账',
  product: '货源',
  order: '订单'
}

/**
 * 系统配置（运营端）。
 */
export default function AdminConfig() {
  const [rows, setRows] = useState<ConfigRow[]>([])
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [groupFilter, setGroupFilter] = useState<string | undefined>()
  const [keyword, setKeyword] = useState('')
  const [draftGroup, setDraftGroup] = useState<string | undefined>()
  const [draftKeyword, setDraftKeyword] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getConfigs()
      if (res?.code === 200) {
        setRows(res.data ?? [])
        setDraft({})
      } else {
        message.error(res?.message ?? '加载配置失败')
      }
    } catch {
      message.error('加载配置失败（请检查后端是否在运行）')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filteredRows = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return rows.filter((row) =>
      (!groupFilter || row.configGroup === groupFilter)
      && (!kw || [row.configName, row.configKey, row.description].some((v) => String(v ?? '').toLowerCase().includes(kw))))
  }, [rows, groupFilter, keyword])

  const handleQuery = () => {
    setGroupFilter(draftGroup)
    setKeyword(draftKeyword)
  }

  const handleReset = () => {
    setDraftGroup(undefined)
    setDraftKeyword('')
    setGroupFilter(undefined)
    setKeyword('')
  }

  const save = async (row: ConfigRow) => {
    const value = draft[row.configKey] ?? row.configValue
    setSavingKey(row.configKey)
    try {
      const res = await updateConfig(row.configKey, value)
      if (res?.code === 200) {
        message.success('已保存')
        load()
      } else {
        message.error(res?.message ?? '保存失败')
      }
    } catch {
      message.error('保存失败')
    } finally {
      setSavingKey(null)
    }
  }

  const renderEditor = (row: ConfigRow) => {
    const disabled = row.editable === 0
    const value = draft[row.configKey] ?? row.configValue
    if (row.valueType === 'boolean') {
      return (
        <Select
          style={{ width: 140 }}
          disabled={disabled}
          value={value}
          onChange={(v) => setDraft((prev) => ({ ...prev, [row.configKey]: v }))}
          options={[{ value: 'true', label: '是' }, { value: 'false', label: '否' }]}
        />
      )
    }
    return (
      <Input
        style={{ width: 190 }}
        disabled={disabled}
        value={value}
        onChange={(e) => setDraft((prev) => ({ ...prev, [row.configKey]: e.target.value }))}
      />
    )
  }

  return (
    <div style={{ padding: 20 }}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="这里只列真的有代码在读的配置"
        description="改了会真的改变系统行为。取值优先级：这里的值 > 配置文件；删掉本行则回落到配置文件里的值。"
      />

      <TradeList<ConfigRow>
        listId="admin-config"
        rowKey="configKey"
        loading={loading}
        dataSource={filteredRows}
        onRefresh={load}
        toolbarLeft={<span style={{ fontWeight: 600 }}>系统配置（共 {filteredRows.length} 项）</span>}
        filterSlot={(
          <TradeFilters
            loading={loading}
            onQuery={handleQuery}
            onReset={handleReset}
            fields={[
              {
                label: '配置分组',
                control: (
                  <Select
                    allowClear
                    value={draftGroup}
                    placeholder="全部分组"
                    onChange={setDraftGroup}
                    options={Object.entries(GROUP_NAME).map(([value, label]) => ({ value, label }))}
                  />
                ),
              },
              {
                label: '关键字',
                control: (
                  <Input
                    allowClear
                    value={draftKeyword}
                    placeholder="配置项 / 配置键 / 说明"
                    onChange={(e) => setDraftKeyword(e.target.value)}
                    onPressEnter={handleQuery}
                  />
                ),
              },
            ]}
          />
        )}
        locale={{ emptyText: '暂无配置项' }}
        columns={[
          { title: '分组', dataIndex: 'configGroup', width: 120, render: (v: string) => GROUP_NAME[v] ?? v },
          { title: '配置项', dataIndex: 'configName', width: 180, ellipsis: true },
          {
            title: '配置键',
            dataIndex: 'configKey',
            width: 230,
            ellipsis: true,
            render: (v: string) => <Typography.Text code>{v}</Typography.Text>
          },
          { title: '类型', dataIndex: 'valueType', width: 90, render: (v: string) => <Tag>{v}</Tag> },
          { title: '当前值', dataIndex: 'configValue', width: 220, render: (_: string, row: ConfigRow) => renderEditor(row) },
          { title: '说明', dataIndex: 'description', width: 260, ellipsis: true },
          {
            title: '操作',
            key: 'action',
            width: 104,
            render: (_: unknown, row: ConfigRow) =>
              row.editable === 0 ? (
                <span style={{ color: '#a0aec0' }}>只读</span>
              ) : (
                <ListRowActions>
                  <Button
                    type="link"
                    size="small"
                    loading={savingKey === row.configKey}
                    onClick={() => save(row)}
                  >
                    保存
                  </Button>
                </ListRowActions>
              )
          }
        ]}
      />
      <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
        说明：配置项不是越多越好。新增一个键的前提是已经有代码在读它，否则运营改了没反应，会以为系统坏了。
      </Typography.Paragraph>
    </div>
  )
}
