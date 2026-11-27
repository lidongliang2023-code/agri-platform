<template>
  <div v-loading="loading">
    <AgriVueDetailLayout
      v-if="profile"
      :code="`CUST-${profile.consumerId}`"
      :title="profile.name || '微信用户'"
      :status="memberLevelBadge"
      :extra-statuses="extraStatuses"
      :meta="headerMeta"
      :tabs="tabs"
      :active-tab="activeTab"
      back-label="返回客户列表"
      @back="router.push('/customers')"
      @tab-change="(key) => (activeTab = key)"
    >
      <template #actions>
        <el-button @click="printPage">打印</el-button>
        <el-button @click="load">刷新</el-button>
        <el-button
          v-if="latestOrder"
          type="primary"
          @click="router.push(`/orders/${latestOrder.id}`)"
        >
          查看最新订单
        </el-button>
      </template>

      <template v-if="activeTab === 'overview'">
        <AgriVueDetailSection title="客户档案信息">
          <S2b2cDetailInfoGrid :items="profileInfoItems" />
        </AgriVueDetailSection>

        <AgriVueDetailSection title="本渠道消费指标">
          <div class="detail-kpi-strip">
            <div class="detail-kpi-cell">
              <span>累计下单</span>
              <strong>{{ Number(profile.orderCount || 0) }} 单</strong>
              <small>不含已取消订单</small>
            </div>
            <div class="detail-kpi-cell">
              <span>累计消费</span>
              <strong>¥{{ formatMoney(profile.totalAmount) }}</strong>
              <small>本渠道实付汇总</small>
            </div>
            <div class="detail-kpi-cell">
              <span>平均客单价</span>
              <strong>¥{{ formatMoney(profile.avgAmount) }}</strong>
              <small>消费总额 / 有效订单</small>
            </div>
            <div class="detail-kpi-cell">
              <span>常购商品</span>
              <strong>{{ topProducts.length }} 款</strong>
              <small>有效成交品类偏好</small>
            </div>
          </div>
        </AgriVueDetailSection>

        <AgriVueDetailSection title="最近订单" :flush="orders.length > 0">
          <template #extra>
            <button
              v-if="orders.length > 0"
              type="button"
              class="detail-section-link"
              @click="activeTab = 'orders'"
            >
              查看全部 {{ orders.length }} 单
            </button>
          </template>
          <template v-if="orders.length">
            <el-table :data="orders.slice(0, 5)" size="small">
              <el-table-column prop="orderNo" label="订单号" min-width="200">
                <template #default="{ row }">
                  <button
                    type="button"
                    class="detail-section-link detail-mono"
                    @click="router.push(`/orders/${row.id}`)"
                  >
                    {{ row.orderNo }}
                  </button>
                </template>
              </el-table-column>
              <el-table-column label="实付金额" width="120" align="right">
                <template #default="{ row }">
                  <strong class="detail-mono">¥{{ formatMoney(row.payAmount) }}</strong>
                </template>
              </el-table-column>
              <el-table-column label="订单状态" width="110" align="center">
                <template #default="{ row }">
                  <el-tag size="small" :type="resolveOrderStatus(row.status).elType">
                    {{ resolveOrderStatus(row.status).label }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="下单时间" width="175">
                <template #default="{ row }">
                  <span class="detail-mono">{{ formatDateTime(row.createTime) }}</span>
                </template>
              </el-table-column>
            </el-table>
            <div class="detail-table-summary">
              <span>近期订单总额</span>
              <strong>¥{{ formatMoney(recentOrdersTotal) }}</strong>
            </div>
          </template>
          <el-empty v-else description="暂无订单" :image-size="56" />
        </AgriVueDetailSection>
      </template>

      <template v-else-if="activeTab === 'products'">
        <AgriVueDetailSection title="常购商品偏好" :flush="topProducts.length > 0">
          <template #extra>
            <span class="muted">共 {{ topProducts.length }} 款</span>
          </template>
          <template v-if="topProducts.length">
            <el-table :data="topProducts" size="small">
              <el-table-column prop="name" label="商品名称" min-width="220" />
              <el-table-column label="累计件数" width="120" align="right">
                <template #default="{ row }">
                  <span class="detail-mono">{{ Number(row.qty || 0).toLocaleString('zh-CN') }}</span>
                </template>
              </el-table-column>
              <el-table-column label="累计消费" width="140" align="right">
                <template #default="{ row }">
                  <strong class="detail-mono">¥{{ formatMoney(row.amount) }}</strong>
                </template>
              </el-table-column>
            </el-table>
            <div class="detail-table-summary">
              <span>常购商品合计</span>
              <strong>¥{{ formatMoney(topProductsTotal) }}</strong>
            </div>
          </template>
          <el-empty v-else description="暂无商品偏好数据" :image-size="56" />
        </AgriVueDetailSection>
      </template>

      <template v-else-if="activeTab === 'orders'">
        <AgriVueDetailSection title="本渠道最近订单（最多 10 单）" :flush="orders.length > 0">
          <template #extra>
            <span class="muted">共 {{ orders.length }} 单</span>
          </template>
          <template v-if="orders.length">
            <el-table :data="orders" size="small">
              <el-table-column prop="orderNo" label="订单号" min-width="200">
                <template #default="{ row }">
                  <button
                    type="button"
                    class="detail-section-link detail-mono"
                    @click="router.push(`/orders/${row.id}`)"
                  >
                    {{ row.orderNo }}
                  </button>
                </template>
              </el-table-column>
              <el-table-column label="实付金额" width="120" align="right">
                <template #default="{ row }">
                  <strong class="detail-mono">¥{{ formatMoney(row.payAmount) }}</strong>
                </template>
              </el-table-column>
              <el-table-column label="订单状态" width="110" align="center">
                <template #default="{ row }">
                  <el-tag size="small" :type="resolveOrderStatus(row.status).elType">
                    {{ resolveOrderStatus(row.status).label }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="下单时间" width="175">
                <template #default="{ row }">
                  <span class="detail-mono">{{ formatDateTime(row.createTime) }}</span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="90" fixed="right" align="right">
                <template #default="{ row }">
                  <el-button link type="primary" @click="router.push(`/orders/${row.id}`)">查看详情</el-button>
                </template>
              </el-table-column>
            </el-table>
            <div class="detail-table-summary">
              <span>近期订单总额</span>
              <strong>¥{{ formatMoney(recentOrdersTotal) }}</strong>
            </div>
          </template>
          <el-empty v-else description="暂无订单" :image-size="56" />
        </AgriVueDetailSection>
      </template>

      <template #aside>
        <AgriVueDetailSection title="客户成长轨迹">
          <AgriVueDetailTimeline :items="timelineSteps" />
        </AgriVueDetailSection>

        <AgriVueDetailSection title="关联单据">
          <AgriVueDetailRelated :items="relatedDocs" />
        </AgriVueDetailSection>
      </template>
    </AgriVueDetailLayout>

    <div v-else-if="!loading" class="detail-empty-card">
      <el-empty description="客户档案不存在或该客户尚未在本渠道下单">
        <el-button @click="router.push('/customers')">返回客户列表</el-button>
      </el-empty>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
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
  resolveMemberLevel,
  resolveOrderStatus,
} from '../../../frontend-shared/detail/s2b2cDetailHelper'
import { channelApi } from '../api'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const activeTab = ref('overview')
const profile = ref(null)
const orders = ref([])
const topProducts = ref([])

async function load() {
  const id = route.params.id
  if (!id) return
  loading.value = true
  try {
    const data = await channelApi.getCustomerDetail(id)
    profile.value = data?.profile || null
    orders.value = Array.isArray(data?.orders) ? data.orders : []
    topProducts.value = Array.isArray(data?.topProducts) ? data.topProducts : []
  } catch (e) {
    profile.value = null
    orders.value = []
    topProducts.value = []
    ElMessage.error(e?.message || '客户画像读取失败')
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

const latestOrder = computed(() => orders.value[0] || null)
const earliestOrder = computed(() => (orders.value.length ? orders.value[orders.value.length - 1] : null))

const recentOrdersTotal = computed(() =>
  orders.value.reduce((sum, item) => sum + Number(item?.payAmount || 0), 0),
)

const topProductsTotal = computed(() =>
  topProducts.value.reduce((sum, item) => sum + Number(item?.amount || 0), 0),
)

const memberLevelBadge = computed(() => {
  const meta = resolveMemberLevel(profile.value?.memberLevel)
  return { label: meta.label, tone: meta.tone }
})

const extraStatuses = computed(() => {
  const count = Number(profile.value?.orderCount || 0)
  if (count >= 3) return [{ label: '高频复购', tone: 'green' }]
  if (count >= 2) return [{ label: '复购客户', tone: 'blue' }]
  return [{ label: '首单客户', tone: 'orange' }]
})

const headerMeta = computed(() => [
  { label: '联系电话', value: maskPhone(profile.value?.phone) },
  { label: '本渠道下单', value: `${Number(profile.value?.orderCount || 0)} 单` },
  { label: '最近下单', value: formatDateTime(profile.value?.lastOrderTime) },
])

const tabs = computed(() => [
  { key: 'overview', label: '客户画像' },
  { key: 'products', label: '常购商品', count: topProducts.value.length },
  { key: 'orders', label: '最近订单', count: orders.value.length },
])

const profileInfoItems = computed(() => [
  { key: 'consumerId', label: '客户编号', value: `CUST-${profile.value?.consumerId}`, mono: true },
  { key: 'name', label: '客户昵称', value: profile.value?.name || '微信用户' },
  { key: 'phone', label: '联系电话', value: maskPhone(profile.value?.phone), mono: true },
  { key: 'memberLevel', label: '会员等级', value: resolveMemberLevel(profile.value?.memberLevel).label },
  { key: 'lastOrder', label: '最近下单时间', value: formatDateTime(profile.value?.lastOrderTime), mono: true },
  { key: 'totalAmount', label: '累计消费总额', value: `¥${formatMoney(profile.value?.totalAmount)}`, mono: true },
  {
    key: 'boundary',
    label: '数据归属说明',
    value: '仅展示本渠道内的消费汇总用于店铺经营；客户账号、实名认证与跨渠道数据由用户中心主责。',
    fullWidth: true,
  },
])

const timelineSteps = computed(() => {
  const count = Number(profile.value?.orderCount || 0)
  const hasRepeat = count >= 2
  const hasTopProducts = topProducts.value.length > 0
  return [
    {
      key: 'first-order',
      title: '首次在本渠道下单',
      time: formatShortTime(earliestOrder.value?.createTime || profile.value?.lastOrderTime) || '已下单',
      state: 'done',
    },
    {
      key: 'repeat',
      title: hasRepeat ? '已形成复购习惯' : '等待二次复购',
      time: hasRepeat ? `累计 ${count} 单` : '当前节点',
      description: hasRepeat
        ? `客单价 ¥${formatMoney(profile.value?.avgAmount)}`
        : '可通过优惠券或社群活动引导复购',
      state: hasRepeat ? 'done' : 'current',
    },
    {
      key: 'preference',
      title: hasTopProducts ? '商品偏好已沉淀' : '持续观察品类偏好',
      time: hasTopProducts ? `${topProducts.value.length} 款常购商品` : '待沉淀',
      state: hasTopProducts ? 'done' : 'pending',
    },
    {
      key: 'latest',
      title: '最近活跃交易',
      time: formatShortTime(profile.value?.lastOrderTime) || '—',
      description: latestOrder.value
        ? `最近单号 ${latestOrder.value.orderNo} · ${resolveOrderStatus(latestOrder.value.status).label}`
        : '暂无最新订单',
      state: latestOrder.value ? 'done' : 'pending',
    },
  ]
})

const relatedDocs = computed(() => [
  {
    key: 'latest-order',
    label: '最新成交订单',
    code: latestOrder.value?.orderNo || '',
    emptyText: '暂无订单',
    onClick: latestOrder.value
      ? () => router.push(`/orders/${latestOrder.value.id}`)
      : undefined,
  },
  {
    key: 'orders',
    label: '渠道订单台账',
    text: '查看全部订单',
    onClick: () => router.push('/orders'),
  },
  {
    key: 'customer-ops',
    label: '客户运营与社群',
    text: '前往客户运营',
    onClick: () => router.push('/customer-ops'),
  },
  {
    key: 'reviews',
    label: '评价管理',
    text: '查看客户评价',
    onClick: () => router.push('/reviews'),
  },
])

function printPage() {
  window.print()
}
</script>

<style scoped>
.muted {
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
