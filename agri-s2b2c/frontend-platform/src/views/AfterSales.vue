<template>
  <div class="after-sales-page">
    <div class="page-head">
      <div>
        <h2>异常与售后</h2>
        <p>平台视角的售后工单：渠道主责处理，平台在此复核/兜底；退款资金动作与支付通道不在本模块。</p>
      </div>
    </div>

    <AgriElementListTable
      :columns="columns"
      :data="rows"
      row-key="id"
      :loading="loading"
      client-pagination
      column-settings-storage-key="agri-s2b2c-platform:after-sales"
      empty-text="当前筛选下没有售后工单"
      @refresh="load"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="1" :loading="loading" @search="load" @reset="reset">
          <div class="agri-vue-filter-field">
            <label>售后状态</label>
            <el-select v-model="status" placeholder="全部">
              <el-option label="全部" value="" />
              <el-option label="待处理" value="PENDING" />
              <el-option label="已同意" value="APPROVED" />
              <el-option label="退货中" value="RETURNING" />
              <el-option label="已完成" value="COMPLETED" />
              <el-option label="已拒绝" value="REJECTED" />
            </el-select>
          </div>
        </AgriVueFilterBar>
      </template>

      <template #toolbar-left>
        <el-radio-group v-model="status" size="small" @change="load">
          <el-radio-button value="">全部</el-radio-button>
          <el-radio-button value="PENDING">待处理（{{ pendingCount }}）</el-radio-button>
          <el-radio-button value="APPROVED">已同意</el-radio-button>
          <el-radio-button value="RETURNING">退货中</el-radio-button>
          <el-radio-button value="COMPLETED">已完成</el-radio-button>
          <el-radio-button value="REJECTED">已拒绝</el-radio-button>
        </el-radio-group>
      </template>

      <template #cell-amount="{ row }">¥{{ money(row.amount) }}</template>
      <template #cell-status="{ row }">
        <el-tag :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag>
      </template>
      <template #cell-actions="{ row }">
        <AgriVueRowActions :actions="rowActions(row)" />
      </template>
    </AgriElementListTable>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { AgriElementListTable, AgriVueFilterBar, AgriVueRowActions } from '@agri/shared/vue/element'
import { platformApi } from '../api'

const router = useRouter()
const status = ref('')
const rows = ref([])
const loading = ref(false)
const pendingCount = ref(0)

const columns = [
  { key: 'id', prop: 'id', label: '售后单', width: 190 },
  { key: 'orderNo', prop: 'orderNo', label: '订单号', minWidth: 180 },
  { key: 'channelName', prop: 'channelName', label: '渠道', width: 150 },
  { key: 'items', prop: 'items', label: '商品', minWidth: 180 },
  { key: 'type', prop: 'type', label: '类型', width: 90 },
  { key: 'reason', prop: 'reason', label: '原因', minWidth: 160 },
  { key: 'amount', prop: 'amount', label: '金额', width: 100 },
  { key: 'status', prop: 'status', label: '状态', width: 100 },
  { key: 'createTime', prop: 'createTime', label: '申请时间', width: 180 },
  { key: 'actions', label: '操作', width: 155 },
]

function rowActions(row) {
  const list = []
  if (row.status === 'PENDING') {
    list.push({ key: 'approve', label: '同意', onClick: () => review(row, 'APPROVED') })
    list.push({ key: 'reject', label: '拒绝', danger: true, onClick: () => review(row, 'REJECTED') })
  } else if (row.status === 'RETURNING') {
    if (row.returnShippedAt) {
      list.push({ key: 'confirmReturn', label: '确认收货', onClick: () => confirmReturn(row) })
    } else {
      list.push({ key: 'waiting', label: '待寄回', disabled: true, title: '等待买家寄回' })
    }
  }
  list.push({ key: 'orders', label: '订单', onClick: () => router.push('/orders') })
  return list
}

onMounted(load)

async function load() {
  loading.value = true
  try {
    rows.value = (await platformApi.getAfterSales({ status: status.value || undefined })) || []
  } catch (e) {
    rows.value = []
    ElMessage.error(e?.message || '售后工单读取失败')
  } finally {
    loading.value = false
  }
  if (status.value !== 'PENDING') {
    try {
      pendingCount.value = ((await platformApi.getAfterSales({ status: 'PENDING' })) || []).length
    } catch {
      pendingCount.value = 0
    }
  } else {
    pendingCount.value = rows.value.length
  }
}

function reset() {
  status.value = ''
  load()
}

async function review(row, next) {
  let opinion = ''
  try {
    const result = await ElMessageBox.prompt(
      next === 'APPROVED' ? '可填写复核意见（选填）' : '请填写拒绝依据',
      next === 'APPROVED' ? '同意售后' : '拒绝售后',
      { inputPlaceholder: next === 'APPROVED' ? '选填' : '必填', confirmButtonText: '确认', cancelButtonText: '取消' },
    )
    opinion = result.value || ''
  } catch {
    return
  }
  try {
    const res = await platformApi.reviewAfterSale(row.id, next, opinion)
    if (res?.success === false) {
      ElMessage.error(res.message || '处理失败')
      return
    }
    ElMessage.success(res?.message || '处理成功')
    await load()
  } catch (e) {
    ElMessage.error(e?.message || '处理失败')
  }
}

async function confirmReturn(row) {
  try {
    const result = await ElMessageBox.prompt('可填写收货说明（选填）', '确认收到退货', {
      inputPlaceholder: '选填', confirmButtonText: '确认收货', cancelButtonText: '取消',
    })
    const res = await platformApi.confirmAfterSaleReturn(row.id, result.value || '')
    if (res?.success === false) {
      ElMessage.error(res.message || '确认失败')
      return
    }
    ElMessage.success(res?.message || '已确认收货并退款')
    await load()
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error(e?.message || '确认失败')
  }
}

const money = (value) => Number(value || 0).toFixed(2)
const statusText = (value) => ({
  PENDING: '待处理', APPROVED: '已同意', RETURNING: '退货中', COMPLETED: '已完成', REJECTED: '已拒绝',
}[value] || value)
const statusType = (value) => ({
  PENDING: 'warning', APPROVED: 'success', RETURNING: 'primary', COMPLETED: 'success', REJECTED: 'danger',
}[value] || 'info')
</script>

<style scoped>
.after-sales-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 780px; }
</style>
