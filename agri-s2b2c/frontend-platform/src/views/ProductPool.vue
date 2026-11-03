<template>
  <div class="pool-page">
    <div class="page-head">
      <div>
        <h2>总部选品池</h2>
        <p>平台统采统建的商品池（已审核通过）；货源、供货价与类目主数据由交易撮合/主数据主责，本页只做选品视角的只读视图。</p>
      </div>
      <el-button @click="$router.push('/products')">去商品审核</el-button>
    </div>

    <div class="filter-bar">
      <el-input v-model="keyword" placeholder="搜索商品名称" style="width: 280px" clearable @keyup.enter="search" @clear="search" />
      <el-button type="primary" @click="search">查询</el-button>
      <span class="muted">共 {{ total }} 个在池商品</span>
    </div>

    <el-table :data="rows" border>
      <el-table-column prop="name" label="商品" min-width="200" />
      <el-table-column prop="categoryName" label="类目" width="120" />
      <el-table-column prop="supplierName" label="供应商" min-width="150" />
      <el-table-column label="供货价" width="110">
        <template #default="{ row }">¥{{ money(row.price) }}</template>
      </el-table-column>
      <el-table-column label="建议零售价" width="120">
        <template #default="{ row }">{{ row.originalPrice ? `¥${money(row.originalPrice)}` : '—' }}</template>
      </el-table-column>
      <el-table-column prop="stock" label="库存" width="90" />
      <el-table-column prop="sales" label="销量" width="90" />
      <el-table-column label="佣金率" width="90">
        <template #default="{ row }">{{ Number(row.commissionRate || 0) }}%</template>
      </el-table-column>
      <el-table-column label="操作" width="90" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="$router.push(`/product-detail/${row.id}`)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!rows.length" description="商品池暂无已审核商品" />
    <el-pagination
      v-model:current-page="page"
      :page-size="size"
      :total="total"
      layout="prev, pager, next, jumper"
      @current-change="load"
    />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { platformApi } from '../api'

const keyword = ref('')
const rows = ref([])
const page = ref(1)
const size = ref(10)
const total = ref(0)

onMounted(load)

async function load() {
  try {
    const res = await platformApi.getProducts({
      page: page.value,
      size: size.value,
      status: 'APPROVED',
      keyword: keyword.value.trim() || undefined,
    })
    rows.value = res.records || []
    total.value = res.total || 0
  } catch (e) {
    rows.value = []
    total.value = 0
    ElMessage.error(e?.message || '选品池读取失败')
  }
}

function search() {
  page.value = 1
  load()
}

const money = (value) => Number(value || 0).toFixed(2)
</script>

<style scoped>
.pool-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 780px; }
.filter-bar { display: flex; align-items: center; gap: 10px; }
.muted { color: #84938a; font-size: 12px; }
</style>
