<template>
  <div class="page-stack">
    <PageTitle
      eyebrow="PROVIDER ONBOARDING"
      title="服务商入驻"
      description="面向农机、农技、检测、培训与涉农服务机构。入驻档案归属当前登录经营主体，审核通过后才会进入服务超市。"
    />
    <section class="join-hero">
      <div>
        <span class="hero-kicker"><i /> 共建可核查的农业服务网络</span>
        <h2>让专业能力被看见，让服务可靠地成交</h2>
        <p>一次入驻，同时连接需求发布、派单履约与担保结算。</p>
      </div>
      <div class="join-metrics">
        <span><b>{{ availableProviders }}</b><small>当前在营可接单服务商</small></span>
        <span><b>{{ applicant || '未解析' }}</b><small>本次申请归属主体</small></span>
      </div>
    </section>

    <div class="join-layout">
      <section class="surface-card join-form-card">
        <div class="section-heading compact">
          <div><span class="section-kicker">APPLY NOW</span><h2>提交入驻资料</h2></div>
          <span class="section-note">审核进度以运营端结论为准</span>
        </div>
        <div v-if="success" class="join-success">
          <span><CheckCircleFilled /></span>
          <h2>申请已提交</h2>
          <p>{{ success.name }} 的入驻资料已进入审核队列，审核结论会写入消息中心。</p>
          <div><b>申请状态</b><span>{{ success.status === 'pending' ? '待审核' : success.status }}</span></div>
          <a-button type="primary" @click="success = null">继续提交资料</a-button>
        </div>
        <a-form v-else :model="formState" layout="vertical" @finish="submit">
          <div class="form-grid-2">
            <a-form-item label="服务商名称" name="name" :rules="[{ required: true, message: '请输入服务商名称' }]">
              <a-input v-model:value="formState.name" placeholder="公司、合作社或服务队名称" />
            </a-form-item>
            <a-form-item label="服务类型" name="category" :rules="[{ required: true }]">
              <a-select v-model:value="formState.category" :options="categoryOptions" />
            </a-form-item>
          </div>
          <div class="form-grid-2">
            <a-form-item label="联系人（自动取当前主体）">
              <a-input :value="applicant || '未解析到经营主体'" readonly disabled />
            </a-form-item>
            <a-form-item
              label="联系电话"
              name="phone"
              :rules="[{ required: true, message: '请输入联系电话' }, { pattern: /^1[3-9]\d{9}$/, message: '请输入 11 位手机号' }]"
            >
              <a-input v-model:value="formState.phone" />
            </a-form-item>
          </div>
          <a-form-item label="主要服务区域" name="region" :rules="[{ required: true, message: '请输入服务区域' }]">
            <a-input v-model:value="formState.region" placeholder="如：长沙市望城区乔口镇及周边 30km" />
          </a-form-item>
          <a-form-item label="资质与证照名称" name="certifications" :rules="[{ required: true, message: '请填写已有的营业执照/许可证名称' }]">
            <a-input v-model:value="formState.certifications" placeholder="逗号分隔，如：营业执照,农机作业许可" />
          </a-form-item>
          <a-form-item label="服务能力与优势" name="description" :rules="[{ required: true, message: '请介绍服务能力' }]">
            <a-textarea v-model:value="formState.description" :rows="4" placeholder="服务项目、设备数量、人员资质、过往服务规模等" />
          </a-form-item>
          <p class="form-assurance">本版不接收证照图片附件，填写的资质名称会展示在服务商档案页；审核时由平台线下查验原件。</p>
          <a-button type="primary" size="large" html-type="submit" block :loading="submitting">提交入驻审核</a-button>
          <p class="form-assurance">提交即表示同意平台服务商管理规范，资料仅用于资质审核与档案展示。</p>
        </a-form>
      </section>

      <aside class="join-aside">
        <div class="join-benefit"><ThunderboltOutlined /><h3>获得服务需求</h3><p>进入需求大厅的抢单池，同类目在营需求会出现在移动工作台。</p></div>
        <div class="join-benefit"><ShopOutlined /><h3>建立服务档案</h3><p>展示资质名称、服务项目、真实评价与可约档期。</p></div>
        <div class="join-benefit"><TeamOutlined /><h3>履约与结算协同</h3><p>订单、进度上报、验收与结算批次在同一套流程内留痕。</p></div>
        <div class="join-contact"><b>提示</b><span>入驻申请归属于当前登录主体</span><small>同一主体重复提交会被运营审核合并处理</small></div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { CheckCircleFilled, ShopOutlined, TeamOutlined, ThunderboltOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { serviceApi } from '../api'
import PageTitle from '../components/PageTitle.vue'

const submitting = ref(false)
const categories = ref<string[]>([])
const applicant = ref('')
const availableProviders = ref(0)
const success = ref<{ name: string; status: string; message: string } | null>(null)

const formState = reactive({
  name: '',
  category: '农机作业',
  phone: '',
  region: '',
  certifications: '',
  description: '',
})

const categoryOptions = computed(() => (categories.value.length ? categories.value : ['农机作业']).map((value) => ({ value, label: value })))

onMounted(() => {
  Promise.all([serviceApi.dictionaries(), serviceApi.identity().catch(() => null)])
    .then(([dict, identity]) => {
      categories.value = dict.categories
      if (dict.categories.length) formState.category = dict.categories[0]
      applicant.value = identity?.merchantName ?? ''
    })
    .catch(() => { categories.value = [] })

  serviceApi.providers({})
    .then((rows) => { availableProviders.value = rows.length })
    .catch(() => { availableProviders.value = 0 })
})

async function submit() {
  submitting.value = true
  try {
    success.value = await serviceApi.applyProvider({ ...formState })
    message.success('入驻申请已提交，可在消息中心跟踪审核结论')
  } catch (reason) {
    message.error(reason instanceof Error ? reason.message : '入驻申请失败')
  } finally {
    submitting.value = false
  }
}
</script>
