<template>
  <div class="inventory-page">
    <div class="page-header">
      <div class="header-info">
        <h2>库存管理</h2>
        <p>实时监控农资库存状况</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" @click="showAddModal = true">
          <el-icon name="plus"></el-icon>
          新增入库
        </el-button>
      </div>
    </div>

    <div class="stats-cards">
      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon blue">
            <el-icon name="warehouse"></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ totalInventory }}</div>
            <div class="stat-label">库存总量</div>
          </div>
        </div>
      </el-card>
      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon green">
            <el-icon name="arrow-down"></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ todayInbound }}</div>
            <div class="stat-label">今日入库</div>
          </div>
        </div>
      </el-card>
      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon orange">
            <el-icon name="arrow-up"></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ todayOutbound }}</div>
            <div class="stat-label">今日出库</div>
          </div>
        </div>
      </el-card>
      <el-card class="stat-card warning">
        <div class="stat-content">
          <div class="stat-icon red">
            <el-icon name="alert-triangle"></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ lowStockCount }}</div>
            <div class="stat-label">库存预警</div>
          </div>
        </div>
      </el-card>
    </div>

    <div class="search-bar">
      <el-input v-model="searchText" placeholder="搜索物料名称" class="search-input" />
      <el-select v-model="categoryFilter" placeholder="物料类别">
        <el-option label="全部" value="" />
        <el-option label="化肥" value="fertilizer" />
        <el-option label="农药" value="pesticide" />
        <el-option label="种子" value="seed" />
        <el-option label="农机" value="machine" />
      </el-select>
      <el-button type="primary" @click="search">搜索</el-button>
    </div>

    <el-table :data="inventoryList" border>
      <el-table-column prop="materialName" label="物料名称" />
      <el-table-column prop="category" label="类别">
        <template #default="scope">
          <el-tag :type="getCategoryType(scope.row.category)">{{ getCategoryText(scope.row.category) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="specification" label="规格" />
      <el-table-column prop="unit" label="单位" />
      <el-table-column prop="quantity" label="库存数量">
        <template #default="scope">
          <span :class="{ 'low-stock': scope.row.quantity < scope.row.minStock }">{{ scope.row.quantity }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="minStock" label="最低库存" />
      <el-table-column prop="location" label="存放位置" />
      <el-table-column prop="lastUpdate" label="更新时间" />
      <el-table-column label="操作">
        <template #default="scope">
          <el-button size="small" @click="viewDetail(scope.row)">详情</el-button>
          <el-button size="small" @click="editItem(scope.row)">编辑</el-button>
          <el-button size="small" type="danger" @click="deleteItem(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      :total="total"
      :page-size="10"
      :current-page="page"
      @current-change="handlePageChange"
      layout="total, prev, pager, next, jumper"
      class="pagination"
    />

    <el-dialog title="新增入库" :visible.sync="showAddModal" width="500px">
      <el-form :model="formData" label-width="120px">
        <el-form-item label="物料名称">
          <el-input v-model="formData.materialName" />
        </el-form-item>
        <el-form-item label="类别">
          <el-select v-model="formData.category">
            <el-option label="化肥" value="fertilizer" />
            <el-option label="农药" value="pesticide" />
            <el-option label="种子" value="seed" />
            <el-option label="农机" value="machine" />
          </el-select>
        </el-form-item>
        <el-form-item label="规格">
          <el-input v-model="formData.specification" />
        </el-form-item>
        <el-form-item label="单位">
          <el-input v-model="formData.unit" />
        </el-form-item>
        <el-form-item label="入库数量">
          <el-input v-model.number="formData.quantity" type="number" />
        </el-form-item>
        <el-form-item label="最低库存">
          <el-input v-model.number="formData.minStock" type="number" />
        </el-form-item>
        <el-form-item label="存放位置">
          <el-input v-model="formData.location" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddModal = false">取消</el-button>
        <el-button type="primary" @click="submitForm">确认入库</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'

const searchText = ref('')
const categoryFilter = ref('')
const page = ref(1)
const total = ref(100)
const showAddModal = ref(false)

const formData = reactive({
  materialName: '',
  category: '',
  specification: '',
  unit: '',
  quantity: 0,
  minStock: 0,
  location: ''
})

const inventoryList = ref([
  { id: 1, materialName: '复合肥', category: 'fertilizer', specification: '50kg/袋', unit: '袋', quantity: 120, minStock: 50, location: 'A区-01', lastUpdate: '2024-07-20 10:30:00' },
  { id: 2, materialName: '杀虫剂', category: 'pesticide', specification: '500ml/瓶', unit: '瓶', quantity: 25, minStock: 30, location: 'B区-02', lastUpdate: '2024-07-19 14:20:00' },
  { id: 3, materialName: '番茄种子', category: 'seed', specification: '10g/袋', unit: '袋', quantity: 80, minStock: 20, location: 'C区-01', lastUpdate: '2024-07-18 09:15:00' },
  { id: 4, materialName: '尿素', category: 'fertilizer', specification: '40kg/袋', unit: '袋', quantity: 200, minStock: 100, location: 'A区-02', lastUpdate: '2024-07-20 11:00:00' },
  { id: 5, materialName: '除草剂', category: 'pesticide', specification: '1L/瓶', unit: '瓶', quantity: 45, minStock: 30, location: 'B区-01', lastUpdate: '2024-07-17 16:45:00' },
  { id: 6, materialName: '黄瓜种子', category: 'seed', specification: '5g/袋', unit: '袋', quantity: 120, minStock: 50, location: 'C区-02', lastUpdate: '2024-07-16 10:30:00' },
  { id: 7, materialName: '磷酸二铵', category: 'fertilizer', specification: '50kg/袋', unit: '袋', quantity: 60, minStock: 40, location: 'A区-03', lastUpdate: '2024-07-15 08:00:00' },
  { id: 8, materialName: '杀菌剂', category: 'pesticide', specification: '250ml/瓶', unit: '瓶', quantity: 15, minStock: 20, location: 'B区-03', lastUpdate: '2024-07-14 13:20:00' }
])

const totalInventory = computed(() => {
  return inventoryList.value.reduce((sum, item) => sum + item.quantity, 0)
})

const todayInbound = ref(150)
const todayOutbound = ref(80)

const lowStockCount = computed(() => {
  return inventoryList.value.filter(item => item.quantity < item.minStock).length
})

const getCategoryType = (category) => {
  const types = { fertilizer: 'success', pesticide: 'danger', seed: 'primary', machine: 'warning' }
  return types[category] || 'default'
}

const getCategoryText = (category) => {
  const texts = { fertilizer: '化肥', pesticide: '农药', seed: '种子', machine: '农机' }
  return texts[category] || category
}

const search = () => {
  console.log('搜索:', searchText.value, categoryFilter.value)
}

const handlePageChange = (newPage) => {
  page.value = newPage
}

const viewDetail = (row) => {
  console.log('查看详情:', row)
}

const editItem = (row) => {
  console.log('编辑:', row)
}

const deleteItem = (row) => {
  console.log('删除:', row)
}

const submitForm = () => {
  console.log('提交:', formData)
  showAddModal.value = false
}
</script>

<style scoped>
.inventory-page { padding: 20px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.header-info p { color: #718096; margin: 4px 0 0; }
.header-actions { display: flex; gap: 12px; }
.stats-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }
.stat-card { padding: 20px; }
.stat-card.warning { border-color: #F56C6C; }
.stat-content { display: flex; align-items: center; gap: 16px; }
.stat-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; color: white; }
.stat-icon.blue { background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%); }
.stat-icon.green { background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); }
.stat-icon.orange { background: linear-gradient(135deg, #ed8936 0%, #dd6b20 100%); }
.stat-icon.red { background: linear-gradient(135deg, #fc8181 0%, #f56565 100%); }
.stat-value { font-size: 28px; font-weight: 600; color: #1a365d; }
.stat-label { font-size: 14px; color: #718096; }
.search-bar { display: flex; gap: 12px; margin-bottom: 20px; }
.search-input { width: 250px; }
.pagination { margin-top: 20px; text-align: right; }
.low-stock { color: #F56C6C; font-weight: bold; }
</style>
