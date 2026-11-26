import { defineComponent, h, type PropType } from 'vue'
import type { TablePaginationConfig } from 'ant-design-vue/es/table'
import { AgriVuePagination } from '@agri/shared/vue/list'
export function productionPagination(config: TablePaginationConfig | false | undefined, selectedCount=0): TablePaginationConfig | false {
  if(config===false)return false
  return {defaultPageSize:20,showSizeChanger:true,...config,showTotal:total=>`已选 ${selectedCount} 项 · 共 ${total} 条`}
}
export default defineComponent({
  name:'ProductionVuePagination',inheritAttrs:false,
  props:{pageSizeOptions:Array as PropType<number[]>,current:Number,defaultCurrent:Number,pageSize:Number,defaultPageSize:Number,total:Number,selectedCount:Number,showSizeChanger:{type:Boolean,default:true},onChange:Function as PropType<(page:number,size:number)=>void>},
  setup(props){return()=>h(AgriVuePagination,{page:props.current??props.defaultCurrent??1,pageSize:props.pageSize??props.defaultPageSize??20,total:props.total??0,selectedCount:props.selectedCount??0,pageSizeOptions:props.pageSizeOptions,showSizeChanger:props.showSizeChanger,onChange:props.onChange})},
})
