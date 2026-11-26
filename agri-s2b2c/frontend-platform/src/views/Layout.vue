<template>
  <div class="layout s2b2c-layout" :class="{ 'is-collapsed': sidebarCollapsed }">
    <div v-if="mobileOpen" class="sidebar-overlay" @click="mobileOpen = false" />
    <aside class="sidebar" :class="{ 'is-open': mobileOpen, 'is-compact': sidebarCollapsed }">
      <div class="brand">
        <img class="brand-mark" :src="brandLogoSrc" alt="丰链云" />
        <span class="brand-copy"><b>丰链云</b><small>FENGCHAIN · AGRI</small></span>
      </div>
      <div class="workspace-badge"><i /> 全域交易运营中</div>
      <el-menu
        :default-active="activeMenu"
        router
        unique-opened
        class="sidebar-menu"
        :collapse="sidebarCollapsed"
        :collapse-transition="false"
        :default-openeds="sidebarCollapsed ? [] : openedGroups"
        @select="mobileOpen = false"
      >
        <el-menu-item index="/" title="运营大盘">
          <el-icon><HomeFilled /></el-icon>
          <template #title>运营大盘</template>
        </el-menu-item>

        <el-sub-menu index="data" title="数据中心">
          <template #title><el-icon><TrendCharts /></el-icon><span>数据中心</span></template>
          <el-menu-item index="/reports">数据报表</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="supply" title="平台供货运营">
          <template #title><el-icon><Goods /></el-icon><span>平台供货运营</span></template>
          <el-menu-item index="/supply/products">货源商品维护</el-menu-item>
          <el-menu-item index="/supply/supply-pool">可投放货源</el-menu-item>
          <el-menu-item index="/supply/listing-config">投放与授权规则</el-menu-item>
          <el-menu-item index="/supply/distributors">渠道授权网络</el-menu-item>
          <el-menu-item index="/supply/recruit">渠道招募</el-menu-item>
          <el-menu-item index="/supply/orders">供货履约</el-menu-item>
          <el-menu-item index="/supply/todo">供货待办</el-menu-item>
          <el-menu-item index="/supply/revenue">供货收入与对账</el-menu-item>
          <el-menu-item index="/supply/analytics">货源动销分析</el-menu-item>
          <el-menu-item index="/supply/notice-settings">供货消息设置</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="goods" title="商品与供应链">
          <template #title><el-icon><Goods /></el-icon><span>商品与供应链</span></template>
          <el-menu-item index="/product-pool">总部选品池</el-menu-item>
          <el-menu-item index="/products">商品审核</el-menu-item>
          <el-menu-item index="/categories">类目与溯源模板</el-menu-item>
          <el-menu-item index="/suppliers">货源档案管理</el-menu-item>
          <el-menu-item index="/inventory">库存与云仓</el-menu-item>
          <el-menu-item index="/group-purchases">集采管理</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="channel" title="小 B 商家">
          <template #title><el-icon><UserFilled /></el-icon><span>小 B 商家</span></template>
          <el-menu-item index="/channel-onboard">入驻审核</el-menu-item>
          <el-menu-item index="/channel-partners">商家列表</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="trade" title="订单与履约">
          <template #title><el-icon><ShoppingCart /></el-icon><span>订单与履约</span></template>
          <el-menu-item index="/orders">订单监控</el-menu-item>
          <el-menu-item index="/after-sales">异常与售后</el-menu-item>
          <el-menu-item index="/fulfillment">履约调度</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="marketing" title="营销活动中心">
          <template #title><el-icon><Promotion /></el-icon><span>营销活动中心</span></template>
          <el-menu-item index="/activities">活动列表</el-menu-item>
          <el-menu-item index="/activity-create">创建活动</el-menu-item>
          <el-menu-item index="/activity-monitor">活动监控</el-menu-item>
          <el-menu-item index="/coupons">优惠券管理</el-menu-item>
          <el-menu-item index="/commission-rules">分销与佣金规则</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="fund" title="价格与结算">
          <template #title><el-icon><Money /></el-icon><span>价格与结算</span></template>
          <el-menu-item index="/price-center">价格与价盘</el-menu-item>
          <el-menu-item index="/settlement">分润结算</el-menu-item>
          <el-menu-item index="/withdrawals">提现审批</el-menu-item>
          <el-menu-item index="/commission-report">佣金明细报表</el-menu-item>
          <el-menu-item index="/supplier-statements">供货对账单</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="risk" title="风控合规">
          <template #title><el-icon><Warning /></el-icon><span>风控合规</span></template>
          <el-menu-item index="/risk-rules">风控规则</el-menu-item>
          <el-menu-item index="/risk-events">风控事件</el-menu-item>
          <el-menu-item index="/reviews">评价审核</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="ai" title="AI 能力">
          <template #title><el-icon><MagicStick /></el-icon><span>AI 能力</span></template>
          <el-menu-item index="/gap/ai-ops">AI 智能运营</el-menu-item>
        </el-sub-menu>

        <el-menu-item index="/boundary" title="模块边界与协同">
          <el-icon><Compass /></el-icon>
          <template #title>模块边界与协同</template>
        </el-menu-item>
      </el-menu>
      <div class="sidebar-footer pc-side-user">
        <el-dropdown trigger="click" :placement="sidebarCollapsed ? 'right-end' : 'top-start'" popper-class="s2-side-user-popper">
          <button type="button" class="pc-side-user-trigger" :title="`${userDisplayName} · 平台运营`">
            <span class="pc-side-user-avatar">{{ userInitial }}</span>
            <template v-if="!sidebarCollapsed">
              <span class="pc-side-user-meta"><strong>{{ userDisplayName }}</strong><small>平台运营</small></span>
              <span class="pc-side-user-caret"><el-icon><ArrowUp /></el-icon></span>
            </template>
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="openPersonalCenter">个人中心</el-dropdown-item>
              <el-dropdown-item @click="switchToChannel">切换身份（商家工作台）</el-dropdown-item>
              <el-dropdown-item divided @click="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </aside>
    <main class="main">
      <AgriVueTopHeader
        header-class="header"
        left-class="header-left"
        right-class="header-right"
        :collapsed="collapsed"
        :mobile="isMobile"
        :mobile-open="mobileOpen"
        :breadcrumbs="['S2B2C 平台运营', pageTitle]"
        @toggle-collapse="toggleSidebar"
      >
        <template #right>
          <span class="header-health"><i /> 平台服务正常</span>
          <el-dropdown>
            <span class="user-info">
              <span class="user-avatar">{{ userInitial }}</span>
              <span class="user-label"><small>统一账号 · 平台运营</small><b>{{ userDisplayName }}</b></span>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="logout">退出</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
      </AgriVueTopHeader>
      <AgriVueWorkspaceTabs
        :active-key="route.fullPath"
        :active-path="route.fullPath"
        :active-label="pageTitle"
        home-key="/"
        home-label="运营大盘"
        storage-key="agri-s2b2c-platform:workspace-tabs"
        @navigate="(path) => $router.push(path)"
      />
      <div class="content">
        <router-view />
      </div>
    </main>
  </div>
</template>

<script setup>
const brandLogoSrc = `${import.meta.env.BASE_URL}fengchain.svg`
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  HomeFilled, UserFilled, Goods, ShoppingCart, Promotion, Money, Warning, TrendCharts,
  MagicStick, Compass, ArrowDown, ArrowUp,
} from '@element-plus/icons-vue'
import { AgriVueTopHeader, AgriVueWorkspaceTabs } from '@agri/shared/vue/workspace'
import { logoutUnified, unifiedSession } from '../../../frontend-shared/unified-auth'

const route = useRoute()
const mobileOpen = ref(false)
const collapsed = ref(typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px) and (max-width: 1279px)').matches)
const isMobile = ref(typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches)
const sidebarCollapsed = computed(() => collapsed.value && !isMobile.value)
const openedGroups = ['data', 'goods', 'channel', 'trade', 'fund']

function toggleSidebar() {
  if (isMobile.value) mobileOpen.value = !mobileOpen.value
  else collapsed.value = !collapsed.value
}

let compactMedia = null
let mobileMedia = null
function syncViewport() {
  if (!compactMedia || !mobileMedia) return
  isMobile.value = mobileMedia.matches
  if (!mobileMedia.matches) {
    mobileOpen.value = false
    collapsed.value = compactMedia.matches
  }
}

onMounted(() => {
  compactMedia = window.matchMedia('(min-width: 1024px) and (max-width: 1279px)')
  mobileMedia = window.matchMedia('(max-width: 1023px)')
  syncViewport()
  compactMedia.addEventListener('change', syncViewport)
  mobileMedia.addEventListener('change', syncViewport)
})

onBeforeUnmount(() => {
  compactMedia?.removeEventListener('change', syncViewport)
  mobileMedia?.removeEventListener('change', syncViewport)
})

const admin = computed(() => unifiedSession.user)
const userDisplayName = computed(() => admin.value?.nickname || admin.value?.username || '平台运营')

const activeMenu = computed(() => route.path)
const userInitial = computed(() => userDisplayName.value.slice(0, 1) || '运')

const pageTitle = computed(() => {
  const titles = {
    '/': '运营大盘',
    '/suppliers': '货源档案管理',
    '/channel-partners': '商家列表',
    '/channel-onboard': '入驻审核',
    '/products': '商品审核',
    '/product-pool': '总部选品池',
    '/categories': '类目与溯源模板',
    '/orders': '订单监控',
    '/after-sales': '异常与售后',
    '/fulfillment': '履约调度',
    '/activities': '活动列表',
    '/activity-create': '创建营销活动',
    '/activity-monitor': '活动监控',
    '/coupons': '优惠券管理',
    '/commission-rules': '分销与佣金规则',
    '/inventory': '库存与云仓',
    '/price-center': '价格与价盘',
    '/settlement': '分润结算',
    '/withdrawals': '提现审批',
    '/commission-report': '佣金明细报表',
    '/supplier-statements': '供货对账单',
    '/reports': '数据报表中心',
    '/group-purchases': '集采管理',
    '/risk-rules': '风控规则',
    '/risk-events': '风控事件',
    '/reviews': '评价审核',
    '/boundary': '模块边界与协同说明',
    '/growth': '增长与风控',
  }
  const supplyTitles = {
    '/supply/products': '货源商品维护',
    '/supply/product-add': '新增供货商品',
    '/supply/supply-pool': '可投放货源',
    '/supply/listing-config': '投放与授权规则',
    '/supply/distributors': '渠道授权网络',
    '/supply/recruit': '渠道招募',
    '/supply/orders': '供货履约',
    '/supply/todo': '供货待办',
    '/supply/revenue': '供货收入与对账',
    '/supply/analytics': '货源动销分析',
    '/supply/notice-settings': '供货消息设置',
  }
  if (supplyTitles[route.path]) return supplyTitles[route.path]
  if (route.path.startsWith('/supply/product-edit/')) return `编辑供货商品 · ${route.params.id ?? ''}`.replace(/ · $/, '')
  if (route.path.startsWith('/supply/distributor-detail/')) return `渠道详情 · ${route.params.id ?? ''}`.replace(/ · $/, '')
  if (route.path.startsWith('/supply/order-detail/')) return `供货订单 · ${route.params.id ?? ''}`.replace(/ · $/, '')
  if (route.path.startsWith('/supply')) return '平台供货运营'
  if (route.name === 'SupplierDetail') return `货源档案详情 · ${route.params.id ?? ''}`.replace(/ · $/, '')
  if (route.name === 'ChannelPartnerDetail') return `商家详情 · ${route.params.id ?? ''}`.replace(/ · $/, '')
  if (route.name === 'ProductDetail') return `商品详情 · ${route.params.id ?? ''}`.replace(/ · $/, '')
  if (route.name === 'OrderDetail') return `订单详情 · ${route.params.id ?? ''}`.replace(/ · $/, '')
  if (route.path.startsWith('/gap/')) return '能力未接入'
  return titles[route.path] || '平台运营工作台'
})

const logout = () => logoutUnified('s2b2c-platform')
const openPersonalCenter = () => {
  window.open(`${window.location.protocol}//${window.location.hostname}:8098/portal/#/account/business`, '_blank', 'noopener')
}
const switchToChannel = () => {
  window.location.href = `${window.location.protocol}//${window.location.hostname}:8085/`
}

watch(() => route.fullPath, () => {
  mobileOpen.value = false
})
</script>

<style scoped>
.layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 240px;
  background: #001529;
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
  font-weight: 600;
}

.sidebar-menu {
  flex: 1;
  border-right: none;
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
  font-weight: 600;
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
