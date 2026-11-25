<template>
  <div class="page-stack">
    <PageTitle
      eyebrow="SMART MATCHING"
      title="需求大厅"
      description="用一句话描述作业面积、地点、时间和预算，AI 自动匹配可履约的服务商。"
    >
      <template #actions>
        <a-button @click="app.navigate('services')">
          <template #icon><AimOutlined /></template>
          浏览服务商
        </a-button>
      </template>
    </PageTitle>

    <div class="demand-layout">
      <section class="surface-card demand-form-card">
        <div class="section-heading compact">
          <div><span class="section-kicker">PUBLISH A DEMAND</span><h2>发布一条服务需求</h2></div>
          <span class="ai-chip"><RobotOutlined /> 关键词解析填充</span>
        </div>
        <div class="ai-description-box">
          <a-textarea
            v-model:value="description"
            :rows="4"
            placeholder="例：我有 50 亩晚稻，在望城区乔口镇，10 月 25 日成熟，想找履带式收割机，预算 60 元一亩，要含运输卸粮。"
          />
          <div>
            <span>支持面积、时间、地点、预算与作业要求自动拆解</span>
            <a-button type="primary" :disabled="!description.trim()" @click="parseDescription">
              <template #icon><ThunderboltOutlined /></template>
              AI 解析并填充
            </a-button>
          </div>
        </div>
        <a-form ref="formRef" :model="formState" layout="vertical" @finish="submit">
          <div class="form-grid-2">
            <a-form-item label="服务类型" name="category" :rules="[{ required: true }]">
              <a-select v-model:value="formState.category" :options="categories.map((value) => ({ value, label: value }))" />
            </a-form-item>
            <a-form-item label="需求标题" name="serviceName" :rules="[{ required: true, message: '请填写需求标题' }]">
              <a-input v-model:value="formState.serviceName" placeholder="如：50 亩晚稻机收" />
            </a-form-item>
          </div>
          <a-form-item label="详细描述" name="description" :rules="[{ required: true, message: '请描述作业要求' }]">
            <a-textarea v-model:value="formState.description" :rows="3" placeholder="补充机型、作业标准、运输与验收要求" />
          </a-form-item>
          <div class="form-grid-2">
            <a-form-item label="服务地点" name="location" :rules="[{ required: true, message: '请输入服务地点' }]">
              <a-input v-model:value="formState.location"><template #prefix><EnvironmentOutlined /></template></a-input>
            </a-form-item>
            <a-form-item label="面积 / 数量" name="area" :rules="[{ required: true, message: '请输入面积或数量' }]">
              <a-input v-model:value="formState.area" />
            </a-form-item>
          </div>
          <div class="form-grid-3">
            <a-form-item label="期望日期" name="preferredDate" :rules="[{ required: true, message: '请选择日期' }]">
              <a-input v-model:value="formState.preferredDate" type="date" :min="tomorrowText()" />
            </a-form-item>
            <a-form-item label="最低预算" name="budgetMin">
              <a-input-number v-model:value="formState.budgetMin" :min="0" addon-after="元" style="width: 100%" />
            </a-form-item>
            <a-form-item label="最高预算" name="budgetMax">
              <a-input-number v-model:value="formState.budgetMax" :min="0" addon-after="元" style="width: 100%" />
            </a-form-item>
          </div>
          <div class="form-grid-2">
            <a-form-item label="联系人" name="contactName" :rules="[{ required: true }]">
              <a-input v-model:value="formState.contactName" />
            </a-form-item>
            <a-form-item
              label="联系电话"
              name="contactPhone"
              :rules="[{ required: true, message: '请输入联系电话' }, { pattern: /^1[3-9]\d{9}$/, message: '请输入 11 位手机号' }]"
            >
              <a-input v-model:value="formState.contactPhone" placeholder="服务商接单后才会看到完整号码" />
            </a-form-item>
          </div>
          <a-button type="primary" size="large" html-type="submit" :loading="submitting" block>发布需求并智能匹配</a-button>
          <p class="form-assurance">手机号仅向已接单服务商展示，平台提供资金担保与履约保障。</p>
        </a-form>
      </section>

      <aside class="demand-aside">
        <div class="ai-match-note">
          <RobotOutlined />
          <h3>需求是怎么被撮合的</h3>
          <ul>
            <li><b>同类目在营</b> 发布时按服务类型统计当前可接单的服务商数，就是页面显示的匹配数</li>
            <li><b>服务商抢单</b> 在营服务商在移动工作台看到脱敏后的需求，确认报价后抢单</li>
            <li><b>抢单前置校验</b> 类目不符、已被别家接走的会被拒绝</li>
            <li><b>运营兜底指派</b> 长期无人抢单时由平台调度人工派单，结果写入订单动态</li>
            <li><b>联系方式</b> 未接单前号码脱敏，接单后服务商可见完整号码</li>
          </ul>
        </div>
        <div class="surface-card demand-tip">
          <b>完善需求，更快响应</b>
          <p>写清地块条件、运输要求和验收标准，平均可减少 1-2 次电话沟通。</p>
        </div>
      </aside>
    </div>

    <section class="surface-card demand-list-section">
      <div class="section-heading compact">
        <div><span class="section-kicker">公开需求</span><h2>需求大厅</h2></div>
        <span class="section-note">共 {{ demands.length }} 条 · 联系方式按主体脱敏</span>
      </div>
      <LoadingBlock v-if="loading" :rows="2" />
      <EmptyState v-else-if="demands.length === 0" title="暂无公开需求" />
      <div v-else class="demand-list">
        <article v-for="demand in demands" :key="demand.id">
          <div class="demand-status"><i /><span>{{ DEMAND_STATUS[demand.status] ?? demand.status }}</span></div>
          <div class="demand-main">
            <div class="demand-title-line">
              <span>{{ demand.category }}</span>
              <h3>{{ demand.serviceName }}<a-tag v-if="demand.mine" color="green">我发布的</a-tag></h3>
            </div>
            <p>{{ demand.description }}</p>
            <div class="demand-meta">
              <span><EnvironmentOutlined /> {{ demand.location }}</span>
              <span><CalendarOutlined /> {{ demand.preferredDate }}</span>
              <span>{{ demand.area }}</span>
              <span>预算 ¥{{ demand.budgetMin }}-{{ demand.budgetMax }}</span>
              <span v-if="demand.acceptedProviderName">已由 {{ demand.acceptedProviderName }} 接单</span>
            </div>
          </div>
          <div class="demand-matches"><b>{{ demand.matchCount }}</b><span>家在营可见</span><small>{{ demand.demandNo }}</small></div>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { AimOutlined, CalendarOutlined, EnvironmentOutlined, RobotOutlined, ThunderboltOutlined } from '@ant-design/icons-vue'
import { message, type FormInstance } from 'ant-design-vue'
import { serviceApi } from '../api'
import { useAppStore } from '../app-context'
import type { Demand } from '../types'
import EmptyState from '../components/EmptyState.vue'
import LoadingBlock from '../components/LoadingBlock.vue'
import PageTitle from '../components/PageTitle.vue'

const DEMAND_STATUS: Record<string, string> = {
  matching: '智能匹配中',
  quoted: '已收到报价',
  accepted: '服务商已接单',
  assigned: '平台已指派',
  closed: '已结束',
}

function tomorrowText(): string {
  const date = new Date(Date.now() + 86400000)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const app = useAppStore()
const demands = ref<Demand[]>([])
const categories = ref<string[]>(['农机作业', '植保防疫', '粮食烘干', '检测认证', '农技问诊'])
const loading = ref(true)
const submitting = ref(false)
const description = ref('')
const formRef = ref<FormInstance>()

const formState = reactive<{
  category: string
  serviceName: string
  description: string
  location: string
  area: string
  preferredDate: string
  budgetMin?: number
  budgetMax?: number
  contactName: string
  contactPhone: string
}>({
  category: '农机作业',
  serviceName: '',
  description: '',
  location: '',
  area: '',
  preferredDate: tomorrowText(),
  budgetMin: undefined,
  budgetMax: undefined,
  contactName: '',
  contactPhone: '',
})

function load() {
  loading.value = true
  Promise.all([serviceApi.demands(), serviceApi.dictionaries(), serviceApi.identity().catch(() => null)])
    .then(([rows, dict, identity]) => {
      demands.value = rows
      if (dict.categories.length) {
        categories.value = dict.categories
        if (!categories.value.includes(formState.category)) formState.category = categories.value[0]
      }
      if (identity?.merchantName && !formState.contactName) formState.contactName = identity.merchantName
    })
    .catch((reason: Error) => message.error(reason.message))
    .finally(() => { loading.value = false })
}

onMounted(load)

function parseDescription() {
  let category = categories.value[0]
  if (description.value.includes('飞防') || description.value.includes('植保')) category = categories.value.includes('植保防疫') ? '植保防疫' : category
  else if (description.value.includes('检测')) category = categories.value.includes('检测认证') ? '检测认证' : category
  else if (description.value.includes('烘干')) category = categories.value.includes('粮食烘干') ? '粮食烘干' : category
  const area = description.value.match(/(\d+)\s*亩/)?.[1]
  const price = description.value.match(/(\d+(?:\.\d+)?)\s*元/)?.[1]
  formState.category = category
  formState.serviceName = description.value.slice(0, 20) || '农业服务需求'
  formState.description = description.value
  formState.area = area ? `${area}亩` : ''
  formState.preferredDate = tomorrowText()
  formState.budgetMin = price ? Number(price) : undefined
  formState.budgetMax = price ? Math.round(Number(price) * 1.15 * 100) / 100 : undefined
  message.success('已按关键词填充类型、面积与预算，请核对后发布')
}

async function submit() {
  submitting.value = true
  try {
    const created = await serviceApi.createDemand({ ...formState })
    message.success(`需求 ${created.demandNo} 已发布，同类目在营服务商 ${created.matchCount} 家可见`)
    formRef.value?.resetFields()
    formState.preferredDate = tomorrowText()
    description.value = ''
    load()
  } catch (reason) {
    message.error(reason instanceof Error ? reason.message : '需求发布失败')
  } finally {
    submitting.value = false
  }
}
</script>
