/**
 * 用户端布局
 *
 * 面向农场主 / 农技员，使用 PRD 十二个一级模块菜单，侧边栏为浅色风格。
 */
import BasicLayout from './BasicLayout'

/**
 * 用户端布局（/production 前缀路由的父级布局）
 * @returns 用户端布局结构
 */
export default function UserLayout(): JSX.Element {
  return <BasicLayout variant="user" title="农业生产管理系统" />
}
