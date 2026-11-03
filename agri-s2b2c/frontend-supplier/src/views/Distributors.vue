<template>
  <div class="distributors-page">
    <div class="page-head">
      <div>
        <h2>分销商列表</h2>
        <p>选中你商品并形成授权的渠道商；渠道经营归属渠道端，本页只做供货侧授权视图。</p>
      </div>
      <el-button @click="load">刷新</el-button>
    </div>

    <el-table :data="rows" border>
      <el-table-column label="渠道商" min-width="180">
        <template #default="{ row }">
          <b>{{ row.shopName || '未命名渠道' }}</b><br><small>{{ row.channelId }}</small>
        </template>
      </el-table-column>
      <el-table-column label="等级" width="100">
        <template #default="{ row }"><el-tag>{{ gradeText(row.grade) }}</el-tag></template>
      </el-table-column>
      <el-table-column prop="activeCount" label="在售授权" width="110" />
      <el-table-column prop="revokedCount" label="已撤销" width="100" />
      <el-table-column prop="orders30" label="30 天订单" width="110" />
      <el-table-column label="30 天 GMV" width="120">
        <template #default="{ row }">¥{{ money(row.gmv30) }}</template>
      </el-table-column>
      <el-table-column prop="lastOrderTime" label="最近成交" width="180" />
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="$router.push(`/distributor-detail/${row.channelId}`)">详情与授权</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!rows.length" description="还没有渠道选中你的商品" />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { supplierApi } from '../api'

const rows = ref([])

onMounted(load)

async function load() {
  try {
    rows.value = (await supplierApi.getChannels()) || []
  } catch (e) {
    rows.value = []
    ElMessage.error(e?.message || '分销网络读取失败')
  }
}

const money = (value) => Number(value || 0).toFixed(2)
const gradeText = (value) => ({ LEVEL_1: '铜牌', LEVEL_2: '银牌', LEVEL_3: '金牌' }[value] || value || '未定级')
</script>

<style scoped>
.distributors-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 780px; }
</style>
