<template>
  <div class="price-page">
    <div class="page-head">
      <div>
        <h2>价格与价盘</h2>
        <p>供货价来自交易撮合；渠道成交价取渠道分销价（未设为商品价）。供应商可设零售价区间与省级限售；全量巡检会把低于底价的渠道货架自动下架并留痕。</p>
      </div>
    </div>

    <div class="stat-row">
      <div class="stat-card"><span>监控商品</span><b>{{ total }}</b><small>已审核通过</small></div>
      <div class="stat-card"><span>低于供货价</span><b class="danger">{{ belowCount }}</b><small>渠道售价 &lt; 供货价</small></div>
      <div class="stat-card"><span>高加价</span><b class="warn">{{ highCount }}</b><small>渠道售价 &gt; 供货价 3 倍</small></div>
      <div class="stat-card"><span>今日巡检下架</span><b class="danger">{{ todayOffShelf }}</b><small>低于底价的渠道货架</small></div>
    </div>

    <AgriElementListTable
      :columns="priceColumns"
      :data="filtered"
      :row-key="(row) => String(row.id ?? row.productId ?? row.name)"
      :loading="loading"
      client-pagination
      column-settings-storage-key="agri-s2b2c-platform:price-center"
      empty-text="没有符合条件的商品"
      @refresh="reload"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="2" :loading="loading" @search="load" @reset="reset">
          <div class="agri-vue-filter-field">
            <label>商品</label>
            <el-input v-model="keyword" placeholder="搜索商品" clearable @keyup.enter="load" />
          </div>
          <div class="agri-vue-filter-field">
            <label>异常类型</label>
            <el-select v-model="anomaly" placeholder="全部">
              <el-option label="全部" value="" />
              <el-option label="仅异常" value="ANY" />
              <el-option label="低于供货价" value="BELOW_SUPPLY" />
              <el-option label="高加价" value="HIGH_MARKUP" />
            </el-select>
          </div>
        </AgriVueFilterBar>
      </template>

      <template #toolbar-left>
        <el-button type="primary" :loading="scanning" @click="scan">全量巡检</el-button>
      </template>

      <template #cell-price="{ row }">¥{{ money(row.price) }}</template>
      <template #cell-limitPrice="{ row }">
        <span v-if="row.minRetailPrice != null || row.maxRetailPrice != null">
          ¥{{ row.minRetailPrice != null ? money(row.minRetailPrice) : '—' }}
          ~ ¥{{ row.maxRetailPrice != null ? money(row.maxRetailPrice) : '—' }}
        </span>
        <span v-else class="muted">未设置</span>
      </template>
      <template #cell-regionNames="{ row }">
        <span v-if="!row.regionNames?.length" class="muted">全国</span>
        <span v-else>{{ row.regionNames.join('、') }}</span>
      </template>
      <template #cell-retailRange="{ row }">
        <span v-if="row.minRetail != null">¥{{ money(row.minRetail) }} ~ ¥{{ money(row.maxRetail) }}</span>
        <span v-else class="muted">未上架</span>
      </template>
      <template #cell-belowSupplyCount="{ row }">
        <el-tag v-if="row.belowSupplyCount > 0" type="danger">{{ row.belowSupplyCount }} 个渠道</el-tag>
        <span v-else class="muted">—</span>
      </template>
      <template #cell-anomaly="{ row }">
        <el-tag :type="anomalyType(row.anomaly)">{{ anomalyText(row.anomaly) }}</el-tag>
      </template>
    </AgriElementListTable>

    <p class="note">说明：巡检只下架低于底价（max(供货价, 供应商最低限价)）的渠道货架，不改价、不撤销授权；高于供货价 3 倍仅标记。定时任务每天 08:30 执行，可用 agri.s2b2c.price-guard.cron 调整。</p>

    <AgriElementListTable
      :columns="guardColumns"
      :data="guardRecords"
      :row-key="(row) => String(row.id ?? `${row.productName}-${row.channelName}-${row.createTime}`)"
      :loading="loading"
      client-pagination
      :page-size="10"
      column-settings-storage-key="agri-s2b2c-platform:price-guard-records"
      empty-text="暂无巡检记录"
      @refresh="loadGuardRecords"
    >
      <template #toolbar-left>
        <div class="section-title">
          <h3>最近巡检记录</h3>
          <span class="muted">今日下架 {{ todayOffShelf }} 个货架</span>
        </div>
      </template>
      <template #cell-createTime="{ row }">{{ formatTime(row.createTime) }}</template>
      <template #cell-pricePair="{ row }">¥{{ money(row.retailPrice) }} / ¥{{ money(row.floorPrice) }}</template>
      <template #cell-triggerSource="{ row }">
        <el-tag size="small" :type="triggerType(row.triggerSource)">{{ triggerText(row.triggerSource) }}</el-tag>
      </template>
    </AgriElementListTable>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { AgriElementListTable, AgriVueFilterBar } from '@agri/shared/vue/element'
import { platformApi } from '../api'

const keyword = ref('')
const anomaly = ref('')
const rows = ref([])
const total = ref(0)
const loading = ref(false)
const scanning = ref(false)
const guardRecords = ref([])
const todayOffShelf = ref(0)

const priceColumns = [
  { key: 'name', prop: 'name', label: '商品', minWidth: 200 },
  { key: 'categoryName', prop: 'categoryName', label: '类目', width: 110 },
  { key: 'supplierName', prop: 'supplierName', label: '供应商', minWidth: 140 },
  { key: 'price', prop: 'price', label: '供货价', width: 100 },
  { key: 'limitPrice', label: '供应商限价', width: 150 },
  { key: 'regionNames', label: '限售区域', width: 170 },
  { key: 'listingCount', prop: 'listingCount', label: '渠道上架', width: 95 },
  { key: 'onShelfCount', prop: 'onShelfCount', label: '在售', width: 80 },
  { key: 'retailRange', label: '渠道价区间', width: 150 },
  { key: 'belowSupplyCount', prop: 'belowSupplyCount', label: '低于供货价', width: 110 },
  { key: 'anomaly', prop: 'anomaly', label: '判定', width: 120 },
]

const guardColumns = [
  { key: 'createTime', prop: 'createTime', label: '时间', width: 170 },
  { key: 'productName', prop: 'productName', label: '商品', minWidth: 180 },
  { key: 'supplierName', prop: 'supplierName', label: '供应商', minWidth: 130 },
  { key: 'channelName', prop: 'channelName', label: '渠道', minWidth: 130 },
  { key: 'pricePair', label: '渠道价 / 底价', width: 150 },
  { key: 'triggerSource', prop: 'triggerSource', label: '触发方式', width: 115 },
]

const filtered = computed(() => rows.value.filter((row) => {
  if (!anomaly.value) return true
  if (anomaly.value === 'ANY') return row.anomaly !== 'OK'
  return row.anomaly === anomaly.value
}))
const belowCount = computed(() => rows.value.filter((row) => row.anomaly === 'BELOW_SUPPLY').length)
const highCount = computed(() => rows.value.filter((row) => row.anomaly === 'HIGH_MARKUP').length)

onMounted(reload)

async function reload() {
  loading.value = true
  try {
    await Promise.all([load(), loadGuardRecords()])
  } finally {
    loading.value = false
  }
}

async function load() {
  loading.value = true
  try {
    const data = (await platformApi.getPriceCenter(keyword.value.trim() || undefined)) || {}
    rows.value = data.records || []
    total.value = data.total || rows.value.length
  } catch (e) {
    rows.value = []
    total.value = 0
    ElMessage.error(e?.message || '价盘数据读取失败')
  } finally {
    loading.value = false
  }
}

function reset() {
  keyword.value = ''
  anomaly.value = ''
  load()
}

async function loadGuardRecords() {
  try {
    const data = (await platformApi.getPriceGuardRecords(50)) || {}
    guardRecords.value = data.records || []
    todayOffShelf.value = Number(data.todayOffShelf || 0)
  } catch {
    guardRecords.value = []
    todayOffShelf.value = 0
  }
}

async function scan() {
  scanning.value = true
  try {
    const res = await platformApi.scanPriceGuard()
    if (res?.success === false) return ElMessage.error(res.message || '巡检失败')
    ElMessage.success(res?.message || '巡检完成')
    await reload()
  } catch (e) {
    ElMessage.error(e?.message || '巡检失败')
  } finally {
    scanning.value = false
  }
}

const money = (value) => Number(value || 0).toFixed(2)
const formatTime = (value) => String(value || '').replace('T', ' ').slice(0, 19)
const triggerText = (value) => ({ MANUAL: '手动巡检', RULE: '规则保存', PRODUCT_UPDATE: '商品更新', SCHEDULED: '每日巡检' }[value] || value || '—')
const triggerType = (value) => ({ MANUAL: 'primary', RULE: 'warning', PRODUCT_UPDATE: 'info', SCHEDULED: 'success' }[value] || 'info')
const anomalyText = (value) => ({ OK: '正常', BELOW_SUPPLY: '低于供货价', HIGH_MARKUP: '高加价' }[value] || value)
const anomalyType = (value) => ({ OK: 'success', BELOW_SUPPLY: 'danger', HIGH_MARKUP: 'warning' }[value] || 'info')
</script>

<style scoped>
.price-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 820px; }
.stat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; max-width: 1000px; }
.stat-card { display: flex; flex-direction: column; gap: 6px; padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.stat-card span { color: #84938a; font-size: 12px; }
.stat-card b { color: #173e2a; font-size: 24px; }
.stat-card b.danger { color: #c54b4b; }
.stat-card b.warn { color: #a96a08; }
.stat-card small { color: #94a198; font-size: 12px; }
.section-title { display: flex; align-items: baseline; gap: 10px; }
.section-title h3 { margin: 0; font-size: 15px; color: #173e2a; }
.muted { color: #94a198; font-size: 12px; }
.note { margin: 0; color: #84938a; font-size: 12px; line-height: 1.7; }
</style>
