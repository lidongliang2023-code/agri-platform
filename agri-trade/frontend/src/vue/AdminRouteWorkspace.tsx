import { computed, defineComponent, h, markRaw, provide, shallowReactive, watch, type Component, type PropType } from 'vue'
import { routeLocationKey, useRoute, useRouter, type RouteLocationNormalizedLoaded } from 'vue-router'
import { WorkspacePanels } from './WorkspacePanels'
const CachedRoutePanel = defineComponent({
  props: { route: { type: Object as PropType<RouteLocationNormalizedLoaded>, required: true }, view: { type: Object as PropType<Component>, required: true } },
  setup(props) {
    provide(routeLocationKey, props.route)
    return () => h(props.view)
  },
})
export const AdminRouteWorkspace = defineComponent({
  name: 'AdminRouteWorkspace',
  props: { labels: { type: Object as PropType<Record<string, string>>, required: true } },
  setup(props) {
    const route = useRoute(), router = useRouter()
    const cache = shallowReactive(new Map<string, { route: RouteLocationNormalizedLoaded; component: Component }>())
    const remember = () => {
      const component = route.matched[route.matched.length - 1]?.components?.default
      if (!component || cache.has(route.fullPath)) return
      const snapshot = { ...route, params: { ...route.params }, query: { ...route.query }, matched: [...route.matched] } as RouteLocationNormalizedLoaded
      cache.set(route.fullPath, { route: snapshot, component: markRaw(component as Component) })
    }
    watch(() => route.fullPath, remember, { immediate: true })
    const title = computed(() => props.labels[route.path] || '运营中心')
    return () => h(WorkspacePanels, {
      class: 'trade-admin-workspace',
      activeKey: route.fullPath,
      activeLabel: title.value,
      homeKey: '/admin/trade/dashboard',
      homeLabel: '交易大盘',
      storageKey: 'trade:admin:vue-workspace:v1',
      tabBarClassName: 'trade-admin-workspace-tabbar',
      paneClassName: 'trade-admin-workspace-pane',
      onSelect: key => { void router.push(key) },
      renderPane: tab => {
        const page = cache.get(tab.key)
        return page ? h(CachedRoutePanel, { key: tab.key, route: page.route, view: page.component }) : null
      },
    })
  },
})
