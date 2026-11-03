<template>
  <div class="purchase-page">
    <div class="page-head">
      <div>
        <h2>集采采购补货</h2>
        <p>总部集采批次报名：只登记采购意向与数量，合同、付款与到货入库由交易撮合/仓储完成。</p>
      </div>
      <el-button @click="load">刷新</el-button>
    </div>

    <div class="stat-row">
      <div class="stat-card"><span>可报名批次</span><b>{{ openBatches.length }}</b><small>OPEN / UPCOMING</small></div>
      <div class="stat-card"><span>我的报名</span><b>{{ activeMine.length }}</b><small>未取消</small></div>
      <div class="stat-card"><span>报名数量</span><b>{{ myQuantity }}</b><small>件</small></div>
      <div class="stat-card"><span>报名金额</span><b>¥{{ money(myAmount) }}</b><small>集采价 × 数量</small></div>
    </div>

    <div class="card">
      <div class="card-head"><h3>进行中的集采批次</h3><span class="muted">报名截止前可改量或取消</span></div>
      <el-table :data="openBatches" border>
        <el-table-column label="批次" min-width="200">
          <template #default="{ row }">
            <b>{{ row.title }}</b><br><small>{{ row.productName }} · {{ row.supplierName || '供应商待定' }}</small>
          </template>
        </el-table-column>
        <el-table-column label="集采价" width="100">
          <template #default="{ row }">¥{{ money(row.purchase_price) }}</template>
        </el-table-column>
        <el-table-column label="起订/目标" width="110">
          <template #default="{ row }">{{ row.min_quantity || 0 }} / {{ row.target_quantity || 0 }}</template>
        </el-table-column>
        <el-table-column label="已报名" width="130">
          <template #default="{ row }">{{ row.stats?.channels || 0 }} 家 · {{ row.stats?.quantity || 0 }} 件</template>
        </el-table-column>
        <el-table-column label="截止" width="180"><template #default="{ row }">{{ row.end_time }}</template></el-table-column>
        <el-table-column label="我的报名" width="150">
          <template #default="{ row }">
            <template v-if="row.myCommitment && row.myCommitment.status !== 'CANCELLED'">
              {{ row.myCommitment.quantity }} 件 · ¥{{ money(row.myCommitment.amount) }}
            </template>
            <span v-else class="muted">未报名</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="170" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" :disabled="row.status !== 'OPEN'" @click="openJoin(row)">
              {{ row.myCommitment && row.myCommitment.status === 'RESERVED' ? '改量' : '报名' }}
            </el-button>
            <el-button v-if="row.myCommitment && row.myCommitment.status === 'RESERVED'" link type="danger" @click="cancel(row)">取消</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!openBatches.length" description="当前没有可报名的集采批次" :image-size="70" />
    </div>

    <div class="card">
      <div class="card-head"><h3>我的集采记录</h3></div>
      <el-table :data="history" border size="small">
        <el-table-column prop="title" label="批次" min-width="180" />
        <el-table-column prop="productName" label="商品" min-width="160" />
        <el-table-column prop="quantity" label="数量" width="90" />
        <el-table-column label="金额" width="120"><template #default="{ row }">¥{{ money(row.amount) }}</template></el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }"><el-tag :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="createTime" label="报名时间" width="180" />
      </el-table>
      <el-empty v-if="!history.length" description="还没有集采报名记录" :image-size="70" />
    </div>

    <el-dialog v-model="joinVisible" title="集采报名" width="460px">
      <el-form label-width="100px">
        <el-form-item label="批次"><span>{{ joinForm.title }}</span></el-form-item>
        <el-form-item label="集采价"><span>¥{{ money(joinForm.price) }}</span></el-form-item>
        <el-form-item label="报名数量" required><el-input v-model="joinForm.quantity" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="joinForm.remark" /></el-form-item>
      </el-form>
      <p class="note">预计金额 ¥{{ money(joinForm.price * Number(joinForm.quantity || 0)) }}；本系统只登记意向，不扣款。</p>
      <template #footer>
        <el-button @click="joinVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitJoin">确认报名</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { channelApi } from '../api'

const batches = ref([])
const history = ref([])
const joinVisible = ref(false)
const submitting = ref(false)
const joinForm = reactive({ id: '', title: '', price: 0, quantity: '', remark: '' })

const openBatches = computed(() => batches.value)
const activeMine = computed(() => (history.value || []).filter((row) => row.status !== 'CANCELLED'))
const myQuantity = computed(() => activeMine.value.reduce((sum, row) => sum + Number(row.quantity || 0), 0))
const myAmount = computed(() => activeMine.value.reduce((sum, row) => sum + Number(row.amount || 0), 0))

onMounted(load)

async function load() {
  try {
    const data = (await channelApi.getGroupPurchases()) || {}
    batches.value = data.batches || []
    history.value = data.history || []
  } catch (e) {
    batches.value = []
    history.value = []
    ElMessage.error(e?.message || '集采数据读取失败')
  }
}

function openJoin(row) {
  joinForm.id = row.id
  joinForm.title = row.title
  joinForm.price = Number(row.purchase_price || 0)
  joinForm.quantity = row.myCommitment && row.myCommitment.status === 'RESERVED'
    ? String(row.myCommitment.quantity) : ''
  joinForm.remark = row.myCommitment?.remark || ''
  joinVisible.value = true
}

async function submitJoin() {
  const quantity = Number(joinForm.quantity)
  if (!quantity || quantity <= 0) return ElMessage.warning('报名数量必须大于 0')
  submitting.value = true
  try {
    const res = await channelApi.joinGroupPurchase(joinForm.id, { quantity, remark: joinForm.remark })
    if (res?.success === false) return ElMessage.error(res.message || '报名失败')
    ElMessage.success(res?.message || '报名成功')
    joinVisible.value = false
    await load()
  } catch (e) {
    ElMessage.error(e?.message || '报名失败')
  } finally {
    submitting.value = false
  }
}

async function cancel(row) {
  try {
    await ElMessageBox.confirm('确认取消该集采报名？截止后不可取消。', '取消报名', { confirmButtonText: '确认', cancelButtonText: '取消' })
  } catch {
    return
  }
  try {
    const res = await channelApi.cancelGroupPurchase(row.id)
    if (res?.success === false) return ElMessage.error(res.message || '取消失败')
    ElMessage.success('已取消报名')
    await load()
  } catch (e) {
    ElMessage.error(e?.message || '取消失败')
  }
}

const money = (value) => Number(value || 0).toFixed(2)
const statusText = (value) => ({ RESERVED: '已报名', CONFIRMED: '已确认', FULFILLED: '已到货', CANCELLED: '已取消' }[value] || value)
const statusType = (value) => ({ RESERVED: 'success', CONFIRMED: 'primary', FULFILLED: 'success', CANCELLED: 'info' }[value] || 'info')
</script>

<style scoped>
.purchase-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 820px; }
.stat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.stat-card { display: flex; flex-direction: column; gap: 6px; padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.stat-card span { color: #84938a; font-size: 12px; }
.stat-card b { color: #173e2a; font-size: 23px; }
.stat-card small { color: #94a198; font-size: 12px; }
.card { padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.card-head h3 { margin: 0; font-size: 15px; }
.muted { color: #94a198; font-size: 12px; }
.note { margin: 0; color: #84938a; font-size: 12px; }
@media (max-width: 1000px) { .stat-row { grid-template-columns: repeat(2, 1fr); } }
</style>
