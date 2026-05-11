<template>
  <div class="announcement">
    <div class="page-header">
      <div class="header-left">
        <h1>公告管理</h1>
        <p>管理系统公告和通知消息</p>
      </div>
      <button class="add-btn" @click="showAddModal = true">+ 发布公告</button>
    </div>

    <div class="filter-bar">
      <select v-model="filterStatus" class="filter-select">
        <option value="all">全部状态</option>
        <option value="draft">草稿</option>
        <option value="published">已发布</option>
        <option value="expired">已过期</option>
      </select>
      <input 
        type="text" 
        v-model="filterKeyword" 
        placeholder="搜索公告标题..." 
        class="filter-input"
      />
    </div>

    <div class="announcement-list">
      <div 
        v-for="item in filteredAnnouncements" 
        :key="item.id" 
        class="announcement-card"
        :class="item.status"
      >
        <div class="card-header">
          <div class="header-left">
            <span class="type-badge" :class="item.type">{{ getTypeLabel(item.type) }}</span>
            <h3>{{ item.title }}</h3>
          </div>
          <span class="status-badge">{{ getStatusLabel(item.status) }}</span>
        </div>
        <div class="card-body">
          <p>{{ item.content }}</p>
        </div>
        <div class="card-footer">
          <div class="meta">
            <span class="author">作者: {{ item.author }}</span>
            <span class="time">{{ item.publishTime }}</span>
            <span v-if="item.expireTime" class="expire">到期: {{ item.expireTime }}</span>
          </div>
          <div class="actions">
            <button v-if="item.status === 'draft'" class="action-btn publish" @click="publishAnnouncement(item)">发布</button>
            <button class="action-btn edit" @click="editAnnouncement(item)">编辑</button>
            <button class="action-btn delete" @click="deleteAnnouncement(item)">删除</button>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-overlay" v-if="showAddModal" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ isEdit ? '编辑公告' : '发布公告' }}</h3>
          <button class="close-btn" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>公告标题 *</label>
            <input type="text" v-model="form.title" class="form-input" placeholder="请输入公告标题" />
          </div>
          <div class="form-group">
            <label>公告类型</label>
            <select v-model="form.type" class="form-input">
              <option value="info">通知公告</option>
              <option value="warning">重要提醒</option>
              <option value="maintenance">系统维护</option>
              <option value="emergency">紧急通知</option>
            </select>
          </div>
          <div class="form-group">
            <label>公告内容 *</label>
            <textarea v-model="form.content" class="form-input" rows="6" placeholder="请输入公告内容"></textarea>
          </div>
          <div class="form-group">
            <label>发布时间</label>
            <input type="datetime-local" v-model="form.publishTime" class="form-input" />
          </div>
          <div class="form-group">
            <label>过期时间</label>
            <input type="datetime-local" v-model="form.expireTime" class="form-input" />
          </div>
          <div class="form-group">
            <label>是否发布</label>
            <div class="checkbox-option">
              <input type="checkbox" v-model="form.published" id="published" />
              <label for="published">立即发布</label>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="closeModal">取消</button>
          <button class="btn btn-primary" @click="saveAnnouncement">{{ isEdit ? '保存修改' : '发布公告' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'

const showAddModal = ref(false)
const isEdit = ref(false)
const filterStatus = ref('all')
const filterKeyword = ref('')

const form = reactive({
  id: null,
  title: '',
  type: 'info',
  content: '',
  author: '管理员',
  publishTime: '',
  expireTime: '',
  published: false,
  status: 'draft'
})

const announcements = ref([])

const mockAnnouncements = [
  { id: 1, title: '系统升级通知', type: 'maintenance', content: '系统将于2026年5月15日00:00-04:00进行升级维护，期间系统将暂停服务，请提前做好准备。', author: '管理员', publishTime: '2026-05-10 09:00:00', expireTime: '2026-05-16 00:00:00', status: 'published' },
  { id: 2, title: '数据质量检测规则更新', type: 'info', content: '新增身份证号验证规则和邮箱格式验证规则，请相关人员注意查看。', author: '管理员', publishTime: '2026-05-09 14:30:00', expireTime: '', status: 'published' },
  { id: 3, title: '租户注册流程优化', type: 'info', content: '租户注册流程已优化，新增邮箱验证环节，请租户管理员注意。', author: '管理员', publishTime: '2026-05-08 10:00:00', expireTime: '', status: 'published' },
  { id: 4, title: '安全提醒', type: 'warning', content: '近期发现异常登录尝试，请各用户注意账号安全，及时修改密码。', author: '管理员', publishTime: '2026-05-07 16:00:00', expireTime: '', status: 'published' },
  { id: 5, title: '新功能预告', type: 'info', content: '数据质量仪表盘功能即将上线，敬请期待。', author: '管理员', publishTime: '', expireTime: '', status: 'draft' }
]

const filteredAnnouncements = computed(() => {
  return announcements.value.filter(item => {
    const matchStatus = filterStatus.value === 'all' || item.status === filterStatus.value
    const matchKeyword = !filterKeyword.value || 
      item.title.toLowerCase().includes(filterKeyword.value.toLowerCase()) ||
      item.content.toLowerCase().includes(filterKeyword.value.toLowerCase())
    return matchStatus && matchKeyword
  })
})

const getTypeLabel = (type) => {
  const labels = {
    info: '通知',
    warning: '提醒',
    maintenance: '维护',
    emergency: '紧急'
  }
  return labels[type] || type
}

const getStatusLabel = (status) => {
  const labels = {
    draft: '草稿',
    published: '已发布',
    expired: '已过期'
  }
  return labels[status] || status
}

const loadData = () => {
  announcements.value = mockAnnouncements
}

onMounted(() => {
  loadData()
})

const closeModal = () => {
  showAddModal.value = false
  isEdit.value = false
  Object.keys(form).forEach(key => {
    form[key] = key === 'type' ? 'info' : key === 'author' ? '管理员' : key === 'published' ? false : key === 'status' ? 'draft' : ''
  })
}

const editAnnouncement = (item) => {
  isEdit.value = true
  Object.assign(form, item)
  form.published = item.status === 'published'
  showAddModal.value = true
}

const publishAnnouncement = (item) => {
  item.status = 'published'
  item.publishTime = '刚刚'
  alert(`公告 "${item.title}" 已发布`)
}

const deleteAnnouncement = (item) => {
  if (confirm(`确定删除公告 "${item.title}" 吗？`)) {
    const index = announcements.value.findIndex(a => a.id === item.id)
    if (index !== -1) {
      announcements.value.splice(index, 1)
    }
    alert('公告已删除')
  }
}

const saveAnnouncement = () => {
  if (!form.title || !form.content) {
    alert('请填写必填字段')
    return
  }

  form.status = form.published ? 'published' : 'draft'
  form.publishTime = form.published ? '刚刚' : form.publishTime

  if (isEdit.value) {
    const index = announcements.value.findIndex(a => a.id === form.id)
    if (index !== -1) {
      announcements.value[index] = { ...announcements.value[index], ...form }
    }
    alert('公告已更新')
  } else {
    announcements.value.push({
      id: Date.now(),
      ...form
    })
    alert('公告已保存')
  }
  closeModal()
}
</script>

<style scoped>
.announcement {
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

.add-btn {
  padding: 10px 20px;
  background: linear-gradient(135deg, #238636 0%, #2ea043 100%);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.add-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(35, 134, 54, 0.3);
}

.filter-bar {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.filter-select {
  padding: 8px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  cursor: pointer;
}

.filter-input {
  padding: 8px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  flex: 1;
  min-width: 200px;
}

.announcement-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.announcement-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.announcement-card.draft {
  border-left: 4px solid #a0aec0;
}

.announcement-card.published {
  border-left: 4px solid #238636;
}

.announcement-card.expired {
  border-left: 4px solid #6b7280;
  opacity: 0.7;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.header-left {
  flex: 1;
}

.header-left h3 {
  font-size: 18px;
  font-weight: 600;
  color: #2d3748;
  margin: 8px 0 0;
}

.type-badge {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
}

.type-badge.info {
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
}

.type-badge.warning {
  background: rgba(210, 153, 34, 0.1);
  color: #d29922;
}

.type-badge.maintenance {
  background: rgba(147, 51, 234, 0.1);
  color: #7c3aed;
}

.type-badge.emergency {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.status-badge {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  background: rgba(156, 163, 175, 0.1);
  color: #6b7280;
}

.card-body {
  padding: 16px;
}

.card-body p {
  font-size: 14px;
  color: #4a5568;
  line-height: 1.6;
  margin: 0;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f8fafc;
}

.meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #718096;
}

.actions {
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

.action-btn.publish {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.action-btn.edit {
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
}

.action-btn.delete {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.action-btn:hover {
  opacity: 0.8;
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
  width: 600px;
  max-width: 90%;
  max-height: 90vh;
  overflow-y: auto;
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

.form-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.form-input:focus {
  border-color: #238636;
}

.checkbox-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.checkbox-option input {
  width: 18px;
  height: 18px;
}

.checkbox-option label {
  margin: 0;
  font-weight: 400;
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

.btn-primary {
  background: linear-gradient(135deg, #238636 0%, #2ea043 100%);
  color: #fff;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(35, 134, 54, 0.3);
}
</style>