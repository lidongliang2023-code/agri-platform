import { tableProps } from 'ant-design-vue/es/table/Table'
import { descriptionsProps } from 'ant-design-vue/es/descriptions/index'
import { timelineProps } from 'ant-design-vue/es/timeline/Timeline'
import { selectProps } from 'ant-design-vue/es/select'
import { inputNumberProps } from 'ant-design-vue/es/input-number'
import { alertProps } from 'ant-design-vue/es/alert'
import { listProps } from 'ant-design-vue/es/list'
import { modalProps } from 'ant-design-vue/es/modal/Modal'
import { rateProps } from 'ant-design-vue/es/rate'
import { imageProps } from 'ant-design-vue/es/image'
import { popconfirmProps } from 'ant-design-vue/es/popconfirm'
import { defineComponent, h, isVNode, watch, type CSSProperties, type PropType, type VNodeChild } from 'vue'
import * as A from 'ant-design-vue'
import { Form as BaseForm, Modal as BaseModal, useFormModel } from '@agri/shared/vue/antdv/jsxUi'
export * from '@agri/shared/vue/antdv/jsxUi'
export type { FormModel } from '@agri/shared/vue/antdv/formModel'

type TypedForm<T> = Omit<ReturnType<typeof useFormModel>, 'validateFields'> & { validateFields(): Promise<T> }
function useTypedForm<T extends Record<string, any> = Record<string, any>>(): TypedForm<T> {
  return useFormModel() as TypedForm<T>
}
export const Form = Object.assign(BaseForm, { useForm: useTypedForm })

type RenderColumn = { render?: (value: any, row: any, index: number) => VNodeChild; children?: RenderColumn[]; [key: string]: any }
function columnsForVue(columns: RenderColumn[] = []): any[] {
  return columns.map(column => ({
    ...column,
    children: column.children ? columnsForVue(column.children) : undefined,
    customRender: column.render ? ({ text, record, index }: any) => column.render!(text, record, index) : column.customRender,
  }))
}

export const Table = defineComponent({
  name: 'TradeDetailTable',
  inheritAttrs: false,
  props: { ...tableProps(), columns: Array as PropType<RenderColumn[]> },
  setup(props, { attrs, slots }) {
    return () => h(A.Table, { ...props, ...attrs, columns: columnsForVue(props.columns) }, slots)
  },
})

export const Descriptions = Object.assign(defineComponent({
  name: 'TradeDescriptions',
  inheritAttrs: false,
  props: { ...descriptionsProps(), items: Array as PropType<{ key?: string; label: VNodeChild; children: VNodeChild; span?: number }[]> },
  setup(props, { attrs, slots }) {
    return () => h(A.Descriptions, { ...props, ...attrs }, props.items ? { default: () => props.items!.map((item, i) => h(A.Descriptions.Item, { key: item.key || i, label: item.label, span: item.span }, () => item.children)) } : slots)
  },
}), { Item: A.Descriptions.Item })

export const Timeline = Object.assign(defineComponent({
  name: 'TradeTimeline',
  inheritAttrs: false,
  props: { ...timelineProps(), items: Array as PropType<{ key?: string | number; children: VNodeChild; color?: string; label?: VNodeChild }[]> },
  setup(props, { attrs, slots }) {
    return () => h(A.Timeline, { ...props, ...attrs }, props.items ? { default: () => props.items!.map((item, i) => h(A.Timeline.Item, { key: item.key ?? i, color: item.color, label: item.label }, () => item.children)) } : slots)
  },
}), { Item: A.Timeline.Item })

export const Select = Object.assign(defineComponent({
  name: 'TradeSelect',
  inheritAttrs: false,
  props: { ...selectProps(), onChange: Function as PropType<(value: any, option: any) => void> },
  setup(props, { attrs, slots }) {
    return () => h(A.Select, { ...props, ...attrs }, slots)
  },
}), { Option: A.Select.Option, OptGroup: A.Select.OptGroup })

export const InputNumber = defineComponent({
  name: 'TradeNumber',
  inheritAttrs: false,
  props: { ...inputNumberProps(), value: null as unknown as PropType<number | string | null>, onChange: Function as PropType<(value: any) => void> },
  setup(props, { attrs, slots }) {
    return () => h(A.InputNumber, { ...props, ...attrs, value: props.value ?? undefined, onChange: props.onChange }, slots)
  },
})

const TextAreaCompat = defineComponent({
  name: 'TradeTextArea',
  inheritAttrs: false,
  props: {
    value: [String, Number] as PropType<string | number | undefined>,
    rows: Number,
    placeholder: String,
    showCount: Boolean,
    maxLength: Number,
    maxlength: Number,
    disabled: Boolean,
    allowClear: Boolean,
    autoSize: [Boolean, Object] as PropType<boolean | { minRows?: number; maxRows?: number }>,
    onChange: Function as PropType<(e: any) => void>,
    onPressEnter: Function as PropType<(e: any) => void>,
    style: [String, Object] as PropType<string | CSSProperties>,
  },
  setup(props, { attrs, slots }) {
    return () => h(A.Input.TextArea, { ...attrs, ...props, maxlength: props.maxlength ?? props.maxLength }, slots)
  },
})

const InputCompat = defineComponent({
  name: 'TradeInput',
  inheritAttrs: false,
  props: {
    value: [String, Number] as PropType<string | number | undefined>,
    placeholder: String,
    allowClear: Boolean,
    disabled: Boolean,
    maxLength: Number,
    maxlength: Number,
    size: String as PropType<'large' | 'middle' | 'small'>,
    prefix: null as unknown as PropType<VNodeChild>,
    suffix: null as unknown as PropType<VNodeChild>,
    addonBefore: null as unknown as PropType<VNodeChild>,
    addonAfter: null as unknown as PropType<VNodeChild>,
    type: String as PropType<'text' | 'password' | 'number' | 'email' | 'search' | 'tel' | 'url'>,
    onChange: Function as PropType<(e: any) => void>,
    onPressEnter: Function as PropType<(e: any) => void>,
    style: [String, Object] as PropType<string | CSSProperties>,
  },
  setup(props, { attrs, slots }) {
    return () => h(A.Input, { ...attrs, ...props, maxlength: props.maxlength ?? props.maxLength }, slots)
  },
})

export const Input = Object.assign(InputCompat, {
  TextArea: TextAreaCompat,
  Search: A.Input.Search,
  Password: A.Input.Password,
  Group: A.Input.Group,
})

export const Rate = defineComponent({
  name: 'TradeRate',
  inheritAttrs: false,
  props: { ...rateProps(), defaultValue: Number },
  setup(props, { attrs, slots }) {
    return () => h(A.Rate, { ...props, ...attrs, value: props.value ?? props.defaultValue }, slots)
  },
})

export const Image = Object.assign(defineComponent({
  name: 'TradeImage',
  inheritAttrs: false,
  props: { ...imageProps(), alt: String },
  setup(props, { attrs, slots }) {
    return () => h(A.Image, { ...props, ...attrs }, slots)
  },
}), { PreviewGroup: A.Image.PreviewGroup })

const makeTypography = (Comp: any, name: string) => defineComponent({
  name,
  inheritAttrs: false,
  props: {
    type: String as PropType<'secondary' | 'success' | 'warning' | 'danger'>,
    level: Number as PropType<1 | 2 | 3 | 4 | 5>,
    strong: Boolean,
    code: Boolean,
    copyable: [Boolean, Object],
    ellipsis: [Boolean, Object],
    style: [String, Object] as PropType<string | CSSProperties>,
    class: [String, Object, Array],
  },
  setup(props, { attrs, slots }) {
    return () => h(Comp, { ...attrs, ...props }, slots)
  },
})

export const Typography = Object.assign(A.Typography, {
  Text: makeTypography(A.Typography.Text, 'TradeTypographyText'),
  Title: makeTypography(A.Typography.Title, 'TradeTypographyTitle'),
  Paragraph: makeTypography(A.Typography.Paragraph, 'TradeTypographyParagraph'),
  Link: A.Typography.Link,
})

export const List = Object.assign(defineComponent({
  name: 'TradeListDisplay',
  inheritAttrs: false,
  props: { ...listProps(), renderItem: Function as PropType<(item: any, index: number) => VNodeChild> },
  setup(props, { attrs, slots }) {
    return () => { const {renderItem, ...rest}=props; return h(A.List, { ...rest, ...attrs }, {
      ...slots,
      ...(props.renderItem ? { renderItem: ({ item, index }: any) => props.renderItem!(item, index) } : {}),
    }) }
  },
}), { Item: A.List.Item })

export const Alert = defineComponent({
  name: 'TradeAlert',
  inheritAttrs: false,
  props: { ...alertProps(), action: null as unknown as PropType<VNodeChild> },
  setup(props, { attrs, slots }) {
    return () => h(A.Alert, { ...props, ...attrs }, {
      ...slots,
      ...(props.action !== undefined ? { action: () => props.action } : {}),
    })
  },
})

export const Modal = Object.assign(defineComponent({
  name: 'TradeModal',
  inheritAttrs: false,
  props: { ...modalProps(), styles: null, footer: null, title: null, afterOpenChange: Function as PropType<(open: boolean) => void> },
  setup(props, { attrs, slots }) {
    watch(() => props.open, (open) => props.afterOpenChange?.(Boolean(open)), { flush: 'post' })
    return () => h(BaseModal, { ...props, ...attrs, open: props.open }, slots)
  },
}), {
  confirm: A.Modal.confirm,
  info: A.Modal.info,
  success: A.Modal.success,
  error: A.Modal.error,
  warning: A.Modal.warning,
})

function normalizeMenuItems(items?: any[]): any[] | undefined {
  if (!items) return undefined
  return items.map((item) => {
    if (!item || typeof item !== 'object') return item
    const icon = isVNode(item.icon) ? () => item.icon : item.icon
    const children = Array.isArray(item.children) ? normalizeMenuItems(item.children) : item.children
    return { ...item, icon, ...(children !== undefined ? { children } : {}) }
  })
}

export const Menu = Object.assign(defineComponent({
  name: 'TradeMenu',
  inheritAttrs: false,
  props: {
    theme: String as PropType<'light' | 'dark'>,
    mode: String as PropType<'vertical' | 'horizontal' | 'inline'>,
    inlineCollapsed: Boolean,
    selectedKeys: Array as PropType<(string | number)[]>,
    openKeys: Array as PropType<(string | number)[]>,
    items: Array as PropType<any[]>,
    onClick: Function as PropType<(info: { key: string | number; [k: string]: any }) => void>,
    onOpenChange: Function as PropType<(keys: (string | number)[]) => void>,
    class: [String, Object, Array],
  },
  setup(props, { attrs, slots }) {
    return () => h(A.Menu, { ...attrs, ...props, items: normalizeMenuItems(props.items) }, slots)
  },
}), { Item: A.Menu.Item, SubMenu: A.Menu.SubMenu, Divider: A.Menu.Divider, ItemGroup: A.Menu.ItemGroup })

export const Popconfirm = defineComponent({
  name: 'TradePopconfirm',
  inheritAttrs: false,
  props: { ...popconfirmProps(), description: null as unknown as PropType<VNodeChild> },
  setup(props, { attrs, slots }) {
    return () => {
      const { description, title, ...rest } = props
      const mergedTitle = description
        ? h('div', [h('div', title as any), h('div', { style: { fontSize: '12px', color: '#64748b', marginTop: '4px', fontWeight: 400 } }, description as any)])
        : title
      return h(A.Popconfirm, { ...rest, ...attrs }, {
        ...slots,
        ...(mergedTitle !== undefined ? { title: () => mergedTitle } : {}),
      })
    }
  },
})
