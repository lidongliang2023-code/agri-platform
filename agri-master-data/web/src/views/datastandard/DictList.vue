<template>
  <div class="dict-list">
    <div class="page-header">
      <div class="header-left">
        <h1>数据字典</h1>
        <p>管理系统数据字典及字典项</p>
      </div>
      <button class="add-btn" @click="openCreateModal">
        <span class="btn-icon">+</span>
        <span>新增字典</span>
      </button>
    </div>

    <div class="search-bar">
      <div class="search-group">
        <input 
          type="text" 
          v-model="searchForm.keyword" 
          placeholder="字典名称/编码..." 
          class="search-input"
        />
        <button class="search-btn" @click="loadData">搜索</button>
      </div>
      <div class="filter-group">
        <select v-model="searchForm.status" class="filter-select">
          <option value="">全部状态</option>
          <option value="1">启用</option>
          <option value="0">禁用</option>
        </select>
      </div>
    </div>

    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>字典编码</th>
            <th>字典名称</th>
            <th>字典类型</th>
            <th>描述</th>
            <th>状态</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="dict in tableData" :key="dict.id">
            <td>{{ dict.dictCode }}</td>
            <td>{{ dict.dictName }}</td>
            <td>{{ dict.dictType }}</td>
            <td class="desc-cell">{{ dict.description }}</td>
            <td>
              <span class="status-badge" :class="dict.status === 1 ? 'active' : 'inactive'">
                {{ dict.status === 1 ? '启用' : '禁用' }}
              </span>
            </td>
            <td>{{ formatDate(dict.createTime) }}</td>
            <td class="action-cell">
              <button class="action-btn view" @click="viewItems(dict)">查看项</button>
              <button class="action-btn edit" @click="editDict(dict)">编辑</button>
              <button 
                class="action-btn delete" 
                @click="deleteDict(dict.id)"
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
          <h3>{{ form.id ? '编辑字典' : '新增字典' }}</h3>
          <button class="close-btn" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>字典编码 *</label>
            <input type="text" v-model="form.dictCode" placeholder="请输入字典编码" class="form-input" :disabled="form.id" />
          </div>
          <div class="form-group">
            <label>字典名称 *</label>
            <input type="text" v-model="form.dictName" placeholder="请输入字典名称" class="form-input" />
          </div>
          <div class="form-group">
            <label>字典类型</label>
            <input type="text" v-model="form.dictType" placeholder="请输入字典类型" class="form-input" />
          </div>
          <div class="form-group">
            <label>描述</label>
            <textarea v-model="form.description" placeholder="请输入描述" class="form-textarea"></textarea>
          </div>
          <div class="form-group">
            <label>状态</label>
            <select v-model="form.status" class="form-select">
              <option :value="1">启用</option>
              <option :value="0">禁用</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="closeModal">取消</button>
          <button class="btn btn-primary" @click="saveDict">确认{{ form.id ? '修改' : '添加' }}</button>
        </div>
      </div>
    </div>

    <div class="modal-overlay" v-if="itemsModalVisible" @click="closeItemsModal">
      <div class="modal-content items-modal" @click.stop>
        <div class="modal-header">
          <h3>{{ currentDictName }} - 字典项管理</h3>
          <button class="close-btn" @click="closeItemsModal">×</button>
        </div>
        <div class="modal-body">
          <div class="items-header">
            <span class="items-title">字典项列表</span>
            <button class="btn btn-primary btn-sm" @click="openItemCreateModal">+ 添加字典项</button>
          </div>
          <table class="data-table items-table">
            <thead>
              <tr>
                <th>值</th>
                <th>标签</th>
                <th>排序</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in dictItems" :key="item.id">
                <td>{{ item.itemValue }}</td>
                <td>{{ item.itemLabel }}</td>
                <td>{{ item.sortOrder }}</td>
                <td>
                  <span class="status-badge" :class="item.status === 1 ? 'active' : 'inactive'">
                    {{ item.status === 1 ? '启用' : '禁用' }}
                  </span>
                </td>
                <td class="action-cell">
                  <button class="action-btn edit" @click="editDictItem(item)">编辑</button>
                  <button class="action-btn delete" @click="deleteDictItem(item.id)">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="closeItemsModal">关闭</button>
        </div>
      </div>
    </div>

    <div class="modal-overlay" v-if="itemModalVisible" @click="closeItemModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ itemForm.id ? '编辑字典项' : '新增字典项' }}</h3>
          <button class="close-btn" @click="closeItemModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>值 *</label>
            <input type="text" v-model="itemForm.itemValue" placeholder="请输入值" class="form-input" />
          </div>
          <div class="form-group">
            <label>标签 *</label>
            <input type="text" v-model="itemForm.itemLabel" placeholder="请输入标签" class="form-input" />
          </div>
          <div class="form-group">
            <label>排序</label>
            <input type="number" v-model="itemForm.sortOrder" placeholder="请输入排序号" class="form-input" />
          </div>
          <div class="form-group">
            <label>状态</label>
            <select v-model="itemForm.status" class="form-select">
              <option :value="1">启用</option>
              <option :value="0">禁用</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="closeItemModal">取消</button>
          <button class="btn btn-primary" @click="saveDictItem">确认{{ itemForm.id ? '修改' : '添加' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { getDictList, createDict, updateDict, deleteDict as apiDeleteDict } from '../../utils/api'

const tableData = ref([])
const pageNum = ref(1)
const pageSize = ref(10)
const total = ref(0)
const modalVisible = ref(false)
const itemsModalVisible = ref(false)
const itemModalVisible = ref(false)
const currentDictName = ref('')
const currentDictId = ref(null)
const dictItems = ref([])

const totalPages = computed(() => Math.ceil(total.value / pageSize.value))

const searchForm = reactive({
  keyword: '',
  status: ''
})

const form = reactive({
  id: null,
  dictCode: '',
  dictName: '',
  dictType: '',
  description: '',
  status: 1
})

const itemForm = reactive({
  id: null,
  itemValue: '',
  itemLabel: '',
  sortOrder: 1,
  status: 1
})

const loadData = async () => {
  try {
    const response = await getDictList({
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      keyword: searchForm.keyword,
      status: searchForm.status
    })
    if (response.code === 200) {
      tableData.value = response.data.list || mockDicts
      total.value = response.data.total || mockDicts.length
    }
  } catch (error) {
    console.error('Failed to load dicts:', error)
    tableData.value = mockDicts
    total.value = mockDicts.length
  }
}

const mockDicts = [
  { id: 1, dictCode: 'YES_NO', dictName: '是否', dictType: 'base', description: '是/否选择', status: 1, createTime: '2024-01-01 00:00:00' },
  { id: 2, dictCode: 'USER_TYPE', dictName: '用户类型', dictType: 'user', description: '用户类型字典', status: 1, createTime: '2024-01-02 10:00:00' },
  { id: 3, dictCode: 'ORG_TYPE', dictName: '组织类型', dictType: 'org', description: '组织类型字典', status: 1, createTime: '2024-01-03 14:30:00' },
  { id: 4, dictCode: 'AUTH_STATUS', dictName: '认证状态', dictType: 'base', description: '认证状态字典', status: 0, createTime: '2024-01-04 09:15:00' },
  { id: 5, dictCode: 'PRODUCT_STATUS', dictName: '商品状态', dictType: 'product', description: '商品状态字典', status: 1, createTime: '2024-01-05 16:45:00' }
]

const handleCurrentChange = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    pageNum.value = page
    loadData()
  }
}

const openCreateModal = () => {
  form.id = null
  form.dictCode = ''
  form.dictName = ''
  form.dictType = ''
  form.description = ''
  form.status = 1
  modalVisible.value = true
}

const editDict = (row) => {
  form.id = row.id
  form.dictCode = row.dictCode
  form.dictName = row.dictName
  form.dictType = row.dictType
  form.description = row.description
  form.status = row.status
  modalVisible.value = true
}

const closeModal = () => {
  modalVisible.value = false
}

const saveDict = async () => {
  if (!form.dictCode || !form.dictName) {
    alert('请填写必填项')
    return
  }
  
  try {
    let response
    if (form.id) {
      response = await updateDict(form.id, form)
    } else {
      response = await createDict(form)
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

const deleteDict = async (id) => {
  if (!confirm('确定要删除该字典吗？')) return
  try {
    const response = await apiDeleteDict(id)
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

const viewItems = (row) => {
  currentDictName.value = row.dictName
  currentDictId.value = row.id
  dictItems.value = [
    { id: 1, itemValue: '1', itemLabel: '是', sortOrder: 1, status: 1 },
    { id: 2, itemValue: '0', itemLabel: '否', sortOrder: 2, status: 1 }
  ]
  itemsModalVisible.value = true
}

const closeItemsModal = () => {
  itemsModalVisible.value = false
}

const openItemCreateModal = () => {
  itemForm.id = null
  itemForm.itemValue = ''
  itemForm.itemLabel = ''
  itemForm.sortOrder = 1
  itemForm.status = 1
  itemModalVisible.value = true
}

const editDictItem = (row) => {
  itemForm.id = row.id
  itemForm.itemValue = row.itemValue
  itemForm.itemLabel = row.itemLabel
  itemForm.sortOrder = row.sortOrder
  itemForm.status = row.status
  itemModalVisible.value = true
}

const closeItemModal = () => {
  itemModalVisible.value = false
}

const saveDictItem = async () => {
  if (!itemForm.itemValue || !itemForm.itemLabel) {
    alert('请填写必填项')
    return
  }
  
  try {
    if (itemForm.id) {
      const index = dictItems.value.findIndex(item => item.id === itemForm.id)
      if (index !== -1) {
        dictItems.value[index] = { ...itemForm }
      }
    } else {
      dictItems.value.push({
        ...itemForm,
        id: Date.now()
      })
    }
    alert(itemForm.id ? '修改成功' : '添加成功')
    closeItemModal()
  } catch (error) {
    alert('操作失败')
  }
}

const deleteDictItem = async (id) => {
  if (!confirm('确定要删除该字典项吗？')) return
  try {
    dictItems.value = dictItems.value.filter(item => item.id !== id)
    alert('删除成功')
  } catch (error) {
    alert('删除失败')
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
.dict-list {
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
  transition: all 0.2s;
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
}

.search-btn:hover {
  background: rgba(35, 134, 54, 0.1);
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

.desc-cell {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-badge {
  font-size: 11px;
  font-weight: 500;
  padding: 4px 12px;
  border-radius: 12px;
}

.status-badge.active {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.status-badge.inactive {
  background: rgba(160, 174, 192, 0.1);
  color: #a0aec0;
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

.action-btn.edit {
  background: rgba(210, 153, 34, 0.1);
  color: #d29922;
}

.action-btn.delete {
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

.items-modal {
  width: 700px;
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

.close-btn:hover {
  color: #2d3748;
}

.modal-body {
  padding: 20px;
}

.items-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.items-title {
  font-size: 14px;
  font-weight: 600;
  color: #2d3748;
}

.btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
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

.form-input:disabled {
  background: #f8fafc;
  color: #a0aec0;
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

.items-table {
  font-size: 13px;
}

.items-table th,
.items-table td {
  padding: 10px 12px;
}
</style>