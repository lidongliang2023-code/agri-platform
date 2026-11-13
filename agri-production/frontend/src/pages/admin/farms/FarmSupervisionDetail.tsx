import './FarmSupervisionCompact.css'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Empty, Skeleton, Space, Tag, Typography } from 'antd'
import { EnvironmentOutlined, ReloadOutlined } from '@ant-design/icons'
import { TiandituMap, computePolygonMetrics, isValidLngLat, parseBoundaryVertices, polygonCentroid } from '@agri/shared'
import PageContainer from '@/components/ProductionPageContainer'
import Card from '@/components/SectionCard'
import { DetailInfoGrid, DetailMetricGrid } from '@/components'
import FarmRectificationPanel from '@/components/FarmRectificationPanel'
import FarmPlotBoundaryChecks from '@/components/FarmPlotBoundaryChecks'
import { supervisionDetail } from '@/api/admin/farm-supervision'

const farmTypes: Record<number, string> = { 1: '种植类', 2: '养殖类', 3: '综合种养' }

export default function FarmSupervisionDetail(): JSX.Element {
  const { farmId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['supervision-detail', farmId], queryFn: () => supervisionDetail(farmId!), enabled: !!farmId, retry: false, refetchOnWindowFocus: true })
  const detail = query.data
  const farm = detail?.farm
  const vertices = parseBoundaryVertices(farm?.boundary)
  const hasBoundary = vertices.length >= 3
  const hasPoint = farm?.longitude != null && farm?.latitude != null && isValidLngLat(Number(farm.longitude), Number(farm.latitude))
  const center = hasPoint ? { longitude: Number(farm!.longitude), latitude: Number(farm!.latitude) } : polygonCentroid(vertices)
  const metrics = hasBoundary ? computePolygonMetrics(vertices) : null
  const region = [farm?.province, farm?.city, farm?.district].filter(Boolean).join('')
  const address = farm?.address ? farm.province && farm.address.startsWith(farm.province) ? farm.address : `${region}${farm.address}` : region || '未登记'
  const mapPath = `/admin/production/farms?view=map&farmId=${encodeURIComponent(farmId ?? '')}`
  const refresh = () => Promise.all([
    query.refetch(),
    queryClient.invalidateQueries({ queryKey: ['farm-checks', false, farmId] }),
    queryClient.invalidateQueries({ queryKey: ['farm-plot-boundary-checks', true, farmId] }),
  ])

  return <PageContainer className="farm-supervision-compact"
    title={farm?.farmName || '农场监管详情'}
    subTitle="农场档案、空间范围与检查整改"
    onBack={() => navigate('/admin/production/farms')}
    extra={<Space wrap>
      <Button icon={<ReloadOutlined />} loading={query.isFetching} onClick={() => void refresh()}>刷新档案</Button>
      <Button icon={<EnvironmentOutlined />} disabled={!farm} onClick={() => navigate(mapPath)}>维护坐标</Button>
      <Button disabled={!farm} onClick={() => navigate(`${mapPath}&edit=boundary`)}>维护边界</Button>
      <Button type="primary" disabled={!farm} onClick={() => navigate(`/admin/production/farms/compliance?farmId=${encodeURIComponent(farmId ?? '')}`)}>检查整改</Button>
    </Space>}
  >
    {query.isLoading ? <Skeleton active paragraph={{ rows: 10 }} /> : !farm || !detail ?
      <Empty description={<Space direction="vertical"><Typography.Text type="danger">{query.isError ? '农场档案读取失败' : '暂无农场档案'}</Typography.Text>{query.isError && <Typography.Text type="secondary">{(query.error as Error).message}</Typography.Text>}<Button onClick={() => void query.refetch()}>重新加载</Button></Space>} /> :
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {query.isError && <Alert showIcon type="warning" message="刷新失败，当前展示上次读取的农场档案" description={(query.error as Error).message} />}
        <Card title="基本信息" extra={<Tag color={Number(farm.status) === 1 ? 'green' : 'default'}>{Number(farm.status) === 1 ? '运营中' : '已停用'}</Tag>}>
          <DetailInfoGrid columns={3} items={[
            { key: 'code', label: '农场编号', value: farm.farmCode },
            { key: 'type', label: '农场类型', value: farmTypes[farm.farmType] || '未分类' },
            { key: 'tenant', label: '所属经营主体', value: farm.tenantName || '主体名称暂不可用' },
            { key: 'area', label: '登记面积', value: farm.areaTotal == null ? '未登记' : `${Number(farm.areaTotal).toLocaleString('zh-CN')} 亩` },
            { key: 'address', label: '农场地址', value: address, fullWidth: true },
            { key: 'manager', label: '负责人', value: farm.managerName },
            { key: 'phone', label: '联系电话', value: farm.managerPhone },
            { key: 'created', label: '创建时间', value: farm.createdAt },
            { key: 'updated', label: '更新时间', value: farm.updatedAt },
          ]} />
        </Card>
        <DetailMetricGrid items={[
          { key: 'plots', title: '关联地块', value: detail.plotCount ?? null, suffix: '个', extra: '农场下登记的地块数量' },
          { key: 'checks', title: '检查记录', value: detail.checkCount ?? null, suffix: '条', extra: '已登记的实际检查记录' },
          { key: 'open', title: '未闭环问题', value: detail.openCount ?? null, suffix: '条', valueStyle: { color: detail.openCount > 0 ? '#d46b08' : undefined }, extra: '含待整改、逾期及待复核记录' },
          { key: 'review', title: '待运营复核', value: detail.reviewCount ?? null, suffix: '条', valueStyle: { color: detail.reviewCount > 0 ? '#1677ff' : undefined }, extra: '经营主体已提交整改结果' },
        ]} />
        <Card title="农场位置与边界" extra={<Space wrap><Button type="link" onClick={() => navigate(mapPath)}>维护坐标</Button><Button type="link" onClick={() => navigate(`${mapPath}&edit=boundary`)}>维护边界</Button></Space>}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <DetailInfoGrid columns={2} items={[
              { key: 'point', label: '中心坐标（经度 / 纬度）', value: hasPoint ? `${farm.longitude} / ${farm.latitude}` : '未登记' },
              { key: 'boundary', label: '边界登记', value: hasBoundary ? `已绘制 · ${vertices.length} 个顶点` : '未绘制' },
              { key: 'measured', label: '边界测算面积', value: metrics ? `约 ${metrics.areaMu.toFixed(2)} 亩` : '—' },
              { key: 'perimeter', label: '边界测算周长', value: metrics ? `约 ${Math.round(metrics.perimeterMeters).toLocaleString('zh-CN')} 米` : '—' },
            ]} />
            {center ? <TiandituMap key={String(farm.farmId)} height={280} showLegend={false} points={[{ id: String(farm.farmId), title: farm.farmName, ...center, boundary: hasBoundary ? farm.boundary : undefined }]} selectedPoint={hasPoint ? { longitude: Number(farm.longitude), latitude: Number(farm.latitude) } : null} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未登记中心坐标和农场边界"><Button onClick={() => navigate(mapPath)}>补录农场位置</Button></Empty>}
            <Typography.Text type="secondary">坐标采用天地图口径；仅登记边界时使用边界中心辅助定位。测算面积不替代登记面积。</Typography.Text>
          </Space>
        </Card>
        <Card title="地块范围检查"><FarmPlotBoundaryChecks farmId={farmId} boundary={farm.boundary} admin /></Card>
        <FarmRectificationPanel farmId={farmId} />
      </Space>}
  </PageContainer>
}
