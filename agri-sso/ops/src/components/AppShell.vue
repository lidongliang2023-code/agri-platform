<template>
  <div class="app-shell" :class="{ 'sidebar-collapsed': collapsed }">
    <aside class="app-sidebar" :class="{ 'mobile-open': mobileOpen }">
      <button class="app-brand" type="button" @click="app.navigate('dashboard')">
        <img class="app-brand-mark" :src="`${baseUrl}fengchain.svg`" alt="丰链云" />
        <span v-if="showSidebarCopy" class="app-brand-copy">
          <b>丰链云</b>
          <small>FENGCHAIN · AGRI</small>
        </span>
      </button>
      <div class="sidebar-groups">
        <section v-for="group in MENU" :key="group.title" class="sidebar-group">
          <button
            v-for="item in group.items"
            :key="item.key"
            type="button"
            :class="{ on: highlight === item.key }"
            :title="collapsed ? item.label : undefined"
            @click="app.navigate(item.key)"
          >
            <span class="sidebar-icon"><component :is="item.icon" /></span>
            <span v-if="showSidebarCopy">{{ item.label }}</span>
            <i v-if="showSidebarCopy && item.key === 'dashboard' && pending > 0">{{ pending }}</i>
          </button>
        </section>
      </div>
      <SidebarUserCard
        :name="displayName"
        role="用户中心运营"
        :collapsed="!showSidebarCopy"
        switch-label="切换身份（主数据运营）"
        :switch-url="mdmSwitchUrl"
        @logout="handleLogout"
      />
    </aside>

    <button v-if="mobileOpen" type="button" class="mobile-overlay" aria-label="关闭菜单" @click="mobileOpen = false" />

    <div class="app-main">
      <AgriVueTopHeader
        header-class="app-header"
        left-class="header-left"
        right-class="header-right"
        :collapsed="collapsed"
        :mobile="isMobile"
        :mobile-open="mobileOpen"
        :breadcrumbs="breadcrumbs"
        @toggle-collapse="toggleCollapse"
      >
        <template #right>
          <button type="button" class="header-link" @click="app.navigate('dashboard')">待办 {{ pending }}</button>
          <button type="button" class="header-link" @click="app.navigate('audit-log')">审计日志</button>
          <a-dropdown placement="bottomRight">
            <button type="button" class="user-chip">
              <a-avatar :size="32" class="user-avatar">
                <template #icon><UserOutlined /></template>
                {{ displayName.slice(0, 1) }}
              </a-avatar>
              <span><b>{{ displayName }}</b><small>统一账号 · 运营权限</small></span>
            </button>
            <template #overlay>
              <a-menu @click="handleUserMenu">
                <a-menu-item key="config">参数配置</a-menu-item>
                <a-menu-item key="stats">用户统计</a-menu-item>
                <a-menu-item key="logout">退出统一登录</a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </template>
      </AgriVueTopHeader>

      <AgriVueWorkspaceTabs
        :active-key="activeTabKey"
        :active-label="activeTabLabel"
        :active-path="activeTabPath"
        home-key="dashboard"
        :home-label="TITLES.dashboard"
        storage-key="agri-sso-ops:workspace-tabs"
        @navigate="(path) => app.navigatePath(path)"
      />

      <main class="app-content"><slot /></main>
      <footer class="app-footer">© 2026 农业产业互联网平台 · 丰链云用户中心运营端</footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, type Component } from 'vue'
import {
  AuditOutlined,
  BarChartOutlined,
  BellOutlined,
  ClusterOutlined,
  DashboardOutlined,
  FileProtectOutlined,
  IdcardOutlined,
  KeyOutlined,
  LockOutlined,
  MessageOutlined,
  SafetyCertificateOutlined,
  SafetyOutlined,
  SettingOutlined,
  SolutionOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons-vue'
import { AgriVueTopHeader, AgriVueWorkspaceTabs } from '@agri/shared/vue/workspace'
import { useAppStore } from '../app-context'
import type { OpsPageKey } from '../types'
import { ucApi } from '../api'
import { logoutUnified, ucSession } from '../sso'
import SidebarUserCard from './SidebarUserCard.vue'

type MenuItem = { key: OpsPageKey; label: string; icon: Component }
type MenuGroup = { title: string; items: MenuItem[] }

const MENU: MenuGroup[] = [
  { title: '运营总览', items: [{ key: 'dashboard', label: '用户中心总览', icon: DashboardOutlined }] },
  {
    title: '用户与身份',
    items: [
      { key: 'user-list', label: '用户列表', icon: UserOutlined },
      { key: 'user-identity', label: '身份管理', icon: IdcardOutlined },
    ],
  },
  {
    title: '认证审核',
    items: [
      { key: 'audit-workbench', label: '审核工作台', icon: AuditOutlined },
      { key: 'identity-audit', label: '身份申请审核', icon: SolutionOutlined },
      { key: 'realname-audit', label: '实名认证审核', icon: SafetyCertificateOutlined },
      { key: 'qualification-audit', label: '资质审核', icon: FileProtectOutlined },
    ],
  },
  {
    title: '组织管理',
    items: [
      { key: 'org-list', label: '组织列表', icon: ClusterOutlined },
      { key: 'org-audit', label: '组织认证审核', icon: SafetyOutlined },
    ],
  },
  {
    title: '角色权限',
    items: [
      { key: 'role-list', label: '角色管理', icon: TeamOutlined },
      { key: 'perm-matrix', label: '权限矩阵', icon: KeyOutlined },
    ],
  },
  {
    title: '第三方授权',
    items: [
      { key: 'auth-app', label: '第三方应用', icon: LockOutlined },
      { key: 'auth-record', label: '授权记录', icon: AuditOutlined },
    ],
  },
  {
    title: '消息中心',
    items: [
      { key: 'message-push', label: '消息推送', icon: BellOutlined },
      { key: 'message-template', label: '消息模板', icon: MessageOutlined },
    ],
  },
  {
    title: '安全风控',
    items: [
      { key: 'security-risk', label: '安全风险监控', icon: SafetyOutlined },
      { key: 'device-log', label: '设备与登录日志', icon: AuditOutlined },
      { key: 'account-freeze', label: '账号冻结与解封', icon: LockOutlined },
    ],
  },
  {
    title: '合规服务',
    items: [
      { key: 'privacy-request', label: '隐私请求处理', icon: FileProtectOutlined },
      { key: 'feedback-manage', label: '反馈处理', icon: MessageOutlined },
    ],
  },
  { title: '数据分析', items: [{ key: 'stats', label: '用户统计分析', icon: BarChartOutlined }] },
  {
    title: '系统设置',
    items: [
      { key: 'health-monitor', label: '统一健康监控', icon: DashboardOutlined },
      { key: 'config', label: '参数配置', icon: SettingOutlined },
      { key: 'audit-log', label: '操作审计', icon: AuditOutlined },
    ],
  },
]

const TITLES: Record<OpsPageKey, string> = {
  'audit-workbench': '审核工作台',
  dashboard: '用户中心总览',
  'health-monitor': '统一健康监控',
  'user-list': '用户列表',
  'user-detail': '用户详情',
  'user-identity': '身份管理',
  'identity-audit': '身份申请审核',
  'realname-audit': '实名认证审核',
  'qualification-audit': '资质审核',
  'org-list': '组织列表',
  'org-detail': '组织详情',
  'org-audit': '组织认证审核',
  'role-list': '角色管理',
  'perm-matrix': '权限矩阵',
  'auth-app': '第三方应用',
  'auth-record': '授权记录',
  'message-push': '消息推送',
  'message-template': '消息模板',
  'security-risk': '安全风险监控',
  'device-log': '设备与登录日志',
  'account-freeze': '账号冻结与解封',
  'privacy-request': '隐私请求处理',
  'feedback-manage': '反馈处理',
  stats: '用户统计分析',
  config: '参数配置',
  'audit-log': '操作审计',
}

const PARENT_OF: Partial<Record<OpsPageKey, OpsPageKey>> = {
  'user-detail': 'user-list',
  'org-detail': 'org-list',
}

const app = useAppStore()
const baseUrl = import.meta.env.BASE_URL
const mdmSwitchUrl = `${window.location.protocol}//${window.location.hostname}:8080/`

const collapsed = ref(window.innerWidth >= 1024 && window.innerWidth < 1280)
const isMobile = ref(window.innerWidth < 1024)
const mobileOpen = ref(false)
const pending = ref(0)

const showSidebarCopy = computed(() => !collapsed.value || mobileOpen.value)
const displayName = computed(() => ucSession.user?.nickname || ucSession.user?.username || '平台运营')
const highlight = computed(() => PARENT_OF[app.page] ?? app.page)
const activeLabel = computed(() => TITLES[app.page])
const breadcrumbs = computed(() => {
  const parentKey = PARENT_OF[app.page]
  if (parentKey) {
    const tail = app.id ? `${activeLabel.value} · ${app.id.slice(-6)}` : activeLabel.value
    return ['用户中心 · 运营端', TITLES[parentKey], tail]
  }
  return ['用户中心 · 运营端', activeLabel.value]
})
const activeTabKey = computed(() => (app.id === undefined ? app.page : `${app.page}/${encodeURIComponent(app.id)}`))
const activeTabLabel = computed(() => (app.id === undefined ? activeLabel.value : `${activeLabel.value} · ${app.id.slice(-6)}`))
const activeTabPath = computed(() => app.hash.replace(/^#\/?/, '') || 'dashboard')

function syncLayout() {
  const w = window.innerWidth
  isMobile.value = w < 1024
  if (w >= 1024 && w < 1280) collapsed.value = true
  else if (w >= 1280) collapsed.value = false
  if (w >= 1024) mobileOpen.value = false
}

watch(() => app.page, () => {
  mobileOpen.value = false
  ucApi.dashboard(7)
    .then((data) => { pending.value = data.todos.reduce((sum, todo) => sum + todo.count, 0) })
    .catch(() => undefined)
}, { immediate: true })

onMounted(() => window.addEventListener('resize', syncLayout))
onUnmounted(() => window.removeEventListener('resize', syncLayout))

function toggleCollapse() {
  if (isMobile.value) mobileOpen.value = !mobileOpen.value
  else collapsed.value = !collapsed.value
}

function handleLogout() {
  void logoutUnified('user-center-ops')
}

function handleUserMenu({ key }: { key: string | number }) {
  if (key === 'config') app.navigate('config')
  else if (key === 'stats') app.navigate('stats')
  else if (key === 'logout') handleLogout()
}
</script>
