import { ref } from 'vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { requireChannelLogin as guard } from './session'
export function useNativePage(load: () => Promise<void>, access: () => boolean = guard) {
  const loading = ref(false), error = ref(''), busy = ref(false)
  let generation = 0
  async function reload() {
    if (loading.value) { uni.stopPullDownRefresh(); return }
    if (!access()) { uni.stopPullDownRefresh(); return }
    const current = ++generation
    loading.value = true; error.value = ''
    try { await load() } catch (e) { if(current === generation) error.value = e instanceof Error ? e.message : '加载失败，请重试' }
    finally { if(current === generation) loading.value = false; uni.stopPullDownRefresh() }
  }
  async function act(action: () => Promise<{success?: boolean; message?: string}>, refresh = true) {
    if (busy.value || loading.value || !access()) return false
    busy.value = true; error.value = ''
    try {
      const result = await action()
      if (result.success !== true) throw new Error(result.message || '操作未完成，请重试')
      uni.showToast({title: result.message || '操作成功', icon:'none'})
      if(refresh) await reload()
      return true
    } catch(e) { error.value = e instanceof Error ? e.message : '操作失败'; return false }
    finally {busy.value = false}
  }
  onShow(reload); onPullDownRefresh(reload)
  return {loading,error,busy,reload,act}
}
export function go(url: string) { uni.navigateTo({url}) }
export function confirmAction(content: string): Promise<boolean> {
  return new Promise(resolve => uni.showModal({title:'请确认',content,success:(r: {confirm?:boolean})=>resolve(!!r.confirm),fail:()=>resolve(false)}))
}
