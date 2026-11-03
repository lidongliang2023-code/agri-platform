<template>
  <div class="mds-page">
    <PageHeader
      title="供应商主数据"
      subtitle="上游供货主体的唯一维护入口：建档、等级与停用；证照与供应品类在交易撮合侧引用。"
      source="客商主数据 · 全平台共享"
    >
      <template #actions>
        <button v-point="'POST /admin/masterdata/customer/supplier'" class="mds-btn mds-btn--primary" @click="openCreateModal">+ 新增供应商</button>
        <button class="mds-btn" :disabled="loading" @click="reloadAll">刷新</button>
      </template>
    </PageHeader>

    <StatGrid :items="statItems" />

    <NoticeBar tone="info" title="字段口径：">
      供应商表的联系人列是 <code>contact_person</code>；「营业执照」不是独立字段，用
      <code>credit_code</code>（统一社会信用代码）承载 —— 原来表单里的「营业执照号」填了不会落库，已替换。
    </NoticeBar>

    <div class="mds-card">
      <div class="mds-filter">
        <input
          v-model="searchForm.keyword"
          class="mds-input"
          type="search"
          placeholder="供应商名称 / 编码 / 联系人"
          @keyup.enter="search"
        />
        <select v-model="searchForm.supplierType" class="mds-select" @change="search">
          <option value="">全部类型</option>
          <option value="manufacturer">生产厂家</option>
          <option value="dealer">经销商</option>
          <option value="agent">代理商</option>
        </select>
        <select v-model="searchForm.level" class="mds-select" @change="search">
          <option value="">全部等级</option>
          <option value="A">A 级</option>
          <option value="B">B 级</option>
          <option value="C">C 级</option>
        </select>
        <select v-model="searchForm.status" class="mds-select" @change="search">
          <option value="">全部状态</option>
          <option value="1">正常</option>
          <option value="0">禁用</option>
        </select>
        <button class="mds-btn mds-btn--primary" @click="search">查询</button>
        <button class="mds-btn" @click="reset">重置</button>
      </div>

      <div class="mds-table-wrap">
        <table class="mds-table">
          <thead>
            <tr>
              <th>供应商编码</th>
              <th>供应商名称</th>
              <th>类型</th>
              <th class="mds-center">等级</th>
              <th>联系人</th>
              <th>联系电话</th>
              <th>信用代码</th>
              <th>地址</th>
              <th>状态</th>
              <th>创建时间</th>
              <th class="mds-actions">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="11" class="mds-empty">正在加载供应商…</td>
            </tr>
            <tr v-else-if="!tableData.length">
              <td colspan="11">
                <EmptyState title="暂无符合条件的供应商" description="调整关键字或筛选条件；也可以直接新增供应商。" />
              </td>
            </tr>
            <tr v-for="supplier in tableData" :key="supplier.id">
              <td class="mds-mono">{{ supplier.supplierCode || '—' }}</td>
              <td class="mds-name">{{ supplier.supplierName || '—' }}</td>
              <td><StatusTag :text="getTypeLabel(supplier.supplierType)" tone="cyan" plain /></td>
              <td class="mds-center">
                <StatusTag :text="supplier.level || '—'" :tone="levelTone(supplier.level)" plain />
              </td>
              <td>{{ supplier.contactPerson || '—' }}</td>
              <td class="mds-mono">{{ supplier.contactPhone || '—' }}</td>
              <td class="mds-mono">{{ supplier.creditCode || '—' }}</td>
              <td class="address-cell">{{ supplier.address || '—' }}</td>
              <td>
                <StatusTag
                  :text="Number(supplier.status) === 1 ? '正常' : '禁用'"
                  :tone="Number(supplier.status) === 1 ? 'success' : 'gray'"
                />
              </td>
              <td class="mds-muted">{{ formatDate(supplier.createTime) }}</td>
              <td class="mds-actions">
                <button class="mds-btn mds-btn--link" @click="viewDetail(supplier.id)">详情</button>
                <button v-point="'PUT /admin/masterdata/customer/supplier/{id}'" class="mds-btn mds-btn--link" @click="editSupplier(supplier)">编辑</button>
                <button
                  class="mds-btn mds-btn--link"
                  :class="{ 'mds-danger': Number(supplier.status) === 1 }"
                  @click="toggleStatus(supplier)"
                >
                  {{ Number(supplier.status) === 1 ? '禁用' : '启用' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <PagerBar
        :page="pageNum"
        :page-size="pageSize"
        :total="total"
        @change="handleCurrentChange"
        @update:page-size="changePageSize"
      />
    </div>

    <div v-if="detail" class="mds-card">
      <div class="mds-card-head">
        <div>
          <h2 class="mds-card-title">供应商详情 · {{ detail.supplierName }}</h2>
          <p class="mds-card-sub">{{ detail.supplierCode }} · {{ detail.tenantId || '未关联主体' }}</p>
        </div>
        <button class="mds-btn" @click="detail = null">收起</button>
      </div>
      <div class="mds-card-body">
        <div class="mds-kv-grid">
          <div class="mds-kv"><span class="mds-kv__k">供应商编码</span><span class="mds-kv__v mds-mono">{{ detail.supplierCode || '—' }}</span></div>
          <div class="mds-kv"><span class="mds-kv__k">供应商名称</span><span class="mds-kv__v">{{ detail.supplierName || '—' }}</span></div>
          <div class="mds-kv"><span class="mds-kv__k">供应商类型</span><span class="mds-kv__v">{{ getTypeLabel(detail.supplierType) }}</span></div>
          <div class="mds-kv"><span class="mds-kv__k">等级</span><span class="mds-kv__v">{{ detail.level || '—' }}</span></div>
          <div class="mds-kv"><span class="mds-kv__k">信用代码</span><span class="mds-kv__v mds-mono">{{ detail.creditCode || '—' }}</span></div>
          <div class="mds-kv"><span class="mds-kv__k">法人代表</span><span class="mds-kv__v">{{ detail.legalPerson || '—' }}</span></div>
          <div class="mds-kv"><span class="mds-kv__k">联系人</span><span class="mds-kv__v">{{ detail.contactPerson || '—' }}</span></div>
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
          <h2 class="mds-card-title">{{ form.id ? '编辑供应商' : '新增供应商' }}</h2>
          <button class="mds-btn mds-btn--link" @click="closeModal">关闭</button>
        </div>
        <div class="mds-card-body">
          <div class="mds-form">
            <label class="mds-field">
              <span class="mds-field__label mds-required">供应商编码</span>
              <input v-model="form.supplierCode" class="mds-input" :disabled="Boolean(form.id)" placeholder="如 S1001" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label mds-required">供应商名称</span>
              <input v-model="form.supplierName" class="mds-input" placeholder="供应商全称" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label">供应商类型</span>
              <select v-model="form.supplierType" class="mds-select">
                <option value="manufacturer">生产厂家</option>
                <option value="dealer">经销商</option>
                <option value="agent">代理商</option>
              </select>
            </label>
            <label class="mds-field">
              <span class="mds-field__label">等级</span>
              <select v-model="form.level" class="mds-select">
                <option value="A">A 级</option>
                <option value="B">B 级</option>
                <option value="C">C 级</option>
              </select>
            </label>
            <label class="mds-field">
              <span class="mds-field__label">联系人</span>
              <input v-model="form.contactPerson" class="mds-input" placeholder="联系人姓名" />
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
              <input v-model="form.address" class="mds-input" placeholder="经营 / 发货地址" />
            </label>
          </div>
          <div class="mds-form-actions">
            <button class="mds-btn" @click="closeModal">取消</button>
            <button class="mds-btn mds-btn--primary" :disabled="saving" @click="saveSupplier">
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
import PagerBar from '@/components/ui/PagerBar.vue'
import {
  createSupplier,
  getCustomerStatistics,
  getSupplierDetail,
  getSupplierList,
  updateSupplier,
} from '../../utils/api'

const tableData = ref([])
const detail = ref(null)
const pageNum = ref(1)
const pageSize = ref(20)
const total = ref(0)
const modalVisible = ref(false)
const loading = ref(false)
const saving = ref(false)
const stats = ref({ totalCustomers: 0, totalSuppliers: 0, activeSuppliers: 0 })

const searchForm = reactive({ keyword: '', supplierType: '', level: '', status: '' })

const form = reactive({
  id: null,
  supplierCode: '',
  supplierName: '',
  supplierType: 'manufacturer',
  level: 'C',
  contactPerson: '',
  contactPhone: '',
  creditCode: '',
  address: '',
  status: 1,
})

const statItems = computed(() => [
  { label: '供应商总数', value: stats.value.totalSuppliers ?? 0 },
  { label: '正常合作', value: stats.value.activeSuppliers ?? 0, tone: 'success' },
  { label: '客户总数', value: stats.value.totalCustomers ?? 0, hint: '客商同源统计' },
  {
    label: '停用',
    value: Math.max(0, Number(stats.value.totalSuppliers ?? 0) - Number(stats.value.activeSuppliers ?? 0)),
    tone: 'warning',
  },
])

const getTypeLabel = (type) =>
  ({ manufacturer: '生产厂家', dealer: '经销商', agent: '代理商' }[type] ?? type ?? '—')
const levelTone = (level) => ({ A: 'purple', B: 'info', C: 'gray' }[level] ?? 'gray')

const loadData = async () => {
  loading.value = true
  try {
    const response = await getSupplierList({
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      keyword: searchForm.keyword || undefined,
      supplierType: searchForm.supplierType || undefined,
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
  Object.assign(searchForm, { keyword: '', supplierType: '', level: '', status: '' })
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

const openCreateModal = () => {
  Object.assign(form, {
    id: null,
    supplierCode: '',
    supplierName: '',
    supplierType: 'manufacturer',
    level: 'C',
    contactPerson: '',
    contactPhone: '',
    creditCode: '',
    address: '',
    status: 1,
  })
  modalVisible.value = true
}

const editSupplier = (row) => {
  Object.assign(form, {
    id: row.id,
    supplierCode: row.supplierCode ?? '',
    supplierName: row.supplierName ?? '',
    supplierType: row.supplierType ?? 'manufacturer',
    level: row.level ?? 'C',
    contactPerson: row.contactPerson ?? '',
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

const saveSupplier = async () => {
  if (!form.supplierCode.trim() || !form.supplierName.trim()) {
    message.warning('供应商编码与名称为必填')
    return
  }
  saving.value = true
  try {
    const payload = { ...form }
    const response = form.id ? await updateSupplier(form.id, payload) : await createSupplier(payload)
    if (response.code !== 200) throw new Error(response.message || '操作失败')
    message.success(form.id ? '供应商已更新' : '供应商已创建')
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
  if (!enabling && !window.confirm(`确认禁用「${row.supplierName}」？`)) return
  try {
    const response = await updateSupplier(row.id, { status: enabling ? 1 : 0 })
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
    const response = await getSupplierDetail(id)
    if (response.code !== 200) throw new Error(response.message || '详情加载失败')
    detail.value = response.data ?? null
  } catch (error) {
    message.error(error instanceof Error ? error.message : '详情加载失败')
  }
}

const formatDate = (date) => (date ? String(date).replace('T', ' ').split(' ')[0] : '—')

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
