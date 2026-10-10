/**
 * 页面名称：溯源链路详情
 * 路由路径：/admin/production/trace/:code
 * 所属模块：质量追溯管理
 * 原型来源：P13 trace-detail — 溯源链路详情
 *
 * ====================== 数据源实测结论（已连后端验证） ======================
 * 实测 GET /admin/trace/chain?code=DEMO-TC-0001 返回：
 * {"code":0,"data":{"found":true,"traceCode":{...真实溯源码档案...},"batch":null}}
 * 即后端**只返回溯源码档案**（code / batchId / batchNo / status / scanCount /
 * activatedAt / activatedBy / lastScanAt / expireDate），
 * 并在批次能关联上时附带 batch 与 inspections。
 *
 * 后端**没有**提供：
 * - 11 节点全链路时间线（原型 P13 的播种/施肥/…/扫码节点无对应端点）
 * - 区块高度 / 上链交易哈希 / 已上链标记（返回体中不存在这些字段）
 * - 扫码记录明细（GET /trace/codes/{code}/scans 实测 code=500）
 *
 * 处置：删除原先内置的 11 节点模板与示例扫码记录（含编造的 txHash / 区块高度 / 操作主体），
 * 仅呈现后端真实返回的档案字段；无数据部分统一空态 + 明确提示。
 * =========================================================================
 */
import { useMemo } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Row,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd'
import {
  ArrowLeftOutlined,
  DownloadOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchAdminTraceChain, recallAdminTraceBatch } from '@/api/admin/trace'
import { revokeTraceCode } from '@/api/trace'

const { Text, Title } = Typography

/** 溯源码状态 → 中文与配色 */
const CODE_STATUS_MAP: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: '已激活', color: 'green' },
  INACTIVE: { label: '未激活', color: 'default' },
  GENERATED: { label: '已生成', color: 'blue' },
  REVOKED: { label: '已作废', color: 'red' },
  EXPIRED: { label: '已过期', color: 'orange' },
}

/** 档案字段行（用于导出与表格化展示） */
interface ArchiveRow {
  /** 字段标识 */
  key: string
  /** 字段名称 */
  label: string
  /** 字段值 */
  value: string
}

/**
 * 溯源链路详情
 *
 * 业务职责：按溯源码展示后端真实返回的溯源码档案与批次 / 检测关联信息，
 * 支持导出档案快照与冻结 / 召回处置；链路节点与存证信息后端未提供，统一空态。
 *
 * @returns 页面内容
 */
export default function Detail(): JSX.Element {
  const { code = '' } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const queryClient = useQueryClient()

  /** 全链条回溯 */
  const chainQuery = useQuery({
    queryKey: ['admin', 'trace', 'chain', code],
    queryFn: () => fetchAdminTraceChain(code),
    enabled: Boolean(code),
    retry: false,
  })

  /** 作废溯源码 */
  const revokeMutation = useMutation({
    mutationFn: () => revokeTraceCode(code),
    onSuccess: () => {
      message.success('溯源码已作废，消费者扫码将提示失效')
      void queryClient.invalidateQueries({ queryKey: ['admin', 'trace', 'chain', code] })
    },
    onError: () => {
      message.warning('作废接口未返回成功，请确认后端 /trace/{code}/revoke 是否可用')
    },
  })

  /**
   * 一键召回（作废码段 + 冻结批次）。
   *
   * ⚠️ 后端 `{@code AdminTraceService.recall}` 在 `selectById` 拿不到批次时
   * **不报错、直接返回 0**（实测 `POST /admin/trace/recall?batchId=__NO_SUCH_BATCH__`
   * → HTTP 200 + `{"code":0,"data":0}`）。此前前端拿到 0 也照样弹
   * 「召回已执行，作废溯源码 0 张并冻结批次」——批次根本不存在，什么都没冻结。
   * 且**刷新不会露馅**：列表里本来就没有这个批次，运营会以为"召回了只是这批没码"。
   *
   * 前端分不出来「批次不存在」和「批次存在但名下没有溯源码」（两种情况后端都回 0），
   * 所以 `count === 0` 时**不再宣称批次已冻结**，把两种可能都写出来让人去核。
   * 后端侧的 NOT_FOUND 已另开工单，改完这里应当改成按 code 分支。
   */
  const recallMutation = useMutation({
    mutationFn: (batchId: string) => recallAdminTraceBatch(batchId),
    onSuccess: (count) => {
      const invalidated = Number.isFinite(Number(count)) ? Number(count) : 0
      if (invalidated > 0) {
        message.success(`召回已执行，作废溯源码 ${invalidated} 张并冻结批次`)
      } else {
        message.warning(
          '召回未生效：服务端作废了 0 张溯源码。该批次可能不存在，也可能该批次名下没有溯源码——未确认批次已冻结，请核对批次 ID',
        )
      }
      void queryClient.invalidateQueries({ queryKey: ['admin', 'trace', 'chain', code] })
    },
    onError: () => {
      message.warning('召回接口未返回成功，请确认批次 ID 是否有效')
    },
  })

  /** 远端链路数据 */
  const chain = chainQuery.data
  /** 溯源码档案 */
  const traceCode = chain?.traceCode
  /** 批次快照（后端关联不到时为 null / undefined） */
  const batch = chain?.batch
  /** 批次关联检测记录 */
  const inspections = chain?.inspections ?? []

  /** 档案字段（全部取自后端返回，缺失显示「未接入」） */
  const archiveRows: ArchiveRow[] = useMemo(() => [
    { key: 'code', label: '溯源码', value: traceCode?.code ?? code ?? '—' },
    { key: 'batchNo', label: '批次号', value: traceCode?.batchNo ?? batch?.batchNo ?? '未接入' },
    { key: 'batchId', label: '关联批次 ID', value: String(traceCode?.batchId ?? batch?.batchId ?? '未接入') },
    {
      key: 'status',
      label: '码状态',
      value:
        CODE_STATUS_MAP[String(traceCode?.status ?? '')]?.label ?? String(traceCode?.status ?? '未接入'),
    },
    {
      key: 'scanCount',
      label: '扫码次数',
      value: traceCode?.scanCount === undefined ? '未接入' : String(traceCode.scanCount),
    },
    { key: 'activatedAt', label: '激活时间', value: traceCode?.activatedAt ?? '未激活 / 未接入' },
    { key: 'activatedBy', label: '激活操作人', value: traceCode?.activatedBy ?? '未接入' },
    { key: 'lastScanAt', label: '最近扫码时间', value: traceCode?.lastScanAt ?? '未接入' },
    { key: 'expireDate', label: '有效期至', value: traceCode?.expireDate ?? '未接入' },
    {
      key: 'batchArchive',
      label: '批次档案',
      value: batch ? '已关联' : '后端未关联到批次档案（batch = null）',
    },
    {
      key: 'product',
      label: '产品名称',
      value: batch?.cropName ?? traceCode?.productName ?? '未接入',
    },
    { key: 'farm', label: '农场名称', value: batch?.farmName ?? traceCode?.farmName ?? '未接入' },
    { key: 'plot', label: '地块名称', value: batch?.plotId ?? traceCode?.plotName ?? '未接入' },
    { key: 'grade', label: '质量等级', value: traceCode?.grade ?? '未接入' },
    {
      key: 'harvestDate',
      label: '采收日期',
      value: batch?.harvestDate ?? '未接入',
    },
    {
      key: 'batchStatus',
      label: '批次状态',
      value: batch?.status === undefined ? '未接入' : batch.status === 4 ? '已冻结' : '正常流通',
    },
  ], [code, traceCode, batch])

  /** 导出档案快照（仅导出后端真实返回字段） */
  const handleExportReport = (): void => {
    const rows: string[][] = [
      ['溯源档案快照'],
      ['字段', '数值'],
      ...archiveRows.map((row) => [row.label, row.value]),
      [],
      ['以下维度后端暂无接口，不做填充'],
      ['全链路节点时间线', '后端未返回链路节点数据'],
      ['区块高度 / 上链交易哈希', '后端返回体中不存在该字段'],
      ['消费者扫码明细', 'GET /trace/codes/{code}/scans 不可用'],
      [],
      ['批次关联检测记录'],
      ['检测单号', '检测机构', '抽样时间', '结论'],
      ...inspections.map((item) => [
        item.inspectionNo ?? item.inspectionId ?? '—',
        item.labName ?? item.inspectorName ?? '—',
        item.sampleAt?.slice(0, 10) ?? '—',
        item.result ?? '—',
      ]),
    ]
    const csv = rows.map((row) => row.join(',')).join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `溯源链路报告_${code}.csv`
    link.click()
    URL.revokeObjectURL(url)
    message.success('档案快照已导出（仅含后端真实返回字段）')
  }

  /** 档案表格列 */
  const archiveColumns: ColumnsType<ArchiveRow> = [
    { title: '字段', dataIndex: 'label', width: 160 },
    {
      title: '数值',
      dataIndex: 'value',
      render: (value: string) =>
        value === '未接入' ? <Text type="secondary">{value}</Text> : <Text>{value}</Text>,
    },
  ]

  /** 未传入溯源码时的空态 */
  if (!code) {
    return (
      <Card>
        <Empty description="未指定溯源码，请从溯源码管理页选择「查看链路」进入" />
      </Card>
    )
  }

  return (
    <Spin spinning={chainQuery.isLoading}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          banner
          type="warning"
          showIcon
          message="链路口径说明：后端 GET /admin/trace/chain 仅返回溯源码档案（及可关联时的批次 / 检测记录）；11 节点全链路时间线、区块高度 / 交易哈希、扫码明细后端均未提供，显示为「未接入」，不再展示原型示例链路"
        />

        {chainQuery.isError ? (
          <Alert
            type="error"
            showIcon
            message="全链条回溯接口（GET /admin/trace/chain）未返回数据，请重试"
            action={
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={() => void chainQuery.refetch()}
              >
                重试
              </Button>
            }
          />
        ) : null}

        {!chainQuery.isLoading && chain?.found === false ? (
          <Alert
            type="info"
            showIcon
            message={`后端未检索到溯源码 ${code} 的任何记录（found = false），本页无数据可展示`}
          />
        ) : null}

        {/* 头卡：溯源码档案 */}
        <Card
          title={
            <Space>
              <SafetyCertificateOutlined />
              <span>溯源档案详情</span>
            </Space>
          }
          extra={
            <Space wrap>
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/production/trace/codes')}>
                返回溯源码管理
              </Button>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                disabled={chain?.found !== true}
                onClick={handleExportReport}
              >
                导出档案快照
              </Button>
            </Space>
          }
        >
          <Descriptions
            column={{ xs: 1, sm: 2, lg: 3 }}
            size="small"
            items={[
              { key: 'code', label: '溯源码', children: <Text copyable strong>{code}</Text> },
              {
                key: 'status',
                label: '码状态',
                children: (() => {
                  const mapped = CODE_STATUS_MAP[String(traceCode?.status ?? '')]
                  return mapped ? (
                    <Tag color={mapped.color}>{mapped.label}</Tag>
                  ) : (
                    <Tag>未接入</Tag>
                  )
                })(),
              },
              {
                key: 'batchNo',
                label: '批次号',
                children: traceCode?.batchNo ?? batch?.batchNo ?? '未接入',
              },
              {
                key: 'scan',
                label: '扫码次数',
                children:
                  traceCode?.scanCount === undefined ? (
                    <Text type="secondary">未接入</Text>
                  ) : (
                    <Text strong style={{ color: '#1677ff' }}>{traceCode.scanCount} 次</Text>
                  ),
              },
              {
                key: 'batch',
                label: '批次档案',
                children: batch ? (
                  <Tag color="success">已关联</Tag>
                ) : (
                  <Tag color="warning">后端未关联到批次档案</Tag>
                ),
              },
              {
                key: 'batchStatus',
                label: '批次状态',
                children:
                  batch?.status === undefined ? (
                    <Tag>未接入</Tag>
                  ) : batch.status === 4 ? (
                    <Tag color="red">已冻结</Tag>
                  ) : (
                    <Tag color="blue">正常流通</Tag>
                  ),
              },
            ]}
          />
          <Row justify="end" style={{ marginTop: 12 }}>
            <Space>
              <Button
                danger
                icon={<StopOutlined />}
                loading={revokeMutation.isPending}
                onClick={() => revokeMutation.mutate()}
              >
                作废该溯源码
              </Button>
              <Button
                danger
                type="primary"
                disabled={!batch?.batchId}
                loading={recallMutation.isPending}
                onClick={() => batch?.batchId && recallMutation.mutate(String(batch.batchId))}
              >
                一键召回批次
              </Button>
            </Space>
          </Row>
        </Card>

        {/* 档案明细（全部来自后端返回） */}
        <Card title="溯源码档案明细">
          <Table
            rowKey="key"
            size="small"
            pagination={false}
            columns={archiveColumns}
            dataSource={archiveRows}
          />
        </Card>

        {/* 链路节点 / 上链存证 / 扫码记录：后端均无数据，统一空态 */}
        <Row gutter={16}>
          <Col xs={24} lg={12}>
            <Card title="溯源链路节点时间线">
              <Empty description="后端未提供链路节点数据（原型 P13 的 11 节点为设计稿结构，非真实数据），暂不展示" />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="各环节上链存证">
              <Empty description="后端返回体中不存在区块高度 / 交易哈希 / 已上链标记，暂不展示" />
            </Card>
          </Col>
        </Row>

        <Card title="扫码记录">
          <Empty description="后端未提供扫码明细端点（GET /trace/codes/{code}/scans 不可用），暂不展示" />
        </Card>

        {inspections.length > 0 ? (
          <Card title="批次关联检测报告">
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {inspections.map((item) => (
                <Row key={item.inspectionId} justify="space-between" align="middle">
                  <Space wrap>
                    <Text strong>{item.inspectionNo ?? item.inspectionId}</Text>
                    <Text type="secondary">{item.labName ?? item.inspectorName ?? '—'}</Text>
                    <Text type="secondary">{item.sampleAt?.slice(0, 10) ?? '—'}</Text>
                  </Space>
                  {item.result === 'FAIL' ? (
                    <Tag color="error">不合格</Tag>
                  ) : item.result === 'PASS' ? (
                    <Tag color="success">合格</Tag>
                  ) : (
                    <Tag>待检</Tag>
                  )}
                </Row>
              ))}
            </Space>
          </Card>
        ) : null}

        <Title level={5} type="secondary" style={{ marginTop: 0 }}>
          说明：档案数据取自 GET /admin/trace/chain?code=；检测记录由后端按批次关联返回。
        </Title>
      </Space>
    </Spin>
  )
}
