<template>
  <div class="mds-page">
    <PageHeader
      title="属性模板"
      subtitle="按品类查看属性集合：哪些属性必填、哪些参与 SKU 规格组合。模板由平台 / 主体管理员维护。"
      source="主数据 · 品类属性"
    >
      <template #actions>
        <button class="mds-btn" :disabled="loading" @click="loadAttributes">刷新</button>
      </template>
    </PageHeader>

    <NoticeBar tone="info" title="口径：">
      属性是品类级公共数据（模板），不是本主体私有数据；这里只做只读查看。
    </NoticeBar>

    <div class="mds-card">
      <div class="mds-filter">
        <select v-model="categoryId" class="mds-select" style="min-width: 280px" @change="loadAttributes">
          <option value="">请选择品类</option>
          <option v-for="category in categories" :key="category.id" :value="String(category.id)">
            {{ category.categoryName }}
          </option>
        </select>
        <span class="mds-hint">共 {{ attributes.length }} 个属性</span>
      </div>

      <div class="mds-table-wrap">
        <table class="mds-table">
          <thead>
            <tr>
              <th>属性编码</th>
              <th>属性名称</th>
              <th>类型</th>
              <th>单位 / 取值</th>
              <th class="mds-center">必填</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading"><td colspan="6" class="mds-empty">正在加载属性…</td></tr>
            <tr v-else-if="!categories.length">
              <td colspan="6"><EmptyState icon="🧩" title="还没有可用品类" description="品类目录为空，属性模板无从挂载。可先到「我的品类」查看。" /></td>
            </tr>
            <tr v-else-if="!attributes.length">
              <td colspan="6"><EmptyState icon="🧩" title="该品类还没有属性" description="模板为空时，商品无法做规格组合。" /></td>
            </tr>
            <tr v-for="row in attributes" :key="row.id">
              <td class="mds-mono">{{ row.attributeCode }}</td>
              <td class="mds-name">{{ row.attributeName }}</td>
              <td>{{ typeText(row.attributeType) }}</td>
              <td>{{ row.options || row.unit || '—' }}</td>
              <td class="mds-center">{{ Number(row.isRequired) === 1 ? '是' : '否' }}</td>
              <td><StatusTag :text="Number(row.status) === 1 ? '启用' : '停用'" :tone="Number(row.status) === 1 ? 'success' : 'gray'" /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { userGet } from '@/utils/userApi'
import { useMeStore } from '@/stores/me'

interface CategoryRow { id: number; categoryName?: string }
interface AttributeRow {
  id: number
  attributeCode?: string
  attributeName?: string
  attributeType?: string
  unit?: string
  options?: string
  isRequired?: number
  status?: number
}

const me = useMeStore()
const categories = ref<CategoryRow[]>([])
const attributes = ref<AttributeRow[]>([])
const categoryId = ref('')
const loading = ref(false)

const TYPE_TEXT: Record<string, string> = {
  string: '文本',
  number: '数值',
  enum: '枚举',
  date: '日期',
  boolean: '布尔',
}
const typeText = (type?: string) => TYPE_TEXT[type ?? ''] ?? type ?? '—'

async function loadCategories() {
  try {
    const response = await userGet<CategoryRow[]>('/api/user/categories')
    categories.value = response.data ?? []
    if (categories.value.length) {
      categoryId.value = String(categories.value[0].id)
    }
  } catch {
    categories.value = []
  }
}

async function loadAttributes() {
  loading.value = true
  try {
    await me.load()
    if (!categoryId.value) {
      attributes.value = []
      return
    }
    const response = await userGet<AttributeRow[]>('/api/product/attribute', { categoryId: categoryId.value })
    attributes.value = response.data ?? []
  } catch {
    attributes.value = []
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadCategories()
  await loadAttributes()
})
</script>
