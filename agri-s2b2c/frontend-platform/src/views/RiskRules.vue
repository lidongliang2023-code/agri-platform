<template>
  <div class="risk-rules-page">
    <div class="page-head">
      <div>
        <h2>风控规则</h2>
        <p>规则用于计算风险信号并提示人工复核；系统不自动拦截、扣款或拉黑。阈值修改后立即影响事件计算。</p>
      </div>
      <el-button @click="load">刷新</el-button>
    </div>

    <el-table :data="rows" border>
      <el-table-column prop="code" label="规则编码" width="210" />
      <el-table-column prop="name" label="规则" min-width="200" />
      <el-table-column label="阈值" width="190">
        <template #default="{ row }">
          <el-input-number v-model="row.threshold" :min="0" :precision="0" size="small" style="width: 110px" />
          <span class="unit">{{ row.unit }}</span>
        </template>
      </el-table-column>
      <el-table-column label="等级" width="100">
        <template #default="{ row }">
          <el-tag :type="row.level === 'HIGH' ? 'danger' : 'warning'">{{ row.level === 'HIGH' ? '高危' : '中风险' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="120">
        <template #default="{ row }">
          <el-switch v-model="row.status" active-value="ACTIVE" inactive-value="DISABLED" active-text="启用" inactive-text="停用" />
        </template>
      </el-table-column>
      <el-table-column prop="actionNote" label="处置建议" min-width="200" />
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="save(row)">保存</el-button>
        </template>
      </el-table-column>
    </el-table>
    <p class="note">规则说明：高退款买家/渠道售后率用于提示复核；秒拍秒退需核对物流签收时间；低价仅提示调价，不自动下架。</p>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { platformApi } from '../api'

const rows = ref([])

onMounted(load)

async function load() {
  try {
    rows.value = (await platformApi.getRiskRules()) || []
  } catch (e) {
    rows.value = []
    ElMessage.error(e?.message || '风控规则读取失败')
  }
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
