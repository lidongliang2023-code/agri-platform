<template>
  <div class="m-container" v-loading="loading">
    <div class="m-page-hd">
      <h1>领券中心</h1>
      <span class="sub">平台运营端配置的在发优惠券，先领后买；结算时由后端按门槛自动匹配可用券</span>
      <div class="hd-actions">
        <button type="button" class="m-btn sm" @click="router.push('/my-coupons')">我的优惠券 ›</button>
      </div>
    </div>

    <!-- 券类型筛选：只保留后端真实存在的 FIXED / DISCOUNT 两种 -->
    <div class="m-card tabs">
      <button
        v-for="tab in TABS"
        :key="tab.value || 'all'"
        type="button"
        class="seg"
        :class="{ on: type === tab.value }"
        @click="type = tab.value"
      >
        {{ tab.label }}
        <span class="seg-num num">{{ countOf(tab.value) }}</span>
      </button>
    </div>

    <!-- 券列表 -->
    <div v-if="visibleCoupons.length" class="m-grid m-grid-3 coupon-grid">
      <article v-for="coupon in visibleCoupons" :key="coupon.id" class="coupon-card">
        <div class="face" :class="{ discount: coupon.type === 'DISCOUNT' }">
          <b class="num">{{ faceText(coupon) }}</b>
          <small>{{ coupon.type === 'DISCOUNT' ? '折扣券' : '满减券' }}</small>
        </div>

        <div class="c-bd">
          <div class="c-name" :title="coupon.name">{{ coupon.name }}</div>
          <div class="muted small">{{ couponCondition(coupon) }}</div>
          <div class="muted small num">
            有效期 {{ dateOnly(coupon.validStart) }} ~ {{ dateOnly(coupon.validEnd) }}
          </div>
          <div class="c-ft">
            <span class="muted small">剩余 <b class="num">{{ coupon.remainCount ?? 0 }}</b> 张</span>
            <button
              type="button"
              class="m-btn sm"
              :class="{ primary: canReceive(coupon) }"
              :disabled="isReceived(coupon) || soldOut(coupon) || receivingId === coupon.id"
              @click="receive(coupon)"
            >
              {{ actionText(coupon) }}
            </button>
          </div>
        </div>
      </article>
    </div>

    <EmptyBlock
      v-else-if="!loading"
      icon="🎫"
      :title="type ? '该类型暂无在发优惠券' : '当前没有在发优惠券'"
      desc="优惠券由平台运营端在营销活动里配置（面额/门槛/有效期/发放数量），配置并通过审核后才会出现在这里，供应商与消费者都不能自行创建。"
    >
      <template #actions>
        <div class="m-row-wrap">
          <button type="button" class="m-btn primary" @click="router.push('/products')">去逛逛好货</button>
          <button v-if="type" type="button" class="m-btn" @click="type = ''">查看全部券</button>
        </div>
      </template>
    </EmptyBlock>

    <p class="note muted small">
      券面额与门槛以后端返回为准；「折扣券」的折扣力度由平台运营端在券模板里配置，前端不做二次换算。
    </p>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { consumerApi } from '../api'
import { useUserStore } from '../stores/user'
import { couponCondition, couponValue, dateOnly } from '../utils/format'
import EmptyBlock from '../components/EmptyBlock.vue'

const router = useRouter()
const userStore = useUserStore()

/** 后端券 type 只有 FIXED（满减）与 DISCOUNT（折扣）两种，这里按真实取值分组。 */
const TABS = [
  { label: '全部', value: '' },
  { label: '满减券', value: 'FIXED' },
  { label: '折扣券', value: 'DISCOUNT' },
]

const loading = ref(false)
const coupons = ref([])
const mineCoupons = ref([])
const type = ref('')
const receivingId = ref(null)

/** 已领取的券模板 ID 集合：用于把按钮置为「已领取」，避免重复点时被后端拒绝。 */
const receivedIds = computed(() => new Set((mineCoupons.value || []).map((row) => String(row.couponId))))

const visibleCoupons = computed(() =>
  type.value ? coupons.value.filter((item) => item.type === type.value) : coupons.value,
)

function countOf(value) {
  return value ? coupons.value.filter((item) => item.type === value).length : coupons.value.length
}

/**
 * 面额展示：折扣券优先用 discountRate 折算成「8.0 折」；
 * 后端未配置折扣力度时（discountRate 为空、amount 为 0）只显示「折扣券」，不臆造折扣数字。
 */
function faceText(coupon) {
  if (coupon.type === 'DISCOUNT' && !(Number(coupon.discountRate) > 0)) return '折扣券'
  return couponValue(coupon)
}

function isReceived(coupon) {
  return receivedIds.value.has(String(coupon.id))
}

function soldOut(coupon) {
  return Number(coupon.remainCount ?? 0) <= 0
}

/** 只有「已登录 + 未领过 + 还有库存」才给主按钮样式；未登录仍可点击，点了给出登录提示。 */
function canReceive(coupon) {
  return Boolean(userStore.consumerId) && !isReceived(coupon) && !soldOut(coupon)
}

function actionText(coupon) {
  if (!userStore.consumerId) return '登录后可领取'
  if (isReceived(coupon)) return '已领取'
  if (soldOut(coupon)) return '已领完'
  if (receivingId.value === coupon.id) return '领取中…'
  return '立即领取'
}

async function loadMarket() {
  loading.value = true
  try {
    const data = await consumerApi.getMarketing()
    coupons.value = data?.coupons || []
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '优惠券加载失败')
  } finally {
    loading.value = false
  }
}

/** 回读我的券：领取是否生效以这里为准，不信写接口的返回值。 */
async function loadMine() {
  if (!userStore.consumerId) {
    mineCoupons.value = []
    return []
  }
  const rows = await consumerApi.getCoupons(userStore.consumerId).catch(() => null)
  mineCoupons.value = rows || []
  return mineCoupons.value
}

async function receive(coupon) {
  if (!userStore.consumerId) {
    ElMessage.warning('登录后可领取优惠券')
    return
  }
  receivingId.value = coupon.id
  try {
    const res = await consumerApi.receiveCoupon(userStore.consumerId, coupon.id)
    if (res?.success === false) {
      ElMessage.warning(res.message || '领取失败')
      await Promise.all([loadMine(), loadMarket()])
      return
    }
    const mine = await loadMine()
    if (mine.some((row) => String(row.couponId) === String(coupon.id))) {
      ElMessage.success('领取成功，可在「我的优惠券」查看')
      await loadMarket()
    } else {
      ElMessage.error('领取未生效，请刷新后重试')
      await loadMine()
    }
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '领取失败')
  } finally {
    receivingId.value = null
  }
}

onMounted(async () => {
  await loadMarket()
  await loadMine()
})

// 统一身份异步换回消费者 ID：拿到后再补查「我已领取」状态
watch(
  () => userStore.consumerId,
  (id) => {
    if (id) loadMine()
  },
)
</script>

<style scoped>
.m-container {
  width: min(1280px, calc(100% - 48px));
  margin: 18px auto 0;
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
  padding: 8px;
}

.seg {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 16px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #4b5d53;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background .15s, color .15s, box-shadow .15s;
}

.seg:hover {
  background: #f1fbf5;
  color: #12764a;
}

.seg.on {
  background: linear-gradient(135deg, #12764a, #159a5e);
  color: #fff;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(18, 118, 74, .18);
}

.seg-num {
  padding: 0 6px;
  border-radius: 8px;
  background: rgba(11, 26, 18, .06);
  font-size: var(--agri-font-size-micro);
  font-weight: 700;
}

.seg.on .seg-num {
  background: rgba(255, 255, 255, .24);
}

.coupon-grid {
  align-items: stretch;
}

.coupon-card {
  display: grid;
  grid-template-columns: 104px minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid #e3eae5;
  border-radius: 12px;
  background: #fff;
  transition: border-color .15s, box-shadow .15s;
}

.coupon-card:hover {
  border-color: #cfe3d7;
  box-shadow: 0 8px 22px rgba(4, 31, 20, .05);
}

.face {
  position: relative;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 2px;
  padding: 14px 8px;
  background: linear-gradient(160deg, #fdf1ea, #fbe3d6);
  color: #d45b32;
  text-align: center;
}

.face::after {
  position: absolute;
  top: 8px;
  right: -1px;
  bottom: 8px;
  border-left: 1px dashed #efd3c4;
  content: "";
}

.face.discount {
  background: linear-gradient(160deg, #f1fbf5, #e2f5ea);
  color: #12764a;
}

.face.discount::after {
  border-left-color: #cfe7da;
}

.face b {
  font-size: 22px;
  font-weight: 800;
  line-height: 1.2;
  word-break: break-all;
}

.face small {
  font-size: var(--agri-font-size-micro);
  opacity: .8;
}

.c-bd {
  display: grid;
  gap: 5px;
  align-content: start;
  padding: 12px 14px;
}

.c-name {
  overflow: hidden;
  color: #0b1a12;
  font-size: 13.5px;
  font-weight: 700;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.c-ft {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.c-ft .m-btn {
  margin-left: auto;
}

.c-ft b {
  color: #0b1a12;
}

.note {
  margin: 16px 0 0;
  line-height: 1.8;
}

@media (max-width: 960px) {
  .coupon-card { grid-template-columns: 88px minmax(0, 1fr); }
}
</style>
