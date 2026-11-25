<template>
  <div class="mds-page">
    <PageHeader
      title="认证审核"
      subtitle="企业与个人实名认证台账：本页只做核对，审核动作由用户中心运营端办理。"
      source="只读 · 用户中心主责"
    />

    <NoticeBar tone="info" title="只读视图：">
      批量通过 / 驳回与按行审核已移除，认证结论统一在用户中心运营端录入，避免同一申请出现两套审核记录。
    </NoticeBar>

    <div class="audit-kpis">
      <div class="audit-kpi"><span>待审核</span><strong>{{ counts.pending }}</strong><small>全部待处理申请</small></div>
      <div class="audit-kpi tech"><span>企业待审</span><strong>{{ counts.enterprisePending }}</strong><small>经营主体资质</small></div>
      <div class="audit-kpi"><span>个人待审</span><strong>{{ counts.personalPending }}</strong><small>个人实名认证</small></div>
      <div class="audit-kpi green"><span>今日通过</span><strong>{{ counts.passedToday }}</strong><small>按审核时间统计</small></div>
      <div class="audit-kpi red"><span>今日驳回</span><strong>{{ counts.rejectedToday }}</strong><small>按审核时间统计</small></div>
    </div>

    <AgriVueTable
      :columns="columns"
      :data="filtered"
      row-key="key"
      :loading="loading"
      empty-text="暂无认证申请"
      column-settings-storage-key="mds:cols:user-audit"
      client-pagination
      v-model:page="page"
      v-model:page-size="pageSize"
      @refresh="loadData"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="3" :loading="loading" @search="search" @reset="reset">
          <div class="agri-vue-filter-field">
            <label>认证类型</label>
            <select v-model="typeFilter" class="mds-select">
              <option value="all">全部类型</option>
              <option value="enterprise">企业认证</option>
              <option value="personal">个人实名认证</option>
            </select>
          </div>
          <div class="agri-vue-filter-field">
            <label>审核状态</label>
            <select v-model="statusFilter" class="mds-select">
              <option value="all">全部状态</option>
              <option value="pending">待审核</option>
              <option value="approved">已通过</option>
              <option value="rejected">已驳回</option>
            </select>
          </div>
          <div class="agri-vue-filter-field">
            <label>关键字</label>
            <input v-model="keyword" class="mds-input" placeholder="主体名称 / 申请编号 / 证件号 / 联系人" @keyup.enter="search" />
          </div>
        </AgriVueFilterBar>
      </template>

      <template #toolbar-left>
        <button class="mds-btn" @click="openUserCenter">前往用户中心 · 认证审核</button>
        <span class="mds-muted" style="font-size: 12px">加载 {{ rows.length }} 条 · 筛选 {{ filtered.length }} 条</span>
      </template>

      <template #cell-type="{ row }">
        <span class="type-badge" :class="row.type">{{ row.type === 'enterprise' ? '企业认证' : '个人实名' }}</span>
      </template>
      <template #cell-status="{ row }">
        <span class="status-badge" :class="row.status">{{ statusText(row.status) }}</span>
      </template>
      <template #cell-submitTime="{ row }">
        {{ formatTime(row.submitTime) }}
      </template>
      <template #cell-actions="{ row }">
        <MdsRowActions :actions="[{ key: 'view', label: '查看', onClick: () => (detail = row) }]" />
      </template>
    </AgriVueTable>

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
            <div class="detail-row"><span class="detail-label">注册资本</span><span class="detail-value">{{ detail.raw.registeredCapital || '—' }}</span></div>
            <div class="detail-row"><span class="detail-label">法人扫脸</span><span class="detail-value">{{ detail.raw.legalPersonFaceStatus === 'verified' ? '已通过' : '已提交待复核' }}</span></div>
            <div class="detail-row"><span class="detail-label">对公账户</span><span class="detail-value">{{ detail.raw.corporateBankName || '—' }} · {{ detail.raw.corporateBankAccount || '—' }}</span></div>
            <div class="detail-row"><span class="detail-label">对公打款</span><span class="detail-value">{{ detail.raw.corporateTransferAmount || '—' }} 元 · {{ detail.raw.corporateTransferReference || '—' }}</span></div>
            <div class="detail-row"><span class="detail-label">认证方式</span><span class="detail-value">{{ detail.raw.verificationChannel || '法人扫脸 + 对公打款' }}</span></div>
            <div class="detail-row"><span class="detail-label">联系人</span><span class="detail-value">{{ detail.raw.contactName || '—' }}</span></div>
            <div class="detail-row"><span class="detail-label">联系电话</span><span class="detail-value mono">{{ detail.raw.contactPhone || '—' }}</span></div>
            <div class="detail-row"><span class="detail-label">材料说明</span><span class="detail-value">{{ detail.raw.attachNote || '—' }}</span></div>
            <div class="detail-row material-detail-row">
              <span class="detail-label">认证材料</span>
              <div class="material-gallery">
                <figure v-for="item in enterpriseDocuments" :key="item.key">
                  <div class="material-image-wrap">
                    <img
                      v-if="documentPreviews[item.key]"
                      :src="documentPreviews[item.key]"
                      :alt="item.label"
                      @click="openDocument(documentPreviews[item.key])"
                    />
                    <div v-else class="material-empty">
                      {{ documentLoading ? '材料加载中…' : (item.url ? '材料加载失败' : '未上传') }}
                    </div>
                  </div>
                  <figcaption>{{ item.label }}</figcaption>
                </figure>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="detail-row"><span class="detail-label">真实姓名</span><span class="detail-value">{{ detail.raw.realName }}</span></div>
            <div class="detail-row"><span class="detail-label">身份证号</span><span class="detail-value mono">{{ detail.raw.idNoMasked }}</span></div>
            <div class="detail-row"><span class="detail-label">认证渠道</span><span class="detail-value">{{ detail.raw.verificationChannel || '公安二要素 + 活体' }}</span></div>
            <div class="detail-row"><span class="detail-label">公安二要素</span><span class="detail-value">{{ detail.raw.policeVerified ? '已通过' : '待核验' }}</span></div>
            <div class="detail-row"><span class="detail-label">人脸活体</span><span class="detail-value">{{ detail.raw.livenessVerified ? '已通过' : '待检测' }}</span></div>
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
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import MdsRowActions from '@/components/ui/MdsRowActions.vue'
import { AgriVueFilterBar, AgriVueTable } from '@agri/shared/vue/list'
import '@/styles/admin-page.css'

const columns = [
  { prop: 'no', label: '申请编号', width: 155, kind: 'code', locked: true },
  { prop: 'type', label: '类型', width: 105, align: 'center', ellipsis: false },
  { prop: 'name', label: '主体 / 姓名', minWidth: 160 },
  { prop: 'idNumber', label: '证件 / 信用代码', width: 175, kind: 'code' },
  { prop: 'contact', label: '联系人', width: 100 },
  { prop: 'phone', label: '手机号', width: 130, kind: 'code' },
  { prop: 'status', label: '状态', width: 96, kind: 'status' },
  { prop: 'submitTime', label: '提交时间', width: 165 },
  { key: 'actions', label: '操作', width: 90, kind: 'action' },
]
import {
  getMerchantCertificationDocument,
  getMerchantCertifications,
  getUserIdentities,
} from '@/utils/certification'

const rows = ref([])
const loading = ref(false)
const typeFilter = ref('all')
const statusFilter = ref('all')
const keyword = ref('')
const detail = ref(null)
const page = ref(1)
const pageSize = ref(20)
watch([typeFilter, statusFilter, keyword], () => { page.value = 1 })
const search = () => {
  keyword.value = keyword.value.trim()
  page.value = 1
}
const reset = () => {
  typeFilter.value = 'all'
  statusFilter.value = 'all'
  keyword.value = ''
  page.value = 1
}

function openUserCenter() {
  window.open(`${window.location.protocol}//${window.location.hostname}:8115/user-center-ops/`, '_blank', 'noopener')
}
const documentPreviews = ref({})
const documentLoading = ref(false)

const enterpriseDocuments = computed(() => {
  const raw = detail.value?.raw
  if (!raw || detail.value?.type !== 'enterprise') return []
  return [
    { key: 'businessLicense', label: '营业执照', url: raw.businessLicenseUrl },
    { key: 'legalPersonFace', label: '法人扫脸', url: raw.legalPersonFaceUrl },
    { key: 'corporateTransferProof', label: '对公打款凭证', url: raw.corporateTransferProofUrl },
  ]
})

const clearDocumentPreviews = () => {
  Object.values(documentPreviews.value).forEach((url) => URL.revokeObjectURL(String(url)))
  documentPreviews.value = {}
}

const loadDocumentPreviews = async (row) => {
  clearDocumentPreviews()
  if (!row || row.type !== 'enterprise' || !row.raw?.merchantId) return
  documentLoading.value = true
  try {
    for (const item of enterpriseDocuments.value) {
      if (!item.url) continue
      try {
        const blob = await getMerchantCertificationDocument(row.raw.merchantId, item.url)
        if (detail.value?.key !== row.key) return
        documentPreviews.value = {
          ...documentPreviews.value,
          [item.key]: URL.createObjectURL(blob),
        }
      } catch {
        if (detail.value?.key === row.key) message.warning(`${item.label}加载失败`)
      }
    }
  } finally {
    if (detail.value?.key === row.key) documentLoading.value = false
  }
}

const openDocument = (url) => {
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}

watch(detail, (row) => void loadDocumentPreviews(row))
onBeforeUnmount(clearDocumentPreviews)

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

/**
 * 判断接口是否成功。
 *
 * <p>core-platform 的 {@code ApiResponse.ok()} 返回的是 {@code code: 0}，
 * 不是 200 —— 本页原先按 {@code code === 200} 判定，结果**所有成功的响应都被当成失败**：
 * 列表永远是空的、还挂着"加载失败"的提示，审核按钮也点不动。
 * 两个都认，避免以后再被不同模块的成功码绊倒。</p>
 */
const isOk = (res) => res?.code === 0 || res?.code === 200

const loadData = async () => {
  loading.value = true
  try {
    const [enterprise, personal] = await Promise.all([
      getMerchantCertifications({ pageNum: 1, pageSize: 200 }),
      getUserIdentities({ pageNum: 1, pageSize: 200 }),
    ])
    const list = []
    if (isOk(enterprise)) list.push(...(enterprise.data?.records ?? []).map(normalizeEnterprise))
    if (isOk(personal)) list.push(...(personal.data?.records ?? []).map(normalizePersonal))
    list.sort((a, b) => String(b.submitTime ?? '').localeCompare(String(a.submitTime ?? '')))
    rows.value = list
    if (!isOk(enterprise) || !isOk(personal)) {
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

onMounted(loadData)
</script>

<style scoped>
.audit-inline-summary {
  color: #6b7c72;
  font-size: 12px;
  white-space: nowrap;
  margin-left: auto;
}

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
  border-color: #2d8f4e;
  background: #2d8f4e;
  color: #fff;
  font-weight: 600;
}

.audit-detail {
  width: 640px;
}

.empty-cell {
  text-align: center;
  color: #93a29a;
  padding: 32px 0;
}

.mono {
  font-family: "DIN Alternate", "Roboto Mono", ui-monospace, monospace;
}

.material-detail-row {
  align-items: flex-start;
}

.material-gallery {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 9px;
  width: calc(100% - 112px);
}

.material-gallery figure {
  min-width: 0;
  margin: 0;
  padding: 7px;
  border: 1px solid #e3eae5;
  border-radius: 9px;
  background: #f8fbf9;
}

.material-image-wrap {
  overflow: hidden;
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: 6px;
  background: #edf3ef;
}

.material-image-wrap img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: zoom-in;
}

.material-empty {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  color: #8a9a91;
  font-size: var(--agri-font-size-micro);
}

.material-gallery figcaption {
  margin-top: 6px;
  overflow: hidden;
  color: #526359;
  font-size: var(--agri-font-size-micro);
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 1100px) {
  .audit-kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (max-width: 700px) {
  .audit-kpis { grid-template-columns: 1fr 1fr; }
  .audit-detail { width: calc(100vw - 24px); }
  .material-gallery { width: 100%; grid-template-columns: 1fr; }
}
</style>
