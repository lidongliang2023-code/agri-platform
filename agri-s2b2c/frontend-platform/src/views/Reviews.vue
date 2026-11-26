<template>
  <div class="reviews-page">
    <div class="page-head">
      <div>
        <h2>评价审核</h2>
        <p>平台查看全量买家评价，对违规或失实评价做隐藏处理；供应商与渠道可在各自工作台回复评价。</p>
      </div>
    </div>

    <AgriElementListTable
      :columns="columns"
      :data="rows"
      row-key="id"
      :loading="loading"
      :page="page"
      :page-size="size"
      :total="total"
      column-settings-storage-key="agri-s2b2c-platform:reviews"
      empty-text="当前筛选下暂无评价"
      @page-change="handlePageChange"
      @refresh="load"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="2" :loading="loading" @search="search" @reset="reset">
          <div class="agri-vue-filter-field">
            <label>展示状态</label>
            <el-select v-model="hidden" placeholder="全部">
              <el-option label="全部" value="" />
              <el-option label="展示中" value="false" />
              <el-option label="已隐藏" value="true" />
            </el-select>
          </div>
          <div class="agri-vue-filter-field">
            <label>评分</label>
            <el-select v-model="rating" placeholder="全部评分">
              <el-option label="全部评分" value="" />
              <el-option v-for="n in [5, 4, 3, 2, 1]" :key="n" :label="`${n} 星`" :value="String(n)" />
            </el-select>
          </div>
        </AgriVueFilterBar>
      </template>

      <template #cell-channelName="{ row }">{{ row.channelName || '平台直营' }}</template>
      <template #cell-rating="{ row }"><span class="stars">{{ '★'.repeat(row.rating || 0) }}</span></template>
      <template #cell-buyer="{ row }">{{ row.anonymous ? '匿名用户' : (row.nickname || '买家') }}</template>
      <template #cell-reply="{ row }">
        <span v-if="row.reply">{{ row.reply }}</span>
        <span v-else class="muted">未回复</span>
      </template>
      <template #cell-status="{ row }">
        <el-tag :type="row.hidden ? 'info' : 'success'">{{ row.hidden ? '已隐藏' : '展示中' }}</el-tag>
      </template>
      <template #cell-actions="{ row }">
        <AgriVueRowActions
          :actions="row.hidden
            ? [{ key: 'show', label: '恢复', onClick: () => toggle(row, false) }]
            : [{ key: 'hide', label: '隐藏', danger: true, onClick: () => toggle(row, true) }]"
        />
      </template>
    </AgriElementListTable>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { AgriElementListTable, AgriVueFilterBar, AgriVueRowActions } from '@agri/shared/vue/element'
import { platformApi } from '../api'

const rows = ref([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const size = ref(20)
const hidden = ref('')
const rating = ref('')

const columns = [
  { key: 'productName', prop: 'productName', label: '商品', minWidth: 160 },
  { key: 'supplierName', prop: 'supplierName', label: '供应商', width: 150 },
  { key: 'channelName', prop: 'channelName', label: '渠道', width: 130 },
  { key: 'orderNo', prop: 'orderNo', label: '订单号', minWidth: 170 },
  { key: 'rating', prop: 'rating', label: '评分', width: 110 },
  { key: 'content', prop: 'content', label: '评价内容', minWidth: 220 },
  { key: 'buyer', prop: 'nickname', label: '买家', width: 110 },
  { key: 'reply', prop: 'reply', label: '商家回复', minWidth: 180 },
  { key: 'createTime', prop: 'createTime', label: '评价时间', width: 170 },
  { key: 'status', prop: 'hidden', label: '状态', width: 95 },
  { key: 'actions', label: '操作', width: 95 },
]

onMounted(load)

async function load() {
  loading.value = true
  try {
    const data = await platformApi.getReviews({
      hidden: hidden.value === '' ? undefined : hidden.value === 'true',
      rating: rating.value === '' ? undefined : Number(rating.value),
      page: page.value,
      size: size.value,
    })
    rows.value = data?.records || []
    total.value = Number(data?.total || 0)
  } catch (e) {
    rows.value = []
    total.value = 0
    ElMessage.error(e?.message || '评价读取失败')
  } finally {
    loading.value = false
  }
}

function search() {
  page.value = 1
  load()
}

function reset() {
  hidden.value = ''
  rating.value = ''
  page.value = 1
  load()
}

function handlePageChange(nextPage, nextSize) {
  page.value = nextPage
  size.value = nextSize
  load()
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
.muted { color: #84938a; font-size: 12px; }
.stars { color: #e6a23c; letter-spacing: 1px; }
</style>
