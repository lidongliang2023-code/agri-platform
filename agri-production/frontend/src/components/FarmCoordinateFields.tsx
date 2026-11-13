import { useRef, useState } from 'react'
import { Alert, Button, Form, InputNumber, Space, Switch, Typography, message } from 'antd'
import type { FormInstance } from 'antd'
import { TiandituMap, geocodeAddress, isValidLngLat } from '@agri/shared'

interface Props {
  form: FormInstance
  disabled?: boolean
  address?: () => string
}

/** 经纬度统一以天地图地理坐标录入，地图交互仅修改草稿。 */
export default function FarmCoordinateFields({ form, disabled = false, address }: Props): JSX.Element {
  const longitude = Form.useWatch('longitude', form)
  const latitude = Form.useWatch('latitude', form)
  const clearing = Form.useWatch('clearCoordinates', form)
  const [locating, setLocating] = useState(false)
  const [locationHint, setLocationHint] = useState('')
  const revision = useRef(0)
  const disabledRef = useRef(disabled)
  disabledRef.current = disabled
  const valid = longitude != null && latitude != null && isValidLngLat(Number(longitude), Number(latitude))
  const setPoint = (point: { longitude: number; latitude: number }) => {
    if (disabledRef.current) return
    revision.current += 1
    form.setFieldsValue({ longitude: Number(point.longitude.toFixed(8)), latitude: Number(point.latitude.toFixed(8)), clearCoordinates: false })
    void form.validateFields(['longitude', 'latitude']).catch(() => undefined)
  }
  const locate = async () => {
    const keyword = address?.().trim()
    if (!keyword) { message.warning('请先填写农场地址'); return }
    const requestRevision = ++revision.current
    setLocating(true)
    try {
      const result = await geocodeAddress(keyword)
      if (revision.current !== requestRevision || disabledRef.current) return
      setPoint(result)
      setLocationHint(`地址匹配：${result.matchedAddress || keyword}${result.level ? `（${result.level}）` : ''}。请在地图确认准确位置后保存。`)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '地址定位失败，请手工录入或地图选点')
    } finally { setLocating(false) }
  }
  return <div style={{ marginBottom: 20 }}>
    <Typography.Text strong>农场地理坐标</Typography.Text>
    <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 12 }}>
      经纬度单位为度，顺序为经度、纬度。请使用天地图同一坐标口径；高德、百度等来源坐标应先转换后录入。
    </Typography.Paragraph>
    <Form.Item name="clearCoordinates" hidden valuePropName="checked"><Switch /></Form.Item>
    <Space size={16} wrap align="start">
      <Form.Item name="longitude" label="经度" dependencies={['latitude', 'clearCoordinates']} rules={[
        { type: 'number', min: -180, max: 180, message: '经度范围为 -180～180' },
        { validator: (_, value) => value == null && form.getFieldValue('latitude') != null ? Promise.reject(new Error('请同时填写经度')) : Promise.resolve() },
      ]}>
        <InputNumber disabled={disabled} min={-180} max={180} precision={8} placeholder="-180～180" style={{ width: 210 }} onChange={() => { revision.current += 1; form.setFieldValue('clearCoordinates', false) }} />
      </Form.Item>
      <Form.Item name="latitude" label="纬度" dependencies={['longitude', 'clearCoordinates']} rules={[
        { type: 'number', min: -90, max: 90, message: '纬度范围为 -90～90' },
        { validator: (_, value) => value == null && form.getFieldValue('longitude') != null ? Promise.reject(new Error('请同时填写纬度')) : Promise.resolve() },
      ]}>
        <InputNumber disabled={disabled} min={-90} max={90} precision={8} placeholder="-90～90" style={{ width: 210 }} onChange={() => { revision.current += 1; form.setFieldValue('clearCoordinates', false) }} />
      </Form.Item>
      <Space wrap style={{ marginTop: 30 }}>
        {address && <Button disabled={disabled} loading={locating} onClick={() => void locate()}>按地址定位</Button>}
        <Button disabled={disabled} onClick={() => {
          revision.current += 1
          form.setFieldsValue({ longitude: undefined, latitude: undefined, clearCoordinates: true })
          setLocationHint('')
          void form.validateFields(['longitude', 'latitude']).catch(() => undefined)
        }}>清空坐标</Button>
      </Space>
    </Space>
    {clearing && <Alert type="warning" showIcon message="保存后将清空农场原有坐标；取消或离开页面不会生效。" style={{ marginBottom: 12 }} />}
    {locationHint && <Alert type="info" showIcon message={locationHint} style={{ marginBottom: 12 }} />}
    <TiandituMap height={340} showLegend={false} selectable={!disabled} selectedPoint={valid ? { longitude: Number(longitude), latitude: Number(latitude) } : null} onMapClick={setPoint} />
    <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>点击地图回填坐标，保存后同步到农场资料和运营监管地图。底图不可用时仍可手工输入。</Typography.Paragraph>
  </div>
}
