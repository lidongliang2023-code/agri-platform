/**
 * 运营端布局
 *
 * 面向平台运营人员，使用九个一级模块菜单。
 * **视觉风格与用户端保持一致**（同主题 Token、浅色侧边栏、同一品牌主色）——
 * 此前用深色侧边栏 + 深蓝主色「区分两端」，会让同一业务页在两端观感割裂，已统一。
 */
import BasicLayout from './BasicLayout'

/**
 * 运营端布局（/admin/production 前缀路由的父级布局）
 * @returns 运营端布局结构
 */
export default function AdminLayout(): JSX.Element {
  return <BasicLayout variant="admin" title="农业生产运营管理平台" />
}
