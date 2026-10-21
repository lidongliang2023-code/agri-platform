/**
 * 页面名称：主体分层运营
 * 路由路径：/admin/production/tenants/segments
 * 所属模块：主体管理
 * PRD 序号：PRD 6.2 #7
 * 说明：原型无此页，按 PRD「主体画像、分层标签、差异化策略」实现，
 * 分层口径沿用原型 4.1 的主体等级（钻石 / 金牌 / 银牌 / 普通）。
 *
 * 数据来源约定（硬规矩：可以降级，不能骗人）：
 * - **后端当前没有对应端点**：`AdminTenantController` 未提供
 *   `GET /admin/tenants/segment-summary` 与 `GET /admin/tenants/profiles`
 *   （2026-10-10 复测，后端 8096：HTTP 200 / code=404 / message=资源不存在），
 *   也没有 `PUT /admin/tenants/{tenantId}/profile` 写入端点。
 * - 因此本页**不使用任何原型示例 / 本地构造数据兜底**：后端没数据就展示空态，
 *   并在页面顶部显式告警说明「后端暂未提供该数据」，不用本地数据伪装成服务端数据。
 * - 后端补齐端点后，本页无需改动即可自动展示真实数据。
 */
import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import { TagsOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MetricNumber } from '@/components'
import { toFiniteNumber } from '@/utils/metric-format'
import type {
  TenantActivity,
  TenantSegmentLevel,
  TenantSegmentProfile,
  TenantSegmentSummary,
  TenantTag,
} from '@/types'
import { listTenantProfiles, listTenantSegmentSummary, updateTenantProfile } from '@/api/admin/tenants'

const { Text } = Typography

/** 分层 →  Tag 颜色 */
const SEGMENT_COLOR: Record<TenantSegmentLevel, string> = {
  钻石: 'purple',
  金牌: 'gold',
  银牌: 'blue',
  普通: 'default',
}

/** 分层图标 */
const SEGMENT_ICON: Record<TenantSegmentLevel, string> = {
  钻石: '💎',
  金牌: '🥇',
  银牌: '🥈',
  普通: '',
}

/** 活跃度 → Tag 颜色 */
const ACTIVITY_COLOR: Record<TenantActivity, string> = {
  正常: 'green',
  低活跃: 'orange',
  不活跃: 'red',
}

/** 可选运营标签 */
const TAG_OPTIONS: TenantTag[] = ['重点客户', '高潜成长', '续费预警', '配额预警', '政策试点', '待激活']

/** 分层池 */
const SEGMENT_POOL: TenantSegmentLevel[] = ['钻石', '金牌', '银牌', '普通']

/** 后端缺失端点时的统一提示口径 */
const BACKEND_UNAVAILABLE_TITLE = '后端暂未提供主体分层数据'

/**
 * 分层指标缺失提示。
 *
 * 后端补齐 `/profiles` / `/segment-summary` 后，若返回行里没有
 * `tenantCount` / `revenue` / `avgUsageRate` / `activeDays` / `quotaUsageRate`，
 * 这些位置必须显示「—」，**不许兜成 0**（0 会被读成"统计过了，结果是 0"）。
 */
const SEGMENT_METRIC_MISSING_TIP =
  '后端未返回该分层指标（tenantCount / revenue / avgUsageRate / activeDays / quotaUsageRate），显示为「—」，接口补齐后自动填充'

/** 后端缺失端点时的详细说明 */
const BACKEND_UNAVAILABLE_DESC =
  '后端 AdminTenantController 当前没有 GET /admin/tenants/segment-summary、' +
  'GET /admin/tenants/profiles 与 PUT /admin/tenants/{tenantId}/profile 端点' +
  '（实测返回 404），因此本页面不展示任何数据——不用原型示例数据填充列表。' +
  '待后端补齐端点后本页会自动展示真实分层结果。'

/** 分层 / 策略编辑表单 */
interface ProfileFormValues {
  segment: TenantSegmentLevel
  tags: TenantTag[]
  strategy: string
}

/**
 * 主体展示名：后端未提供主体名称时兜底展示主体 ID，避免出现空白列。
 *
 * 判空覆盖 undefined / null / '' / 纯空白串（'   ' 视为空）。
 *
 * @param profile 主体画像数据
 * @returns 用于展示的主体标识
 */
function resolveTenantName(profile: { tenantId: string; tenantName?: string }): string {
  const name = profile.tenantName?.trim()
  return name ? name : profile.tenantId
}

/**
 * 主体分层运营
 *
 * 业务职责：按规模与贡献度对主体分层（钻石 / 金牌 / 银牌 / 普通），
 * 维护运营标签与差异化策略配置，并支持从列表直接调整。
 *
 * @returns 页面内容
 */
export default function TenantSegments(): JSX.Element {
  const { message } = App.useApp()
  const queryClient = useQueryClient()

  /** 关键字 */
  const [keyword, setKeyword] = useState<string>('')
  /** 查询关键字（点击查询后生效） */
  const [searchKeyword, setSearchKeyword] = useState<string>('')
  /** 分层筛选 */
  const [segmentFilter, setSegmentFilter] = useState<TenantSegmentLevel | 'all'>('all')
  /** 分页 */
  const [page, setPage] = useState<{ pageNum: number; pageSize: number }>({ pageNum: 1, pageSize: 10 })
  /** 编辑目标 */
  const [editTarget, setEditTarget] = useState<TenantSegmentProfile | null>(null)
  /** 编辑表单 */
  const [profileForm] = Form.useForm<ProfileFormValues>()

  /** 分层汇总统计（后端当前无此端点，查询会失败 / 返回空，页面据此展示空态） */
  const summaryQuery = useQuery({
    queryKey: ['admin', 'tenants', 'segment-summary'],
    queryFn: () => listTenantSegmentSummary(),
    retry: false,
  })

  /** 主体画像列表（后端当前无此端点，查询会失败 / 返回空，页面据此展示空态） */
  const profilesQuery = useQuery({
    queryKey: ['admin', 'tenants', 'profiles', page.pageNum, page.pageSize, searchKeyword, segmentFilter],
    queryFn: () =>
      listTenantProfiles({
        pageNum: page.pageNum,
        pageSize: page.pageSize,
        tenantName: searchKeyword || undefined,
        segment: segmentFilter === 'all' ? undefined : segmentFilter,
      }),
    retry: false,
  })

  /** 更新分层 / 标签 / 策略（后端无写入端点，失败时会由 http 层显式提示） */
  const profileMutation = useMutation({
    mutationFn: (payload: { tenantId: string; values: ProfileFormValues }) =>
      updateTenantProfile(payload.tenantId, {
        segment: payload.values.segment,
        tags: payload.values.tags,
        strategy: payload.values.strategy,
      }),
    onSuccess: () => {
      message.success('主体分层信息已更新')
      setEditTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['admin', 'tenants', 'profiles'] })
    },
  })

  /** 后端不可用（两个读端点都没有有效数据） */
  const backendUnavailable: boolean =
    profilesQuery.isError && summaryQuery.isError

  /** 分层汇总数据：只用后端返回值，不用示例数据兜底 */
  const summaries: TenantSegmentSummary[] = useMemo<TenantSegmentSummary[]>(
    () => summaryQuery.data ?? [],
    [summaryQuery.data],
  )

  /** 主体画像数据：只用后端返回值，不用示例数据兜底 */
  const profiles: TenantSegmentProfile[] = useMemo<TenantSegmentProfile[]>(
    () => profilesQuery.data?.list ?? [],
    [profilesQuery.data],
  )

  /** 分页总数：后端真实返回值；未取到时为 0（不做任何原型口径的假总数） */
  const total: number = profilesQuery.data?.total ?? 0

  /** 表格列定义 */
  const columns: ColumnsType<TenantSegmentProfile> = [
    { title: '主体编号', dataIndex: 'tenantCode', width: 130 },
    {
      title: '主体名称',
      dataIndex: 'tenantName',
      width: 220,
      ellipsis: true,
      // 后端未返回主体名称时兜底展示主体 ID，避免出现空白列
      render: (_dom, entity) => <span>{resolveTenantName(entity)}</span>,
    },
    {
      title: '分层',
      dataIndex: 'segment',
      width: 110,
      render: (value: TenantSegmentLevel) => (
        <Tag color={SEGMENT_COLOR[value] ?? 'default'}>
          {SEGMENT_ICON[value] ?? ''} {value}
        </Tag>
      ),
    },
    {
      title: '运营标签',
      dataIndex: 'tags',
      width: 240,
      render: (_dom, entity) => (
        <Space size={[4, 4]} wrap>
          {(entity.tags ?? []).map((tag) => (
            <Tag key={tag} color={tag.includes('预警') || tag === '待激活' ? 'red' : 'blue'}>
              {tag}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '活跃度',
      dataIndex: 'activity',
      width: 100,
      render: (value: TenantActivity) => <Tag color={ACTIVITY_COLOR[value] ?? 'default'}>{value}</Tag>,
    },
    {
      title: '配额使用率',
      dataIndex: 'quotaUsageRate',
      width: 160,
      sorter: (a, b) => (toFiniteNumber(a.quotaUsageRate) ?? 0) - (toFiniteNumber(b.quotaUsageRate) ?? 0),
      render: (value: number) => {
        const numeric = toFiniteNumber(value)
        if (numeric === null) {
          return <MetricNumber value={value} suffix="%" missingTip={SEGMENT_METRIC_MISSING_TIP} />
        }
        return <Tag color={numeric >= 80 ? 'red' : 'blue'}>{numeric}%</Tag>
      },
    },
    {
      title: '近30天活跃天数',
      dataIndex: 'activeDays',
      width: 130,
      sorter: (a, b) => (toFiniteNumber(a.activeDays) ?? 0) - (toFiniteNumber(b.activeDays) ?? 0),
      render: (value: number) => <MetricNumber value={value} suffix=" 天" missingTip={SEGMENT_METRIC_MISSING_TIP} />,
    },
    {
      title: '年度贡献收入',
      dataIndex: 'revenue',
      width: 140,
      sorter: (a, b) => (toFiniteNumber(a.revenue) ?? 0) - (toFiniteNumber(b.revenue) ?? 0),
      render: (value: number) => (
        <MetricNumber value={value} prefix="¥" missingTip={SEGMENT_METRIC_MISSING_TIP} />
      ),
    },
    {
      title: '运营策略',
      dataIndex: 'strategy',
      ellipsis: true,
      width: 260,
      render: (value: string) => (
        <Tag>{value}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_dom, entity) => (
        <Button
          type="link"
          size="small"
          icon={<TagsOutlined />}
          onClick={() => {
            setEditTarget(entity)
            profileForm.setFieldsValue({
              segment: entity.segment,
              tags: entity.tags,
              strategy: entity.strategy,
            })
          }}
        >
          调整分层
        </Button>
      ),
    },
  ]

  return (
    <div>
      {/* 后端端点缺失必须让用户看见：不用示例数据冒充服务端返回 */}
      {backendUnavailable && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={BACKEND_UNAVAILABLE_TITLE}
          description={BACKEND_UNAVAILABLE_DESC}
        />
      )}

      {/* 分层统计卡：后端无数据时不渲染任何卡片（渲染 0 也等于在展示假数据） */}
      <Row gutter={[12, 12]} style={{ marginBottom: summaries.length > 0 ? 12 : 0 }}>
        {summaries.map((item) => (
          <Col key={item.segment} xs={12} md={6}>
            <Card
              size="small"
              title={
                <Space>
                  <Tag color={SEGMENT_COLOR[item.segment] ?? 'default'}>
                    {SEGMENT_ICON[item.segment] ?? ''} {item.segment}
                  </Tag>
                </Space>
              }
              extra={
                <Text type="secondary" style={{ fontSize: 12 }}>
                  平均使用率{' '}
                  <MetricNumber
                    value={item.avgUsageRate}
                    suffix="%"
                    missingTip={SEGMENT_METRIC_MISSING_TIP}
                  />
                </Text>
              }
            >
              <Row gutter={8}>
                <Col span={12}>
                  <div style={{ fontSize: 20, fontWeight: 600 }}>
                    <MetricNumber value={item.tenantCount} missingTip={SEGMENT_METRIC_MISSING_TIP} />
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>主体数</Text>
                </Col>
                <Col span={12}>
                  <div style={{ fontSize: 20, fontWeight: 600 }}>
                    <MetricNumber
                      value={item.revenue}
                      prefix="¥"
                      missingTip={SEGMENT_METRIC_MISSING_TIP}
                    />
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>贡献收入</Text>
                </Col>
              </Row>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: 'rgba(0,0,0,0.45)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                策略：{item.strategy?.trim() ? item.strategy : '—'}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 检索区 + 列表 */}
      <Card
        size="small"
        title="主体分层明细"
        extra={
          <Space>
            <Input.Search
              style={{ width: 220 }}
              allowClear
              placeholder="主体名称 / 编号"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onSearch={(value) => {
                setSearchKeyword(value.trim())
                setPage({ pageNum: 1, pageSize: page.pageSize })
              }}
            />
            <Select
              style={{ width: 130 }}
              value={segmentFilter}
              onChange={(value) => {
                setSegmentFilter(value)
                setPage({ pageNum: 1, pageSize: page.pageSize })
              }}
              options={[
                { value: 'all', label: '全部分层' },
                { value: '钻石', label: '钻石' },
                { value: '金牌', label: '金牌' },
                { value: '银牌', label: '银牌' },
                { value: '普通', label: '普通' },
              ]}
            />
            <Button
              onClick={() => {
                setKeyword('')
                setSearchKeyword('')
                setSegmentFilter('all')
                setPage({ pageNum: 1, pageSize: 10 })
              }}
            >
              重置
            </Button>
          </Space>
        }
      >
        <Table<TenantSegmentProfile>
          rowKey="tenantId"
          size="small"
          loading={profilesQuery.isFetching}
          columns={columns}
          dataSource={profiles}
          scroll={{ x: 1500 }}
          locale={{
            emptyText: (
              <Alert
                type="warning"
                showIcon
                style={{ margin: '12px 0' }}
                message={BACKEND_UNAVAILABLE_TITLE}
                description={BACKEND_UNAVAILABLE_DESC}
              />
            ),
          }}
          pagination={{
            current: page.pageNum,
            pageSize: page.pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50],
            onChange: (pageNum, pageSize) => setPage({ pageNum, pageSize }),
          }}
        />
        <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
          数据来源：后端 `GET /admin/tenants/profiles`（当前后端未提供该端点，列表为空）；
          本页不使用任何原型示例或本地构造数据兜底。
        </Text>
      </Card>

      {/* 分层 / 策略编辑弹窗 */}
      <Modal
        open={editTarget !== null}
        title={editTarget ? `调整分层 - ${resolveTenantName(editTarget)}` : '调整分层'}
        onCancel={() => setEditTarget(null)}
        okText="保存"
        cancelText="取消"
        confirmLoading={profileMutation.isPending}
        destroyOnClose
        onOk={() => {
          void profileForm.validateFields().then((values) => {
            if (!editTarget) {
              return
            }
            profileMutation.mutate({ tenantId: editTarget.tenantId, values })
          })
        }}
      >
        <Form<ProfileFormValues> form={profileForm} layout="vertical" preserve={false}>
          <Form.Item
            name="segment"
            label="主体分层"
            rules={[{ required: true, message: '请选择主体分层' }]}
          >
            <Select
              options={SEGMENT_POOL.map((item) => ({
                value: item,
                label: `${SEGMENT_ICON[item]} ${item}`,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="tags"
            label="运营标签"
            rules={[{ required: true, message: '请至少选择一个运营标签' }]}
          >
            <Select mode="multiple" placeholder="可多选" options={TAG_OPTIONS.map((item) => ({ value: item, label: item }))} />
          </Form.Item>
          <Form.Item
            name="strategy"
            label="差异化运营策略"
            rules={[{ required: true, message: '请输入运营策略' }, { max: 200, message: '不超过 200 个字符' }]}
          >
            <Input.TextArea rows={3} maxLength={200} placeholder="如：专属客户经理 + 季度业务复盘 + 新功能优先试点" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
