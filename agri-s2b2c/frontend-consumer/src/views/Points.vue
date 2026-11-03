<template>
  <div class="m-container" v-loading="loading">
    <div class="m-page-hd">
      <h1>我的积分</h1>
      <span class="sub">签到与订单会累计积分，积分可在积分商城兑换优惠券</span>
      <div class="hd-actions">
        <button type="button" class="m-btn sm" @click="load">刷新</button>
      </div>
    </div>

    <!-- 未登录 -->
    <EmptyBlock
      v-if="userStore.booted && !userStore.consumerId"
      icon="🔐"
      title="登录后查看积分"
      desc="积分按消费者账号累计与消耗。当前浏览器没有检测到已登录的统一身份，请从统一门户登录后再进入商城。"
    >
      <template #actions>
        <button type="button" class="m-btn primary" @click="router.push('/')">返回首页</button>
      </template>
    </EmptyBlock>

    <template v-else>
      <!-- 积分卡 -->
      <section class="m-card point-card">
        <div class="pc-left">
          <span class="muted small">当前可用积分</span>
          <b class="num">{{ userStore.user?.points ?? 0 }}</b>
          <small class="muted">积分不可提现、不可转赠</small>
        </div>
        <div class="pc-right">
          <button type="button" class="m-btn primary" @click="router.push('/points-mall')">积分商城</button>
          <button type="button" class="m-btn ghost" @click="router.push('/signin')">去签到</button>
        </div>
      </section>

      <!-- 明细 -->
      <section class="m-card list-card">
        <header class="list-hd">
          <div class="m-row-wrap tabs">
            <button
              v-for="item in TABS"
              :key="item.value"
              type="button"
              class="seg"
              :class="{ on: tab === item.value }"
              @click="switchTab(item.value)"
            >
              {{ item.label }}
              <span class="seg-num num">{{ countOf(item.value) }}</span>
            </button>
          </div>
          <span class="m-spacer" />
          <span class="muted small">共 <b class="num">{{ filtered.length }}</b> 条</span>
        </header>

        <el-table v-if="paged.length" :data="paged" size="default">
          <el-table-column label="时间" min-width="160">
            <template #default="{ row }">{{ dateTime(row.createTime) }}</template>
          </el-table-column>
          <el-table-column label="类型" min-width="100">
            <template #default="{ row }">
              <span class="m-tag" :class="tagClass(row.type)">{{ typeText(row.type) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="说明" min-width="240">
            <template #default="{ row }">{{ row.reason || '—' }}</template>
          </el-table-column>
          <el-table-column label="积分变动" min-width="120" align="right">
            <template #default="{ row }">
              <span class="num delta" :class="Number(row.points) >= 0 ? 'up' : 'down'">
                {{ Number(row.points) > 0 ? '+' : '' }}{{ row.points ?? 0 }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="余额" min-width="110" align="right">
            <template #default="{ row }">
              <span class="num">{{ row.balance ?? '—' }}</span>
            </template>
          </el-table-column>
        </el-table>

        <EmptyBlock
          v-else-if="!loading"
          icon="⭐"
          :title="emptyTitle"
          :desc="emptyDesc"
        >
          <template #actions>
            <div class="m-row-wrap">
              <button type="button" class="m-btn primary" @click="router.push('/signin')">去签到得积分</button>
              <button type="button" class="m-btn" @click="router.push('/points-mall')">去积分商城</button>
            </div>
          </template>
        </EmptyBlock>

        <el-pagination
          v-if="filtered.length > PAGE_SIZE"
          class="pager"
          layout="prev, pager, next, total"
          :total="filtered.length"
          :page-size="PAGE_SIZE"
          :current-page="page"
          @current-change="changePage"
        />
      </section>

      <p class="note muted small">
        积分流水的「类型」只有后端真实存在的三种：签到（SIGN_IN）、订单（ORDER）、兑换（EXCHANGE）。
        「获得 / 使用」是按积分变动的正负在前端筛分，接口本身按时间倒序分页返回。      </p>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { consumerApi } from '../api'
import { useUserStore } from '../stores/user'
import { dateTime } from '../utils/format'
import EmptyBlock from '../components/EmptyBlock.vue'

const router = useRouter()
const userStore = useUserStore()

/** 后端 type 只有 SIGN_IN / ORDER / EXCHANGE 三种；tab 按积分正负筛分，不按 type 硬套成三档。 */
const TABS = [
  { label: '全部明细', value: 'ALL' },
  { label: '获得', value: 'IN' },
  { label: '使用', value: 'OUT' },
]

const PAGE_SIZE = 10
const FETCH_SIZE = 100

const loading = ref(false)
const logs = ref([])
const tab = ref('ALL')
const page = ref(1)

const filtered = computed(() => {
  if (tab.value === 'IN') return logs.value.filter((row) => Number(row.points) > 0)
  if (tab.value === 'OUT') return logs.value.filter((row) => Number(row.points) < 0)
  return logs.value
})

const paged = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return filtered.value.slice(start, start + PAGE_SIZE)
})

const emptyTitle = computed(() => {
  if (tab.value === 'IN') return '暂无积分获得记录'
  if (tab.value === 'OUT') return '暂无积分使用记录'
  return '暂无积分明细'
})

const emptyDesc = computed(() => {
  if (tab.value === 'IN') {
    return '积分由每日签到（+5 分）与订单完成后的后端发放产生。当前账号还没有获得记录，去签到试试。'
  }
  if (tab.value === 'OUT') {
    return '积分消耗只发生在积分商城兑换优惠券。当前账号还没有兑换记录，兑换后可在这里看到负数流水。'
  }
  return '积分来自每日签到与订单，消耗发生在积分商城兑换。当前账号还没有任何积分流水，先去签到得第一笔积分。'
})

function countOf(value) {
  if (value === 'IN') return logs.value.filter((row) => Number(row.points) > 0).length
  if (value === 'OUT') return logs.value.filter((row) => Number(row.points) < 0).length
  return logs.value.length
}

function typeText(type) {
  if (type === 'SIGN_IN') return '签到'
  if (type === 'ORDER') return '订单'
  if (type === 'EXCHANGE') return '兑换'
  return type || '—'
}

function tagClass(type) {
  if (type === 'SIGN_IN') return ''
  if (type === 'ORDER') return 'blue'
  if (type === 'EXCHANGE') return 'amber'
  return 'plain'
}

function switchTab(value) {
  tab.value = value
  page.value = 1
}

function changePage(next) {
  page.value = next
}

/**
 * 一次性把流水取全，前端做正负筛分 + 分页：
 * 接口不支持按积分正负过滤，若只取当前页会在「获得 / 使用」里漏数据。
 * 每页 100 条（后端上限），最多取 10 页，避免异常数据把请求拖长。
 */
async function loadLogs() {
  const first = await consumerApi.getPointsLogs({
    consumerId: userStore.consumerId,
    page: 1,
    size: FETCH_SIZE,
  })
  let rows = first?.records || []
  const total = Number(first?.total || 0)
  let current = 1
  while (rows.length < total && current < 10) {
    current += 1
    const next = await consumerApi.getPointsLogs({
      consumerId: userStore.consumerId,
      page: current,
      size: FETCH_SIZE,
    })
    const pageRows = next?.records || []
    if (!pageRows.length) break
    rows = rows.concat(pageRows)
  }
  logs.value = rows
}

async function load() {
  if (!userStore.consumerId) {
    logs.value = []
    return
  }
  loading.value = true
  try {
    // 先刷新档案拿最新积分余额，再取流水明细
    await Promise.all([userStore.refreshProfile(), loadLogs()])
    if ((page.value - 1) * PAGE_SIZE >= filtered.value.length) page.value = 1
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '积分明细加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(load)

// 统一身份异步换回消费者 ID：拿到后再取积分与流水，避免直接进入本页时误判「未登录」
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

.point-card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  padding: 20px 22px;
  background: linear-gradient(120deg, #f4fbf7, #ffffff 62%);
}

.pc-left {
  display: grid;
  gap: 2px;
}

.pc-left b {
  color: #12764a;
  font-size: 34px;
  font-weight: 800;
  line-height: 1.2;
}

.pc-left small {
  font-size: 12px;
}

.pc-right {
  display: flex;
  gap: 10px;
  margin-left: auto;
}

.list-card {
  margin-top: 16px;
  overflow: hidden;
}

.list-hd {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  border-bottom: 1px solid #eef3ef;
}

.tabs {
  gap: 6px;
}

.seg {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 14px;
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

.delta {
  font-weight: 700;
}

.up {
  color: #12764a;
}

.down {
  color: #c94b4b;
}

.pager {
  padding: 0 18px 16px;
}

.note {
  margin: 16px 0 0;
  line-height: 1.85;
}
</style>
