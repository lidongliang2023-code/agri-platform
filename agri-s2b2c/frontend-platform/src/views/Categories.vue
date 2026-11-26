<template>
  <div class="categories-page">
    <div class="page-head">
      <div>
        <h2>类目与溯源模板</h2>
        <p>类目树主数据归主数据管理；本页维护分销展示类目。溯源模板需生产管理提供批次字段定义，当前未接入，不做占位假数据。</p>
      </div>
    </div>

    <AgriElementListTable
      :columns="columns"
      :data="filteredCategories"
      row-key="id"
      :loading="loading"
      client-pagination
      column-settings-storage-key="agri-s2b2c-platform:categories"
      empty-text="暂无符合条件的类目"
      @refresh="loadCategories"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="2" :loading="loading" @search="applyFilter" @reset="resetFilter">
          <div class="agri-vue-filter-field">
            <label>类目名称</label>
            <el-input v-model="draft.keyword" placeholder="搜索类目名称" clearable @keyup.enter="applyFilter" />
          </div>
          <div class="agri-vue-filter-field">
            <label>状态</label>
            <el-select v-model="draft.status" placeholder="全部">
              <el-option label="全部" value="" />
              <el-option label="启用" value="ACTIVE" />
              <el-option label="禁用" value="INACTIVE" />
            </el-select>
          </div>
        </AgriVueFilterBar>
      </template>

      <template #toolbar-left>
        <el-button type="primary" @click="openAdd">添加分类</el-button>
      </template>

      <template #cell-status="{ row }">
        <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'danger'">{{ row.status === 'ACTIVE' ? '启用' : '禁用' }}</el-tag>
      </template>
      <template #cell-actions="{ row }">
        <AgriVueRowActions
          :actions="[
            { key: 'edit', label: '编辑', onClick: () => editCategory(row) },
            { key: 'delete', label: '删除', danger: true, onClick: () => deleteCategory(row.id) },
          ]"
        />
      </template>
    </AgriElementListTable>

    <el-dialog v-model="showAddDialog" :title="isEdit ? '编辑分类' : '添加分类'">
      <el-form :model="form" label-width="80px">
        <el-form-item label="分类名称">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="上级分类">
          <el-select v-model="form.parentId" placeholder="请选择">
            <el-option label="顶级分类" :value="0" />
            <el-option v-for="cat in parentCategories" :key="cat.id" :label="cat.name" :value="cat.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="图标">
          <el-input v-model="form.icon" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input v-model.number="form.sortOrder" type="number" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio label="ACTIVE">启用</el-radio>
            <el-radio label="INACTIVE">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="saveCategory">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive, computed } from 'vue'
import { AgriElementListTable, AgriVueFilterBar, AgriVueRowActions } from '@agri/shared/vue/element'
import { platformApi } from '../api'

const categories = ref([])
const loading = ref(false)
const showAddDialog = ref(false)
const isEdit = ref(false)
const draft = reactive({ keyword: '', status: '' })
const activeFilter = reactive({ keyword: '', status: '' })

const columns = [
  { key: 'id', prop: 'id', label: 'ID', width: 90 },
  { key: 'name', prop: 'name', label: '名称', minWidth: 180 },
  { key: 'icon', prop: 'icon', label: '图标', width: 140 },
  { key: 'level', prop: 'level', label: '层级', width: 90 },
  { key: 'sortOrder', prop: 'sortOrder', label: '排序', width: 90 },
  { key: 'status', prop: 'status', label: '状态', width: 110 },
  { key: 'actions', label: '操作', width: 130 },
]

const form = reactive({
  id: null,
  name: '',
  parentId: 0,
  icon: '',
  sortOrder: 0,
  status: 'ACTIVE',
})

const parentCategories = computed(() => categories.value.filter((c) => c.level === 1))

const filteredCategories = computed(() => {
  const kw = activeFilter.keyword.trim().toLowerCase()
  return categories.value.filter((c) => {
    if (activeFilter.status && c.status !== activeFilter.status) return false
    if (kw && !String(c.name || '').toLowerCase().includes(kw)) return false
    return true
  })
})

async function loadCategories() {
  loading.value = true
  try {
    const res = await platformApi.getCategories()
    categories.value = res || []
  } finally {
    loading.value = false
  }
}

onMounted(loadCategories)

const applyFilter = () => {
  activeFilter.keyword = draft.keyword
  activeFilter.status = draft.status
}

const resetFilter = () => {
  draft.keyword = ''
  draft.status = ''
  activeFilter.keyword = ''
  activeFilter.status = ''
}

const openAdd = () => {
  isEdit.value = false
  Object.assign(form, { id: null, name: '', parentId: 0, icon: '', sortOrder: 0, status: 'ACTIVE' })
  showAddDialog.value = true
}

const editCategory = (row) => {
  isEdit.value = true
  Object.assign(form, row)
  showAddDialog.value = true
}

const saveCategory = async () => {
  if (isEdit.value) {
    await platformApi.updateCategory(form)
  } else {
    await platformApi.addCategory(form)
  }
  showAddDialog.value = false
  loadCategories()
}

const deleteCategory = async (id) => {
  if (!confirm('确定删除这个分类吗？')) return
  await platformApi.deleteCategory(id)
  loadCategories()
}
</script>

<style scoped>
.categories-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 760px; }
</style>
