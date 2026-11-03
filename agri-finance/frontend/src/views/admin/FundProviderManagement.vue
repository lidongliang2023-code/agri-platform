<template>
  <section class="finance-page">
    <header class="finance-page-heading">
      <div>
        <small>FUND INSTITUTION LEDGER</small>
        <h1>资金机构与主体绑定</h1>
        <p>维护资金机构的准入审核与「平台经营主体」绑定关系 —— 决定哪个登录账号能进哪家机构的资金工作台。</p>
      </div>
      <div class="finance-page-heading-actions">
        <el-input v-model="keyword" clearable placeholder="搜索机构名称 / 编号 / 信用代码" class="provider-search" :prefix-icon="Search" @change="load" />
        <el-button class="finance-ghost-button" :loading="loading" @click="load">刷新</el-button>
      </div>
    </header>

    <div v-if="error" class="provider-error">
      <span>{{ error }}</span>
      <el-button link @click="load">重新加载</el-button>
    </div>

    <el-skeleton v-if="loading && !items.length" :rows="7" animated />

    <template v-else>
      <div class="finance-kpis">
        <article class="finance-kpi"><span>资金机构</span><strong>{{ summary.total || 0 }}<em> 家</em></strong><small>在册未注销</small></article>
        <article class="finance-kpi"><span>已绑定主体</span><strong>{{ summary.boundCount || 0 }}<em> 家</em></strong><small>账号可进资金工作台</small></article>
        <article class="finance-kpi"><span>未绑定主体</span><strong>{{ summary.unboundCount || 0 }}<em> 家</em></strong><small>登录后会被明确拒绝</small></article>
        <article class="finance-kpi"><span>待准入审核</span><strong>{{ summary.pendingCount || 0 }}<em> 家</em></strong><small>需核验牌照与资金能力</small></article>
      </div>

      <section class="finance-card">
        <div class="finance-card-head">
          <strong>机构台账</strong>
          <div class="finance-tabs">
            <button type="button" :class="{ on: bound === '' }" @click="switchBound('')">全部</button>
            <button type="button" :class="{ on: bound === 'bound' }" @click="switchBound('bound')">已绑定</button>
            <button type="button" :class="{ on: bound === 'unbound' }" @click="switchBound('unbound')">未绑定</button>
          </div>
        </div>
        <el-table v-if="items.length" :data="items" style="width: 100%">
          <el-table-column label="机构" min-width="200">
            <template #default="{ row }">
              <div class="provider-subject">
                <span>{{ row.institutionName?.slice(0, 1) || '机' }}</span>
                <div>
                  <strong>{{ row.institutionName }}</strong>
                  <small>{{ row.providerNo }} · {{ row.creditCode || '无统一社会信用代码' }}</small>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="类型" width="100">
            <template #default="{ row }">{{ institutionType(row.institutionType) }}</template>
          </el-table-column>
          <el-table-column label="准入状态" width="100">
            <template #default="{ row }">
              <FinanceStatus :value="row.reviewStatus || '待审核'" />
              <small v-if="row.reviewOpinion" class="provider-opinion">{{ row.reviewOpinion }}</small>
            </template>
          </el-table-column>
          <el-table-column label="绑定经营主体" min-width="210">
            <template #default="{ row }">
              <template v-if="row.merchantId">
                <strong class="provider-merchant">{{ row.merchantName || row.merchantId }}</strong>
                <small class="provider-merchant-id">{{ row.merchantId }}</small>
              </template>
              <span v-else class="provider-muted">未绑定 · 该机构账号无法进入资金工作台</span>
            </template>
          </el-table-column>
          <el-table-column label="联系人" width="130">
            <template #default="{ row }">
              <span>{{ row.contactName || '—' }}</span>
              <small class="provider-merchant-id">{{ row.contactPhone || '' }}</small>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="190" align="right">
            <template #default="{ row }">
              <el-button link class="finance-link-button" @click="openBind(row)">{{ row.merchantId ? '换绑主体' : '绑定主体' }}</el-button>
              <el-button v-if="row.merchantId" link class="finance-link-button" @click="unbind(row)">解绑</el-button>
              <template v-if="(row.reviewStatus || '待审核') === '待审核'">
                <el-button link class="finance-link-button" @click="decide(row, true)">通过</el-button>
                <el-button link class="finance-link-button danger" @click="decide(row, false)">拒绝</el-button>
              </template>
            </template>
          </el-table-column>
        </el-table>
        <div v-else class="finance-empty">
          <strong>暂无资金机构</strong>
          <p>机构在资金方端提交注册后进入这里审核与绑定。</p>
        </div>
      </section>
    </template>

    <el-dialog v-model="bindOpen" :title="`绑定经营主体 · ${target?.institutionName || ''}`" width="min(620px, 94vw)">
      <p class="provider-dialog-tip">
        绑定的主体号决定登录身份：资金方账号必须已绑定该平台经营主体，
        进入资金端时后端按访问令牌解析出这家机构，前端无法再指定别人的机构。
      </p>
      <el-select
        v-model="selectedMerchant"
        filterable
        remote
        :remote-method="searchMerchants"
        :loading="searching"
        placeholder="输入主体名称搜索（支持统一社会信用代码）"
        style="width: 100%"
      >
        <el-option
          v-for="option in merchants"
          :key="option.merchantId"
          :label="`${option.merchantName}（${option.merchantId}）`"
          :value="option.merchantId"
        >
          <div class="provider-option">
            <strong>{{ option.merchantName }}</strong>
            <small>{{ option.merchantId }} · {{ option.creditCode || '无信用代码' }} ·
              {{ option.verifyStatus === 'approved' ? '认证通过' : '认证未通过' }}</small>
          </div>
        </el-option>
      </el-select>
      <div v-if="target?.merchantId" class="provider-dialog-current">
        当前绑定：{{ target.merchantName || '—' }}（{{ target.merchantId }}）
      </div>
      <template #footer>
        <el-button class="finance-ghost-button" @click="bindOpen = false">取消</el-button>
        <el-button class="finance-action-button" :loading="saving" :disabled="!selectedMerchant" @click="saveBind">
          确认绑定
        </el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import FinanceStatus from '@/components/FinanceStatus.vue'
import { operationsApi } from '@/api/operations'

const loading = ref(true)
const saving = ref(false)
const searching = ref(false)
const error = ref('')
const items = ref([])
const summary = ref({})
const keyword = ref('')
const bound = ref('')
const bindOpen = ref(false)
const target = ref(null)
const selectedMerchant = ref('')
const merchants = ref([])

const pendingCount = computed(() => items.value.filter((item) => (item.reviewStatus || '待审核') === '待审核').length)

function institutionType(value) {
  return { BANK: '银行', TRUST: '信托', FACTOR: '商业保理', GUARANTEE: '担保', LEASE: '融资租赁' }[value] || value || '其他'
}

function switchBound(value) {
  bound.value = value
  load()
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await operationsApi.providerList({ keyword: keyword.value, bound: bound.value })
    items.value = data?.items || []
    summary.value = { ...(data?.summary || {}), pendingCount: pendingCount.value }
  } catch (err) {
    error.value = err.message || '资金机构台账加载失败'
  } finally {
    loading.value = false
  }
}

async function searchMerchants(query) {
  searching.value = true
  try {
    merchants.value = (await operationsApi.merchantOptions(query)) || []
  } catch (err) {
    ElMessage.error(err.message || '经营主体搜索失败')
  } finally {
    searching.value = false
  }
}

function openBind(row) {
  target.value = row
  selectedMerchant.value = ''
  merchants.value = row.merchantId
    ? [{ merchantId: row.merchantId, merchantName: row.merchantName || row.merchantId, creditCode: '', verifyStatus: '' }]
    : []
  bindOpen.value = true
}

async function saveBind() {
  if (!target.value || !selectedMerchant.value) return
  saving.value = true
  try {
    await operationsApi.bindProvider(target.value.id, selectedMerchant.value)
    ElMessage.success('绑定已保存')
    bindOpen.value = false
    await load()
  } catch (err) {
    ElMessage.error(err.message || '绑定失败')
  } finally {
    saving.value = false
  }
}

async function unbind(row) {
  await ElMessageBox.confirm(
    `解除「${row.institutionName}」与主体 ${row.merchantId} 的绑定？解绑后该机构的账号将无法进入资金工作台。`,
    '确认解绑', { confirmButtonText: '确认解绑', cancelButtonText: '取消', type: 'warning' },
  )
  try {
    await operationsApi.bindProvider(row.id, '')
    ElMessage.success('已解绑')
    await load()
  } catch (err) {
    ElMessage.error(err.message || '解绑失败')
  }
}

async function decide(row, approved) {
  const opinion = await ElMessageBox.prompt(
    approved ? `通过「${row.institutionName}」的准入审核？通过后该机构才能参与审批与配置资金。`
      : `拒绝「${row.institutionName}」的准入申请，请填写原因。`,
    approved ? '准入通过' : '准入拒绝',
    {
      confirmButtonText: approved ? '确认通过' : '确认拒绝',
      cancelButtonText: '返回检查',
      inputPlaceholder: approved ? '审核意见（可留空）' : '拒绝原因',
      inputValue: approved ? '机构资质与资金能力审核通过' : '',
      inputValidator: (value) => (approved || (value && value.trim()) ? true : '拒绝必须填写原因'),
    },
  ).then(({ value }) => value || '').catch(() => null)
  if (opinion === null) return
  try {
    await operationsApi.reviewProvider(row.id, approved, opinion)
    ElMessage.success(approved ? '准入已通过' : '准入已拒绝')
    await load()
  } catch (err) {
    ElMessage.error(err.message || '审核失败')
  }
}

onMounted(load)
</script>

<style scoped>
.provider-error { display: flex; align-items: center; justify-content: space-between; padding: 11px 14px; border: 1px solid #efd4ce; border-radius: 10px; background: #fff8f6; color: #a44f3f; font-size: 12px; }
.provider-search { width: 260px; }
.provider-subject { display: flex; align-items: center; gap: 8px; }
.provider-subject > span { display: grid; width: 32px; height: 32px; place-items: center; border-radius: 8px; background: #e8f5ee; color: #27704d; font-size: 13px; font-weight: 700; }
.provider-subject strong, .provider-subject small { display: block; }
.provider-subject strong { color: #3a5544; font-size: 13px; }
.provider-subject small { margin-top: 2px; color: #8b9a92; font-family: ui-monospace, Consolas, monospace; font-size: var(--fin-fs-xs); }
.provider-opinion { display: block; margin-top: 4px; color: #8b9991; font-size: var(--fin-fs-xs); }
.provider-merchant { display: block; color: #2f6647; font-size: 13px; }
.provider-merchant-id { display: block; color: #8b9a92; font-family: ui-monospace, Consolas, monospace; font-size: var(--fin-fs-xs); }
.provider-muted { color: #9b865b; font-size: 12px; }
.provider-dialog-tip { margin: 0 0 12px; color: #6d8275; font-size: 12px; line-height: 1.7; }
.provider-dialog-current { margin-top: 10px; color: #8b9991; font-size: var(--fin-fs-xs); }
.provider-option strong, .provider-option small { display: block; }
.provider-option strong { color: #34563f; font-size: 13px; }
.provider-option small { color: #8b9991; font-family: ui-monospace, Consolas, monospace; font-size: var(--fin-fs-xs); }
.finance-link-button.danger { color: #a44f3f; }
@media (max-width: 700px) { .provider-search { width: 100%; } }
</style>
