<template>
  <div class="layout-container" :class="{ 'is-collapsed': collapsed }">
    <aside class="sidebar">
      <div class="logo-section">
        <BrandMark :size="36" />
        <div class="logo-text">
          <h1>丰链云</h1>
          <p>主数据管理</p>
        </div>
      </div>

      <nav class="nav-menu">
        <div v-for="group in menuGroups" :key="group.key" class="nav-group">
          <button
            type="button"
            class="group-head"
            :class="{ 'is-open': isGroupOpen(group) }"
            :aria-expanded="isGroupOpen(group)"
            @click="toggleGroup(group)"
          >
            <span class="group-icon"><MenuIcon :name="group.icon" /></span>
            <span class="group-label">{{ group.label }}</span>
            <span class="group-arrow">▶</span>
          </button>
          <ul v-show="isGroupOpen(group)" class="sub-menu">
            <li v-for="item in group.items" :key="item.path" :class="{ active: isActive(item.path) }">
              <router-link :to="item.path" :title="item.label">
                {{ item.label }}
                <span v-if="item.readonly" class="readonly-mark">只读</span>
              </router-link>
            </li>
          </ul>
        </div>
      </nav>

      <div class="sidebar-foot">主数据运营端 · V1.0</div>
    </aside>

    <main class="main-content">
      <header class="top-header">
        <div class="header-left">
          <button type="button" class="collapse-btn" :title="collapsed ? '展开菜单' : '收起菜单'" @click="toggleCollapse">
            ☰
          </button>
          <div class="breadcrumb">
            <span>{{ currentGroupLabel }}</span><b>/</b><strong>{{ currentPageLabel }}</strong>
          </div>
        </div>
        <div class="header-right">
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
            <div class="user-detail">
              <span class="user-name">{{ userInfo.nickname || userInfo.username || '管理员' }}</span>
              <span class="user-roles">{{ userInfo.roles?.length ? userInfo.roles.join(' / ') : '未分配角色' }}</span>
            </div>
          </div>
          <button class="logout-btn" :disabled="loggingOut" @click="handleLogout">
            {{ loggingOut ? '退出中…' : '退出登录' }}
          </button>
        </div>
      </header>
      <div class="content-wrapper">
        <PointHiddenNotice />
        <router-view />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { revokePlatformSession, ssoLogoutUrl } from '@/utils/sso'
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

const router = useRouter()
const route = useRoute()
const session = useSessionStore()

const userInfo = computed(() => session.user ?? { username: '', nickname: '', roles: [] })
const userInitial = computed(() => (userInfo.value.nickname || userInfo.value.username || '管').slice(0, 1))
const userEntry = `${window.location.protocol}//${window.location.hostname}:8086/member/buyer`
const userCenterOps = `${window.location.protocol}//${window.location.hostname}:8115/user-center-ops/`

const COLLAPSE_KEY = 'mds.sidebar.collapsed'
const collapsed = ref(localStorage.getItem(COLLAPSE_KEY) === '1')
const loggingOut = ref(false)
const searchKeyword = ref('')
const expandedKeys = ref<string[]>([])

/** 默认展开当前页所在分组；首次进入展开「运营总览」。 */
function defaultExpanded(): string[] {
  const hits = menuGroups.filter((group) => group.items.some((item) => isActive(item.path))).map((group) => group.key)
  return hits.length ? hits : ['overview']
}

function isActive(path: string): boolean {
  const current = route.path
  if (current === path) return true
  // 详情/编辑页归属到列表菜单，例如 /subject/detail/9 → /subject/list
  if (path === '/subject/list' && /^\/subject\/(detail|edit)\//.test(current)) return true
  if (path === '/permission/role' && /^\/permission\/role\//.test(current)) return true
  if (path === '/org/list' && /^\/org\//.test(current)) return true
  if (path === '/user/list' && /^\/user\/detail\//.test(current)) return true
  if (path === '/datastandard/dict' && /^\/datastandard\/dict\//.test(current)) return true
  return false
}

function isGroupOpen(group: MenuGroup): boolean {
  return expandedKeys.value.includes(group.key)
}

function toggleGroup(group: MenuGroup) {
  if (collapsed.value) {
    collapsed.value = false
    localStorage.setItem(COLLAPSE_KEY, '0')
  }
  expandedKeys.value = isGroupOpen(group)
    ? expandedKeys.value.filter((key) => key !== group.key)
    : [...expandedKeys.value, group.key]
}

function toggleCollapse() {
  collapsed.value = !collapsed.value
  localStorage.setItem(COLLAPSE_KEY, collapsed.value ? '1' : '0')
}

const currentGroup = computed(() => menuGroups.find((group) => group.items.some((item) => isActive(item.path))))
const currentGroupLabel = computed(() => currentGroup.value?.label ?? '主数据管理')
const currentPageLabel = computed(() => {
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
  session.markForcedLogout()
  await revokePlatformSession()
  session.clear()
  window.location.assign(ssoLogoutUrl())
}

watch(
  () => route.path,
  () => {
    const key = currentGroup.value?.key
    if (key && !expandedKeys.value.includes(key)) {
      expandedKeys.value = [...expandedKeys.value, key]
    }
  },
)

onMounted(() => {
  expandedKeys.value = defaultExpanded()
})
</script>

<style scoped>
.layout-container {
  display: flex;
  min-height: 100vh;
  background: var(--mds-bg, #f5f7fa);
}

.sidebar {
  width: 224px;
  background: #062b1c;
  color: #fff;
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  transition: width 0.22s ease;
  overflow: hidden;
}

.is-collapsed .sidebar {
  width: 64px;
}

.logo-section {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.logo-text h1 {
  margin: 0;
  font-size: 17px;
  font-weight: 800;
  letter-spacing: 0.3px;
  white-space: nowrap;
}

.logo-text p {
  margin: 2px 0 0;
  font-size: var(--agri-font-size-micro);
  opacity: 0.55;
  letter-spacing: 2.4px;
  white-space: nowrap;
}

.nav-menu {
  flex: 1;
  padding: 8px 8px 12px;
  overflow-y: auto;
  overflow-x: hidden;
}

.nav-menu::-webkit-scrollbar {
  width: 6px;
}

.nav-menu::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.18);
  border-radius: 3px;
}

.nav-group + .nav-group {
  margin-top: 2px;
}

.group-head {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 9px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: rgba(255, 255, 255, 0.62);
  font-size: 12px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}

.group-head:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.group-icon {
  display: inline-flex;
  color: rgba(255, 255, 255, 0.55);
}

.group-head:hover .group-icon,
.group-head.is-open .group-icon {
  color: #7fe0ae;
}

.group-label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.group-arrow {
  font-size: var(--agri-font-size-micro);
  color: rgba(255, 255, 255, 0.35);
  transition: transform 0.2s;
}

.group-head.is-open .group-arrow {
  transform: rotate(90deg);
}

.sub-menu {
  list-style: none;
  margin: 2px 0 6px;
  padding: 0;
}

.sub-menu li a {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px 8px 35px;
  border-left: 3px solid transparent;
  color: rgba(255, 255, 255, 0.62);
  font-size: 12.5px;
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sub-menu li a:hover {
  background: rgba(19, 160, 90, 0.16);
  color: #fff;
}

.sub-menu li.active a {
  border-left-color: #7fe0ae;
  background: rgba(19, 160, 90, 0.24);
  color: #fff;
  font-weight: 600;
}

.readonly-mark {
  flex: none;
  padding: 0 4px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.6);
  font-size: var(--agri-font-size-micro);
  line-height: 15px;
}

.sidebar-foot {
  flex: none;
  padding: 12px 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.32);
  font-size: var(--agri-font-size-micro);
  text-align: center;
  white-space: nowrap;
}

.is-collapsed .logo-text,
.is-collapsed .group-label,
.is-collapsed .group-arrow,
.is-collapsed .sub-menu,
.is-collapsed .sidebar-foot {
  display: none;
}

.is-collapsed .group-head {
  justify-content: center;
  padding: 10px 0;
}

.main-content {
  flex: 1;
  min-width: 0;
  margin-left: 224px;
  display: flex;
  flex-direction: column;
  transition: margin-left 0.22s ease;
}

.is-collapsed .main-content {
  margin-left: 64px;
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
  font-weight: 700;
}

.user-detail {
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
  color: #047857;
  background: #ecfdf5;
}

.logout-btn:disabled {
  opacity: 0.55;
  cursor: wait;
}

.content-wrapper {
  flex: 1;
  padding: 18px 22px 34px;
  background: var(--mds-bg, #f5f7fa);
}

@media (max-width: 1024px) {
  .sidebar {
    width: 64px;
  }

  .logo-text,
  .group-label,
  .group-arrow,
  .sub-menu,
  .sidebar-foot {
    display: none;
  }

  .group-head {
    justify-content: center;
    padding: 10px 0;
  }

  .main-content {
    margin-left: 64px;
  }

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

  .user-detail,
  .role-switch {
    display: none;
  }
}
</style>
