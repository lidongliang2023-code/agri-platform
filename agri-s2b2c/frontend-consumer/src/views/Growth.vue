<template>
  <div class="m-container" v-loading="loading">
    <div class="m-page-hd">
      <h1>成长值明细</h1>
      <span class="sub">成长值来自已完成订单的消费金额，每消费 1 元计 1 点（取整）</span>
      <div class="hd-actions">
        <button type="button" class="m-btn sm" @click="router.push('/member')">‹ 返回会员中心</button>
      </div>
    </div>

    <!-- 未登录 -->
    <EmptyBlock
      v-if="userStore.booted && !userStore.consumerId"
      icon="🔐"
      title="登录后查看成长值"
      desc="成长值按消费者账号累计。当前浏览器没有检测到已登录的统一身份，请从统一门户登录后再进入商城。"
    >
      <template #actions>
        <button type="button" class="m-btn primary" @click="router.push('/')">返回首页</button>
      </template>
    </EmptyBlock>

    <template v-else>
      <!-- 三个指标 -->
      <div class="m-grid m-grid-3 metrics">
        <div class="m-card metric">
          <span class="muted small">当前成长值</span>
          <b class="num">{{ data.growth ?? 0 }}</b>
          <small class="muted">{{ memberLevelText(data.level) }}</small>
        </div>
        <div class="m-card metric">
          <span class="muted small">累计消费</span>
          <b class="num">¥{{ money(data.totalConsume) }}</b>
          <small class="muted">成长值即累计消费取整</small>
        </div>
        <div class="m-card metric">
          <span class="muted small">当前等级</span>
          <b>{{ memberLevelText(data.level) }}</b>
          <small class="muted">
            {{ data.nextLevel ? `下一等级 ${memberLevelText(data.nextLevel)}（${data.nextThreshold ?? '—'} 成长值）` : '已是最高等级' }}
          </small>
        </div>
      </div>

      <!-- 明细 -->
      <section class="m-card table-card">
        <header class="m-card-hd">
          <h3>成长值流水</h3>
          <span class="hd-actions muted small">仅展示订单类成长记录，按时间倒序</span>
        </header>

        <el-table v-if="records.length" :data="records" size="default">
          <el-table-column label="时间" min-width="160">
            <template #default="{ row }">{{ dateTime(row.time) }}</template>
          </el-table-column>
          <el-table-column label="类型" min-width="100">
            <template #default="{ row }">
              <span class="m-tag plain">{{ typeText(row.type) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="说明" min-width="240">
            <template #default="{ row }">{{ row.description || '—' }}</template>
          </el-table-column>
          <el-table-column label="成长值" min-width="110" align="right">
            <template #default="{ row }">
              <span class="num" :class="Number(row.value) >= 0 ? 'up' : 'down'">
                {{ Number(row.value) > 0 ? '+' : '' }}{{ row.value ?? 0 }}
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
          icon="📈"
          title="暂无成长值记录"
          desc="成长值来自已完成订单，订单完成时后端写入一条订单类流水。当前账号还没有累计记录，下单并确认收货后即可在此查看。"
        >
          <template #actions>
            <button type="button" class="m-btn primary" @click="router.push('/products')">去逛逛好货</button>
          </template>
        </EmptyBlock>

        <p class="table-note muted small">
          表格由后端复用积分流水的「订单」类记录生成：<code>value</code> 是下单获得/扣减的积分，<code>balance</code> 是记录的积分余额，
          与顶部「当前成长值」（累计消费取整）口径不同，页面不做换算，仅如实展示后端返回的两个字段。
        </p>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { consumerApi } from '../api'
import { useUserStore } from '../stores/user'
import { dateTime, memberLevelText, money } from '../utils/format'
import EmptyBlock from '../components/EmptyBlock.vue'

const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const data = ref({ growth: 0, totalConsume: 0, level: 'NORMAL', nextLevel: null, nextThreshold: null, records: [] })

const records = computed(() => data.value.records || [])

/** 成长值流水只有 ORDER 一种来源（后端固定过滤），这里做中文映射兜底。 */
function typeText(type) {
  if (type === 'ORDER') return '订单'
  if (type === 'SIGN_IN') return '签到'
  if (type === 'EXCHANGE') return '兑换'
  return type || '—'
}

async function load() {
  if (!userStore.consumerId) {
    data.value = { growth: 0, totalConsume: 0, level: 'NORMAL', nextLevel: null, nextThreshold: null, records: [] }
    return
  }
  loading.value = true
  try {
    const res = await consumerApi.getGrowth(userStore.consumerId)
    data.value = res || { growth: 0, totalConsume: 0, level: 'NORMAL', nextLevel: null, nextThreshold: null, records: [] }
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '成长值加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(load)

// 统一身份异步换回消费者 ID：拿到后再查成长值，避免直接进入本页时误判「未登录」
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

.metrics {
  align-items: stretch;
}

.metric {
  display: grid;
  gap: 3px;
  padding: 18px 20px;
}

.metric b {
  color: #0b1a12;
  font-size: 24px;
  font-weight: 800;
  line-height: 1.3;
}

.metric small {
  font-size: 12px;
}

.table-card {
  margin-top: 16px;
  overflow: hidden;
}

.table-card :deep(.el-table) {
  border-bottom: 1px solid #e3eae5;
}

.up {
  color: #12764a;
  font-weight: 700;
}

.down {
  color: #c94b4b;
  font-weight: 700;
}

.table-note {
  margin: 0;
  padding: 14px 22px 18px;
  line-height: 1.85;
}

.table-note code {
  padding: 1px 5px;
  border-radius: 4px;
  background: #f1f5f2;
  color: #12764a;
  font-size: 12px;
}
</style>
