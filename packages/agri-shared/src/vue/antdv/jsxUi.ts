import { defineComponent, h, cloneVNode, isVNode, inject, provide, Fragment, computed, ref, onBeforeUnmount, type VNode, type InjectionKey } from 'vue'
import * as A from 'ant-design-vue'
import {formProps} from 'ant-design-vue/es/form/Form'
import {formItemProps} from 'ant-design-vue/es/form/FormItem'
import {modalProps} from 'ant-design-vue/es/modal/Modal'
import {drawerProps} from 'ant-design-vue/es/drawer'
import {tabsProps} from 'ant-design-vue/es/tabs/src/Tabs'
import type {PropType} from 'vue'
import { useFormModel, type FormModel } from './formModel'
export { useFormModel } from './formModel'
export { Steps, Pagination, Table, Alert, Badge, Button, Card, Checkbox, Col, Descriptions, Divider, Empty, Image, Input, InputNumber, Menu, Popconfirm, Popover, Progress, Radio, Rate, Row, Segmented, Select, Skeleton, Slider, Space, Spin, Statistic, Switch, Tag, Tooltip, Typography, Upload, message, notification } from 'ant-design-vue'
const formKey: InjectionKey<FormModel> = Symbol('agri-form')
const listKey: InjectionKey<(string | number)[]> = Symbol('agri-list')
const valueOf = (v: any, checked = false) => v?.target ? (checked ? v.target.checked : v.target.value) : v
const nodes = (value: any): VNode[] => (Array.isArray(value) ? value.flat(Infinity) : [value]).filter(isVNode)
const FormRoot = defineComponent({ name: 'AgriForm', inheritAttrs: false, props: {...formProps(),form:null,initialValues:null,preserve:{type:Boolean,default:true},onFinish:Function as PropType<(values:any)=>unknown>}, setup(props, { attrs, slots }) {
  const form: FormModel = props.form ?? useFormModel(); form.bind((values) => props.onFinish?.(values), props.initialValues); provide(formKey, form)
  return () => h(A.Form, { ...props,...attrs, model: form.model, ref: (el: any) => { form.instance.value = el }, onFinishFailed: (error: any) => form.recordErrors(error.errorFields ?? []), onFinish: () => { form.recordErrors([]); return props.onFinish?.({...form.model}) } }, slots)
}})
const FormItem = defineComponent({ name: 'AgriFormItem', inheritAttrs: false, props: {...formItemProps(),name:null,initialValue:null,dependencies:null,tooltip:null,extra:null,valuePropName:String,getValueProps:Function as PropType<(value:any)=>Record<string,unknown>>,normalize:Function as PropType<(value:any,previous:any,values:Record<string,any>)=>any>,shouldUpdate:[Boolean,Function] as PropType<boolean|((prev:any,next:any)=>boolean)>}, setup(props, { attrs, slots }) {
  const form = inject(formKey); const prefix = inject(listKey, [])
  const keys = () => [...prefix, ...(Array.isArray(props.name) ? props.name : props.name === undefined ? [] : [props.name])]
  function get() { return keys().reduce((obj, key) => obj?.[key], form?.model as any) }
  function set(value: any) { if (!form) return; const path=keys(); if(!path.length)return; let obj=form.model; path.slice(0,-1).forEach((key,i)=>{obj[key]??=typeof path[i+1]==='number'?[]:{};obj=obj[key]});obj[path[path.length-1]]=props.normalize?props.normalize(value,get(),form.model):value }
  if (props.initialValue !== undefined && get() === undefined) set(props.initialValue)
  function bind(node: VNode): VNode {
    if (node.type===Fragment) return cloneVNode(node, {}, false) && h(Fragment, {}, nodes(node.children).map(bind))
    if (typeof node.type==='string') return node
    const prop=props.valuePropName??'value';
    return cloneVNode(node, { ...(props.getValueProps?.(get()) ?? {[prop]:get()}), [`onUpdate:${prop}`]:(value:any)=>set(value), onChange:(value:any)=>{set(valueOf(value,prop==='checked'))} }, false)
  }
  return () => h(A.Form.Item,{...props,...attrs,name:keys().length?keys():undefined}, {default:()=> props.name===undefined ? slots.default?.(form) : nodes(slots.default?.()).map(bind)})
}})
const FormList = defineComponent({
  name: 'AgriFormList',
  props: {
    name: { type: [String, Number, Array] as PropType<string | number | (string | number)[]>, required: true },
    rules: Array as PropType<Array<{ validator?: (rule: any, value: any) => Promise<void> | void }>>,
  },
  slots: Object as import('vue').SlotsType<{
    default: (
      fields: Array<{ name: number; key: number }>,
      operation: { add: (defaultValue?: any, insertIndex?: number) => void; remove: (index: number | number[]) => void },
      meta: { errors: string[] },
    ) => any
  }>,
  setup(props, { slots }) {
    const form = inject(formKey)!
    const prefix = inject(listKey, [])
    const segments = Array.isArray(props.name) ? props.name : [props.name]
    const path = [...prefix, ...segments]
    provide(listKey, path)
    const errors = ref<string[]>([])
    const items = () => {
      let obj: any = form.model
      for (const k of path) { obj[k] ??= []; obj = obj[k] }
      return obj as any[]
    }
    const validateList = async () => {
      const next: string[] = []
      for (const rule of props.rules ?? []) {
        if (!rule.validator) continue
        try { await rule.validator(rule, items()) }
        catch (err) { next.push(err instanceof Error ? err.message : String(err)) }
      }
      errors.value = next
      if (next.length) throw new Error(next[0])
    }
    const regKey = path.join('.')
    if (props.rules?.length) form.registerListValidator(regKey, validateList)
    onBeforeUnmount(() => { form.registerListValidator(regKey) })
    return () => (slots.default as any)?.(
      items().map((_, i) => ({ name: i, key: i })),
      { add: (v: any = {}, index?: number) => { items().splice(index ?? items().length, 0, v); errors.value = [] }, remove: (index: number | number[]) => { for (const i of (Array.isArray(index) ? [...index] : [index]).sort((a,b)=>b-a)) items().splice(i, 1); void validateList().catch(() => {}) } },
      { errors: errors.value },
    )
  },
})
export const Form = Object.assign(FormRoot,{Item:FormItem,List:FormList,useWatch:(name:string|number|(string|number)[],form:FormModel)=>computed(()=> (Array.isArray(name)?name:[name]).reduce((value,key)=>value?.[key],form.model as any))})
export const App = Object.assign(defineComponent({setup(_,{slots}){return()=>slots.default?.()}}), {useApp:()=>({message:A.message,modal:A.Modal,notification:A.notification})})
export const Modal = Object.assign(defineComponent({name:'AgriModal',inheritAttrs:false,props:{...modalProps(),footer:null,styles:null,title:null},setup(props,{attrs,slots}){return()=>{
 const s:any={...slots};if(props.footer!==undefined)s.footer=()=>props.footer;if(isVNode(props.title))s.title=()=>props.title;
 return h(A.Modal,{...props,...attrs,title:isVNode(props.title)?undefined:props.title,bodyStyle:props.styles?.body,footer:props.footer===null?null:undefined},s)
}}}),{confirm:A.Modal.confirm,info:A.Modal.info,success:A.Modal.success,error:A.Modal.error,warning:A.Modal.warning})
export const Drawer=defineComponent({name:'AgriDrawer',inheritAttrs:false,props:{...drawerProps(),footer:null,title:null,extra:null,styles:null},setup(props,{attrs,slots}){return()=>h(A.Drawer,{...props,...attrs,title:props.title,bodyStyle:props.styles?.body},{...slots,...(props.footer!==undefined?{footer:()=>props.footer}:{}),...(props.extra!==undefined?{extra:()=>props.extra}:{})})}})
export const Tabs=defineComponent({name:'AgriTabs',inheritAttrs:false,props:{...tabsProps(),items:null},setup(props,{attrs,slots}){return()=>h(A.Tabs,{...props,...attrs},props.items?{default:()=>props.items.map((item:any)=>h(A.TabPane,{key:item.key,tab:item.label,disabled:item.disabled},{default:()=>item.children}))}:slots)}})
export const Collapse=defineComponent({name:'AgriCollapse',inheritAttrs:false,props:{items:null,activeKey:null,defaultActiveKey:null,accordion:Boolean,bordered:Boolean,ghost:Boolean,onChange:Function as PropType<(key:string|number|(string|number)[])=>void>},setup(props,{attrs,slots}){return()=>h(A.Collapse,{...props,...attrs},props.items?{default:()=>props.items.map((item:any)=>h(A.CollapsePanel,{key:item.key,header:item.label},{default:()=>item.children,extra:()=>item.extra}))}:slots)}})
export const Dropdown=defineComponent({name:'AgriDropdown',inheritAttrs:false,props:{menu:null,trigger:Array as PropType<('click'|'hover'|'contextmenu')[]>,placement:String as PropType<'bottomLeft'|'bottomRight'|'topLeft'|'topRight'|'top'|'bottom'>,open:Boolean},setup(props,{attrs,slots}){return()=>h(A.Dropdown,{...props,...attrs},{...slots,overlay:()=>h(A.Menu,{onClick:props.menu?.onClick},{default:()=>props.menu?.items?.map((item:any,index:number)=>item.type==='divider'?h(A.MenuDivider,{key:item.key??`div-${index}`}):h(A.MenuItem,{key:item.key,disabled:item.disabled,danger:item.danger,onClick:item.onClick},{default:()=>item.label,...(item.icon?{icon:()=>typeof item.icon==='function'?item.icon():item.icon}:{})}))})})}})

export { ConfigProvider, DatePicker, Layout, List, Result, Timeline, Tree, Transfer, Cascader, AutoComplete, TimePicker } from 'ant-design-vue'
export type { ColProps } from 'ant-design-vue'
export type { TablePaginationConfig } from 'ant-design-vue/es/table/interface'
export type FormInstance = FormModel
