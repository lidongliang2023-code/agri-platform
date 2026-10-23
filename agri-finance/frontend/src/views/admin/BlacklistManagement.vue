<template>
  <section class="finance-page">
    <header class="finance-page-heading">
      <div><small>BLACKLIST MANAGEMENT</small><h1>黑名单管理</h1><p>维护企业、个人和关联方黑名单，阻断高风险融资准入。</p></div>
      <div class="finance-page-heading-actions"><el-button class="finance-ghost-button" :loading="loading" @click="load">刷新</el-button><el-button class="finance-action-button" @click="createOpen = true">新增黑名单</el-button></div>
    </header>
    <div class="finance-kpis">
      <article class="finance-kpi"><span>黑名单记录</span><strong>{{ entries.length }}<em> 条</em></strong><small>企业、个人与关联方</small></article>
      <article class="finance-kpi"><span>已通过</span><strong>{{ approved.length }}<em> 条</em></strong><small>当前生效</small></article>
      <article class="finance-kpi"><span>待复核</span><strong>{{ pending.length }}<em> 条</em></strong><small>需完成证据核验</small></article>
      <article class="finance-kpi"><span>企业名单</span><strong>{{ enterpriseCount }}<em> 条</em></strong><small>企业及关联主体</small></article>
    </div>
    <section class="finance-card">
      <div class="finance-card-head"><strong>名单记录</strong><div class="finance-tabs"><button type="button" :class="{ on: filter === 'all' }" @click="filter = 'all'">全部</button><button type="button" :class="{ on: filter === 'pending' }" @click="filter = 'pending'">待复核</button><button type="button" :class="{ on: filter === 'approved' }" @click="filter = 'approved'">已通过</button></div></div>
      <el-table :data="filtered" style="width: 100%">
        <el-table-column prop="listNo" label="名单编号" min-width="125" />
        <el-table-column prop="userName" label="主体" min-width="140" />
        <el-table-column prop="listType" label="类型" width="90" />
        <el-table-column prop="reason" label="列入原因" min-width="220" show-overflow-tooltip />
        <el-table-column prop="reviewerName" label="审核人" width="90" />
        <el-table-column label="状态" width="90"><template #default="{ row }"><FinanceStatus :value="row.reviewStatus" /></template></el-table-column>
        <el-table-column label="操作" width="135" align="right"><template #default="{ row }"><el-button v-if="row.reviewStatus === '待复核'" link class="finance-link-button" @click="approve(row)">审核通过</el-button><el-button v-if="!row.removedTime" link class="finance-link-button" @click="remove(row)">移除</el-button></template></el-table-column>
      </el-table>
      <div v-if="!filtered.length" class="finance-empty"><strong>暂无匹配名单</strong><p>黑名单审核通过后将参与融资准入检查。</p></div>
    </section>
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
import FinanceStatus from '@/components/FinanceStatus.vue'
import { operationsApi } from '@/api/operations'

const loading = ref(true)
const saving = ref(false)
const entries = ref([])
const filter = ref('all')
const createOpen = ref(false)
const form = reactive({ userName: '', userId: '', listType: 'ENTERPRISE', reason: '', evidence: '' })
const approved = computed(() => entries.value.filter((item) => item.reviewStatus === '已通过' && !item.removedTime))
const pending = computed(() => entries.value.filter((item) => item.reviewStatus === '待复核'))
const enterpriseCount = computed(() => approved.value.filter((item) => item.listType === 'ENTERPRISE').length)
const filtered = computed(() => filter.value === 'pending' ? pending.value : filter.value === 'approved' ? approved.value : entries.value)

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
.finance-kpi em { color: #60776a; font-size: 10px; font-style: normal; }
</style>
