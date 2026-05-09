<template>
  <div class="device-list">
    <div class="search-bar">
      <el-input v-model="searchForm.deviceName" placeholder="设备名称" class="search-input" />
      <el-select v-model="searchForm.status" placeholder="设备状态">
        <el-option label="全部" value="" />
        <el-option label="在线" value="online" />
        <el-option label="离线" value="offline" />
      </el-select>
      <el-button type="primary" @click="handleSearch">搜索</el-button>
      <el-button type="success" @click="handleAdd">添加设备</el-button>
    </div>

    <el-table :data="deviceList" border class="device-table">
      <el-table-column prop="deviceCode" label="设备编号" />
      <el-table-column prop="deviceName" label="设备名称" />
      <el-table-column prop="deviceTypeName" label="设备类型" />
      <el-table-column prop="plotName" label="所属地块" />
      <el-table-column prop="status" label="状态">
        <template #default="scope">
          <el-tag :type="scope.row.status === 'online' ? 'success' : 'danger'">
            {{ scope.row.status === 'online' ? '在线' : '离线' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="lastOnlineTime" label="最后在线" />
      <el-table-column prop="createTime" label="创建时间" />
      <el-table-column label="操作">
        <template #default="scope">
          <el-button type="primary" size="small" @click="handleDetail(scope.row.id)">详情</el-button>
          <el-button type="warning" size="small" @click="handleControl(scope.row)">控制</el-button>
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

    <el-dialog title="添加设备" :visible.sync="addDialogVisible">
      <el-form :model="addForm" label-width="100px">
        <el-form-item label="设备编号">
          <el-input v-model="addForm.deviceCode" />
        </el-form-item>
        <el-form-item label="设备名称">
          <el-input v-model="addForm.deviceName" />
        </el-form-item>
        <el-form-item label="设备类型">
          <el-select v-model="addForm.deviceTypeId">
            <el-option label="温湿度传感器" value="1" />
            <el-option label="土壤湿度传感器" value="2" />
            <el-option label="光照传感器" value="3" />
            <el-option label="灌溉控制器" value="4" />
          </el-select>
        </el-form-item>
        <el-form-item label="所属地块">
          <el-select v-model="addForm.plotId">
            <el-option label="地块A" value="1" />
            <el-option label="地块B" value="2" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog title="设备控制" :visible.sync="controlDialogVisible">
      <el-form :model="controlForm" label-width="100px">
        <el-form-item label="控制命令">
          <el-select v-model="controlForm.command">
            <el-option label="开启" value="on" />
            <el-option label="关闭" value="off" />
            <el-option label="重启" value="reboot" />
          </el-select>
        </el-form-item>
        <el-form-item label="参数">
          <el-input v-model="controlForm.params" placeholder="JSON格式参数" />
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
  deviceName: '',
  status: ''
})

const pageNum = ref(1)
const pageSize = ref(10)
const total = ref(100)

const deviceList = ref([
  { id: 1, deviceCode: 'D001', deviceName: '温湿度传感器-001', deviceTypeName: '温湿度传感器', plotName: '地块A', status: 'online', lastOnlineTime: '刚刚', createTime: '2024-01-01 10:00:00' },
  { id: 2, deviceCode: 'D002', deviceName: '土壤湿度传感器-002', deviceTypeName: '土壤湿度传感器', plotName: '地块A', status: 'online', lastOnlineTime: '1分钟前', createTime: '2024-01-02 11:00:00' },
  { id: 3, deviceCode: 'D003', deviceName: '光照传感器-003', deviceTypeName: '光照传感器', plotName: '地块B', status: 'offline', lastOnlineTime: '1小时前', createTime: '2024-01-03 12:00:00' },
  { id: 4, deviceCode: 'D004', deviceName: '灌溉控制器-004', deviceTypeName: '灌溉控制器', plotName: '地块B', status: 'online', lastOnlineTime: '5分钟前', createTime: '2024-01-04 13:00:00' }
])

const addDialogVisible = ref(false)
const addForm = reactive({
  deviceCode: '',
  deviceName: '',
  deviceTypeId: '',
  plotId: ''
})

const controlDialogVisible = ref(false)
const controlForm = reactive({
  command: '',
  params: ''
})
const currentDevice = ref(null)

const handleSearch = () => {
  ElMessage.info('搜索功能')
}

const handleAdd = () => {
  addDialogVisible.value = true
}

const handleSave = () => {
  addDialogVisible.value = false
  ElMessage.success('设备添加成功')
}

const handleDetail = (id) => {
  window.location.href = `/device/detail/${id}`
}

const handleControl = (device) => {
  currentDevice.value = device
  controlDialogVisible.value = true
}

const handleControlSubmit = () => {
  controlDialogVisible.value = false
  ElMessage.success('控制命令已发送')
}

const handleDelete = (id) => {
  ElMessage.success('设备删除成功')
}

const handlePageChange = (page) => {
  pageNum.value = page
}
</script>

<style scoped>
.device-list {
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

.device-table {
  margin-bottom: 20px;
}

.pagination {
  text-align: right;
}
</style>