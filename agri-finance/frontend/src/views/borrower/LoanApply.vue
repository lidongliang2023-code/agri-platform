<template>
  <section class="finance-page apply-page">
    <header class="finance-page-heading">
      <div>
        <small>FINANCING APPLICATION</small>
        <h1>发起融资申请</h1>
        <p>填写经营场景、资金用途与还款来源，提交后进入平台智能预审和人工复核。</p>
      </div>
      <el-button class="finance-ghost-button" @click="$router.push('/borrower/loan-management')">我的申请</el-button>
    </header>

    <div class="finance-steps">
      <div class="finance-step on"><span>01</span>填写经营信息</div>
      <div class="finance-step"><span>02</span>平台预审</div>
      <div class="finance-step"><span>03</span>人工复核</div>
      <div class="finance-step"><span>04</span>签约放款</div>
    </div>

    <div class="apply-layout">
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="apply-form">
        <section class="finance-card finance-form-card">
          <h2 class="finance-section-title">融资方案</h2>
          <div class="finance-form-grid">
            <el-form-item label="融资产品" prop="productType">
              <el-select v-model="form.productType" placeholder="请选择产品" style="width: 100%">
                <el-option v-for="product in financeProducts" :key="product.key" :label="product.name" :value="product.key" />
              </el-select>
            </el-form-item>
            <el-form-item label="申请金额（元）" prop="applyAmount">
              <el-input v-model="form.applyAmount" inputmode="decimal" placeholder="请输入申请金额">
                <template #prefix>¥</template>
              </el-input>
            </el-form-item>
          </div>
          <div class="finance-form-grid three">
            <el-form-item label="融资期限" prop="applyTerm">
              <el-select v-model="form.applyTerm" style="width: 100%">
                <el-option v-for="term in [3, 6, 9, 12, 18, 24, 36]" :key="term" :label="`${term} 个月`" :value="term" />
              </el-select>
            </el-form-item>
            <el-form-item label="还款方式" prop="repaymentMethod">
              <el-select v-model="form.repaymentMethod" style="width: 100%">
                <el-option label="等额本息" value="等额本息" />
                <el-option label="到期一次还本付息" value="到期一次还本付息" />
              </el-select>
            </el-form-item>
            <el-form-item label="预计年化利率">
              <div class="apply-readonly">{{ credit?.referenceRate != null ? `${credit.referenceRate}%` : '审批后确定' }}</div>
            </el-form-item>
          </div>
          <div class="apply-quick-amount">
            <span>快捷金额</span>
            <button v-for="value in quickAmounts" :key="value" type="button" @click="form.applyAmount = String(value)">
              {{ value >= 10000 ? `${value / 10000}万` : value }}
            </button>
          </div>
        </section>

        <section class="finance-card finance-form-card">
          <h2 class="finance-section-title">经营与用途</h2>
          <el-form-item label="融资用途" prop="fundPurpose">
            <el-input v-model="form.fundPurpose" type="textarea" :rows="3" maxlength="500" show-word-limit placeholder="说明采购、生产、收购或设备投入等具体用途" />
          </el-form-item>
          <el-form-item label="还款来源" prop="repaymentSource">
            <el-input v-model="form.repaymentSource" type="textarea" :rows="3" maxlength="500" show-word-limit placeholder="说明订单回款、销售回款或其他经营收入来源" />
          </el-form-item>
          <div class="finance-form-grid">
            <el-form-item label="资产总额（元）">
              <el-input v-model="form.assetAmount" inputmode="decimal" placeholder="用于评估偿债能力" />
            </el-form-item>
            <el-form-item label="质押物/贸易背景说明">
              <el-input v-model="form.collateralInfo" placeholder="如仓单、订单、农机设备等" />
            </el-form-item>
          </div>
        </section>

        <section class="finance-card finance-form-card">
          <h2 class="finance-section-title">联系人与材料</h2>
          <div class="finance-form-grid">
            <el-form-item label="联系人" prop="contactName">
              <el-input v-model="form.contactName" placeholder="请输入联系人姓名" />
            </el-form-item>
            <el-form-item label="联系电话" prop="contactPhone">
              <el-input v-model="form.contactPhone" placeholder="请输入手机号" />
            </el-form-item>
          </div>
          <el-form-item label="补充材料">
            <el-upload
              class="apply-upload"
              drag
              :auto-upload="false"
              :show-file-list="false"
              :on-change="uploadEvidence"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
            >
              <el-icon><UploadFilled /></el-icon>
              <div class="el-upload__text">
                {{ evidenceName || '拖拽或点击上传营业执照、采购合同、仓单、资产证明' }}
              </div>
              <template #tip><div class="el-upload__tip">支持 PDF / PNG / JPG / WEBP，单文件不超过 5MB</div></template>
            </el-upload>
          </el-form-item>
        </section>

        <div class="apply-submit-bar">
          <div>
            <span>预计每期还款</span>
            <strong>{{ money(estimatedPayment) }}</strong>
            <small>最终以审批结果和还款计划为准</small>
          </div>
          <el-button class="finance-ghost-button" @click="reset">重置</el-button>
          <el-button class="finance-action-button" :loading="submitting" @click="submit">提交融资申请</el-button>
        </div>
      </el-form>

      <aside class="apply-aside">
        <section class="apply-credit-card">
          <span>当前可用授信</span>
          <strong>{{ money(credit?.availableAmount) }}</strong>
          <p>{{ credit?.creditLevel || '—' }} 级信用 · 参考利率 {{ credit?.referenceRate || '—' }}%</p>
          <div class="finance-progress">
            <span :style="{ width: `${Math.min(100, usagePercent)}%` }" />
          </div>
          <small>本次申请占当前授信 {{ usagePercent.toFixed(1) }}%</small>
        </section>
        <section class="finance-card">
          <div class="finance-card-head"><strong>申请流程</strong><small>预计 1-2 个工作日</small></div>
          <ol class="apply-flow">
            <li><b>1</b><div><strong>智能预审</strong><p>校验信用、经营数据和申请金额</p></div></li>
            <li><b>2</b><div><strong>补充材料</strong><p>必要时补充合同、仓单或设备证明</p></div></li>
            <li><b>3</b><div><strong>签约放款</strong><p>审批通过后签署合同并生成还款计划</p></div></li>
          </ol>
        </section>
        <section class="apply-tip">
          <CircleCheck />
          <p>请确保申请信息与真实经营一致。提供真实订单与履约数据有助于获得更高额度和更优利率。</p>
        </section>
      </aside>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CircleCheck, UploadFilled } from '@element-plus/icons-vue'
import { financeApi, money } from '@/api/finance'
import { financeProducts, productByKey } from '@/data/products'

const route = useRoute()
const router = useRouter()
const formRef = ref()
const credit = ref(null)
const submitting = ref(false)
const uploading = ref(false)
const evidenceUrl = ref('')
const evidenceName = ref('')
const quickAmounts = [50000, 100000, 200000, 300000, 500000]

const initialProduct = productByKey(String(route.query.product || 'agri'))
const form = reactive({
  productType: initialProduct.key,
  applyAmount: '',
  applyTerm: 12,
  repaymentMethod: '等额本息',
  fundPurpose: '',
  repaymentSource: '',
  assetAmount: '',
  collateralInfo: '',
  contactName: '',
  contactPhone: '',
})

const rules = {
  productType: [{ required: true, message: '请选择融资产品', trigger: 'change' }],
  applyAmount: [
    { required: true, message: '请输入申请金额', trigger: 'blur' },
    { validator: (_rule, value, callback) => Number(value) > 0 ? callback() : callback(new Error('申请金额必须大于 0')), trigger: 'blur' },
  ],
  applyTerm: [{ required: true, message: '请选择融资期限', trigger: 'change' }],
  repaymentMethod: [{ required: true, message: '请选择还款方式', trigger: 'change' }],
  fundPurpose: [{ required: true, message: '请填写融资用途', trigger: 'blur' }],
  repaymentSource: [{ required: true, message: '请填写还款来源', trigger: 'blur' }],
  contactName: [{ required: true, message: '请填写联系人', trigger: 'blur' }],
  contactPhone: [
    { required: true, message: '请填写联系电话', trigger: 'blur' },
    { pattern: /^1\d{10}$/, message: '请输入正确的手机号', trigger: 'blur' },
  ],
}

const usagePercent = computed(() => {
  const available = Number(credit.value?.availableAmount || 0)
  return available > 0 ? Math.min(100, Number(form.applyAmount || 0) / available * 100) : 0
})

const estimatedPayment = computed(() => {
  const amount = Number(form.applyAmount || 0)
  const rate = Number(credit.value?.referenceRate || 6) / 100 / 12
  const term = Number(form.applyTerm || 1)
  if (!amount) return 0
  if (form.repaymentMethod === '到期一次还本付息') {
    return amount * (1 + rate * term) / term
  }
  return rate > 0 ? amount * rate * (1 + rate) ** term / ((1 + rate) ** term - 1) : amount / term
})

watch(() => route.query.product, (value) => {
  if (value) form.productType = productByKey(String(value)).key
})

async function uploadEvidence(file) {
  if (!file?.raw || uploading.value) return
  uploading.value = true
  try {
    const result = await financeApi.uploadEvidence(file.raw)
    evidenceUrl.value = result.url
    evidenceName.value = result.originalName
    ElMessage.success('补充材料上传成功')
  } catch (err) {
    ElMessage.error(err.message || '材料上传失败')
  } finally {
    uploading.value = false
  }
}

async function submit() {
  await formRef.value.validate()
  const product = productByKey(form.productType)
  await ElMessageBox.confirm(
    `确认申请${product.name} ${money(Number(form.applyAmount))}，期限 ${form.applyTerm} 个月？`,
    '提交融资申请',
    { confirmButtonText: '确认提交', cancelButtonText: '再检查一下', type: 'info' },
  )
  submitting.value = true
  try {
    await financeApi.apply({
      productType: form.productType,
      applyAmount: Number(form.applyAmount),
      applyTerm: Number(form.applyTerm),
      repaymentMethod: form.repaymentMethod,
      fundPurpose: form.fundPurpose,
      repaymentSource: form.repaymentSource,
      assetAmount: form.assetAmount ? Number(form.assetAmount) : null,
      collateralInfo: form.collateralInfo || null,
      contactName: form.contactName,
      contactPhone: form.contactPhone,
      evidenceUrl: evidenceUrl.value || null,
    })
    ElMessage.success('融资申请已提交，等待平台审批')
    router.push('/borrower/loan-management')
  } catch (err) {
    ElMessage.error(err.message || '申请提交失败')
  } finally {
    submitting.value = false
  }
}

function reset() {
  formRef.value.resetFields()
  evidenceUrl.value = ''
  evidenceName.value = ''
}

onMounted(async () => {
  try {
    credit.value = await financeApi.credit()
  } catch {
    credit.value = null
  }
})
</script>

<style scoped>
.apply-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  align-items: start;
  gap: 14px;
}

.apply-form {
  display: grid;
  gap: 14px;
}

.apply-readonly {
  display: flex;
  width: 100%;
  height: 32px;
  align-items: center;
  color: #b45b12;
  font-size: 11px;
  font-weight: 650;
}

.apply-quick-amount {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: -4px;
}

.apply-quick-amount > span {
  color: #87978d;
  font-size: 8px;
}

.apply-quick-amount button {
  padding: 5px 10px;
  border: 1px solid #d8e5dd;
  border-radius: 99px;
  background: #f7fbf8;
  color: #577061;
  cursor: pointer;
  font-size: 8px;
}

.apply-quick-amount button:hover {
  border-color: #9bc9ad;
  background: #edf8f1;
  color: var(--fin-green-800);
}

.apply-upload {
  width: 100%;
}

.apply-upload :deep(.el-upload) {
  width: 100%;
}

.apply-upload :deep(.el-upload-dragger) {
  width: 100%;
  padding: 18px;
  border-color: #d2e2d8;
  background: #f9fcf9;
}

.apply-upload :deep(.el-icon) {
  color: var(--fin-green-600);
  font-size: 24px;
}

.apply-upload :deep(.el-upload__text) {
  color: #71857a;
  font-size: 9px;
}

.apply-submit-bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 9px;
  padding: 14px 16px;
  border: 1px solid var(--fin-line);
  border-radius: 13px;
  background: #fff;
}

.apply-submit-bar > div {
  display: flex;
  margin-right: auto;
  flex-direction: column;
}

.apply-submit-bar span {
  color: #89988f;
  font-size: 8px;
}

.apply-submit-bar strong {
  margin-top: 2px;
  color: #d2523f;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 16px;
}

.apply-submit-bar small {
  color: #9ca7a0;
  font-size: 7.5px;
}

.apply-aside {
  display: grid;
  gap: 12px;
}

.apply-credit-card {
  padding: 18px;
  border-radius: 15px;
  background:
    radial-gradient(circle at 88% 10%, rgba(131, 228, 170, .18), transparent 10rem),
    linear-gradient(135deg, #083c27, #0f7048);
  color: #fff;
}

.apply-credit-card span,
.apply-credit-card strong,
.apply-credit-card p,
.apply-credit-card small {
  display: block;
}

.apply-credit-card span {
  color: rgba(255, 255, 255, .58);
  font-size: 8px;
}

.apply-credit-card strong {
  margin-top: 5px;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 23px;
}

.apply-credit-card p {
  margin: 4px 0 12px;
  color: rgba(255, 255, 255, .57);
  font-size: 8px;
}

.apply-credit-card .finance-progress {
  background: rgba(255, 255, 255, .13);
}

.apply-credit-card .finance-progress > span {
  background: #a6ebbd;
}

.apply-credit-card small {
  margin-top: 7px;
  color: rgba(255, 255, 255, .48);
  font-size: 7.5px;
}

.apply-flow {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 14px 15px;
  list-style: none;
}

.apply-flow li {
  display: flex;
  gap: 9px;
}

.apply-flow b {
  display: grid;
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 8px;
  background: #e9f6ee;
  color: var(--fin-green-700);
  font-family: ui-monospace, Consolas, monospace;
  font-size: 8px;
}

.apply-flow strong {
  color: #3e5848;
  font-size: 9.5px;
}

.apply-flow p {
  margin: 3px 0 0;
  color: #89978f;
  font-size: 8px;
  line-height: 1.55;
}

.apply-tip {
  display: flex;
  gap: 8px;
  padding: 12px;
  border: 1px solid #d7e8dd;
  border-radius: 12px;
  background: #f0f9f4;
  color: var(--fin-green-700);
}

.apply-tip svg {
  width: 17px;
  flex: 0 0 auto;
}

.apply-tip p {
  margin: 0;
  color: #6f8377;
  font-size: 8.5px;
  line-height: 1.65;
}

@media (max-width: 900px) {
  .apply-layout { grid-template-columns: 1fr; }
  .apply-aside { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .apply-tip { grid-column: 1 / -1; }
}

@media (max-width: 620px) {
  .apply-aside { grid-template-columns: 1fr; }
  .apply-submit-bar { align-items: stretch; flex-direction: column; }
  .apply-submit-bar > div { margin-right: 0; }
}
</style>
