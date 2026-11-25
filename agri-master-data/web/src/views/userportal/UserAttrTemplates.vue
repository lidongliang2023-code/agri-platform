<template>
  <div class="mds-page">
    <PageHeader
      title="属性模板"
      subtitle="按品类查看属性集合：哪些属性必填、哪些参与 SKU 规格组合。模板由平台 / 主体管理员维护。"
      source="主数据 · 品类属性"
    >
      
    </PageHeader>

    <NoticeBar tone="info" title="口径：">
      属性是品类级公共数据（模板），不是本主体私有数据；这里只做只读查看。
    </NoticeBar>

    <div class="mds-card">

      <AgriVueTable
        :columns="columns"
        :data="attributes"
        row-key="id"
        :loading="loading"
        loading-text="正在加载属性…"
        column-settings-storage-key="mds:cols:user-attr-templates"
        client-pagination
        @refresh="loadAttributes"
      >
        <template #filter>
          <AgriVueFilterBar :field-count="1" :loading="loading" @search="loadAttributes" @reset="resetListFilter1">
            <div class="agri-vue-filter-field">
              <label>品类</label>
              <select v-model="categoryId" class="mds-select" @change="loadAttributes">
                        <option value="">请选择品类</option>
                        <option v-for="category in categories" :key="category.id" :value="String(category.id)">
                          {{ category.categoryName }}
                        </option>
                      </select>
            </div>
          </AgriVueFilterBar>
        </template>
        <template #empty>
          <EmptyState icon="🧩" title="还没有可用品类" description="品类目录为空，属性模板无从挂载。可先到「我的品类」查看。" />
        </template>
        <template #cell-attributeName="{ row: row }">
          <div class="mds-name">
            {{ row.attributeName }}
          </div>
        </template>
        <template #cell-attributeType="{ row: row }">
          {{ typeText(row.attributeType) }}
        </template>
        <template #cell-options="{ row: row }">
          {{ row.options || row.unit || '—' }}
        </template>
        <template #cell-isRequired="{ row: row }">
          {{ Number(row.isRequired) === 1 ? '是' : '否' }}
        </template>
        <template #cell-status="{ row: row }">
          <StatusTag :text="Number(row.status) === 1 ? '启用' : '停用'" :tone="Number(row.status) === 1 ? 'success' : 'gray'" />
        </template>
      </AgriVueTable>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AgriVueTable, AgriVueFilterBar, type VueListColumn } from '@agri/shared/vue/list'
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

const columns: VueListColumn[] = [
  { prop: 'attributeCode', label: '属性编码', minWidth: 142, locked: true, kind: 'code' },
  { prop: 'attributeName', label: '属性名称', width: 128 },
  { prop: 'attributeType', label: '类型', width: 128, ellipsis: false },
  { prop: 'options', label: '单位 / 取值', width: 128, ellipsis: false },
  { prop: 'isRequired', label: '必填', width: 128, align: 'center', ellipsis: false },
  { prop: 'status', label: '状态', width: 104, kind: 'status', ellipsis: false },
]

function resetListFilter1() {
  categoryId.value = ""
  void loadAttributes()
}
</script>
