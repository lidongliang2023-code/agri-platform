<template>
  <div class="supply-pool-page">
    <div class="page-head">
      <div>
        <h2>可投放货源</h2>
        <p>已审核通过、可被渠道选品的商品；渠道在平台商品池中选择后形成授权关系，可在“我的分销池”查看。</p>
      </div>
      <el-button type="primary" @click="$router.push('/product-add')">新增商品</el-button>
    </div>

    <el-table :data="rows" border>
      <el-table-column prop="name" label="商品" min-width="200" />
      <el-table-column prop="categoryName" label="类目" width="110" />
      <el-table-column label="供货价" width="110"><template #default="{ row }">¥{{ money(row.price) }}</template></el-table-column>
      <el-table-column prop="stock" label="库存" width="90" />
      <el-table-column prop="sales" label="销量" width="90" />
      <el-table-column label="佣金率" width="90"><template #default="{ row }">{{ Number(row.commissionRate || 0) }}%</template></el-table-column>
      <el-table-column label="操作" width="110" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="$router.push(`/product-edit/${row.id}`)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!rows.length" description="暂无已审核商品，先新增并等待平台审核" />
    <el-pagination v-model:current-page="page" :page-size="size" :total="total" layout="prev, pager, next, jumper" @current-change="load" />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { supplierApi } from '../api'
import { currentSupplierId } from '../api/supplierSession'

const rows = ref([])
const page = ref(1)
const size = ref(10)
const total = ref(0)

onMounted(load)

async function load() {
  try {
    const supplierId = await currentSupplierId()
    if (!supplierId) {
      rows.value = []
      total.value = 0
      return
    }
    const res = await supplierApi.getProducts({ supplierId, page: page.value, size: size.value, status: 'APPROVED' })
    rows.value = res.records || []
    total.value = res.total || 0
  } catch (e) {
    rows.value = []
    total.value = 0
    ElMessage.error(e?.message || '货源读取失败')
  }
}

const money = (value) => Number(value || 0).toFixed(2)
</script>

<style scoped>
.supply-pool-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 780px; }
</style>
