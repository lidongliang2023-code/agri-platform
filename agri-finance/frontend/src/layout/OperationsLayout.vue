<template>
  <div class="finance-shell ops-shell" :class="{ 'is-collapsed': !isMobile && collapsed, 'nav-open': navOpen }">
    <aside class="finance-sidebar">
      <router-link :to="homePath" class="finance-brand" @click="navOpen = false">
        <img class="finance-brand-mark" :src="brandLogoSrc" alt="丰链云" />
        <span><strong>丰链云</strong><small>FENGCHAIN · AGRI</small></span>
      </router-link>

      <nav class="finance-nav">
        <router-link v-for="item in navigation.primary" :key="item.path" :to="item.path" :title="item.label" :aria-label="item.label" @click="navOpen = false">
          <component :is="item.icon" /><span>{{ item.label }}</span>
        </router-link>
        <router-link v-for="item in navigation.secondary" :key="item.path" :to="item.path" :title="item.label" :aria-label="item.label" @click="navOpen = false">
          <component :is="item.icon" /><span>{{ item.label }}</span>
          <i v-if="item.badge">{{ item.badge }}</i>
        </router-link>
      </nav>

      <div class="finance-sidebar-foot pc-side-user">
        <button type="button" class="pc-side-user-trigger" :title="`${displayUser.name} · ${role === 'fund' ? '认证资金机构' : '平台运营账户'}`" :aria-expanded="userMenuOpen" aria-haspopup="menu" @click.stop="userMenuOpen = !userMenuOpen">
          <span class="pc-side-user-avatar">{{ displayUser.name.slice(0, 1) }}</span>
          <span class="pc-side-user-meta"><strong>{{ displayUser.name }}</strong><small>{{ role === 'fund' ? '认证资金机构' : '平台运营账户' }}</small></span>
          <span class="pc-side-user-caret" aria-hidden="true">⌃</span>
        </button>
        <div v-if="userMenuOpen" class="pc-side-user-menu" role="menu">
          <a :href="personalCenter" target="_blank" rel="noreferrer" role="menuitem" @click="userMenuOpen = false">个人中心</a>
          <router-link v-if="role === 'fund' && hasFinancePermission('finance:admin')" to="/admin/workbench" role="menuitem" @click="userMenuOpen = false">切换身份（运营端）</router-link>
          <router-link v-else-if="role === 'admin' && hasFinancePermission('finance:fund')" to="/fund/workbench" role="menuitem" @click="userMenuOpen = false">切换身份（资金方）</router-link>
          <a v-else href="http://localhost:8098/portal/" role="menuitem" @click="userMenuOpen = false">切换身份（官网门户）</a>
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
        :breadcrumbs="breadcrumbs"
        @toggle-collapse="toggleSidebar"
      >
        <template #right>
          <span class="ops-ai-badge">AI 风控增强</span>
          <button class="finance-icon-button" type="button" aria-label="消息通知" @click="$router.push(role === 'fund' ? '/fund/workbench' : '/admin/workbench')">
            <Bell /><i v-if="unreadCount">{{ unreadCount }}</i>
          </button>
          <span class="finance-topbar-divider" />
          <div class="finance-topbar-user">
            <span>{{ displayUser.name.slice(0, 1) }}</span>
            <div><strong>{{ displayUser.name }}</strong><small>{{ role === 'fund' ? '资金方账户' : '运营风控' }}</small></div>
          </div>
        </template>
      </AgriVueTopHeader>
      <AgriVueWorkspaceTabs
        :active-key="route.fullPath"
        :active-path="route.fullPath"
        :active-label="activeTabLabel"
        :home-key="homePath"
        :home-label="homeLabel"
        :storage-key="'agri-finance-' + role + ':workspace-tabs'"
        @navigate="(path) => $router.push(path)"
      />
      <main class="finance-content"><router-view /></main>
    </div>
    <button v-if="navOpen" class="finance-nav-mask" type="button" aria-label="关闭菜单" @click="navOpen = false" />
  </div>
</template>

<script setup>
const brandLogoSrc = `${import.meta.env.BASE_URL}fengchain.svg`
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  Bell,
  Box,
  Checked,
  CreditCard,
  DataAnalysis,
  Document,
  Files,
  Lock,
  Money,
  OfficeBuilding,
  Setting,
  Tickets,
  TrendCharts,
  Warning,
} from '@element-plus/icons-vue'
import { AgriVueTopHeader, AgriVueWorkspaceTabs } from '@agri/shared/vue/workspace'
import { fundProvider, operationsApi, operationUser } from '@/api/operations'
import { hasFinancePermission, logoutFinance } from '@/auth'

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
const role = computed(() => route.path.startsWith('/fund') ? 'fund' : 'admin')
const homePath = computed(() => role.value === 'fund' ? '/fund/workbench' : '/admin/workbench')
const homeLabel = computed(() => role.value === 'fund' ? '资金工作台' : '运营工作台')
const activeTabLabel = computed(() => {
  const base = String(route.meta.title || homeLabel.value)
  return route.params.assetId ? `${base} · ${route.params.assetId}` : base
})
const breadcrumbs = computed(() => {
  const roleLabel = role.value === 'fund' ? '资金方端' : '运营风控端'
  if (route.params.assetId) {
    return ['供应链金融', roleLabel, '资产市场', `资产详情 · ${route.params.assetId}`]
  }
  return ['供应链金融', roleLabel, String(route.meta.title || '工作台')]
})
const displayUser = computed(() => role.value === 'fund' ? fundProvider : operationUser)

const navigation = computed(() => role.value === 'fund' ? {
  primary: [
    { path: '/fund/workbench', label: '资金工作台', icon: DataAnalysis },
    { path: '/fund/asset-market', label: '资产市场', icon: Tickets },
    { path: '/fund/approval', label: '审批管理', icon: Checked },
    { path: '/fund/my-investment', label: '我的投资', icon: Money },
  ],
  secondary: [
    { path: '/fund/product-config', label: '产品配置', icon: Box },
    { path: '/fund/risk-center', label: '风控中台', icon: DataAnalysis },
    { path: '/fund/risk-strategy', label: '风控策略', icon: Lock },
    { path: '/fund/report', label: '数据报表', icon: TrendCharts },
  ],
} : {
  primary: [
    { path: '/admin/workbench', label: '运营工作台', icon: DataAnalysis },
    { path: '/admin/approval', label: '借款审批', icon: Checked, badge: 1 },
    { path: '/admin/overdue', label: '逾期管理', icon: Warning, badge: 2 },
    { path: '/admin/credit-management', label: '信用查询', icon: CreditCard },
  ],
  secondary: [
    { path: '/admin/pledge', label: '质押与仓单', icon: Box },
    { path: '/admin/pledge-goods', label: '质押物目录', icon: Tickets },
    { path: '/admin/fund-provider', label: '资金机构', icon: OfficeBuilding },
    { path: '/admin/blacklist', label: '黑名单', icon: Lock },
    { path: '/admin/risk', label: '风险规则', icon: Setting },
    { path: '/admin/report', label: '报表中心', icon: Files },
  ],
})

async function loadUnread() {
  try {
    const messages = await operationsApi.messages()
    unreadCount.value = messages.filter((item) => !item.isRead).length
  } catch {
    unreadCount.value = 0
  }
}

onMounted(loadUnread)
watch(() => route.fullPath, () => {
  navOpen.value = false
  loadUnread()
})
</script>

<style scoped>
.ops-role-link {
  flex: 0 0 auto;
  padding: 5px 7px;
  border: 1px solid rgba(255, 255, 255, .1);
  border-radius: 7px;
  color: rgba(255, 255, 255, .55);
  font-size: var(--fin-fs-xs);
  text-decoration: none;
}

.ops-account-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.ops-account-actions button {
  cursor: pointer;
  font: inherit;
}

.ops-ai-badge {
  padding: 4px 8px;
  border-radius: 99px;
  background: #edf8f2;
  color: var(--fin-green-700);
  font-size: var(--fin-fs-xs);
  font-weight: 600;
}

.finance-icon-button {
  border: 1px solid var(--fin-line);
  background: #fff;
}

@media (max-width: 880px) {
  .ops-ai-badge { display: none; }
}
</style>
