<template>
  <div class="audit-progress-page">
    <div class="progress-card">
      <div class="head">
        <div>
          <h2>入驻审核进度</h2>
          <p>平台审核通过后，还需完成批发商业务身份认证，供货能力才会开通。</p>
        </div>
        <el-tag :type="statusType">{{ statusText }}</el-tag>
      </div>

      <el-empty v-if="auditStatus === 'NONE'" description="尚未提交入驻申请">
        <el-button type="primary" @click="router.push('/apply')">去提交申请</el-button>
      </el-empty>

      <template v-else>
        <el-steps :active="activeStep" finish-status="success" simple class="steps">
          <el-step title="提交申请" />
          <el-step title="平台审核" />
          <el-step title="业务身份与供货能力" />
          <el-step title="入驻完成" />
        </el-steps>

        <dl class="info">
          <dt>企业名称</dt><dd>{{ detail.companyName || profile.companyName || '—' }}</dd>
          <dt>店铺名称</dt><dd>{{ detail.shopName || profile.shopName || '—' }}</dd>
          <dt>申请时间</dt><dd>{{ profile.createTime || detail.createTime || '—' }}</dd>
          <dt>审核时间</dt><dd>{{ profile.auditTime || detail.auditTime || '—' }}</dd>
          <dt>供货能力</dt>
          <dd>
            <el-tag :type="profile.capabilityGranted ? 'success' : 'warning'">
              {{ profile.capabilityGranted ? '已开通' : '未开通' }}
            </el-tag>
            <span v-if="!profile.capabilityGranted" class="reason">{{ profile.capabilityReason }}</span>
          </dd>
        </dl>

        <div v-if="auditStatus === 'REJECTED'" class="audit-opinion">
          <h3>审核意见</h3>
          <p>{{ detail.auditOpinion || profile.auditOpinion || '请根据平台意见调整后重新申请。' }}</p>
          <el-button type="primary" @click="reapply">重新申请</el-button>
        </div>

        <div v-if="auditStatus === 'APPROVED' && !profile.capabilityGranted" class="capability-guide">
          <b>还需要完成业务身份认证</b>
          <p>{{ profile.capabilityReason || '请先在用户中心完成批发商业务身份认证，通过后即可上架商品。' }}</p>
          <el-button type="primary" size="small" @click="openIdentityCenter">前往用户中心完成认证</el-button>
        </div>

        <div class="actions">
          <el-button :loading="loading" @click="loadAuditInfo">刷新审核状态</el-button>
          <el-button v-if="auditStatus === 'APPROVED' && profile.capabilityGranted"
                     type="primary" @click="router.push('/')">进入供应商工作台</el-button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { supplierApi } from '../api'

const router = useRouter()
const loading = ref(false)
const profile = ref({})
const detail = ref({})
const auditStatus = ref('NONE')

const statusText = computed(() => ({
  NONE: '未申请', PENDING: '审核中', APPROVED: '已通过', REJECTED: '已拒绝',
}[auditStatus.value] || auditStatus.value))
const statusType = computed(() => ({
  NONE: 'info', PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger',
}[auditStatus.value] || 'info'))
const activeStep = computed(() => {
  if (auditStatus.value === 'APPROVED' && profile.value.capabilityGranted) return 4
  if (auditStatus.value === 'APPROVED') return 2
  if (auditStatus.value === 'PENDING' || auditStatus.value === 'REJECTED') return 1
  return 0
})

onMounted(loadAuditInfo)

async function loadAuditInfo() {
  loading.value = true
  try {
    const data = (await supplierApi.getProfile()) || {}
    profile.value = data
    if (!data.applied) {
      auditStatus.value = 'NONE'
      detail.value = {}
      return
    }
    detail.value = await supplierApi.getDetail(data.id)
    auditStatus.value = detail.value?.auditStatus || data.auditStatus || 'PENDING'
  } catch (e) {
    ElMessage.error(e?.message || '审核进度读取失败')
  } finally {
    loading.value = false
  }
}

const reapply = () => router.push('/apply')

function openIdentityCenter() {
  const local = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  const base = local
    ? `${window.location.protocol}//${window.location.hostname}:8098/portal/index.html`
    : `${window.location.origin}/portal/index.html`
  window.open(`${base}#/account/org`, '_blank', 'noopener')
}
</script>

<style scoped>
.audit-progress-page {
  display: flex;
  justify-content: center;
}

.progress-card {
  width: 760px;
  max-width: 100%;
  padding: 24px;
  border: 1px solid #e3eae5;
  border-radius: 12px;
  background: #fff;
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.head h2 {
  margin: 0 0 6px;
  font-size: 18px;
}

.head p {
  margin: 0;
  color: #84938a;
  font-size: 12px;
  line-height: 1.6;
}

.steps {
  margin-bottom: 18px;
}

.info {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 10px 14px;
  margin: 0;
  font-size: 13px;
}

.info dt {
  color: #84938a;
}

.info dd {
  margin: 0;
  color: #173e2a;
}

.reason {
  margin-left: 8px;
  color: #a46408;
  font-size: 12px;
}

.audit-opinion,
.capability-guide {
  margin-top: 16px;
  padding: 12px 14px;
  border-radius: 10px;
  font-size: 13px;
}

.audit-opinion {
  border: 1px solid #f0c7c7;
  background: #fff5f5;
  color: #7d2e2e;
}

.capability-guide {
  border: 1px solid #f2d8a8;
  background: #fff9ec;
  color: #7c5a12;
}

.audit-opinion h3,
.capability-guide b {
  margin: 0 0 6px;
  font-size: 13px;
}

.audit-opinion p,
.capability-guide p {
  margin: 0 0 8px;
  line-height: 1.7;
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 18px;
}
</style>