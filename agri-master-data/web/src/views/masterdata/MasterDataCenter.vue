<template>
  <div class="md-center">
    <div class="md-page-head">
      <div>
        <h1>主数据运营中心</h1>
        <p>统一用户、权限、商品、客户供应商与数据治理</p>
      </div>
      <div class="md-head-actions">
        <span class="md-refresh-time">最近刷新 {{ lastUpdated || '—' }}</span>
        <button class="md-btn md-btn-outline" :disabled="loading" @click="loadAll">
          {{ loading ? '刷新中…' : '刷新数据' }}
        </button>
      </div>
    </div>

    <div v-if="loadErrors.length" class="md-error">
      <b>部分数据加载失败</b>
      <span>{{ loadErrors.slice(0, 3).join('；') }}</span>
      <button class="md-error-close" type="button" @click="loadErrors = []">×</button>
    </div>

    <div class="md-stat-grid">
      <div v-for="card in summaryCards" :key="card.label" class="md-stat-card">
        <div class="md-stat-top">
          <span class="md-stat-icon">{{ card.icon }}</span>
          <span>{{ card.label }}</span>
        </div>
        <strong>{{ card.value }}</strong>
        <small>{{ card.hint }}</small>
      </div>
    </div>

    <div class="md-workbench">
      <div class="md-tabs" role="tablist">
        <button
          v-for="tab in TABS"
          :key="tab.key"
          type="button"
          class="md-tab"
          :class="{ on: activeTab === tab.key }"
          role="tab"
          :aria-selected="activeTab === tab.key"
          @click="setTab(tab.key)"
        >
          {{ tab.label }}
        </button>
      </div>

      <div class="md-workbench-body">
        <section v-if="activeTab === 'users'" class="md-panel">
          <div class="md-toolbar">
            <div class="md-search">
              <input
                v-model="filters.userKeyword"
                placeholder="搜索用户名 / 手机号"
                @keyup.enter="searchUsers"
              />
              <button type="button" @click="searchUsers">搜索</button>
            </div>
            <select v-model="filters.userType" class="md-select" @change="searchUsers">
              <option value="">全部用户类型</option>
              <option value="enterprise">企业用户</option>
              <option value="individual">个人用户</option>
            </select>
            <select v-model="filters.userStatus" class="md-select" @change="searchUsers">
              <option value="">全部状态</option>
              <option value="active">正常</option>
              <option value="inactive">禁用</option>
            </select>
            <select v-model="filters.realNameStatus" class="md-select" @change="searchUsers">
              <option value="">全部实名状态</option>
              <option value="verified">已认证</option>
              <option value="pending">审核中</option>
              <option value="unverified">未认证</option>
            </select>
            <span class="md-spacer" />
            <router-link class="md-link" to="/user/list">进入用户管理 →</router-link>
          </div>
          <div class="md-table-wrap">
            <table class="md-table">
              <thead>
                <tr>
                  <th>用户编码</th><th>用户名</th><th>姓名</th><th>手机号</th>
                  <th>用户类型</th><th>实名状态</th><th>状态</th><th>创建时间</th><th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!loading && data.users.rows.length === 0">
                  <td colspan="9"><div class="md-empty-inline">暂无用户数据</div></td>
                </tr>
                <tr v-for="user in data.users.rows" :key="user.id">
                  <td class="mono">{{ user.userCode || '—' }}</td>
                  <td>{{ user.username || '—' }}</td>
                  <td>{{ user.realName || '—' }}</td>
                  <td class="mono">{{ maskPhone(user.phone) }}</td>
                  <td><span class="md-badge">{{ userTypeLabel(user.userType) }}</span></td>
                  <td><span class="md-badge" :class="realNameStatusClass(user.realNameStatus)">{{ realNameStatusLabel(user.realNameStatus) }}</span></td>
                  <td><span class="md-badge" :class="userStatusClass(user.userStatus)">{{ userStatusLabel(user.userStatus) }}</span></td>
                  <td class="mono">{{ formatDate(user.createTime) }}</td>
                  <td class="md-actions">
                    <router-link :to="`/user/detail/${user.id}`">详情</router-link>
                    <router-link to="/user/list">管理</router-link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="md-pager">
            <span>共 {{ formatCount(totals.users) }} 条</span>
            <button type="button" :disabled="pages.users <= 1" @click="changePage('users', -1)">上一页</button>
            <span>第 {{ pages.users }} / {{ pageCount('users') }} 页</span>
            <button type="button" :disabled="pages.users >= pageCount('users')" @click="changePage('users', 1)">下一页</button>
          </div>
        </section>

        <section v-if="activeTab === 'roles'" class="md-panel">
          <div class="md-toolbar">
            <div class="md-search">
              <input v-model="filters.roleKeyword" placeholder="搜索角色名称" @keyup.enter="searchRoles" />
              <button type="button" @click="searchRoles">搜索</button>
            </div>
            <span class="md-spacer" />
            <router-link class="md-link" to="/permission/role">进入角色管理 →</router-link>
          </div>
          <div class="md-table-wrap">
            <table class="md-table">
              <thead><tr><th>角色编码</th><th>角色名称</th><th>角色标识</th><th>数据范围</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-if="!loading && data.roles.rows.length === 0"><td colspan="7"><div class="md-empty-inline">暂无角色数据</div></td></tr>
                <tr v-for="role in data.roles.rows" :key="role.id">
                  <td class="mono">{{ role.roleCode || '—' }}</td>
                  <td>{{ role.roleName || '—' }}</td>
                  <td class="mono">{{ role.roleKey || '—' }}</td>
                  <td>{{ dataScopeLabel(role.dataScope) }}</td>
                  <td><span class="md-badge" :class="Number(role.status) === 1 ? 'ok' : 'off'">{{ Number(role.status) === 1 ? '启用' : '禁用' }}</span></td>
                  <td class="mono">{{ formatDate(role.createTime) }}</td>
                  <td class="md-actions"><router-link to="/permission/role">配置权限</router-link></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="md-pager">
            <span>共 {{ formatCount(totals.roles) }} 条</span>
            <button type="button" :disabled="pages.roles <= 1" @click="changePage('roles', -1)">上一页</button>
            <span>第 {{ pages.roles }} / {{ pageCount('roles') }} 页</span>
            <button type="button" :disabled="pages.roles >= pageCount('roles')" @click="changePage('roles', 1)">下一页</button>
          </div>
        </section>

        <section v-if="activeTab === 'goods'" class="md-panel">
          <div class="md-toolbar">
            <div class="md-search">
              <input v-model="filters.productKeyword" placeholder="搜索商品名称 / 商品编码" @keyup.enter="searchProducts" />
              <button type="button" @click="searchProducts">搜索</button>
            </div>
            <select v-model="filters.productStatus" class="md-select" @change="searchProducts">
              <option value="">全部状态</option>
              <option value="1">正常</option>
              <option value="0">禁用</option>
            </select>
            <span class="md-spacer" />
            <router-link class="md-link" to="/product/catalog">商品与分类 →</router-link>
            <router-link class="md-link" to="/product/list">商品管理 →</router-link>
          </div>
          <div class="md-table-wrap">
            <table class="md-table">
              <thead><tr><th>商品编码</th><th>商品名称</th><th>分类</th><th>单位</th><th>品牌</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-if="!loading && data.products.rows.length === 0"><td colspan="8"><div class="md-empty-inline">暂无商品数据</div></td></tr>
                <tr v-for="product in data.products.rows" :key="product.id">
                  <td class="mono">{{ product.productCode || '—' }}</td>
                  <td>{{ product.productName || '—' }}</td>
                  <td>{{ product.categoryName || '—' }}</td>
                  <td>{{ unitLabel(product.unit) }}</td>
                  <td>{{ product.brand || '—' }}</td>
                  <td><span class="md-badge" :class="Number(product.status) === 1 ? 'ok' : 'off'">{{ Number(product.status) === 1 ? '正常' : '禁用' }}</span></td>
                  <td class="mono">{{ formatDate(product.createTime) }}</td>
                  <td class="md-actions"><router-link to="/product/list">查看</router-link></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="md-pager">
            <span>共 {{ formatCount(totals.products) }} 条</span>
            <button type="button" :disabled="pages.products <= 1" @click="changePage('products', -1)">上一页</button>
            <span>第 {{ pages.products }} / {{ pageCount('products') }} 页</span>
            <button type="button" :disabled="pages.products >= pageCount('products')" @click="changePage('products', 1)">下一页</button>
          </div>
        </section>

        <section v-if="activeTab === 'partners'" class="md-panel">
          <div class="md-partner-grid">
            <div class="md-partner-panel">
              <div class="md-toolbar">
                <div class="md-search">
                  <input v-model="filters.customerKeyword" placeholder="搜索客户名称 / 客户编码" @keyup.enter="searchCustomers" />
                  <button type="button" @click="searchCustomers">搜索</button>
                </div>
                <span class="md-spacer" />
                <router-link class="md-link" to="/customer/list">客户管理 →</router-link>
              </div>
              <div class="md-subhead"><b>客户主数据</b><span>共 {{ formatCount(totals.customers) }} 条</span></div>
              <div class="md-table-wrap">
                <table class="md-table">
                  <thead><tr><th>客户编码</th><th>客户名称</th><th>类型</th><th>联系人</th><th>状态</th></tr></thead>
                  <tbody>
                    <tr v-if="!loading && data.customers.rows.length === 0"><td colspan="5"><div class="md-empty-inline">暂无客户数据</div></td></tr>
                    <tr v-for="customer in data.customers.rows" :key="customer.id">
                      <td class="mono">{{ customer.customerCode || '—' }}</td>
                      <td>{{ customer.customerName || '—' }}</td>
                      <td>{{ customer.customerType === 'enterprise' ? '企业' : '个人' }}</td>
                      <td>{{ customer.contactName || '—' }}</td>
                      <td><span class="md-badge" :class="Number(customer.status) === 1 ? 'ok' : 'off'">{{ Number(customer.status) === 1 ? '正常' : '禁用' }}</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div class="md-partner-panel">
              <div class="md-toolbar">
                <div class="md-search">
                  <input v-model="filters.supplierKeyword" placeholder="搜索供应商名称 / 供应商编码" @keyup.enter="searchSuppliers" />
                  <button type="button" @click="searchSuppliers">搜索</button>
                </div>
                <span class="md-spacer" />
                <router-link class="md-link" to="/supplier/list">供应商管理 →</router-link>
              </div>
              <div class="md-subhead"><b>供应商主数据</b><span>共 {{ formatCount(totals.suppliers) }} 条</span></div>
              <div class="md-table-wrap">
                <table class="md-table">
                  <thead><tr><th>供应商编码</th><th>供应商名称</th><th>类型</th><th>联系人</th><th>状态</th></tr></thead>
                  <tbody>
                    <tr v-if="!loading && data.suppliers.rows.length === 0"><td colspan="5"><div class="md-empty-inline">暂无供应商数据</div></td></tr>
                    <tr v-for="supplier in data.suppliers.rows" :key="supplier.id">
                      <td class="mono">{{ supplier.supplierCode || '—' }}</td>
                      <td>{{ supplier.supplierName || '—' }}</td>
                      <td>{{ supplierTypeLabel(supplier.supplierType) }}</td>
                      <td>{{ supplier.contactPerson || '—' }}</td>
                      <td><span class="md-badge" :class="Number(supplier.status) === 1 ? 'ok' : 'off'">{{ Number(supplier.status) === 1 ? '正常' : '禁用' }}</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div class="md-pager">
            <button type="button" :disabled="pages.customers <= 1" @click="changePartnerPage('customers', -1)">客户上一页</button>
            <button type="button" :disabled="pages.customers >= pageCount('customers')" @click="changePartnerPage('customers', 1)">客户下一页</button>
            <button type="button" :disabled="pages.suppliers <= 1" @click="changePartnerPage('suppliers', -1)">供应商上一页</button>
            <button type="button" :disabled="pages.suppliers >= pageCount('suppliers')" @click="changePartnerPage('suppliers', 1)">供应商下一页</button>
          </div>
        </section>

        <section v-if="activeTab === 'govern'" class="md-panel">
          <div class="md-govern-cards">
            <router-link class="md-govern-card" to="/datastandard/dict">
              <span>📚</span><div><b>数据字典</b><strong>{{ formatCount(totals.dicts) }}</strong><small>统一编码与字典项</small></div>
            </router-link>
            <router-link class="md-govern-card" to="/datastandard/code-rule">
              <span>🔢</span><div><b>编码规则</b><strong>{{ formatCount(totals.codeRules) }}</strong><small>业务编码生成规则</small></div>
            </router-link>
            <router-link class="md-govern-card" to="/quality/rule">
              <span>🛡️</span><div><b>质量规则</b><strong>{{ formatCount(totals.qualityRules) }}</strong><small>数据校验规则</small></div>
            </router-link>
          </div>
          <div class="md-toolbar">
            <div class="md-search">
              <input v-model="filters.governKeyword" placeholder="搜索标准 / 规则 / 字典名称" />
            </div>
            <span class="md-spacer" />
            <router-link class="md-link" to="/datastandard/dict">数据标准 →</router-link>
            <router-link class="md-link" to="/quality/dashboard">质量监控 →</router-link>
          </div>
          <div class="md-table-wrap">
            <table class="md-table">
              <thead><tr><th>名称</th><th>类型</th><th>编码</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-if="governanceRows.length === 0"><td colspan="6"><div class="md-empty-inline">暂无数据标准或编码规则</div></td></tr>
                <tr v-for="row in governanceRows" :key="row.key">
                  <td>{{ row.name }}</td>
                  <td><span class="md-badge info">{{ row.type }}</span></td>
                  <td class="mono">{{ row.code || '—' }}</td>
                  <td><span class="md-badge" :class="Number(row.status) === 1 ? 'ok' : 'off'">{{ Number(row.status) === 1 ? '启用' : '禁用' }}</span></td>
                  <td class="mono">{{ formatDate(row.createTime) }}</td>
                  <td class="md-actions"><router-link :to="row.to">管理</router-link></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section v-if="activeTab === 'overview'" class="md-panel">
          <div class="md-overview-kpis">
            <div><span>主数据条目总量</span><b>{{ formatCount(totalEntries) }}</b><small>按当前已接入数据域汇总</small></div>
            <div><span>统一用户</span><b>{{ formatCount(totals.users) }}</b><small>用户与认证主体</small></div>
            <div><span>商品主数据</span><b>{{ formatCount(totals.products) }}</b><small>商品与品类</small></div>
            <div><span>质量问题</span><b>{{ formatCount(quality.totalIssues) }}</b><small>待治理与已解决合计</small></div>
          </div>
          <div class="md-overview-grid">
            <div class="md-card">
              <div class="md-card-head"><h3>主数据资产分布</h3><span>当前接口口径</span></div>
              <div class="md-distribution">
                <div v-for="item in modelDistribution" :key="item.label">
                  <div class="md-distribution-label"><span>{{ item.label }}</span><b class="mono">{{ formatCount(item.count) }}</b></div>
                  <div class="md-progress"><i :style="{ width: item.percent + '%' }" /></div>
                </div>
              </div>
            </div>
            <div class="md-card">
              <div class="md-card-head"><h3>数据质量概览</h3><router-link to="/quality/dashboard">查看全部 →</router-link></div>
              <div class="md-quality-mini">
                <div><span>问题总数</span><b>{{ formatCount(quality.totalIssues) }}</b></div>
                <div><span>严重问题</span><b class="danger">{{ formatCount(quality.highSeverityCount) }}</b></div>
                <div><span>解决率</span><b>{{ quality.resolutionRate == null ? '—' : quality.resolutionRate + '%' }}</b></div>
                <div><span>质量规则</span><b>{{ formatCount(totals.qualityRules) }}</b></div>
              </div>
              <div class="md-source-note">
                <b>数据源采集池</b>
                <p>采集源与同步频率接口尚未接入，不展示推算数字。</p>
                <button type="button" class="md-link-button" @click="setTab('sources')">查看接入说明 →</button>
              </div>
            </div>
          </div>
        </section>

        <section v-if="activeTab === 'models'" class="md-panel">
          <div class="md-note">
            下列模型目录由当前已接入的数据域生成。模型字段、版本与关系接口尚未接入，因此只展示真实条目数，不展示示例版本号。
          </div>
          <div class="md-table-wrap">
            <table class="md-table">
              <thead><tr><th>模型名</th><th>模型编码</th><th>数据域</th><th>条目数</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="model in modelRows" :key="model.code">
                  <td>{{ model.name }}</td>
                  <td class="mono">{{ model.code }}</td>
                  <td><span class="md-badge info">{{ model.domain }}</span></td>
                  <td class="mono">{{ formatCount(model.count) }}</td>
                  <td><span class="md-badge">目录只读</span></td>
                  <td class="md-actions"><router-link :to="model.to">查看数据</router-link></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section v-if="activeTab === 'sources'" class="md-panel">
          <div class="md-empty-card">
            <div class="md-empty-icon">🔌</div>
            <h3>数据源采集池尚未接入</h3>
            <p>后端目前没有采集源、同步任务、成功率和延迟接口。本页不使用示例数字填充，以免把演示数据误认为真实运行状态。</p>
            <div class="md-plan-chips">
              <span>平台注册 API · 待接入</span>
              <span>企业信用同步 · 待接入</span>
              <span>生产 MQTT · 待接入</span>
              <span>Excel 导入 · 待接入</span>
            </div>
            <div class="md-empty-actions">
              <router-link class="md-btn md-btn-primary" to="/distribution/list">查看已接入的数据分发监控</router-link>
              <router-link class="md-btn md-btn-outline" to="/datastandard/dict">查看数据标准</router-link>
            </div>
          </div>
        </section>

        <section v-if="activeTab === 'quality'" class="md-panel">
          <div class="md-quality-stats">
            <div><span>问题总数</span><b>{{ formatCount(quality.totalIssues) }}</b></div>
            <div><span>严重问题</span><b class="danger">{{ formatCount(quality.highSeverityCount) }}</b></div>
            <div><span>警告问题</span><b class="warn">{{ formatCount(quality.mediumSeverityCount) }}</b></div>
            <div><span>解决率</span><b>{{ quality.resolutionRate == null ? '—' : quality.resolutionRate + '%' }}</b></div>
          </div>
          <div class="md-toolbar">
            <span class="md-spacer" />
            <router-link class="md-link" to="/quality/dashboard">质量仪表盘 →</router-link>
            <router-link class="md-link" to="/quality/list">质量监控 →</router-link>
            <router-link class="md-link" to="/quality/rule">规则配置 →</router-link>
          </div>
          <div class="md-table-wrap">
            <table class="md-table">
              <thead><tr><th>问题编码</th><th>级别</th><th>类型</th><th>问题描述</th><th>状态</th><th>检测时间</th></tr></thead>
              <tbody>
                <tr v-if="!loading && data.qualityIssues.rows.length === 0"><td colspan="6"><div class="md-empty-inline">暂无质量问题数据</div></td></tr>
                <tr v-for="issue in data.qualityIssues.rows" :key="issue.id">
                  <td class="mono">{{ issue.issueCode || '—' }}</td>
                  <td><span class="md-badge" :class="severityClass(issue.severity)">{{ severityLabel(issue.severity) }}</span></td>
                  <td>{{ issueTypeLabel(issue.issueType) }}</td>
                  <td class="md-desc">{{ issue.description || '—' }}</td>
                  <td>{{ issueStatusLabel(issue.status) }}</td>
                  <td class="mono">{{ formatDate(issue.detectTime || issue.createTime) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getCodeRuleList,
  getCustomerList,
  getDashboard,
  getDictList,
  getProductList,
  getQualityList,
  getQualityRuleList,
  getQualityStatistics,
  getRoleList,
  getSupplierList,
  getUserList,
} from '@/utils/api'

const TABS = [
  { key: 'users', label: '统一用户' },
  { key: 'roles', label: '统一权限' },
  { key: 'goods', label: '统一商品' },
  { key: 'partners', label: '客户 / 供应商' },
  { key: 'govern', label: '数据治理' },
  { key: 'overview', label: '主数据运营大盘' },
  { key: 'models', label: '主数据模型' },
  { key: 'sources', label: '数据源采集池' },
  { key: 'quality', label: '数据质量监控' },
]

const route = useRoute()
const router = useRouter()
const PAGE_SIZE = 8

const activeTab = ref(TABS.some((tab) => tab.key === route.query.tab) ? String(route.query.tab) : 'users')
const loading = ref(true)
const loadErrors = ref([])
const lastUpdated = ref('')

const filters = reactive({
  userKeyword: '',
  userType: '',
  userStatus: '',
  realNameStatus: '',
  roleKeyword: '',
  productKeyword: '',
  productStatus: '',
  customerKeyword: '',
  supplierKeyword: '',
  governKeyword: '',
})

const pages = reactive({
  users: 1,
  roles: 1,
  products: 1,
  customers: 1,
  suppliers: 1,
})

const totals = reactive({
  users: null,
  roles: null,
  products: null,
  customers: null,
  suppliers: null,
  dicts: null,
  codeRules: null,
  qualityRules: null,
  tenants: null,
  orgs: null,
})

const data = reactive({
  users: { rows: [] },
  roles: { rows: [] },
  products: { rows: [] },
  customers: { rows: [] },
  suppliers: { rows: [] },
  dicts: { rows: [] },
  codeRules: { rows: [] },
  qualityIssues: { rows: [] },
  qualityRules: { rows: [] },
})

const quality = reactive({
  totalIssues: null,
  highSeverityCount: null,
  mediumSeverityCount: null,
  resolutionRate: null,
})

const summaryCards = computed(() => [
  { icon: '👥', label: '用户总数', value: formatCount(totals.users), hint: '统一用户主数据' },
  { icon: '🔐', label: '角色数', value: formatCount(totals.roles), hint: '权限角色' },
  { icon: '📦', label: '商品 SKU', value: formatCount(totals.products), hint: '商品主数据' },
  { icon: '🤝', label: '客户数', value: formatCount(totals.customers), hint: '客户档案' },
  { icon: '🏭', label: '供应商数', value: formatCount(totals.suppliers), hint: '供应商档案' },
])

const governanceRows = computed(() => {
  const keyword = filters.governKeyword.trim()
  const rows = [
    ...data.dicts.rows.map((item) => ({
      key: `dict-${item.id}`,
      type: '数据字典',
      code: item.dictCode,
      name: item.dictName,
      status: item.status,
      createTime: item.createTime,
      to: '/datastandard/dict',
    })),
    ...data.codeRules.rows.map((item) => ({
      key: `rule-${item.id}`,
      type: '编码规则',
      code: item.ruleCode,
      name: item.ruleName,
      status: item.status,
      createTime: item.createTime,
      to: '/datastandard/code-rule',
    })),
  ]
  if (!keyword) return rows
  return rows.filter((row) => `${row.name ?? ''}${row.code ?? ''}${row.type}`.includes(keyword))
})

const modelRows = computed(() => [
  { name: '统一用户', code: 'MD_USER', domain: '用户域', count: totals.users, to: '/user/list' },
  { name: '统一权限角色', code: 'MD_ROLE', domain: '权限域', count: totals.roles, to: '/permission/role' },
  { name: '组织机构', code: 'MD_ORGANIZATION', domain: '组织域', count: totals.orgs, to: '/org/list' },
  { name: '统一商品', code: 'MD_GOODS', domain: '商品域', count: totals.products, to: '/product/list' },
  { name: '客户主数据', code: 'MD_CUSTOMER', domain: '伙伴域', count: totals.customers, to: '/customer/list' },
  { name: '供应商主数据', code: 'MD_SUPPLIER', domain: '伙伴域', count: totals.suppliers, to: '/supplier/list' },
  { name: '数据字典', code: 'MD_DICT', domain: '字典域', count: totals.dicts, to: '/datastandard/dict' },
  { name: '编码规则', code: 'MD_CODE_RULE', domain: '标准域', count: totals.codeRules, to: '/datastandard/code-rule' },
])

const totalEntries = computed(() => {
  const values = ['users', 'roles', 'orgs', 'products', 'customers', 'suppliers', 'dicts', 'codeRules']
    .map((key) => totals[key])
    .filter((value) => value !== null && value !== undefined)
  return values.length ? values.reduce((sum, value) => sum + (Number(value) || 0), 0) : null
})

const modelDistribution = computed(() => {
  const items = [
    { label: '统一用户', count: totals.users },
    { label: '统一权限角色', count: totals.roles },
    { label: '组织机构', count: totals.orgs },
    { label: '统一商品', count: totals.products },
    { label: '客户 / 供应商', count: (Number(totals.customers) || 0) + (Number(totals.suppliers) || 0) },
    { label: '数据字典', count: totals.dicts },
    { label: '编码规则', count: totals.codeRules },
  ]
  const max = Math.max(...items.map((item) => Number(item.count) || 0), 1)
  return items.map((item) => ({
    ...item,
    percent: item.count == null ? 0 : Math.max(2, Math.round(((Number(item.count) || 0) / max) * 100)),
  }))
})

function setTab(key) {
  activeTab.value = key
  void router.replace({ path: route.path, query: { ...route.query, tab: key } })
}

watch(
  () => route.query.tab,
  (tab) => {
    if (tab && TABS.some((item) => item.key === tab)) activeTab.value = String(tab)
  },
)

function formatCount(value) {
  if (value === null || value === undefined) return '—'
  return Number(value).toLocaleString('zh-CN')
}

function formatDate(value) {
  if (!value) return '—'
  const text = String(value).replace('T', ' ')
  return text.length > 16 ? text.slice(0, 16) : text
}

function maskPhone(value) {
  if (!value) return '—'
  return String(value).replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2')
}

function dataScopeLabel(scope) {
  return { 1: '全部数据', 2: '本部门数据', 3: '本人数据', 4: '自定义' }[Number(scope)] ?? '—'
}

function isActiveStatus(status) {
  return status === 'active' || status === 1 || status === '1' || status === true
}

function userStatusClass(status) {
  if (isActiveStatus(status)) return 'ok'
  if (status === 'inactive' || status === 0 || status === '0' || status === false) return 'off'
  return ''
}

function userStatusLabel(status) {
  if (isActiveStatus(status)) return '正常'
  if (status === 'inactive' || status === 0 || status === '0' || status === false) return '禁用'
  return '—'
}

function userTypeLabel(type) {
  return { enterprise: '企业用户', individual: '个人用户' }[type] ?? '—'
}

function realNameStatusLabel(status) {
  return { verified: '已认证', pending: '审核中', unverified: '未认证' }[status] ?? (status || '—')
}

function realNameStatusClass(status) {
  if (status === 'verified') return 'ok'
  if (status === 'pending') return 'warn'
  return 'off'
}

function supplierTypeLabel(type) {
  return { manufacturer: '生产厂家', dealer: '经销商', agent: '代理商' }[type] ?? (type || '—')
}

function unitLabel(unit) {
  return {
    bag: '袋',
    box: '箱',
    kg: '千克',
    ton: '吨',
    piece: '件',
    bottle: '瓶',
  }[unit] ?? (unit || '—')
}

function issueTypeLabel(type) {
  return {
    accuracy: '准确性',
    consistency: '一致性',
    completeness: '完整性',
    uniqueness: '唯一性',
    timeliness: '时效性',
    format: '格式',
    reference: '引用完整性',
  }[type] ?? (type || '—')
}

function severityLabel(level) {
  return { high: '严重', medium: '警告', low: '提示' }[level] ?? (level || '—')
}

function severityClass(level) {
  return { high: 'danger', medium: 'warn', low: 'info' }[level] ?? ''
}

function issueStatusLabel(status) {
  return { pending: '待处理', processing: '处理中', resolved: '已解决', ignored: '已忽略' }[status] ?? (status || '—')
}

function pageCount(key) {
  return Math.max(1, Math.ceil((Number(totals[key]) || 0) / PAGE_SIZE))
}

function unwrapPage(response) {
  if (!response || response.code !== 200) throw new Error(response?.message || '接口返回异常')
  const payload = response.data ?? {}
  const rows = Array.isArray(payload) ? payload : (payload.list ?? payload.records ?? payload.rows ?? [])
  return { rows, total: Number(payload.total ?? rows.length) || 0 }
}

async function capture(label, task) {
  try {
    await task()
  } catch (error) {
    loadErrors.value.push(`${label}：${error instanceof Error ? error.message : '加载失败'}`)
  }
}

async function loadDashboard() {
  const response = await getDashboard()
  if (!response || response.code !== 200) throw new Error(response?.message || '运营总览接口返回异常')
  const metrics = response.data?.coreMetrics ?? {}
  if (totals.users == null) totals.users = metrics.userCount ?? null
  totals.tenants = metrics.tenantCount ?? null
  totals.orgs = metrics.orgCount ?? null
}

async function loadUsers() {
  const keyword = filters.userKeyword.trim()
  const isPhone = /^\d{3,}$/.test(keyword)
  const page = unwrapPage(await getUserList({
    pageNum: pages.users,
    pageSize: PAGE_SIZE,
    username: keyword && !isPhone ? keyword : undefined,
    phone: keyword && isPhone ? keyword : undefined,
    userType: filters.userType || undefined,
    userStatus: filters.userStatus || undefined,
    realNameStatus: filters.realNameStatus || undefined,
  }))
  data.users.rows = page.rows
  totals.users = page.total
}

async function loadRoles() {
  const page = unwrapPage(await getRoleList({
    pageNum: pages.roles,
    pageSize: PAGE_SIZE,
    roleName: filters.roleKeyword.trim() || undefined,
  }))
  data.roles.rows = page.rows
  totals.roles = page.total
}

async function loadProducts() {
  const keyword = filters.productKeyword.trim()
  const isCode = /^[A-Za-z][A-Za-z0-9_-]*$/.test(keyword) && /\d/.test(keyword)
  const page = unwrapPage(await getProductList({
    pageNum: pages.products,
    pageSize: PAGE_SIZE,
    productName: keyword && !isCode ? keyword : undefined,
    productCode: keyword && isCode ? keyword : undefined,
    status: filters.productStatus || undefined,
  }))
  data.products.rows = page.rows
  totals.products = page.total
}

async function loadCustomers() {
  const keyword = filters.customerKeyword.trim()
  const isCode = /^[A-Za-z][A-Za-z0-9_-]*$/.test(keyword) && /\d/.test(keyword)
  const page = unwrapPage(await getCustomerList({
    pageNum: pages.customers,
    pageSize: PAGE_SIZE,
    customerName: keyword && !isCode ? keyword : undefined,
    customerCode: keyword && isCode ? keyword : undefined,
  }))
  data.customers.rows = page.rows
  totals.customers = page.total
}

async function loadSuppliers() {
  const keyword = filters.supplierKeyword.trim()
  const isCode = /^[A-Za-z][A-Za-z0-9_-]*$/.test(keyword) && /\d/.test(keyword)
  const page = unwrapPage(await getSupplierList({
    pageNum: pages.suppliers,
    pageSize: PAGE_SIZE,
    supplierName: keyword && !isCode ? keyword : undefined,
    supplierCode: keyword && isCode ? keyword : undefined,
  }))
  data.suppliers.rows = page.rows
  totals.suppliers = page.total
}

async function loadGovernance() {
  const [dictPage, rulePage] = await Promise.all([
    getDictList({ pageNum: 1, pageSize: PAGE_SIZE }),
    getCodeRuleList({ pageNum: 1, pageSize: PAGE_SIZE }),
  ])
  const dicts = unwrapPage(dictPage)
  const rules = unwrapPage(rulePage)
  data.dicts.rows = dicts.rows
  data.codeRules.rows = rules.rows
  totals.dicts = dicts.total
  totals.codeRules = rules.total
}

async function loadQuality() {
  const [statResponse, issuePage, rulePage] = await Promise.all([
    getQualityStatistics(),
    getQualityList({ pageNum: 1, pageSize: 6 }),
    getQualityRuleList({ pageNum: 1, pageSize: 1 }),
  ])
  if (statResponse?.code !== 200) throw new Error(statResponse?.message || '质量统计接口返回异常')
  const stats = statResponse.data ?? {}
  quality.totalIssues = stats.totalIssues ?? null
  quality.highSeverityCount = stats.highSeverityCount ?? null
  quality.mediumSeverityCount = stats.mediumSeverityCount ?? null
  quality.resolutionRate = stats.resolutionRate ?? null
  const issues = unwrapPage(issuePage)
  data.qualityIssues.rows = issues.rows
  const rules = unwrapPage(rulePage)
  data.qualityRules.rows = rules.rows
  totals.qualityRules = rules.total
}

async function loadAll() {
  loading.value = true
  loadErrors.value = []
  await Promise.all([
    capture('运营总览', loadDashboard),
    capture('统一用户', loadUsers),
    capture('统一权限', loadRoles),
    capture('统一商品', loadProducts),
    capture('客户主数据', loadCustomers),
    capture('供应商主数据', loadSuppliers),
    capture('数据治理', loadGovernance),
    capture('数据质量', loadQuality),
  ])
  lastUpdated.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  loading.value = false
}

async function searchUsers() {
  pages.users = 1
  await capture('统一用户', loadUsers)
}

async function searchRoles() {
  pages.roles = 1
  await capture('统一权限', loadRoles)
}

async function searchProducts() {
  pages.products = 1
  await capture('统一商品', loadProducts)
}

async function searchCustomers() {
  pages.customers = 1
  await capture('客户主数据', loadCustomers)
}

async function searchSuppliers() {
  pages.suppliers = 1
  await capture('供应商主数据', loadSuppliers)
}

async function changePage(key, delta) {
  const target = pages[key] + delta
  if (target < 1 || target > pageCount(key)) return
  pages[key] = target
  const loaders = {
    users: ['统一用户', loadUsers],
    roles: ['统一权限', loadRoles],
    products: ['统一商品', loadProducts],
  }
  const loader = loaders[key]
  if (loader) await capture(loader[0], loader[1])
}

async function changePartnerPage(key, delta) {
  const target = pages[key] + delta
  if (target < 1 || target > pageCount(key)) return
  pages[key] = target
  if (key === 'customers') await capture('客户主数据', loadCustomers)
  if (key === 'suppliers') await capture('供应商主数据', loadSuppliers)
}

onMounted(loadAll)
</script>

<style scoped>
.md-center {
  padding: 20px;
  color: #0b1a12;
}

.md-page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.md-page-head h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}

.md-page-head p {
  margin: 4px 0 0;
  color: #6b7c72;
  font-size: 13px;
}

.md-head-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.md-refresh-time {
  color: #93a29a;
  font-size: 12px;
}

.md-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 16px;
  border-radius: 8px;
  border: 1px solid transparent;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
}

.md-btn:disabled {
  cursor: wait;
  opacity: 0.6;
}

.md-btn-outline {
  border-color: #cfdcd4;
  background: #fff;
  color: #12764a;
}

.md-btn-primary {
  background: linear-gradient(135deg, #12764a, #159a5e);
  color: #fff;
}

.md-error {
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

.md-error span {
  flex: 1;
  line-height: 1.6;
}

.md-error-close {
  border: none;
  background: transparent;
  color: #b42318;
  font-size: 18px;
  cursor: pointer;
}

.md-stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}

.md-stat-card {
  padding: 16px;
  border: 1px solid #e3eae5;
  border-radius: 12px;
  background: #fff;
}

.md-stat-top {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #6b7c72;
  font-size: 12.5px;
}

.md-stat-icon {
  font-size: 15px;
}

.md-stat-card strong {
  display: block;
  margin-top: 9px;
  color: #0e5233;
  font-size: 26px;
  font-weight: 800;
  line-height: 1.1;
}

.md-stat-card small {
  display: block;
  margin-top: 5px;
  color: #93a29a;
  font-size: 11px;
}

.md-workbench {
  border: 1px solid #e3eae5;
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
}

.md-tabs {
  display: flex;
  gap: 2px;
  padding: 0 12px;
  border-bottom: 1px solid #e3eae5;
  overflow-x: auto;
}

.md-tab {
  flex: none;
  padding: 15px 12px 12px;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #6b7c72;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.md-tab:hover {
  color: #12764a;
}

.md-tab.on {
  border-bottom-color: #159a5e;
  color: #0e5233;
}

.md-workbench-body {
  padding: 18px;
}

.md-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.md-search {
  display: flex;
  min-width: 260px;
}

.md-search input {
  flex: 1;
  min-width: 0;
  padding: 9px 12px;
  border: 1px solid #dfe8e2;
  border-radius: 8px 0 0 8px;
  outline: none;
  font-size: 12.5px;
}

.md-search input:focus {
  border-color: #159a5e;
}

.md-search button {
  padding: 9px 15px;
  border: 1px solid #dfe8e2;
  border-left: none;
  border-radius: 0 8px 8px 0;
  background: #f7fbf9;
  color: #12764a;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}

.md-select {
  padding: 9px 12px;
  border: 1px solid #dfe8e2;
  border-radius: 8px;
  background: #fff;
  color: #33453b;
  font-size: 12.5px;
}

.md-spacer {
  flex: 1;
}

.md-link {
  color: #12764a;
  font-size: 12.5px;
  font-weight: 600;
  text-decoration: none;
}

.md-link:hover {
  text-decoration: underline;
}

.md-table-wrap {
  overflow-x: auto;
  border: 1px solid #edf2ee;
  border-radius: 9px;
}

.md-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 760px;
}

.md-table th,
.md-table td {
  padding: 11px 12px;
  border-bottom: 1px solid #f0f4f1;
  text-align: left;
  vertical-align: middle;
}

.md-table th {
  background: #f8faf9;
  color: #4b5d53;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.md-table td {
  color: #33453b;
  font-size: 12.5px;
}

.md-table tr:last-child td {
  border-bottom: none;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.md-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 9px;
  border-radius: 999px;
  background: #eef3f0;
  color: #4b5d53;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.md-badge.ok {
  background: #e4f6ec;
  color: #12764a;
}

.md-badge.off {
  background: #eef1ef;
  color: #6b7c72;
}

.md-badge.warn {
  background: #fef3c7;
  color: #92400e;
}

.md-badge.danger {
  background: #fee2e2;
  color: #b42318;
}

.md-badge.info {
  background: #e0f2fe;
  color: #0b5e86;
}

.md-actions {
  display: flex;
  gap: 10px;
  white-space: nowrap;
}

.md-actions a {
  color: #12764a;
  text-decoration: none;
}

.md-actions a:hover {
  text-decoration: underline;
}

.md-empty-inline {
  padding: 22px;
  color: #93a29a;
  text-align: center;
}

.md-pager {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 12px;
  color: #93a29a;
  font-size: 12px;
}

.md-pager button {
  padding: 6px 10px;
  border: 1px solid #dfe8e2;
  border-radius: 7px;
  background: #fff;
  color: #33453b;
  font-size: 12px;
  cursor: pointer;
}

.md-pager button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.md-partner-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.md-partner-panel {
  min-width: 0;
}

.md-partner-panel .md-search {
  flex: 1;
}

.md-subhead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 4px 0 10px;
  color: #6b7c72;
  font-size: 12px;
}

.md-subhead b {
  color: #33453b;
  font-size: 13.5px;
}

.md-govern-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.md-govern-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 1px solid #e3eae5;
  border-radius: 10px;
  color: inherit;
  text-decoration: none;
}

.md-govern-card:hover {
  border-color: #9fd7b8;
  background: #f7fbf9;
}

.md-govern-card > span {
  font-size: 24px;
}

.md-govern-card b,
.md-govern-card strong,
.md-govern-card small {
  display: block;
}

.md-govern-card b {
  font-size: 12.5px;
}

.md-govern-card strong {
  margin-top: 3px;
  color: #0e5233;
  font-size: 22px;
}

.md-govern-card small {
  color: #93a29a;
  font-size: 10.5px;
}

.md-overview-kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.md-overview-kpis > div {
  padding: 14px;
  border: 1px solid #e3eae5;
  border-radius: 10px;
}

.md-overview-kpis span,
.md-overview-kpis small {
  display: block;
  color: #6b7c72;
  font-size: 11.5px;
}

.md-overview-kpis b {
  display: block;
  margin: 5px 0;
  color: #0e5233;
  font-size: 23px;
}

.md-overview-kpis small {
  color: #93a29a;
}

.md-overview-grid {
  display: grid;
  grid-template-columns: 1.25fr 1fr;
  gap: 16px;
}

.md-card {
  padding: 16px;
  border: 1px solid #e3eae5;
  border-radius: 10px;
}

.md-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
}

.md-card-head h3 {
  margin: 0;
  font-size: 14px;
}

.md-card-head span,
.md-card-head a {
  color: #93a29a;
  font-size: 11.5px;
  text-decoration: none;
}

.md-distribution {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.md-distribution-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 5px;
  color: #4b5d53;
  font-size: 12px;
}

.md-progress {
  height: 7px;
  border-radius: 99px;
  background: #edf2ee;
  overflow: hidden;
}

.md-progress i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #12764a, #159a5e);
}

.md-quality-mini {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.md-quality-mini > div {
  padding: 10px;
  border-radius: 8px;
  background: #f8faf9;
}

.md-quality-mini span,
.md-quality-mini b {
  display: block;
}

.md-quality-mini span {
  color: #6b7c72;
  font-size: 11px;
}

.md-quality-mini b {
  margin-top: 4px;
  font-size: 19px;
}

.md-quality-mini b.danger {
  color: #dc2626;
}

.md-source-note {
  margin-top: 12px;
  padding: 11px;
  border-radius: 8px;
  background: #fffbe6;
}

.md-source-note b {
  font-size: 12.5px;
}

.md-source-note p {
  margin: 4px 0 6px;
  color: #6b7c72;
  font-size: 11.5px;
  line-height: 1.6;
}

.md-link-button {
  padding: 0;
  border: none;
  background: transparent;
  color: #12764a;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
}

.md-note {
  margin-bottom: 12px;
  padding: 11px 13px;
  border-radius: 8px;
  background: #f8faf9;
  color: #6b7c72;
  font-size: 12px;
  line-height: 1.7;
}

.md-empty-card {
  max-width: 720px;
  margin: 20px auto;
  padding: 34px;
  border: 1px dashed #cfdcd4;
  border-radius: 12px;
  text-align: center;
}

.md-empty-icon {
  font-size: 36px;
}

.md-empty-card h3 {
  margin: 12px 0 8px;
  font-size: 18px;
}

.md-empty-card p {
  margin: 0 auto;
  max-width: 560px;
  color: #6b7c72;
  font-size: 12.5px;
  line-height: 1.8;
}

.md-plan-chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 16px;
}

.md-plan-chips span {
  padding: 4px 10px;
  border-radius: 999px;
  background: #f3f6f4;
  color: #6b7c72;
  font-size: 11px;
}

.md-empty-actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}

.md-quality-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.md-quality-stats > div {
  padding: 14px;
  border: 1px solid #e3eae5;
  border-radius: 10px;
}

.md-quality-stats span,
.md-quality-stats b {
  display: block;
}

.md-quality-stats span {
  color: #6b7c72;
  font-size: 11.5px;
}

.md-quality-stats b {
  margin-top: 5px;
  color: #0e5233;
  font-size: 23px;
}

.md-quality-stats b.danger {
  color: #dc2626;
}

.md-quality-stats b.warn {
  color: #b45309;
}

.md-desc {
  max-width: 360px;
  line-height: 1.6;
}

@media (max-width: 980px) {
  .md-partner-grid,
  .md-overview-grid {
    grid-template-columns: 1fr;
  }

  .md-govern-cards,
  .md-overview-kpis,
  .md-quality-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 700px) {
  .md-center {
    padding: 14px;
  }

  .md-page-head {
    flex-direction: column;
  }

  .md-head-actions {
    width: 100%;
    justify-content: space-between;
  }

  .md-stat-grid,
  .md-govern-cards,
  .md-overview-kpis,
  .md-quality-mini {
    grid-template-columns: 1fr;
  }

  .md-stat-grid,
  .md-overview-kpis,
  .md-quality-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .md-workbench-body {
    padding: 12px;
  }

  .md-search {
    min-width: 100%;
  }

  .md-select {
    flex: 1;
  }

  .md-pager {
    flex-wrap: wrap;
    justify-content: flex-start;
  }
}
</style>
