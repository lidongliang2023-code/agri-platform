/**
 * 页面名称：溯源总览
 * 路由路径：/admin/production/trace
 * 所属模块：质量追溯管理
 * 原型来源：P11 trace — 溯源总览
 * PRD 序号：PRD 6.2 #16
 *
 * ====================== 数据源实测结论（已连后端验证） ======================
 * 可用（真实数据）：
 * - GET /admin/trace/code-stats    {"generated":"0","active":"5","scanned":"0","revoked":"0"}
 * - GET /admin/quality/overview    {"passCount":"3","failCount":"1","passRate":"75","labCount":"2","frozenBatch":"1"}
 * 不可用（后端无对应端点）：
 * - 溯源码生成趋势（无趋势端点）
 * - 扫码区域分布 / 扫码热力区域 TOP10（无扫码区域汇总端点）
 * - 溯源覆盖率分类分析（无分类覆盖率端点）
 * - 区块链节点数（无节点数端点）
 * - 消费者扫码总次数（无扫码汇总端点）
 *
 * 处置：真实端点出真数；不可用部分**不再沿用原型 P11 硬编码口径**（2,450,000 / 87.6% / 48 节点等），
 * 统一显示「未接入」或空态，并在页顶横幅中明示。
 * =========================================================================
 */
import { useMemo } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Space,
  Statistic,
  Table,
  Typography,
  message,
} from 'antd'
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useQuery } from '@tanstack/react-query'
import { fetchAdminQualityOverview, fetchAdminTraceCodeStats } from '@/api/admin/trace'

const { Text } = Typography

/** 码段统计后端取值 → 前端展示口径映射 */
const CODE_STATUS_LABEL: Record<string, string> = {
  generated: '已生成',
  active: '已激活',
  scanned: '已扫码',
  revoked: '已作废',
}

/** 码段展示顺序（与后端返回 key 一致） */
const CODE_STATUS_ORDER: string[] = ['generated', 'active', 'scanned', 'revoked']

/** 未接入项说明（后端无对应端点，明确告诉用户不要当真数据看） */
const NOT_INTEGRATED_ITEMS: Array<{ name: string; reason: string }> = [
  { name: '消费者扫码总次数', reason: '后端未提供扫码汇总端点' },
  { name: '区块链节点数', reason: '后端未提供链节点统计端点' },
  { name: '溯源码生成趋势', reason: '后端未提供按日趋势端点' },
  { name: '扫码区域分布 / 热力区域 TOP10', reason: '后端未提供扫码区域汇总端点' },
  { name: '溯源覆盖率分类分析', reason: '后端未提供分类覆盖率端点' },
]

/**
 * 将后端返回的「可能是字符串的数字」安全转为 number。
 *
 * @param value 后端原始值
 * @returns 数字；无法解析时返回 undefined（保持「未接入」语义，绝不填 0）
 */
function toNumber(value: string | number | undefined): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined
  }
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

/**
 * 溯源总览
 *
 * 业务职责：展示平台级溯源业务大盘——码量（生成 / 激活 / 扫码 / 作废）与检测质量指标，
 * 并对后端暂未提供的维度显式标注「未接入」。
 *
 * @returns 页面内容
 */
export default function TraceOverview(): JSX.Element {
  /** 码段统计 */
  const statsQuery = useQuery({
    queryKey: ['admin', 'trace', 'code-stats'],
    queryFn: () => fetchAdminTraceCodeStats(),
    retry: false,
  })

  /** 质量总览 */
  const qualityQuery = useQuery({
    queryKey: ['admin', 'quality', 'overview'],
    queryFn: () => fetchAdminQualityOverview(),
    retry: false,
  })

  /** 码段真实统计（仅取后端返回的字段，缺失即 undefined） */
  const codeStats = useMemo(() => {
    const raw = statsQuery.data ?? {}
    return {
      generated: toNumber(raw.generated),
      active: toNumber(raw.active),
      scanned: toNumber(raw.scanned),
      revoked: toNumber(raw.revoked),
    }
  }, [statsQuery.data])

  /** 码总量（各状态之和；后端未返回任何状态时为 undefined） */
  const totalCodeCount = useMemo(() => {
    const parts = [codeStats.generated, codeStats.active, codeStats.scanned, codeStats.revoked]
    if (parts.every((item) => item === undefined)) {
      return undefined
    }
    return parts.reduce<number>((sum, item) => sum + (item ?? 0), 0)
  }, [codeStats])

  /** 码段分布（后端统计优先，缺失时为空数组 → 空态） */
  const statusDistribution = useMemo(() => {
    const raw = statsQuery.data ?? {}
    return CODE_STATUS_ORDER.filter((key) => toNumber(raw[key]) !== undefined).map((key) => ({
      name: CODE_STATUS_LABEL[key] ?? key,
      value: toNumber(raw[key]) ?? 0,
    }))
  }, [statsQuery.data])

  /** 导出看板快照（仅导出真实指标，不含任何原型示例数据） */
  const handleExport = (): void => {
    const rows: string[][] = [
      ['指标', '数值'],
      ['溯源码总量', totalCodeCount === undefined ? '未接入' : String(totalCodeCount)],
      ['已生成', codeStats.generated === undefined ? '未接入' : String(codeStats.generated)],
      ['已激活', codeStats.active === undefined ? '未接入' : String(codeStats.active)],
      ['已扫码', codeStats.scanned === undefined ? '未接入' : String(codeStats.scanned)],
      ['已作废', codeStats.revoked === undefined ? '未接入' : String(codeStats.revoked)],
      [
        '检测合格率(%)',
        toNumber(qualityQuery.data?.passRate) === undefined
          ? '未接入'
          : String(toNumber(qualityQuery.data?.passRate)),
      ],
      [
        '检测合格单数',
        toNumber(qualityQuery.data?.passCount) === undefined
          ? '未接入'
          : String(toNumber(qualityQuery.data?.passCount)),
      ],
      [
        '检测不合格单数',
        toNumber(qualityQuery.data?.failCount) === undefined
          ? '未接入'
          : String(toNumber(qualityQuery.data?.failCount)),
      ],
      [],
      ['以下维度后端暂未提供，不做填充'],
      ...NOT_INTEGRATED_ITEMS.map((item) => [item.name, item.reason]),
    ]
    const csv = rows.map((row) => row.join(',')).join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `溯源总览_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    message.success('看板快照已导出（仅含后端真实返回指标）')
  }

  /** 刷新全部指标 */
  const handleRefresh = (): void => {
    void statsQuery.refetch()
    void qualityQuery.refetch()
    message.success('指标已刷新')
  }

  /** 未接入项表格列 */
  const notIntegratedColumns: ColumnsType<(typeof NOT_INTEGRATED_ITEMS)[number]> = [
    { title: '未接入维度', dataIndex: 'name', width: 260 },
    {
      title: '原因',
      dataIndex: 'reason',
      render: (value: string) => <Text type="secondary">{value}</Text>,
    },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Alert
        banner
        type="warning"
        showIcon
        message="溯源总览口径说明：码段统计与检测质量指标取自真实接口；扫码汇总、区块链节点数、生成趋势、扫码区域分布、覆盖率分类分析后端暂未提供，显示「未接入」，不再沿用原型示例数值"
        action={
          <Button size="small" icon={<ReloadOutlined />} onClick={handleRefresh}>
            刷新
          </Button>
        }
      />

      {statsQuery.isError ? (
        <Alert
          type="error"
          showIcon
          message="码段统计接口（GET /admin/trace/code-stats）未返回数据，相关指标显示为「未接入」"
          action={
            <Button size="small" icon={<ReloadOutlined />} onClick={() => void statsQuery.refetch()}>
              重试
            </Button>
          }
        />
      ) : null}

      {/* 指标卡：全部来自后端真实返回 */}
      <Row gutter={16}>
        <Col xs={24} sm={12} lg={4}>
          <Card>
            <Statistic
              title="溯源码总量"
              value={totalCodeCount === undefined ? '未接入' : totalCodeCount}
              suffix={totalCodeCount === undefined ? undefined : '枚'}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card>
            <Statistic
              title="已激活"
              value={codeStats.active === undefined ? '未接入' : codeStats.active}
              suffix={codeStats.active === undefined ? undefined : '枚'}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card>
            <Statistic
              title="已扫码"
              value={codeStats.scanned === undefined ? '未接入' : codeStats.scanned}
              suffix={codeStats.scanned === undefined ? undefined : '枚'}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card>
            <Statistic
              title="已作废"
              value={codeStats.revoked === undefined ? '未接入' : codeStats.revoked}
              suffix={codeStats.revoked === undefined ? undefined : '枚'}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card>
            <Statistic
              title="检测合格率"
              value={toNumber(qualityQuery.data?.passRate) === undefined ? '未接入' : String(toNumber(qualityQuery.data?.passRate))}
              suffix="%"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card>
            <Statistic
              title="检测合格 / 不合格"
              value={`${toNumber(qualityQuery.data?.passCount) ?? '—'} / ${toNumber(qualityQuery.data?.failCount) ?? '—'}`}
              valueStyle={{ fontSize: 22 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>单位：单</Text>
          </Card>
        </Col>
      </Row>

      {/* 码段状态分布（真实） */}
      <Card title="码段状态分布" loading={statsQuery.isLoading}>
        {statusDistribution.length === 0 ? (
          <Empty description="后端 /admin/trace/code-stats 未返回任何码段数据" />
        ) : (
          <Row gutter={8}>
            {statusDistribution.map((item) => (
              <Col span={6} key={item.name}>
                <Statistic title={item.name} value={item.value} suffix="枚" valueStyle={{ fontSize: 18 }} />
              </Col>
            ))}
          </Row>
        )}
      </Card>

      {/* 原趋势图 / 覆盖率分析 / 扫码区域分布：后端未提供，改空态 */}
      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card title="溯源码生成趋势">
            <Empty description="后端未提供按日趋势端点，暂不展示（不使用原型示例序列）" />
          </Card>
        </Col>
        <Col xs={24} lg={6}>
          <Card title="溯源覆盖率分析">
            <Empty description="后端未提供分类覆盖率端点，暂不展示" />
          </Card>
        </Col>
        <Col xs={24} lg={6}>
          <Card title="扫码区域分布">
            <Empty description="后端未提供扫码区域汇总端点，暂不展示" />
          </Card>
        </Col>
      </Row>

      <Card
        title="后端暂未接入的维度"
        extra={
          <Space>
            <Button size="small" icon={<DownloadOutlined />} onClick={handleExport}>
              导出报表
            </Button>
            <Button size="small" icon={<ReloadOutlined />} onClick={handleRefresh}>
              刷新
            </Button>
          </Space>
        }
      >
        <Table
          rowKey="name"
          size="small"
          pagination={false}
          columns={notIntegratedColumns}
          dataSource={NOT_INTEGRATED_ITEMS}
        />
        <Space direction="vertical" size={4} style={{ marginTop: 12 }}>
          <Text type="secondary">说明：以上维度在后端没有对应接口，页面一律显示「未接入」，不做本地估算、不填 0、不沿用原型示例数值。</Text>
          <Text type="secondary">
            数据来源：<Text code>GET /admin/trace/code-stats</Text>（码段）、
            <Text code>GET /admin/quality/overview</Text>（检测质量）。
          </Text>
        </Space>
      </Card>
    </Space>
  )
}
