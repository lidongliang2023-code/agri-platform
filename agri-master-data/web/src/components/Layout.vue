<template>
  <div class="layout-container">
    <aside class="sidebar">
      <div class="logo-section">
        <div class="logo-icon">🌾</div>
        <div class="logo-text">
          <h1>农产云</h1>
          <p>MASTER DATA</p>
        </div>
      </div>
      <nav class="nav-menu">
        <ul>
          <li v-for="item in menuItems" :key="item.path" :class="{ active: isCurrentPath(item), expanded: expandedMenu === item.path }">
            <a 
              :href="item.path" 
              @click.prevent="handleMenuClick(item)"
              class="menu-link"
            >
              <span class="nav-icon">{{ item.icon }}</span>
              <span class="nav-label">{{ item.label }}</span>
              <span v-if="item.children" class="expand-icon" :class="{ expanded: expandedMenu === item.path }">▶</span>
            </a>
            <ul v-if="item.children && expandedMenu === item.path" class="sub-menu">
              <li v-for="child in item.children" :key="child.path" :class="{ active: currentPath === child.path }">
                <a :href="child.path" @click.prevent="handleNavClick(child.path)">
                  {{ child.label }}
                </a>
              </li>
            </ul>
          </li>
        </ul>
      </nav>
      <div class="sidebar-foot">平台运营 · 主数据管理</div>
    </aside>
    <main class="main-content">
      <header class="top-header">
        <div class="header-left">
          <div class="breadcrumb">
            <span>主数据管理</span><b>/</b><strong>{{ currentLocation }}</strong>
          </div>
        </div>
        <div class="header-right">
          <div class="role-switch">
            <span class="on">运营中心</span>
            <a :href="userEntry">用户端</a>
          </div>
          <button class="notification-btn">🔔</button>
          <div class="user-info">
            <div class="user-avatar">{{ (userInfo.nickname || userInfo.username || '管').slice(0, 1) }}</div>
            <div class="user-detail">
              <span class="user-name">{{ userInfo.nickname || userInfo.username || '管理员' }}</span>
              <!-- 原来这里写死 admin@masterdata.com：一个真实的界面上不该出现编造的邮箱 -->
              <span class="user-email">{{ userInfo.roles?.length ? userInfo.roles.join(' / ') : '未分配角色' }}</span>
            </div>
          </div>
        </div>
      </header>
      <div class="content-wrapper">
        <router-view />
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { ssoLogoutUrl } from '@/utils/sso'

const router = useRouter()
/**
 * 登录态取唯一来源（Pinia）。
 *
 * 这里原来直接读 localStorage 里的 `user` / `token`，等于在 store 之外另开一份状态：
 * 两份状态必然分叉，而且 localStorage 里的凭证本来就不该存在（V2.0 第 4.3 节）。
 */
const session = useSessionStore()

/** 当前用户展示信息（内存态优先，回退到持久化的非凭证资料） */
const userInfo = computed(() => session.user ?? { username: '', nickname: '', roles: [] })
const currentPath = ref('/dashboard')
const expandedMenu = ref(null)
/** 用户端入口（买家中心）；运营端与用户端共用平台 SSO。 */
const userEntry = `${window.location.protocol}//${window.location.hostname}:8086/member/buyer`

const menuItems = [
  { path: '/dashboard', label: '运营总览', icon: '📊' },
  { path: '/masterdata/center', label: '主数据运营', icon: '🗂️' },
  {
    path: '/subject',
    label: '主体管理',
    icon: '🏢',
    children: [
      { path: '/subject/list', label: '企业与个人主体' },
      { path: '/subject/quota', label: '主体资源配额' },
      { path: '/subject/package', label: '服务套餐' },
      { path: '/subject/statistics', label: '主体数据统计' }
    ]
  },
  {
    path: '/user', 
    label: '用户管理', 
    icon: '👥',
    children: [
      { path: '/user/list', label: '用户列表' },
      { path: '/user/audit', label: '认证审核' }
    ]
  },
  { 
    path: '/org', 
    label: '组织管理', 
    icon: '🏠',
    children: [
      { path: '/org/list', label: '组织列表' }
    ]
  },
  { 
    path: '/permission', 
    label: '权限审计', 
    icon: '🔒',
    children: [
      { path: '/permission/role', label: '角色管理' },
      { path: '/permission/log', label: '操作日志' }
    ]
  },
  { 
    path: '/datastandard', 
    label: '数据标准', 
    icon: '📋',
    children: [
      { path: '/datastandard/dict', label: '数据字典' },
      { path: '/datastandard/code-rule', label: '编码规则' }
    ]
  },
  { 
    path: '/quality', 
    label: '数据质量', 
    icon: '✅',
    children: [
      { path: '/quality/dashboard', label: '质量仪表盘' },
      { path: '/quality/list', label: '质量监控' },
      { path: '/quality/rule', label: '规则配置' },
      { path: '/quality/task', label: '检测任务' },
      { path: '/quality/issue', label: '问题工单' }
    ]
  },
  { 
    path: '/distribution', 
    label: '数据分发', 
    icon: '📤',
    children: [
      { path: '/distribution/list', label: '分发监控' }
    ]
  },
  { 
    path: '/product', 
    label: '商品管理', 
    icon: '📦',
    children: [
      { path: '/product/list', label: '商品列表' },
      { path: '/product/catalog', label: '商品与分类' }
    ]
  },
  { 
    path: '/customer', 
    label: '客户供应商', 
    icon: '🤝',
    children: [
      { path: '/customer/list', label: '客户列表' },
      { path: '/supplier/list', label: '供应商列表' }
    ]
  },
  
  { 
    path: '/system', 
    label: '系统配置', 
    icon: '⚙️',
    children: [
      { path: '/system/params', label: '参数配置' },
      { path: '/system/template', label: '通知模板' },
      { path: '/system/announcement', label: '公告管理' },
      { path: '/system/region', label: '行政区划' }
    ]
  }
]

const currentLocation = computed(() => {
  const pathNames = {
    '/dashboard': '运营总览',
    '/masterdata/center': '主数据运营',
    '/subject/list': '企业与个人主体',
    '/subject/quota': '主体资源配额',
    '/subject/package': '服务套餐',
    '/subject/statistics': '主体数据统计',
    '/user/list': '用户管理',
    '/user/audit': '认证审核',
    '/org/list': '组织管理',
    '/permission/role': '角色管理',
    '/permission/log': '操作日志',
    '/datastandard/dict': '数据字典',
    '/datastandard/code-rule': '编码规则',
    '/quality/dashboard': '质量仪表盘',
    '/quality/list': '质量监控',
    '/quality/rule': '规则配置',
    '/quality/task': '检测任务',
    '/quality/issue': '问题工单',
    '/distribution/list': '分发监控',
    '/product/list': '商品列表',
    '/product/catalog': '商品与分类',
    '/customer/list': '客户管理',
    '/supplier/list': '供应商管理',
    '/system/params': '参数配置',
    '/system/template': '通知模板',
    '/system/announcement': '公告管理',
    '/system/region': '行政区划'
  }
  return pathNames[currentPath.value] || '首页'
})

const isCurrentPath = (item) => {
  if (currentPath.value === item.path) return true
  if (item.children) {
    return item.children.some(child => currentPath.value === child.path)
  }
  return false
}

const handleMenuClick = (item) => {
  if (item.children) {
    if (expandedMenu.value === item.path) {
      expandedMenu.value = null
    } else {
      expandedMenu.value = item.path
    }
  }
  if (!item.children) {
    currentPath.value = item.path
    router.push(item.path)
  }
}

const handleNavClick = (path) => {
  currentPath.value = path
  router.push(path)
}

const handleLogout = () => {
  session.clear()
  // 必须由浏览器**整页导航**到认证中心的登出端点：SSO 会话 Cookie 只存在于那个域上，
  // 子系统发起的跨域 XHR 带不上它 —— 只清本地会出现"点了登出、刷新又登回来"。
  window.location.href = ssoLogoutUrl()
}

onMounted(() => {
  currentPath.value = router.currentRoute.value.path
  const currentMenu = menuItems.find(item => {
    if (item.children) {
      return item.children.some(child => currentPath.value === child.path)
    }
    return false
  })
  if (currentMenu) {
    expandedMenu.value = currentMenu.path
  }
})
</script>

<style scoped>
.layout-container {
  display: flex;
  min-height: 100vh;
  background: #f4f7f5;
}

.sidebar {
  width: 224px;
  background: linear-gradient(180deg, #06281a, #05301f);
  color: #fff;
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.logo-section {
  padding: 18px;
  background: transparent;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
}

.logo-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #159a5e, #0c7ba8);
  font-size: 17px;
  flex: none;
}

.logo-text h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.3px;
}

.logo-text p {
  margin: 2px 0 0;
  font-size: 9px;
  opacity: 0.55;
  letter-spacing: 2.4px;
}

.nav-menu {
  flex: 1;
  padding: 10px 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.nav-menu ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.nav-menu > ul > li {
  margin: 2px 10px;
  border-radius: 8px;
}

.nav-menu > ul > li > a {
  display: flex;
  align-items: center;
  padding: 9px 12px;
  color: rgba(255, 255, 255, 0.76);
  text-decoration: none;
  transition: all 0.2s;
  font-size: 13.5px;
}

.nav-menu > ul > li:hover > a {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.nav-menu > ul > li.active > a {
  background: linear-gradient(135deg, #12764a, #159a5e);
  color: #fff;
  box-shadow: 0 8px 22px rgba(21, 154, 94, 0.28);
}

.nav-icon {
  margin-right: 10px;
  font-size: 16px;
}

.expand-icon {
  margin-left: auto;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  transition: transform 0.2s;
}

.expand-icon.expanded {
  transform: rotate(90deg);
}

.sub-menu {
  background: rgba(0, 0, 0, 0.16);
  margin: 4px 8px;
  border-radius: 8px;
  overflow: hidden;
}

.sub-menu li {
  padding: 2px 0;
}

.sub-menu li a {
  display: block;
  padding: 8px 14px 8px 42px;
  color: rgba(255, 255, 255, 0.65);
  text-decoration: none;
  font-size: 12.5px;
  transition: all 0.2s;
}

.sub-menu li:hover a {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.sub-menu li.active a {
  color: #6fd6a2;
  background: rgba(21, 154, 94, 0.16);
  font-weight: 600;
}

.sidebar-foot {
  flex: none;
  padding: 14px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.35);
  font-size: 10.5px;
  text-align: center;
}

.main-content {
  flex: 1;
  min-width: 0;
  margin-left: 224px;
  display: flex;
  flex-direction: column;
}

.top-header {
  background: #fff;
  padding: 0 24px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e3eae5;
  position: sticky;
  top: 0;
  z-index: 99;
}

.header-left {
  flex: 1;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #6b7c72;
  font-size: 13px;
}

.breadcrumb b {
  color: #bac6be;
  font-weight: 400;
}

.breadcrumb strong {
  color: #0b1a12;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.role-switch {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border: 1px solid #e3eae5;
  border-radius: 999px;
  background: #eef3f0;
}

.role-switch span,
.role-switch a {
  padding: 4px 12px;
  border-radius: 999px;
  color: #6b7c72;
  font-size: 12.5px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}

.role-switch a:hover {
  color: #0e5233;
}

.role-switch .on {
  background: #12764a;
  color: #fff;
}

.notification-btn {
  background: #f4f7f5;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 8px;
}

.notification-btn:hover {
  background: #e4f6ec;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 8px;
  border-radius: 8px;
  cursor: pointer;
}

.user-info:hover {
  background: #f4f7f5;
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
}

.user-name {
  font-size: 13px;
  font-weight: 600;
  color: #33453b;
}

.user-email {
  font-size: 10.5px;
  color: #93a29a;
}

.content-wrapper {
  flex: 1;
  padding: 20px 24px 34px;
  background: #f4f7f5;
}

/* 页面公共控件向会员中心的绿色系收口 */
.content-wrapper .add-btn,
.content-wrapper .btn-primary {
  background: linear-gradient(135deg, #12764a, #159a5e) !important;
}

.content-wrapper .search-btn {
  color: #12764a;
}

.content-wrapper .status-badge.active,
.content-wrapper .type-badge.enterprise {
  background: rgba(18, 118, 74, 0.1);
  color: #12764a;
}

.content-wrapper .table-card {
  border: 1px solid #e3eae5;
  box-shadow: none;
}

.content-wrapper .header-left h1 {
  color: #0b1a12;
}

@media (max-width: 900px) {
  .layout-container {
    display: block;
  }

  .sidebar {
    position: relative;
    width: 100%;
    bottom: auto;
  }

  .main-content {
    margin-left: 0;
  }

  .nav-menu {
    max-height: 320px;
  }

  .sidebar-foot {
    display: none;
  }

  .top-header {
    padding: 0 14px;
  }

  .content-wrapper {
    padding: 14px;
  }

  .user-email {
    display: none;
  }
}

@media (max-width: 700px) {
  .top-header {
    height: auto;
    min-height: 60px;
    flex-wrap: wrap;
    gap: 8px;
    padding: 10px 12px;
  }

  .header-left {
    flex: 1 1 100%;
  }

  .breadcrumb {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .header-right {
    width: 100%;
    justify-content: flex-end;
  }

  .role-switch {
    margin-right: auto;
  }
}

.nav-menu::-webkit-scrollbar {
  width: 6px;
}

.nav-menu::-webkit-scrollbar-track {
  background: transparent;
}

.nav-menu::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.nav-menu::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

.nav-menu::-moz-scrollbar {
  width: 6px;
}

.nav-menu::-moz-scrollbar-track {
  background: transparent;
}

.nav-menu::-moz-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}
</style>
