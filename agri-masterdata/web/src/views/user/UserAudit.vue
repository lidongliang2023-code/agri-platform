<template>
  <div class="user-audit">
    <div class="page-header">
      <div class="header-left">
        <h1>用户认证审核</h1>
        <p>审核用户认证申请</p>
      </div>
    </div>

    <div class="search-bar">
      <div class="search-group">
        <input 
          type="text" 
          v-model="searchForm.keyword" 
          placeholder="搜索用户名/姓名..." 
          class="search-input"
        />
        <button class="search-btn" @click="loadData">搜索</button>
      </div>
      <div class="filter-group">
        <select v-model="searchForm.authStatus" class="filter-select">
          <option value="">全部状态</option>
          <option value="pending">待审核</option>
          <option value="approved">已通过</option>
          <option value="rejected">已拒绝</option>
        </select>
      </div>
      <div class="filter-group">
        <select v-model="searchForm.authType" class="filter-select">
          <option value="">全部类型</option>
          <option value="individual">个人认证</option>
          <option value="enterprise">企业认证</option>
        </select>
      </div>
    </div>

    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>用户名</th>
            <th>真实姓名</th>
            <th>证件类型</th>
            <th>证件号码</th>
            <th>手机号</th>
            <th>认证类型</th>
            <th>审核状态</th>
            <th>提交时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="audit in tableData" :key="audit.id">
            <td>{{ audit.username }}</td>
            <td>{{ audit.realName }}</td>
            <td>{{ audit.idCardType }}</td>
            <td>{{ audit.idCardNo }}</td>
            <td>{{ audit.phone }}</td>
            <td>
              <span class="type-badge" :class="audit.authType">
                {{ audit.authType === 'enterprise' ? '企业认证' : '个人认证' }}
              </span>
            </td>
            <td>
              <span class="status-badge" :class="audit.authStatus">
                {{ getStatusLabel(audit.authStatus) }}
              </span>
            </td>
            <td>{{ formatDate(audit.createTime) }}</td>
            <td class="action-cell">
              <button class="action-btn view" @click="viewDetail(audit)">详情</button>
              <template v-if="audit.authStatus === 'pending'">
                <button class="action-btn approve" @click="approve(audit.id)">通过</button>
                <button class="action-btn reject" @click="showRejectModal = true; currentAuditId = audit.id">拒绝</button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="pagination">
        <button class="page-btn" :disabled="pageNum === 1" @click="handleCurrentChange(pageNum - 1)">上一页</button>
        <span class="page-info">第 {{ pageNum }} / {{ totalPages }} 页</span>
        <button class="page-btn" :disabled="pageNum === totalPages" @click="handleCurrentChange(pageNum + 1)">下一页</button>
      </div>
    </div>

    <div class="modal-overlay" v-if="detailVisible" @click="detailVisible = false">
      <div class="modal-content detail-modal" @click.stop>
        <div class="modal-header">
          <h3>审核详情</h3>
          <button class="close-btn" @click="detailVisible = false">×</button>
        </div>
        <div class="modal-body" v-if="detailData">
          <div class="detail-row">
            <span class="detail-label">用户名</span>
            <span class="detail-value">{{ detailData.username }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">真实姓名</span>
            <span class="detail-value">{{ detailData.realName }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">证件类型</span>
            <span class="detail-value">{{ detailData.idCardType }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">证件号码</span>
            <span class="detail-value">{{ detailData.idCardNo }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">手机号</span>
            <span class="detail-value">{{ detailData.phone }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">认证类型</span>
            <span class="detail-value">{{ detailData.authType === 'enterprise' ? '企业认证' : '个人认证' }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">提交时间</span>
            <span class="detail-value">{{ detailData.createTime }}</span>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="detailVisible = false">关闭</button>
          <template v-if="detailData && detailData.authStatus === 'pending'">
            <button class="btn btn-success" @click="approve(detailData.id)">通过</button>
            <button class="btn btn-danger" @click="showRejectModal = true; currentAuditId = detailData.id">拒绝</button>
          </template>
        </div>
      </div>
    </div>

    <div class="modal-overlay" v-if="showRejectModal" @click="showRejectModal = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>拒绝审核</h3>
          <button class="close-btn" @click="showRejectModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>拒绝原因</label>
            <textarea v-model="rejectForm.auditNote" rows="3" class="form-textarea" placeholder="请输入拒绝原因"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="showRejectModal = false">取消</button>
          <button class="btn btn-danger" @click="confirmReject">确定拒绝</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getUserAuditList, reviewUserCert } from '../../utils/api'

const tableData = ref([])
const pageNum = ref(1)
const pageSize = ref(10)
const total = ref(0)
const totalPages = ref(1)
const detailVisible = ref(false)
const showRejectModal = ref(false)
const detailData = ref(null)
const currentAuditId = ref(null)

const searchForm = reactive({
  keyword: '',
  authStatus: '',
  authType: ''
})

const rejectForm = reactive({
  auditNote: ''
})

const getStatusLabel = (status) => {
  const labels = { pending: '待审核', approved: '已通过', rejected: '已拒绝' }
  return labels[status] || status
}

const loadData = async () => {
  try {
    const response = await getUserAuditList({
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      keyword: searchForm.keyword,
      authStatus: searchForm.authStatus,
      authType: searchForm.authType
    })
    if (response.code === 200) {
      tableData.value = response.data.list || mockAudits
      total.value = response.data.total || mockAudits.length
      totalPages.value = Math.ceil(total.value / pageSize.value)
    } else {
      ElMessage.warning('获取数据失败，使用本地数据')
      tableData.value = mockAudits
      total.value = mockAudits.length
      totalPages.value = Math.ceil(total.value / pageSize.value)
    }
  } catch (error) {
    console.error('认证审核列表加载失败:', error)
    if (error.response) {
      ElMessage.error(`加载失败: ${error.response.status} - ${error.response.statusText}`)
    } else if (error.request) {
      ElMessage.warning('网络请求失败，使用本地数据')
    } else {
      ElMessage.error('请求配置错误')
    }
    tableData.value = mockAudits
    total.value = mockAudits.length
    totalPages.value = Math.ceil(total.value / pageSize.value)
  }
}

const mockAudits = [
  { id: 1, username: 'user001', realName: '张三', idCardType: '身份证', idCardNo: '110101199001011234', phone: '13800138001', authType: 'individual', authStatus: 'pending', createTime: '2024-01-15 10:30:00' },
  { id: 2, username: 'user002', realName: '李四', idCardType: '身份证', idCardNo: '110101199001015678', phone: '13800138002', authType: 'individual', authStatus: 'approved', createTime: '2024-01-15 09:15:00' },
  { id: 3, username: 'user003', realName: '王五', idCardType: '营业执照', idCardNo: '911100001234567890', phone: '13800138003', authType: 'enterprise', authStatus: 'pending', createTime: '2024-01-15 14:20:00' },
  { id: 4, username: 'user004', realName: '赵六', idCardType: '身份证', idCardNo: '110101199001019012', phone: '13800138004', authType: 'individual', authStatus: 'rejected', createTime: '2024-01-14 16:45:00' },
  { id: 5, username: 'user005', realName: '钱七', idCardType: '营业执照', idCardNo: '911100009876543210', phone: '13800138005', authType: 'enterprise', authStatus: 'approved', createTime: '2024-01-14 11:00:00' }
]

const handleSizeChange = (size) => {
  pageSize.value = size
  loadData()
}

const handleCurrentChange = (page) => {
  pageNum.value = page
  loadData()
}

const viewDetail = (row) => {
  detailData.value = row
  detailVisible.value = true
}

const approve = async (id) => {
  try {
    const response = await reviewUserCert(id, { authStatus: 'approved', auditNote: '审核通过' })
    if (response.code === 200) {
      ElMessage.success('审核通过')
      detailVisible.value = false
      loadData()
    } else {
      ElMessage.error(response.message || '操作失败')
    }
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

const confirmReject = async () => {
  if (!rejectForm.auditNote) {
    ElMessage.warning('请填写拒绝原因')
    return
  }
  
  try {
    const response = await reviewUserCert(currentAuditId.value, { 
      authStatus: 'rejected', 
      auditNote: rejectForm.auditNote 
    })
    if (response.code === 200) {
      ElMessage.success('已拒绝')
      showRejectModal.value = false
      detailVisible.value = false
      rejectForm.auditNote = ''
      loadData()
    } else {
      ElMessage.error(response.message || '操作失败')
    }
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

const formatDate = (date) => {
  if (!date) return ''
  return date.split(' ')[0]
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.user-audit {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.header-left h1 {
  font-size: 24px;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
}

.header-left p {
  font-size: 14px;
  color: #a0aec0;
  margin: 4px 0 0;
}

.search-bar {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.search-group {
  display: flex;
  flex: 1;
}

.search-input {
  flex: 1;
  padding: 10px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px 0 0 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.search-input:focus {
  border-color: #238636;
}

.search-btn {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-left: none;
  padding: 10px 24px;
  border-radius: 0 8px 8px 0;
  font-size: 14px;
  color: #238636;
  cursor: pointer;
  transition: all 0.2s;
}

.search-btn:hover {
  background: rgba(35, 134, 54, 0.1);
}

.filter-group {
  display: flex;
  align-items: center;
}

.filter-select {
  padding: 10px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  color: #4a5568;
  background: #fff;
  cursor: pointer;
  outline: none;
}

.table-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 14px 16px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
}

.data-table th {
  font-size: 13px;
  font-weight: 600;
  color: #4a5568;
  background: #f8fafc;
}

.data-table td {
  font-size: 13px;
  color: #2d3748;
}

.type-badge {
  font-size: 11px;
  font-weight: 500;
  padding: 4px 12px;
  border-radius: 12px;
}

.type-badge.individual {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.type-badge.enterprise {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.status-badge {
  font-size: 11px;
  font-weight: 500;
  padding: 4px 12px;
  border-radius: 12px;
}

.status-badge.pending {
  background: rgba(210, 153, 34, 0.1);
  color: #d29922;
}

.status-badge.approved {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.status-badge.rejected {
  background: rgba(218, 54, 51, 0.1);
  color: #da3633;
}

.action-cell {
  display: flex;
  gap: 8px;
}

.action-btn {
  font-size: 12px;
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn.view {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.action-btn.approve {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.action-btn.reject {
  background: rgba(218, 54, 51, 0.1);
  color: #da3633;
}

.action-btn:hover {
  opacity: 0.8;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  padding: 20px;
}

.page-btn {
  padding: 8px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
  font-size: 13px;
  color: #4a5568;
  cursor: pointer;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background: #f8fafc;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: 13px;
  color: #a0aec0;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #fff;
  border-radius: 12px;
  width: 500px;
  max-width: 90%;
  overflow: hidden;
}

.detail-modal {
  width: 600px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #f0f0f0;
}

.modal-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #a0aec0;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.close-btn:hover {
  color: #2d3748;
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 14px;
  color: #4a5568;
  margin-bottom: 6px;
  font-weight: 500;
}

.form-textarea {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
  resize: vertical;
}

.form-textarea:focus {
  border-color: #238636;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  font-size: 13px;
  color: #a0aec0;
}

.detail-value {
  font-size: 13px;
  color: #2d3748;
  font-weight: 500;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid #f0f0f0;
}

.btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-cancel {
  background: #f0f0f0;
  color: #4a5568;
}

.btn-cancel:hover {
  background: #e2e8f0;
}

.btn-success {
  background: linear-gradient(135deg, #238636 0%, #2ea043 100%);
  color: #fff;
}

.btn-success:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(35, 134, 54, 0.3);
}

.btn-danger {
  background: linear-gradient(135deg, #da3633 0%, #ff4d4f 100%);
  color: #fff;
}

.btn-danger:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(218, 54, 51, 0.3);
}
</style>