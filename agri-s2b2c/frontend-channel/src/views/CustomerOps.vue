<template>
  <div class="customer-ops-page">
    <div class="page-head">
      <div>
        <h2>客户运营与社群</h2>
        <p>基于本渠道真实订单的客户分层与名单导出；站内信/短信/企业微信触达由用户中心与外部企微承接，本页不发送消息。</p>
      </div>
      <div class="head-actions">
        <el-button :loading="exporting" @click="exportCsv">导出客户名单</el-button>
        <el-button @click="$router.push('/customers')">客户列表</el-button>
      </div>
    </div>

    <div class="stat-row">
      <div class="stat-card"><span>客户总数</span><b>{{ summary.total || 0 }}</b><small>有过支付订单</small></div>
      <div class="stat-card"><span>复购率</span><b>{{ Number(summary.repeatRate || 0).toFixed(1) }}%</b><small>下单 ≥ 2 次客户占比</small></div>
      <div class="stat-card"><span>高价值客户</span><b>{{ summary.highValue || 0 }}</b><small>累计 ≥ ¥500 或 ≥5 单</small></div>
      <div class="stat-card"><span>沉睡客户</span><b>{{ summary.sleeping || 0 }}</b><small>30 天未下单</small></div>
      <div class="stat-card"><span>累计消费</span><b>¥{{ money(summary.totalSpend) }}</b><small>非取消订单</small></div>
      <div class="stat-card"><span>平均消费</span><b>¥{{ money(summary.avgAmount) }}</b><small>累计 / 客户数</small></div>
    </div>

    <div class="segment-grid">
      <div v-for="segment in segments" :key="segment.layer" class="segment-card">
        <div class="segment-head">
          <b>{{ segment.name }}</b>
          <el-tag :type="segment.type">{{ segment.count }} 人</el-tag>
        </div>
        <p>{{ segment.desc }}</p>
        <p class="action">建议：{{ segment.action }}</p>
        <el-button link type="primary" @click="$router.push({ path: '/customers', query: { layer: segment.layer } })">查看名单</el-button>
      </div>
    </div>

    <div class="card">
      <h3>运营说明</h3>
      <ul>
        <li>分层口径与客户列表一致：新客（1 单）、活跃客（≥2 单且 30 天内有单）、高价值（累计 ≥¥500 或 ≥5 单）、沉睡客（30 天无单）。</li>
        <li>导出为当前渠道客户 CSV（手机号脱敏），用于线下回访；不包含跨渠道客户数据。</li>
        <li>企微社群、短信、站内信与自动化触达未接入，页面不提供“发送”按钮，避免假动作。</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { channelApi } from '../api'

const summary = ref({})
const exporting = ref(false)

const segments = computed(() => [
  { layer: 'NEW', name: '新客', count: summary.value.newCount || 0, type: 'info',
    desc: '仅下过 1 单，需完成首单体验。', action: '发货后回访，引导收藏/复购。' },
  { layer: 'ACTIVE', name: '活跃客', count: summary.value.activeCount || 0, type: 'primary',
    desc: '≥2 单且 30 天内有成交。', action: '保持上新提醒，推荐关联品类。' },
  { layer: 'HIGH_VALUE', name: '高价值客户', count: summary.value.highValue || 0, type: 'success',
    desc: '累计 ≥¥500 或 ≥5 单。', action: '优先服务与专属选品，避免流失。' },
  { layer: 'SLEEPING', name: '沉睡客户', count: summary.value.sleeping || 0, type: 'warning',
    desc: '30 天没有下单。', action: '人工回访，了解断购原因。' },
])

onMounted(load)

async function load() {
  try {
    const data = (await channelApi.getCustomers({ page: 1, size: 1 })) || {}
    summary.value = data.summary || {}
  } catch (e) {
    ElMessage.error(e?.message || '客户运营数据读取失败')
  }
}

async function exportCsv() {
  exporting.value = true
  try {
    const data = (await channelApi.getCustomers({ page: 1, size: 1000 })) || {}
    const rows = data.records || []
    if (!rows.length) {
      ElMessage.warning('暂无可导出的客户')
      return
    }
    const header = ['客户ID', '昵称', '手机号', '分层', '下单次数', '累计消费', '客单价', '最近下单']
    const layerText = { NEW: '新客', ACTIVE: '活跃客', HIGH_VALUE: '高价值', SLEEPING: '沉睡客' }
    const lines = [header.join(',')]
    for (const row of rows) {
      lines.push([
        row.consumerId, row.name, row.phone, layerText[row.layer] || row.layer,
        row.orderCount, row.totalAmount, row.avgAmount, row.lastOrderTime,
      ].map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
    }
    const blob = new Blob([`\ufeff${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    link.href = url
    link.download = `channel-customers-${stamp}.csv`
    link.click()
    URL.revokeObjectURL(url)
    ElMessage.success(`已导出 ${rows.length} 位客户`)
  } catch (e) {
    ElMessage.error(e?.message || '导出失败')
  } finally {
    exporting.value = false
  }
}

const money = (value) => Number(value || 0).toFixed(2)
</script>

<style scoped>
.customer-ops-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 820px; }
.head-actions { display: flex; gap: 8px; }
.stat-row { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; }
.stat-card { display: flex; flex-direction: column; gap: 6px; padding: 14px 16px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.stat-card span { color: #84938a; font-size: 12px; }
.stat-card b { color: #173e2a; font-size: 20px; }
.stat-card small { color: #94a198; font-size: var(--agri-font-size-micro); }
.segment-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.segment-card { padding: 16px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; display: flex; flex-direction: column; gap: 8px; }
.segment-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.segment-head b { color: #173e2a; font-size: 15px; }
.segment-card p { margin: 0; color: #6b7c72; font-size: 12px; line-height: 1.6; }
.segment-card .action { color: #a96a08; }
.card { padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.card h3 { margin: 0 0 10px; font-size: 15px; }
.card ul { margin: 0; padding-left: 18px; color: #52665a; font-size: 13px; line-height: 1.9; }
@media (max-width: 1200px) { .stat-row { grid-template-columns: repeat(3, 1fr); } .segment-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
