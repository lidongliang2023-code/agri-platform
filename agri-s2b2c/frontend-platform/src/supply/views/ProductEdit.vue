<template>
  <div class="product-edit-page">
    <!-- 档案没读到就锁住保存：读回来的字段不全，写回去等于把没显示的列清空（溯源批次就是这么被抹掉过一次的） -->
    <p v-if="loadError" class="batch-error">{{ loadError }} —— 商品档案没有读到，已锁住保存，请返回列表重新进入。</p>
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
      <el-form-item label="认证信息" prop="certifications">
        <el-input v-model="form.certifications" />
      </el-form-item>
      <el-form-item label="溯源批次" prop="prodBatchNo">
        <el-select
          v-model="form.prodBatchNo"
          clearable
          filterable
          placeholder="选择本经营主体在生产管理模块登记的采收批次"
          :loading="batchLoading"
          style="width: 100%"
          @visible-change="loadBatches"
          @change="onBatchChange"
        >
          <el-option
            v-for="b in batches"
            :key="b.batchNo"
            :value="b.batchNo"
            :label="`${b.batchNo} · ${b.cropName || '未填作物'}${b.grade ? ' / ' + b.grade + '级' : ''} · 采收 ${b.harvestDate || '未填'}`"
          />
        </el-select>
        <div class="batch-hint">
          <template v-if="traceHint">{{ traceHint }}</template>
          <template v-else>
            链路内容（种植 / 采收 / 加工 / 质检 / 仓储）由生产管理模块持有，这里只做绑定；
            不绑定则消费者详情页显示"尚未绑定生产批次"，商城不会代填批次内容。
          </template>
        </div>
      </el-form-item>
      <el-form-item label="商品详情" prop="detail">
        <el-input v-model="form.detail" type="textarea" :rows="5" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="saving" :disabled="Boolean(loadError)" @click="submitForm">保存修改</el-button>
        <el-button @click="goBack">取消</el-button>
        <span v-if="saveError" class="batch-error">{{ saveError }}</span>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { supplierApi } from '../api'

const router = useRouter()
const route = useRoute()
const formRef = ref(null)

const categories = ref([
  { id: 7, name: '大米' },
  { id: 8, name: '面粉' },
  { id: 9, name: '食用油' },
  { id: 10, name: '调味品' },
  { id: 11, name: '时令蔬菜' },
  { id: 12, name: '新鲜水果' },
  { id: 14, name: '猪肉' },
  { id: 16, name: '鲜蛋' },
  { id: 17, name: '绿茶' },
  { id: 18, name: '红茶' }
])

const form = reactive({
  id: null,
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
  certifications: '',
  prodBatchNo: '',
  detail: ''
})

const batches = ref([])
const batchLoading = ref(false)
const traceHint = ref('')
const saving = ref(false)
const saveError = ref('')
const loadError = ref('')

const rules = {
  name: [{ required: true, message: '请输入商品名称', trigger: 'blur' }],
  categoryId: [{ required: true, message: '请选择分类', trigger: 'blur' }],
  price: [{ required: true, message: '请输入价格', trigger: 'blur' }],
  stock: [{ required: true, message: '请输入库存', trigger: 'blur' }]
}

onMounted(() => {
  loadProduct()
})

/*
 * 同一路由换参数（/product-edit/3 → /product-edit/1）不会重新挂载组件，onMounted 只跑一次。
 * 不盯着 params.id 重新读档案，表单就会带着上一条商品的（或读失败后的空）状态继续显示，
 * 这时保存写的是当前 URL 那件商品——两份档案错拼成一次提交。
 */
watch(() => route.params.id, (next) => {
  if (next) loadProduct()
})

const loadProduct = async () => {
  loadError.value = ''
  try {
    // 读商品自己的档案：以前这里调的是 /supplier/detail/{id}（供应商档案），
    // 商品 id 恰好等于某个供应商 id 时会拿到别人的公司资料，表单一片空白照样能保存，
    // 于是没被读出来的列（含溯源批次）被写回默认值——读失败必须拦住写。
    const res = await supplierApi.getProduct(route.params.id)
    if (!res || !res.id) {
      loadError.value = res?.message || '没有读到这个商品的档案，请先返回列表重试'
      return
    }
    Object.assign(form, res)
    // 已绑定的批次要能看见预览；它可能不在第一页候选里，所以单独按编号取一次
    if (form.prodBatchNo) {
      await previewTrace(form.prodBatchNo)
    }
  } catch (e) {
    loadError.value = e?.response?.data?.message || '商品档案读取失败（请求未被接受）'
  }
}

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

const onBatchChange = async (value) => {
  saveError.value = ''
  traceHint.value = ''
  if (value) await previewTrace(value)
}

const previewTrace = async (batchNo) => {
  try {
    const t = await supplierApi.previewBatchTrace(batchNo)
    const stages = t?.stages ?? []
    const has = (key) => stages.includes(key)
    traceHint.value = has('planting') || has('harvest') || has('process')
      ? `该批次在生产管理模块有 ${t.nodeCount ?? 0} 个节点：`
        + `种植${has('planting') ? '✓' : '缺'}、采收${has('harvest') ? '✓' : '缺'}、`
        + `加工${has('process') ? '✓' : '缺'}、质检${has('inspect') ? '✓' : '缺'}；`
        + `链上存证 ${t.onChainCount ?? 0}/${t.nodeCount ?? 0}。${t.conclusion ?? ''}`
      : '该批次在生产管理模块还没有链路节点，绑上后消费者也看不到内容——请先去生产管理补登记。'
  } catch (e) {
    traceHint.value = e?.response?.data?.message || '链路预览失败'
  }
}

const submitForm = async () => {
  formRef.value.validate(async (valid) => {
    if (!valid) return
    saving.value = true
    saveError.value = ''
    try {
      const res = await supplierApi.updateProduct(form)
      if (res.success) {
        // 回显服务端记录的绑定值：解绑是否真的落库，不能靠"我以为提交了"
        form.prodBatchNo = res.prodBatchNo ?? ''
        alert('商品更新成功')
        router.push('/supply/products')
      } else {
        saveError.value = res.message || '商品更新失败'
      }
    } catch (e) {
      saveError.value = e?.response?.data?.message || '保存失败：请求未被接受'
    } finally {
      saving.value = false
    }
  })
}

const goBack = () => {
  router.push('/supply/products')
}
</script>

<style scoped>
.product-edit-page {
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