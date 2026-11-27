<template>
  <div v-loading="loading">
    <AgriVueDetailLayout
      v-if="order.id"
      :code="order.orderNo || `#${order.id}`"
      :status="orderStatusBadge"
      :meta="headerMeta"
      :tabs="tabs"
      :active-tab="activeTab"
      back-label="返回订单监控"
      @back="router.push('/orders')"
      @tab-change="(key) => (activeTab = key)"
    >
      <template #actions>
        <el-button @click="printPage">打印</el-button>
        <el-button @click="load">刷新</el-button>
        <el-button v-if="order.status === 'PENDING_SHIP'" type="primary" @click="openShipDialog">
          平台代发
        </el-button>
      </template>

      <template v-if="activeTab === 'overview'">
        <AgriVueDetailSection title="基本信息">
          <S2b2cDetailInfoGrid :items="basicInfoItems" />
        </AgriVueDetailSection>

        <AgriVueDetailSection title="收货信息">
          <S2b2cDetailInfoGrid v-if="address" :items="receiverInfoItems" />
          <el-empty v-else description="暂无收货地址快照" :image-size="56" />
        </AgriVueDetailSection>

        <AgriVueDetailSection title="商品明细" :flush="true">
          <template #extra>
            <button
              v-if="items.length > 0"
              type="button"
              class="detail-section-link"
              @click="activeTab = 'items'"
            >
              查看全部 {{ items.length }} 项
            </button>
          </template>

          <el-table :data="previewItems" size="small">
            <el-table-column prop="name" label="商品名称" min-width="200" />
            <el-table-column prop="spec" label="规格" width="130">
              <template #default="{ row }">{{ row.spec || '标准规格' }}</template>
            </el-table-column>
            <el-table-column label="数量" width="90" align="right">
              <template #default="{ row }">
                <span class="detail-mono">{{ Number(row.quantity || 0).toLocaleString('zh-CN') }}</span>
              </template>
            </el-table-column>
            <el-table-column label="成交单价" width="110" align="right">
              <template #default="{ row }">
                <span class="detail-mono">¥{{ formatMoney(row.price) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="小计" width="120" align="right">
              <template #default="{ row }">
                <strong class="detail-mono">¥{{ formatMoney(row.totalAmount) }}</strong>
              </template>
            </el-table-column>
          </el-table>

          <template #footer>
            <div class="detail-total-bar">
              <div class="detail-total-breakdown">
                <span>商品金额 <strong>¥{{ formatMoney(order.totalAmount) }}</strong></span>
                <span>优惠 <strong>-¥{{ formatMoney(order.discountAmount) }}</strong></span>
                <span>运费 <strong>¥{{ formatMoney(order.freightAmount) }}</strong></span>
              </div>
              <div class="detail-total-main">
                <span>订单实付</span>
                <strong>¥{{ formatMoney(order.payAmount) }}</strong>
              </div>
            </div>
          </template>
        </AgriVueDetailSection>
      </template>

      <template v-else-if="activeTab === 'items'">
        <AgriVueDetailSection title="商品明细" :flush="true">
          <template #extra>
            <span class="muted">共 {{ items.length }} 项</span>
          </template>
          <el-table :data="items" size="small">
            <el-table-column prop="name" label="商品名称" min-width="220" />
            <el-table-column prop="spec" label="规格" width="130">
              <template #default="{ row }">{{ row.spec || '标准规格' }}</template>
            </el-table-column>
            <el-table-column label="成交单价" width="110" align="right">
              <template #default="{ row }">
                <span class="detail-mono">¥{{ formatMoney(row.price) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="供货价快照" width="120" align="right">
              <template #default="{ row }">
                <span class="detail-mono">{{ row.supplyPrice == null ? '—' : `¥${formatMoney(row.supplyPrice)}` }}</span>
              </template>
            </el-table-column>
            <el-table-column label="数量" width="90" align="right">
              <template #default="{ row }">
                <span class="detail-mono">{{ Number(row.quantity || 0).toLocaleString('zh-CN') }}</span>
              </template>
            </el-table-column>
            <el-table-column label="小计" width="120" align="right">
              <template #default="{ row }">
                <strong class="detail-mono">¥{{ formatMoney(row.totalAmount) }}</strong>
              </template>
            </el-table-column>
            <el-table-column label="秒杀" width="96" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.flashSaleId" size="small" type="danger">已参与</el-tag>
                <span v-else class="muted">—</span>
              </template>
            </el-table-column>
          </el-table>

          <template #footer>
            <div class="detail-total-bar">
              <div class="detail-total-main">
                <span>订单实付</span>
                <strong>¥{{ formatMoney(order.payAmount) }}</strong>
              </div>
            </div>
          </template>
        </AgriVueDetailSection>
      </template>

      <template v-else-if="activeTab === 'logistics'">
        <AgriVueDetailSection title="物流与发货协同">
          <S2b2cDetailInfoGrid :items="logisticsInfoItems" />
        </AgriVueDetailSection>

        <AgriVueDetailSection title="售后记录" :flush="afterSales.length > 0">
          <template #extra>
            <span class="muted">共 {{ afterSales.length }} 条</span>
          </template>
          <el-table v-if="afterSales.length" :data="afterSales" size="small">
            <el-table-column label="类型" width="100">
              <template #default="{ row }">{{ resolveAfterSaleType(row.type) }}</template>
            </el-table-column>
            <el-table-column prop="reason" label="原因" min-width="180" />
            <el-table-column label="退款金额" width="110" align="right">
              <template #default="{ row }">
                <span class="detail-mono">¥{{ formatMoney(row.amount) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100" align="center">
              <template #default="{ row }">
                <el-tag size="small" :type="resolveAfterSaleStatus(row.status).elType">
                  {{ resolveAfterSaleStatus(row.status).label }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="handleOpinion" label="处理意见" min-width="160">
              <template #default="{ row }">{{ row.handleOpinion || '—' }}</template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="暂无售后记录" :image-size="56" />
        </AgriVueDetailSection>

        <AgriVueDetailSection title="渠道佣金明细">
          <S2b2cDetailInfoGrid v-if="commission" :items="commissionInfoItems" />
          <el-empty v-else description="直购订单无渠道佣金" :image-size="56" />
        </AgriVueDetailSection>
      </template>

      <template v-else-if="activeTab === 'logs'">
        <AgriVueDetailSection title="操作日志" :flush="operationLogs.length > 0">
          <template #extra>
            <span class="muted">共 {{ operationLogs.length }} 条</span>
          </template>
          <el-table v-if="operationLogs.length" :data="operationLogs" size="small">
            <el-table-column prop="time" label="时间" width="175">
              <template #default="{ row }"><span class="detail-mono">{{ row.time }}</span></template>
            </el-table-column>
            <el-table-column prop="actor" label="参与方" width="120" />
            <el-table-column prop="action" label="动作" width="170" />
            <el-table-column prop="detail" label="详情" min-width="240" />
          </el-table>
          <el-empty v-else description="暂无操作日志" :image-size="56" />
        </AgriVueDetailSection>
      </template>

      <template #aside>
        <AgriVueDetailSection title="订单进度">
          <AgriVueDetailTimeline :items="timelineSteps" />
        </AgriVueDetailSection>

        <AgriVueDetailSection title="关联单据">
          <AgriVueDetailRelated :items="relatedDocs" />
        </AgriVueDetailSection>
      </template>
    </AgriVueDetailLayout>

    <div v-else-if="!loading" class="detail-empty-card">
      <el-empty description="订单不存在或无权查看">
        <el-button @click="router.push('/orders')">返回订单监控</el-button>
      </el-empty>
    </div>

    <el-dialog v-model="shipVisible" title="平台代发" width="460px">
      <el-form label-width="90px" @submit.prevent>
        <el-form-item label="物流公司">
          <el-input v-model="shipForm.company" placeholder="如：顺丰冷链" />
        </el-form-item>
        <el-form-item label="物流单号" required>
          <el-input v-model="shipForm.logisticsNo" placeholder="请填写电子面单号" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="shipVisible = false">取消</el-button>
        <el-button type="primary" :loading="shipping" @click="submitShip">确认发货</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
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
  buildS2b2cOrderLogs,
  buildS2b2cOrderTimeline,
  formatDateTime,
  formatMoney,
  maskPhone,
  resolveAfterSaleStatus,
  resolveAfterSaleType,
  resolveCommissionStatus,
  resolveOrderStatus,
  resolveProposerText,
  resolveShipmentStatus,
} from '../../../frontend-shared/detail/s2b2cDetailHelper'
import { platformApi } from '../api'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const activeTab = ref('overview')
const order = ref({})
const items = ref([])
const consumer = ref(null)
const address = ref(null)
const supplier = ref(null)
const channel = ref(null)
const shipment = ref(null)
const afterSales = ref([])
const commission = ref(null)

const shipVisible = ref(false)
const shipping = ref(false)
const shipForm = reactive({ company: '顺丰冷链', logisticsNo: '' })

async function load() {
  const id = route.params.id
  if (!id) return
  loading.value = true
  try {
    const data = (await platformApi.getOrderDetail(id)) || {}
    order.value = data.order || {}
    items.value = data.items || []
    consumer.value = data.consumer || null
    address.value = data.address || null
    supplier.value = data.supplier || null
    channel.value = data.channel || null
    shipment.value = data.shipment || null
    afterSales.value = data.afterSales || []
    commission.value = data.commission || null
  } catch (e) {
    order.value = {}
    ElMessage.error(e?.message || '订单详情读取失败')
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

const orderStatusBadge = computed(() => {
  const meta = resolveOrderStatus(order.value?.status)
  return { label: meta.label, tone: meta.tone }
})

const headerMeta = computed(() => [
  { label: '消费者', value: consumer.value?.nickname || maskPhone(consumer.value?.phone) || (order.value?.consumerId ? `用户 #${order.value.consumerId}` : '—') },
  { label: '供应商', value: supplier.value?.shopName || supplier.value?.companyName || (order.value?.supplierId ? `供应商 #${order.value.supplierId}` : '平台直购') },
  { label: '下单时间', value: formatDateTime(order.value?.createTime) },
])

const operationLogs = computed(() =>
  buildS2b2cOrderLogs(order.value, shipment.value, afterSales.value, commission.value ? [commission.value] : []),
)

const tabs = computed(() => [
  { key: 'overview', label: '订单详情' },
  { key: 'items', label: '商品明细', count: items.value.length },
  { key: 'logistics', label: '物流与售后', count: afterSales.value.length || null },
  { key: 'logs', label: '操作日志', count: operationLogs.value.length },
])

const previewItems = computed(() => items.value.slice(0, 5))

const basicInfoItems = computed(() => [
  { key: 'orderNo', label: '订单号', value: order.value.orderNo || `#${order.value.id}`, mono: true },
  { key: 'orderType', label: '订单来源', value: channel.value?.shopName || order.value.channelId ? '渠道分销订单' : '商城直购订单' },
  { key: 'consumer', label: '消费者', value: consumer.value?.nickname || consumer.value?.phone || order.value.consumerId || '—' },
  { key: 'supplier', label: '供应商', value: supplier.value?.shopName || supplier.value?.companyName || order.value.supplierId || '直购' },
  { key: 'channel', label: '归属渠道', value: channel.value?.shopName || (order.value.channelId ? `渠道 #${order.value.channelId}` : '直购无渠道') },
  { key: 'payMethod', label: '支付方式', value: order.value.payMethod || '线上支付' },
  { key: 'payTime', label: '支付时间', value: formatDateTime(order.value.payTime), mono: true },
  { key: 'payAmount', label: '实付金额', value: `¥${formatMoney(order.value.payAmount)}`, mono: true },
  { key: 'remark', label: '订单备注', value: order.value.remark || '—', fullWidth: true },
])

const receiverInfoItems = computed(() => {
  if (!address.value) return []
  const fullAddr = [address.value.province, address.value.city, address.value.district, address.value.address].filter(Boolean).join(' ')
  return [
    { key: 'name', label: '收货人', value: address.value.name || '—' },
    { key: 'phone', label: '联系电话', value: maskPhone(address.value.phone), mono: true },
    { key: 'address', label: '收货地址', value: fullAddr || '—', fullWidth: true },
    { key: 'logisticsCompany', label: '物流公司', value: order.value.logisticsCompany || '待发货' },
    { key: 'logisticsNo', label: '物流单号', value: order.value.logisticsNo || '待生成', mono: Boolean(order.value.logisticsNo) },
  ]
})

const logisticsInfoItems = computed(() => [
  { key: 'logisticsCompany', label: '物流公司', value: order.value.logisticsCompany || shipment.value?.logisticsCompany || '未发货' },
  { key: 'logisticsNo', label: '物流单号', value: order.value.logisticsNo || shipment.value?.logisticsNo || '—', mono: Boolean(order.value.logisticsNo || shipment.value?.logisticsNo) },
  { key: 'shipStatus', label: '发货协同', value: shipment.value ? resolveShipmentStatus(shipment.value.status).label : '无发货协同记录' },
  { key: 'proposer', label: '协同提交方', value: shipment.value ? resolveProposerText(shipment.value.proposerType) : '—' },
  { key: 'shipSubmitTime', label: '提交时间', value: shipment.value ? formatDateTime(shipment.value.createTime) : '—', mono: Boolean(shipment.value?.createTime) },
  { key: 'shipReason', label: '驳回原因', value: shipment.value?.reason || '—' },
])

const commissionInfoItems = computed(() => {
  if (!commission.value) return []
  return [
    { key: 'channelId', label: '渠道 ID', value: String(commission.value.channelId || '—'), mono: true },
    { key: 'rate', label: '佣金比例', value: `${Number(commission.value.rate || 0)}%`, mono: true },
    { key: 'amount', label: '佣金金额', value: `¥${formatMoney(commission.value.amount)}`, mono: true },
    { key: 'status', label: '结算状态', value: resolveCommissionStatus(commission.value.status).label },
    { key: 'settleTime', label: '结算时间', value: formatDateTime(commission.value.settleTime), mono: true, fullWidth: true },
  ]
})

const timelineSteps = computed(() => buildS2b2cOrderTimeline(order.value, shipment.value, afterSales.value))

const relatedDocs = computed(() => {
  const docs = []
  docs.push({
    key: 'supplier',
    label: '货源档案',
    text: supplier.value?.shopName || supplier.value?.companyName || (order.value.supplierId ? `供应商 #${order.value.supplierId}` : ''),
    emptyText: '平台直购',
    onClick: order.value.supplierId ? () => router.push(`/supplier-detail/${order.value.supplierId}`) : undefined,
  })
  docs.push({
    key: 'channel',
    label: '渠道商家',
    text: channel.value?.shopName || (order.value.channelId ? `渠道 #${order.value.channelId}` : ''),
    emptyText: '直购无渠道',
    onClick: order.value.channelId ? () => router.push(`/channel-partner-detail/${order.value.channelId}`) : undefined,
  })
  docs.push({
    key: 'logistics',
    label: '物流单号',
    code: order.value.logisticsNo || shipment.value?.logisticsNo || '',
    emptyText: '待生成',
    onClick: order.value.logisticsNo || shipment.value?.logisticsNo ? () => { activeTab.value = 'logistics' } : undefined,
  })
  docs.push({
    key: 'commission',
    label: '渠道佣金',
    code: commission.value ? `¥${formatMoney(commission.value.amount)}` : '',
    emptyText: '无渠道佣金',
    badge: commission.value ? resolveCommissionStatus(commission.value.status).label : undefined,
    badgeTone: commission.value ? resolveCommissionStatus(commission.value.status).tone : undefined,
    onClick: commission.value ? () => { activeTab.value = 'logistics' } : undefined,
  })
  docs.push({
    key: 'after-sale',
    label: '售后工单',
    text: afterSales.value.length ? `${afterSales.value.length} 条记录` : '',
    emptyText: '无售后申请',
    badge: afterSales.value.length ? resolveAfterSaleStatus(afterSales.value[0].status).label : undefined,
    badgeTone: afterSales.value.length ? resolveAfterSaleStatus(afterSales.value[0].status).tone : undefined,
    onClick: afterSales.value.length ? () => { activeTab.value = 'logistics' } : undefined,
  })
  return docs
})

function openShipDialog() {
  shipForm.logisticsNo = order.value.logisticsNo || ''
  shipForm.company = order.value.logisticsCompany || '顺丰冷链'
  shipVisible.value = true
}

async function submitShip() {
  if (!shipForm.logisticsNo.trim()) {
    ElMessage.warning('请填写物流单号')
    return
  }
  shipping.value = true
  try {
    const res = await platformApi.shipOrder(order.value.id, shipForm.logisticsNo.trim(), shipForm.company.trim())
    if (res?.success === false) {
      ElMessage.error(res.message || '发货失败')
      return
    }
    ElMessage.success(res?.message || '已发货')
    shipVisible.value = false
    await load()
  } catch (e) {
    ElMessage.error(e?.message || '发货失败')
  } finally {
    shipping.value = false
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
