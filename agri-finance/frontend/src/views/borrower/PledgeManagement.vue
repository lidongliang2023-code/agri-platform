<template>
  <section class="finance-page">
    <header class="finance-page-heading">
      <div>
        <small>WAREHOUSE RECEIPT & PLEDGE</small>
        <h1>仓单与质押</h1>
        <p>以真实库存形成仓单质押，作为收购贷等融资产品的贸易背景和增信依据。</p>
      </div>
      <div class="finance-page-heading-actions">
        <el-button class="finance-ghost-button" :loading="loading" @click="load">刷新</el-button>
        <el-button class="finance-action-button" @click="openCreate">发起仓单质押</el-button>
      </div>
    </header>

    <div class="finance-kpis">
      <article class="finance-kpi">
        <span>质押仓单</span>
        <strong>{{ pledges.length }}<em> 笔</em></strong>
        <small>{{ activePledges.length }} 笔已生效</small>
      </article>
      <article class="finance-kpi">
        <span>质押物价值</span>
        <strong>{{ compactMoney(totalCollateralValue) }}</strong>
        <small>按申报数量与单价计算</small>
      </article>
      <article class="finance-kpi">
        <span>可融资额度</span>
        <strong>{{ compactMoney(pledgeLoanLimit) }}</strong>
        <small>按质押率测算</small>
      </article>
      <article class="finance-kpi">
        <span>待审核</span>
        <strong>{{ pendingPledges.length }}<em> 笔</em></strong>
        <small>平台审核后形成有效质押</small>
      </article>
    </div>

    <div class="pledge-layout">
      <section class="finance-card">
        <div class="finance-card-head">
          <strong>我的仓单质押</strong>
          <div class="finance-tabs">
            <button v-for="item in filters" :key="item.key" type="button" :class="{ on: activeFilter === item.key }" @click="activeFilter = item.key">
              {{ item.label }}
            </button>
          </div>
        </div>
        <div v-if="filteredPledges.length" class="pledge-list">
          <article v-for="item in filteredPledges" :key="item.id">
            <div class="pledge-card-head">
              <span class="pledge-icon"><Box /></span>
              <div><strong>{{ item.commodityType }}</strong><p>{{ item.pledgeNo }}</p></div>
              <FinanceStatus :value="item.status" />
            </div>
            <div class="pledge-values">
              <div><span>数量</span><strong>{{ item.quantity }} 吨</strong></div>
              <div><span>单价</span><strong>{{ money(item.unitPrice) }}</strong></div>
              <div><span>质押物价值</span><strong>{{ money(item.totalValue) }}</strong></div>
              <div><span>预计可融资</span><strong class="green">{{ money(item.loanAmount) }}</strong></div>
            </div>
            <div class="pledge-meta">
              <span><OfficeBuilding /> {{ item.warehouseName || '仓库待确认' }}</span>
              <span>质押率 {{ item.pledgeRate }}%</span>
              <span>{{ shortDate(item.pledgeDate) }}</span>
            </div>
          </article>
        </div>
        <div v-else class="finance-empty">
          <strong>暂无匹配的质押记录</strong>
          <p>仓单质押需要填写真实仓储、品类、数量和单价，平台审核后生效。</p>
        </div>
      </section>

      <aside class="pledge-aside">
        <section class="pledge-guide">
          <Box />
          <h3>仓单质押融资</h3>
          <p>以库存农产品作为质押物，结合真实仓储和质检信息形成可核验的融资依据。</p>
          <div><span>质押率</span><strong>最高 70%</strong></div>
          <div><span>适用产品</span><strong>收购贷 / 销售贷</strong></div>
          <el-button class="pledge-guide-button" @click="openCreate">发起质押申请</el-button>
        </section>
        <section class="finance-card">
          <div class="finance-card-head"><strong>申请材料</strong><small>建议提前准备</small></div>
          <ul class="pledge-material">
            <li>真实有效的仓储入库单</li>
            <li>货物品种、数量与质检等级</li>
            <li>采购合同或销售订单</li>
            <li>仓单持有人及仓库信息</li>
          </ul>
        </section>
      </aside>
    </div>

    <el-dialog v-model="createOpen" title="发起仓单质押" width="min(620px, 92vw)">
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <div class="finance-form-grid">
          <el-form-item label="质押物类型" prop="commodityType">
            <el-input v-model="form.commodityType" placeholder="例如：优质稻谷、冷链苹果" />
          </el-form-item>
          <el-form-item label="质量等级">
            <el-input v-model="form.qualityStandard" placeholder="例如：一级" />
          </el-form-item>
        </div>
        <div class="finance-form-grid">
          <el-form-item label="数量（吨）" prop="quantity">
            <el-input v-model="form.quantity" inputmode="decimal" />
          </el-form-item>
          <el-form-item label="单价（元/吨）" prop="unitPrice">
            <el-input v-model="form.unitPrice" inputmode="decimal" />
          </el-form-item>
        </div>
        <div class="finance-form-grid">
          <el-form-item label="质押率（%）">
            <el-input-number v-model="form.pledgeRate" :min="30" :max="70" :step="5" style="width: 100%" />
          </el-form-item>
          <el-form-item label="预计可融资">
            <div class="pledge-calc">{{ money(estimatedLoan) }}</div>
          </el-form-item>
        </div>
        <el-form-item label="仓库名称">
          <el-input v-model="form.warehouseName" placeholder="例如：丰链云临沂中心仓" />
        </el-form-item>
        <el-form-item label="仓库地址">
          <el-input v-model="form.warehouseAddress" placeholder="请输入仓库详细地址" />
        </el-form-item>
      </el-form>
      <div class="pledge-dialog-summary">
        <span>质押物价值 <b>{{ money(collateralValue) }}</b></span>
        <span>融资测算 <b>{{ money(estimatedLoan) }}</b></span>
      </div>
      <template #footer>
        <el-button class="finance-ghost-button" @click="createOpen = false">取消</el-button>
        <el-button class="finance-action-button" :loading="submitting" @click="submit">提交审核</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Box, OfficeBuilding } from '@element-plus/icons-vue'
import FinanceStatus from '@/components/FinanceStatus.vue'
import { financeApi, money, shortDate } from '@/api/finance'

const loading = ref(true)
const createOpen = ref(false)
const submitting = ref(false)
const pledges = ref([])
const activeFilter = ref('all')
const formRef = ref()
const filters = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '已生效' },
  { key: 'pending', label: '待审核' },
]
const form = reactive({
  commodityType: '',
  qualityStandard: '',
  quantity: '',
  unitPrice: '',
  pledgeRate: 70,
  warehouseName: '',
  warehouseAddress: '',
})

const rules = {
  commodityType: [{ required: true, message: '请填写质押物类型', trigger: 'blur' }],
  quantity: [{ required: true, message: '请填写数量', trigger: 'blur' }],
  unitPrice: [{ required: true, message: '请填写单价', trigger: 'blur' }],
}

const activePledges = computed(() => pledges.value.filter((item) => item.status === '已生效'))
const pendingPledges = computed(() => pledges.value.filter((item) => item.status === '待审核'))
const totalCollateralValue = computed(() => pledges.value.reduce((total, item) => total + Number(item.totalValue || 0), 0))
const pledgeLoanLimit = computed(() => pledges.value.reduce((total, item) => total + Number(item.loanAmount || 0), 0))
const collateralValue = computed(() => Number(form.quantity || 0) * Number(form.unitPrice || 0))
const estimatedLoan = computed(() => collateralValue.value * Number(form.pledgeRate || 0) / 100)
const filteredPledges = computed(() => {
  if (activeFilter.value === 'active') return activePledges.value
  if (activeFilter.value === 'pending') return pendingPledges.value
  return pledges.value
})

function compactMoney(value) {
  const amount = Number(value || 0)
  return amount >= 10000 ? `¥${(amount / 10000).toFixed(1)}万` : money(amount)
}

function openCreate() {
  Object.assign(form, {
    commodityType: '', qualityStandard: '', quantity: '', unitPrice: '',
    pledgeRate: 70, warehouseName: '', warehouseAddress: '',
  })
  createOpen.value = true
}

async function submit() {
  await formRef.value.validate()
  if (Number(form.quantity) <= 0 || Number(form.unitPrice) <= 0) {
    ElMessage.warning('数量和单价必须大于 0')
    return
  }
  submitting.value = true
  try {
    await financeApi.createPledge({
      commodityType: form.commodityType,
      qualityStandard: form.qualityStandard,
      quantity: Number(form.quantity),
      unitPrice: Number(form.unitPrice),
      pledgeRate: Number(form.pledgeRate),
      warehouseName: form.warehouseName,
      warehouseAddress: form.warehouseAddress,
    })
    ElMessage.success('仓单质押申请已提交')
    createOpen.value = false
    await load()
  } catch (err) {
    ElMessage.error(err.message || '仓单质押提交失败')
  } finally {
    submitting.value = false
  }
}

async function load() {
  loading.value = true
  try {
    pledges.value = (await financeApi.pledges()) || []
  } catch (err) {
    ElMessage.error(err.message || '质押记录加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.finance-kpi em { color: #61786a; font-size: 10px; font-style: normal; }

.pledge-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 290px;
  align-items: start;
  gap: 14px;
}

.pledge-list {
  display: grid;
  gap: 10px;
  padding: 11px;
}

.pledge-list article {
  padding: 14px;
  border: 1px solid #e3ebe6;
  border-radius: 12px;
  background: #fff;
}

.pledge-card-head {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}

.pledge-icon {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 11px;
  background: #e7f6ed;
  color: var(--fin-green-700);
}

.pledge-icon svg { width: 18px; }
.pledge-card-head strong { color: #344f3f; font-size: 11px; }
.pledge-card-head p { margin: 3px 0 0; color: #8b9a92; font-family: ui-monospace, Consolas, monospace; font-size: 8px; }

.pledge-values {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
  margin: 12px 0 10px;
  overflow: hidden;
  border-radius: 9px;
  background: #edf2ee;
}

.pledge-values > div { padding: 9px 10px; background: #f8fbf9; }
.pledge-values span, .pledge-values strong { display: block; }
.pledge-values span { color: #8b9a91; font-size: 7.5px; }
.pledge-values strong { margin-top: 3px; color: #395544; font-family: ui-monospace, Consolas, monospace; font-size: 9px; }
.pledge-values strong.green { color: #16764a; }

.pledge-meta {
  display: flex;
  align-items: center;
  gap: 14px;
  color: #87968d;
  font-size: 8px;
}

.pledge-meta span { display: inline-flex; align-items: center; gap: 4px; }
.pledge-meta svg { width: 12px; color: #6e927c; }

.pledge-aside {
  display: grid;
  gap: 12px;
}

.pledge-guide {
  padding: 18px;
  border-radius: 15px;
  background:
    radial-gradient(circle at 88% 10%, rgba(131, 228, 170, .18), transparent 10rem),
    linear-gradient(135deg, #083c27, #0f7048);
  color: #fff;
}

.pledge-guide > svg { width: 24px; color: #bdeed0; }
.pledge-guide h3 { margin: 10px 0 5px; font-size: 17px; }
.pledge-guide > p { margin: 0 0 14px; color: rgba(255, 255, 255, .6); font-size: 8.5px; line-height: 1.65; }
.pledge-guide > div { display: flex; justify-content: space-between; padding: 8px 0; border-top: 1px solid rgba(255, 255, 255, .1); font-size: 8px; }
.pledge-guide > div span { color: rgba(255, 255, 255, .5); }
.pledge-guide > div strong { color: #fff; }

.pledge-guide-button.el-button {
  width: 100%;
  margin-top: 13px;
  border-color: #fff;
  border-radius: 9px;
  background: #fff;
  color: var(--fin-green-800);
  font-size: 9px;
  font-weight: 700;
}

.pledge-material {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 13px 16px 13px 31px;
  color: #71857a;
  font-size: 8.5px;
}

.pledge-material li::marker { color: var(--fin-green-600); }

.pledge-calc {
  display: flex;
  height: 32px;
  align-items: center;
  color: #d0523f;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 13px;
  font-weight: 700;
}

.pledge-dialog-summary {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 13px;
  border-radius: 9px;
  background: #f4f9f6;
  color: #73867a;
  font-size: 9px;
}

.pledge-dialog-summary b { color: var(--fin-green-800); }

@media (max-width: 900px) {
  .pledge-layout { grid-template-columns: 1fr; }
  .pledge-aside { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 620px) {
  .pledge-values { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pledge-aside { grid-template-columns: 1fr; }
  .pledge-meta { align-items: flex-start; flex-direction: column; gap: 5px; }
}
</style>
