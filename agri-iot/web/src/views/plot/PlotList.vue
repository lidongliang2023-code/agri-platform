<template>
  <div class="plot-list">
    <div class="search-bar">
      <el-input v-model="searchForm.plotName" placeholder="地块名称" class="search-input" />
      <el-select v-model="searchForm.cropType" placeholder="作物类型">
        <el-option label="全部" value="" />
        <el-option label="小麦" value="wheat" />
        <el-option label="玉米" value="corn" />
        <el-option label="水稻" value="rice" />
      </el-select>
      <el-button type="primary" @click="handleSearch">搜索</el-button>
      <el-button type="success" @click="handleAdd">添加地块</el-button>
    </div>

    <el-table :data="plotList" border class="plot-table">
      <el-table-column prop="plotCode" label="地块编号" />
      <el-table-column prop="plotName" label="地块名称" />
      <el-table-column prop="plotType" label="地块类型" />
      <el-table-column prop="cropType" label="作物类型">
        <template #default="scope">
          <el-tag type="info">{{ scope.row.cropType === 'wheat' ? '小麦' : scope.row.cropType === 'corn' ? '玉米' : '水稻' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="cropStage" label="作物阶段" />
      <el-table-column prop="area" label="面积(亩)" />
      <el-table-column prop="deviceCount" label="设备数" />
      <el-table-column prop="onlineDeviceCount" label="在线设备数" />
      <el-table-column prop="status" label="状态">
        <template #default="scope">
          <el-tag :type="scope.row.status === 1 ? 'success' : 'danger'">
            {{ scope.row.status === 1 ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createTime" label="创建时间" />
      <el-table-column label="操作">
        <template #default="scope">
          <el-button type="primary" size="small" @click="handleDetail(scope.row)">详情</el-button>
          <el-button type="warning" size="small" @click="handleEdit(scope.row)">编辑</el-button>
          <el-button type="danger" size="small" @click="handleDelete(scope.row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      :total="total"
      :page-size="pageSize"
      :current-page="pageNum"
      @current-change="handlePageChange"
      class="pagination"
    />

    <el-dialog title="添加地块" :visible.sync="addDialogVisible">
      <el-form :model="addForm" label-width="120px">
        <el-form-item label="地块编号">
          <el-input v-model="addForm.plotCode" />
        </el-form-item>
        <el-form-item label="地块名称">
          <el-input v-model="addForm.plotName" />
        </el-form-item>
        <el-form-item label="地块类型">
          <el-select v-model="addForm.plotType">
            <el-option label="大田" value="field" />
            <el-option label="温室" value="greenhouse" />
            <el-option label="果园" value="orchard" />
          </el-select>
        </el-form-item>
        <el-form-item label="作物类型">
          <el-select v-model="addForm.cropType">
            <el-option label="小麦" value="wheat" />
            <el-option label="玉米" value="corn" />
            <el-option label="水稻" value="rice" />
          </el-select>
        </el-form-item>
        <el-form-item label="作物阶段">
          <el-select v-model="addForm.cropStage">
            <el-option label="播种期" value="sowing" />
            <el-option label="生长期" value="growing" />
            <el-option label="成熟期" value="mature" />
          </el-select>
        </el-form-item>
        <el-form-item label="面积(亩)">
          <el-input v-model="addForm.area" type="number" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'

const searchForm = reactive({
  plotName: '',
  cropType: ''
})

const pageNum = ref(1)
const pageSize = ref(10)
const total = ref(25)

const plotList = ref([
  { id: 1, plotCode: 'P001', plotName: '地块A', plotType: 'field', cropType: 'wheat', cropStage: 'growing', area: 100, deviceCount: 15, onlineDeviceCount: 14, status: 1, createTime: '2024-01-01 10:00:00' },
  { id: 2, plotCode: 'P002', plotName: '地块B', plotType: 'greenhouse', cropType: 'corn', cropStage: 'sowing', area: 50, deviceCount: 8, onlineDeviceCount: 8, status: 1, createTime: '2024-01-02 10:00:00' },
  { id: 3, plotCode: 'P003', plotName: '地块C', plotType: 'orchard', cropType: 'rice', cropStage: 'mature', area: 80, deviceCount: 12, onlineDeviceCount: 10, status: 1, createTime: '2024-01-03 10:00:00' }
])

const addDialogVisible = ref(false)
const addForm = reactive({
  plotCode: '',
  plotName: '',
  plotType: '',
  cropType: '',
  cropStage: '',
  area: ''
})

const handleSearch = () => {
  ElMessage.info('搜索功能')
}

const handleAdd = () => {
  addDialogVisible.value = true
}

const handleSave = () => {
  addDialogVisible.value = false
  ElMessage.success('地块添加成功')
}

const handleDetail = (plot) => {
  ElMessage.info('查看地块详情')
}

const handleEdit = (plot) => {
  addForm.plotCode = plot.plotCode
  addForm.plotName = plot.plotName
  addForm.plotType = plot.plotType
  addForm.cropType = plot.cropType
  addForm.cropStage = plot.cropStage
  addForm.area = plot.area
  addDialogVisible.value = true
}

const handleDelete = (id) => {
  ElMessage.success('地块删除成功')
}

const handlePageChange = (page) => {
  pageNum.value = page
}
</script>

<style scoped>
.plot-list {
  background: #fff;
  padding: 20px;
  border-radius: 12px;
}

.search-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  align-items: center;
}

.search-input {
  width: 200px;
}

.plot-table {
  margin-bottom: 20px;
}

.pagination {
  text-align: right;
}
</style>