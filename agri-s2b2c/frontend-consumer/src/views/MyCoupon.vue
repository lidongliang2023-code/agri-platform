<template>
  <div class="m-container" v-loading="loading">
    <div class="m-page-hd">
      <h1>我的优惠券</h1>
      <span class="sub">已领取的优惠券按状态分类；过期与已使用的券只做留档，不能再次使用</span>
      <div class="hd-actions">
        <button type="button" class="m-btn sm primary" @click="router.push('/coupons')">去领券中心 ›</button>
      </div>
    </div>

    <!-- 未登录 -->
    <EmptyBlock
      v-if="userStore.booted && !userStore.consumerId"
      icon="🔐"
      title="登录后查看优惠券"
      desc="优惠券按消费者账号发放与核销。当前浏览器没有检测到已登录的统一身份，请从统一门户登录后再进入商城。"
    >
      <template #actions>
        <button type="button" class="m-btn primary" @click="router.push('/')">返回首页</button>
      </template>
    </EmptyBlock>

    <template v-else>
      <!-- 状态筛选：可用 / 已使用 / 已过期 -->
      <div class="m-card tabs">
        <button
          v-for="tab in TABS"
          :key="tab.value"
          type="button"
          class="seg"
          :class="{ on: tabKey === tab.value }"
          @click="tabKey = tab.value"
        >
          {{ tab.label }}
          <span class="seg-num num">{{ groups[tab.value].length }}</span>
        </button>
      </div>

      <div v-if="current.length" class="m-grid m-grid-3 coupon-grid">
        <article
          v-for="coupon in current"
          :key="coupon.id"
          class="coupon-card"
          :class="{ dim: tabKey !== 'UNUSED' }"
        >
          <div class="face" :class="{ discount: coupon.type === 'DISCOUNT', dim: tabKey !== 'UNUSED' }">
            <b class="num">{{ faceText(coupon) }}</b>
            <small>{{ coupon.type === 'DISCOUNT' ? '折扣券' : '满减券' }}</small>
          </div>

          <div class="c-bd">
            <div class="c-name" :title="coupon.name">{{ coupon.name }}</div>
            <div class="muted small">{{ couponCondition(coupon) }}</div>
            <div class="muted small">有效期至 {{ dateOnly(coupon.validEnd) }}</div>
            <div class="muted small">领取时间 {{ dateTime(coupon.receiveTime) }}</div>
            <div class="c-ft">
              <span class="m-tag" :class="tagClass(coupon)">{{ statusText(coupon) }}</span>
              <button
                v-if="tabKey === 'UNUSED'"
                type="button"
                class="m-btn sm primary"
                @click="router.push('/products')"
              >
                去使用
              </button>
            </div>
          </div>
        </article>
      </div>

      <EmptyBlock
        v-else-if="!loading"
        icon="🎫"
        :title="`暂无${currentTabLabel}优惠券`"
        :desc="emptyDesc"
      >
        <template #actions>
          <div class="m-row-wrap">
            <button type="button" class="m-btn primary" @click="router.push('/coupons')">去领券中心</button>
            <button type="button" class="m-btn" @click="router.push('/products')">去逛逛</button>
          </div>
        </template>
      </EmptyBlock>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { consumerApi } from '../api'
import { useUserStore } from '../stores/user'
import { couponCondition, couponValue, dateOnly, dateTime } from '../utils/format'
import EmptyBlock from '../components/EmptyBlock.vue'

const router = useRouter()
const userStore = useUserStore()

const TABS = [
  { label: '可用', value: 'UNUSED' },
  { label: '已使用', value: 'USED' },
  { label: '已过期', value: 'EXPIRED' },
]

const loading = ref(false)
const coupons = ref([])
const tabKey = ref('UNUSED')

function localToday() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** 是否已过期：后端 status 会给 EXPIRED，也可能仍是 UNUSED 但有效期已过（按 validEnd 判断）。 */
function isExpired(coupon) {
  if (coupon.status === 'EXPIRED') return true
  if (coupon.status !== 'UNUSED') return false
  const end = dateOnly(coupon.validEnd)
  if (!end || end === '—') return false
  return end < localToday()
}

const groups = computed(() => {
  const result = { UNUSED: [], USED: [], EXPIRED: [] }
  for (const coupon of coupons.value) {
    if (coupon.status === 'USED') result.USED.push(coupon)
    else if (isExpired(coupon)) result.EXPIRED.push(coupon)
    else result.UNUSED.push(coupon)
  }
  return result
})

const current = computed(() => groups.value[tabKey.value] || [])
const currentTabLabel = computed(() => TABS.find((tab) => tab.value === tabKey.value)?.label || '')

const emptyDesc = computed(() => {
  if (tabKey.value === 'USED') {
    return '已使用的券是下单核销后留下的记录。当前账号还没有核销过优惠券，使用后会在这里留档。'
  }
  if (tabKey.value === 'EXPIRED') {
    return '过期券由有效期（validEnd）判定，仅作留档。当前没有被判定为过期的券。'
  }
  return '可用券来自「领券中心」的领取记录，也可在积分商城用积分兑换。当前账号还没有可用券，去领券中心看看。'
})

function faceText(coupon) {
  if (coupon.type === 'DISCOUNT' && !(Number(coupon.discountRate) > 0)) return '折扣券'
  return couponValue(coupon)
}

function statusText(coupon) {
  if (coupon.status === 'USED') return '已使用'
  if (isExpired(coupon)) return '已过期'
  return '可使用'
}

function tagClass(coupon) {
  if (coupon.status === 'USED') return 'plain'
  if (isExpired(coupon)) return 'red'
  return ''
}

async function load() {
  if (!userStore.consumerId) {
    coupons.value = []
    return
  }
  loading.value = true
  try {
    coupons.value = (await consumerApi.getCoupons(userStore.consumerId)) || []
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '优惠券加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(load)

// 统一身份异步换回消费者 ID：拿到后再查券，避免直接进入本页时误判「没有券」
watch(
  () => userStore.consumerId,
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

.coupon-card.dim {
  background: #fbfdfc;
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

.face.dim {
  filter: grayscale(1);
  opacity: .65;
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

@media (max-width: 960px) {
  .coupon-card { grid-template-columns: 88px minmax(0, 1fr); }
}
</style>
