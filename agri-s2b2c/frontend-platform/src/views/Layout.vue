<template>
  <div class="layout s2b2c-layout">
    <div v-if="mobileOpen" class="sidebar-overlay" @click="mobileOpen = false" />
    <aside class="sidebar" :class="{ 'is-open': mobileOpen }">
      <div class="brand">
        <span class="brand-mark">丰</span>
        <span class="brand-copy"><b>丰链云</b><small>平台运营工作台</small></span>
      </div>
      <div class="workspace-badge"><i /> 全域交易运营中</div>
      <el-menu :default-active="activeMenu" router unique-opened class="sidebar-menu" :default-openeds="openedGroups" @select="mobileOpen = false">
        <el-menu-item index="/">
          <el-icon><HomeFilled /></el-icon>
          <span>运营大盘</span>
        </el-menu-item>

        <el-sub-menu index="data">
          <template #title><el-icon><TrendCharts /></el-icon><span>数据中心</span></template>
          <el-menu-item index="/reports">数据报表</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="goods">
          <template #title><el-icon><Goods /></el-icon><span>商品与供应链</span></template>
          <el-menu-item index="/product-pool">总部选品池</el-menu-item>
          <el-menu-item index="/products">商品审核</el-menu-item>
          <el-menu-item index="/categories">类目与溯源模板</el-menu-item>
          <el-menu-item index="/suppliers">供应商管理</el-menu-item>
          <el-menu-item index="/inventory">库存与云仓</el-menu-item>
          <el-menu-item index="/group-purchases">集采管理</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="channel">
          <template #title><el-icon><UserFilled /></el-icon><span>小 B 渠道商</span></template>
          <el-menu-item index="/channel-onboard">入驻审核</el-menu-item>
          <el-menu-item index="/channel-partners">渠道商列表</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="trade">
          <template #title><el-icon><ShoppingCart /></el-icon><span>订单与履约</span></template>
          <el-menu-item index="/orders">订单监控</el-menu-item>
          <el-menu-item index="/after-sales">异常与售后</el-menu-item>
          <el-menu-item index="/fulfillment">履约调度</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="marketing">
          <template #title><el-icon><Promotion /></el-icon><span>营销活动中心</span></template>
          <el-menu-item index="/activities">活动列表</el-menu-item>
          <el-menu-item index="/activity-create">创建活动</el-menu-item>
          <el-menu-item index="/activity-monitor">活动监控</el-menu-item>
          <el-menu-item index="/coupons">优惠券管理</el-menu-item>
          <el-menu-item index="/commission-rules">分销与佣金规则</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="fund">
          <template #title><el-icon><Money /></el-icon><span>价格与结算</span></template>
          <el-menu-item index="/price-center">价格与价盘</el-menu-item>
          <el-menu-item index="/settlement">分润结算</el-menu-item>
          <el-menu-item index="/withdrawals">提现审批</el-menu-item>
          <el-menu-item index="/commission-report">佣金明细报表</el-menu-item>
          <el-menu-item index="/supplier-statements">供应商对账单</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="risk">
          <template #title><el-icon><Warning /></el-icon><span>风控合规</span></template>
          <el-menu-item index="/risk-rules">风控规则</el-menu-item>
          <el-menu-item index="/risk-events">风控事件</el-menu-item>
          <el-menu-item index="/reviews">评价审核</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="ai">
          <template #title><el-icon><MagicStick /></el-icon><span>AI 能力</span></template>
          <el-menu-item index="/gap/ai-ops">AI 智能运营</el-menu-item>
        </el-sub-menu>

        <el-menu-item index="/boundary">
          <el-icon><Compass /></el-icon>
          <span>模块边界与协同</span>
        </el-menu-item>
      </el-menu>
      <div class="sidebar-footer">
        <div class="sidebar-role"><span>当前角色</span><b>平台运营</b></div>
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
          <div class="page-context"><small>S2B2C / OPERATIONS</small><strong class="header-title">{{ pageTitle }}</strong></div>
        </div>
        <div class="header-right">
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
        </div>
      </div>
      <div class="content">
        <router-view />
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  HomeFilled, UserFilled, Goods, ShoppingCart, Promotion, Money, Warning, TrendCharts,
  MagicStick, Compass, Menu, SwitchButton, ArrowDown,
} from '@element-plus/icons-vue'
import { logoutUnified, unifiedSession } from '../../../frontend-shared/unified-auth'

const route = useRoute()
const mobileOpen = ref(false)
const openedGroups = ['data', 'goods', 'channel', 'trade', 'fund']

const admin = computed(() => unifiedSession.user)
const userDisplayName = computed(() => admin.value?.nickname || admin.value?.username || '平台运营')

const activeMenu = computed(() => route.path)
const userInitial = computed(() => userDisplayName.value.slice(0, 1) || '运')

const pageTitle = computed(() => {
  const titles = {
    '/': '运营大盘',
    '/suppliers': '供应商管理',
    '/channel-partners': '渠道商列表',
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
    '/supplier-statements': '供应商对账单',
    '/reports': '数据报表中心',
    '/group-purchases': '集采管理',
    '/risk-rules': '风控规则',
    '/risk-events': '风控事件',
    '/reviews': '评价审核',
    '/boundary': '模块边界与协同说明',
    '/growth': '增长与风控',
  }
  if (route.name === 'SupplierDetail') return '供应商详情'
  if (route.name === 'ChannelPartnerDetail') return '渠道商详情'
  if (route.name === 'ProductDetail') return '商品详情'
  if (route.path.startsWith('/gap/')) return '能力未接入'
  return titles[route.path] || '平台运营工作台'
})

const logout = () => logoutUnified('s2b2c-platform')

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

.sidebar-menu :deep(.el-menu-item),
.sidebar-menu :deep(.el-sub-menu__title) {
  color: rgba(255,255,255,0.8);
}

.sidebar-menu :deep(.el-menu-item.is-active),
.sidebar-menu :deep(.el-sub-menu__title.is-active) {
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
