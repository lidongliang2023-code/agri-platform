<template>
  <div class="m-container" v-loading="loading">
    <div class="m-page-hd">
      <h1>积分商城</h1>
      <span class="sub">用积分兑换平台在发的优惠券，兑换成功后券直接进入「我的优惠券」</span>
      <div class="hd-actions">
        <button type="button" class="m-btn sm" @click="router.push('/points')">积分明细 ›</button>
        <button type="button" class="m-btn sm primary" @click="router.push('/signin')">去签到赚积分</button>
      </div>
    </div>

    <!-- 未登录 -->
    <EmptyBlock
      v-if="userStore.booted && !userStore.consumerId"
      icon="🔐"
      title="登录后才能兑换"
      desc="积分与兑换记录按消费者账号存储。当前浏览器没有检测到已登录的统一身份，请从统一门户登录后再进入商城。"
    >
      <template #actions>
        <button type="button" class="m-btn primary" @click="router.push('/')">返回首页</button>
      </template>
    </EmptyBlock>

    <template v-else>
      <!-- 积分余额 -->
      <section class="m-card balance-card">
        <div>
          <span class="muted small">我的可用积分</span>
          <b class="num">{{ userStore.user?.points ?? 0 }}</b>
        </div>
        <span class="m-spacer" />
        <p class="muted small balance-tip">
          兑换比例由平台运营口径确定：满减券按面额 ×10 积分、折扣券按门槛 ×2 积分，最低 50 分；
          最终所需积分以后端返回的 pointsCost 为准。
        </p>
      </section>

      <!-- 可兑换券 -->
      <div v-if="goods.length" class="m-grid m-grid-3 goods-grid">
        <article v-for="item in goods" :key="item.couponId" class="goods-card">
          <header class="gc-hd">
            <div class="face" :class="{ discount: item.type === 'DISCOUNT' }">
              <b class="num">{{ faceText(item) }}</b>
              <small>{{ item.type === 'DISCOUNT' ? '折扣券' : '满减券' }}</small>
            </div>
            <div class="gc-info">
              <div class="gc-name" :title="item.name">{{ item.name }}</div>
              <div class="muted small">{{ couponCondition(item) }}</div>
              <div class="muted small">有效期至 {{ dateOnly(item.validEnd) }}</div>
            </div>
          </header>

          <div class="gc-cost">
            <span class="muted small">所需积分</span>
            <b class="num">{{ item.pointsCost ?? '—' }}</b>
            <small class="muted">分</small>
            <span class="m-spacer" />
            <span class="muted small">剩余 <b class="num">{{ item.remainCount ?? 0 }}</b> 张</span>
          </div>

          <button
            type="button"
            class="m-btn block"
            :class="{ primary: canExchange(item) }"
            :disabled="!canExchange(item) || exchangingId === item.couponId"
            @click="exchange(item)"
          >
            {{ buttonText(item) }}
          </button>
        </article>
      </div>

      <EmptyBlock
        v-else-if="!loading"
        icon="🎁"
        title="暂无可兑换的优惠券"
        desc="积分商城的「商品」就是平台运营端在发的优惠券（状态有效且还有剩余数量）。当前没有满足条件的券，等运营端补券后再来看看。"
      >
        <template #actions>
          <div class="m-row-wrap">
            <button type="button" class="m-btn primary" @click="router.push('/coupons')">去领券中心</button>
            <button type="button" class="m-btn" @click="router.push('/signin')">去签到</button>
          </div>
        </template>
      </EmptyBlock>

      <!-- 规则 -->
      <section class="m-card m-card-pad rules">
        <h3>兑换规则</h3>
        <ul class="muted small">
          <li>兑换比例是平台运营口径：满减券按面额 ×10 积分、折扣券按门槛 ×2 积分，任何券最低 50 积分。</li>
          <li>兑换成功后券直接发放到「我的优惠券」，可在结算时按门槛使用。</li>
          <li><b>兑换后不退不换</b>：积分实时扣减，已发放的券不支持退回积分。</li>
          <li>同一张券每个账号限兑一次，已领取过同款券时后端会拒绝兑换并提示原因。</li>
        </ul>
      </section>
    </template>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { consumerApi } from '../api'
import { useUserStore } from '../stores/user'
import { couponCondition, couponValue, dateOnly } from '../utils/format'
import EmptyBlock from '../components/EmptyBlock.vue'

const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const goods = ref([])
const exchangingId = ref(null)

/**
 * 面额展示：折扣券优先按 discountRate 折算；
 * 积分商城接口不返回 discountRate，未配置折扣力度时只显示「折扣券」，不臆造折扣数字。
 */
function faceText(item) {
  if (item.type === 'DISCOUNT' && !(Number(item.discountRate) > 0)) return '折扣券'
  return couponValue(item)
}

function balance() {
  return Number(userStore.user?.points ?? 0)
}

function costOf(item) {
  return Number(item.pointsCost || 0)
}

function canExchange(item) {
  if (!userStore.consumerId) return false
  if (Number(item.remainCount ?? 0) <= 0) return false
  return balance() >= costOf(item)
}

function buttonText(item) {
  if (!userStore.consumerId) return '登录后可兑换'
  if (exchangingId.value === item.couponId) return '兑换中…'
  if (Number(item.remainCount ?? 0) <= 0) return '已兑完'
  const gap = costOf(item) - balance()
  if (gap > 0) return `还差 ${gap} 分`
  return '立即兑换'
}

async function loadGoods() {
  const rows = await consumerApi.getPointsGoods().catch(() => null)
  if (rows) goods.value = rows
  return goods.value
}

async function load() {
  if (!userStore.consumerId) {
    goods.value = []
    return
  }
  loading.value = true
  try {
    await Promise.all([userStore.refreshProfile(), loadGoods()])
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '积分商城加载失败')
  } finally {
    loading.value = false
  }
}

/** 兑换：确认 → 调接口 → 回读档案与券目录（剩余数变化）后才提示成功。 */
async function exchange(item) {
  if (!userStore.consumerId) {
    ElMessage.warning('请先完成登录')
    return
  }
  const cost = costOf(item)
  const gap = cost - balance()
  if (gap > 0) {
    ElMessage.warning(`积分不足，还差 ${gap} 分`)
    return
  }
  if (Number(item.remainCount ?? 0) <= 0) {
    ElMessage.warning('该券已兑完')
    await loadGoods()
    return
  }

  try {
    await ElMessageBox.confirm(
      `确认使用 ${cost} 积分兑换「${item.name}」？兑换后券会进入「我的优惠券」，积分实时扣减且不退不换。`,
      '确认兑换',
      { confirmButtonText: '确认兑换', cancelButtonText: '再想想', type: 'warning' },
    )
  } catch {
    return
  }

  const beforeRemain = Number(item.remainCount ?? 0)
  exchangingId.value = item.couponId
  try {
    const res = await consumerApi.exchangePoints(userStore.consumerId, item.couponId)
    if (res?.success === false) {
      ElMessage.warning(res.message || '兑换失败')
      await Promise.all([userStore.refreshProfile(), loadGoods()])
      return
    }

    // 回读复核：积分余额下降 + 券剩余数减少（或券已兑完从目录消失）
    const beforePoints = balance()
    await Promise.all([userStore.refreshProfile(), loadGoods()])
    const after = goods.value.find((row) => String(row.couponId) === String(item.couponId))
    const afterRemain = after ? Number(after.remainCount ?? 0) : 0
    const pointsDropped = balance() < beforePoints
    const stockDropped = !after || afterRemain < beforeRemain

    if (pointsDropped && stockDropped) {
      ElMessage.success('兑换成功，已放入「我的优惠券」')
    } else if (pointsDropped) {
      ElMessage.warning('积分已扣减，但券库存回读不一致，请到「我的优惠券」核对')
    } else {
      ElMessage.error('兑换结果未确认，请到「我的优惠券」与积分明细核对')
    }
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '兑换失败')
    await Promise.all([userStore.refreshProfile(), loadGoods()])
  } finally {
    exchangingId.value = null
  }
}

onMounted(load)

// 统一身份异步换回消费者 ID：拿到后再查余额与可兑换券，避免直接进入本页时误判「未登录」
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

.balance-card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  padding: 18px 22px;
  background: linear-gradient(120deg, #f4fbf7, #ffffff 62%);
}

.balance-card b {
  display: block;
  color: #12764a;
  font-size: 30px;
  font-weight: 800;
  line-height: 1.25;
}

.balance-tip {
  max-width: 560px;
  margin: 0;
  line-height: 1.8;
  text-align: right;
}

.goods-grid {
  margin-top: 16px;
}

.goods-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 18px 18px;
  border: 1px solid #e3eae5;
  border-radius: 12px;
  background: #fff;
  transition: border-color .15s, box-shadow .15s;
}

.goods-card:hover {
  border-color: #cfe3d7;
  box-shadow: 0 8px 22px rgba(4, 31, 20, .05);
}

.gc-hd {
  display: flex;
  gap: 12px;
}

.face {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 1px;
  flex: 0 0 92px;
  height: 66px;
  border-radius: 10px;
  background: linear-gradient(160deg, #fdf1ea, #fbe3d6);
  color: #d45b32;
  text-align: center;
}

.face.discount {
  background: linear-gradient(160deg, #f1fbf5, #e2f5ea);
  color: #12764a;
}

.face b {
  font-size: 18px;
  font-weight: 800;
  line-height: 1.2;
  word-break: break-all;
}

.face small {
  font-size: var(--agri-font-size-micro);
  opacity: .82;
}

.gc-info {
  display: grid;
  gap: 4px;
  align-content: center;
  min-width: 0;
}

.gc-name {
  overflow: hidden;
  color: #0b1a12;
  font-size: 13.5px;
  font-weight: 700;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.gc-cost {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #f8fbf9;
}

.gc-cost b {
  color: #d45b32;
  font-size: 20px;
  font-weight: 800;
  line-height: 1;
}

.gc-cost small {
  font-size: var(--agri-font-size-micro);
}

.goods-card .m-btn {
  margin-top: auto;
}

.rules {
  margin-top: 16px;
}

.rules h3 {
  margin: 0 0 10px;
  font-size: 14.5px;
  font-weight: 700;
}

.rules ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding-left: 16px;
  line-height: 1.8;
}

.rules b {
  color: #c94b4b;
}
</style>
