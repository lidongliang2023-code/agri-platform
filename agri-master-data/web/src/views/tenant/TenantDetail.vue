<template>
  <div class="subject-detail">
    <header class="page-header">
      <button class="back-btn" @click="goBack">← 返回主体列表</button>
      <div>
        <h1>主体详情</h1>
        <p>查看主体注册档案、认证信息、联系方式和主体资源使用情况。</p>
      </div>
      <button v-if="tenantData" class="edit-btn" @click="editSubject">编辑资料</button>
    </header>

    <div v-if="loadError" class="state-card error">{{ loadError }}</div>
    <div v-else-if="!tenantData" class="state-card">正在加载主体详情…</div>

    <template v-else>
      <section class="identity-card">
        <div class="identity-main">
          <span class="identity-icon">{{ isPersonal ? '👤' : '🏢' }}</span>
          <div>
            <div class="identity-title">
              <h2>{{ value(tenantData.tenantName) }}</h2>
              <span class="type-badge" :class="isPersonal ? 'personal' : 'enterprise'">{{ subjectTypeText(tenantData.tenantType) }}</span>
            </div>
            <p>{{ tenantData.tenantCode }}</p>
          </div>
        </div>
        <div class="identity-status">
          <span class="status-badge" :class="verifyClass(tenantData.verifyStatus)">{{ verifyText(tenantData.verifyStatus) }}</span>
          <span class="status-badge" :class="Number(tenantData.status) === 1 ? 'active' : 'inactive'">
            {{ Number(tenantData.status) === 1 ? '启用' : '停用' }}
          </span>
        </div>
      </section>

      <div class="content-grid">
        <section class="detail-card">
          <div class="card-head"><h3>注册档案</h3><span>{{ isPersonal ? '个人主体' : '企业主体' }}</span></div>
          <div class="info-grid">
            <div><label>主体编码</label><strong>{{ value(tenantData.tenantCode) }}</strong></div>
            <div><label>主体类型</label><strong>{{ subjectTypeText(tenantData.tenantType) }}</strong></div>
            <div><label>{{ isPersonal ? '真实姓名' : '企业名称' }}</label><strong>{{ value(tenantData.tenantName) }}</strong></div>
            <template v-if="isPersonal">
              <div><label>身份证号码</label><strong>{{ value(tenantData.identityNoMasked) }}</strong></div>
              <div><label>个人经营类型</label><strong>{{ value(tenantData.businessType) }}</strong></div>
              <div><label>证件有效期</label><strong>{{ validity }}</strong></div>
            </template>
            <template v-else>
              <div><label>统一社会信用代码</label><strong>{{ value(tenantData.creditCode) }}</strong></div>
              <div><label>所属行业</label><strong>{{ value(tenantData.industry) }}</strong></div>
              <div><label>企业规模</label><strong>{{ value(tenantData.companySize) }}</strong></div>
              <div><label>法定代表人</label><strong>{{ value(tenantData.legalPerson) }}</strong></div>
              <div><label>营业执照号</label><strong>{{ value(tenantData.licenseNo) }}</strong></div>
              <div><label>注册资本</label><strong>{{ value(tenantData.registeredCapital) }}</strong></div>
            </template>
            <div class="wide-field"><label>注册地址</label><strong>{{ value(tenantData.address) }}</strong></div>
            <div><label>创建时间</label><strong>{{ formatDate(tenantData.createTime) }}</strong></div>
          </div>
        </section>

        <section class="detail-card">
          <div class="card-head"><h3>联系信息</h3></div>
          <div class="info-grid">
            <div><label>联系人</label><strong>{{ value(tenantData.contactName) }}</strong></div>
            <div><label>联系电话</label><strong>{{ value(tenantData.phone) }}</strong></div>
            <div><label>联系邮箱</label><strong>{{ value(tenantData.email) }}</strong></div>
            <div><label>主体状态</label><strong>{{ Number(tenantData.status) === 1 ? '启用' : '停用' }}</strong></div>
          </div>
        </section>
      </div>

      <section class="detail-card">
        <div class="card-head">
          <h3>认证与核验信息</h3>
          <span class="status-badge" :class="verifyClass(tenantData.verifyStatus)">{{ verifyText(tenantData.verifyStatus) }}</span>
        </div>
        <div v-if="hasCertification" class="info-grid">
          <div><label>认证单号</label><strong>{{ value(tenantData.certificationNo) }}</strong></div>
          <div><label>认证状态</label><strong>{{ verifyText(tenantData.certificationStatus || tenantData.verifyStatus) }}</strong></div>
          <div><label>认证渠道</label><strong>{{ value(tenantData.verificationChannel) }}</strong></div>
          <template v-if="isPersonal">
            <div><label>公安二要素</label><strong>{{ yesNo(tenantData.policeVerified) }}</strong></div>
            <div><label>活体核验</label><strong>{{ yesNo(tenantData.livenessVerified) }}</strong></div>
          </template>
          <template v-else>
            <div><label>法人扫脸</label><strong>{{ faceStatusText(tenantData.legalPersonFaceStatus) }}</strong></div>
            <div><label>对公账户户名</label><strong>{{ value(tenantData.corporateBankName) }}</strong></div>
            <div><label>对公账户</label><strong>{{ value(tenantData.corporateBankAccount) }}</strong></div>
            <div><label>对公打款</label><strong>{{ transferStatusText(tenantData.corporateTransferStatus) }}</strong></div>
            <div><label>营业执照材料</label><strong>{{ tenantData.businessLicenseUrl ? '已上传' : '未上传' }}</strong></div>
          </template>
          <div v-if="tenantData.certificationReviewRemark" class="wide-field">
            <label>审核意见</label><strong>{{ tenantData.certificationReviewRemark }}</strong>
          </div>
        </div>
        <div v-else class="empty-certification">该主体尚未提交认证资料。</div>
      </section>

      <div class="content-grid">
        <section class="detail-card">
          <div class="card-head"><h3>成员与组织</h3></div>
          <div class="stats-grid">
            <div><span>成员总数</span><strong>{{ countText(tenantData.userOrgStats?.totalUsers) }}</strong></div>
            <div><span>已实名成员</span><strong>{{ countText(tenantData.userOrgStats?.verifiedUsers) }}</strong></div>
            <div><span>待认证成员</span><strong>{{ countText(tenantData.userOrgStats?.pendingUsers) }}</strong></div>
            <div><span>组织数量</span><strong>{{ countText(tenantData.userOrgStats?.totalOrgs) }}</strong></div>
          </div>
        </section>

        <section class="detail-card">
          <div class="card-head"><h3>资源配额</h3><router-link to="/subject/quota">查看配额 →</router-link></div>
          <div class="stats-grid">
            <div><span>用户</span><strong>{{ quotaText(tenantData.quotaInfo?.usedUsers, tenantData.quotaInfo?.userLimit) }}</strong></div>
            <div><span>组织</span><strong>{{ quotaText(tenantData.quotaInfo?.usedOrgs, tenantData.quotaInfo?.orgLimit) }}</strong></div>
            <div><span>商品</span><strong>{{ quotaText(tenantData.quotaInfo?.usedProducts, tenantData.quotaInfo?.productLimit) }}</strong></div>
            <div><span>API</span><strong>{{ quotaText(tenantData.quotaInfo?.usedApiToday, tenantData.quotaInfo?.apiLimit) }}</strong></div>
          </div>
        </section>
      </div>

      <section class="detail-card">
        <div class="card-head"><h3>操作记录</h3></div>
        <table v-if="tenantData.operationLogs?.length" class="log-table">
          <thead><tr><th>时间</th><th>操作</th><th>操作人</th><th>说明</th></tr></thead>
          <tbody>
            <tr v-for="(log, index) in tenantData.operationLogs" :key="index">
              <td>{{ value(log.time) }}</td><td>{{ value(log.operationType) }}</td>
              <td>{{ value(log.operator) }}</td><td>{{ value(log.content) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty-tip">暂无操作记录。</p>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getTenantDetail } from '../../utils/api'

const route = useRoute()
const router = useRouter()
const tenantData = ref(null)
const loadError = ref('')
const isPersonal = computed(() => tenantData.value?.tenantType === 'INDIVIDUAL')
const hasCertification = computed(() => Boolean(
  tenantData.value?.certificationNo ||
  tenantData.value?.verificationChannel ||
  tenantData.value?.legalPersonFaceStatus ||
  tenantData.value?.identityNoMasked,
))
const validity = computed(() => {
  const start = tenantData.value?.validStart
  const end = tenantData.value?.validEnd
  return start || end ? `${value(start)} 至 ${value(end)}` : '—'
})

const loadDetail = async () => {
  loadError.value = ''
  try {
    const response = await getTenantDetail(route.params.id)
    if (response.code !== 200) throw new Error(response.message || '主体详情加载失败')
    tenantData.value = response.data
  } catch (error) {
    tenantData.value = null
    loadError.value = error instanceof Error ? error.message : '主体详情加载失败'
  }
}

const goBack = () => router.push('/subject/list')
const editSubject = () => router.push(`/subject/edit/${route.params.id}`)
const value = (input) => input === null || input === undefined || input === '' ? '—' : input
const countText = (input) => input === null || input === undefined ? '—' : Number(input).toLocaleString('zh-CN')
const quotaText = (used, limit) => `${countText(used)} / ${countText(limit)}`
const subjectTypeText = (type) => type === 'INDIVIDUAL' ? '个人主体' : '企业主体'
const verifyText = (status) => ({ approved: '已认证', pending: '审核中', rejected: '已驳回', draft: '草稿', unverified: '未认证' }[status] || '未认证')
const verifyClass = (status) => ({ approved: 'active', pending: 'pending', rejected: 'rejected', draft: 'inactive', unverified: 'inactive' }[status] || 'inactive')
const yesNo = (input) => input === true ? '已通过' : input === false ? '未通过' : '—'
const faceStatusText = (status) => ({ verified: '已通过', uploaded: '材料已上传', pending: '待核验', rejected: '未通过' }[String(status || '').toLowerCase()] || status || '—')
const transferStatusText = (status) => ({ verified: '已验证', submitted: '已提交', pending: '待打款', rejected: '未通过' }[String(status || '').toLowerCase()] || status || '—')
const formatDate = (input) => input ? String(input).replace('T', ' ').slice(0, 16) : '—'

onMounted(loadDetail)
</script>

<style scoped>
.subject-detail { padding:0; color:var(--pc-text,#1a1a1a); }
.page-header { display:flex; align-items:center; gap:16px; margin-bottom:20px; }
.page-header > div { flex:1; min-width:0; }
.page-header h1 { margin:0 0 4px; font-size:24px; line-height:1.35; color:var(--pc-text,#1a1a1a); }
.page-header p { margin:0; color:var(--pc-secondary,#595959); font-size:14px; }
.back-btn,.edit-btn { height:32px; padding:0 16px; border-radius:4px; font-size:14px; font-weight:500; cursor:pointer; }
.back-btn { border:1px solid var(--pc-border,#e8e8e8); background:#fff; color:var(--pc-text,#1a1a1a); }
.back-btn:hover { border-color:var(--pc-brand,#2d8f4e); color:var(--pc-brand,#2d8f4e); }
.edit-btn { border:1px solid var(--pc-brand,#2d8f4e); background:var(--pc-brand,#2d8f4e); color:#fff; }
.edit-btn:hover { border-color:var(--pc-hover,#247a3f); background:var(--pc-hover,#247a3f); }
.state-card,.identity-card,.detail-card { border:1px solid var(--pc-border,#e8e8e8); border-radius:8px; background:#fff; box-shadow:none; }
.state-card { padding:40px; text-align:center; color:var(--pc-secondary,#595959); }
.state-card.error { color:#b71c1c; background:#ffebee; border-color:#ffcdd2; }
.identity-card { display:flex; justify-content:space-between; align-items:center; gap:16px; padding:20px 24px; margin-bottom:16px; }
.identity-main { display:flex; align-items:center; gap:14px; }
.identity-icon { width:48px; height:48px; display:grid; place-items:center; border-radius:8px; background:var(--pc-light,#e8f5e9); font-size:24px; }
.identity-title { display:flex; align-items:center; flex-wrap:wrap; gap:8px; }
.identity-title h2 { margin:0; font-size:20px; color:var(--pc-text,#1a1a1a); }
.identity-main p { margin:4px 0 0; color:var(--pc-secondary,#595959); font-family:var(--pc-mono,ui-monospace,Consolas,monospace); font-size:12px; }
.identity-status { display:flex; gap:8px; }
.type-badge,.status-badge { display:inline-block; padding:3px 10px; border-radius:4px; font-size:12px; font-weight:500; }
.type-badge.enterprise,.status-badge.active { background:var(--pc-light,#e8f5e9); color:var(--pc-active,#1b6332); }
.type-badge.personal { background:#e3f2fd; color:#1565c0; }
.status-badge.pending { background:#fff3e0; color:#8f4500; }
.status-badge.rejected { background:#ffebee; color:#b71c1c; }
.status-badge.inactive { background:var(--pc-bg,#f5f6fa); color:var(--pc-secondary,#595959); }
.content-grid { display:grid; grid-template-columns:1.35fr .65fr; gap:16px; margin-bottom:16px; }
.detail-card { padding:24px; margin-bottom:16px; }
.content-grid .detail-card { margin-bottom:0; }
.card-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; }
.card-head h3 { margin:0; font-size:18px; color:var(--pc-text,#1a1a1a); }
.card-head span { color:var(--pc-secondary,#595959); font-size:12px; }
.card-head a { color:var(--pc-active,#1b6332); font-size:13px; text-decoration:none; }
.card-head a:hover { text-decoration:underline; }
.info-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
.info-grid > div { padding:12px 14px; border:1px solid var(--pc-line,#f0f0f0); border-radius:6px; background:var(--pc-bg,#f5f6fa); }
.info-grid label { display:block; margin-bottom:4px; color:var(--pc-secondary,#595959); font-size:12px; }
.info-grid strong { color:var(--pc-text,#1a1a1a); font-size:14px; font-weight:500; word-break:break-all; }
.wide-field { grid-column:span 2; }
.stats-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }
.stats-grid div { padding:12px 14px; border:1px solid var(--pc-line,#f0f0f0); border-radius:6px; background:var(--pc-bg,#f5f6fa); }
.stats-grid span,.stats-grid strong { display:block; }
.stats-grid span { color:var(--pc-secondary,#595959); font-size:12px; }
.stats-grid strong { margin-top:6px; color:var(--pc-text,#1a1a1a); font-size:18px; font-variant-numeric:tabular-nums; }
.log-table { width:100%; border-collapse:collapse; }
.log-table th,.log-table td { height:48px; padding:12px 16px; border-bottom:1px solid var(--pc-line,#f0f0f0); text-align:left; font-size:14px; color:var(--pc-text,#1a1a1a); }
.log-table th { background:#fafafa; color:var(--pc-secondary,#595959); font-size:12px; font-weight:600; border-bottom:1px solid var(--pc-border,#e8e8e8); }
.empty-tip,.empty-certification { margin:0; padding:24px; border-radius:6px; background:var(--pc-bg,#f5f6fa); text-align:center; color:var(--pc-secondary,#595959); font-size:13px; }
@media(max-width:1000px){.content-grid{grid-template-columns:1fr}.info-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:600px){.page-header{align-items:flex-start;flex-wrap:wrap}.identity-card{align-items:flex-start;flex-direction:column}.info-grid,.stats-grid{grid-template-columns:1fr}.wide-field{grid-column:auto}}
</style>
