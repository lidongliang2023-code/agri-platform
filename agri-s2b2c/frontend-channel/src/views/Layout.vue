<template>
  <div class="layout">
    <div class="sidebar">
      <div class="logo">
        <span class="logo-icon">🌾</span>
        <span class="logo-text">渠道商管理</span>
      </div>
      <el-menu :default-active="activeMenu" router class="sidebar-menu">
        <el-menu-item index="/">
          <el-icon><HomeFilled /></el-icon>
          <span>数据看板</span>
        </el-menu-item>
        <el-menu-item index="/product-pool">
          <el-icon><Search /></el-icon>
          <span>选品中心</span>
        </el-menu-item>
        <el-menu-item index="/products">
          <el-icon><Goods /></el-icon>
          <span>商品管理</span>
        </el-menu-item>
        <el-menu-item index="/orders">
          <el-icon><ShoppingCart /></el-icon>
          <span>订单管理</span>
        </el-menu-item>
        <el-menu-item index="/commissions">
          <el-icon><Wallet /></el-icon>
          <span>佣金管理</span>
        </el-menu-item>
        <el-menu-item index="/profile">
          <el-icon><User /></el-icon>
          <span>店铺信息</span>
        </el-menu-item>
      </el-menu>
      <div class="logout-btn">
        <el-button type="text" @click="logout">退出登录</el-button>
      </div>
    </div>
    <div class="main">
      <div class="header">
        <span class="header-title">{{ pageTitle }}</span>
        <div class="header-right">
          <el-dropdown>
            <span class="user-info">
              <el-icon><User /></el-icon>
              <span>{{ channel?.phone }}</span>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="logout">退出</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
      <div class="content">
        <router-view />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { HomeFilled, Search, Goods, ShoppingCart, Wallet, User } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()

const channel = computed(() => {
  const saved = localStorage.getItem('channel')
  return saved ? JSON.parse(saved) : null
})

const activeMenu = computed(() => route.path)

const pageTitle = computed(() => {
  const titles = {
    '/': '数据看板',
    '/product-pool': '选品中心',
    '/products': '商品管理',
    '/orders': '订单管理',
    '/commissions': '佣金管理',
    '/profile': '店铺信息'
  }
  return titles[route.path] || '渠道商管理'
})

onMounted(() => {
  if (!channel.value) {
    router.push('/login')
  }
})

const logout = () => {
  localStorage.removeItem('channel')
  router.push('/login')
}
</script>

<style scoped>
.layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 220px;
  background: linear-gradient(180deg, #f093fb 0%, #f5576c 100%);
  display: flex;
  flex-direction: column;
}

.logo {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: #fff;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.logo-icon {
  font-size: 24px;
  margin-right: 10px;
}

.logo-text {
  font-size: 16px;
  font-weight: bold;
}

.sidebar-menu {
  flex: 1;
  border-right: none;
}

.sidebar-menu :deep(.el-menu-item) {
  color: rgba(255,255,255,0.8);
}

.sidebar-menu :deep(.el-menu-item.is-active) {
  color: #fff;
  background: rgba(255,255,255,0.1);
}

.logout-btn {
  padding: 20px;
  border-top: 1px solid rgba(255,255,255,0.1);
}

.logout-btn :deep(.el-button--text) {
  color: rgba(255,255,255,0.8);
}

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background: #fff;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.header-title {
  font-size: 18px;
  font-weight: bold;
  color: #333;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #666;
  cursor: pointer;
}

.content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}
</style>