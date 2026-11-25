<template>
  <div class="page-stack">
    <PageTitle
      eyebrow="POLICY ASSISTANT"
      title="惠农政策"
      description="按经营主体自动匹配补贴政策，申报条件、材料和进度一目了然。"
    >
      <template #actions>
        <a-button @click="load"><template #icon><ThunderboltOutlined /></template>重新匹配政策</a-button>
      </template>
    </PageTitle>

    <section class="policy-top-summary">
      <div>
        <span class="policy-summary-icon"><ThunderboltOutlined /></span>
        <div><small>AI 精准匹配</small><h2>发现 4 项可申报政策</h2><p>乔口丰收家庭农场 · 种植型经营主体 · 128 亩</p></div>
      </div>
      <div class="policy-summary-figures">
        <span><b>4</b><small>匹配政策</small></span>
        <span><b>2</b><small>申报中</small></span>
        <span><b>¥4,500</b><small>预计可兑付</small></span>
      </div>
    </section>

    <section class="surface-card policy-content">
      <div class="policy-toolbar">
        <div class="order-tabs">
          <button type="button" :class="{ on: tab === 'match' }" @click="tab = 'match'">为您匹配</button>
          <button type="button" :class="{ on: tab === 'applications' }" @click="tab = 'applications'">我的申报 <i>{{ applications.length }}</i></button>
        </div>
        <div v-if="tab === 'match'" class="inline-search">
          <a-input v-model:value="keyword" placeholder="搜索政策关键词" @press-enter="load">
            <template #prefix><SearchOutlined /></template>
          </a-input>
          <a-button @click="load">查询</a-button>
        </div>
      </div>

      <LoadingBlock v-if="loading" :rows="3" />
      <template v-else-if="tab === 'match'">
        <EmptyState v-if="policies.length === 0" title="没有匹配政策" />
        <div v-else class="policy-card-list">
          <article v-for="(policy, index) in policies" :key="policy.id" class="policy-card" :class="{ featured: index === 0 }">
            <div class="policy-score">
              <span>{{ policy.matchScore }}</span><small>匹配度</small>
            </div>
            <div class="policy-card-main">
              <div class="policy-tag-line">
                <span>{{ policy.level }}</span><span>{{ policy.category }}</span>
                <em v-if="policy.matchScore >= 90">优先推荐</em>
              </div>
              <h3>{{ policy.title }}</h3>
              <p>{{ policy.conditions }}</p>
              <div class="policy-card-meta">
                <span><b>{{ policy.amountText }}</b><small>补贴标准</small></span>
                <span><CalendarOutlined /><b>{{ policy.deadline }}</b><small>申报截止</small></span>
                <span><FileTextOutlined /><b>{{ policy.materials.length }} 项</b><small>所需材料</small></span>
              </div>
            </div>
            <div class="policy-card-actions">
              <a-button @click="message.info(policy.conditions)">查看详情</a-button>
              <a-button type="primary" @click="openApply(policy)">去申报 <ArrowRightOutlined /></a-button>
            </div>
          </article>
        </div>
      </template>
      <template v-else>
        <EmptyState v-if="applications.length === 0" icon="📑" title="还没有申报记录">
          <template #action><a-button type="primary" @click="tab = 'match'">去看看政策</a-button></template>
        </EmptyState>
        <div v-else class="application-list">
          <article v-for="application in applications" :key="application.id">
            <div class="application-head">
              <div><span class="application-doc"><FileTextOutlined /></span><div><b>{{ application.policyTitle }}</b><small>{{ application.applicationNo }} · {{ application.submittedAt }}</small></div></div>
              <StatusTag :status="application.status" :labels="POLICY_STATUS" />
            </div>
            <div class="application-body">
              <span><small>申报主体</small><b>{{ application.applicant }}</b></span>
              <span><small>预计金额</small><b>{{ application.amountText }}</b></span>
              <span><small>当前进度</small><b>{{ application.progress }}%</b></span>
            </div>
            <a-progress :percent="application.progress" :show-info="false" stroke-color="#159a5e" />
            <div class="application-steps">
              <span v-for="(step, index) in ['提交申报', '形式审查', '部门审核', '公示兑付']" :key="step" :class="{ done: application.progress >= (index + 1) * 25 }">
                <CheckCircleFilled />{{ step }}
              </span>
            </div>
          </article>
        </div>
      </template>
    </section>

    <a-modal :open="Boolean(selected)" :title="`申报 · ${selected?.title ?? ''}`" :confirm-loading="submitting" ok-text="提交申报" :width="620" @cancel="selected = null" @ok="submit">
      <a-form ref="formRef" :model="formState" layout="vertical">
        <div class="apply-policy-summary">
          <b>{{ selected?.amountText }}</b><span>{{ selected?.conditions }}</span>
        </div>
        <a-form-item label="申报主体" name="applicant" :rules="[{ required: true }]"><a-input v-model:value="formState.applicant" /></a-form-item>
        <div class="form-grid-2">
          <a-form-item label="联系电话" name="contactPhone" :rules="[{ required: true }]"><a-input v-model:value="formState.contactPhone" /></a-form-item>
          <a-form-item label="收款账户" name="bankAccount" :rules="[{ required: true }]"><a-input v-model:value="formState.bankAccount" /></a-form-item>
        </div>
        <div class="materials-box">
          <b>需准备材料</b>
          <span v-for="material in selected?.materials ?? []" :key="material"><CheckCircleFilled /> {{ material }}</span>
        </div>
        <div class="booking-form-tip">平台将先进行材料完整性与资格预检，再提交至对应主管部门。</div>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ArrowRightOutlined, CalendarOutlined, CheckCircleFilled, FileTextOutlined, SearchOutlined, ThunderboltOutlined } from '@ant-design/icons-vue'
import { message, type FormInstance } from 'ant-design-vue'
import { serviceApi } from '../api'
import type { Policy, PolicyApplication } from '../types'
import { POLICY_STATUS } from '../components/ui-constants'
import EmptyState from '../components/EmptyState.vue'
import LoadingBlock from '../components/LoadingBlock.vue'
import PageTitle from '../components/PageTitle.vue'
import StatusTag from '../components/StatusTag.vue'

const tab = ref<'match' | 'applications'>('match')
const keyword = ref('')
const policies = ref<Policy[]>([])
const applications = ref<PolicyApplication[]>([])
const loading = ref(true)
const selected = ref<Policy | null>(null)
const submitting = ref(false)
const formRef = ref<FormInstance>()
const formState = reactive({ applicant: '乔口丰收家庭农场', contactPhone: '13800121206', bankAccount: '6222 **** **** 1206' })

function load() {
  loading.value = true
  Promise.all([serviceApi.policies(keyword.value || undefined), serviceApi.policyApplications()])
    .then(([policyList, applicationList]) => {
      policies.value = policyList
      applications.value = applicationList
    })
    .catch((reason: Error) => message.error(reason.message))
    .finally(() => { loading.value = false })
}

onMounted(load)

function openApply(policy: Policy) {
  selected.value = policy
  formState.applicant = '乔口丰收家庭农场'
  formState.contactPhone = '13800121206'
  formState.bankAccount = '6222 **** **** 1206'
}

async function submit() {
  if (!selected.value) return
  submitting.value = true
  try {
    await formRef.value?.validate()
    const created = await serviceApi.applyPolicy({ policyId: selected.value.id, ...formState })
    selected.value = null
    message.success(`申报 ${created.applicationNo} 已提交`)
    tab.value = 'applications'
    load()
  } catch (reason) {
    if (reason instanceof Error) message.error(reason.message)
  } finally {
    submitting.value = false
  }
}
</script>
