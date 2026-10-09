/**
 * 页面名称：农场监管列表
 * 路由路径：/admin/production/farms
 * 所属模块：农场监管
 * PRD 序号：PRD 6.2 #8
 * 原型来源：P4 farms — 农场列表（监管视角）
 */
import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Input,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  DownloadOutlined,
  EnvironmentOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  listSupervisedComplianceProfiles,
  listSupervisedFarms,
} from '@/api/admin/farms'
import type { FarmComplianceProfile } from '@/api/admin/farms'
import type { Farm } from '@/types'
import {
  RISK_BAND_META,
  SAMPLE_FARM_TOTALS,
  SAMPLE_SUPERVISED_FARMS,
  buildRiskInfo,
  exportCsv,
  formatRegion,
} from './supervisionShared'
import type { RiskLevelKey, SupervisedFarmRow } from './supervisionShared'
import RectifyDispatchModal from './RectifyDispatchModal'
import type { RectifyTargetSummary } from './RectifyDispatchModal'

const { Text, Title } = Typography

/** 统计卡文案与取色（对应原型 P4 统计卡） */
interface StatItem {
  /** 唯一键 */
  key: string
  /** 标题 */
  title: string
  /** 数值 */
  value: number
  /** 主色 */
  color: string
}

/**
 * 后端农场实体 → 列表行模型。
 *
 * @param farm 后端农场档案
 * @param profile 农场合规画像（可缺省）
 * @returns 列表行模型
 */
function mapFarmToRow(farm: Farm, profile?: FarmComplianceProfile): SupervisedFarmRow {
  const disabled = Number(farm.status) === 0
  const riskInfo = buildRiskInfo(String(farm.farmId), profile, disabled)
  return {
    farmId: farm.farmId,
    farmCode: farm.farmCode || String(farm.farmId),
    farmName: farm.farmName,
    tenantName: farm.tenantId ? `租户 ${farm.tenantId}` : '—',
    province: farm.province || '',
    city: farm.city || '',
    areaTotal: Number(farm.areaTotal) || 0,
    crops: '—',
    riskScore: riskInfo.riskScore,
    riskLevel: riskInfo.riskLevel,
    statusLabel: RISK_BAND_META[riskInfo.riskLevel].farmStatus,
    lastCheckAt: '—',
    fromSample: false,
  }
}

/**
 * 农场监管列表
 *
 * 业务职责：全平台农场监管台账，按名称 / 租户 / 省份 / 状态 / 风险等级检索，
 * 提供风险评分分档着色、整改下发与地图模式入口。
 *
 * 数据来源：`GET /admin/farms`（分页）与 `GET /admin/farms/compliance?limit`（合规画像）。
 * 后端暂未返回风险评分、所属租户名称与最近检查时间，页面使用「稳定派生 + 原型示例」两条兜底：
 * - 风险评分：由合规画像等级 + 农场 ID 稳定哈希派生（见 supervisionShared.deriveRiskScore）
 * - 后端无数据时：整体降级为原型 P4 示例口径（5 条），保证页面可交互
 *
 * @returns 页面内容
 */
export default function FarmSupervisionList(): JSX.Element {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const queryClient = useQueryClient()

  /** 页码 */
  const [pageNum, setPageNum] = useState<number>(1)
  /** 每页条数 */
  const [pageSize, setPageSize] = useState<number>(20)
  /** 已提交的筛选条件 */
  const [filters, setFilters] = useState<{
    farmName: string
    tenantName: string
    province: string
    status: string
    riskLevel: string
  }>({ farmName: '', tenantName: '', province: '', status: '', riskLevel: '' })
  /** 筛选表单草稿值 */
  const [draft, setDraft] = useState<typeof filters>(filters)
  /** 下发整改弹窗当前农场 */
  const [rectifyTarget, setRectifyTarget] = useState<SupervisedFarmRow | null>(null)

  /** 合规画像（用于派生风险评分） */
  const profilesQuery = useQuery({
    queryKey: ['admin', 'farms', 'supervision', 'profiles'],
    queryFn: () => listSupervisedComplianceProfiles(200),
    retry: false,
  })

  /**
   * 合规画像 Map：farmId → 画像。
   */
  const profileMap = useMemo<Map<string, FarmComplianceProfile>>(() => {
    const map = new Map<string, FarmComplianceProfile>()
    const list = profilesQuery.data
    if (Array.isArray(list)) {
      list.forEach((item) => {
        if (item?.farmId) {
          map.set(String(item.farmId), item)
        }
      })
    }
    return map
  }, [profilesQuery.data])

  /** 分页农场列表（服务端关键字 + 状态过滤） */
  const farmsQuery = useQuery({
    queryKey: ['admin', 'farms', 'supervision', 'list', pageNum, pageSize, filters.farmName],
    queryFn: () =>
      listSupervisedFarms({
        pageNum,
        pageSize,
        keyword: filters.farmName || undefined,
      }),
    retry: false,
  })

  /** 服务端行数据 */
  const remoteRows = useMemo<SupervisedFarmRow[]>(
    () => (farmsQuery.data?.list ?? []).map((farm) => mapFarmToRow(farm, profileMap.get(farm.farmId))),
    [farmsQuery.data, profileMap],
  )

  /** 是否处于原型示例口径（后端无数据） */
  const usingSample: boolean = !farmsQuery.isLoading && remoteRows.length === 0

  /** 参与筛选与展示的原始数据 */
  const sourceRows: SupervisedFarmRow[] = usingSample ? SAMPLE_SUPERVISED_FARMS : remoteRows

  /** 本地二次过滤后的行（后端尚不支持租户 / 省份 / 风险筛选） */
  const filteredRows = useMemo<SupervisedFarmRow[]>(
    () =>
      sourceRows.filter((row) => {
        if (filters.farmName && !row.farmName.includes(filters.farmName)) {
          return false
        }
        if (filters.tenantName && row.tenantName !== filters.tenantName) {
          return false
        }
        if (filters.province && row.province !== filters.province) {
          return false
        }
        if (filters.status && RISK_BAND_META[row.riskLevel].farmStatus !== filters.status) {
          return false
        }
        if (filters.riskLevel && row.riskLevel !== filters.riskLevel) {
          return false
        }
        return true
      }),
    [sourceRows, filters],
  )

  /** 展示行：示例口径下本地分页，服务端口径下直接使用当前页 */
  const pagedRows = useMemo<SupervisedFarmRow[]>(() => {
    if (!usingSample) {
      return filteredRows
    }
    const start = (pageNum - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [usingSample, filteredRows, pageNum, pageSize])

  /** 总条数 */
  const totalCount: number = usingSample
    ? filteredRows.length
    : Number(farmsQuery.data?.total ?? 0)

  /** 租户选项（去重） */
  const tenantOptions = useMemo<string[]>(() => {
    const set = new Set<string>()
    SAMPLE_SUPERVISED_FARMS.forEach((row) => set.add(row.tenantName))
    remoteRows.forEach((row) => set.add(row.tenantName))
    return Array.from(set).filter(Boolean)
  }, [remoteRows])

  /** 省份选项（去重） */
  const provinceOptions = useMemo<string[]>(() => {
    const set = new Set<string>()
    SAMPLE_SUPERVISED_FARMS.forEach((row) => row.province && set.add(row.province))
    remoteRows.forEach((row) => row.province && set.add(row.province))
    return Array.from(set)
  }, [remoteRows])

  /** 统计卡片数据 */
  const statItems = useMemo<StatItem[]>(() => {
    if (usingSample) {
      return [
        { key: 'total', title: '总农场数', value: SAMPLE_FARM_TOTALS.total, color: '#1677ff' },
        { key: 'normal', title: '正常', value: SAMPLE_FARM_TOTALS.normal, color: '#52c41a' },
        { key: 'warning', title: '预警', value: SAMPLE_FARM_TOTALS.warning, color: '#fa8c16' },
        { key: 'abnormal', title: '异常', value: SAMPLE_FARM_TOTALS.abnormal, color: '#ff4d4f' },
      ]
    }
    let normal = 0
    let warning = 0
    let abnormal = 0
    profileMap.forEach((profile) => {
      if (profile.complianceLevel === 'RISK') {
        abnormal += 1
      } else if (profile.complianceLevel === 'WARN') {
        warning += 1
      } else {
        normal += 1
      }
    })
    if (normal + warning + abnormal === 0) {
      remoteRows.forEach((row) => {
        if (row.riskLevel === 'high') {
          abnormal += 1
        } else if (row.riskLevel === 'medium') {
          warning += 1
        } else {
          normal += 1
        }
      })
    }
    return [
      { key: 'total', title: '总农场数', value: Number(farmsQuery.data?.total ?? 0), color: '#1677ff' },
      { key: 'normal', title: '正常', value: normal, color: '#52c41a' },
      { key: 'warning', title: '预警', value: warning, color: '#fa8c16' },
      { key: 'abnormal', title: '异常', value: abnormal, color: '#ff4d4f' },
    ]
  }, [usingSample, profileMap, remoteRows, farmsQuery.data])

  /** 下发整改弹窗的农场摘要 */
  const rectifySummary: RectifyTargetSummary | null = useMemo<RectifyTargetSummary | null>(
    () =>
      rectifyTarget
        ? {
            farmId: rectifyTarget.farmId,
            farmCode: rectifyTarget.farmCode,
            farmName: rectifyTarget.farmName,
            tenantName: rectifyTarget.tenantName,
            riskScore: rectifyTarget.riskScore,
          }
        : null,
    [rectifyTarget],
  )

  /** 表格列定义（原型 P4 表格列） */
  const columns: ColumnsType<SupervisedFarmRow> = [
    {
      title: '农场编号',
      dataIndex: 'farmCode',
      width: 110,
      render: (value: string) => <Text copyable={{ text: value }}>{value}</Text>,
    },
    {
      title: '农场名称',
      dataIndex: 'farmName',
      width: 160,
      render: (value: string, row) => (
        <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/admin/production/farms/${row.farmId}`)}>
          {value}
        </Button>
      ),
    },
    { title: '所属租户', dataIndex: 'tenantName', width: 120 },
    {
      title: '省市',
      width: 140,
      render: (_value: unknown, row) => formatRegion(row.province, row.city),
    },
    {
      title: '面积',
      dataIndex: 'areaTotal',
      width: 100,
      align: 'right',
      render: (value: number) => `${value.toLocaleString('zh-CN')}亩`,
    },
    { title: '种植作物', dataIndex: 'crops', width: 130 },
    {
      title: '风险评分',
      dataIndex: 'riskScore',
      width: 110,
      align: 'center',
      render: (value: number, row) => (
        <Tooltip title={`${RISK_BAND_META[row.riskLevel].label}（${RISK_BAND_META[row.riskLevel].rangeText}）`}>
          <Tag color={RISK_BAND_META[row.riskLevel].tagColor} style={{ fontWeight: 600 }}>
            {value}
          </Tag>
        </Tooltip>
      ),
    },
    { title: '最近检查', dataIndex: 'lastCheckAt', width: 100, align: 'center' },
    {
      title: '状态',
      dataIndex: 'statusLabel',
      width: 90,
      align: 'center',
      render: (_value: unknown, row) => (
        <Tag color={RISK_BAND_META[row.riskLevel].tagColor}>{RISK_BAND_META[row.riskLevel].farmStatus}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_value: unknown, row) => (
        <Space size={4}>
          <Button type="link" size="small" onClick={() => navigate(`/admin/production/farms/${row.farmId}`)}>
            查看
          </Button>
          <Button
            type="link"
            size="small"
            danger
            onClick={() => setRectifyTarget(row)}
          >
            下发整改
          </Button>
        </Space>
      ),
    },
  ]

  /** 手动刷新 */
  const handleRefresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'farms', 'supervision'] })
  }

  /** 导出当前筛选结果 */
  const handleExport = (): void => {
    if (filteredRows.length === 0) {
      message.warning('当前没有可导出的数据')
      return
    }
    exportCsv<SupervisedFarmRow>('农场监管列表', filteredRows, [
      { title: '农场编号', render: (row) => row.farmCode },
      { title: '农场名称', render: (row) => row.farmName },
      { title: '所属租户', render: (row) => row.tenantName },
      { title: '省市', render: (row) => formatRegion(row.province, row.city) },
      { title: '面积(亩)', render: (row) => row.areaTotal },
      { title: '种植作物', render: (row) => row.crops },
      { title: '风险评分', render: (row) => row.riskScore },
      { title: '最近检查', render: (row) => row.lastCheckAt },
      { title: '状态', render: (row) => RISK_BAND_META[row.riskLevel].farmStatus },
    ])
    message.success(`已导出 ${filteredRows.length} 条农场监管记录`)
  }

  /** 是否启用了后端暂不支持的筛选项 */
  const hasUnsupportedFilter: boolean =
    !usingSample && Boolean(filters.tenantName || filters.province || filters.riskLevel)

  return (
    <div>
      {/* 标题栏 + 地图模式（原型 P4 右上角） */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>
            农场列表
          </Title>
          <Text type="secondary">首页 &gt; 生产管理 &gt; 农场监管 &gt; 农场列表</Text>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
              刷新
            </Button>
            <Tooltip title="导出当前筛选结果">
              <Button icon={<DownloadOutlined />} onClick={handleExport}>
                导出
              </Button>
            </Tooltip>
            <Button
              type="primary"
              icon={<EnvironmentOutlined />}
              onClick={() => navigate('/admin/production/farms/map')}
            >
              地图模式
            </Button>
          </Space>
        </Col>
      </Row>

      {/* 统计卡（原型 P4） */}
      <Row gutter={[12, 12]}>
        {statItems.map((item) => (
          <Col key={item.key} xs={12} sm={12} md={6}>
            <Card size="small" styles={{ body: { padding: 16 } }}>
              <Text type="secondary">{item.title}</Text>
              <div>
                <Text strong style={{ fontSize: 24, color: item.color }}>
                  {item.value.toLocaleString('zh-CN')}
                </Text>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 筛选器（原型 P4 Filter Bar） */}
      <Card size="small" style={{ marginTop: 12 }} styles={{ body: { paddingBottom: 0 } }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} md={6}>
            <div>
              <Text type="secondary">农场名称：</Text>
              <Input
                allowClear
                value={draft.farmName}
                placeholder="请输入农场名称"
                onChange={(event) => setDraft({ ...draft, farmName: event.target.value })}
              />
            </div>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <div>
              <Text type="secondary">所属租户：</Text>
              <Select
                allowClear
                style={{ width: '100%' }}
                placeholder="全部"
                value={draft.tenantName || undefined}
                onChange={(value?: string) => setDraft({ ...draft, tenantName: value ?? '' })}
                options={tenantOptions.map((item) => ({ label: item, value: item }))}
              />
            </div>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <div>
              <Text type="secondary">省份：</Text>
              <Select
                allowClear
                style={{ width: '100%' }}
                placeholder="全部"
                value={draft.province || undefined}
                onChange={(value?: string) => setDraft({ ...draft, province: value ?? '' })}
                options={provinceOptions.map((item) => ({ label: item, value: item }))}
              />
            </div>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <div>
              <Text type="secondary">状态：</Text>
              <Select
                allowClear
                style={{ width: '100%' }}
                placeholder="全部"
                value={draft.status || undefined}
                onChange={(value?: string) => setDraft({ ...draft, status: value ?? '' })}
                options={(['low', 'medium', 'high'] as RiskLevelKey[])
                  .map((key) => RISK_BAND_META[key].farmStatus)
                  .filter((value, index, arr) => arr.indexOf(value) === index)
                  .map((value) => ({ label: value, value }))}
              />
            </div>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <div>
              <Text type="secondary">风险等级：</Text>
              <Select
                allowClear
                style={{ width: '100%' }}
                placeholder="全部"
                value={draft.riskLevel || undefined}
                onChange={(value?: string) => setDraft({ ...draft, riskLevel: value ?? '' })}
                options={(['low', 'medium', 'high'] as RiskLevelKey[]).map((key) => ({
                  label: `${RISK_BAND_META[key].shortLabel}(${RISK_BAND_META[key].rangeText})`,
                  value: key,
                }))}
              />
            </div>
          </Col>
          <Col xs={24} sm={24} md={2}>
            <Space>
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={() => {
                  setFilters({ ...draft })
                  setPageNum(1)
                }}
              >
                查询
              </Button>
              <Button
                onClick={() => {
                  const empty = {
                    farmName: '',
                    tenantName: '',
                    province: '',
                    status: '',
                    riskLevel: '',
                  }
                  setDraft(empty)
                  setFilters(empty)
                  setPageNum(1)
                }}
              >
                重置
              </Button>
            </Space>
          </Col>
        </Row>
        <div style={{ height: 12 }} />
      </Card>

      {/* 数据状态提示 */}
      {farmsQuery.isError && (
        <Alert
          style={{ marginTop: 12 }}
          type="error"
          showIcon
          message="农场列表加载失败"
          description="接口暂不可用，已切换为原型示例口径展示，筛选与整改下发仍可正常使用。"
          action={
            <Button size="small" onClick={handleRefresh}>
              重试
            </Button>
          }
        />
      )}
      {usingSample && !farmsQuery.isError && (
        <Alert
          style={{ marginTop: 12 }}
          type="info"
          showIcon
          message="当前为原型示例口径（后端农场列表暂未返回数据）"
          description="统计卡片采用原型 4.2 平台级口径（3,542 / 2,980 / 412 / 150），列表与操作功能均可正常使用。"
        />
      )}
      {hasUnsupportedFilter && (
        <Alert
          style={{ marginTop: 12 }}
          type="warning"
          showIcon
          message="所属租户 / 省份 / 风险等级筛选暂由前端在当前页结果上二次过滤"
          description="后端 /admin/farms 目前仅支持关键字与状态过滤，已对返回结果做本地补充过滤。"
        />
      )}

      {/* 农场台账表格（原型 P4 Table） */}
      <Card size="small" style={{ marginTop: 12 }}>
        <Table<SupervisedFarmRow>
          rowKey="farmId"
          size="small"
          columns={columns}
          dataSource={pagedRows}
          loading={farmsQuery.isLoading}
          scroll={{ x: 1300 }}
          locale={{ emptyText: '暂无农场数据' }}
          pagination={{
            current: pageNum,
            pageSize,
            total: totalCount,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50],
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, size) => {
              setPageNum(page)
              setPageSize(size)
            },
          }}
        />
      </Card>

      {/* 下发整改弹窗（PRD #11 整改下发，列表页与详情页共用） */}
      <RectifyDispatchModal
        open={rectifyTarget !== null}
        target={rectifySummary}
        onClose={() => setRectifyTarget(null)}
      />
    </div>
  )
}
