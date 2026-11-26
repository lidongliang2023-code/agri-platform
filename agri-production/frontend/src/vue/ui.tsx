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
import { defineComponent, h, isVNode, watch, reactive, onMounted, onBeforeUnmount, type CSSProperties, type PropType, type VNodeChild } from 'vue'
import * as A from 'ant-design-vue'
import { Form as BaseForm, Modal as BaseModal, useFormModel } from '@agri/shared/vue/antdv/jsxUi'
export * from '@agri/shared/vue/antdv/jsxUi'
export type { FormModel } from '@agri/shared/vue/antdv/formModel'

type TypedForm<T> = Omit<ReturnType<typeof useFormModel>, 'validateFields'> & {
  validateFields(names?: Parameters<ReturnType<typeof useFormModel>['validateFields']>[0]): Promise<T>
  [Symbol.iterator](): IterableIterator<TypedForm<T>>
}
function useTypedForm<T extends Record<string, any> = Record<string, any>>(): TypedForm<T> {
  const api = useFormModel() as TypedForm<T>
  api[Symbol.iterator] = () => [api][Symbol.iterator]()
  return api
}
export const Form = Object.assign(BaseForm, { useForm: useTypedForm })

export type ColumnType<T = any> = {
  key?: string | number
  dataIndex?: string | number | readonly (string | number)[]
  title?: VNodeChild | ((props: any) => VNodeChild)
  width?: number | string
  minWidth?: number
  maxWidth?: number
  align?: 'left' | 'center' | 'right'
  fixed?: boolean | 'left' | 'right'
  ellipsis?: boolean | { showTitle?: boolean }
  className?: string
  sorter?: boolean | ((a: T, b: T) => number) | { compare?: (a: T, b: T) => number; multiple?: number }
  sortOrder?: 'ascend' | 'descend' | null
  defaultSortOrder?: 'ascend' | 'descend' | null
  filters?: Array<{ text: VNodeChild; value: string | number | boolean }>
  onFilter?: (value: string | number | boolean, record: T) => boolean
  render?: (value: any, record: T, index: number) => VNodeChild
  customRender?: (opt: { value: any; text: any; record: T; index: number; column: any }) => VNodeChild
  children?: ColumnType<T>[]
  [key: string]: any
}
export type ColumnsType<T = any> = ColumnType<T>[]
export type ColumnGroupType<T = any> = ColumnType<T>
type RenderColumn = ColumnType<any>
function columnsForVue(columns: RenderColumn[] = []): any[] {
  return columns.map(column => ({
    ...column,
    children: column.children ? columnsForVue(column.children) : undefined,
    customRender: column.render ? ({ text, record, index }: any) => column.render!(text, record, index) : column.customRender,
  }))
}

export const Table = defineComponent({
  name: 'ProductionDetailTable',
  inheritAttrs: false,
  props: { ...tableProps(), columns: Array as PropType<RenderColumn[]>, expandable: Object as PropType<{expandedRowRender?:(row:any,index:number)=>VNodeChild;rowExpandable?:(row:any)=>boolean}> },
  setup(props, { attrs, slots }) {
    return () => h(A.Table, { ...props, ...attrs, columns: columnsForVue(props.columns), expandedRowRender: props.expandable?.expandedRowRender ? ({record,index}:any)=>props.expandable!.expandedRowRender!(record,index) : undefined, rowExpandable: props.expandable?.rowExpandable }, slots)
  },
})

export const Descriptions = Object.assign(defineComponent({
  name: 'ProductionDescriptions',
  inheritAttrs: false,
  props: { ...descriptionsProps(), items: Array as PropType<{ key?: string; label: VNodeChild; children: VNodeChild; span?: number }[]> },
  setup(props, { attrs, slots }) {
    return () => h(A.Descriptions, { ...props, ...attrs }, props.items ? { default: () => props.items!.map((item, i) => h(A.Descriptions.Item, { key: item.key || i, label: item.label, span: item.span }, () => item.children)) } : slots)
  },
}), { Item: A.Descriptions.Item })

export const Timeline = Object.assign(defineComponent({
  name: 'ProductionTimeline',
  inheritAttrs: false,
  props: { ...timelineProps(), items: Array as PropType<{ key?: string | number; children: VNodeChild; color?: string; label?: VNodeChild }[]> },
  setup(props, { attrs, slots }) {
    return () => h(A.Timeline, { ...props, ...attrs }, props.items ? { default: () => props.items!.map((item, i) => h(A.Timeline.Item, { key: item.key ?? i, color: item.color, label: item.label }, () => item.children)) } : slots)
  },
}), { Item: A.Timeline.Item })

export const Select = Object.assign(defineComponent({
  name: 'ProductionSelect',
  inheritAttrs: false,
  props: { ...selectProps(), options:Array as PropType<any[]>,value:null,filterOption:[Boolean,Function] as PropType<boolean|((input:string,option:any)=>boolean)>, onChange: Function as PropType<(value: any, option: any) => void> },
  setup(props, { attrs, slots }) {
    return () => { const bools = props.options?.some(option=>typeof option.value==='boolean'); const encode=(value:any)=>bools&&typeof value==='boolean'?`__agri_bool_${value}`:value; const decode=(value:any)=>bools&&value==='__agri_bool_true'?true:bools&&value==='__agri_bool_false'?false:value; return h(A.Select, { ...props, ...attrs, options:props.options?.map(option=>({...option,value:encode(option.value)})), value:encode(props.value),onChange:(value:any,option:any)=>props.onChange?.(decode(value),option) }, slots) }
  },
}), { Option: A.Select.Option, OptGroup: A.Select.OptGroup })

export const InputNumber = defineComponent({
  name: 'ProductionNumber',
  inheritAttrs: false,
  props: { ...inputNumberProps(), value: null as unknown as PropType<number | string | null>, onChange: Function as PropType<(value: any) => void> },
  setup(props, { attrs, slots }) {
    return () => h(A.InputNumber, { ...props, ...attrs, value: props.value ?? undefined, onChange: props.onChange }, slots)
  },
})

const TextAreaCompat = defineComponent({
  name: 'ProductionTextArea',
  inheritAttrs: false,
  props: {
    value: [String, Number] as PropType<string | number | undefined>,
    rows: Number,
    placeholder: String,
    showCount: Boolean,
    maxLength: Number,
    maxlength: Number,
    disabled: Boolean,
    readOnly: Boolean,
    allowClear: Boolean,
    autoSize: [Boolean, Object] as PropType<boolean | { minRows?: number; maxRows?: number }>,
    onChange: Function as PropType<(e: any) => void>,
    onPressEnter: Function as PropType<(e: any) => void>,
    onKeyDown: Function as PropType<(e: any) => void>,
    style: [String, Object] as PropType<string | CSSProperties>,
  },
  setup(props, { attrs, slots }) {
    return () => {
      const { readOnly, onKeyDown, ...rest } = props
      return h(A.Input.TextArea, { ...attrs, ...rest, readonly: readOnly ?? (attrs.readonly as boolean | undefined), onKeydown: onKeyDown, maxlength: props.maxlength ?? props.maxLength }, slots)
    }
  },
})

const InputCompat = defineComponent({
  name: 'ProductionInput',
  inheritAttrs: false,
  props: {
    value: [String, Number] as PropType<string | number | undefined>,
    placeholder: String,
    allowClear: Boolean,
    disabled: Boolean,
    readOnly: Boolean,
    showCount: Boolean,
    maxLength: Number,
    maxlength: Number,
    size: String as PropType<'large' | 'middle' | 'small'>,
    prefix: null as unknown as PropType<VNodeChild>,
    suffix: null as unknown as PropType<VNodeChild>,
    addonBefore: null as unknown as PropType<VNodeChild>,
    addonAfter: null as unknown as PropType<VNodeChild>,
    type: String as PropType<import('vue').InputHTMLAttributes['type']>,
    status: String as PropType<'error' | 'warning'>,
    onChange: Function as PropType<(e: any) => void>,
    onPressEnter: Function as PropType<(e: any) => void>,
    onKeyDown: Function as PropType<(e: any) => void>,
    style: [String, Object] as PropType<string | CSSProperties>,
  },
  setup(props, { attrs, slots }) {
    return () => {
      const { readOnly, onKeyDown, ...rest } = props
      return h(A.Input as import('vue').Component, { ...attrs, ...rest, readonly: readOnly ?? (attrs.readonly as boolean | undefined), onKeydown: onKeyDown, maxlength: props.maxlength ?? props.maxLength }, slots)
    }
  },
})

export const Card = Object.assign(defineComponent({
  name: 'ProductionCard',
  inheritAttrs: false,
  props: {
    title: null as unknown as PropType<VNodeChild>,
    extra: null as unknown as PropType<VNodeChild>,
    size: String as PropType<'default' | 'small'>,
    loading: Boolean,
    bordered: { type: Boolean, default: true },
    hoverable: Boolean,
    cover: null as unknown as PropType<VNodeChild>,
    actions: Array as PropType<VNodeChild[]>,
    bodyStyle: Object as PropType<CSSProperties>,
    headStyle: Object as PropType<CSSProperties>,
    styles: Object as PropType<{ body?: CSSProperties; header?: CSSProperties }>,
    style: [String, Object] as PropType<string | CSSProperties>,
    class: [String, Object, Array],
    onClick: Function as PropType<(e: any) => void>,
  },
  setup(props, { attrs, slots }) {
    return () => {
      const { styles, bodyStyle, headStyle, ...rest } = props
      return h(A.Card, { ...attrs, ...rest, bodyStyle: bodyStyle ?? styles?.body, headStyle: headStyle ?? styles?.header }, slots)
    }
  },
}), { Grid: A.Card.Grid, Meta: A.Card.Meta })

const RadioOptionCompat = (Comp: any, name: string) => defineComponent({
  name,
  inheritAttrs: false,
  props: {
    value: [String, Number, Boolean] as PropType<string | number | boolean>,
    disabled: Boolean,
    checked: Boolean,
  },
  setup(props, { attrs, slots }) {
    return () => h(Comp, { ...attrs, ...props }, slots)
  },
})
export const Radio = Object.assign(RadioOptionCompat(A.Radio, 'ProductionRadio'), {
  Button: RadioOptionCompat(A.Radio.Button, 'ProductionRadioButton'),
  Group: A.Radio.Group,
})

export const Segmented = defineComponent({
  name: 'ProductionSegmented',
  inheritAttrs: false,
  props: {
    value: [String, Number] as PropType<string | number>,
    defaultValue: [String, Number] as PropType<string | number>,
    options: Array as PropType<Array<string | number | { label?: VNodeChild; value: string | number; icon?: VNodeChild; disabled?: boolean; className?: string; title?: string }>>,
    block: Boolean,
    disabled: Boolean,
    size: String as PropType<'large' | 'middle' | 'small'>,
    onChange: Function as PropType<(value: any) => void>,
  },
  setup(props, { attrs, slots }) {
    return () => {
      const normalized = props.options?.map(opt => {
        if (typeof opt === 'string' || typeof opt === 'number') return opt
        return { value: opt.value, disabled: opt.disabled, className: opt.className, title: opt.title, payload: { label: opt.label, icon: opt.icon } }
      })
      return h(A.Segmented as import('vue').Component, { ...attrs, ...props, options: normalized ?? [] }, {
        ...slots,
        label: ({ value, payload }: any) => payload ? h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '4px' } }, [payload.icon, payload.label ?? value]) : value,
      })
    }
  },
})

export const Input = Object.assign(InputCompat, {
  TextArea: TextAreaCompat,
  Search: A.Input.Search,
  Password: A.Input.Password,
  Group: A.Input.Group,
})

export const Rate = defineComponent({
  name: 'ProductionRate',
  inheritAttrs: false,
  props: { ...rateProps(), defaultValue: Number },
  setup(props, { attrs, slots }) {
    return () => h(A.Rate, { ...props, ...attrs, value: props.value ?? props.defaultValue }, slots)
  },
})

export const Image = Object.assign(defineComponent({
  name: 'ProductionImage',
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
    title: String,
    tabIndex: Number,
    onClick: Function as PropType<(event: MouseEvent) => void>,
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
  Text: makeTypography(A.Typography.Text, 'ProductionTypographyText'),
  Title: makeTypography(A.Typography.Title, 'ProductionTypographyTitle'),
  Paragraph: makeTypography(A.Typography.Paragraph, 'ProductionTypographyParagraph'),
  Link: A.Typography.Link,
})

const ListItemCompat = Object.assign(defineComponent({
  name: 'ProductionListItem',
  inheritAttrs: false,
  props: {
    actions: Array as PropType<VNodeChild[]>,
    extra: null as unknown as PropType<VNodeChild>,
    style: [String, Object] as PropType<string | CSSProperties>,
    class: [String, Object, Array],
    onClick: Function as PropType<(e: any) => void>,
  },
  setup(props, { attrs, slots }) {
    return () => h(A.List.Item, { ...attrs, ...props }, slots)
  },
}), { Meta: A.List.Item.Meta })

export const List = Object.assign(defineComponent({
  name: 'ProductionListDisplay',
  inheritAttrs: false,
  props: { ...listProps(), renderItem: Function as PropType<(item: any, index: number) => VNodeChild> },
  setup(props, { attrs, slots }) {
    return () => { const {renderItem, ...rest}=props; return h(A.List, { ...rest, ...attrs }, {
      ...slots,
      ...(props.renderItem ? { renderItem: ({ item, index }: any) => props.renderItem!(item, index) } : {}),
    }) }
  },
}), { Item: ListItemCompat })

export const Alert = defineComponent({
  name: 'ProductionAlert',
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
  name: 'ProductionModal',
  inheritAttrs: false,
  props: { ...modalProps(), styles: null, footer: null, title: null, destroyOnHidden:Boolean, afterOpenChange: Function as PropType<(open: boolean) => void> },
  setup(props, { attrs, slots }) {
    watch(() => props.open, (open) => props.afterOpenChange?.(Boolean(open)), { flush: 'post' })
    return () => h(BaseModal, { ...props, ...attrs, open: props.open, destroyOnClose:props.destroyOnHidden||props.destroyOnClose }, slots)
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
  name: 'ProductionMenu',
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
  name: 'ProductionPopconfirm',
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

export { Avatar, Flex, Affix, Anchor, UploadDragger } from 'ant-design-vue'
export type { TableProps, BadgeProps, CardProps, MenuProps, UploadFile } from 'ant-design-vue'
export type { ThemeConfig } from 'ant-design-vue/es/config-provider/context'
export const Breadcrumb = Object.assign(defineComponent({
  name:'ProductionBreadcrumb',inheritAttrs:false,props:{items:Array as PropType<Array<{title:VNodeChild;href?:string}>>},
  setup(props,{attrs,slots}){return()=>h(A.Breadcrumb,attrs,props.items?{default:()=>props.items!.map((item,index)=>h(A.Breadcrumb.Item,{key:index,href:item.href},()=>item.title))}:slots)}
}),{Item:A.Breadcrumb.Item,Separator:A.Breadcrumb.Separator})
export const Grid = { useBreakpoint() {
  const screens = reactive<Record<string, boolean>>({})
  const queries = Object.entries({xs:'(max-width:575px)',sm:'(min-width:576px)',md:'(min-width:768px)',lg:'(min-width:992px)',xl:'(min-width:1200px)',xxl:'(min-width:1600px)'}).map(([key, query])=>({key, media:window.matchMedia(query)}))
  const sync=()=>{for(const {key,media} of queries)screens[key]=media.matches}
  sync();onMounted(()=>queries.forEach(({media})=>media.addEventListener('change',sync)))
  onBeforeUnmount(()=>queries.forEach(({media})=>media.removeEventListener('change',sync)))
  return screens
}}

// 本项目未使用 valueFormat；统一保留 Dayjs 和清空后的 null。
function dateControl(Comp: any, range = false) {
  return defineComponent({
    name: range ? 'ProductionRangePicker' : 'ProductionDatePicker', inheritAttrs: false,
    props: { value: null as unknown as PropType<any>, onChange: Function as PropType<(value: any, text: any) => void>, disabledDate: Function as PropType<(date: import('dayjs').Dayjs) => boolean>, presets: Array as PropType<any[]>, showTime: [Boolean, Object], format: [String, Function, Array], picker: String, placeholder: [String, Array], allowClear: {type:Boolean,default:true}, disabled: Boolean, style: Object, size:String },
    setup(props,{attrs,slots}) { return()=>h(Comp,{...attrs,...props,value:props.value??undefined,onChange:(value:any,text:any)=>props.onChange?.(value??null,text)},slots) },
  })
}
export const DatePicker = Object.assign(dateControl(A.DatePicker), { RangePicker: dateControl(A.DatePicker.RangePicker,true) })
export const Calendar = defineComponent({
  name:'ProductionCalendar',inheritAttrs:false,
  props:{cellRender:Function as PropType<(date:import('dayjs').Dayjs,info:{type:string;originNode:VNodeChild})=>VNodeChild>},
  setup(props,{attrs,slots}) { return()=>h(A.Calendar,attrs,{...slots,...(props.cellRender?{dateCellRender:({current}:any)=>props.cellRender!(current,{type:'date',originNode:null}),monthCellRender:({current}:any)=>props.cellRender!(current,{type:'month',originNode:null})}:{})}) },
})
export const Switch = defineComponent({
  name:'ProductionSwitch',inheritAttrs:false,
  props:{checked:{type:Boolean,default:undefined},defaultChecked:Boolean,disabled:Boolean,loading:Boolean,size:String as PropType<'small'|'default'>,checkedChildren:null,unCheckedChildren:null,onChange:Function as PropType<(checked:boolean,event:Event)=>void>},
  setup(props,{attrs,slots}){return()=>h(A.Switch,{...attrs,...props,onChange:(value:any,event:Event)=>props.onChange?.(Boolean(value),event)},slots)},
})
export const Tag = defineComponent({
  name:'ProductionTag',inheritAttrs:false,
  props:{color:String,title:String,closable:Boolean,bordered:{type:Boolean,default:true},icon:null,onClose:Function as PropType<(event:MouseEvent)=>void>},
  setup(props,{attrs,slots}){return()=>h(A.Tag,{...attrs,...props},slots)},
})
export const Row = defineComponent({
 name:'ProductionRow',inheritAttrs:false,
 props:{gutter:[Number,Array,Object] as PropType<any>,align:String as PropType<any>,justify:String as PropType<any>,wrap:{type:Boolean,default:true},onClick:Function as PropType<(event:MouseEvent)=>void>},
 setup(props,{attrs,slots}){return()=>h(A.Row,{...attrs,...props},slots)},
})
export const Tabs = defineComponent({
 name:'ProductionTabs',inheritAttrs:false,
 props:{items:Array as PropType<any[]>,activeKey:[String,Number],defaultActiveKey:[String,Number],type:String as PropType<any>,size:String as PropType<any>,tabPosition:String as PropType<any>,onChange:Function as PropType<(key:string)=>void>},
 setup(props,{attrs,slots}){return()=>h(A.Tabs,{...attrs,...props,onChange:(key:string|number)=>props.onChange?.(String(key))},props.items?{default:()=>props.items!.map(item=>h(A.TabPane,{key:item.key,tab:item.label,disabled:item.disabled},()=>item.children))}:slots)},
})

export const AutoComplete = defineComponent({name:'ProductionAutoComplete',inheritAttrs:false,
 props:{value:String,placeholder:String,allowClear:Boolean,disabled:Boolean,options:Array as PropType<any[]>,filterOption:[Boolean,Function] as PropType<boolean|((input:string,option:any)=>boolean)>,onChange:Function as PropType<(value:string)=>void>},
 setup(props,{attrs,slots}){return()=>h(A.AutoComplete,{...attrs,...props,onChange:(value:any)=>props.onChange?.(String(value??''))},slots)},
})
export const Space = defineComponent({name:'ProductionSpace',inheritAttrs:false,
 props:{direction:String,align:String,size:[Number,String,Array] as PropType<any>,wrap:Boolean,onClick:Function as PropType<(event:MouseEvent)=>void>},
 setup(props,{attrs,slots}){return()=>h(A.Space,{...attrs,...props},slots)},
})
