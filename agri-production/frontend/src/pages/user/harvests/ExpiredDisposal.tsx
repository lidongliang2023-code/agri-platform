import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Checkbox, Form, Input, InputNumber, Modal, Select, message } from 'antd'
import type { InventoryRecord } from '@/types'
import { inventoryExpiryState } from '@/types'
import { http } from '@/utils/request'
import useAuthStore from '@/store/auth'

/** 过期实物处置复用报损账务；只登记已完成的处置，不承担审批或实物销毁。 */
export default function ExpiredDisposal({ record, onDone }: { record: InventoryRecord; onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [scope, setScope] = useState<string | undefined>()
  const [form] = Form.useForm()
  const tenantId = useAuthStore(state => state.userInfo?.tenantId)
  const eligible = (inventoryExpiryState(record.expireDate) === 'expired' || record.healthStatus === 'expired') && record.currentQty > 0
  const permission = useQuery({
    queryKey: ['inventory-disposal-permission', tenantId],
    queryFn: () => http.get<{tenantId: string; allowed: boolean; reason: string}>('/harvests/inventory/disposal-permission'),
    enabled: eligible && Boolean(tenantId), retry: false, staleTime: 0,
  })
  const allowed = !permission.isError && permission.data?.allowed === true && String(permission.data.tenantId) === String(tenantId)
  useEffect(() => { setOpen(false); setError(''); form.resetFields() }, [tenantId, record.inventoryId, form])
  if (!(inventoryExpiryState(record.expireDate) === 'expired' || record.healthStatus === 'expired') || !(record.currentQty > 0)) return null
  const submit = async () => {
    if (busy) return
    try {
      const values = await form.validateFields()
      if (scope !== useAuthStore.getState().userInfo?.tenantId) throw new Error('经营主体已切换，请重新打开处置表单')
      setBusy(true); setError('')
      const checked = await permission.refetch()
      if (checked.error) throw new Error('处置权限核验失败，请重试；未提交处置')
      if (!checked.data?.allowed) throw new Error(checked.data?.reason || '仅当前经营主体负责人可登记过期处置')
      if (String(checked.data.tenantId) !== String(scope) || scope !== useAuthStore.getState().userInfo?.tenantId) throw new Error('经营主体已切换，请重新打开处置表单')
      await http.post(`/harvests/inventory/${record.batchId}/loss`, {
        inventoryId: record.inventoryId, expiredDisposal: true, expectedQty: record.currentQty,
        quantity: values.quantity, disposalMethod: values.disposalMethod,
        evidenceNo: values.evidenceNo.trim(), reason: values.reason.trim(),
      })
      setOpen(false); form.resetFields(); message.success('过期处置已登记，余量保持冻结')
      await onDone()
    } catch (e: any) { if (!e?.errorFields) setError(e.message || '处置未完成，请核对流水后重试') }
    finally { setBusy(false) }
  }
  if (!allowed) return <div style={{ maxWidth: 360 }}>
    <Button size="small" disabled>{permission.isFetching ? '正在核验权限' : permission.isError || !tenantId ? '权限待核验' : '仅负责人可登记'}</Button>
    <div style={{ fontSize: 12, color: '#667085', marginTop: 4 }} role="status">
      {permission.isError ? '暂时无法核验处置权限，请重试。库存和流水仍可查看。' : !tenantId ? '请先选择经营主体，再核验处置权限。' : permission.isFetching ? '正在核验当前经营主体的处置权限…' : permission.data?.reason || '处置权限尚未核验，请重试。'}
      {permission.isError && <Button type="link" size="small" onClick={() => void permission.refetch()}>重试</Button>}
    </div>
  </div>
  return <>
    <Button danger size="small" onClick={() => { setScope(useAuthStore.getState().userInfo?.tenantId); setError(''); form.resetFields(); setOpen(true) }}>过期处置</Button>
    <Modal title="过期库存处置" open={open} onCancel={() => { if (!busy) setOpen(false) }} onOk={() => void submit()} okText="确认登记处置" confirmLoading={busy} cancelButtonProps={{ disabled: busy }} closable={!busy} maskClosable={!busy} keyboard={!busy}>
      <Alert type="warning" showIcon message="仅主体负责人可登记已完成的实物处置" description="核销后生成报损流水；支持直接处置冻结库存，剩余量继续冻结。请保存真实凭据，重复凭据不能再次登记。" />
      <p>{record.productName} · {record.warehouseName} · 当前 {record.currentQty} {record.unit} · 有效期 {record.expireDate}</p>
      <Form form={form} layout="vertical" disabled={busy}>
        <Form.Item name="quantity" label={`处置数量（${record.unit || ''}）`} rules={[{ required: true, message: '请输入处置数量' }, {type:'number',min:0.0001,max:record.currentQty,message:'数量必须大于0且不能超过当前库存'}]}><InputNumber min={0.0001} max={record.currentQty} precision={4} style={{ width: '100%' }} /></Form.Item>
        <Form.Item name="disposalMethod" label="处置方式" rules={[{required:true}]}><Select options={[{label:'销毁',value:'DESTROY'},{label:'无害化处理',value:'HARMLESS'}]} /></Form.Item>
        <Form.Item name="evidenceNo" label="处置凭据编号" rules={[{required:true,whitespace:true}]}><Input maxLength={80} /></Form.Item>
        <Form.Item name="reason" label="处置说明" rules={[{required:true,whitespace:true}]}><Input.TextArea maxLength={1000} showCount rows={3} /></Form.Item>
        <Form.Item name="confirmed" valuePropName="checked" rules={[{validator:(_,v)=>v?Promise.resolve():Promise.reject(new Error('请确认实物处置及凭据'))}]}><Checkbox>已核实实物处置完成，数量和凭据准确</Checkbox></Form.Item>
      </Form>
      {error && <Alert type="error" message={error} showIcon />}
    </Modal>
  </>
}
