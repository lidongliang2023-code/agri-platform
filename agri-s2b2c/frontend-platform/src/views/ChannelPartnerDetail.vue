<template>
  <div class="partner-detail-page" v-loading="loading">
    <div class="page-head">
      <div>
        <h2>渠道商详情</h2>
        <p v-if="channel">{{ channel.shopName || channel.companyName }} · {{ channel.id }} · 入驻 {{ channel.createTime }}</p>
      </div>
      <div class="head-actions">
        <el-button @click="$router.push('/channel-partners')">返回列表</el-button>
        <el-button v-if="channel?.auditStatus === 'PENDING'" type="primary" @click="audit(true)">通过入驻</el-button>
        <el-button v-if="channel?.auditStatus === 'PENDING'" type="danger" @click="audit(false)">驳回</el-button>
      </div>
    </div>

    <template v-if="channel">
      <div class="stat-row">
        <div class="stat-card"><span>近 30 天 GMV</span><b>¥{{ money(performance.gmv30) }}</b><small>{{ performance.orders30 || 0 }} 单 · 客单 ¥{{ money(performance.avgOrderAmount) }}</small></div>
        <div class="stat-card"><span>累计 GMV</span><b>¥{{ money(performance.gmvTotal) }}</b><small>{{ performance.ordersTotal || 0 }} 单</small></div>
        <div class="stat-card"><span>复购率</span><b>{{ Number(performance.repeatRate || 0).toFixed(1) }}%</b><small>渠道内复购客户 / 客户数</small></div>
        <div class="stat-card"><span>售后率</span><b>{{ Number(performance.afterSaleRate || 0).toFixed(1) }}%</b><small>30 天售后单 / 订单</small></div>
        <div class="stat-card"><span>在售商品</span><b>{{ performance.productCount || 0 }}</b><small>渠道货架 ON</small></div>
        <div class="stat-card"><span>健康度</span><b><el-tag :type="healthType(performance.health)">{{ healthText(performance.health) }}</el-tag></b><small>运营标记，非平台评分</small></div>
      </div>

      <div class="grid">
        <div class="card">
          <div class="card-head"><h3>近 30 天成交走势</h3></div>
          <div ref="trendChart" class="chart" />
        </div>
        <div class="card">
          <h3>渠道档案</h3>
          <dl class="descs">
            <dt>等级</dt>
            <dd>
              <el-select :model-value="channel.grade" size="small" style="width: 130px" @change="changeGrade">
                <el-option label="铜牌 LEVEL_1" value="LEVEL_1" />
                <el-option label="银牌 LEVEL_2" value="LEVEL_2" />
                <el-option label="金牌 LEVEL_3" value="LEVEL_3" />
              </el-select>
            </dd>
            <dt>审核状态</dt><dd><el-tag :type="auditType(channel.auditStatus)">{{ auditText(channel.auditStatus) }}</el-tag></dd>
            <dt>联系人</dt><dd>{{ channel.contactName || '—' }} · {{ channel.contactPhone || '' }}</dd>
            <dt>区域</dt><dd>{{ [channel.province, channel.city, channel.district].filter(Boolean).join(' ') || '—' }}</dd>
            <dt>地址</dt><dd>{{ channel.address || '—' }}</dd>
            <dt>审核时间</dt><dd>{{ channel.auditTime || '—' }}</dd>
          </dl>
        </div>
      </div>

      <div class="grid">
        <div class="card">
          <div class="card-head"><h3>热销商品（近 90 天）</h3></div>
          <el-table :data="topProducts" border size="small">
            <el-table-column prop="name" label="商品" min-width="180" />
            <el-table-column prop="qty" label="销量" width="90" />
            <el-table-column label="销售额" width="120">
              <template #default="{ row }">¥{{ money(row.amount) }}</template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!topProducts.length" description="暂无成交商品" :image-size="60" />
        </div>
        <div class="card">
          <h3>佣金与提现</h3>
          <dl class="descs">
            <dt>已结算佣金</dt><dd>¥{{ money(commission.settled) }}</dd>
            <dt>待结算佣金</dt><dd>¥{{ money(commission.pending) }}</dd>
            <dt>提现处理中</dt><dd>¥{{ money(commission.withdrawalProcessing) }}</dd>
            <dt>已打款提现</dt><dd>¥{{ money(commission.withdrawalPaid) }}</dd>
          </dl>
          <p class="note">佣金按订单归属渠道统计；打款流水在提现审批页查看。</p>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3>最近订单</h3><span class="muted">最多 10 单</span></div>
        <el-table :data="recentOrders" border size="small">
          <el-table-column prop="orderNo" label="订单号" min-width="200" />
          <el-table-column label="实付" width="110">
            <template #default="{ row }">¥{{ money(row.payAmount) }}</template>
          </el-table-column>
          <el-table-column label="状态" width="110">
            <template #default="{ row }">
              <el-tag :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="createTime" label="下单时间" width="180" />
        </el-table>
        <el-empty v-if="!recentOrders.length" description="该渠道暂无订单" :image-size="60" />
      </div>
    </template>
  </div>
</template>

<script setup>
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as echarts from 'echarts'
import { platformApi } from '../api'

const route = useRoute()
const loading = ref(true)
const channel = ref(null)
const performance = ref({})
const trend = ref([])
const topProducts = ref([])
const recentOrders = ref([])
const commission = ref({})
const trendChart = ref(null)
let chart = null

onMounted(load)
onUnmounted(() => chart?.dispose())

async function load() {
  loading.value = true
  try {
    const data = await platformApi.getChannelPerformanceDetail(route.params.id)
    channel.value = data.channel || null
    performance.value = data.performance || {}
    trend.value = data.trend || []
    topProducts.value = data.topProducts || []
    recentOrders.value = data.recentOrders || []
    commission.value = data.commission || {}
    await nextTick()
    renderTrend()
  } catch (e) {
    ElMessage.error(e?.message || '渠道详情读取失败')
  } finally {
    loading.value = false
  }
}

function renderTrend() {
  if (!trendChart.value) return
  if (!chart) chart = echarts.init(trendChart.value)
  chart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 48, right: 16, top: 20, bottom: 28 },
    xAxis: {
      type: 'category',
      data: trend.value.map((p) => p.date),
      axisLabel: { color: '#6b7c72', interval: 4 },
      axisLine: { lineStyle: { color: '#e3eae5' } },
    },
    yAxis: { type: 'value', axisLabel: { color: '#6b7c72' }, splitLine: { lineStyle: { color: '#eef3ef' } } },
    series: [{
      type: 'line', smooth: true, symbol: 'none',
      data: trend.value.map((p) => Number(p.amount || 0)),
      lineStyle: { color: '#12764a', width: 2 },
      areaStyle: { color: 'rgba(18,118,74,0.12)' },
    }],
  }, true)
}

async function changeGrade(grade) {
  try {
    const res = await platformApi.updateChannelGrade(channel.value.id, grade)
    if (res?.success === false) {
      ElMessage.error(res.message || '调整失败')
      return
    }
    channel.value.grade = grade
    ElMessage.success('等级已调整，新订单按新规则计算佣金')
  } catch (e) {
    ElMessage.error(e?.message || '调整失败')
  }
}

async function audit(approved) {
  let opinion = ''
  try {
    const result = await ElMessageBox.prompt(approved ? '可填写通过说明（选填）' : '请填写驳回原因',
      approved ? '通过入驻' : '驳回入驻',
      { inputPlaceholder: approved ? '选填' : '必填', confirmButtonText: '确认', cancelButtonText: '取消' })
    opinion = result.value || ''
  } catch {
    return
  }
  const res = await platformApi.auditChannelPartner({
    id: channel.value.id,
    auditStatus: approved ? 'APPROVED' : 'REJECTED',
    auditOpinion: opinion,
  })
  if (res?.success === false) {
    ElMessage.error(res.message || '审核失败')
    return
  }
  ElMessage.success(approved ? '已通过入驻' : '已驳回入驻')
  await load()
}

const money = (value) => Number(value || 0).toFixed(2)
const auditText = (value) => ({ PENDING: '待审核', APPROVED: '已通过', REJECTED: '已驳回' }[value] || value)
const auditType = (value) => ({ PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger' }[value] || 'info')
const healthText = (value) => ({ HEALTHY: '优质', NORMAL: '正常', RISK: '售后风险', SLEEPING: '沉默' }[value] || value || '—')
const healthType = (value) => ({ HEALTHY: 'success', NORMAL: 'primary', RISK: 'danger', SLEEPING: 'info' }[value] || 'info')
const statusText = (value) => ({
  PENDING_PAY: '待付款', PENDING_SHIP: '待发货', SHIPPED: '已发货', PENDING_RECEIVE: '待收货',
  COMPLETED: '已完成', CANCELLED: '已取消', REFUNDING: '退款中', REFUNDED: '已退款',
}[value] || value)
const statusType = (value) => ({
  PENDING_PAY: 'warning', PENDING_SHIP: 'warning', SHIPPED: 'primary', PENDING_RECEIVE: 'primary',
  COMPLETED: 'success', CANCELLED: 'info', REFUNDING: 'danger', REFUNDED: 'danger',
}[value] || 'info')
</script>

<style scoped>
.partner-detail-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; }
.head-actions { display: flex; gap: 8px; }
.stat-row { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; }
.stat-card { display: flex; flex-direction: column; gap: 6px; padding: 14px 16px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.stat-card span { color: #84938a; font-size: 12px; }
.stat-card b { color: #173e2a; font-size: 20px; }
.stat-card small { color: #94a198; font-size: var(--agri-font-size-micro); }
.grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 16px; }
.card { padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.card h3 { margin: 0 0 12px; font-size: 15px; }
.card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.card-head h3 { margin: 0; }
.chart { height: 260px; }
.descs { display: grid; grid-template-columns: 100px 1fr; gap: 10px 12px; margin: 0; font-size: 13px; }
.descs dt { color: #84938a; }
.descs dd { margin: 0; color: #173e2a; word-break: break-all; }
.muted { color: #84938a; font-size: 12px; }
.note { margin: 10px 0 0; color: #84938a; font-size: 12px; }
@media (max-width: 1200px) { .stat-row { grid-template-columns: repeat(3, 1fr); } .grid { grid-template-columns: 1fr; } }
</style>
