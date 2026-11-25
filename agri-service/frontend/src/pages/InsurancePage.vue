<template>
  <div class="page-stack">
    <PageTitle
      eyebrow="AGRICULTURAL INSURANCE"
      title="农险服务"
      description="在售险种按费率实时测算保费与保额；保单、报案与理赔进度都归属当前经营主体。"
    >
      <template #actions>
        <a-button type="primary" @click="openClaim()">
          <template #icon><SafetyCertificateOutlined /></template>
          出险报案
        </a-button>
      </template>
    </PageTitle>

    <section class="insurance-banner">
      <div>
        <span class="hero-kicker"><i /> 平台协办 · 主体名下</span>
        <h2>{{ subjectName || '未解析到经营主体' }}</h2>
        <p>保费 = 险种费率 × 投保数量，保额 = 单位保额 × 投保数量，两个数字都由服务端算出。</p>
      </div>
      <div class="insurance-banner-stats">
        <div><b>{{ products.length }}</b><span>在售险种</span></div>
        <div><b>{{ policies.length }}</b><span>我的保单</span></div>
        <div><b>{{ openCount }}</b><span>在途理赔</span></div>
      </div>
    </section>

    <LoadingBlock v-if="loading" :rows="3" />
    <template v-else>
      <section class="surface-card detail-section">
        <div class="section-heading compact">
          <div><span class="section-kicker">PRODUCTS</span><h2>在售险种</h2></div>
          <span class="section-note">费率与单位保额来自险种配置</span>
        </div>
        <div class="insurance-product-grid">
          <article v-for="product in products" :key="product.id" class="insurance-product-card">
            <div class="insurance-product-head">
              <span>{{ product.icon }}</span>
              <div><small>{{ product.category }}</small><h3>{{ product.name }}</h3></div>
            </div>
            <p>{{ product.summary }}</p>
            <div class="insurance-product-tags"><span v-for="tag in product.tags" :key="tag">{{ tag }}</span></div>
            <div class="insurance-product-price">
              <span><small>展示保费</small><b>{{ product.premium }}</b></span>
              <span><small>展示保额</small><b>{{ product.coverage }}</b></span>
            </div>
            <div class="insurance-product-price">
              <span><small>费率</small><b>¥{{ product.premiumRate }}/{{ product.unitMeasure }}</b></span>
              <span><small>单位保额</small><b>¥{{ product.coveragePerUnit }}</b></span>
            </div>
            <a-button block @click="openInsure(product)">测算并投保</a-button>
          </article>
        </div>
      </section>

      <div class="insurance-lower-grid">
        <section class="surface-card detail-section">
          <div class="section-heading compact">
            <div><span class="section-kicker">MY POLICIES</span><h2>我的保单</h2></div>
            <span class="section-note">{{ policies.length }} 份保单</span>
          </div>
          <EmptyState v-if="policies.length === 0" icon="🛡️" title="本主体还没有保单" description="可在上方选择险种投保" />
          <div v-else class="policy-list">
            <article v-for="policy in policies" :key="policy.id">
              <div class="policy-list-head">
                <span><SafetyCertificateOutlined /></span>
                <div><b>{{ policy.productName }}</b><small>{{ policy.policyNo }} · {{ policy.insuredSubject }}</small></div>
                <StatusTag :status="policy.status" :labels="INSURANCE_STATUS" />
              </div>
              <div class="policy-list-meta">
                <span><small>承保标的</small><b>{{ policy.insuredArea }}</b></span>
                <span><small>自缴保费</small><b>¥{{ policy.premium.toLocaleString('zh-CN') }}</b></span>
                <span><small>保障额度</small><b>¥{{ policy.coverageAmount.toLocaleString('zh-CN') }}</b></span>
                <span><small>生效日期</small><b>{{ policy.effectiveDate }}</b></span>
              </div>
              <div class="policy-list-actions">
                <a-button size="small" @click="detailPolicy = policy">保单要素</a-button>
                <a-button v-if="policy.status !== 'expired'" size="small" type="primary" ghost @click="openClaim(policy)">出险报案</a-button>
              </div>
            </article>
          </div>
        </section>

        <section class="surface-card detail-section">
          <div class="section-heading compact">
            <div><span class="section-kicker">CLAIMS</span><h2>理赔进度</h2></div>
            <span class="section-note">状态由平台案件流转推进</span>
          </div>
          <EmptyState v-if="claims.length === 0" icon="🛡️" title="暂无理赔案件" />
          <article v-for="claim in claims" v-else :key="claim.id" class="claim-card">
            <div class="claim-card-head">
              <span><ClockCircleOutlined /></span>
              <div><b>{{ claim.disasterType }}</b><small>{{ claim.claimNo }} · {{ claim.policyNo }}</small></div>
              <StatusTag :status="claim.status" :labels="INSURANCE_STATUS" />
            </div>
            <p>{{ claim.description }}</p>
            <div class="claim-progress"><i :style="{ width: `${claim.progress}%` }" /><span>{{ claim.progress }}%</span></div>
            <div class="claim-steps">
              <span v-for="(step, index) in CLAIM_STEPS" :key="step" :class="{ done: stepDone(claim.progress, index) }">
                <CheckCircleFilled />{{ step }}
              </span>
            </div>
            <small>查勘与定损由保险机构执行，平台只同步案件状态；进度更新会写入消息中心。</small>
          </article>
        </section>
      </div>
    </template>

    <a-modal
      :open="Boolean(selectedProduct)"
      :title="`测算并投保 · ${selectedProduct?.name ?? ''}`"
      :confirm-loading="submitting"
      ok-text="确认投保"
      @cancel="selectedProduct = null"
      @ok="submitInsure"
    >
      <a-form ref="insureFormRef" :model="insureForm" layout="vertical">
        <a-form-item label="投保主体（登录令牌解析）">
          <a-input :value="subjectName || '未解析到经营主体'" readonly disabled />
        </a-form-item>
        <a-form-item
          :label="`投保数量（${selectedProduct?.unitMeasure ?? '单位'}）`"
          name="insuredAmount"
          :rules="[{ required: true, message: '请填写投保数量' }]"
        >
          <a-input-number v-model:value="insureForm.insuredAmount" :min="1" style="width: 100%" />
        </a-form-item>
        <div class="insurance-confirm-note">
          {{ estimate ? `按费率 ¥${selectedProduct?.premiumRate}/${selectedProduct?.unitMeasure} 测算：应交保费 ¥${estimate.premium}，保障额度 ¥${estimate.coverage}。` : '填写数量后按险种费率测算；最终以服务端计算为准。' }}
        </div>
        <div class="insurance-confirm-note">政府补贴比例以保险机构核保与地方政策为准，平台不在本环节计算补贴。</div>
      </a-form>
    </a-modal>

    <a-modal
      :open="Boolean(claimPolicy)"
      title="出险报案"
      :confirm-loading="submitting"
      ok-text="提交报案"
      @cancel="claimPolicy = null"
      @ok="submitClaim"
    >
      <a-form ref="claimFormRef" :model="claimForm" layout="vertical">
        <div class="claim-policy-summary">{{ claimPolicy?.productName }} · {{ claimPolicy?.policyNo }} · {{ claimPolicy?.insuredArea }}</div>
        <a-form-item label="灾害类型" name="disasterType" :rules="[{ required: true }]">
          <a-select v-model:value="claimForm.disasterType" :options="disasterOptions" />
        </a-form-item>
        <a-form-item label="受灾面积" name="lossArea" :rules="[{ required: true, message: '请填写受灾面积，如 12亩' }]">
          <a-input v-model:value="claimForm.lossArea" placeholder="如 12亩" />
        </a-form-item>
        <a-form-item label="受灾情况" name="description" :rules="[{ required: true, message: '请描述受灾情况' }]">
          <a-textarea v-model:value="claimForm.description" :rows="5" placeholder="请说明发生时间、受灾范围、当前水位或作物状态" />
        </a-form-item>
        <div class="insurance-confirm-note">本版不接收照片附件；现场查勘由保险机构安排，案件状态变化会在理赔进度与消息中心同步。</div>
      </a-form>
    </a-modal>

    <a-modal :open="Boolean(detailPolicy)" :title="`保单要素 · ${detailPolicy?.policyNo ?? ''}`" :width="620" @cancel="detailPolicy = null">
      <template #footer>
        <a-button @click="detailPolicy = null">关闭</a-button>
      </template>
      <div v-if="detailPolicy" class="contract-preview">
        <dl>
          <dt>险种</dt><dd>{{ detailPolicy.productName }}</dd>
          <dt>投保主体</dt><dd>{{ detailPolicy.insuredSubject }}</dd>
          <dt>承保标的</dt><dd>{{ detailPolicy.insuredArea }}</dd>
          <dt>自缴保费</dt><dd>¥{{ detailPolicy.premium.toLocaleString('zh-CN') }}</dd>
          <dt>保障额度</dt><dd>¥{{ detailPolicy.coverageAmount.toLocaleString('zh-CN') }}</dd>
          <dt>生效日期</dt><dd>{{ detailPolicy.effectiveDate }}</dd>
          <dt>保单状态</dt><dd>{{ INSURANCE_STATUS[detailPolicy.status]?.label ?? detailPolicy.status }}</dd>
        </dl>
        <p class="contract-clause">以上是平台侧记录的保单要素；正式保单与免责条款以保险机构出具的文件为准。</p>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { CheckCircleFilled, ClockCircleOutlined, SafetyCertificateOutlined } from '@ant-design/icons-vue'
import { message, type FormInstance } from 'ant-design-vue'
import { serviceApi } from '../api'
import type { InsuranceClaim, InsurancePolicy, InsuranceProduct } from '../types'
import { INSURANCE_STATUS } from '../components/ui-constants'
import EmptyState from '../components/EmptyState.vue'
import LoadingBlock from '../components/LoadingBlock.vue'
import PageTitle from '../components/PageTitle.vue'
import StatusTag from '../components/StatusTag.vue'

const CLAIM_STEPS = ['报案提交', '查勘定损', '公示', '赔款支付']
const disasterOptions = ['暴雨内涝', '干旱', '风灾', '冻害', '病虫害', '意外事故'].map((value) => ({ value, label: value }))

function stepDone(progress: number, index: number): boolean {
  if (index === 0) return progress >= 20
  if (index === 1) return progress >= 45
  if (index === 2) return progress >= 85
  return progress >= 100
}

const products = ref<InsuranceProduct[]>([])
const policies = ref<InsurancePolicy[]>([])
const claims = ref<InsuranceClaim[]>([])
const subjectName = ref('')
const loading = ref(true)
const selectedProduct = ref<InsuranceProduct | null>(null)
const detailPolicy = ref<InsurancePolicy | null>(null)
const claimPolicy = ref<InsurancePolicy | null>(null)
const submitting = ref(false)
const insureFormRef = ref<FormInstance>()
const claimFormRef = ref<FormInstance>()

const insureForm = reactive<{ insuredAmount?: number }>({ insuredAmount: undefined })
const claimForm = reactive({ policyId: 0, disasterType: '暴雨内涝', lossArea: '', description: '' })

const openCount = computed(() => claims.value.filter((claim) => !['paid', 'closed', 'rejected'].includes(claim.status)).length)
const estimate = computed(() => {
  const amount = Number(insureForm.insuredAmount)
  if (!selectedProduct.value || !amount || amount <= 0) return null
  return {
    premium: Math.round(Number(selectedProduct.value.premiumRate) * amount * 100) / 100,
    coverage: Math.round(Number(selectedProduct.value.coveragePerUnit) * amount * 100) / 100,
  }
})

function load() {
  loading.value = true
  Promise.all([
    serviceApi.insuranceProducts(),
    serviceApi.insurancePolicies(),
    serviceApi.insuranceClaims(),
    serviceApi.identity().catch(() => null),
  ])
    .then(([productList, policyList, claimList, identity]) => {
      products.value = productList
      policies.value = policyList
      claims.value = claimList
      subjectName.value = identity?.merchantName ?? ''
    })
    .catch((reason: Error) => message.error(reason.message))
    .finally(() => { loading.value = false })
}

onMounted(load)

function openInsure(product: InsuranceProduct) {
  selectedProduct.value = product
  insureForm.insuredAmount = undefined
}

async function submitInsure() {
  if (!selectedProduct.value) return
  submitting.value = true
  try {
    await insureFormRef.value?.validate()
    const policy = await serviceApi.insure({ productId: selectedProduct.value.id, insuredAmount: insureForm.insuredAmount })
    selectedProduct.value = null
    message.success(`投保成功，保单 ${policy.policyNo} 自 ${policy.effectiveDate} 起保障`)
    load()
  } catch (reason) {
    if (reason instanceof Error) message.error(reason.message)
  } finally {
    submitting.value = false
  }
}

function openClaim(policy?: InsurancePolicy) {
  const chosen = policy ?? policies.value.find((item) => item.status !== 'expired')
  if (!chosen) {
    message.warning('当前没有可报案的保单')
    return
  }
  claimPolicy.value = chosen
  claimForm.policyId = chosen.id
  claimForm.disasterType = '暴雨内涝'
  claimForm.lossArea = ''
  claimForm.description = ''
}

async function submitClaim() {
  submitting.value = true
  try {
    await claimFormRef.value?.validate()
    const claim = await serviceApi.createClaim({ ...claimForm })
    claimPolicy.value = null
    message.success(`报案 ${claim.claimNo} 已提交，进入查勘后会在此更新进度`)
    load()
  } catch (reason) {
    if (reason instanceof Error) message.error(reason.message)
  } finally {
    submitting.value = false
  }
}
</script>
