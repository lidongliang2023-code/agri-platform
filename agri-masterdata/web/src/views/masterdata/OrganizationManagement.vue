<template>
  <div class="org-management">
    <div class="page-header">
      <div class="header-left">
        <h1>组织管理</h1>
        <p>管理企业组织架构</p>
      </div>
      <div class="header-right">
        <button class="btn btn-primary" @click="openCreateModal">新建组织</button>
      </div>
    </div>

    <div class="main-content">
      <div class="tree-panel">
        <div class="panel-header">
          <h3>组织架构树</h3>
        </div>
        <div class="tree-content">
          <div class="tree-node" v-for="node in treeData" :key="node.id">
            <div 
              class="node-header" 
              :class="{ active: selectedOrg?.id === node.id }"
              @click="selectOrg(node)"
            >
              <span class="expand-icon" @click.stop="toggleExpand(node.id)">
                {{ expandedIds.includes(node.id) ? '▼' : '▶' }}
              </span>
              <span class="node-icon">🏢</span>
              <span class="node-name">{{ node.name }}</span>
            </div>
            <div v-if="expandedIds.includes(node.id) && node.children?.length" class="child-nodes">
              <div v-for="child in node.children" :key="child.id" class="child-node">
                <div 
                  class="child-header" 
                  :class="{ active: selectedOrg?.id === child.id }"
                  @click="selectOrg(child)"
                >
                  <span class="child-icon">📦</span>
                  <span>{{ child.name }}</span>
                </div>
                <div v-if="child.children?.length" class="grandchild-nodes">
                  <div 
                    v-for="grandchild in child.children" 
                    :key="grandchild.id"
                    class="grandchild-node"
                    :class="{ active: selectedOrg?.id === grandchild.id }"
                    @click="selectOrg(grandchild)"
                  >
                    <span class="grandchild-icon">👤</span>
                    <span>{{ grandchild.name }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="detail-panel">
        <div v-if="selectedOrg" class="detail-content">
          <div class="detail-header">
            <h3>{{ selectedOrg.name }}</h3>
            <div class="detail-actions">
              <button class="action-btn edit" @click="editOrg(selectedOrg)">编辑</button>
              <button class="action-btn delete" @click="deleteOrg(selectedOrg)">删除</button>
            </div>
          </div>

          <div class="info-section">
            <h4>基本信息</h4>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">组织编码</span>
                <span class="info-value">{{ selectedOrg.code }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">组织类型</span>
                <span class="info-value">{{ getTypeLabel(selectedOrg.type) }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">上级组织</span>
                <span class="info-value">{{ selectedOrg.parentName || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">状态</span>
                <span :class="['info-value', 'status-badge', selectedOrg.status]">{{ getStatusLabel(selectedOrg.status) }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">创建时间</span>
                <span class="info-value">{{ selectedOrg.createTime }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">负责人</span>
                <span class="info-value">{{ selectedOrg.manager || '-' }}</span>
              </div>
            </div>
          </div>

          <div class="member-section">
            <div class="section-header">
              <h4>成员列表</h4>
              <button class="add-member-btn" @click="addMember">+ 添加成员</button>
            </div>
            <div class="member-list">
              <div v-for="member in selectedOrg.members" :key="member.id" class="member-item">
                <span class="member-avatar">{{ member.avatar }}</span>
                <div class="member-info">
                  <span class="member-name">{{ member.name }}</span>
                  <span class="member-role">{{ member.role }}</span>
                </div>
                <button class="remove-member" @click="removeMember(member)">×</button>
              </div>
            </div>
          </div>

          <div class="relation-section">
            <h4>关联业务</h4>
            <div class="relation-list">
              <div v-for="relation in selectedOrg.relations" :key="relation.id" class="relation-item">
                <span class="relation-icon">{{ relation.icon }}</span>
                <div class="relation-info">
                  <span class="relation-name">{{ relation.name }}</span>
                  <span class="relation-type">{{ relation.type }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          <span class="empty-icon">🏢</span>
          <p>请选择一个组织查看详情</p>
        </div>
      </div>
    </div>

    <div class="modal-overlay" v-if="modalVisible" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ isEdit ? '编辑组织' : '新建组织' }}</h3>
          <button class="close-btn" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>组织名称</label>
            <input type="text" v-model="formData.name" class="form-input" placeholder="请输入组织名称" />
          </div>
          <div class="form-group">
            <label>组织编码</label>
            <input type="text" v-model="formData.code" class="form-input" placeholder="请输入组织编码" />
          </div>
          <div class="form-group">
            <label>组织类型</label>
            <select v-model="formData.type" class="form-select">
              <option value="company">企业</option>
              <option value="department">部门</option>
              <option value="team">团队</option>
              <option value="position">岗位</option>
            </select>
          </div>
          <div class="form-group">
            <label>上级组织</label>
            <select v-model="formData.parentId" class="form-select">
              <option value="">无</option>
              <option v-for="org in parentOptions" :key="org.id" :value="org.id">{{ org.name }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>负责人</label>
            <input type="text" v-model="formData.manager" class="form-input" placeholder="请输入负责人姓名" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="closeModal">取消</button>
          <button class="btn btn-primary" @click="saveOrg">{{ isEdit ? '保存修改' : '创建组织' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'

const selectedOrg = ref(null)
const expandedIds = ref([1])
const modalVisible = ref(false)
const isEdit = ref(false)

const formData = reactive({
  name: '',
  code: '',
  type: 'department',
  parentId: '',
  manager: ''
})

const mockOrgs = ref([
  {
    id: 1,
    name: '农谷集团',
    code: 'AGRI-001',
    type: 'company',
    parentId: null,
    parentName: '',
    status: 'active',
    createTime: '2026-01-01 09:00:00',
    manager: '张总',
    members: [
      { id: 1, avatar: '👤', name: '张总', role: 'CEO' },
      { id: 2, avatar: '👤', name: '李副总', role: 'COO' }
    ],
    relations: [
      { id: 1, icon: '📦', name: '商品管理系统', type: '业务系统' },
      { id: 2, icon: '👥', name: '客户管理系统', type: '业务系统' }
    ],
    children: [
      {
        id: 2,
        name: '研发部',
        code: 'AGRI-RD-001',
        type: 'department',
        parentId: 1,
        parentName: '农谷集团',
        status: 'active',
        createTime: '2026-01-05 10:00:00',
        manager: '王经理',
        members: [
          { id: 3, avatar: '👤', name: '王经理', role: '部门经理' },
          { id: 4, avatar: '👤', name: '赵工程师', role: '高级工程师' },
          { id: 5, avatar: '👤', name: '孙开发', role: '开发工程师' }
        ],
        relations: [],
        children: [
          { id: 5, name: '前端开发组', code: 'AGRI-RD-FE', type: 'team', parentId: 2, parentName: '研发部', status: 'active', createTime: '2026-02-01 09:00:00', manager: '赵工程师', members: [], relations: [] },
          { id: 6, name: '后端开发组', code: 'AGRI-RD-BE', type: 'team', parentId: 2, parentName: '研发部', status: 'active', createTime: '2026-02-01 09:00:00', manager: '孙开发', members: [], relations: [] }
        ]
      },
      {
        id: 3,
        name: '市场部',
        code: 'AGRI-MKT-001',
        type: 'department',
        parentId: 1,
        parentName: '农谷集团',
        status: 'active',
        createTime: '2026-01-06 10:00:00',
        manager: '刘经理',
        members: [
          { id: 6, avatar: '👤', name: '刘经理', role: '部门经理' },
          { id: 7, avatar: '👤', name: '陈专员', role: '市场专员' }
        ],
        relations: [],
        children: []
      },
      {
        id: 4,
        name: '销售部',
        code: 'AGRI-SALES-001',
        type: 'department',
        parentId: 1,
        parentName: '农谷集团',
        status: 'active',
        createTime: '2026-01-07 10:00:00',
        manager: '周经理',
        members: [
          { id: 8, avatar: '👤', name: '周经理', role: '部门经理' },
          { id: 9, avatar: '👤', name: '吴销售', role: '销售代表' }
        ],
        relations: [],
        children: []
      }
    ]
  }
])

const treeData = computed(() => mockOrgs.value)

const parentOptions = computed(() => {
  const options = []
  const collectOrgs = (orgs) => {
    orgs.forEach(org => {
      if (org.type !== 'position') {
        options.push({ id: org.id, name: org.name })
      }
      if (org.children) {
        collectOrgs(org.children)
      }
    })
  }
  collectOrgs(mockOrgs.value)
  return options
})

const getTypeLabel = (type) => {
  const labels = { company: '企业', department: '部门', team: '团队', position: '岗位' }
  return labels[type] || type
}

const getStatusLabel = (status) => {
  return status === 'active' ? '启用' : '禁用'
}

const toggleExpand = (id) => {
  const index = expandedIds.value.indexOf(id)
  if (index > -1) {
    expandedIds.value.splice(index, 1)
  } else {
    expandedIds.value.push(id)
  }
}

const selectOrg = (org) => {
  selectedOrg.value = org
}

const openCreateModal = () => {
  isEdit.value = false
  formData.name = ''
  formData.code = ''
  formData.type = 'department'
  formData.parentId = ''
  formData.manager = ''
  modalVisible.value = true
}

const editOrg = (org) => {
  isEdit.value = true
  formData.name = org.name
  formData.code = org.code
  formData.type = org.type
  formData.parentId = org.parentId || ''
  formData.manager = org.manager || ''
  selectedOrg.value = org
  modalVisible.value = true
}

const deleteOrg = (org) => {
  if (confirm(`确定要删除组织 ${org.name} 吗？`)) {
    alert('组织删除功能开发中')
  }
}

const saveOrg = () => {
  if (!formData.name || !formData.code) {
    alert('请填写必填字段')
    return
  }
  if (isEdit.value) {
    alert('组织信息已更新')
  } else {
    alert('组织创建成功')
  }
  closeModal()
}

const closeModal = () => {
  modalVisible.value = false
  selectedOrg.value = null
}

const addMember = () => {
  alert('添加成员功能开发中')
}

const removeMember = (member) => {
  if (confirm(`确定要移除成员 ${member.name} 吗？`)) {
    if (selectedOrg.value && selectedOrg.value.members) {
      const index = selectedOrg.value.members.findIndex(m => m.id === member.id)
      if (index > -1) {
        selectedOrg.value.members.splice(index, 1)
      }
    }
  }
}

onMounted(() => {
  if (mockOrgs.value.length > 0) {
    selectedOrg.value = mockOrgs.value[0]
  }
})
</script>

<style scoped>
.org-management {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
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

.btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
}

.btn-primary {
  background: #238636;
  color: #fff;
}

.btn-cancel {
  background: #f0f0f0;
  color: #4a5568;
}

.main-content {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 20px;
}

.tree-panel {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.panel-header {
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
}

.panel-header h3 {
  font-size: 14px;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
}

.tree-content {
  padding: 12px;
}

.tree-node {
  margin-bottom: 4px;
}

.node-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.node-header:hover {
  background: #f8fafc;
}

.node-header.active {
  background: rgba(35, 134, 54, 0.1);
}

.expand-icon {
  font-size: 10px;
  color: #a0aec0;
  width: 16px;
}

.node-icon {
  font-size: 16px;
}

.node-name {
  font-size: 14px;
  color: #2d3748;
  font-weight: 500;
}

.child-nodes {
  padding-left: 24px;
}

.child-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.child-header:hover {
  background: #f8fafc;
}

.child-header.active {
  background: rgba(35, 134, 54, 0.1);
}

.child-icon {
  font-size: 14px;
}

.grandchild-nodes {
  padding-left: 20px;
}

.grandchild-node {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
  font-size: 13px;
  color: #4a5568;
}

.grandchild-node:hover {
  background: #f8fafc;
}

.grandchild-node.active {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.grandchild-icon {
  font-size: 12px;
}

.detail-panel {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  min-height: 500px;
}

.detail-content {
  padding: 20px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.detail-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
}

.detail-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  border: none;
}

.action-btn.edit {
  background: rgba(210, 153, 34, 0.1);
  color: #d29922;
}

.action-btn.delete {
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
}

.info-section {
  margin-bottom: 24px;
}

.info-section h4 {
  font-size: 14px;
  font-weight: 600;
  color: #2d3748;
  margin: 0 0 16px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.info-item {
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
}

.info-label {
  display: block;
  font-size: 12px;
  color: #a0aec0;
  margin-bottom: 4px;
}

.info-value {
  font-size: 14px;
  color: #2d3748;
  font-weight: 500;
}

.status-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.status-badge.active {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.status-badge.inactive {
  background: rgba(156, 163, 175, 0.1);
  color: #6b7280;
}

.member-section {
  margin-bottom: 24px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h4 {
  font-size: 14px;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
}

.add-member-btn {
  padding: 6px 14px;
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}

.member-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.member-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
}

.member-avatar {
  font-size: 24px;
}

.member-info {
  flex: 1;
}

.member-name {
  display: block;
  font-size: 14px;
  color: #2d3748;
  font-weight: 500;
}

.member-role {
  font-size: 12px;
  color: #a0aec0;
}

.remove-member {
  padding: 4px 8px;
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
}

.relation-section h4 {
  font-size: 14px;
  font-weight: 600;
  color: #2d3748;
  margin: 0 0 16px;
}

.relation-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.relation-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
}

.relation-icon {
  font-size: 20px;
}

.relation-info {
  flex: 1;
}

.relation-name {
  display: block;
  font-size: 14px;
  color: #2d3748;
}

.relation-type {
  font-size: 12px;
  color: #a0aec0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state p {
  font-size: 14px;
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
  overflow: hidden;
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
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 13px;
  color: #4a5568;
  margin-bottom: 6px;
}

.form-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
}

.form-select {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  color: #4a5568;
  background: #fff;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid #f0f0f0;
}
</style>