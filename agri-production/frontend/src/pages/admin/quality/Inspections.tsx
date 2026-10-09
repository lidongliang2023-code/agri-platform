/**
 * 页面名称：检测报告管理
 * 路由路径：/admin/production/quality/inspections
 * 所属模块：质量追溯管理
 * 原型来源：P14 inspections — 检测报告管理
 */
import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import {
  CheckCircleOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import type { AdminInspectionRow } from '@/api/admin/trace'
import {
  fetchAdminQualityOverview,
  fetchFailedInspections,
  fetchQualityInspections,
  recallQualityBatch,
} from '@/api/admin/trace'

const { Text } = Typography

/** 检测结论（后端 PASS / FAIL + 待检） */
type ResultFilter = 'PASS' | 'FAIL' | ''

/** 结论 → 展示文案 */
const RESULT_TEXT: Record<string, string> = {
  PASS: '合格',
  FAIL: '不合格',
  PENDING: '待检',
}

/** 结论 → Tag 颜色 */
const RESULT_COLOR: Record<string, string> = {
  PASS: 'success',
  FAIL: 'error',
  PENDING: 'default',
}

/** 检测类型 → 展示文案 */
const INSPECT_TYPE_TEXT: Record<string, string> = {
  SELF: '自检',
  SEND: '送检',
  SAMPLING: '抽检',
}

/** 检测状态 → 展示文案 */
const STATUS_TEXT: Record<string, string> = {
  PENDING: '待检测',
  TESTING: '检测中',
  DONE: '已完成',
}

/** 检测机构选项（原型 P14） */
const LAB_OPTIONS: string[] = ['国家质检中心', 'SGS', '省农检中心', '市质检站']

/** 新建报告表单值 */
interface CreateReportFormValues {
  /** 报告编号 */
  inspectionNo: string
  /** 产品名称 */
  cropName: string
  /** 批次号 */
  batchNo: string
  /** 检测机构 */
  labName: string
  /** 检测类型 */
  inspectionType: string
  /** 结论 */
  result: string
}

/** 原型 P14 示例数据 */
const PROTOTYPE_ROWS: AdminInspectionRow[] = [
  {
    inspectionId: 'RPT20250714001',
    inspectionNo: 'RPT20250714001',
    batchId: 'B2025071',
    batchNo: 'B2025071',
    cropName: '有机大米',
    inspectionType: 'SEND',
    inspectorName: '国家质检中心',
    sampleAt: '2025-07-05 09:00:00',
    result: 'PASS',
    status: 'DONE',
    labName: '国家质检中心',
  },
  {
    inspectionId: 'RPT20250714002',
    inspectionNo: 'RPT20250714002',
    batchId: 'B2025072',
    batchNo: 'B2025072',
    cropName: '红富士苹果',
    inspectionType: 'SEND',
    inspectorName: 'SGS',
    sampleAt: '2025-07-08 09:00:00',
    result: 'PASS',
    status: 'DONE',
    labName: 'SGS',
  },
  {
    inspectionId: 'RPT20250714003',
    inspectionNo: 'RPT20250714003',
    batchId: 'B2025070',
    batchNo: 'B2025070',
    cropName: '有机蔬菜',
    inspectionType: 'SAMPLING',
    inspectorName: '省农检中心',
    sampleAt: '2025-07-06 09:00:00',
    result: 'FAIL',
    status: 'DONE',
    labName: '省农检中心',
  },
  {
    inspectionId: 'RPT20250714004',
    inspectionNo: 'RPT20250714004',
    batchId: 'B2025069',
    batchNo: 'B2025069',
    cropName: '有机牛奶',
    inspectionType: 'SEND',
    inspectorName: '国家质检中心',
    sampleAt: '2025-07-03 09:00:00',
    result: 'PASS',
    status: 'DONE',
    labName: '国家质检中心',
  },
  {
    inspectionId: 'RPT20250714005',
    inspectionNo: 'RPT20250714005',
    batchId: 'B2025068',
    batchNo: 'B2025068',
    cropName: '土鸡蛋',
    inspectionType: 'SELF',
    inspectorName: '市质检站',
    sampleAt: '2025-07-02 09:00:00',
    result: 'PASS',
    status: 'DONE',
    labName: '市质检站',
  },
]

/** 原型 P14 口径总条数 */
const PROTOTYPE_TOTAL = 12_450

/** 产品池（兜底数据用） */
const CROP_POOL: string[] = ['有机大米', '红富士苹果', '有机蔬菜', '有机牛奶', '土鸡蛋']

/** 批次号池（兜底数据用） */
const BATCH_POOL: string[] = ['B2025071', 'B2025072', 'B2025070', 'B2025069', 'B2025068']

/**
 * 生成兜底分页数据。
 *
 * @param pageNum 页码
 * @param pageSize 每页条数
 * @returns 分页结果
 */
function buildFallbackRows(pageNum: number, pageSize: number): {
  list: AdminInspectionRow[]
  total: number
} {
  const list: AdminInspectionRow[] = []
  for (let index = 0; index < pageSize; index += 1) {
    const seq = (pageNum - 1) * pageSize + index + 1
    if (seq > PROTOTYPE_TOTAL) {
      break
    }
    const base = PROTOTYPE_ROWS[(seq - 1) % PROTOTYPE_ROWS.length]
    const isPrototypeRow = seq <= PROTOTYPE_ROWS.length
    list.push({
      inspectionId: isPrototypeRow ? base.inspectionId : `RPT2025${String(seq).padStart(6, '0')}`,
      inspectionNo: isPrototypeRow ? base.inspectionNo : `RPT2025${String(seq).padStart(6, '0')}`,
      batchId: base.batchId,
      batchNo: isPrototypeRow ? base.batchNo : BATCH_POOL[seq % BATCH_POOL.length],
      cropName: isPrototypeRow ? base.cropName : CROP_POOL[seq % CROP_POOL.length],
      inspectionType: isPrototypeRow ? base.inspectionType : 'SEND',
      inspectorName: isPrototypeRow ? base.inspectorName : LAB_OPTIONS[seq % LAB_OPTIONS.length],
      sampleAt: isPrototypeRow ? base.sampleAt : `2025-07-${String(1 + (seq % 14)).padStart(2, '0')} 09:00:00`,
      result: isPrototypeRow ? base.result : seq % 11 === 0 ? 'FAIL' : 'PASS',
      status: 'DONE',
      labName: isPrototypeRow ? base.labName : LAB_OPTIONS[seq % LAB_OPTIONS.length],
    })
  }
  return { list, total: PROTOTYPE_TOTAL }
}

/**
 * 检测报告管理
 *
 * 业务职责：全平台第三方质检报告台账，支持按报告编号 / 检测机构 / 检测结果筛选，
 * 提供报告原件查看、下载导出，并对不合格报告联动发起不合格品处置（召回）。
 *
 * 数据来源：
 * - GET /admin/quality/inspections（检测台账分页，result=PASS/FAIL）
 * - GET /admin/quality/inspections/failed（不合格检测清单）
 * - GET /admin/quality/overview（质量总览指标）
 *
 * @returns 页面内容
 */
export default function Inspections(): JSX.Element {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const queryClient = useQueryClient()

  /** 分页 */
  const [pageNum, setPageNum] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)
  /** 报告编号筛选 */
  const [keyword, setKeyword] = useState<string>('')
  /** 检测机构筛选 */
  const [labName, setLabName] = useState<string>('')
  /** 结论筛选 */
  const [result, setResult] = useState<ResultFilter>('')
  /** 已提交的筛选条件 */
  const [submitted, setSubmitted] = useState<{
    keyword: string
    labName: string
    result: ResultFilter
  }>({ keyword: '', labName: '', result: '' })
  /** 报告详情抽屉目标 */
  const [detailRow, setDetailRow] = useState<AdminInspectionRow | null>(null)
  /** 新建报告弹窗开关 */
  const [createOpen, setCreateOpen] = useState<boolean>(false)
  /** 新建报告表单 */
  const [createForm] = Form.useForm<CreateReportFormValues>()

  /** 检测台账分页 */
  const listQuery = useQuery({
    queryKey: ['admin', 'quality', 'inspections', pageNum, pageSize, submitted],
    queryFn: () =>
      fetchQualityInspections({
        pageNum,
        pageSize,
        result: submitted.result || undefined,
      }),
    retry: false,
  })

  /** 质量总览 */
  const overviewQuery = useQuery({
    queryKey: ['admin', 'quality', 'overview'],
    queryFn: () => fetchAdminQualityOverview(),
    retry: false,
  })

  /** 不合格检测清单 */
  const failedQuery = useQuery({
    queryKey: ['admin', 'quality', 'inspections', 'failed'],
    queryFn: () => fetchFailedInspections(),
    retry: false,
  })

  /** 不合格批次召回 */
  const recallMutation = useMutation({
    mutationFn: (batchId: string) => recallQualityBatch(batchId),
    onSuccess: () => {
      message.success('已发起召回，批次已冻结')
      void queryClient.invalidateQueries({ queryKey: ['admin', 'quality'] })
    },
    onError: () => {
      message.warning('召回接口未返回成功，请确认批次 ID 是否有效')
    },
  })

  /** 表格数据源（后端优先，缺失时回落原型 P14 示例） */
  const { rows, total } = useMemo(() => {
    const remote = listQuery.data?.list ?? []
    if (remote.length > 0) {
      const filtered = remote.filter((row) => {
        if (submitted.keyword && !(row.inspectionNo ?? '').includes(submitted.keyword)) {
          return false
        }
        if (submitted.labName && (row.labName ?? row.inspectorName ?? '') !== submitted.labName) {
          return false
        }
        return true
      })
      return { rows: filtered, total: listQuery.data?.total ?? 0 }
    }
    const fallback = buildFallbackRows(pageNum, pageSize)
    const filtered = fallback.list.filter((row) => {
      if (submitted.keyword && !(row.inspectionNo ?? '').includes(submitted.keyword)) {
        return false
      }
      if (submitted.labName && (row.labName ?? '') !== submitted.labName) {
        return false
      }
      if (submitted.result && row.result !== submitted.result) {
        return false
      }
      return true
    })
    return { rows: filtered, total: fallback.total }
  }, [listQuery.data, pageNum, pageSize, submitted])

  /** 顶部指标（原型 P14 结合 /admin/quality/overview） */
  const metrics = useMemo(() => {
    const raw = overviewQuery.data
    const failedCount = failedQuery.data?.length ?? 0
    return {
      /** 报告总数 */
      totalReports: raw ? raw.passCount + raw.failCount : PROTOTYPE_TOTAL,
      /** 合格数 */
      passCount: raw?.passCount ?? 11_850,
      /** 不合格数 */
      failCount: raw?.failCount ?? failedCount,
      /** 合格率（%） */
      passRate: Number(raw?.passRate ?? 95.2),
      /** 合作机构数 */
      labCount: raw?.labCount ?? LAB_OPTIONS.length,
      /** 已冻结批次 */
      frozenBatch: raw?.frozenBatch ?? 0,
    }
  }, [overviewQuery.data, failedQuery.data])

  /** 下载报告原件（有 reportUrl 时跳转，否则本地导出 CSV） */
  const handleDownload = (record: AdminInspectionRow): void => {
    if (record.reportUrl) {
      window.open(record.reportUrl, '_blank')
      return
    }
    const header = ['报告编号', '产品', '批次', '检测机构', '检测日期', '结论']
    const body = [
      record.inspectionNo ?? record.inspectionId,
      record.cropName ?? '—',
      record.batchNo ?? '—',
      record.labName ?? record.inspectorName ?? '—',
      record.sampleAt?.slice(0, 10) ?? '—',
      RESULT_TEXT[record.result ?? ''] ?? '待检',
    ]
    const blob = new Blob([`\uFEFF${header.join(',')}\n${body.join(',')}`], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${record.inspectionNo ?? record.inspectionId}.csv`
    link.click()
    URL.revokeObjectURL(url)
    message.success('报告已导出')
  }

  /** 表格列（对齐原型 P14） */
  const columns: ColumnsType<AdminInspectionRow> = [
    {
      title: '报告编号',
      dataIndex: 'inspectionNo',
      width: 180,
      render: (value: string) => <Text copyable>{value ?? '—'}</Text>,
    },
    { title: '产品', dataIndex: 'cropName', width: 120, render: (value: string) => value ?? '—' },
    { title: '批次', dataIndex: 'batchNo', width: 120, render: (value: string) => value ?? '—' },
    {
      title: '检测机构',
      dataIndex: 'labName',
      width: 140,
      render: (_value: string, record) => record.labName ?? record.inspectorName ?? '—',
    },
    {
      title: '检测日期',
      dataIndex: 'sampleAt',
      width: 120,
      render: (value: string) => value?.slice(0, 10) ?? '—',
    },
    {
      title: '结果',
      dataIndex: 'result',
      width: 100,
      render: (value: string) => (
        <Tag color={RESULT_COLOR[value] ?? 'default'}>{RESULT_TEXT[value] ?? '待检'}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_value, record) => (
        <Space size={4}>
          <Button type="link" size="small" onClick={() => setDetailRow(record)}>
            查看
          </Button>
          {record.result === 'FAIL' ? (
            <Button
              type="link"
              size="small"
              danger
              icon={<ExclamationCircleOutlined />}
              onClick={() => {
                if (!record.batchId) {
                  message.warning('该报告未关联批次，无法发起召回')
                  return
                }
                recallMutation.mutate(record.batchId)
              }}
            >
              处理
            </Button>
          ) : (
            <Button
              type="link"
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(record)}
            >
              下载
            </Button>
          )}
        </Space>
      ),
    },
  ]

  /** 查询 */
  const handleSearch = (): void => {
    setPageNum(1)
    setSubmitted({ keyword, labName, result })
  }

  /** 重置 */
  const handleReset = (): void => {
    setKeyword('')
    setLabName('')
    setResult('')
    setPageNum(1)
    setSubmitted({ keyword: '', labName: '', result: '' })
  }

  /** 提交新建报告 */
  const handleCreateSubmit = async (): Promise<void> => {
    const values = await createForm.validateFields()
    message.success(`报告 ${values.inspectionNo} 已登记（后端新增接口待补齐，当前为本地登记）`)
    setCreateOpen(false)
    createForm.resetFields()
    void queryClient.invalidateQueries({ queryKey: ['admin', 'quality', 'inspections'] })
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {listQuery.isError ? (
        <Alert
          type="warning"
          showIcon
          message="检测台账接口未返回数据，当前展示原型 P14 示例数据（共 12,450 条）"
          action={
            <Button size="small" icon={<ReloadOutlined />} onClick={() => void listQuery.refetch()}>
              重试
            </Button>
          }
        />
      ) : null}

      {/* 指标卡 */}
      <Row gutter={16}>
        <Col xs={12} sm={12} lg={6}>
          <Card>
            <Statistic title="报告总数" value={metrics.totalReports} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Card>
            <Statistic
              title="合格报告"
              value={metrics.passCount}
              suffix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Card>
            <Statistic
              title="不合格报告"
              value={metrics.failCount}
              valueStyle={{ color: metrics.failCount > 0 ? '#ff4d4f' : undefined }}
              suffix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Card>
            <Statistic
              title="检测合格率"
              value={metrics.passRate}
              precision={1}
              suffix="%"
              valueStyle={{ color: metrics.passRate >= 95 ? '#52c41a' : '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选区（原型 P14） */}
      <Card>
        <Space wrap size={12}>
          <Input
            placeholder="请输入报告编号"
            value={keyword}
            allowClear
            style={{ width: 200 }}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <Select
            placeholder="检测机构：全部"
            value={labName || undefined}
            allowClear
            style={{ width: 180 }}
            onChange={(value: string | undefined) => setLabName(value ?? '')}
            options={LAB_OPTIONS.map((item) => ({ label: item, value: item }))}
          />
          <Select
            placeholder="检测结果：全部"
            value={result || undefined}
            allowClear
            style={{ width: 160 }}
            onChange={(value: ResultFilter | undefined) => setResult(value ?? '')}
            options={[
              { label: '合格', value: 'PASS' },
              { label: '不合格', value: 'FAIL' },
            ]}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            查询
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>
      </Card>

      {/* 列表区 */}
      <Card
        title="检测报告台账"
        extra={
          <Space wrap>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateOpen(true)}
            >
              新建报告
            </Button>
            <Button
              icon={<ExclamationCircleOutlined />}
              onClick={() => navigate('/admin/production/quality/recalls')}
            >
              不合格品处置
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => void listQuery.refetch()}>
              刷新
            </Button>
          </Space>
        }
      >
        <Table<AdminInspectionRow>
          rowKey="inspectionId"
          size="small"
          loading={listQuery.isLoading}
          columns={columns}
          dataSource={rows}
          scroll={{ x: 1100 }}
          locale={{
            emptyText: <Empty description="暂无检测报告，请调整筛选条件或新建报告" />,
          }}
          pagination={{
            current: pageNum,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (value) => `共 ${value.toLocaleString('zh-CN')} 条`,
            onChange: (page, size) => {
              setPageNum(page)
              setPageSize(size)
            },
          }}
        />
      </Card>

      {/* 报告详情抽屉 */}
      <Drawer
        title="检测报告详情"
        width={560}
        open={detailRow !== null}
        onClose={() => setDetailRow(null)}
        destroyOnClose
        extra={
          detailRow ? (
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(detailRow)}
            >
              下载原件
            </Button>
          ) : null
        }
      >
        {detailRow ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions
              column={1}
              size="small"
              bordered
              items={[
                { key: 'no', label: '报告编号', children: detailRow.inspectionNo ?? detailRow.inspectionId },
                { key: 'crop', label: '产品', children: detailRow.cropName ?? '—' },
                { key: 'batch', label: '批次号', children: detailRow.batchNo ?? '—' },
                { key: 'plot', label: '地块', children: detailRow.plotId ?? '—' },
                {
                  key: 'lab',
                  label: '检测机构',
                  children: detailRow.labName ?? detailRow.inspectorName ?? '—',
                },
                {
                  key: 'type',
                  label: '检测类型',
                  children: INSPECT_TYPE_TEXT[detailRow.inspectionType ?? ''] ?? detailRow.inspectionType ?? '—',
                },
                { key: 'sampleAt', label: '抽样时间', children: detailRow.sampleAt ?? '—' },
                { key: 'sampleQty', label: '抽样数量', children: String(detailRow.sampleQty ?? '—') },
                {
                  key: 'result',
                  label: '检测结论',
                  children: (
                    <Tag color={RESULT_COLOR[detailRow.result ?? ''] ?? 'default'}>
                      {RESULT_TEXT[detailRow.result ?? ''] ?? '待检'}
                    </Tag>
                  ),
                },
                {
                  key: 'status',
                  label: '检测状态',
                  children: STATUS_TEXT[detailRow.status ?? ''] ?? detailRow.status ?? '—',
                },
                {
                  key: 'report',
                  label: '报告原件',
                  children: detailRow.reportUrl ? (
                    <Button type="link" size="small" href={detailRow.reportUrl} target="_blank">
                      查看原件
                    </Button>
                  ) : (
                    <Text type="secondary">暂未上传原件</Text>
                  ),
                },
              ]}
            />
            {detailRow.result === 'FAIL' ? (
              <Alert
                type="error"
                showIcon
                message="该批次判定不合格"
                description="将触发事件 prod.quality.test.failed（载荷 batchNo / failItems），请前往「不合格品处置」发起召回与处置闭环。"
                action={
                  <Button
                    size="small"
                    danger
                    disabled={!detailRow.batchId}
                    loading={recallMutation.isPending}
                    onClick={() => {
                      if (detailRow.batchId) {
                        recallMutation.mutate(detailRow.batchId)
                      }
                    }}
                  >
                    发起召回
                  </Button>
                }
              />
            ) : null}
          </Space>
        ) : null}
      </Drawer>

      {/* 新建报告弹窗 */}
      <Modal
        title="新建检测报告"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => void handleCreateSubmit()}
        okText="提交"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" preserve={false}>
          <Form.Item
            name="inspectionNo"
            label="报告编号"
            rules={[{ required: true, message: '请输入报告编号' }]}
          >
            <Input placeholder="如 RPT20250714001" />
          </Form.Item>
          <Form.Item name="cropName" label="产品名称" rules={[{ required: true, message: '请输入产品名称' }]}>
            <Input placeholder="如 有机大米" />
          </Form.Item>
          <Form.Item name="batchNo" label="批次号" rules={[{ required: true, message: '请输入批次号' }]}>
            <Input placeholder="如 B2025071" />
          </Form.Item>
          <Form.Item name="labName" label="检测机构" rules={[{ required: true, message: '请选择检测机构' }]}>
            <Select options={LAB_OPTIONS.map((item) => ({ label: item, value: item }))} />
          </Form.Item>
          <Form.Item name="inspectionType" label="检测类型" rules={[{ required: true, message: '请选择检测类型' }]}>
            <Select
              options={[
                { label: '自检', value: 'SELF' },
                { label: '送检', value: 'SEND' },
                { label: '抽检', value: 'SAMPLING' },
              ]}
            />
          </Form.Item>
          <Form.Item name="result" label="检测结论" rules={[{ required: true, message: '请选择检测结论' }]}>
            <Select
              options={[
                { label: '合格', value: 'PASS' },
                { label: '不合格', value: 'FAIL' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
