<template>
  <div class="page-stack">
    <PageTitle eyebrow="NOTIFICATIONS" title="消息中心" description="同步订单履约、政策审核、查勘进度与学习提醒。">
      <template #actions>
        <a-button @click="markAll"><template #icon><CheckOutlined /></template>全部已读</a-button>
      </template>
    </PageTitle>
    <section class="surface-card message-center">
      <div class="message-summary">
        <span><BellOutlined /></span>
        <div><b>{{ unreadCount }} 条未读消息</b><small>重要服务节点会同步短信提醒</small></div>
      </div>
      <LoadingBlock v-if="loading" :rows="4" />
      <EmptyState v-else-if="items.length === 0" icon="📭" title="暂无消息" />
      <div v-else class="message-list">
        <article v-for="item in items" :key="item.id" :class="item.read ? 'read' : 'unread'">
          <span :class="`message-icon tone-${item.type}`">
            <BellOutlined v-if="item.type === 'order'" />
            <SafetyCertificateOutlined v-else-if="item.type === 'policy' || item.type === 'insurance'" />
            <MessageOutlined v-else />
          </span>
          <div>
            <h3>{{ item.title }}<i v-if="!item.read" /></h3>
            <p>{{ item.content }}</p>
            <small>{{ item.createdAt }}</small>
          </div>
          <a-button type="text" @click="markOne(item.id)">查看</a-button>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { BellOutlined, CheckOutlined, MessageOutlined, SafetyCertificateOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { serviceApi } from '../api'
import type { ServiceMessage } from '../types'
import EmptyState from '../components/EmptyState.vue'
import LoadingBlock from '../components/LoadingBlock.vue'
import PageTitle from '../components/PageTitle.vue'

const items = ref<ServiceMessage[]>([])
const loading = ref(true)
const unreadCount = computed(() => items.value.filter((item) => !item.read).length)

onMounted(() => {
  serviceApi.messages()
    .then((rows) => { items.value = rows })
    .catch((reason: Error) => message.error(reason.message))
    .finally(() => { loading.value = false })
})

async function markAll() {
  try {
    await serviceApi.readAllMessages()
    items.value = items.value.map((item) => ({ ...item, read: true }))
    message.success('消息已全部标记为已读')
  } catch (reason) {
    message.error(reason instanceof Error ? reason.message : '操作失败')
  }
}

function markOne(id: number) {
  items.value = items.value.map((entry) => (entry.id === id ? { ...entry, read: true } : entry))
}
</script>
