<template>
  <div class="user-data-query">
    <div class="page-header">
      <h1>数据查询</h1>
      <p>查询和浏览主数据信息</p>
    </div>

    <div class="query-section">
      <div class="query-tabs">
        <button 
          v-for="tab in dataTabs" 
          :key="tab.key"
          :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>

      <div class="filter-bar">
        <div class="search-group">
          <select v-model="searchForm.type" class="search-select">
            <option value="">全部字段</option>
            <option value="name">名称</option>
            <option value="code">编码</option>
            <option value="id">ID</option>
          </select>
          <input 
            type="text" 
            v-model="searchForm.keyword" 
            placeholder="输入搜索关键词..." 
            class="search-input"
            @keyup.enter="handleSearch"
          />
          <button class="search-btn" @click="handleSearch">搜索</button>
        </div>
        <button class="export-btn" @click="handleExport">📥 导出数据</button>
      </div>
    </div>

    <div class="result-section">
      <div class="result-header">
        <span class="result-count">共 {{ tableData.length }} 条记录</span>
        <div class="result-actions">
          <button class="refresh-btn" @click="handleRefresh">🔄 刷新</button>
        </div>
      </div>

      <div class="data-table">
        <table>
          <thead>
            <tr>
              <th v-for="col in tableColumns" :key="col.key">{{ col.label }}</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in tableData" :key="row.id">
              <td v-for="col in tableColumns" :key="col.key">
                <template v-if="col.key === 'status'">
                  <span class="status-badge" :class="row[col.key]">
                    {{ getStatusLabel(row[col.key]) }}
                  </span>
                </template>
                <template v-else>
                  {{ row[col.key] }}
                </template>
              </td>
              <td class="action-cell">
                <button class="action-btn view" @click="viewDetail(row)">查看</button>
                <button class="action-btn edit" @click="editRow(row)">编辑</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pagination">
        <button class="page-btn" :disabled="currentPage === 1" @click="prevPage">上一页</button>
        <span class="page-info">第 {{ currentPage }} / {{ totalPages }} 页</span>
        <button class="page-btn" :disabled="currentPage === totalPages" @click="nextPage">下一页</button>
      </div>
    </div>

    <div class="modal-overlay" v-if="detailVisible" @click="detailVisible = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>数据详情</h3>
          <button class="close-btn" @click="detailVisible = false">×</button>
        </div>
        <div class="modal-body" v-if="selectedData">
          <div class="detail-grid">
            <div v-for="col in tableColumns" :key="col.key" class="detail-item">
              <span class="detail-label">{{ col.label }}</span>
              <span class="detail-value">{{ selectedData[col.key] }}</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" @click="detailVisible = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'

const activeTab = ref('user')
const detailVisible = ref(false)
const selectedData = ref(null)
const currentPage = ref(1)
const pageSize = ref(10)

const searchForm = reactive({
  type: '',
  keyword: ''
})

const dataTabs = [
  { key: 'user', label: '用户数据' },
  { key: 'organization', label: '组织数据' },
  { key: 'product', label: '商品数据' },
  { key: 'customer', label: '客户数据' }
]

const tableColumnsMap = {
  user: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: '姓名' },
    { key: 'code', label: '用户编码' },
    { key: 'email', label: '邮箱' },
    { key: 'phone', label: '手机号' },
    { key: 'status', label: '状态' },
    { key: 'createTime', label: '创建时间' }
  ],
  organization: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: '组织名称' },
    { key: 'code', label: '组织编码' },
    { key: 'type', label: '组织类型' },
    { key: 'parentName', label: '上级组织' },
    { key: 'status', label: '状态' },
    { key: 'createTime', label: '创建时间' }
  ],
  product: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: '商品名称' },
    { key: 'code', label: '商品编码' },
    { key: 'category', label: '分类' },
    { key: 'brand', label: '品牌' },
    { key: 'status', label: '状态' },
    { key: 'createTime', label: '创建时间' }
  ],
  customer: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: '客户名称' },
    { key: 'code', label: '客户编码' },
    { key: 'type', label: '客户类型' },
    { key: 'contact', label: '联系人' },
    { key: 'phone', label: '联系电话' },
    { key: 'createTime', label: '创建时间' }
  ]
}

const mockData = {
  user: [
    { id: 1, name: '张三', code: 'U001', email: 'zhangsan@example.com', phone: '13800138001', status: 'active', createTime: '2026-05-01 10:30:00' },
    { id: 2, name: '李四', code: 'U002', email: 'lisi@example.com', phone: '13800138002', status: 'active', createTime: '2026-05-02 14:20:00' },
    { id: 3, name: '王五', code: 'U003', email: 'wangwu@example.com', phone: '13800138003', status: 'inactive', createTime: '2026-05-03 09:15:00' },
    { id: 4, name: '赵六', code: 'U004', email: 'zhaoliu@example.com', phone: '13800138004', status: 'active', createTime: '2026-05-04 16:45:00' },
    { id: 5, name: '钱七', code: 'U005', email: 'qianqi@example.com', phone: '13800138005', status: 'active', createTime: '2026-05-05 11:00:00' }
  ],
  organization: [
    { id: 1, name: '总部', code: 'O001', type: '总部', parentName: '-', status: 'active', createTime: '2026-01-01 00:00:00' },
    { id: 2, name: '研发部', code: 'O002', type: '部门', parentName: '总部', status: 'active', createTime: '2026-01-05 10:00:00' },
    { id: 3, name: '市场部', code: 'O003', type: '部门', parentName: '总部', status: 'active', createTime: '2026-01-06 10:00:00' },
    { id: 4, name: '销售部', code: 'O004', type: '部门', parentName: '总部', status: 'active', createTime: '2026-01-07 10:00:00' },
    { id: 5, name: '研发一组', code: 'O005', type: '小组', parentName: '研发部', status: 'active', createTime: '2026-02-01 09:00:00' }
  ],
  product: [
    { id: 1, name: '有机大米', code: 'P001', category: '粮油', brand: '农谷', status: 'active', createTime: '2026-03-01 10:00:00' },
    { id: 2, name: '新鲜蔬菜礼盒', code: 'P002', category: '蔬菜', brand: '田园', status: 'active', createTime: '2026-03-05 14:00:00' },
    { id: 3, name: '土鸡蛋', code: 'P003', category: '蛋类', brand: '农家', status: 'active', createTime: '2026-03-10 09:30:00' },
    { id: 4, name: '有机猪肉', code: 'P004', category: '肉类', brand: '绿源', status: 'inactive', createTime: '2026-03-15 11:00:00' },
    { id: 5, name: '蜂蜜', code: 'P005', category: '食品', brand: '山野', status: 'active', createTime: '2026-03-20 16:00:00' }
  ],
  customer: [
    { id: 1, name: 'ABC超市', code: 'C001', type: '商超', contact: '张经理', phone: '13900139001', createTime: '2026-04-01 10:00:00' },
    { id: 2, name: '生鲜电商', code: 'C002', type: '电商', contact: '李总', phone: '13900139002', createTime: '2026-04-05 14:00:00' },
    { id: 3, name: '农贸市场', code: 'C003', type: '市场', contact: '王老板', phone: '13900139003', createTime: '2026-04-10 09:00:00' },
    { id: 4, name: '餐饮连锁', code: 'C004', type: '餐饮', contact: '赵总', phone: '13900139004', createTime: '2026-04-15 11:30:00' },
    { id: 5, name: '便利店', code: 'C005', type: '零售', contact: '钱店长', phone: '13900139005', createTime: '2026-04-20 15:00:00' }
  ]
}

const tableColumns = computed(() => tableColumnsMap[activeTab.value] || [])

const tableData = computed(() => {
  let data = mockData[activeTab.value] || []
  if (searchForm.keyword) {
    const keyword = searchForm.keyword.toLowerCase()
    data = data.filter(item => {
      if (searchForm.type) {
        return String(item[searchForm.type] || '').toLowerCase().includes(keyword)
      }
      return Object.values(item).some(val => 
        String(val).toLowerCase().includes(keyword)
      )
    })
  }
  return data
})

const totalPages = computed(() => Math.ceil(tableData.value.length / pageSize.value))

const getStatusLabel = (status) => {
  const labels = { active: '启用', inactive: '禁用' }
  return labels[status] || status
}

const handleSearch = () => {
  currentPage.value = 1
}

const handleRefresh = () => {
  searchForm.type = ''
  searchForm.keyword = ''
  currentPage.value = 1
}

const handleExport = () => {
  alert('数据导出功能已触发')
}

const viewDetail = (row) => {
  selectedData.value = row
  detailVisible.value = true
}

const editRow = (row) => {
  alert(`编辑数据: ${row.name || row.code}`)
}

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
  }
}

onMounted(() => {})
</script>

<style scoped>
.user-data-query {
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 24px;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
}

.page-header p {
  font-size: 14px;
  color: #a0aec0;
  margin: 4px 0 0;
}

.query-section {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  margin-bottom: 20px;
}

.query-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.query-tabs button {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  background: #f0f0f0;
  color: #4a5568;
  cursor: pointer;
  transition: all 0.2s;
}

.query-tabs button.active {
  background: #238636;
  color: #fff;
}

.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.search-group {
  display: flex;
  gap: 8px;
}

.search-select {
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  color: #4a5568;
  background: #fff;
}

.search-input {
  padding: 10px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  width: 300px;
  outline: none;
}

.search-input:focus {
  border-color: #238636;
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

.export-btn {
  padding: 10px 20px;
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

.result-section {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
}

.result-count {
  font-size: 13px;
  color: #a0aec0;
}

.refresh-btn {
  padding: 6px 12px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  color: #4a5568;
  cursor: pointer;
}

.data-table {
  overflow-x: auto;
}

.data-table table {
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
  width: 600px;
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

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
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

.modal-footer {
  display: flex;
  justify-content: flex-end;
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

.btn-primary {
  background: #238636;
  color: #fff;
}
</style>