<template>
  <view v-if="show" class="sheet-mask" @tap="close" @touchmove.stop.prevent>
    <view class="input-sheet" role="dialog" aria-modal="true" :aria-label="title" @tap.stop>
      <view class="sheet-head"><text class="sheet-title">{{ title }}</text><button class="sheet-close" :disabled="busy" aria-label="关闭" @tap="close">×</button></view>
      <text v-if="description" class="sheet-description">{{ description }}</text>
      <input v-model="value" class="sheet-input" :type="inputType" :focus="show" :disabled="busy" :maxlength="inputType === 'digit' ? 12 : 200" :placeholder="placeholder" :adjust-position="true" :cursor-spacing="24" confirm-type="done" @confirm="submit" />
      <text v-if="error" class="sheet-error">{{ error }}</text>
      <view class="sheet-actions"><button class="sheet-cancel" :disabled="busy" @tap="close">取消</button><button class="sheet-submit" :loading="busy" :disabled="busy" @tap="submit">{{ confirmText }}</button></view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  show: boolean
  title: string
  description?: string
  placeholder?: string
  initialValue?: string
  inputType?: 'text' | 'digit'
  confirmText?: string
  busy?: boolean
  error?: string
}>(), {
  inputType: 'text',
  confirmText: '确认保存',
  initialValue: '',
  busy: false,
})

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'submit', value: string): void
}>()

const value = ref('')

watch(() => props.show, (show) => {
  if (show) value.value = props.initialValue
}, { immediate: true })

function close() {
  if (!props.busy) emit('close')
}

function submit() {
  if (!props.busy) emit('submit', value.value.trim())
}
</script>

<style scoped lang="scss">
.sheet-mask { position: fixed; inset: 0; z-index: 999; display: flex; align-items: flex-end; background: rgba(8,24,16,.45); }
.input-sheet { width: 100%; max-width: 480px; margin: 0 auto; padding: 16px 20px calc(20px + env(safe-area-inset-bottom)); box-sizing: border-box; border-radius: 24px 24px 0 0; background: #fff; color: #0b1a12; }
.sheet-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.sheet-title { font-size: 20px; font-weight: 700; }
.sheet-close { width: 44px; height: 44px; margin: 0; padding: 0; font-size: 28px; line-height: 44px; background: transparent; }
.sheet-description { display: block; margin: 8px 0 20px; font-size: 14px; line-height: 1.6; color: #64756a; overflow-wrap: anywhere; }
.sheet-input { width: 100%; height: 56px; box-sizing: border-box; padding: 0 16px; border: 1px solid #b9d4c4; border-radius: 12px; background: #f7faf8; font-size: 24px; }
.sheet-error { display: block; margin-top: 12px; color: #b53c2c; font-size: 14px; }
.sheet-actions { display: flex; gap: 12px; margin-top: 24px; }
.sheet-actions button { min-height: 48px; flex: 1; margin: 0; padding: 0 12px; line-height: 48px; border-radius: 12px; font-size: 16px; }
.sheet-cancel { background: #eef3ef; color: #33453b; }
.sheet-submit { background: #12764a; color: #fff; }
.sheet-actions button[disabled] { opacity: .5; }
button::after { border: 0; }
</style>
