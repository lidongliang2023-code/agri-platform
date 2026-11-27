<template>
  <div v-loading="loading">
    <AgriVueDetailLayout
      v-if="supplier"
      :code="supplier.creditCode || `SUP-${supplier.id}`"
      :title="supplier.companyName || supplier.shopName || ''"
      :status="auditStatusBadge"
      :meta="headerMeta"
      :tabs="tabs"
      :active-tab="activeTab"
      back-label="返回货源档案管理"
      @back="router.push('/suppliers')"
      @tab-change="(key) => (activeTab = key)"
    >
      <template #actions>
        <el-button @click="printPage">打印</el-button>
        <el-button @click="loadSupplier">刷新</el-button>
        <el-button v-if="supplier.auditStatus === 'PENDING'" type="danger" plain @click="audit('REJECTED')">
          拒绝入驻
        </el-button>
        <el-button v-if="supplier.auditStatus === 'PENDING'" type="primary" @click="audit('APPROVED')">
          通过入驻
        </el-button>
      </template>

      <template v-if="activeTab === 'overview'">
        <AgriVueDetailSection title="企业主体信息">
          <S2b2cDetailInfoGrid :items="companyInfoItems" />
        </AgriVueDetailSection>

        <AgriVueDetailSection title="店铺与区域信息">
          <S2b2cDetailInfoGrid :items="shopRegionItems" />
        </AgriVueDetailSection>
      </template>

      <template v-else-if="activeTab === 'settlement'">
        <AgriVueDetailSection title="收款银行与结算账户">
          <S2b2cDetailInfoGrid :items="bankInfoItems" />
        </AgriVueDetailSection>
      </template>

      <template v-else-if="activeTab === 'audit'">
        <AgriVueDetailSection title="入驻审核记录">
          <S2b2cDetailInfoGrid :items="auditInfoItems" />
        </AgriVueDetailSection>
      </template>

      <template #aside>
        <AgriVueDetailSection title="入驻进度">
          <AgriVueDetailTimeline :items="timelineSteps" />
        </AgriVueDetailSection>

        <AgriVueDetailSection title="关联入口">
          <AgriVueDetailRelated :items="relatedDocs" />
        </AgriVueDetailSection>
      </template>
    </AgriVueDetailLayout>

    <div v-else-if="!loading" class="detail-empty-card">
      <el-empty description="货源档案不存在或无权查看">
        <el-button @click="router.push('/suppliers')">返回货源档案管理</el-button>
      </el-empty>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  AgriVueDetailLayout,
  AgriVueDetailRelated,
  AgriVueDetailSection,
  AgriVueDetailTimeline,
} from '@agri/shared/vue/detail'
import S2b2cDetailInfoGrid from '../../../frontend-shared/components/S2b2cDetailInfoGrid.vue'
import {
  formatDateTime,
  formatShortTime,
  maskPhone,
  resolveAuditStatus,
} from '../../../frontend-shared/detail/s2b2cDetailHelper'
import { platformApi } from '../api'

const router = useRouter()
const route = useRoute()

const loading = ref(true)
const activeTab = ref('overview')
const supplier = ref(null)

async function loadSupplier() {
  const id = route.params.id
  if (!id) return
  loading.value = true
  try {
    supplier.value = await platformApi.getSupplierDetail(id)
  } catch (e) {
    supplier.value = null
    ElMessage.error(e?.message || '货源档案读取失败')
  } finally {
    loading.value = false
  }
}

watch(
  () => route.params.id,
  () => {
    activeTab.value = 'overview'
    loadSupplier()
  },
  { immediate: true },
)

const auditStatusBadge = computed(() => {
  const meta = resolveAuditStatus(supplier.value?.auditStatus)
  return { label: meta.label, tone: meta.tone }
})

const headerMeta = computed(() => [
  { label: '店铺名称', value: supplier.value?.shopName || '—' },
  { label: '法定代表人', value: supplier.value?.legalName || '—' },
  { label: '建档时间', value: formatDateTime(supplier.value?.createTime) },
])

const tabs = [
  { key: 'overview', label: '档案详情' },
  { key: 'settlement', label: '结算账户' },
  { key: 'audit', label: '审核记录' },
]

function maskIdCard(val) {
  const s = String(val || '').trim()
  if (s.length >= 12) return `${s.slice(0, 6)}********${s.slice(-4)}`
  return s || '—'
}

function maskBankAccount(val) {
  const s = String(val || '').trim()
  if (s.length >= 10) return `${s.slice(0, 4)} **** **** ${s.slice(-4)}`
  return s || '—'
}

const companyInfoItems = computed(() => [
  { key: 'companyName', label: '公司名称', value: supplier.value?.companyName || '—' },
  { key: 'creditCode', label: '信用代码', value: supplier.value?.creditCode || '—', mono: true },
  { key: 'industry', label: '所属行业', value: supplier.value?.industry || '—' },
  { key: 'legalName', label: '法定代表人', value: supplier.value?.legalName || '—' },
  { key: 'legalIdCard', label: '证件号码', value: maskIdCard(supplier.value?.legalIdCard), mono: true },
  { key: 'contactPhone', label: '联系电话', value: maskPhone(supplier.value?.contactPhone), mono: true },
])

const shopRegionItems = computed(() => [
  { key: 'shopName', label: '店铺名称', value: supplier.value?.shopName || '—' },
  { key: 'region', label: '所在区域', value: [supplier.value?.province, supplier.value?.city, supplier.value?.district].filter(Boolean).join(' ') || '—' },
  { key: 'address', label: '详细地址', value: supplier.value?.address || '—', fullWidth: true },
  { key: 'shopDesc', label: '店铺描述', value: supplier.value?.shopDesc || '—', fullWidth: true },
])

const bankInfoItems = computed(() => [
  { key: 'bankName', label: '银行名称', value: supplier.value?.bankName || '—' },
  { key: 'bankAccount', label: '银行账号', value: maskBankAccount(supplier.value?.bankAccount), mono: true },
  { key: 'bankBranch', label: '开户支行', value: supplier.value?.bankBranch || '—', fullWidth: true },
])

const auditInfoItems = computed(() => [
  { key: 'status', label: '审核状态', value: resolveAuditStatus(supplier.value?.auditStatus).label },
  { key: 'auditTime', label: '审核时间', value: formatDateTime(supplier.value?.auditTime), mono: true },
  { key: 'createTime', label: '创建时间', value: formatDateTime(supplier.value?.createTime), mono: true },
  { key: 'opinion', label: '审核意见', value: supplier.value?.auditOpinion || '—', fullWidth: true },
])

const timelineSteps = computed(() => {
  const status = String(supplier.value?.auditStatus || '').toUpperCase()
  const approved = status === 'APPROVED'
  const rejected = status === 'REJECTED'
  return [
    {
      key: 'create',
      title: '提交货源建档',
      time: formatShortTime(supplier.value?.createTime) || '已创建',
      state: 'done',
    },
    {
      key: 'audit',
      title: approved ? '资质审核通过' : rejected ? '审核未通过' : '等待资质审核',
      time: approved || rejected ? (formatShortTime(supplier.value?.auditTime) || '已处理') : '当前节点',
      description: supplier.value?.auditOpinion || (approved ? '可进入平台选品池供货' : '待平台运营核验'),
      state: approved ? 'done' : rejected ? 'error' : 'current',
    },
    {
      key: 'supply',
      title: '商品供货与对账',
      time: approved ? '可开展供货' : '待处理',
      state: approved ? 'current' : 'pending',
    },
  ]
})

const relatedDocs = computed(() => [
  {
    key: 'products',
    label: '总部选品池',
    text: '查看供货商品',
    onClick: () => router.push('/product-pool'),
  },
  {
    key: 'statements',
    label: '供货对账单',
    text: '查看对账流水',
    onClick: () => router.push('/supplier-statements'),
  },
  {
    key: 'supply-ops',
    label: '平台供货运营',
    text: '进入供货工作台',
    onClick: () => {
      if (supplier.value?.id) sessionStorage.setItem('s2b2c-platform-supply-source', String(supplier.value.id))
      router.push('/supply/products')
    },
  },
])

async function audit(status) {
  try {
    let opinion = ''
    if (status === 'REJECTED') {
      const result = await ElMessageBox.prompt('请输入拒绝原因', '拒绝供应商', {
        inputPattern: /\S+/,
        inputErrorMessage: '请填写拒绝原因',
      })
      opinion = result.value
    } else {
      await ElMessageBox.confirm('确认通过该供应商的入驻申请？', '通过供应商', {
        confirmButtonText: '通过',
        cancelButtonText: '取消',
        type: 'warning',
      })
    }
    const res = await platformApi.auditSupplier({
      id: route.params.id,
      auditStatus: status,
      auditOpinion: opinion,
    })
    if (res?.success === false) {
      ElMessage.error(res.message || '审核失败')
      return
    }
    ElMessage.success('审核已提交')
    await loadSupplier()
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error(e?.message || '审核失败')
  }
}

function printPage() {
  window.print()
}
</script>

<style scoped>
.detail-empty-card {
  padding: 48px 24px;
  border: 1px solid #e8ecea;
  border-radius: 10px;
  background: #fff;
}
</style>
