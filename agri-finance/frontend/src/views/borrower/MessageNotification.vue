<template>
  <section class="finance-page">
    <header class="finance-page-heading">
      <div>
        <small>NOTIFICATIONS</small>
        <h1>消息通知</h1>
        <p>审批进度、还款提醒、质押处理和合同签署动态统一汇总。</p>
      </div>
      <div class="finance-page-heading-actions">
        <el-button class="finance-ghost-button" :disabled="!unreadCount" @click="markAllRead">全部已读</el-button>
      </div>
    </header>

    <div class="message-summary">
      <div><span>未读消息</span><strong>{{ unreadCount }}<em> 条</em></strong></div>
      <div><span>审批通知</span><strong>{{ typeCount('LOAN') }}<em> 条</em></strong></div>
      <div><span>还款提醒</span><strong>{{ typeCount('REPAYMENT') }}<em> 条</em></strong></div>
      <div><span>质押通知</span><strong>{{ typeCount('PLEDGE') }}<em> 条</em></strong></div>
    </div>

    <section class="finance-card message-card">
      <div class="finance-card-head">
        <div class="finance-tabs">
          <button v-for="item in filters" :key="item.key" type="button" :class="{ on: activeFilter === item.key }" @click="activeFilter = item.key">
            {{ item.label }}
            <i v-if="item.key === 'unread' && unreadCount">{{ unreadCount }}</i>
          </button>
        </div>
        <small>{{ filteredMessages.length }} 条消息</small>
      </div>
      <div v-if="filteredMessages.length" class="message-list">
        <article v-for="item in filteredMessages" :key="item.id" :class="{ unread: !item.isRead }" @click="markRead(item)">
          <span :class="['message-type-icon', messageTone(item)]">
            <Bell v-if="item.messageType === 'LOAN'" />
            <Wallet v-else-if="item.messageType === 'REPAYMENT'" />
            <Box v-else />
          </span>
          <div class="message-main">
            <div><strong>{{ item.title }}</strong><FinanceStatus :value="item.priority" /></div>
            <p>{{ item.content }}</p>
            <span>{{ typeLabel(item.messageType) }} · {{ shortDate(item.createdAt) }}</span>
          </div>
          <i v-if="!item.isRead" class="message-unread-dot" />
        </article>
      </div>
      <div v-else class="finance-empty">
        <strong>暂无匹配消息</strong>
        <p>融资审批、还款和合同状态变化后，平台会在这里通知你。</p>
      </div>
    </section>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Bell, Box, Wallet } from '@element-plus/icons-vue'
import FinanceStatus from '@/components/FinanceStatus.vue'
import { financeApi, shortDate } from '@/api/finance'

const messages = ref([])
const activeFilter = ref('all')
const filters = [
  { key: 'all', label: '全部' },
  { key: 'unread', label: '未读' },
  { key: 'loan', label: '审批通知' },
  { key: 'repayment', label: '还款提醒' },
  { key: 'pledge', label: '质押通知' },
]

const unreadCount = computed(() => messages.value.filter((item) => !item.isRead).length)
const filteredMessages = computed(() => {
  if (activeFilter.value === 'unread') return messages.value.filter((item) => !item.isRead)
  if (activeFilter.value === 'loan') return messages.value.filter((item) => item.messageType === 'LOAN')
  if (activeFilter.value === 'repayment') return messages.value.filter((item) => item.messageType === 'REPAYMENT')
  if (activeFilter.value === 'pledge') return messages.value.filter((item) => item.messageType === 'PLEDGE')
  return messages.value
})

function typeCount(type) {
  return messages.value.filter((item) => item.messageType === type).length
}

function typeLabel(type) {
  return { LOAN: '审批通知', REPAYMENT: '还款提醒', PLEDGE: '质押通知' }[type] || '系统通知'
}

function messageTone(item) {
  if (item.priority === 'HIGH') return 'red'
  if (item.messageType === 'REPAYMENT') return 'amber'
  if (item.messageType === 'PLEDGE') return 'blue'
  return 'green'
}

async function markRead(item) {
  if (item.isRead) return
  try {
    await financeApi.markMessageRead(item.id)
    item.isRead = true
  } catch (err) {
    ElMessage.error(err.message || '消息状态更新失败')
  }
}

async function markAllRead() {
  try {
    await financeApi.markAllMessagesRead()
    messages.value.forEach((item) => { item.isRead = true })
    ElMessage.success('全部消息已标记为已读')
  } catch (err) {
    ElMessage.error(err.message || '操作失败')
  }
}

async function load() {
  try {
    messages.value = (await financeApi.messages()) || []
  } catch (err) {
    ElMessage.error(err.message || '消息加载失败')
  }
}

onMounted(load)
</script>

<style scoped>
.message-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  overflow: hidden;
  border: 1px solid var(--fin-line);
  border-radius: 14px;
  background: #fff;
}

.message-summary > div {
  padding: 15px 17px;
  border-left: 1px solid #edf2ee;
}

.message-summary > div:first-child { border-left: 0; }
.message-summary span, .message-summary strong { display: block; }
.message-summary span { color: #85958c; font-size: 8px; }
.message-summary strong { margin-top: 4px; color: #244e36; font-family: ui-monospace, Consolas, monospace; font-size: 18px; }
.message-summary em { color: #697d70; font-size: 9px; font-style: normal; }

.message-card { min-height: 260px; }
.finance-tabs button i {
  display: inline-grid;
  min-width: 15px;
  height: 15px;
  place-items: center;
  margin-left: 4px;
  padding: 0 3px;
  border-radius: 99px;
  background: #e2a72f;
  color: #3d2900;
  font-size: 7px;
  font-style: normal;
}

.message-list { display: grid; }
.message-list article {
  position: relative;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  align-items: center;
  gap: 11px;
  padding: 14px 16px;
  border-top: 1px solid #edf2ee;
  cursor: pointer;
}
.message-list article:first-child { border-top: 0; }
.message-list article:hover { background: #f9fcfa; }
.message-list article.unread { background: #f5fbf7; }
.message-type-icon { display: grid; width: 40px; height: 40px; place-items: center; border-radius: 11px; }
.message-type-icon svg { width: 17px; }
.message-type-icon.green { background: #e7f6ed; color: #18774d; }
.message-type-icon.amber { background: #fff3df; color: #aa680f; }
.message-type-icon.blue { background: #eaf3fa; color: #2b6d96; }
.message-type-icon.red { background: #fdecea; color: #b44c44; }
.message-main { min-width: 0; }
.message-main > div { display: flex; align-items: center; gap: 8px; }
.message-main strong { color: #344f3f; font-size: 10.5px; }
.message-main p { margin: 4px 0; color: #71857a; font-size: 8.5px; line-height: 1.55; }
.message-main > span { color: #929f97; font-size: 7.5px; }
.message-unread-dot { width: 7px; height: 7px; border-radius: 50%; background: #168052; box-shadow: 0 0 0 4px rgba(22, 128, 82, .08); }

@media (max-width: 680px) {
  .message-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .message-summary > div:nth-child(3) { border-top: 1px solid #edf2ee; border-left: 0; }
  .message-summary > div:nth-child(4) { border-top: 1px solid #edf2ee; }
}
</style>
