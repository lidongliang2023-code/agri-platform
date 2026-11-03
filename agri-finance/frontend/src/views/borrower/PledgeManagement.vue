<template>
  <section class="finance-page">
    <header class="finance-page-heading">
      <div>
        <small>WAREHOUSE RECEIPT &amp; PLEDGE</small>
        <h1>仓单与质押</h1>
        <p>仓单由你名下<b>已入库的采收批次</b>生成：品类、数量、仓库、溯源码与区块链存证都从生产管理模块核对，不手工填报。</p>
      </div>
      <div class="finance-page-heading-actions">
        <el-button class="finance-ghost-button" :loading="loading" @click="load">刷新</el-button>
        <el-button class="finance-action-button" @click="openReceipt">从批次开仓单</el-button>
      </div>
    </header>

    <div class="finance-kpis">
      <article class="finance-kpi">
        <span>可开单批次</span>
        <strong>{{ openableBatches.length }}<em> 个</em></strong>
        <small>已入库且没有未释放仓单</small>
      </article>
      <article class="finance-kpi">
        <span>我的仓单</span>
        <strong>{{ receipts.length }}<em> 张</em></strong>
        <small>{{ toPledgeCount }} 张待质押</small>
      </article>
      <article class="finance-kpi">
        <span>在押货值</span>
        <strong>{{ compactMoney(pledgedValue) }}</strong>
        <small>状态为已质押的仓单</small>
      </article>
      <article class="finance-kpi">
        <span>质押可融资</span>
        <strong>{{ compactMoney(pledgeLoanLimit) }}</strong>
        <small>已生效质押按折算率测算</small>
      </article>
    </div>

    <section class="finance-card">
      <div class="finance-card-head">
        <strong>我的仓单</strong>
        <div class="finance-tabs">
          <button v-for="item in receiptFilters" :key="item.key" type="button" :class="{ on: receiptFilter === item.key }" @click="receiptFilter = item.key">
            {{ item.label }}
          </button>
        </div>
      </div>
      <div v-if="filteredReceipts.length" class="receipt-list">
        <article v-for="item in filteredReceipts" :key="item.id">
          <div class="receipt-head">
            <span class="receipt-icon"><Box /></span>
            <div>
              <strong>{{ item.commodityType }}</strong>
              <p>{{ item.receiptNo }} · 批次 {{ item.batchNo || '—' }}</p>
            </div>
            <FinanceStatus :value="item.status" />
          </div>
          <div class="receipt-values">
            <div><span>数量</span><strong>{{ num(item.quantity) }} {{ item.unit || '' }}</strong></div>
            <div><span>单价</span><strong>{{ money(item.unitPrice) }}</strong></div>
            <div><span>仓单货值</span><strong>{{ money(item.totalValue) }}</strong></div>
            <div><span>折算率上限</span><strong>{{ rateCap(item) }}%</strong></div>
          </div>
          <div class="receipt-meta">
            <span><OfficeBuilding /> {{ item.warehouseName || '仓库待确认' }}</span>
            <span><Tickets /> 溯源码 {{ item.traceCode || '—' }}</span>
            <span :class="{ warn: !item.blockchainHash }">
              <Link /> {{ item.blockchainHash ? `存证 ${shortHash(item.blockchainHash)}` : '该批次尚未上链存证' }}
            </span>
            <span><Calendar /> 有效期至 {{ shortDate(item.expireDate) }}</span>
          </div>
          <div class="receipt-actions">
            <el-button v-if="item.status === '待质押'" link class="finance-link-button" @click="openPledge(item)">发起质押</el-button>
            <el-button link class="finance-link-button" @click="openMonitor(item)">仓储读数</el-button>
            <span v-if="item.status === '已质押'" class="receipt-hint">已被质押占用，借款结清后自动释放</span>
          </div>
        </article>
      </div>
      <div v-else class="finance-empty">
        <strong>还没有仓单</strong>
        <p v-if="batchError">读不到你的采收批次：{{ batchError }}</p>
        <p v-else>仓单来自你名下<b>已完成成品入库</b>的采收批次。先到生产管理模块把批次入库，再回来开单。</p>
      </div>
    </section>

    <section class="finance-card">
      <div class="finance-card-head">
        <strong>质押记录</strong>
        <div class="finance-tabs">
          <button v-for="item in pledgeFilters" :key="item.key" type="button" :class="{ on: pledgeFilter === item.key }" @click="pledgeFilter = item.key">
            {{ item.label }}
          </button>
        </div>
      </div>
      <el-table :data="filteredPledges" style="width: 100%">
        <el-table-column prop="pledgeNo" label="质押编号" min-width="130" />
        <el-table-column label="来源仓单" min-width="150">
          <template #default="{ row }">
            <span v-if="row.receiptNo">{{ row.receiptNo }}<em v-if="row.batchNo"> / {{ row.batchNo }}</em></span>
            <span v-else class="cell-muted">历史记录（未关联仓单）</span>
          </template>
        </el-table-column>
        <el-table-column prop="commodityType" label="质押物" min-width="100" />
        <el-table-column label="数量" min-width="110"><template #default="{ row }">{{ num(row.quantity) }}</template></el-table-column>
        <el-table-column label="货值" min-width="110" align="right"><template #default="{ row }">{{ compactMoney(row.totalValue) }}</template></el-table-column>
        <el-table-column label="折算率" width="80" align="right"><template #default="{ row }">{{ row.pledgeRate }}%</template></el-table-column>
        <el-table-column label="可融资" min-width="110" align="right"><template #default="{ row }">{{ compactMoney(row.loanAmount) }}</template></el-table-column>
        <el-table-column label="状态" width="90"><template #default="{ row }"><FinanceStatus :value="row.status" /></template></el-table-column>
      </el-table>
      <div v-if="!filteredPledges.length" class="finance-empty">
        <strong>暂无质押记录</strong>
        <p>仓单开出来后，对状态为「待质押」的仓单点发起质押即可提交平台审核。</p>
      </div>
    </section>

    <el-dialog v-model="receiptOpen" title="从采收批次开仓单" width="min(720px, 94vw)">
      <el-form ref="receiptFormRef" :model="receiptForm" :rules="receiptRules" label-position="top">
        <el-form-item label="采收批次（只列出你名下已入库的批次）" prop="batchId">
          <el-select v-model="receiptForm.batchId" placeholder="选择批次" style="width: 100%" @change="previewBatch">
            <el-option v-for="row in batches" :key="row.batchId" :value="row.batchId"
                       :label="`${row.batchNo} · ${row.cropName}${row.cropVariety ? ' / ' + row.cropVariety : ''}`"
                       :disabled="!!row.receiptId && row.receiptStatus !== '已释放'">
              <span>{{ row.batchNo }} · {{ row.cropName }}</span>
              <em class="opt-hint">{{ num(row.quantity) }}{{ row.unit }} / {{ row.warehouseName || '未填仓库' }}
                {{ row.receiptNo ? `（已有仓单 ${row.receiptNo}）` : '' }}</em>
            </el-option>
          </el-select>
        </el-form-item>
        <div v-loading="previewLoading" class="batch-preview">
          <div v-if="preview.batch">
            <div class="preview-line"><span>采收日期</span><b>{{ preview.batch.harvestDate || '—' }}</b></div>
            <div class="preview-line"><span>质量等级</span><b>{{ preview.batch.grade || '—' }}</b></div>
            <div class="preview-line"><span>在库可用量</span><b>{{ num(preview.availableQuantity) }} {{ preview.batch.unit }}</b>
              <i>已按分仓现算，出库与冻结部分不计入</i></div>
            <div class="preview-line"><span>区块链存证</span>
              <b v-if="preview.chain" class="green">{{ preview.chain.chainType }} · {{ preview.chain.txHash }}</b>
              <b v-else class="red">该批次没有成功的上链记录，仓单可以开，但质押审核会要求补存证</b></div>
            <div v-if="preview.inventories && preview.inventories.length" class="preview-stock">
              <div v-for="row in preview.inventories" :key="row.inventoryId">
                <span>{{ row.warehouseName || '未填仓库' }}{{ row.locationCode ? ` / ${row.locationCode}` : '' }}</span>
                <b>{{ num(row.currentQty) }} {{ row.unit }}</b>
                <em v-if="Number(row.frozenQty) > 0">冻结 {{ num(row.frozenQty) }}</em>
              </div>
            </div>
          </div>
          <p v-else class="preview-empty">选择批次后这里显示生产域核对结果（库存、存证、分仓明细）。</p>
        </div>
        <div class="finance-form-grid">
          <el-form-item label="质押物品种（决定折算率上限）" prop="goodsCode">
            <el-select v-model="receiptForm.goodsCode" placeholder="选择品种" style="width: 100%">
              <el-option v-for="g in goodsList" :key="g.goodsCode" :value="g.goodsCode"
                         :label="`${g.goodsName}（最高 ${g.pledgeRateMax}%）`">
                <span>{{ g.goodsName }}</span>
                <em class="opt-hint">{{ g.category }} · 最高 {{ g.pledgeRateMax }}% · 最长 {{ g.maxPledgeTerm }} 天</em>
              </el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="仓单数量" prop="quantity">
            <el-input v-model="receiptForm.quantity" inputmode="decimal" :placeholder="`不超过在库可用量 ${num(preview.availableQuantity)}`" />
          </el-form-item>
        </div>
        <div class="finance-form-grid">
          <el-form-item label="单价（元，与数量同口径）" prop="unitPrice">
            <el-input v-model="receiptForm.unitPrice" inputmode="decimal" placeholder="例如：6.80" />
          </el-form-item>
          <el-form-item label="仓单货值">
            <div class="pledge-calc">{{ money(receiptValue) }}</div>
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button class="finance-ghost-button" @click="receiptOpen = false">取消</el-button>
        <el-button class="finance-action-button" :loading="submitting" @click="submitReceipt">生成仓单</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="pledgeOpen" title="仓单质押申请" width="min(560px, 92vw)">
      <div v-if="pledgeTarget" class="pledge-target">
        <strong>{{ pledgeTarget.commodityType }}</strong>
        <p>{{ pledgeTarget.receiptNo }} · 批次 {{ pledgeTarget.batchNo || '—' }} · {{ num(pledgeTarget.quantity) }}{{ pledgeTarget.unit }}</p>
        <span>货值 {{ money(pledgeTarget.totalValue) }} · 仓库 {{ pledgeTarget.warehouseName || '待确认' }}</span>
      </div>
      <el-form :model="pledgeForm" label-position="top">
        <div class="finance-form-grid">
          <el-form-item :label="`折算率（上限 ${pledgeRateCap}%）`">
            <el-input-number v-model="pledgeForm.pledgeRate" :min="10" :max="Number(pledgeRateCap) || 70" :step="5" style="width: 100%" />
          </el-form-item>
          <el-form-item label="预计可融资">
            <div class="pledge-calc">{{ money(pledgeEstimate) }}</div>
          </el-form-item>
        </div>
        <el-form-item label="关联的融资申请（可选，结清后自动释放质押）">
          <el-select v-model="pledgeForm.applicationId" clearable placeholder="不关联也可以，后续由运营核对" style="width: 100%">
            <el-option v-for="a in pledgeApplications" :key="a.id" :value="a.id"
                       :label="`${a.applicationNo} · ${money(a.applyAmount)} · ${a.status}`" />
          </el-select>
        </el-form-item>
      </el-form>
      <p class="pledge-note">提交后仓单立即置为「已质押」，同一批货不能再开第二张仓单、也不能重复质押。</p>
      <template #footer>
        <el-button class="finance-ghost-button" @click="pledgeOpen = false">取消</el-button>
        <el-button class="finance-action-button" :loading="submitting" @click="submitPledge">提交审核</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="monitorOpen" :title="monitorTarget ? `仓储读数 · ${monitorTarget.receiptNo}` : '仓储读数'" size="min(460px, 92vw)">
      <div v-loading="monitorLoading" class="monitor-body">
        <div class="monitor-actions">
          <el-button class="finance-ghost-button" size="small" :loading="monitorLoading" @click="refreshMonitor">
            从生产管理模块取最新读数
          </el-button>
        </div>
        <div v-if="monitor.id" class="monitor-grid">
          <div><span>温度</span><strong>{{ dash(monitor.temperature, ' ℃') }}</strong></div>
          <div><span>湿度</span><strong>{{ dash(monitor.humidity, ' %') }}</strong></div>
          <div><span>实时重量</span><strong>{{ dash(monitor.realtimeWeight) }}</strong></div>
          <div><span>气体浓度</span><strong>{{ dash(monitor.gasConcentration) }}</strong></div>
          <div><span>设备状态</span><strong>{{ monitor.deviceStatus || '—' }}</strong></div>
          <div><span>告警</span><strong :class="{ red: monitor.alertLevel && monitor.alertLevel !== '无' }">{{ monitor.alertLevel || '—' }}</strong></div>
          <div class="wide"><span>读数来源</span><strong>{{ monitor.deviceCode || '—' }}</strong></div>
          <div class="wide"><span>口径说明</span><strong class="note">{{ monitor.deviceNote || '—' }}</strong></div>
          <div class="wide"><span>读数时间</span><strong>{{ shortDate(monitor.monitorTime) }}</strong></div>
          <div class="wide"><span>告警内容</span><strong>{{ monitor.alertContent || '—' }}</strong></div>
        </div>
        <div v-else class="finance-empty">
          <strong>暂无监控读数</strong>
          <p>点击上方按钮从生产域拉一次。重量与气体浓度本部署没有采集通道，读到空值会显示「—」而不是 0。</p>
        </div>
      </div>
    </el-drawer>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Box, Calendar, Link, OfficeBuilding, Tickets } from '@element-plus/icons-vue'
import FinanceStatus from '@/components/FinanceStatus.vue'
import { compactMoney, financeApi, money, num, shortDate } from '@/api/finance'

const loading = ref(true)
const submitting = ref(false)
const receipts = ref([])
const pledges = ref([])
const batches = ref([])
const goodsList = ref([])
const applications = ref([])
const receiptFilter = ref('all')
const pledgeFilter = ref('all')
const receiptOpen = ref(false)
const pledgeOpen = ref(false)
const monitorOpen = ref(false)
const previewLoading = ref(false)
const monitorLoading = ref(false)
const preview = ref({})
const monitor = ref({})
const monitorTarget = ref(null)
const pledgeTarget = ref(null)
const receiptFormRef = ref()
// 批次来自生产域：读不到必须说清原因，静默当"没有批次"会让人以为自己的货没入库
const batchError = ref('')

const receiptFilters = [
  { key: 'all', label: '全部' },
  { key: '待质押', label: '待质押' },
  { key: '已质押', label: '已质押' },
  { key: '已释放', label: '已释放' },
]
const pledgeFilters = [
  { key: 'all', label: '全部' },
  { key: '待审核', label: '待审核' },
  { key: '已生效', label: '已生效' },
  { key: '已释放', label: '已释放' },
]
const receiptForm = reactive({ batchId: '', goodsCode: '', quantity: '', unitPrice: '' })
const pledgeForm = reactive({ pledgeRate: 60, applicationId: '' })
const receiptRules = {
  batchId: [{ required: true, message: '请选择采收批次', trigger: 'change' }],
  goodsCode: [{ required: true, message: '请选择质押物品种', trigger: 'change' }],
  quantity: [{ required: true, message: '请填写仓单数量', trigger: 'blur' }],
  unitPrice: [{ required: true, message: '请填写单价', trigger: 'blur' }],
}

const openableBatches = computed(() => batches.value.filter((row) => !row.receiptNo || row.receiptStatus === '已释放'))
const toPledgeCount = computed(() => receipts.value.filter((item) => item.status === '待质押').length)
const pledgedValue = computed(() => receipts.value
  .filter((item) => item.status === '已质押')
  .reduce((total, item) => total + Number(item.totalValue || 0), 0))
const pledgeLoanLimit = computed(() => pledges.value
  .filter((item) => item.status === '已生效')
  .reduce((total, item) => total + Number(item.loanAmount || 0), 0))
const filteredReceipts = computed(() => (receiptFilter.value === 'all'
  ? receipts.value
  : receipts.value.filter((item) => item.status === receiptFilter.value)))
const filteredPledges = computed(() => (pledgeFilter.value === 'all'
  ? pledges.value
  : pledges.value.filter((item) => item.status === pledgeFilter.value)))
const receiptValue = computed(() => Number(receiptForm.quantity || 0) * Number(receiptForm.unitPrice || 0))
const pledgeRateCap = computed(() => {
  const goods = goodsList.value.find((item) => item.goodsCode === (pledgeTarget.value || {}).goodsCode)
  return goods ? goods.pledgeRateMax : 70
})
const pledgeEstimate = computed(() => Number((pledgeTarget.value || {}).totalValue || 0)
  * Number(pledgeForm.pledgeRate || 0) / 100)
const pledgeApplications = computed(() => applications.value
  .filter((item) => item.status === '待审批' || item.status === '已通过'))

function dash(value, suffix = '') {
  return value == null || value === '' ? '—' : `${num(value)}${suffix}`
}

function shortHash(value) {
  const text = String(value || '')
  return text.length > 18 ? `${text.slice(0, 10)}…${text.slice(-6)}` : text
}

function rateCap(receipt) {
  const goods = goodsList.value.find((item) => item.goodsCode === receipt.goodsCode)
  return goods ? goods.pledgeRateMax : '—'
}

async function load() {
  loading.value = true
  try {
    const [receiptRows, pledgeRows, batchRowsData, goods, apps] = await Promise.all([
      financeApi.receipts(),
      financeApi.pledges(),
      financeApi.receiptBatches().catch((err) => {
        batchError.value = err.message || '生产管理模块暂时读不到你的采收批次'
        return []
      }),
      financeApi.pledgeGoodsOptions().catch(() => []),
      financeApi.applications().catch(() => []),
    ])
    if ((batchRowsData ?? []).length) batchError.value = ''
    receipts.value = receiptRows || []
    pledges.value = pledgeRows || []
    batches.value = batchRowsData || []
    goodsList.value = goods || []
    applications.value = apps || []
  } catch (err) {
    ElMessage.error(err.message || '仓单数据加载失败')
  } finally {
    loading.value = false
  }
}

function openReceipt() {
  Object.assign(receiptForm, { batchId: '', goodsCode: '', quantity: '', unitPrice: '' })
  preview.value = {}
  if (batchError.value) {
    ElMessage.error(batchError.value)
    return
  }
  if (!openableBatches.value.length) {
    ElMessage.warning('没有可开单的批次：先到生产管理模块把采收批次完成成品入库')
    return
  }
  receiptOpen.value = true
}

async function previewBatch(batchId) {
  if (!batchId) return
  previewLoading.value = true
  try {
    const data = await financeApi.batchPreview(batchId)
    preview.value = data || {}
    receiptForm.quantity = data?.availableQuantity != null ? String(data.availableQuantity) : ''
  } catch (err) {
    ElMessage.error(err.message || '批次核对失败')
    preview.value = {}
  } finally {
    previewLoading.value = false
  }
}

async function submitReceipt() {
  await receiptFormRef.value.validate()
  submitting.value = true
  try {
    const created = await financeApi.createReceipt({
      batchId: receiptForm.batchId,
      goodsCode: receiptForm.goodsCode,
      quantity: Number(receiptForm.quantity),
      unitPrice: Number(receiptForm.unitPrice),
    })
    ElMessage.success(`仓单 ${created.receiptNo} 已生成，可以发起质押`)
    receiptOpen.value = false
    await load()
  } catch (err) {
    ElMessage.error(err.message || '开仓单失败')
  } finally {
    submitting.value = false
  }
}

function openPledge(receipt) {
  pledgeTarget.value = receipt
  const cap = Number(rateCap(receipt)) || 70
  Object.assign(pledgeForm, { pledgeRate: cap, applicationId: '' })
  pledgeOpen.value = true
}

async function submitPledge() {
  submitting.value = true
  try {
    const created = await financeApi.createPledge({
      receiptId: pledgeTarget.value.id,
      pledgeRate: Number(pledgeForm.pledgeRate),
      applicationId: pledgeForm.applicationId || undefined,
    })
    ElMessage.success(`质押申请 ${created.pledgeNo} 已提交，等待平台审核`)
    pledgeOpen.value = false
    await load()
  } catch (err) {
    ElMessage.error(err.message || '质押申请提交失败')
  } finally {
    submitting.value = false
  }
}

function openMonitor(receipt) {
  monitorTarget.value = receipt
  monitor.value = {}
  monitorOpen.value = true
  loadMonitor(receipt)
}

async function loadMonitor(receipt) {
  monitorLoading.value = true
  try {
    const detail = await financeApi.receiptDetail(receipt.id)
    monitor.value = detail?.monitor || {}
  } catch (err) {
    ElMessage.error(err.message || '仓储读数加载失败')
  } finally {
    monitorLoading.value = false
  }
}

async function refreshMonitor() {
  monitorLoading.value = true
  try {
    monitor.value = await financeApi.refreshReceiptMonitor(monitorTarget.value.id)
    ElMessage.success('已从生产管理模块拉取最新读数')
  } catch (err) {
    ElMessage.error(err.message || '读数拉取失败')
  } finally {
    monitorLoading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.receipt-list { display: grid; gap: 10px; padding: 11px; }
.receipt-list article { padding: 14px; border: 1px solid #e3ebe6; border-radius: 12px; background: #fff; }
.receipt-head { display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; align-items: center; gap: 10px; }
.receipt-head strong { color: #344f3f; font-size: var(--fin-fs-xs); }
.receipt-head p { margin: 3px 0 0; color: #8b9a92; font-family: ui-monospace, Consolas, monospace; font-size: var(--fin-fs-xs); }
.receipt-icon { display: grid; width: 40px; height: 40px; place-items: center; border-radius: 11px; background: #e7f6ed; color: var(--fin-green-700); }
.receipt-icon svg { width: 18px; }
.receipt-values { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; margin: 12px 0 10px; overflow: hidden; border-radius: 9px; background: #edf2ee; }
.receipt-values > div { padding: 9px 10px; background: #f8fbf9; }
.receipt-values span, .receipt-values strong { display: block; }
.receipt-values span { color: #8b9a91; font-size: var(--fin-fs-xs); }
.receipt-values strong { margin-top: 3px; color: #395544; font-family: ui-monospace, Consolas, monospace; font-size: var(--fin-fs-xs); }
.receipt-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; color: #87968d; font-size: var(--fin-fs-xs); }
.receipt-meta span { display: inline-flex; align-items: center; gap: 4px; }
.receipt-meta svg { width: 12px; color: #6e927c; }
.receipt-meta .warn { color: #c2653f; }
.receipt-actions { display: flex; align-items: center; gap: 12px; margin-top: 10px; padding-top: 9px; border-top: 1px dashed #e6eee8; }
.receipt-hint { color: #8b9a92; font-size: var(--fin-fs-xs); }
.opt-hint { margin-left: 10px; color: #9aa8a0; font-size: var(--fin-fs-xs); font-style: normal; }
.cell-muted { color: #9aa8a0; font-size: var(--fin-fs-xs); }
.batch-preview { min-height: 96px; margin: 4px 0 12px; padding: 11px 12px; border-radius: 10px; background: #f5f9f6; }
.preview-line { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 4px 0; font-size: var(--fin-fs-xs); }
.preview-line span { color: #8b9a91; min-width: 78px; }
.preview-line b { color: #395544; font-family: ui-monospace, Consolas, monospace; font-weight: 600; }
.preview-line i { color: #9aa8a0; font-size: var(--fin-fs-xs); font-style: normal; }
.preview-line .green { color: #16764a; }
.preview-line .red { color: #c2653f; }
.preview-stock { display: grid; gap: 4px; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #dde7e0; }
.preview-stock > div { display: flex; gap: 10px; align-items: center; font-size: var(--fin-fs-xs); color: #71857a; }
.preview-stock b { font-family: ui-monospace, Consolas, monospace; color: #395544; }
.preview-stock em { color: #c2653f; font-style: normal; }
.preview-empty { margin: 0; color: #9aa8a0; font-size: var(--fin-fs-xs); }
.pledge-target { padding: 11px 12px; margin-bottom: 12px; border-radius: 10px; background: #f4f9f6; }
.pledge-target strong { display: block; color: #344f3f; font-size: var(--fin-fs-xs); }
.pledge-target p, .pledge-target span { display: block; margin: 4px 0 0; color: #8b9a92; font-size: var(--fin-fs-xs); font-family: ui-monospace, Consolas, monospace; }
.pledge-note { margin: 8px 0 0; color: #8b9a91; font-size: var(--fin-fs-xs); }
.pledge-calc { display: flex; height: 32px; align-items: center; color: #d0523f; font-family: ui-monospace, Consolas, monospace; font-size: 13px; font-weight: 700; }
.monitor-body { padding: 0 4px; }
.monitor-actions { margin-bottom: 12px; }
.monitor-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; border-radius: 10px; overflow: hidden; background: #edf2ee; }
.monitor-grid > div { padding: 10px 11px; background: #f8fbf9; }
.monitor-grid .wide { grid-column: 1 / -1; }
.monitor-grid span { display: block; color: #8b9a91; font-size: var(--fin-fs-xs); }
.monitor-grid strong { display: block; margin-top: 4px; color: #395544; font-family: ui-monospace, Consolas, monospace; font-size: var(--fin-fs-xs); }
.monitor-grid .red { color: #c2653f; }
.monitor-grid .note { font-size: var(--fin-fs-xs); line-height: 1.6; color: #8b9a91; font-family: inherit; }
</style>
