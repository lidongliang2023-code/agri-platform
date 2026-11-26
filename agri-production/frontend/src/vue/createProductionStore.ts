import { computed, reactive, watch, type ComputedRef } from 'vue'
import { createPinia, defineStore } from 'pinia'

/** 同一 Pinia 实例同时用于应用安装和应用启动前的认证续签。 */
export const productionPinia = createPinia()
type Patch<T> = Partial<T> | ((state: T) => Partial<T>)
export interface ProductionStore<T extends object> {
  (): T
  <R>(selector: (state: T) => R): ComputedRef<R>
  getState(): T
  setState(patch: Patch<T>): void
  subscribe(listener: (state: T, previous: T) => void): () => void
}

/** 状态迁移期间保留请求拦截器 getState/setState 契约；页面选择器返回 computed。 */
export function createProductionStore<T extends object>(id: string, initializer: (set: (patch: Patch<T>) => void, get: () => T) => T): ProductionStore<T> {
  const useStore = defineStore(id, {
    state: (): { model: T } => {
      let state: T
      const set = (patch: Patch<T>) => Object.assign(state, typeof patch === 'function' ? patch(state) : patch)
      state = reactive(initializer(set, () => state)) as T
      return { model: state }
    },
  })
  const getState = () => useStore(productionPinia).$state.model as T
  const select = ((selector?: (state: T) => unknown) => selector ? computed(() => selector(getState())) : getState()) as ProductionStore<T>
  select.getState = getState
  select.setState = patch => { const state = getState(); Object.assign(state, typeof patch === 'function' ? patch(state) : patch) }
  select.subscribe = listener => {
    let previous = { ...getState() }
    return watch(getState(), state => { const next = { ...state }; listener(state as T, previous as T); previous = next }, { deep: true, flush: 'sync' })
  }
  return select
}
