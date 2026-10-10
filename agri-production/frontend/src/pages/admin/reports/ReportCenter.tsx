/**
 * 页面名称：报表中心
 * 路由路径：/admin/production/reports
 * 所属模块：统计报表
 * PRD 序号：PRD 6.2 #28
 * 原型页码：P26 reports
 *
 * 交互说明（对照原型 P26）：
 * - 筛选：报表类型（生产报表 / 质量报表 / 设备报表 / 告警报表）+ 时间范围；
 * - 6 张报表卡片：图标 + 名称 / 最新时间·更新频率 / 覆盖范围 / 操作（查看、下载）；
 *   「生产日报」跳转 /admin/production/reports/production，「质量检测报告」跳转 .../quality；
 * - 收藏管理：星标收藏持久化到 localStorage，支持「仅看收藏」过滤；
 * - 下载通过前端 Blob 生成报表摘要文件，无需后端介入即可闭环。
 *
 * 明示（与 AI 模型管理同一套口径，避免"看起来像真的"）：
 * - ① 顶部常驻 Alert：示例数据 + 收藏仅在本机生效 + 下载为前端生成摘要文件；
 * - ② 收藏与下载的成功提示均带限定语「仅保存到本机 / 未同步服务端」「前端即时生成的摘要文件」；
 * - ③ 服务端报表列表中不存在的卡片统一带「示例」Tag，可一眼区分真实报表与示例数据。
 */
import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  BarChartOutlined,
  DownloadOutlined,
  EyeOutlined,
  ReloadOutlined,
  StarFilled,
  StarOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { CSSProperties } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getReportCenterStat, listAdminReports } from '@/api'
import type { AdminReportPage } from '@/api'

/** 报表大类：production 生产报表 / quality 质量报表 / device 设备报表 / alert 告警报表 */
type ReportGroup = 'production' | 'quality' | 'device' | 'alert'

/** 报表卡片模型 */
interface ReportCard {
  /** 报表 ID */
  reportId: string
  /** 报表名称 */
  name: string
  /** 所属大类 */
  group: ReportGroup
  /** 图标 */
  icon: string
  /** 最新时间描述 */
  latest: string
  /** 更新频率 */
  frequency: string
  /** 覆盖范围描述 */
  coverage: string
  /** 跳转路由（可选） */
  route?: string
}

/** 原型 P26 的 6 张报表卡片 */
const REPORT_CARDS: ReportCard[] = [
  {
    reportId: 'RPT-PROD-DAY',
    name: '生产日报',
    group: 'production',
    icon: '📊',
    latest: '2025-07-14',
    frequency: '每日更新',
    coverage: '任务完成率、产量、种植面积',
    route: '/admin/production/reports/production',
  },
  {
    reportId: 'RPT-PROD-WEEK',
    name: '生产周报',
    group: 'production',
    icon: '📊',
    latest: '2025-07-07 ~ 07-13',
    frequency: '每周更新',
    coverage: '周度汇总、趋势对比',
    route: '/admin/production/reports/production',
  },
  {
    reportId: 'RPT-PROD-MONTH',
    name: '生产月报',
    group: 'production',
    icon: '📊',
    latest: '2025-06',
    frequency: '每月更新',
    coverage: '月度总结、同比环比',
    route: '/admin/production/reports/production',
  },
  {
    reportId: 'RPT-QUALITY',
    name: '质量检测报告',
    group: 'quality',
    icon: '🛡️',
    latest: '2025-07-14',
    frequency: '按批次',
    coverage: '检测合格率、异常分布',
    route: '/admin/production/reports/quality',
  },
  {
    reportId: 'RPT-DEVICE',
    name: '设备运维报表',
    group: 'device',
    icon: '📡',
    latest: '2025-07-14',
    frequency: '每日更新',
    coverage: '在线率、故障率、维护记录',
  },
  {
    reportId: 'RPT-ALERT',
    name: '告警分析报表',
    group: 'alert',
    icon: '⚠️',
    latest: '2025-07-14',
    frequency: '每日更新',
    coverage: '告警统计、处理时效、根因分析',
  },
]

/** 收藏缓存 key */
const FAVORITE_KEY = 'agri:admin:reports:favorites'

/** 统计接口不可用时统计卡显示的占位符（不是 0，0 会被读成「本月生成 0 份」） */
const UNAVAILABLE_TEXT = '—'

/** 占位符样式：弱化，避免与真实数字混淆 */
const UNAVAILABLE_VALUE_STYLE: CSSProperties = { color: '#bfbfbf', fontSize: 24 }

/**
 * 读取本地收藏
 * @returns 已收藏报表 ID 列表
 */
function readFavorites(): string[] {
  try {
    const raw = window.localStorage.getItem(FAVORITE_KEY)
    if (!raw) {
      return []
    }
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as string[]) : []
  } catch {
    return []
  }
}

/** 查询条件 */
interface FilterState {
  group?: ReportGroup
  keyword?: string
  range?: [string, string]
}

/**
 * 报表中心页面
 * @returns 页面内容
 */
export default function ReportCenter(): JSX.Element {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form] = Form.useForm<FilterState>()
  const [filters, setFilters] = useState<FilterState>({})
  const [favorites, setFavorites] = useState<string[]>(readFavorites())
  const [onlyFavorite, setOnlyFavorite] = useState<boolean>(false)
  const [serverTotal, setServerTotal] = useState<number | undefined>(undefined)

  /**
   * 报表中心统计。
   *
   * ⚠️ 不再在 catch 里返回 `{ totalCount: 6, monthCount: 128, downloadCount: 862, failedCount: 2 }`
   * 这类编造数字：后端 `GET /admin/reports/stat` 实际不存在（会被 `@GetMapping("/{id}")`
   * 吞掉后抛 NOT_FOUND），编造数字会让「接口挂了」显示成「本月生成 128 份」。
   * 现在由 api 层返回 `unavailableReason`，本页按失败态渲染。
   */
  const statQuery = useQuery({
    queryKey: ['admin-report-center-stat'],
    queryFn: () => getReportCenterStat(),
  })

  /** 统计接口不可用原因（非空即本次没拿到任何真实统计） */
  const statUnavailableReason: string | undefined = statQuery.data?.unavailableReason

  /** 服务端报表任务列表；失败时同样带 unavailableReason，不做「空列表」冒充 */
  const listQuery = useQuery({
    queryKey: ['admin-report-center-list'],
    queryFn: async (): Promise<AdminReportPage> => {
      const page = await listAdminReports({ pageNum: 1, pageSize: 100 })
      setServerTotal(page.unavailableReason ? undefined : page.total)
      return page
    },
  })

  /** 报表任务列表接口不可用原因 */
  const listUnavailableReason: string | undefined = listQuery.data?.unavailableReason

  useEffect(() => {
    window.localStorage.setItem(FAVORITE_KEY, JSON.stringify(favorites))
  }, [favorites])

  /** 切换收藏（仅写入本机 localStorage，不调用服务端） */
  const toggleFavorite = (reportId: string): void => {
    const willFavorite = !favorites.includes(reportId)
    setFavorites((prev) =>
      prev.includes(reportId) ? prev.filter((id) => id !== reportId) : [...prev, reportId],
    )
    const target = REPORT_CARDS.find((card) => card.reportId === reportId)
    message.success(
      willFavorite
        ? `已收藏「${target?.name ?? reportId}」（仅保存到本机，未同步服务端）`
        : `已取消收藏「${target?.name ?? reportId}」（仅在本机生效，未同步服务端）`,
    )
  }

  /** 是否为本机示例卡片（服务端报表列表中不存在） */
  const isDemoCard = (card: ReportCard): boolean =>
    !listQuery.data?.list?.some((item) => item.reportId === card.reportId)

  /** 当前展示的报表卡片 */
  const displayCards = useMemo(
    () =>
      REPORT_CARDS.filter((card) => {
        if (filters.group && card.group !== filters.group) {
          return false
        }
        if (filters.keyword && !card.name.includes(filters.keyword)) {
          return false
        }
        if (onlyFavorite && !favorites.includes(card.reportId)) {
          return false
        }
        return true
      }),
    [filters, onlyFavorite, favorites],
  )

  /**
   * 查看报表：配置了路由的跳转对应页面，其余提示暂未开放
   * @param card 目标报表卡片
   */
  const handleView = (card: ReportCard): void => {
    if (card.route) {
      navigate(card.route)
      return
    }
    message.info(`「${card.name}」详情页正在建设中，可通过下载获取最新报表`)
  }

  /**
   * 下载报表摘要（前端 Blob 方式，保证无后端依赖时也可闭环）
   * @param card 目标报表卡片
   */
  const handleDownload = (card: ReportCard): void => {
    const content = [
      `报表名称：${card.name}`,
      `报表编号：${card.reportId}`,
      `最新时间：${card.latest}`,
      `更新频率：${card.frequency}`,
      `覆盖范围：${card.coverage}`,
      `导出时间：${dayjs().format('YYYY-MM-DD HH:mm:ss')}`,
      '',
      '说明：本文件由平台报表中心自动导出，用于运营侧的离线查阅。',
    ].join('\n')
    const blob = new Blob([`\uFEFF${content}`], { type: 'text/plain;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${card.name}_${dayjs().format('YYYYMMDD')}.txt`
    link.click()
    URL.revokeObjectURL(url)
    message.success(`「${card.name}」已下载（前端即时生成的摘要文件，非服务端原始报表）`)
  }

  /**
   * 渲染一张统计卡。
   *
   * 统计接口不可用时统一显示「—」：接口失败 ≠ 有 128 份本月报表，
   * 用示例数字顶上会让用户把「接口挂了」读成「业务量很大」。
   *
   * @param title 卡片标题
   * @param value 真实统计值（仅在接口可用时使用）
   * @param suffix 单位（仅在接口可用时显示）
   * @param valueStyle 数值样式（仅在接口可用时应用）
   * @returns 统计卡所在的栅格列
   */
  const renderStatCard = (
    title: string,
    value: number,
    suffix: string,
    valueStyle?: CSSProperties,
  ): JSX.Element => (
    <Col span={6}>
      <Card>
        <Statistic
          title={title}
          value={statUnavailableReason ? UNAVAILABLE_TEXT : value}
          suffix={statUnavailableReason ? undefined : suffix}
          valueStyle={statUnavailableReason ? UNAVAILABLE_VALUE_STYLE : valueStyle}
          loading={!statUnavailableReason && statQuery.isPending}
        />
      </Card>
    </Col>
  )

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Alert
        type="warning"
        showIcon
        message="报表目录含本机示例数据；收藏状态仅保存在本机浏览器，未同步至服务端"
        description={
          <span>
            服务端报表接口未返回数据时，本页展示原型 P26 的示例报表目录与示例统计，带{' '}
            <Typography.Text code>示例</Typography.Text> 标签的卡片即本机示例数据（非服务端真实报表）；
            星标收藏写入浏览器本地存储（localStorage），<Typography.Text strong>只对当前浏览器生效</Typography.Text>
            ，其他账号 / 设备不可见，也不会同步到服务端；卡片「下载」得到的是
            <Typography.Text strong>前端即时生成的摘要文件</Typography.Text>，不是服务端生成的 PDF / Excel 原件。
          </span>
        }
      />
      {statUnavailableReason ? (
        <Alert
          banner
          showIcon
          type="warning"
          message="报表中心统计未接入：后端尚未提供 /admin/reports/stat，四张统计卡显示「—」，不使用示例数字占位"
          description={
            <span>
              原因：{statUnavailableReason}。为避免把编造数字误当成真实统计，此处
              <strong>不会</strong>用示例值填充；接口上线后本提示自动消失，卡片即恢复真实数字。
            </span>
          }
        />
      ) : null}

      {listUnavailableReason ? (
        <Alert
          banner
          showIcon
          type="warning"
          message="服务端报表任务列表不可用，下方卡片一律按示例数据处理"
          description={
            <span>
              原因：{listUnavailableReason}。此时所有卡片都会带{' '}
              <Typography.Text code>示例</Typography.Text> 标签，
              <strong>不代表服务端已存在这些报表</strong>。
            </span>
          }
        />
      ) : null}

      <Row gutter={16}>
        {renderStatCard('报表总数', serverTotal ?? statQuery.data?.totalCount ?? 0, '类')}
        {renderStatCard('本月生成', statQuery.data?.monthCount ?? 0, '份')}
        {renderStatCard('下载次数', statQuery.data?.downloadCount ?? 0, '次')}
        {renderStatCard(
          '生成失败',
          statQuery.data?.failedCount ?? 0,
          '份',
          (statQuery.data?.failedCount ?? 0) > 0 ? { color: '#cf1322' } : undefined,
        )}
      </Row>

      <Card>
        <Form<FilterState>
          form={form}
          layout="inline"
          style={{ rowGap: 12 }}
          onFinish={(values) => {
            const range = values.range as unknown as [dayjs.Dayjs, dayjs.Dayjs] | undefined
            setFilters({
              ...values,
              range: range ? [range[0].format('YYYY-MM-DD'), range[1].format('YYYY-MM-DD')] : undefined,
            })
          }}
        >
          <Form.Item name="keyword" label="快速查询">
            <Input allowClear placeholder="输入报表名称" style={{ width: 180 }} />
          </Form.Item>
          <Form.Item name="group" label="报表类型">
            <Select
              allowClear
              placeholder="全部"
              style={{ width: 160 }}
              options={[
                { value: 'production', label: '生产报表' },
                { value: 'quality', label: '质量报表' },
                { value: 'device', label: '设备报表' },
                { value: 'alert', label: '告警报表' },
              ]}
            />
          </Form.Item>
          <Form.Item name="range" label="时间范围">
            <DatePicker.RangePicker />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                查询
              </Button>
              <Button
                onClick={() => {
                  form.resetFields()
                  setFilters({})
                }}
              >
                重置
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  void queryClient.invalidateQueries({ queryKey: ['admin-report-center-stat'] })
                  void queryClient.invalidateQueries({ queryKey: ['admin-report-center-list'] })
                }}
              >
                刷新
              </Button>
              <Tooltip title="收藏状态仅保存在当前浏览器本地（localStorage），不会同步到服务端，换设备 / 清理浏览器数据后失效">
                <Space size={4}>
                  <Switch
                    checked={onlyFavorite}
                    onChange={(checked) => setOnlyFavorite(checked)}
                    checkedChildren="收藏"
                    unCheckedChildren="全部"
                  />
                  <Typography.Text type="secondary">仅看收藏（{favorites.length}）</Typography.Text>
                </Space>
              </Tooltip>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {displayCards.length === 0 ? (
        <Card>
          <Empty description="没有符合条件的报表" />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {displayCards.map((card) => (
            <Col span={8} key={card.reportId}>
              <Card
                styles={{ body: { padding: 16 } }}
                title={
                  <Space>
                    <span style={{ fontSize: 18 }}>{card.icon}</span>
                    <span>{card.name}</span>
                    <Tag color={card.group === 'quality' ? 'blue' : card.group === 'production' ? 'green' : 'orange'}>
                      {card.group === 'production'
                        ? '生产'
                        : card.group === 'quality'
                          ? '质量'
                          : card.group === 'device'
                            ? '设备'
                            : '告警'}
                    </Tag>
                    {isDemoCard(card) ? <Tag color="purple">示例</Tag> : null}
                  </Space>
                }
                extra={
                  <Button
                    type="text"
                    icon={
                      favorites.includes(card.reportId) ? (
                        <StarFilled style={{ color: '#faad14' }} />
                      ) : (
                        <StarOutlined />
                      )
                    }
                    onClick={() => toggleFavorite(card.reportId)}
                    aria-label="收藏"
                  />
                }
                actions={[
                  <Button key="view" type="link" icon={<EyeOutlined />} onClick={() => handleView(card)}>
                    查看
                  </Button>,
                  <Button
                    key="download"
                    type="link"
                    icon={<DownloadOutlined />}
                    onClick={() => handleDownload(card)}
                  >
                    下载
                  </Button>,
                ]}
              >
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <Typography.Text type="secondary">
                    最新 {card.latest} · {card.frequency}
                  </Typography.Text>
                  <Typography.Text type="secondary">覆盖 {card.coverage}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    <BarChartOutlined /> 编号 {card.reportId}
                    {listQuery.data?.list?.some((item) => item.reportId === card.reportId)
                      ? ' · 平台已生成'
                      : ''}
                  </Typography.Text>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </Space>
  )
}
