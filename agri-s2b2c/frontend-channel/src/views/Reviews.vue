<template>
  <div class="reviews-page">
    <div class="page-head">
      <div>
        <h2>评价管理</h2>
        <p>查看本渠道订单的买家评价并回复；平台可对违规评价做隐藏处理。</p>
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
      column-settings-storage-key="agri-s2b2c-channel:reviews"
      empty-text="暂无评价"
      @page-change="handlePageChange"
      @refresh="load"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="2" :loading="loading" @search="search" @reset="reset">
          <div class="agri-vue-filter-field">
            <label>评分</label>
            <el-select v-model="rating" placeholder="全部">
              <el-option label="全部" value="" />
              <el-option v-for="n in [5, 4, 3, 2, 1]" :key="n" :label="`${n} 星`" :value="String(n)" />
            </el-select>
          </div>
          <div class="agri-vue-filter-field">
            <label>回复状态</label>
            <el-select v-model="replied" placeholder="全部">
              <el-option label="全部" value="" />
              <el-option label="未回复" value="false" />
              <el-option label="已回复" value="true" />
            </el-select>
          </div>
        </AgriVueFilterBar>
      </template>

      <template #cell-rating="{ row }"><span class="stars">{{ '★'.repeat(row.rating || 0) }}</span></template>
      <template #cell-buyer="{ row }">{{ row.anonymous ? '匿名用户' : (row.nickname || '买家') }}</template>
      <template #cell-actions="{ row }">
        <AgriVueRowActions
          v-if="!row.reply"
          :actions="[{ key: 'reply', label: '回复', onClick: () => openReply(row) }]"
        />
        <span v-else class="muted">已回复</span>
      </template>
    </AgriElementListTable>

    <el-dialog v-model="replyVisible" title="回复评价" width="520px">
      <p class="muted">商品：{{ current?.productName }}；评价：{{ current?.content }}</p>
      <el-input v-model="replyText" type="textarea" :rows="4" maxlength="1000" show-word-limit placeholder="填写回复内容" />
      <template #footer>
        <el-button @click="replyVisible = false">取消</el-button>
        <el-button type="primary" :loading="replying" @click="submitReply">提交回复</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { AgriElementListTable, AgriVueFilterBar, AgriVueRowActions } from '@agri/shared/vue/element'
import { channelApi } from '../api'

const rows = ref([])
const loading = ref(false)
const page = ref(1)
const size = ref(20)
const total = ref(0)
const rating = ref('')
const replied = ref('')
const replyVisible = ref(false)
const replyText = ref('')
const current = ref(null)
const replying = ref(false)

const columns = [
  { key: 'productName', prop: 'productName', label: '商品', minWidth: 180 },
  { key: 'orderNo', prop: 'orderNo', label: '订单号', minWidth: 180 },
  { key: 'rating', prop: 'rating', label: '评分', width: 100 },
  { key: 'content', prop: 'content', label: '评价内容', minWidth: 220 },
  { key: 'buyer', prop: 'nickname', label: '买家', width: 110 },
  { key: 'reply', prop: 'reply', label: '商家回复', minWidth: 180 },
  { key: 'createTime', prop: 'createTime', label: '评价时间', width: 180 },
  { key: 'actions', label: '操作', width: 100 },
]

onMounted(load)

async function load() {
  loading.value = true
  try {
    const data = await channelApi.getReviews({
      rating: rating.value === '' ? undefined : Number(rating.value),
      replied: replied.value === '' ? undefined : replied.value === 'true',
      page: page.value,
      size: size.value,
    })
    rows.value = data?.records || []
    total.value = Number(data?.total ?? rows.value.length)
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
  rating.value = ''
  replied.value = ''
  page.value = 1
  load()
}

function handlePageChange(nextPage, nextSize) {
  page.value = nextPage
  size.value = nextSize
  load()
}

function openReply(row) {
  current.value = row
  replyText.value = ''
  replyVisible.value = true
}

async function submitReply() {
  if (!replyText.value.trim()) return ElMessage.warning('请填写回复内容')
  replying.value = true
  try {
    const res = await channelApi.replyReview(current.value.id, replyText.value.trim())
    if (res?.success === false) return ElMessage.error(res.message || '回复失败')
    ElMessage.success('回复已提交')
    replyVisible.value = false
    await load()
  } catch (e) {
    ElMessage.error(e?.message || '回复失败')
  } finally {
    replying.value = false
  }
}
</script>

<style scoped>
.reviews-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 760px; }
.muted { color: #84938a; font-size: 12px; }
.stars { color: #e6a23c; letter-spacing: 1px; }
</style>
