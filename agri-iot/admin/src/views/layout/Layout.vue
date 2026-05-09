<template>
  <div class="layout-container">
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo">
          <span class="logo-icon">⚙️</span>
          <span class="logo-text">运营平台</span>
        </div>
      </div>
      <nav class="nav-menu">
        <ul class="menu-list">
          <li v-for="item in menuItems" :key="item.id" class="menu-item">
            <a 
              v-if="!item.children" 
              :href="item.path" 
              class="menu-link"
              :class="{ 'active': $route.path === item.path }"
              @click.prevent="navigateTo(item.path)"
            >
              <span class="link-icon">{{ item.icon }}</span>
              <span class="link-text">{{ item.label }}</span>
            </a>
            <div v-else class="sub-menu-wrapper">
              <div 
                class="menu-link sub-menu-header"
                :class="{ 'active': $route.path.startsWith(item.path) }"
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
            <span class="btn-badge">5</span>
          </button>
          <div class="user-profile" @click="showUserMenu">
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

const expandedMenus = ref(['system'])

const menuItems = ref([
  { id: 'dashboard', label: '运营概览', icon: '📊', path: '/' },
  { id: 'tenant', label: '租户管理', icon: '🏢', path: '/tenant' },
  { id: 'user', label: '用户管理', icon: '👥', path: '/user' },
  { id: 'device', label: '设备管理', icon: '📱', path: '/device' },
  { id: 'alert', label: '告警管理', icon: '🔔', path: '/alert' },
  { id: 'gateway', label: '网关管理', icon: '🌐', path: '/gateway' },
  { 
    id: 'system', 
    label: '系统管理', 
    icon: '⚙️', 
    path: '/firmware',
    children: [
      { id: 'firmware', label: '固件管理', path: '/firmware' },
      { id: 'ota', label: 'OTA升级', path: '/ota' },
      { id: 'config', label: '系统配置', path: '/system' }
    ]
  }
])

const breadcrumbMap = {
  '/': '运营概览',
  '/tenant': '租户管理',
  '/user': '用户管理',
  '/device': '设备管理',
  '/alert': '告警管理',
  '/gateway': '网关管理',
  '/firmware': '固件管理',
  '/ota': 'OTA升级',
  '/system': '系统配置'
}

const breadcrumbList = computed(() => {
  const path = route.path
  return [{ path: '', title: breadcrumbMap[path] || '运营概览' }]
})

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
  alert('通知中心')
}

const showUserMenu = () => {
  if (confirm('确定退出登录？')) {
    localStorage.removeItem('admin_token')
    router.push('/login')
  }
}
</script>

<style scoped>
.layout-container {
  display: flex;
  min-height: 100vh;
  background: #f0f2f5;
}

.sidebar {
  width: 220px;
  background: #1f2937;
  display: flex;
  flex-direction: column;
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 100;
}

.sidebar-header {
  height: 60px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  border-bottom: 1px solid #374151;
}

.logo {
  display: flex;
  align-items: center;
}

.logo-icon {
  font-size: 24px;
  margin-right: 10px;
}

.logo-text {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.nav-menu {
  flex: 1;
  padding: 20px 0;
}

.menu-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.menu-item {
  margin-bottom: 4px;
}

.menu-link {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  color: #9ca3af;
  text-decoration: none;
  transition: all 0.2s ease;
}

.menu-link:hover {
  background: #374151;
  color: #fff;
}

.menu-link.active {
  background: #4080ff;
  color: #fff;
}

.link-icon {
  font-size: 16px;
  margin-right: 12px;
}

.link-text {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
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
  background: #111827;
}

.sub-menu-link {
  display: block;
  padding: 10px 20px 10px 50px;
  color: #9ca3af;
  text-decoration: none;
  font-size: 13px;
  transition: all 0.2s ease;
}

.sub-menu-link:hover {
  background: #374151;
  color: #fff;
}

.sub-menu-link.active {
  background: #374151;
  color: #4080ff;
}

.main-content {
  flex: 1;
  margin-left: 220px;
  display: flex;
  flex-direction: column;
}

.top-header {
  height: 60px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
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
  gap: 20px;
}

.header-btn {
  background: transparent;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  position: relative;
  transition: background 0.2s ease;
}

.header-btn:hover {
  background: #f0f0f0;
}

.btn-icon {
  font-size: 18px;
}

.btn-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  background: #ff4d4f;
  color: white;
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 8px;
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
  background: #f0f0f0;
}

.user-name {
  font-size: 13px;
  font-weight: 500;
  color: #333;
}

.user-arrow {
  font-size: 11px;
  color: #999;
}

.content-wrapper {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}
</style>