<template>
  <div class="group-list">
    <div class="search-bar">
      <el-input v-model="searchForm.groupName" placeholder="分组名称" class="search-input" />
      <el-button type="primary" @click="handleSearch">搜索</el-button>
      <el-button type="success" @click="handleAdd">添加分组</el-button>
    </div>

    <el-table :data="groupList" border class="group-table">
      <el-table-column prop="groupName" label="分组名称" />
      <el-table-column prop="groupIcon" label="分组图标">
        <template #default="scope">
          <el-icon class="icon">{{ scope.row.groupIcon }}</el-icon>
        </template>
      </el-table-column>
      <el-table-column prop="deviceCount" label="设备数量" />
      <el-table-column prop="isPreset" label="是否预设">
        <template #default="scope">
          <el-tag :type="scope.row.isPreset ? 'primary' : 'info'">
            {{ scope.row.isPreset ? '是' : '否' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createTime" label="创建时间" />
      <el-table-column label="操作">
        <template #default="scope">
          <el-button type="primary" size="small" @click="handleDetail(scope.row)">详情</el-button>
          <el-button type="warning" size="small" @click="handleBatchControl(scope.row)">批量控制</el-button>
          <el-button v-if="!scope.row.isPreset" type="danger" size="small" @click="handleDelete(scope.row.id)">删除</el-button>
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

    <el-dialog title="添加分组" :visible.sync="addDialogVisible">
      <el-form :model="addForm" label-width="100px">
        <el-form-item label="分组名称">
          <el-input v-model="addForm.groupName" />
        </el-form-item>
        <el-form-item label="分组图标">
          <el-select v-model="addForm.groupIcon">
            <el-option label="🌡️ 温度" value="🌡️" />
            <el-option label="💧 湿度" value="💧" />
            <el-option label="☀️ 光照" value="☀️" />
            <el-option label="🌾 灌溉" value="🌾" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog title="分组详情" :visible.sync="detailDialogVisible">
      <div v-if="currentGroup">
        <h3>设备列表</h3>
        <el-table :data="currentGroup.devices" border>
          <el-table-column prop="deviceCode" label="设备编号" />
          <el-table-column prop="deviceName" label="设备名称" />
          <el-table-column prop="status" label="状态">
            <template #default="scope">
              <el-tag :type="scope.row.status === 'online' ? 'success' : 'danger'">
                {{ scope.row.status === 'online' ? '在线' : '离线' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog title="批量控制" :visible.sync="controlDialogVisible">
      <el-form :model="controlForm" label-width="100px">
        <el-form-item label="控制命令">
          <el-select v-model="controlForm.command">
            <el-option label="开启" value="on" />
            <el-option label="关闭" value="off" />
            <el-option label="重启" value="reboot" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="controlDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleControlSubmit">执行</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'

const searchForm = reactive({
  groupName: ''
})

const pageNum = ref(1)
const pageSize = ref(10)
const total = ref(50)

const groupList = ref([
  { id: 1, groupName: '环境监测组', groupIcon: '🌡️', deviceCount: 12, isPreset: true, createTime: '2024-01-01 10:00:00' },
  { id: 2, groupName: '灌溉控制组', groupIcon: '🌾', deviceCount: 8, isPreset: true, createTime: '2024-01-01 10:00:00' },
  { id: 3, groupName: '自定义组1', groupIcon: '💧', deviceCount: 5, isPreset: false, createTime: '2024-01-10 14:00:00' }
])

const addDialogVisible = ref(false)
const addForm = reactive({
  groupName: '',
  groupIcon: ''
})

const detailDialogVisible = ref(false)
const currentGroup = ref(null)

const controlDialogVisible = ref(false)
const controlForm = reactive({
  command: ''
})
const currentControlGroup = ref(null)

const handleSearch = () => {
  ElMessage.info('搜索功能')
}

const handleAdd = () => {
  addDialogVisible.value = true
}

const handleSave = () => {
  addDialogVisible.value = false
  ElMessage.success('分组添加成功')
}

const handleDetail = (group) => {
  currentGroup.value = {
    ...group,
    devices: [
      { deviceCode: 'D001', deviceName: '温湿度传感器-001', status: 'online' },
      { deviceCode: 'D002', deviceName: '土壤湿度传感器-002', status: 'online' }
    ]
  }
  detailDialogVisible.value = true
}

const handleBatchControl = (group) => {
  currentControlGroup.value = group
  controlDialogVisible.value = true
}

const handleControlSubmit = () => {
  controlDialogVisible.value = false
  ElMessage.success('批量控制命令已发送')
}

const handleDelete = (id) => {
  ElMessage.success('分组删除成功')
}

const handlePageChange = (page) => {
  pageNum.value = page
}
</script>

<style scoped>
.group-list {
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

.group-table {
  margin-bottom: 20px;
}

.icon {
  font-size: 24px;
}

.pagination {
  text-align: right;
}
</style>