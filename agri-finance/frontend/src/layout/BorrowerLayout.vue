<template>
  <div class="finance-shell" :class="{ 'nav-open': navOpen }">
    <aside class="finance-sidebar">
      <router-link to="/borrower/home" class="finance-brand" @click="navOpen = false">
        <span class="finance-brand-mark">丰</span>
        <span>
          <strong>丰链云</strong>
          <small>FENGCHAIN · FINANCE</small>
        </span>
      </router-link>

      <div class="finance-role">
        <span>融资方</span>
        <small>供应链金融工作台</small>
      </div>

      <nav class="finance-nav">
        <span class="finance-nav-title">融资服务</span>
        <router-link v-for="item in primaryNav" :key="item.path" :to="item.path" @click="navOpen = false">
          <component :is="item.icon" />
          <span>{{ item.label }}</span>
        </router-link>

        <span class="finance-nav-title">资金与履约</span>
        <router-link v-for="item in secondaryNav" :key="item.path" :to="item.path" @click="navOpen = false">
          <component :is="item.icon" />
          <span>{{ item.label }}</span>
          <i v-if="item.badge && unreadCount > 0">{{ unreadCount }}</i>
        </router-link>
      </nav>

      <div class="finance-sidebar-foot">
        <div>
          <span class="finance-avatar">{{ financeUser.name.slice(0, 1) }}</span>
          <div><strong>{{ financeUser.name }}</strong><small>认证融资主体</small></div>
        </div>
        <a href="http://localhost:8098/portal/" title="返回官网门户">官网</a>
      </div>
    </aside>

    <div class="finance-workspace">
      <header class="finance-topbar">
        <div class="finance-topbar-left">
          <button class="finance-menu-button" type="button" aria-label="打开菜单" @click="navOpen = !navOpen">
            <Menu />
          </button>
          <div>
            <small>供应链金融 / 融资方</small>
            <strong>{{ route.meta.title || '融资工作台' }}</strong>
          </div>
        </div>
        <div class="finance-topbar-right">
          <router-link to="/borrower/message" class="finance-icon-button" aria-label="消息通知">
            <Bell />
            <i v-if="unreadCount > 0">{{ unreadCount }}</i>
          </router-link>
          <span class="finance-topbar-divider" />
          <div class="finance-topbar-user">
            <span>{{ financeUser.name.slice(0, 1) }}</span>
            <div><strong>{{ financeUser.name }}</strong><small>融资方账户</small></div>
          </div>
        </div>
      </header>

      <main class="finance-content">
        <router-view />
      </main>
    </div>
    <button v-if="navOpen" class="finance-nav-mask" type="button" aria-label="关闭菜单" @click="navOpen = false" />
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  Bell,
  Box,
  CreditCard,
  Document,
  HomeFilled,
  Menu,
  Tickets,
  TrendCharts,
  Wallet,
} from '@element-plus/icons-vue'
import { financeApi, financeUser } from '@/api/finance'

const route = useRoute()
const navOpen = ref(false)
const unreadCount = ref(0)

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
