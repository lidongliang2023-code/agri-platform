<template>
  <div class="md-overview">
    <header class="page-head">
      <div>
        <h1>主数据总览</h1>
        <p>集中查看各数据域规模、治理状态和管理入口；具体维护统一在对应功能页完成。</p>
      </div>
      <div class="head-actions">
        <span>最近刷新 {{ lastUpdated || '—' }}</span>
        <button type="button" :disabled="loading" @click="loadAll">
          {{ loading ? '刷新中…' : '刷新数据' }}
        </button>
      </div>
    </header>

    <div v-if="loadErrors.length" class="error-banner">
      <strong>部分统计加载失败</strong>
      <span>{{ loadErrors.join('；') }}</span>
      <button type="button" aria-label="关闭提示" @click="loadErrors = []">×</button>
    </div>

    <section class="metric-grid" aria-label="主数据汇总指标">
      <div v-for="metric in summaryMetrics" :key="metric.label" class="metric-card">
        <span class="metric-icon">{{ metric.icon }}</span>
        <div>
          <small>{{ metric.label }}</small>
          <strong>{{ formatCount(metric.value) }}</strong>
          <p>{{ metric.hint }}</p>
        </div>
      </div>
    </section>

    <section class="asset-section">
      <div class="section-head">
        <div>
          <h2>数据域与功能入口</h2>
          <p>本页只提供汇总与导航，避免在总览页重复维护业务数据。</p>
        </div>
        <span class="source-badge">统一主数据 · 实时接口</span>
      </div>

      <div class="domain-groups">
        <article v-for="group in domainGroups" :key="group.key" class="domain-group">
          <div class="group-head">
            <h3>{{ group.title }}</h3>
            <p>{{ group.description }}</p>
          </div>
          <div class="domain-links">
            <router-link v-for="item in group.items" :key="item.label" :to="item.to" class="domain-link">
              <span class="domain-icon">{{ item.icon }}</span>
              <span class="domain-content">
                <b>{{ item.label }}</b>
                <small>{{ item.hint }}</small>
              </span>
              <strong>{{ formatCount(item.count) }}</strong>
              <span class="arrow">→</span>
            </router-link>
          </div>
        </article>
      </div>
    </section>

    <div class="lower-grid">
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>待处理事项</h2>
            <p>仅汇总需要运营介入的事项，处理请进入对应专页。</p>
          </div>
        </div>
        <div class="todo-list">
          <router-link v-for="item in todoItems" :key="item.label" :to="item.to" class="todo-item">
            <span class="todo-icon">{{ item.icon }}</span>
            <span>
              <b>{{ item.label }}</b>
              <small>{{ item.hint }}</small>
            </span>
            <strong :class="{ danger: item.danger && Number(item.value) > 0 }">
              {{ formatCount(item.value) }}
            </strong>
            <span class="arrow">→</span>
          </router-link>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>数据治理状态</h2>
            <p>质量问题、规则和分发任务的实时汇总。</p>
          </div>
          <router-link to="/quality/dashboard">质量仪表盘 →</router-link>
        </div>
        <div class="quality-grid">
          <div><span>问题总数</span><strong>{{ formatCount(quality.totalIssues) }}</strong></div>
          <div><span>待处理</span><strong class="danger">{{ formatCount(quality.pendingCount) }}</strong></div>
          <div><span>解决率</span><strong>{{ rate(quality.resolutionRate) }}</strong></div>
          <div><span>质量规则</span><strong>{{ formatCount(totals.qualityRules) }}</strong></div>
        </div>
        <div class="govern-links">
          <router-link to="/datastandard/dict">数据字典</router-link>
          <router-link to="/datastandard/code-rule">编码规则</router-link>
          <router-link to="/quality/rule">质量规则</router-link>
          <router-link to="/distribution/list">分发监控</router-link>
        </div>
      </section>
    </div>

    <section class="scope-note">
      <div>
        <h2>页面边界</h2>
        <p>主数据总览用于观察和跳转，不在本页直接新增、编辑或删除主体、用户、组织、商品及标准数据。</p>
      </div>
      <div class="scope-items">
        <span>统计只读</span>
        <span>唯一管理入口</span>
        <span>数据源实时读取</span>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import {
  getCodeRuleList,
  getCustomerList,
  getDictList,
  getDistributionStatistics,
  getOrgList,
  getPendingAudit,
  getProductList,
  getQualityRuleList,
  getQualityStatistics,
  getRoleList,
  getSupplierList,
  getTenantList,
  getUserList,
} from '@/utils/api'

const loading = ref(false)
const lastUpdated = ref('')
const loadErrors = ref([])

const totals = reactive({
  subjects: null,
  users: null,
  orgs: null,
  roles: null,
  products: null,
  customers: null,
  suppliers: null,
  dicts: null,
  codeRules: null,
  qualityRules: null,
})

const quality = reactive({
  totalIssues: null,
  pendingCount: null,
  highSeverityCount: null,
  resolutionRate: null,
})

const pending = reactive({
  userCertCount: null,
  orgCertCount: null,
  qualityIssueCount: null,
})

const distribution = reactive({
  totalTasks: null,
  failedCount: null,
  pendingCount: null,
})

const summaryMetrics = computed(() => [
  {
    icon: '🪪',
    label: '身份与主体',
    value: sum(totals.subjects, totals.users, totals.orgs),
    hint: '经营主体、统一用户与主体内组织',
  },
  {
    icon: '📦',
    label: '业务主数据',
    value: sum(totals.products, totals.customers, totals.suppliers),
    hint: '商品、客户与供应商档案',
  },
  {
    icon: '📐',
    label: '标准与权限',
    value: sum(totals.roles, totals.dicts, totals.codeRules),
    hint: '角色、数据字典与编码规则',
  },
  {
    icon: '⚠️',
    label: '待处理事项',
    value: sum(pending.userCertCount, quality.pendingCount ?? pending.qualityIssueCount, distribution.failedCount),
    hint: '认证、质量问题与分发失败',
  },
])

const domainGroups = computed(() => [
  {
    key: 'identity',
    title: '身份与主体',
    description: '统一账号、经营主体与主体内部组织。',
    items: [
      { icon: '🏢', label: '企业与个人主体', hint: '经营主体主档', count: totals.subjects, to: '/subject/list' },
      { icon: '👤', label: '统一用户', hint: '账号与主体成员关系', count: totals.users, to: '/user/list' },
      { icon: '🏠', label: '主体内组织', hint: '部门、团队与生产单位', count: totals.orgs, to: '/org/list' },
    ],
  },
  {
    key: 'standards',
    title: '标准与权限',
    description: '统一规则、字典和角色权限。',
    items: [
      { icon: '🔐', label: '角色管理', hint: '运营角色与数据范围', count: totals.roles, to: '/permission/role' },
      { icon: '📚', label: '数据字典', hint: '统一枚举与业务口径', count: totals.dicts, to: '/datastandard/dict' },
      { icon: '🔢', label: '编码规则', hint: '业务编码生成规则', count: totals.codeRules, to: '/datastandard/code-rule' },
    ],
  },
  {
    key: 'business',
    title: '业务主数据',
    description: '商品、客户和供应商共享主档。',
    items: [
      { icon: '🛒', label: '商品管理', hint: '商品与 SKU', count: totals.products, to: '/product/list' },
      { icon: '🤝', label: '客户管理', hint: '客户档案', count: totals.customers, to: '/customer/list' },
      { icon: '🏭', label: '供应商管理', hint: '供应商档案', count: totals.suppliers, to: '/supplier/list' },
    ],
  },
  {
    key: 'governance',
    title: '数据治理',
    description: '质量监控、问题处置与数据分发。',
    items: [
      { icon: '🛡️', label: '质量问题', hint: '检测与处置工单', count: quality.totalIssues, to: '/quality/list' },
      { icon: '✅', label: '质量规则', hint: '校验规则配置', count: totals.qualityRules, to: '/quality/rule' },
      { icon: '🔁', label: '数据分发', hint: '跨系统分发任务', count: distribution.totalTasks, to: '/distribution/list' },
    ],
  },
])

const todoItems = computed(() => [
  {
    icon: '🪪',
    label: '主体与个人认证',
    hint: '待审核的统一认证申请',
    value: pending.userCertCount,
    to: '/user/audit',
    danger: true,
  },
  {
    icon: '⚠️',
    label: '质量问题',
    hint: '待处理的数据质量问题',
    value: quality.pendingCount,
    to: '/quality/list',
    danger: true,
  },
  {
    icon: '🔁',
    label: '分发失败',
    hint: '需要重试的数据分发任务',
    value: distribution.failedCount,
    to: '/distribution/list',
    danger: true,
  },
])

const sum = (...values) => {
  const available = values.filter((value) => value !== null && value !== undefined)
  return available.length ? available.reduce((total, value) => total + Number(value || 0), 0) : null
}

const formatCount = (value) => value === null || value === undefined
  ? '—'
  : Number(value).toLocaleString('zh-CN')

const rate = (value) => value === null || value === undefined ? '—' : `${Number(value).toFixed(1)}%`

const unwrapPage = (response, label) => {
  if (!response || response.code !== 200) {
    throw new Error(response?.message || `${label}接口返回异常`)
  }
  const payload = response.data ?? {}
  const rows = Array.isArray(payload) ? payload : (payload.list ?? payload.records ?? [])
  return Number(payload.total ?? rows.length) || 0
}

const capture = async (label, task) => {
  try {
    await task()
  } catch (error) {
    loadErrors.value.push(`${label}：${error instanceof Error ? error.message : '加载失败'}`)
  }
}

const loadAll = async () => {
  loading.value = true
  loadErrors.value = []
  await Promise.all([
    capture('经营主体', async () => {
      totals.subjects = unwrapPage(await getTenantList({ pageNum: 1, pageSize: 1 }), '经营主体')
    }),
    capture('统一用户', async () => {
      totals.users = unwrapPage(await getUserList({ pageNum: 1, pageSize: 1 }), '统一用户')
    }),
    capture('主体内组织', async () => {
      totals.orgs = unwrapPage(await getOrgList({ pageNum: 1, pageSize: 1 }), '主体内组织')
    }),
    capture('角色', async () => {
      totals.roles = unwrapPage(await getRoleList({ pageNum: 1, pageSize: 1 }), '角色')
    }),
    capture('商品', async () => {
      totals.products = unwrapPage(await getProductList({ pageNum: 1, pageSize: 1 }), '商品')
    }),
    capture('客户', async () => {
      totals.customers = unwrapPage(await getCustomerList({ pageNum: 1, pageSize: 1 }), '客户')
    }),
    capture('供应商', async () => {
      totals.suppliers = unwrapPage(await getSupplierList({ pageNum: 1, pageSize: 1 }), '供应商')
    }),
    capture('数据字典', async () => {
      totals.dicts = unwrapPage(await getDictList({ pageNum: 1, pageSize: 1 }), '数据字典')
    }),
    capture('编码规则', async () => {
      totals.codeRules = unwrapPage(await getCodeRuleList({ pageNum: 1, pageSize: 1 }), '编码规则')
    }),
    capture('质量规则', async () => {
      totals.qualityRules = unwrapPage(await getQualityRuleList({ pageNum: 1, pageSize: 1 }), '质量规则')
    }),
    capture('质量统计', async () => {
      const response = await getQualityStatistics()
      if (!response || response.code !== 200) throw new Error(response?.message || '接口返回异常')
      const data = response.data ?? {}
      quality.totalIssues = data.totalIssues ?? null
      quality.pendingCount = data.pendingCount ?? null
      quality.highSeverityCount = data.highSeverityCount ?? null
      quality.resolutionRate = data.resolutionRate ?? null
    }),
    capture('待审核事项', async () => {
      const response = await getPendingAudit()
      if (!response || response.code !== 200) throw new Error(response?.message || '接口返回异常')
      const data = response.data ?? {}
      pending.userCertCount = data.userCertCount ?? null
      pending.orgCertCount = data.orgCertCount ?? null
      pending.qualityIssueCount = data.qualityIssueCount ?? null
    }),
    capture('数据分发', async () => {
      const response = await getDistributionStatistics()
      if (!response || response.code !== 200) throw new Error(response?.message || '接口返回异常')
      const data = response.data ?? {}
      distribution.totalTasks = data.totalTasks ?? null
      distribution.failedCount = data.failedTasks ?? data.failedCount ?? null
      distribution.pendingCount = data.pendingTasks ?? data.pendingCount ?? null
    }),
  ])
  lastUpdated.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  loading.value = false
}

onMounted(loadAll)
</script>

<style scoped>
.md-overview {
  padding: 20px;
  color: #17231c;
}

.page-head,
.section-head,
.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.page-head {
  margin-bottom: 18px;
}

.page-head h1,
.section-head h2,
.panel-head h2,
.scope-note h2 {
  margin: 0;
  color: #13291d;
}

.page-head h1 {
  font-size: 24px;
}

.page-head p,
.section-head p,
.panel-head p,
.scope-note p {
  margin: 6px 0 0;
  color: #718078;
  font-size: 13px;
  line-height: 1.6;
}

.head-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.head-actions > span {
  color: #93a29a;
  font-size: 12px;
}

.head-actions button {
  padding: 8px 15px;
  border: 1px solid #cfdcd4;
  border-radius: 8px;
  background: #fff;
  color: #12764a;
  font-weight: 600;
  cursor: pointer;
}

.head-actions button:disabled {
  opacity: .55;
  cursor: wait;
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px 14px;
  border: 1px solid #f5c2c0;
  border-radius: 10px;
  background: #fff5f5;
  color: #b42318;
  font-size: 12.5px;
}

.error-banner span {
  flex: 1;
}

.error-banner button {
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 18px;
  cursor: pointer;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}

.metric-card {
  display: flex;
  gap: 14px;
  padding: 17px;
  border: 1px solid #e3eae5;
  border-radius: 12px;
  background: #fff;
}

.metric-icon {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  flex: none;
  border-radius: 11px;
  background: #ecfdf3;
  font-size: 20px;
}

.metric-card small {
  display: block;
  color: #6f8076;
  font-size: 12px;
}

.metric-card strong {
  display: block;
  margin-top: 4px;
  color: #0f5a37;
  font-size: 25px;
  line-height: 1.15;
}

.metric-card p {
  margin: 5px 0 0;
  color: #93a29a;
  font-size: var(--agri-font-size-micro);
}

.asset-section,
.panel,
.scope-note {
  padding: 18px;
  border: 1px solid #e3eae5;
  border-radius: 12px;
  background: #fff;
}

.asset-section {
  margin-bottom: 18px;
}

.source-badge {
  padding: 6px 10px;
  border-radius: 999px;
  background: #ecfdf3;
  color: #087844;
  font-size: var(--agri-font-size-micro);
  white-space: nowrap;
}

.domain-groups {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 18px;
}

.domain-group {
  padding: 15px;
  border: 1px solid #edf1ee;
  border-radius: 10px;
  background: #fbfdfb;
}

.group-head h3 {
  margin: 0;
  color: #21382b;
  font-size: 15px;
}

.group-head p {
  margin: 5px 0 12px;
  color: #91a097;
  font-size: 12px;
}

.domain-links {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.domain-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid #e8eee9;
  border-radius: 9px;
  background: #fff;
  color: inherit;
  text-decoration: none;
  transition: border-color .15s, transform .15s;
}

.domain-link:hover {
  border-color: #9fd6b9;
  transform: translateY(-1px);
}

.domain-icon,
.todo-icon {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  flex: none;
  border-radius: 8px;
  background: #f2f8f4;
}

.domain-content {
  min-width: 0;
  flex: 1;
}

.domain-content b,
.domain-content small {
  display: block;
}

.domain-content b {
  color: #20372a;
  font-size: 13px;
}

.domain-content small {
  margin-top: 2px;
  overflow: hidden;
  color: #94a199;
  font-size: var(--agri-font-size-micro);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.domain-link > strong {
  color: #0f7245;
  font-size: 16px;
}

.arrow {
  color: #a8b4ad;
}

.lower-grid {
  display: grid;
  grid-template-columns: 1.1fr .9fr;
  gap: 14px;
  margin-bottom: 18px;
}

.panel-head a {
  color: #0f8050;
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
}

.todo-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
  margin-top: 15px;
}

.todo-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px;
  border: 1px solid #edf1ee;
  border-radius: 9px;
  color: inherit;
  text-decoration: none;
}

.todo-item > span:nth-child(2) {
  flex: 1;
}

.todo-item b,
.todo-item small {
  display: block;
}

.todo-item b {
  color: #263b2e;
  font-size: 13px;
}

.todo-item small {
  margin-top: 2px;
  color: #96a299;
  font-size: var(--agri-font-size-micro);
}

.todo-item > strong {
  color: #41554a;
  font-size: 18px;
}

.danger {
  color: #d14343 !important;
}

.quality-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 15px;
}

.quality-grid div {
  padding: 13px;
  border-radius: 9px;
  background: #f7faf8;
}

.quality-grid span,
.quality-grid strong {
  display: block;
}

.quality-grid span {
  color: #829188;
  font-size: var(--agri-font-size-micro);
}

.quality-grid strong {
  margin-top: 5px;
  color: #173d29;
  font-size: 20px;
}

.govern-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.govern-links a {
  padding: 6px 10px;
  border: 1px solid #dbe7df;
  border-radius: 999px;
  background: #fff;
  color: #28714e;
  font-size: var(--agri-font-size-micro);
  text-decoration: none;
}

.scope-note {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  background: linear-gradient(120deg, #f8fcf9, #f2f9ff);
}

.scope-items {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.scope-items span {
  padding: 6px 10px;
  border-radius: 999px;
  background: #fff;
  color: #567064;
  font-size: var(--agri-font-size-micro);
  box-shadow: 0 1px 2px rgba(20, 52, 34, .06);
}

@media (max-width: 1000px) {
  .metric-grid,
  .domain-groups,
  .lower-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .lower-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .page-head,
  .section-head,
  .scope-note {
    flex-direction: column;
  }
  .head-actions {
    width: 100%;
    justify-content: space-between;
  }
  .metric-grid,
  .domain-groups {
    grid-template-columns: 1fr;
  }
}
</style>
