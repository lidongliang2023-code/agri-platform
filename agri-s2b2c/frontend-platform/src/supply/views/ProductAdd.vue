<template>
  <div class="product-add-page">
    <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
      <el-form-item label="商品名称" prop="name">
        <el-input v-model="form.name" />
      </el-form-item>
      <el-form-item label="商品卖点" prop="sellingPoint">
        <el-input v-model="form.sellingPoint" />
      </el-form-item>
      <el-form-item label="分类" prop="categoryId">
        <el-select v-model="form.categoryId" placeholder="请选择分类">
          <el-option v-for="cat in categories" :key="cat.id" :label="cat.name" :value="cat.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="产地" prop="origin">
        <el-input v-model="form.origin" />
      </el-form-item>
      <el-form-item label="规格" prop="spec">
        <el-input v-model="form.spec" />
      </el-form-item>
      <el-form-item label="等级" prop="grade">
        <el-input v-model="form.grade" />
      </el-form-item>
      <el-form-item label="价格" prop="price">
        <el-input v-model.number="form.price" type="number" />
      </el-form-item>
      <el-form-item label="原价" prop="originalPrice">
        <el-input v-model.number="form.originalPrice" type="number" />
      </el-form-item>
      <el-form-item label="成本价" prop="costPrice">
        <el-input v-model.number="form.costPrice" type="number" />
      </el-form-item>
      <el-form-item label="库存" prop="stock">
        <el-input v-model.number="form.stock" type="number" />
      </el-form-item>
      <el-form-item label="库存预警" prop="stockWarning">
        <el-input v-model.number="form.stockWarning" type="number" />
      </el-form-item>
      <el-form-item label="佣金比例" prop="commissionRate">
        <el-input v-model.number="form.commissionRate" type="number" />
        <span style="margin-left: 10px">%</span>
      </el-form-item>
      <el-form-item label="商品图片" prop="images">
        <el-upload
          :action="uploadUrl"
          list-type="picture-card"
          :on-success="handleUpload"
          :file-list="imageList"
        >
          <el-icon><Plus /></el-icon>
        </el-upload>
      </el-form-item>
      <el-form-item label="认证信息" prop="certifications">
        <el-input v-model="form.certifications" />
      </el-form-item>
      <el-form-item label="溯源批次" prop="prodBatchNo">
        <el-select
          v-model="form.prodBatchNo"
          clearable
          filterable
          placeholder="选择本经营主体在生产管理模块登记的采收批次（可留空，稍后在编辑页补绑）"
          :loading="batchLoading"
          style="width: 100%"
          @visible-change="loadBatches"
        >
          <el-option
            v-for="b in batches"
            :key="b.batchNo"
            :value="b.batchNo"
            :label="`${b.batchNo} · ${b.cropName || '未填作物'}${b.grade ? ' / ' + b.grade + '级' : ''} · 采收 ${b.harvestDate || '未填'}`"
          />
        </el-select>
        <div class="batch-hint">
          绑定的作用：消费者详情页的种植-采收-加工链路按这个批次向生产管理模块实查。
          请核对批次作物与商品一致——同一主体下多个基地多品种时，选错就是给错来历。
        </div>
      </el-form-item>
      <el-form-item label="商品详情" prop="detail">
        <el-input v-model="form.detail" type="textarea" :rows="5" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="submitForm">提交审核</el-button>
        <el-button @click="goBack">取消</el-button>
        <span v-if="saveError" class="batch-error">{{ saveError }}</span>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Plus } from '@element-plus/icons-vue'
import { supplierApi } from '../api'
import { currentSupplierId } from '../api/supplierSession'

const router = useRouter()
const formRef = ref(null)
const uploadUrl = '/api/upload'

const categories = ref([])
onMounted(async () => {
  try { categories.value = (await supplierApi.getCategories()) || [] }
  catch (e) { saveError.value = '商品类目读取失败' }
})

const imageList = ref([])

const form = reactive({
  supplierId: null,
  name: '',
  sellingPoint: '',
  categoryId: null,
  origin: '',
  spec: '',
  grade: '',
  price: null,
  originalPrice: null,
  costPrice: null,
  stock: 0,
  stockWarning: 10,
  commissionRate: 10,
  images: '[]',
  certifications: '',
  prodBatchNo: '',
  detail: ''
})

const batches = ref([])
const batchLoading = ref(false)
const saveError = ref('')

const loadBatches = async (open) => {
  if (!open || batches.value.length) return
  batchLoading.value = true
  try {
    const res = await supplierApi.getProductionBatches()
    batches.value = res?.records ?? []
  } catch (e) {
    batches.value = []
    saveError.value = e?.response?.data?.message || '可绑定批次取不到（生产管理模块不可达？）'
  } finally {
    batchLoading.value = false
  }
}

const rules = {
  name: [{ required: true, message: '请输入商品名称', trigger: 'blur' }],
  categoryId: [{ required: true, message: '请选择分类', trigger: 'blur' }],
  price: [{ required: true, message: '请输入价格', trigger: 'blur' }],
  stock: [{ required: true, message: '请输入库存', trigger: 'blur' }]
}

const handleUpload = (res) => {
  imageList.value.push({ url: res.url })
  form.images = JSON.stringify(imageList.value.map(item => item.url))
}

const submitForm = async () => {
  formRef.value.validate(async (valid) => {
    if (!valid) return
    saveError.value = ''
    try {
      form.supplierId = await currentSupplierId()
      const res = await supplierApi.createProduct(form)
      if (res.success) {
        alert('商品创建成功，等待审核')
        router.push('/supply/products')
      } else {
        // 原来这里只认 success、失败什么都不说：绑定校验被拒时页面看起来像"点了没反应"
        saveError.value = res.message || '商品创建失败'
      }
    } catch (e) {
      saveError.value = e?.response?.data?.message || '提交失败：请求未被接受'
    }
  })
}

const goBack = () => {
  router.push('/supply/products')
}
</script>

<style scoped>
.product-add-page {
  background: #fff;
  border-radius: 12px;
  padding: 30px;
}

.batch-hint {
  margin-top: 6px;
  color: #718277;
  font-size: var(--agri-font-size-aux, 13px);
  line-height: 1.6;
}

.batch-error {
  margin-left: 12px;
  color: #c54b4b;
  font-size: var(--agri-font-size-aux, 13px);
}
</style>