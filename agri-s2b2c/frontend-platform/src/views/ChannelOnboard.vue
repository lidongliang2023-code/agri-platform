<template>
  <div class="onboard-page">
    <div class="page-head">
      <div>
        <h2>入驻审核</h2>
        <p>渠道商主体实名与资质核验由用户中心主责；本页只做渠道入驻的业务审核（经营能力与渠道分层）。</p>
      </div>
      <el-button @click="load">刷新</el-button>
    </div>

    <div class="filter-bar">
      <el-radio-group v-model="status" @change="search">
        <el-radio-button value="PENDING">待审核</el-radio-button>
        <el-radio-button value="APPROVED">已通过</el-radio-button>
        <el-radio-button value="REJECTED">已驳回</el-radio-button>
      </el-radio-group>
      <span class="muted">共 {{ total }} 条</span>
    </div>

    <el-table :data="rows" border>
      <el-table-column label="申请方" min-width="180">
        <template #default="{ row }">
          <b>{{ row.shopName || row.companyName || '未命名渠道' }}</b><br>
          <small>{{ row.id }}</small>
        </template>
      </el-table-column>
      <el-table-column label="类型/区域" min-width="160">
        <template #default="{ row }">
          {{ row.registerType === 'COMPANY' ? '企业' : '个人' }}<br>
          <small>{{ [row.province, row.city, row.district].filter(Boolean).join(' ') || '未填' }}</small>
        </template>
      </el-table-column>
      <el-table-column label="联系人" width="170">
        <template #default="{ row }">{{ row.contactName || '—' }}<br><small>{{ row.contactPhone || '' }}</small></template>
      </el-table-column>
      <el-table-column label="等级" width="100">
        <template #default="{ row }">{{ gradeText(row.grade) }}</template>
      </el-table-column>
      <el-table-column label="审核状态" width="110">
        <template #default="{ row }">
          <el-tag :type="auditType(row.auditStatus)">{{ auditText(row.auditStatus) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="auditTime" label="审核时间" width="180" />
      <el-table-column label="操作" width="190" fixed="right">
        <template #default="{ row }">
          <template v-if="row.auditStatus === 'PENDING'">
            <el-button link type="success" @click="review(row, true)">通过</el-button>
            <el-button link type="danger" @click="review(row, false)">驳回</el-button>
          </template>
          <el-button link type="primary" @click="$router.push(`/channel-partner-detail/${row.id}`)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!rows.length" :description="status === 'PENDING' ? '没有待审核的渠道入驻申请' : '当前筛选下没有记录'" />
    <el-pagination
      v-model:current-page="page"
      :page-size="size"
      :total="total"
      layout="prev, pager, next, jumper"
      @current-change="load"
    />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { platformApi } from '../api'

const status = ref('PENDING')
const rows = ref([])
const page = ref(1)
const size = ref(10)
const total = ref(0)

onMounted(load)

async function load() {
  try {
    const res = await platformApi.getChannelPartners({
      page: page.value,
      size: size.value,
      auditStatus: status.value,
    })
    rows.value = res.records || []
    total.value = res.total || 0
  } catch (e) {
    rows.value = []
    total.value = 0
    ElMessage.error(e?.message || '入驻申请读取失败')
  }
}

function search() {
  page.value = 1
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
.filter-bar { display: flex; align-items: center; gap: 16px; }
.muted { color: #84938a; font-size: 12px; }
</style>
