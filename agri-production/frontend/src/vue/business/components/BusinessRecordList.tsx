import { defineComponent, h, type PropType, type VNodeChild } from 'vue';
import { agriAntdvJsxListProps } from '@agri/shared/vue/antdv/AgriAntdvJsxList';
import ProductionRequestTable, { type ProductionColumn } from '@/vue/ProductionRequestTable';

/** 生产端通用业务记录列表 Vue 封装，承接原 BusinessRecordList 参数并复用共享表格能力。 */
export default defineComponent({
  name: 'ProductionVueBusinessRecordList',
  inheritAttrs: false,
  props: {
    ...agriAntdvJsxListProps,
    columns: {
      type: Array as PropType<ProductionColumn[]>,
      default: () => []
    },
    dataSource: {
      type: Array as PropType<readonly object[]>,
      default: () => []
    },
    rowKey: {
      type: [String, Function] as PropType<string | ((row: any) => string | number)>,
      default: 'id'
    },
    loading: Boolean,
    footer:Function as PropType<(rows:readonly object[])=>VNodeChild>,
    toolbarTitle: null as unknown as PropType<VNodeChild>,
    toolbarExtra: null as unknown as PropType<VNodeChild>,
    memberListToolbar: Boolean,
    rowSelection: agriAntdvJsxListProps.rowSelection,
    pagination: {
      type: [Object, Boolean] as PropType<import('ant-design-vue/es/table/interface').TablePaginationConfig | false>,
      default: () => ({
        defaultPageSize: 20,
        showSizeChanger: true
      })
    },
    scroll: agriAntdvJsxListProps.scroll,
    expandable: agriAntdvJsxListProps.expandable,
    onReload: Function as PropType<() => void>,
    columnSettingsStorageKey: [String, Boolean] as PropType<string | false>,
    columnWidthStorageKey: [String, Boolean] as PropType<string | false>
  },
  setup(props, {
    attrs,
    slots
  }) {
    return () => h('div', { class: 'production-business-list' }, [h(ProductionRequestTable, {
      ...attrs, ...props,
      columns: props.columns,
      dataSource: props.dataSource,
      rowKey: props.rowKey,
      loading: props.loading,
      search: false,
      headerTitle: props.toolbarTitle,
      toolbarLeft: props.toolbarExtra ?? props.toolbarTitle,
      rowSelection: props.rowSelection,
      pagination: props.pagination,
      scroll: props.scroll,
      expandable: props.expandable,
      onRefresh: props.onReload,
      columnSettingsStorageKey: props.columnSettingsStorageKey,
      columnWidthStorageKey: props.columnWidthStorageKey
    }, slots), props.footer ? h('div',{class:'ant-table-footer'},[props.footer(props.dataSource)]) : null]);
  }
});
