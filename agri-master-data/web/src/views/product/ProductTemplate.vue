<template>
  <div class="mds-page">
    <PageHeader
      title="属性模板与 SKU"
      subtitle="按品类维护属性集合（模板），SKU 由参与规格的属性笛卡尔组合生成；属性编码与单位是主数据级标准。"
      source="品类 · 属性模板"
    >
      <template #actions>
        <button class="mds-btn" @click="router.push('/product/catalog')">品类标准与单位</button>
        <button class="mds-btn" @click="router.push('/datastandard/code-rule')">查看编码规则</button>
      </template>
    </PageHeader>

    <NoticeBar tone="info" title="模板与 SKU 的关系：">
      模板 = 某个品类允许/要求的属性全集；勾选「参与规格」的属性会进入 SKU 组合（例如 品种 × 等级 × 规格 × 包装）。
      SKU 编码由编码规则统一生成，不在本页单独维护。
    </NoticeBar>

    <div class="mds-split">
      <div class="mds-card" style="margin-bottom: 0">
        <div class="mds-card-head">
          <h2 class="mds-card-title">品类</h2>
          <span class="mds-tag mds-tag--plain">{{ flatCategories.length }} 个</span>
        </div>
        <div class="mds-card-body" style="padding: 10px 8px">
          <input v-model="categoryKeyword" class="mds-input mds-input--sm" placeholder="搜索品类" style="width: 100%" />
        </div>
        <div class="mds-tree">
          <button
            v-for="node in visibleCategories"
            :key="node.id"
            type="button"
            class="mds-tree__node"
            :class="[`mds-tree__node--depth-${Math.min(node.depth, 3)}`, { 'is-active': node.id === selectedId }]"
            @click="selectCategory(node.id)"
          >
            <span>{{ node.name }}</span>
            <span v-if="node.code" class="mds-tree__count">{{ node.code }}</span>
          </button>
          <EmptyState v-if="!visibleCategories.length" title="没有匹配的品类" description="先到品类标准页维护品类树。" />
        </div>
      </div>

      <div>
        <div class="mds-card">
          <div class="mds-card-head">
            <div>
              <h2 class="mds-card-title">
                属性模板
                <span v-if="selectedCategory" class="mds-card-sub" style="display: inline; margin-left: 8px">
                  {{ selectedCategory.name }}<template v-if="selectedCategory.code"> · {{ selectedCategory.code }}</template>
                </span>
              </h2>
              <p class="mds-card-sub">未选择品类时显示全部属性</p>
            </div>
            <div class="mds-head-actions">

            </div>
          </div>

          <div v-if="editing" class="mds-card-body" style="background: #fbfcfd; border-bottom: 1px solid var(--mds-line-soft)">
            <div class="mds-form">
              <label class="mds-field">
                <span class="mds-field__label mds-required">属性编码</span>
                <input v-model="form.attributeCode" class="mds-input" placeholder="如 variety / grade" />
              </label>
              <label class="mds-field">
                <span class="mds-field__label mds-required">属性名称</span>
                <input v-model="form.attributeName" class="mds-input" placeholder="如 品种 / 等级" />
              </label>
              <label class="mds-field">
                <span class="mds-field__label">数据类型</span>
                <select v-model="form.attributeType" class="mds-select">
                  <option value="string">文本</option>
                  <option value="number">数值</option>
                  <option value="enum">枚举</option>
                  <option value="date">日期</option>
                  <option value="boolean">布尔</option>
                </select>
              </label>
              <label class="mds-field">
                <span class="mds-field__label">单位</span>
                <input v-model="form.unit" class="mds-input" placeholder="如 kg / mm / %" />
              </label>
              <label class="mds-field">
                <span class="mds-field__label">枚举取值</span>
                <input v-model="form.options" class="mds-input" placeholder="枚举类型用逗号分隔，如 一级,二级,三级" />
              </label>
              <label class="mds-field">
                <span class="mds-field__label">排序</span>
                <input v-model.number="form.sortOrder" class="mds-input" type="number" min="0" />
              </label>
              <label class="mds-field">
                <span class="mds-field__label">是否必填</span>
                <select v-model.number="form.isRequired" class="mds-select">
                  <option :value="1">必填</option>
                  <option :value="0">选填</option>
                </select>
              </label>
              <label class="mds-field">
                <span class="mds-field__label">启用状态</span>
                <select v-model.number="form.status" class="mds-select">
                  <option :value="1">启用</option>
                  <option :value="0">停用</option>
                </select>
              </label>
              <label class="mds-field mds-field--full">
                <span class="mds-field__label">备注</span>
                <input v-model="form.remark" class="mds-input" placeholder="选填" />
              </label>
            </div>
            <div class="mds-form-actions">
              <button class="mds-btn" @click="editing = false">取消</button>
              <button class="mds-btn mds-btn--primary" :disabled="saving" @click="submitForm">
                {{ saving ? '保存中…' : '保存' }}
              </button>
            </div>
          </div>

          <AgriVueTable
            :columns="columns"
            :data="visibleAttributes"
            row-key="id"
            :loading="loading"
            loading-text="正在加载属性模板…"
            column-settings-storage-key="mds:cols:product-template"
            client-pagination
            v-model:page="listPage1"
            @refresh="loadAttributes"
          >
            <template #filter>
              <AgriVueFilterBar :field-count="1" :loading="loading" @search="applyListFilter1" @reset="resetListFilter1">
                <div class="agri-vue-filter-field">
                  <label>属性名称 / 编码</label>
                  <input v-model="keyword" class="mds-input" placeholder="搜索属性名称 / 编码" />
                </div>
              </AgriVueFilterBar>
            </template>
            <template #toolbar-left>
              <button v-point="'POST /api/product/attribute'" class="mds-btn mds-btn--primary" @click="startCreate">新增属性</button>
            </template>
            <template #empty>
              <EmptyState
                                    title="该品类暂无属性"
                                    description="属性模板为空时，商品无法进行规格组合；点击右上角「新增属性」开始维护。"
                                  />
            </template>
            <template #cell-attributeName="{ row: item }">
              <div class="mds-name">
                {{ item.attributeName }}
              </div>
            </template>
            <template #cell-attributeType="{ row: item }">
              {{ typeText(item.attributeType) }}
            </template>
            <template #cell-options="{ row: item }">
              <span v-if="item.options" class="mds-muted">{{ item.options }}</span>
                                  <span v-else>{{ item.unit || '—' }}</span>
            </template>
            <template #cell-isRequired="{ row: item }">
              {{ item.isRequired === 1 ? '是' : '否' }}
            </template>
            <template #cell-categoryName="{ row: item }">
              <div class="mds-muted">
                {{ item.categoryName || categoryName(item.categoryId) }}
              </div>
            </template>
            <template #cell-sortOrder="{ row: item }">
              {{ item.sortOrder ?? 0 }}
            </template>
            <template #cell-status="{ row: item }">
              <StatusTag :text="item.status === 1 ? '启用' : '停用'" :tone="item.status === 1 ? 'success' : 'gray'" />
            </template>
            <template #cell-actions="{ row: item }">
              <MdsRowActions
                :actions="[
                  { key: '1', label: &quot;编辑&quot;, onClick: () => startEdit(item), point: 'PUT /api/product/attribute/{id}' },
                  { key: '2', label: &quot;删除&quot;, onClick: () => remove(item), point: 'DELETE /api/product/attribute/{id}', disabled: busyId === item.id },
                ]"
              />
            </template>
          </AgriVueTable>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AgriVueTable, AgriVueFilterBar, type VueListColumn } from '@agri/shared/vue/list'
import MdsRowActions from '@/components/ui/MdsRowActions.vue'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import {
  createProductAttribute,
  deleteProductAttribute,
  getProductAttributeList,
  getProductCategoryTree,
  updateProductAttribute,
} from '@/utils/api'

interface CategoryNode {
  id: number
  categoryName: string
  categoryCode?: string
  children?: CategoryNode[]
}

interface FlatCategory {
  id: number
  name: string
  code?: string
  depth: number
}

interface AttributeRow {
  id: number
  categoryId?: number
  categoryName?: string
  attributeCode: string
  attributeName: string
  attributeType?: string
  unit?: string
  options?: string
  sortOrder?: number
  isRequired?: number
  status?: number
  remark?: string
}

const router = useRouter()
const categories = ref<FlatCategory[]>([])
const attributes = ref<AttributeRow[]>([])
const selectedId = ref<number | null>(null)
const loading = ref(false)
const saving = ref(false)
const busyId = ref<number | null>(null)
const keyword = ref('')
const categoryKeyword = ref('')
const editing = ref(false)
const editingId = ref<number | null>(null)

const form = reactive({
  categoryId: null as number | null,
  attributeCode: '',
  attributeName: '',
  attributeType: 'string',
  unit: '',
  options: '',
  sortOrder: 0,
  isRequired: 0,
  status: 1,
  remark: '',
})

const flatCategories = computed(() => categories.value)

const visibleCategories = computed(() => {
  const kw = categoryKeyword.value.trim()
  if (!kw) return categories.value
  return categories.value.filter((item) => item.name.includes(kw) || (item.code ?? '').includes(kw))
})

const selectedCategory = computed(() => categories.value.find((item) => item.id === selectedId.value) ?? null)

const visibleAttributes = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return attributes.value
  return attributes.value.filter(
    (item) =>
      item.attributeName.toLowerCase().includes(kw) || item.attributeCode.toLowerCase().includes(kw),
  )
})

const categoryName = (id?: number) => categories.value.find((item) => item.id === id)?.name ?? '—'
const typeText = (type?: string) =>
  ({ string: '文本', number: '数值', enum: '枚举', date: '日期', boolean: '布尔' } as Record<string, string>)[type ?? ''] ??
  (type || '—')

function flatten(nodes: CategoryNode[], depth = 0, out: FlatCategory[] = []) {
  nodes.forEach((node) => {
    out.push({ id: node.id, name: node.categoryName, code: node.categoryCode, depth })
    if (node.children?.length) flatten(node.children, depth + 1, out)
  })
  return out
}

async function loadCategories() {
  try {
    const response = await getProductCategoryTree()
    if (response.code !== 200) throw new Error(response.message || '品类加载失败')
    categories.value = flatten((response.data ?? []) as CategoryNode[])
  } catch (error) {
    categories.value = []
    message.error(error instanceof Error ? error.message : '品类加载失败')
  }
}

async function loadAttributes() {
  loading.value = true
  try {
    const response = await getProductAttributeList(
      selectedId.value ? { categoryId: selectedId.value } : undefined,
    )
    if (response.code !== 200) throw new Error(response.message || '属性加载失败')
    attributes.value = (response.data ?? []) as AttributeRow[]
  } catch (error) {
    attributes.value = []
    message.error(error instanceof Error ? error.message : '属性加载失败')
  } finally {
    loading.value = false
  }
}

function selectCategory(id: number) {
  selectedId.value = id
  void loadAttributes()
}

function resetForm() {
  Object.assign(form, {
    categoryId: selectedId.value,
    attributeCode: '',
    attributeName: '',
    attributeType: 'string',
    unit: '',
    options: '',
    sortOrder: 0,
    isRequired: 0,
    status: 1,
    remark: '',
  })
  editingId.value = null
}

function startCreate() {
  if (!selectedId.value) {
    message.warning('请先在左侧选择一个品类：属性模板按品类维护')
    return
  }
  resetForm()
  editing.value = true
}

function startEdit(item: AttributeRow) {
  editingId.value = item.id
  Object.assign(form, {
    categoryId: item.categoryId ?? selectedId.value,
    attributeCode: item.attributeCode,
    attributeName: item.attributeName,
    attributeType: item.attributeType ?? 'string',
    unit: item.unit ?? '',
    options: item.options ?? '',
    sortOrder: Number(item.sortOrder ?? 0),
    isRequired: Number(item.isRequired ?? 0),
    status: Number(item.status ?? 1),
    remark: item.remark ?? '',
  })
  editing.value = true
}

async function submitForm() {
  if (!form.attributeCode.trim() || !form.attributeName.trim()) {
    message.warning('属性编码与属性名称必填')
    return
  }
  saving.value = true
  try {
    const payload = { ...form, categoryId: form.categoryId ?? selectedId.value }
    const response = editingId.value
      ? await updateProductAttribute(editingId.value, payload)
      : await createProductAttribute(payload)
    if (response.code !== 200) throw new Error(response.message || '保存失败')
    message.success(editingId.value ? '属性已更新' : '属性已新增')
    editing.value = false
    await loadAttributes()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function remove(item: AttributeRow) {
  if (!window.confirm(`确认删除属性「${item.attributeName}」？已用于商品规格的属性删除后历史 SPU 将缺少该属性。`)) return
  busyId.value = item.id
  try {
    const response = await deleteProductAttribute(item.id)
    if (response.code !== 200) throw new Error(response.message || '删除失败')
    message.success('属性已删除')
    await loadAttributes()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '删除失败')
  } finally {
    busyId.value = null
  }
}

onMounted(async () => {
  await loadCategories()
  if (categories.value.length) {
    selectedId.value = categories.value[0].id
  }
  await loadAttributes()
})

const columns: VueListColumn[] = [
  { prop: 'attributeCode', label: '属性编码', minWidth: 142, locked: true, kind: 'code' },
  { prop: 'attributeName', label: '属性名称', width: 128 },
  { prop: 'attributeType', label: '类型', width: 128, ellipsis: false },
  { prop: 'options', label: '单位 / 取值', width: 128, ellipsis: false },
  { prop: 'isRequired', label: '必填', width: 128, align: 'center', ellipsis: false },
  { prop: 'categoryName', label: '所属品类', width: 128, ellipsis: false },
  { prop: 'sortOrder', label: '排序', width: 104, kind: 'number', ellipsis: false },
  { prop: 'status', label: '状态', width: 104, kind: 'status', ellipsis: false },
  { key: 'actions', label: '操作', width: 138, kind: 'action', ellipsis: false },
]

const listPage1 = ref(1)
function applyListFilter1() {
  listPage1.value = 1
}

function resetListFilter1() {
  keyword.value = ""
  applyListFilter1()
}

watch(keyword, () => { listPage1.value = 1 })
</script>
