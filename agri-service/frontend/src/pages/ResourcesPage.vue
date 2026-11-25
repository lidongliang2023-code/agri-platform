<template>
  <div class="page-stack">
    <PageTitle
      eyebrow="INDUSTRIAL RESOURCES"
      title="产业资源对接"
      description="土地流转与季节性用工由经营主体自行发布，平台记录归属并按主体脱敏联系方式；法律求助直接生成问诊单。"
    >
      <template #actions>
        <a-button type="primary" @click="openPublish"><template #icon><PlusOutlined /></template>发布资源</a-button>
      </template>
    </PageTitle>

    <section class="resource-tabs">
      <button type="button" :class="{ on: tab === 'land' }" @click="tab = 'land'">
        <span>🌳</span><b>土地流转</b><small>{{ landList.length }} 条在挂</small>
      </button>
      <button type="button" :class="{ on: tab === 'labor' }" @click="tab = 'labor'">
        <span>🧑‍🌾</span><b>劳务用工</b><small>{{ laborList.length }} 条在挂</small>
      </button>
      <button type="button" :class="{ on: tab === 'legal' }" @click="tab = 'legal'">
        <span>⚖️</span><b>法律咨询</b><small>{{ lawyer ? `${lawyer.name} 可接诊` : '暂无在册律师' }}</small>
      </button>
    </section>

    <LoadingBlock v-if="loading" :rows="3" />
    <template v-else>
      <div v-if="tab === 'land'" class="resource-layout">
        <section class="surface-card detail-section">
          <div class="section-heading compact">
            <div><span class="section-kicker">LAND LISTINGS</span><h2>在挂地源</h2></div>
            <span class="section-note">发布方与联系方式由平台记录</span>
          </div>
          <div class="land-list">
            <a-empty v-if="landList.length === 0" description="暂未有主体发布土地流转资源" />
            <article v-for="row in landList" v-else :key="row.id">
              <div>
                <h3>
                  {{ row.title }}
                  <a-tag v-if="row.mine" color="green">我发布的</a-tag>
                  <a-tag v-else color="blue">{{ row.merchantName ?? '其他主体' }}</a-tag>
                </h3>
                <p>{{ row.description || '未填写地块说明' }}</p>
                <small><EnvironmentOutlined /> {{ row.location }}　·　{{ row.areaMu ? `${row.areaMu} 亩` : '面积待补充' }}</small>
              </div>
              <div>
                <b>{{ row.price }} {{ row.unit }}</b>
                <small><PhoneOutlined /> {{ row.contactName }} {{ row.contactPhone }}{{ row.mine ? '' : '（脱敏）' }}</small>
                <a-button type="primary" ghost @click="app.navigate('demand')"><template #icon><AimOutlined /></template>发起需求</a-button>
              </div>
            </article>
          </div>
        </section>
        <aside class="surface-card resource-assurance-card">
          <TeamOutlined />
          <h3>流转前请自行核验</h3>
          <span v-for="item in ['承包关系与权属证书原件', '实地面积与地块四至', '流转期限与用途限制', '村集体备案与网签']" :key="item">· {{ item }}</span>
          <a-button block @click="app.navigate('policies')">查看流转奖补政策</a-button>
        </aside>
      </div>

      <div v-if="tab === 'labor'" class="resource-layout">
        <section class="surface-card detail-section">
          <div class="section-heading compact">
            <div><span class="section-kicker">LABOR LISTINGS</span><h2>在挂工队</h2></div>
            <span class="section-note">共 {{ laborList.length }} 支</span>
          </div>
          <div class="labor-list">
            <a-empty v-if="laborList.length === 0" description="暂未有主体发布劳务用工资源" />
            <article v-for="row in laborList" v-else :key="row.id">
              <div>
                <h3>
                  {{ row.title }}
                  <a-tag v-if="row.mine" color="green">我发布的</a-tag>
                  <a-tag v-else color="blue">{{ row.merchantName ?? '其他主体' }}</a-tag>
                </h3>
                <p>{{ row.description || '未填写班组说明' }}</p>
                <small><EnvironmentOutlined /> {{ row.location }}　·　{{ row.areaMu ? `${row.areaMu} 亩` : '面积待补充' }}</small>
              </div>
              <div>
                <b>{{ row.price }} {{ row.unit }}</b>
                <small><PhoneOutlined /> {{ row.contactName }} {{ row.contactPhone }}{{ row.mine ? '' : '（脱敏）' }}</small>
                <a-button type="primary" ghost @click="app.navigate('demand')"><template #icon><AimOutlined /></template>发起需求</a-button>
              </div>
            </article>
          </div>
        </section>
        <aside class="surface-card resource-assurance-card">
          <TeamOutlined />
          <h3>用工建议约定</h3>
          <span v-for="item in ['工时与计件口径', '结算周期与担保方式', '意外责任与保险', '现场安全交底']" :key="item">· {{ item }}</span>
          <a-button block @click="app.navigate('demand')"><template #icon><AimOutlined /></template>发布用工需求</a-button>
        </aside>
      </div>

      <div v-if="tab === 'legal'" class="resource-layout">
        <section class="surface-card detail-section legal-chat">
          <div class="section-heading compact">
            <div><span class="section-kicker">LEGAL CONSULT</span><h2>{{ lawyer ? `${lawyer.name} · ${lawyer.title}` : '涉农法律咨询' }}</h2></div>
            <span class="ai-live-badge"><i /> 提交后生成真实问诊单</span>
          </div>
          <div class="legal-message">
            <span>{{ lawyer ? lawyer.name.slice(0, 1) : '法' }}</span>
            <div>
              <b>{{ lawyer ? lawyer.organization : '当前没有在册律师' }}</b>
              <p>{{ lawyer ? lawyer.summary : '法律咨询需要平台先录入具备执业资格的专家档案。' }}</p>
            </div>
          </div>
          <div class="legal-input">
            <a-textarea v-model:value="question" :rows="4" placeholder="例如：土地流转合同没有约定到期地上作物归属，风险怎么处理？" />
            <div>
              <a-button type="primary" :disabled="!lawyer" @click="askLegal">提交问题</a-button>
              <a-button @click="app.navigate('consult')">查看全部专家<ArrowRightOutlined /></a-button>
            </div>
          </div>
          <div class="legal-topics">
            <button v-for="topic in ['土地承包到期续签', '果园冻害损失责任', '采摘临时用工工伤', '农机作业质量纠纷']" :key="topic" type="button" @click="question = topic">{{ topic }}</button>
          </div>
        </section>
        <aside class="surface-card resource-assurance-card">
          <template v-if="lawyer">
            <span class="lawyer-avatar">{{ lawyer.name.slice(0, 1) }}</span>
            <h3>{{ lawyer.name }}</h3>
            <p>{{ lawyer.title }} · {{ lawyer.serviceScope }}</p>
            <b>已接诊 {{ lawyer.consultCount }} 次 · 评分 {{ lawyer.rating }}</b>
            <a-button type="primary" block @click="app.navigate('consult')">查看专家列表</a-button>
            <small>正式法律意见以委托合同与法律意见书为准</small>
          </template>
          <template v-else>
            <h3>暂无在册律师</h3>
            <p>平台需要录入执业律师档案后才能受理法律问诊。</p>
          </template>
        </aside>
      </div>
    </template>

    <a-modal v-model:open="publishOpen" title="发布产业资源" :confirm-loading="submitting" ok-text="提交发布" :width="640" @ok="publish">
      <a-form ref="formRef" :model="formState" layout="vertical">
        <a-form-item label="资源类型" name="resourceType" :rules="[{ required: true }]">
          <a-select v-model:value="formState.resourceType" :options="[{ value: 'land', label: '土地流转' }, { value: 'labor', label: '劳务用工' }]" />
        </a-form-item>
        <a-form-item label="标题" name="title" :rules="[{ required: true, message: '请填写资源标题' }]">
          <a-input v-model:value="formState.title" placeholder="如：望城区乔口镇连片水田 128 亩" />
        </a-form-item>
        <a-form-item label="所在地" name="location" :rules="[{ required: true, message: '请填写所在地' }]">
          <a-input v-model:value="formState.location" placeholder="区县 + 乡镇" />
        </a-form-item>
        <a-form-item label="面积 / 人数（亩）" name="areaMu">
          <a-input-number v-model:value="formState.areaMu" :min="0" style="width: 100%" />
        </a-form-item>
        <a-form-item label="价格" name="price" :rules="[{ required: true, message: '请填写价格' }]">
          <a-input-number v-model:value="formState.price" :min="0" :precision="2" style="width: 100%">
            <template #addonAfter>
              <a-input v-model:value="formState.unit" style="width: 110px" />
            </template>
          </a-input-number>
        </a-form-item>
        <a-form-item label="说明" name="description">
          <a-textarea v-model:value="formState.description" :rows="3" placeholder="权属/技能/可上工时间等" />
        </a-form-item>
        <a-form-item
          label="联系电话"
          name="contactPhone"
          :rules="[{ required: true, message: '请填写联系电话' }, { pattern: /^1[3-9]\d{9}$/, message: '请填写 11 位手机号' }]"
        >
          <a-input v-model:value="formState.contactPhone" placeholder="对外展示的联系方式，其他主体看到的是脱敏号码" />
        </a-form-item>
        <p class="form-hint">发布主体：{{ identityName || '未解析到经营主体' }}（由登录令牌解析，不可在此填写）</p>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { AimOutlined, ArrowRightOutlined, EnvironmentOutlined, PhoneOutlined, PlusOutlined, TeamOutlined } from '@ant-design/icons-vue'
import { message, type FormInstance } from 'ant-design-vue'
import { serviceApi } from '../api'
import { useAppStore } from '../app-context'
import type { Expert, ServiceResource } from '../types'
import LoadingBlock from '../components/LoadingBlock.vue'
import PageTitle from '../components/PageTitle.vue'

const app = useAppStore()
const tab = ref<'land' | 'labor' | 'legal'>('land')
const resources = ref<ServiceResource[]>([])
const experts = ref<Expert[]>([])
const identityName = ref('')
const loading = ref(true)
const publishOpen = ref(false)
const submitting = ref(false)
const question = ref('')
const lawyerId = ref<number | null>(null)
const formRef = ref<FormInstance>()

const formState = reactive<{
  resourceType: 'land' | 'labor'
  title: string
  location: string
  areaMu?: number
  price?: number
  unit: string
  description: string
  contactPhone: string
}>({
  resourceType: 'land',
  title: '',
  location: '',
  areaMu: undefined,
  price: undefined,
  unit: '元/亩/年',
  description: '',
  contactPhone: '',
})

function load() {
  loading.value = true
  Promise.all([serviceApi.resources(), serviceApi.experts(), serviceApi.identity().catch(() => null)])
    .then(([rows, roster, identity]) => {
      resources.value = rows
      experts.value = roster
      identityName.value = identity?.merchantName ?? ''
      const lawyer = roster.find((item) => item.category === '法律咨询')
      lawyerId.value = lawyer?.id ?? null
    })
    .catch((reason: Error) => message.error(reason.message))
    .finally(() => { loading.value = false })
}

onMounted(load)

const landList = computed(() => resources.value.filter((item) => item.resourceType === 'land'))
const laborList = computed(() => resources.value.filter((item) => item.resourceType === 'labor'))
const lawyer = computed(() => experts.value.find((item) => item.id === lawyerId.value) ?? null)

function openPublish() {
  formState.resourceType = tab.value === 'labor' ? 'labor' : 'land'
  formState.title = ''
  formState.location = ''
  formState.areaMu = undefined
  formState.price = undefined
  formState.unit = tab.value === 'labor' ? '元/人/天' : '元/亩/年'
  formState.description = ''
  formState.contactPhone = ''
  publishOpen.value = true
}

async function publish() {
  submitting.value = true
  try {
    await formRef.value?.validate()
    const created = await serviceApi.createResource({ ...formState })
    publishOpen.value = false
    message.success(`资源「${created.title}」已发布，归属主体 ${created.merchantName ?? ''}`)
    load()
  } catch (reason) {
    if (reason instanceof Error) message.error(reason.message)
  } finally {
    submitting.value = false
  }
}

async function askLegal() {
  if (!question.value.trim()) {
    message.warning('请先描述法律问题')
    return
  }
  if (!lawyer.value) {
    message.error('当前没有在册的涉农法律专家，无法受理')
    return
  }
  try {
    const created = await serviceApi.createConsultation({
      type: '法律图文',
      expertId: lawyer.value.id,
      subject: question.value.slice(0, 24),
      content: question.value,
    })
    question.value = ''
    message.success(`已受理（${created.consultNo}），${lawyer.value.name} 的复核结论会在消息中心通知`)
    load()
  } catch (reason) {
    message.error(reason instanceof Error ? reason.message : '提交失败')
  }
}
</script>
