import { computed, defineComponent, h, shallowRef, watch, type PropType, type VNodeChild } from 'vue'
import { AgriVueWorkspaceTabs, type RouteWorkspaceTabMeta, type WorkspaceTabMeta } from '@agri/shared/vue/workspace'

/** Vue 页签栏负责关闭确认与排序；面板按稳定 key 保留，关闭时释放。 */
export const WorkspacePanels = defineComponent({
  name: 'TradeWorkspacePanels',
  inheritAttrs: false,
  props: {
    activeKey: { type: String, required: true },
    activeLabel: { type: String, required: true },
    homeKey: { type: String, required: true },
    homeLabel: { type: String, required: true },
    storageKey: String,
    tabBarClassName: String,
    paneClassName: String,
    renderPane: { type: Function as PropType<(tab: WorkspaceTabMeta, active: boolean) => VNodeChild>, required: true },
    footer: null as unknown as PropType<VNodeChild>,
    onSelect: Function as PropType<(key: string) => void>,
  },
  setup(props, { attrs }) {
    const tabs = shallowRef<RouteWorkspaceTabMeta[]>([])
    const visited = shallowRef(new Set([props.activeKey]))
    watch(() => props.activeKey, key => { visited.value = new Set([...visited.value, key]) })
    const panels = computed(() => tabs.value.filter(tab => visited.value.has(tab.key)))
    const onTabsChange = (next: RouteWorkspaceTabMeta[]) => {
      tabs.value = next
      const remaining = new Set(next.map(tab => tab.key))
      visited.value = new Set([...visited.value].filter(key => remaining.has(key)))
    }
    return () => h('div', { ...attrs, class: ['agri-workspace', attrs.class] }, [
      h(AgriVueWorkspaceTabs, {
        activeKey: props.activeKey,
        activeLabel: props.activeLabel,
        activePath: props.activeKey,
        homeKey: props.homeKey,
        homeLabel: props.homeLabel,
        homePath: props.homeKey,
        storageKey: props.storageKey,
        tabBarClass: props.tabBarClassName,
        sticky: false,
        onNavigate: props.onSelect,
        onTabsChange,
      }),
      ...panels.value.map(tab => h('div', {
        key: tab.key,
        class: ['agri-workspace-pane', props.paneClassName],
        role: 'tabpanel',
        'aria-label': tab.label,
        'aria-hidden': tab.key !== props.activeKey,
        style: tab.key === props.activeKey ? undefined : { display: 'none' },
      }, [props.renderPane(tab, tab.key === props.activeKey)])),
      props.footer,
    ])
  },
})
