import { cloneVNode, defineComponent, Fragment, h, isVNode, useId, type CSSProperties, type PropType, type VNode, type VNodeChild } from 'vue'
import { AgriVueFilterBar } from '@agri/shared/vue/list'
import { Form } from '@agri/shared/vue/antdv/jsxUi'
import type { FormModel } from '@agri/shared/vue/antdv/formModel'
import './ProductionListFilters.css'
import { useRoute } from 'vue-router'

/** 只展开 Fragment，不改变字段节点结构；收起由共享组件的 CSS 完成，保留表单注册及输入值。 */
function fieldsFrom(children: unknown): VNode[] {
  if (Array.isArray(children)) return children.flatMap(fieldsFrom)
  if (!isVNode(children)) return []
  if (children.type === Fragment) return fieldsFrom(children.children)
  return typeof children.type === 'symbol' ? [] : [children]
}

/** 生产端唯一查询区：普通受控控件、FormModel 表单和请求型表格均复用共享折叠布局。 */
export default defineComponent({
  name: 'ProductionListFilters',
  inheritAttrs: false,
  props: {
    form: Object as PropType<FormModel>,
    initialValues: Object as PropType<Record<string, any>>,
    fieldCount: Number,
    collapseThreshold: { type: Number, default: 5 },
    defaultCollapsed: { type: null as unknown as PropType<boolean | null | undefined>, default: null },
    loading: Boolean,
    embedded: { type: Boolean, default: true },
    searchText: { type: String, default: '查询' },
    resetText: { type: String, default: '重置' },
    onSearch: Function as PropType<() => unknown>,
    onReset: Function as PropType<() => unknown>,
    onFinish: Function as PropType<(values: any) => unknown>,
  },
  setup(props, { attrs, slots }) {
    const id = useId()
    const route = useRoute()
    function search(values?: Record<string, any>) {
      if (props.loading) return
      if (props.onFinish) return props.onFinish(values ?? props.form?.getFieldsValue() ?? {})
      return props.onSearch?.()
    }
    return () => {
      const fields = fieldsFrom(slots.default?.())
      const filter = h(AgriVueFilterBar, {
        ...(!props.form ? attrs : {}),
        as: props.form ? 'div' : 'form',
        class: ['production-list-filters', { 'is-embedded': props.embedded }, !props.form && attrs.class],
        fieldCount: props.fieldCount ?? fields.length,
        collapseThreshold: props.collapseThreshold,
        defaultCollapsed: typeof props.defaultCollapsed === 'boolean' ? props.defaultCollapsed : null,
        uniformColumns: true,
        loading: props.loading,
        searchText: props.searchText,
        resetText: props.resetText,
        onSearch: () => search(),
        onReset: () => { if (!props.loading) return props.onReset?.() },
      }, {
        default: () => fields.map((node, index) => {
          const classes = String(node.props?.class ?? '')
          const style = node.props?.style as CSSProperties | undefined
          const full = style?.gridColumn != null
          const wide = classes.includes('production-filter-span-2') || classes.includes('agri-vue-filter-span-2') || full
          const labelId = `${id}-filter-${index}`
          const rawField = typeof node.type === 'string' && classes.includes('filter-field')
          const field = rawField ? cloneVNode(node, {
            class: 'production-query-field',
            ...(full ? { style: { ...style, gridColumn: 'auto' } } : {}),
          }) : node
          return h('div', {
            key: node.key ?? String(node.props?.name ?? index),
            class: ['agri-vue-filter-field', { 'agri-vue-filter-span-2': wide, 'production-filter-full-row': full }],
            ...(rawField ? { role: 'group', 'aria-labelledby': labelId } : {}),
          }, [rawField ? h('div', { id: labelId, class: 'production-query-field-content' }, [field]) : field])
        }),
      })
      return props.form ? h(Form, {
        ...attrs,
        form: props.form,
        initialValues: props.initialValues,
        layout: 'vertical',
        class: ['production-list-filter-form', attrs.class],
        onFinish: search,
      }, { default: () => filter }) : filter
    }
  },
})
