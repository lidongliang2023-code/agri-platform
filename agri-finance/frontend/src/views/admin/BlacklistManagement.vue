<template>
  <section class="finance-page">
    <header class="finance-page-heading">
      <div><small>BLACKLIST MANAGEMENT</small><h1>黑名单管理</h1><p>维护企业、个人和关联方黑名单，阻断高风险融资准入。</p></div>
      <div class="finance-page-heading-actions"><el-button class="finance-action-button" @click="createOpen = true">新增黑名单</el-button></div>
    </header>
    <div class="finance-kpis">
      <article class="finance-kpi"><span>黑名单记录</span><strong>{{ entries.length }}<em> 条</em></strong><small>企业、个人与关联方</small></article>
      <article class="finance-kpi"><span>已通过</span><strong>{{ approved.length }}<em> 条</em></strong><small>当前生效</small></article>
      <article class="finance-kpi"><span>待复核</span><strong>{{ pending.length }}<em> 条</em></strong><small>需完成证据核验</small></article>
      <article class="finance-kpi"><span>企业名单</span><strong>{{ enterpriseCount }}<em> 条</em></strong><small>企业及关联主体</small></article>
    </div>
    <AgriElementListTable
      :columns="blacklistColumns"
      :data="filtered"
      row-key="id"
      :loading="loading"
      client-pagination
      column-settings-storage-key="agri-finance:admin-blacklist"
      empty-text="暂无匹配名单，黑名单审核通过后将参与融资准入检查"
      @refresh="load"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="3" :loading="loading" @search="applyFilter" @reset="resetFilter">
          <div class="agri-vue-filter-field">
            <label>关键字</label>
            <el-input v-model="draft.keyword" clearable placeholder="名单编号 / 主体名称 / 列入原因" @keyup.enter="applyFilter" />
          </div>
          <div class="agri-vue-filter-field">
            <label>主体类型</label>
            <el-select v-model="draft.listType" clearable placeholder="全部类型">
              <el-option label="全部" value="" />
              <el-option label="企业" value="ENTERPRISE" />
              <el-option label="个人" value="PERSON" />
            </el-select>
          </div>
          <div class="agri-vue-filter-field">
            <label>审核状态</label>
            <el-select v-model="draft.status" placeholder="全部状态">
              <el-option label="全部" value="all" />
              <el-option label="待复核" value="pending" />
              <el-option label="已通过" value="approved" />
            </el-select>
          </div>
        </AgriVueFilterBar>
      </template>
      <template #toolbar-left>
        <el-button class="finance-action-button" @click="createOpen = true">+ 新增黑名单</el-button>
        <div class="finance-tabs">
          <button type="button" :class="{ on: filter === 'all' }" @click="selectTab('all')">全部</button>
          <button type="button" :class="{ on: filter === 'pending' }" @click="selectTab('pending')">待复核</button>
          <button type="button" :class="{ on: filter === 'approved' }" @click="selectTab('approved')">已通过</button>
        </div>
      </template>
      <template #cell-listType="{ row }">{{ row.listType === 'ENTERPRISE' ? '企业' : row.listType === 'PERSON' ? '个人' : (row.listType || '—') }}</template>
      <template #cell-reviewStatus="{ row }"><FinanceStatus :value="row.reviewStatus" /></template>
      <template #cell-actions="{ row }">
        <AgriVueRowActions :actions="blacklistRowActions(row)" />
      </template>
    </AgriElementListTable>
    <el-dialog v-model="createOpen" title="新增黑名单" width="min(560px, 92vw)">
      <el-form :model="form" label-position="top">
        <div class="finance-form-grid"><el-form-item label="主体名称"><el-input v-model="form.userName" placeholder="请输入企业或个人名称" /></el-form-item><el-form-item label="主体 ID"><el-input v-model="form.userId" placeholder="请输入主体 ID" /></el-form-item></div>
        <el-form-item label="类型"><el-select v-model="form.listType" style="width: 100%"><el-option label="企业" value="ENTERPRISE" /><el-option label="个人" value="PERSON" /></el-select></el-form-item>
        <el-form-item label="列入原因"><el-input v-model="form.reason" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="证据说明"><el-input v-model="form.evidence" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button class="finance-ghost-button" @click="createOpen = false">取消</el-button><el-button class="finance-action-button" :loading="saving" @click="create">提交审核</el-button></template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { AgriElementListTable, AgriVueFilterBar, AgriVueRowActions } from '@agri/shared/vue/element'
import FinanceStatus from '@/components/FinanceStatus.vue'
import { operationsApi } from '@/api/operations'

const blacklistColumns = [
  { key: 'listNo', prop: 'listNo', label: '名单编号', kind: 'code', minWidth: 135, locked: true },
  { key: 'userName', prop: 'userName', label: '主体', minWidth: 145 },
  { key: 'listType', prop: 'listType', label: '类型', width: 90 },
  { key: 'reason', prop: 'reason', label: '列入原因', minWidth: 220 },
  { key: 'reviewerName', prop: 'reviewerName', label: '审核人', width: 96 },
  { key: 'reviewStatus', prop: 'reviewStatus', label: '状态', kind: 'status', width: 96 },
  { key: 'actions', label: '操作', kind: 'action', width: 135 },
]

const loading = ref(true)
const saving = ref(false)
const entries = ref([])
const filter = ref('all')
const draft = reactive({ keyword: '', listType: '', status: 'all' })
const query = reactive({ keyword: '', listType: '' })
const createOpen = ref(false)
const form = reactive({ userName: '', userId: '', listType: 'ENTERPRISE', reason: '', evidence: '' })
const approved = computed(() => entries.value.filter((item) => item.reviewStatus === '已通过' && !item.removedTime))
const pending = computed(() => entries.value.filter((item) => item.reviewStatus === '待复核'))
const enterpriseCount = computed(() => approved.value.filter((item) => item.listType === 'ENTERPRISE').length)

function applyFilter() {
  query.keyword = draft.keyword
  query.listType = draft.listType
  filter.value = draft.status || 'all'
}

function resetFilter() {
  draft.keyword = ''
  draft.listType = ''
  draft.status = 'all'
  applyFilter()
}

function selectTab(key) {
  filter.value = key
  draft.status = key
}

const filtered = computed(() => {
  const base = filter.value === 'pending' ? pending.value : filter.value === 'approved' ? approved.value : entries.value
  const kw = query.keyword.trim().toLowerCase()
  return base.filter((item) => {
    if (query.listType && item.listType !== query.listType) return false
    if (kw && !`${item.listNo || ''}${item.userName || ''}${item.reason || ''}`.toLowerCase().includes(kw)) return false
    return true
  })
})

function blacklistRowActions(row) {
  const list = []
  if (row.reviewStatus === '待复核') list.push({ key: 'approve', label: '审核通过', onClick: () => approve(row) })
  if (!row.removedTime) list.push({ key: 'remove', label: '移除', danger: true, onClick: () => remove(row) })
  return list
}

async function approve(row) {
  await ElMessageBox.confirm(`确认将 ${row.userName} 加入黑名单？`, '审核黑名单', { confirmButtonText: '审核通过', cancelButtonText: '取消', type: 'warning' })
  try { await operationsApi.approveBlacklist(row.id); ElMessage.success('名单审核通过'); await load() } catch (err) { ElMessage.error(err.message || '审核失败') }
}

async function remove(row) {
  await ElMessageBox.confirm(`确认从黑名单移除 ${row.userName}？`, '移除黑名单', { confirmButtonText: '确认移除', cancelButtonText: '取消', type: 'warning' })
  try { await operationsApi.removeBlacklist(row.id); ElMessage.success('已移出黑名单'); await load() } catch (err) { ElMessage.error(err.message || '移除失败') }
}

async function create() {
  if (!form.userName || !form.userId || !form.reason) { ElMessage.warning('请填写主体和列入原因'); return }
  saving.value = true
  try { await operationsApi.addBlacklist({ ...form }); ElMessage.success('黑名单申请已提交复核'); createOpen.value = false; Object.assign(form, { userName: '', userId: '', listType: 'ENTERPRISE', reason: '', evidence: '' }); await load() } catch (err) { ElMessage.error(err.message || '提交失败') } finally { saving.value = false }
}

async function load() {
  loading.value = true
  try { entries.value = (await operationsApi.blacklist()) || [] } catch (err) { ElMessage.error(err.message || '黑名单加载失败') } finally { loading.value = false }
}

onMounted(load)
</script>

<style scoped>
.finance-kpi em { color: #60776a; font-size: var(--fin-fs-xs); font-style: normal; }
</style>
