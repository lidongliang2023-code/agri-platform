<template>
  <div class="mds-page">
    <PageHeader
      title="编码规则管理"
      subtitle="全平台主数据编码的统一规则：前缀 + 日期段 + 流水号（+ 后缀）；续号与冲突由后端生成。"
      source="数据标准 · 编码"
    />

    <NoticeBar tone="info" title="试算说明：">
      「试算」按规则真实拼接一个样例（前缀 + 日期 + 序号），不是查已有编码；序号从这里看不出并发占用情况。
    </NoticeBar>

    <AgriVueTable
      :columns="columns"
      :data="tableData"
      row-key="id"
      :loading="loading"
      loading-text="正在加载编码规则…"
      column-settings-storage-key="mds:cols:code-rule-list"
      :page="pageNum"
      :page-size="pageSize"
      :total="total"
      @refresh="loadData"
      @update:page="handleCurrentChange"
      @update:page-size="changePageSize"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="2" :loading="loading" @search="search" @reset="reset">
          <div class="agri-vue-filter-field">
            <label>关键字</label>
            <input
              v-model="searchForm.keyword"
              class="mds-input"
              type="search"
              placeholder="规则名称 / 编码"
              @keyup.enter="search"
            />
          </div>
          <div class="agri-vue-filter-field">
            <label>状态</label>
            <select v-model="searchForm.status" class="mds-select" @change="search">
              <option value="">全部状态</option>
              <option value="1">启用</option>
              <option value="0">禁用</option>
            </select>
          </div>
        </AgriVueFilterBar>
      </template>

      <template #toolbar-left>
        <button v-point="'POST /admin/masterdata/standard/code-rule'" class="mds-btn mds-btn--primary" @click="openCreateModal">+ 新增规则</button>
      </template>

      <template #empty>
        <EmptyState title="暂无编码规则" description="新增规则后，用户 / 组织 / 商品等编码才会按统一规则生成。" />
      </template>

      <template #cell-ruleName="{ row }">
        <span class="mds-name">{{ row.ruleName || '—' }}</span>
      </template>
      <template #cell-ruleType="{ row }">
        <StatusTag
          :text="row.ruleType === 'auto' ? '自动生成' : '手动输入'"
          :tone="row.ruleType === 'auto' ? 'success' : 'info'"
          plain
        />
      </template>
      <template #cell-status="{ row }">
        <StatusTag
          :text="Number(row.status) === 1 ? '启用' : '禁用'"
          :tone="Number(row.status) === 1 ? 'success' : 'gray'"
        />
      </template>
      <template #cell-createTime="{ row }">
        <span class="mds-muted">{{ formatDate(row.createTime) }}</span>
      </template>
      <template #cell-actions="{ row }">
        <MdsRowActions
          :actions="[
            { key: 'try', label: '试算', point: 'POST /admin/masterdata/standard/code-rule/{id}/test', disabled: busyId === row.id || row.ruleType === 'manual', title: row.ruleType === 'manual' ? '手工录入规则不参与自动生成' : '按规则试算一个样例', onClick: () => tryRule(row) },
            { key: 'edit', label: '编辑', point: 'PUT /admin/masterdata/standard/code-rule/{id}', onClick: () => editRule(row) },
            { key: 'toggle', label: Number(row.status) === 1 ? '禁用' : '启用', danger: Number(row.status) === 1, point: 'PUT /admin/masterdata/standard/code-rule/{id}', disabled: busyId === row.id, onClick: () => toggleStatus(row) },
          ]"
        />
      </template>
    </AgriVueTable>

    <div v-if="sample" class="mds-card">
      <div class="mds-card-head">
        <div>
          <h2 class="mds-card-title">试算结果 · {{ sample.ruleName }}</h2>
          <p class="mds-card-sub">按当前规则拼接的样例编码（序号固定取 1）</p>
        </div>
        <button class="mds-btn" @click="sample = null">收起</button>
      </div>
      <div class="mds-card-body">
        <div class="sample-code">{{ sample.code }}</div>
      </div>
    </div>

    <div v-if="modalVisible" class="mds-mask" @click="closeModal">
      <div class="mds-modal" @click.stop>
        <div class="mds-card-head">
          <h2 class="mds-card-title">{{ form.id ? '编辑规则' : '新增规则' }}</h2>
          <button class="mds-btn mds-btn--link" @click="closeModal">关闭</button>
        </div>
        <div class="mds-card-body">
          <div class="mds-form">
            <label class="mds-field">
              <span class="mds-field__label mds-required">规则编码</span>
              <input v-model="form.ruleCode" class="mds-input" :disabled="Boolean(form.id)" placeholder="如 CUSTOMER_CODE" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label mds-required">规则名称</span>
              <input v-model="form.ruleName" class="mds-input" placeholder="如 客户编码规则" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label">规则类型</span>
              <select v-model="form.ruleType" class="mds-select">
                <option value="auto">自动生成</option>
                <option value="manual">手动输入</option>
              </select>
            </label>
            <label class="mds-field">
              <span class="mds-field__label">前缀</span>
              <input v-model="form.prefix" class="mds-input" placeholder="如 CUS" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label">序号长度</span>
              <input v-model.number="form.seqLength" class="mds-input" type="number" min="1" max="12" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label">编码格式示例</span>
              <input v-model="form.rulePattern" class="mds-input" placeholder="如 CUS+yyyyMMdd+5位" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label">状态</span>
              <select v-model.number="form.status" class="mds-select">
                <option :value="1">启用</option>
                <option :value="0">禁用</option>
              </select>
            </label>
          </div>
          <div class="mds-form-actions">
            <button class="mds-btn" @click="closeModal">取消</button>
            <button class="mds-btn mds-btn--primary" :disabled="saving" @click="saveRule">
              {{ saving ? '保存中…' : form.id ? '保存修改' : '确认新增' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import MdsRowActions from '@/components/ui/MdsRowActions.vue'
import { AgriVueFilterBar, AgriVueTable } from '@agri/shared/vue/list'

const columns = [
  { prop: 'ruleCode', label: '规则编码', width: 155, kind: 'code', locked: true },
  { prop: 'ruleName', label: '规则名称', width: 165 },
  { prop: 'rulePattern', label: '编码格式', minWidth: 170, kind: 'code' },
  { prop: 'ruleType', label: '规则类型', width: 105, align: 'center', ellipsis: false },
  { prop: 'prefix', label: '前缀', width: 96, kind: 'code' },
  { prop: 'seqLength', label: '序号长度', width: 96, kind: 'number' },
  { prop: 'status', label: '状态', width: 92, kind: 'status' },
  { prop: 'createTime', label: '创建时间', width: 120 },
  { key: 'actions', label: '操作', width: 130, kind: 'action' },
]
import {
  createCodeRule,
  getCodeRuleList,
  testCodeRule,
  updateCodeRule,
} from '../../utils/api'

const tableData = ref([])
const pageNum = ref(1)
const pageSize = ref(20)
const total = ref(0)
const modalVisible = ref(false)
const loading = ref(false)
const saving = ref(false)
const busyId = ref(null)
const sample = ref(null)

const searchForm = reactive({ keyword: '', status: '' })

const form = reactive({
  id: null,
  ruleCode: '',
  ruleName: '',
  ruleType: 'auto',
  prefix: '',
  seqLength: 6,
  rulePattern: '',
  status: 1,
})

const loadData = async () => {
  loading.value = true
  try {
    const response = await getCodeRuleList({
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      keyword: searchForm.keyword || undefined,
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

function search() {
  pageNum.value = 1
  void loadData()
}

function reset() {
  Object.assign(searchForm, { keyword: '', status: '' })
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
    ruleCode: '',
    ruleName: '',
    ruleType: 'auto',
    prefix: '',
    seqLength: 6,
    rulePattern: '',
    status: 1,
  })
  modalVisible.value = true
}

const editRule = (row) => {
  Object.assign(form, {
    id: row.id,
    ruleCode: row.ruleCode ?? '',
    ruleName: row.ruleName ?? '',
    ruleType: row.ruleType ?? 'auto',
    prefix: row.prefix ?? '',
    seqLength: Number(row.seqLength ?? 6),
    rulePattern: row.rulePattern ?? '',
    status: Number(row.status ?? 1),
  })
  modalVisible.value = true
}

const closeModal = () => {
  modalVisible.value = false
}

const saveRule = async () => {
  if (!form.ruleCode.trim() || !form.ruleName.trim()) {
    message.warning('规则编码与名称为必填')
    return
  }
  saving.value = true
  try {
    const payload = { ...form }
    const response = form.id ? await updateCodeRule(form.id, payload) : await createCodeRule(payload)
    if (response.code !== 200) throw new Error(response.message || '操作失败')
    message.success(form.id ? '规则已更新' : '规则已创建')
    closeModal()
    await loadData()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '操作失败')
  } finally {
    saving.value = false
  }
}

const toggleStatus = async (row) => {
  const enabling = Number(row.status) !== 1
  if (!enabling && !window.confirm(`确认禁用「${row.ruleName}」？禁用后新编码将无法按此规则生成。`)) return
  busyId.value = row.id
  try {
    const response = await updateCodeRule(row.id, { status: enabling ? 1 : 0 })
    if (response.code !== 200) throw new Error(response.message || '操作失败')
    message.success(enabling ? '规则已启用' : '规则已禁用')
    await loadData()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '操作失败')
  } finally {
    busyId.value = null
  }
}

const tryRule = async (row) => {
  busyId.value = row.id
  try {
    const response = await testCodeRule(row.id)
    if (response.code !== 200) throw new Error(response.message || '试算失败')
    sample.value = { ruleName: row.ruleName, code: String(response.data ?? '') }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '试算失败')
  } finally {
    busyId.value = null
  }
}

const formatDate = (value) => (value ? String(value).replace('T', ' ').split(' ')[0] : '—')

onMounted(loadData)
</script>

<style scoped>
.sample-code {
  padding: 14px 16px;
  border-radius: 8px;
  background: var(--mds-brand-soft);
  color: var(--mds-brand-deep);
  font-family: var(--mds-mono);
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 1px;
  word-break: break-all;
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
  width: 640px;
  max-width: 100%;
  max-height: 88vh;
  overflow: auto;
  border-radius: var(--mds-radius);
  background: var(--mds-card);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
}
</style>
