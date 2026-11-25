<template>
  <div class="layout-container" :class="{ 'is-collapsed': effectiveCollapsed, 'is-mobile': isMobile, 'is-drawer-open': drawerOpen }">
    <button
      v-if="isMobile && drawerOpen"
      type="button"
      class="sidebar-overlay"
      aria-label="关闭导航菜单"
      @click="drawerOpen = false"
    />
    <aside class="sidebar" :class="{ 'is-open': drawerOpen }" @mouseleave="scheduleCloseFlyout">
      <div class="logo-section">
        <BrandMark :size="36" />
        <div class="logo-text">
          <h1>丰链云</h1>
          <p>FENGCHAIN · AGRI</p>
        </div>
      </div>

      <nav class="nav-menu" aria-label="主数据导航">
        <template v-for="section in menuSections" :key="section.title">
          <div
            v-for="group in section.groups"
            :key="group.key"
            class="nav-group"
            @mouseenter="openFlyout(group, $event)"
          >
            <button
              type="button"
              class="group-head"
              :class="{ 'is-open': isGroupOpen(group), 'is-current': currentGroup?.key === group.key }"
              :title="group.label"
              :aria-label="group.label"
              :aria-expanded="effectiveCollapsed ? flyoutGroup?.key === group.key : isGroupOpen(group)"
              @click="handleGroupClick(group, $event)"
              @keydown.down.prevent="focusFlyout(group, $event)"
            >
              <span class="group-icon"><MenuIcon :name="group.icon" /></span>
              <span class="group-label">{{ group.label }}</span>
              <span class="group-arrow" aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
            </button>
            <ul v-show="!effectiveCollapsed && isGroupOpen(group)" class="sub-menu">
              <li v-for="item in group.items" :key="item.path" :class="{ active: isActive(item.path) }">
                <router-link :to="item.path" :title="item.label" @click="drawerOpen = false">
                  {{ item.label }}
                  <span v-if="item.readonly" class="readonly-mark">只读</span>
                </router-link>
              </li>
            </ul>
          </div>
        </template>
      </nav>

      <div class="pc-side-user" ref="userMenuRef">
        <button
          type="button"
          class="pc-side-user-trigger"
          :title="`${userDisplayName} · ${userRoleSummary}`"
          :aria-expanded="userMenuOpen"
          aria-haspopup="menu"
          @click.stop="userMenuOpen = !userMenuOpen"
        >
          <span class="pc-side-user-avatar">{{ userInitial }}</span>
          <span class="pc-side-user-meta">
            <strong>{{ userDisplayName }}</strong>
            <small>{{ userRoleSummary }}</small>
          </span>
          <span class="pc-side-user-caret" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 7.5L6 4.5L9 7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        </button>
        <div v-if="userMenuOpen" class="pc-side-user-menu" role="menu">
          <a :href="personalCenter" target="_blank" rel="noreferrer" role="menuitem" @click="userMenuOpen = false">个人中心</a>
          <a :href="userEntry" role="menuitem" @click="userMenuOpen = false">切换身份（会员中心）</a>
          <div class="pc-side-user-divider" />
          <button type="button" class="is-danger" role="menuitem" :disabled="loggingOut" @click="handleLogout">
            {{ loggingOut ? '退出中…' : '退出登录' }}
          </button>
        </div>
      </div>
    </aside>

    <!-- 80px 图标侧栏收起态：悬停或点击分组图标时在右侧弹出子菜单 -->
    <div
      v-if="effectiveCollapsed && flyoutGroup"
      class="nav-flyout"
      :style="{ top: `${flyoutTop}px` }"
      role="menu"
      @mouseenter="cancelCloseFlyout"
      @mouseleave="scheduleCloseFlyout"
    >
      <div class="nav-flyout-title">{{ flyoutGroup.label }}</div>
      <ul class="nav-flyout-list">
        <li v-for="item in flyoutGroup.items" :key="item.path" :class="{ active: isActive(item.path) }">
          <router-link :to="item.path" :title="item.label" @click="closeFlyout">
            <span>{{ item.label }}</span>
            <span v-if="item.readonly" class="readonly-mark">只读</span>
          </router-link>
        </li>
      </ul>
    </div>

    <main class="main-content">
      <AgriVueTopHeader
        header-class="top-header"
        left-class="header-left"
        right-class="header-right"
        toggle-button-class="collapse-btn"
        :collapsed="collapsed"
        :mobile="isMobile"
        :mobile-open="drawerOpen"
        :breadcrumbs="[currentGroupLabel, currentPageLabel]"
        @toggle-collapse="toggleCollapse"
      >
        <template #right>
          <form class="global-search" @submit.prevent="submitSearch">
            <input
              v-model="searchKeyword"
              type="search"
              placeholder="搜索主体 / 组织 / 用户"
              aria-label="全局搜索"
            />
          </form>
          <div class="role-switch">
            <span class="on">运营中心</span>
            <a :href="userEntry">会员中心</a>
          </div>
          <button
            type="button"
            class="icon-btn"
            title="消息中心由用户中心统一承载，点击前往用户中心运营端"
            @click="openUserCenter"
          >🔔</button>
          <div class="user-info">
            <div class="user-avatar">{{ userInitial }}</div>
            <div class="header-user-detail">
              <span class="user-name">{{ userInfo.nickname || userInfo.username || '管理员' }}</span>
              <span class="user-roles">{{ userInfo.roles?.length ? userInfo.roles.join(' / ') : '未分配角色' }}</span>
            </div>
          </div>
          <button class="logout-btn" :disabled="loggingOut" @click="handleLogout">
            {{ loggingOut ? '退出中…' : '退出登录' }}
          </button>
        </template>
      </AgriVueTopHeader>
      <div class="content-wrapper">
        <PointHiddenNotice />
        <router-view />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { revokePlatformSession } from '@/utils/sso'
import { AgriVueTopHeader } from '@agri/shared/vue/workspace'
import BrandMark from '@/components/BrandMark.vue'
import MenuIcon from '@/components/MenuIcon.vue'
import PointHiddenNotice from '@/components/ui/PointHiddenNotice.vue'

interface MenuItem {
  path: string
  label: string
  readonly?: boolean
}

interface MenuGroup {
  key: string
  label: string
  icon: string
  items: MenuItem[]
}

/**
 * 导航分组与《主数据管理模块_运营端原型 v1》一一对应（9 组）。
 *
 * 与原型的唯一差异：原型把「租户详情」也放进菜单，但详情页离开主体 ID 无法独立渲染，
 * 因此不进菜单（从列表点进去），菜单只保留可独立到达的页面。
 */
const menuGroups: MenuGroup[] = [
  {
    key: 'overview',
    label: '运营总览',
    icon: 'dashboard',
    items: [
      { path: '/dashboard', label: '运营大盘' },
      { path: '/masterdata/center', label: '主数据总览' },
    ],
  },
  {
    key: 'tenant',
    label: '租户与配额',
    icon: 'subject',
    items: [
      { path: '/subject/list', label: '租户列表' },
      { path: '/subject/audit', label: '入驻与生命周期' },
      { path: '/subject/create', label: '开通配置' },
      { path: '/subject/quota', label: '配额与超限' },
      { path: '/subject/package', label: '套餐模板' },
      { path: '/subject/statistics', label: '主体数据统计' },
    ],
  },
  {
    key: 'org',
    label: '组织与权限',
    icon: 'org',
    items: [
      { path: '/org/list', label: '全平台组织' },
      { path: '/permission/role', label: '角色与权限点' },
      { path: '/permission/matrix', label: '角色权限矩阵' },
      { path: '/permission/anomaly', label: '异常权限检测' },
    ],
  },
  {
    key: 'product',
    label: '商品主数据',
    icon: 'product',
    items: [
      { path: '/product/catalog', label: '品类标准与单位' },
      { path: '/product/template', label: '属性模板与 SKU' },
      { path: '/product/spu-audit', label: '商品审核' },
      { path: '/product/list', label: '官网上架商品' },
    ],
  },
  {
    key: 'partner',
    label: '客商主数据',
    icon: 'customer',
    items: [
      { path: '/customer/list', label: '客户主数据' },
      { path: '/supplier/list', label: '供应商主数据' },
      { path: '/customer/blacklist', label: '黑名单管理' },
    ],
  },
  {
    key: 'standard',
    label: '数据标准',
    icon: 'standard',
    items: [
      { path: '/datastandard/code-rule', label: '编码规则管理' },
      { path: '/datastandard/dict', label: '数据字典' },
      { path: '/datastandard/metadata', label: '标准与元数据' },
    ],
  },
  {
    key: 'governance',
    label: '数据治理',
    icon: 'quality',
    items: [
      { path: '/quality/dashboard', label: '质量稽核' },
      { path: '/quality/list', label: '质量监控' },
      { path: '/quality/issue', label: '问题治理与合并' },
      { path: '/quality/rule', label: '质量规则' },
      { path: '/quality/task', label: '检测任务' },
      { path: '/distribution/list', label: '血缘与分发' },
    ],
  },
  {
    key: 'system',
    label: '系统与审计',
    icon: 'system',
    items: [
      { path: '/permission/log', label: '操作审计' },
      { path: '/system/ops-accounts', label: '运营账号与角色' },
      { path: '/system/params', label: '参数配置' },
      { path: '/system/template', label: '通知模板' },
      { path: '/system/announcement', label: '公告管理' },
      { path: '/system/region', label: '行政区划' },
    ],
  },
  {
    key: 'related',
    label: '关联系统（只读）',
    icon: 'user',
    items: [
      { path: '/user/list', label: '全平台用户', readonly: true },
      { path: '/user/audit', label: '实名认证审核', readonly: true },
      { path: '/uc/overview', label: '用户中心总览', readonly: true },
      { path: '/uc/identity', label: '身份管理', readonly: true },
      { path: '/uc/identity-audit', label: '身份申请审核', readonly: true },
      { path: '/uc/certification', label: '资质审核', readonly: true },
      { path: '/uc/feedback', label: '意见反馈处理', readonly: true },
      { path: '/uc/privacy', label: '隐私与数据申请', readonly: true },
      { path: '/masterdata/boundary', label: '模块边界与协同' },
    ],
  },
]

const menuSections = [
  { title: '平台运营', groups: menuGroups.slice(0, 3) },
  { title: '主数据与标准', groups: menuGroups.slice(3, 6) },
  { title: '治理与系统', groups: menuGroups.slice(6) },
]

const router = useRouter()
const route = useRoute()
const session = useSessionStore()

const userInfo = computed(() => session.user ?? { username: '', nickname: '', roles: [] })
const userDisplayName = computed(() => userInfo.value.nickname || userInfo.value.username || '管理员')
const userRoleSummary = computed(() => (userInfo.value.roles?.length ? userInfo.value.roles.join(' / ') : '主数据运营'))
const userInitial = computed(() => userDisplayName.value.slice(0, 1))
const userEntry = `${window.location.protocol}//${window.location.hostname}:8086/member/buyer`
const personalCenter = `${window.location.protocol}//${window.location.hostname}:8098/portal/#/account/business`
const userCenterOps = `${window.location.protocol}//${window.location.hostname}:8115/user-center-ops/`

const COLLAPSE_KEY = 'mds.sidebar.collapsed'
const isCompactViewport = ref(typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px) and (max-width: 1279px)').matches)
const isMobile = ref(typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches)
const collapsed = ref(
  isCompactViewport.value ? true : localStorage.getItem(COLLAPSE_KEY) === '1',
)
const drawerOpen = ref(false)
const effectiveCollapsed = computed(() => !isMobile.value && collapsed.value)
const loggingOut = ref(false)
const searchKeyword = ref('')
const expandedKeys = ref<string[]>([])
const userMenuOpen = ref(false)
const userMenuRef = ref<HTMLElement | null>(null)
const flyoutGroup = ref<MenuGroup | null>(null)
const flyoutTop = ref(72)
let flyoutTimer: number | null = null

function cancelCloseFlyout() {
  if (flyoutTimer !== null) {
    window.clearTimeout(flyoutTimer)
    flyoutTimer = null
  }
}

function closeFlyout() {
  cancelCloseFlyout()
  flyoutGroup.value = null
}

function scheduleCloseFlyout() {
  cancelCloseFlyout()
  flyoutTimer = window.setTimeout(() => {
    flyoutGroup.value = null
  }, 140)
}

function positionFlyout(target: EventTarget | null) {
  const el = target instanceof HTMLElement ? target.closest('.nav-group, .group-head') as HTMLElement | null : null
  const rect = el?.getBoundingClientRect()
  const rawTop = rect ? rect.top : 72
  const maxTop = Math.max(72, window.innerHeight - 280)
  flyoutTop.value = Math.min(Math.max(68, rawTop), maxTop)
}

function openFlyout(group: MenuGroup, event: Event) {
  if (!effectiveCollapsed.value) return
  cancelCloseFlyout()
  positionFlyout(event.currentTarget)
  flyoutGroup.value = group
}

function handleGroupClick(group: MenuGroup, event: Event) {
  if (effectiveCollapsed.value) {
    openFlyout(group, event)
    return
  }
  expandedKeys.value = isGroupOpen(group)
    ? expandedKeys.value.filter((key) => key !== group.key)
    : [...expandedKeys.value, group.key]
}

function focusFlyout(group: MenuGroup, event: Event) {
  if (!effectiveCollapsed.value) return
  openFlyout(group, event)
  window.setTimeout(() => document.querySelector<HTMLAnchorElement>('.nav-flyout a')?.focus(), 0)
}

function handleNavigationEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  const label = flyoutGroup.value?.label
  closeFlyout()
  userMenuOpen.value = false
  drawerOpen.value = false
  if (label) [...document.querySelectorAll<HTMLButtonElement>('.group-head')].find(button => button.title === label)?.focus()
}

function toggleCollapse() {
  if (isMobile.value) {
    drawerOpen.value = !drawerOpen.value
    return
  }
  collapsed.value = !collapsed.value
  closeFlyout()
  if (!isCompactViewport.value) {
    localStorage.setItem(COLLAPSE_KEY, collapsed.value ? '1' : '0')
  }
}

let compactMedia: MediaQueryList | null = null
let mobileMedia: MediaQueryList | null = null

function syncViewport() {
  if (!compactMedia || !mobileMedia) return
  isCompactViewport.value = compactMedia.matches
  isMobile.value = mobileMedia.matches
  if (mobileMedia.matches) {
    drawerOpen.value = false
    closeFlyout()
  } else if (compactMedia.matches) {
    collapsed.value = true
    drawerOpen.value = false
  } else {
    collapsed.value = localStorage.getItem(COLLAPSE_KEY) === '1'
    drawerOpen.value = false
    closeFlyout()
  }
}

function handleDocClick(event: MouseEvent) {
  if (userMenuOpen.value && userMenuRef.value && !userMenuRef.value.contains(event.target as Node)) {
    userMenuOpen.value = false
  }
  if (flyoutGroup.value) {
    const target = event.target as HTMLElement | null
    if (!target?.closest('.nav-flyout') && !target?.closest('.nav-group')) {
      closeFlyout()
    }
  }
}

/** 默认展开当前页所在分组；首次进入展开「运营总览」。 */
function defaultExpanded(): string[] {
  const hits = menuGroups.filter((group) => group.items.some((item) => isActive(item.path))).map((group) => group.key)
  return hits.length ? hits : ['overview']
}

function isActive(path: string): boolean {
  const current = route.path
  if (current === path) return true
  // 详情/编辑页归属到列表菜单，例如 /subject/detail/9 → /subject/list
  if (path === '/subject/list' && /^\/(subject|tenant)\/(list|detail|edit)(\/|$)/.test(current)) return true
  if (path === '/subject/package' && /^\/(subject|tenant)\/package(\/|$)/.test(current)) return true
  if (path === '/subject/quota' && /^\/(subject|tenant)\/quota(\/|$)/.test(current)) return true
  if (path === '/subject/statistics' && /^\/(subject|tenant)\/statistics(\/|$)/.test(current)) return true
  if (path === '/permission/role' && /^\/permission\/role\//.test(current)) return true
  if (path === '/org/list' && /^\/org\//.test(current)) return true
  if (path === '/user/list' && /^\/user\/detail\//.test(current)) return true
  if (path === '/datastandard/dict' && /^\/datastandard\/dict\//.test(current)) return true
  return false
}

function isGroupOpen(group: MenuGroup): boolean {
  return expandedKeys.value.includes(group.key)
}

const subPageTitleRules: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /^\/(subject|tenant)\/detail\/[^/]+$/, label: '主体详情' },
  { pattern: /^\/(subject|tenant)\/edit\/[^/]+$/, label: '编辑主体资料' },
  { pattern: /^\/(subject|tenant)\/package\/new$/, label: '新建服务套餐' },
  { pattern: /^\/(subject|tenant)\/package\/[^/]+\/edit$/, label: '编辑服务套餐' },
  { pattern: /^\/(subject|tenant)\/package\/[^/]+$/, label: '服务套餐详情' },
  { pattern: /^\/(subject|tenant)\/quota\/[^/]+\/edit$/, label: '编辑主体配额' },
  { pattern: /^\/(subject|tenant)\/quota\/[^/]+$/, label: '主体配额详情' },
  { pattern: /^\/org\/new$/, label: '新建组织' },
  { pattern: /^\/org\/edit\/[^/]+$/, label: '编辑组织' },
  { pattern: /^\/org\/detail\/[^/]+$/, label: '组织详情' },
  { pattern: /^\/permission\/role\/new$/, label: '新建角色' },
  { pattern: /^\/permission\/role\/[^/]+\/edit$/, label: '编辑角色' },
  { pattern: /^\/permission\/role\/[^/]+$/, label: '角色详情' },
  { pattern: /^\/user\/detail\/[^/]+$/, label: '统一用户详情' },
]

const currentGroup = computed(() => menuGroups.find((group) => group.items.some((item) => isActive(item.path))))
const currentGroupLabel = computed(() => currentGroup.value?.label ?? '主数据管理')
const currentPageLabel = computed(() => {
  const matchedSub = subPageTitleRules.find((rule) => rule.pattern.test(route.path))
  if (matchedSub) return matchedSub.label
  const item = currentGroup.value?.items.find((entry) => isActive(entry.path))
  if (item) return item.label
  return detailTitles[route.path] ?? '页面'
})

const detailTitles: Record<string, string> = {
  '/subject/create': '开通配置',
  '/subject/edit/:id': '编辑主体',
  '/system/ops-accounts': '运营账号与角色',
}

function submitSearch() {
  const keyword = searchKeyword.value.trim()
  router.push({ path: '/subject/list', query: keyword ? { keyword } : {} })
}

function openUserCenter() {
  window.open(userCenterOps, '_blank', 'noopener')
}

async function handleLogout() {
  if (loggingOut.value) return
  loggingOut.value = true
  await revokePlatformSession(session.accessToken ?? undefined, () => {
    session.markForcedLogout(); session.clear()
  })
  loggingOut.value = false
}

watch(
  () => route.path,
  () => {
    drawerOpen.value = false
    closeFlyout()
    userMenuOpen.value = false
    const key = currentGroup.value?.key
    if (key && !expandedKeys.value.includes(key)) {
      expandedKeys.value = [...expandedKeys.value, key]
    }
  },
)

onMounted(() => {
  expandedKeys.value = defaultExpanded()
  compactMedia = window.matchMedia('(min-width: 1024px) and (max-width: 1279px)')
  mobileMedia = window.matchMedia('(max-width: 1023px)')
  syncViewport()
  compactMedia.addEventListener('change', syncViewport)
  mobileMedia.addEventListener('change', syncViewport)
  document.addEventListener('click', handleDocClick)
  document.addEventListener('keydown', handleNavigationEscape)
})

onBeforeUnmount(() => {
  cancelCloseFlyout()
  compactMedia?.removeEventListener('change', syncViewport)
  mobileMedia?.removeEventListener('change', syncViewport)
  document.removeEventListener('click', handleDocClick)
  document.removeEventListener('keydown', handleNavigationEscape)
})
</script>

<style scoped>
.layout-container {
  display: flex;
  min-height: 100vh;
  background: var(--mds-bg, #f5f7fa);
}

.sidebar {
  width: 240px;
  background: #001529;
  color: #a6a6a6;
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  transition: width 0.2s ease, transform 0.2s ease;
  overflow: visible;
}

.is-collapsed .sidebar {
  width: 80px;
}

.sidebar-overlay {
  display: block;
  position: fixed;
  inset: 0;
  z-index: 95;
  border: 0;
  padding: 0;
  background: rgba(0, 21, 41, 0.45);
  cursor: pointer;
}

.logo-section {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 64px;
  box-sizing: border-box;
  padding: 0 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.is-collapsed .logo-section {
  justify-content: center;
  padding: 0;
}

.logo-text h1 {
  margin: 0;
  color: #fff;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.3px;
  white-space: nowrap;
}

.logo-text p {
  margin: 2px 0 0;
  color: #a6a6a6;
  font-size: 12px;
  letter-spacing: 1.5px;
  white-space: nowrap;
}

.nav-menu {
  flex: 1;
  min-height: 0;
  padding: 8px 0 12px;
  overflow-y: auto;
  overflow-x: hidden;
}

.nav-section-title {
  padding: 12px 18px 4px;
  color: rgba(255, 255, 255, 0.45);
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.nav-menu::-webkit-scrollbar {
  width: 6px;
}

.nav-menu::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.18);
  border-radius: 3px;
}

.nav-group + .nav-group {
  margin-top: 0;
}

.group-head {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  height: 40px;
  padding: 0 16px 0 15px;
  border: 0;
  border-left: 3px solid transparent;
  border-radius: 0;
  background: transparent;
  color: #a6a6a6;
  font-size: 14px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  box-sizing: border-box;
  transition: background 0.16s ease, color 0.16s ease;
}

.group-head:hover {
  background: #0d2137;
  color: #fff;
}

.group-head.is-current {
  color: #fff;
}

.is-collapsed .group-head.is-current {
  background: rgba(45, 143, 78, 0.18);
  border-left-color: #2d8f4e;
  color: #fff;
}

.group-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: inherit;
}

.group-label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.group-arrow {
  display: inline-flex;
  align-items: center;
  color: #a6a6a6;
  transition: transform 0.2s ease;
}

.group-head.is-open .group-arrow {
  transform: rotate(90deg);
}

.sub-menu {
  list-style: none;
  margin: 0;
  padding: 2px 0;
  background: rgba(0, 0, 0, 0.18);
}

.sub-menu li a {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 16px 0 40px;
  border-left: 3px solid transparent;
  color: #a6a6a6;
  font-size: 14px;
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  box-sizing: border-box;
}

.sub-menu li a:hover {
  background: #0d2137;
  color: #fff;
}

.sub-menu li.active a {
  border-left-color: #2d8f4e;
  background: rgba(45, 143, 78, 0.18);
  color: #fff;
  font-weight: 500;
}

.nav-flyout {
  position: fixed;
  left: 84px;
  z-index: 220;
  min-width: 210px;
  max-height: calc(100vh - 88px);
  overflow-y: auto;
  padding: 6px 0;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: #001529;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.32);
}

.nav-flyout-title {
  padding: 8px 16px 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.55);
  font-size: 12px;
  font-weight: 600;
}

.nav-flyout-list {
  list-style: none;
  margin: 4px 0 0;
  padding: 0;
}

.nav-flyout-list li a {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: 40px;
  padding: 0 16px 0 13px;
  border-left: 3px solid transparent;
  color: #a6a6a6;
  font-size: 14px;
  text-decoration: none;
  white-space: nowrap;
}

.nav-flyout-list li a:hover {
  background: #0d2137;
  color: #fff;
}

.nav-flyout-list li.active a {
  background: rgba(45, 143, 78, 0.18);
  border-left-color: #2d8f4e;
  color: #fff;
  font-weight: 500;
}

.readonly-mark {
  flex: none;
  padding: 0 4px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.12);
  color: #a6a6a6;
  font-size: 12px;
  line-height: 16px;
}

.is-collapsed .logo-text,
.is-collapsed .group-label,
.is-collapsed .group-arrow,
.is-collapsed .sub-menu {
  display: none;
}

.is-collapsed .group-head {
  justify-content: center;
  padding: 0;
}

.main-content {
  flex: 1;
  min-width: 0;
  margin-left: 240px;
  display: flex;
  flex-direction: column;
  transition: margin-left 0.2s ease;
}

.is-collapsed .main-content {
  margin-left: 80px;
}

.is-mobile .sidebar {
  width: 240px;
  transform: translateX(-100%);
  box-shadow: 16px 0 40px rgba(0, 0, 0, 0.28);
}

.is-mobile .sidebar.is-open {
  transform: translateX(0);
}

.is-mobile .main-content {
  margin-left: 0;
}

.top-header {
  height: 60px;
  padding: 0 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: #fff;
  border-bottom: 1px solid #e3eae5;
  position: sticky;
  top: 0;
  z-index: 99;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.collapse-btn {
  width: 32px;
  height: 32px;
  border: 1px solid #e3eae5;
  border-radius: 7px;
  background: #fff;
  color: #4b5563;
  cursor: pointer;
  flex: none;
}

.collapse-btn:hover {
  border-color: #13a05a;
  color: #0f7a45;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: #6b7c72;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.breadcrumb b {
  color: #bac6be;
  font-weight: 400;
}

.breadcrumb strong {
  color: #0b1a12;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
}

.global-search input {
  width: 188px;
  height: 32px;
  padding: 0 10px;
  border: 1px solid #e3eae5;
  border-radius: 7px;
  background: #f7faf8;
  font-size: 12.5px;
  outline: none;
}

.global-search input:focus {
  border-color: #13a05a;
  background: #fff;
}

.role-switch {
  display: inline-flex;
  align-items: center;
  padding: 3px;
  border: 1px solid #e3eae5;
  border-radius: 999px;
  background: #eef3f0;
}

.role-switch span,
.role-switch a {
  padding: 3px 11px;
  border-radius: 999px;
  color: #6b7c72;
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}

.role-switch .on {
  background: #12764a;
  color: #fff;
}

.icon-btn {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: #f4f7f5;
  font-size: 15px;
  cursor: pointer;
}

.icon-btn:hover {
  background: #e4f6ec;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #159a5e, #0ea5e9);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
}

.header-user-detail {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.user-name {
  font-size: 12.5px;
  font-weight: 600;
  color: #33453b;
}

.user-roles {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--agri-font-size-micro);
  color: #93a29a;
}

.logout-btn {
  height: 32px;
  padding: 0 12px;
  border: 1px solid #d1d5db;
  border-radius: 7px;
  background: #fff;
  color: #4b5563;
  font-size: 12.5px;
  cursor: pointer;
  white-space: nowrap;
}

.logout-btn:hover:not(:disabled) {
  border-color: #10b981;
  color: var(--pc-brand, #2d8f4e);
  background: var(--pc-light, #e8f5e9);
}

.logout-btn:disabled {
  opacity: 0.55;
  cursor: wait;
}

.content-wrapper {
  flex: 1;
  padding: 18px 22px 34px;
  background: var(--pc-bg, #f5f6fa);
}

@media (max-width: 1023px) {
  .global-search {
    display: none;
  }
}

@media (max-width: 760px) {
  .content-wrapper {
    padding: 14px;
  }

  .top-header {
    padding: 0 12px;
  }

  .header-user-detail,
  .role-switch {
    display: none;
  }
}
</style>
