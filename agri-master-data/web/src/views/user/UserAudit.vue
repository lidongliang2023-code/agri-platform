<template>
  <div class="user-audit">
    <div class="page-header">
      <div class="header-left">
        <h1>认证审核</h1>
        <p>企业与个人实名认证统一审核 · 数据来自 core-platform</p>
      </div>
      <button class="search-btn" :disabled="loading" @click="loadData">刷新</button>
    </div>

    <div class="audit-kpis">
      <div class="audit-kpi"><span>待审核</span><strong>{{ counts.pending }}</strong><small>全部待处理申请</small></div>
      <div class="audit-kpi tech"><span>企业待审</span><strong>{{ counts.enterprisePending }}</strong><small>经营主体资质</small></div>
      <div class="audit-kpi"><span>个人待审</span><strong>{{ counts.personalPending }}</strong><small>个人实名认证</small></div>
      <div class="audit-kpi green"><span>今日通过</span><strong>{{ counts.passedToday }}</strong><small>按审核时间统计</small></div>
      <div class="audit-kpi red"><span>今日驳回</span><strong>{{ counts.rejectedToday }}</strong><small>按审核时间统计</small></div>
    </div>

    <div class="search-bar">
      <div class="filter-group">
        <button class="type-btn" :class="{ on: typeFilter === 'all' }" @click="typeFilter = 'all'">全部类型</button>
        <button class="type-btn" :class="{ on: typeFilter === 'enterprise' }" @click="typeFilter = 'enterprise'">企业认证</button>
        <button class="type-btn" :class="{ on: typeFilter === 'personal' }" @click="typeFilter = 'personal'">个人实名认证</button>
      </div>
      <div class="filter-group">
        <select v-model="statusFilter" class="filter-select">
          <option value="all">全部状态</option>
          <option value="pending">待审核</option>
          <option value="approved">已通过</option>
          <option value="rejected">已驳回</option>
        </select>
      </div>
      <div class="search-group">
        <input v-model="keyword" class="search-input" placeholder="搜索主体名称 / 申请编号 / 证件号 / 联系人" />
        <button class="search-btn" @click="keyword = keyword.trim()">搜索</button>
      </div>
    </div>

    <div class="audit-toolbar">
      <span>已选 <b>{{ selectedKeys.length }}</b> 项</span>
      <button class="action-btn approve" :disabled="!selectedKeys.length || saving" @click="batchApprove">批量通过</button>
      <button class="action-btn reject" :disabled="!selectedKeys.length || saving" @click="batchReject">批量驳回</button>
      <span class="spacer"></span>
      <span>当前加载 {{ rows.length }} 条 · 筛选后 {{ filtered.length }} 条</span>
    </div>

    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>
              <input type="checkbox" :checked="allSelected" :disabled="!selectableRows.length" @change="toggleAll" />
            </th>
            <th>申请编号</th><th>类型</th><th>主体 / 姓名</th><th>证件 / 信用代码</th>
            <th>联系人</th><th>手机号</th><th>状态</th><th>提交时间</th><th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in filtered" :key="row.key">
            <td>
              <input type="checkbox" :checked="selectedKeys.includes(row.key)" :disabled="row.status !== 'pending'"
                @change="toggleRow(row.key)" />
            </td>
            <td class="mono">{{ row.no }}</td>
            <td><span class="type-badge" :class="row.type">{{ row.type === 'enterprise' ? '企业认证' : '个人实名' }}</span></td>
            <td>{{ row.name }}</td>
            <td class="mono">{{ row.idNumber }}</td>
            <td>{{ row.contact }}</td>
            <td class="mono">{{ row.phone }}</td>
            <td><span class="status-badge" :class="row.status">{{ statusText(row.status) }}</span></td>
            <td>{{ formatTime(row.submitTime) }}</td>
            <td class="action-cell">
              <button class="action-btn view" @click="detail = row">查看</button>
              <button v-if="row.status === 'pending'" class="action-btn edit" @click="detail = row">审核</button>
            </td>
          </tr>
          <tr v-if="!filtered.length">
            <td colspan="10" class="empty-cell">暂无认证申请</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="detail" class="modal-overlay" @click="detail = null">
      <div class="modal-content audit-detail" @click.stop>
        <div class="modal-header">
          <h3>认证申请详情 · {{ detail.no }}</h3>
          <button class="close-btn" @click="detail = null">×</button>
        </div>
        <div class="modal-body">
          <div class="detail-row"><span class="detail-label">申请类型</span><span class="detail-value">{{ detail.type === 'enterprise' ? '企业认证' : '个人实名认证' }}</span></div>
          <div class="detail-row"><span class="detail-label">审核状态</span><span class="detail-value">{{ statusText(detail.status) }}</span></div>
          <template v-if="detail.type === 'enterprise'">
            <div class="detail-row"><span class="detail-label">企业名称</span><span class="detail-value">{{ detail.raw.companyName }}</span></div>
            <div class="detail-row"><span class="detail-label">经营主体</span><span class="detail-value">{{ detail.raw.merchantName }}</span></div>
            <div class="detail-row"><span class="detail-label">统一信用代码</span><span class="detail-value mono">{{ detail.raw.creditCode }}</span></div>
            <div class="detail-row"><span class="detail-label">法定代表人</span><span class="detail-value">{{ detail.raw.legalPerson || '—' }}</span></div>
            <div class="detail-row"><span class="detail-label">营业执照编号</span><span class="detail-value">{{ detail.raw.licenseNo || '—' }}</span></div>
            <div class="detail-row"><span class="detail-label">联系人</span><span class="detail-value">{{ detail.raw.contactName || '—' }}</span></div>
            <div class="detail-row"><span class="detail-label">联系电话</span><span class="detail-value mono">{{ detail.raw.contactPhone || '—' }}</span></div>
            <div class="detail-row"><span class="detail-label">材料说明</span><span class="detail-value">{{ detail.raw.attachNote || '—' }}</span></div>
          </template>
          <template v-else>
            <div class="detail-row"><span class="detail-label">真实姓名</span><span class="detail-value">{{ detail.raw.realName }}</span></div>
            <div class="detail-row"><span class="detail-label">身份证号</span><span class="detail-value mono">{{ detail.raw.idNoMasked }}</span></div>
            <div class="detail-row"><span class="detail-label">号码是否变更</span><span class="detail-value">{{ detail.raw.idNoChanged ? '与上次不一致' : '与上次一致' }}</span></div>
            <div class="detail-row"><span class="detail-label">说明</span><span class="detail-value">平台不保存身份证明文，运营只能看到掩码；三要素核验需接合规实名服务。</span></div>
          </template>
          <div class="detail-row"><span class="detail-label">提交时间</span><span class="detail-value">{{ formatTime(detail.submitTime) }}</span></div>
          <div class="detail-row"><span class="detail-label">审核人</span><span class="detail-value">{{ detail.reviewer || '—' }}</span></div>
          <div class="detail-row"><span class="detail-label">审核时间</span><span class="detail-value">{{ formatTime(detail.reviewTime) }}</span></div>
          <div class="detail-row"><span class="detail-label">审核意见</span><span class="detail-value">{{ detail.reviewRemark || '—' }}</span></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="detail = null">关闭</button>
          <template v-if="detail.status === 'pending'">
            <button class="btn btn-success" :disabled="saving" @click="approveOne(detail)">审核通过</button>
            <button class="btn btn-danger" :disabled="saving" @click="openReject([detail])">驳回申请</button>
          </template>
        </div>
      </div>
    </div>

    <div v-if="rejectTargets.length" class="modal-overlay" @click="closeReject">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ rejectTargets.length > 1 ? `批量驳回 ${rejectTargets.length} 笔申请` : '驳回认证申请' }}</h3>
          <button class="close-btn" @click="closeReject">×</button>
        </div>
        <div class="modal-body">
          <p class="reject-tip">驳回必须说明具体原因；同一原因会应用到本批全部申请。</p>
          <div class="form-group">
            <label>审核意见</label>
            <textarea v-model="rejectReason" rows="4" class="form-textarea" placeholder="例如：营业执照与统一社会信用代码不一致，请重新提交"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="closeReject">取消</button>
          <button class="btn btn-danger" :disabled="saving" @click="submitReject">确认驳回</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import '@/styles/admin-page.css'
import {
  auditMerchantCertification,
  getMerchantCertifications,
  getUserIdentities,
  reviewUserIdentity,
} from '@/utils/certification'

const rows = ref([])
const loading = ref(false)
const saving = ref(false)
const typeFilter = ref('all')
const statusFilter = ref('all')
const keyword = ref('')
const selectedKeys = ref([])
const detail = ref(null)
const rejectTargets = ref([])
const rejectReason = ref('')

const statusMap = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回',
}

const statusText = (status) => statusMap[status] ?? status
const formatTime = (value) => (value ? String(value).replace('T', ' ').slice(0, 19) : '—')
const isToday = (value) => {
  if (!value) return false
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return String(value).slice(0, 10) === today
}

const normalizeEnterprise = (row) => ({
  key: `enterprise-${row.id}`,
  id: row.id,
  type: 'enterprise',
  no: row.certNo,
  name: row.companyName || row.merchantName || '—',
  idNumber: row.creditCode || '—',
  contact: row.contactName || '—',
  phone: row.contactPhone || '—',
  status: row.certStatus === 'approved' ? 'approved' : row.certStatus === 'rejected' ? 'rejected' : 'pending',
  submitTime: row.submitTime,
  reviewer: row.reviewer,
  reviewTime: row.reviewTime,
  reviewRemark: row.reviewRemark,
  raw: row,
})

const normalizePersonal = (row) => ({
  key: `personal-${row.id}`,
  id: row.id,
  type: 'personal',
  no: row.identityNo,
  name: row.realName || '—',
  idNumber: row.idNoMasked || '—',
  contact: row.realName || '—',
  phone: '—',
  status: row.status === 'verified' ? 'approved' : row.status === 'rejected' ? 'rejected' : 'pending',
  submitTime: row.submitTime,
  reviewer: row.reviewerName,
  reviewTime: row.reviewTime,
  reviewRemark: row.reviewRemark,
  raw: row,
})

const loadData = async () => {
  loading.value = true
  try {
    const [enterprise, personal] = await Promise.all([
      getMerchantCertifications({ pageNum: 1, pageSize: 200 }),
      getUserIdentities({ pageNum: 1, pageSize: 200 }),
    ])
    const list = []
    if (enterprise.code === 200) list.push(...(enterprise.data?.records ?? []).map(normalizeEnterprise))
    if (personal.code === 200) list.push(...(personal.data?.records ?? []).map(normalizePersonal))
    list.sort((a, b) => String(b.submitTime ?? '').localeCompare(String(a.submitTime ?? '')))
    rows.value = list
    if (enterprise.code !== 200 || personal.code !== 200) {
      message.warning('部分认证数据加载失败，请检查 core-platform')
    }
  } catch {
    message.error('加载认证审核数据失败（请检查 core-platform 是否在运行）')
    rows.value = []
  } finally {
    loading.value = false
  }
}

const filtered = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  return rows.value.filter((row) => {
    if (typeFilter.value !== 'all' && row.type !== typeFilter.value) return false
    if (statusFilter.value !== 'all' && row.status !== statusFilter.value) return false
    if (!text) return true
    return [row.no, row.name, row.idNumber, row.contact, row.phone]
      .some((value) => String(value ?? '').toLowerCase().includes(text))
  })
})

const counts = computed(() => ({
  pending: rows.value.filter((row) => row.status === 'pending').length,
  enterprisePending: rows.value.filter((row) => row.status === 'pending' && row.type === 'enterprise').length,
  personalPending: rows.value.filter((row) => row.status === 'pending' && row.type === 'personal').length,
  passedToday: rows.value.filter((row) => row.status === 'approved' && isToday(row.reviewTime)).length,
  rejectedToday: rows.value.filter((row) => row.status === 'rejected' && isToday(row.reviewTime)).length,
}))

const selectableRows = computed(() => filtered.value.filter((row) => row.status === 'pending'))
const allSelected = computed(() =>
  selectableRows.value.length > 0 && selectableRows.value.every((row) => selectedKeys.value.includes(row.key)))

const toggleRow = (key) => {
  selectedKeys.value = selectedKeys.value.includes(key)
    ? selectedKeys.value.filter((item) => item !== key)
    : [...selectedKeys.value, key]
}

const toggleAll = () => {
  selectedKeys.value = allSelected.value ? [] : selectableRows.value.map((row) => row.key)
}

const approveItem = async (item) => {
  const res = item.type === 'enterprise'
    ? await auditMerchantCertification(item.id, 'approved', '材料齐全，审核通过')
    : await reviewUserIdentity(item.id, true, '材料齐全，审核通过')
  if (res.code !== 200) {
    message.error(res.message || '审核失败')
    return false
  }
  return true
}

const rejectItem = async (item, reason) => {
  const res = item.type === 'enterprise'
    ? await auditMerchantCertification(item.id, 'rejected', reason)
    : await reviewUserIdentity(item.id, false, reason)
  if (res.code !== 200) {
    message.error(res.message || '审核失败')
    return false
  }
  return true
}

const approveOne = async (item) => {
  saving.value = true
  try {
    if (await approveItem(item)) {
      message.success('已通过')
      detail.value = null
      await loadData()
    }
  } catch {
    message.error('审核失败')
  } finally {
    saving.value = false
  }
}

const batchApprove = async () => {
  const targets = filtered.value.filter((row) => selectedKeys.value.includes(row.key) && row.status === 'pending')
  if (!targets.length) return
  if (!window.confirm(`确认通过 ${targets.length} 笔申请？`)) return
  saving.value = true
  let success = 0
  try {
    for (const item of targets) {
      if (await approveItem(item)) success += 1
    }
    message.success(`已通过 ${success} 笔，失败 ${targets.length - success} 笔`)
    selectedKeys.value = []
    await loadData()
  } finally {
    saving.value = false
  }
}

const openReject = (targets) => {
  rejectTargets.value = targets
  rejectReason.value = ''
}

const closeReject = () => {
  rejectTargets.value = []
  rejectReason.value = ''
}

const batchReject = () => {
  const targets = filtered.value.filter((row) => selectedKeys.value.includes(row.key) && row.status === 'pending')
  if (targets.length) openReject(targets)
}

const submitReject = async () => {
  if (!rejectReason.value.trim()) {
    message.warning('驳回必须填写原因')
    return
  }
  saving.value = true
  let success = 0
  try {
    for (const item of rejectTargets.value) {
      if (await rejectItem(item, rejectReason.value.trim())) success += 1
    }
    message.success(`已驳回 ${success} 笔，失败 ${rejectTargets.value.length - success} 笔`)
    closeReject()
    detail.value = null
    selectedKeys.value = []
    await loadData()
  } finally {
    saving.value = false
  }
}

onMounted(loadData)
</script>

<style scoped>
.audit-kpis {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.audit-kpi {
  padding: 14px 16px;
  border: 1px solid #e3eae5;
  border-radius: 12px;
  background: #fff;
}

.audit-kpi span {
  display: block;
  color: #6b7c72;
  font-size: 12.5px;
}

.audit-kpi strong {
  display: block;
  margin-top: 6px;
  color: #0e5233;
  font-size: 26px;
}

.audit-kpi small {
  display: block;
  margin-top: 5px;
  color: #97a3b2;
  font-size: 11.5px;
}

.audit-kpi.tech strong { color: #0b5e86; }
.audit-kpi.green strong { color: #159a5e; }
.audit-kpi.red strong { color: #d4380d; }

.type-btn {
  border: 1px solid #e3eae5;
  border-radius: 999px;
  background: #fff;
  color: #5c6f63;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
}

.type-btn.on {
  border-color: #12764a;
  background: #12764a;
  color: #fff;
  font-weight: 600;
}

.audit-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 2px;
  color: #6b7c72;
  font-size: 12px;
  flex-wrap: wrap;
}

.audit-toolbar .spacer {
  flex: 1;
}

.audit-detail {
  width: 640px;
}

.empty-cell {
  text-align: center;
  color: #93a29a;
  padding: 32px 0;
}

.reject-tip {
  color: #b45309;
  background: #fffbe6;
  border: 1px solid #ffe58f;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12.5px;
}

.mono {
  font-family: "DIN Alternate", "Roboto Mono", ui-monospace, monospace;
}

@media (max-width: 1100px) {
  .audit-kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (max-width: 700px) {
  .audit-kpis { grid-template-columns: 1fr 1fr; }
  .audit-detail { width: calc(100vw - 24px); }
}
</style>
