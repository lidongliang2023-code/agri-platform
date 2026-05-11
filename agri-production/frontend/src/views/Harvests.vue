<template>
  <div class="harvests-page">
    <div class="page-header">
      <el-button type="primary" @click="showAddDialog = true">
        <el-icon><Plus /></el-icon> 新增采收记录
      </el-button>
      <el-select v-model="statusFilter" placeholder="状态筛选" class="status-select">
        <el-option label="全部" value="" />
        <el-option label="待审核" value="pending" />
        <el-option label="已审核" value="approved" />
        <el-option label="已入库" value="stored" />
      </el-select>
      <el-input 
        v-model="searchKeyword" 
        placeholder="搜索产品名称" 
        class="search-input"
        @keyup.enter="handleSearch"
      >
        <template #append>
          <el-button @click="handleSearch"><el-icon><Search /></el-icon></el-button>
        </template>
      </el-input>
    </div>

    <el-card>
      <el-table :data="harvests" border>
        <el-table-column prop="harvestCode" label="采收单号" />
        <el-table-column prop="productName" label="产品名称" />
        <el-table-column prop="plotName" label="地块" />
        <el-table-column prop="farmName" label="农场" />
        <el-table-column prop="quantity" label="采收数量" />
        <el-table-column prop="unit" label="单位" />
        <el-table-column prop="qualityGrade" label="品质等级">
          <template #default="scope">
            <el-tag :type="getGradeType(scope.row.qualityGrade)">{{ scope.row.qualityGrade }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="harvestDate" label="采收日期" />
        <el-table-column prop="status" label="状态">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)">{{ getStatusText(scope.row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作">
          <template #default="scope">
            <el-button size="small" @click="editHarvest(scope.row)">编辑</el-button>
            <el-button v-if="scope.row.status === 'pending'" size="small" type="success" @click="approveHarvest(scope.row.id)">审核通过</el-button>
            <el-button v-if="scope.row.status === 'approved'" size="small" type="success" @click="storeHarvest(scope.row.id)">入库</el-button>
            <el-button size="small" type="danger" @click="deleteHarvest(scope.row.id)">删除</el-button>
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

    <el-dialog :title="editForm.id ? '编辑采收记录' : '新增采收记录'" :visible.sync="showAddDialog">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="产品名称" prop="productName">
          <el-input v-model="editForm.productName" />
        </el-form-item>
        <el-form-item label="产品编码" prop="productCode">
          <el-input v-model="editForm.productCode" />
        </el-form-item>
        <el-form-item label="所属地块" prop="plotId">
          <el-select v-model="editForm.plotId">
            <el-option v-for="plot in plotOptions" :key="plot.value" :label="plot.label" :value="plot.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="采收数量" prop="quantity">
          <el-input v-model="editForm.quantity" type="number" />
        </el-form-item>
        <el-form-item label="单位" prop="unit">
          <el-input v-model="editForm.unit" />
        </el-form-item>
        <el-form-item label="品质等级" prop="qualityGrade">
          <el-select v-model="editForm.qualityGrade">
            <el-option label="A级" value="A级" />
            <el-option label="B级" value="B级" />
            <el-option label="C级" value="C级" />
          </el-select>
        </el-form-item>
        <el-form-item label="采收日期" prop="harvestDate">
          <el-date-picker v-model="editForm.harvestDate" type="date" />
        </el-form-item>
        <el-form-item label="采收人员" prop="harvestPerson">
          <el-input v-model="editForm.harvestPerson" />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-textarea v-model="editForm.remark" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="saveHarvest">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { Plus, Search } from '@element-plus/icons-vue'

const searchKeyword = ref('')
const statusFilter = ref('')
const showAddDialog = ref(false)

const plotOptions = ref([
  { value: 1, label: '地块A1 - 阳光农场' },
  { value: 2, label: '地块A2 - 阳光农场' },
  { value: 3, label: '地块B1 - 绿色田园' },
  { value: 4, label: '地块C1 - 生态农庄' },
  { value: 5, label: '地块D1 - 现代农业园' }
])

const harvests = ref([
  { id: 1, harvestCode: 'H20240115001', productName: '小麦', productCode: 'P001', plotId: 1, plotName: '地块A1', farmName: '阳光农场', quantity: 500, unit: 'kg', qualityGrade: 'A级', harvestDate: '2024-01-15', harvestPerson: '张三', status: 'stored', createTime: '2024-01-15' },
  { id: 2, harvestCode: 'H20240116001', productName: '玉米', productCode: 'P002', plotId: 2, plotName: '地块A2', farmName: '阳光农场', quantity: 300, unit: 'kg', qualityGrade: 'B级', harvestDate: '2024-01-16', harvestPerson: '李四', status: 'approved', createTime: '2024-01-16' },
  { id: 3, harvestCode: 'H20240117001', productName: '蔬菜', productCode: 'P003', plotId: 3, plotName: '地块B1', farmName: '绿色田园', quantity: 150, unit: 'kg', qualityGrade: 'A级', harvestDate: '2024-01-17', harvestPerson: '王五', status: 'pending', createTime: '2024-01-17' },
  { id: 4, harvestCode: 'H20240118001', productName: '水稻', productCode: 'P004', plotId: 4, plotName: '地块C1', farmName: '生态农庄', quantity: 400, unit: 'kg', qualityGrade: 'B级', harvestDate: '2024-01-18', harvestPerson: '赵六', status: 'pending', createTime: '2024-01-18' },
  { id: 5, harvestCode: 'H20240119001', productName: '苹果', productCode: 'P005', plotId: 5, plotName: '地块D1', farmName: '现代农业园', quantity: 200, unit: 'kg', qualityGrade: 'A级', harvestDate: '2024-01-19', harvestPerson: '钱七', status: 'stored', createTime: '2024-01-19' }
])

const pagination = reactive({
  pageNum: 1,
  pageSize: 10,
  total: 5
})

const editForm = reactive({
  id: null,
  harvestCode: '',
  productName: '',
  productCode: '',
  plotId: '',
  quantity: 0,
  unit: '',
  qualityGrade: 'A级',
  harvestDate: '',
  harvestPerson: '',
  remark: ''
})

const getGradeType = (grade) => {
  const types = { 'A级': 'success', 'B级': 'warning', 'C级': 'danger' }
  return types[grade] || 'default'
}

const getStatusType = (status) => {
  const types = { pending: 'warning', approved: 'primary', stored: 'success' }
  return types[status] || 'default'
}

const getStatusText = (status) => {
  const texts = { pending: '待审核', approved: '已审核', stored: '已入库' }
  return texts[status] || status
}

const handleSearch = () => {
  console.log('搜索:', searchKeyword.value, statusFilter.value)
}

const handlePageChange = (page) => {
  pagination.pageNum = page
}

const editHarvest = (harvest) => {
  Object.assign(editForm, harvest)
  showAddDialog.value = true
}

const approveHarvest = (id) => {
  const harvest = harvests.value.find(h => h.id === id)
  if (harvest) {
    harvest.status = 'approved'
    ElMessage.success('审核通过')
  }
}

const storeHarvest = (id) => {
  const harvest = harvests.value.find(h => h.id === id)
  if (harvest) {
    harvest.status = 'stored'
    ElMessage.success('已入库')
  }
}

const deleteHarvest = (id) => {
  harvests.value = harvests.value.filter(h => h.id !== id)
  pagination.total--
  ElMessage.success('删除成功')
}

const saveHarvest = () => {
  const plot = plotOptions.value.find(p => p.value === editForm.plotId)
  const plotInfo = plot?.label ? plot.label.split(' - ') : ['', '']
  
  if (editForm.id) {
    const index = harvests.value.findIndex(h => h.id === editForm.id)
    if (index > -1) {
      harvests.value[index] = { 
        ...editForm, 
        plotName: plotInfo[0] || '', 
        farmName: plotInfo[1] || '' 
      }
    }
    ElMessage.success('更新成功')
  } else {
    const newHarvest = { 
      ...editForm, 
      id: Date.now(), 
      harvestCode: 'H' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + String(Date.now()).slice(-3),
      plotName: plotInfo[0] || '', 
      farmName: plotInfo[1] || '',
      status: 'pending', 
      createTime: new Date().toISOString().split('T')[0] 
    }
    harvests.value.unshift(newHarvest)
    pagination.total++
    ElMessage.success('创建成功')
  }
  showAddDialog.value = false
  resetForm()
}

const resetForm = () => {
  editForm.id = null
  editForm.harvestCode = ''
  editForm.productName = ''
  editForm.productCode = ''
  editForm.plotId = ''
  editForm.quantity = 0
  editForm.unit = ''
  editForm.qualityGrade = 'A级'
  editForm.harvestDate = ''
  editForm.harvestPerson = ''
  editForm.remark = ''
}
</script>

<style scoped>
.harvests-page {
  padding: 20px;
}

.page-header {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.status-select {
  width: 150px;
}

.search-input {
  width: 300px;
}
</style>