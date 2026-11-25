import { AgriListTable, type AgriListTableProps } from '@agri/shared/components/list'

/** 运营列表统一入口：桥接 @agri/shared 的 AgriListTable，统一四段式工具栏、列设置、固定列宽与 20 条/页联动分页。 */
export default function ProductionListTable<T extends object>(props: AgriListTableProps<T>): JSX.Element {
  return <AgriListTable<T> {...props} />
}
