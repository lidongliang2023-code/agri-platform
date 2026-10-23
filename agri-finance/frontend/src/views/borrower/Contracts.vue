<template>
  <section class="finance-page">
    <header class="finance-page-heading">
      <div>
        <small>FINANCING CONTRACTS</small>
        <h1>融资合同</h1>
        <p>查看借款合同、仓单质押合同及双方签署状态。</p>
      </div>
      <div class="finance-page-heading-actions">
        <el-button class="finance-ghost-button" :loading="loading" @click="load">刷新合同</el-button>
      </div>
    </header>

    <div class="contract-summary">
      <div><span>合同总数</span><strong>{{ contracts.length }}<em> 份</em></strong></div>
      <div><span>待签署</span><strong>{{ pendingCount }}<em> 份</em></strong></div>
      <div><span>执行中</span><strong>{{ activeCount }}<em> 份</em></strong></div>
      <div><span>合同金额</span><strong>{{ money(totalAmount) }}</strong></div>
    </div>

    <div class="contract-layout">
      <section class="finance-card">
        <div class="finance-card-head">
          <strong>合同列表</strong>
          <div class="finance-tabs">
            <button type="button" :class="{ on: filter === 'all' }" @click="filter = 'all'">全部</button>
            <button type="button" :class="{ on: filter === 'sign' }" @click="filter = 'sign'">待签署</button>
            <button type="button" :class="{ on: filter === 'active' }" @click="filter = 'active'">执行中</button>
          </div>
        </div>
        <div v-if="filteredContracts.length" class="contract-list">
          <article v-for="item in filteredContracts" :key="item.id" @click="openDetail(item)">
            <span class="contract-icon"><Document /></span>
            <div class="contract-main">
              <div><strong>{{ item.contractType }}</strong><FinanceStatus :value="item.signStatus" /></div>
              <p>{{ item.contractNo }} · {{ item.loanNo || '待关联借款' }}</p>
              <span>{{ financeUser.name }} · {{ shortDate(item.createdAt) }}</span>
            </div>
            <div class="contract-value">
              <span>合同金额</span>
              <strong>{{ money(item.amount) }}</strong>
              <small>{{ item.rate }}% · {{ item.term }} 个月</small>
            </div>
            <span class="contract-arrow">→</span>
          </article>
        </div>
        <div v-else class="finance-empty">
          <strong>暂无匹配的融资合同</strong>
          <p>融资审批通过后会生成借款合同或仓单质押合同。</p>
        </div>
      </section>

      <aside class="contract-aside">
        <section class="contract-notice">
          <Lock />
          <h3>电子合同安全</h3>
          <p>合同编号、双方主体、金额、利率和签署时间均留痕保存。签署前请完整核对合同条款。</p>
          <div><span>融资方</span><strong>{{ financeUser.name }}</strong></div>
          <div><span>资金方</span><strong>平台合作资金机构</strong></div>
        </section>
        <section class="finance-card">
          <div class="finance-card-head"><strong>合同状态</strong><small>签署规则</small></div>
          <div class="contract-states">
            <div><i class="amber" /><p><strong>待签署</strong><span>双方尚未完成合同签署</span></p></div>
            <div><i class="green" /><p><strong>融资方已签</strong><span>等待资金方完成签署</span></p></div>
            <div><i class="blue" /><p><strong>已签署</strong><span>双方签署完成，合同生效</span></p></div>
          </div>
        </section>
      </aside>
    </div>

    <el-dialog v-model="detailOpen" title="合同详情" width="min(720px, 94vw)">
      <div v-if="selected" class="contract-detail">
        <div class="contract-detail-head">
          <span><Document /></span>
          <div><strong>{{ selected.contractType }}</strong><p>{{ selected.contractNo }}</p></div>
          <FinanceStatus :value="selected.signStatus" />
        </div>
        <dl>
          <div><dt>融资方</dt><dd>{{ financeUser.name }}</dd></div>
          <div><dt>资金方</dt><dd>平台合作资金机构</dd></div>
          <div><dt>合同金额</dt><dd>{{ money(selected.amount) }}</dd></div>
          <div><dt>年化利率</dt><dd>{{ selected.rate }}%</dd></div>
          <div><dt>融资期限</dt><dd>{{ selected.term }} 个月</dd></div>
          <div><dt>融资方签署时间</dt><dd>{{ shortDate(selected.borrowerSignTime) }}</dd></div>
          <div><dt>资金方签署时间</dt><dd>{{ shortDate(selected.lenderSignTime) }}</dd></div>
          <div><dt>合同起止</dt><dd>{{ shortDate(selected.startDate) }} 至 {{ shortDate(selected.endDate) }}</dd></div>
        </dl>
        <div class="contract-detail-note">
          本合同依据平台融资申请、审批结果及真实贸易背景生成。签署即表示已阅读并同意合同全部条款。
        </div>
      </div>
      <template #footer>
        <a v-if="selected?.contractUrl" :href="selected.contractUrl" target="_blank" rel="noreferrer" class="contract-file-link">查看合同文件</a>
        <el-button class="finance-ghost-button" @click="detailOpen = false">关闭</el-button>
        <el-button v-if="selected && !selected.borrowerSignTime" class="finance-action-button" :loading="signing" @click="sign">确认签署</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Document, Lock } from '@element-plus/icons-vue'
import FinanceStatus from '@/components/FinanceStatus.vue'
import { financeApi, financeUser, money, shortDate } from '@/api/finance'

const loading = ref(true)
const signing = ref(false)
const contracts = ref([])
const filter = ref('all')
const detailOpen = ref(false)
const selected = ref(null)

const pendingCount = computed(() => contracts.value.filter((item) => !item.borrowerSignTime).length)
const activeCount = computed(() => contracts.value.filter((item) => item.status === '执行中').length)
const totalAmount = computed(() => contracts.value.reduce((total, item) => total + Number(item.amount || 0), 0))
const filteredContracts = computed(() => {
  if (filter.value === 'sign') return contracts.value.filter((item) => !item.borrowerSignTime)
  if (filter.value === 'active') return contracts.value.filter((item) => item.status === '执行中')
  return contracts.value
})

function openDetail(item) {
  selected.value = item
  detailOpen.value = true
}

async function sign() {
  if (!selected.value) return
  await ElMessageBox.confirm('确认已阅读并同意合同内容，使用当前经营主体完成签署？', '确认签署合同', {
    confirmButtonText: '确认签署',
    cancelButtonText: '取消',
    type: 'info',
  })
  signing.value = true
  try {
    await financeApi.signContract(selected.value.id)
    ElMessage.success('合同签署成功')
    await load()
    selected.value = contracts.value.find((item) => item.id === selected.value.id) || selected.value
  } catch (err) {
    ElMessage.error(err.message || '合同签署失败')
  } finally {
    signing.value = false
  }
}

async function load() {
  loading.value = true
  try {
    contracts.value = (await financeApi.contracts()) || []
  } catch (err) {
    ElMessage.error(err.message || '合同加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.contract-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  overflow: hidden;
  border: 1px solid var(--fin-line);
  border-radius: 14px;
  background: #fff;
}

.contract-summary > div {
  padding: 15px 17px;
  border-left: 1px solid #edf2ee;
}

.contract-summary > div:first-child { border-left: 0; }
.contract-summary span, .contract-summary strong { display: block; }
.contract-summary span { color: #85958c; font-size: 8px; }
.contract-summary strong { margin-top: 4px; color: #244e36; font-family: ui-monospace, Consolas, monospace; font-size: 18px; }
.contract-summary em { color: #697d70; font-size: 9px; font-style: normal; }

.contract-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 290px;
  align-items: start;
  gap: 14px;
}

.contract-list { display: grid; }
.contract-list article {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) 145px 18px;
  align-items: center;
  gap: 11px;
  padding: 14px 16px;
  border-top: 1px solid #edf2ee;
  cursor: pointer;
}
.contract-list article:first-child { border-top: 0; }
.contract-list article:hover { background: #f8fbf9; }
.contract-icon {
  display: grid; width: 42px; height: 42px; place-items: center;
  border-radius: 11px; background: #e8f5ee; color: var(--fin-green-700);
}
.contract-icon svg { width: 19px; }
.contract-main { min-width: 0; }
.contract-main > div { display: flex; align-items: center; gap: 8px; }
.contract-main strong { color: #344f3f; font-size: 11px; }
.contract-main p { margin: 3px 0; color: #89988f; font-family: ui-monospace, Consolas, monospace; font-size: 8px; }
.contract-main > span { color: #8d9c93; font-size: 8px; }
.contract-value { text-align: right; }
.contract-value span, .contract-value strong, .contract-value small { display: block; }
.contract-value span { color: #8a9990; font-size: 7.5px; }
.contract-value strong { margin-top: 2px; color: #d0523f; font-family: ui-monospace, Consolas, monospace; font-size: 12px; }
.contract-value small { margin-top: 2px; color: #95a098; font-size: 7.5px; }
.contract-arrow { color: #9ba7a0; font-size: 10px; }

.contract-aside { display: grid; gap: 12px; }
.contract-notice {
  padding: 18px; border-radius: 15px;
  background: radial-gradient(circle at 88% 9%, rgba(131, 228, 170, .18), transparent 10rem), linear-gradient(135deg, #083c27, #0f7048);
  color: #fff;
}
.contract-notice > svg { width: 25px; color: #bcefd0; }
.contract-notice h3 { margin: 10px 0 5px; font-size: 17px; }
.contract-notice > p { margin: 0 0 13px; color: rgba(255, 255, 255, .59); font-size: 8.5px; line-height: 1.65; }
.contract-notice > div { display: flex; justify-content: space-between; padding: 8px 0; border-top: 1px solid rgba(255, 255, 255, .1); font-size: 8px; }
.contract-notice span { color: rgba(255, 255, 255, .48); }
.contract-notice strong { color: #fff; }
.contract-states { display: grid; padding: 13px 15px; }
.contract-states > div { display: flex; gap: 8px; padding: 8px 0; border-top: 1px solid #edf2ee; }
.contract-states > div:first-child { border-top: 0; }
.contract-states i { width: 7px; height: 7px; flex: 0 0 auto; margin-top: 4px; border-radius: 50%; }
.contract-states i.amber { background: #d89527; }
.contract-states i.green { background: #1b925c; }
.contract-states i.blue { background: #397fa4; }
.contract-states p { margin: 0; }
.contract-states strong, .contract-states span { display: block; }
.contract-states strong { color: #415b4a; font-size: 9px; }
.contract-states span { margin-top: 2px; color: #8a9991; font-size: 8px; }

.contract-detail-head {
  display: grid; grid-template-columns: 43px minmax(0, 1fr) auto; align-items: center; gap: 10px;
  padding-bottom: 13px; border-bottom: 1px solid #edf2ee;
}
.contract-detail-head > span { display: grid; width: 43px; height: 43px; place-items: center; border-radius: 12px; background: #e8f5ee; color: var(--fin-green-700); }
.contract-detail-head > span svg { width: 19px; }
.contract-detail-head strong { color: #2f4a39; font-size: 13px; }
.contract-detail-head p { margin: 3px 0 0; color: #8a9991; font-family: ui-monospace, Consolas, monospace; font-size: 8px; }
.contract-detail dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; margin: 14px 0; overflow: hidden; border-radius: 10px; background: #edf2ee; }
.contract-detail dl > div { padding: 10px 12px; background: #f8fbf9; }
.contract-detail dt { color: #8a9990; font-size: 8px; }
.contract-detail dd { margin: 3px 0 0; color: #3d5847; font-size: 10px; }
.contract-detail-note { padding: 12px; border-radius: 9px; background: #f0f9f4; color: #60776a; font-size: 8.5px; line-height: 1.65; }
.contract-file-link { margin-right: auto; color: var(--fin-green-700); font-size: 9px; text-decoration: none; }

@media (max-width: 900px) {
  .contract-layout { grid-template-columns: 1fr; }
  .contract-aside { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 680px) {
  .contract-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .contract-summary > div:nth-child(3) { border-top: 1px solid #edf2ee; border-left: 0; }
  .contract-summary > div:nth-child(4) { border-top: 1px solid #edf2ee; }
  .contract-list article { grid-template-columns: 38px minmax(0, 1fr) auto; }
  .contract-value { grid-column: 2; text-align: left; }
  .contract-arrow { grid-column: 3; grid-row: 1 / span 2; }
  .contract-aside { grid-template-columns: 1fr; }
  .contract-detail dl { grid-template-columns: 1fr; }
}
</style>
