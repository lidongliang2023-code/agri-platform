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
import { message } from 'ant-design-vue'
import {
  getTenantPackageList,
  createTenantPackage,
  updateTenantPackage,
  deleteTenantPackage as apiDeleteTenantPackage
} from '../../utils/api'

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

const BYTES_PER_GB = 1024 * 1024 * 1024
const toGb = (bytes) => (bytes == null ? 0 : Math.round((bytes / BYTES_PER_GB) * 10) / 10)
const toBytes = (gb) => Math.round(Number(gb || 0) * BYTES_PER_GB)

/** 服务级别与页面下拉值的对应关系（1/2/3 ↔ BASIC/STANDARD/ENTERPRISE） */
const LEVEL_TO_SUPPORT = { 1: 'BASIC', 2: 'STANDARD', 3: 'ENTERPRISE' }
const SUPPORT_TO_LEVEL = { BASIC: 1, STANDARD: 2, ENTERPRISE: 3 }
const SUPPORT_LABELS = { BASIC: '基础支持', STANDARD: '标准支持', ENTERPRISE: '7×24小时' }

/**
 * 卡片上的"功能清单"是由限额字段**派生**出来的展示项，不是独立数据。
 *
 * 接口侧只有 userLimit / orgLimit / … 这些数字，页面把它们渲染成"最大用户数: 50"这样的条目；
 * 反过来编辑时也从这些数字直接回填，不再像原来那样去解析 "存储空间: 10GB" 这种字符串
 * （那种写法一旦文案改一个字、或出现"不限"，回填就会静默变成 0）。
 */
function deriveFeatures(row) {
  const orUnlimited = (value) => (value == null || value <= 0 ? '不限' : String(value))
  return [
    { name: '最大用户数', value: orUnlimited(row.maxUsers) },
    { name: '最大组织数', value: orUnlimited(row.maxOrgs) },
    { name: '最大商品数', value: orUnlimited(row.maxProducts) },
    { name: '存储空间', value: row.maxStorage > 0 ? `${row.maxStorage}GB` : '不限' },
    { name: '每日API调用', value: orUnlimited(row.maxApiCalls) },
    // 优先用接口给的服务级别文案（工作日支持 / 7x12小时支持 / 7x24小时专属支持），
    // 拿不到才退回按级别写的通用文案
    { name: '客服支持', value: row.serviceLevelDesc || SUPPORT_LABELS[row.supportLevel] || '—' }
  ]
}

const loadPackages = async () => {
  try {
    const response = await getTenantPackageList()
    if (response.code !== 200) {
      message.error(response.message || '加载套餐失败')
      packageList.value = []
      return
    }
    // 不再回落到演示数据：失败就说失败
    packageList.value = (response.data ?? []).map(row => {
      const item = {
        id: row.id,
        name: row.packageName,
        // 套餐编码即页面上的"类型"（BASE/PRO/ENTERPRISE），卡片配色也用这个值
        type: (row.packageCode || '').toUpperCase(),
        price: row.price,
        // 价格单位由有效期推导：365 天按"年"，其余按"月"
        priceUnit: (row.duration ?? 0) >= 365 ? '年' : '月',
        maxUsers: row.userLimit ?? 0,
        maxOrgs: row.orgLimit ?? 0,
        maxProducts: row.productLimit ?? 0,
        maxStorage: toGb(row.storageLimit),
        maxApiCalls: row.apiLimit ?? 0,
        supportLevel: LEVEL_TO_SUPPORT[row.serviceLevel] ?? 'BASIC',
        serviceLevelDesc: row.serviceLevelDesc
      }
      item.features = deriveFeatures(item)
      return item
    })
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载套餐失败')
    packageList.value = []
  }
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
  // 直接从数值字段回填，不从 features 的展示文案里反解（含"不限"时反解会静默变成 0）
  form.maxUsers = pkg.maxUsers
  form.maxOrgs = pkg.maxOrgs
  form.maxProducts = pkg.maxProducts
  form.maxStorage = pkg.maxStorage
  form.maxApiCalls = pkg.maxApiCalls
  form.supportLevel = pkg.supportLevel
  showAddModal.value = true
}

const deletePackage = async (pkg) => {
  if (!confirm(`确定删除套餐 "${pkg.name}" 吗？`)) {
    return
  }
  try {
    const response = await apiDeleteTenantPackage(pkg.id)
    if (response.code === 200) {
      message.success('套餐已删除')
      loadPackages()
    } else {
      message.error(response.message || '删除失败')
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '删除失败')
  }
}

const savePackage = async () => {
  if (!form.name || form.price <= 0) {
    message.warning('请填写完整的套餐信息')
    return
  }

  const payload = {
    packageCode: form.type,
    packageName: form.name,
    packageDesc: `${form.name}（${form.priceUnit}付）`,
    userLimit: Number(form.maxUsers) || 0,
    orgLimit: Number(form.maxOrgs) || 0,
    productLimit: Number(form.maxProducts) || 0,
    // 输入框是 GB，接口要字节：漏了这一行会把 10GB 存成 10 字节
    storageLimit: toBytes(form.maxStorage),
    apiLimit: Number(form.maxApiCalls) || 0,
    serviceLevel: SUPPORT_TO_LEVEL[form.supportLevel] ?? 1,
    price: Number(form.price) || 0,
    // 价格单位反向映射成有效期天数（年→365，月→30）
    duration: form.priceUnit === '年' ? 365 : 30
  }

  try {
    const response = isEdit.value
      ? await updateTenantPackage(form.id, payload)
      : await createTenantPackage(payload)
    if (response.code === 200) {
      message.success(isEdit.value ? '套餐已更新' : '套餐已创建')
      closeAddModal()
      loadPackages()
    } else {
      message.error(response.message || '保存失败')
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败')
  }
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
