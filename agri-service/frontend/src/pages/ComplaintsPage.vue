<template>
  <div class="page-stack">
    <PageTitle
      eyebrow="AFTER-SALES SERVICE"
      title="售后与投诉"
      description="投诉由平台质量仲裁员受理，处理结论会同步写入消息中心；本页只展示属于当前主体的工单。"
    >
      <template #actions>
        <a-button @click="app.navigate('messages')">
          <template #icon><MessageOutlined /></template>
          消息中心（{{ unreadMessagesCount }} 未读）
        </a-button>
      </template>
    </PageTitle>
    <section class="service-commitment">
      <div><FileTextOutlined /><span><b>{{ openCount }}</b><small>未办结工单</small></span></div>
      <div><FileTextOutlined /><span><b>{{ items.length }}</b><small>累计工单</small></span></div>
      <div><FileTextOutlined /><span><b>{{ resolvedCount }}</b><small>已办结</small></span></div>
    </section>
    <section class="surface-card detail-section">
      <div class="section-heading compact">
        <div><span class="section-kicker">MY TICKETS</span><h2>我的售后工单</h2></div>
        <span class="section-note">在订单详情发起售后</span>
      </div>
      <LoadingBlock v-if="loading" :rows="2" />
      <EmptyState v-else-if="items.length === 0" icon="💬" title="暂无售后工单" description="如订单出现质量、履约或结算问题，可在订单详情发起售后。">
        <template #action><a-button @click="app.navigate('orders')">去我的订单</a-button></template>
      </EmptyState>
      <div v-else class="complaint-list">
        <article v-for="item in items" :key="item.id">
          <div class="complaint-head">
            <span>{{ item.category }}</span>
            <h3>{{ item.complaintNo }}</h3>
            <small>关联订单 {{ item.orderNo }} · {{ item.createdAt }}</small>
            <em>{{ STATUS_TEXT[item.status] ?? item.status }}</em>
          </div>
          <div class="complaint-progress"><i :style="{ width: `${item.progress}%` }" /></div>
          <p>{{ item.description }}</p>
          <div class="complaint-demand"><b>诉求</b><span>{{ item.demand || '未填写' }}</span></div>
          <div class="complaint-foot">
            <span>
              当前进度：{{ STAGE_TEXT[item.progress] ?? `${item.progress}%` }}
              {{ item.handler ? ` · 处理人 ${item.handler}` : '' }}
            </span>
            <b v-if="item.resolution" class="complaint-resolution">处理结论：{{ item.resolution }}</b>
            <small v-if="noticeFor(item.complaintNo)">
              通知回执：{{ noticeFor(item.complaintNo)?.title }}（{{ noticeFor(item.complaintNo)?.createdAt }}）
            </small>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { FileTextOutlined, MessageOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { serviceApi } from '../api'
import { useAppStore } from '../app-context'
import type { Complaint, ServiceMessage } from '../types'
import EmptyState from '../components/EmptyState.vue'
import LoadingBlock from '../components/LoadingBlock.vue'
import PageTitle from '../components/PageTitle.vue'

const STATUS_TEXT: Record<string, string> = {
  pending: '待受理',
  processing: '平台处理中',
  resolved: '已办结',
}

const STAGE_TEXT: Record<number, string> = {
  15: '已提交，等待受理',
  35: '受理与事实核验',
  55: '双方协调中',
  65: '调解方案拟定',
  100: '已办结',
}

const app = useAppStore()
const items = ref<Complaint[]>([])
const messages = ref<ServiceMessage[]>([])
const loading = ref(true)

onMounted(() => {
  Promise.all([serviceApi.complaints(), serviceApi.messages()])
    .then(([tickets, inbox]) => {
      items.value = tickets
      messages.value = inbox
    })
    .catch((reason: Error) => message.error(reason.message))
    .finally(() => { loading.value = false })
})

const openCount = computed(() => items.value.filter((item) => item.status !== 'resolved').length)
const resolvedCount = computed(() => items.value.filter((item) => item.status === 'resolved').length)
const unreadMessagesCount = computed(() => messages.value.filter((item) => !item.read).length)

function noticeFor(complaintNo: string): ServiceMessage | undefined {
  return messages.value.find((item) => item.content.includes(complaintNo))
}
</script>
