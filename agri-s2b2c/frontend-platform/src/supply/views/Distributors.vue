<template>
  <div class="distributors-page">
    <div class="page-head">
      <div>
        <h2>分销商列表</h2>
        <p>选中你商品并形成授权的商家；渠道经营归属商家端，本页只做供货侧授权视图。</p>
      </div>
    </div>

    <AgriElementListTable
      :columns="columns"
      :data="filteredRows"
      row-key="channelId"
      :loading="loading"
      client-pagination
      column-settings-storage-key="agri-s2b2c-platform:supply-distributors"
      empty-text="还没有渠道选中平台货源商品"
      @refresh="load"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="2" :loading="loading" @search="applyFilter" @reset="resetFilter">
          <div class="agri-vue-filter-field">
            <label>商家名称/ID</label>
            <el-input v-model="draft.keyword" placeholder="搜索店铺名或渠道 ID" clearable @keyup.enter="applyFilter" />
          </div>
          <div class="agri-vue-filter-field">
            <label>等级</label>
            <el-select v-model="draft.grade" placeholder="全部">
              <el-option label="全部" value="" />
              <el-option label="铜牌" value="LEVEL_1" />
              <el-option label="银牌" value="LEVEL_2" />
              <el-option label="金牌" value="LEVEL_3" />
            </el-select>
          </div>
        </AgriVueFilterBar>
      </template>

      <template #cell-shop="{ row }">
        <b>{{ row.shopName || '未命名渠道' }}</b><br><small>{{ row.channelId }}</small>
      </template>
      <template #cell-grade="{ row }"><el-tag>{{ gradeText(row.grade) }}</el-tag></template>
      <template #cell-gmv30="{ row }">¥{{ money(row.gmv30) }}</template>
      <template #cell-actions="{ row }">
        <AgriVueRowActions :actions="[{ key: 'detail', label: '详情与授权', onClick: () => $router.push(`/supply/distributor-detail/${row.channelId}`) }]" />
      </template>
    </AgriElementListTable>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { AgriElementListTable, AgriVueFilterBar, AgriVueRowActions } from '@agri/shared/vue/element'
import { supplierApi } from '../api'

const rows = ref([])
const loading = ref(false)
const draft = reactive({ keyword: '', grade: '' })
const activeFilter = reactive({ keyword: '', grade: '' })

const columns = [
  { key: 'shop', prop: 'shopName', label: '商家', minWidth: 180 },
  { key: 'grade', prop: 'grade', label: '等级', width: 100 },
  { key: 'activeCount', prop: 'activeCount', label: '在售授权', width: 110 },
  { key: 'revokedCount', prop: 'revokedCount', label: '已撤销', width: 100 },
  { key: 'orders30', prop: 'orders30', label: '30 天订单', width: 110 },
  { key: 'gmv30', prop: 'gmv30', label: '30 天 GMV', width: 120 },
  { key: 'lastOrderTime', prop: 'lastOrderTime', label: '最近成交', width: 180 },
  { key: 'actions', label: '操作', width: 120 },
]

const filteredRows = computed(() => {
  const kw = activeFilter.keyword.trim().toLowerCase()
  return rows.value.filter((row) => {
    if (activeFilter.grade && row.grade !== activeFilter.grade) return false
    if (kw && !`${row.shopName || ''} ${row.channelId || ''}`.toLowerCase().includes(kw)) return false
    return true
  })
})

onMounted(load)

async function load() {
  loading.value = true
  try {
    rows.value = (await supplierApi.getChannels()) || []
  } catch (e) {
    rows.value = []
    ElMessage.error(e?.message || '分销网络读取失败')
  } finally {
    loading.value = false
  }
}

function applyFilter() {
  activeFilter.keyword = draft.keyword
  activeFilter.grade = draft.grade
}

function resetFilter() {
  draft.keyword = ''
  draft.grade = ''
  activeFilter.keyword = ''
  activeFilter.grade = ''
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
