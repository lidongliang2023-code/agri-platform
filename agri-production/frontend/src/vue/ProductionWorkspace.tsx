import { computed, defineComponent, h, markRaw, provide, shallowReactive, shallowRef, watch, type Component, type PropType } from 'vue'
import { routeLocationKey, useRoute, useRouter, type RouteLocationNormalizedLoaded } from 'vue-router'
import { AgriVueWorkspaceTabs, type RouteWorkspaceTabMeta } from '@agri/shared/vue/workspace'

const RoutePanel = defineComponent({
  name: 'ProductionRoutePanel',
  props: {
    route: { type: Object as PropType<RouteLocationNormalizedLoaded>, required: true },
    view: { type: [Object, Function] as PropType<Component>, required: true },
  },
  setup(props) {
    provide(routeLocationKey, props.route)
    return () => h(props.view)
  },
})

/** 独立路由快照与组件实例；关闭页签释放，主体变化通过 contextKey 整体清空。 */
export default defineComponent({
  name: 'ProductionVueWorkspace', inheritAttrs: false,
  props: { admin: Boolean, embedded: Boolean, contextKey: { type: String, default: '' } },
  setup(props, { attrs }) {
    const route = useRoute(), router = useRouter()
    const entries = shallowReactive(new Map<string, { route: RouteLocationNormalizedLoaded; component: Component }>())
    const tabs = shallowRef<RouteWorkspaceTabMeta[]>([])
    const workspaceEpoch = shallowRef(0)
    const home = computed(() => props.admin ? '/admin/production/dashboard' : '/production/dashboard')
    function remember() {
      const view = route.matched.at(-1)?.components?.default
      if (!view || entries.has(route.fullPath)) return
      const snapshot = { ...route, params: { ...route.params }, query: { ...route.query }, matched: [...route.matched] } as RouteLocationNormalizedLoaded
      entries.set(route.fullPath, { route: snapshot, component: markRaw(view as Component) })
    }
    watch(() => route.fullPath, remember, { immediate: true })
    watch(() => props.contextKey, () => { entries.clear(); tabs.value = []; workspaceEpoch.value++; remember() })
    const onTabsChange = (next: RouteWorkspaceTabMeta[]) => {
      tabs.value = next
      const open = new Set(next.map(tab => tab.key))
      for (const key of entries.keys()) if (!open.has(key) && key !== route.fullPath) entries.delete(key)
    }
    return () => h('div', { ...attrs, class: ['agri-workspace', 'production-workspace', attrs.class] }, [
      h(AgriVueWorkspaceTabs, {
        key: `${props.contextKey}:${workspaceEpoch.value}`,
        activeKey: route.fullPath,
        activePath: route.fullPath,
        activeLabel: String(route.meta.name ?? route.meta.title ?? '页面'),
        homeKey: home.value, homePath: home.value, homeLabel: props.admin ? '运营管理大盘' : '生产工作台',
        hideTabBar: props.embedded, sticky: false,
        tabBarClass: 'production-workspace-tabbar',
        onNavigate: (key: string) => { void router.push(key) }, onTabsChange,
      }),
      ...Array.from(entries, ([key, page]) => h('div', { key: `${props.contextKey}:${key}`, class: 'agri-workspace-pane production-workspace-pane', role: 'tabpanel', 'aria-hidden': key !== route.fullPath, style: key !== route.fullPath ? { display: 'none' } : undefined }, [h(RoutePanel, { route: page.route, view: page.component })])),
    ])
  },
})
