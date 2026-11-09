<template>
  <div class="channels-page">
    <div class="page-head">
      <div>
        <h2>商家列表与分层</h2>
        <p>按渠道聚合近 30 天经营表现；复购率、售后率为渠道内真实订单口径，健康度仅作运营标记（非平台评分）。</p>
      </div>
      <el-button @click="$router.push('/channel-onboard')">入驻审核</el-button>
    </div>

    <div class="stat-row">
      <div class="stat-card"><span>渠道总数</span><b>{{ summary.channels || 0 }}</b><small>含待审核 / 已驳回</small></div>
      <div class="stat-card"><span>近 30 天有成交</span><b>{{ summary.active30 || 0 }}</b><small>活跃渠道</small></div>
      <div class="stat-card"><span>沉默渠道</span><b>{{ summary.sleeping || 0 }}</b><small>30 天无成交</small></div>
      <div class="stat-card"><span>售后风险</span><b>{{ summary.risk || 0 }}</b><small>售后率 &gt; 5%</small></div>
      <div class="stat-card"><span>30 天 GMV</span><b>¥{{ money(summary.gmv30) }}</b><small>非取消订单</small></div>
    </div>

    <div class="filter-bar">
      <el-input v-model="keyword" placeholder="搜索店铺/公司/联系人/手机" style="width: 280px" clearable @keyup.enter="search" @clear="search" />
      <el-select v-model="grade" placeholder="等级" style="width: 130px" @change="search">
        <el-option label="全部" value="" />
        <el-option label="铜牌" value="LEVEL_1" />
        <el-option label="银牌" value="LEVEL_2" />
        <el-option label="金牌" value="LEVEL_3" />
      </el-select>
      <el-select v-model="auditStatus" placeholder="审核状态" style="width: 140px" @change="search">
        <el-option label="全部" value="" />
        <el-option label="待审核" value="PENDING" />
        <el-option label="已通过" value="APPROVED" />
        <el-option label="已驳回" value="REJECTED" />
      </el-select>
      <el-button type="primary" @click="search">查询</el-button>
    </div>

    <el-table :data="rows" border>
      <el-table-column label="渠道" min-width="180">
        <template #default="{ row }">
          <b>{{ row.shopName || row.companyName || '未命名渠道' }}</b><br>
          <small>{{ row.id }}</small>
        </template>
      </el-table-column>
      <el-table-column label="区域" width="150">
        <template #default="{ row }">{{ [row.province, row.city].filter(Boolean).join(' ') || '—' }}</template>
      </el-table-column>
      <el-table-column label="等级" width="100">
        <template #default="{ row }"><el-tag>{{ gradeText(row.grade) }}</el-tag></template>
      </el-table-column>
      <el-table-column label="30 天 GMV" width="125">
        <template #default="{ row }">¥{{ money(row.gmv30) }}</template>
      </el-table-column>
      <el-table-column prop="orders30" label="30 天订单" width="100" />
      <el-table-column label="累计 GMV" width="125">
        <template #default="{ row }">¥{{ money(row.gmvTotal) }}</template>
      </el-table-column>
      <el-table-column label="复购率" width="100">
        <template #default="{ row }">{{ Number(row.repeatRate || 0).toFixed(1) }}%</template>
      </el-table-column>
      <el-table-column label="售后率" width="100">
        <template #default="{ row }">{{ Number(row.afterSaleRate || 0).toFixed(1) }}%</template>
      </el-table-column>
      <el-table-column prop="productCount" label="在售商品" width="100" />
      <el-table-column label="审核" width="100">
        <template #default="{ row }">
          <el-tag :type="auditType(row.auditStatus)">{{ auditText(row.auditStatus) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="健康度" width="110">
        <template #default="{ row }">
          <el-tag :type="healthType(row.health)">{{ healthText(row.health) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="90" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="$router.push(`/channel-partner-detail/${row.id}`)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!rows.length" description="当前筛选条件下没有商家" />
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

const keyword = ref('')
const grade = ref('')
const auditStatus = ref('')
const rows = ref([])
const summary = ref({})
const page = ref(1)
const size = ref(10)
const total = ref(0)

onMounted(load)

async function load() {
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
    total.value = data.total || 0
  } catch (e) {
    rows.value = []
    total.value = 0
    ElMessage.error(e?.message || '渠道经营数据读取失败')
  }
}

function search() {
  page.value = 1
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
.filter-bar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
@media (max-width: 1200px) { .stat-row { grid-template-columns: repeat(2, 1fr); } }
</style>
