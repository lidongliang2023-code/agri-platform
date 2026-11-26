<template>
  <div class="withdrawals-page">
    <div class="page-head">
      <div>
        <h2>提现审核</h2>
        <p>渠道申请提现后在这里审核；通过后线下打款，再登记打款流水号并标记「已打款」。状态只能按 待审核 → 通过/驳回 → 已打款 流转。</p>
      </div>
    </div>

    <AgriElementListTable
      :columns="columns"
      :data="rows"
      row-key="id"
      :loading="loading"
      client-pagination
      column-settings-storage-key="agri-s2b2c-platform:withdrawals"
      empty-text="当前没有提现申请"
      @refresh="load"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="1" :loading="loading" @search="load" @reset="reset">
          <div class="agri-vue-filter-field">
            <label>提现状态</label>
            <el-select v-model="status" placeholder="全部">
              <el-option label="全部" value="" />
              <el-option label="待审核" value="PENDING" />
              <el-option label="已通过待打款" value="APPROVED" />
              <el-option label="已驳回" value="REJECTED" />
              <el-option label="已打款" value="PAID" />
            </el-select>
          </div>
        </AgriVueFilterBar>
      </template>

      <template #cell-amount="{ row }">{{ Number(row.amount).toFixed(2) }}</template>
      <template #cell-status="{ row }">
        <el-tag :type="tagType(row.status)">{{ statusText(row.status) }}</el-tag>
      </template>
      <template #cell-actions="{ row }">
        <AgriVueRowActions :actions="rowActions(row)" />
      </template>
    </AgriElementListTable>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { AgriElementListTable, AgriVueFilterBar, AgriVueRowActions } from '@agri/shared/vue/element'
import { platformApi } from '../api'

const rows = ref([])
const loading = ref(false)
const status = ref('')

const columns = [
  { key: 'channelName', prop: 'channelName', label: '渠道', minWidth: 160 },
  { key: 'amount', prop: 'amount', label: '金额(元)', width: 120 },
  { key: 'status', prop: 'status', label: '状态', width: 130 },
  { key: 'applyTime', prop: 'applyTime', label: '申请时间', width: 180 },
  { key: 'reviewer', prop: 'reviewer', label: '处理人', width: 110 },
  { key: 'payoutNo', prop: 'payoutNo', label: '打款流水号', width: 180 },
  { key: 'remark', prop: 'remark', label: '备注', minWidth: 160 },
  { key: 'actions', label: '操作', width: 150 },
]

function rowActions(row) {
  if (row.status === 'PENDING') {
    return [
      { key: 'approve', label: '通过', onClick: () => review(row, 'APPROVED') },
      { key: 'reject', label: '驳回', danger: true, onClick: () => review(row, 'REJECTED') },
    ]
  }
  if (row.status === 'APPROVED') {
    return [{ key: 'paid', label: '标记已打款', onClick: () => review(row, 'PAID') }]
  }
  return []
}

onMounted(load)

async function load() {
  loading.value = true
  try {
    rows.value = (await platformApi.getWithdrawals({ status: status.value || undefined })) || []
  } catch (e) {
    ElMessage.error(e?.message || '提现列表读取失败')
  } finally {
    loading.value = false
  }
}

function reset() {
  status.value = ''
  load()
}

const statusText = (s) => ({ PENDING: '待审核', APPROVED: '已通过待打款', REJECTED: '已驳回', PAID: '已打款' }[s] || s)
const tagType = (s) => ({ PENDING: 'warning', APPROVED: 'primary', REJECTED: 'danger', PAID: 'success' }[s] || 'info')

async function review(row, next) {
  let remark = ''
  let payoutNo = ''
  if (next === 'REJECTED') {
    try {
      const result = await ElMessageBox.prompt('请填写驳回原因', '驳回提现', { inputPattern: /\S+/, inputErrorMessage: '请填写原因' })
      remark = result.value
    } catch {
      return
    }
  }
  if (next === 'PAID') {
    try {
      const result = await ElMessageBox.prompt('请填写线下打款流水号（作为打款凭证）', '标记已打款', {
        inputPattern: /\S+/,
        inputErrorMessage: '请填写打款流水号',
      })
      payoutNo = result.value.trim()
    } catch {
      return
    }
  }
  const res = await platformApi.reviewWithdrawal(row.id, next, remark, payoutNo)
  if (res?.success === false) {
    ElMessage.error(res.message || '处理失败')
    return
  }
  ElMessage.success(res?.message || '处理成功')
  await load()
}
</script>

<style scoped>
.withdrawals-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 780px; }
</style>
