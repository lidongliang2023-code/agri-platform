<template>
  <div class="notice-settings-page">
    <div class="page-head">
      <div>
        <h2>协同与通知设置</h2>
        <p>仅控制站内通知是否落库；短信、企业微信与推送通道尚未接入，本页不做开关承诺。</p>
      </div>
    </div>

    <AgriElementListTable
      :columns="columns"
      :data="rows"
      row-key="noticeType"
      :loading="loading"
      client-pagination
      column-settings-storage-key="agri-s2b2c-platform:supply-notice-settings"
      empty-text="暂无通知配置项"
      @refresh="load"
    >
      <template #cell-enabled="{ row }">
        <el-switch v-model="row.enabled" @change="(value) => save(row, value)" />
      </template>
      <template #cell-desc="{ row }">{{ descriptions[row.noticeType] || '—' }}</template>
    </AgriElementListTable>

    <div class="card">
      <h3>边界说明</h3>
      <ul>
        <li>关闭后对应事件不再写入站内通知；已产生的通知保留，可在铃铛中查看。</li>
        <li>通知仅落本系统站内信，不发短信/企微/小程序订阅消息。</li>
        <li>订单与发货状态不受通知开关影响。</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { AgriElementListTable } from '@agri/shared/vue/element'
import { supplierApi } from '../api'

const rows = ref([])
const loading = ref(false)
const descriptions = {
  ORDER_CREATED: '有新订单/新渠道订单时提醒',
  SHIP_PROPOSED: '对方提交发货信息待确认',
  SHIP_CONFIRMED: '发货信息被对方确认',
  SHIP_REJECTED: '发货信息被对方驳回',
  SHIP_WITHDRAWN: '对方撤回发货信息',
}

const columns = [
  { key: 'title', prop: 'title', label: '通知类型', minWidth: 220 },
  { key: 'noticeType', prop: 'noticeType', label: '事件编码', width: 220 },
  { key: 'enabled', prop: 'enabled', label: '站内通知', width: 130, align: 'center' },
  { key: 'desc', label: '说明', minWidth: 240 },
]

onMounted(load)

async function load() {
  loading.value = true
  try {
    rows.value = (await supplierApi.getNoticePreferences()) || []
  } catch (e) {
    rows.value = []
    ElMessage.error(e?.message || '通知偏好读取失败')
  } finally {
    loading.value = false
  }
}

async function save(row, enabled) {
  try {
    const res = await supplierApi.updateNoticePreference({ noticeType: row.noticeType, enabled })
    if (res?.success === false) {
      ElMessage.error(res.message || '保存失败')
      row.enabled = !enabled
      return
    }
    ElMessage.success(enabled ? '已开启该通知' : '已关闭该通知')
  } catch (e) {
    row.enabled = !enabled
    ElMessage.error(e?.message || '保存失败')
  }
}
</script>

<style scoped>
.notice-settings-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 800px; }
.card { padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.card h3 { margin: 0 0 10px; font-size: 15px; }
.card ul { margin: 0; padding-left: 18px; color: #52665a; font-size: 13px; line-height: 1.9; }
</style>
