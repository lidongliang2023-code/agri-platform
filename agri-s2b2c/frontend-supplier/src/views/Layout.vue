<template>
  <div v-if="!profileReady" class="profile-state">正在读取供应商档案…</div>
  <div v-else-if="!supplierApproved" class="onboarding-shell">
    <div class="onboarding-header">
      <div class="brand">
        <span class="brand-mark">丰</span>
        <span class="brand-copy"><b>丰链云</b><small>供应商入驻</small></span>
      </div>
      <div class="onboarding-user">
        <span>{{ userDisplayName }}</span>
        <el-button link @click="logout">退出登录</el-button>
      </div>
    </div>
    <div class="onboarding-content">
      <router-view />
    </div>
  </div>
  <div v-else class="layout s2b2c-layout">
    <div v-if="mobileOpen" class="sidebar-overlay" @click="mobileOpen = false" />
    <aside class="sidebar" :class="{ 'is-open': mobileOpen }">
      <div class="brand">
        <span class="brand-mark">丰</span>
        <span class="brand-copy"><b>丰链云</b><small>供应商工作台</small></span>
      </div>
      <div class="workspace-badge"><i /> 产地供应链协同</div>
      <el-menu :default-active="activeMenu" router class="sidebar-menu" :default-openeds="openedGroups" @select="mobileOpen = false">
        <el-menu-item index="/">
          <el-icon><HomeFilled /></el-icon>
          <span>分销总览</span>
        </el-menu-item>
        <el-menu-item index="/todo">
          <el-icon><Bell /></el-icon>
          <span>待办与预警</span>
        </el-menu-item>

        <el-sub-menu index="goods">
          <template #title><el-icon><Goods /></el-icon><span>货源与投放</span></template>
          <el-menu-item index="/supply-pool">可投放货源</el-menu-item>
          <el-menu-item index="/products">我的分销池</el-menu-item>
          <el-menu-item index="/listing-config">投放规则配置</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="channel">
          <template #title><el-icon><UserFilled /></el-icon><span>分销网络</span></template>
          <el-menu-item index="/distributors">分销商列表</el-menu-item>
          <el-menu-item index="/recruit">分销商招募</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="orders">
          <template #title><el-icon><ShoppingCart /></el-icon><span>分销订单</span></template>
          <el-menu-item index="/orders">分销订单列表</el-menu-item>
          <el-menu-item index="/after-sales">售后协同</el-menu-item>
          <el-menu-item index="/reviews">评价管理</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="fund">
          <template #title><el-icon><Money /></el-icon><span>分销资金</span></template>
          <el-menu-item index="/revenue">供货收入与对账</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="data">
          <template #title><el-icon><TrendCharts /></el-icon><span>数据洞察</span></template>
          <el-menu-item index="/analytics">分销动销分析</el-menu-item>
          <el-menu-item index="/distributors">渠道商画像</el-menu-item>
          <el-menu-item index="/gap/ai-advisor">AI 投放顾问</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="settings">
          <template #title><el-icon><Setting /></el-icon><span>供货设置</span></template>
          <el-menu-item index="/profile">供货主体与资质</el-menu-item>
          <el-menu-item index="/notice-settings">协同与通知设置</el-menu-item>
        </el-sub-menu>

        <el-menu-item index="/boundary">
          <el-icon><Compass /></el-icon>
          <span>模块边界与协同</span>
        </el-menu-item>
      </el-menu>
      <div class="sidebar-footer">
        <div class="sidebar-role"><span>当前角色</span><b>供应商</b></div>
        <div class="logout-btn">
          <el-button link @click="logout"><el-icon><SwitchButton /></el-icon> 退出登录</el-button>
        </div>
      </div>
    </aside>
    <main class="main">
      <div class="header">
        <div class="header-left">
          <el-button class="mobile-menu" text circle @click="mobileOpen = true">
            <el-icon><Menu /></el-icon>
          </el-button>
          <div class="page-context"><small>S2B2C / SUPPLIER</small><strong class="header-title">{{ pageTitle }}</strong></div>
        </div>
        <div class="header-right">
          <el-popover v-if="hasProfile" placement="bottom-end" :width="360" trigger="click" @show="loadNotices">
            <template #reference>
              <el-badge :value="unread" :hidden="!unread" class="notice-badge">
                <el-button text circle><el-icon><Bell /></el-icon></el-button>
              </el-badge>
            </template>
            <div class="notice-panel">
              <div class="notice-head"><b>通知</b><el-button link type="primary" @click="readAll">全部已读</el-button></div>
              <div v-if="!notices.length" class="notice-empty">暂无通知</div>
              <div v-for="item in notices" :key="item.id" class="notice-item" :class="{ unread: !item.readFlag }" @click="openNotice(item)">
                <div class="notice-title"><b>{{ item.title }}</b><span>{{ item.createTime }}</span></div>
                <p>{{ item.content }}</p>
              </div>
            </div>
          </el-popover>
          <span class="header-health"><i /> 业务运行正常</span>
          <el-dropdown>
            <span class="user-info">
              <span class="user-avatar">{{ userInitial }}</span>
              <span class="user-label"><small>统一账号 · 供应商</small><b>{{ userDisplayName }}</b></span>
              <el-icon><ArrowDown /></el-icon>
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
        <div v-if="profile.capabilityGranted === false" class="capability-banner">
          <b>供货能力未开通</b>
          <span>{{ profile.capabilityReason || '请先在用户中心完成批发商业务身份认证，通过后才能上架商品。' }}</span>
        </div>
        <router-view />
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  HomeFilled, Goods, ShoppingCart, UserFilled, Money, TrendCharts, Setting, Compass,
  Bell, Menu, SwitchButton, ArrowDown,
} from '@element-plus/icons-vue'
import { logoutUnified, unifiedSession } from '../../../frontend-shared/unified-auth'
import { supplierApi } from '../api'

const route = useRoute()
const router = useRouter()
const unread = ref(0)
const notices = ref([])
const mobileOpen = ref(false)
const openedGroups = ['goods', 'channel', 'orders', 'fund']
const profile = ref(null)
const profileReady = ref(false)
const hasProfile = computed(() => Boolean(profile.value?.applied))
const supplierApproved = computed(() => hasProfile.value
  && String(profile.value?.auditStatus || '').toUpperCase() === 'APPROVED')

const supplier = computed(() => unifiedSession.user)
const userDisplayName = computed(() => supplier.value?.nickname || supplier.value?.username || '平台用户')

const activeMenu = computed(() => route.path)
const userInitial = computed(() => userDisplayName.value.slice(0, 1) || '供')

const pageTitle = computed(() => {
  const titles = {
    '/': '数据看板',
    '/products': '商品管理',
    '/orders': '订单管理',
    '/reviews': '评价管理',
    '/profile': '店铺信息',
    '/audit-progress': '审核进度',
    '/apply': '入驻申请'
  }
  if (route.name === 'ProductAdd') return '发布商品'
  if (route.name === 'ProductEdit') return '编辑商品'
  if (route.name === 'OrderDetail') return '订单详情'
  return titles[route.path] || '供应商工作台'
})

async function loadUnread() {
  try {
    const res = await supplierApi.getUnreadNoticeCount()
    unread.value = Number(res?.unread || 0)
  } catch {
    unread.value = 0
  }
}

async function loadProfile() {
  try {
    profile.value = (await supplierApi.getProfile()) || { applied: false }
  } catch {
    profile.value = { applied: false }
  } finally {
    profileReady.value = true
  }
  if (hasProfile.value) await loadUnread()
}

async function loadNotices() {
  if (!hasProfile.value) return
  try {
    const res = await supplierApi.getNotices({ page: 1, size: 8 })
    notices.value = res?.records || []
    unread.value = Number(res?.unread || 0)
  } catch {
    notices.value = []
  }
}

async function openNotice(item) {
  if (!item.readFlag) {
    await supplierApi.markNoticeRead(item.id).catch(() => {})
    await loadUnread()
    item.readFlag = 1
  }
  if (item.refType === 'ORDER' && item.refId) {
    router.push(`/order-detail/${item.refId}`)
  }
}

async function readAll() {
  await supplierApi.markAllNoticesRead().catch(() => {})
  unread.value = 0
  await loadNotices()
}

onMounted(loadProfile)

const logout = () => logoutUnified('mall-supplier')

watch([profileReady, supplierApproved, () => route.path], () => {
  mobileOpen.value = false
  if (!profileReady.value) return
  const isOnboarding = ['/apply', '/audit-progress'].includes(route.path)
  if (!supplierApproved.value && !isOnboarding) {
    router.replace(hasProfile.value ? '/audit-progress' : '/apply')
    return
  }
  if (!supplierApproved.value && !profile.value?.applied) {
    loadProfile()
  }
})
</script>

<style scoped>
.layout {
  display: flex;
  min-height: 100vh;
}

.onboarding-shell {
  min-height: 100vh;
  background: linear-gradient(180deg, #073821 0%, #12764a 26%, #f5f7fa 26.1%, #f5f7fa 100%);
}

.onboarding-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 32px;
  color: #fff;
}

.onboarding-header .brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.onboarding-header .brand-mark {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
  font-weight: 800;
}

.onboarding-header .brand-copy b,
.onboarding-header .brand-copy small {
  display: block;
}

.onboarding-header .brand-copy b {
  font-size: 16px;
}

.onboarding-header .brand-copy small {
  color: rgba(255, 255, 255, 0.72);
  font-size: var(--agri-font-size-micro);
}

.onboarding-user {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
}

.onboarding-user :deep(.el-button) {
  color: rgba(255, 255, 255, 0.9);
}

.onboarding-content {
  max-width: 980px;
  margin: 0 auto;
  padding: 24px 20px 60px;
}

.capability-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  padding: 10px 14px;
  border: 1px solid #f2d8a8;
  border-radius: 10px;
  background: #fff9ec;
  color: #7c5a12;
  font-size: 12px;
}

.capability-banner b {
  color: #a46408;
  flex-shrink: 0;
}

.profile-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 24px;
  color: #84938a;
  font-size: 13px;
}

.profile-hint {
  margin: 10px 0 0;
  color: #94a198;
  font-size: 12px;
}

.sidebar {
  width: 220px;
  background: linear-gradient(180deg, #073821 0%, #12764a 100%);
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

.notice-badge { margin-right: 10px; }
.notice-panel { max-height: 420px; overflow-y: auto; }
.notice-head { display: flex; align-items: center; justify-content: space-between; padding-bottom: 8px; border-bottom: 1px solid #eef2ef; }
.notice-empty { padding: 24px 0; text-align: center; color: #94a198; font-size: 12px; }
.notice-item { padding: 10px 8px; border-bottom: 1px solid #f1f5f2; cursor: pointer; }
.notice-item:hover { background: #f7fbf8; }
.notice-item.unread { background: #f0faf4; }
.notice-title { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 13px; color: #173e2a; }
.notice-title span { color: #94a198; font-size: var(--agri-font-size-micro); white-space: nowrap; }
.notice-item p { margin: 4px 0 0; color: #6b7c72; font-size: 12px; line-height: 1.5; }
</style>
