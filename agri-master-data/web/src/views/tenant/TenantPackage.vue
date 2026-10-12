<template>
  <div class="tenant-package">
    <div class="page-header">
      <div class="header-left">
        <h1>租户套餐配置</h1>
        <p>管理租户套餐定义与定价</p>
      </div>
      <button class="add-btn" @click="showAddModal = true">+ 新建套餐</button>
    </div>

    <div class="package-grid">
      <div class="package-card" v-for="pkg in packageList" :key="pkg.id">
        <div class="package-header" :class="pkg.type.toLowerCase()">
          <h3>{{ pkg.name }}</h3>
          <span class="package-tag">{{ pkg.type === 'BASE' ? '基础版' : pkg.type === 'PRO' ? '专业版' : '企业版' }}</span>
        </div>
        <div class="package-price">
          <span class="price-symbol">¥</span>
          <span class="price-value">{{ pkg.price }}</span>
          <span class="price-unit">/{{ pkg.priceUnit }}</span>
        </div>
        <div class="package-features">
          <div class="feature-item" v-for="feature in pkg.features" :key="feature.name">
            <span class="feature-check">✓</span>
            <span class="feature-text">{{ feature.name }}: {{ feature.value }}</span>
          </div>
        </div>
        <div class="package-footer">
          <button class="footer-btn" @click="editPackage(pkg)">编辑</button>
          <button class="footer-btn delete" @click="deletePackage(pkg)">删除</button>
        </div>
      </div>
    </div>

    <div class="modal-overlay" v-if="showAddModal" @click="closeAddModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ isEdit ? '编辑套餐' : '新建套餐' }}</h3>
          <button class="close-btn" @click="closeAddModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>套餐名称</label>
            <input type="text" v-model="form.name" class="form-input" placeholder="请输入套餐名称" />
          </div>
          <div class="form-group">
            <label>套餐类型</label>
            <select v-model="form.type" class="form-input">
              <option value="BASE">基础版</option>
              <option value="PRO">专业版</option>
              <option value="ENTERPRISE">企业版</option>
            </select>
          </div>
          <div class="form-group">
            <label>价格(元)</label>
            <input type="number" v-model="form.price" class="form-input" placeholder="请输入价格" />
          </div>
          <div class="form-group">
            <label>价格单位</label>
            <select v-model="form.priceUnit" class="form-input">
              <option value="月">月</option>
              <option value="年">年</option>
            </select>
          </div>
          <div class="form-group">
            <label>最大用户数</label>
            <input type="number" v-model="form.maxUsers" class="form-input" placeholder="请输入最大用户数" />
          </div>
          <div class="form-group">
            <label>最大组织数</label>
            <input type="number" v-model="form.maxOrgs" class="form-input" placeholder="请输入最大组织数" />
          </div>
          <div class="form-group">
            <label>最大商品数</label>
            <input type="number" v-model="form.maxProducts" class="form-input" placeholder="请输入最大商品数" />
          </div>
          <div class="form-group">
            <label>存储容量(GB)</label>
            <input type="number" v-model="form.maxStorage" class="form-input" placeholder="请输入存储容量" />
          </div>
          <div class="form-group">
            <label>每日API调用次数</label>
            <input type="number" v-model="form.maxApiCalls" class="form-input" placeholder="请输入API调用次数" />
          </div>
          <div class="form-group">
            <label>客服支持</label>
            <select v-model="form.supportLevel" class="form-input">
              <option value="BASIC">基础支持</option>
              <option value="STANDARD">标准支持</option>
              <option value="ENTERPRISE">7×24小时支持</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="closeAddModal">取消</button>
          <button class="btn btn-primary" @click="savePackage">{{ isEdit ? '保存修改' : '创建套餐' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'

const showAddModal = ref(false)
const isEdit = ref(false)

const form = reactive({
  id: null,
  name: '',
  type: 'BASE',
  price: 0,
  priceUnit: '月',
  maxUsers: 0,
  maxOrgs: 0,
  maxProducts: 0,
  maxStorage: 0,
  maxApiCalls: 0,
  supportLevel: 'BASIC'
})

const packageList = ref([])

const mockPackages = [
  {
    id: 1,
    name: '基础版',
    type: 'BASE',
    price: 199,
    priceUnit: '月',
    features: [
      { name: '最大用户数', value: '50' },
      { name: '最大组织数', value: '5' },
      { name: '最大商品数', value: '500' },
      { name: '存储空间', value: '10GB' },
      { name: '每日API调用', value: '10,000次' },
      { name: '客服支持', value: '基础支持' }
    ]
  },
  {
    id: 2,
    name: '专业版',
    type: 'PRO',
    price: 599,
    priceUnit: '月',
    features: [
      { name: '最大用户数', value: '500' },
      { name: '最大组织数', value: '50' },
      { name: '最大商品数', value: '5,000' },
      { name: '存储空间', value: '100GB' },
      { name: '每日API调用', value: '100,000次' },
      { name: '客服支持', value: '标准支持' }
    ]
  },
  {
    id: 3,
    name: '企业版',
    type: 'ENTERPRISE',
    price: 1999,
    priceUnit: '月',
    features: [
      { name: '最大用户数', value: '不限' },
      { name: '最大组织数', value: '不限' },
      { name: '最大商品数', value: '不限' },
      { name: '存储空间', value: '500GB' },
      { name: '每日API调用', value: '不限' },
      { name: '客服支持', value: '7×24小时' }
    ]
  }
]

const loadPackages = () => {
  packageList.value = mockPackages
}

onMounted(() => {
  loadPackages()
})

const closeAddModal = () => {
  showAddModal.value = false
  isEdit.value = false
  Object.keys(form).forEach(key => {
    form[key] = key === 'type' ? 'BASE' : key === 'priceUnit' ? '月' : key === 'supportLevel' ? 'BASIC' : 0
  })
}

const editPackage = (pkg) => {
  isEdit.value = true
  form.id = pkg.id
  form.name = pkg.name
  form.type = pkg.type
  form.price = pkg.price
  form.priceUnit = pkg.priceUnit
  pkg.features.forEach(f => {
    if (f.name === '最大用户数') form.maxUsers = parseInt(f.value) || 0
    if (f.name === '最大组织数') form.maxOrgs = parseInt(f.value) || 0
    if (f.name === '最大商品数') form.maxProducts = parseInt(f.value.replace(',', '')) || 0
    if (f.name === '存储空间') form.maxStorage = parseInt(f.value) || 0
    if (f.name === '每日API调用') form.maxApiCalls = parseInt(f.value.replace(',', '')) || 0
    if (f.name === '客服支持') form.supportLevel = f.value === '基础支持' ? 'BASIC' : f.value === '标准支持' ? 'STANDARD' : 'ENTERPRISE'
  })
  showAddModal.value = true
}

const deletePackage = (pkg) => {
  if (confirm(`确定删除套餐 "${pkg.name}" 吗？`)) {
    packageList.value = packageList.value.filter(p => p.id !== pkg.id)
    alert('套餐已删除')
  }
}

const savePackage = () => {
  if (!form.name || form.price <= 0) {
    alert('请填写完整的套餐信息')
    return
  }
  
  const features = [
    { name: '最大用户数', value: form.maxUsers > 0 ? form.maxUsers.toString() : '不限' },
    { name: '最大组织数', value: form.maxOrgs > 0 ? form.maxOrgs.toString() : '不限' },
    { name: '最大商品数', value: form.maxProducts > 0 ? form.maxProducts.toString() : '不限' },
    { name: '存储空间', value: form.maxStorage > 0 ? form.maxStorage + 'GB' : '不限' },
    { name: '每日API调用', value: form.maxApiCalls > 0 ? form.maxApiCalls.toString() : '不限' },
    { name: '客服支持', value: form.supportLevel === 'BASIC' ? '基础支持' : form.supportLevel === 'STANDARD' ? '标准支持' : '7×24小时' }
  ]

  if (isEdit.value) {
    const index = packageList.value.findIndex(p => p.id === form.id)
    if (index !== -1) {
      packageList.value[index] = {
        ...packageList.value[index],
        name: form.name,
        type: form.type,
        price: form.price,
        priceUnit: form.priceUnit,
        features
      }
    }
    alert('套餐已更新')
  } else {
    packageList.value.push({
      id: Date.now(),
      name: form.name,
      type: form.type,
      price: form.price,
      priceUnit: form.priceUnit,
      features
    })
    alert('套餐已创建')
  }
  closeAddModal()
}
</script>

<style scoped>
.tenant-package {
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

.package-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 20px;
}

.package-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  transition: all 0.3s;
}

.package-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.package-header {
  padding: 20px;
  color: #fff;
}

.package-header.base {
  background: linear-gradient(135deg, #6b7280 0%, #9ca3af 100%);
}

.package-header.pro {
  background: linear-gradient(135deg, #238636 0%, #2ea043 100%);
}

.package-header.enterprise {
  background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
}

.package-header h3 {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 8px;
}

.package-tag {
  display: inline-block;
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  font-size: 12px;
}

.package-price {
  padding: 20px;
  text-align: center;
  border-bottom: 1px solid #f0f0f0;
}

.price-symbol {
  font-size: 20px;
  color: #4a5568;
}

.price-value {
  font-size: 48px;
  font-weight: 700;
  color: #2d3748;
}

.price-unit {
  font-size: 16px;
  color: #a0aec0;
}

.package-features {
  padding: 20px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
}

.feature-check {
  color: #238636;
  font-weight: bold;
}

.feature-text {
  font-size: 14px;
  color: #4a5568;
}

.package-footer {
  display: flex;
  gap: 10px;
  padding: 16px 20px;
  background: #f8fafc;
}

.footer-btn {
  flex: 1;
  padding: 10px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  color: #4a5568;
  background: #fff;
  cursor: pointer;
  transition: all 0.2s;
}

.footer-btn:hover {
  background: #f0f0f0;
}

.footer-btn.delete {
  border-color: #f87171;
  color: #dc2626;
}

.footer-btn.delete:hover {
  background: rgba(239, 68, 68, 0.1);
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
  position: sticky;
  top: 0;
  background: #fff;
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