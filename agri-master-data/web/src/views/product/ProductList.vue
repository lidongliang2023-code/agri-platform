<template>
  <div class="product-list">
    <div class="page-header">
      <div class="header-left">
        <h1>官网上架商品</h1>
        <p>运营端新增后直接写入交易商品库，并同步展示在官网门户商品详情</p>
      </div>
      <button class="add-btn" @click="openCreateModal">
        <span class="btn-icon">+</span>
        <span>新增商品</span>
      </button>
    </div>

    <div class="search-bar">
      <div class="search-group">
        <input v-model="searchForm.keyword" type="text" placeholder="商品名称 / 编码 / 供应商" class="search-input" @keyup.enter="loadData" />
        <button class="search-btn" @click="loadData">搜索</button>
      </div>
      <div class="filter-group">
        <select v-model="searchForm.categoryId" class="filter-select" @change="loadData">
          <option value="">全部分类</option>
          <option v-for="item in categories" :key="item.id" :value="String(item.id)">{{ item.categoryName }}</option>
        </select>
        <select v-model="searchForm.publishStatus" class="filter-select" @change="loadData">
          <option value="">全部发布状态</option>
          <option value="published">已发布</option>
          <option value="pending">待审核</option>
          <option value="draft">草稿</option>
          <option value="rejected">已驳回</option>
        </select>
        <select v-model="searchForm.status" class="filter-select" @change="loadData">
          <option value="">全部状态</option>
          <option value="1">正常</option>
          <option value="0">禁用</option>
        </select>
      </div>
    </div>

    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>图片</th><th>商品</th><th>分类</th><th>供应商</th><th>价格</th><th>库存</th>
            <th>发布状态</th><th>状态</th><th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="product in tableData" :key="product.id">
            <td>
              <img v-if="product.images?.length" :src="product.images[0]" class="product-thumb" :alt="product.productName" />
              <div v-else class="product-thumb placeholder">无图</div>
            </td>
            <td>
              <strong>{{ product.productName }}</strong>
              <div class="cell-sub">{{ product.productCode }} · {{ product.variety || '品种待补充' }}</div>
            </td>
            <td><span class="type-badge">{{ product.categoryName || '—' }}</span></td>
            <td>{{ product.sellerName }}</td>
            <td class="price-cell">¥{{ money(product.price) }}<span>/{{ product.unit }}</span></td>
            <td>{{ product.stockQuantity }} {{ product.unit }}</td>
            <td><span class="status-badge" :class="product.publishStatus === 'published' ? 'active' : 'pending'">{{ publishLabel(product.publishStatus) }}</span></td>
            <td><span class="status-badge" :class="product.status === 1 ? 'active' : 'inactive'">{{ product.status === 1 ? '正常' : '禁用' }}</span></td>
            <td class="action-cell">
              <button class="action-btn view" @click="viewPortal(product)">官网详情</button>
              <button class="action-btn edit" @click="editProduct(product.id)">编辑</button>
              <button class="action-btn" :class="product.status === 1 ? 'disable' : 'enable'" @click="toggleStatus(product)">
                {{ product.status === 1 ? '禁用' : '启用' }}
              </button>
            </td>
          </tr>
          <tr v-if="!loading && tableData.length === 0">
            <td colspan="9" class="empty-row">暂无商品，点击右上角“新增商品”发布第一条官网上架商品。</td>
          </tr>
        </tbody>
      </table>

      <div class="pagination">
        <button class="page-btn" :disabled="pageNum === 1" @click="handleCurrentChange(pageNum - 1)">上一页</button>
        <span class="page-info">第 {{ pageNum }} / {{ totalPages }} 页 · 共 {{ total }} 条</span>
        <button class="page-btn" :disabled="pageNum === totalPages" @click="handleCurrentChange(pageNum + 1)">下一页</button>
      </div>
    </div>

    <div v-if="modalVisible" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <div>
            <h3>{{ form.id ? '编辑官网商品' : '新增官网商品' }}</h3>
            <p>商品详情、价格、库存、图片等字段将原样写入交易商品库</p>
          </div>
          <button class="close-btn" @click="closeModal">×</button>
        </div>

        <div class="modal-body">
          <section class="form-section">
            <h4>基础信息</h4>
            <div class="form-grid form-grid-3">
              <label class="form-group"><span>商品名称 *</span><input v-model="form.productName" class="form-input" placeholder="如：赣南脐橙 20斤装" /></label>
              <label class="form-group"><span>商品编码</span><input v-model="form.productCode" class="form-input" placeholder="留空自动生成" :disabled="Boolean(form.id)" /></label>
              <label class="form-group"><span>条码</span><input v-model="form.barcode" class="form-input" placeholder="可选" /></label>
              <label class="form-group">
                <span>商品分类 *</span>
                <select v-model="form.categoryId" class="form-select" @change="syncCategoryName">
                  <option value="">请选择分类</option>
                  <option v-for="item in categories" :key="item.id" :value="String(item.id)">{{ item.categoryName }}</option>
                </select>
              </label>
              <label class="form-group">
                <span>供应商 *</span>
                <select v-model="form.sellerId" class="form-select" @change="syncSellerName">
                  <option value="">请选择供应商</option>
                  <option v-for="item in sellers" :key="item.sellerId" :value="String(item.sellerId)">{{ item.sellerName }}</option>
                </select>
              </label>
              <label class="form-group"><span>品种</span><input v-model="form.variety" class="form-input" placeholder="如：纽荷尔脐橙" /></label>
            </div>
          </section>

          <section class="form-section">
            <h4>产地与规格</h4>
            <div class="form-grid form-grid-4">
              <label class="form-group"><span>产地省份</span><input v-model="form.originProvince" class="form-input" placeholder="江西省" /></label>
              <label class="form-group"><span>产地城市</span><input v-model="form.originCity" class="form-input" placeholder="赣州市" /></label>
              <label class="form-group"><span>区县</span><input v-model="form.originDistrict" class="form-input" placeholder="信丰县" /></label>
              <label class="form-group"><span>详细产地</span><input v-model="form.originAddress" class="form-input" placeholder="基地/园区详细地址" /></label>
              <label class="form-group"><span>规格等级</span><input v-model="form.specLevel" class="form-input" placeholder="一级/特级" /></label>
              <label class="form-group"><span>质量等级</span><input v-model="form.qualityLevel" class="form-input" placeholder="如：优质" /></label>
              <label class="form-group"><span>规格尺寸</span><input v-model="form.specSize" class="form-input" placeholder="如：80mm以上 / 20斤/箱" /></label>
              <label class="form-group"><span>采收批次</span><input v-model="form.harvestBatchNo" class="form-input" placeholder="可选" /></label>
            </div>
          </section>

          <section class="form-section">
            <h4>价格与库存</h4>
            <div class="form-grid form-grid-4">
              <label class="form-group"><span>销售单价 *</span><input v-model="form.price" type="number" min="0" step="0.01" class="form-input" /></label>
              <label class="form-group"><span>参考最低价</span><input v-model="form.priceMin" type="number" min="0" step="0.01" class="form-input" /></label>
              <label class="form-group"><span>参考最高价</span><input v-model="form.priceMax" type="number" min="0" step="0.01" class="form-input" /></label>
              <label class="form-group"><span>价格类型</span><select v-model="form.priceType" class="form-select"><option value="fixed">固定价</option><option value="negotiable">可议价</option></select></label>
              <label class="form-group"><span>库存数量 *</span><input v-model="form.stockQuantity" type="number" min="0" step="0.001" class="form-input" /></label>
              <label class="form-group"><span>计量单位 *</span><input v-model="form.unit" class="form-input" placeholder="箱 / kg / 吨" /></label>
              <label class="form-group"><span>起订量 *</span><input v-model="form.minOrderQuantity" type="number" min="0.001" step="0.001" class="form-input" /></label>
              <label class="form-group"><span>商品状态</span><select v-model="form.status" class="form-select"><option :value="1">正常</option><option :value="0">禁用</option></select></label>
            </div>
          </section>

          <section class="form-section">
            <h4>品质与详情</h4>
            <div class="form-grid form-grid-2">
              <label class="form-group"><span>认证信息</span><input v-model="form.certificationsText" class="form-input" placeholder="绿色食品,有机认证（逗号分隔）" /></label>
              <label class="form-group"><span>质量报告地址</span><input v-model="form.qualityReportUrl" class="form-input" placeholder="https://..." /></label>
            </div>
            <label class="form-group"><span>商品描述</span><textarea v-model="form.description" rows="4" class="form-input" placeholder="填写商品特点、种植/加工方式和交付说明"></textarea></label>
            <label class="form-group"><span>视频地址</span><input v-model="form.videoUrl" class="form-input" placeholder="可选，https://..." /></label>
          </section>

          <section class="form-section">
            <h4>商品图片 *</h4>
            <div class="upload-box">
              <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden @change="handleFiles" />
              <button type="button" class="upload-btn" :disabled="uploading" @click="fileInput?.click()">{{ uploading ? '上传中…' : '选择图片' }}</button>
              <span>首张为主图，最多 9 张，单张不超过 5MB</span>
            </div>
            <div v-if="form.images.length" class="image-grid">
              <div v-for="(image, index) in form.images" :key="image" class="image-item" :class="{ main: index === 0 }">
                <img :src="image" alt="商品图片" />
                <span>{{ index === 0 ? '主图' : `详情图 ${index}` }}</span>
                <button type="button" @click="removeImage(index)">删除</button>
              </div>
            </div>
          </section>
        </div>

        <div class="modal-footer">
          <button class="btn btn-cancel" @click="closeModal">取消</button>
          <button class="btn btn-primary" :disabled="saving || uploading" @click="saveProduct">{{ saving ? '保存中…' : '保存并发布到官网' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import {
  createTradeProduct,
  getTradeCategoryOptions,
  getTradeProductManageDetail,
  getTradeProductManageList,
  getTradeSellerOptions,
  updateTradeProduct,
  updateTradeProductStatus,
  uploadTradeProductImage,
} from '../../utils/api'

const tableData = ref([])
const categories = ref([])
const sellers = ref([])
const pageNum = ref(1)
const pageSize = ref(10)
const total = ref(0)
const loading = ref(false)
const saving = ref(false)
const uploading = ref(false)
const modalVisible = ref(false)
const fileInput = ref(null)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const searchForm = reactive({ keyword: '', categoryId: '', publishStatus: '', status: '' })

const emptyForm = () => ({
  id: null, productCode: '', productName: '', categoryId: '', categoryName: '', sellerId: '', sellerName: '',
  barcode: '', variety: '', originProvince: '', originCity: '', originDistrict: '', originAddress: '',
  specLevel: '', qualityLevel: '', specSize: '', harvestBatchNo: '', unit: '箱',
  stockQuantity: '', price: '', priceMin: '', priceMax: '', priceType: 'fixed', minOrderQuantity: 1,
  certificationsText: '', qualityReportUrl: '', description: '', videoUrl: '', images: [], status: 1,
})
const form = reactive(emptyForm())

const money = (value) => Number(value ?? 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
const publishLabel = (status) => ({ published: '已发布', pending: '待审核', draft: '草稿', rejected: '已驳回' }[status] || status)

const loadOptions = async () => {
  const [categoryRes, sellerRes] = await Promise.all([getTradeCategoryOptions(), getTradeSellerOptions()])
  if (categoryRes.code === 200) categories.value = categoryRes.data ?? []
  if (sellerRes.code === 200) {
    const map = new Map()
    for (const item of sellerRes.data?.records ?? []) {
      if (item.sellerId && item.sellerName) map.set(item.sellerId, item)
    }
    sellers.value = Array.from(map.values())
  }
}

const loadData = async () => {
  loading.value = true
  try {
    const response = await getTradeProductManageList({
      pageNum: pageNum.value, pageSize: pageSize.value, keyword: searchForm.keyword,
      categoryId: searchForm.categoryId, publishStatus: searchForm.publishStatus, status: searchForm.status,
    })
    if (response.code === 200) {
      tableData.value = response.data.records ?? []
      total.value = Number(response.data.total ?? 0)
    } else message.error(response.message || '加载商品失败')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载商品失败')
  } finally {
    loading.value = false
  }
}

const handleCurrentChange = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    pageNum.value = page
    loadData()
  }
}

const resetForm = () => Object.assign(form, emptyForm())
const openCreateModal = () => { resetForm(); modalVisible.value = true }
const closeModal = () => { modalVisible.value = false }
const syncCategoryName = () => {
  form.categoryName = categories.value.find((item) => String(item.id) === String(form.categoryId))?.categoryName || ''
}
const syncSellerName = () => {
  form.sellerName = sellers.value.find((item) => String(item.sellerId) === String(form.sellerId))?.sellerName || ''
}

const editProduct = async (id) => {
  try {
    const response = await getTradeProductManageDetail(id)
    if (response.code !== 200) return message.error(response.message || '读取商品失败')
    const item = response.data
    Object.assign(form, {
      ...item,
      categoryId: String(item.categoryId ?? ''),
      sellerId: String(item.sellerId ?? ''),
      certificationsText: (item.certifications ?? []).join(','),
      images: item.images ?? [],
    })
    modalVisible.value = true
  } catch {
    message.error('读取商品失败')
  }
}

const handleFiles = async (event) => {
  const files = Array.from(event.target.files ?? [])
  event.target.value = ''
  if (form.images.length + files.length > 9) return message.warning('商品图片最多 9 张')
  uploading.value = true
  try {
    for (const file of files) {
      const response = await uploadTradeProductImage(file)
      if (response.code !== 200 || !response.data?.url) throw new Error(response.message || '图片上传失败')
      form.images.push(response.data.url)
    }
    message.success(`已上传 ${files.length} 张图片`)
  } catch (error) {
    message.error(error instanceof Error ? error.message : '图片上传失败')
  } finally {
    uploading.value = false
  }
}

const removeImage = (index) => form.images.splice(index, 1)

const validateForm = () => {
  const required = [
    [form.productName, '商品名称'], [form.categoryId, '商品分类'], [form.sellerId, '供应商'],
    [form.unit, '计量单位'], [form.price, '销售单价'], [form.stockQuantity, '库存数量'], [form.minOrderQuantity, '起订量'],
  ]
  const missing = required.find(([value]) => value === '' || value === null || value === undefined)
  if (missing) return `请填写${missing[1]}`
  if (Number(form.price) <= 0) return '销售单价必须大于 0'
  if (Number(form.stockQuantity) < 0) return '库存不能小于 0'
  if (Number(form.minOrderQuantity) <= 0) return '起订量必须大于 0'
  if (!form.images.length) return '请至少上传一张商品图片'
  return ''
}

const saveProduct = async () => {
  const error = validateForm()
  if (error) return message.warning(error)
  syncCategoryName()
  syncSellerName()
  saving.value = true
  try {
    const payload = {
      ...form,
      stockQuantity: Number(form.stockQuantity),
      price: Number(form.price),
      priceMin: form.priceMin === '' ? null : Number(form.priceMin),
      priceMax: form.priceMax === '' ? null : Number(form.priceMax),
      minOrderQuantity: Number(form.minOrderQuantity),
      categoryId: Number(form.categoryId),
      sellerId: form.sellerId,
      certifications: form.certificationsText.split(/[,，]/).map((item) => item.trim()).filter(Boolean),
    }
    const response = form.id ? await updateTradeProduct(form.id, payload) : await createTradeProduct(payload)
    if (response.code !== 200) return message.error(response.message || '保存失败')
    const createdUrl = response.data?.portalUrl
    message.success(form.id ? '商品已更新并同步到官网' : '商品已发布到官网')
    closeModal()
    await loadData()
    if (!form.id && createdUrl) window.open(createdUrl, '_blank')
  } catch (err) {
    message.error(err instanceof Error ? err.message : '保存失败')
  } finally {
    saving.value = false
  }
}

const toggleStatus = async (product) => {
  try {
    const response = await updateTradeProductStatus(product.id, product.status === 1 ? 0 : 1)
    if (response.code === 200) {
      message.success(product.status === 1 ? '商品已禁用' : '商品已启用')
      loadData()
    } else message.error(response.message || '操作失败')
  } catch {
    message.error('操作失败')
  }
}

const viewPortal = (product) => window.open(product.portalUrl, '_blank')

onMounted(async () => {
  await loadOptions()
  await loadData()
})
</script>

<style scoped>
.product-list { padding: 20px; }
.page-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; gap:16px; }
.header-left h1 { margin:0; color:#2d3748; font-size:24px; font-weight:650; }
.header-left p { margin:5px 0 0; color:#8492a6; font-size:13px; }
.add-btn { display:flex; align-items:center; gap:8px; border:none; border-radius:8px; padding:10px 18px; color:#fff; background:linear-gradient(135deg,#238636,#2ea043); font-size:14px; cursor:pointer; }
.search-bar { display:flex; gap:12px; margin-bottom:18px; }
.search-group { display:flex; flex:1; }
.search-input,.filter-select,.form-input,.form-select { border:1px solid #e2e8f0; border-radius:8px; background:#fff; box-sizing:border-box; }
.search-input { flex:1; min-width:0; padding:10px 14px; border-radius:8px 0 0 8px; outline:none; }
.search-btn { padding:10px 22px; border:1px solid #e2e8f0; border-left:none; border-radius:0 8px 8px 0; color:#238636; background:#fff; cursor:pointer; }
.filter-group { display:flex; gap:10px; flex-wrap:wrap; }
.filter-select { min-width:145px; padding:10px 12px; color:#4a5568; }
.table-card { overflow-x:auto; border-radius:12px; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.08); }
.data-table { width:100%; min-width:1120px; border-collapse:collapse; }
.data-table th,.data-table td { padding:13px 14px; border-bottom:1px solid #eef2f5; text-align:left; font-size:13px; }
.data-table th { color:#526173; background:#f8fafc; font-weight:650; }
.product-thumb { width:58px; height:58px; border-radius:8px; object-fit:cover; background:#f1f5f3; }
.product-thumb.placeholder { display:grid; place-items:center; color:#9aa7b3; font-size:11px; }
.cell-sub { margin-top:4px; color:#8a96a3; font-size:11px; }
.price-cell { color:#d33e43; font-weight:700; }
.price-cell span { margin-left:3px; color:#8a96a3; font-size:10px; font-weight:400; }
.type-badge,.status-badge { display:inline-block; padding:4px 9px; border-radius:999px; font-size:11px; }
.type-badge { color:#238636; background:#eaf7ee; }
.status-badge.active { color:#238636; background:#eaf7ee; }
.status-badge.inactive { color:#7a8691; background:#f1f4f6; }
.status-badge.pending { color:#b7791f; background:#fff8e7; }
.action-cell { display:flex; gap:6px; white-space:nowrap; }
.action-btn { border:none; border-radius:5px; padding:6px 9px; font-size:11px; cursor:pointer; }
.action-btn.view { color:#2878c7; background:#eef6ff; }
.action-btn.edit { color:#b7791f; background:#fff8e7; }
.action-btn.disable { color:#c53030; background:#fff0f0; }
.action-btn.enable { color:#238636; background:#eaf7ee; }
.empty-row { padding:42px !important; color:#8a96a3 !important; text-align:center !important; }
.pagination { display:flex; align-items:center; justify-content:center; gap:14px; padding:18px; color:#8a96a3; font-size:12px; }
.page-btn { padding:7px 13px; border:1px solid #e2e8f0; border-radius:6px; background:#fff; cursor:pointer; }
.page-btn:disabled { opacity:.45; cursor:not-allowed; }
.modal-overlay { position:fixed; inset:0; z-index:1000; display:flex; align-items:center; justify-content:center; padding:24px; background:rgba(10,28,19,.55); }
.modal-content { width:min(1040px,96vw); max-height:92vh; display:flex; flex-direction:column; overflow:hidden; border-radius:14px; background:#fff; box-shadow:0 24px 70px rgba(0,0,0,.2); }
.modal-header { display:flex; align-items:flex-start; justify-content:space-between; padding:18px 22px; border-bottom:1px solid #edf1ef; }
.modal-header h3 { margin:0; color:#203128; font-size:19px; }
.modal-header p { margin:5px 0 0; color:#8a96a3; font-size:11.5px; }
.close-btn { border:none; color:#8a96a3; background:transparent; font-size:25px; cursor:pointer; }
.modal-body { padding:20px 22px; overflow-y:auto; }
.form-section { margin-bottom:22px; padding-bottom:18px; border-bottom:1px dashed #e5ece8; }
.form-section:last-child { margin-bottom:0; border-bottom:none; }
.form-section h4 { margin:0 0 14px; color:#2f493b; font-size:14px; }
.form-grid { display:grid; gap:13px; }
.form-grid-2 { grid-template-columns:repeat(2,minmax(0,1fr)); }
.form-grid-3 { grid-template-columns:repeat(3,minmax(0,1fr)); }
.form-grid-4 { grid-template-columns:repeat(4,minmax(0,1fr)); }
.form-group { display:flex; flex-direction:column; gap:6px; min-width:0; margin-bottom:12px; }
.form-group > span { color:#526173; font-size:12px; font-weight:600; }
.form-input,.form-select { width:100%; padding:9px 11px; color:#33453b; outline:none; font:inherit; font-size:12.5px; }
textarea.form-input { resize:vertical; line-height:1.7; }
.upload-box { display:flex; align-items:center; gap:12px; padding:13px; border:1px dashed #b9d8c8; border-radius:9px; background:#f6fbf8; }
.upload-box span { color:#8a96a3; font-size:11px; }
.upload-btn { padding:8px 14px; border:1px solid #238636; border-radius:7px; color:#238636; background:#fff; cursor:pointer; }
.image-grid { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; margin-top:12px; }
.image-item { position:relative; overflow:hidden; border:1px solid #e2e8f0; border-radius:9px; background:#f8fafc; }
.image-item.main { border:2px solid #238636; }
.image-item img { width:100%; height:100px; object-fit:cover; display:block; }
.image-item span { display:block; padding:5px 7px; color:#526173; font-size:10px; }
.image-item button { position:absolute; top:5px; right:5px; border:none; border-radius:5px; padding:3px 6px; color:#fff; background:rgba(0,0,0,.55); font-size:10px; cursor:pointer; }
.modal-footer { display:flex; justify-content:flex-end; gap:10px; padding:14px 22px; border-top:1px solid #edf1ef; background:#fbfdfc; }
.btn { padding:9px 17px; border:none; border-radius:7px; cursor:pointer; font-size:13px; }
.btn-cancel { color:#526173; background:#edf1ef; }
.btn-primary { color:#fff; background:linear-gradient(135deg,#238636,#2ea043); }
.btn:disabled,.upload-btn:disabled { opacity:.55; cursor:not-allowed; }
@media(max-width:900px){.form-grid-3,.form-grid-4{grid-template-columns:repeat(2,minmax(0,1fr))}.image-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:620px){.product-list{padding:12px}.page-header,.search-bar{flex-direction:column}.search-group{width:100%}.filter-group{width:100%}.form-grid-2,.form-grid-3,.form-grid-4{grid-template-columns:1fr}.image-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.modal-overlay{padding:8px}.modal-body{padding:16px}}
</style>
