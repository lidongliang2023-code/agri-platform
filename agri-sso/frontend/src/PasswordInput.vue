<template>
  <div class="password-row">
    <input
      :id="inputId"
      class="auth-input"
      :type="visible ? 'text' : 'password'"
      :value="modelValue"
      :maxlength="maxLength"
      :autocomplete="autoComplete"
      :placeholder="placeholder"
      :autofocus="autoFocus"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <button
      type="button"
      class="password-toggle"
      :aria-label="toggleText"
      :title="toggleText"
      :aria-pressed="visible"
      :aria-controls="inputId"
      @click="visible = !visible"
    >
      <Icon :name="visible ? 'eye-off' : 'eye'" :size="19" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import Icon from './Icon.vue'

const props = defineProps<{
  label: string
  modelValue: string
  id?: string
  placeholder?: string
  autoComplete?: string
  maxLength?: number
  autoFocus?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const autoId = useId().replace(/:/g, '')
const inputId = computed(() => props.id ?? `password-${autoId}`)
const visible = ref(false)
const toggleText = computed(() => `${visible.value ? '隐藏' : '显示'}${props.label}`)
</script>
