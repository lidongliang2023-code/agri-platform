<template>
  <div v-loading="loading">
    <AgriVueDetailLayout
      v-if="product"
      :code="`PRD-${product.id}`"
      :title="product.name || ''"
      :status="auditStatusBadge"
      :extra-statuses="extraStatuses"
      :meta="headerMeta"
      :tabs="tabs"
      :active-tab="activeTab"
      back-label="返回商品审核"
      @back="router.push('/products')"
      @tab-change="(key) => (activeTab = key)"
    >
      <template #actions>
        <el-button @click="printPage">打印</el-button>
        <el-button @click="loadProduct">刷新</el-button>
        <el-button
          v-if="isPending"
          type="danger"
          plain
          :loading="auditing"
          @click="audit('REJECTED')"
        >
          拒绝审核
        </el-button>
        <el-button
          v-if="isPending"
          type="primary"
          :loading="auditing"
          @click="audit('APPROVED')"
        >
          审核通过
        </el-button>
      </template>

      <template v-if="activeTab === 'overview'">
        <AgriVueDetailSection title="基本信息">
          <S2b2cDetailInfoGrid :items="basicInfoItems" />
        </AgriVueDetailSection>

        <AgriVueDetailSection title="经营核心指标">
          <div class="detail-kpi-strip">
            <div class="detail-kpi-cell">
              <span>平台供货价</span>
              <strong>¥{{ formatMoney(product.price) }}</strong>
              <small>成本 ¥{{ formatMoney(product.costPrice) }} · 原价 ¥{{ formatMoney(product.originalPrice) }}</small>
            </div>
            <div class="detail-kpi-cell">
              <span>当前库存</span>
              <strong>{{ Number(product.stock || 0).toLocaleString('zh-CN') }} {{ product.unit || '件' }}</strong>
              <small>预警阈值 {{ Number(product.stockWarning || 0).toLocaleString('zh-CN') }}</small>
            </div>
            <div class="detail-kpi-cell">
              <span>累计销量</span>
              <strong>{{ Number(product.sales || 0).toLocaleString('zh-CN') }}</strong>
              <small>渠道累计出单件数</small>
            </div>
            <div class="detail-kpi-cell">
              <span>分销佣金</span>
              <strong>{{ formatRate(product.commissionRate) }}</strong>
              <small>{{ product.distributionEnabled === false ? '当前暂停渠道投放' : '已开启渠道分销' }}</small>
            </div>
          </div>
        </AgriVueDetailSection>

        <AgriVueDetailSection title="审核留痕" :flush="auditLogs.length > 0">
          <template #extra>
            <button
              v-if="auditLogs.length > 0"
              type="button"
              class="detail-section-link"
              @click="activeTab = 'auditLogs'"
            >
              查看全部 {{ auditLogs.length }} 条
            </button>
          </template>
          <el-table v-if="auditLogs.length" :data="auditLogs.slice(0, 5)" size="small">
            <el-table-column label="审核动作" width="110" align="center">
              <template #default="{ row }">
                <el-tag size="small" :type="resolveAuditStatus(row.action).elType">
                  {{ resolveAuditStatus(row.action).label }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="operator" label="操作人" width="140">
              <template #default="{ row }">{{ row.operator || '平台运营' }}</template>
            </el-table-column>
            <el-table-column prop="opinion" label="审核意见" min-width="220" show-overflow-tooltip>
              <template #default="{ row }">{{ row.opinion || '—' }}</template>
            </el-table-column>
            <el-table-column label="审核时间" width="175">
              <template #default="{ row }">
                <span class="detail-mono">{{ formatDateTime(row.createTime) }}</span>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="暂无审核留痕记录" :image-size="56" />
        </AgriVueDetailSection>
      </template>

      <template v-else-if="activeTab === 'pricing'">
        <AgriVueDetailSection title="价盘与佣金配置">
          <S2b2cDetailInfoGrid :items="pricingInfoItems" />
        </AgriVueDetailSection>

        <AgriVueDetailSection title="库存与履约保障">
          <S2b2cDetailInfoGrid :items="inventoryInfoItems" />
        </AgriVueDetailSection>
      </template>

      <template v-else-if="activeTab === 'distribution'">
        <AgriVueDetailSection title="分销投放与溯源绑定">
          <S2b2cDetailInfoGrid :items="distributionInfoItems" />
        </AgriVueDetailSection>

        <AgriVueDetailSection title="商品详情与溯源说明">
          <div class="detail-rich-copy">
            <p v-if="product.detail">{{ product.detail }}</p>
            <p v-if="product.traceabilityInfo" class="detail-rich-sub">
              <strong>溯源补充：</strong>{{ product.traceabilityInfo }}
            </p>
            <p v-if="!product.detail && !product.traceabilityInfo" class="muted">
              暂无补充图文描述或自定义溯源说明
            </p>
          </div>
        </AgriVueDetailSection>
      </template>

      <template v-else-if="activeTab === 'auditLogs'">
        <AgriVueDetailSection title="审核状态摘要">
          <S2b2cDetailInfoGrid :items="auditSummaryItems" />
        </AgriVueDetailSection>

        <AgriVueDetailSection title="审核操作日志" :flush="auditLogs.length > 0">
          <template #extra>
            <span class="muted">共 {{ auditLogs.length }} 条记录</span>
          </template>
          <el-table v-if="auditLogs.length" :data="auditLogs" size="small">
            <el-table-column label="审核动作" width="110" align="center">
              <template #default="{ row }">
                <el-tag size="small" :type="resolveAuditStatus(row.action).elType">
                  {{ resolveAuditStatus(row.action).label }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="operator" label="操作人" width="140">
              <template #default="{ row }">{{ row.operator || '平台运营' }}</template>
            </el-table-column>
            <el-table-column prop="opinion" label="审核意见" min-width="240">
              <template #default="{ row }">{{ row.opinion || '—' }}</template>
            </el-table-column>
            <el-table-column label="审核时间" width="175">
              <template #default="{ row }">
                <span class="detail-mono">{{ formatDateTime(row.createTime) }}</span>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="暂无审核操作日志" :image-size="56" />
        </AgriVueDetailSection>
      </template>

      <template #aside>
        <AgriVueDetailSection title="商品准入进度">
          <AgriVueDetailTimeline :items="timelineSteps" />
        </AgriVueDetailSection>

        <AgriVueDetailSection title="关联单据">
          <AgriVueDetailRelated :items="relatedDocs" />
        </AgriVueDetailSection>
      </template>
    </AgriVueDetailLayout>

    <div v-else-if="!loading" class="detail-empty-card">
      <el-empty description="商品档案不存在或无权查看">
        <el-button @click="router.push('/products')">返回商品审核</el-button>
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
  formatMoney,
  formatShortTime,
  resolveAuditStatus,
} from '../../../frontend-shared/detail/s2b2cDetailHelper'
import { platformApi } from '../api'

const router = useRouter()
const route = useRoute()

const loading = ref(true)
const auditing = ref(false)
const activeTab = ref('overview')
const product = ref(null)
const supplier = ref(null)
const auditLogs = ref([])

const isPending = computed(() => String(product.value?.status || '').toUpperCase() === 'PENDING')
const isLowStock = computed(() => {
  if (!product.value) return false
  const stock = Number(product.value.stock ?? 0)
  const warning = Number(product.value.stockWarning ?? 0)
  return warning > 0 && stock <= warning
})

function formatRate(val) {
  if (val === null || val === undefined || val === '') return '—'
  return `${Number(val).toFixed(2).replace(/\.00$/, '')}%`
}

async function loadProduct() {
  const id = route.params.id
  if (!id) return
  loading.value = true
  try {
    const [detail, logs] = await Promise.all([
      platformApi.getProductDetail(id),
      platformApi.getProductAuditLogs(id).catch(() => []),
    ])
    product.value = detail || null
    auditLogs.value = Array.isArray(logs) ? logs : []
    if (detail?.supplierId) {
      supplier.value = await platformApi.getSupplierDetail(detail.supplierId).catch(() => null)
    } else {
      supplier.value = null
    }
  } catch (e) {
    product.value = null
    supplier.value = null
    auditLogs.value = []
    ElMessage.error(e?.message || '商品详情读取失败')
  } finally {
    loading.value = false
  }
}

watch(
  () => route.params.id,
  () => {
    activeTab.value = 'overview'
    loadProduct()
  },
  { immediate: true },
)

const auditStatusBadge = computed(() => {
  const meta = resolveAuditStatus(product.value?.status)
  return { label: meta.label, tone: meta.tone }
})

const extraStatuses = computed(() => {
  const list = []
  if (product.value) {
    list.push(
      product.value.distributionEnabled === false
        ? { label: '暂停分销', tone: 'gray' }
        : { label: '允许分销', tone: 'blue' },
    )
    if (isLowStock.value) {
      list.push({ label: '库存预警', tone: 'orange' })
    }
  }
  return list
})

const supplierLabel = computed(() => {
  if (supplier.value?.companyName) return supplier.value.companyName
  if (supplier.value?.shopName) return supplier.value.shopName
  if (product.value?.supplierName) return product.value.supplierName
  if (product.value?.supplierId) return `货源档案 SUP-${product.value.supplierId}`
  return '—'
})

const headerMeta = computed(() => [
  { label: '供货商', value: supplierLabel.value },
  { label: '规格', value: [product.value?.spec, product.value?.unit].filter(Boolean).join(' / ') || '—' },
  { label: '创建时间', value: formatDateTime(product.value?.createTime) },
])

const tabs = computed(() => [
  { key: 'overview', label: '商品详情' },
  { key: 'pricing', label: '价格与库存' },
  { key: 'distribution', label: '分销与溯源' },
  { key: 'auditLogs', label: '审核记录', count: auditLogs.value.length },
])

const basicInfoItems = computed(() => [
  { key: 'id', label: '商品编号', value: `PRD-${product.value?.id}`, mono: true },
  { key: 'name', label: '商品名称', value: product.value?.name || '—' },
  { key: 'supplier', label: '所属货源', value: supplierLabel.value },
  { key: 'category', label: '所属类目', value: product.value?.categoryName || (product.value?.categoryId ? `CAT-${product.value.categoryId}` : '—'), mono: !product.value?.categoryName },
  { key: 'origin', label: '核心产地', value: product.value?.origin || '—' },
  { key: 'spec', label: '商品规格', value: [product.value?.spec, product.value?.unit].filter(Boolean).join(' / ') || '—' },
  { key: 'grade', label: '商品品级', value: product.value?.grade || '—' },
  { key: 'shelfLife', label: '保质期', value: product.value?.shelfLife || '—' },
  { key: 'sellingPoint', label: '核心卖点', value: product.value?.sellingPoint || '—', fullWidth: true },
  { key: 'certifications', label: '认证资质', value: product.value?.certifications || '—', fullWidth: true },
])

const pricingInfoItems = computed(() => [
  { key: 'price', label: '平台供货价', value: `¥${formatMoney(product.value?.price)}`, mono: true },
  { key: 'originalPrice', label: '划线原价', value: product.value?.originalPrice != null ? `¥${formatMoney(product.value.originalPrice)}` : '—', mono: true },
  { key: 'costPrice', label: '供货成本价', value: product.value?.costPrice != null ? `¥${formatMoney(product.value.costPrice)}` : '—', mono: true },
  { key: 'commissionRate', label: '分销佣金比例', value: formatRate(product.value?.commissionRate), mono: true },
  { key: 'minRetail', label: '渠道最低零售价', value: product.value?.minRetailPrice != null ? `¥${formatMoney(product.value.minRetailPrice)}` : '不限制', mono: true },
  { key: 'maxRetail', label: '渠道最高零售价', value: product.value?.maxRetailPrice != null ? `¥${formatMoney(product.value.maxRetailPrice)}` : '不限制', mono: true },
])

const inventoryInfoItems = computed(() => [
  { key: 'stock', label: '当前可用库存', value: `${Number(product.value?.stock || 0).toLocaleString('zh-CN')} ${product.value?.unit || '件'}`, mono: true },
  { key: 'stockWarning', label: '库存预警阈值', value: `${Number(product.value?.stockWarning || 0).toLocaleString('zh-CN')} ${product.value?.unit || '件'}`, mono: true },
  { key: 'stockHealth', label: '库存健康状态', value: isLowStock.value ? '低于预警线，需补货' : '库存充足' },
  { key: 'sales', label: '累计销量', value: `${Number(product.value?.sales || 0).toLocaleString('zh-CN')} ${product.value?.unit || '件'}`, mono: true },
  { key: 'deliveryTime', label: '发货与配送时效', value: product.value?.deliveryTime || '—' },
  { key: 'freightTemplate', label: '运费模板', value: product.value?.freightTemplate || '标准包邮 / 默认模板' },
])

const distributionInfoItems = computed(() => [
  { key: 'distEnabled', label: '渠道投放权限', value: product.value?.distributionEnabled === false ? '暂停投放' : '允许渠道选品投放' },
  { key: 'maxChannels', label: '最大授权渠道数', value: Number(product.value?.maxChannels || 0) > 0 ? `${product.value.maxChannels} 家` : '不限渠道数', mono: true },
  { key: 'prodBatchNo', label: '生产采收批次', value: product.value?.prodBatchNo || '未绑定', mono: Boolean(product.value?.prodBatchNo) },
  { key: 'supplierId', label: '货源档案号', value: product.value?.supplierId ? `SUP-${product.value.supplierId}` : '—', mono: true },
  { key: 'createTime', label: '建档时间', value: formatDateTime(product.value?.createTime), mono: true },
  { key: 'updateTime', label: '最近更新时间', value: formatDateTime(product.value?.updateTime), mono: true },
])

const auditSummaryItems = computed(() => [
  { key: 'status', label: '当前审核状态', value: resolveAuditStatus(product.value?.status).label },
  { key: 'auditTime', label: '最近审核时间', value: formatDateTime(product.value?.auditTime), mono: true },
  { key: 'createTime', label: '提交建档时间', value: formatDateTime(product.value?.createTime), mono: true },
  { key: 'logCount', label: '留痕条数', value: `${auditLogs.value.length} 条`, mono: true },
  { key: 'opinion', label: '最近审核意见', value: product.value?.auditOpinion || '—', fullWidth: true },
])

const timelineSteps = computed(() => {
  const status = String(product.value?.status || '').toUpperCase()
  const approved = status === 'APPROVED'
  const rejected = status === 'REJECTED'
  const distOpen = approved && product.value?.distributionEnabled !== false
  const hasSales = Number(product.value?.sales || 0) > 0

  return [
    {
      key: 'create',
      title: '商品提交建档',
      time: formatShortTime(product.value?.createTime) || '已建档',
      state: 'done',
    },
    {
      key: 'audit',
      title: approved ? '平台准入通过' : rejected ? '审核未通过' : '等待平台审核',
      time: approved || rejected ? (formatShortTime(product.value?.auditTime) || '已处理') : '当前节点',
      description: product.value?.auditOpinion || (approved ? '符合选品准入标准' : '待平台运营核验价格与资质'),
      state: approved ? 'done' : rejected ? 'error' : 'current',
    },
    {
      key: 'pool',
      title: distOpen ? '进入总部选品池' : approved ? '暂停渠道投放' : '总部选品池上架',
      time: distOpen ? '渠道可选品' : approved ? '已暂停' : '待处理',
      state: distOpen ? 'done' : approved ? 'current' : 'pending',
    },
    {
      key: 'sales',
      title: hasSales ? '渠道已形成动销' : '等待渠道首单',
      time: hasSales ? `累计售出 ${product.value.sales} ${product.value?.unit || '件'}` : distOpen ? '当前节点' : '待处理',
      state: hasSales ? 'done' : distOpen ? 'current' : 'pending',
    },
  ]
})

const relatedDocs = computed(() => [
  {
    key: 'supplier',
    label: '所属货源档案',
    code: product.value?.supplierId ? `SUP-${product.value.supplierId}` : '',
    emptyText: '未关联',
    onClick: product.value?.supplierId
      ? () => router.push(`/supplier-detail/${product.value.supplierId}`)
      : undefined,
  },
  {
    key: 'batch',
    label: '生产采收批次',
    code: product.value?.prodBatchNo || '',
    emptyText: '未绑定',
  },
  {
    key: 'pool',
    label: '总部选品池',
    text: '查看选品池列表',
    onClick: () => router.push('/product-pool'),
  },
  {
    key: 'price',
    label: '价格与价盘',
    text: '前往价盘管控',
    onClick: () => router.push('/price-center'),
  },
  {
    key: 'inventory',
    label: '库存与云仓',
    text: '查看库存水位',
    onClick: () => router.push('/inventory'),
  },
])

async function audit(status) {
  try {
    let opinion = ''
    if (status === 'REJECTED') {
      const result = await ElMessageBox.prompt('请输入拒绝审核原因', '拒绝商品审核', {
        confirmButtonText: '确认拒绝',
        cancelButtonText: '取消',
        inputPattern: /\S+/,
        inputErrorMessage: '拒绝商品必须填写原因',
      })
      opinion = result.value.trim()
    } else {
      await ElMessageBox.confirm('确认通过该商品的分销准入审核？', '审核通过', {
        confirmButtonText: '审核通过',
        cancelButtonText: '取消',
        type: 'warning',
      })
    }
    auditing.value = true
    const res = await platformApi.auditProduct({
      id: route.params.id,
      status,
      opinion,
    })
    if (res?.success === false) {
      ElMessage.error(res.message || '审核提交失败')
      return
    }
    ElMessage.success(res?.message || '审核已提交')
    await loadProduct()
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') {
      ElMessage.error(e?.message || '审核提交失败')
    }
  } finally {
    auditing.value = false
  }
}

function printPage() {
  window.print()
}
</script>

<style scoped>
.muted {
  color: #8c9a92;
  font-size: 12px;
}

.detail-rich-copy {
  font-size: 13px;
  line-height: 1.7;
  color: #1f2e26;
}

.detail-rich-copy p {
  margin: 0 0 8px;
}

.detail-rich-copy p:last-child {
  margin-bottom: 0;
}

.detail-rich-sub {
  padding-top: 8px;
  border-top: 1px dashed #e6ede9;
  color: #4f6358;
}

.detail-empty-card {
  padding: 48px 24px;
  border: 1px solid #e8ecea;
  border-radius: 10px;
  background: #fff;
}
</style>
