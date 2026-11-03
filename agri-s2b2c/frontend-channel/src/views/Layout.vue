<template>
  <div class="layout s2b2c-layout">
    <div v-if="mobileOpen" class="sidebar-overlay" @click="mobileOpen = false" />
    <aside class="sidebar" :class="{ 'is-open': mobileOpen }">
      <div class="brand">
        <span class="brand-mark">丰</span>
        <span class="brand-copy"><b>丰链云</b><small>渠道商工作台</small></span>
      </div>
      <div class="workspace-badge"><i /> 渠道增长与分润</div>
      <el-menu :default-active="activeMenu" router class="sidebar-menu" :default-openeds="openedGroups" @select="mobileOpen = false">
        <el-menu-item index="/">
          <el-icon><HomeFilled /></el-icon>
          <span>经营看板</span>
        </el-menu-item>

        <el-sub-menu index="goods">
          <template #title><el-icon><Goods /></el-icon><span>选品与商品</span></template>
          <el-menu-item index="/product-pool">平台商品池</el-menu-item>
          <el-menu-item index="/products">我的货架</el-menu-item>
          <el-menu-item index="/gap/ai-selection">AI 智能选品</el-menu-item>
          <el-menu-item index="/gap/one-click-publish">一键铺货到店</el-menu-item>
          <el-menu-item index="/listing">商品编辑</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="trade">
          <template #title><el-icon><ShoppingCart /></el-icon><span>订单与履约</span></template>
          <el-menu-item index="/orders">订单列表</el-menu-item>
          <el-menu-item index="/fulfillment">履约与云仓代发</el-menu-item>
          <el-menu-item index="/after-sales">售后管理</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="crm">
          <template #title><el-icon><User /></el-icon><span>客户与社群</span></template>
          <el-menu-item index="/customers">客户列表</el-menu-item>
          <el-menu-item index="/customer-ops">客户运营与社群</el-menu-item>
          <el-menu-item index="/reviews">评价管理</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="fund">
          <template #title><el-icon><Wallet /></el-icon><span>资金结算</span></template>
          <el-menu-item index="/commissions">佣金中心</el-menu-item>
          <el-menu-item index="/wallet">账户与提现</el-menu-item>
          <el-menu-item index="/reconcile">分润与对账单</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="data">
          <template #title><el-icon><TrendCharts /></el-icon><span>数据中心</span></template>
          <el-menu-item index="/analytics">经营数据分析</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="marketing">
          <template #title><el-icon><Promotion /></el-icon><span>营销中心</span></template>
          <el-menu-item index="/marketing">营销工作台</el-menu-item>
          <el-menu-item index="/marketing/coupons">优惠券管理</el-menu-item>
          <el-menu-item index="/marketing/groups">拼团活动</el-menu-item>
          <el-menu-item index="/marketing/flash">秒杀活动</el-menu-item>
          <el-menu-item index="/gap/distribution">分销裂变团队</el-menu-item>
          <el-menu-item index="/marketing/share">分享推广素材</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="supply">
          <template #title><el-icon><Box /></el-icon><span>采购与库存</span></template>
          <el-menu-item index="/purchase">集采采购补货</el-menu-item>
          <el-menu-item index="/inventory">库存管理</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="ai">
          <template #title><el-icon><MagicStick /></el-icon><span>AI 能力</span></template>
          <el-menu-item index="/gap/ai-studio">AI 营销与客服台</el-menu-item>
        </el-sub-menu>

        <el-menu-item index="/settings">
          <el-icon><Setting /></el-icon>
          <span>店铺与资质</span>
        </el-menu-item>
        <el-menu-item index="/notice-settings">通知设置</el-menu-item>
        <el-menu-item index="/boundary">
          <el-icon><Compass /></el-icon>
          <span>模块边界与协同</span>
        </el-menu-item>
      </el-menu>
      <div class="sidebar-footer">
        <div class="sidebar-role"><span>当前角色</span><b>渠道商</b></div>
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
          <div class="page-context"><small>S2B2C / CHANNEL</small><strong class="header-title">{{ pageTitle }}</strong></div>
        </div>
        <div class="header-right">
          <el-popover v-if="channelApproved" placement="bottom-end" :width="360" trigger="click" @show="loadNotices">
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
          <span class="header-health"><i /> 分润链路正常</span>
          <el-dropdown>
            <span class="user-info">
              <span class="user-avatar">{{ userInitial }}</span>
              <span class="user-label"><small>统一账号 · 渠道商</small><b>{{ userDisplayName }}</b></span>
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
        <div v-if="!profileReady" class="profile-state">正在读取渠道档案…</div>
        <router-view v-else-if="channelApproved || (route.path === '/apply' && canApply)" />
        <div v-else class="profile-state">
          <el-empty :description="onboardingTitle">
            <el-button v-if="canApply" type="primary" @click="router.push('/apply')">
              {{ profile.applied ? '重新提交申请' : '提交入驻申请' }}
            </el-button>
            <el-button v-else @click="loadProfile">刷新审核状态</el-button>
          </el-empty>
          <p class="profile-hint">{{ onboardingHint }}</p>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  HomeFilled, Goods, ShoppingCart, User, Wallet, TrendCharts, Promotion, Box,
  MagicStick, Setting, Compass, Bell, Menu, SwitchButton, ArrowDown,
} from '@element-plus/icons-vue'
import { logoutUnified, unifiedSession } from '../../../frontend-shared/unified-auth'
import { channelApi } from '../api'

const route = useRoute()
const router = useRouter()
const unread = ref(0)
const notices = ref([])
const mobileOpen = ref(false)
const openedGroups = ['goods', 'trade', 'fund']
const profile = ref({})
const profileReady = ref(false)
const channelApproved = computed(() => profile.value?.applied === true
  && String(profile.value?.auditStatus || '').toUpperCase() === 'APPROVED')
const canApply = computed(() => profile.value?.applied !== true
  || String(profile.value?.auditStatus || '').toUpperCase() === 'REJECTED')
const onboardingTitle = computed(() => {
  if (!profile.value?.applied) return '当前账号还没有渠道商档案'
  if (String(profile.value?.auditStatus || '').toUpperCase() === 'REJECTED') return '渠道入驻申请未通过'
  return '渠道入驻申请审核中'
})
const onboardingHint = computed(() => {
  if (!profile.value?.applied) return '提交入驻申请并通过平台审核后，才能进入渠道工作台。'
  if (String(profile.value?.auditStatus || '').toUpperCase() === 'REJECTED') {
    return profile.value?.auditOpinion ? `审核意见：${profile.value.auditOpinion}` : '请根据平台意见调整后重新申请。'
  }
  return '平台审核通过后，工作台会自动开放选品、订单与佣金功能。'
})

const channel = computed(() => unifiedSession.user)
const userDisplayName = computed(() => channel.value?.nickname || channel.value?.username || '平台用户')

const activeMenu = computed(() => route.path)
const userInitial = computed(() => userDisplayName.value.slice(0, 1) || '渠')

const pageTitle = computed(() => {
  const titles = {
    '/': '经营看板',
    '/product-pool': '平台商品池',
    '/products': '我的货架',
    '/listing': '商品编辑',
    '/orders': '订单列表',
    '/fulfillment': '履约与云仓代发',
    '/after-sales': '售后管理',
    '/customers': '客户列表',
    '/customer-ops': '客户运营与社群',
    '/reviews': '评价管理',
    '/commissions': '佣金中心',
    '/wallet': '账户与提现',
    '/reconcile': '分润与对账单',
    '/inventory': '库存管理',
    '/purchase': '集采采购补货',
    '/marketing': '营销中心',
    '/marketing/coupons': '优惠券管理',
    '/marketing/flash': '秒杀活动',
    '/marketing/groups': '拼团活动',
    '/marketing/share': '分享推广素材',
    '/analytics': '经营数据分析',
    '/settings': '店铺与资质',
    '/notice-settings': '通知设置',
    '/boundary': '模块边界与协同说明',
    '/growth': '营销与售后',
    '/profile': '店铺信息',
    '/apply': '入驻申请'
  }
  if (route.path.startsWith('/orders/')) return '订单详情'
  if (route.path.startsWith('/customers/')) return '客户画像'
  if (route.path.startsWith('/gap/')) return '能力未接入'
  return titles[route.path] || '渠道商工作台'
})

async function loadUnread() {
  try {
    const res = await channelApi.getUnreadNoticeCount()
    unread.value = Number(res?.unread || 0)
  } catch {
    unread.value = 0
  }
}

async function loadProfile() {
  try {
    profile.value = (await channelApi.getProfile()) || {}
  } catch {
    profile.value = {}
  } finally {
    profileReady.value = true
  }
  if (channelApproved.value) await loadUnread()
}

async function loadNotices() {
  if (!channelApproved.value) return
  try {
    const res = await channelApi.getNotices({ page: 1, size: 8 })
    notices.value = res?.records || []
    unread.value = Number(res?.unread || 0)
  } catch {
    notices.value = []
  }
}

async function openNotice(item) {
  if (!item.readFlag) {
    await channelApi.markNoticeRead(item.id).catch(() => {})
    await loadUnread()
    item.readFlag = 1
  }
  if (item.refType === 'ORDER' && item.refId) {
    router.push(`/orders/${item.refId}`)
  }
}

async function readAll() {
  await channelApi.markAllNoticesRead().catch(() => {})
  unread.value = 0
  await loadNotices()
}

onMounted(loadProfile)

const logout = () => logoutUnified('mall-channel')

watch(() => route.fullPath, () => {
  mobileOpen.value = false
  if (!channelApproved.value) loadProfile()
})
</script>

<style scoped>
.layout {
  display: flex;
  min-height: 100vh;
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
