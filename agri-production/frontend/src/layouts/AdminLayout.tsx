/**
 * 运营端布局
 *
 * 面向平台运营人员，使用九个一级模块菜单，侧边栏为深色风格以区分用户端。
 */
import BasicLayout from './BasicLayout'

/**
 * 运营端布局（/admin/production 前缀路由的父级布局）
 * @returns 运营端布局结构
 */
export default function AdminLayout(): JSX.Element {
  return <BasicLayout variant="admin" title="农业生产运营管理平台" />
}
