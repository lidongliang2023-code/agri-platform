import { computed, defineComponent, h, watchEffect } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter, type HistoryState } from 'vue-router'

export { RouterView, useRoute, useRouter }
export function useNavigate() {
  const router = useRouter()
  return (target: string | number, options?: { replace?: boolean; state?: any }) => {
    if (typeof target === 'number') return router.go(target)
    return options?.replace ? router.replace({ path: target, state: options.state as HistoryState }) : router.push({ path: target, state: options?.state as HistoryState })
  }
}
export function useLocation() {
  const route = useRoute()
  return computed(() => ({ pathname: route.path, search: route.fullPath.includes('?') ? `?${route.fullPath.split('?')[1].split('#')[0]}` : '', hash: route.hash, key: route.fullPath, state: typeof window !== 'undefined' ? window.history.state : null }))
}
export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>() {
  const route = useRoute()
  return new Proxy({} as T, { get: (_, key: string) => { const value = route.params[key]; return Array.isArray(value) ? value[0] : value } })
}
export function useSearchParams() {
  const route = useRoute(), router = useRouter()
  const params = computed(() => new URLSearchParams(route.fullPath.split('?')[1]?.split('#')[0] ?? ''))
  const update = (next: URLSearchParams | Record<string, string> | ((previous: URLSearchParams) => URLSearchParams), options?: { replace?: boolean }) => {
    const value = typeof next === 'function' ? next(new URLSearchParams(params.value)) : next
    const query = new URLSearchParams(value).toString()
    const target = `${route.path}${query ? `?${query}` : ''}${route.hash}`
    return options?.replace ? router.replace(target) : router.push(target)
  }
  return [params, update] as const
}
export const Link = defineComponent({
  name: 'ProductionRouterLink', inheritAttrs: false,
  props: { to: { type: String, required: true }, replace: Boolean },
  setup(props, { attrs, slots }) { return () => h(RouterLink, { ...attrs, ...props }, slots) },
})
export const Navigate = defineComponent({
  name: 'ProductionNavigate', props: { to: { type: String, required: true }, replace: Boolean },
  setup(props) { const router = useRouter(); watchEffect(() => { void (props.replace ? router.replace(props.to) : router.push(props.to)) }); return () => null },
})
