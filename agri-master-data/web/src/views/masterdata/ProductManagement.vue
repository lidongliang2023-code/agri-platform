<template>
  <div class="product-management">
    <div class="page-header">
      <div class="header-left">
        <h1>商品管理</h1>
        <p>管理商品主数据信息</p>
      </div>
      <div class="header-right">
        <button class="btn btn-primary" @click="openCreateModal">新建商品</button>
      </div>
    </div>

    <div class="filter-section">
      <div class="search-box">
        <input type="text" v-model="searchKeyword" placeholder="搜索商品名称或编码..." class="search-input" />
        <button class="search-btn" @click="handleSearch">搜索</button>
      </div>
      <div class="filter-group">
        <select v-model="categoryFilter" class="filter-select">
          <option value="">全部分类</option>
          <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
        </select>
        <select v-model="statusFilter" class="filter-select">
          <option value="">全部状态</option>
          <option value="pending">待审核</option>
          <option value="approved">已通过</option>
          <option value="rejected">已拒绝</option>
        </select>
      </div>
    </div>

    <div class="main-content">
      <div class="category-tree">
        <h3>商品分类</h3>
        <ul class="tree-list">
          <li v-for="cat in categories" :key="cat.id">
            <div 
              class="tree-item" 
              :class="{ active: categoryFilter === cat.id }"
              @click="categoryFilter = cat.id"
            >
              <span>{{ cat.icon }}</span>
              <span>{{ cat.name }}</span>
              <span class="cat-count">{{ cat.count }}</span>
            </div>
            <ul v-if="cat.children" class="sub-tree">
              <li v-for="sub in cat.children" :key="sub.id">
                <div 
                  class="tree-item sub"
                  :class="{ active: categoryFilter === sub.id }"
                  @click="categoryFilter = sub.id"
                >
                  <span>{{ sub.name }}</span>
                  <span class="cat-count">{{ sub.count }}</span>
                </div>
              </li>
            </ul>
          </li>
        </ul>
      </div>

      <div class="product-list">
        <div class="list-header">
          <span class="list-title">商品列表</span>
          <span class="list-count">共 {{ filteredProducts.length }} 件商品</span>
        </div>
        <div class="product-grid">
          <div v-for="product in filteredProducts" :key="product.id" class="product-card">
            <div class="product-image">
              <span class="image-icon">{{ product.icon }}</span>
            </div>
            <div class="product-info">
              <h4>{{ product.name }}</h4>
              <p class="product-code">{{ product.code }}</p>
              <p class="product-desc">{{ product.description }}</p>
              <div class="product-meta">
                <span class="product-category">{{ getCategoryName(product.categoryId) }}</span>
                <span :class="['product-status', product.status]">{{ getStatusLabel(product.status) }}</span>
              </div>
            </div>
            <div class="product-actions">
              <button class="action-btn" @click="viewProduct(product)">查看</button>
              <button class="action-btn edit" @click="editProduct(product)">编辑</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-overlay" v-if="modalVisible" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ isEdit ? '编辑商品' : '新建商品' }}</h3>
          <button class="close-btn" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group">
              <label>商品名称</label>
              <input type="text" v-model="formData.name" class="form-input" placeholder="请输入商品名称" />
            </div>
            <div class="form-group">
              <label>商品编码</label>
              <input type="text" v-model="formData.code" class="form-input" placeholder="请输入商品编码" />
            </div>
          </div>
          <div class="form-group">
            <label>商品分类</label>
            <select v-model="formData.categoryId" class="form-select">
              <option value="">请选择分类</option>
              <option v-for="cat in allCategories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>品牌</label>
            <input type="text" v-model="formData.brand" class="form-input" placeholder="请输入品牌名称" />
          </div>
          <div class="form-group">
            <label>商品描述</label>
            <textarea v-model="formData.description" class="form-textarea" placeholder="请输入商品描述"></textarea>
          </div>
          <div class="form-group">
            <label>规格属性</label>
            <div class="spec-grid">
              <div class="spec-item">
                <input type="text" v-model="formData.specs.weight" placeholder="重量" class="spec-input" />
              </div>
              <div class="spec-item">
                <input type="text" v-model="formData.specs.size" placeholder="尺寸" class="spec-input" />
              </div>
              <div class="spec-item">
                <input type="text" v-model="formData.specs.color" placeholder="颜色" class="spec-input" />
              </div>
              <div class="spec-item">
                <input type="text" v-model="formData.specs.material" placeholder="材质" class="spec-input" />
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="closeModal">取消</button>
          <button class="btn btn-primary" @click="saveProduct">{{ isEdit ? '保存修改' : '创建商品' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'

const searchKeyword = ref('')
const categoryFilter = ref('')
const statusFilter = ref('')
const modalVisible = ref(false)
const isEdit = ref(false)

const formData = reactive({
  name: '',
  code: '',
  categoryId: '',
  brand: '',
  description: '',
  specs: {
    weight: '',
    size: '',
    color: '',
    material: ''
  }
})

const categories = ref([
  { 
    id: 'grain', 
    name: '粮油', 
    icon: '🌾', 
    count: 125,
    children: [
      { id: 'rice', name: '大米', count: 45 },
      { id: 'oil', name: '食用油', count: 38 },
      { id: 'flour', name: '面粉', count: 42 }
    ]
  },
  { 
    id: 'vegetable', 
    name: '蔬菜', 
    icon: '🥬', 
    count: 89,
    children: [
      { id: 'leafy', name: '叶菜类', count: 35 },
      { id: 'root', name: '根茎类', count: 28 },
      { id: 'mushroom', name: '菌菇类', count: 26 }
    ]
  },
  { 
    id: 'fruit', 
    name: '水果', 
    icon: '🍎', 
    count: 67,
    children: [
      { id: 'domestic', name: '国产水果', count: 32 },
      { id: 'imported', name: '进口水果', count: 35 }
    ]
  },
  { 
    id: 'meat', 
    name: '肉类', 
    icon: '🥩', 
    count: 54,
    children: [
      { id: 'pork', name: '猪肉', count: 22 },
      { id: 'beef', name: '牛肉', count: 18 },
      { id: 'poultry', name: '禽类', count: 14 }
    ]
  }
])

const allCategories = computed(() => {
  const result = []
  const flatten = (cats) => {
    cats.forEach(cat => {
      result.push({ id: cat.id, name: cat.name })
      if (cat.children) flatten(cat.children)
    })
  }
  flatten(categories.value)
  return result
})

const mockProducts = ref([
  { id: 1, name: '有机大米', code: 'SPU-001', categoryId: 'rice', brand: '农谷', description: '优质有机大米，口感软糯', icon: '🍚', status: 'approved', specs: { weight: '5kg', size: '', color: '', material: '' } },
  { id: 2, name: '菜籽油', code: 'SPU-002', categoryId: 'oil', brand: '农家', description: '纯正菜籽油，香味浓郁', icon: '🫒', status: 'approved', specs: { weight: '1.8L', size: '', color: '金黄色', material: '' } },
  { id: 3, name: '小麦面粉', code: 'SPU-003', categoryId: 'flour', brand: '丰收', description: '高筋小麦粉，适合烘焙', icon: '🍞', status: 'pending', specs: { weight: '2.5kg', size: '', color: '', material: '' } },
  { id: 4, name: '有机蔬菜礼盒', code: 'SPU-004', categoryId: 'leafy', brand: '田园', description: '精选有机蔬菜组合', icon: '🥗', status: 'approved', specs: { weight: '3kg', size: '', color: '', material: '' } },
  { id: 5, name: '土鸡蛋', code: 'SPU-005', categoryId: 'poultry', brand: '农家', description: '散养土鸡蛋，营养丰富', icon: '🥚', status: 'approved', specs: { weight: '30枚', size: '', color: '棕色', material: '' } },
  { id: 6, name: '进口车厘子', code: 'SPU-006', categoryId: 'imported', brand: '智利', description: '智利进口车厘子', icon: '🍒', status: 'pending', specs: { weight: '500g', size: '', color: '深红色', material: '' } },
  { id: 7, name: '有机猪肉', code: 'SPU-007', categoryId: 'pork', brand: '绿源', description: '有机养殖猪肉', icon: '🥓', status: 'rejected', specs: { weight: '1kg', size: '', color: '', material: '' } },
  { id: 8, name: '新鲜香菇', code: 'SPU-008', categoryId: 'mushroom', brand: '山野', description: '新鲜采摘香菇', icon: '🍄', status: 'approved', specs: { weight: '250g', size: '', color: '', material: '' } }
])

const filteredProducts = computed(() => {
  return mockProducts.value.filter(product => {
    const matchKeyword = !searchKeyword.value || 
      product.name.includes(searchKeyword.value) ||
      product.code.includes(searchKeyword.value)
    const matchCategory = !categoryFilter.value || product.categoryId === categoryFilter.value || 
      categories.value.some(cat => cat.id === categoryFilter.value && 
        cat.children?.some(sub => sub.id === product.categoryId))
    const matchStatus = !statusFilter.value || product.status === statusFilter.value
    return matchKeyword && matchCategory && matchStatus
  })
})

const getCategoryName = (categoryId) => {
  const findCategory = (cats) => {
    for (const cat of cats) {
      if (cat.id === categoryId) return cat.name
      if (cat.children) {
        const found = findCategory(cat.children)
        if (found) return found
      }
    }
    return categoryId
  }
  return findCategory(categories.value)
}

const getStatusLabel = (status) => {
  const labels = { pending: '待审核', approved: '已通过', rejected: '已拒绝' }
  return labels[status] || status
}

const handleSearch = () => {}

const openCreateModal = () => {
  isEdit.value = false
  formData.name = ''
  formData.code = ''
  formData.categoryId = ''
  formData.brand = ''
  formData.description = ''
  formData.specs = { weight: '', size: '', color: '', material: '' }
  modalVisible.value = true
}

const editProduct = (product) => {
  isEdit.value = true
  formData.name = product.name
  formData.code = product.code
  formData.categoryId = product.categoryId
  formData.brand = product.brand
  formData.description = product.description
  formData.specs = { ...product.specs }
  modalVisible.value = true
}

const viewProduct = (product) => {
  alert(`查看商品: ${product.name}`)
}

const saveProduct = () => {
  if (!formData.name || !formData.code) {
    alert('请填写必填字段')
    return
  }
  if (isEdit.value) {
    alert('商品信息已更新')
  } else {
    alert('商品创建成功，等待审核')
  }
  closeModal()
}

const closeModal = () => {
  modalVisible.value = false
}

onMounted(() => {})
</script>

<style scoped>
.product-management {
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

.filter-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 16px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
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

.main-content {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 20px;
}

.category-tree {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.category-tree h3 {
  font-size: 14px;
  font-weight: 600;
  color: #2d3748;
  margin: 0 0 16px;
}

.tree-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.tree-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
  font-size: 14px;
  color: #2d3748;
}

.tree-item:hover {
  background: #f8fafc;
}

.tree-item.active {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.tree-item.sub {
  padding-left: 24px;
  font-size: 13px;
}

.cat-count {
  margin-left: auto;
  font-size: 12px;
  color: #a0aec0;
  background: #f0f0f0;
  padding: 2px 8px;
  border-radius: 10px;
}

.sub-tree {
  list-style: none;
  padding: 0;
  margin: 4px 0 8px;
}

.product-list {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.list-title {
  font-size: 14px;
  font-weight: 600;
  color: #2d3748;
}

.list-count {
  font-size: 13px;
  color: #a0aec0;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.product-card {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 10px;
  transition: all 0.2s;
}

.product-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.product-image {
  width: 80px;
  height: 80px;
  background: #fff;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-icon {
  font-size: 40px;
}

.product-info {
  flex: 1;
}

.product-info h4 {
  font-size: 15px;
  font-weight: 600;
  color: #2d3748;
  margin: 0 0 4px;
}

.product-code {
  font-size: 12px;
  color: #a0aec0;
  margin: 0 0 6px;
}

.product-desc {
  font-size: 13px;
  color: #4a5568;
  margin: 0 0 10px;
  line-height: 1.4;
}

.product-meta {
  display: flex;
  gap: 10px;
}

.product-category {
  font-size: 11px;
  padding: 4px 10px;
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
  border-radius: 12px;
}

.product-status {
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 12px;
  font-weight: 500;
}

.product-status.pending {
  background: rgba(210, 153, 34, 0.1);
  color: #d29922;
}

.product-status.approved {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.product-status.rejected {
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
}

.product-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-btn {
  padding: 8px 16px;
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}

.action-btn.edit {
  background: rgba(210, 153, 34, 0.1);
  color: #d29922;
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

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
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

.form-textarea {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  min-height: 80px;
  resize: vertical;
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

.spec-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.spec-input {
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 13px;
  outline: none;
  width: 100%;
  box-sizing: border-box;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid #f0f0f0;
}
</style>