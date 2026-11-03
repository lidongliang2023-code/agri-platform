<template>
  <div class="m-container" v-loading="loading">
    <!-- 页头 -->
    <div class="m-page-hd">
      <h1>个人中心</h1>
      <span class="sub">订单、资产与账户功能集中在这里；数字全部来自消费者域接口，取不到时显示「—」而不是 0</span>
      <div class="hd-actions">
        <button type="button" class="m-btn sm" @click="load">刷新</button>
      </div>
    </div>

    <!-- 未登录 / 未换回消费者档案 -->
    <EmptyBlock
      v-if="userStore.booted && !consumerId"
      icon="🔐"
      title="登录后使用个人中心"
      desc="订单、收藏、地址都挂在商城消费者账号下。当前浏览器没有检测到已登录的统一身份，请从统一门户登录后再进入商城。"
    >
      <template #actions>
        <button type="button" class="m-btn primary" @click="router.push('/')">返回首页</button>
      </template>
    </EmptyBlock>

    <template v-else>
      <!-- 身份卡 -->
      <section class="m-card head-card">
        <span class="avatar">{{ (userStore.displayName || '客').slice(0, 1) }}</span>
        <div class="head-info">
          <b>{{ userStore.displayName }}</b>
          <div class="m-row-wrap">
            <span class="m-tag">{{ memberLevelText(userStore.user?.memberLevel) }}</span>
            <span class="muted small num">{{ maskedPhone }}</span>
          </div>
        </div>
        <button type="button" class="m-btn sm" @click="router.push('/security')">账户设置 ›</button>
      </section>

      <!-- 订单快捷入口：数字来自 /consumer/orders 的 total -->
      <section class="m-card">
        <header class="m-card-hd">
          <h3>我的订单</h3>
          <div class="hd-actions">
            <button type="button" class="m-btn text" @click="router.push('/orders')">查看全部订单 ›</button>
          </div>
        </header>
        <div class="quick-row">
          <button
            v-for="row in orderShortcuts"
            :key="row.label"
            type="button"
            class="quick-item"
            :title="row.hint"
            @click="router.push('/orders')"
          >
            <span class="qi-ic">{{ row.icon }}</span>
            <b class="num">{{ row.count === null ? '—' : row.count }}</b>
            <small>{{ row.label }}</small>
          </button>
        </div>
        <p class="muted small quick-note">
          待付款/待发货/待收货/已完成按订单状态统计；售后为当前账号的售后记录条数（申请与处理进度在订单详情里查看）。
        </p>
      </section>

      <!-- 资产 -->
      <section class="m-card assets">
        <button v-for="asset in assetRows" :key="asset.label" type="button" class="asset" @click="router.push(asset.path)">
          <b class="num">{{ asset.value === null ? '—' : asset.value }}</b>
          <small>{{ asset.label }}</small>
        </button>
      </section>

      <!-- 功能宫格 -->
      <SectionHead title="常用功能" desc="收藏、地址、评价、营销与账户安全" />
      <div class="m-card grid-card">
        <div class="fun-grid">
          <button v-for="item in funRows" :key="item.label" type="button" class="fun-item" @click="router.push(item.path)">
            <i>{{ item.icon }}</i>
            <span>{{ item.label }}</span>
            <small>{{ item.desc }}</small>
            <i v-if="item.badge" class="m-tag red fun-badge">{{ item.badge > 99 ? '99+' : item.badge }}</i>
          </button>
        </div>
      </div>

      <!-- 退出登录 -->
      <section class="m-card m-card-pad logout-card">
        <div>
          <b>退出当前账号</b>
          <p class="muted small">
            退出会同时清理商城本地登录态并跳转统一认证的注销页，其它端（供应商端 / 渠道商端 / 运营端）的登录态由统一账号统一管理。
          </p>
        </div>
        <button type="button" class="m-btn" @click="logout">退出登录</button>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { consumerApi } from '../api'
import { useUserStore } from '../stores/user'
import { memberLevelText } from '../utils/format'
import SectionHead from '../components/SectionHead.vue'
import EmptyBlock from '../components/EmptyBlock.vue'

const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const consumerId = computed(() => userStore.consumerId)

/** 各状态订单数：null 表示接口失败（显示「—」），不能用 0 冒充"没有订单"。 */
const counts = ref({ pay: null, ship: null, receive: null, done: null, afterSale: null })
const assets = ref({ coupons: null, favorites: null, footprints: null })

const maskedPhone = computed(() => {
  const phone = String(userStore.user?.phone || '').trim()
  if (!phone) return '未绑定手机号'
  if (/^\d{11}$/.test(phone)) return `${phone.slice(0, 3)}****${phone.slice(7)}`
  return phone
})

const orderShortcuts = computed(() => [
  { label: '待付款', icon: '💳', count: counts.value.pay, hint: '统计 status=PENDING_PAY 的订单' },
  { label: '待发货', icon: '📦', count: counts.value.ship, hint: '统计 status=PENDING_SHIP 的订单' },
  { label: '待收货', icon: '🚚', count: counts.value.receive, hint: '统计已发货未收货的订单' },
  { label: '已完成', icon: '✅', count: counts.value.done, hint: '统计 status=COMPLETED 的订单' },
  { label: '售后', icon: '🛠️', count: counts.value.afterSale, hint: '当前账号的售后记录条数' },
])

const assetRows = computed(() => [
  { label: '积分', value: userStore.user?.points ?? 0, path: '/points' },
  { label: '优惠券', value: assets.value.coupons, path: '/my-coupons' },
  { label: '收藏', value: assets.value.favorites, path: '/favorites' },
  { label: '足迹', value: assets.value.footprints, path: '/footprints' },
])

const funRows = computed(() => [
  { icon: '⭐', label: '我的收藏', desc: '收藏的产地好货', path: '/favorites' },
  { icon: '👣', label: '我的足迹', desc: '最近浏览记录', path: '/footprints' },
  { icon: '📍', label: '收货地址', desc: '维护常用收货信息', path: '/addresses' },
  { icon: '💬', label: '评价中心', desc: '待评价与已评价', path: '/reviews' },
  { icon: '🎫', label: '我的优惠券', desc: '可用 / 已用 / 过期', path: '/my-coupons' },
  { icon: '🎁', label: '积分商城', desc: '积分兑换优惠券', path: '/points-mall' },
  { icon: '📅', label: '每日签到', desc: '签到得积分', path: '/signin' },
  { icon: '👑', label: '会员中心', desc: '等级与权益', path: '/member' },
  { icon: '🔔', label: '消息通知', desc: '订单与活动通知', path: '/messages', badge: userStore.unreadCount },
  { icon: '🧭', label: '模块边界', desc: '能力归属说明', path: '/boundary' },
])

/** 单个状态的订单总数：接口失败返回 null，避免把"查询失败"显示成 0。 */
async function countOrders(status) {
  try {
    const res = await consumerApi.getOrders({ consumerId: consumerId.value, status, page: 1, size: 1 })
    const total = Number(res?.total)
    return Number.isFinite(total) ? total : null
  } catch {
    return null
  }
}

/** 待收货 = 已发货 + 待收货两种状态之和；任一查询失败都返回 null。 */
async function countToReceive() {
  const [shipped, pending] = await Promise.all([countOrders('SHIPPED'), countOrders('PENDING_RECEIVE')])
  if (shipped === null || pending === null) return null
  return shipped + pending
}

async function load() {
  if (!consumerId.value) {
    counts.value = { pay: null, ship: null, receive: null, done: null, afterSale: null }
    assets.value = { coupons: null, favorites: null, footprints: null }
    return
  }
  loading.value = true
  try {
    const [pay, ship, receive, done, afterSales, coupons, favorites, footprints] = await Promise.allSettled([
      countOrders('PENDING_PAY'),
      countOrders('PENDING_SHIP'),
      countToReceive(),
      countOrders('COMPLETED'),
      consumerApi.getAfterSales(consumerId.value),
      consumerApi.getCoupons(consumerId.value),
      consumerApi.getFavorites(consumerId.value),
      consumerApi.getFootprints(consumerId.value),
    ])

    const pick = (result) => (result.status === 'fulfilled' ? result.value : null)

    counts.value = {
      pay: pay.status === 'fulfilled' ? pay.value : null,
      ship: ship.status === 'fulfilled' ? ship.value : null,
      receive: receive.status === 'fulfilled' ? receive.value : null,
      done: done.status === 'fulfilled' ? done.value : null,
      afterSale: Array.isArray(pick(afterSales)) ? afterSales.value.length : null,
    }

    // 优惠券只统计"未使用"的券；优惠券状态字段由后端给出，这里不做二次判定
    const couponList = Array.isArray(pick(coupons)) ? coupons.value : null
    assets.value = {
      coupons: couponList ? couponList.filter((row) => row.status === 'UNUSED').length : null,
      favorites: Array.isArray(pick(favorites)) ? favorites.value.length : null,
      footprints: Array.isArray(pick(footprints)) ? footprints.value.length : null,
    }
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '个人中心数据加载失败')
  } finally {
    loading.value = false
  }
}

async function logout() {
  try {
    await ElMessageBox.confirm(
      '退出后需要重新从统一门户登录才能继续下单、查看订单。确认退出当前账号？',
      '退出登录',
      { confirmButtonText: '确认退出', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  // logout 内部会调统一认证注销并整页跳转，成功后不需要再做前端跳转
  await userStore.logout()
}

onMounted(load)

// 统一身份异步换回消费者 ID：拿到后再统计，避免直接进入本页时把数字全显示成「—」
watch(
  () => consumerId.value,
  (id) => {
    if (id) load()
  },
)
</script>

<style scoped>
.m-container {
  width: min(1280px, calc(100% - 48px));
  margin: 18px auto 0;
}

.head-card {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  padding: 20px 22px;
  background: linear-gradient(120deg, #f4fbf7, #fff 62%);
}

.avatar {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: 18px;
  background: linear-gradient(135deg, #e4f6ec, #cbeadb);
  color: #12764a;
  font-size: 26px;
  font-weight: 800;
}

.head-info {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.head-info b {
  overflow: hidden;
  font-size: 20px;
  font-weight: 800;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.head-card .m-btn {
  margin-left: auto;
}

.quick-row {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
  padding: 16px 22px 6px;
}

.quick-item {
  display: grid;
  justify-items: center;
  gap: 3px;
  padding: 12px 6px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: #fbfdfc;
  cursor: pointer;
  transition: border-color .15s, background .15s;
}

.quick-item:hover {
  border-color: #cfe3d7;
  background: #f1fbf5;
}

.qi-ic {
  font-size: 19px;
}

.quick-item b {
  color: #0b1a12;
  font-size: 19px;
  font-weight: 800;
  line-height: 1.2;
}

.quick-item small {
  color: #6b7c72;
  font-size: 12px;
}

.quick-note {
  margin: 4px 0 0;
  padding: 0 22px 16px;
  line-height: 1.7;
}

.assets {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 16px;
  padding: 16px 10px;
}

.asset {
  display: grid;
  justify-items: center;
  gap: 2px;
  padding: 6px 0;
  border: 0;
  border-right: 1px solid #eef3ef;
  background: none;
  cursor: pointer;
}

.asset:last-child {
  border-right: 0;
}

.asset:hover b {
  color: #12764a;
}

.asset b {
  color: #0b1a12;
  font-size: 20px;
  font-weight: 800;
  line-height: 1.2;
}

.asset small {
  color: #6b7c72;
  font-size: 12px;
}

.grid-card {
  padding: 8px;
}

.fun-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 4px;
}

.fun-item {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 3px;
  padding: 16px 8px;
  border: 0;
  border-radius: 10px;
  background: none;
  cursor: pointer;
  transition: background .15s;
}

.fun-item:hover {
  background: #f1fbf5;
}

.fun-item i:first-child {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: #f1fbf5;
  font-size: 19px;
  font-style: normal;
}

.fun-item span {
  color: #0b1a12;
  font-size: 13px;
  font-weight: 600;
}

.fun-item small {
  color: #93a29a;
  font-size: var(--agri-font-size-micro);
}

.fun-badge {
  position: absolute;
  top: 8px;
  left: 50%;
  margin-left: 8px;
  font-style: normal;
}

.logout-card {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 16px;
}

.logout-card b {
  font-size: 14px;
}

.logout-card p {
  margin: 4px 0 0;
  max-width: 720px;
  line-height: 1.8;
}

.logout-card .m-btn {
  margin-left: auto;
}

@media (max-width: 1180px) {
  .fun-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}

@media (max-width: 960px) {
  .quick-row { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .fun-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .assets { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .asset:nth-child(2n) { border-right: 0; }
}
</style>
