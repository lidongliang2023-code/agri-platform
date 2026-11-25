<template>
  <div class="mds-page">
    <PageHeader
      title="客户主数据"
      subtitle="客商主数据的唯一维护入口：建档、等级与停用；按 tenant_id 隔离，交易撮合的客商视图为只读引用。"
      source="客商主数据 · 全平台共享"
    />

    <StatGrid :items="statItems" />

    <NoticeBar tone="info" title="字段口径：">
      客户表的联系人列是 <code>contact_name</code>，表单提交也用它；邮箱在客户实体里没有对应列，
      因此不再放一个「填了不生效」的输入框。等级（A/B/C）与信用代码可直接维护。
    </NoticeBar>

    <AgriVueTable
      :columns="columns"
      :data="tableData"
      row-key="id"
      :loading="loading"
      loading-text="正在加载客户…"
      column-settings-storage-key="mds:cols:customer-list"
      :page="pageNum"
      :page-size="pageSize"
      :total="total"
      @refresh="reloadAll"
      @update:page="handleCurrentChange"
      @update:page-size="changePageSize"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="4" :loading="loading" @search="search" @reset="reset">
          <div class="agri-vue-filter-field">
            <label>关键字</label>
            <input
              v-model="searchForm.keyword"
              class="mds-input"
              type="search"
              placeholder="客户名称 / 编码 / 联系人"
              @keyup.enter="search"
            />
          </div>
          <div class="agri-vue-filter-field">
            <label>客户类型</label>
            <select v-model="searchForm.customerType" class="mds-select" @change="search">
              <option value="">全部类型</option>
              <option value="enterprise">企业客户</option>
              <option value="individual">个人客户</option>
            </select>
          </div>
          <div class="agri-vue-filter-field">
            <label>客户等级</label>
            <select v-model="searchForm.level" class="mds-select" @change="search">
              <option value="">全部等级</option>
              <option value="A">A 级（核心）</option>
              <option value="B">B 级（重点）</option>
              <option value="C">C 级（普通）</option>
            </select>
          </div>
          <div class="agri-vue-filter-field">
            <label>状态</label>
            <select v-model="searchForm.status" class="mds-select" @change="search">
              <option value="">全部状态</option>
              <option value="1">正常</option>
              <option value="0">禁用</option>
            </select>
          </div>
        </AgriVueFilterBar>
      </template>

      <template #toolbar-left>
        <button v-point="'POST /admin/masterdata/customer'" class="mds-btn mds-btn--primary" @click="openCreateModal">+ 新增客户</button>
      </template>

      <template #empty>
        <EmptyState title="暂无符合条件的客户" description="调整关键字或筛选条件；也可以直接新增客户。" />
      </template>

      <template #cell-customerName="{ row }">
        <span class="mds-name">{{ row.customerName || '—' }}</span>
      </template>
      <template #cell-customerType="{ row }">
        <StatusTag
          :text="row.customerType === 'individual' ? '个人客户' : '企业客户'"
          :tone="row.customerType === 'individual' ? 'brand' : 'info'"
          plain
        />
      </template>
      <template #cell-level="{ row }">
        <StatusTag :text="row.level || '—'" :tone="levelTone(row.level)" plain />
      </template>
      <template #cell-status="{ row }">
        <StatusTag
          :text="Number(row.status) === 1 ? '正常' : '禁用'"
          :tone="Number(row.status) === 1 ? 'success' : 'gray'"
        />
      </template>
      <template #cell-createTime="{ row }">
        <span class="mds-muted">{{ formatDate(row.createTime) }}</span>
      </template>
      <template #cell-actions="{ row }">
        <MdsRowActions
          :actions="[
            { key: 'detail', label: '详情', onClick: () => viewDetail(row.id) },
            { key: 'edit', label: '编辑', point: 'PUT /admin/masterdata/customer/{id}', onClick: () => editCustomer(row) },
            { key: 'toggle', label: Number(row.status) === 1 ? '禁用' : '启用', danger: Number(row.status) === 1, onClick: () => toggleStatus(row) },
          ]"
        />
      </template>
    </AgriVueTable>

    <div v-if="detail" class="mds-card">
      <div class="mds-card-head">
        <div>
          <h2 class="mds-card-title">客户详情 · {{ detail.customerName }}</h2>
          <p class="mds-card-sub">{{ detail.customerCode }} · {{ detail.tenantId || '未关联主体' }}</p>
        </div>
        <button class="mds-btn" @click="detail = null">收起</button>
      </div>
      <div class="mds-card-body">
        <div class="mds-kv-grid">
          <div class="mds-kv"><span class="mds-kv__k">客户编码</span><span class="mds-kv__v mds-mono">{{ detail.customerCode || '—' }}</span></div>
          <div class="mds-kv"><span class="mds-kv__k">客户名称</span><span class="mds-kv__v">{{ detail.customerName || '—' }}</span></div>
          <div class="mds-kv"><span class="mds-kv__k">客户类型</span><span class="mds-kv__v">{{ detail.customerType === 'individual' ? '个人客户' : '企业客户' }}</span></div>
          <div class="mds-kv"><span class="mds-kv__k">等级</span><span class="mds-kv__v">{{ detail.level || '—' }}</span></div>
          <div class="mds-kv"><span class="mds-kv__k">信用代码</span><span class="mds-kv__v mds-mono">{{ detail.creditCode || '—' }}</span></div>
          <div class="mds-kv"><span class="mds-kv__k">法人代表</span><span class="mds-kv__v">{{ detail.legalPerson || '—' }}</span></div>
          <div class="mds-kv"><span class="mds-kv__k">联系人</span><span class="mds-kv__v">{{ detail.contactName || '—' }}</span></div>
          <div class="mds-kv"><span class="mds-kv__k">联系电话</span><span class="mds-kv__v mds-mono">{{ detail.contactPhone || '—' }}</span></div>
          <div class="mds-kv"><span class="mds-kv__k">所属组织</span><span class="mds-kv__v">{{ detail.orgName || '—' }}</span></div>
          <div class="mds-kv"><span class="mds-kv__k">地址</span><span class="mds-kv__v">{{ detail.address || '—' }}</span></div>
          <div class="mds-kv"><span class="mds-kv__k">状态</span><span class="mds-kv__v">{{ Number(detail.status) === 1 ? '正常' : '禁用' }}</span></div>
          <div class="mds-kv"><span class="mds-kv__k">创建时间</span><span class="mds-kv__v">{{ formatDate(detail.createTime) }}</span></div>
        </div>
      </div>
    </div>

    <div v-if="modalVisible" class="mds-mask" @click="closeModal">
      <div class="mds-modal" @click.stop>
        <div class="mds-card-head">
          <h2 class="mds-card-title">{{ form.id ? '编辑客户' : '新增客户' }}</h2>
          <button class="mds-btn mds-btn--link" @click="closeModal">关闭</button>
        </div>
        <div class="mds-card-body">
          <div class="mds-form">
            <label class="mds-field">
              <span class="mds-field__label mds-required">客户编码</span>
              <input v-model="form.customerCode" class="mds-input" :disabled="Boolean(form.id)" placeholder="如 C1001" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label mds-required">客户名称</span>
              <input v-model="form.customerName" class="mds-input" placeholder="客户全称" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label">客户类型</span>
              <select v-model="form.customerType" class="mds-select">
                <option value="enterprise">企业客户</option>
                <option value="individual">个人客户</option>
              </select>
            </label>
            <label class="mds-field">
              <span class="mds-field__label">等级</span>
              <select v-model="form.level" class="mds-select">
                <option value="A">A 级（核心）</option>
                <option value="B">B 级（重点）</option>
                <option value="C">C 级（普通）</option>
              </select>
            </label>
            <label class="mds-field">
              <span class="mds-field__label">联系人</span>
              <input v-model="form.contactName" class="mds-input" placeholder="联系人姓名" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label">联系电话</span>
              <input v-model="form.contactPhone" class="mds-input" placeholder="11 位手机号" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label">统一社会信用代码</span>
              <input v-model="form.creditCode" class="mds-input" placeholder="选填" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label">状态</span>
              <select v-model.number="form.status" class="mds-select">
                <option :value="1">正常</option>
                <option :value="0">禁用</option>
              </select>
            </label>
            <label class="mds-field mds-field--full">
              <span class="mds-field__label">地址</span>
              <input v-model="form.address" class="mds-input" placeholder="收货 / 经营地址" />
            </label>
          </div>
          <div class="mds-form-actions">
            <button class="mds-btn" @click="closeModal">取消</button>
            <button class="mds-btn mds-btn--primary" :disabled="saving" @click="saveCustomer">
              {{ saving ? '保存中…' : form.id ? '保存修改' : '确认新增' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatGrid from '@/components/ui/StatGrid.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import MdsRowActions from '@/components/ui/MdsRowActions.vue'
import { AgriVueFilterBar, AgriVueTable } from '@agri/shared/vue/list'

const columns = [
  { prop: 'customerCode', label: '客户编码', width: 140, kind: 'code' },
  { prop: 'customerName', label: '客户名称', width: 180, locked: true },
  { prop: 'customerType', label: '类型', width: 105, align: 'center', ellipsis: false },
  { prop: 'level', label: '等级', width: 80, align: 'center', ellipsis: false },
  { prop: 'contactName', label: '联系人', width: 110 },
  { prop: 'contactPhone', label: '联系电话', width: 135, kind: 'code' },
  { prop: 'address', label: '地址', minWidth: 180 },
  { prop: 'status', label: '状态', width: 96, kind: 'status' },
  { prop: 'createTime', label: '创建时间', width: 120 },
  { key: 'actions', label: '操作', width: 130, kind: 'action' },
]
import {
  createCustomer,
  getCustomerDetail,
  getCustomerList,
  getCustomerStatistics,
  updateCustomer,
} from '../../utils/api'

const tableData = ref([])
const detail = ref(null)
const pageNum = ref(1)
const pageSize = ref(20)
const total = ref(0)
const modalVisible = ref(false)
const loading = ref(false)
const saving = ref(false)
const stats = ref({ totalCustomers: 0, activeCustomers: 0, inactiveCustomers: 0, totalSuppliers: 0 })

const searchForm = reactive({
  keyword: '',
  customerType: '',
  level: '',
  status: '',
})

const form = reactive({
  id: null,
  customerCode: '',
  customerName: '',
  customerType: 'enterprise',
  level: 'C',
  contactName: '',
  contactPhone: '',
  creditCode: '',
  address: '',
  status: 1,
})

const statItems = computed(() => [
  { label: '客户总数', value: stats.value.totalCustomers ?? 0 },
  { label: '正常合作', value: stats.value.activeCustomers ?? 0, tone: 'success' },
  { label: '已禁用', value: stats.value.inactiveCustomers ?? 0, tone: 'warning' },
  { label: '供应商总数', value: stats.value.totalSuppliers ?? 0, hint: '客商同源统计' },
])

const loadData = async () => {
  loading.value = true
  try {
    const response = await getCustomerList({
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      keyword: searchForm.keyword || undefined,
      customerType: searchForm.customerType || undefined,
      level: searchForm.level || undefined,
      status: searchForm.status || undefined,
    })
    if (response.code !== 200) throw new Error(response.message || '加载数据失败')
    tableData.value = response.data?.list ?? []
    total.value = Number(response.data?.total ?? 0)
  } catch (error) {
    tableData.value = []
    total.value = 0
    message.error(error instanceof Error ? error.message : '加载数据失败')
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    const response = await getCustomerStatistics()
    if (response.code === 200) {
      stats.value = { ...stats.value, ...(response.data ?? {}) }
    }
  } catch {
    // 统计失败不影响列表
  }
}

function reloadAll() {
  void loadData()
  void loadStats()
}

function search() {
  pageNum.value = 1
  void loadData()
}

function reset() {
  Object.assign(searchForm, { keyword: '', customerType: '', level: '', status: '' })
  search()
}

function handleCurrentChange(next) {
  pageNum.value = next
  void loadData()
}

function changePageSize(size) {
  pageSize.value = size
  pageNum.value = 1
  void loadData()
}

const levelTone = (level) => ({ A: 'purple', B: 'info', C: 'gray' }[level] ?? 'gray')

const openCreateModal = () => {
  Object.assign(form, {
    id: null,
    customerCode: '',
    customerName: '',
    customerType: 'enterprise',
    level: 'C',
    contactName: '',
    contactPhone: '',
    creditCode: '',
    address: '',
    status: 1,
  })
  modalVisible.value = true
}

const editCustomer = (row) => {
  Object.assign(form, {
    id: row.id,
    customerCode: row.customerCode ?? '',
    customerName: row.customerName ?? '',
    customerType: row.customerType ?? 'enterprise',
    level: row.level ?? 'C',
    // 列表与表单统一用 contactName：客户表的列就是 contact_name，
    // 原来表单绑 contactPerson → 编辑时联系人改了也不生效
    contactName: row.contactName ?? '',
    contactPhone: row.contactPhone ?? '',
    creditCode: row.creditCode ?? '',
    address: row.address ?? '',
    status: Number(row.status ?? 1),
  })
  modalVisible.value = true
}

const closeModal = () => {
  modalVisible.value = false
}

const saveCustomer = async () => {
  if (!form.customerCode.trim() || !form.customerName.trim()) {
    message.warning('客户编码与客户名称为必填')
    return
  }
  saving.value = true
  try {
    const payload = { ...form }
    const response = form.id ? await updateCustomer(form.id, payload) : await createCustomer(payload)
    if (response.code !== 200) throw new Error(response.message || '操作失败')
    message.success(form.id ? '客户已更新' : '客户已创建')
    closeModal()
    await loadData()
    await loadStats()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '操作失败')
  } finally {
    saving.value = false
  }
}

const toggleStatus = async (row) => {
  const enabling = Number(row.status) !== 1
  if (!enabling && !window.confirm(`确认禁用「${row.customerName}」？`)) return
  try {
    const response = await updateCustomer(row.id, { status: enabling ? 1 : 0 })
    if (response.code !== 200) throw new Error(response.message || '操作失败')
    message.success(enabling ? '已启用' : '已禁用')
    await loadData()
    await loadStats()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '操作失败')
  }
}

const viewDetail = async (id) => {
  try {
    const response = await getCustomerDetail(id)
    if (response.code !== 200) throw new Error(response.message || '详情加载失败')
    detail.value = response.data ?? null
  } catch (error) {
    message.error(error instanceof Error ? error.message : '详情加载失败')
  }
}

const formatDate = (date) => {
  if (!date) return '—'
  return String(date).replace('T', ' ').split(' ')[0]
}

onMounted(() => {
  void loadData()
  void loadStats()
})
</script>

<style scoped>
.address-cell {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mds-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  padding: 20px;
}

.mds-modal {
  width: 680px;
  max-width: 100%;
  max-height: 88vh;
  overflow: auto;
  border-radius: var(--mds-radius);
  background: var(--mds-card);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
}
</style>
