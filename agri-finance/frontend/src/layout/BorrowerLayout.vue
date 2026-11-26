<template>
  <div class="finance-shell" :class="{ 'is-collapsed': !isMobile && collapsed, 'nav-open': navOpen }">
    <aside class="finance-sidebar">
      <router-link to="/borrower/home" class="finance-brand" @click="navOpen = false">
        <img class="finance-brand-mark" :src="brandLogoSrc" alt="丰链云" />
        <span>
          <strong>丰链云</strong>
          <small>FENGCHAIN · AGRI</small>
        </span>
      </router-link>

      <nav class="finance-nav">
        <router-link v-for="item in primaryNav" :key="item.path" :to="item.path" :title="item.label" :aria-label="item.label" @click="navOpen = false">
          <component :is="item.icon" />
          <span>{{ item.label }}</span>
        </router-link>
        <router-link v-for="item in secondaryNav" :key="item.path" :to="item.path" :title="item.label" :aria-label="item.label" @click="navOpen = false">
          <component :is="item.icon" />
          <span>{{ item.label }}</span>
          <i v-if="item.badge && unreadCount > 0">{{ unreadCount }}</i>
        </router-link>
      </nav>

      <div class="finance-sidebar-foot pc-side-user">
        <button type="button" class="pc-side-user-trigger" :title="`${financeUser.name} · 认证融资主体`" :aria-expanded="userMenuOpen" aria-haspopup="menu" @click.stop="userMenuOpen = !userMenuOpen">
          <span class="pc-side-user-avatar">{{ financeUser.name.slice(0, 1) }}</span>
          <span class="pc-side-user-meta"><strong>{{ financeUser.name }}</strong><small>认证融资主体</small></span>
          <span class="pc-side-user-caret" aria-hidden="true">⌃</span>
        </button>
        <div v-if="userMenuOpen" class="pc-side-user-menu" role="menu">
          <a :href="personalCenter" target="_blank" rel="noreferrer" role="menuitem" @click="userMenuOpen = false">个人中心</a>
          <a href="http://localhost:8098/portal/" role="menuitem" @click="userMenuOpen = false">切换身份（官网门户）</a>
          <div class="pc-side-user-divider" />
          <button type="button" class="is-danger" role="menuitem" @click="logout">退出登录</button>
        </div>
      </div>
    </aside>

    <div class="finance-workspace">
      <AgriVueTopHeader
        header-class="finance-topbar"
        left-class="finance-topbar-left"
        right-class="finance-topbar-right"
        :collapsed="collapsed"
        :mobile="isMobile"
        :mobile-open="navOpen"
        :breadcrumbs="['供应链金融', '融资方', String(route.meta.title || '融资工作台')]"
        @toggle-collapse="toggleSidebar"
      >
        <template #right>
          <router-link to="/borrower/message" class="finance-icon-button" aria-label="消息通知">
            <Bell />
            <i v-if="unreadCount > 0">{{ unreadCount }}</i>
          </router-link>
          <span class="finance-topbar-divider" />
          <div class="finance-topbar-user">
            <span>{{ financeUser.name.slice(0, 1) }}</span>
            <div><strong>{{ financeUser.name }}</strong><small>融资方账户</small></div>
          </div>
        </template>
      </AgriVueTopHeader>
      <AgriVueWorkspaceTabs
        :active-key="route.fullPath"
        :active-path="route.fullPath"
        :active-label="String(route.meta.title || '融资工作台')"
        home-key="/borrower/home"
        home-label="融资工作台"
        storage-key="agri-finance-borrower:workspace-tabs"
        @navigate="(path) => $router.push(path)"
      />

      <main class="finance-content">
        <router-view />
      </main>
    </div>
    <button v-if="navOpen" class="finance-nav-mask" type="button" aria-label="关闭菜单" @click="navOpen = false" />
  </div>
</template>

<script setup>
const brandLogoSrc = `${import.meta.env.BASE_URL}fengchain.svg`
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  Bell,
  Box,
  CreditCard,
  Document,
  HomeFilled,
  Tickets,
  TrendCharts,
  Wallet,
} from '@element-plus/icons-vue'
import { AgriVueTopHeader, AgriVueWorkspaceTabs } from '@agri/shared/vue/workspace'
import { financeApi, financeUser } from '@/api/finance'
import { logoutFinance } from '@/auth'

const route = useRoute()
const navOpen = ref(false)
const isMobile = ref(typeof window !== 'undefined' && window.innerWidth < 1024)
const collapsed = ref(typeof window !== 'undefined' && window.innerWidth >= 1024 && window.innerWidth < 1280)
const toggleSidebar = () => {
  if (isMobile.value) navOpen.value = !navOpen.value
  else collapsed.value = !collapsed.value
}
const syncViewport = () => {
  const w = window.innerWidth
  isMobile.value = w < 1024
  if (w >= 1024) {
    navOpen.value = false
    collapsed.value = w < 1280
  }
}
const unreadCount = ref(0)
const logout = () => logoutFinance()
const userMenuOpen = ref(false)
const personalCenter = `${window.location.protocol}//${window.location.hostname}:8098/portal/#/account/business`
const closeUserMenu = (event) => {
  if (!(event.target instanceof Element) || !event.target.closest('.pc-side-user')) userMenuOpen.value = false
}
onMounted(() => {
  document.addEventListener('click', closeUserMenu)
  window.addEventListener('resize', syncViewport)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', closeUserMenu)
  window.removeEventListener('resize', syncViewport)
})

const primaryNav = [
  { path: '/borrower/home', label: '融资工作台', icon: HomeFilled },
  { path: '/borrower/products', label: '融资产品', icon: Tickets },
  { path: '/borrower/credit', label: '信用中心', icon: TrendCharts },
]

const secondaryNav = [
  { path: '/borrower/loan-management', label: '我的借款', icon: CreditCard },
  { path: '/borrower/repayment', label: '还款中心', icon: Wallet },
  { path: '/borrower/pledge', label: '仓单与质押', icon: Box },
  { path: '/borrower/contracts', label: '融资合同', icon: Document },
  { path: '/borrower/message', label: '消息通知', icon: Bell, badge: true },
]

async function refreshUnread() {
  try {
    const messages = await financeApi.messages()
    unreadCount.value = messages.filter((item) => !item.isRead).length
  } catch {
    unreadCount.value = 0
  }
}

onMounted(refreshUnread)
watch(() => route.fullPath, () => {
  navOpen.value = false
  refreshUnread()
})
</script>
