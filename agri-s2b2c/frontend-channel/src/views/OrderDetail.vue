<template>
  <div v-loading="loading">
    <AgriVueDetailLayout
      v-if="order"
      :code="order.orderNo || `#${order.id}`"
      :status="orderStatusBadge"
      :extra-statuses="extraStatuses"
      :meta="headerMeta"
      :tabs="tabs"
      :active-tab="activeTab"
      back-label="返回订单列表"
      @back="router.push('/orders')"
      @tab-change="(key) => (activeTab = key)"
    >
      <template #actions>
        <el-button @click="printPage">打印</el-button>
        <el-button @click="load">刷新</el-button>
        <el-button v-if="canWithdraw" :loading="acting" @click="withdrawShipment">撤回发货信息</el-button>
        <el-button v-if="canConfirm" type="danger" plain :loading="acting" @click="rejectShipment">驳回发货</el-button>
        <el-button v-if="canConfirm" type="primary" :loading="acting" @click="confirmShipment">确认发货</el-button>
        <el-button v-else-if="canSubmit" type="primary" @click="shipVisible = true">提交发货</el-button>
      </template>

      <template v-if="statusHint" #banner>
        <el-alert :title="statusHint" type="info" :closable="false" show-icon />
      </template>

      <template v-if="activeTab === 'overview'">
        <AgriVueDetailSection title="基本信息">
          <S2b2cDetailInfoGrid :items="basicInfoItems" />
        </AgriVueDetailSection>

        <AgriVueDetailSection title="买家与收货信息">
          <template #extra>
            <button
              v-if="buyer?.id"
              type="button"
              class="detail-section-link"
              @click="router.push(`/customers/${buyer.id}`)"
            >
              查看客户画像
            </button>
          </template>
          <S2b2cDetailInfoGrid :items="receiverInfoItems" />
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
            <el-table-column prop="spec" label="规格" width="120">
              <template #default="{ row }">{{ row.spec || '标准规格' }}</template>
            </el-table-column>
            <el-table-column label="数量" width="90" align="right">
              <template #default="{ row }">
                <span class="detail-mono">{{ Number(row.quantity || 0).toLocaleString('zh-CN') }}</span>
              </template>
            </el-table-column>
            <el-table-column label="单价" width="110" align="right">
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
                <span>商品总额 <strong>¥{{ formatMoney(order.totalAmount ?? order.payAmount) }}</strong></span>
                <span v-if="totalCommission > 0">预计佣金 <strong>¥{{ formatMoney(totalCommission) }}</strong></span>
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
            <el-table-column label="单价" width="110" align="right">
              <template #default="{ row }"><span class="detail-mono">¥{{ formatMoney(row.price) }}</span></template>
            </el-table-column>
            <el-table-column label="数量" width="90" align="right">
              <template #default="{ row }"><span class="detail-mono">{{ Number(row.quantity || 0).toLocaleString('zh-CN') }}</span></template>
            </el-table-column>
            <el-table-column label="小计" width="120" align="right">
              <template #default="{ row }"><strong class="detail-mono">¥{{ formatMoney(row.totalAmount) }}</strong></template>
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
        <AgriVueDetailSection title="发货协同与物流">
          <S2b2cDetailInfoGrid :items="shipmentInfoItems" />
          <p class="section-note">确认发货后订单进入已发货状态；驳回后可修改物流信息重新提交。</p>
        </AgriVueDetailSection>

        <AgriVueDetailSection title="佣金与结算" :flush="commissions.length > 0">
          <template #extra>
            <span class="muted">共 {{ commissions.length }} 条</span>
          </template>
          <el-table v-if="commissions.length" :data="commissions" size="small">
            <el-table-column label="佣金金额" width="120" align="right">
              <template #default="{ row }"><strong class="detail-mono">¥{{ formatMoney(row.amount) }}</strong></template>
            </el-table-column>
            <el-table-column label="比例" width="90" align="right">
              <template #default="{ row }"><span class="detail-mono">{{ Number(row.rate || 0) }}%</span></template>
            </el-table-column>
            <el-table-column label="状态" width="100" align="center">
              <template #default="{ row }">
                <el-tag size="small" :type="resolveCommissionStatus(row.status).elType">
                  {{ resolveCommissionStatus(row.status).label }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="结算时间" width="175">
              <template #default="{ row }"><span class="detail-mono">{{ formatDateTime(row.settleTime) }}</span></template>
            </el-table-column>
            <el-table-column prop="settleBatchNo" label="结算批次" min-width="180" show-overflow-tooltip>
              <template #default="{ row }"><span class="detail-mono">{{ row.settleBatchNo || '—' }}</span></template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="本单暂无佣金记录（直购单或尚未结算）" :image-size="56" />
        </AgriVueDetailSection>

        <AgriVueDetailSection title="售后记录" :flush="afterSales.length > 0">
          <template #extra>
            <span class="muted">共 {{ afterSales.length }} 条</span>
          </template>
          <el-table v-if="afterSales.length" :data="afterSales" size="small">
            <el-table-column label="类型" width="100">
              <template #default="{ row }">{{ resolveAfterSaleType(row.type) }}</template>
            </el-table-column>
            <el-table-column label="退款金额" width="110" align="right">
              <template #default="{ row }"><span class="detail-mono">¥{{ formatMoney(row.amount) }}</span></template>
            </el-table-column>
            <el-table-column label="状态" width="100" align="center">
              <template #default="{ row }">
                <el-tag size="small" :type="resolveAfterSaleStatus(row.status).elType">
                  {{ resolveAfterSaleStatus(row.status).label }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="申请时间" min-width="175">
              <template #default="{ row }"><span class="detail-mono">{{ formatDateTime(row.createTime) }}</span></template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="本单没有售后申请" :image-size="56" />
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
            <el-table-column prop="actor" label="参与方" width="130" />
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
        <el-button @click="router.push('/orders')">返回订单列表</el-button>
      </el-empty>
    </div>

    <el-dialog v-model="shipVisible" title="订单发货" width="460px">
      <el-form label-width="90px" @submit.prevent>
        <el-form-item label="物流公司">
          <el-input v-model="shipForm.company" placeholder="如：顺丰冷链" />
        </el-form-item>
        <el-form-item label="物流单号" required>
          <el-input v-model="shipForm.logisticsNo" placeholder="填写电子面单号" />
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
import { ElMessage, ElMessageBox } from 'element-plus'
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
import { channelApi } from '../api'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const activeTab = ref('overview')
const order = ref(null)
const items = ref([])
const commissions = ref([])
const afterSales = ref([])
const shipment = ref(null)
const acting = ref(false)
const buyer = ref(null)
const address = ref(null)
const shipVisible = ref(false)
const shipping = ref(false)
const shipForm = reactive({ company: '云仓代发', logisticsNo: '' })

const canSubmit = computed(() => order.value?.status === 'PENDING_SHIP' && shipment.value?.status !== 'PROPOSED')
const canConfirm = computed(() => order.value?.status === 'PENDING_SHIP' && shipment.value?.status === 'PROPOSED' && shipment.value?.proposerType === 'SUPPLIER')
const canWithdraw = computed(() => order.value?.status === 'PENDING_SHIP' && shipment.value?.status === 'PROPOSED' && shipment.value?.proposerType === 'CHANNEL')
const channelCode = computed(() => String(order.value?.channelId || '').slice(-6))
const totalCommission = computed(() => commissions.value.reduce((sum, item) => sum + Number(item.amount || 0), 0))

async function load() {
  const id = route.params.id
  if (!id) return
  loading.value = true
  try {
    const data = await channelApi.getOrderDetail(id)
    order.value = data?.order || null
    items.value = data?.items || []
    commissions.value = data?.commissions || []
    afterSales.value = data?.afterSales || []
    shipment.value = await channelApi.getShipment(id).catch(() => null)
    buyer.value = data?.buyer || null
    address.value = data?.address || null
  } catch (e) {
    order.value = null
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

const extraStatuses = computed(() => {
  if (!shipment.value?.status) return []
  const meta = resolveShipmentStatus(shipment.value.status)
  return [{ label: `协同 · ${meta.label}`, tone: meta.tone }]
})

const headerMeta = computed(() => [
  { label: '买家', value: buyer.value?.nickname || maskPhone(buyer.value?.phone) || '微信用户' },
  { label: '商家编号', value: channelCode.value || '—' },
  { label: '下单时间', value: formatDateTime(order.value?.createTime) },
])

const statusHint = computed(() => ({
  PENDING_PAY: '买家尚未支付，超时后订单将自动关闭。',
  PENDING_SHIP: '买家已付款，请及时发货并回传物流单号。',
  SHIPPED: '商品已出库，等待买家确认收货。',
  PENDING_RECEIVE: '商品运输中，等待买家确认收货。',
  COMPLETED: '订单已完成，佣金按 T+1 规则结算。',
  CANCELLED: '订单已取消，不产生佣金。',
  REFUNDING: '售后处理中，退款完成后佣金自动冲回。',
}[order.value?.status] || ''))

const operationLogs = computed(() =>
  buildS2b2cOrderLogs(order.value, shipment.value, afterSales.value, commissions.value),
)

const tabs = computed(() => [
  { key: 'overview', label: '订单详情' },
  { key: 'items', label: '商品明细', count: items.value.length },
  { key: 'logistics', label: '物流与佣金', count: commissions.value.length + afterSales.value.length || null },
  { key: 'logs', label: '操作日志', count: operationLogs.value.length },
])

const previewItems = computed(() => items.value.slice(0, 5))

const basicInfoItems = computed(() => [
  { key: 'orderNo', label: '订单号', value: order.value.orderNo || `#${order.value.id}`, mono: true },
  { key: 'status', label: '订单状态', value: resolveOrderStatus(order.value.status).label },
  { key: 'payAmount', label: '实付金额', value: `¥${formatMoney(order.value.payAmount)}`, mono: true },
  { key: 'payTime', label: '支付时间', value: formatDateTime(order.value.payTime), mono: true },
  { key: 'logisticsCompany', label: '物流公司', value: order.value.logisticsCompany || '待发货' },
  { key: 'logisticsNo', label: '物流单号', value: order.value.logisticsNo || '待生成', mono: Boolean(order.value.logisticsNo) },
  { key: 'remark', label: '买家备注', value: order.value.remark || '无', fullWidth: true },
])

const receiverInfoItems = computed(() => {
  const list = [
    { key: 'buyer', label: '买家', value: `${buyer.value?.nickname || '微信用户'}${buyer.value?.phone ? `（${maskPhone(buyer.value.phone)}）` : ''}` },
    { key: 'buyerStats', label: '历史下单', value: `${buyer.value?.orderCount || 0} 单 · 累计 ¥${formatMoney(buyer.value?.totalAmount)}`, mono: true },
  ]
  if (address.value) {
    list.push(
      { key: 'receiver', label: '收货人', value: address.value.name || '—' },
      { key: 'receiverPhone', label: '联系电话', value: maskPhone(address.value.phone), mono: true },
      { key: 'receiverAddr', label: '收货地址', value: `${address.value.region || ''}${address.value.detail || ''}` || '—', fullWidth: true },
    )
  }
  return list
})

const shipmentInfoItems = computed(() => [
  { key: 'shipStatus', label: '协同状态', value: shipment.value ? resolveShipmentStatus(shipment.value.status).label : '未发起发货协同' },
  { key: 'proposer', label: '提交方', value: shipment.value ? resolveProposerText(shipment.value.proposerType, 'CHANNEL') : '—' },
  { key: 'company', label: '物流公司', value: shipment.value?.logisticsCompany || order.value.logisticsCompany || '—' },
  { key: 'no', label: '物流单号', value: shipment.value?.logisticsNo || order.value.logisticsNo || '—', mono: Boolean(shipment.value?.logisticsNo || order.value.logisticsNo) },
  { key: 'time', label: '提交时间', value: shipment.value ? formatDateTime(shipment.value.createTime) : '—', mono: Boolean(shipment.value?.createTime) },
  { key: 'reason', label: '驳回原因', value: shipment.value?.reason || '—' },
])

const timelineSteps = computed(() => buildS2b2cOrderTimeline(order.value, shipment.value, afterSales.value))

const relatedDocs = computed(() => {
  const firstCommission = commissions.value[0]
  return [
    {
      key: 'customer',
      label: '客户画像',
      text: buyer.value?.nickname || (buyer.value?.id ? `客户 #${buyer.value.id}` : ''),
      emptyText: '暂无客户档案',
      onClick: buyer.value?.id ? () => router.push(`/customers/${buyer.value.id}`) : undefined,
    },
    {
      key: 'logistics',
      label: '物流单号',
      code: order.value.logisticsNo || shipment.value?.logisticsNo || '',
      emptyText: '待回传',
      onClick: order.value.logisticsNo || shipment.value?.logisticsNo ? () => { activeTab.value = 'logistics' } : undefined,
    },
    {
      key: 'commission',
      label: '结算佣金',
      code: firstCommission ? `¥${formatMoney(totalCommission.value)}` : '',
      emptyText: '暂无佣金记录',
      badge: firstCommission ? resolveCommissionStatus(firstCommission.status).label : undefined,
      badgeTone: firstCommission ? resolveCommissionStatus(firstCommission.status).tone : undefined,
      onClick: firstCommission ? () => { activeTab.value = 'logistics' } : undefined,
    },
    {
      key: 'after-sale',
      label: '售后工单',
      text: afterSales.value.length ? `${afterSales.value.length} 条记录` : '',
      emptyText: '无售后申请',
      badge: afterSales.value.length ? resolveAfterSaleStatus(afterSales.value[0].status).label : undefined,
      badgeTone: afterSales.value.length ? resolveAfterSaleStatus(afterSales.value[0].status).tone : undefined,
      onClick: afterSales.value.length ? () => { activeTab.value = 'logistics' } : undefined,
    },
  ]
})

async function submitShip() {
  if (!shipForm.logisticsNo.trim()) {
    ElMessage.warning('请填写物流单号')
    return
  }
  shipping.value = true
  try {
    const res = await channelApi.shipOrder(order.value.id, {
      logisticsNo: shipForm.logisticsNo.trim(),
      company: shipForm.company.trim(),
    })
    if (res?.success === false) {
      ElMessage.error(res.message || '发货失败')
      return
    }
    ElMessage.success(res?.message || '发货成功')
    shipVisible.value = false
    await load()
  } catch (e) {
    ElMessage.error(e?.message || '发货失败')
  } finally {
    shipping.value = false
  }
}

async function confirmShipment() {
  acting.value = true
  try {
    const res = await channelApi.confirmShipment(order.value.id)
    if (res?.success === false) return ElMessage.error(res.message || '确认失败')
    ElMessage.success(res?.message || '已确认发货')
    await load()
  } catch (e) {
    ElMessage.error(e?.message || '确认失败')
  } finally {
    acting.value = false
  }
}

async function rejectShipment() {
  try {
    const result = await ElMessageBox.prompt('请填写驳回原因', '驳回发货信息', {
      inputPattern: /\S+/,
      inputErrorMessage: '请填写原因',
    })
    acting.value = true
    const res = await channelApi.rejectShipment(order.value.id, result.value)
    if (res?.success === false) return ElMessage.error(res.message || '驳回失败')
    ElMessage.success('已驳回')
    await load()
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error(e?.message || '驳回失败')
  } finally {
    acting.value = false
  }
}

async function withdrawShipment() {
  acting.value = true
  try {
    const res = await channelApi.withdrawShipment(order.value.id)
    if (res?.success === false) return ElMessage.error(res.message || '撤回失败')
    ElMessage.success('已撤回')
    await load()
  } catch (e) {
    ElMessage.error(e?.message || '撤回失败')
  } finally {
    acting.value = false
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

.section-note {
  margin: 12px 0 0;
  color: #8c9a92;
  font-size: 12px;
  line-height: 1.6;
}

.detail-empty-card {
  padding: 48px 24px;
  border: 1px solid #e8ecea;
  border-radius: 10px;
  background: #fff;
}
</style>
