<template>
  <div class="layout-container">
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo">
          <span class="logo-icon">📦</span>
          <span class="logo-text">IoT平台</span>
        </div>
        <button class="collapse-btn" @click="toggleCollapse">
          <span>{{ isCollapsed ? '›' : '‹' }}</span>
        </button>
      </div>
      
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="text" placeholder="搜索菜单" class="search-input" />
      </div>
      
      <nav class="nav-menu">
        <ul class="menu-list">
          <li v-for="item in menuItems" :key="item.id" class="menu-item">
            <a 
              v-if="!item.children" 
              :href="item.path" 
              class="menu-link"
              :class="{ 'active': activeMenu === item.path }"
              @click.prevent="navigateTo(item.path)"
            >
              <span class="link-icon">{{ item.icon }}</span>
              <span class="link-text">{{ item.label }}</span>
              <span v-if="item.badge" class="link-badge">{{ item.badge }}</span>
            </a>
            
            <div v-else class="sub-menu-wrapper">
              <div 
                class="menu-link sub-menu-header"
                :class="{ 'active': activeMenu.startsWith(item.path) }"
                @click="toggleSubMenu(item.id)"
              >
                <span class="link-icon">{{ item.icon }}</span>
                <span class="link-text">{{ item.label }}</span>
                <span class="sub-menu-arrow" :class="{ 'rotated': expandedMenus.includes(item.id) }">›</span>
              </div>
              
              <ul v-show="expandedMenus.includes(item.id)" class="sub-menu">
                <li v-for="child in item.children" :key="child.id">
                  <a 
                    :href="child.path" 
                    class="sub-menu-link"
                    :class="{ 'active': $route.path === child.path }"
                    @click.prevent="navigateTo(child.path)"
                  >
                    <span class="sub-link-text">{{ child.label }}</span>
                  </a>
                </li>
              </ul>
            </div>
          </li>
        </ul>
      </nav>
    </aside>
    
    <main class="main-content">
      <header class="top-header">
        <div class="header-left">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item v-for="item in breadcrumbList" :key="item.path">
              <router-link v-if="item.path" :to="item.path">{{ item.title }}</router-link>
              <span v-else>{{ item.title }}</span>
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        
        <div class="header-right">
          <button class="header-btn" @click="showNotifications">
            <span class="btn-icon">🔔</span>
            <span class="btn-badge">3</span>
          </button>
          
          <button class="header-btn" @click="showSettings">
            <span class="btn-icon">⚙️</span>
          </button>
          
          <div class="user-profile">
            <div class="user-avatar">👤</div>
            <span class="user-name">管理员</span>
            <span class="user-arrow">▼</span>
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
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const isCollapsed = ref(false)
const expandedMenus = ref(['device', 'alert', 'automation', 'push', 'report'])

const menuItems = ref([
  { id: 'dashboard', label: '控制台', icon: '📊', path: '/dashboard' },
  { 
    id: 'device', 
    label: '设备管理', 
    icon: '📱', 
    path: '/device',
    children: [
      { id: 'device-list', label: '设备列表', path: '/device/list' }
    ]
  },
  { id: 'group', label: '设备分组', icon: '📁', path: '/group' },
  { 
    id: 'alert', 
    label: '告警管理', 
    icon: '🔔', 
    path: '/alert',
    badge: '5',
    children: [
      { id: 'alert-list', label: '告警列表', path: '/alert/list' },
      { id: 'alert-rule', label: '告警规则', path: '/alert/rule' }
    ]
  },
  { 
    id: 'automation', 
    label: '自动化规则', 
    icon: '⚙️', 
    path: '/automation',
    children: [
      { id: 'rule-list', label: '规则列表', path: '/automation' },
      { id: 'rule-config', label: '规则配置', path: '/automation/config' }
    ]
  },
  { 
    id: 'push', 
    label: '推送管理', 
    icon: '📤', 
    path: '/push',
    children: [
      { id: 'push-config', label: '推送配置', path: '/push/config' },
      { id: 'push-message', label: '消息记录', path: '/push/message' }
    ]
  },
  { 
    id: 'report', 
    label: '报表管理', 
    icon: '📈', 
    path: '/report',
    children: [
      { id: 'report-list', label: '报表列表', path: '/report/list' },
      { id: 'report-export', label: '数据导出', path: '/report/export' }
    ]
  },
  { id: 'plot', label: '地块管理', icon: '🗺️', path: '/plot' }
])

const activeMenu = computed(() => {
  const path = route.path
  if (path.startsWith('/device')) return '/device'
  if (path.startsWith('/alert')) return '/alert'
  if (path.startsWith('/automation')) return '/automation'
  if (path.startsWith('/push')) return '/push'
  if (path.startsWith('/report')) return '/report'
  return path
})

const breadcrumbMap = {
  '/dashboard': '控制台',
  '/device': '设备管理',
  '/device/list': '设备列表',
  '/device/detail': '设备详情',
  '/group': '设备分组',
  '/alert': '告警管理',
  '/alert/list': '告警列表',
  '/alert/rule': '告警规则',
  '/automation': '自动化规则',
  '/automation/config': '规则配置',
  '/push': '推送管理',
  '/push/config': '推送配置',
  '/push/message': '消息记录',
  '/report': '报表管理',
  '/report/list': '报表列表',
  '/report/export': '数据导出',
  '/plot': '地块管理'
}

const breadcrumbList = computed(() => {
  const path = route.path
  const parts = path.split('/').filter(p => p)
  const list = []
  let currentPath = ''
  
  parts.forEach((part, index) => {
    currentPath += `/${part}`
    list.push({
      path: index === parts.length - 1 ? '' : currentPath,
      title: breadcrumbMap[currentPath] || part
    })
  })
  
  return list.length ? list : [{ path: '', title: '控制台' }]
})

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
}

const toggleSubMenu = (id) => {
  const index = expandedMenus.value.indexOf(id)
  if (index > -1) {
    expandedMenus.value.splice(index, 1)
  } else {
    expandedMenus.value.push(id)
  }
}

const navigateTo = (path) => {
  router.push(path)
}

const showNotifications = () => {
  uni.showToast({ title: '通知中心', icon: 'none' })
}

const showSettings = () => {
  uni.showToast({ title: '设置', icon: 'none' })
}
</script>

<style scoped>
.layout-container {
  display: flex;
  min-height: 100vh;
  background: var(--bg-primary);
}

.sidebar {
  width: var(--sidebar-width);
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 100;
  transition: width 0.3s ease;
}

.sidebar-header {
  height: var(--header-height);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 16px;
  border-bottom: 1px solid var(--border-color);
}

.logo {
  display: flex;
  align-items: center;
}

.logo-icon {
  font-size: 24px;
  margin-right: 8px;
}

.logo-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.collapse-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 20px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.3s ease;
}

.collapse-btn:hover {
  background: var(--bg-hover);
}

.search-box {
  display: flex;
  align-items: center;
  margin: 12px;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border-radius: 6px;
}

.search-icon {
  font-size: 14px;
  margin-right: 8px;
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 13px;
  color: var(--text-secondary);
}

.search-input::placeholder {
  color: var(--text-muted);
}

.nav-menu {
  flex: 1;
  padding: 8px 0;
  overflow-y: auto;
}

.menu-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.menu-item {
  margin-bottom: 2px;
}

.menu-link {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  color: var(--text-secondary);
  text-decoration: none;
  border-radius: 0 6px 6px 0;
  transition: all 0.2s ease;
  position: relative;
}

.menu-link:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.menu-link.active {
  background: rgba(255, 125, 0, 0.08);
  color: var(--primary-color);
}

.menu-link.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 18px;
  background: var(--primary-color);
  border-radius: 0 3px 3px 0;
}

.link-icon {
  font-size: 16px;
  margin-right: 10px;
}

.link-text {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
}

.link-badge {
  background: var(--danger-color);
  color: white;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 8px;
  min-width: 18px;
  text-align: center;
}

.sub-menu-wrapper {
  position: relative;
}

.sub-menu-header {
  justify-content: space-between;
}

.sub-menu-arrow {
  font-size: 14px;
  transition: transform 0.2s ease;
}

.sub-menu-arrow.rotated {
  transform: rotate(90deg);
}

.sub-menu {
  list-style: none;
  padding: 0;
  margin: 0;
  background: var(--bg-tertiary);
}

.sub-menu-link {
  display: block;
  padding: 8px 16px 8px 44px;
  color: var(--text-muted);
  text-decoration: none;
  font-size: 12px;
  transition: all 0.2s ease;
}

.sub-menu-link:hover {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.sub-menu-link.active {
  color: var(--primary-color);
  background: rgba(255, 125, 0, 0.06);
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-left: var(--sidebar-width);
}

.top-header {
  height: var(--header-height);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  padding: 0 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  flex: 1;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  position: relative;
  transition: background 0.2s ease;
}

.header-btn:hover {
  background: var(--bg-hover);
}

.btn-icon {
  font-size: 18px;
}

.btn-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  background: var(--danger-color);
  color: white;
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 8px;
  min-width: 14px;
  text-align: center;
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.user-profile:hover {
  background: var(--bg-hover);
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 14px;
}

.user-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.user-arrow {
  font-size: 11px;
  color: var(--text-muted);
}

.content-wrapper {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

:deep(.el-breadcrumb__item) {
  font-size: 13px;
}

:deep(.el-breadcrumb__item a) {
  color: var(--text-muted);
}

:deep(.el-breadcrumb__item:last-child a) {
  color: var(--text-primary);
  font-weight: 500;
}
</style>