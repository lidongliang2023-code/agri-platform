<template>
  <div v-loading="loading">
    <AgriVueDetailLayout
      v-if="channel"
      :code="`CH-${channel.id}`"
      :title="channel.shopName || ''"
      :status="distributorStatusBadge"
      :meta="headerMeta"
      :tabs="tabs"
      :active-tab="activeTab"
      back-label="返回渠道授权网络"
      @back="router.push('/supply/distributors')"
      @tab-change="(key) => (activeTab = key)"
    >
      <template #actions>
        <el-button @click="printPage">打印</el-button>
        <el-button @click="load">刷新</el-button>
        <el-button type="primary" @click="router.push(`/channel-partner-detail/${channel.id}`)">
          查看商家档案
        </el-button>
      </template>

      <template v-if="activeTab === 'overview'">
        <AgriVueDetailSection title="分销商概览">
          <S2b2cDetailInfoGrid :items="overviewItems" />
        </AgriVueDetailSection>

        <AgriVueDetailSection title="授权与成交指标">
          <div class="detail-kpi-strip">
            <div class="detail-kpi-cell">
              <span>累计订单</span>
              <strong>{{ metrics.orders || 0 }}</strong>
              <small>非取消订单</small>
            </div>
            <div class="detail-kpi-cell">
              <span>累计 GMV</span>
              <strong>¥{{ formatMoney(metrics.gmv) }}</strong>
              <small>渠道成交</small>
            </div>
            <div class="detail-kpi-cell">
              <span>在售授权</span>
              <strong>{{ activeCount }}</strong>
              <small>有效授权商品</small>
            </div>
            <div class="detail-kpi-cell">
              <span>已撤销授权</span>
              <strong>{{ revokedCount }}</strong>
              <small>历史撤销记录</small>
            </div>
          </div>
        </AgriVueDetailSection>

        <AgriVueDetailSection title="货源商品授权" :flush="products.length > 0">
          <template #extra>
            <button
              v-if="products.length > 0"
              type="button"
              class="detail-section-link"
              @click="activeTab = 'authorizations'"
            >
              查看全部 {{ products.length }} 项
            </button>
          </template>
          <el-table v-if="products.length" :data="products.slice(0, 5)" size="small">
            <el-table-column prop="name" label="商品名称" min-width="190" />
            <el-table-column label="渠道零售价" width="120" align="right">
              <template #default="{ row }">
                <span class="detail-mono">{{ row.retailPrice ? `¥${formatMoney(row.retailPrice)}` : '按商品价' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="货架" width="90" align="center">
              <template #default="{ row }">{{ row.shelfStatus === 'OFF' ? '已下架' : '在售' }}</template>
            </el-table-column>
            <el-table-column label="授权状态" width="100" align="center">
              <template #default="{ row }">
                <el-tag size="small" :type="row.status === 'ACTIVE' ? 'success' : 'info'">
                  {{ row.status === 'ACTIVE' ? '有效' : '已撤销' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100" align="right">
              <template #default="{ row }">
                <el-button v-if="row.status === 'ACTIVE'" link type="danger" @click="revoke(row)">撤销授权</el-button>
                <span v-else class="muted">—</span>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="该渠道暂无平台货源商品授权" :image-size="56" />
        </AgriVueDetailSection>
      </template>

      <template v-else-if="activeTab === 'authorizations'">
        <AgriVueDetailSection title="货源商品授权清单" :flush="products.length > 0">
          <template #extra>
            <span class="muted">撤销后渠道不能再下单该商品，历史订单不受影响</span>
          </template>
          <el-table v-if="products.length" :data="products" size="small">
            <el-table-column prop="name" label="商品名称" min-width="200" />
            <el-table-column label="渠道零售价" width="120" align="right">
              <template #default="{ row }">
                <span class="detail-mono">{{ row.retailPrice ? `¥${formatMoney(row.retailPrice)}` : '按商品价' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="货架" width="100" align="center">
              <template #default="{ row }">{{ row.shelfStatus === 'OFF' ? '已下架' : '在售' }}</template>
            </el-table-column>
            <el-table-column label="授权状态" width="110" align="center">
              <template #default="{ row }">
                <el-tag size="small" :type="row.status === 'ACTIVE' ? 'success' : 'info'">
                  {{ row.status === 'ACTIVE' ? '有效' : '已撤销' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="授权时间" width="175">
              <template #default="{ row }"><span class="detail-mono">{{ formatDateTime(row.pickedAt) }}</span></template>
            </el-table-column>
            <el-table-column label="操作" width="110" fixed="right" align="right">
              <template #default="{ row }">
                <el-button v-if="row.status === 'ACTIVE'" link type="danger" @click="revoke(row)">撤销授权</el-button>
                <span v-else class="muted">—</span>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="该渠道暂无平台货源商品授权" :image-size="56" />
        </AgriVueDetailSection>
      </template>

      <template v-else-if="activeTab === 'orders'">
        <AgriVueDetailSection title="最近订单" :flush="recentOrders.length > 0">
          <template #extra>
            <span class="muted">共 {{ recentOrders.length }} 单</span>
          </template>
          <el-table v-if="recentOrders.length" :data="recentOrders" size="small">
            <el-table-column prop="orderNo" label="订单号" min-width="195">
              <template #default="{ row }">
                <button
                  type="button"
                  class="detail-section-link detail-mono"
                  @click="router.push(`/supply/order-detail/${row.id}`)"
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
          <el-empty v-else description="暂无订单" :image-size="56" />
        </AgriVueDetailSection>
      </template>

      <template #aside>
        <AgriVueDetailSection title="合作与授权状态">
          <AgriVueDetailTimeline :items="timelineSteps" />
        </AgriVueDetailSection>

        <AgriVueDetailSection title="关联入口">
          <AgriVueDetailRelated :items="relatedDocs" />
        </AgriVueDetailSection>
      </template>
    </AgriVueDetailLayout>

    <div v-else-if="!loading" class="detail-empty-card">
      <el-empty description="分销商档案不存在或无权查看">
        <el-button @click="router.push('/supply/distributors')">返回渠道授权网络</el-button>
      </el-empty>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  AgriVueDetailLayout,
  AgriVueDetailRelated,
  AgriVueDetailSection,
  AgriVueDetailTimeline,
} from '@agri/shared/vue/detail'
import S2b2cDetailInfoGrid from '../../../../frontend-shared/components/S2b2cDetailInfoGrid.vue'
import {
  formatDateTime,
  formatMoney,
  resolveOrderStatus,
} from '../../../../frontend-shared/detail/s2b2cDetailHelper'
import { supplierApi } from '../api'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const activeTab = ref('overview')
const channel = ref(null)
const products = ref([])
const recentOrders = ref([])
const metrics = ref({})

const activeCount = computed(() => products.value.filter((row) => row.status === 'ACTIVE').length)
const revokedCount = computed(() => products.value.filter((row) => row.status !== 'ACTIVE').length)

async function load() {
  const id = route.params.id
  if (!id) return
  loading.value = true
  try {
    const data = await supplierApi.getChannelDetail(id)
    channel.value = data?.channel || null
    products.value = data?.products || []
    recentOrders.value = data?.recentOrders || []
    metrics.value = data?.metrics || {}
  } catch (e) {
    channel.value = null
    ElMessage.error(e?.message || '分销商详情读取失败')
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

const distributorStatusBadge = computed(() =>
  activeCount.value > 0
    ? { label: `合作中 · ${activeCount.value} 款授权`, tone: 'green' }
    : { label: '暂无在售授权', tone: 'gray' },
)

const headerMeta = computed(() => [
  { label: '所属区域', value: channel.value?.region || '区域未填' },
  { label: '累计订单', value: `${metrics.value.orders || 0} 单` },
  { label: '累计 GMV', value: `¥${formatMoney(metrics.value.gmv)}` },
])

const tabs = computed(() => [
  { key: 'overview', label: '分销商详情' },
  { key: 'authorizations', label: '商品授权', count: products.value.length },
  { key: 'orders', label: '最近订单', count: recentOrders.value.length },
])

const overviewItems = computed(() => [
  { key: 'id', label: '渠道 ID', value: `CH-${channel.value?.id}`, mono: true },
  { key: 'shopName', label: '分销商名称', value: channel.value?.shopName || '—' },
  { key: 'region', label: '所属区域', value: channel.value?.region || '区域未填' },
  { key: 'activeAuth', label: '有效授权', value: `${activeCount.value} 款（已撤销 ${revokedCount.value} 款）`, mono: true },
])

const timelineSteps = computed(() => [
  {
    key: 'partner',
    title: '建立渠道合作关系',
    time: channel.value?.shopName || '已建档',
    state: 'done',
  },
  {
    key: 'auth',
    title: activeCount.value > 0 ? '已完成商品授权' : '等待商品授权',
    time: activeCount.value > 0 ? `有效 ${activeCount.value} 款` : '当前节点',
    state: activeCount.value > 0 ? 'done' : 'current',
  },
  {
    key: 'orders',
    title: Number(metrics.value?.orders || 0) > 0 ? '已产生分销订单' : '等待首单动销',
    time: Number(metrics.value?.orders || 0) > 0 ? `累计 ${metrics.value.orders} 单 · ¥${formatMoney(metrics.value.gmv)}` : activeCount.value > 0 ? '当前节点' : '待处理',
    state: Number(metrics.value?.orders || 0) > 0 ? 'done' : activeCount.value > 0 ? 'current' : 'pending',
  },
])

const relatedDocs = computed(() => [
  {
    key: 'partner-detail',
    label: '商家经营档案',
    code: `CH-${channel.value?.id}`,
    onClick: () => router.push(`/channel-partner-detail/${channel.value.id}`),
  },
  {
    key: 'supply-orders',
    label: '供货履约单',
    text: recentOrders.value.length ? `${recentOrders.value.length} 笔最近订单` : '',
    emptyText: '暂无订单',
    onClick: recentOrders.value.length ? () => { activeTab.value = 'orders' } : undefined,
  },
  {
    key: 'listing-config',
    label: '投放授权规则',
    text: '前往规则配置',
    onClick: () => router.push('/supply/listing-config'),
  },
])

async function revoke(row) {
  try {
    await ElMessageBox.confirm(`撤销「${row.name}」在该渠道的授权？撤销后渠道不能再下单该商品。`, '撤销授权', {
      confirmButtonText: '确认撤销',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  try {
    const res = await supplierApi.revokeChannelAuthorization(row.relationId)
    if (res?.success === false) {
      ElMessage.error(res.message || '撤销失败')
      return
    }
    ElMessage.success('已撤销授权')
    await load()
  } catch (e) {
    ElMessage.error(e?.message || '撤销失败')
  }
}

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
