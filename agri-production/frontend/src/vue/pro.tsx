import { defineComponent, h, type PropType, type VNodeChild } from 'vue'
import { Button, Space, Tabs, Typography } from 'ant-design-vue'
export { ProForm, ModalForm, ProFormText, ProFormTextArea, ProFormDigit, ProFormSelect, ProFormDatePicker, ProFormDateTimePicker, ProFormRadio } from './ProductionForm'
export { default as ProTable } from './ProductionRequestTable'
export type { ProductionColumn as ProColumns, ProductionTableAction as ActionType } from './ProductionRequestTable'

/** 页面容器使用 Vue 插槽承载原有标题、统计区域与标签页，不改变业务内容。 */
export const PageContainer = defineComponent({
  name: 'ProductionVuePageContainer', inheritAttrs: false,
  props: {
    loading: Boolean,
    mobileForm: Boolean,
    backIcon: null as unknown as PropType<VNodeChild>,
    title: null as unknown as PropType<VNodeChild | false>,
    subTitle: null as unknown as PropType<VNodeChild>,
    extra: null as unknown as PropType<VNodeChild>,
    content: null as unknown as PropType<VNodeChild>,
    footer: null as unknown as PropType<VNodeChild>,
    tabList: Array as PropType<Array<{ key: string; tab: VNodeChild; disabled?: boolean }>>,
    tabActiveKey: String,
    onTabChange: Function as PropType<(key: string) => void>,
    onBack: Function as PropType<() => void>,
    header: Object as PropType<{ title?: VNodeChild | false; subTitle?: VNodeChild; extra?: VNodeChild; onBack?: () => void }>,
  },
  setup(props, { attrs, slots }) {
    return () => {
      const title = props.header?.title ?? props.title
      const subTitle = props.header?.subTitle ?? props.subTitle
      const extra = props.header?.extra ?? props.extra
      const onBack = props.header?.onBack ?? props.onBack
      return h('section', { ...attrs, class: ['ant-pro-page-container', props.mobileForm && 'production-mobile-form', attrs.class] }, [
        title !== false && (title || subTitle || extra || onBack) ? h('header', { class: 'ant-page-header ant-pro-page-container-warp', style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '16px 0' } }, [
          h(Space, {}, () => [onBack ? h(Button, { type: 'text', onClick: onBack, 'aria-label': '返回' }, () => props.backIcon ?? '←') : null, title ? h(Typography.Title, { level: 4, style: { margin: 0 } }, () => title) : null, subTitle ? h(Typography.Text, { type: 'secondary' }, () => subTitle) : null]), extra,
        ]) : null,
        props.content,
        props.tabList?.length ? h(Tabs, { activeKey: props.tabActiveKey, onChange: key => props.onTabChange?.(String(key)) }, { default: () => props.tabList!.map(tab => h(Tabs.TabPane, { key: tab.key, tab: tab.tab, disabled: tab.disabled })) }) : null,
        h('div', { class: 'ant-pro-page-container-children-container' }, slots.default?.()),
        props.footer ? h('footer', { class: 'ant-pro-footer-toolbar' }, props.footer) : null,
      ])
    }
  },
})
