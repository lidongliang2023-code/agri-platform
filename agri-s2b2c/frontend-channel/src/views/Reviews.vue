<template>
  <div class="reviews-page">
    <div class="page-head">
      <div>
        <h2>评价管理</h2>
        <p>查看本渠道订单的买家评价并回复；平台可对违规评价做隐藏处理。</p>
      </div>
      <el-button @click="load">刷新</el-button>
    </div>

    <div class="filter-bar">
      <el-select v-model="rating" placeholder="评分" style="width: 140px" @change="load">
        <el-option label="全部" :value="null" />
        <el-option v-for="n in [5,4,3,2,1]" :key="n" :label="`${n} 星`" :value="n" />
      </el-select>
      <el-select v-model="replied" placeholder="回复状态" style="width: 160px" @change="load">
        <el-option label="全部" :value="null" />
        <el-option label="未回复" :value="false" />
        <el-option label="已回复" :value="true" />
      </el-select>
    </div>

    <el-table :data="rows" border>
      <el-table-column prop="productName" label="商品" min-width="180" show-overflow-tooltip />
      <el-table-column prop="orderNo" label="订单号" min-width="180" show-overflow-tooltip />
      <el-table-column label="评分" width="90">
        <template #default="{ row }">{{ '★'.repeat(row.rating) }}</template>
      </el-table-column>
      <el-table-column prop="content" label="评价内容" min-width="220" show-overflow-tooltip />
      <el-table-column label="买家" width="110">
        <template #default="{ row }">{{ row.anonymous ? '匿名用户' : (row.nickname || '买家') }}</template>
      </el-table-column>
      <el-table-column prop="reply" label="商家回复" min-width="180" show-overflow-tooltip />
      <el-table-column prop="createTime" label="评价时间" width="180" />
      <el-table-column label="操作" width="90" fixed="right">
        <template #default="{ row }">
          <el-button v-if="!row.reply" link type="primary" @click="openReply(row)">回复</el-button>
          <span v-else class="muted">已回复</span>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!rows.length" description="暂无评价" />

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
import { channelApi } from '../api'

const rows = ref([])
const rating = ref(null)
const replied = ref(null)
const replyVisible = ref(false)
const replyText = ref('')
const current = ref(null)
const replying = ref(false)

onMounted(load)

async function load() {
  try {
    const data = await channelApi.getReviews({
      rating: rating.value ?? undefined,
      replied: replied.value ?? undefined,
      page: 1,
      size: 50,
    })
    rows.value = data?.records || []
  } catch (e) {
    rows.value = []
    ElMessage.error(e?.message || '评价读取失败')
  }
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
.filter-bar { display: flex; gap: 10px; }
.muted { color: #84938a; font-size: 12px; }
</style>