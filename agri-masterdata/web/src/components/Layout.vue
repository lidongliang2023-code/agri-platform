<template>
  <div class="layout-container">
    <aside class="sidebar">
      <div class="logo-section">
        <div class="logo-icon">🌾</div>
        <div class="logo-text">
          <h1>主数据管理</h1>
          <p>Master Data System</p>
        </div>
      </div>
      <nav class="nav-menu">
        <ul>
          <li v-for="item in menuItems" :key="item.path" :class="{ active: currentPath === item.path }">
            <a :href="item.path" @click.prevent="handleNavClick(item.path)">
              <span class="nav-icon">{{ item.icon }}</span>
              <span class="nav-label">{{ item.label }}</span>
            </a>
            <ul v-if="item.children" class="sub-menu">
              <li v-for="child in item.children" :key="child.path" :class="{ active: currentPath === child.path }">
                <a :href="child.path" @click.prevent="handleNavClick(child.path)">
                  {{ child.label }}
                </a>
              </li>
            </ul>
          </li>
        </ul>
      </nav>
    </aside>
    <main class="main-content">
      <header class="top-header">
        <div class="header-left">
          <span class="current-location">{{ currentLocation }}</span>
        </div>
        <div class="header-right">
          <button class="notification-btn">🔔</button>
          <div class="user-info">
            <div class="user-avatar">👤</div>
            <div class="user-detail">
              <span class="user-name">{{ userInfo.nickname || userInfo.username || '管理员' }}</span>
              <span class="user-email">admin@masterdata.com</span>
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
import { ElMessage } from 'element-plus'

const router = useRouter()

const userInfo = ref({})
const currentPath = ref('/dashboard')

const menuItems = [
  { path: '/dashboard', label: '运营总览', icon: '📊' },
  { 
    path: '/tenant', 
    label: '租户管理', 
    icon: '🏢',
    children: [
      { path: '/tenant/list', label: '租户列表' }
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
      { path: '/quality/list', label: '质量监控' }
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
      { path: '/product/list', label: '商品列表' }
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
  }
]

const currentLocation = computed(() => {
  const pathNames = {
    '/dashboard': '运营总览',
    '/tenant/list': '租户管理',
    '/user/list': '用户管理',
    '/user/audit': '认证审核',
    '/org/list': '组织管理',
    '/permission/role': '角色管理',
    '/permission/log': '操作日志',
    '/datastandard/dict': '数据字典',
    '/datastandard/code-rule': '编码规则',
    '/quality/list': '质量监控',
    '/distribution/list': '分发监控',
    '/product/list': '商品列表',
    '/customer/list': '客户管理',
    '/supplier/list': '供应商管理'
  }
  return pathNames[currentPath.value] || '首页'
})

const handleNavClick = (path) => {
  currentPath.value = path
  router.push(path)
}

const handleLogout = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  ElMessage.success('退出成功')
  setTimeout(() => {
    router.push('/login')
  }, 1000)
}

onMounted(() => {
  const user = localStorage.getItem('user')
  if (user) {
    userInfo.value = JSON.parse(user)
  }
  currentPath.value = router.currentRoute.value.path
})
</script>

<style scoped>
.layout-container {
  display: flex;
  min-height: 100vh;
  background: #f5f7fa;
}

.sidebar {
  width: 200px;
  background: #2d3748;
  color: #fff;
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
}

.logo-section {
  padding: 20px;
  background: linear-gradient(135deg, #238636 0%, #2ea043 100%);
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  font-size: 28px;
}

.logo-text h1 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.logo-text p {
  margin: 4px 0 0;
  font-size: 10px;
  opacity: 0.8;
}

.nav-menu {
  flex: 1;
  padding: 10px 0;
}

.nav-menu ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.nav-menu > ul > li {
  margin: 4px 8px;
  border-radius: 6px;
}

.nav-menu > ul > li > a {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  color: #a0aec0;
  text-decoration: none;
  transition: all 0.2s;
  font-size: 14px;
}

.nav-menu > ul > li:hover > a {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.nav-menu > ul > li.active > a {
  background: #238636;
  color: #fff;
  border-radius: 6px;
}

.nav-icon {
  margin-right: 10px;
  font-size: 16px;
}

.sub-menu {
  background: rgba(0, 0, 0, 0.2);
  margin: 4px 8px;
  border-radius: 6px;
  overflow: hidden;
}

.sub-menu li {
  padding: 6px 0;
}

.sub-menu li a {
  display: block;
  padding: 8px 16px 8px 44px;
  color: #a0aec0;
  text-decoration: none;
  font-size: 13px;
  transition: all 0.2s;
}

.sub-menu li:hover a {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.sub-menu li.active a {
  color: #238636;
  font-weight: 500;
}

.main-content {
  flex: 1;
  margin-left: 200px;
  display: flex;
  flex-direction: column;
}

.top-header {
  background: #fff;
  padding: 0 20px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 99;
}

.header-left {
  flex: 1;
}

.current-location {
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.notification-btn {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  transition: background 0.2s;
}

.notification-btn:hover {
  background: #f0f0f0;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.user-info:hover {
  background: #f0f0f0;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #238636 0%, #2ea043 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 14px;
}

.user-detail {
  display: flex;
  flex-direction: column;
}

.user-name {
  font-size: 13px;
  font-weight: 500;
  color: #2d3748;
}

.user-email {
  font-size: 11px;
  color: #a0aec0;
}

.content-wrapper {
  flex: 1;
  padding: 20px;
}
</style>
