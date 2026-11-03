<template>
  <div class="m-container gd" v-loading="loading">
    <template v-if="activity">
      <div class="m-split">
        <section class="m-stack">
          <div class="m-card hero">
            <div class="hero-top">
              <div>
                <span v-if="openInstances.length" class="m-tag red">拼团进行中</span>
                <span v-else class="m-tag plain">暂无可参与的团</span>
                <h1>{{ activity.name }}</h1>
                <p class="muted small">
                  商品：<a class="link" @click="$router.push(`/product/${activity.productId}`)">{{ productName }}</a>
                </p>
              </div>
              <div class="hero-time">
                <span class="muted small">活动剩余</span>
                <Countdown :end-time="activity.endTime" end-text="活动已结束" />
              </div>
            </div>

            <div class="price-band">
              <div class="pb-item">
                <span>单买价</span>
                <b class="strike">¥{{ money(activity.singlePrice) }}</b>
              </div>
              <div class="pb-item main">
                <span>拼团价</span>
                <b class="price lg"><span class="cur">¥</span>{{ money(activity.groupPrice) }}</b>
              </div>
              <div v-if="Number(activity.leaderPrice) > 0" class="pb-item">
                <span>团长价</span>
                <b class="price">¥{{ money(activity.leaderPrice) }}</b>
              </div>
              <div class="pb-item">
                <span>成团人数</span>
                <b>{{ activity.groupSize }} 人</b>
              </div>
              <div class="pb-item">
                <span>有效期</span>
                <b>{{ activity.validHours }} 小时</b>
              </div>
            </div>

            <div class="actions">
              <button type="button" class="m-btn primary" :disabled="busy || !activityOpen" @click="startGroup">
                发起拼团（¥{{ money(leaderPrice) }}）
              </button>
              <span class="muted small">一次只能结算这件商品，系统会自动只勾选它</span>
            </div>
            <p v-if="!activityOpen" class="muted small">活动不在有效期内，无法发起拼团。</p>
          </div>

          <div class="m-card">
            <div class="m-card-hd">
              <h3>正在拼的团</h3>
              <span class="hd-actions muted small">共 {{ openInstances.length }} 个团可参与</span>
            </div>
            <div v-if="openInstances.length" class="inst-list">
              <div v-for="ins in openInstances" :key="ins.instanceId" class="inst">
                <span class="avatar">{{ (ins.leaderName || '团').slice(0, 1) }}</span>
                <div class="inst-info">
                  <b>{{ ins.leaderName }} 的团</b>
                  <small>已拼 {{ ins.joinedCount }}/{{ ins.requiredSize }} 人 · {{ expireText(ins.expireTime) }}</small>
                </div>
                <div class="inst-progress">
                  <span class="bar"><i :style="{ width: percent(ins) }" /></span>
                </div>
                <button type="button" class="m-btn sm ghost" :disabled="busy" @click="joinGroup(ins)">
                  ¥{{ money(activity.groupPrice) }} 参团
                </button>
              </div>
            </div>
            <EmptyBlock
              v-else
              icon="👥"
              title="还没有人开团"
              desc="你可以直接发起一团，把链接发给朋友一起拼；满员前任何人都能参团。"
            />
          </div>

          <div class="m-card rules">
            <h3>拼团规则</h3>
            <ol>
              <li>发起人按团长价、参团人按团价结算，<b>下单即按团价扣款</b>，不等到成团。</li>
              <li>团有效期取「活动结束时间」与「{{ activity.validHours }} 小时」中较早的一个；到期未满自动标记失败。</li>
              <li>未成团的退款由平台运营端统一处理，本页只展示团状态，不做退款动作。</li>
              <li>同一团每人只能参一次；每人限购 {{ activity.perUserLimit || '不限' }} 件。</li>
            </ol>
          </div>
        </section>

        <aside class="m-stack">
          <div class="m-card m-card-pad">
            <h4>我参与的团</h4>
            <div v-if="myGroups.length" class="my-list">
              <div v-for="g in myGroups" :key="g.instanceId" class="my-item">
                <div class="m-row-wrap">
                  <span class="m-tag" :class="statusClass(g.status)">{{ statusText(g.status) }}</span>
                  <span class="muted small">{{ g.role === 'LEADER' ? '我是团长' : '我是团员' }}</span>
                </div>
                <div class="my-meta">
                  已拼 {{ g.joinedCount }}/{{ g.requiredSize }} 人
                  <span v-if="g.status === 'PENDING'"> · {{ expireText(g.expireTime) }}</span>
                </div>
                <button type="button" class="m-btn sm text" @click="$router.push(`/order/${g.orderId}`)">查看订单 ›</button>
              </div>
            </div>
            <EmptyBlock v-else icon="🧾" title="还没参加过这个团" desc="发起或参团后，记录会出现在这里。" />
          </div>
        </aside>
      </div>
    </template>

    <EmptyBlock
      v-else-if="!loading"
      icon="👥"
      title="拼团活动不存在或已下线"
      desc="活动可能已结束或被运营端下架。"
    >
      <template #actions>
        <button type="button" class="m-btn primary" @click="$router.push('/groups')">返回拼团专区</button>
      </template>
    </EmptyBlock>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { consumerApi } from '../api'
import { useUserStore } from '../stores/user'
import { money } from '../utils/format'
import Countdown from '../components/Countdown.vue'
import EmptyBlock from '../components/EmptyBlock.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const busy = ref(false)
const activity = ref(null)
const productName = ref('')
const instances = ref([])
const myGroups = ref([])

const openInstances = computed(() => instances.value)

const leaderPrice = computed(() => {
  const price = Number(activity.value?.leaderPrice)
  return price > 0 ? price : activity.value?.groupPrice
})

const activityOpen = computed(() => {
  if (!activity.value) return false
  const now = Date.now()
  const start = new Date(String(activity.value.startTime).replace(' ', 'T')).getTime()
  const end = new Date(String(activity.value.endTime).replace(' ', 'T')).getTime()
  return activity.value.status === 'ACTIVE' && now >= start && now <= end
})

function percent(ins) {
  const required = Number(ins.requiredSize || 0)
  if (!required) return '0%'
  return `${Math.min(100, Math.round((Number(ins.joinedCount || 0) / required) * 100))}%`
}

function expireText(value) {
  if (!value) return '—'
  const ts = new Date(String(value).replace(' ', 'T')).getTime()
  const diff = ts - Date.now()
  if (diff <= 0) return '已到期'
  const hours = Math.floor(diff / 3600000)
  if (hours >= 1) return `${hours} 小时后到期`
  return `${Math.max(1, Math.floor(diff / 60000))} 分钟后到期`
}

const STATUS_TEXT = { PENDING: '待成团', SUCCESS: '已成团', FAILED: '未成团', CANCELLED: '已取消' }
function statusText(status) {
  return STATUS_TEXT[status] || status || '—'
}
function statusClass(status) {
  if (status === 'SUCCESS') return ''
  if (status === 'FAILED') return 'red'
  return 'amber'
}

/**
 * 拼团下单前把购物车整理成「只勾这一件」：
 * 后端要求拼团订单只能结算活动商品且只有一行，否则会直接拒绝。
 */
async function prepareCart(productId) {
  const consumerId = userStore.consumerId
  await consumerApi.addCart({ consumerId, productId, quantity: 1 })
  const lines = await consumerApi.getCart(consumerId)
  const same = lines.filter((line) => String(line.productId) === String(productId))
  // 同商品多行会让「只结算一件」失效：保留最新一行，其余删掉
  for (const line of same.slice(0, -1)) {
    await consumerApi.deleteCart(line.id)
  }
  await consumerApi.selectAllCart(consumerId, false)
  const keep = same[same.length - 1]
  if (keep) await consumerApi.updateCart({ id: keep.id, selected: true })
  await userStore.refreshCart()
}

async function startGroup() {
  if (!userStore.consumerId) {
    ElMessage.warning('请先完成登录')
    return
  }
  busy.value = true
  try {
    await prepareCart(activity.value.productId)
    router.push({ path: '/order/confirm', query: { groupBuyId: activity.value.id } })
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '发起拼团失败')
  } finally {
    busy.value = false
  }
}

async function joinGroup(ins) {
  if (!userStore.consumerId) {
    ElMessage.warning('请先完成登录')
    return
  }
  busy.value = true
  try {
    await prepareCart(activity.value.productId)
    router.push({
      path: '/order/confirm',
      query: { groupBuyId: activity.value.id, groupInstanceId: ins.instanceId },
    })
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '参团失败')
  } finally {
    busy.value = false
  }
}

async function load() {
  loading.value = true
  try {
    const data = await consumerApi.getGroupBuyDetail(route.params.id)
    activity.value = data?.activity || null
    instances.value = data?.instances || []
    if (activity.value) {
      const product = await consumerApi.getProductDetail(activity.value.productId).catch(() => null)
      productName.value = product?.name || `商品 #${activity.value.productId}`
    }
    if (userStore.consumerId) {
      const mine = await consumerApi.getMyGroups(userStore.consumerId).catch(() => [])
      myGroups.value = (mine || []).filter((g) => String(g.groupBuyId) === String(route.params.id))
    }
  } catch (err) {
    if (err.response?.status !== 404) {
      ElMessage.error(err.friendlyMessage || '拼团详情加载失败')
    }
    activity.value = null
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.gd {
  margin-top: 18px;
}

.hero {
  padding: 22px 24px;
}

.hero-top {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.hero-top h1 {
  margin: 8px 0 4px;
  font-size: 21px;
  font-weight: 800;
}

.hero-time {
  display: grid;
  justify-items: end;
  gap: 4px;
  margin-left: auto;
}

.link {
  color: #12764a;
  cursor: pointer;
  text-decoration: underline;
}

.price-band {
  display: flex;
  flex-wrap: wrap;
  gap: 26px;
  margin: 18px 0 16px;
  padding: 16px 20px;
  border-radius: 12px;
  background: linear-gradient(120deg, #fdf6f1, #f6fbf8);
}

.pb-item {
  display: grid;
  gap: 4px;
}

.pb-item > span {
  color: #6b7c72;
  font-size: 12px;
}

.pb-item > b {
  font-size: 15px;
}

.pb-item .strike {
  color: #9aa8a0;
  text-decoration: line-through;
}

.pb-item.main b {
  font-size: 24px;
}

.actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.inst-list {
  padding: 6px 22px 16px;
}

.inst {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 140px auto;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px dashed #eef3ef;
}

.inst:last-child {
  border-bottom: 0;
}

.inst .avatar {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #e4f6ec;
  color: #12764a;
  font-weight: 700;
}

.inst-info b {
  display: block;
  font-size: 13.5px;
}

.inst-info small {
  color: #6b7c72;
  font-size: 12px;
}

.inst-progress .bar {
  display: block;
  overflow: hidden;
  height: 7px;
  border-radius: 4px;
  background: #f1f5f2;
}

.inst-progress .bar i {
  display: block;
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, #7ac9a6, #12764a);
}

.rules {
  padding: 20px 22px;
}

.rules h3 {
  margin: 0 0 10px;
  font-size: 15px;
}

.rules ol {
  margin: 0;
  padding-left: 20px;
  color: #4b5d53;
  font-size: 13px;
  line-height: 1.95;
}

.my-list {
  display: grid;
  gap: 12px;
  margin-top: 10px;
}

.my-item {
  padding: 10px 12px;
  border: 1px solid #e3eae5;
  border-radius: 10px;
  background: #fbfdfc;
}

.my-meta {
  margin: 6px 0 2px;
  color: #6b7c72;
  font-size: 12px;
}

h4 {
  margin: 0;
  font-size: 16px;
}

@media (max-width: 1080px) {
  .inst { grid-template-columns: 36px minmax(0, 1fr) auto; }
  .inst-progress { display: none; }
}
</style>
