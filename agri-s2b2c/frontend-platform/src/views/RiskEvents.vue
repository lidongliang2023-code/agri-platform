<template>
  <div class="risk-events-page">
    <div class="page-head">
      <div>
        <h2>风控事件</h2>
        <p>基于真实订单、售后与价盘数据计算的信号，仅用于人工复核；不自动拦截订单或限制账号。</p>
      </div>
      <el-button @click="load">刷新</el-button>
    </div>

    <div class="stat-row">
      <div class="stat-card"><span>事件总数</span><b>{{ summary.total || 0 }}</b><small>当前阈值下</small></div>
      <div class="stat-card"><span>高危</span><b class="danger">{{ summary.high || 0 }}</b><small>需优先复核</small></div>
      <div class="stat-card"><span>中风险</span><b class="warn">{{ summary.medium || 0 }}</b><small>常规复核</small></div>
      <div class="stat-card"><span>启用规则</span><b>{{ summary.activeRules || 0 }}</b><small>可在风控规则调整</small></div>
      <div class="stat-card"><span>已处置</span><b>{{ summary.handled || 0 }}</b><small>复核 / 忽略留痕</small></div>
    </div>

    <div class="filter-bar">
      <el-select v-model="ruleCode" placeholder="规则类型" style="width: 260px" @change="load">
        <el-option label="全部规则" value="" />
        <el-option v-for="rule in rules" :key="rule.code" :label="rule.name" :value="rule.code" />
      </el-select>
      <el-button @click="$router.push('/risk-rules')">风控规则</el-button>
    </div>

    <el-table :data="rows" border>
      <el-table-column label="等级" width="100">
        <template #default="{ row }">
          <el-tag :type="row.level === 'HIGH' ? 'danger' : 'warning'">{{ row.level === 'HIGH' ? '高危' : '中风险' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="ruleName" label="规则" width="200" />
      <el-table-column prop="subject" label="对象" min-width="190" show-overflow-tooltip />
      <el-table-column prop="evidence" label="证据" min-width="260" show-overflow-tooltip />
      <el-table-column label="金额" width="110">
        <template #default="{ row }">{{ Number(row.amount) > 0 ? `¥${money(row.amount)}` : '—' }}</template>
      </el-table-column>
      <el-table-column label="发生时间" width="180">
        <template #default="{ row }">{{ row.occurredAt || '持续状态' }}</template>
      </el-table-column>
      <el-table-column prop="actionNote" label="建议" min-width="180" show-overflow-tooltip />
      <el-table-column label="处置" width="110">
        <template #default="{ row }">
          <el-tag :type="row.handleStatus === 'HANDLED' ? 'success' : row.handleStatus === 'IGNORED' ? 'info' : 'warning'">
            {{ row.handleStatus === 'HANDLED' ? '已复核' : row.handleStatus === 'IGNORED' ? '已忽略' : '待处理' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="handleRemark" label="处置意见" min-width="140" show-overflow-tooltip />
      <el-table-column label="操作" width="170" fixed="right">
        <template #default="{ row }">
          <template v-if="row.handleStatus === 'PENDING'">
            <el-button link type="primary" @click="handle(row, 'HANDLED')">标记复核</el-button>
            <el-button link type="info" @click="handle(row, 'IGNORED')">忽略</el-button>
          </template>
          <span v-else class="muted">{{ row.handleOperator }} {{ row.handleTime }}</span>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!rows.length" description="当前阈值下没有风险信号" />
    <p class="note">{{ note }}</p>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { platformApi } from '../api'

const rows = ref([])
const rules = ref([])
const summary = ref({})
const note = ref('')
const ruleCode = ref('')

onMounted(async () => {
  try {
    rules.value = (await platformApi.getRiskRules()) || []
  } catch {
    rules.value = []
  }
  await load()
})

async function load() {
  try {
    const data = (await platformApi.getRiskEvents(ruleCode.value || undefined)) || {}
    rows.value = data.records || []
    summary.value = data.summary || {}
    note.value = data.note || ''
  } catch (e) {
    rows.value = []
    ElMessage.error(e?.message || '风险事件读取失败')
  }
}

async function handle(row, status) {
  let remark = ''
  try {
    const result = await ElMessageBox.prompt(
      status === 'HANDLED' ? '可填写复核结论（选填）' : '可填写忽略原因（选填）',
      status === 'HANDLED' ? '标记已复核' : '忽略事件',
      { inputPlaceholder: '选填', confirmButtonText: '确认', cancelButtonText: '取消' },
    )
    remark = result.value || ''
  } catch {
    return
  }
  try {
    const res = await platformApi.handleRiskEvent({ eventKey: row.eventKey, status, remark })
    if (res?.success === false) return ElMessage.error(res.message || '处置失败')
    ElMessage.success(res?.message || '已记录处置')
    await load()
  } catch (e) {
    ElMessage.error(e?.message || '处置失败')
  }
}

const money = (value) => Number(value || 0).toFixed(2)
</script>

<style scoped>
.risk-events-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 820px; }
.stat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.stat-card { display: flex; flex-direction: column; gap: 6px; padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.stat-card span { color: #84938a; font-size: 12px; }
.stat-card b { color: #173e2a; font-size: 24px; }
.stat-card b.danger { color: #c54b4b; }
.stat-card b.warn { color: #a96a08; }
.stat-card small { color: #94a198; font-size: 12px; }
.filter-bar { display: flex; gap: 10px; align-items: center; }
.note { margin: 0; color: #84938a; font-size: 12px; line-height: 1.7; }
.muted { color: #94a198; font-size: var(--agri-font-size-micro); }
@media (max-width: 1000px) { .stat-row { grid-template-columns: repeat(2, 1fr); } }
</style>
