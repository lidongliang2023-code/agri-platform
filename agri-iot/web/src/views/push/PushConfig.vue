<template>
  <div class="push-config">
    <div class="config-section">
      <h3>推送配置</h3>
      <el-form :model="pushConfig" label-width="150px">
        <el-form-item label="是否启用推送">
          <el-switch v-model="pushConfig.enabled" />
        </el-form-item>
        <el-form-item label="推送方式">
          <el-checkbox-group v-model="pushConfig.channels">
            <el-checkbox label="短信" />
            <el-checkbox label="邮件" />
            <el-checkbox label="APP推送" />
            <el-checkbox label="微信公众号" />
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="告警级别过滤">
          <el-select v-model="pushConfig.alertLevel" multiple>
            <el-option label="严重" value="critical" />
            <el-option label="警告" value="warning" />
            <el-option label="信息" value="info" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSave">保存配置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="notification-section">
      <div class="section-header">
        <h3>推送消息列表</h3>
        <el-button type="success" @click="handleSend">发送消息</el-button>
      </div>
      <el-table :data="notificationList" border>
        <el-table-column prop="title" label="消息标题" />
        <el-table-column prop="content" label="消息内容" />
        <el-table-column prop="channel" label="推送渠道" />
        <el-table-column prop="target" label="接收人" />
        <el-table-column prop="status" label="状态">
          <template #default="scope">
            <el-tag :type="scope.row.status === 'success' ? 'success' : 'danger'">
              {{ scope.row.status === 'success' ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="sendTime" label="发送时间" />
      </el-table>
      <el-pagination
        :total="total"
        :page-size="pageSize"
        :current-page="pageNum"
        @current-change="handlePageChange"
        class="pagination"
      />
    </div>

    <el-dialog title="发送消息" :visible.sync="sendDialogVisible">
      <el-form :model="sendForm" label-width="100px">
        <el-form-item label="消息标题">
          <el-input v-model="sendForm.title" />
        </el-form-item>
        <el-form-item label="消息内容">
          <el-textarea v-model="sendForm.content" :rows="4" />
        </el-form-item>
        <el-form-item label="推送渠道">
          <el-checkbox-group v-model="sendForm.channels">
            <el-checkbox label="短信" value="sms" />
            <el-checkbox label="邮件" value="email" />
            <el-checkbox label="APP推送" value="app" />
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="接收人">
          <el-input v-model="sendForm.target" placeholder="多个用户用逗号分隔" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="sendDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSendSubmit">发送</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'

const pushConfig = reactive({
  enabled: true,
  channels: ['短信', 'APP推送'],
  alertLevel: ['critical', 'warning']
})

const notificationList = ref([
  { id: 1, title: '设备离线告警', content: '设备D004已离线超过1小时', channel: 'APP推送', target: '管理员', status: 'success', sendTime: '2024-01-15 10:30:00' },
  { id: 2, title: '温度异常告警', content: '地块A温度超过阈值', channel: '短信', target: '张三', status: 'success', sendTime: '2024-01-15 09:20:00' },
  { id: 3, title: '湿度告警', content: '土壤湿度低于正常值', channel: '邮件', target: '管理员', status: 'success', sendTime: '2024-01-15 08:15:00' }
])

const pageNum = ref(1)
const pageSize = ref(10)
const total = ref(30)

const sendDialogVisible = ref(false)
const sendForm = reactive({
  title: '',
  content: '',
  channels: [],
  target: ''
})

const handleSave = () => {
  ElMessage.success('配置保存成功')
}

const handleSend = () => {
  sendDialogVisible.value = true
}

const handleSendSubmit = () => {
  sendDialogVisible.value = false
  ElMessage.success('消息发送成功')
}

const handlePageChange = (page) => {
  pageNum.value = page
}
</script>

<style scoped>
.push-config {
  background: #fff;
  padding: 20px;
  border-radius: 12px;
}

.config-section {
  background: #f9fafc;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.config-section h3 {
  margin: 0 0 20px 0;
  font-size: 16px;
  color: #303133;
}

.notification-section {
  background: #f9fafc;
  padding: 20px;
  border-radius: 8px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-header h3 {
  margin: 0;
  font-size: 16px;
  color: #303133;
}

.pagination {
  text-align: right;
  margin-top: 20px;
}
</style>