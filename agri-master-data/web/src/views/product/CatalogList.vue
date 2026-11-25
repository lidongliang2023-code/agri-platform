<template>
  <div class="catalog-page">
    <div class="page-header">
      <div class="header-left">
        <h1>商品与分类</h1>
        <p>主数据管理 · 交易品类维护与商品违规处置</p>
      </div>

    </div>

    <div class="catalog-tabs">
      <button :class="{ on: tab === 'category' }" @click="tab = 'category'">品类管理</button>
      <button :class="{ on: tab === 'violation' }" @click="tab = 'violation'">商品违规</button>
    </div>

    <div v-if="tab === 'category'" class="table-card">
      
      <AgriVueTable
        :columns="listColumns1"
        :data="categories"
        row-key="id"
        column-settings-storage-key="mds:cols:catalog-list-1"
        :page="categoryPage"
        :page-size="categoryPageSize"
        :total="categoryTotal"
        @page-change="(next, size) => size !== categoryPageSize ? changeCategorySize(size) : changeCategoryPage(next)"
        @refresh="loadCategories"
      >
        <template #toolbar-left>
          <button v-if="tab === 'category'" class="mds-btn mds-btn--primary" @click="openCategory()">
                  <span class="btn-icon">+</span><span>新建品类</span>
                </button>
          <span>共 <b>{{ categoryTotal }}</b> 个品类 · 品类为全平台共用，删除前会检查下级与引用</span>
        </template>
        <template #empty>
          暂无品类
        </template>
        <template #cell-parentId="{ row: row }">
          {{ parentName(row.parentId) }}
        </template>
        <template #cell-status="{ row: row }">
          <span class="status-badge" :class="row.status === 1 ? 'active' : 'inactive'">{{ row.status === 1 ? '启用' : '停用' }}</span>
        </template>
        <template #cell-actions="{ row: row }">
          <MdsRowActions
            :actions="[
              { key: '1', label: &quot;编辑&quot;, onClick: () => openCategory(row) },
              { key: '2', label: &quot;删除&quot;, onClick: () => removeCategory(row), danger: true },
            ]"
          />
        </template>
      </AgriVueTable>
      
    </div>

    <div v-else class="table-card">
      
      <AgriVueTable
        :columns="listColumns2"
        :data="violations"
        row-key="id"
        column-settings-storage-key="mds:cols:catalog-list-2"
        :page="violationPage"
        :page-size="violationPageSize"
        :total="violationTotal"
        @page-change="(next, size) => size !== violationPageSize ? changeViolationSize(size) : changeViolationPage(next)"
        @refresh="loadViolations"
      >
        <template #filter>
          <AgriVueFilterBar :field-count="1" @search="searchViolations" @reset="resetViolations">
            <div class="agri-vue-filter-field">
              <label>处置状态</label>
              <select v-model="violationStatus" class="mds-select" @change="searchViolations">
                          <option value="">全部状态</option>
                          <option value="active">生效中</option>
                          <option value="revoked">已撤销</option>
                        </select>
            </div>
          </AgriVueFilterBar>
        </template>
        <template #toolbar-left>
          <button class="mds-btn mds-btn--primary" @click="openViolation">
                  <span class="btn-icon">+</span><span>违规下架</span>
                </button>
          <span>共 <b>{{ violationTotal }}</b> 条处置记录 · 下架必须填写原因并留痕</span>
        </template>
        <template #empty>
          暂无违规处置记录
        </template>
        <template #cell-violationType="{ row: row }">
          {{ violationTypeText(row.violationType) }}
        </template>
        <template #cell-violationStatus="{ row: row }">
          <span class="status-badge" :class="row.violationStatus === 'active' ? 'inactive' : 'active'">{{ row.violationStatus === 'active' ? '生效中' : '已撤销' }}</span>
        </template>
        <template #cell-createTime="{ row: row }">
          {{ formatTime(row.createTime) }}
        </template>
        <template #cell-actions="{ row: row }">
          <MdsRowActions v-if="row.violationStatus === 'active'"
            :actions="[
              { key: '1', label: &quot;撤销&quot;, onClick: () => openRevoke(row), hidden: !((row.violationStatus === 'active')) },
            ]"
          />
          <span v-else class="muted">已撤销</span>
        </template>
      </AgriVueTable>
      
    </div>

    <div v-if="categoryOpen" class="modal-overlay" @click="categoryOpen = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header"><h3>{{ categoryForm.id ? '编辑品类' : '新建品类' }}</h3><button class="close-btn" @click="categoryOpen = false">×</button></div>
        <div class="modal-body">
          <div class="form-group"><label>品类名称 *</label><input v-model="categoryForm.categoryName" class="form-input" placeholder="例如：大米" /></div>
          <div class="form-group"><label>品类编码</label><input v-model="categoryForm.categoryCode" class="form-input" placeholder="例如：GRAIN_RICE" /></div>
          <div class="form-group"><label>上级品类</label>
            <select v-model="categoryForm.parentId" class="form-select">
              <option :value="null">顶级品类</option>
              <option v-for="item in categories.filter((c) => c.id !== categoryForm.id)" :key="item.id" :value="item.id">{{ item.categoryName }}</option>
            </select>
          </div>
          <div class="form-group"><label>排序</label><input v-model.number="categoryForm.sortOrder" type="number" class="form-input" /></div>
          <div class="form-group"><label>状态</label>
            <select v-model.number="categoryForm.status" class="form-select"><option :value="1">启用</option><option :value="0">停用</option></select>
          </div>
          <div class="form-group"><label>备注</label><textarea v-model="categoryForm.remark" rows="3" class="form-textarea"></textarea></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="categoryOpen = false">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="saveCategory">保存</button>
        </div>
      </div>
    </div>

    <div v-if="violationOpen" class="modal-overlay" @click="violationOpen = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header"><h3>违规下架</h3><button class="close-btn" @click="violationOpen = false">×</button></div>
        <div class="modal-body">
          <div class="form-group"><label>货源 *</label>
            <select v-model.number="violationForm.productId" class="form-select">
              <option :value="null">请选择货源</option>
              <option v-for="item in products" :key="item.id" :value="item.id">{{ item.productName }} · {{ item.sellerName }}</option>
            </select>
          </div>
          <div class="form-group"><label>违规类型</label>
            <select v-model="violationForm.violationType" class="form-select">
              <option value="false_info">信息不实</option><option value="banned">禁售品</option>
              <option value="price_fraud">价格欺诈</option><option value="quality">质量问题</option><option value="other">其它</option>
            </select>
          </div>
          <div class="form-group"><label>处置原因 *</label><textarea v-model="violationForm.reason" rows="3" class="form-textarea"></textarea></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="violationOpen = false">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="submitViolation">确认下架</button>
        </div>
      </div>
    </div>

    <div v-if="revokeTarget" class="modal-overlay" @click="revokeTarget = null">
      <div class="modal-content" @click.stop>
        <div class="modal-header"><h3>撤销处置</h3><button class="close-btn" @click="revokeTarget = null">×</button></div>
        <div class="modal-body">
          <p class="muted">撤销后货源会恢复到处置前的状态，不会一律重新上架。</p>
          <div class="form-group"><label>撤销原因</label><textarea v-model="revokeReason" rows="3" class="form-textarea" placeholder="选填，但建议填写"></textarea></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="revokeTarget = null">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="submitRevoke">确认撤销</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { AgriVueTable, AgriVueFilterBar } from '@agri/shared/vue/list'
import MdsRowActions from '@/components/ui/MdsRowActions.vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import '@/styles/admin-page.css'
import {
  createTradeCategory,
  deleteTradeCategory,
  getTradeCategories,
  getTradeProductOptions,
  getTradeViolations,
  revokeTradeViolation,
  takeDownTradeProduct,
  updateTradeCategory,
} from '@/utils/tradeCatalog'

const tab = ref('category')
const saving = ref(false)

const categories = ref([])
const categoryPage = ref(1)
const categoryPageSize = ref(20)
const categoryTotal = ref(0)
const categoryOpen = ref(false)
const categoryForm = reactive({ id: null, categoryName: '', categoryCode: '', parentId: null, sortOrder: 0, status: 1, remark: '' })

const violations = ref([])
const violationPage = ref(1)
const violationPageSize = ref(20)
const violationTotal = ref(0)
const violationStatus = ref('')
const violationOpen = ref(false)
const violationForm = reactive({ productId: null, violationType: 'false_info', reason: '' })
const products = ref([])
const revokeTarget = ref(null)
const revokeReason = ref('')

const categoryPages = computed(() => Math.max(1, Math.ceil(categoryTotal.value / categoryPageSize.value)))
const violationPages = computed(() => Math.max(1, Math.ceil(violationTotal.value / violationPageSize.value)))

const formatTime = (value) => (value ? String(value).replace('T', ' ').slice(0, 19) : '—')
const parentName = (id) => (id == null ? '顶级品类' : categories.value.find((c) => c.id === id)?.categoryName ?? `#${id}`)
const violationTypeText = (value) => ({
  false_info: '信息不实', banned: '禁售品', price_fraud: '价格欺诈', quality: '质量问题', other: '其它'
}[value] ?? value ?? '—')

const loadCategories = async () => {
  try {
    const res = await getTradeCategories({ pageNum: categoryPage.value, pageSize: categoryPageSize.value })
    if (res.code === 200) {
      categories.value = res.data?.records ?? res.data?.list ?? []
      categoryTotal.value = res.data.total ?? 0
    } else {
      message.error(res.message || '加载品类失败')
    }
  } catch {
    message.error('加载品类失败（请确认交易服务已启动）')
  }
}

const loadViolations = async () => {
  try {
    const res = await getTradeViolations({ pageNum: violationPage.value, pageSize: violationPageSize.value, violationStatus: violationStatus.value || undefined })
    if (res.code === 200) {
      violations.value = res.data?.records ?? res.data?.list ?? []
      violationTotal.value = res.data.total ?? 0
    } else {
      message.error(res.message || '加载违规记录失败')
    }
  } catch {
    message.error('加载违规记录失败（请确认交易服务已启动）')
  }
}

const changeCategoryPage = (page) => {
  if (page < 1 || page > categoryPages.value) return
  categoryPage.value = page
  loadCategories()
}

const changeViolationPage = (page) => {
  if (page < 1 || page > violationPages.value) return
  violationPage.value = page
  loadViolations()
}

const openCategory = (row) => {
  Object.assign(categoryForm, row
    ? { ...row }
    : { id: null, categoryName: '', categoryCode: '', parentId: null, sortOrder: 0, status: 1, remark: '' })
  categoryOpen.value = true
}

const saveCategory = async () => {
  if (!categoryForm.categoryName?.trim()) {
    message.warning('请填写品类名称')
    return
  }
  saving.value = true
  try {
    const payload = {
      categoryName: categoryForm.categoryName.trim(),
      categoryCode: categoryForm.categoryCode?.trim(),
      parentId: categoryForm.parentId,
      sortOrder: categoryForm.sortOrder,
      status: categoryForm.status,
      remark: categoryForm.remark,
    }
    const res = categoryForm.id
      ? await updateTradeCategory(categoryForm.id, payload)
      : await createTradeCategory(payload)
    if (res.code === 200) {
      message.success(categoryForm.id ? '已保存' : '已新建')
      categoryOpen.value = false
      loadCategories()
    } else {
      message.error(res.message || '操作失败')
    }
  } catch {
    message.error('操作失败')
  } finally {
    saving.value = false
  }
}

const removeCategory = async (row) => {
  if (!window.confirm(`确认删除品类「${row.categoryName}」？有下级或货源引用时后端会拒绝。`)) return
  try {
    const res = await deleteTradeCategory(row.id)
    if (res.code === 200) {
      message.success('已删除')
      loadCategories()
    } else {
      message.error(res.message || '删除失败')
    }
  } catch {
    message.error('删除失败')
  }
}

const openViolation = async () => {
  Object.assign(violationForm, { productId: null, violationType: 'false_info', reason: '' })
  violationOpen.value = true
  try {
    const res = await getTradeProductOptions({ pageNum: 1, pageSize: 100 })
    products.value = res.code === 200 ? (res.data?.records ?? res.data?.list ?? []) : []
  } catch {
    products.value = []
  }
}

const submitViolation = async () => {
  if (!violationForm.productId || !violationForm.reason?.trim()) {
    message.warning('请选择货源并填写处置原因')
    return
  }
  saving.value = true
  try {
    const res = await takeDownTradeProduct(violationForm.productId, violationForm.violationType, violationForm.reason.trim())
    if (res.code === 200) {
      message.success('已下架并留痕')
      violationOpen.value = false
      loadViolations()
    } else {
      message.error(res.message || '处置失败')
    }
  } catch {
    message.error('处置失败')
  } finally {
    saving.value = false
  }
}

const openRevoke = (row) => {
  revokeTarget.value = row
  revokeReason.value = ''
}

const submitRevoke = async () => {
  if (!revokeTarget.value) return
  saving.value = true
  try {
    const res = await revokeTradeViolation(revokeTarget.value.id, revokeReason.value.trim() || undefined)
    if (res.code === 200) {
      message.success('已撤销处置')
      revokeTarget.value = null
      loadViolations()
    } else {
      message.error(res.message || '撤销失败')
    }
  } catch {
    message.error('撤销失败')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadCategories()
  loadViolations()
})

const listColumns1 = [
  { prop: 'categoryName', label: '品类名称', minWidth: 174, locked: true },
  { prop: 'categoryCode', label: '编码', width: 142, kind: 'code' },
  { prop: 'parentId', label: '上级品类', width: 128, ellipsis: false },
  { prop: 'level', label: '层级', width: 104, kind: 'number' },
  { prop: 'sortOrder', label: '排序', width: 104, kind: 'number' },
  { prop: 'status', label: '状态', width: 104, kind: 'status', ellipsis: false },
  { prop: 'remark', label: '备注', width: 210 },
  { key: 'actions', label: '操作', width: 138, kind: 'action', ellipsis: false },
]

const listColumns2 = [
  { prop: 'violationNo', label: '处置单号', minWidth: 142, locked: true, kind: 'code' },
  { prop: 'productName', label: '货源', width: 128 },
  { prop: 'sellerName', label: '供应商', width: 128 },
  { prop: 'violationType', label: '违规类型', width: 128, ellipsis: false },
  { prop: 'reason', label: '处置原因', width: 128 },
  { prop: 'violationStatus', label: '状态', width: 104, kind: 'status', ellipsis: false },
  { prop: 'operator', label: '处理人', width: 128 },
  { prop: 'createTime', label: '处置时间', width: 152, ellipsis: false },
  { key: 'actions', label: '操作', width: 138, kind: 'action', ellipsis: false },
]

function changeCategorySize(size) {
  categoryPageSize.value = size
  categoryPage.value = 1
  void loadCategories()
}
function searchViolations() {
  violationPage.value = 1
  void loadViolations()
}
function resetViolations() {
  violationStatus.value = ''
  searchViolations()
}
function changeViolationSize(size) {
  violationPageSize.value = size
  searchViolations()
}
</script>

<style scoped>
.catalog-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 14px;
}

.catalog-tabs button {
  border: 1px solid #e3eae5;
  background: #fff;
  color: #5c6f63;
  border-radius: 999px;
  padding: 6px 16px;
  font-size: 13px;
  cursor: pointer;
}

.catalog-tabs button.on {
  border-color: #12764a;
  background: #12764a;
  color: #fff;
  font-weight: 600;
}

.card-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #e3eae5;
  color: #6b7c72;
  font-size: 12.5px;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  gap: 8px;
}

.empty-cell {
  text-align: center;
  color: #93a29a;
  padding: 32px 0;
}

.muted {
  color: #93a29a;
}
</style>
