import { defineComponent, h, Fragment, isVNode, type PropType, type VNode, type VNodeChild } from 'vue'
import { Popover } from 'ant-design-vue'
import { AgriVueTopHeader } from '@agri/shared/vue/workspace'
export { isFormWorkspaceTab, type WorkspaceTabMeta as WorkspaceTabItem } from '@agri/shared/vue/workspace'
function flatten(children: unknown): VNode[] {
  return (Array.isArray(children) ? children : [children]).flatMap(node => {
    if (!isVNode(node)) return []
    if (node.type === Fragment) return flatten(node.children)
    return typeof node.type === 'symbol' ? [] : [node]
  })
}
export const ListRowActions = defineComponent({
  name: 'TradeRowActions',
  props: { items: Array as PropType<VNodeChild[]>, maxVisible: { type: Number, default: 2 }, moreLabel: { type: String, default: '更多' } },
  setup(props, { slots }) {
    return () => {
      const nodes = flatten(props.items || slots.default?.())
      if (nodes.length <= props.maxVisible) return h('div', { class: 'agri-vue-row-actions' }, nodes)
      const count = Math.max(0, props.maxVisible - 1)
      return h('div', { class: 'agri-vue-row-actions' }, [...nodes.slice(0, count), h(Popover, { trigger: 'click', placement: 'bottomRight' }, {
        default: () => h('button', { type: 'button', class: 'agri-vue-action-link' }, props.moreLabel),
        content: () => h('div', { class: 'agri-vue-more-menu-content', style: { display: 'flex', flexDirection: 'column', gap: '8px' } }, nodes.slice(count)),
      })])
    }
  },
})
export const WorkspaceHeader = defineComponent({
  name: 'TradeWorkspaceHeader', inheritAttrs: false,
  props: { collapsed:Boolean, mobile:Boolean, mobileOpen:Boolean, breadcrumbs:Array as PropType<string[]>, onToggleCollapse:Function as PropType<()=>void>, right: null as unknown as PropType<VNodeChild>, center: null as unknown as PropType<VNodeChild>, left: null as unknown as PropType<VNodeChild>, leftClassName: String, rightClassName: String, centerClassName: String },
  setup(props, { attrs, slots }) { return () => h(AgriVueTopHeader, { ...attrs, collapsed:props.collapsed, mobile:props.mobile, mobileOpen:props.mobileOpen, breadcrumbs:props.breadcrumbs, onToggleCollapse:props.onToggleCollapse, leftClass: props.leftClassName, rightClass: props.rightClassName, centerClass: props.centerClassName }, { ...slots, ...(props.left !== undefined ? {left:()=>props.left}:{}), ...(props.right !== undefined ? { right: () => props.right } : {}), ...(props.center !== undefined ? { center: () => props.center } : {}) }) },
})
