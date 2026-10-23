<template>
  <div class="finance-shell ops-shell" :class="{ 'nav-open': navOpen }">
    <aside class="finance-sidebar">
      <router-link :to="homePath" class="finance-brand" @click="navOpen = false">
        <span class="finance-brand-mark">丰</span>
        <span><strong>丰链云</strong><small>FENGCHAIN · FINANCE</small></span>
      </router-link>

      <div class="finance-role">
        <span>{{ role === 'fund' ? '资金方端' : '运营风控端' }}</span>
        <small>{{ role === 'fund' ? '资金配置与投资工作台' : '融资审批与风险控制' }}</small>
      </div>

      <nav class="finance-nav">
        <span class="finance-nav-title">{{ role === 'fund' ? '资金业务' : '运营管理' }}</span>
        <router-link v-for="item in navigation.primary" :key="item.path" :to="item.path" @click="navOpen = false">
          <component :is="item.icon" /><span>{{ item.label }}</span>
        </router-link>
        <span class="finance-nav-title">{{ role === 'fund' ? '策略与数据' : '风险与资产' }}</span>
        <router-link v-for="item in navigation.secondary" :key="item.path" :to="item.path" @click="navOpen = false">
          <component :is="item.icon" /><span>{{ item.label }}</span>
          <i v-if="item.badge">{{ item.badge }}</i>
        </router-link>
      </nav>

      <div class="finance-sidebar-foot">
        <div>
          <span class="finance-avatar">{{ displayUser.name.slice(0, 1) }}</span>
          <div><strong>{{ displayUser.name }}</strong><small>{{ role === 'fund' ? '认证资金机构' : '平台运营账户' }}</small></div>
        </div>
        <router-link v-if="role === 'fund'" to="/admin/workbench" class="ops-role-link">运营端</router-link>
        <router-link v-else to="/fund/workbench" class="ops-role-link">资金方</router-link>
      </div>
    </aside>

    <div class="finance-workspace">
      <header class="finance-topbar">
        <div class="finance-topbar-left">
          <button class="finance-menu-button" type="button" aria-label="打开菜单" @click="navOpen = !navOpen"><Menu /></button>
          <div><small>供应链金融 / {{ role === 'fund' ? '资金方端' : '运营风控端' }}</small><strong>{{ route.meta.title || '工作台' }}</strong></div>
        </div>
        <div class="finance-topbar-right">
          <span class="ops-ai-badge">AI 风控增强</span>
          <button class="finance-icon-button" type="button" aria-label="消息通知" @click="$router.push(role === 'fund' ? '/fund/workbench' : '/admin/workbench')">
            <Bell /><i v-if="unreadCount">{{ unreadCount }}</i>
          </button>
          <span class="finance-topbar-divider" />
          <div class="finance-topbar-user">
            <span>{{ displayUser.name.slice(0, 1) }}</span>
            <div><strong>{{ displayUser.name }}</strong><small>{{ role === 'fund' ? '资金方账户' : '运营风控' }}</small></div>
          </div>
        </div>
      </header>
      <main class="finance-content"><router-view /></main>
    </div>
    <button v-if="navOpen" class="finance-nav-mask" type="button" aria-label="关闭菜单" @click="navOpen = false" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
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
  Menu,
  Money,
  Setting,
  Tickets,
  TrendCharts,
  Warning,
} from '@element-plus/icons-vue'
import { fundProvider, operationsApi, operationUser } from '@/api/operations'

const route = useRoute()
const navOpen = ref(false)
const unreadCount = ref(0)
const role = computed(() => route.path.startsWith('/fund') ? 'fund' : 'admin')
const homePath = computed(() => role.value === 'fund' ? '/fund/workbench' : '/admin/workbench')
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
  font-size: 8px;
  text-decoration: none;
}

.ops-ai-badge {
  padding: 4px 8px;
  border-radius: 99px;
  background: #edf8f2;
  color: var(--fin-green-700);
  font-size: 8px;
  font-weight: 700;
}

.finance-icon-button {
  border: 1px solid var(--fin-line);
  background: #fff;
}

@media (max-width: 880px) {
  .ops-ai-badge { display: none; }
}
</style>
