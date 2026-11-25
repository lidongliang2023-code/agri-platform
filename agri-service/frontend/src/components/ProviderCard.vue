<template>
  <article class="provider-card card-hover" @click="app.navigate('provider', provider.id)">
    <div class="provider-cover">
      <span class="provider-cover-icon">{{ provider.categoryIcon }}</span>
      <span class="provider-badge">{{ provider.badge }}</span>
      <span class="provider-distance"><EnvironmentOutlined /> {{ provider.distanceKm }}km</span>
    </div>
    <div class="provider-body">
      <div class="provider-heading">
        <div>
          <h3>{{ provider.name }}</h3>
          <div class="provider-meta">
            <span><StarFilled /> {{ provider.rating }}</span>
            <span>已服务 {{ provider.orderCount }} 单</span>
            <span><ClockCircleOutlined /> {{ provider.responseMinutes }} 分钟响应</span>
          </div>
        </div>
        <Money :value="provider.price" />
      </div>
      <p class="provider-desc">{{ provider.description }}</p>
      <div class="tag-row">
        <span v-for="tag in provider.tags.slice(0, 3)" :key="tag" class="soft-tag">{{ tag }}</span>
        <span class="soft-tag muted">{{ provider.category }}</span>
        <span v-if="provider.favorited" class="soft-tag">已收藏</span>
      </div>
      <div class="provider-foot">
        <span><EnvironmentOutlined /> {{ provider.region }}</span>
        <button type="button" @click.stop="app.navigate('provider', provider.id)">
          查看与预约 <ArrowRightOutlined />
        </button>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { ArrowRightOutlined, ClockCircleOutlined, EnvironmentOutlined, StarFilled } from '@ant-design/icons-vue'
import { useAppStore } from '../app-context'
import type { Provider } from '../types'
import Money from './Money.vue'

defineProps<{ provider: Provider }>()
const app = useAppStore()
</script>
