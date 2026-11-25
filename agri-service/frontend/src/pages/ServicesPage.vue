<template>
  <div class="page-stack">
    <PageTitle
      eyebrow="SERVICE MARKETPLACE"
      title="服务超市"
      description="平台认证、明码标价、过程可追踪。按生产场景筛选本地服务能力。"
    >
      <template #actions>
        <a-button type="primary" @click="app.navigate('demand')">
          <template #icon><RobotOutlined /></template>
          描述需求，AI 帮我找
        </a-button>
      </template>
    </PageTitle>

    <section class="filter-panel surface-card">
      <div class="filter-search">
        <a-input
          v-model:value="keyword"
          size="large"
          allow-clear
          placeholder="搜索服务项目、服务商或能力标签"
          @press-enter="search"
        >
          <template #prefix><SearchOutlined /></template>
        </a-input>
        <a-button size="large" type="primary" @click="search">搜索</a-button>
      </div>
      <div class="filter-line">
        <span class="filter-label"><FilterOutlined /> 服务类型</span>
        <div class="category-tabs">
          <button
            v-for="item in categoryOptions"
            :key="item"
            type="button"
            :class="{ on: category === item }"
            @click="category = item"
          >
            {{ item }}
          </button>
        </div>
        <a-select
          v-model:value="sort"
          :options="sortOptions"
          class="sort-select"
        />
      </div>
    </section>

    <div class="result-heading">
      <div><span>{{ heading }}</span><small>共找到 {{ providers.length }} 家认证服务商</small></div>
      <span class="verified-note">仅展示状态为「可接单」的服务商，资质材料以其档案页公示为准</span>
    </div>

    <LoadingBlock v-if="loading" :rows="4" />
    <EmptyState v-else-if="error" icon="📡" title="服务列表加载失败" :description="error">
      <template #action>
        <a-button @click="app.openServices()">重新加载</a-button>
      </template>
    </EmptyState>
    <EmptyState v-else-if="providers.length === 0" icon="🔎" title="没有找到匹配服务" description="换一个关键词或服务类型，也可以直接发布需求让服务商响应。">
      <template #action>
        <a-button type="primary" @click="app.navigate('demand')">发布需求</a-button>
      </template>
    </EmptyState>
    <div v-else class="provider-grid">
      <ProviderCard v-for="provider in providers" :key="provider.id" :provider="provider" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { FilterOutlined, RobotOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { serviceApi } from '../api'
import { useAppStore } from '../app-context'
import type { Provider } from '../types'
import EmptyState from '../components/EmptyState.vue'
import LoadingBlock from '../components/LoadingBlock.vue'
import PageTitle from '../components/PageTitle.vue'
import ProviderCard from '../components/ProviderCard.vue'

const app = useAppStore()
const providers = ref<Provider[]>([])
const categories = ref<string[]>([])
const loading = ref(true)
const error = ref('')
const keyword = ref(app.query.get('q') ?? '')
const category = ref(app.query.get('category') ?? '全部')
const sort = ref('recommended')

const sortOptions = [
  { value: 'recommended', label: '综合推荐' },
  { value: 'distance', label: '距离最近' },
  { value: 'price', label: '价格最低' },
  { value: 'orders', label: '服务最多' },
]

const categoryOptions = computed(() => (categories.value.length ? categories.value : ['全部']))
const heading = computed(() => (keyword.value ? `“${keyword.value}” 的搜索结果` : category.value === '全部' ? '全部认证服务' : category.value))

onMounted(() => {
  serviceApi.dictionaries()
    .then((dict) => { categories.value = ['全部', ...dict.categories] })
    .catch(() => { categories.value = ['全部'] })
})

watch(() => app.query, (q) => {
  keyword.value = q.get('q') ?? ''
  category.value = q.get('category') ?? '全部'
})

let reqSeq = 0
watch([keyword, category, sort], () => {
  const seq = ++reqSeq
  loading.value = true
  error.value = ''
  serviceApi.providers({
    keyword: keyword.value || undefined,
    category: category.value === '全部' ? undefined : category.value,
    sort: sort.value,
  })
    .then((items) => { if (seq === reqSeq) providers.value = items })
    .catch((reason: Error) => { if (seq === reqSeq) error.value = reason.message })
    .finally(() => { if (seq === reqSeq) loading.value = false })
}, { immediate: true })

function search() {
  app.openServices(keyword.value.trim(), category.value === '全部' ? undefined : category.value)
}
</script>
