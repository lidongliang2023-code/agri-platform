import { useMemo, useRef, useState } from 'react'
import { Alert, Button, Form, Input, Space, Switch, Typography, message } from 'antd'
import type { FormInstance } from 'antd'
import { TiandituBoundaryEditor, geocodeAddress, isValidLngLat, parseBoundaryVertices } from '@agri/shared'

interface Props {
  form: FormInstance
  disabled?: boolean
  address?: () => string
}

/** 农场边界草稿；保存由父级统一提交，不自动更改登记面积或中心点。 */
export default function FarmBoundaryFields({ form, disabled = false, address }: Props): JSX.Element {
  const boundary = Form.useWatch('boundary', form) as string | undefined
  const clearing = Form.useWatch('clearBoundary', form)
  const longitude = Form.useWatch('longitude', form)
  const latitude = Form.useWatch('latitude', form)
  const vertices = useMemo(() => parseBoundaryVertices(boundary), [boundary])
  const [locating, setLocating] = useState(false)
  const [focus, setFocus] = useState<{ longitude: number; latitude: number } | null>(null)
  const [locateSignal, setLocateSignal] = useState(0)
  const request = useRef(0)
  const disabledRef = useRef(disabled)
  disabledRef.current = disabled
  const locate = async () => {
    const keyword = address?.().trim()
    if (!keyword) { message.warning('请先填写农场地址'); return }
    const revision = ++request.current
    setLocating(true)
    try {
      const result = await geocodeAddress(keyword)
      if (request.current !== revision || disabledRef.current) return
      setFocus(result)
      setLocateSignal(signal => signal + 1)
      message.info(`已定位到${result.matchedAddress || keyword}，请确认后沿农场边缘绘制`)
    } catch (error) { if (request.current === revision) message.error(error instanceof Error ? error.message : '地址定位失败') }
    finally { setLocating(false) }
  }
  const setVertices = (value: number[][]) => {
    if (disabledRef.current) return
    form.setFieldsValue({ boundary: value.length ? JSON.stringify({ type: 'Polygon', coordinates: [[...value, value[0]]] }) : undefined, clearBoundary: value.length === 0 })
    void form.validateFields(['boundary']).catch(() => undefined)
  }
  return <div style={{ marginBottom: 20 }}>
    <Typography.Title level={5}>农场边界</Typography.Title>
    <Typography.Paragraph type="secondary">沿农场外围依次点击，至少 3 个顶点形成闭合面。边界测算面积仅供参考，不替代登记面积；坐标采用天地图口径。</Typography.Paragraph>
    <Form.Item name="boundary" hidden rules={[{ validator: (_, value) => !value || parseBoundaryVertices(value).length >= 3 ? Promise.resolve() : Promise.reject(new Error('农场边界至少需要 3 个不同顶点')) }]}><Input /></Form.Item>
    <Form.Item name="clearBoundary" hidden valuePropName="checked"><Switch /></Form.Item>
    <Space wrap style={{ marginBottom: 12 }}>
      {address && <Button disabled={disabled} loading={locating} onClick={() => void locate()}>按地址定位绘制区域</Button>}
      <Button disabled={disabled || !vertices.length} onClick={() => setVertices(vertices.slice(0, -1))}>撤销上一点</Button>
      <Button disabled={disabled || !vertices.length} onClick={() => setVertices([])}>清空边界</Button>
      <Typography.Text type="secondary">已绘制 {vertices.length} 个顶点（最多 500 个）</Typography.Text>
    </Space>
    {clearing && <Alert type="warning" showIcon message="保存后将清空原有农场边界，取消不会生效。" style={{ marginBottom: 12 }} />}
    {vertices.length > 0 && vertices.length < 3 && <Alert type="warning" showIcon message="请继续绘制，至少需要 3 个不同顶点才能保存。" style={{ marginBottom: 12 }} />}
    <TiandituBoundaryEditor value={vertices} onChange={value => { if (value.length > 500) { message.warning('边界最多支持 500 个顶点'); return }; setVertices(value) }} disabled={disabled} height={400} focusPoint={focus ?? (longitude != null && latitude != null && isValidLngLat(Number(longitude), Number(latitude)) ? { longitude: Number(longitude), latitude: Number(latitude) } : null)} locateSignal={locateSignal} />
    <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>点击顶点标记可删除该点。交叉或重叠的边界会在保存时被拒绝，请沿外围按顺序绘制。</Typography.Paragraph>
  </div>
}
