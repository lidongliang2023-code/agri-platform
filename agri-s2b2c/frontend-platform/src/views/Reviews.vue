<template>
  <div class="reviews-page">
    <div class="page-head">
      <div>
        <h2>评价审核</h2>
        <p>平台查看全量买家评价，对违规或失实评价做隐藏处理；供应商与渠道可在各自工作台回复评价。</p>
      </div>
      <el-button @click="load">刷新</el-button>
    </div>

    <div class="filter-bar">
      <el-radio-group v-model="hidden" @change="load">
        <el-radio-button :value="null">全部</el-radio-button>
        <el-radio-button :value="false">展示中</el-radio-button>
        <el-radio-button :value="true">已隐藏</el-radio-button>
      </el-radio-group>
      <el-select v-model="rating" placeholder="评分" style="width: 140px" @change="load">
        <el-option label="全部评分" :value="null" />
        <el-option v-for="n in [5, 4, 3, 2, 1]" :key="n" :label="`${n} 星`" :value="n" />
      </el-select>
      <span class="muted">共 {{ total }} 条评价</span>
    </div>

    <el-table :data="rows" border>
      <el-table-column prop="productName" label="商品" min-width="160" show-overflow-tooltip />
      <el-table-column prop="supplierName" label="供应商" width="150" show-overflow-tooltip />
      <el-table-column label="渠道" width="130" show-overflow-tooltip>
        <template #default="{ row }">{{ row.channelName || '平台直营' }}</template>
      </el-table-column>
      <el-table-column prop="orderNo" label="订单号" min-width="170" show-overflow-tooltip />
      <el-table-column label="评分" width="110">
        <template #default="{ row }"><span class="stars">{{ '★'.repeat(row.rating || 0) }}</span></template>
      </el-table-column>
      <el-table-column prop="content" label="评价内容" min-width="220" show-overflow-tooltip />
      <el-table-column label="买家" width="110">
        <template #default="{ row }">{{ row.anonymous ? '匿名用户' : (row.nickname || '买家') }}</template>
      </el-table-column>
      <el-table-column label="商家回复" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          <span v-if="row.reply">{{ row.reply }}</span>
          <span v-else class="muted">未回复</span>
        </template>
      </el-table-column>
      <el-table-column prop="createTime" label="评价时间" width="170" />
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.hidden ? 'info' : 'success'">{{ row.hidden ? '已隐藏' : '展示中' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="90" fixed="right">
        <template #default="{ row }">
          <el-button v-if="!row.hidden" link type="danger" @click="toggle(row, true)">隐藏</el-button>
          <el-button v-else link type="primary" @click="toggle(row, false)">恢复</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!rows.length" description="当前筛选下暂无评价" />

    <el-pagination
      v-if="total > size"
      v-model:current-page="page"
      :page-size="size"
      :total="total"
      layout="prev, pager, next"
      @current-change="load"
    />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { platformApi } from '../api'

const rows = ref([])
const total = ref(0)
const page = ref(1)
const size = 10
const hidden = ref(null)
const rating = ref(null)

onMounted(load)

async function load() {
  try {
    const data = await platformApi.getReviews({
      hidden: hidden.value ?? undefined,
      rating: rating.value ?? undefined,
      page: page.value,
      size,
    })
    rows.value = data?.records || []
    total.value = Number(data?.total || 0)
  } catch (e) {
    rows.value = []
    total.value = 0
    ElMessage.error(e?.message || '评价读取失败')
  }
}

async function toggle(row, nextHidden) {
  try {
    await ElMessageBox.confirm(
      nextHidden ? '隐藏后买家端不再展示该评价，确认隐藏？' : '恢复后买家端将重新展示该评价，确认恢复？',
      nextHidden ? '隐藏评价' : '恢复评价',
      { confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  try {
    const res = await platformApi.hideReview(row.id, nextHidden)
    if (res?.success === false) {
      ElMessage.error(res.message || '操作失败')
      return
    }
    ElMessage.success(res?.message || '操作成功')
    await load()
  } catch (e) {
    ElMessage.error(e?.message || '操作失败')
  }
}
</script>

<style scoped>
.reviews-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 820px; }
.filter-bar { display: flex; align-items: center; gap: 16px; }
.muted { color: #84938a; font-size: 12px; }
.stars { color: #e6a23c; letter-spacing: 1px; }
</style>
