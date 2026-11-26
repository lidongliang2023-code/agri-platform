import { computed, defineComponent, h, watchEffect } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

export function useNavigate() {
  const router = useRouter()
  return (to: string | number, options?: { replace?: boolean }) => {
    if (typeof to === 'number') return router.go(to)
    return options?.replace ? router.replace(to) : router.push(to)
  }
}
export function useLocation() {
  const route = useRoute()
  return computed(() => ({ pathname: route.path, search: route.fullPath.includes('?') ? `?${route.fullPath.split('?')[1].split('#')[0]}` : '', hash: route.hash, key: route.fullPath }))
}
export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>() {
  const route = useRoute()
  return new Proxy({} as T, { get: (_, key: string) => {
    const value = route.params[key]
    return Array.isArray(value) ? value[0] : value
  } })
}
export function useSearchParams() {
  const route = useRoute()
  const router = useRouter()
  const params = computed(() => new URLSearchParams(route.fullPath.split('?')[1]?.split('#')[0] || ''))
  const update = (next: URLSearchParams | Record<string, string> | ((previous: URLSearchParams) => URLSearchParams), options?: { replace?: boolean }) => {
    const value = typeof next === 'function' ? next(params.value) : next
    const query = new URLSearchParams(value).toString()
    const target = `${route.path}${query ? `?${query}` : ''}${route.hash}`
    return options?.replace ? router.replace(target) : router.push(target)
  }
  return [params, update] as const
}
export const Link = defineComponent({
  name: 'TradeLink', inheritAttrs: false,
  props: { to: { type: String, required: true }, replace: Boolean },
  setup(props, { attrs, slots }) { return () => h(RouterLink, { ...attrs, to: props.to, replace: props.replace }, slots) },
})
export const Navigate = defineComponent({
  name: 'TradeNavigate', props: { to: { type: String, required: true }, replace: Boolean },
  setup(props) { const router = useRouter(); watchEffect(() => { void (props.replace ? router.replace(props.to) : router.push(props.to)) }); return () => null },
})
