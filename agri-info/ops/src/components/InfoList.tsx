import { defineComponent, h, useId, type PropType, type VNodeChild } from 'vue'
import {
  AgriAntdvJsxList,
  AgriVueFilterBar,
  AgriVueRowActions,
  type VueRowActionItem,
} from '@agri/shared/vue/antdv'
import { agriAntdvJsxListProps } from '@agri/shared/vue/antdv/AgriAntdvJsxList'

export const InfoList = defineComponent({
  name: 'InfoList',
  inheritAttrs: false,
  props: {
    ...agriAntdvJsxListProps,
    listId: {
      type: String,
      required: true,
    },
    selectable: {
      type: Boolean,
      default: true,
    },
  },
  setup(props, { attrs, slots }) {
    return () =>
      h(
        AgriAntdvJsxList,
        {
          ...props,
          ...attrs,
          columnSettingsStorageKey: `info-ops:list:columns:${props.listId}`,
          columnWidthStorageKey: `info-ops:list:widths:${props.listId}`,
          wrapperClassName: ['info-ops-list', props.wrapperClassName].filter(Boolean).join(' '),
          rowSelection: props.selectable
            ? {
                preserveSelectedRowKeys: true,
                ...props.rowSelection,
              }
            : undefined,
        },
        slots,
      )
  },
})

export interface InfoFilterField {
  label: string
  control: VNodeChild
  wide?: boolean
}

export const InfoFilters = defineComponent({
  name: 'InfoFilters',
  props: {
    fields: {
      type: Array as PropType<InfoFilterField[]>,
      required: true,
    },
    onQuery: {
      type: Function as PropType<() => void>,
      required: true,
    },
    onReset: {
      type: Function as PropType<() => void>,
      required: true,
    },
    loading: Boolean,
    queryText: {
      type: String,
      default: '查询',
    },
  },
  setup(props) {
    const id = useId()
    return () =>
      h(
        AgriVueFilterBar,
        {
          fieldCount: props.fields.length,
          loading: props.loading,
          searchText: props.queryText,
          onSearch: props.onQuery,
          onReset: props.onReset,
        },
        {
          default: () =>
            props.fields.map(({ label, control, wide }, index) =>
              h(
                'div',
                {
                  key: label,
                  class: ['agri-vue-filter-field', wide ? 'agri-vue-filter-span-2' : ''],
                  role: 'group',
                  'aria-labelledby': `${id}-${index}`,
                },
                [h('label', { id: `${id}-${index}` }, label), control],
              ),
            ),
        },
      )
  },
})

export const InfoRowActions = defineComponent({
  name: 'InfoRowActions',
  props: {
    actions: {
      type: Array as PropType<VueRowActionItem[]>,
      required: true,
    },
    maxVisible: {
      type: Number,
      default: 2,
    },
  },
  setup(props) {
    return () =>
      h(AgriVueRowActions, {
        actions: props.actions,
        maxVisible: props.maxVisible,
      })
  },
})

export type { VueRowActionItem as InfoRowActionItem }
