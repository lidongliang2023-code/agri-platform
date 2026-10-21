<template>
  <div class="tenant-quota">
    <div class="page-header">
      <div class="header-left">
        <h1>主体配额管理</h1>
        <p>管理主体资源配额配置</p>
      </div>
    </div>

    <div class="search-bar">
      <div class="search-group">
        <input
          type="text"
          v-model="searchForm.keyword"
          placeholder="搜索主体名称..."
          class="search-input"
        />
        <button class="search-btn" @click="handleSearch">搜索</button>
      </div>
    </div>

    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>主体名称</th>
            <th>主体类型</th>
            <th>用户配额</th>
            <th>组织配额</th>
            <th>商品配额</th>
            <th>存储配额</th>
            <th>API配额</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="tenant in tenantList" :key="tenant.id">
            <td class="name-cell">
              <span class="tenant-icon">🏢</span>
              <span class="tenant-name">{{ tenant.name }}</span>
            </td>
            <td>{{ tenantTypeLabel(tenant.type) }}</td>
            <td>
              <template v-if="tenant.hasQuota">
              <div class="quota-bar">
                <div class="quota-fill" :style="{width: tenant.userUsagePercent + '%'}"></div>
              </div>
              <span class="quota-text">{{ tenant.userUsed }} / {{ tenant.userLimit }}</span>
              </template>
              <span v-else class="quota-empty">未配置配额</span>
            </td>
            <td>
              <template v-if="tenant.hasQuota">
              <div class="quota-bar">
                <div class="quota-fill" :style="{width: tenant.orgUsagePercent + '%'}"></div>
              </div>
              <span class="quota-text">{{ tenant.orgUsed }} / {{ tenant.orgLimit }}</span>
              </template>
              <span v-else class="quota-empty">—</span>
            </td>
            <td>
              <template v-if="tenant.hasQuota">
              <div class="quota-bar">
                <div class="quota-fill" :style="{width: tenant.productUsagePercent + '%'}"></div>
              </div>
              <span class="quota-text">{{ tenant.productUsed }} / {{ tenant.productLimit }}</span>
              </template>
              <span v-else class="quota-empty">—</span>
            </td>
            <td>
              <template v-if="tenant.hasQuota">
              <div class="quota-bar">
                <div class="quota-fill" :style="{width: tenant.storageUsagePercent + '%'}"></div>
              </div>
              <span class="quota-text">{{ tenant.storageUsed }}GB / {{ tenant.storageLimit }}GB</span>
              </template>
              <span v-else class="quota-empty">—</span>
            </td>
            <td>
              <template v-if="tenant.hasQuota">
              <div class="quota-bar">
                <div class="quota-fill" :style="{width: tenant.apiUsagePercent + '%'}"></div>
              </div>
              <span class="quota-text">{{ tenant.apiUsed }} / {{ tenant.apiLimit }}</span>
              </template>
              <span v-else class="quota-empty">—</span>
            </td>
            <td class="action-cell">
              <button class="action-btn edit" @click="editQuota(tenant)">编辑配额</button>
              <button class="action-btn" @click="viewQuotaDetail(tenant)">查看详情</button>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="pagination">
        <button class="page-btn" :disabled="currentPage === 1" @click="prevPage">上一页</button>
        <span class="page-info">第 {{ currentPage }} / {{ totalPages }} 页</span>
        <button class="page-btn" :disabled="currentPage === totalPages" @click="nextPage">下一页</button>
      </div>
    </div>

    <div class="modal-overlay" v-if="showEditModal" @click="closeEditModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>编辑主体配额</h3>
          <button class="close-btn" @click="closeEditModal">×</button>
        </div>
        <div class="modal-body" v-if="editForm">
          <div class="form-group">
            <label>主体名称</label>
            <input type="text" :value="editForm.name" disabled class="form-input" />
          </div>
          <div class="form-group">
            <label>用户配额</label>
            <input type="number" v-model="editForm.userLimit" class="form-input" />
          </div>
          <div class="form-group">
            <label>组织配额</label>
            <input type="number" v-model="editForm.orgLimit" class="form-input" />
          </div>
          <div class="form-group">
            <label>商品配额</label>
            <input type="number" v-model="editForm.productLimit" class="form-input" />
          </div>
          <div class="form-group">
            <label>存储配额(GB)</label>
            <input type="number" v-model="editForm.storageLimit" class="form-input" />
          </div>
          <div class="form-group">
            <label>API配额(次/日)</label>
            <input type="number" v-model="editForm.apiLimit" class="form-input" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="closeEditModal">取消</button>
          <button class="btn btn-primary" @click="saveQuota">保存配置</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { getTenantQuotaOverview, adjustTenantQuota } from '../../utils/api'

/**
 * 存储配额的接口单位是**字节**（与 TenantPackageVO 一致），页面按 GB 展示与录入。
 *
 * 换算必须写在一处并双向使用：接口给字节、输入框收 GB，
 * 只要有一边忘了换算，"10 GB" 就会存成 10 字节，而页面上看起来完全正常。
 */
const BYTES_PER_GB = 1024 * 1024 * 1024
const toGb = (bytes) => (bytes == null ? 0 : Math.round((bytes / BYTES_PER_GB) * 10) / 10)
const toBytes = (gb) => Math.round(Number(gb || 0) * BYTES_PER_GB)

/** 主体类型展示名。原来只判断 ENTERPRISE/其它两种，合作社与个体经营都会被显示成"个人主体"。 */
const TENANT_TYPE_LABELS = {
  ENTERPRISE: '企业主体',
  COOPERATIVE: '合作社',
  INDIVIDUAL: '个体经营',
  FARM: '农场',
}
const tenantTypeLabel = (type) => TENANT_TYPE_LABELS[type] ?? (type || '—')

const searchForm = reactive({
  keyword: ''
})

const tenantList = ref([])
const currentPage = ref(1)
const totalCount = ref(0)
const totalPages = ref(1)

const showEditModal = ref(false)
const editForm = reactive({
  id: null,
  name: '',
  userLimit: 0,
  orgLimit: 0,
  productLimit: 0,
  storageLimit: 0,
  apiLimit: 0
})

const calculateUsagePercent = (used, limit) => {
  // 限额为 0（或缺失）时不算"100% 用满"，而是 0 —— 否则"未配置"会画成一根满格红条
  if (!limit) return 0
  return Math.min((used / limit) * 100, 100)
}

const loadTenants = async () => {
  try {
    const response = await getTenantQuotaOverview({
      pageNum: currentPage.value,
      pageSize: 10,
      keyword: searchForm.keyword
    })
    if (response.code !== 200) {
      message.error(response.message || '加载配额数据失败')
      tenantList.value = []
      totalCount.value = 0
      totalPages.value = 1
      return
    }
    // 不再回落到演示数据：接口失败就说失败，否则满屏数字看着正常、其实一条不是真的
    tenantList.value = (response.data.list ?? []).map(row => {
      const item = {
        id: row.id,
        name: row.tenantName,
        code: row.tenantCode,
        type: row.tenantType,
        hasQuota: row.hasQuota === true,
        userUsed: row.userUsed ?? 0,
        userLimit: row.userLimit ?? 0,
        orgUsed: row.orgUsed ?? 0,
        orgLimit: row.orgLimit ?? 0,
        productUsed: row.productUsed ?? 0,
        productLimit: row.productLimit ?? 0,
        storageUsed: toGb(row.storageUsed),
        storageLimit: toGb(row.storageLimit),
        apiUsed: row.apiUsed ?? 0,
        apiLimit: row.apiLimit ?? 0
      }
      item.userUsagePercent = calculateUsagePercent(item.userUsed, item.userLimit)
      item.orgUsagePercent = calculateUsagePercent(item.orgUsed, item.orgLimit)
      item.productUsagePercent = calculateUsagePercent(item.productUsed, item.productLimit)
      item.storageUsagePercent = calculateUsagePercent(item.storageUsed, item.storageLimit)
      item.apiUsagePercent = calculateUsagePercent(item.apiUsed, item.apiLimit)
      return item
    })
    totalCount.value = response.data.total ?? 0
    totalPages.value = Math.max(1, Math.ceil(totalCount.value / 10))
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载配额数据失败')
    tenantList.value = []
    totalCount.value = 0
    totalPages.value = 1
  }
}

onMounted(() => {
  loadTenants()
})

const handleSearch = () => {
  currentPage.value = 1
  loadTenants()
}

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
    loadTenants()
  }
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    loadTenants()
  }
}

const editQuota = (tenant) => {
  Object.assign(editForm, {
    id: tenant.id,
    name: tenant.name,
    userLimit: tenant.userLimit,
    orgLimit: tenant.orgLimit,
    productLimit: tenant.productLimit,
    storageLimit: tenant.storageLimit,
    apiLimit: tenant.apiLimit
  })
  showEditModal.value = true
}

const closeEditModal = () => {
  showEditModal.value = false
  Object.keys(editForm).forEach(key => editForm[key] = null)
}

const saveQuota = () => {
  void (async () => {
    try {
      const response = await adjustTenantQuota(editForm.id, {
        userLimit: Number(editForm.userLimit) || 0,
        orgLimit: Number(editForm.orgLimit) || 0,
        productLimit: Number(editForm.productLimit) || 0,
        // 输入框是 GB，接口要字节：这一行漏了就会把 10GB 存成 10 字节
        storageLimit: toBytes(editForm.storageLimit),
        apiLimit: Number(editForm.apiLimit) || 0,
        reason: '运营端手工调整'
      })
      if (response.code === 200) {
        message.success('配额配置已更新')
        closeEditModal()
        loadTenants()
      } else {
        message.error(response.message || '保存失败')
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败')
    }
  })()
}

const viewQuotaDetail = (tenant) => {
  if (!tenant.hasQuota) {
    Modal.info({
      title: `主体 ${tenant.name}`,
      content: '该主体尚未配置配额记录。可在「编辑配额」中补齐各项限额。'
    })
    return
  }
  Modal.info({
    title: `主体 ${tenant.name} 的配额用量`,
    content: [
      `用户：${tenant.userUsed} / ${tenant.userLimit}（${tenant.userUsagePercent.toFixed(1)}%）`,
      `组织：${tenant.orgUsed} / ${tenant.orgLimit}（${tenant.orgUsagePercent.toFixed(1)}%）`,
      `商品：${tenant.productUsed} / ${tenant.productLimit}（${tenant.productUsagePercent.toFixed(1)}%）`,
      `存储：${tenant.storageUsed} GB / ${tenant.storageLimit} GB（${tenant.storageUsagePercent.toFixed(1)}%）`,
      `API：${tenant.apiUsed} / ${tenant.apiLimit}（${tenant.apiUsagePercent.toFixed(1)}%）`
      // 用「；」连接而不是换行符：antd 的 content 按纯文本渲染，\n 不会断行
    ].join('；')
  })
}
</script>

<style scoped>
.tenant-quota {
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

.name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tenant-icon {
  font-size: 18px;
}

.tenant-name {
  font-weight: 500;
}

.quota-bar {
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 4px;
}

.quota-fill {
  height: 100%;
  background: linear-gradient(90deg, #238636, #2ea043);
  border-radius: 4px;
  transition: width 0.3s;
}

.quota-text {
  font-size: 12px;
  color: #718096;
}

/* "未配置配额"：与"配额为 0"区分开，后者看起来像是被限死了 */
.quota-empty {
  font-size: 12px;
  color: #c0c4cc;
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

.action-btn.edit {
  background: rgba(210, 153, 34, 0.1);
  color: #d29922;
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
