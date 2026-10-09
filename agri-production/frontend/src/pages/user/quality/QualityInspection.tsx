/**
 * 页面名称：质量检测管理
 * 路由路径：/production/quality
 * 所属模块：质量检测与溯源
 * PRD 序号：PRD 6.1 #34
 * 原型来源：用户端原型 P25 trace-inspections
 *
 * 还原要点：
 * - 标题 🔬 质量检测记录 + `+ 录入检测报告` 按钮
 * - 统计：合格 / 不合格 / 待检（数据源 GET /quality/grading）
 * - 筛选：全部结果（合格 / 不合格 / 待检）+ 全部机构 + 搜索检测编号
 * - 表格列：检测编号 | 产品名称 | 批次号 | 检测项目 | 检测机构 | 检测日期 | 结果 | 上链 | 操作
 * - 行操作：报告（→trace-reports）/ 结果录入（PASS、FAIL）/ 明细 / 删除
 * - 结论提交后端联动领域事件：PASS → prod.quality.test.passed，FAIL → prod.quality.test.failed
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageContainer, ProTable } from '@ant-design/pro-components'
import type { ProColumns } from '@ant-design/pro-components'
import {
  AutoComplete,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
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
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { Dayjs } from 'dayjs'
import { DeleteOutlined, FileTextOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import useFarmStore from '@/store/farm'
import {
  deleteInspection,
  fetchGradingStats,
  fetchInspectionItems,
  fetchInspectionPage,
  fetchLabPage,
  registerInspection,
  submitInspectionResult,
} from '@/api/quality'
import { listHarvests } from '@/api/harvests'
import type { HarvestBatch, InspectionItem, RawInspection, TestingLab } from '@/types'

/** 列表一次性拉取上限（后端未提供结果 / 机构过滤，二者在前端二次过滤） */
const MAX_FETCH_SIZE = 200

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

/** 列表筛选条件 */
interface InspectionFilters {
  /** 检测单号关键字（服务端） */
  keyword?: string
  /** 结果筛选（前端） */
  result?: string
  /** 检测机构（前端） */
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
  const [filters, setFilters] = useState<InspectionFilters>({})
  const [filterForm] = Form.useForm<InspectionFilters>()

  const [createOpen, setCreateOpen] = useState<boolean>(false)
  const [createForm] = Form.useForm<InspectionFormValues>()
  const [resultTarget, setResultTarget] = useState<RawInspection | null>(null)
  const [resultForm] = Form.useForm<ResultFormValues>()
  const [detailId, setDetailId] = useState<string>('')

  /** 检测单列表 */
  const listQuery = useQuery({
    queryKey: ['quality-inspections', filters.keyword],
    enabled: Boolean(farmId),
    queryFn: () =>
      fetchInspectionPage({
        keyword: filters.keyword,
        pageNum: 1,
        pageSize: MAX_FETCH_SIZE,
      }),
  })

  /** 检测单总量 */
  const totalQuery = useQuery({
    queryKey: ['quality-inspections-total'],
    enabled: Boolean(farmId),
    queryFn: () => fetchInspectionPage({ pageNum: 1, pageSize: 1 }),
  })

  /** 分级统计（PASS / FAIL） */
  const statsQuery = useQuery({
    queryKey: ['quality-grading-stats'],
    enabled: Boolean(farmId),
    queryFn: () => fetchGradingStats(),
  })

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

  /** 前端过滤后的列表 */
  const filteredList = useMemo<RawInspection[]>(() => {
    const result = filters.result
    const labName = (filters.labName ?? '').trim()
    return (listQuery.data?.list ?? []).filter((item) => {
      if (result && result !== 'all') {
        const actual = item.result ?? (item.status === 'DONE' ? undefined : 'PENDING')
        if (result === 'PENDING') {
          if (item.result === 'PASS' || item.result === 'FAIL') return false
        } else if (actual !== result) {
          return false
        }
      }
      if (labName && String(item.labName ?? '') !== labName) return false
      return true
    })
  }, [listQuery.data, filters.result, filters.labName])

  /** 统一失效刷新 */
  const invalidateAll = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ['quality-inspections'] })
    await queryClient.invalidateQueries({ queryKey: ['quality-inspections-total'] })
    await queryClient.invalidateQueries({ queryKey: ['quality-grading-stats'] })
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
    onError: () => {
      message.error('登记失败，请检查检测单号是否重复')
    },
  })

  /** 结论录入 */
  const resultMutation = useMutation({
    mutationFn: (params: { inspectionId: string; result: string; reportUrl?: string }) =>
      submitInspectionResult(params.inspectionId, params.result, params.reportUrl),
    onSuccess: (_data, variables) => {
      message.success(
        variables.result === 'PASS'
          ? '已登记合格结论，并发布 prod.quality.test.passed'
          : '已登记不合格结论，并发布 prod.quality.test.failed',
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
        if (record.result === 'PASS') return <Tag color="green">✅ 合格</Tag>
        if (record.result === 'FAIL') return <Tag color="red">❌ 不合格</Tag>
        return <Tag>⏳ 待检</Tag>
      },
    },
    {
      title: '上链',
      key: 'onChain',
      width: 110,
      render: (_, record) =>
        record.onChain ? <Tag color="green">🔗 已上链</Tag> : <Tag>⏳ 待上链</Tag>,
    },
    {
      title: '操作',
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

  /** 待检数量 */
  const pendingCount = Math.max(
    (totalQuery.data?.total ?? 0) -
      Number(statsQuery.data?.PASS ?? 0) -
      Number(statsQuery.data?.FAIL ?? 0),
    0,
  )

  return (
    <PageContainer
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
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card loading={statsQuery.isFetching}>
            <Statistic
              title="合格"
              value={Number(statsQuery.data?.PASS ?? 0)}
              suffix="单"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card loading={statsQuery.isFetching}>
            <Statistic
              title="不合格"
              value={Number(statsQuery.data?.FAIL ?? 0)}
              suffix="单"
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card loading={totalQuery.isFetching || statsQuery.isFetching}>
            <Statistic title="待检" value={pendingCount} suffix="单" />
          </Card>
        </Col>
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
        dataSource={filteredList}
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
          total: filteredList.length,
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

      <Modal
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

      <Modal
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

      <Drawer
        title="检测项明细"
        width={720}
        open={Boolean(detailId)}
        onClose={() => setDetailId('')}
      >
        {detailQuery.isError ? (
          <Typography.Text type="danger">明细加载失败，请稍后重试</Typography.Text>
        ) : (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="检测编号">
                {detailQuery.data?.inspectionNo ?? detailId}
              </Descriptions.Item>
              <Descriptions.Item label="检测类型">
                {INSPECT_TYPE_TEXT[String(detailQuery.data?.inspectionType)] ??
                  detailQuery.data?.inspectionType ??
                  '—'}
              </Descriptions.Item>
              <Descriptions.Item label="检测项目">
                {detailQuery.data?.item ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="检测结论">
                {detailQuery.data?.result === 'PASS' ? (
                  <Tag color="green">合格</Tag>
                ) : detailQuery.data?.result === 'FAIL' ? (
                  <Tag color="red">不合格</Tag>
                ) : (
                  <Tag>待检</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="检测单状态" span={2}>
                {detailQuery.data?.status ?? '—'}
              </Descriptions.Item>
            </Descriptions>
            <Table<InspectionItem>
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
