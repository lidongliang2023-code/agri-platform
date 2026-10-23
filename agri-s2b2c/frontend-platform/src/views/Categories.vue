<template>
  <div class="categories-page">
    <el-button type="primary" @click="showAddDialog = true">添加分类</el-button>
    <el-table :data="categories" border style="margin-top: 20px">
      <el-table-column prop="id" label="ID" />
      <el-table-column prop="name" label="名称" />
      <el-table-column prop="icon" label="图标" />
      <el-table-column prop="level" label="层级" />
      <el-table-column prop="sortOrder" label="排序" />
      <el-table-column prop="status" label="状态">
        <template #default="{ row }">
          <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'danger'">{{ row.status === 'ACTIVE' ? '启用' : '禁用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作">
        <template #default="{ row }">
          <el-button type="text" @click="editCategory(row)">编辑</el-button>
          <el-button type="text" @click="deleteCategory(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
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
import { platformApi } from '../api'

const categories = ref([])
const showAddDialog = ref(false)
const isEdit = ref(false)

const form = reactive({
  id: null,
  name: '',
  parentId: 0,
  icon: '',
  sortOrder: 0,
  status: 'ACTIVE'
})

const parentCategories = computed(() => {
  return categories.value.filter(c => c.level === 1)
})

onMounted(() => {
  loadCategories()
})

const loadCategories = async () => {
  const res = await platformApi.getCategories()
  categories.value = res
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
.categories-page {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
}
</style>