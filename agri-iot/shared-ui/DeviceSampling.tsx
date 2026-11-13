import { useEffect, useState, type FormEvent } from 'react'

export interface MetricSamplingConfig {
  metricKey: string
  metricName: string
  enabled: boolean
  intervalSeconds: number | null
  toleranceSeconds: number
  effectiveIntervalSeconds: number | null
  effectiveToleranceSeconds: number
  maxGapSeconds: number | null
  effectiveAt?: string | null
}

export interface SamplingConfig {
  intervalSeconds: number | null
  toleranceSeconds: number
  effectiveAt?: string | null
  maxGapSeconds?: number | null
  metrics: MetricSamplingConfig[]
  fallbackDescription?: string
}

export default function DeviceSampling({ deviceId, load, save }: {
  deviceId: number
  load: (id: number) => Promise<SamplingConfig>
  save: (id: number, body: SamplingConfig) => Promise<SamplingConfig>
}) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<SamplingConfig | null>(null)
  const [defaultEnabled, setDefaultEnabled] = useState(false)
  const [defaultInterval, setDefaultInterval] = useState('30')
  const [defaultTolerance, setDefaultTolerance] = useState('0')
  const [metrics, setMetrics] = useState<MetricSamplingConfig[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const apply = (value: SamplingConfig) => {
    setConfig(value)
    setDefaultEnabled(value.intervalSeconds != null)
    setDefaultInterval(String(value.intervalSeconds ?? 30))
    setDefaultTolerance(String(value.toleranceSeconds ?? 0))
    setMetrics(value.metrics ?? [])
  }

  useEffect(() => {
    let live = true
    setLoading(true)
    setError('')
    load(deviceId).then(value => { if (live) apply(value) })
      .catch(error => { if (live) setError(error instanceof Error ? error.message : '读取配置失败') })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [deviceId, load])

  const updateMetric = (key: string, patch: Partial<MetricSamplingConfig>) => {
    setMetrics(items => items.map(item => item.metricKey === key ? { ...item, ...patch } : item))
    setNotice('')
  }

  const validate = (enabled: boolean, intervalText: string, toleranceText: string, label: string) => {
    const seconds = Number(intervalText)
    const delay = Number(toleranceText)
    if (enabled && (!intervalText || !toleranceText || !Number.isInteger(seconds) || seconds < 1 || seconds > 86400
      || !Number.isInteger(delay) || delay < 0 || delay > seconds)) {
      throw new Error(`${label}的采样周期须为 1～86400 的整数秒，允许延迟须为 0～采样周期的整数秒`)
    }
    return { seconds, delay }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setNotice('')
    setError('')
    try {
      const defaults = validate(defaultEnabled, defaultInterval, defaultTolerance, '设备默认')
      const normalizedMetrics = metrics.map(item => {
        const values = validate(item.enabled, String(item.intervalSeconds ?? ''), String(item.toleranceSeconds ?? 0), item.metricName)
        return {
          ...item,
          intervalSeconds: item.enabled ? values.seconds : null,
          toleranceSeconds: item.enabled ? values.delay : 0,
        }
      })
      setSaving(true)
      const saved = await save(deviceId, {
        intervalSeconds: defaultEnabled ? defaults.seconds : null,
        toleranceSeconds: defaultEnabled ? defaults.delay : 0,
        metrics: normalizedMetrics,
      })
      apply(saved)
      setNotice('独立采样周期已保存，未向设备下发配置')
    } catch (error) {
      setError(error instanceof Error ? error.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = { width: 112, maxWidth: '100%', border: '1px solid #d9d9d9', borderRadius: 6, padding: '6px 8px', minHeight: 34 }
  return <section aria-label="设备采样配置" style={{ border: '1px solid #eee', borderRadius: 8, padding: 14, margin: '12px 0' }}>
    <b>指标独立采样周期与持续告警</b>
    {loading && <p role="status">读取配置中…</p>}
    <form onSubmit={event => void submit(event)} style={{ marginTop: 12 }}>
      <fieldset disabled={loading || saving || !config} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <div style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 12, marginBottom: 12 }}>
          <b style={{ fontSize: 13 }}>设备默认值</b>
          <p style={{ color: '#666', fontSize: 12, margin: '4px 0 8px' }}>未单独配置的指标使用此值；关闭后，未单独配置指标按规则持续时长保守判定。</p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <input type="checkbox" checked={defaultEnabled} onChange={event => { setDefaultEnabled(event.target.checked); setNotice('') }} />
            启用设备默认采样周期
          </label>
          {defaultEnabled && <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>周期（秒）<input aria-label="设备默认采样周期（秒）" type="number" min={1} max={86400} step={1} value={defaultInterval} onChange={event => setDefaultInterval(event.target.value)} style={inputStyle} /></label>
            <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>允许延迟（秒）<input aria-label="设备默认允许延迟（秒）" type="number" min={0} max={Number(defaultInterval) || 86400} step={1} value={defaultTolerance} onChange={event => setDefaultTolerance(event.target.value)} style={inputStyle} /></label>
          </div>}
        </div>
        <div>
          <b style={{ fontSize: 13 }}>按指标独立配置</b>
          {metrics.length === 0 && <p style={{ color: '#888', fontSize: 12 }}>设备类型暂未登记可配置指标。</p>}
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            {metrics.map(item => <div key={item.metricKey} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 150 }}>
                <input type="checkbox" checked={item.enabled} onChange={event => updateMetric(item.metricKey, { enabled: event.target.checked })} />
                <span>{item.metricName}</span><small style={{ color: '#999' }}>({item.metricKey})</small>
              </label>
              {item.enabled ? <>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>周期 <input aria-label={`${item.metricName}采样周期（秒）`} type="number" min={1} max={86400} step={1} value={item.intervalSeconds ?? ''} onChange={event => updateMetric(item.metricKey, { intervalSeconds: Number(event.target.value) || null })} style={inputStyle} /></label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>延迟 <input aria-label={`${item.metricName}允许延迟（秒）`} type="number" min={0} max={item.intervalSeconds || 86400} step={1} value={item.toleranceSeconds} onChange={event => updateMetric(item.metricKey, { toleranceSeconds: Number(event.target.value) || 0 })} style={inputStyle} /></label>
              </> : <small style={{ color: '#888' }}>{config?.intervalSeconds == null ? '使用规则持续时长' : `使用设备默认 ${config.intervalSeconds} 秒`}</small>}
            </div>)}
          </div>
        </div>
        <p style={{ color: '#666', fontSize: 12, marginBottom: 8 }}>每个指标按自己的周期检查连续性，超过“对应周期＋允许延迟”的采样间隔将中断持续条件。修改后该指标重新积累持续时间，既有告警仍需人工结案。保存不会修改硬件采样频率或自动发送指令。</p>
        {config && <p style={{ color: '#666', fontSize: 12, overflowWrap: 'anywhere' }}>设备默认最大间隔：{config.maxGapSeconds == null ? '按规则时长' : `${config.maxGapSeconds} 秒`}；已配置独立指标：{metrics.filter(item => item.enabled).length} 项；生效时间：{config.effectiveAt?.replace('T', ' ') || '历史配置 / 未配置'}</p>}
        <button type="submit" style={{ border: 0, borderRadius: 6, padding: '7px 14px', background: '#12764a', color: '#fff', cursor: 'pointer' }}>{saving ? '保存中…' : '保存采样配置'}</button>
      </fieldset>
    </form>
    {error && <p role="alert" style={{ color: '#cf1322' }}>{error}</p>}
    {notice && <p role="status" style={{ color: '#12764a' }}>{notice}</p>}
  </section>
}
