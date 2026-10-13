import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Input, Select, Space, Table, Tag, Typography, message } from 'antd'
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons'
import { getConfigs, updateConfig, type ConfigRow } from '@/api/config'

const GROUP_NAME: Record<string, string> = {
  settlement: '结算与分账',
  product: '货源',
  order: '订单'
}

/**
 * 系统配置（运营端）。
 *
 * 这一页只放**真的有代码在读**的配置项。一个配置改了没反应，比没有这一页更糟 ——
 * 所以后端表里只有两个键，且两处消费方都已接上（结算费率、货源是否先送审）。
 * 取值优先级：库里的配置 > 配置文件；库里没有该行时用配置文件的值，
 * 这样换环境不会因为"库里少一行"而改变行为。
 */
export default function AdminConfig() {
  const [rows, setRows] = useState<ConfigRow[]>([])
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [savingKey, setSavingKey] = useState<string | null>(null)

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
        style={{ width: 200 }}
        disabled={disabled}
        value={value}
        onChange={(e) => setDraft((prev) => ({ ...prev, [row.configKey]: e.target.value }))}
      />
    )
  }

  return (
    <div style={{ padding: 20 }}>
      <Card
        title={`系统配置 ${rows.length} 项`}
        extra={<Button icon={<ReloadOutlined />} loading={loading} onClick={load}>刷新</Button>}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="这里只列真的有代码在读的配置"
          description="改了会真的改变系统行为。取值优先级：这里的值 > 配置文件；删掉本行则回落到配置文件里的值。"
        />
        <Table
          rowKey="configKey"
          loading={loading}
          dataSource={rows}
          pagination={false}
          locale={{ emptyText: '暂无配置项' }}
          columns={[
            { title: '分组', dataIndex: 'configGroup', width: 120,
              render: (v: string) => GROUP_NAME[v] ?? v },
            { title: '配置项', dataIndex: 'configName', width: 180 },
            { title: '配置键', dataIndex: 'configKey', width: 230,
              render: (v: string) => <Typography.Text code>{v}</Typography.Text> },
            { title: '类型', dataIndex: 'valueType', width: 90,
              render: (v: string) => <Tag>{v}</Tag> },
            { title: '当前值', dataIndex: 'configValue', width: 220, render: (_: string, row: ConfigRow) => renderEditor(row) },
            { title: '说明', dataIndex: 'description', ellipsis: true },
            {
              title: '操作',
              width: 100,
              fixed: 'right' as const,
              render: (_: unknown, row: ConfigRow) =>
                row.editable === 0 ? (
                  <span style={{ color: '#a0aec0' }}>只读</span>
                ) : (
                  <Space size={0}>
                    <Button
                      type="link"
                      icon={<SaveOutlined />}
                      loading={savingKey === row.configKey}
                      onClick={() => save(row)}
                    >
                      保存
                    </Button>
                  </Space>
                )
            }
          ]}
        />
        <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
          说明：配置项不是越多越好。新增一个键的前提是**已经有代码在读它** ——
          否则运营改了没反应，会以为系统坏了。
        </Typography.Paragraph>
      </Card>
    </div>
  )
}
