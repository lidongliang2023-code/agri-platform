<template>
  <div class="onboard-page">
    <div class="page-head">
      <div>
        <h2>入驻审核</h2>
        <p>商家主体实名与资质核验由用户中心主责；本页只做渠道入驻的业务审核（经营能力与渠道分层）。</p>
      </div>
    </div>

    <AgriElementListTable
      :columns="columns"
      :data="rows"
      row-key="id"
      :loading="loading"
      :page="page"
      :page-size="size"
      :total="total"
      column-settings-storage-key="agri-s2b2c-platform:channel-onboard"
      :empty-text="status === 'PENDING' ? '没有待审核的渠道入驻申请' : '当前筛选下没有记录'"
      @page-change="handlePageChange"
      @refresh="load"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="1" :loading="loading" @search="search" @reset="reset">
          <div class="agri-vue-filter-field">
            <label>审核状态</label>
            <el-select v-model="status" placeholder="请选择">
              <el-option label="待审核" value="PENDING" />
              <el-option label="已通过" value="APPROVED" />
              <el-option label="已驳回" value="REJECTED" />
            </el-select>
          </div>
        </AgriVueFilterBar>
      </template>

      <template #toolbar-left>
        <el-radio-group v-model="status" size="small" @change="search">
          <el-radio-button value="PENDING">待审核</el-radio-button>
          <el-radio-button value="APPROVED">已通过</el-radio-button>
          <el-radio-button value="REJECTED">已驳回</el-radio-button>
        </el-radio-group>
      </template>

      <template #cell-applicant="{ row }">
        <b>{{ row.shopName || row.companyName || '未命名渠道' }}</b><br>
        <small>{{ row.id }}</small>
      </template>
      <template #cell-region="{ row }">
        {{ row.registerType === 'COMPANY' ? '企业' : '个人' }}<br>
        <small>{{ [row.province, row.city, row.district].filter(Boolean).join(' ') || '未填' }}</small>
      </template>
      <template #cell-contact="{ row }">
        {{ row.contactName || '—' }}<br><small>{{ row.contactPhone || '' }}</small>
      </template>
      <template #cell-grade="{ row }">{{ gradeText(row.grade) }}</template>
      <template #cell-auditStatus="{ row }">
        <el-tag :type="auditType(row.auditStatus)">{{ auditText(row.auditStatus) }}</el-tag>
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
const status = ref('PENDING')
const rows = ref([])
const loading = ref(false)
const page = ref(1)
const size = ref(20)
const total = ref(0)

const columns = [
  { key: 'applicant', prop: 'shopName', label: '申请方', minWidth: 180 },
  { key: 'region', label: '类型/区域', minWidth: 160 },
  { key: 'contact', label: '联系人', width: 170 },
  { key: 'grade', prop: 'grade', label: '等级', width: 100 },
  { key: 'auditStatus', prop: 'auditStatus', label: '审核状态', width: 110 },
  { key: 'auditTime', prop: 'auditTime', label: '审核时间', width: 180 },
  { key: 'actions', label: '操作', width: 150 },
]

function rowActions(row) {
  const list = []
  if (row.auditStatus === 'PENDING') {
    list.push({ key: 'approve', label: '通过', onClick: () => review(row, true) })
    list.push({ key: 'reject', label: '驳回', danger: true, onClick: () => review(row, false) })
  }
  list.push({ key: 'detail', label: '详情', onClick: () => router.push(`/channel-partner-detail/${row.id}`) })
  return list
}

onMounted(load)

async function load() {
  loading.value = true
  try {
    const res = await platformApi.getChannelPartners({
      page: page.value,
      size: size.value,
      auditStatus: status.value,
    })
    rows.value = res.records || []
    total.value = Number(res.total || 0)
  } catch (e) {
    rows.value = []
    total.value = 0
    ElMessage.error(e?.message || '入驻申请读取失败')
  } finally {
    loading.value = false
  }
}

function search() {
  page.value = 1
  load()
}

function reset() {
  status.value = 'PENDING'
  page.value = 1
  load()
}

function handlePageChange(nextPage, nextSize) {
  page.value = nextPage
  size.value = nextSize
  load()
}

async function review(row, approved) {
  let opinion = ''
  try {
    const result = await ElMessageBox.prompt(
      approved ? '可填写通过说明（选填）' : '请填写驳回原因',
      approved ? '通过入驻' : '驳回入驻',
      { inputPlaceholder: approved ? '选填' : '必填', confirmButtonText: '确认', cancelButtonText: '取消' },
    )
    opinion = result.value || ''
  } catch {
    return
  }
  if (!approved && !opinion.trim()) {
    ElMessage.warning('驳回必须填写原因')
    return
  }
  try {
    const res = await platformApi.auditChannelPartner({
      id: row.id,
      auditStatus: approved ? 'APPROVED' : 'REJECTED',
      auditOpinion: opinion,
    })
    if (res?.success === false) {
      ElMessage.error(res.message || '审核失败')
      return
    }
    ElMessage.success(approved ? '已通过入驻' : '已驳回入驻')
    await load()
  } catch (e) {
    ElMessage.error(e?.message || '审核失败')
  }
}

const gradeText = (value) => ({ LEVEL_1: '铜牌', LEVEL_2: '银牌', LEVEL_3: '金牌' }[value] || value || '未定级')
const auditText = (value) => ({ PENDING: '待审核', APPROVED: '已通过', REJECTED: '已驳回' }[value] || value)
const auditType = (value) => ({ PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger' }[value] || 'info')
</script>

<style scoped>
.onboard-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 780px; }
</style>
