<template>
  <div class="notice-settings-page">
    <div class="page-head">
      <div>
        <h2>协同与通知设置</h2>
        <p>仅控制站内通知是否落库；短信、企业微信与推送通道尚未接入，本页不做开关承诺。</p>
      </div>
      <el-button @click="load">刷新</el-button>
    </div>

    <div class="card">
      <el-table :data="rows" border>
        <el-table-column prop="title" label="通知类型" min-width="220" />
        <el-table-column prop="noticeType" label="事件编码" width="220" />
        <el-table-column label="站内通知" width="140">
          <template #default="{ row }">
            <el-switch v-model="row.enabled" @change="(value) => save(row, value)" />
          </template>
        </el-table-column>
        <el-table-column label="说明" min-width="240">
          <template #default="{ row }">{{ descriptions[row.noticeType] || '—' }}</template>
        </el-table-column>
      </el-table>
    </div>

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
import { supplierApi } from '../api'

const rows = ref([])
const descriptions = {
  ORDER_CREATED: '有新订单/新渠道订单时提醒',
  SHIP_PROPOSED: '对方提交发货信息待确认',
  SHIP_CONFIRMED: '发货信息被对方确认',
  SHIP_REJECTED: '发货信息被对方驳回',
  SHIP_WITHDRAWN: '对方撤回发货信息',
}

onMounted(load)

async function load() {
  try {
    rows.value = (await supplierApi.getNoticePreferences()) || []
  } catch (e) {
    rows.value = []
    ElMessage.error(e?.message || '通知偏好读取失败')
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
