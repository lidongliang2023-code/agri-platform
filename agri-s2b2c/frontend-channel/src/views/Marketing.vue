<template>
  <div class="marketing-page">
    <div class="page-head">
      <div>
        <h2>营销中心</h2>
        <p>活动由平台运营统一创建；本页只展示平台券与适用于本店在架商品的秒杀/拼团，并提供店铺分享链接。</p>
      </div>
      <el-button @click="load">刷新</el-button>
    </div>

    <div class="stat-row">
      <div class="stat-card"><span>平台券</span><b>{{ summary.coupons || 0 }}</b><small>进行中</small></div>
      <div class="stat-card"><span>可用秒杀</span><b>{{ summary.flashes || 0 }}</b><small>本店商品</small></div>
      <div class="stat-card"><span>可用拼团</span><b>{{ summary.groups || 0 }}</b><small>本店商品</small></div>
      <div class="stat-card"><span>在架商品</span><b>{{ summary.shelfProducts || 0 }}</b><small>货架 ACTIVE</small></div>
    </div>

    <el-tabs v-model="tab" @tab-change="onTabChange">
      <el-tab-pane label="优惠券" name="coupon">
        <el-table :data="data.coupons || []" border>
          <el-table-column prop="name" label="优惠券" min-width="180" />
          <el-table-column label="类型/门槛" min-width="160">
            <template #default="{ row }">
              {{ row.type === 'DISCOUNT' ? `折扣 ${Number(row.discountRate || 0)} 折` : `满减 ¥${money(row.amount)}` }}
              · 满 ¥{{ money(row.minAmount) }}
            </template>
          </el-table-column>
          <el-table-column prop="remainCount" label="剩余" width="90" />
          <el-table-column label="有效期" min-width="180">
            <template #default="{ row }">{{ row.validStart }} ~ {{ row.validEnd }}</template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!(data.coupons || []).length" description="暂无进行中的平台券" :image-size="70" />
        <p class="note">平台券由平台承担或联合供应商承担，渠道不参与创建与改价。</p>
      </el-tab-pane>

      <el-tab-pane label="秒杀" name="flash">
        <el-table :data="data.flashes || []" border>
          <el-table-column prop="productName" label="商品" min-width="190" />
          <el-table-column label="秒杀价" width="100"><template #default="{ row }">¥{{ money(row.salePrice) }}</template></el-table-column>
          <el-table-column label="剩余/总库存" width="130">
            <template #default="{ row }">{{ row.remainStock }} / {{ row.totalStock }}</template>
          </el-table-column>
          <el-table-column label="时间" min-width="220">
            <template #default="{ row }">{{ row.startTime }} ~ {{ row.endTime }}</template>
          </el-table-column>
          <el-table-column label="状态" width="100"><template #default="{ row }"><el-tag>{{ row.status }}</el-tag></template></el-table-column>
        </el-table>
        <el-empty v-if="!(data.flashes || []).length" description="本店商品暂无秒杀活动" :image-size="70" />
        <p class="note">秒杀价由平台活动配置，下单时按活动价结算；售罄自动不可用。</p>
      </el-tab-pane>

      <el-tab-pane label="拼团" name="group">
        <el-table :data="data.groups || []" border>
          <el-table-column prop="name" label="活动" min-width="170" />
          <el-table-column prop="productName" label="商品" min-width="180" />
          <el-table-column label="团价 / 单买" width="160">
            <template #default="{ row }">¥{{ money(row.groupPrice) }} / ¥{{ money(row.singlePrice) }}</template>
          </el-table-column>
          <el-table-column prop="groupSize" label="成团人数" width="100" />
          <el-table-column prop="validHours" label="有效期(小时)" width="110" />
          <el-table-column label="状态" width="100"><template #default="{ row }"><el-tag>{{ row.status }}</el-tag></template></el-table-column>
        </el-table>
        <el-empty v-if="!(data.groups || []).length" description="本店商品暂无拼团活动" :image-size="70" />
      </el-tab-pane>

      <el-tab-pane label="分享推广" name="share">
        <div class="share-card">
          <h3>移动端店铺链接</h3>
          <p class="muted">复制后发到微信群/朋友圈；消费者打开即进入本店，成交归因本渠道。</p>
          <div class="share-row">
            <el-input v-model="shareLink" readonly />
            <el-button type="primary" @click="copyShare">复制链接</el-button>
          </div>
          <el-alert type="info" :closable="false" show-icon
            title="分享链接不包含追踪参数：当前仅按渠道店铺归属成交，无分销层级归因。" />
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { channelApi } from '../api'

const route = useRoute()
const router = useRouter()
const data = ref({})
const summary = ref({})
const tab = ref('coupon')

const tabByPath = {
  '/marketing/coupons': 'coupon',
  '/marketing/flash': 'flash',
  '/marketing/groups': 'group',
  '/marketing/share': 'share',
}

const shareLink = computed(() => {
  if (!data.value.storeSharePath) return ''
  return `${window.location.protocol}//${window.location.hostname}:8182/#${data.value.storeSharePath}`
})

onMounted(() => {
  tab.value = tabByPath[route.path] || 'coupon'
  load()
})

watch(() => route.path, (path) => {
  tab.value = tabByPath[path] || 'coupon'
})

async function load() {
  try {
    data.value = (await channelApi.getMarketing()) || {}
    summary.value = data.value.summary || {}
  } catch (e) {
    ElMessage.error(e?.message || '营销数据读取失败')
  }
}

function onTabChange(name) {
  const path = Object.keys(tabByPath).find((key) => tabByPath[key] === name) || '/marketing'
  router.replace(path)
}

async function copyShare() {
  if (!shareLink.value) return
  try {
    await navigator.clipboard.writeText(shareLink.value)
    ElMessage.success('店铺链接已复制')
  } catch {
    ElMessage.warning('浏览器未授权剪贴板，请手动复制')
  }
}

const money = (value) => Number(value || 0).toFixed(2)
</script>

<style scoped>
.marketing-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 800px; }
.stat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.stat-card { display: flex; flex-direction: column; gap: 6px; padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.stat-card span { color: #84938a; font-size: 12px; }
.stat-card b { color: #173e2a; font-size: 24px; }
.stat-card small { color: #94a198; font-size: 12px; }
.note { margin: 12px 0 0; color: #84938a; font-size: 12px; line-height: 1.7; }
.share-card { padding: 20px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; max-width: 820px; }
.share-card h3 { margin: 0 0 8px; font-size: 15px; }
.share-card .muted { margin: 0 0 14px; color: #84938a; font-size: 12px; }
.share-row { display: flex; gap: 10px; margin-bottom: 14px; }
@media (max-width: 1000px) { .stat-row { grid-template-columns: repeat(2, 1fr); } }
</style>
