<template>
  <div class="risk-rules-page">
    <div class="page-head">
      <div>
        <h2>风控规则</h2>
        <p>规则用于计算风险信号并提示人工复核；系统不自动拦截、扣款或拉黑。阈值修改后立即影响事件计算。</p>
      </div>
    </div>

    <AgriElementListTable
      :columns="columns"
      :data="filteredRows"
      row-key="code"
      :loading="loading"
      client-pagination
      column-settings-storage-key="agri-s2b2c-platform:risk-rules"
      empty-text="暂无风控规则"
      @refresh="load"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="2" :loading="loading" @search="applyFilter" @reset="resetFilter">
          <div class="agri-vue-filter-field">
            <label>规则名称/编码</label>
            <el-input v-model="draft.keyword" placeholder="搜索规则编码或名称" clearable @keyup.enter="applyFilter" />
          </div>
          <div class="agri-vue-filter-field">
            <label>状态</label>
            <el-select v-model="draft.status" placeholder="全部">
              <el-option label="全部" value="" />
              <el-option label="启用" value="ACTIVE" />
              <el-option label="停用" value="DISABLED" />
            </el-select>
          </div>
        </AgriVueFilterBar>
      </template>

      <template #cell-threshold="{ row }">
        <el-input-number v-model="row.threshold" :min="0" :precision="0" size="small" style="width: 105px" />
        <span class="unit">{{ row.unit }}</span>
      </template>
      <template #cell-level="{ row }">
        <el-tag :type="row.level === 'HIGH' ? 'danger' : 'warning'">{{ row.level === 'HIGH' ? '高危' : '中风险' }}</el-tag>
      </template>
      <template #cell-status="{ row }">
        <el-switch v-model="row.status" active-value="ACTIVE" inactive-value="DISABLED" active-text="启用" inactive-text="停用" />
      </template>
      <template #cell-actions="{ row }">
        <AgriVueRowActions :actions="[{ key: 'save', label: '保存', onClick: () => save(row) }]" />
      </template>
    </AgriElementListTable>

    <p class="note">规则说明：高退款买家/渠道售后率用于提示复核；秒拍秒退需核对物流签收时间；低价仅提示调价，不自动下架。</p>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { AgriElementListTable, AgriVueFilterBar, AgriVueRowActions } from '@agri/shared/vue/element'
import { platformApi } from '../api'

const rows = ref([])
const loading = ref(false)
const draft = reactive({ keyword: '', status: '' })
const activeFilter = reactive({ keyword: '', status: '' })

const columns = [
  { key: 'code', prop: 'code', label: '规则编码', width: 210 },
  { key: 'name', prop: 'name', label: '规则', minWidth: 200 },
  { key: 'threshold', prop: 'threshold', label: '阈值', width: 190 },
  { key: 'level', prop: 'level', label: '等级', width: 100 },
  { key: 'status', prop: 'status', label: '状态', width: 130 },
  { key: 'actionNote', prop: 'actionNote', label: '处置建议', minWidth: 200 },
  { key: 'actions', label: '操作', width: 100 },
]

const filteredRows = computed(() => {
  const kw = activeFilter.keyword.trim().toLowerCase()
  return rows.value.filter((row) => {
    if (activeFilter.status && row.status !== activeFilter.status) return false
    if (kw && !`${row.code || ''} ${row.name || ''}`.toLowerCase().includes(kw)) return false
    return true
  })
})

onMounted(load)

async function load() {
  loading.value = true
  try {
    rows.value = (await platformApi.getRiskRules()) || []
  } catch (e) {
    rows.value = []
    ElMessage.error(e?.message || '风控规则读取失败')
  } finally {
    loading.value = false
  }
}

function applyFilter() {
  activeFilter.keyword = draft.keyword
  activeFilter.status = draft.status
}

function resetFilter() {
  draft.keyword = ''
  draft.status = ''
  activeFilter.keyword = ''
  activeFilter.status = ''
}

async function save(row) {
  try {
    const res = await platformApi.updateRiskRule(row.code, { threshold: row.threshold, status: row.status })
    if (res?.success === false) {
      ElMessage.error(res.message || '保存失败')
      return
    }
    ElMessage.success('规则已更新')
    await load()
  } catch (e) {
    ElMessage.error(e?.message || '保存失败')
  }
}
</script>

<style scoped>
.risk-rules-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 820px; }
.unit { margin-left: 8px; color: #84938a; font-size: 12px; }
.note { margin: 0; color: #84938a; font-size: 12px; line-height: 1.7; }
</style>
