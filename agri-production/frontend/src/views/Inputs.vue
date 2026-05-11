<template>
  <div class="inputs-page">
    <div class="page-header">
      <el-button type="primary" @click="showAddDialog = true">
        <el-icon><Plus /></el-icon> 添加投入品
      </el-button>
      <el-select v-model="typeFilter" placeholder="类型筛选" class="type-select">
        <el-option label="全部" value="" />
        <el-option label="化肥" value="fertilizer" />
        <el-option label="农药" value="pesticide" />
        <el-option label="种子" value="seed" />
        <el-option label="农膜" value="film" />
      </el-select>
      <el-input 
        v-model="searchKeyword" 
        placeholder="搜索投入品名称" 
        class="search-input"
        @keyup.enter="handleSearch"
      >
        <template #append>
          <el-button @click="handleSearch"><el-icon><Search /></el-icon></el-button>
        </template>
      </el-input>
    </div>

    <el-card>
      <el-table :data="inputs" border>
        <el-table-column prop="inputName" label="投入品名称" />
        <el-table-column prop="inputCode" label="编码" />
        <el-table-column prop="inputType" label="类型">
          <template #default="scope">
            <el-tag type="primary">{{ getTypeText(scope.row.inputType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="specification" label="规格" />
        <el-table-column prop="unit" label="单位" />
        <el-table-column prop="quantity" label="库存数量" />
        <el-table-column prop="minStock" label="最低库存" />
        <el-table-column prop="status" label="库存状态">
          <template #default="scope">
            <el-tag :type="getStockStatusType(scope.row)">{{ getStockStatusText(scope.row) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="expireDate" label="有效期" />
        <el-table-column label="操作">
          <template #default="scope">
            <el-button size="small" @click="editInput(scope.row)">编辑</el-button>
            <el-button size="small" @click="adjustStock(scope.row)">调整库存</el-button>
            <el-button size="small" type="danger" @click="deleteInput(scope.row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        :current-page="pagination.pageNum"
        :page-size="pagination.pageSize"
        :total="pagination.total"
        layout="total, prev, pager, next, jumper"
        @current-change="handlePageChange"
      />
    </el-card>

    <el-dialog :title="editForm.id ? '编辑投入品' : '添加投入品'" :visible.sync="showAddDialog">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="投入品名称" prop="inputName">
          <el-input v-model="editForm.inputName" />
        </el-form-item>
        <el-form-item label="编码" prop="inputCode">
          <el-input v-model="editForm.inputCode" />
        </el-form-item>
        <el-form-item label="类型" prop="inputType">
          <el-select v-model="editForm.inputType">
            <el-option label="化肥" value="fertilizer" />
            <el-option label="农药" value="pesticide" />
            <el-option label="种子" value="seed" />
            <el-option label="农膜" value="film" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="规格" prop="specification">
          <el-input v-model="editForm.specification" />
        </el-form-item>
        <el-form-item label="单位" prop="unit">
          <el-input v-model="editForm.unit" />
        </el-form-item>
        <el-form-item label="库存数量" prop="quantity">
          <el-input v-model="editForm.quantity" type="number" />
        </el-form-item>
        <el-form-item label="最低库存" prop="minStock">
          <el-input v-model="editForm.minStock" type="number" />
        </el-form-item>
        <el-form-item label="有效期" prop="expireDate">
          <el-date-picker v-model="editForm.expireDate" type="date" />
        </el-form-item>
        <el-form-item label="供应商" prop="supplier">
          <el-input v-model="editForm.supplier" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="saveInput">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog title="调整库存" :visible.sync="showStockDialog">
      <el-form :model="stockForm" label-width="100px">
        <el-form-item label="调整数量">
          <el-input v-model="stockForm.changeQuantity" type="number" placeholder="正数入库，负数出库" />
        </el-form-item>
        <el-form-item label="备注">
          <el-textarea v-model="stockForm.remark" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showStockDialog = false">取消</el-button>
        <el-button type="primary" @click="saveStockChange">确认调整</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { Plus, Search } from '@element-plus/icons-vue'

const searchKeyword = ref('')
const typeFilter = ref('')
const showAddDialog = ref(false)
const showStockDialog = ref(false)

const inputs = ref([
  { id: 1, inputName: '尿素', inputCode: 'I001', inputType: 'fertilizer', specification: '50kg/袋', unit: 'kg', quantity: 1200, minStock: 500, expireDate: '2025-12-31', supplier: '农资公司A', createTime: '2024-01-01' },
  { id: 2, inputName: '复合肥', inputCode: 'I002', inputType: 'fertilizer', specification: '40kg/袋', unit: 'kg', quantity: 350, minStock: 200, expireDate: '2025-06-30', supplier: '农资公司B', createTime: '2024-01-10' },
  { id: 3, inputName: '杀虫剂', inputCode: 'I003', inputType: 'pesticide', specification: '500ml/瓶', unit: '瓶', quantity: 80, minStock: 50, expireDate: '2025-03-15', supplier: '农药厂家C', createTime: '2024-02-01' },
  { id: 4, inputName: '小麦种子', inputCode: 'I004', inputType: 'seed', specification: '10kg/袋', unit: 'kg', quantity: 800, minStock: 300, expireDate: '2024-06-30', supplier: '种子公司D', createTime: '2024-02-15' },
  { id: 5, inputName: '农膜', inputCode: 'I005', inputType: 'film', specification: '2m*100m', unit: '卷', quantity: 50, minStock: 20, expireDate: '2026-12-31', supplier: '塑料厂E', createTime: '2024-03-01' }
])

const pagination = reactive({
  pageNum: 1,
  pageSize: 10,
  total: 5
})

const editForm = reactive({
  id: null,
  inputName: '',
  inputCode: '',
  inputType: 'fertilizer',
  specification: '',
  unit: '',
  quantity: 0,
  minStock: 0,
  expireDate: '',
  supplier: ''
})

const stockForm = reactive({
  inputId: null,
  changeQuantity: 0,
  remark: ''
})

const getTypeText = (type) => {
  const texts = { fertilizer: '化肥', pesticide: '农药', seed: '种子', film: '农膜', other: '其他' }
  return texts[type] || type
}

const getStockStatusType = (row) => {
  if (row.quantity <= 0) return 'danger'
  if (row.quantity <= row.minStock) return 'warning'
  return 'success'
}

const getStockStatusText = (row) => {
  if (row.quantity <= 0) return '库存不足'
  if (row.quantity <= row.minStock) return '低于最低库存'
  return '正常'
}

const handleSearch = () => {
  console.log('搜索:', searchKeyword.value, typeFilter.value)
}

const handlePageChange = (page) => {
  pagination.pageNum = page
}

const editInput = (input) => {
  Object.assign(editForm, input)
  showAddDialog.value = true
}

const adjustStock = (input) => {
  stockForm.inputId = input.id
  stockForm.changeQuantity = 0
  stockForm.remark = ''
  showStockDialog.value = true
}

const deleteInput = (id) => {
  inputs.value = inputs.value.filter(i => i.id !== id)
  pagination.total--
  ElMessage.success('删除成功')
}

const saveInput = () => {
  if (editForm.id) {
    const index = inputs.value.findIndex(i => i.id === editForm.id)
    if (index > -1) {
      inputs.value[index] = { ...editForm }
    }
    ElMessage.success('更新成功')
  } else {
    const newInput = { 
      ...editForm, 
      id: Date.now(), 
      createTime: new Date().toISOString().split('T')[0] 
    }
    inputs.value.unshift(newInput)
    pagination.total++
    ElMessage.success('添加成功')
  }
  showAddDialog.value = false
  resetForm()
}

const saveStockChange = () => {
  const input = inputs.value.find(i => i.id === stockForm.inputId)
  if (input) {
    input.quantity += stockForm.changeQuantity
    ElMessage.success('库存调整成功')
  }
  showStockDialog.value = false
}

const resetForm = () => {
  editForm.id = null
  editForm.inputName = ''
  editForm.inputCode = ''
  editForm.inputType = 'fertilizer'
  editForm.specification = ''
  editForm.unit = ''
  editForm.quantity = 0
  editForm.minStock = 0
  editForm.expireDate = ''
  editForm.supplier = ''
}
</script>

<style scoped>
.inputs-page {
  padding: 20px;
}

.page-header {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.type-select {
  width: 150px;
}

.search-input {
  width: 300px;
}
</style>