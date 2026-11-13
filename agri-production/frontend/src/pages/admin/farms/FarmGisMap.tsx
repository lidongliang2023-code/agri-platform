import './FarmSupervisionCompact.css'
import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Button, Form, Input, Modal, Select, Space, Tag, Typography, message } from 'antd'
import { TiandituMap, isValidLngLat, parseBoundaryVertices, polygonCentroid } from '@agri/shared'
import type { ProColumns } from '@ant-design/pro-components'
import PageContainer from '@/components/ProductionPageContainer'
import Card from '@/components/SectionCard'
import { DetailMetricGrid } from '@/components'
import ProTable from '@/components/ProductionTable'
import FarmCoordinateFields from '@/components/FarmCoordinateFields'
import FarmBoundaryFields from '@/components/FarmBoundaryFields'
import { listSupervisedFarmMapPoints, saveSupervisedFarmCoordinates, saveSupervisedFarmBoundary, type FarmMapPoint } from '@/api/admin/farms'

function hasCoordinates(farm: FarmMapPoint): boolean {
  return farm.longitude != null && farm.latitude != null && isValidLngLat(Number(farm.longitude), Number(farm.latitude))
}
function displayPoint(farm: FarmMapPoint) {
  const center = hasCoordinates(farm) ? { longitude: Number(farm.longitude), latitude: Number(farm.latitude) } : polygonCentroid(parseBoundaryVertices(farm.boundary))
  return center ? { id: String(farm.farmId), title: farm.farmName, ...center, boundary: farm.boundary } : null
}
interface CoordinateValues { longitude?: number; latitude?: number; clearCoordinates?: boolean }
interface BoundaryValues { longitude?: number; latitude?: number; boundary?: string; clearBoundary?: boolean }

export default function FarmGisMap({ embedded = false }: { embedded?: boolean }): JSX.Element {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['supervision-map'], queryFn: listSupervisedFarmMapPoints, refetchOnWindowFocus: true })
  const rows = query.data ?? []
  const [keyword, setKeyword] = useState('')
  const [coordinateState, setCoordinateState] = useState('all')
  const [selectedId, setSelectedId] = useState<string>()
  const [editing, setEditing] = useState<FarmMapPoint>()
  const [saving, setSaving] = useState(false)
  const [boundaryEditing, setBoundaryEditing] = useState<FarmMapPoint>()
  const [boundarySaving, setBoundarySaving] = useState(false)
  const [boundaryForm] = Form.useForm<BoundaryValues>()
  const [form] = Form.useForm<CoordinateValues>()
  const filtered = rows.filter(farm => (!keyword.trim() || [farm.farmName, farm.farmCode, farm.tenantName, farm.tenantId, farm.province, farm.city, farm.district].join(' ').toLowerCase().includes(keyword.trim().toLowerCase())) && (coordinateState === 'all' || hasCoordinates(farm) === (coordinateState === 'valid')))
  const points = useMemo(() => filtered.map(displayPoint).filter((point): point is NonNullable<typeof point> => point !== null), [query.data, keyword, coordinateState])
  const selected = filtered.find(farm => String(farm.farmId) === selectedId)
  const openEditor = (farm: FarmMapPoint) => {
    form.resetFields()
    form.setFieldsValue({ longitude: farm.longitude == null ? undefined : Number(farm.longitude), latitude: farm.latitude == null ? undefined : Number(farm.latitude), clearCoordinates: false })
    setEditing(farm)
  }
  const openBoundaryEditor = (farm: FarmMapPoint) => {
    boundaryForm.resetFields()
    boundaryForm.setFieldsValue({ boundary: farm.boundary ?? undefined, clearBoundary: false, longitude: farm.longitude == null ? undefined : Number(farm.longitude), latitude: farm.latitude == null ? undefined : Number(farm.latitude) })
    setBoundaryEditing(farm)
  }
  const saveBoundary = async () => {
    if (!boundaryEditing || boundarySaving) return
    let values: BoundaryValues
    try { values = await boundaryForm.validateFields() } catch { message.warning('请至少绘制 3 个顶点，或清空边界'); return }
    if (!values.boundary && !values.clearBoundary) { message.warning('请绘制农场边界，或明确选择清空边界'); return }
    setBoundarySaving(true)
    try {
      await saveSupervisedFarmBoundary(boundaryEditing.farmId, values.clearBoundary ? { clearBoundary: true } : { boundary: values.boundary })
      await Promise.all(['supervision-map', 'farm-supervision', 'supervision-detail', 'farm-detail', 'farms', 'farm-plot-boundary-checks'].map(key => queryClient.invalidateQueries({ queryKey: [key] })))
      setSelectedId(String(boundaryEditing.farmId))
      setBoundaryEditing(undefined)
      message.success('农场边界已保存，农场档案与监管地图已同步')
    } catch (error) { message.error(error instanceof Error ? error.message : '边界保存失败') }
    finally { setBoundarySaving(false) }
  }
  const requestedFarmId = params.get('farmId')
  useEffect(() => {
    if (!requestedFarmId || !query.data) return
    const farm = query.data.find(row => String(row.farmId) === requestedFarmId)
    if (farm) { setSelectedId(String(farm.farmId)); if (params.get('edit') === 'boundary') openBoundaryEditor(farm); else openEditor(farm) }
    else message.warning('该农场不在当前监管范围内')
    setParams(current => { const next = new URLSearchParams(current); next.delete('farmId'); next.delete('edit'); return next }, { replace: true })
  }, [requestedFarmId, query.data])
  const save = async () => {
    if (!editing || saving) return
    let values: CoordinateValues
    try { values = await form.validateFields() } catch { return }
    if (!values.clearCoordinates && (values.longitude == null || values.latitude == null)) { message.warning('请填写完整经纬度，或选择清空坐标'); return }
    setSaving(true)
    try {
      await saveSupervisedFarmCoordinates(editing.farmId, values.clearCoordinates ? { clearCoordinates: true } : { longitude: values.longitude, latitude: values.latitude })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['supervision-map'] }),
        queryClient.invalidateQueries({ queryKey: ['farm-supervision'] }),
        queryClient.invalidateQueries({ queryKey: ['supervision-detail'] }),
        queryClient.invalidateQueries({ queryKey: ['farm-detail'] }),
        queryClient.invalidateQueries({ queryKey: ['farms'] }),
      ])
      message.success('坐标已保存，农场档案与监管地图已同步')
      setSelectedId(values.clearCoordinates ? undefined : String(editing.farmId))
      setEditing(undefined)
    } catch (error) { message.error(error instanceof Error ? error.message : '坐标保存失败') }
    finally { setSaving(false) }
  }
  const columns: ProColumns<FarmMapPoint>[] = [
    { title: '农场', dataIndex: 'farmName', width: 240 },
    { title: '所属区域', width: 190, render: (_, farm) => [farm.province, farm.city, farm.district].filter(Boolean).join(' / ') || '—' },
    { title: '所属经营主体', dataIndex: 'tenantName', width: 240, render: (_, farm) => farm.tenantName || '主体名称暂不可用' },
    { title: '经度', width: 140, render: (_, farm) => farm.longitude == null ? '—' : Number(farm.longitude).toFixed(8) },
    { title: '纬度', width: 140, render: (_, farm) => farm.latitude == null ? '—' : Number(farm.latitude).toFixed(8) },
    { title: '坐标状态', width: 120, render: (_, farm) => <Tag color={hasCoordinates(farm) ? 'green' : 'orange'}>{hasCoordinates(farm) ? '已登记' : '待补录'}</Tag> },
    { title: '边界状态', width: 110, render: (_, farm) => <Tag color={parseBoundaryVertices(farm.boundary).length >= 3 ? 'green' : 'default'}>{parseBoundaryVertices(farm.boundary).length >= 3 ? '已绘制' : '未绘制'}</Tag> },
    { title: '操作', valueType: 'option', fixed: 'right', width: 330, render: (_, farm) => <Space size={0}>
      <Button type="link" disabled={!displayPoint(farm)} onClick={() => setSelectedId(String(farm.farmId))}>定位</Button>
      <Button type="link" onClick={() => openEditor(farm)}>{hasCoordinates(farm) ? '编辑坐标' : '补录坐标'}</Button>
      <Button type="link" onClick={() => openBoundaryEditor(farm)}>{farm.boundary ? '编辑边界' : '绘制边界'}</Button>
      <Button type="link" onClick={() => navigate(`/admin/production/farms/${farm.farmId}`)}>监管详情</Button>
    </Space> },
  ]
  const validCount = rows.filter(hasCoordinates).length
  const content = <>
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <DetailMetricGrid items={[
        { key: 'total', title: '监管农场', value: query.data ? rows.length : null, suffix: '个' },
        { key: 'point', title: '已登记坐标', value: query.data ? validCount : null, suffix: '个' },
        { key: 'missing', title: '待补录坐标', value: query.data ? rows.length - validCount : null, suffix: '个' },
        { key: 'boundary', title: '已绘制边界', value: query.data ? rows.filter(farm => parseBoundaryVertices(farm.boundary).length >= 3).length : null, suffix: '个' },
      ]} />
      {query.isError && <Alert type="error" showIcon message="坐标查询失败" description={(query.error as Error).message} action={<Button onClick={() => void query.refetch()}>重试</Button>} />}
      <Card title="农场监管地图" extra={<Button onClick={() => { setSelectedId(undefined); void query.refetch() }}>刷新地图</Button>}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Input.Search allowClear value={keyword} onChange={event => setKeyword(event.target.value)} placeholder="农场名称 / 编号 / 主体 / 区域" style={{ width: 320, maxWidth: '100%' }} />
          <Select value={coordinateState} onChange={value => { setCoordinateState(value); setSelectedId(undefined) }} style={{ width: 160 }} options={[{ value: 'all', label: '全部坐标状态' }, { value: 'valid', label: '已登记坐标' }, { value: 'missing', label: '待补录坐标' }]} />
          <Typography.Text type="secondary">筛选 {filtered.length} 个农场，地图显示 {points.length} 个点位</Typography.Text>
          {selectedId && <Button onClick={() => setSelectedId(undefined)}>查看全部点位</Button>}
        </Space>
        <TiandituMap key={selectedId ?? 'all'} height={360} points={selected && displayPoint(selected) ? [displayPoint(selected)!] : points} showLegend={false} selectedPoint={selected && hasCoordinates(selected) && !selected.boundary ? { longitude: Number(selected.longitude), latitude: Number(selected.latitude) } : null} onPointClick={point => setSelectedId(String(point.id))} />
        {selected && <Space wrap style={{ marginTop: 12 }}><Typography.Text strong>{selected.farmName}</Typography.Text><Typography.Text type="secondary">{hasCoordinates(selected) ? `${selected.longitude}, ${selected.latitude}` : '中心坐标未登记 · 使用边界中心定位'}</Typography.Text><Button type="link" onClick={() => openEditor(selected)}>编辑坐标</Button><Button type="link" onClick={() => openBoundaryEditor(selected)}>维护边界</Button><Button type="link" onClick={() => navigate(`/admin/production/farms/${selected.farmId}`)}>监管详情</Button></Space>}
      </Card>
      <Card title="农场位置与边界台账"><ProTable<FarmMapPoint> rowKey="farmId" columns={columns} dataSource={filtered} loading={query.isFetching} search={false} scroll={{ x: 1490 }} columnWidthStorageKey="supervision-map" options={{ reload: () => void query.refetch() }} pagination={{ defaultPageSize: 10, showSizeChanger: true }} /></Card>
    </Space>
    <Modal title={`维护坐标 · ${editing?.farmName ?? ''}`} open={!!editing} width={860} destroyOnClose maskClosable={false} closable={!saving} confirmLoading={saving} cancelButtonProps={{ disabled: saving }} okText="保存坐标" onOk={() => void save()} onCancel={() => { if (!saving) setEditing(undefined) }}>
      <Typography.Paragraph type="secondary">{[editing?.province, editing?.city, editing?.district].filter(Boolean).join(' / ')} · 所属经营主体：{editing?.tenantName || '主体名称暂不可用'}</Typography.Paragraph>
      <Form form={form} layout="vertical" disabled={saving}><FarmCoordinateFields form={form} disabled={saving} address={() => [editing?.province, editing?.city, editing?.district, editing?.address].filter(Boolean).join('')} /></Form>
    </Modal>
    <Modal title={`绘制农场边界 · ${boundaryEditing?.farmName ?? ''}`} open={!!boundaryEditing} width={960} destroyOnClose maskClosable={false} closable={!boundarySaving} confirmLoading={boundarySaving} cancelButtonProps={{ disabled: boundarySaving }} okText="保存边界" onOk={() => void saveBoundary()} onCancel={() => { if (!boundarySaving) setBoundaryEditing(undefined) }}>
      <Form form={boundaryForm} layout="vertical" disabled={boundarySaving}>
        <Form.Item name="longitude" hidden><Input /></Form.Item><Form.Item name="latitude" hidden><Input /></Form.Item>
        <FarmBoundaryFields key={String(boundaryEditing?.farmId)} form={boundaryForm} disabled={boundarySaving} address={() => [boundaryEditing?.province, boundaryEditing?.city, boundaryEditing?.district, boundaryEditing?.address].filter(Boolean).join('')} />
      </Form>
    </Modal>
  </>
  return embedded ? content : <PageContainer className="farm-supervision-compact" title="农场监管" subTitle="农场地理分布、坐标维护与主体档案联动">{content}</PageContainer>
}
