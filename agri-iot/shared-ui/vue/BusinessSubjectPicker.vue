<template>
  <div class="iot-subject-picker">
    <label for="iot-business-subject">经营主体</label>
    <a-select
      id="iot-business-subject"
      aria-label="切换经营主体"
      show-search
      option-filter-prop="label"
      :placeholder="loading ? '加载主体…' : '暂无关联主体'"
      :value="activeId"
      :loading="loading || switching"
      :disabled="loading || switching || !options.length || !!error"
      :options="options"
      title="切换主体后将返回工作台，未保存内容不会保留"
      @change="(val: unknown) => emit('switch', String(val))"
    />
    <a-button v-if="error" size="small" @click="emit('reload')">重试</a-button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BusinessSubjectItem } from './useBusinessSubject'

const props = defineProps<{
  merchants: BusinessSubjectItem[]
  activeId?: string
  loading: boolean
  switching: boolean
  error: string
}>()

const emit = defineEmits<{
  switch: [id: string]
  reload: []
}>()

const options = computed(() =>
  props.merchants.map((item) => ({
    value: String(item.merchantId),
    label: item.merchantName || `主体 ${item.merchantId}`,
  })),
)
</script>
