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
      back-label="返回供货履约"
      @back="router.push('/supply/orders')"
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

      <template v-if="activeTab === 'overview'">
        <AgriVueDetailSection title="基本信息">
          <S2b2cDetailInfoGrid :items="basicInfoItems" />
        </AgriVueDetailSection>

        <AgriVueDetailSection title="渠道与履约信息">
          <S2b2cDetailInfoGrid :items="channelFulfillmentItems" />
          <p class="section-note">收货人隐私信息由消费者端与用户中心管理，供货履约端仅按订单快照执行出库与回传单号。</p>
        </AgriVueDetailSection>

        <AgriVueDetailSection title="商品明细与溯源" :flush="true">
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
            <el-table-column prop="name" label="商品名称" min-width="180" />
            <el-table-column prop="spec" label="规格" width="110">
              <template #default="{ row }">{{ row.spec || '标准规格' }}</template>
            </el-table-column>
            <el-table-column prop="prodBatchNo" label="来源批次" min-width="150">
              <template #default="{ row }">
                <span class="detail-mono">{{ row.prodBatchNo || '未记录' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="数量" width="80" align="right">
              <template #default="{ row }"><span class="detail-mono">{{ row.quantity }}</span></template>
            </el-table-column>
            <el-table-column label="单价" width="100" align="right">
              <template #default="{ row }"><span class="detail-mono">¥{{ formatMoney(row.price) }}</span></template>
            </el-table-column>
            <el-table-column label="小计" width="110" align="right">
              <template #default="{ row }"><strong class="detail-mono">¥{{ formatMoney(row.totalAmount) }}</strong></template>
            </el-table-column>
            <el-table-column label="单品溯源" width="160" align="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="showTrace(row)">查看链路</el-button>
                <el-button
                  v-if="order.status === 'PENDING_SHIP' && row.prodBatchNo"
                  link
                  type="success"
                  @click="openTraceBind(row)"
                >
                  绑定单品码
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <template #footer>
            <div class="detail-total-bar">
              <div class="detail-total-breakdown">
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
        <AgriVueDetailSection title="商品明细与单品溯源" :flush="true">
          <template #extra>
            <span class="muted">共 {{ items.length }} 项</span>
          </template>
          <el-table :data="items" size="small">
            <el-table-column prop="name" label="商品名称" min-width="190" />
            <el-table-column prop="spec" label="规格" width="110">
              <template #default="{ row }">{{ row.spec || '标准规格' }}</template>
            </el-table-column>
            <el-table-column prop="prodBatchNo" label="下单来源批次" min-width="170">
              <template #default="{ row }">
                <span class="detail-mono">{{ row.prodBatchNo || '历史来源未记录' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="单价" width="100" align="right">
              <template #default="{ row }"><span class="detail-mono">¥{{ formatMoney(row.price) }}</span></template>
            </el-table-column>
            <el-table-column label="数量" width="80" align="right">
              <template #default="{ row }"><span class="detail-mono">{{ row.quantity }}</span></template>
            </el-table-column>
            <el-table-column label="小计" width="110" align="right">
              <template #default="{ row }"><strong class="detail-mono">¥{{ formatMoney(row.totalAmount) }}</strong></template>
            </el-table-column>
            <el-table-column label="单品溯源" min-width="165" align="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="showTrace(row)">查看链路</el-button>
                <el-button
                  v-if="order.status === 'PENDING_SHIP' && row.prodBatchNo"
                  link
                  type="success"
                  @click="openTraceBind(row)"
                >
                  绑定单品码
                </el-button>
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
        <AgriVueDetailSection title="发货协同与物流">
          <S2b2cDetailInfoGrid :items="shipmentInfoItems" />
          <p class="section-note">确认发货后订单进入已发货状态；驳回后双方可修改物流单号重新提交。</p>
        </AgriVueDetailSection>

        <AgriVueDetailSection title="售后记录" :flush="afterSales.length > 0">
          <template #extra>
            <span class="muted">共 {{ afterSales.length }} 条</span>
          </template>
          <el-table v-if="afterSales.length" :data="afterSales" size="small">
            <el-table-column label="类型" width="100">
              <template #default="{ row }">{{ resolveAfterSaleType(row.type) }}</template>
            </el-table-column>
            <el-table-column prop="reason" label="原因" min-width="200" />
            <el-table-column label="金额" width="110" align="right">
              <template #default="{ row }"><span class="detail-mono">¥{{ formatMoney(row.amount) }}</span></template>
            </el-table-column>
            <el-table-column label="状态" width="110" align="center">
              <template #default="{ row }">
                <el-tag size="small" :type="resolveAfterSaleStatus(row.status).elType">
                  {{ resolveAfterSaleStatus(row.status).label }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="handleOpinion" label="处理意见" min-width="160">
              <template #default="{ row }">{{ row.handleOpinion || '—' }}</template>
            </el-table-column>
            <el-table-column label="申请时间" width="175">
              <template #default="{ row }"><span class="detail-mono">{{ formatDateTime(row.createTime) }}</span></template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="本单暂无售后记录" :image-size="56" />
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
        <AgriVueDetailSection title="履约进度">
          <AgriVueDetailTimeline :items="timelineSteps" />
        </AgriVueDetailSection>

        <AgriVueDetailSection title="关联单据">
          <AgriVueDetailRelated :items="relatedDocs" />
        </AgriVueDetailSection>
      </template>
    </AgriVueDetailLayout>

    <div v-else-if="!loading" class="detail-empty-card">
      <el-empty description="供货订单不存在或无权查看">
        <el-button @click="router.push('/supply/orders')">返回供货履约</el-button>
      </el-empty>
    </div>

    <el-dialog v-model="traceBindVisible" title="绑定出货单品码" width="620px">
      <el-alert type="info" :closable="false" title="每件销售单位一码；码须激活、质检合格且与下单批次一致。绑定后不允许覆盖。" />
      <p class="dialog-sub">{{ traceItem?.name }} · 来源批次 {{ traceItem?.prodBatchNo }} · 需绑定 {{ traceItem?.quantity }} 个码</p>
      <el-input v-model="traceCodes" type="textarea" :rows="8" placeholder="每行一个单品溯源码" />
      <el-alert v-if="traceError" type="error" :closable="false" :title="traceError" style="margin-top: 12px" />
      <template #footer>
        <el-button @click="traceBindVisible = false">取消</el-button>
        <el-button type="primary" :loading="traceBinding" @click="bindTrace">校验并绑定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="traceViewVisible" title="订单来源与单品履约" width="760px">
      <el-alert v-if="traceError" type="error" :title="traceError" :closable="false" />
      <template v-if="traceView">
        <p class="dialog-sub">下单来源批次：{{ traceView.batchNo || '未记录' }}；此记录为下单快照批次。</p>
        <el-table :data="traceView.units || []" border size="small">
          <el-table-column prop="traceCode" label="出货单品码" min-width="260" />
          <el-table-column prop="batchNo" label="批次" />
          <el-table-column prop="boundAt" label="绑定时间" />
        </el-table>
        <el-empty v-if="!traceView.units?.length" description="尚未记录单品履约绑定" />
        <el-timeline v-if="traceView.nodes?.length" style="margin-top: 20px">
          <el-timeline-item
            v-for="(node, index) in traceView.nodes"
            :key="index"
            :timestamp="node.occurredAt || node.time || '未记录时间'"
          >
            {{ node.title || node.nodeName || node.stage }} · {{ node.description || node.detail }}
          </el-timeline-item>
        </el-timeline>
      </template>
    </el-dialog>

    <el-dialog v-model="shipVisible" title="订单发货" width="460px">
      <el-form label-width="90px" @submit.prevent>
        <el-form-item label="物流公司"><el-input v-model="shipForm.company" /></el-form-item>
        <el-form-item label="物流单号" required><el-input v-model="shipForm.logisticsNo" placeholder="填写电子面单号" /></el-form-item>
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
import S2b2cDetailInfoGrid from '../../../../frontend-shared/components/S2b2cDetailInfoGrid.vue'
import {
  buildS2b2cOrderLogs,
  buildS2b2cOrderTimeline,
  formatDateTime,
  formatMoney,
  resolveAfterSaleStatus,
  resolveAfterSaleType,
  resolveGradeText,
  resolveOrderStatus,
  resolveProposerText,
  resolveShipmentStatus,
} from '../../../../frontend-shared/detail/s2b2cDetailHelper'
import { supplierApi } from '../api'

const route = useRoute()
const router = useRouter()

const traceBindVisible = ref(false)
const traceViewVisible = ref(false)
const traceBinding = ref(false)
const traceItem = ref(null)
const traceView = ref(null)
const traceCodes = ref('')
const traceError = ref('')

const loading = ref(true)
const activeTab = ref('overview')
const order = ref(null)
const items = ref([])
const channel = ref(null)
const afterSales = ref([])
const shipment = ref(null)
const acting = ref(false)

const shipVisible = ref(false)
const shipping = ref(false)
const shipForm = reactive({ company: '顺丰冷链', logisticsNo: '' })

const canSubmit = computed(() => order.value?.status === 'PENDING_SHIP' && shipment.value?.status !== 'PROPOSED')
const canConfirm = computed(() => order.value?.status === 'PENDING_SHIP' && shipment.value?.status === 'PROPOSED' && shipment.value?.proposerType === 'CHANNEL')
const canWithdraw = computed(() => order.value?.status === 'PENDING_SHIP' && shipment.value?.status === 'PROPOSED' && shipment.value?.proposerType === 'SUPPLIER')

async function load() {
  const id = route.params.id
  if (!id) return
  loading.value = true
  try {
    const data = await supplierApi.getOrderDetail(id)
    order.value = data?.order || null
    items.value = data?.items || []
    channel.value = data?.channel || null
    afterSales.value = data?.afterSales || []
    shipment.value = await supplierApi.getShipment(id).catch(() => null)
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
  { label: '归属渠道', value: channel.value?.shopName || '直购订单' },
  { label: '实付金额', value: `¥${formatMoney(order.value?.payAmount)}` },
  { label: '下单时间', value: formatDateTime(order.value?.createTime) },
])

const operationLogs = computed(() => buildS2b2cOrderLogs(order.value, shipment.value, afterSales.value, []))

const tabs = computed(() => [
  { key: 'overview', label: '订单详情' },
  { key: 'items', label: '商品明细', count: items.value.length },
  { key: 'logistics', label: '物流与售后', count: afterSales.value.length || null },
  { key: 'logs', label: '操作日志', count: operationLogs.value.length },
])

const previewItems = computed(() => items.value.slice(0, 5))

const basicInfoItems = computed(() => [
  { key: 'orderNo', label: '订单号', value: order.value.orderNo || `#${order.value.id}`, mono: true },
  { key: 'status', label: '订单状态', value: resolveOrderStatus(order.value.status).label },
  { key: 'payAmount', label: '实付金额', value: `¥${formatMoney(order.value.payAmount)}`, mono: true },
  { key: 'freight', label: '运费金额', value: `¥${formatMoney(order.value.freightAmount)}`, mono: true },
  { key: 'payTime', label: '支付时间', value: formatDateTime(order.value.payTime), mono: true },
  { key: 'createTime', label: '下单时间', value: formatDateTime(order.value.createTime), mono: true },
])

const channelFulfillmentItems = computed(() => [
  { key: 'channel', label: '渠道商家', value: channel.value?.shopName || '直购订单（无渠道归属）' },
  { key: 'grade', label: '渠道等级', value: resolveGradeText(channel.value?.grade) },
  { key: 'deliveryType', label: '发货方式', value: order.value.deliveryType || '供应商直发' },
  { key: 'addressSnap', label: '收货地址', value: order.value.addressId ? '以订单快照为准' : '—' },
  { key: 'logisticsCompany', label: '物流公司', value: order.value.logisticsCompany || shipment.value?.logisticsCompany || '未发货' },
  { key: 'logisticsNo', label: '物流单号', value: order.value.logisticsNo || shipment.value?.logisticsNo || '待回传', mono: Boolean(order.value.logisticsNo || shipment.value?.logisticsNo) },
  { key: 'remark', label: '买家备注', value: order.value.remark || '无', fullWidth: true },
])

const shipmentInfoItems = computed(() => [
  { key: 'shipStatus', label: '协同状态', value: shipment.value ? resolveShipmentStatus(shipment.value.status).label : '未发起发货协同' },
  { key: 'proposer', label: '提交方', value: shipment.value ? resolveProposerText(shipment.value.proposerType, 'SUPPLIER') : '—' },
  { key: 'company', label: '物流公司', value: shipment.value?.logisticsCompany || order.value.logisticsCompany || '—' },
  { key: 'no', label: '物流单号', value: shipment.value?.logisticsNo || order.value.logisticsNo || '—', mono: Boolean(shipment.value?.logisticsNo || order.value.logisticsNo) },
  { key: 'time', label: '提交时间', value: shipment.value ? formatDateTime(shipment.value.createTime) : '—', mono: Boolean(shipment.value?.createTime) },
  { key: 'reason', label: '驳回原因', value: shipment.value?.reason || '—' },
])

const timelineSteps = computed(() => buildS2b2cOrderTimeline(order.value, shipment.value, afterSales.value))

const relatedDocs = computed(() => {
  const firstBatch = items.value.find((it) => it.prodBatchNo)?.prodBatchNo || ''
  return [
    {
      key: 'channel',
      label: '关联渠道',
      text: channel.value?.shopName || '',
      emptyText: '直购无渠道',
      onClick: channel.value?.id ? () => router.push(`/supply/distributor-detail/${channel.value.id}`) : undefined,
    },
    {
      key: 'batch',
      label: '来源批次',
      code: firstBatch,
      emptyText: '未关联批次',
      onClick: firstBatch ? () => showTrace(items.value.find((it) => it.prodBatchNo)) : undefined,
    },
    {
      key: 'logistics',
      label: '物流单号',
      code: order.value.logisticsNo || shipment.value?.logisticsNo || '',
      emptyText: '待回传',
      onClick: order.value.logisticsNo || shipment.value?.logisticsNo ? () => { activeTab.value = 'logistics' } : undefined,
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

function openTraceBind(item) {
  traceItem.value = item
  traceCodes.value = ''
  traceError.value = ''
  traceBindVisible.value = true
}

async function bindTrace() {
  if (traceBinding.value) return
  traceBinding.value = true
  traceError.value = ''
  try {
    const codes = traceCodes.value.split(/\r?\n/).map((v) => v.trim()).filter(Boolean)
    await supplierApi.bindTraceUnits(order.value.id, traceItem.value.id, codes)
    traceBindVisible.value = false
    ElMessage.success('出货单品码已绑定')
  } catch (e) {
    traceError.value = e?.response?.data?.message || e?.message || '绑定失败'
  } finally {
    traceBinding.value = false
  }
}

async function showTrace(item) {
  if (!item) return
  traceError.value = ''
  traceView.value = null
  traceViewVisible.value = true
  try {
    traceView.value = await supplierApi.getItemTrace(order.value.id, item.id)
  } catch (e) {
    traceError.value = e?.response?.data?.message || e?.message || '溯源加载失败'
  }
}

async function submitShip() {
  if (!shipForm.logisticsNo.trim()) return ElMessage.warning('请填写物流单号')
  shipping.value = true
  try {
    const res = await supplierApi.shipOrder(order.value.id, {
      logisticsNo: shipForm.logisticsNo.trim(),
      company: shipForm.company.trim(),
    })
    if (res?.success === false) return ElMessage.error(res.message || '发货失败')
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
    const res = await supplierApi.confirmShipment(order.value.id)
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
    const res = await supplierApi.rejectShipment(order.value.id, result.value)
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
    const res = await supplierApi.withdrawShipment(order.value.id)
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

.dialog-sub {
  margin: 12px 0;
  color: #5a6860;
  font-size: 13px;
}

.detail-empty-card {
  padding: 48px 24px;
  border: 1px solid #e8ecea;
  border-radius: 10px;
  background: #fff;
}
</style>
