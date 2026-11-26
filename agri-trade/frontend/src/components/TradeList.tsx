import {AgriVueFilterBar} from '@agri/shared/vue/list'
import { computed, defineComponent, h, ref, useId, type PropType, type VNodeChild } from 'vue';
import { Button } from '@/vue/ui';
import { AgriAntdvJsxList, agriAntdvJsxListProps } from '@agri/shared/vue/antdv/AgriAntdvJsxList';
import { shouldCollapseFilters } from '@agri/shared/vue/list/vueListUtils';
import './trade-list.css';
export const TradeList = defineComponent({
  name: 'TradeList',
  inheritAttrs: false,
  props: {
    ...agriAntdvJsxListProps,
    rowClassName: Function as PropType<(row: any, index: number) => string>,
    listId: {
      type: String,
      required: true
    },
    selectable: {
      type: Boolean,
      default: true
    }
  },
  setup(props, {
    attrs,
    slots
  }) {
    return () => h(AgriAntdvJsxList, {
      ...props,
      ...attrs,
      columnSettingsStorageKey: `trade:list:columns:${props.listId}`,
      columnWidthStorageKey: `trade:list:widths:${props.listId}`,
      wrapperClassName: ['trade-list', props.wrapperClassName].filter(Boolean).join(' '),
      rowSelection: props.selectable ? {
        preserveSelectedRowKeys: true,
        ...props.rowSelection
      } : undefined
    }, slots);
  }
});
export interface FilterField {
  label: string;
  control: VNodeChild;
  wide?: boolean;
}
export const TradeFilters = defineComponent({
  name: 'TradeFilters',
  props: {
    fields: {
      type: Array as PropType<FilterField[]>,
      required: true
    },
    onQuery: {
      type: Function as PropType<() => void>,
      required: true
    },
    onReset: {
      type: Function as PropType<() => void>,
      required: true
    },
    loading: Boolean,
    queryText: {
      type: String,
      default: '查询'
    }
  },
  setup(props) {
    const id = useId()
    return () => h(AgriVueFilterBar, {fieldCount:props.fields.length, loading:props.loading, searchText:props.queryText, onSearch:props.onQuery, onReset:props.onReset, class:'trade-list-filters'}, {
      default:()=>props.fields.map(({label,control,wide},index)=>h('div',{key:label,class:['agri-vue-filter-field',wide?'agri-vue-filter-span-2':''],role:'group','aria-labelledby':`${id}-${index}`},[h('label',{id:`${id}-${index}`},label),control]))
    })
  }
})
