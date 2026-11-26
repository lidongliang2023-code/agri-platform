import { defineComponent, h, ref, isVNode, Fragment, type PropType, type VNode, type VNodeChild } from 'vue'
import { Form } from '@/vue/ui'
import type { FormModel } from '@agri/shared/vue/antdv/formModel'
import { Button } from 'ant-design-vue'
import { DownOutlined, UpOutlined } from '@ant-design/icons-vue'
export interface CollapsibleFilterRenderState { collapsed: boolean; toggleButton: VNodeChild }
function flatten(input: unknown): VNode[] {
  const out: VNode[] = []
  const visit = (item: unknown) => { if (Array.isArray(item)) { item.forEach(visit); return }; if (!isVNode(item)) return; if (item.type === Fragment && Array.isArray(item.children)) item.children.forEach(visit); else out.push(item) }
  visit(input); return out
}
export const CollapsibleFilterDiv = defineComponent({
  name: 'ProductionVueCollapsibleFilterDiv', inheritAttrs: false,
  props: { fieldCount: {type:Number,default:0}, defaultCollapsed: {type:null as unknown as PropType<boolean|null|undefined>,default:null}, actions: null as unknown as PropType<VNodeChild>, collapseThreshold: {type:Number,default:5} },
  slots: Object as import('vue').SlotsType<{ default: (state: CollapsibleFilterRenderState) => any }>, setup(props, { attrs, slots }) {
    const collapsed = ref(typeof props.defaultCollapsed === 'boolean' ? props.defaultCollapsed : props.fieldCount >= props.collapseThreshold)
    return () => {
      const collapsible = props.fieldCount >= props.collapseThreshold
      const toggleButton = collapsible ? h(Button, {type:'link',size:'small','aria-expanded':!collapsed.value,onClick:()=>{collapsed.value=!collapsed.value}},()=>[collapsed.value?'展开':'收起',collapsed.value?h(DownOutlined):h(UpOutlined)]) : null
      const children=flatten(slots.default?.({collapsed:collapsed.value,toggleButton}))
      return h('div',{...attrs,class:['production-filter-grid',attrs.class]},[
        ...children.map((node,index)=> {
          const action=String(node.props?.class??'').includes('production-filter-actions')
          return !action&&collapsible&&collapsed.value&&index>=3 ? h('div',{style:{display:'none'}},[node]) : node
        }),
        props.actions ? h('div',{class:'production-filter-actions'},[props.actions,toggleButton]) : null,
      ])
    }
  },
})
export const CollapsibleFilterForm = defineComponent({
  name:'ProductionVueCollapsibleFilterForm',inheritAttrs:false,
  props:{form:Object as PropType<FormModel>,initialValues:Object,fieldCount:{type:Number,default:0},defaultCollapsed:{type:null as unknown as PropType<boolean|null|undefined>,default:null},collapseThreshold:{type:Number,default:5},actions:null as unknown as PropType<VNodeChild>,onFinish:Function as PropType<(values: Record<string, any>)=>void>},
  slots: Object as import('vue').SlotsType<{ default: (state: CollapsibleFilterRenderState) => any }>, setup(props,{attrs,slots}){return()=>h(Form,{form:props.form,initialValues:props.initialValues,onFinish:props.onFinish,layout:'vertical'}, {default:()=>h(CollapsibleFilterDiv,{...attrs,...props},slots)})},
})
export default CollapsibleFilterDiv
