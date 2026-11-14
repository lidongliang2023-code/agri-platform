import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Descriptions, List, Select, Space, Tag, Typography } from 'antd'
import { Link } from 'react-router-dom'
import { pageUsages } from '@/api/inputs'
import { compareActualInputSafety } from '@/api/input-safety'
import type { SafetyCheckResult } from '@/api/input-safety'

export default function InputSafetyEvidence({ record }: { record: Record<string, unknown> }): JSX.Element {
  const { message } = App.useApp()
  const client = useQueryClient()
  const [usageId, setUsageId] = useState<string>()
  const usages = useQuery({ queryKey: ['safety-actual-usages'], queryFn: () => pageUsages({ pageNum: 1, pageSize: 200, status: 1 }) })
  const compare = useMutation({ mutationFn: () => compareActualInputSafety(String(record.id), { usageId: usageId! }), onSuccess: r => { message[r.matched ? 'success' : 'warning'](r.message); void client.invalidateQueries({ queryKey: ['safety-risks'] }); void client.invalidateQueries({ queryKey: ['input-safety-detail'] }) }, onError: (e: Error) => message.error(e.message) })
  const result = record.result as SafetyCheckResult
  const request = record.request as Record<string, unknown>
  const events = (record.events ?? []) as Array<Record<string, unknown>>
  return <Space direction="vertical" size={20} style={{ width: '100%' }}>
    <Descriptions bordered column={1} items={[{ key: 'scope', label: '作物 / 靶标', children: `${String(record.crop_name)} · ${String(record.target_name)}` }, { key: 'region', label: '属地', children: String(request.region ?? '未登记') }, { key: 'dates', label: '拟施用 / 采收', children: `${String(request.applicationDate)} / ${String(request.harvestDate ?? '未提供')}` }, { key: 'operator', label: '操作人', children: String(record.created_by) }, { key: 'state', label: '校验状态', children: <Tag>{result.state === 'PASSED' ? '推荐可用' : result.state === 'NEEDS_REVIEW' ? '部分候选待复核' : '未通过'}</Tag> }]} />
    <List header="本次推荐及拦截依据（不可变快照）" dataSource={[...(result.recommendations ?? []), ...(result.blocked ?? [])]} renderItem={r => <List.Item><List.Item.Meta title={String(r.inputName ?? '范围校验')} description={<><div>{String(r.reason)}</div>{r.registrationNo != null && <div>登记证：{String(r.registrationNo)} · 资料版本：{String(r.sourceVersion ?? '—')}</div>}{r.source != null && <div>出处：{String(r.source)}</div>}</>} /></List.Item>} />
    <Alert showIcon type="info" message="先在原使用台账完成实际登记，再选择记录比对。不会重复记账或扣减库存。" />
    <Link to="/production/inputs?tab=ledger">打开投入品使用台账</Link>
    <Select style={{ width: '100%' }} showSearch optionFilterProp="label" allowClear value={usageId} onChange={setUsageId} options={(usages.data?.list ?? []).map(r => ({ value: String(r.usageId), label: `#${r.usageId} · ${r.inputName ?? ''} · ${r.usedAt ?? ''} · ${r.dosage ?? ''}${r.unit ?? ''}` }))} placeholder="选择近期实际用药台账（最多展示200条）" />
    <Button type="primary" disabled={!usageId} loading={compare.isPending} onClick={() => compare.mutate()}>与真实使用台账比对</Button>
    {compare.data && <Alert type={compare.data.matched ? 'success' : 'warning'} message={compare.data.message} />}
    <List header="审计记录" dataSource={events} renderItem={e => <List.Item><Space direction="vertical"><Typography.Text>{String(e.event_type)} · {String(e.operator)} · {String(e.created_at)}</Typography.Text>{e.event_type !== 'CHECK' && <Typography.Paragraph style={{ margin: 0 }}>{String(e.payload_json)}</Typography.Paragraph>}</Space></List.Item>} />
  </Space>
}
