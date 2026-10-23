<template>
  <div class="product-edit-page">
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
      <el-form-item label="商品详情" prop="detail">
        <el-input v-model="form.detail" type="textarea" :rows="5" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="submitForm">保存修改</el-button>
        <el-button @click="goBack">取消</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
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
  supplierId: 1,
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
  detail: ''
})

const rules = {
  name: [{ required: true, message: '请输入商品名称', trigger: 'blur' }],
  categoryId: [{ required: true, message: '请选择分类', trigger: 'blur' }],
  price: [{ required: true, message: '请输入价格', trigger: 'blur' }],
  stock: [{ required: true, message: '请输入库存', trigger: 'blur' }]
}

onMounted(() => {
  loadProduct()
})

const loadProduct = async () => {
  const res = await supplierApi.getDetail(route.params.id)
  Object.assign(form, res)
}

const submitForm = async () => {
  formRef.value.validate(async (valid) => {
    if (valid) {
      const res = await supplierApi.updateProduct(form)
      if (res.success) {
        alert('商品更新成功')
        router.push('/products')
      }
    }
  })
}

const goBack = () => {
  router.push('/products')
}
</script>

<style scoped>
.product-edit-page {
  background: #fff;
  border-radius: 12px;
  padding: 30px;
}
</style>