<template>
  <div class="farms-page">
    <div class="header-section">
      <div class="header-left">
        <h1>农场管理</h1>
        <p>管理农场基本信息</p>
      </div>
      <div class="header-right">
        <el-button type="primary" class="add-btn" @click="showAddModal = true">
          <el-icon name="plus"></el-icon>
          新建农场
        </el-button>
      </div>
    </div>

    <div class="stats-row">
      <el-card class="stat-card">
        <div class="stat-icon-wrap blue">
          <el-icon name="map-pin"></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.total }}</div>
          <div class="stat-label">农场总数</div>
        </div>
      </el-card>

      <el-card class="stat-card">
        <div class="stat-icon-wrap green">
          <el-icon name="check-circle"></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.active }}</div>
          <div class="stat-label">正常运营</div>
        </div>
      </el-card>

      <el-card class="stat-card">
        <div class="stat-icon-wrap orange">
          <el-icon name="pause"></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.inactive }}</div>
          <div class="stat-label">暂停运营</div>
        </div>
      </el-card>

      <el-card class="stat-card">
        <div class="stat-icon-wrap purple">
          <el-icon name="crop"></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.totalArea }}</div>
          <div class="stat-label">总面积(亩)</div>
        </div>
      </el-card>
    </div>

    <div class="filter-section">
      <el-input v-model="searchText" placeholder="搜索农场名称..." class="search-input" />
      <el-select v-model="statusFilter" placeholder="状态">
        <el-option label="全部" value="" />
        <el-option label="正常运营" value="active" />
        <el-option label="暂停运营" value="inactive" />
      </el-select>
      <el-button type="primary" @click="search">搜索</el-button>
    </div>

    <el-table :data="farmList" border class="farm-table">
      <el-table-column prop="farmCode" label="农场编码" width="120" />
      <el-table-column prop="farmName" label="农场名称" />
      <el-table-column prop="farmType" label="类型" width="100">
        <template #default="scope">
          <el-tag :type="getTypeTag(scope.row.farmType)">{{ getTypeText(scope.row.farmType) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="province" label="省份" width="100" />
      <el-table-column prop="totalArea" label="规模(亩)" width="100" />
      <el-table-column prop="plotCount" label="地块数" width="80" />
      <el-table-column prop="status" label="状态" width="100">
        <template #default="scope">
          <el-tag :type="scope.row.status === 'active' ? 'success' : 'warning'">
            {{ scope.row.status === 'active' ? '正常' : '暂停' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createTime" label="创建时间" width="160" />
      <el-table-column label="操作" width="120">
        <template #default="scope">
          <el-button size="small" @click="viewDetail(scope.row)">详情</el-button>
          <el-button size="small" @click="editFarm(scope.row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog title="新建农场" :visible.sync="showAddModal" width="600px">
      <el-form :model="formData" label-width="120px">
        <el-form-item label="农场名称">
          <el-input v-model="formData.farmName" />
        </el-form-item>
        <el-form-item label="农场类型">
          <el-select v-model="formData.farmType">
            <el-option label="企业" value="enterprise" />
            <el-option label="合作社" value="cooperative" />
            <el-option label="个体" value="individual" />
          </el-select>
        </el-form-item>
        <el-form-item label="法人">
          <el-input v-model="formData.legalPerson" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="formData.contactPhone" />
        </el-form-item>
        <el-form-item label="省份">
          <el-input v-model="formData.province" />
        </el-form-item>
        <el-form-item label="总面积(亩)">
          <el-input v-model.number="formData.totalArea" type="number" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddModal = false">取消</el-button>
        <el-button type="primary" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'

const searchText = ref('')
const statusFilter = ref('')
const showAddModal = ref(false)

const stats = reactive({
  total: 8,
  active: 6,
  inactive: 2,
  totalArea: '2,450'
})

const formData = reactive({
  farmName: '',
  farmType: '',
  legalPerson: '',
  contactPhone: '',
  province: '',
  totalArea: 0
})

const farmList = ref([
  { id: 1, farmCode: 'FARM001', farmName: '绿源生态农场', farmType: 'enterprise', province: '山东省', totalArea: 520, plotCount: 12, status: 'active', createTime: '2024-01-15 10:00:00' },
  { id: 2, farmCode: 'FARM002', farmName: '金穗农业基地', farmType: 'cooperative', province: '河南省', totalArea: 860, plotCount: 18, status: 'active', createTime: '2024-02-20 14:30:00' },
  { id: 3, farmCode: 'FARM003', farmName: '阳光田园', farmType: 'individual', province: '江苏省', totalArea: 280, plotCount: 8, status: 'inactive', createTime: '2024-03-10 09:00:00' },
  { id: 4, farmCode: 'FARM004', farmName: '稻香农庄', farmType: 'enterprise', province: '安徽省', totalArea: 680, plotCount: 15, status: 'active', createTime: '2024-04-05 16:00:00' },
  { id: 5, farmCode: 'FARM005', farmName: '果蔬乐园', farmType: 'individual', province: '浙江省', totalArea: 350, plotCount: 10, status: 'active', createTime: '2024-05-18 11:30:00' },
  { id: 6, farmCode: 'FARM006', farmName: '绿洲农场', farmType: 'cooperative', province: '福建省', totalArea: 420, plotCount: 9, status: 'inactive', createTime: '2024-06-22 08:00:00' }
])

const getTypeTag = (type) => {
  const types = { enterprise: 'primary', cooperative: 'success', individual: 'info' }
  return types[type] || 'default'
}

const getTypeText = (type) => {
  const texts = { enterprise: '企业', cooperative: '合作社', individual: '个体' }
  return texts[type] || type
}

const search = () => {
  console.log('搜索:', searchText.value, statusFilter.value)
}

const viewDetail = (row) => {
  console.log('查看详情:', row)
}

const editFarm = (row) => {
  console.log('编辑:', row)
}

const submitForm = () => {
  console.log('提交:', formData)
  showAddModal.value = false
}
</script>

<style scoped>
.farms-page { padding: 24px; }
.header-section { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.header-left h1 { margin: 0; font-size: 24px; color: #1a365d; }
.header-left p { margin: 4px 0 0; color: #718096; }
.add-btn { background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); border: none; padding: 10px 24px; }

.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
.stat-card { padding: 20px; display: flex; align-items: center; gap: 16px; }
.stat-icon-wrap { width: 48px; height: 48px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 22px; color: white; }
.stat-icon-wrap.blue { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
.stat-icon-wrap.green { background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); }
.stat-icon-wrap.orange { background: linear-gradient(135deg, #ed8936 0%, #dd6b20 100%); }
.stat-icon-wrap.purple { background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%); }
.stat-content { }
.stat-value { font-size: 28px; font-weight: 600; color: #1a365d; }
.stat-label { font-size: 14px; color: #718096; margin-top: 4px; }

.filter-section { display: flex; gap: 16px; margin-bottom: 24px; }
.search-input { width: 300px; }

.farm-table { }
</style>
