import { ref } from 'vue'
import { onPullDownRefresh, onUnload } from '@dcloudio/uni-app'
import { infoApi, toast } from './api'
import { isLoggedIn, handleInfoUnauthorized } from './auth'

export function useNativePage(loader: () => Promise<void>) {
 const loading = ref(false)
 const error = ref('')
 let active = true
 onUnload(() => { active = false })
 async function load() {
  if (loading.value || !active) return
  if (!isLoggedIn()) { handleInfoUnauthorized(); uni.stopPullDownRefresh(); return }
  loading.value = true; error.value = ''
  try { await loader() } catch (e) { if(active) error.value = e instanceof Error ? e.message : '加载失败，请重试' }
  finally { loading.value = false; uni.stopPullDownRefresh() }
 }
 onPullDownRefresh(load)
 return { loading, error, load }
}

export function useFavorite(type: string, getItem: () => {id:number;title:string;summary?:string} | null) {
 const saved = ref(false)
 const saving = ref(false)
 async function refresh() {
  const item = getItem(); if (!item) return
  const records = await infoApi.favorites()
  saved.value = records.some(row => row.targetType === type && row.targetId === item.id)
 }
 async function toggle() {
  const item = getItem(); if (!item || saving.value) return
  saving.value = true
  try {
   if(saved.value) await infoApi.removeFavoriteTarget(type, item.id)
   else await infoApi.addFavorite({targetType:type,targetId:item.id,title:item.title,summary:item.summary})
   saved.value = !saved.value
   toast(saved.value ? '已收藏' : '已取消收藏')
  } catch(e) { toast(e instanceof Error ? e.message : '操作失败') }
  finally { saving.value = false }
 }
 return {saved,saving,refresh,toggle}
}
