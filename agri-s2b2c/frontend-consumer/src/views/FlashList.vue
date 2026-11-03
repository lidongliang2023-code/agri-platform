<template>
  <div class="m-container" v-loading="loading">
    <div class="m-page-hd">
      <h1>限时秒杀</h1>
      <span class="sub">按场次开抢，库存与进度以后端实时数据为准；秒杀价在商品详情页下单时生效</span>
      <div class="hd-actions">
        <button type="button" class="m-btn sm" @click="load">刷新场次</button>
      </div>
    </div>

    <!-- 场次 tabs：按开始时间的「日期 + 小时」分组 -->
    <div v-if="sessions.length" class="m-card sessions">
      <button
        v-for="session in sessions"
        :key="session.key"
        type="button"
        class="session-tab"
        :class="{ on: activeKey === session.key }"
        @click="activeKey = session.key"
      >
        <b>{{ session.label }}</b>
        <small>{{ sessionStatusText(session) }}</small>
      </button>
    </div>

    <!-- 当前场次 -->
    <section v-if="activeSession" class="m-card active-card">
      <header class="active-hd">
        <div>
          <h2>{{ activeSession.label }} 场</h2>
          <p class="muted small num">
            {{ dateTime(activeSession.startTime) }} — {{ dateTime(activeSession.endTime) }}
          </p>
        </div>
        <span class="m-tag" :class="sessionTagClass(activeSession)">{{ sessionStatusText(activeSession) }}</span>
        <span class="m-spacer" />
        <template v-if="sessionState(activeSession) === 'ongoing'">
          <span class="muted small">距本场结束</span>
          <Countdown :end-time="activeSession.endTime" />
        </template>
        <template v-else-if="sessionState(activeSession) === 'upcoming'">
          <span class="muted small">距本场开始</span>
          <Countdown :end-time="activeSession.startTime" end-text="即将开始" />
        </template>
        <span v-else class="muted small">本场已结束</span>
      </header>

      <div class="m-grid m-grid-4 goods-grid">
        <article v-for="item in activeSession.items" :key="item.id" class="flash-card">
          <div class="flash-thumb" @click="router.push(`/product/${item.productId}`)">
            <span>⚡</span>
            <i class="flash-flag">秒杀</i>
            <i v-if="Number(item.remainStock) <= 0" class="sold-out">已抢光</i>
          </div>
          <div class="flash-bd">
            <div class="pc-name" :title="item.productName" @click="router.push(`/product/${item.productId}`)">
              {{ item.productName }}
            </div>
            <div class="muted small">{{ item.unit ? `规格：${item.unit}` : '产地直供' }}</div>
            <div class="progress">
              <span class="bar"><i :style="{ width: soldPercent(item) + '%' }" /></span>
              <small class="num">已抢 {{ soldPercent(item) }}%</small>
            </div>
            <div class="price-row">
              <span class="price"><span class="cur">¥</span>{{ money(item.salePrice) }}</span>
              <span class="cost">¥{{ money(item.originalPrice) }}</span>
              <span class="muted small num">剩 {{ item.remainStock ?? 0 }} 件</span>
            </div>
            <button
              type="button"
              class="m-btn primary sm block"
              :disabled="Number(item.remainStock) <= 0 || sessionState(activeSession) === 'ended'"
              @click="router.push(`/product/${item.productId}`)"
            >
              {{ buttonText(item, activeSession) }}
            </button>
          </div>
        </article>
      </div>
    </section>

    <EmptyBlock
      v-else-if="!loading"
      icon="⏰"
      title="当前没有秒杀场次"
      desc="秒杀场次由平台运营端配置（商品、秒杀价、场次时间、活动库存），配置后才会在这里开放；供应商与消费者都不能自行发起。"
    >
      <template #actions>
        <button type="button" class="m-btn primary" @click="router.push('/products')">去逛逛好货</button>
      </template>
    </EmptyBlock>

    <p class="note muted small">
      进度条按「（活动总库存 − 剩余库存）/ 活动总库存」计算，只用后端返回的 totalStock 与 remainStock，不含任何预估数据。
    </p>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { consumerApi } from '../api'
import { dateOnly, dateTime, money, soldPercent } from '../utils/format'
import EmptyBlock from '../components/EmptyBlock.vue'
import Countdown from '../components/Countdown.vue'

const router = useRouter()

const loading = ref(false)
const flashSales = ref([])
const activeKey = ref('')
const now = ref(Date.now())
let timer = null

function toTs(value) {
  if (!value) return 0
  const ts = new Date(String(value).replace(' ', 'T')).getTime()
  return Number.isNaN(ts) ? 0 : ts
}

/** 场次 key：开始的「日期 + 小时」，与运营端配置的整点场次一一对应。 */
function sessionKey(startTime) {
  const date = dateOnly(startTime)
  const hour = String(startTime || '').replace('T', ' ').slice(11, 13)
  return `${date} ${hour || '00'}`
}

/** 场次标签：如「10-20 00:00 场」。 */
function sessionLabel(startTime) {
  const date = dateOnly(startTime)
  const hour = String(startTime || '').replace('T', ' ').slice(11, 13) || '00'
  return `${date.slice(5)} ${hour}:00`
}

const sessions = computed(() => {
  const map = new Map()
  for (const item of flashSales.value) {
    const key = sessionKey(item.startTime)
    if (!map.has(key)) {
      map.set(key, {
        key,
        label: sessionLabel(item.startTime),
        startTime: item.startTime,
        endTime: item.endTime,
        items: [],
      })
    }
    const session = map.get(key)
    session.items.push(item)
    // 同场次取最晚结束时间作为倒计时目标
    if (toTs(item.endTime) > toTs(session.endTime)) session.endTime = item.endTime
  }
  // 按开始时间倒序：最新的场次在前
  return [...map.values()].sort((a, b) => toTs(b.startTime) - toTs(a.startTime))
})

const activeSession = computed(() => sessions.value.find((item) => item.key === activeKey.value) || null)

/** 场次状态：upcoming / ongoing / ended，全部按开始-结束时间比较，不依赖后端 status 文案。 */
function sessionState(session) {
  const start = toTs(session.startTime)
  const end = toTs(session.endTime)
  if (!start || !end) return 'unknown'
  if (now.value < start) return 'upcoming'
  if (now.value > end) return 'ended'
  return 'ongoing'
}

function sessionStatusText(session) {
  const state = sessionState(session)
  if (state === 'ongoing') return '进行中'
  if (state === 'upcoming') return '即将开始'
  if (state === 'ended') return '已结束'
  return '—'
}

function sessionTagClass(session) {
  const state = sessionState(session)
  if (state === 'ongoing') return ''
  if (state === 'upcoming') return 'amber'
  return 'plain'
}

function buttonText(item, session) {
  if (sessionState(session) === 'ended') return '本场已结束'
  if (Number(item.remainStock) <= 0) return '已抢光'
  if (sessionState(session) === 'upcoming') return '即将开始'
  return '马上抢'
}

async function load() {
  loading.value = true
  now.value = Date.now()
  try {
    const data = await consumerApi.getMarketing()
    flashSales.value = data?.flashSales || []
    // 默认选中第一个「进行中」的场次；没有进行中则退回第一个（时间最新的）场次
    const ongoing = sessions.value.find((session) => sessionState(session) === 'ongoing')
    activeKey.value = ongoing?.key || sessions.value[0]?.key || ''
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '秒杀场次加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  load()
  // 每 60 秒刷新一次「当前时间」，让场次状态与按钮文案跟着走
  timer = setInterval(() => {
    now.value = Date.now()
  }, 60000)
})

onBeforeUnmount(() => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
})
</script>

<style scoped>
.m-container {
  width: min(1280px, calc(100% - 48px));
  margin: 18px auto 0;
}

.sessions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
  padding: 10px;
}

.session-tab {
  display: grid;
  gap: 2px;
  min-width: 132px;
  padding: 8px 14px;
  border: 1px solid #e3eae5;
  border-radius: 10px;
  background: #fff;
  text-align: left;
  cursor: pointer;
  transition: border-color .15s, background .15s, box-shadow .15s;
}

.session-tab:hover {
  border-color: #bfe0cd;
}

.session-tab.on {
  border-color: #12764a;
  background: #f1fbf5;
  box-shadow: 0 4px 12px rgba(18, 118, 74, .1);
}

.session-tab b {
  color: #0b1a12;
  font-size: 13.5px;
  font-weight: 700;
}

.session-tab.on b {
  color: #12764a;
}

.session-tab small {
  color: #93a29a;
  font-size: var(--agri-font-size-micro);
}

.active-card {
  padding: 16px 20px 20px;
}

.active-hd {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 14px;
  border-bottom: 1px solid #eef3ef;
}

.active-hd h2 {
  margin: 0;
  font-size: 16.5px;
  font-weight: 800;
}

.active-hd p {
  margin: 2px 0 0;
}

.goods-grid {
  margin-top: 16px;
}

.flash-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #f1ddd3;
  border-radius: 12px;
  background: #fff;
  transition: border-color .15s, box-shadow .15s;
}

.flash-card:hover {
  border-color: #e8c6b6;
  box-shadow: 0 8px 22px rgba(4, 31, 20, .05);
}

.flash-thumb {
  position: relative;
  display: grid;
  place-items: center;
  height: 130px;
  background: linear-gradient(135deg, #fff2ea, #ffe2d2);
  font-size: 34px;
  cursor: pointer;
}

.flash-flag {
  position: absolute;
  top: 10px;
  left: 10px;
  padding: 2px 8px;
  border-radius: 6px;
  background: #d45b32;
  color: #fff;
  font-size: var(--agri-font-size-micro);
  font-style: normal;
  font-weight: 700;
}

.sold-out {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(11, 26, 18, .46);
  color: #fff;
  font-size: 15px;
  font-style: normal;
  font-weight: 700;
  letter-spacing: 2px;
}

.flash-bd {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px 14px;
}

.progress {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress .bar {
  flex: 1;
  overflow: hidden;
  height: 6px;
  border-radius: 4px;
  background: #fdece4;
}

.progress .bar i {
  display: block;
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, #f0a06f, #d45b32);
}

.progress small {
  color: #d45b32;
  font-size: var(--agri-font-size-micro);
}

.price-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: auto;
}

.price-row .muted {
  margin-left: auto;
}

.note {
  margin: 16px 0 0;
  line-height: 1.8;
}

@media (max-width: 1180px) {
  .goods-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (max-width: 960px) {
  .goods-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
