<template>
  <div class="report-page">
    <div class="page-head">
      <div>
        <h2>佣金明细报表</h2>
        <p>渠道佣金逐笔明细，可按渠道与结算状态筛选；批次号与结算时间用于财务核对。</p>
      </div>
      <el-button @click="load">刷新</el-button>
    </div>

    <div class="stat-row">
      <div class="stat-card"><span>已结算</span><b>¥{{ money(summary.settled) }}</b><small>SETTLED 金额合计</small></div>
      <div class="stat-card"><span>待结算</span><b>¥{{ money(summary.pending) }}</b><small>PENDING 金额合计</small></div>
      <div class="stat-card"><span>佣金笔数</span><b>{{ summary.total || 0 }}</b><small>当前筛选口径</small></div>
    </div>

    <div class="filter-bar">
      <el-input v-model="channelId" placeholder="渠道 ID" style="width: 200px" clearable />
      <el-select v-model="status" placeholder="结算状态" style="width: 150px">
        <el-option label="全部" value="" />
        <el-option label="待结算" value="PENDING" />
        <el-option label="已结算" value="SETTLED" />
      </el-select>
      <el-button type="primary" @click="search">查询</el-button>
    </div>

    <el-table :data="rows" border>
      <el-table-column prop="orderNo" label="订单号" min-width="190" />
      <el-table-column prop="channelName" label="渠道" min-width="150" />
      <el-table-column label="佣金" width="110">
        <template #default="{ row }">¥{{ money(row.amount) }}</template>
      </el-table-column>
      <el-table-column label="比例" width="90">
        <template #default="{ row }">{{ Number(row.rate) }}%</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'SETTLED' ? 'success' : 'warning'">
            {{ row.status === 'SETTLED' ? '已结算' : '待结算' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="settleBatchNo" label="结算批次" width="190" show-overflow-tooltip />
      <el-table-column prop="remark" label="说明" min-width="120" show-overflow-tooltip />
      <el-table-column prop="settleTime" label="结算时间" width="180" />
      <el-table-column prop="createTime" label="产生时间" width="180" />
    </el-table>
    <el-empty v-if="!rows.length" description="当前筛选下没有佣金记录" />
    <el-pagination
      v-model:current-page="page"
      :page-size="size"
      :total="total"
      layout="prev, pager, next, jumper"
      @current-change="load"
    />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { platformApi } from '../api'

const channelId = ref('')
const status = ref('')
const rows = ref([])
const summary = ref({})
const page = ref(1)
const size = ref(10)
const total = ref(0)

onMounted(load)

async function load() {
  try {
    const data = (await platformApi.getCommissions({
      page: page.value,
      size: size.value,
      channelId: channelId.value.trim() || undefined,
      status: status.value || undefined,
    })) || {}
    rows.value = data.records || []
    total.value = data.total || 0
    summary.value = data.summary || {}
  } catch (e) {
    rows.value = []
    total.value = 0
    ElMessage.error(e?.message || '佣金报表读取失败')
  }
}

function search() {
  page.value = 1
  load()
}

const money = (value) => Number(value || 0).toFixed(2)
</script>

<style scoped>
.report-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 780px; }
.stat-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; max-width: 820px; }
.stat-card { display: flex; flex-direction: column; gap: 6px; padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.stat-card span { color: #84938a; font-size: 12px; }
.stat-card b { color: #173e2a; font-size: 22px; }
.stat-card small { color: #94a198; font-size: 12px; }
.filter-bar { display: flex; gap: 10px; align-items: center; }
</style>
