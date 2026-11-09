import '@/pages/user/quality/quality-trace.css'
import BusinessRecordList from '@/components/BusinessRecordList'
import DetailInfoGrid from '@/components/DetailInfoGrid'
import Card from '@/components/SectionCard'
import ProTable from '@/components/ProductionTable'
/**
 * 页面名称：质量检测管理
 * 路由路径：/production/quality
 * 所属模块：质量检测与溯源
 * PRD 序号：PRD 6.1 #34
 * 原型来源：用户端原型 P25 trace-inspections
 *
 * 还原要点：
 * - 标题 🔬 质量检测记录 + `+ 录入检测报告` 按钮
 * - 统计：合格 / 不合格 / 待检 / 检测中（当前农场服务端分页总数）
 * - 筛选：全部结果（合格 / 不合格 / 待检）+ 全部机构 + 搜索检测编号
 * - 表格列：检测编号 | 产品名称 | 批次号 | 检测项目 | 检测机构 | 检测日期 | 结果 | 上链 | 操作
 * - 行操作：报告（→trace-reports）/ 结果录入（PASS、FAIL）/ 明细 / 删除
 * - 结论提交后端联动领域事件：PASS → prod.quality.test.passed，FAIL → prod.quality.test.failed
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'

import PageContainer from '@/components/ProductionPageContainer'
import type { ProColumns } from '@ant-design/pro-components'
import {
  Alert,
  AutoComplete,
  Button,
  Col,
  DatePicker,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd'
import type { Dayjs } from 'dayjs'
import { DeleteOutlined, FileTextOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import useFarmStore from '@/store/farm'
import {
  deleteInspection,
  fetchInspectionItems,
  fetchInspectionPage,
  fetchLabPage,
  registerInspection,
  submitInspectionResult,
} from '@/api/quality'
import { listHarvests } from '@/api/harvests'
import { listBlockchainByBiz } from '@/api/blockchain'
import type {
  BlockchainBizRecord,
  HarvestBatch,
  InspectionItem,
  RawInspection,
  TestingLab,
} from '@/types'

/** 检测类型选项 */
const INSPECT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'SELF', label: '自检' },
  { value: 'SEND', label: '送检' },
  { value: 'SAMPLING', label: '抽检' },
]

/** 检测类型展示文案 */
const INSPECT_TYPE_TEXT: Record<string, string> = {
  SELF: '自检',
  SEND: '送检',
  SAMPLING: '抽检',
}

/** 检测单状态选项 */
const INSPECT_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'PENDING', label: '待检' },
  { value: 'TESTING', label: '检测中' },
  { value: 'DONE', label: '已完成' },
]

/** 结果筛选选项 */
const RESULT_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: '全部结果' },
  { value: 'PASS', label: '合格' },
  { value: 'FAIL', label: '不合格' },
  { value: 'PENDING', label: '待检' },
]

/** 送检登记表单值 */
interface InspectionFormValues {
  /** 检测单号 */
  inspectionNo: string
  /** 关联批次 */
  batchId?: string
  /** 地块 */
  plotId?: string
  /** 作物 */
  cropId?: string
  /** 检测类型 */
  inspectionType: string
  /** 检测机构名称 */
  labName?: string
  /** 检测人 */
  inspectorName?: string
  /** 抽样数量 */
  sampleQty?: number
  /** 抽样时间 */
  sampleAt?: Dayjs
  /** 报告附件地址 */
  reportUrl?: string
  /** 检测单状态 */
  status: string
}

/** 结果录入表单值 */
interface ResultFormValues {
  /** 检测结论 */
  result: string
  /** 报告附件地址 */
  reportUrl?: string
}

/**
 * 列表筛选条件（全部在服务端生效）
 *
 * <p>注释里标的"（前端）"是旧口径的遗留：结果与机构以前在浏览器里筛那 200 条，
 * 表格再本地翻页。200 条一填满，"待检"就筛不出东西、换机构毫无反应 —— 看着像数据没了。
 * 现在三个条件都进请求。</p>
 */
interface InspectionFilters {
  /** 检测单号 / 批次号 / 作物名 关键字（服务端） */
  keyword?: string
  /** 结果（服务端）：PASS / FAIL / PENDING；'all' 表示不筛这一项 */
  result?: string
  /** 检测机构全名（服务端精确匹配） */
  labName?: string
}

/** 仅保留日期 */
function formatDate(value?: string): string {
  if (!value) return '-'
  const date = dayjs(value)
  return date.isValid() ? date.format('YYYY-MM-DD') : value
}

/**
 * 质量检测记录页
 *
 * 业务职责：检测任务台账，支持送检登记、结论录入（合格 / 不合格）、明细查看与报告跳转。
 *
 * @returns 页面内容
 */
export default function QualityInspection(): JSX.Element {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentFarm = useFarmStore((state) => state.currentFarm)
  const farmId = currentFarm?.farmId

  const [pageNum, setPageNum] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)
  /**
   * 支持从存证列表带 `?keyword=<质检单号>` 跳进来（存证的 target_code 就是检测单号）。
   * 没有这个入口时，从一条存证回不到它对应的那张检测单。
   */
  const [searchParams] = useSearchParams()
  const initialKeyword = searchParams.get('keyword') ?? ''
  const [filters, setFilters] = useState<InspectionFilters>(() =>
    initialKeyword ? { keyword: initialKeyword } : {},
  )
  const [filterForm] = Form.useForm<InspectionFilters>()
  useEffect(() => {
    if (initialKeyword) {
      filterForm.setFieldsValue({ keyword: initialKeyword })
    }
  }, [initialKeyword, filterForm])

  const [createOpen, setCreateOpen] = useState<boolean>(false)
  const [createForm] = Form.useForm<InspectionFormValues>()
  const [resultTarget, setResultTarget] = useState<RawInspection | null>(null)
  const [resultForm] = Form.useForm<ResultFormValues>()
  const [detailId, setDetailId] = useState<string>('')

  /**
   * 检测单列表：筛选与分页都在服务端。
   *
   * <p>{@code 'all'} 是"全部结果"那个选项的值，**不能发给后端**——发过去就成了
   * {@code result='all'} 的等值筛选，一条都不剩。这里就地折成"不筛这一项"。</p>
   */
  const listQuery = useQuery({
    queryKey: ['quality-inspections', farmId, filters, pageNum, pageSize],
    enabled: Boolean(farmId),
    queryFn: () =>
      fetchInspectionPage({
        farmId,
        keyword: filters.keyword?.trim() || undefined,
        result: filters.result && filters.result !== 'all' ? filters.result : undefined,
        labName: filters.labName?.trim() || undefined,
        pageNum,
        pageSize,
      }),
  })

  /** 当前农场全量检测状态统计，不受下方列表筛选影响。 */
  const inspectionStats = useQueries({
    queries: [
      { label: '合格', status: 'DONE', result: 'PASS', color: '#52c41a' },
      { label: '不合格', status: 'DONE', result: 'FAIL', color: '#ff4d4f' },
      { label: '待检', status: 'PENDING', result: undefined, color: undefined },
      { label: '检测中', status: 'TESTING', result: undefined, color: undefined },
    ].map((item) => ({
      queryKey: ['quality-inspections-stats', farmId, item.status, item.result],
      enabled: Boolean(farmId),
      queryFn: () => fetchInspectionPage({ farmId, status: item.status, result: item.result, pageNum: 1, pageSize: 1 }),
      select: (page: Awaited<ReturnType<typeof fetchInspectionPage>>) => ({ ...item, count: page.total }),
    })),
  })

  useEffect(() => {
    setPageNum(1)
    setDetailId('')
    setCreateOpen(false)
    setResultTarget(null)
    createForm.resetFields()
    resultForm.resetFields()
  }, [farmId, createForm, resultForm])

  /** 检测机构下拉 */
  const labQuery = useQuery({
    queryKey: ['quality-lab-options'],
    enabled: Boolean(farmId),
    queryFn: () => fetchLabPage({ pageNum: 1, pageSize: 100 }),
  })

  /** 采收批次下拉 */
  const batchQuery = useQuery({
    queryKey: ['harvest-batch-options', farmId],
    enabled: Boolean(farmId),
    queryFn: () => listHarvests({ farmId, pageNum: 1, pageSize: 100 }),
  })

  /** 检测项明细 */
  const detailQuery = useQuery({
    queryKey: ['quality-inspection-items', detailId],
    enabled: Boolean(detailId),
    queryFn: () => fetchInspectionItems(detailId),
  })

  /** 当前列表的检测单号（存证域 INSPECTION 类按单号关联，非 inspectionId） */
  const inspectionNos = useMemo<string[]>(
    () =>
      (listQuery.data?.list ?? [])
        .map((item) => String(item.inspectionNo ?? item.inspectionId ?? ''))
        .filter((item) => item !== ''),
    [listQuery.data],
  )

  /** 存证域：逐条按检测单号查上链存证（GET /blockchain/by-biz，裸数组，无记录返回 []） */
  const anchorQueries = useQueries({
    queries: inspectionNos.map((bizNo) => ({
      queryKey: ['blockchain-by-biz', 'INSPECTION', bizNo],
      enabled: Boolean(bizNo),
      retry: false,
      queryFn: () => listBlockchainByBiz({ bizType: 'INSPECTION' as const, bizNo }),
    })),
  })

  /** 检测单号 → 存证记录（同单号多条时取第一条） */
  const anchorMap = useMemo(() => {
    const map = new Map<string, BlockchainBizRecord>()
    anchorQueries.forEach((query) => {
      ;(query.data ?? []).forEach((record) => {
        const key = String(record.bizNo ?? '')
        if (key !== '' && !map.has(key)) {
          map.set(key, record)
        }
      })
    })
    return map
  }, [anchorQueries])

  /** 存证查询是否仍在进行（进行中不渲染结论，避免把「还没查到」显示成「无存证」） */
  const anchorLoading = anchorQueries.some((query) => query.isFetching)

  /** 机构下拉选项 */
  const labOptions = useMemo(
    () =>
      (labQuery.data?.list ?? []).map((lab: TestingLab) => ({
        value: lab.labName,
        label: lab.labName,
      })),
    [labQuery.data],
  )

  /** 批次下拉选项 */
  const batchOptions = useMemo(
    () =>
      (batchQuery.data?.list ?? []).map((batch: HarvestBatch) => ({
        value: String(batch.batchId),
        label: `${batch.batchNo ?? batch.batchId} · ${batch.cropName ?? batch.cropId ?? '未知名产品'}`,
      })),
    [batchQuery.data],
  )

  /** 当前页数据（服务端已按结果/机构/关键字筛好并切好页，这里不再本地二次过滤或本地翻页） */
  const pageRows = useMemo<RawInspection[]>(() => listQuery.data?.list ?? [], [listQuery.data])

  /** 统一失效刷新 */
  const invalidateAll = async (): Promise<void> => {
    await Promise.all(['harvests', 'harvest-batch-options', 'inventories', 'inventory', 'trace-codes'].map(key => queryClient.invalidateQueries({ queryKey: [key] })))
    await queryClient.invalidateQueries({ queryKey: ['quality-inspections'] })
    await queryClient.invalidateQueries({ queryKey: ['quality-inspections-stats'] })
  }

  /** 送检登记 */
  const createMutation = useMutation({
    mutationFn: (payload: Partial<RawInspection>) => registerInspection(payload),
    onSuccess: () => {
      message.success('检测报告已登记')
      setCreateOpen(false)
      createForm.resetFields()
      void invalidateAll()
    },
    onError: (error: Error) => {
      message.error(error.message || '登记失败')
    },
  })

  /** 结论录入 */
  const resultMutation = useMutation({
    mutationFn: (params: { inspectionId: string; result: string; reportUrl?: string }) =>
      submitInspectionResult(params.inspectionId, params.result, params.reportUrl),
    onSuccess: (_data, variables) => {
      message.success(
        variables.result === 'PASS'
          ? '合格结论已保存'
          : '不合格结论已保存，关联批次及库存已冻结',
      )
      setResultTarget(null)
      resultForm.resetFields()
      void invalidateAll()
    },
  })

  /** 删除检测单 */
  const deleteMutation = useMutation({
    mutationFn: (inspectionId: string) => deleteInspection(inspectionId),
    onSuccess: () => {
      message.success('检测单已删除')
      void invalidateAll()
    },
  })

  /** 打开送检登记弹窗 */
  const openCreate = (): void => {
    setCreateOpen(true)
  }

  /** 提交送检登记 */
  const submitCreate = (): void => {
    void createForm.validateFields().then((values) => {
      const lab = (labQuery.data?.list ?? []).find(
        (item: TestingLab) => item.labName === values.labName,
      )
      createMutation.mutate({
        inspectionNo: values.inspectionNo,
        batchId: values.batchId ? String(values.batchId).trim() : undefined,
        plotId: values.plotId,
        cropId: values.cropId,
        inspectionType: values.inspectionType,
        inspectorName: values.inspectorName,
        sampleQty: values.sampleQty,
        sampleAt: values.sampleAt ? values.sampleAt.format('YYYY-MM-DDTHH:mm:ss') : undefined,
        reportUrl: values.reportUrl,
        status: values.status,
        labId: lab?.labId,
        labName: values.labName,
      })
    })
  }

  /** 提交结论 */
  const submitResult = (): void => {
    if (!resultTarget) return
    void resultForm.validateFields().then((values) => {
      resultMutation.mutate({
        inspectionId: resultTarget.inspectionId,
        result: values.result,
        reportUrl: values.reportUrl,
      })
    })
  }

  /** 查询 */
  const handleSearch = (): void => {
    setFilters(filterForm.getFieldsValue())
    setPageNum(1)
  }

  /** 重置 */
  const handleReset = (): void => {
    filterForm.resetFields()
    setFilters({})
    setPageNum(1)
  }

  /** 表格列定义 */
  const columns: ProColumns<RawInspection>[] = [
    {
      title: '检测编号',
      dataIndex: 'inspectionNo',
      width: 180,
      render: (_, record) => record.inspectionNo ?? record.inspectionId,
    },
    {
      title: '产品名称',
      key: 'cropName',
      width: 130,
      render: (_, record) => record.cropName ?? record.cropId ?? '-',
    },
    {
      title: '批次号',
      key: 'batchNo',
      width: 140,
      render: (_, record) => record.batchNo ?? record.batchId ?? '-',
    },
    {
      title: '检测项目',
      key: 'inspectionType',
      width: 140,
      render: (_, record) => (
        <Tag color="geekblue">
          {INSPECT_TYPE_TEXT[String(record.inspectionType)] ?? record.inspectionType ?? '—'}
        </Tag>
      ),
    },
    {
      title: '检测机构',
      dataIndex: 'labName',
      width: 140,
      render: (_, record) => record.labName ?? '—',
    },
    {
      title: '检测日期',
      dataIndex: 'sampleAt',
      width: 120,
      render: (_, record) => formatDate(record.sampleAt ?? record.createdAt),
    },
    {
      title: '结果',
      key: 'result',
      width: 130,
      render: (_, record) => {
        if (record.status === 'TESTING') return <Tag color="processing">检测中</Tag>
        if (record.status === 'PENDING') return <Tag>待检</Tag>
        if (record.result === 'PASS') return <Tag color="green">✅ 合格</Tag>
        if (record.result === 'FAIL') return <Tag color="red">❌ 不合格</Tag>
        return <Tag>⏳ 待检</Tag>
      },
    },
    {
      // 上链状态取自存证域 GET /blockchain/by-biz（bizType=INSPECTION、bizNo=检测单号），
      // 连服实测 DEMO-INSPC-001 能查到 SUCCESS 记录。
      // 旧实现读后端不存在的 record.onChain，把 undefined 当 false 渲染成「⏳ 待上链」，
      // 是没有依据的业务结论；现改为查存证域取真值，无记录时显示「无存证」。
      title: (
        <Tooltip title="上链状态取自存证域 /blockchain/by-biz（按检测单号关联）：已上链=存证 SUCCESS、待上链=存证 PENDING、无存证=查过存证域但无匹配记录">
          上链 🔗
        </Tooltip>
      ),
      key: 'onChain',
      width: 110,
      render: (_, record) => {
        if (anchorLoading) {
          return <Typography.Text type="secondary">查询中…</Typography.Text>
        }
        const anchor = anchorMap.get(String(record.inspectionNo ?? record.inspectionId ?? ''))
        if (!anchor) {
          return <Typography.Text type="secondary">无存证</Typography.Text>
        }
        if (anchor.status === 'SUCCESS') {
          // 交易哈希挂在 span 的原生 title 上：列宽只有 110px 放不下完整哈希，
          // 但哈希必须让用户取得到（hover 可见），同时也是「这条是真存证」的凭据。
          const blockText =
            anchor.blockHeight == null ? '' : ` · 区块高度 ${String(anchor.blockHeight)}`
          return (
            <Tooltip title={anchor.txHash ? `交易哈希 ${anchor.txHash}${blockText}` : '存证已确认'}>
              <span title={anchor.txHash ? `交易哈希 ${anchor.txHash}${blockText}` : undefined}>
                <Tag color="green">🔗 已上链</Tag>
              </span>
            </Tooltip>
          )
        }
        return <Tag>⏳ 待上链</Tag>
      },
    },
    {
      title: '操作',
      fixed: 'right',
      key: 'option',
      width: 260,
      valueType: 'option',
      render: (_, record) => [
        <Typography.Link
          key="report"
          onClick={() =>
            navigate(
              `/production/trace/reports?batchId=${encodeURIComponent(String(record.batchId ?? ''))}`,
            )
          }
        >
          报告→
        </Typography.Link>,
        <Typography.Link
          key="result"
          onClick={() => setResultTarget(record)}
        >
          结果录入
        </Typography.Link>,
        <Typography.Link
          key="detail"
          onClick={() => setDetailId(record.inspectionId)}
        >
          明细
        </Typography.Link>,
        <Popconfirm
          key="delete"
          title="确认删除该检测单？"
          okText="确认删除"
          cancelText="取消"
          onConfirm={() => deleteMutation.mutate(record.inspectionId)}
        >
          <Typography.Link type="danger">删除</Typography.Link>
        </Popconfirm>,
      ],
    },
  ]

  /** 明细中的检测项列表（后端返回 Map 结构，兼容未来返回数组） */
  const detailItems = useMemo<InspectionItem[]>(() => {
    const data = detailQuery.data
    if (!data) return []
    if (Array.isArray(data.items) && data.items.length > 0) return data.items
    return [
      {
        itemId: 'summary',
        inspectionId: String(data.inspectionId ?? ''),
        itemName: data.item ?? data.inspectionType ?? '综合检测',
        standardLimit: '按国家食品安全标准',
        measuredValue: data.result === 'PASS' ? '未超标' : data.result === 'FAIL' ? '超标' : '待检',
        unit: '',
        qualified: data.result === 'PASS',
      },
    ]
  }, [detailQuery.data])

  return (
    <PageContainer className="quality-trace-page"
      title="🔬 质量检测记录"
      subTitle={currentFarm ? currentFarm.farmName : undefined}
      extra={[
        <Button key="create" type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          + 录入检测报告
        </Button>,
        <Button
          key="reload"
          icon={<ReloadOutlined />}
          onClick={() => {
            void invalidateAll()
          }}
        >
          刷新
        </Button>,
      ]}
    >
      <Typography.Paragraph type="secondary">统计范围：当前农场全部检测单；合格、不合格仅统计已完成检测，待检与检测中分别按实际状态统计，不受下方列表筛选影响。</Typography.Paragraph>
      {inspectionStats.some((query) => query.isError) && <Alert type="error" showIcon message="检测统计读取失败，未取得的数量显示为 —" action={<Button onClick={() => void invalidateAll()}>重试</Button>} style={{ marginBottom: 16 }} />}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {inspectionStats.map((query, index) => (
          <Col xs={12} lg={6} key={index}>
            <Card loading={query.isFetching}>
              <Statistic title={['合格', '不合格', '待检', '检测中'][index]} value={query.isError || !query.data ? '—' : query.data.count} suffix="单" valueStyle={{ color: query.data?.color }} />
            </Card>
          </Col>
        ))}
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Form form={filterForm} layout="inline" style={{ rowGap: 12 }}>
          <Form.Item name="result" label="结果">
            <Select
              allowClear
              placeholder="全部结果"
              options={RESULT_OPTIONS}
              style={{ width: 130 }}
            />
          </Form.Item>
          <Form.Item name="labName" label="机构">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="全部机构"
              options={labOptions}
              style={{ width: 170 }}
            />
          </Form.Item>
          <Form.Item name="keyword" label="检测编号">
            <Input allowClear placeholder="搜索检测编号..." style={{ width: 200 }} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" onClick={handleSearch}>
                查询
              </Button>
              <Button onClick={handleReset}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <ProTable<RawInspection>
        rowKey="inspectionId"
        size="small"
        columns={columns}
        dataSource={pageRows}
        loading={listQuery.isFetching}
        search={false}
        options={{
          reload: () => {
            void invalidateAll()
          },
          density: true,
          setting: true,
        }}
        pagination={{
          current: pageNum,
          pageSize,
          // 总数只认服务端给的（以前是 filteredList.length —— 本地筛完的那一批的长度，
          // 与"共 N 条"这句话的含义不一致，翻页器也就成了摆设）
          total: listQuery.data?.total ?? 0,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (nextPage, nextSize) => {
            setPageNum(nextPage)
            setPageSize(nextSize)
          },
        }}
        toolBarRender={() => [
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            + 录入检测报告
          </Button>,
        ]}
      />

      <Modal className="quality-trace-dialog"
        title="录入检测报告"
        open={createOpen}
        okText="确认登记"
        cancelText="取消"
        width={720}
        confirmLoading={createMutation.isPending}
        destroyOnClose
        onOk={submitCreate}
        onCancel={() => setCreateOpen(false)}
      >
        <Form
          form={createForm}
          layout="vertical"
          style={{ marginTop: 16 }}
          initialValues={{
            inspectionNo: `INS${dayjs().format('YYYYMMDDHHmmss')}`,
            inspectionType: 'SEND',
            status: 'PENDING',
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="inspectionNo"
                label="检测编号"
                rules={[{ required: true, message: '请输入检测编号' }]}
              >
                <Input placeholder="如 INS20260601001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="batchId" label="关联批次">
                <AutoComplete
                  options={batchOptions}
                  placeholder="选择或输入采收批次 ID"
                  filterOption={(input, option) =>
                    String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="inspectionType" label="检测类型" rules={[{ required: true }]}>
                <Select options={INSPECT_TYPE_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="labName"
                label="检测机构"
                extra="后端 prod_inspection 暂无机构字段，暂不回显"
              >
                <AutoComplete
                  options={labOptions}
                  placeholder="选择或输入检测机构"
                  filterOption={(input, option) =>
                    String(option?.value ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="inspectorName" label="检测人">
                <Input placeholder="如 张三" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sampleQty" label="抽样数量">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sampleAt" label="抽样时间">
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="检测状态">
                <Select options={INSPECT_STATUS_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="plotId" label="地块 ID">
                <Input placeholder="可空" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="cropId" label="作物 ID">
                <Input placeholder="可空" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="reportUrl" label="报告附件地址">
                <Input placeholder="https://..." />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal className="quality-trace-dialog"
        title={`结果录入：${resultTarget?.inspectionNo ?? resultTarget?.inspectionId ?? ''}`}
        open={Boolean(resultTarget)}
        okText="确认提交"
        cancelText="取消"
        confirmLoading={resultMutation.isPending}
        destroyOnClose
        onOk={submitResult}
        onCancel={() => setResultTarget(null)}
      >
        <Form
          form={resultForm}
          layout="vertical"
          style={{ marginTop: 16 }}
          initialValues={{
            result: resultTarget?.result === 'FAIL' ? 'FAIL' : 'PASS',
            reportUrl: resultTarget?.reportUrl,
          }}
        >
          <Form.Item
            name="result"
            label="检测结论"
            rules={[{ required: true, message: '请选择检测结论' }]}
          >
            <Select
              options={[
                { value: 'PASS', label: '合格' },
                { value: 'FAIL', label: '不合格' },
              ]}
            />
          </Form.Item>
          <Form.Item name="reportUrl" label="报告附件地址">
            <Input placeholder="https://..." />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer rootClassName="quality-trace-dialog"
        title="检测项明细"
        width={720}
        open={Boolean(detailId)}
        onClose={() => setDetailId('')}
      >
        {detailQuery.isError ? (
          <Typography.Text type="danger">明细加载失败，请稍后重试</Typography.Text>
        ) : (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <DetailInfoGrid columns={2} items={[
{ label: '检测编号', value: <>{detailQuery.data?.inspectionNo ?? detailId}</> },
{ label: '检测类型', value: <>{INSPECT_TYPE_TEXT[String(detailQuery.data?.inspectionType)] ??
                  detailQuery.data?.inspectionType ??
                  '—'}</> },
{ label: '检测项目', value: <>{detailQuery.data?.item ?? '—'}</> },
{ label: '检测结论', value: <>{detailQuery.data?.result === 'PASS' ? (
                  <Tag color="green">合格</Tag>
                ) : detailQuery.data?.result === 'FAIL' ? (
                  <Tag color="red">不合格</Tag>
                ) : (
                  <Tag>待检</Tag>
                )}</> },
{ label: '检测单状态', value: <>{detailQuery.data?.status ?? '—'}</>, fullWidth: true }
]} />
            <BusinessRecordList<InspectionItem>
              rowKey="itemId"
              size="small"
              loading={detailQuery.isFetching}
              dataSource={detailItems}
              pagination={false}
              locale={{ emptyText: '暂无检测项明细' }}
              columns={[
                { title: '检测项', dataIndex: 'itemName' },
                { title: '标准限值', dataIndex: 'standardLimit' },
                { title: '实测值', dataIndex: 'measuredValue' },
                { title: '单位', dataIndex: 'unit', render: (value) => value || '—' },
                {
                  title: '是否达标',
                  dataIndex: 'qualified',
                  render: (value: boolean) =>
                    value ? <Tag color="green">达标</Tag> : <Tag color="red">不达标</Tag>,
                },
              ]}
            />
            <Button
              icon={<FileTextOutlined />}
              onClick={() =>
                navigate(`/production/trace/reports?batchId=${encodeURIComponent(
                  String(
                    (listQuery.data?.list ?? []).find((item) => item.inspectionId === detailId)
                      ?.batchId ?? '',
                  ),
                )}`)
              }
            >
              查看溯源报告
            </Button>
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                deleteMutation.mutate(detailId)
                setDetailId('')
              }}
            >
              删除该检测单
            </Button>
          </Space>
        )}
      </Drawer>
    </PageContainer>
  )
}
