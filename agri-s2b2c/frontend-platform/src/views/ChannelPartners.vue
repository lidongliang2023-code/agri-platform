<template>
  <div class="channels-page">
    <div class="page-head">
      <div>
        <h2>商家列表与分层</h2>
        <p>按渠道聚合近 30 天经营表现；复购率、售后率为渠道内真实订单口径，健康度仅作运营标记（非平台评分）。</p>
      </div>
    </div>

    <div class="stat-row">
      <div class="stat-card"><span>渠道总数</span><b>{{ summary.channels || 0 }}</b><small>含待审核 / 已驳回</small></div>
      <div class="stat-card"><span>近 30 天有成交</span><b>{{ summary.active30 || 0 }}</b><small>活跃渠道</small></div>
      <div class="stat-card"><span>沉默渠道</span><b>{{ summary.sleeping || 0 }}</b><small>30 天无成交</small></div>
      <div class="stat-card"><span>售后风险</span><b>{{ summary.risk || 0 }}</b><small>售后率 &gt; 5%</small></div>
      <div class="stat-card"><span>30 天 GMV</span><b>¥{{ money(summary.gmv30) }}</b><small>非取消订单</small></div>
    </div>

    <AgriElementListTable
      :columns="columns"
      :data="rows"
      row-key="id"
      :loading="loading"
      :page="page"
      :page-size="size"
      :total="total"
      column-settings-storage-key="agri-s2b2c-platform:channel-partners"
      empty-text="当前筛选条件下没有商家"
      @page-change="handlePageChange"
      @refresh="load"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="3" :loading="loading" @search="search" @reset="reset">
          <div class="agri-vue-filter-field">
            <label>关键字</label>
            <el-input v-model="keyword" placeholder="搜索店铺/公司/联系人/手机" clearable @keyup.enter="search" />
          </div>
          <div class="agri-vue-filter-field">
            <label>等级</label>
            <el-select v-model="grade" placeholder="全部">
              <el-option label="全部" value="" />
              <el-option label="铜牌" value="LEVEL_1" />
              <el-option label="银牌" value="LEVEL_2" />
              <el-option label="金牌" value="LEVEL_3" />
            </el-select>
          </div>
          <div class="agri-vue-filter-field">
            <label>审核状态</label>
            <el-select v-model="auditStatus" placeholder="全部">
              <el-option label="全部" value="" />
              <el-option label="待审核" value="PENDING" />
              <el-option label="已通过" value="APPROVED" />
              <el-option label="已驳回" value="REJECTED" />
            </el-select>
          </div>
        </AgriVueFilterBar>
      </template>

      <template #toolbar-left>
        <el-button type="primary" @click="$router.push('/channel-onboard')">入驻审核</el-button>
      </template>

      <template #cell-channel="{ row }">
        <b>{{ row.shopName || row.companyName || '未命名渠道' }}</b><br>
        <small>{{ row.id }}</small>
      </template>
      <template #cell-region="{ row }">{{ [row.province, row.city].filter(Boolean).join(' ') || '—' }}</template>
      <template #cell-grade="{ row }"><el-tag>{{ gradeText(row.grade) }}</el-tag></template>
      <template #cell-gmv30="{ row }">¥{{ money(row.gmv30) }}</template>
      <template #cell-gmvTotal="{ row }">¥{{ money(row.gmvTotal) }}</template>
      <template #cell-repeatRate="{ row }">{{ Number(row.repeatRate || 0).toFixed(1) }}%</template>
      <template #cell-afterSaleRate="{ row }">{{ Number(row.afterSaleRate || 0).toFixed(1) }}%</template>
      <template #cell-auditStatus="{ row }">
        <el-tag :type="auditType(row.auditStatus)">{{ auditText(row.auditStatus) }}</el-tag>
      </template>
      <template #cell-health="{ row }">
        <el-tag :type="healthType(row.health)">{{ healthText(row.health) }}</el-tag>
      </template>
      <template #cell-actions="{ row }">
        <AgriVueRowActions :actions="[{ key: 'detail', label: '详情', onClick: () => $router.push(`/channel-partner-detail/${row.id}`) }]" />
      </template>
    </AgriElementListTable>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { AgriElementListTable, AgriVueFilterBar, AgriVueRowActions } from '@agri/shared/vue/element'
import { platformApi } from '../api'

const keyword = ref('')
const grade = ref('')
const auditStatus = ref('')
const rows = ref([])
const summary = ref({})
const loading = ref(false)
const page = ref(1)
const size = ref(20)
const total = ref(0)

const columns = [
  { key: 'channel', prop: 'shopName', label: '渠道', minWidth: 180 },
  { key: 'region', label: '区域', width: 150 },
  { key: 'grade', prop: 'grade', label: '等级', width: 100 },
  { key: 'gmv30', prop: 'gmv30', label: '30 天 GMV', width: 125 },
  { key: 'orders30', prop: 'orders30', label: '30 天订单', width: 100 },
  { key: 'gmvTotal', prop: 'gmvTotal', label: '累计 GMV', width: 125 },
  { key: 'repeatRate', prop: 'repeatRate', label: '复购率', width: 100 },
  { key: 'afterSaleRate', prop: 'afterSaleRate', label: '售后率', width: 100 },
  { key: 'productCount', prop: 'productCount', label: '在售商品', width: 100 },
  { key: 'auditStatus', prop: 'auditStatus', label: '审核', width: 100 },
  { key: 'health', prop: 'health', label: '健康度', width: 110 },
  { key: 'actions', label: '操作', width: 100 },
]

onMounted(load)

async function load() {
  loading.value = true
  try {
    const data = (await platformApi.getChannelPerformance({
      page: page.value,
      size: size.value,
      keyword: keyword.value.trim() || undefined,
      grade: grade.value || undefined,
      status: auditStatus.value || undefined,
    })) || {}
    rows.value = data.records || []
    summary.value = data.summary || {}
    total.value = Number(data.total || 0)
  } catch (e) {
    rows.value = []
    total.value = 0
    ElMessage.error(e?.message || '渠道经营数据读取失败')
  } finally {
    loading.value = false
  }
}

function search() {
  page.value = 1
  load()
}

function reset() {
  keyword.value = ''
  grade.value = ''
  auditStatus.value = ''
  page.value = 1
  load()
}

function handlePageChange(nextPage, nextSize) {
  page.value = nextPage
  size.value = nextSize
  load()
}

const money = (value) => Number(value || 0).toFixed(2)
const gradeText = (value) => ({ LEVEL_1: '铜牌', LEVEL_2: '银牌', LEVEL_3: '金牌' }[value] || value || '未定级')
const auditText = (value) => ({ PENDING: '待审核', APPROVED: '已通过', REJECTED: '已驳回' }[value] || value)
const auditType = (value) => ({ PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger' }[value] || 'info')
const healthText = (value) => ({ HEALTHY: '优质', NORMAL: '正常', RISK: '售后风险', SLEEPING: '沉默' }[value] || value)
const healthType = (value) => ({ HEALTHY: 'success', NORMAL: 'primary', RISK: 'danger', SLEEPING: 'info' }[value] || 'info')
</script>

<style scoped>
.channels-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 780px; }
.stat-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; }
.stat-card { display: flex; flex-direction: column; gap: 6px; padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.stat-card span { color: #84938a; font-size: 12px; }
.stat-card b { color: #173e2a; font-size: 22px; }
.stat-card small { color: #94a198; font-size: 12px; }
@media (max-width: 1200px) { .stat-row { grid-template-columns: repeat(2, 1fr); } }
</style>
