<template>
  <el-container class="app-container">
    <el-aside width="220px" class="sidebar">
      <div class="logo">
        <div class="logo-icon">
          <el-icon name="leaf" size="32"></el-icon>
        </div>
        <div class="logo-text">
          <h2>智慧农业</h2>
          <p>生产管理系统</p>
        </div>
      </div>
      <el-menu :default-active="activeMenu" class="menu" @select="handleSelect">
        <el-menu-item index="/">
          <el-icon name="layout-dashboard"></el-icon>
          <span>数据看板</span>
        </el-menu-item>
        <el-menu-item index="/farms">
          <el-icon name="map-pin"></el-icon>
          <span>农场管理</span>
        </el-menu-item>
        <el-menu-item index="/plots">
          <el-icon name="map"></el-icon>
          <span>地块管理</span>
        </el-menu-item>
        <el-menu-item index="/tasks">
          <el-icon name="list-checks"></el-icon>
          <span>农事任务</span>
        </el-menu-item>
        <el-menu-item index="/inputs">
          <el-icon name="package"></el-icon>
          <span>农资投入品</span>
        </el-menu-item>
        <el-menu-item index="/harvests">
          <el-icon name="scissors"></el-icon>
          <span>采收管理</span>
        </el-menu-item>
        <el-menu-item index="/inventory">
          <el-icon name="warehouse"></el-icon>
          <span>库存管理</span>
        </el-menu-item>
        <el-menu-item index="/trace">
          <el-icon name="search"></el-icon>
          <span>溯源管理</span>
        </el-menu-item>
        <el-menu-item index="/chain">
          <el-icon name="link"></el-icon>
          <span>区块链存证</span>
        </el-menu-item>
        <el-menu-item index="/iot">
          <el-icon name="signal"></el-icon>
          <span>IoT设备</span>
        </el-menu-item>
        <el-menu-item index="/alerts">
          <el-icon name="bell"></el-icon>
          <span>预警中心</span>
        </el-menu-item>
        <el-menu-item index="/ai">
          <el-icon name="cpu"></el-icon>
          <span>AI助手</span>
        </el-menu-item>
        <el-menu-item index="/admin">
          <el-icon name="bar-chart"></el-icon>
          <span>运营分析</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <div class="header-left">
          <span class="page-title">{{ currentTitle }}</span>
        </div>
        <div class="header-right">
          <div class="user-info">
            <div class="user-avatar">
              <el-icon name="user" size="24"></el-icon>
            </div>
            <div class="user-details">
              <span class="user-name">农场管理员</span>
              <span class="user-email">admin@farm.com</span>
            </div>
          </div>
        </div>
      </el-header>
      <el-main class="main">
        <router-view></router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const activeMenu = ref('/')

const titleMap = {
  '/': '数据看板',
  '/farms': '农场管理',
  '/plots': '地块管理',
  '/tasks': '农事任务',
  '/inputs': '农资投入品',
  '/harvests': '采收管理',
  '/inventory': '库存管理',
  '/trace': '溯源管理',
  '/chain': '区块链存证',
  '/iot': 'IoT设备',
  '/alerts': '预警中心',
  '/ai': 'AI助手',
  '/admin': '运营分析'
}

const currentTitle = computed(() => titleMap[router.currentRoute.value.path] || '智慧农业')

const handleSelect = (index) => {
  if (index.startsWith('/')) {
    activeMenu.value = index
    router.push(index)
  }
}

watch(() => router.currentRoute.value.path, (newPath) => {
  activeMenu.value = newPath
})
</script>

<style scoped>
.app-container {
  height: 100vh;
  background: #f5f7fa;
}

.sidebar {
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  color: white;
  box-shadow: 2px 0 15px rgba(0, 0, 0, 0.3);
}

.logo {
  display: flex;
  align-items: center;
  padding: 24px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.logo-icon {
  width: 50px;
  height: 50px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
}

.logo-text h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.logo-text p {
  margin: 4px 0 0;
  font-size: 12px;
  opacity: 0.8;
}

.menu {
  border-right: none;
  padding-top: 20px;
  background: transparent;
}

.menu :deep(.el-menu) {
  background: transparent;
}

.menu :deep(.el-menu-item) {
  color: rgba(255, 255, 255, 0.9);
  height: 50px;
  line-height: 50px;
  margin: 0 12px;
  border-radius: 8px;
  margin-bottom: 4px;
}

.menu :deep(.el-menu-item:hover) {
  background: rgba(255, 255, 255, 0.1);
}

.menu :deep(.el-menu-item.is-active) {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  font-weight: 500;
}

.header {
  background: white;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
}

.header-left {
  display: flex;
  align-items: center;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: #1a365d;
}

.header-right {
  display: flex;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: #f7fafc;
  border-radius: 8px;
}

.user-avatar {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #4fd1c5 0%, #38b2ac 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.user-details {
  display: flex;
  flex-direction: column;
}

.user-name {
  font-size: 14px;
  font-weight: 500;
  color: #1a365d;
}

.user-email {
  font-size: 12px;
  color: #718096;
}

.main {
  padding: 24px;
  overflow-y: auto;
  background: #f5f7fa;
}
</style>
