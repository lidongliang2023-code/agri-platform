<template>
  <div class="app-shell" :class="{ 'sidebar-collapsed': collapsed }">
    <aside class="app-sidebar" :class="{ 'mobile-open': mobileOpen }">
      <button class="app-brand" type="button" @click="go('home')">
        <img class="app-brand-mark" :src="`${baseUrl}fengchain.svg`" alt="丰链云" />
        <span v-if="showSidebarCopy" class="app-brand-copy">
          <b>丰链云</b>
          <small>FENGCHAIN · AGRI</small>
        </span>
      </button>
      <div class="sidebar-groups">
        <section v-for="group in MENU" :key="group.title" class="sidebar-group">
          <button
            v-for="item in group.items"
            :key="item.key"
            type="button"
            :class="{ on: highlight === item.key }"
            :title="collapsed ? item.label : undefined"
            @click="go(item.key)"
          >
            <span class="sidebar-icon"><component :is="item.icon" /></span>
            <span v-if="showSidebarCopy">{{ item.label }}</span>
            <i v-if="showSidebarCopy && item.key === 'messages' && unread > 0">{{ unread }}</i>
          </button>
        </section>
      </div>
      <SidebarUserCard
        :name="displayName"
        role="综合服务用户"
        :collapsed="!showSidebarCopy"
        switch-label="切换身份（服务商移动端）"
        :switch-url="mobileSwitchUrl"
        @logout="handleLogout"
      />
    </aside>

    <button v-if="mobileOpen" type="button" class="mobile-overlay" aria-label="关闭菜单" @click="mobileOpen = false" />

    <div class="app-main">
      <AgriVueTopHeader
        header-class="app-header"
        left-class="header-left"
        right-class="header-right"
        :collapsed="collapsed"
        :mobile="isMobile"
        :mobile-open="mobileOpen"
        :breadcrumbs="breadcrumbs"
        @toggle-collapse="toggleCollapse"
      >
        <template #center>
          <form class="global-search" @submit.prevent="submitSearch">
            <SearchOutlined />
            <input
              v-model="keyword"
              placeholder="搜索农机、农技、检测或服务商"
              aria-label="搜索服务"
            />
            <kbd>搜索</kbd>
          </form>
        </template>
        <template #right>
          <button type="button" class="header-link" @click="go('join')">我是服务商</button>
          <button type="button" class="header-icon" aria-label="消息中心" @click="go('messages')">
            <a-badge :count="unread" size="small"><BellOutlined /></a-badge>
          </button>
          <a-dropdown placement="bottomRight">
            <button type="button" class="user-chip">
              <a-avatar :size="32" class="user-avatar">
                <template #icon><UserOutlined /></template>
                {{ displayName.slice(0, 1) }}
              </a-avatar>
              <span><b>{{ displayName }}</b><small>{{ subjectName ? `经营主体：${subjectName}` : '未解析到经营主体' }}</small></span>
            </button>
            <template #overlay>
              <a-menu @click="handleUserMenu">
                <a-menu-item key="orders">我的服务订单</a-menu-item>
                <a-menu-item key="messages">消息与通知</a-menu-item>
                <a-menu-item key="join">服务商入驻</a-menu-item>
                <a-menu-item key="logout">退出统一登录</a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </template>
      </AgriVueTopHeader>

      <AgriVueWorkspaceTabs
        :active-key="activeTabKey"
        :active-label="activeTabLabel"
        :active-path="activeTabPath"
        home-key="home"
        :home-label="TITLES.home"
        storage-key="agri-service:workspace-tabs"
        @navigate="(path) => app.navigatePath(path)"
      />

      <main class="app-content"><slot /></main>
      <footer class="app-footer">© 2026 农业产业互联网平台 · 丰链云综合服务</footer>
    </div>

    <nav class="mobile-tabbar">
      <button
        v-for="item in primaryMobileItems"
        :key="item.key"
        type="button"
        :class="{ on: app.page === item.key }"
        @click="go(item.key)"
      >
        <component :is="item.icon" />
        <span>{{ item.label.replace('服务', item.key === 'home' ? '首页' : '') }}</span>
        <i v-if="item.key === 'messages' && unread > 0">{{ unread }}</i>
      </button>
      <button type="button" @click="mobileOpen = true">
        <FileTextOutlined />
        <span>更多</span>
      </button>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, type Component } from 'vue'
import {
  BellOutlined,
  BookOutlined,
  CalendarOutlined,
  CompassOutlined,
  CustomerServiceOutlined,
  FileProtectOutlined,
  FileTextOutlined,
  HomeOutlined,
  InsuranceOutlined,
  MessageOutlined,
  ProfileOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  ShopOutlined,
  SolutionOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons-vue'
import { AgriVueTopHeader, AgriVueWorkspaceTabs } from '@agri/shared/vue/workspace'
import { useAppStore } from '../app-context'
import type { PageKey } from '../types'
import { serviceApi } from '../api'
import { logoutUnified, serviceSession } from '../sso'
import SidebarUserCard from './SidebarUserCard.vue'

type MenuItem = { key: PageKey; label: string; icon: Component }
type MenuGroup = { title: string; items: MenuItem[] }

const MENU: MenuGroup[] = [
  {
    title: '服务概览',
    items: [{ key: 'home', label: '服务首页', icon: HomeOutlined }],
  },
  {
    title: '服务交易',
    items: [
      { key: 'services', label: '服务超市', icon: ShopOutlined },
      { key: 'orders', label: '我的订单', icon: ProfileOutlined },
      { key: 'contracts', label: '服务合同', icon: FileProtectOutlined },
      { key: 'complaints', label: '售后与投诉', icon: CustomerServiceOutlined },
    ],
  },
  {
    title: '生产保障',
    items: [
      { key: 'insurance', label: '农险服务', icon: InsuranceOutlined },
      { key: 'consult', label: '农技问诊', icon: TeamOutlined },
      { key: 'ai-diagnose', label: '农事问题初判', icon: RobotOutlined },
      { key: 'training', label: '培训课堂', icon: BookOutlined },
    ],
  },
  {
    title: '产业资源',
    items: [
      { key: 'demand', label: '需求大厅', icon: CalendarOutlined },
      { key: 'resources', label: '土地·用工·法律', icon: CompassOutlined },
      { key: 'policies', label: '惠农政策', icon: SafetyCertificateOutlined },
    ],
  },
  {
    title: '我的服务',
    items: [
      { key: 'messages', label: '消息中心', icon: MessageOutlined },
      { key: 'join', label: '服务商入驻', icon: SolutionOutlined },
    ],
  },
]

const TITLES: Record<PageKey, string> = {
  home: '服务首页',
  services: '服务超市',
  provider: '服务商详情',
  orders: '我的订单',
  'order-detail': '订单详情',
  demand: '需求大厅',
  insurance: '农险服务',
  policies: '惠农政策',
  training: '培训课堂',
  consult: '农技问诊',
  'ai-diagnose': '农事问题初判',
  resources: '产业资源',
  messages: '消息中心',
  join: '服务商入驻',
  contracts: '服务合同',
  complaints: '售后与投诉',
}

const PRIMARY_MOBILE: PageKey[] = ['home', 'services', 'orders', 'messages']
const allMenuItems = MENU.flatMap((group) => group.items)
const primaryMobileItems = PRIMARY_MOBILE.map((key) => allMenuItems.find((entry) => entry.key === key)).filter((x): x is MenuItem => Boolean(x))

const app = useAppStore()
const baseUrl = import.meta.env.BASE_URL
const mobileSwitchUrl = `${window.location.protocol}//${window.location.hostname}:8106/`

const collapsed = ref(window.innerWidth >= 1024 && window.innerWidth < 1280)
const isMobile = ref(window.innerWidth < 1024)
const mobileOpen = ref(false)
const keyword = ref('')
const unread = ref(0)
const subjectName = ref('')

const PARENT_OF: Partial<Record<PageKey, PageKey>> = {
  'order-detail': 'orders',
  provider: 'services',
}

const showSidebarCopy = computed(() => !collapsed.value || mobileOpen.value)
const highlight = computed(() => PARENT_OF[app.page] ?? app.page)
const activeLabel = computed(() => TITLES[app.page])
const breadcrumbs = computed(() => {
  const parentKey = PARENT_OF[app.page]
  if (parentKey) {
    const tail = app.id !== undefined ? `${activeLabel.value} · ${app.id}` : activeLabel.value
    return ['综合服务', TITLES[parentKey], tail]
  }
  return ['综合服务', activeLabel.value]
})
const displayName = computed(() => serviceSession.user?.nickname || serviceSession.user?.username || '平台用户')
const activeTabKey = computed(() => (app.id === undefined ? app.page : `${app.page}/${app.id}`))
const activeTabLabel = computed(() => (app.id === undefined ? activeLabel.value : `${activeLabel.value} · ${app.id}`))
const activeTabPath = computed(() => app.hash.replace(/^#\/?/, '') || 'home')

function syncLayout() {
  const w = window.innerWidth
  isMobile.value = w < 1024
  if (w >= 1024 && w < 1280) collapsed.value = true
  else if (w >= 1280) collapsed.value = false
  if (w >= 1024) mobileOpen.value = false
}

function loadHeaderMeta() {
  serviceApi.messages()
    .then((items) => { unread.value = items.filter((item) => !item.read).length })
    .catch(() => undefined)
  serviceApi.identity()
    .then((identity) => { subjectName.value = identity.merchantName })
    .catch(() => { subjectName.value = '' })
}

watch(() => app.page, () => {
  mobileOpen.value = false
  loadHeaderMeta()
}, { immediate: true })

onMounted(() => {
  window.addEventListener('resize', syncLayout)
})
onUnmounted(() => {
  window.removeEventListener('resize', syncLayout)
})

function go(key: PageKey) {
  app.navigate(key)
}

function toggleCollapse() {
  if (isMobile.value) mobileOpen.value = !mobileOpen.value
  else collapsed.value = !collapsed.value
}

function submitSearch() {
  app.openServices(keyword.value.trim())
}

function handleLogout() {
  void logoutUnified('service')
}

function handleUserMenu({ key }: { key: string | number }) {
  if (key === 'orders') go('orders')
  else if (key === 'messages') go('messages')
  else if (key === 'join') go('join')
  else if (key === 'logout') handleLogout()
}
</script>
