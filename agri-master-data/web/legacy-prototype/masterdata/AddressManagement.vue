<template>
  <div class="address-management">
    <div class="page-header">
      <div class="header-left">
        <h1>地址主数据</h1>
        <p>管理行政区划和地址标准化配置</p>
      </div>
      <div class="header-right">
        <button class="btn btn-primary" @click="openCreateModal">新增行政区划</button>
      </div>
    </div>

    <div class="tabs-container">
      <div class="tabs">
        <button 
          v-for="tab in tabs" 
          :key="tab.key" 
          :class="['tab-btn', { active: activeTab === tab.key }]"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <div v-if="activeTab === 'region'" class="tab-content">
      <div class="filter-section">
        <div class="search-box">
          <input type="text" v-model="searchKeyword" placeholder="搜索行政区划名称..." class="search-input" />
          <button class="search-btn" @click="handleSearch">搜索</button>
        </div>
        <div class="filter-group">
          <select v-model="levelFilter" class="filter-select">
            <option value="">全部级别</option>
            <option value="province">省级</option>
            <option value="city">市级</option>
            <option value="district">区级</option>
          </select>
        </div>
      </div>

      <div class="region-tree-container">
        <div class="tree-header">
          <span>行政区划树</span>
        </div>
        <div class="tree-content">
          <div class="tree-node" v-for="province in filteredRegions" :key="province.code">
            <div class="node-header" @click="toggleExpand(province.code)">
              <span class="expand-icon">{{ expandedNodes.includes(province.code) ? '▼' : '▶' }}</span>
              <span class="node-name">{{ province.name }} ({{ province.code }})</span>
              <span class="node-level">省级</span>
            </div>
            <div v-if="expandedNodes.includes(province.code)" class="children-container">
              <div v-for="city in province.children" :key="city.code" class="tree-node city">
                <div class="node-header" @click="toggleExpand(city.code)">
                  <span class="expand-icon">{{ expandedNodes.includes(city.code) ? '▼' : '▶' }}</span>
                  <span class="node-name">{{ city.name }} ({{ city.code }})</span>
                  <span class="node-level">市级</span>
                </div>
                <div v-if="expandedNodes.includes(city.code)" class="children-container">
                  <div v-for="district in city.children" :key="district.code" class="tree-node district">
                    <div class="node-header">
                      <span class="expand-icon"></span>
                      <span class="node-name">{{ district.name }} ({{ district.code }})</span>
                      <span class="node-level">区级</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="region-detail" v-if="selectedRegion">
        <div class="detail-header">
          <h3>行政区划详情</h3>
          <button class="close-btn" @click="selectedRegion = null">×</button>
        </div>
        <div class="detail-body">
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">行政区划代码</span>
              <span class="detail-value">{{ selectedRegion.code }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">名称</span>
              <span class="detail-value">{{ selectedRegion.name }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">级别</span>
              <span class="detail-value">{{ getLevelLabel(selectedRegion.level) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">上级代码</span>
              <span class="detail-value">{{ selectedRegion.parentCode || '-' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">拼音</span>
              <span class="detail-value">{{ selectedRegion.pinyin || '-' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">排序号</span>
              <span class="detail-value">{{ selectedRegion.sortOrder }}</span>
            </div>
          </div>
        </div>
        <div class="detail-footer">
          <button class="btn btn-edit" @click="editRegion(selectedRegion)">编辑</button>
          <button class="btn btn-delete" @click="deleteRegion(selectedRegion)">删除</button>
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'address-standard'" class="tab-content">
      <div class="standard-section">
        <div class="section-header">
          <h3>地址标准化配置</h3>
        </div>
        <div class="config-grid">
          <div class="config-card">
            <div class="config-icon">🧹</div>
            <div class="config-info">
              <h4>地址清洗</h4>
              <p>自动识别并清理地址中的冗余信息</p>
            </div>
            <button class="btn btn-secondary" @click="openCleaningModal">配置规则</button>
          </div>
          <div class="config-card">
            <div class="config-icon">🔄</div>
            <div class="config-info">
              <h4>地址补全</h4>
              <p>自动补全省市区等缺失信息</p>
            </div>
            <button class="btn btn-secondary" @click="openCompletionModal">配置规则</button>
          </div>
          <div class="config-card">
            <div class="config-icon">✅</div>
            <div class="config-info">
              <h4>地址验证</h4>
              <p>验证地址格式和有效性</p>
            </div>
            <button class="btn btn-secondary" @click="openValidationModal">配置规则</button>
          </div>
          <div class="config-card">
            <div class="config-icon">📍</div>
            <div class="config-info">
              <h4>产区管理</h4>
              <p>管理农产品产区信息</p>
            </div>
            <button class="btn btn-secondary" @click="openRegionModal">管理产区</button>
          </div>
        </div>
      </div>

      <div class="log-section">
        <div class="section-header">
          <h3>处理日志</h3>
        </div>
        <div class="log-table-container">
          <table class="log-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>类型</th>
                <th>原始地址</th>
                <th>处理后地址</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in addressLogs" :key="log.id">
                <td>{{ log.time }}</td>
                <td><span class="log-type">{{ getLogTypeLabel(log.type) }}</span></td>
                <td>{{ log.originalAddress }}</td>
                <td>{{ log.processedAddress }}</td>
                <td><span :class="['log-status', log.status]">{{ log.status === 'success' ? '成功' : '失败' }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="modal-overlay" v-if="modalVisible" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ isEdit ? '编辑行政区划' : '新增行政区划' }}</h3>
          <button class="close-btn" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>行政区划代码</label>
            <input type="text" v-model="formData.code" class="form-input" placeholder="请输入行政区划代码" />
          </div>
          <div class="form-group">
            <label>名称</label>
            <input type="text" v-model="formData.name" class="form-input" placeholder="请输入名称" />
          </div>
          <div class="form-group">
            <label>级别</label>
            <select v-model="formData.level" class="form-select">
              <option value="province">省级</option>
              <option value="city">市级</option>
              <option value="district">区级</option>
            </select>
          </div>
          <div class="form-group">
            <label>上级代码</label>
            <input type="text" v-model="formData.parentCode" class="form-input" placeholder="请输入上级行政区划代码" />
          </div>
          <div class="form-group">
            <label>拼音</label>
            <input type="text" v-model="formData.pinyin" class="form-input" placeholder="请输入拼音" />
          </div>
          <div class="form-group">
            <label>排序号</label>
            <input type="number" v-model="formData.sortOrder" class="form-input" placeholder="请输入排序号" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="closeModal">取消</button>
          <button class="btn btn-primary" @click="saveRegion">{{ isEdit ? '保存修改' : '创建' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'

const tabs = [
  { key: 'region', label: '行政区划管理' },
  { key: 'address-standard', label: '地址标准化' }
]

const activeTab = ref('region')
const searchKeyword = ref('')
const levelFilter = ref('')
const expandedNodes = ref([])
const selectedRegion = ref(null)
const modalVisible = ref(false)
const isEdit = ref(false)

const formData = reactive({
  code: '',
  name: '',
  level: 'province',
  parentCode: '',
  pinyin: '',
  sortOrder: 0
})

const mockRegions = ref([
  {
    code: '110000',
    name: '北京市',
    level: 'province',
    pinyin: 'beijing',
    sortOrder: 1,
    children: [
      {
        code: '110100',
        name: '北京市',
        level: 'city',
        pinyin: 'beijing',
        sortOrder: 1,
        children: [
          { code: '110101', name: '东城区', level: 'district', sortOrder: 1 },
          { code: '110102', name: '西城区', level: 'district', sortOrder: 2 },
          { code: '110105', name: '朝阳区', level: 'district', sortOrder: 3 },
          { code: '110106', name: '丰台区', level: 'district', sortOrder: 4 }
        ]
      }
    ]
  },
  {
    code: '310000',
    name: '上海市',
    level: 'province',
    pinyin: 'shanghai',
    sortOrder: 2,
    children: [
      {
        code: '310100',
        name: '上海市',
        level: 'city',
        pinyin: 'shanghai',
        sortOrder: 1,
        children: [
          { code: '310101', name: '黄浦区', level: 'district', sortOrder: 1 },
          { code: '310104', name: '徐汇区', level: 'district', sortOrder: 2 },
          { code: '310105', name: '长宁区', level: 'district', sortOrder: 3 }
        ]
      }
    ]
  },
  {
    code: '330000',
    name: '浙江省',
    level: 'province',
    pinyin: 'zhejiang',
    sortOrder: 3,
    children: [
      {
        code: '330100',
        name: '杭州市',
        level: 'city',
        pinyin: 'hangzhou',
        sortOrder: 1,
        children: [
          { code: '330102', name: '上城区', level: 'district', sortOrder: 1 },
          { code: '330105', name: '拱墅区', level: 'district', sortOrder: 2 },
          { code: '330106', name: '西湖区', level: 'district', sortOrder: 3 }
        ]
      },
      {
        code: '330200',
        name: '宁波市',
        level: 'city',
        pinyin: 'ningbo',
        sortOrder: 2,
        children: [
          { code: '330203', name: '海曙区', level: 'district', sortOrder: 1 },
          { code: '330205', name: '江北区', level: 'district', sortOrder: 2 }
        ]
      }
    ]
  }
])

const addressLogs = ref([
  { id: 1, time: '2026-05-09 10:30:00', type: 'clean', originalAddress: '浙江省杭州市西湖区文三路123号', processedAddress: '浙江省杭州市西湖区文三路123号', status: 'success' },
  { id: 2, time: '2026-05-09 10:25:00', type: 'complete', originalAddress: '西湖区文三路123号', processedAddress: '浙江省杭州市西湖区文三路123号', status: 'success' },
  { id: 3, time: '2026-05-09 10:20:00', type: 'validate', originalAddress: '北京市朝阳区xxx', processedAddress: '', status: 'failed' },
  { id: 4, time: '2026-05-09 10:15:00', type: 'clean', originalAddress: '上海市   黄浦区外滩18号', processedAddress: '上海市黄浦区外滩18号', status: 'success' }
])

const filteredRegions = computed(() => {
  return mockRegions.value.filter(region => {
    const matchKeyword = !searchKeyword.value || region.name.includes(searchKeyword.value)
    const matchLevel = !levelFilter.value || region.level === levelFilter.value
    return matchKeyword && matchLevel
  })
})

const getLevelLabel = (level) => {
  const labels = { province: '省级', city: '市级', district: '区级' }
  return labels[level] || level
}

const getLogTypeLabel = (type) => {
  const labels = { clean: '地址清洗', complete: '地址补全', validate: '地址验证' }
  return labels[type] || type
}

const toggleExpand = (code) => {
  const index = expandedNodes.value.indexOf(code)
  if (index > -1) {
    expandedNodes.value.splice(index, 1)
  } else {
    expandedNodes.value.push(code)
  }
}

const handleSearch = () => {
  expandedNodes.value = []
}

const openCreateModal = () => {
  isEdit.value = false
  formData.code = ''
  formData.name = ''
  formData.level = 'province'
  formData.parentCode = ''
  formData.pinyin = ''
  formData.sortOrder = 0
  modalVisible.value = true
}

const editRegion = (region) => {
  isEdit.value = true
  formData.code = region.code
  formData.name = region.name
  formData.level = region.level
  formData.parentCode = region.parentCode || ''
  formData.pinyin = region.pinyin || ''
  formData.sortOrder = region.sortOrder
  modalVisible.value = true
}

const deleteRegion = (region) => {
  if (confirm(`确定要删除行政区划 ${region.name} 吗？`)) {
    const index = mockRegions.value.findIndex(r => r.code === region.code)
    if (index > -1) {
      mockRegions.value.splice(index, 1)
      selectedRegion.value = null
    }
  }
}

const saveRegion = () => {
  if (!formData.code || !formData.name) {
    alert('请填写必填字段')
    return
  }
  if (isEdit.value) {
    const updateRegion = (regions) => {
      regions.forEach(region => {
        if (region.code === formData.code) {
          region.name = formData.name
          region.level = formData.level
          region.parentCode = formData.parentCode || undefined
          region.pinyin = formData.pinyin || undefined
          region.sortOrder = formData.sortOrder
        }
        if (region.children) {
          updateRegion(region.children)
        }
      })
    }
    updateRegion(mockRegions.value)
    alert('行政区划信息已更新')
  } else {
    const newRegion = {
      code: formData.code,
      name: formData.name,
      level: formData.level,
      pinyin: formData.pinyin || undefined,
      sortOrder: formData.sortOrder,
      children: []
    }
    if (formData.level === 'city') {
      const province = mockRegions.value.find(r => r.code === formData.parentCode)
      if (province) {
        province.children.push(newRegion)
      }
    } else if (formData.level === 'district') {
      mockRegions.value.forEach(province => {
        const city = province.children.find(c => c.code === formData.parentCode)
        if (city) {
          city.children.push(newRegion)
        }
      })
    } else {
      mockRegions.value.push(newRegion)
    }
    alert('行政区划创建成功')
  }
  closeModal()
}

const closeModal = () => {
  modalVisible.value = false
}

const openCleaningModal = () => {
  alert('地址清洗配置功能开发中...')
}

const openCompletionModal = () => {
  alert('地址补全配置功能开发中...')
}

const openValidationModal = () => {
  alert('地址验证配置功能开发中...')
}

const openRegionModal = () => {
  alert('产区管理功能开发中...')
}

onMounted(() => {})
</script>

<style scoped>
.address-management {
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

.btn-secondary {
  background: #f0f0f0;
  color: #4a5568;
}

.btn-cancel {
  background: #f0f0f0;
  color: #4a5568;
}

.btn-edit {
  background: rgba(210, 153, 34, 0.1);
  color: #d29922;
}

.btn-delete {
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
}

.tabs-container {
  margin-bottom: 20px;
}

.tabs {
  display: flex;
  gap: 8px;
  background: #fff;
  padding: 4px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.tab-btn {
  padding: 10px 24px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  background: transparent;
  cursor: pointer;
  color: #6b7280;
}

.tab-btn.active {
  background: #238636;
  color: #fff;
}

.tab-content {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  padding: 20px;
}

.filter-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
}

.search-box {
  display: flex;
  gap: 8px;
}

.search-input {
  padding: 10px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  width: 300px;
  outline: none;
}

.search-btn {
  padding: 10px 24px;
  background: #238636;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

.filter-group {
  display: flex;
  gap: 12px;
}

.filter-select {
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  color: #4a5568;
  background: #fff;
}

.region-tree-container {
  display: flex;
  gap: 20px;
}

.tree-header {
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 16px;
}

.tree-content {
  width: 50%;
  max-height: 500px;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
}

.tree-node {
  margin-bottom: 4px;
}

.tree-node.city {
  padding-left: 20px;
}

.tree-node.district {
  padding-left: 40px;
}

.node-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.node-header:hover {
  background: #f0f0f0;
}

.expand-icon {
  font-size: 10px;
  color: #a0aec0;
  width: 16px;
}

.node-name {
  flex: 1;
  font-size: 14px;
  color: #2d3748;
}

.node-level {
  font-size: 11px;
  padding: 2px 8px;
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
  border-radius: 10px;
}

.region-detail {
  width: 50%;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.detail-header h3 {
  margin: 0;
  font-size: 16px;
  color: #2d3748;
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  color: #a0aec0;
  cursor: pointer;
}

.detail-body {
  padding: 20px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.detail-item {
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
}

.detail-label {
  display: block;
  font-size: 12px;
  color: #a0aec0;
  margin-bottom: 4px;
}

.detail-value {
  font-size: 14px;
  color: #2d3748;
  font-weight: 500;
}

.detail-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px;
  border-top: 1px solid #e2e8f0;
}

.standard-section {
  margin-bottom: 24px;
}

.section-header {
  margin-bottom: 16px;
}

.section-header h3 {
  font-size: 16px;
  color: #2d3748;
  margin: 0;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.config-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: #f8fafc;
  border-radius: 12px;
}

.config-icon {
  font-size: 32px;
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border-radius: 12px;
}

.config-info h4 {
  margin: 0 0 4px;
  font-size: 14px;
  color: #2d3748;
}

.config-info p {
  margin: 0;
  font-size: 12px;
  color: #a0aec0;
}

.log-section {
  margin-top: 24px;
}

.log-table-container {
  overflow-x: auto;
}

.log-table {
  width: 100%;
  border-collapse: collapse;
}

.log-table th,
.log-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
}

.log-table th {
  font-size: 13px;
  font-weight: 600;
  color: #4a5568;
  background: #f8fafc;
}

.log-table td {
  font-size: 13px;
  color: #2d3748;
}

.log-type {
  padding: 4px 10px;
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
  border-radius: 12px;
  font-size: 11px;
}

.log-status {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.log-status.success {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.log-status.failed {
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
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