<template>
  <div class="procurement-page">
    <div class="page-head">
      <div>
        <h2>集采管理</h2>
        <p>平台发起总部集采批次，渠道报名数量；本模块只登记集采需求与到货状态，不生成采购合同、不代收货款、不写库存。</p>
      </div>
      <div class="head-actions">
        <el-button @click="load">刷新</el-button>
        <el-button type="primary" @click="openCreate">新建集采批次</el-button>
      </div>
    </div>

    <div class="stat-row">
      <div class="stat-card"><span>批次总数</span><b>{{ rows.length }}</b><small>全部状态</small></div>
      <div class="stat-card"><span>进行中</span><b>{{ openCount }}</b><small>OPEN / UPCOMING</small></div>
      <div class="stat-card"><span>报名渠道</span><b>{{ totalChannels }}</b><small>非取消报名</small></div>
      <div class="stat-card"><span>报名金额</span><b>¥{{ money(totalAmount) }}</b><small>集采价 × 数量</small></div>
    </div>

    <div class="filter-bar">
      <el-select v-model="status" placeholder="批次状态" style="width: 170px" @change="load">
        <el-option label="全部" value="" />
        <el-option label="未开始" value="UPCOMING" />
        <el-option label="报名中" value="OPEN" />
        <el-option label="已截止" value="CLOSED" />
        <el-option label="已到货" value="FULFILLED" />
        <el-option label="已取消" value="CANCELLED" />
      </el-select>
    </div>

    <el-table :data="rows" border>
      <el-table-column label="批次" min-width="200">
        <template #default="{ row }">
          <b>{{ row.title }}</b><br>
          <small>{{ row.productName }} · {{ row.supplierName || '供应商待定' }}</small>
        </template>
      </el-table-column>
      <el-table-column label="集采价" width="100">
        <template #default="{ row }">¥{{ money(row.purchase_price) }}</template>
      </el-table-column>
      <el-table-column label="起订/目标" width="120">
        <template #default="{ row }">{{ row.min_quantity || 0 }} / {{ row.target_quantity || 0 }}</template>
      </el-table-column>
      <el-table-column label="报名" width="140">
        <template #default="{ row }">{{ row.stats?.channels || 0 }} 家 · {{ row.stats?.quantity || 0 }} 件</template>
      </el-table-column>
      <el-table-column label="进度" width="160">
        <template #default="{ row }">
          <el-progress :percentage="progress(row)" :stroke-width="8" />
        </template>
      </el-table-column>
      <el-table-column label="时间" min-width="220">
        <template #default="{ row }">{{ row.start_time }} ~ {{ row.end_time }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusType(row)">{{ statusText(row) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)">详情</el-button>
          <el-button v-if="row.status === 'OPEN' || row.status === 'UPCOMING'" link type="warning" @click="changeStatus(row, 'CLOSED')">截止</el-button>
          <el-button v-if="row.status === 'CLOSED'" link type="success" @click="changeStatus(row, 'FULFILLED')">到货</el-button>
          <el-button v-if="row.status === 'CLOSED'" link type="primary" @click="changeStatus(row, 'OPEN')">开放</el-button>
          <el-button v-if="row.status !== 'CANCELLED' && row.status !== 'FULFILLED'" link type="danger" @click="changeStatus(row, 'CANCELLED')">取消</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!rows.length" description="暂无集采批次" />
    <p class="note">边界：供应商合同与付款归交易撮合/财务；到货入库由仓储/交易撮合完成，本模块只记录状态。</p>

    <el-dialog v-model="createVisible" title="新建集采批次" width="620px">
      <el-form label-width="110px">
        <el-form-item label="商品" required>
          <el-select v-model="form.productId" filterable placeholder="选择已审核商品" style="width: 100%" @change="onProduct">
            <el-option v-for="item in products" :key="item.id" :label="`${item.name}（供货价 ¥${money(item.price)}）`" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="批次标题"><el-input v-model="form.title" placeholder="留空则用商品名 + 集采" /></el-form-item>
        <el-form-item label="集采价(元)" required><el-input v-model="form.purchasePrice" /></el-form-item>
        <el-form-item label="起订量"><el-input v-model="form.minQuantity" /></el-form-item>
        <el-form-item label="目标量"><el-input v-model="form.targetQuantity" /></el-form-item>
        <el-form-item label="报名时间">
          <el-date-picker v-model="form.startTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" placeholder="开始" />
          <span class="sep">至</span>
          <el-date-picker v-model="form.endTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" placeholder="截止" />
        </el-form-item>
        <el-form-item label="收货仓"><el-input v-model="form.warehouse" placeholder="如：华东云仓" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="create">创建批次</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailVisible" title="集采批次详情" width="760px">
      <template v-if="detail.batch">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="批次">{{ detail.batch.title }}</el-descriptions-item>
          <el-descriptions-item label="商品">{{ detail.batch.productName }}</el-descriptions-item>
          <el-descriptions-item label="集采价">¥{{ money(detail.batch.purchase_price) }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ detail.batch.status }}</el-descriptions-item>
          <el-descriptions-item label="起订/目标">{{ detail.batch.min_quantity }} / {{ detail.batch.target_quantity }}</el-descriptions-item>
          <el-descriptions-item label="报名">{{ detail.stats?.channels }} 家 · {{ detail.stats?.quantity }} 件 · ¥{{ money(detail.stats?.amount) }}</el-descriptions-item>
          <el-descriptions-item label="收货仓">{{ detail.batch.warehouse || '—' }}</el-descriptions-item>
          <el-descriptions-item label="备注">{{ detail.batch.remark || '—' }}</el-descriptions-item>
        </el-descriptions>
        <h4>渠道报名</h4>
        <el-table :data="detail.commitments || []" border size="small">
          <el-table-column prop="channelName" label="渠道" min-width="160" />
          <el-table-column prop="quantity" label="数量" width="90" />
          <el-table-column label="金额" width="110"><template #default="{ row }">¥{{ money(row.amount) }}</template></el-table-column>
          <el-table-column label="状态" width="110">
            <template #default="{ row }"><el-tag :type="row.status === 'CANCELLED' ? 'info' : 'success'">{{ row.status }}</el-tag></template>
          </el-table-column>
          <el-table-column prop="createTime" label="报名时间" width="180" />
          <el-table-column prop="remark" label="备注" />
        </el-table>
        <el-empty v-if="!(detail.commitments || []).length" description="暂无渠道报名" :image-size="60" />
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { platformApi } from '../api'

const rows = ref([])
const status = ref('')
const products = ref([])
const createVisible = ref(false)
const detailVisible = ref(false)
const submitting = ref(false)
const detail = ref({})
const form = reactive({
  productId: '', title: '', purchasePrice: '', minQuantity: '0', targetQuantity: '100',
  startTime: '', endTime: '', warehouse: '', remark: '',
})

const openCount = computed(() => rows.value.filter((row) => ['OPEN', 'UPCOMING'].includes(row.status)).length)
const totalChannels = computed(() => rows.value.reduce((sum, row) => sum + Number(row.stats?.channels || 0), 0))
const totalAmount = computed(() => rows.value.reduce((sum, row) => sum + Number(row.stats?.amount || 0), 0))

onMounted(async () => {
  const pad = (n) => String(n).padStart(2, '0')
  const now = new Date()
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`
  form.startTime = fmt(now)
  form.endTime = fmt(new Date(now.getTime() + 3 * 86400000))
  try {
    const res = await platformApi.getProducts({ page: 1, size: 100, status: 'APPROVED' })
    products.value = res.records || []
  } catch {
    products.value = []
  }
  await load()
})

async function load() {
  try {
    rows.value = (await platformApi.getGroupPurchases({ status: status.value || undefined })) || []
  } catch (e) {
    rows.value = []
    ElMessage.error(e?.message || '集采批次读取失败')
  }
}

function openCreate() {
  createVisible.value = true
}

function onProduct() {
  const product = products.value.find((item) => String(item.id) === String(form.productId))
  if (product && !form.purchasePrice) {
    form.purchasePrice = (Number(product.price) * 0.9).toFixed(2)
  }
}

async function create() {
  if (!form.productId) return ElMessage.warning('请选择商品')
  submitting.value = true
  try {
    const res = await platformApi.createGroupPurchase({ ...form })
    if (res?.success === false) return ElMessage.error(res.message || '创建失败')
    ElMessage.success('集采批次已创建')
    createVisible.value = false
    await load()
  } catch (e) {
    ElMessage.error(e?.message || '创建失败')
  } finally {
    submitting.value = false
  }
}

async function openDetail(row) {
  try {
    detail.value = (await platformApi.getGroupPurchaseDetail(row.id)) || {}
    detailVisible.value = true
  } catch (e) {
    ElMessage.error(e?.message || '详情读取失败')
  }
}

async function changeStatus(row, next) {
  const labels = { CLOSED: '截止', FULFILLED: '确认到货', OPEN: '重新开放', CANCELLED: '取消' }
  try {
    await ElMessageBox.confirm(`确认${labels[next]}该集采批次？`, '集采状态', { confirmButtonText: '确认', cancelButtonText: '取消' })
  } catch {
    return
  }
  try {
    const res = await platformApi.updateGroupPurchaseStatus(row.id, next)
    if (res?.success === false) return ElMessage.error(res.message || '操作失败')
    ElMessage.success(res?.message || '状态已更新')
    await load()
  } catch (e) {
    ElMessage.error(e?.message || '操作失败')
  }
}

const money = (value) => Number(value || 0).toFixed(2)
const progress = (row) => {
  const target = Number(row.target_quantity || 0)
  const quantity = Number(row.stats?.quantity || 0)
  if (target <= 0) return quantity > 0 ? 100 : 0
  return Math.min(100, Math.round((quantity / target) * 100))
}
const statusText = (row) => {
  if (row.status === 'OPEN' && row.expired) return '已过期'
  return { UPCOMING: '未开始', OPEN: '报名中', CLOSED: '已截止', FULFILLED: '已到货', CANCELLED: '已取消' }[row.status] || row.status
}
const statusType = (row) => {
  if (row.status === 'OPEN' && row.expired) return 'info'
  return { UPCOMING: 'info', OPEN: 'success', CLOSED: 'warning', FULFILLED: 'primary', CANCELLED: 'info' }[row.status] || 'info'
}
</script>

<style scoped>
.procurement-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 860px; }
.head-actions { display: flex; gap: 8px; }
.stat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.stat-card { display: flex; flex-direction: column; gap: 6px; padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.stat-card span { color: #84938a; font-size: 12px; }
.stat-card b { color: #173e2a; font-size: 23px; }
.stat-card small { color: #94a198; font-size: 12px; }
.filter-bar { display: flex; gap: 10px; }
.note { margin: 0; color: #84938a; font-size: 12px; line-height: 1.7; }
.sep { margin: 0 8px; color: #84938a; font-size: 12px; }
h4 { margin: 16px 0 8px; font-size: 14px; }
@media (max-width: 1000px) { .stat-row { grid-template-columns: repeat(2, 1fr); } }
</style>
