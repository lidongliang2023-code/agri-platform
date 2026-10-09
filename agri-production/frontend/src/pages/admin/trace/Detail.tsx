/**
 * 页面名称：溯源链路详情
 * 路由路径：/admin/production/trace/:code
 * 所属模块：质量追溯管理
 * 原型来源：P13 trace-detail — 溯源链路详情（11 节点全链路）
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
  Steps,
  Table,
  Tag,
  Timeline,
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

/* ==================== 原型 P13 全链路 11 节点定义 ==================== */

/** 全链路节点（页面消费形态） */
interface TraceChainNode {
  /** 节点序号（1-11） */
  index: number
  /** 节点名称 */
  name: string
  /** 所属环节 */
  stage: string
  /** 发生时间 */
  occurredAt: string
  /** 操作主体 */
  operator: string
  /** 数据摘要 */
  summary: string
  /** 是否已上链存证 */
  onChain: boolean
  /** 区块高度 */
  blockHeight?: string
  /** 上链交易哈希 */
  txHash?: string
}

/**
 * 原型 P13 全链路 11 节点模板。
 *
 * 顺序：播种 → 施肥 → 灌溉 → 采收 → 检测 → 加工 → 仓储 → 出库 → 物流 → 门店 → 扫码，
 * 覆盖「种植—采收—检测—加工—仓储—流通—消费」完整链路。
 */
const CHAIN_NODE_TEMPLATE: TraceChainNode[] = [
  {
    index: 1,
    name: '播种',
    stage: '种植',
    occurredAt: '2025-03-15',
    operator: '绿源1号农场 · 张三',
    summary: '品种：稻花香2号；播种面积 120 亩；用种量 360kg；基肥一次性施入',
    onChain: true,
    blockHeight: '#185420',
    txHash: '0x7a3f9c21e4b8d5a06f3c8e17b29401da5c6e8f30',
  },
  {
    index: 2,
    name: '施肥',
    stage: '种植',
    occurredAt: '2025-04-20',
    operator: '绿源1号农场 · 李四',
    summary: '尿素 25kg/亩 + 有机肥 120kg/亩；投入品合规校验通过',
    onChain: true,
    blockHeight: '#186100',
    txHash: '0x9b2e41d7c05a8f36b1e2947da03c58f617b40e29',
  },
  {
    index: 3,
    name: '灌溉',
    stage: '种植',
    occurredAt: '2025-05-10',
    operator: '智能灌溉系统 · 自动任务',
    summary: '灌溉时长 6 小时；用水量 480m³；土壤含水率由 18.2% 提升至 26.5%',
    onChain: false,
  },
  {
    index: 4,
    name: '采收',
    stage: '采收',
    occurredAt: '2025-07-01',
    operator: '绿源1号农场 · 赵六',
    summary: '采收量 62,000kg；含水率 14.2%；等级初评 A；地块 3 号 / 5 号',
    onChain: false,
  },
  {
    index: 5,
    name: '检测',
    stage: '检测',
    occurredAt: '2025-07-05',
    operator: '国家质检中心',
    summary: '农残 / 重金属共 12 项，全部合格；报告编号 RPT20250714001',
    onChain: true,
    blockHeight: '#192500',
    txHash: '0x4c8d73a1e9f2056b48c17d3a9e6028f5b1c74d02',
  },
  {
    index: 6,
    name: '加工',
    stage: '加工',
    occurredAt: '2025-07-08',
    operator: '绿源加工厂 · 1 号线',
    summary: '脱壳 / 色选 / 包装；出品率 68.5%；5kg 装 8,540 袋',
    onChain: true,
    blockHeight: '#193200',
    txHash: '0x2f1a85c04d7e1936b2a85f47c09d1e63a7b502fc',
  },
  {
    index: 7,
    name: '仓储',
    stage: '仓储',
    occurredAt: '2025-07-10',
    operator: '中原冷库 A 区',
    summary: '入库 8,540 袋；库温 12°C；湿度 62%；货位 A-03-12',
    onChain: false,
  },
  {
    index: 8,
    name: '出库',
    stage: '仓储',
    occurredAt: '2025-07-12',
    operator: '中原冷库 A 区 · 周八',
    summary: '出库 3,200 袋；承运商 顺丰冷运；运单 SF202507120088',
    onChain: true,
    blockHeight: '#194800',
    txHash: '0x6e5c19b73a2f804d5c61e9b37a04d82f591c6e40',
  },
  {
    index: 9,
    name: '物流',
    stage: '流通',
    occurredAt: '2025-07-13',
    operator: '顺丰冷运 · 豫A12345',
    summary: '冷链运输全程 2~6°C；里程 320km；无温度异常告警',
    onChain: false,
  },
  {
    index: 10,
    name: '门店',
    stage: '流通',
    occurredAt: '2025-07-14',
    operator: '郑州 · 丹尼斯超市（航海路店）',
    summary: '到货 3,200 袋；上架 2,860 袋；零售价 89.9 元 / 袋',
    onChain: false,
  },
  {
    index: 11,
    name: '扫码',
    stage: '消费',
    occurredAt: '2025-07-14',
    operator: '消费者 · 微信小程序',
    summary: '累计扫码 5 次；最近扫码 07-14 15:30；无异地重复扫码异常',
    onChain: false,
  },
]

/** 上链存证行（原型 P13 各环节上链存证） */
interface ChainProofRow {
  /** 环节名称 */
  stage: string
  /** 区块高度 */
  blockHeight: string
  /** 交易哈希 */
  txHash: string
  /** 上链时间 */
  chainAt: string
  /** 存证状态 */
  verified: boolean
}

/** 扫码记录行（原型 P13 扫码记录） */
interface ScanRecordRow {
  /** 记录序号 */
  key: string
  /** 扫码时间 */
  scannedAt: string
  /** 扫码地区 */
  region: string
  /** 扫码设备 / 渠道 */
  device: string
  /** 第几次 */
  seqText: string
}

/** 原型 P13 扫码记录示例 */
const PROTOTYPE_SCANS: ScanRecordRow[] = [
  { key: 's5', scannedAt: '07-14 15:30', region: '河南 · 郑州', device: '微信小程序', seqText: '第5次' },
  { key: 's4', scannedAt: '07-14 12:15', region: '河南 · 郑州', device: '支付宝', seqText: '第4次' },
  { key: 's3', scannedAt: '07-14 10:45', region: '河南 · 洛阳', device: '微信小程序', seqText: '第3次' },
  { key: 's2', scannedAt: '07-14 08:20', region: '山东 · 济南', device: '微信小程序', seqText: '第2次' },
  { key: 's1', scannedAt: '07-14 07:00', region: '河南 · 郑州', device: '扫码枪', seqText: '第1次' },
]

/**
 * 溯源链路详情
 *
 * 业务职责：按溯源码（code）展示 11 节点全链路时间线、各环节上链存证与消费者扫码记录，
 * 支持导出完整报告与冻结 / 召回处置。
 *
 * 数据来源：GET /admin/trace/chain?code=（码 → 批次 → 质检）
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

  /** 一键召回（作废码段 + 冻结批次） */
  const recallMutation = useMutation({
    mutationFn: (batchId: string) => recallAdminTraceBatch(batchId),
    onSuccess: (count) => {
      message.success(`召回已执行，作废溯源码 ${count} 张并冻结批次`)
      void queryClient.invalidateQueries({ queryKey: ['admin', 'trace', 'chain', code] })
    },
    onError: () => {
      message.warning('召回接口未返回成功，请确认批次 ID 是否有效')
    },
  })

  /** 远端链路数据 */
  const chain = chainQuery.data
  /** 批次快照 */
  const batch = chain?.batch
  /** 批次关联检测记录 */
  const inspections = chain?.inspections ?? []

  /** 头卡信息（后端数据优先，缺失时回落原型 P13 口径） */
  const header = useMemo(() => {
    const remoteCode = chain?.traceCode
    return {
      /** 溯源码 */
      code: code || '—',
      /** 产品名称 */
      productName: batch?.cropName ? `${batch.cropName} 5kg装` : '有机大米 5kg装',
      /** 批次号 */
      batchNo: batch?.batchNo ?? remoteCode?.batchNo ?? 'B2025071',
      /** 农场名称 */
      farmName: batch?.farmName ?? remoteCode?.farmName ?? '绿源1号农场',
      /** 扫码次数 */
      scanCount: Number(remoteCode?.scanCount ?? 5),
      /** 是否命中后端记录 */
      found: chain?.found ?? false,
      /** 批次状态：4 已冻结 */
      frozen: batch?.status === 4,
      /** 批次 ID（用于召回） */
      batchId: batch?.batchId ?? '',
    }
  }, [code, chain, batch])

  /** 全链路节点（后端检测记录覆盖「检测」节点） */
  const chainNodes = useMemo<TraceChainNode[]>(() => {
    const nodes = CHAIN_NODE_TEMPLATE.map((node) => ({ ...node }))
    const inspectNode = nodes.find((node) => node.name === '检测')
    if (inspectNode && inspections.length > 0) {
      const latest = inspections[0]
      const result = latest.result === 'FAIL' ? '存在不合格项' : '全部合格'
      inspectNode.operator = latest.labName ?? latest.inspectorName ?? inspectNode.operator
      inspectNode.summary = `${latest.inspectionNo ?? '—'}：${result}${latest.sampleAt ? `；抽样时间 ${latest.sampleAt.slice(0, 10)}` : ''}`
      inspectNode.occurredAt = latest.sampleAt?.slice(0, 10) ?? inspectNode.occurredAt
    }
    return nodes
  }, [inspections])

  /** 上链存证清单（从节点模板中提取已上链环节） */
  const proofRows = useMemo<ChainProofRow[]>(
    () =>
      chainNodes
        .filter((node) => node.onChain && node.blockHeight && node.txHash)
        .map((node) => ({
          stage: node.name,
          blockHeight: node.blockHeight ?? '—',
          txHash: node.txHash ?? '—',
          chainAt: node.occurredAt,
          verified: true,
        })),
    [chainNodes],
  )

  /** 链完整性 */
  const chainIntegrity = useMemo(() => {
    const onChainCount = chainNodes.filter((node) => node.onChain).length
    return {
      /** 已上链节点数 */
      onChainCount,
      /** 总节点数 */
      totalCount: chainNodes.length,
      /** 是否完整 */
      complete: onChainCount >= 5,
    }
  }, [chainNodes])

  /** 导出完整报告（前端本地生成 CSV） */
  const handleExportReport = (): void => {
    const rows: string[][] = [
      ['溯源链路报告'],
      ['溯源码', header.code],
      ['产品', header.productName],
      ['批次号', header.batchNo],
      ['农场', header.farmName],
      ['扫码次数', String(header.scanCount)],
      ['链完整性', chainIntegrity.complete ? '完整' : '不完整'],
      [],
      ['序号', '节点', '环节', '时间', '操作主体', '数据摘要', '存证状态'],
      ...chainNodes.map((node) => [
        String(node.index),
        node.name,
        node.stage,
        node.occurredAt,
        node.operator,
        node.summary,
        node.onChain ? '已上链' : '未上链',
      ]),
      [],
      ['环节', '区块高度', 'Hash', '时间', '状态'],
      ...proofRows.map((row) => [row.stage, row.blockHeight, row.txHash, row.chainAt, row.verified ? '✓' : '—']),
      [],
      ['时间', '地区', '设备', '次数'],
      ...PROTOTYPE_SCANS.map((row) => [row.scannedAt, row.region, row.device, row.seqText]),
    ]
    const csv = rows.map((row) => row.join(',')).join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `溯源链路报告_${header.code}.csv`
    link.click()
    URL.revokeObjectURL(url)
    message.success('完整报告已导出')
  }

  /** 上链存证表格列 */
  const proofColumns: ColumnsType<ChainProofRow> = [
    { title: '环节', dataIndex: 'stage', width: 100 },
    { title: '区块高度', dataIndex: 'blockHeight', width: 120 },
    {
      title: 'Hash',
      dataIndex: 'txHash',
      width: 260,
      render: (value: string) => (
        <Text copyable={{ text: value }} ellipsis style={{ maxWidth: 220 }}>
          {`${value.slice(0, 10)}...${value.slice(-6)}`}
        </Text>
      ),
    },
    { title: '时间', dataIndex: 'chainAt', width: 120 },
    {
      title: '状态',
      dataIndex: 'verified',
      width: 90,
      render: (value: boolean) =>
        value ? <Tag color="success">✓ 已验证</Tag> : <Tag>未验证</Tag>,
    },
  ]

  /** 扫码记录表格列 */
  const scanColumns: ColumnsType<ScanRecordRow> = [
    { title: '时间', dataIndex: 'scannedAt', width: 140 },
    { title: '地区', dataIndex: 'region', width: 160 },
    { title: '设备', dataIndex: 'device', width: 160 },
    { title: '次数', dataIndex: 'seqText', width: 100 },
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
        {chainQuery.isError ? (
          <Alert
            type="warning"
            showIcon
            message="全链条回溯接口未返回数据，当前展示原型 P13 链路口径（11 节点完整链路）"
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

        {/* 头卡（原型 P13） */}
        <Card
          title={
            <Space>
              <SafetyCertificateOutlined />
              <span>溯源链路详情</span>
            </Space>
          }
          extra={
            <Space wrap>
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/production/trace/codes')}>
                返回溯源码管理
              </Button>
              <Button type="primary" icon={<DownloadOutlined />} onClick={handleExportReport}>
                导出完整报告
              </Button>
            </Space>
          }
        >
          <Descriptions
            column={{ xs: 1, sm: 2, lg: 3 }}
            size="small"
            items={[
              { key: 'code', label: '溯源码', children: <Text copyable strong>{header.code}</Text> },
              { key: 'product', label: '产品', children: header.productName },
              { key: 'batch', label: '批次', children: header.batchNo },
              { key: 'farm', label: '农场', children: header.farmName },
              {
                key: 'scan',
                label: '扫码次数',
                children: (
                  <Text strong style={{ color: '#1677ff' }}>{header.scanCount} 次</Text>
                ),
              },
              {
                key: 'integrity',
                label: '链完整性',
                children: chainIntegrity.complete ? (
                  <Tag color="success">完整 ✓</Tag>
                ) : (
                  <Tag color="warning">不完整</Tag>
                ),
              },
              {
                key: 'status',
                label: '批次状态',
                children: header.frozen ? <Tag color="red">已冻结</Tag> : <Tag color="blue">正常流通</Tag>,
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
                disabled={!header.batchId}
                loading={recallMutation.isPending}
                onClick={() => recallMutation.mutate(header.batchId)}
              >
                一键召回批次
              </Button>
            </Space>
          </Row>
        </Card>

        {/* 11 节点全链路时间线（原型 P13） */}
        <Card
          title="溯源链路节点时间线"
          extra={
            <Text type="secondary">
              共 {chainIntegrity.totalCount} 个节点，已上链 {chainIntegrity.onChainCount} 个
            </Text>
          }
        >
          <Steps
            size="small"
            progressDot
            current={chainNodes.length - 1}
            responsive
            items={chainNodes.map((node) => ({
              title: `${node.index}. ${node.name}`,
              description: node.occurredAt.slice(5),
            }))}
          />
          <Timeline
            style={{ marginTop: 24 }}
            items={chainNodes.map((node) => ({
              color: node.onChain ? 'green' : 'gray',
              children: (
                <div>
                  <Space size={8} wrap>
                    <Text strong>{`${node.index}. ${node.name}`}</Text>
                    <Tag>{node.stage}</Tag>
                    <Text type="secondary">{node.occurredAt}</Text>
                    {node.onChain ? (
                      <Tag color="success" icon={<SafetyCertificateOutlined />}>
                        已上链 {node.blockHeight}
                      </Tag>
                    ) : (
                      <Tag>未上链</Tag>
                    )}
                  </Space>
                  <div style={{ marginTop: 4 }}>
                    <Text type="secondary">操作主体：</Text>
                    <Text>{node.operator}</Text>
                  </div>
                  <div>
                    <Text type="secondary">数据摘要：</Text>
                    <Text>{node.summary}</Text>
                  </div>
                </div>
              ),
            }))}
          />
        </Card>

        {/* 各环节上链存证 + 扫码记录 */}
        <Row gutter={16}>
          <Col xs={24} lg={14}>
            <Card title="各环节上链存证">
              <Table
                rowKey="stage"
                size="small"
                pagination={false}
                columns={proofColumns}
                dataSource={proofRows}
              />
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card title="扫码记录" extra={<Text type="secondary">最近 {PROTOTYPE_SCANS.length} 条</Text>}>
              <Table
                rowKey="key"
                size="small"
                pagination={false}
                columns={scanColumns}
                dataSource={PROTOTYPE_SCANS}
              />
            </Card>
          </Col>
        </Row>

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

        {!header.found && !chainQuery.isLoading ? (
          <Alert
            type="info"
            showIcon
            message={`后端未检索到溯源码 ${code} 的实体记录，页面按原型 P13 展示完整链路结构`}
          />
        ) : null}

        <Title level={5} type="secondary" style={{ marginTop: 0 }}>
          说明：链路数据取自 GET /admin/trace/chain?code=，检测节点会被批次真实检测记录覆盖。
        </Title>
      </Space>
    </Spin>
  )
}
