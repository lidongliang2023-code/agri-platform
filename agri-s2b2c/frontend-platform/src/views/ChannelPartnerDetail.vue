<template>
  <div v-loading="loading">
    <AgriVueDetailLayout
      v-if="channel"
      :code="`CH-${channel.id}`"
      :title="channel.shopName || channel.companyName || ''"
      :status="auditStatusBadge"
      :extra-statuses="extraStatuses"
      :meta="headerMeta"
      :tabs="tabs"
      :active-tab="activeTab"
      back-label="返回商家列表"
      @back="router.push('/channel-partners')"
      @tab-change="onTabChange"
    >
      <template #actions>
        <el-button @click="printPage">打印</el-button>
        <el-button @click="load">刷新</el-button>
        <el-button @click="openGradeDialog">调整等级</el-button>
        <el-button v-if="channel.auditStatus === 'PENDING'" type="danger" plain @click="audit(false)">
          驳回入驻
        </el-button>
        <el-button v-if="channel.auditStatus === 'PENDING'" type="primary" @click="audit(true)">
          通过入驻
        </el-button>
      </template>

      <template v-if="activeTab === 'overview'">
        <AgriVueDetailSection title="渠道档案">
          <S2b2cDetailInfoGrid :items="channelProfileItems" />
        </AgriVueDetailSection>

        <AgriVueDetailSection title="经营核心指标">
          <div class="detail-kpi-strip">
            <div class="detail-kpi-cell">
              <span>近 30 天 GMV</span>
              <strong>¥{{ formatMoney(performance.gmv30) }}</strong>
              <small>{{ performance.orders30 || 0 }} 单 · 客单 ¥{{ formatMoney(performance.avgOrderAmount) }}</small>
            </div>
            <div class="detail-kpi-cell">
              <span>累计 GMV</span>
              <strong>¥{{ formatMoney(performance.gmvTotal) }}</strong>
              <small>累计 {{ performance.ordersTotal || 0 }} 单</small>
            </div>
            <div class="detail-kpi-cell">
              <span>复购率</span>
              <strong>{{ Number(performance.repeatRate || 0).toFixed(1) }}%</strong>
              <small>复购客户 / 客户数</small>
            </div>
            <div class="detail-kpi-cell">
              <span>售后率</span>
              <strong>{{ Number(performance.afterSaleRate || 0).toFixed(1) }}%</strong>
              <small>30 天售后 / 订单</small>
            </div>
            <div class="detail-kpi-cell">
              <span>在售商品</span>
              <strong>{{ performance.productCount || 0 }}</strong>
              <small>渠道货架在售</small>
            </div>
          </div>
        </AgriVueDetailSection>

        <AgriVueDetailSection title="近 30 天成交走势">
          <div ref="trendChart" class="partner-trend-chart" />
        </AgriVueDetailSection>

        <AgriVueDetailSection title="最近订单" :flush="recentOrders.length > 0">
          <template #extra>
            <button
              v-if="recentOrders.length > 0"
              type="button"
              class="detail-section-link"
              @click="onTabChange('orders')"
            >
              查看全部 {{ recentOrders.length }} 单
            </button>
          </template>
          <el-table v-if="recentOrders.length" :data="recentOrders.slice(0, 5)" size="small">
            <el-table-column prop="orderNo" label="订单号" min-width="200">
              <template #default="{ row }">
                <button
                  type="button"
                  class="detail-section-link detail-mono"
                  @click="router.push(`/order-detail/${row.id}`)"
                >
                  {{ row.orderNo }}
                </button>
              </template>
            </el-table-column>
            <el-table-column label="实付" width="120" align="right">
              <template #default="{ row }"><strong class="detail-mono">¥{{ formatMoney(row.payAmount) }}</strong></template>
            </el-table-column>
            <el-table-column label="状态" width="110" align="center">
              <template #default="{ row }">
                <el-tag size="small" :type="resolveOrderStatus(row.status).elType">
                  {{ resolveOrderStatus(row.status).label }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="下单时间" width="175">
              <template #default="{ row }"><span class="detail-mono">{{ formatDateTime(row.createTime) }}</span></template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="该渠道暂无订单" :image-size="56" />
        </AgriVueDetailSection>
      </template>

      <template v-else-if="activeTab === 'products'">
        <AgriVueDetailSection title="热销商品（近 90 天）" :flush="topProducts.length > 0">
          <template #extra>
            <span class="muted">共 {{ topProducts.length }} 款</span>
          </template>
          <el-table v-if="topProducts.length" :data="topProducts" size="small">
            <el-table-column prop="name" label="商品名称" min-width="220" />
            <el-table-column label="销量" width="100" align="right">
              <template #default="{ row }"><span class="detail-mono">{{ Number(row.qty || 0).toLocaleString('zh-CN') }}</span></template>
            </el-table-column>
            <el-table-column label="销售额" width="140" align="right">
              <template #default="{ row }"><strong class="detail-mono">¥{{ formatMoney(row.amount) }}</strong></template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="暂无成交商品" :image-size="56" />
        </AgriVueDetailSection>
      </template>

      <template v-else-if="activeTab === 'orders'">
        <AgriVueDetailSection title="最近订单（最多 10 单）" :flush="recentOrders.length > 0">
          <template #extra>
            <span class="muted">共 {{ recentOrders.length }} 单</span>
          </template>
          <el-table v-if="recentOrders.length" :data="recentOrders" size="small">
            <el-table-column prop="orderNo" label="订单号" min-width="200">
              <template #default="{ row }">
                <button
                  type="button"
                  class="detail-section-link detail-mono"
                  @click="router.push(`/order-detail/${row.id}`)"
                >
                  {{ row.orderNo }}
                </button>
              </template>
            </el-table-column>
            <el-table-column label="实付" width="120" align="right">
              <template #default="{ row }"><strong class="detail-mono">¥{{ formatMoney(row.payAmount) }}</strong></template>
            </el-table-column>
            <el-table-column label="状态" width="110" align="center">
              <template #default="{ row }">
                <el-tag size="small" :type="resolveOrderStatus(row.status).elType">
                  {{ resolveOrderStatus(row.status).label }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="下单时间" width="175">
              <template #default="{ row }"><span class="detail-mono">{{ formatDateTime(row.createTime) }}</span></template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="该渠道暂无订单" :image-size="56" />
        </AgriVueDetailSection>
      </template>

      <template v-else-if="activeTab === 'commission'">
        <AgriVueDetailSection title="佣金与提现汇总">
          <S2b2cDetailInfoGrid :items="commissionInfoItems" />
          <p class="section-note">佣金按订单归属渠道自动统计；完整打款流水请前往「提现审批」页核查。</p>
        </AgriVueDetailSection>
      </template>

      <template #aside>
        <AgriVueDetailSection title="商家状态与生命周期">
          <AgriVueDetailTimeline :items="timelineSteps" />
        </AgriVueDetailSection>

        <AgriVueDetailSection title="关联入口">
          <AgriVueDetailRelated :items="relatedDocs" />
        </AgriVueDetailSection>
      </template>
    </AgriVueDetailLayout>

    <div v-else-if="!loading" class="detail-empty-card">
      <el-empty description="商家档案不存在或无权查看">
        <el-button @click="router.push('/channel-partners')">返回商家列表</el-button>
      </el-empty>
    </div>

    <el-dialog v-model="gradeVisible" title="调整商家等级" width="420px">
      <el-form label-width="88px" @submit.prevent>
        <el-form-item label="当前商家">
          <span>{{ channel?.shopName || channel?.companyName || `CH-${channel?.id}` }}</span>
        </el-form-item>
        <el-form-item label="渠道等级" required>
          <el-select v-model="gradeDraft" style="width: 100%">
            <el-option label="铜牌 LEVEL_1" value="LEVEL_1" />
            <el-option label="银牌 LEVEL_2" value="LEVEL_2" />
            <el-option label="金牌 LEVEL_3" value="LEVEL_3" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="gradeVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingGrade" @click="confirmGrade">保存等级</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as echarts from 'echarts'
import {
  AgriVueDetailLayout,
  AgriVueDetailRelated,
  AgriVueDetailSection,
  AgriVueDetailTimeline,
} from '@agri/shared/vue/detail'
import S2b2cDetailInfoGrid from '../../../frontend-shared/components/S2b2cDetailInfoGrid.vue'
import {
  formatDateTime,
  formatMoney,
  formatShortTime,
  maskPhone,
  resolveAuditStatus,
  resolveGradeText,
  resolveHealthStatus,
  resolveOrderStatus,
} from '../../../frontend-shared/detail/s2b2cDetailHelper'
import { platformApi } from '../api'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const activeTab = ref('overview')
const channel = ref(null)
const performance = ref({})
const trend = ref([])
const topProducts = ref([])
const recentOrders = ref([])
const commission = ref({})
const trendChart = ref(null)
let chart = null

const gradeVisible = ref(false)
const gradeDraft = ref('LEVEL_1')
const savingGrade = ref(false)

onUnmounted(() => {
  chart?.dispose()
  chart = null
})

async function load() {
  const id = route.params.id
  if (!id) return
  loading.value = true
  try {
    const data = await platformApi.getChannelPerformanceDetail(id)
    channel.value = data?.channel || null
    performance.value = data?.performance || {}
    trend.value = data?.trend || []
    topProducts.value = data?.topProducts || []
    recentOrders.value = data?.recentOrders || []
    commission.value = data?.commission || {}
    await nextTick()
    if (activeTab.value === 'overview') renderTrend()
  } catch (e) {
    channel.value = null
    ElMessage.error(e?.message || '渠道详情读取失败')
  } finally {
    loading.value = false
  }
}

watch(
  () => route.params.id,
  () => {
    activeTab.value = 'overview'
    load()
  },
  { immediate: true },
)

function renderTrend() {
  if (!trendChart.value) return
  if (chart) {
    chart.dispose()
    chart = null
  }
  chart = echarts.init(trendChart.value)
  chart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 48, right: 16, top: 20, bottom: 28 },
    xAxis: {
      type: 'category',
      data: trend.value.map((p) => p.date),
      axisLabel: { color: '#6b7c72', interval: 4 },
      axisLine: { lineStyle: { color: '#e3eae5' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#6b7c72' },
      splitLine: { lineStyle: { color: '#eef3ef' } },
    },
    series: [{
      type: 'line',
      smooth: true,
      symbol: 'none',
      data: trend.value.map((p) => Number(p.amount || 0)),
      lineStyle: { color: '#2d8f4e', width: 2 },
      areaStyle: { color: 'rgba(45,143,78,0.12)' },
    }],
  }, true)
}

async function onTabChange(key) {
  activeTab.value = key
  if (key === 'overview') {
    await nextTick()
    renderTrend()
  }
}

const auditStatusBadge = computed(() => {
  const meta = resolveAuditStatus(channel.value?.auditStatus)
  return { label: meta.label, tone: meta.tone }
})

const extraStatuses = computed(() => {
  const list = []
  if (performance.value?.health) {
    const h = resolveHealthStatus(performance.value.health)
    list.push({ label: `健康度 · ${h.label}`, tone: h.tone })
  }
  if (channel.value?.grade) {
    list.push({ label: resolveGradeText(channel.value.grade), tone: 'blue' })
  }
  return list
})

const headerMeta = computed(() => [
  { label: '联系人', value: channel.value?.contactName || '—' },
  { label: '联系电话', value: maskPhone(channel.value?.contactPhone) },
  { label: '入驻时间', value: formatDateTime(channel.value?.createTime) },
])

const tabs = computed(() => [
  { key: 'overview', label: '商家详情' },
  { key: 'products', label: '热销商品', count: topProducts.value.length },
  { key: 'orders', label: '最近订单', count: recentOrders.value.length },
  { key: 'commission', label: '佣金与提现' },
])

const channelProfileItems = computed(() => [
  { key: 'shopName', label: '店铺名称', value: channel.value?.shopName || channel.value?.companyName || '—' },
  { key: 'grade', label: '渠道等级', value: resolveGradeText(channel.value?.grade) },
  { key: 'contactName', label: '联系人', value: channel.value?.contactName || '—' },
  { key: 'contactPhone', label: '联系电话', value: maskPhone(channel.value?.contactPhone), mono: true },
  { key: 'region', label: '所属区域', value: [channel.value?.province, channel.value?.city, channel.value?.district].filter(Boolean).join(' ') || '—' },
  { key: 'auditTime', label: '审核时间', value: formatDateTime(channel.value?.auditTime), mono: true },
  { key: 'address', label: '详细地址', value: channel.value?.address || '—', fullWidth: true },
])

const commissionInfoItems = computed(() => [
  { key: 'settled', label: '已结算佣金', value: `¥${formatMoney(commission.value.settled)}`, mono: true },
  { key: 'pending', label: '待结算佣金', value: `¥${formatMoney(commission.value.pending)}`, mono: true },
  { key: 'processing', label: '提现处理中', value: `¥${formatMoney(commission.value.withdrawalProcessing)}`, mono: true },
  { key: 'paid', label: '已打款提现', value: `¥${formatMoney(commission.value.withdrawalPaid)}`, mono: true },
])

const timelineSteps = computed(() => {
  const status = String(channel.value?.auditStatus || '').toUpperCase()
  const approved = status === 'APPROVED'
  const rejected = status === 'REJECTED'
  const hasProducts = Number(performance.value?.productCount || 0) > 0
  const hasOrders = Number(performance.value?.ordersTotal || 0) > 0

  return [
    {
      key: 'apply',
      title: '提交入驻申请',
      time: formatShortTime(channel.value?.createTime) || '已提交',
      state: 'done',
    },
    {
      key: 'audit',
      title: approved ? '平台入驻通过' : rejected ? '入驻审核驳回' : '等待入驻审核',
      time: approved || rejected ? (formatShortTime(channel.value?.auditTime) || '已审核') : '当前节点',
      description: rejected ? (channel.value?.auditOpinion || '待整改后重新提交') : approved ? `当前等级 ${resolveGradeText(channel.value?.grade)}` : '待运营核验资质',
      state: approved ? 'done' : rejected ? 'error' : 'current',
    },
    {
      key: 'shelf',
      title: hasProducts ? '已上架在售商品' : '货架选品铺货',
      time: hasProducts ? `在售 ${performance.value.productCount} 款` : approved ? '当前节点' : '待处理',
      state: hasProducts ? 'done' : approved ? 'current' : 'pending',
    },
    {
      key: 'trade',
      title: hasOrders ? '已产生渠道成交' : '首单成交与分润',
      time: hasOrders ? `累计 ${performance.value.ordersTotal} 单` : hasProducts ? '当前节点' : '待处理',
      description: hasOrders ? `累计 GMV ¥${formatMoney(performance.value.gmvTotal)}` : undefined,
      state: hasOrders ? 'done' : hasProducts ? 'current' : 'pending',
    },
  ]
})

const relatedDocs = computed(() => [
  {
    key: 'orders',
    label: '最近订单',
    text: recentOrders.value.length ? `${recentOrders.value.length} 笔订单` : '',
    emptyText: '暂无订单',
    onClick: recentOrders.value.length ? () => onTabChange('orders') : undefined,
  },
  {
    key: 'commission',
    label: '已结算佣金',
    code: `¥${formatMoney(commission.value.settled)}`,
    onClick: () => onTabChange('commission'),
  },
  {
    key: 'withdrawals',
    label: '提现审批',
    text: '查看打款流水',
    onClick: () => router.push('/withdrawals'),
  },
  {
    key: 'commission-report',
    label: '佣金明细',
    text: '前往佣金报表',
    onClick: () => router.push('/commission-report'),
  },
])

function openGradeDialog() {
  gradeDraft.value = channel.value?.grade || 'LEVEL_1'
  gradeVisible.value = true
}

async function confirmGrade() {
  if (!channel.value?.id) return
  savingGrade.value = true
  try {
    const res = await platformApi.updateChannelGrade(channel.value.id, gradeDraft.value)
    if (res?.success === false) {
      ElMessage.error(res.message || '调整失败')
      return
    }
    channel.value.grade = gradeDraft.value
    gradeVisible.value = false
    ElMessage.success('等级已调整，新订单按新规则计算佣金')
  } catch (e) {
    ElMessage.error(e?.message || '调整失败')
  } finally {
    savingGrade.value = false
  }
}

async function audit(approved) {
  let opinion = ''
  try {
    const result = await ElMessageBox.prompt(
      approved ? '可填写通过说明（选填）' : '请填写驳回原因',
      approved ? '通过入驻' : '驳回入驻',
      {
        inputPlaceholder: approved ? '选填' : '必填',
        inputPattern: approved ? undefined : /\S+/,
        inputErrorMessage: '请填写驳回原因',
        confirmButtonText: '确认',
        cancelButtonText: '取消',
      },
    )
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

function printPage() {
  window.print()
}
</script>

<style scoped>
.partner-trend-chart {
  height: 260px;
  width: 100%;
}

.muted {
  color: #8c9a92;
  font-size: 12px;
}

.section-note {
  margin: 12px 0 0;
  color: #8c9a92;
  font-size: 12px;
}

.detail-empty-card {
  padding: 48px 24px;
  border: 1px solid #e8ecea;
  border-radius: 10px;
  background: #fff;
}
</style>
