<template>
  <div class="trace-page">
    <div class="page-header">
      <el-button type="primary" @click="showGenerateDialog = true">
        <el-icon><Plus /></el-icon> 生成溯源码
      </el-button>
      <el-input 
        v-model="queryCode" 
        placeholder="输入溯源码查询" 
        class="search-input"
        @keyup.enter="handleQuery"
      >
        <template #append>
          <el-button @click="handleQuery"><el-icon><Search /></el-icon></el-button>
        </template>
      </el-input>
    </div>

    <el-card>
      <el-table :data="traceCodes" border>
        <el-table-column prop="traceCode" label="溯源码" />
        <el-table-column prop="productName" label="产品名称" />
        <el-table-column prop="batchNumber" label="批次号" />
        <el-table-column prop="farmName" label="农场" />
        <el-table-column prop="plotName" label="地块" />
        <el-table-column prop="qualityGrade" label="品质等级" />
        <el-table-column prop="harvestDate" label="采收日期" />
        <el-table-column prop="status" label="状态">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)">{{ getStatusText(scope.row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="queryCount" label="查询次数" />
        <el-table-column label="操作">
          <template #default="scope">
            <el-button size="small" @click="viewDetail(scope.row)">查看详情</el-button>
            <el-button v-if="scope.row.status === 'inactive'" size="small" type="success" @click="activateCode(scope.row.id)">激活</el-button>
            <el-button v-if="scope.row.status === 'active'" size="small" type="warning" @click="deactivateCode(scope.row.id)">停用</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        :current-page="pagination.pageNum"
        :page-size="pagination.pageSize"
        :total="pagination.total"
        layout="total, prev, pager, next, jumper"
        @current-change="handlePageChange"
      />
    </el-card>

    <el-dialog title="生成溯源码" :visible.sync="showGenerateDialog">
      <el-form :model="generateForm" label-width="100px">
        <el-form-item label="采收单ID" prop="harvestId">
          <el-input v-model="generateForm.harvestId" type="number" />
        </el-form-item>
        <el-form-item label="产品名称" prop="productName">
          <el-input v-model="generateForm.productName" />
        </el-form-item>
        <el-form-item label="产品编码" prop="productCode">
          <el-input v-model="generateForm.productCode" />
        </el-form-item>
        <el-form-item label="批次号" prop="batchNumber">
          <el-input v-model="generateForm.batchNumber" />
        </el-form-item>
        <el-form-item label="数量" prop="quantity">
          <el-input v-model="generateForm.quantity" type="number" placeholder="生成数量" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showGenerateDialog = false">取消</el-button>
        <el-button type="primary" @click="generateCodes">生成</el-button>
      </template>
    </el-dialog>

    <el-dialog title="溯源详情" :visible.sync="showDetailDialog" width="600px">
      <div v-if="currentTrace" class="trace-detail">
        <div class="detail-row">
          <span class="label">溯源码:</span>
          <span class="value">{{ currentTrace.traceCode }}</span>
        </div>
        <div class="detail-row">
          <span class="label">产品名称:</span>
          <span class="value">{{ currentTrace.productName }}</span>
        </div>
        <div class="detail-row">
          <span class="label">批次号:</span>
          <span class="value">{{ currentTrace.batchNumber }}</span>
        </div>
        <div class="detail-row">
          <span class="label">农场:</span>
          <span class="value">{{ currentTrace.farmName }}</span>
        </div>
        <div class="detail-row">
          <span class="label">地块:</span>
          <span class="value">{{ currentTrace.plotName }}</span>
        </div>
        <div class="detail-row">
          <span class="label">作物:</span>
          <span class="value">{{ currentTrace.cropName }}</span>
        </div>
        <div class="detail-row">
          <span class="label">品质等级:</span>
          <span class="value">{{ currentTrace.qualityGrade }}</span>
        </div>
        <div class="detail-row">
          <span class="label">采收日期:</span>
          <span class="value">{{ currentTrace.harvestDate }}</span>
        </div>
        <div class="detail-row">
          <span class="label">状态:</span>
          <span class="value">{{ getStatusText(currentTrace.status) }}</span>
        </div>
        <div class="detail-row">
          <span class="label">查询次数:</span>
          <span class="value">{{ currentTrace.queryCount }}</span>
        </div>
        <div class="detail-row">
          <span class="label">首次查询时间:</span>
          <span class="value">{{ currentTrace.firstQueryTime || '未查询' }}</span>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { Plus, Search } from '@element-plus/icons-vue'

const queryCode = ref('')
const showGenerateDialog = ref(false)
const showDetailDialog = ref(false)

const traceCodes = ref([
  { id: 1, traceCode: 'AGRI20240115001', productName: '小麦', productCode: 'P001', batchNumber: 'B202401', farmId: 1, farmName: '阳光农场', plotId: 1, plotName: '地块A1', cropName: '小麦', qualityGrade: 'A级', harvestDate: '2024-01-15', status: 'active', queryCount: 15, firstQueryTime: '2024-01-16 10:30' },
  { id: 2, traceCode: 'AGRI20240116001', productName: '玉米', productCode: 'P002', batchNumber: 'B202402', farmId: 1, farmName: '阳光农场', plotId: 2, plotName: '地块A2', cropName: '玉米', qualityGrade: 'B级', harvestDate: '2024-01-16', status: 'active', queryCount: 8, firstQueryTime: '2024-01-17 09:15' },
  { id: 3, traceCode: 'AGRI20240117001', productName: '蔬菜', productCode: 'P003', batchNumber: 'B202403', farmId: 2, farmName: '绿色田园', plotId: 3, plotName: '地块B1', cropName: '蔬菜', qualityGrade: 'A级', harvestDate: '2024-01-17', status: 'inactive', queryCount: 0, firstQueryTime: null },
  { id: 4, traceCode: 'AGRI20240118001', productName: '水稻', productCode: 'P004', batchNumber: 'B202404', farmId: 3, farmName: '生态农庄', plotId: 4, plotName: '地块C1', cropName: '水稻', qualityGrade: 'B级', harvestDate: '2024-01-18', status: 'active', queryCount: 12, firstQueryTime: '2024-01-18 14:20' },
  { id: 5, traceCode: 'AGRI20240119001', productName: '苹果', productCode: 'P005', batchNumber: 'B202405', farmId: 4, farmName: '现代农业园', plotId: 5, plotName: '地块D1', cropName: '苹果', qualityGrade: 'A级', harvestDate: '2024-01-19', status: 'active', queryCount: 20, firstQueryTime: '2024-01-19 08:45' }
])

const pagination = reactive({
  pageNum: 1,
  pageSize: 10,
  total: 5
})

const generateForm = reactive({
  harvestId: '',
  productName: '',
  productCode: '',
  batchNumber: '',
  quantity: 1
})

const currentTrace = ref(null)

const getStatusType = (status) => {
  const types = { active: 'success', inactive: 'warning', revoked: 'danger' }
  return types[status] || 'default'
}

const getStatusText = (status) => {
  const texts = { active: '已激活', inactive: '未激活', revoked: '已撤销' }
  return texts[status] || status
}

const handleQuery = () => {
  if (queryCode.value) {
    const code = traceCodes.value.find(c => c.traceCode === queryCode.value)
    if (code) {
      viewDetail(code)
    } else {
      ElMessage.warning('未找到该溯源码')
    }
  }
}

const handlePageChange = (page) => {
  pagination.pageNum = page
}

const viewDetail = (trace) => {
  currentTrace.value = trace
  showDetailDialog.value = true
}

const activateCode = (id) => {
  const code = traceCodes.value.find(c => c.id === id)
  if (code) {
    code.status = 'active'
    ElMessage.success('已激活')
  }
}

const deactivateCode = (id) => {
  const code = traceCodes.value.find(c => c.id === id)
  if (code) {
    code.status = 'inactive'
    ElMessage.success('已停用')
  }
}

const generateCodes = () => {
  const count = generateForm.quantity || 1
  for (let i = 0; i < count; i++) {
    const newCode = {
      id: Date.now() + i,
      traceCode: 'AGRI' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + String(Date.now()).slice(-3) + i,
      productName: generateForm.productName || '未知产品',
      productCode: generateForm.productCode || '',
      batchNumber: generateForm.batchNumber || 'B' + new Date().toISOString().slice(2, 10).replace(/-/g, ''),
      farmId: 1,
      farmName: '阳光农场',
      plotId: 1,
      plotName: '地块A1',
      cropName: generateForm.productName || '未知作物',
      qualityGrade: 'A级',
      harvestDate: new Date().toISOString().split('T')[0],
      status: 'inactive',
      queryCount: 0,
      firstQueryTime: null
    }
    traceCodes.value.unshift(newCode)
  }
  pagination.total += count
  ElMessage.success(`成功生成 ${count} 个溯源码`)
  showGenerateDialog.value = false
  generateForm.harvestId = ''
  generateForm.productName = ''
  generateForm.productCode = ''
  generateForm.batchNumber = ''
  generateForm.quantity = 1
}
</script>

<style scoped>
.trace-page {
  padding: 20px;
}

.page-header {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.search-input {
  width: 300px;
}

.trace-detail {
  padding: 10px;
}

.detail-row {
  display: flex;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
}

.label {
  width: 100px;
  font-weight: bold;
  color: #666;
}

.value {
  flex: 1;
  color: #333;
}
</style>