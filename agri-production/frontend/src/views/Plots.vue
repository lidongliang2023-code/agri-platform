<template>
  <div class="plots-page">
    <div class="page-header">
      <el-button type="primary" @click="showAddDialog = true">
        <el-icon><Plus /></el-icon> 添加地块
      </el-button>
      <el-select v-model="searchFarm" placeholder="选择农场" class="farm-select">
        <el-option label="全部农场" value="" />
        <el-option v-for="farm in farmOptions" :key="farm.value" :label="farm.label" :value="farm.value" />
      </el-select>
      <el-input 
        v-model="searchKeyword" 
        placeholder="搜索地块名称" 
        class="search-input"
        @keyup.enter="handleSearch"
      >
        <template #append>
          <el-button @click="handleSearch"><el-icon><Search /></el-icon></el-button>
        </template>
      </el-input>
    </div>

    <el-card>
      <el-table :data="plots" border>
        <el-table-column prop="plotName" label="地块名称" />
        <el-table-column prop="plotCode" label="地块编码" />
        <el-table-column prop="farmName" label="所属农场" />
        <el-table-column prop="area" label="面积(亩)" />
        <el-table-column prop="shape" label="形状" />
        <el-table-column prop="soilType" label="土壤类型" />
        <el-table-column prop="cropType" label="种植作物" />
        <el-table-column prop="status" label="状态">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)">{{ getStatusText(scope.row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" />
        <el-table-column label="操作">
          <template #default="scope">
            <el-button size="small" @click="editPlot(scope.row)">编辑</el-button>
            <el-button size="small" type="danger" @click="deletePlot(scope.row.id)">删除</el-button>
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

    <el-dialog :title="editForm.id ? '编辑地块' : '添加地块'" :visible.sync="showAddDialog">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="地块名称" prop="plotName">
          <el-input v-model="editForm.plotName" />
        </el-form-item>
        <el-form-item label="地块编码" prop="plotCode">
          <el-input v-model="editForm.plotCode" />
        </el-form-item>
        <el-form-item label="所属农场" prop="farmId">
          <el-select v-model="editForm.farmId">
            <el-option v-for="farm in farmOptions" :key="farm.value" :label="farm.label" :value="farm.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="面积(亩)" prop="area">
          <el-input v-model="editForm.area" type="number" />
        </el-form-item>
        <el-form-item label="形状" prop="shape">
          <el-select v-model="editForm.shape">
            <el-option label="矩形" value="rectangle" />
            <el-option label="方形" value="square" />
            <el-option label="不规则" value="irregular" />
          </el-select>
        </el-form-item>
        <el-form-item label="土壤类型" prop="soilType">
          <el-input v-model="editForm.soilType" />
        </el-form-item>
        <el-form-item label="种植作物" prop="cropType">
          <el-input v-model="editForm.cropType" />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-textarea v-model="editForm.description" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="savePlot">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { Plus, Search } from '@element-plus/icons-vue'

const searchKeyword = ref('')
const searchFarm = ref('')
const showAddDialog = ref(false)

const farmOptions = ref([
  { value: 1, label: '阳光农场' },
  { value: 2, label: '绿色田园' },
  { value: 3, label: '生态农庄' },
  { value: 4, label: '现代农业园' }
])

const plots = ref([
  { id: 1, plotName: '地块A1', plotCode: 'P001', farmId: 1, farmName: '阳光农场', area: 50, shape: 'rectangle', soilType: '壤土', cropType: '小麦', status: 'planted', createTime: '2024-01-01' },
  { id: 2, plotName: '地块A2', plotCode: 'P002', farmId: 1, farmName: '阳光农场', area: 30, shape: 'square', soilType: '砂壤土', cropType: '玉米', status: 'planted', createTime: '2024-01-02' },
  { id: 3, plotName: '地块B1', plotCode: 'P003', farmId: 2, farmName: '绿色田园', area: 40, shape: 'rectangle', soilType: '黏土', cropType: '蔬菜', status: 'planted', createTime: '2024-01-10' },
  { id: 4, plotName: '地块C1', plotCode: 'P004', farmId: 3, farmName: '生态农庄', area: 60, shape: 'irregular', soilType: '壤土', cropType: '水稻', status: 'fallow', createTime: '2024-02-01' },
  { id: 5, plotName: '地块D1', plotCode: 'P005', farmId: 4, farmName: '现代农业园', area: 100, shape: 'rectangle', soilType: '砂壤土', cropType: '果树', status: 'planted', createTime: '2024-02-15' }
])

const pagination = reactive({
  pageNum: 1,
  pageSize: 10,
  total: 5
})

const editForm = reactive({
  id: null,
  plotName: '',
  plotCode: '',
  farmId: '',
  area: '',
  shape: 'rectangle',
  soilType: '',
  cropType: '',
  description: ''
})

const getStatusType = (status) => {
  const types = { planted: 'success', fallow: 'warning', reserved: 'info' }
  return types[status] || 'default'
}

const getStatusText = (status) => {
  const texts = { planted: '种植中', fallow: '休耕', reserved: '预留' }
  return texts[status] || status
}

const handleSearch = () => {
  console.log('搜索:', searchKeyword.value, searchFarm.value)
}

const handlePageChange = (page) => {
  pagination.pageNum = page
}

const editPlot = (plot) => {
  Object.assign(editForm, plot)
  showAddDialog.value = true
}

const deletePlot = (id) => {
  plots.value = plots.value.filter(p => p.id !== id)
  pagination.total--
  ElMessage.success('删除成功')
}

const savePlot = () => {
  const farm = farmOptions.value.find(f => f.value === editForm.farmId)
  if (editForm.id) {
    const index = plots.value.findIndex(p => p.id === editForm.id)
    if (index > -1) {
      plots.value[index] = { ...editForm, farmName: farm?.label || '' }
    }
    ElMessage.success('更新成功')
  } else {
    const newPlot = { 
      ...editForm, 
      id: Date.now(), 
      farmName: farm?.label || '',
      status: 'fallow', 
      createTime: new Date().toISOString().split('T')[0] 
    }
    plots.value.unshift(newPlot)
    pagination.total++
    ElMessage.success('添加成功')
  }
  showAddDialog.value = false
  resetForm()
}

const resetForm = () => {
  editForm.id = null
  editForm.plotName = ''
  editForm.plotCode = ''
  editForm.farmId = ''
  editForm.area = ''
  editForm.shape = 'rectangle'
  editForm.soilType = ''
  editForm.cropType = ''
  editForm.description = ''
}
</script>

<style scoped>
.plots-page {
  padding: 20px;
}

.page-header {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.farm-select {
  width: 200px;
}

.search-input {
  width: 300px;
}
</style>