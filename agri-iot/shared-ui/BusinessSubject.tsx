import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { Alert, Button, Select, Spin } from 'antd'
import { attachUnifiedAuth, redirectToSso } from './sso'

interface Subject { merchantId: string; merchantName?: string; status?: number }
interface Summary { activeMerchantId?: string; merchants: Subject[] }
const account = axios.create({ baseURL: '/api/v1/sso/account', timeout: 15000, withCredentials: true })
attachUnifiedAuth(account, 'iot')
async function request<T>(url: string, method: 'get' | 'post' = 'get', signal?: AbortSignal): Promise<T> {
  const response = await account.request({ url, method, ...(method === 'post' ? { data: {} } : {}), signal })
  if (![0, 200].includes(response.data?.code) || !response.data?.data) throw new Error(response.data?.message || '经营主体服务返回异常')
  return response.data.data as T
}
function errorMessage(error: unknown) {
  return axios.isAxiosError(error) ? error.response?.data?.message || '经营主体服务暂时无法连接，请重试' : error instanceof Error ? error.message : '经营主体加载失败'
}

/** 主体来自统一账号；切换后整页重建，卸载所有旧主体表单及在途业务请求。 */
export function useBusinessSubject() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState('')
  const controller = useRef<AbortController | null>(null)
  const currentId = useRef<string | undefined>()
  const switchingRef = useRef(false)
  const load = useCallback(async () => {
    if (switchingRef.current) return
    controller.current?.abort()
    const operation = new AbortController()
    controller.current = operation
    setLoading(true)
    try {
      const next = await request<Summary>('/summary', 'get', operation.signal)
      if (operation.signal.aborted) return
      next.merchants = next.merchants.filter(item => item.status !== 0 && !!item.merchantName?.trim())
      const nextId = String(next.activeMerchantId || '')
      if (currentId.current !== undefined && currentId.current !== nextId) {
        window.location.replace('/dashboard')
        return
      }
      currentId.current = nextId
      setSummary(next)
      setError('')
    } catch (cause) {
      if (!operation.signal.aborted) setError(errorMessage(cause))
    } finally { if (!operation.signal.aborted) setLoading(false) }
  }, [])
  useEffect(() => {
    void load()
    const onFocus = () => { if (document.visibilityState === 'visible') void load() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      controller.current?.abort()
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [load])
  const active = summary?.merchants.find(item => String(item.merchantId) === String(summary.activeMerchantId))
  const switchSubject = async (id: string) => {
    if (switchingRef.current || id === String(active?.merchantId) || !summary?.merchants.some(item => String(item.merchantId) === id)) return
    switchingRef.current = true
    controller.current?.abort()
    setSwitching(true)
    setError('')
    try {
      const result = await request<{ activeMerchantId: string }>(`/businesses/${encodeURIComponent(id)}/activate`, 'post')
      if (String(result.activeMerchantId) !== id) throw new Error('主体切换结果不一致，请重新加载')
      window.location.replace('/dashboard')
    } catch (cause) {
      setError(errorMessage(cause))
      switchingRef.current = false
      setSwitching(false)
      // 不猜测激活结果；重新读取权威主体后才能恢复业务操作。
      void load()
    }
  }
  return {
    ready: !error && !!active,
    busy: loading || switching,
    selector: <div className="iot-subject-picker">
      <label htmlFor="iot-business-subject">经营主体</label>
      <Select id="iot-business-subject" aria-label="切换经营主体" showSearch optionFilterProp="label"
        placeholder={loading ? '加载主体…' : '暂无关联主体'} value={active ? String(active.merchantId) : undefined}
        loading={loading || switching} disabled={loading || switching || !summary?.merchants.length || !!error}
        options={summary?.merchants.map(item => ({ value: String(item.merchantId), label: item.merchantName || `主体 ${item.merchantId}` }))}
        onChange={id => void switchSubject(id)} title="切换主体后将返回工作台，未保存内容不会保留" />
      {error && <Button size="small" onClick={() => void load()}>重试</Button>}
    </div>,
    fallback: <div className="iot-subject-fallback">{loading || switching ? <Spin tip={switching ? '正在切换经营主体…' : '正在核验经营主体…'}><div style={{ minHeight: 140 }} /></Spin> :
      <Alert type={error ? 'error' : 'info'} showIcon message={error || '当前账号暂无可用经营主体'} description="业务数据按统一账号当前经营主体加载，请重试或前往统一账号完善主体关联。"
        action={<Button onClick={() => error ? void load() : void redirectToSso('iot', '/dashboard')}>{error ? '重新加载' : '前往统一账号'}</Button>} />}</div>,
  }
}
