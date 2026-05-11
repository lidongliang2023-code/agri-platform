<template>
  <div class="region-list">
    <div class="page-header">
      <div class="header-left">
        <h1>行政区划维护</h1>
        <p>管理省市区行政区划数据</p>
      </div>
      <button class="add-btn" @click="openAddModal">+ 新增地区</button>
    </div>

    <div class="filter-bar">
      <select v-model="filterLevel" class="filter-select">
        <option value="">全部级别</option>
        <option value="1">省级</option>
        <option value="2">市级</option>
        <option value="3">区级</option>
      </select>
      <input 
        type="text" 
        v-model="filterKeyword" 
        placeholder="搜索地区名称..." 
        class="filter-input"
      />
    </div>

    <div class="tree-container">
      <div class="tree-header">
        <span class="header-title">行政区划树</span>
        <button class="expand-all" @click="expandAll">{{ expandedAll ? '全部收起' : '全部展开' }}</button>
      </div>
      <div class="tree-content">
        <ul class="tree-list">
          <li v-for="province in filteredRegions" :key="province.code" class="tree-item">
            <div class="tree-node" @click="toggleNode(province.code)">
              <span class="expand-icon" :class="{ expanded: expandedNodes.includes(province.code) }">▶</span>
              <span class="node-icon">🏛️</span>
              <span class="node-name">{{ province.name }}</span>
              <span class="node-code">{{ province.code }}</span>
              <div class="node-actions">
                <button class="action-btn" @click.stop="editRegion(province)">编辑</button>
                <button class="action-btn delete" @click.stop="deleteRegion(province)">删除</button>
              </div>
            </div>
            <ul v-if="expandedNodes.includes(province.code) && province.children" class="tree-children">
              <li v-for="city in province.children" :key="city.code" class="tree-item">
                <div class="tree-node" @click="toggleNode(city.code)">
                  <span class="expand-icon" :class="{ expanded: expandedNodes.includes(city.code) }">▶</span>
                  <span class="node-icon">🏙️</span>
                  <span class="node-name">{{ city.name }}</span>
                  <span class="node-code">{{ city.code }}</span>
                  <div class="node-actions">
                    <button class="action-btn" @click.stop="editRegion(city)">编辑</button>
                    <button class="action-btn delete" @click.stop="deleteRegion(city)">删除</button>
                  </div>
                </div>
                <ul v-if="expandedNodes.includes(city.code) && city.children" class="tree-children">
                  <li v-for="district in city.children" :key="district.code" class="tree-item">
                    <div class="tree-node">
                      <span class="node-icon">📍</span>
                      <span class="node-name">{{ district.name }}</span>
                      <span class="node-code">{{ district.code }}</span>
                      <div class="node-actions">
                        <button class="action-btn" @click.stop="editRegion(district)">编辑</button>
                        <button class="action-btn delete" @click.stop="deleteRegion(district)">删除</button>
                      </div>
                    </div>
                  </li>
                </ul>
              </li>
            </ul>
          </li>
        </ul>
      </div>
    </div>

    <div class="modal-overlay" v-if="modalVisible" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ form.id ? '编辑地区' : '新增地区' }}</h3>
          <button class="close-btn" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>地区名称 *</label>
            <input type="text" v-model="form.name" class="form-input" placeholder="请输入地区名称" />
          </div>
          <div class="form-group">
            <label>地区编码 *</label>
            <input type="text" v-model="form.code" class="form-input" placeholder="请输入地区编码" :disabled="form.id" />
          </div>
          <div class="form-group">
            <label>上级地区</label>
            <select v-model="form.parentCode" class="form-input">
              <option value="">无（省级）</option>
              <option v-for="province in provinceOptions" :key="province.code" :value="province.code">
                {{ province.name }}
              </option>
              <option v-for="city in cityOptions" :key="city.code" :value="city.code">
                {{ city.parentName }} - {{ city.name }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>地区级别</label>
            <select v-model="form.level" class="form-input" :disabled="form.id">
              <option :value="1">省级</option>
              <option :value="2">市级</option>
              <option :value="3">区级</option>
            </select>
          </div>
          <div class="form-group">
            <label>排序</label>
            <input type="number" v-model="form.sortOrder" class="form-input" placeholder="请输入排序号" />
          </div>
          <div class="form-group">
            <label>是否启用</label>
            <div class="checkbox-option">
              <input type="checkbox" v-model="form.enabled" id="enabled" />
              <label for="enabled">启用</label>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="closeModal">取消</button>
          <button class="btn btn-primary" @click="saveRegion">{{ form.id ? '保存修改' : '新增地区' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'

const modalVisible = ref(false)
const filterKeyword = ref('')
const filterLevel = ref('')
const expandedNodes = ref([])
const expandedAll = ref(false)

const form = reactive({
  id: null,
  name: '',
  code: '',
  parentCode: '',
  level: 1,
  sortOrder: 1,
  enabled: true
})

const regions = ref([])

const mockRegions = [
  {
    id: 1,
    code: '110000',
    name: '北京市',
    level: 1,
    parentCode: '',
    sortOrder: 1,
    enabled: true,
    children: [
      {
        id: 11,
        code: '110100',
        name: '北京市',
        level: 2,
        parentCode: '110000',
        sortOrder: 1,
        enabled: true,
        children: [
          { id: 111, code: '110101', name: '东城区', level: 3, parentCode: '110100', sortOrder: 1, enabled: true },
          { id: 112, code: '110102', name: '西城区', level: 3, parentCode: '110100', sortOrder: 2, enabled: true },
          { id: 113, code: '110105', name: '朝阳区', level: 3, parentCode: '110100', sortOrder: 3, enabled: true }
        ]
      }
    ]
  },
  {
    id: 2,
    code: '310000',
    name: '上海市',
    level: 1,
    parentCode: '',
    sortOrder: 2,
    enabled: true,
    children: [
      {
        id: 21,
        code: '310100',
        name: '上海市',
        level: 2,
        parentCode: '310000',
        sortOrder: 1,
        enabled: true,
        children: [
          { id: 211, code: '310101', name: '黄浦区', level: 3, parentCode: '310100', sortOrder: 1, enabled: true },
          { id: 212, code: '310104', name: '徐汇区', level: 3, parentCode: '310100', sortOrder: 2, enabled: true },
          { id: 213, code: '310105', name: '长宁区', level: 3, parentCode: '310100', sortOrder: 3, enabled: true }
        ]
      }
    ]
  },
  {
    id: 3,
    code: '320000',
    name: '江苏省',
    level: 1,
    parentCode: '',
    sortOrder: 3,
    enabled: true,
    children: [
      {
        id: 31,
        code: '320100',
        name: '南京市',
        level: 2,
        parentCode: '320000',
        sortOrder: 1,
        enabled: true,
        children: [
          { id: 311, code: '320102', name: '玄武区', level: 3, parentCode: '320100', sortOrder: 1, enabled: true },
          { id: 312, code: '320104', name: '秦淮区', level: 3, parentCode: '320100', sortOrder: 2, enabled: true }
        ]
      },
      {
        id: 32,
        code: '320500',
        name: '苏州市',
        level: 2,
        parentCode: '320000',
        sortOrder: 2,
        enabled: true,
        children: [
          { id: 321, code: '320505', name: '虎丘区', level: 3, parentCode: '320500', sortOrder: 1, enabled: true },
          { id: 322, code: '320506', name: '吴中区', level: 3, parentCode: '320500', sortOrder: 2, enabled: true }
        ]
      }
    ]
  }
]

const filteredRegions = computed(() => {
  let result = regions.value
  
  if (filterKeyword.value) {
    const keyword = filterKeyword.value.toLowerCase()
    result = result.map(province => ({
      ...province,
      children: province.children?.map(city => ({
        ...city,
        children: city.children?.filter(district => 
          district.name.toLowerCase().includes(keyword)
        )
      })).filter(city => 
        city.name.toLowerCase().includes(keyword) || city.children?.length > 0
      )
    })).filter(province => 
      province.name.toLowerCase().includes(keyword) || province.children?.length > 0
    )
  }
  
  if (filterLevel.value) {
    result = result.map(province => ({
      ...province,
      children: province.children?.map(city => ({
        ...city,
        children: filterLevel.value === '3' ? city.children : []
      })).filter(city => filterLevel.value !== '1' && (filterLevel.value === '2' || city.children?.length > 0))
    })).filter(province => filterLevel.value === '1' || province.children?.length > 0)
  }
  
  return result
})

const provinceOptions = computed(() => {
  return regions.value.map(p => ({ code: p.code, name: p.name }))
})

const cityOptions = computed(() => {
  const options = []
  regions.value.forEach(province => {
    province.children?.forEach(city => {
      options.push({ 
        code: city.code, 
        name: city.name, 
        parentName: province.name 
      })
    })
  })
  return options
})

const loadData = () => {
  regions.value = mockRegions
}

onMounted(() => {
  loadData()
})

const toggleNode = (code) => {
  const index = expandedNodes.value.indexOf(code)
  if (index === -1) {
    expandedNodes.value.push(code)
  } else {
    expandedNodes.value.splice(index, 1)
  }
}

const expandAll = () => {
  if (expandedAll.value) {
    expandedNodes.value = []
  } else {
    const allCodes = []
    const collectCodes = (nodes) => {
      nodes.forEach(node => {
        allCodes.push(node.code)
        if (node.children) {
          collectCodes(node.children)
        }
      })
    }
    collectCodes(regions.value)
    expandedNodes.value = allCodes
  }
  expandedAll.value = !expandedAll.value
}

const openAddModal = () => {
  Object.keys(form).forEach(key => {
    form[key] = key === 'level' ? 1 : key === 'sortOrder' ? 1 : key === 'enabled' ? true : ''
  })
  modalVisible.value = true
}

const editRegion = (region) => {
  Object.assign(form, region)
  modalVisible.value = true
}

const closeModal = () => {
  modalVisible.value = false
}

const saveRegion = () => {
  if (!form.name || !form.code) {
    alert('请填写必填字段')
    return
  }

  if (form.id) {
    const updateNode = (nodes) => {
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].id === form.id) {
          nodes[i] = { ...nodes[i], ...form }
          return true
        }
        if (nodes[i].children && updateNode(nodes[i].children)) {
          return true
        }
      }
      return false
    }
    updateNode(regions.value)
    alert('地区已更新')
  } else {
    const newRegion = {
      id: Date.now(),
      ...form,
      children: []
    }
    if (form.level === 1) {
      regions.value.push(newRegion)
    } else if (form.level === 2) {
      const province = regions.value.find(p => p.code === form.parentCode)
      if (province) {
        province.children = province.children || []
        province.children.push(newRegion)
      }
    } else if (form.level === 3) {
      let found = false
      regions.value.forEach(province => {
        province.children?.forEach(city => {
          if (city.code === form.parentCode) {
            city.children = city.children || []
            city.children.push(newRegion)
            found = true
          }
        })
      })
      if (!found) {
        alert('未找到上级地区')
        return
      }
    }
    alert('地区已新增')
  }
  closeModal()
}

const deleteRegion = (region) => {
  if (region.children && region.children.length > 0) {
    alert('该地区包含子地区，无法删除')
    return
  }
  
  if (!confirm(`确定删除 "${region.name}" 吗？`)) return
  
  if (region.level === 1) {
    regions.value = regions.value.filter(p => p.id !== region.id)
  } else if (region.level === 2) {
    regions.value.forEach(province => {
      province.children = province.children?.filter(c => c.id !== region.id)
    })
  } else if (region.level === 3) {
    regions.value.forEach(province => {
      province.children?.forEach(city => {
        city.children = city.children?.filter(d => d.id !== region.id)
      })
    })
  }
  alert('地区已删除')
}
</script>

<style scoped>
.region-list {
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

.tree-container {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.tree-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
  background: #f8fafc;
}

.header-title {
  font-size: 14px;
  font-weight: 600;
  color: #2d3748;
}

.expand-all {
  font-size: 12px;
  color: #238636;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.expand-all:hover {
  background: rgba(35, 134, 54, 0.1);
}

.tree-content {
  padding: 16px;
  max-height: 600px;
  overflow-y: auto;
}

.tree-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.tree-children {
  list-style: none;
  padding: 0 0 0 24px;
  margin: 0;
}

.tree-item {
  margin: 4px 0;
}

.tree-node {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.tree-node:hover {
  background: #f8fafc;
}

.expand-icon {
  width: 16px;
  height: 16px;
  font-size: 10px;
  color: #a0aec0;
  transition: transform 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.expand-icon.expanded {
  transform: rotate(90deg);
}

.node-icon {
  margin: 0 8px;
  font-size: 14px;
}

.node-name {
  flex: 1;
  font-size: 14px;
  color: #2d3748;
}

.node-code {
  font-size: 12px;
  color: #a0aec0;
  font-family: monospace;
  margin-right: 12px;
}

.node-actions {
  display: flex;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.2s;
}

.tree-node:hover .node-actions {
  opacity: 1;
}

.action-btn {
  font-size: 11px;
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
  cursor: pointer;
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

.form-input:disabled {
  background: #f8fafc;
  color: #a0aec0;
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