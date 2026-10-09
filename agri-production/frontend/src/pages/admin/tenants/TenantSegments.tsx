/**
 * 页面名称：租户分层运营
 * 路由路径：/admin/production/tenants/segments
 * 所属模块：租户管理
 * PRD 序号：PRD 6.2 #7
 * 说明：原型无此页，按 PRD「租户画像、分层标签、差异化策略」实现，
 * 分层口径沿用原型 4.1 的租户等级（钻石 / 金牌 / 银牌 / 普通）。
 */
import { useMemo, useState } from 'react'
import {
  App,
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { TagsOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

/** 租户名称池 */
const TENANT_NAME_POOL: string[] = [
  '绿源农业科技有限公司', '丰达农场', '大地种业', '丰收集团', '田园生态',
  '惠民种植', '鑫农科技', '鑫盛农业科技', '中原农服', '黄河种业',
]

/** 分层池 */
const SEGMENT_POOL: TenantSegmentLevel[] = ['钻石', '金牌', '银牌', '普通']

/** 策略池 */
const STRATEGY_POOL: string[] = [
  '专属客户经理 + 季度业务复盘 + 新功能优先试点',
  '标准化服务包 + 月度运营巡检 + 用量提醒',
  '自助服务为主 + 线上课程 + 社区答疑',
  '重点回访 + 续费激励 + 配额优化建议',
]

/** 分层汇总示例数据 */
const FALLBACK_SUMMARY: TenantSegmentSummary[] = [
  { segment: '钻石', tenantCount: 186, revenue: 12860000, avgUsageRate: 78.5, strategy: STRATEGY_POOL[0] },
  { segment: '金牌', tenantCount: 452, revenue: 18640000, avgUsageRate: 72.4, strategy: STRATEGY_POOL[1] },
  { segment: '银牌', tenantCount: 528, revenue: 9260000, avgUsageRate: 64.8, strategy: STRATEGY_POOL[2] },
  { segment: '普通', tenantCount: 414, revenue: 3180000, avgUsageRate: 55.2, strategy: STRATEGY_POOL[3] },
]

/**
 * 生成租户画像示例数据（后端无数据时兜底）。
 *
 * @param pageNum 页码
 * @param pageSize 每页条数
 * @returns 租户画像列表
 */
function buildSampleProfiles(pageNum: number, pageSize: number): TenantSegmentProfile[] {
  /** 平台租户总数（原型 4.2 口径） */
  const total = 1580
  return Array.from({ length: Math.min(pageSize, Math.max(0, total - (pageNum - 1) * pageSize)) }, (_unused, index) => {
    const seq = (pageNum - 1) * pageSize + index + 1
    const tier = SEGMENT_POOL[(seq * 3) % 4]
    const usageRate = 42 + ((seq * 13) % 60)
    const activeDays = 6 + ((seq * 5) % 25)
    const tagCount = (seq % 3) + 1
    return {
      tenantId: `TS${String(seq).padStart(6, '0')}`,
      tenantCode: `T2025${String(seq).padStart(4, '0')}`,
      tenantName:
        seq <= TENANT_NAME_POOL.length
          ? TENANT_NAME_POOL[seq - 1]
          : `${TENANT_NAME_POOL[seq % TENANT_NAME_POOL.length]}${seq}号基地`,
      segment: tier,
      tags: TAG_OPTIONS.slice(0, tagCount),
      activity: (usageRate > 95 ? '不活跃' : usageRate > 82 ? '低活跃' : '正常') as TenantActivity,
      quotaUsageRate: usageRate,
      activeDays,
      revenue: 20000 + ((seq * 7919) % 400000),
      strategy: STRATEGY_POOL[(seq * 3) % STRATEGY_POOL.length],
      updatedAt: `2025-07-${String(10 + (seq % 5)).padStart(2, '0')} 10:00:00`,
    }
  })
}

/** 分层 / 策略编辑表单 */
interface ProfileFormValues {
  segment: TenantSegmentLevel
  tags: TenantTag[]
  strategy: string
}

/**
 * 租户展示名：后端未提供租户名称时兜底展示租户 ID，避免出现空白列。
 *
 * 判空覆盖 undefined / null / '' / 纯空白串（'   ' 视为空）。
 *
 * @param profile 租户画像数据
 * @returns 用于展示的租户标识
 */
function resolveTenantName(profile: { tenantId: string; tenantName?: string }): string {
  const name = profile.tenantName?.trim()
  return name ? name : profile.tenantId
}

/**
 * 租户分层运营
 *
 * 业务职责：按规模与贡献度对租户分层（钻石 / 金牌 / 银牌 / 普通），
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

  /** 分层汇总统计 */
  const summaryQuery = useQuery({
    queryKey: ['admin', 'tenants', 'segment-summary'],
    queryFn: () => listTenantSegmentSummary(),
    retry: false,
  })

  /** 租户画像列表 */
  const profilesQuery = useQuery({
    queryKey: ['admin', 'tenants', 'profiles', page, searchKeyword, segmentFilter],
    queryFn: () =>
      listTenantProfiles({
        pageNum: page.pageNum,
        pageSize: page.pageSize,
        tenantName: searchKeyword || undefined,
        segment: segmentFilter === 'all' ? undefined : segmentFilter,
      }),
    retry: false,
  })

  /** 更新分层 / 标签 / 策略 */
  const profileMutation = useMutation({
    mutationFn: (payload: { tenantId: string; values: ProfileFormValues }) =>
      updateTenantProfile(payload.tenantId, {
        segment: payload.values.segment,
        tags: payload.values.tags,
        strategy: payload.values.strategy,
      }),
    onSuccess: () => {
      message.success('租户分层信息已更新')
      setEditTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['admin', 'tenants', 'profiles'] })
    },
  })

  /** 分层汇总数据 */
  const summaries: TenantSegmentSummary[] = useMemo<TenantSegmentSummary[]>(() => {
    const remote = summaryQuery.data
    return remote && remote.length > 0 ? remote : FALLBACK_SUMMARY
  }, [summaryQuery.data])

  /** 租户画像数据 */
  const profiles: TenantSegmentProfile[] = useMemo<TenantSegmentProfile[]>(() => {
    const remote = profilesQuery.data?.list
    const list = remote && remote.length > 0 ? remote : buildSampleProfiles(page.pageNum, page.pageSize)
    if (!searchKeyword) {
      return list
    }
    return list.filter(
      (item) =>
        resolveTenantName(item).includes(searchKeyword) || item.tenantCode.includes(searchKeyword),
    )
  }, [profilesQuery.data, page, searchKeyword])

  /** 表格列定义 */
  const columns: ColumnsType<TenantSegmentProfile> = [
    { title: '租户编号', dataIndex: 'tenantCode', width: 130 },
    {
      title: '租户名称',
      dataIndex: 'tenantName',
      width: 220,
      ellipsis: true,
      // 后端未返回租户名称时兜底展示租户 ID，避免出现空白列
      render: (_dom, entity) => <span>{resolveTenantName(entity)}</span>,
    },
    {
      title: '分层',
      dataIndex: 'segment',
      width: 110,
      render: (value: TenantSegmentLevel) => (
        <Tag color={SEGMENT_COLOR[value]}>
          {SEGMENT_ICON[value]} {value}
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
      render: (value: TenantActivity) => <Tag color={ACTIVITY_COLOR[value]}>{value}</Tag>,
    },
    {
      title: '配额使用率',
      dataIndex: 'quotaUsageRate',
      width: 160,
      sorter: (a, b) => a.quotaUsageRate - b.quotaUsageRate,
      render: (value: number) => {
        const danger = value >= 90
        return (
          <Tooltip title={danger ? '配额即将用尽，建议尽快调整' : `已使用 ${value}%`}>
            <Progress
              percent={Math.min(value, 100)}
              size="small"
              status={danger ? 'exception' : 'normal'}
              strokeColor={danger ? '#ff4d4f' : undefined}
            />
          </Tooltip>
        )
      },
    },
    {
      title: '近30天活跃天数',
      dataIndex: 'activeDays',
      width: 130,
      sorter: (a, b) => a.activeDays - b.activeDays,
      render: (value: number) => `${value} 天`,
    },
    {
      title: '年度贡献收入',
      dataIndex: 'revenue',
      width: 140,
      sorter: (a, b) => a.revenue - b.revenue,
      render: (value: number) => `¥${Number(value).toLocaleString('zh-CN')}`,
    },
    {
      title: '运营策略',
      dataIndex: 'strategy',
      ellipsis: true,
      width: 260,
      render: (value: string) => (
        <Tooltip title={value}>
          <span>{value}</span>
        </Tooltip>
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
      {/* 分层统计卡 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        {summaries.map((item) => (
          <Col key={item.segment} xs={12} md={6}>
            <Card
              size="small"
              title={
                <Space>
                  <Tag color={SEGMENT_COLOR[item.segment]}>
                    {SEGMENT_ICON[item.segment]} {item.segment}
                  </Tag>
                </Space>
              }
              extra={<Text type="secondary" style={{ fontSize: 12 }}>平均使用率 {item.avgUsageRate}%</Text>}
            >
              <Row gutter={8}>
                <Col span={12}>
                  <Statistic
                    title="租户数"
                    value={item.tenantCount}
                    formatter={(value) => Number(value).toLocaleString('zh-CN')}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="贡献收入"
                    value={item.revenue}
                    precision={0}
                    prefix="¥"
                    formatter={(value) => Number(value).toLocaleString('zh-CN')}
                  />
                </Col>
              </Row>
              <Tooltip title={item.strategy}>
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
                  策略：{item.strategy}
                </div>
              </Tooltip>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 检索区 + 列表 */}
      <Card
        size="small"
        title="租户分层明细"
        extra={
          <Space>
            <Input.Search
              style={{ width: 220 }}
              allowClear
              placeholder="租户名称 / 编号"
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
          pagination={{
            current: page.pageNum,
            pageSize: page.pageSize,
            total: profilesQuery.data?.total ?? 1580,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50],
            onChange: (pageNum, pageSize) => setPage({ pageNum, pageSize }),
          }}
        />
        <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
          {profilesQuery.data && profilesQuery.data.list.length > 0
            ? '数据来源：租户分层画像接口'
            : '当前为原型示例口径（后端分层接口暂未返回数据），可直接调整分层、标签与策略'}
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
            label="租户分层"
            rules={[{ required: true, message: '请选择租户分层' }]}
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
