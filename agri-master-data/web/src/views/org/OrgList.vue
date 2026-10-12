<template>
  <div class="org-list">
    <div class="page-header">
      <div class="header-left">
        <h1>组织管理</h1>
        <p>管理组织信息与配置</p>
      </div>
      <button class="add-btn" @click="openCreateModal">
        <span class="btn-icon">+</span>
        <span>新增组织</span>
      </button>
    </div>

    <div class="search-bar">
      <div class="search-group">
        <input 
          type="text" 
          v-model="searchForm.keyword" 
          placeholder="组织名称/编码..." 
          class="search-input"
        />
        <button class="search-btn" @click="loadData">搜索</button>
      </div>
      <div class="filter-group">
        <select v-model="searchForm.orgType" class="filter-select">
          <option value="">全部类型</option>
          <option value="enterprise">企业</option>
          <option value="cooperative">合作社</option>
          <option value="farmer">农户</option>
        </select>
        <select v-model="searchForm.authStatus" class="filter-select">
          <option value="">认证状态</option>
          <option value="verified">已认证</option>
          <option value="unverified">未认证</option>
          <option value="pending">审核中</option>
        </select>
      </div>
    </div>

    <!--
      组织架构树。

      这段是从未接线的 masterdata/OrganizationManagement 页合并过来的 ——
      那一页唯一比本页多的能力就是"按层级看组织"，而它的数据是本地假数组。
      搬过来后改成读 GET /org/tree（真数据），并把原来写死的三层嵌套
      换成"按 parentId 建树 + 拍平渲染"，层数不再受限于三层。
    -->
    <div class="tree-panel">
      <div class="panel-header">
        <h3>组织架构树</h3>
        <span class="panel-hint" v-if="selectedOrg">
          已选中：{{ selectedOrg.orgName }}
          <button class="link-btn" @click="clearSelected">清除</button>
        </span>
      </div>
      <div v-if="treeError" class="tree-empty">{{ treeError }}</div>
      <div v-else-if="treeNodes.length === 0" class="tree-empty">暂无组织数据</div>
      <ul v-else class="tree-list">
        <li
          v-for="node in treeNodes"
          :key="node.id"
          class="tree-row"
          :class="{ active: selectedOrg && selectedOrg.id === node.id }"
          :style="{ paddingLeft: node.depth * 18 + 8 + 'px' }"
          @click="selectNode(node)"
        >
          <span
            class="node-toggle"
            @click.stop="toggleNode(node)"
          >{{ node.hasChildren ? (expandedIds.includes(node.id) ? '▼' : '▶') : '·' }}</span>
          <span class="node-name">{{ node.orgName }}</span>
          <span class="node-type">{{ getOrgTypeLabel(node.orgType) }}</span>
          <span class="node-auth">{{ getStatusLabel(node.authStatus) }}</span>
        </li>
      </ul>
    </div>

    <div class="selected-strip" v-if="selectedOrg">
      <span>编码：{{ selectedOrg.orgCode || '—' }}</span>
      <span>类型：{{ getOrgTypeLabel(selectedOrg.orgType) }}</span>
      <span>法人：{{ selectedOrg.legalPerson || '—' }}</span>
      <span>联系人：{{ selectedOrg.contactPerson || '—' }}</span>
      <span>电话：{{ selectedOrg.contactPhone || '—' }}</span>
      <span>认证：{{ getStatusLabel(selectedOrg.authStatus) }}</span>
      <span>层级：{{ selectedOrg.orgLevel ?? '—' }}</span>
    </div>

    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>组织编码</th>
            <th>组织名称</th>
            <th>组织类型</th>
            <th>法人</th>
            <th>联系人</th>
            <th>联系电话</th>
            <th>认证状态</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="org in tableData" :key="org.id">
            <td>{{ org.orgCode }}</td>
            <td>{{ org.orgName }}</td>
            <td>
              <span class="type-badge" :class="org.orgType">
                {{ getOrgTypeLabel(org.orgType) }}
              </span>
            </td>
            <td>{{ org.legalPerson }}</td>
            <td>{{ org.contactPerson }}</td>
            <td>{{ org.contactPhone }}</td>
            <td>
              <span class="status-badge" :class="org.authStatus">
                {{ getStatusLabel(org.authStatus) }}
              </span>
            </td>
            <td>{{ formatDate(org.createTime) }}</td>
            <td class="action-cell">
              <button class="action-btn view" @click="viewDetail(org.id)">详情</button>
              <button class="action-btn edit" @click="editOrg(org)">编辑</button>
              <button 
                class="action-btn delete" 
                @click="deleteOrgById(org.id)"
                v-if="org.authStatus === 'unverified'"
              >删除</button>
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

    <div class="modal-overlay" v-if="modalVisible" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ form.id ? '编辑组织' : '新增组织' }}</h3>
          <button class="close-btn" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>组织名称 *</label>
            <input type="text" v-model="form.orgName" placeholder="请输入组织名称" class="form-input" />
          </div>
          <div class="form-group">
            <label>组织类型</label>
            <select v-model="form.orgType" class="form-select">
              <option value="enterprise">企业</option>
              <option value="cooperative">合作社</option>
              <option value="farmer">农户</option>
            </select>
          </div>
          <div class="form-group">
            <label>法人 *</label>
            <input type="text" v-model="form.legalPerson" placeholder="请输入法人姓名" class="form-input" />
          </div>
          <div class="form-group">
            <label>联系人</label>
            <input type="text" v-model="form.contactPerson" placeholder="请输入联系人" class="form-input" />
          </div>
          <div class="form-group">
            <label>联系电话</label>
            <input type="text" v-model="form.contactPhone" placeholder="请输入联系电话" class="form-input" />
          </div>
          <div class="form-group">
            <label>地址</label>
            <textarea v-model="form.address" placeholder="请输入地址" class="form-textarea"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="closeModal">取消</button>
          <button class="btn btn-primary" @click="saveOrg">确认{{ form.id ? '修改' : '添加' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { message } from 'ant-design-vue'
import { getOrgList, getOrgTree, createOrg, updateOrg, deleteOrg } from '../../utils/api'

const tableData = ref([])
const pageNum = ref(1)
const pageSize = ref(10)
const total = ref(0)
const modalVisible = ref(false)

const totalPages = computed(() => Math.ceil(total.value / pageSize.value))

const searchForm = reactive({
  keyword: '',
  orgType: '',
  authStatus: ''
})

const form = reactive({
  id: null,
  orgName: '',
  orgType: 'enterprise',
  legalPerson: '',
  contactPerson: '',
  contactPhone: '',
  address: ''
})

const getOrgTypeLabel = (type) => {
  // 大小写不敏感，并覆盖后端实际在用的取值：
  // 库里存的是 ENTERPRISE / COOPERATIVE / FARM / DEPARTMENT，
  // 而原映射表只认小写的 enterprise/cooperative/farmer，
  // 于是每一行都把原始编码直接显示出来（表里显示 "FARM" 而不是"农场"）。
  const labels = {
    enterprise: '企业',
    cooperative: '合作社',
    farmer: '农户',
    farm: '农场',
    department: '部门',
    government: '政府机构',
    other: '其他'
  }
  if (!type) return '—'
  return labels[String(type).toLowerCase()] || type
}

const getStatusLabel = (status) => {
  const labels = { verified: '已认证', unverified: '未认证', pending: '审核中' }
  return labels[status] || status
}

const loadData = async () => {
  try {
    const response = await getOrgList({
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      orgName: searchForm.keyword,
      orgType: searchForm.orgType
    })
    if (response.code === 200) {
      tableData.value = response.data.list ?? []
      total.value = response.data.total ?? 0
    } else {
      message.error(response.message || '加载数据失败')
      tableData.value = []
      total.value = 0
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载数据失败')
    tableData.value = []
    total.value = 0
  }
}

/* ---------------------------- 组织架构树（真数据） ---------------------------- */

/** 树的全量数据（拍平后的可见节点） */
const treeNodes = ref([])
const treeError = ref('')
const expandedIds = ref([])
const selectedOrg = ref(null)
/** 原始树数据（未经展开过滤），供 toggleNode 重新计算 */
let treeSource = []

/** 把树按"当前展开了哪些节点"拍平成带 depth 的列表，模板只需一层 v-for */
function flatten(nodes, depth = 0, out = []) {
  nodes.forEach((node) => {
    out.push({ ...node, depth, hasChildren: node.children.length > 0 })
    if (node.children.length > 0 && expandedIds.value.includes(node.id)) {
      flatten(node.children, depth + 1, out)
    }
  })
  return out
}

function refreshTreeNodes() {
  treeNodes.value = flatten(treeSource)
}

const loadTree = async () => {
  treeError.value = ''
  try {
    const response = await getOrgTree()
    if (response.code !== 200) {
      treeError.value = response.message || '组织架构树加载失败'
      treeSource = []
      treeNodes.value = []
      return
    }
    // 接口 /org/tree 返回的本来就是**嵌套树**（每个节点自带 children），
    // 不需要在前端按 parentId 重新拼一次 —— 那样反而会把 children 覆盖掉。
    treeSource = response.data ?? []
    // 默认展开根节点，否则进来只看到几个根、像"没有下级"
    expandedIds.value = treeSource.map((node) => node.id)
    refreshTreeNodes()
  } catch (error) {
    treeError.value = error instanceof Error ? error.message : '组织架构树加载失败'
    treeSource = []
    treeNodes.value = []
  }
}

const toggleNode = (node) => {
  if (!node.hasChildren) return
  expandedIds.value = expandedIds.value.includes(node.id)
    ? expandedIds.value.filter((id) => id !== node.id)
    : [...expandedIds.value, node.id]
  refreshTreeNodes()
}

const selectNode = (node) => {
  selectedOrg.value = node
}

const clearSelected = () => {
  selectedOrg.value = null
}

const handleCurrentChange = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    pageNum.value = page
    loadData()
  }
}

const openCreateModal = () => {
  form.id = null
  form.orgName = ''
  form.orgType = 'enterprise'
  form.legalPerson = ''
  form.contactPerson = ''
  form.contactPhone = ''
  form.address = ''
  modalVisible.value = true
}

const editOrg = (row) => {
  form.id = row.id
  form.orgName = row.orgName
  form.orgType = row.orgType
  form.legalPerson = row.legalPerson
  form.contactPerson = row.contactPerson
  form.contactPhone = row.contactPhone
  form.address = row.address
  modalVisible.value = true
}

const closeModal = () => {
  modalVisible.value = false
}

const saveOrg = async () => {
  if (!form.orgName || !form.legalPerson) {
    alert('请填写必填项')
    return
  }
  
  try {
    let response
    if (form.id) {
      response = await updateOrg(form.id, form)
    } else {
      response = await createOrg(form)
    }
    
    if (response.code === 200) {
      alert(form.id ? '修改成功' : '创建成功')
      closeModal()
      loadData()
    } else {
      alert(response.message || '操作失败')
    }
  } catch (error) {
    alert('操作失败')
  }
}

const viewDetail = (id) => {
  alert(`查看组织详情: ${id}`)
}

const deleteOrgById = async (id) => {
  if (!confirm('确定要删除该组织吗？')) return
  try {
    const response = await deleteOrg(id)
    if (response.code === 200) {
      alert('删除成功')
      loadData()
    } else {
      alert(response.message || '删除失败')
    }
  } catch (error) {
    alert('删除失败')
  }
}

const formatDate = (date) => {
  if (!date) return ''
  // 后端返回 ISO（如 2026-10-12T17:32:41），只按空格切分会把 T 一起显示出来
  return String(date).replace('T', ' ').split(' ')[0]
}

onMounted(() => {
  loadTree()
  loadData()
})
</script>

<style scoped>
.org-list {
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
  display: flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #238636 0%, #2ea043 100%);
  color: #fff;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.add-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(35, 134, 54, 0.3);
}

.btn-icon {
  font-size: 18px;
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
}

.filter-group {
  display: flex;
  gap: 12px;
}

.filter-select {
  padding: 10px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  color: #4a5568;
  background: #fff;
  cursor: pointer;
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

.type-badge.enterprise {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.type-badge.cooperative {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.type-badge.farmer {
  background: rgba(210, 153, 34, 0.1);
  color: #d29922;
}

.status-badge {
  font-size: 11px;
  font-weight: 500;
  padding: 4px 12px;
  border-radius: 12px;
}

.status-badge.verified {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.status-badge.unverified {
  background: rgba(210, 153, 34, 0.1);
  color: #d29922;
}

.status-badge.pending {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
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
}

.action-btn.view {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.action-btn.edit {
  background: rgba(210, 153, 34, 0.1);
  color: #d29922;
}

.action-btn.delete {
  background: rgba(218, 54, 51, 0.1);
  color: #da3633;
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
  box-sizing: border-box;
}

.form-input:focus {
  border-color: #238636;
}

.form-textarea {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
  min-height: 80px;
}

.form-select {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  color: #4a5568;
  background: #fff;
  cursor: pointer;
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
  border: none;
}

.btn-cancel {
  background: #f0f0f0;
  color: #4a5568;
}

.btn-primary {
  background: linear-gradient(135deg, #238636 0%, #2ea043 100%);
  color: #fff;
}

/* ---------------------------- 组织架构树 ---------------------------- */

.tree-panel {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 16px 20px;
  margin-bottom: 16px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.panel-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #2d3748;
}

.panel-hint {
  font-size: 12px;
  color: #718096;
}

.link-btn {
  border: none;
  background: none;
  color: #238636;
  font-size: 12px;
  cursor: pointer;
  padding: 0 4px;
}

.tree-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 260px;
  overflow-y: auto;
}

.tree-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 13px;
  color: #2d3748;
  cursor: pointer;
}

.tree-row:hover {
  background: #f5f7fa;
}

.tree-row.active {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.node-toggle {
  width: 12px;
  font-size: 10px;
  color: #a0aec0;
}

.node-name {
  flex: 1;
}

.node-type,
.node-auth {
  font-size: 12px;
  color: #a0aec0;
}

.tree-empty {
  padding: 20px;
  text-align: center;
  font-size: 13px;
  color: #a0aec0;
}

.selected-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 12px 20px;
  margin-bottom: 16px;
  font-size: 13px;
  color: #4a5568;
}
</style>
