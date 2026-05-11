<template>
  <div class="quality-page">
    <div class="page-header">
      <h2>质量检测管理</h2>
      <el-button type="primary" @click="showAddModal = true">
        <el-icon><component :is="icons.Plus" /></el-icon>
        新增检测
      </el-button>
    </div>

    <div class="stats-row">
      <el-card class="stat-item">
        <div class="stat-num blue">{{ stats.total }}</div>
        <div class="stat-label">检测总数</div>
      </el-card>
      <el-card class="stat-item">
        <div class="stat-num green">{{ stats.pass }}</div>
        <div class="stat-label">合格</div>
      </el-card>
      <el-card class="stat-item">
        <div class="stat-num red">{{ stats.fail }}</div>
        <div class="stat-label">不合格</div>
      </el-card>
      <el-card class="stat-item">
        <div class="stat-num orange">{{ passRate }}%</div>
        <div class="stat-label">合格率</div>
      </el-card>
    </div>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="检测记录" name="records">
        <div class="search-bar">
          <el-input v-model="searchForm.sampleName" placeholder="样品名称" class="search-input" />
          <el-select v-model="searchForm.result" placeholder="检测结果">
            <el-option label="全部" value="" />
            <el-option label="合格" value="pass" />
            <el-option label="不合格" value="fail" />
          </el-select>
          <el-button type="primary" @click="search">搜索</el-button>
        </div>
        <el-table :data="inspectionList" border>
          <el-table-column prop="inspectionCode" label="检测编号" />
          <el-table-column prop="sampleName" label="样品名称" />
          <el-table-column prop="sampleType" label="样品类型" />
          <el-table-column prop="plotName" label="来源地块" />
          <el-table-column prop="inspector" label="检测人" />
          <el-table-column prop="result" label="结果">
            <template #default="scope">
              <el-tag :type="scope.row.result === 'pass' ? 'success' : 'danger'">
                {{ scope.row.result === 'pass' ? '合格' : '不合格' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="inspectionTime" label="检测时间" />
          <el-table-column label="操作">
            <template #default="scope">
              <el-button size="small" @click="viewDetail(scope.row)">查看报告</el-button>
              <el-button size="small" @click="editRecord(scope.row)">编辑</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="检测项目" name="items">
        <div class="search-bar">
          <el-input v-model="searchForm.itemName" placeholder="项目名称" class="search-input" />
          <el-button type="primary" @click="searchItems">搜索</el-button>
        </div>
        <el-table :data="inspectionItems" border>
          <el-table-column prop="itemCode" label="项目编码" />
          <el-table-column prop="itemName" label="项目名称" />
          <el-table-column prop="category" label="类别" />
          <el-table-column prop="unit" label="单位" />
          <el-table-column prop="standardValue" label="标准值" />
          <el-table-column prop="tolerance" label="允许偏差" />
          <el-table-column label="操作">
            <template #default="scope">
              <el-button size="small" @click="editItem(scope.row)">编辑</el-button>
              <el-button size="small" type="danger" @click="deleteItem(scope.row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="检测标准" name="standards">
        <el-table :data="standards" border>
          <el-table-column prop="standardCode" label="标准编号" />
          <el-table-column prop="standardName" label="标准名称" />
          <el-table-column prop="category" label="适用类别" />
          <el-table-column prop="source" label="标准来源" />
          <el-table-column prop="version" label="版本" />
          <el-table-column label="操作">
            <template #default="scope">
              <el-button size="small" @click="viewStandard(scope.row)">查看</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <el-dialog title="新增检测记录" :visible.sync="showAddModal" width="700px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="样品名称" prop="sampleName">
          <el-input v-model="form.sampleName" />
        </el-form-item>
        <el-form-item label="样品类型" prop="sampleType">
          <el-select v-model="form.sampleType">
            <el-option label="农产品" value="product" />
            <el-option label="土壤" value="soil" />
            <el-option label="水质" value="water" />
            <el-option label="投入品" value="input" />
          </el-select>
        </el-form-item>
        <el-form-item label="来源地块" prop="plotId">
          <el-select v-model="form.plotId">
            <el-option label="A区-01" value="1" />
            <el-option label="A区-02" value="2" />
            <el-option label="B区-01" value="3" />
          </el-select>
        </el-form-item>
        <el-form-item label="检测项目" prop="items">
          <el-checkbox-group v-model="form.items">
            <el-checkbox label="农药残留" value="pesticide" />
            <el-checkbox label="重金属" value="heavyMetal" />
            <el-checkbox label="营养成分" value="nutrition" />
            <el-checkbox label="微生物" value="microbe" />
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="检测结果" prop="result">
          <el-radio-group v-model="form.result">
            <el-radio label="pass">合格</el-radio>
            <el-radio label="fail">不合格</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="检测说明" prop="remark">
          <el-textarea v-model="form.remark" rows="3" />
        </el-form-item>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="showAddModal = false">取消</el-button>
        <el-button type="primary" @click="saveRecord">保存</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import * as icons from '@element-plus/icons-vue'

const showAddModal = ref(false)
const activeTab = ref('records')
const stats = reactive({ total: 156, pass: 142, fail: 14 })
const passRate = computed(() => Math.round((stats.pass / stats.total) * 100))
const searchForm = reactive({ sampleName: '', result: '', itemName: '' })

const form = reactive({
  id: null,
  sampleName: '',
  sampleType: 'product',
  plotId: '',
  items: [],
  result: 'pass',
  remark: ''
})

const inspectionList = ref([
  { id: 1, inspectionCode: 'INS001', sampleName: '番茄样品-A1', sampleType: '农产品', plotName: 'A区-01', inspector: '张三', result: 'pass', inspectionTime: '2024-07-20 10:00:00' },
  { id: 2, inspectionCode: 'INS002', sampleName: '黄瓜样品-B2', sampleType: '农产品', plotName: 'A区-02', inspector: '李四', result: 'pass', inspectionTime: '2024-07-20 11:30:00' },
  { id: 3, inspectionCode: 'INS003', sampleName: '土壤样品-C1', sampleType: '土壤', plotName: 'B区-01', inspector: '王五', result: 'fail', inspectionTime: '2024-07-19 14:00:00' },
  { id: 4, inspectionCode: 'INS004', sampleName: '草莓样品-D1', sampleType: '农产品', plotName: 'C区-01', inspector: '赵六', result: 'pass', inspectionTime: '2024-07-19 09:15:00' },
  { id: 5, inspectionCode: 'INS005', sampleName: '灌溉水样品', sampleType: '水质', plotName: 'A区-01', inspector: '孙七', result: 'pass', inspectionTime: '2024-07-18 16:00:00' }
])

const inspectionItems = ref([
  { id: 1, itemCode: 'ITEM001', itemName: '农药残留检测', category: '安全检测', unit: 'mg/kg', standardValue: '0.05', tolerance: '±10%' },
  { id: 2, itemCode: 'ITEM002', itemName: '重金属含量', category: '安全检测', unit: 'mg/kg', standardValue: '0.3', tolerance: '±5%' },
  { id: 3, itemCode: 'ITEM003', itemName: '维生素C', category: '营养检测', unit: 'mg/100g', standardValue: '25', tolerance: '±15%' },
  { id: 4, itemCode: 'ITEM004', itemName: '大肠杆菌', category: '微生物检测', unit: 'CFU/g', standardValue: '0', tolerance: '0' },
  { id: 5, itemCode: 'ITEM005', itemName: '水分含量', category: '常规检测', unit: '%', standardValue: '90', tolerance: '±2%' }
])

const standards = ref([
  { id: 1, standardCode: 'GB2763-2021', standardName: '食品安全国家标准 食品中农药最大残留限量', category: '农药残留', source: '国家标准', version: '2021' },
  { id: 2, standardCode: 'GB2762-2017', standardName: '食品安全国家标准 食品中污染物限量', category: '重金属', source: '国家标准', version: '2017' },
  { id: 3, standardCode: 'NY/T 1055-2021', standardName: '绿色食品 产品检验规则', category: '综合', source: '农业行业标准', version: '2021' },
  { id: 4, standardCode: 'GB 4789.3-2016', standardName: '食品安全国家标准 食品微生物学检验 大肠菌群计数', category: '微生物', source: '国家标准', version: '2016' }
])

const search = () => { console.log('搜索检测:', searchForm) }
const searchItems = () => { console.log('搜索项目:', searchForm) }
const viewDetail = (row) => { console.log('查看报告:', row) }
const editRecord = (row) => { Object.assign(form, row); showAddModal.value = true }
const editItem = (row) => { console.log('编辑项目:', row) }
const deleteItem = (row) => { console.log('删除项目:', row) }
const viewStandard = (row) => { console.log('查看标准:', row) }
const saveRecord = () => { console.log('保存记录:', form); showAddModal.value = false }
</script>

<style scoped>
.quality-page { padding: 20px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }
.stat-item { text-align: center; }
.stat-num { font-size: 32px; font-weight: 600; }
.stat-num.blue { color: #409EFF; }
.stat-num.green { color: #67C23A; }
.stat-num.red { color: #F56C6C; }
.stat-num.orange { color: #E6A23C; }
.stat-label { color: #909399; font-size: 14px; }
.search-bar { display: flex; gap: 12px; margin-bottom: 20px; }
.search-input { width: 200px; }
.dialog-footer { text-align: right; }
</style>