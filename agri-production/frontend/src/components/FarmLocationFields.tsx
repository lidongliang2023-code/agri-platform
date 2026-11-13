import { useMemo, useRef, useState } from 'react'
import { Alert, Button, Form, Grid, Input, InputNumber, Segmented, Space, Switch, Typography, message } from 'antd'
import type { FormInstance } from 'antd'
import { TiandituBoundaryEditor, geocodeAddress, isValidLngLat, parseBoundaryVertices } from '@agri/shared'

interface Props {
  form: FormInstance
  disabled?: boolean
  address?: () => string
}

/** 农场中心坐标与边界共用地图，所有修改由农场表单统一保存。 */
export default function FarmLocationFields({ form, disabled = false, address }: Props): JSX.Element {
  const screens = Grid.useBreakpoint()
  const longitude = Form.useWatch('longitude', form)
  const latitude = Form.useWatch('latitude', form)
  const boundary = Form.useWatch('boundary', form) as string | undefined
  const clearCoordinates = Form.useWatch('clearCoordinates', form)
  const clearBoundary = Form.useWatch('clearBoundary', form)
  const vertices = useMemo(() => parseBoundaryVertices(boundary), [boundary])
  const [mode, setMode] = useState<'point' | 'boundary'>('point')
  const [locating, setLocating] = useState(false)
  const [hint, setHint] = useState('')
  const [focus, setFocus] = useState<{ longitude: number; latitude: number } | null>(null)
  const [locateSignal, setLocateSignal] = useState(0)
  const revision = useRef(0)
  const disabledRef = useRef(disabled)
  disabledRef.current = disabled
  const validPoint = longitude != null && latitude != null && isValidLngLat(Number(longitude), Number(latitude))
  const point = validPoint ? { longitude: Number(longitude), latitude: Number(latitude) } : null

  const setPoint = (value: { longitude: number; latitude: number }) => {
    if (disabledRef.current) return
    revision.current += 1
    form.setFieldsValue({ longitude: Number(value.longitude.toFixed(8)), latitude: Number(value.latitude.toFixed(8)), clearCoordinates: false })
    setFocus(null)
    setLocateSignal(signal => signal + 1)
    void form.validateFields(['longitude', 'latitude']).catch(() => undefined)
  }
  const setVertices = (value: number[][]) => {
    if (disabledRef.current) return
    if (value.length > 500) { message.warning('边界最多支持 500 个顶点'); return }
    form.setFieldsValue({ boundary: value.length ? JSON.stringify({ type: 'Polygon', coordinates: [[...value, value[0]]] }) : undefined, clearBoundary: value.length === 0 })
    void form.validateFields(['boundary']).catch(() => undefined)
  }
  const locate = async () => {
    const keyword = address?.().trim()
    if (!keyword) { message.warning('请先填写农场地址'); return }
    const requestRevision = ++revision.current
    const requestedMode = mode
    setLocating(true)
    try {
      const result = await geocodeAddress(keyword)
      if (revision.current !== requestRevision || disabledRef.current) return
      if (requestedMode === 'point') setPoint(result)
      else { setFocus(result); setLocateSignal(signal => signal + 1) }
      setHint(`地址匹配：${result.matchedAddress || keyword}。${requestedMode === 'point' ? '请确认农场中心点后保存。' : '请沿农场外围绘制边界，中心坐标保持不变。'}`)
    } catch (error) {
      if (revision.current === requestRevision) message.error(error instanceof Error ? error.message : '地址定位失败，请手工录入或地图选点')
    } finally { setLocating(false) }
  }

  return <div className="farm-location-fields" style={{ marginBottom: 24 }}>
    <Typography.Title level={5}>农场位置与边界</Typography.Title>
    <Typography.Paragraph type="secondary">中心坐标与农场边界在同一地图维护，采用天地图经纬度口径（经度在前、纬度在后）。边界测算面积仅供参考，不替代登记面积。</Typography.Paragraph>
    <Form.Item name="clearCoordinates" hidden valuePropName="checked"><Switch /></Form.Item>
    <Form.Item name="clearBoundary" hidden valuePropName="checked"><Switch /></Form.Item>
    <Form.Item name="boundary" hidden rules={[{ validator: (_, value) => !value || parseBoundaryVertices(value).length >= 3 ? Promise.resolve() : Promise.reject(new Error('农场边界至少需要 3 个不同顶点')) }]}><Input /></Form.Item>
    <Space className="farm-coordinate-fields" wrap size={16} align="start">
      <Form.Item name="longitude" label="中心点经度" dependencies={['latitude', 'clearCoordinates']} rules={[
        { type: 'number', min: -180, max: 180, message: '经度范围为 -180～180' },
        { validator: (_, value) => value == null && form.getFieldValue('latitude') != null ? Promise.reject(new Error('请同时填写经度')) : Promise.resolve() },
      ]}>
        <InputNumber disabled={disabled} min={-180} max={180} precision={8} placeholder="-180～180" style={{ width: 210 }} onChange={() => { revision.current += 1; form.setFieldValue('clearCoordinates', false); setFocus(null) }} />
      </Form.Item>
      <Form.Item name="latitude" label="中心点纬度" dependencies={['longitude', 'clearCoordinates']} rules={[
        { type: 'number', min: -90, max: 90, message: '纬度范围为 -90～90' },
        { validator: (_, value) => value == null && form.getFieldValue('longitude') != null ? Promise.reject(new Error('请同时填写纬度')) : Promise.resolve() },
      ]}>
        <InputNumber disabled={disabled} min={-90} max={90} precision={8} placeholder="-90～90" style={{ width: 210 }} onChange={() => { revision.current += 1; form.setFieldValue('clearCoordinates', false); setFocus(null) }} />
      </Form.Item>
      <Button disabled={disabled} style={{ marginTop: 30 }} onClick={() => {
        revision.current += 1
        form.setFieldsValue({ longitude: undefined, latitude: undefined, clearCoordinates: true })
        setFocus(null); setHint('')
        void form.validateFields(['longitude', 'latitude']).catch(() => undefined)
      }}>清空中心坐标</Button>
    </Space>
    <Space className="farm-location-toolbar" wrap style={{ marginBottom: 12 }}>
      <Segmented disabled={disabled} value={mode} options={[{ label: '选取中心点', value: 'point' }, { label: '绘制边界', value: 'boundary' }]} onChange={value => { revision.current += 1; setMode(value as 'point' | 'boundary'); setHint(''); setFocus(null) }} />
      {address && <Button disabled={disabled} loading={locating} onClick={() => void locate()}>按地址定位</Button>}
      <Typography.Text type="secondary">中心坐标{validPoint ? '已登记' : '未登记'} · 边界 {vertices.length} 个顶点（最多 500 个）</Typography.Text>
    </Space>
    {clearCoordinates && <Alert type="warning" showIcon message="保存后将清空原有中心坐标，边界不受影响。" style={{ marginBottom: 12 }} />}
    {clearBoundary && <Alert type="warning" showIcon message="保存后将清空原有边界，中心坐标不受影响。" style={{ marginBottom: 12 }} />}
    {vertices.length > 0 && vertices.length < 3 && <Alert type="warning" showIcon message="边界至少需要 3 个不同顶点才能保存。" style={{ marginBottom: 12 }} />}
    {hint && <Alert type="info" showIcon message={hint} style={{ marginBottom: 12 }} />}
    <TiandituBoundaryEditor value={vertices} onChange={setVertices} disabled={disabled} height={screens.md === false ? 280 : 400} focusPoint={focus ?? point} locateSignal={locateSignal} selectionMode={mode} onPointSelect={setPoint} showFocusMarkerWithBoundary />
    <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
      {mode === 'point' ? '点击地图设置农场中心点，已绘制边界保持不变。' : '沿农场外围依次点击绘制，点击顶点可删除该点；中心坐标保持不变。'} 保存后统一同步到农场档案与运营监管地图；取消不会生效。高德、百度等来源坐标请先转换后录入。
    </Typography.Paragraph>
  </div>
}
