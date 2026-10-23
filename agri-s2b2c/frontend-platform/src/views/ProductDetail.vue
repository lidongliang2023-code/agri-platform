<template>
  <div class="product-detail-page">
    <el-button @click="goBack">返回</el-button>
    <div class="detail-card" v-if="product">
      <h2>商品详情</h2>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="商品名称">{{ product.name }}</el-descriptions-item>
        <el-descriptions-item label="商品卖点">{{ product.sellingPoint || '-' }}</el-descriptions-item>
        <el-descriptions-item label="分类">{{ product.categoryName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="供应商">{{ product.supplierName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="产地">{{ product.origin || '-' }}</el-descriptions-item>
        <el-descriptions-item label="规格">{{ product.spec || '-' }}</el-descriptions-item>
        <el-descriptions-item label="等级">{{ product.grade || '-' }}</el-descriptions-item>
        <el-descriptions-item label="单位">{{ product.unit || '-' }}</el-descriptions-item>
        <el-descriptions-item label="价格">{{ product.price }}</el-descriptions-item>
        <el-descriptions-item label="原价">{{ product.originalPrice || '-' }}</el-descriptions-item>
        <el-descriptions-item label="成本价">{{ product.costPrice || '-' }}</el-descriptions-item>
        <el-descriptions-item label="库存">{{ product.stock }}</el-descriptions-item>
        <el-descriptions-item label="库存预警">{{ product.stockWarning }}</el-descriptions-item>
        <el-descriptions-item label="佣金比例">{{ product.commissionRate }}%</el-descriptions-item>
        <el-descriptions-item label="认证信息">{{ product.certifications || '-' }}</el-descriptions-item>
        <el-descriptions-item label="保质期">{{ product.shelfLife || '-' }}</el-descriptions-item>
        <el-descriptions-item label="配送时间">{{ product.deliveryTime || '-' }}</el-descriptions-item>
        <el-descriptions-item label="销量">{{ product.sales }}</el-descriptions-item>
        <el-descriptions-item label="审核状态">
          <el-tag :type="getStatusType(product.status)">{{ getStatusText(product.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="审核意见">{{ product.auditOpinion || '-' }}</el-descriptions-item>
        <el-descriptions-item label="审核时间">{{ product.auditTime || '-' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ product.createTime }}</el-descriptions-item>
      </el-descriptions>
      <div class="actions" v-if="product.status === 'PENDING'">
        <el-button type="primary" @click="audit('APPROVED')">通过</el-button>
        <el-button type="danger" @click="audit('REJECTED')">拒绝</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { platformApi } from '../api'

const router = useRouter()
const route = useRoute()
const product = ref(null)

onMounted(() => {
  loadProduct()
})

const loadProduct = async () => {
  const res = await platformApi.getProductDetail(route.params.id)
  product.value = res
}

const getStatusType = (status) => {
  const types = { 'PENDING': 'warning', 'APPROVED': 'success', 'REJECTED': 'danger' }
  return types[status] || 'default'
}

const getStatusText = (status) => {
  const texts = { 'PENDING': '待审核', 'APPROVED': '已通过', 'REJECTED': '已拒绝' }
  return texts[status] || status
}

const goBack = () => {
  router.push('/products')
}

const audit = async (status) => {
  const opinion = status === 'REJECTED' ? prompt('请输入审核意见') : ''
  const res = await platformApi.auditProduct({
    id: route.params.id,
    status: status,
    opinion: opinion
  })
  if (res.success) {
    alert('审核成功')
    loadProduct()
  }
}
</script>

<style scoped>
.product-detail-page {
  background: #fff;
  border-radius: 12px;
  padding: 30px;
}

.detail-card h2 {
  margin-bottom: 30px;
}

.actions {
  margin-top: 30px;
  display: flex;
  gap: 15px;
}
</style>