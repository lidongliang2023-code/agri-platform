/**
 * 页面名称：地块采收记录
 * 路由路径：/production/harvests/plan
 * 所属模块：采收与库存管理
 *
 * ⚠️ 语义说明：
 * 本页后端端点 `GET /harvests/plan` 虽然叫 plan，但语义是「**按地块聚合已发生的采收记录**」，
 * **不是**「待执行的采收计划」。库里不存在 `prod_harvest_plan` 表。
 *
 * 2026-10-16 取数口径修正：后端原读**遗留表** `agri_prod_harvest_record`，而「新建采收」写的是
 * `agri_prod_harvest_batch` —— 于是本页登记完采收回来看不到，像"没落库"。现在两侧同源：
 * 本页与「采收记录」页读同一张表，字段与状态标签也用同一套字典（INBOUND_STATUS_META /
 * BATCH_STATUS_META），不再自造「有效/作废」这套后端并不存在的口径。
 *
 * 因此本页做两件事：
 * 1. 按后端真实语义展示地块采收记录，字段严格对齐 `HarvestRecordEntity`，
 *    后端没返回的字段一律显示「—」（用公共组件 MetricText），不编造；
 * 2. 「采收计划」的创建 / 成熟度评估 / 人力安排三项**后端未实现**
 *    （`/plan` 只有 GET，没有 POST/PUT/DELETE，也没有 maturity / labor 映射），
 *    相关按钮与写操作已整体移除，页面上以 Alert 明示「尚未实现」，
 *    不留空表让人以为坏了，也不留点了必报错的假功能。
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PageContainer, ProTable } from '@ant-design/pro-components'
import type { ProColumns } from '@ant-design/pro-components'
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import useFarmStore from '@/store/farm'
import { MetricStatistic, MetricText } from '@/components'
import { queryHarvestPlans } from '@/api/harvests'
import type { PlotHarvestRecord } from '@/api/harvests'
import { listMembers } from '@/api/members'
import { listPlots } from '@/api/plots'
import type { BatchStatus, HarvestGrade, InboundStatus, Member, Plot } from '@/types'
import {
  BATCH_STATUS_META,
  GRADE_COLOR_MAP,
  GRADE_LABEL_MAP,
  INBOUND_STATUS_META,
} from '@/types'

/** 记录筛选条件：端点只认 plotId，不接受 farmId */
interface RecordFilters {
  /** 地块 ID */
  plotId?: string
}

/**
 * 地块采收记录页面
 *
 * 业务职责：按地块查看已发生的采收记录，并说明采收计划功能尚未实现。
 *
 * @returns 页面内容
 */
export default function HarvestPlan(): JSX.Element {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentFarm = useFarmStore((state) => state.currentFarm)
  const farmId = currentFarm?.farmId

  const [pageNum, setPageNum] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)
  const [filters, setFilters] = useState<RecordFilters>({})
  const [filterForm] = Form.useForm<RecordFilters>()

  /** 采收记录列表：只按 plotId 过滤，不传表示查全部 */
  const recordQuery = useQuery({
    queryKey: ['production-harvest-records-by-plot', filters, pageNum, pageSize],
    enabled: Boolean(farmId),
    queryFn: () => queryHarvestPlans({ plotId: filters.plotId, pageNum, pageSize }),
  })

  /** 地块下拉（按当前农场查询，用于驱动筛选） */
  const plotQuery = useQuery({
    queryKey: ['plot-options', farmId],
    enabled: Boolean(farmId),
    queryFn: () => listPlots({ farmId, pageNum: 1, pageSize: 100 }),
  })

  /** 人员下拉（仅用于把 operatorId 显示成姓名，拿不到就显示 ID） */
  const memberQuery = useQuery({
    queryKey: ['member-options', farmId],
    enabled: Boolean(farmId),
    queryFn: () => listMembers({ farmId, pageNum: 1, pageSize: 100 }),
  })

  /** 统一失效刷新 */
  const invalidateRecords = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: ['production-harvest-records-by-plot'] })

  const records = useMemo<PlotHarvestRecord[]>(() => recordQuery.data?.list ?? [], [
    recordQuery.data,
  ])

  /** 统计概览：只统计后端真正返回的字段，缺失不补 0 */
  const overview = useMemo(() => {
    const knownQty = records.filter((item) => typeof item.quantity === 'number')
    const totalQty = knownQty.length > 0 ? knownQty.reduce((sum, item) => sum + (item.quantity ?? 0), 0) : null
    const plotIds = new Set(records.map((item) => item.plotId).filter(Boolean))
    const dates = records.map((item) => item.harvestDate).filter(Boolean) as string[]
    const latestDate = dates.length > 0 ? dates.sort().reverse()[0] : null
    return {
      total: records.length,
      totalQty,
      plotCount: plotIds.size,
      latestDate,
      missingQtyCount: records.length - knownQty.length,
    }
  }, [records])

  /** 地块下拉选项 */
  const plotOptions = useMemo(
    () =>
      (plotQuery.data?.list ?? []).map((plot: Plot) => ({
        value: plot.plotId,
        label: plot.plotName,
      })),
    [plotQuery.data],
  )

  /** 地块 ID → 地块名称 */
  const plotNameOf = useMemo(() => {
    const map = new Map<string, string>()
    ;(plotQuery.data?.list ?? []).forEach((plot: Plot) => map.set(plot.plotId, plot.plotName))
    return map
  }, [plotQuery.data])

  /** 人员 ID → 姓名 */
  const memberNameOf = useMemo(() => {
    const map = new Map<string, string>()
    ;(memberQuery.data?.list ?? []).forEach((member: Member) =>
      // 键必须是数字主键：批次里落的 operator_id 就是 `Member.id`
      // （原用 memberId 当键，永远查不到，采收人列只能显示「—」）
      map.set(member.id as string, member.realName),
    )
    return map
  }, [memberQuery.data])

  /** 查询 / 重置 */
  const handleSearch = (): void => {
    setPageNum(1)
    setFilters(filterForm.getFieldsValue())
  }

  const handleReset = (): void => {
    filterForm.resetFields()
    setPageNum(1)
    setFilters({})
  }

  /** 表格列定义：字段全部取自后端返回（采收批次表），缺失显示「—」 */
  const columns: ProColumns<PlotHarvestRecord>[] = [
    {
      // 2026-10-16：记录就是采收批次，优先展示业务编号（H20260601 这类），
      // 批次号缺失时退回主键，两者都没有才显示「—」
      title: '批次编号',
      dataIndex: 'batchNo',
      width: 160,
      render: (_, record) => record.batchNo ?? record.recordId ?? '—',
    },
    {
      title: '地块',
      dataIndex: 'plotId',
      width: 140,
      render: (_, record) => {
        if (record.plotId && plotNameOf.has(record.plotId)) return plotNameOf.get(record.plotId)
        // 地块不在当前农场的下拉里（或没配地块主数据）时，用后端冗余的地块名，最后才退回 ID
        return record.plotName ?? record.plotId ?? '—'
      },
    },
    {
      title: '作物品种',
      dataIndex: 'cropVariety',
      width: 150,
      render: (_, record) => record.cropVariety ?? '—',
    },
    {
      title: '采收日期',
      dataIndex: 'harvestDate',
      width: 120,
      render: (_, record) =>
        record.harvestDate ? dayjs(record.harvestDate).format('YYYY-MM-DD') : '—',
    },
    {
      title: '采收数量',
      dataIndex: 'quantity',
      width: 130,
      render: (_, record) => (
        <MetricText
          value={typeof record.quantity === 'number' ? record.quantity : null}
          // 最多两位小数（不补零）：采收数量是实测量，别被抹成整数
          // （原按默认 0 位显示，321.5 kg 会显示成 322 kg，与「采收记录」页的 321.5 kg 打架）
          maxPrecision={2}
          suffix={record.unit ? ` ${record.unit}` : ''}
          missingTip="后端未返回 quantity，显示为「—」，不补 0"
        />
      ),
    },
    {
      title: '质量等级',
      dataIndex: 'grade',
      width: 100,
      render: (_, record) => {
        if (!record.grade) return '—'
        // 后端 grade 是自由文本（实测值如「一级 / 二级 / 待检」），不属于前端 HarvestGrade 联合类型，
        // 字典里查不到就原样显示等级原文，不做映射、不编造。
        const grade = record.grade as HarvestGrade
        return <Tag color={GRADE_COLOR_MAP[grade] ?? 'default'}>{GRADE_LABEL_MAP[grade] ?? record.grade}</Tag>
      },
    },
    {
      title: '采收人',
      dataIndex: 'operatorId',
      width: 120,
      render: (_, record) => {
        if (record.operatorId && memberNameOf.has(record.operatorId)) {
          return memberNameOf.get(record.operatorId)
        }
        return record.operatorName ?? record.operatorId ?? '—'
      },
    },
    // 原「天气」列已删（2026-10-16）：采收批次表没有天气列，「新建采收」表单也不采集，
    // 留着就是一列永远显示「—」的空列 —— 那是噪声不是信息。真需要时补表字段再加回。
    {
      // 状态口径与「采收记录」页一致：入库状态（待入库/已入库/已出库）+ 批次库存状态（在库…）
      title: '状态',
      key: 'status',
      width: 170,
      render: (_, record) => (
        <Space size={4} wrap>
          {typeof record.inboundStatus === 'number' ? (
            <Tag color={INBOUND_STATUS_META[record.inboundStatus as InboundStatus].color}>
              <span style={{ color: INBOUND_STATUS_META[record.inboundStatus as InboundStatus].color }}>
                ●
              </span>{' '}
              {INBOUND_STATUS_META[record.inboundStatus as InboundStatus].label}
            </Tag>
          ) : (
            <Typography.Text type="secondary">—</Typography.Text>
          )}
          {typeof record.status === 'number' ? (
            <Tag color={BATCH_STATUS_META[record.status as BatchStatus]?.color ?? 'default'}>
              {BATCH_STATUS_META[record.status as BatchStatus]?.label ?? record.status}
            </Tag>
          ) : null}
        </Space>
      ),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      width: 200,
      render: (_, record) => record.remark ?? '—',
    },
    {
      title: '操作',
      key: 'option',
      width: 120,
      valueType: 'option',
      render: (_, record) => [
        <Typography.Link
          key="harvest"
          onClick={() => navigate(`/production/harvests/create?plotId=${record.plotId ?? ''}`)}
        >
          登记采收
        </Typography.Link>,
      ],
    },
  ]

  return (
    <PageContainer
      title="📋 地块采收记录"
      subTitle={currentFarm?.farmName}
      extra={[
        <Button key="records" onClick={() => navigate('/production/harvests')}>
          采收批次
        </Button>,
        <Button
          key="create"
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/production/harvests/create')}
        >
          新建采收
        </Button>,
      ]}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="本页展示「按地块聚合的已发生采收记录」，不是采收计划"
        description="后端 GET /harvests/plan 的语义是按地块聚合已发生的采收记录，与「采收记录」页同读 agri_prod_harvest_batch，所以本页「新建采收」登记完立刻能在这里查到。系统当前没有 prod_harvest_plan 表，「采收计划」的创建、成熟度评估、人力安排三项后端尚未实现（无对应端点），因此本页不提供这些操作，待后端补齐后再上线。"
      />
      {overview.missingQtyCount > 0 ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={`有 ${overview.missingQtyCount} 条记录后端未返回 quantity，数量列显示为「—」`}
          description="前端不补 0、不估算；接口补齐字段后自动填充。"
        />
      ) : null}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="记录条数" value={overview.total} suffix="条" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <MetricStatistic
              title="采收总量"
              value={overview.totalQty}
              suffix="kg"
              valueStyle={{ color: '#52c41a' }}
              missingTip="后端未返回任何 quantity，采收总量不做补 0 汇总，显示为「—」"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="涉及地块" value={overview.plotCount} suffix="个" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="最近采收日期"
              value={overview.latestDate ?? '—'}
              valueStyle={overview.latestDate ? undefined : { color: '#bfbfbf' }}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Form form={filterForm} layout="inline" style={{ rowGap: 12 }}>
          <Form.Item name="plotId" label="地块">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="全部地块"
              options={plotOptions}
              style={{ width: 200 }}
            />
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

      <Card>
        {!farmId ? (
          <Empty description="请先在顶部切换农场" />
        ) : recordQuery.isError ? (
          <Empty
            description={
              <Space direction="vertical">
                <Typography.Text type="danger">地块采收记录加载失败，请稍后重试</Typography.Text>
                <Button onClick={() => void invalidateRecords()}>重新加载</Button>
              </Space>
            }
          />
        ) : (
          <ProTable<PlotHarvestRecord>
            rowKey={(record) => record.recordId ?? `${record.plotId ?? ''}-${record.harvestDate ?? ''}`}
            columns={columns}
            dataSource={records}
            loading={recordQuery.isFetching}
            search={false}
            options={{ reload: () => void invalidateRecords(), density: true, setting: true }}
            locale={{ emptyText: '该地块暂无采收记录' }}
            pagination={{
              current: pageNum,
              pageSize,
              total: recordQuery.data?.total ?? 0,
              showSizeChanger: true,
              onChange: (nextPage, nextSize) => {
                setPageNum(nextPage)
                setPageSize(nextSize)
              },
            }}
          />
        )}
      </Card>
    </PageContainer>
  )
}
