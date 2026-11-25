<template>
  <section aria-label="设备采样配置" style="border: 1px solid #eee; border-radius: 8px; padding: 14px; margin: 12px 0">
    <b>指标独立采样周期与持续告警</b>
    <p v-if="loading" role="status">读取配置中…</p>
    <form style="margin-top: 12px" @submit.prevent="submit">
      <fieldset :disabled="loading || saving || !config" style="border: 0; padding: 0; margin: 0; min-width: 0">
        <div style="border-bottom: 1px solid #f0f0f0; padding-bottom: 12px; margin-bottom: 12px">
          <b style="font-size: 13px">设备默认值</b>
          <p style="color: #666; font-size: 12px; margin: 4px 0 8px">
            未单独配置的指标使用此值；关闭后，未单独配置指标按规则持续时长保守判定。
          </p>
          <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px">
            <input v-model="defaultEnabled" type="checkbox" @change="notice = ''" />
            启用设备默认采样周期
          </label>
          <div v-if="defaultEnabled" style="display: flex; gap: 12px; flex-wrap: wrap">
            <label style="display: grid; gap: 4px; font-size: 12px">
              周期（秒）
              <input v-model="defaultInterval" aria-label="设备默认采样周期（秒）" type="number" min="1" max="86400" step="1" :style="inputStyle" />
            </label>
            <label style="display: grid; gap: 4px; font-size: 12px">
              允许延迟（秒）
              <input v-model="defaultTolerance" aria-label="设备默认允许延迟（秒）" type="number" min="0" :max="Number(defaultInterval) || 86400" step="1" :style="inputStyle" />
            </label>
          </div>
        </div>

        <div>
          <b style="font-size: 13px">按指标独立配置</b>
          <p v-if="metrics.length === 0" style="color: #888; font-size: 12px">设备类型暂未登记可配置指标。</p>
          <div style="display: grid; gap: 8px; margin-top: 8px">
            <div
              v-for="item in metrics"
              :key="item.metricKey"
              style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 8px 0; border-bottom: 1px solid #f5f5f5"
            >
              <label style="display: flex; align-items: center; gap: 6px; min-width: 150px">
                <input v-model="item.enabled" type="checkbox" @change="notice = ''" />
                <span>{{ item.metricName }}</span>
                <small style="color: #999">({{ item.metricKey }})</small>
              </label>
              <template v-if="item.enabled">
                <label style="display: flex; align-items: center; gap: 4px; font-size: 12px">
                  周期
                  <input
                    :aria-label="`${item.metricName}采样周期（秒）`"
                    type="number"
                    min="1"
                    max="86400"
                    step="1"
                    :value="item.intervalSeconds ?? ''"
                    :style="inputStyle"
                    @input="item.intervalSeconds = Number(($event.target as HTMLInputElement).value) || null"
                  />
                </label>
                <label style="display: flex; align-items: center; gap: 4px; font-size: 12px">
                  延迟
                  <input
                    :aria-label="`${item.metricName}允许延迟（秒）`"
                    type="number"
                    min="0"
                    :max="item.intervalSeconds || 86400"
                    step="1"
                    :value="item.toleranceSeconds"
                    :style="inputStyle"
                    @input="item.toleranceSeconds = Number(($event.target as HTMLInputElement).value) || 0"
                  />
                </label>
              </template>
              <small v-else style="color: #888">
                {{ config?.intervalSeconds == null ? '使用规则持续时长' : `使用设备默认 ${config.intervalSeconds} 秒` }}
              </small>
            </div>
          </div>
        </div>

        <p style="color: #666; font-size: 12px; margin-bottom: 8px">
          每个指标按自己的周期检查连续性，超过“对应周期＋允许延迟”的采样间隔将中断持续条件。修改后该指标重新积累持续时间，既有告警仍需人工结案。保存不会修改硬件采样频率或自动发送指令。
        </p>
        <p v-if="config" style="color: #666; font-size: 12px; overflow-wrap: anywhere">
          设备默认最大间隔：{{ config.maxGapSeconds == null ? '按规则时长' : `${config.maxGapSeconds} 秒` }}；已配置独立指标：{{
            metrics.filter((item) => item.enabled).length
          }} 项；生效时间：{{ config.effectiveAt?.replace('T', ' ') || '历史配置 / 未配置' }}
        </p>
        <button type="submit" style="border: 0; border-radius: 6px; padding: 7px 14px; background: #12764a; color: #fff; cursor: pointer">
          {{ saving ? '保存中…' : '保存采样配置' }}
        </button>
      </fieldset>
    </form>
    <p v-if="error" role="alert" style="color: #cf1322">{{ error }}</p>
    <p v-if="notice" role="status" style="color: #12764a">{{ notice }}</p>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

export interface MetricSamplingConfig {
  metricKey: string
  metricName: string
  enabled: boolean
  intervalSeconds: number | null
  toleranceSeconds: number
  effectiveIntervalSeconds: number | null
  effectiveToleranceSeconds: number
  maxGapSeconds: number | null
  effectiveAt?: string | null
}

export interface SamplingConfig {
  intervalSeconds: number | null
  toleranceSeconds: number
  effectiveAt?: string | null
  maxGapSeconds?: number | null
  metrics: MetricSamplingConfig[]
  fallbackDescription?: string
}

const props = defineProps<{
  deviceId: number
  load: (id: number) => Promise<SamplingConfig>
  save: (id: number, body: SamplingConfig) => Promise<SamplingConfig>
}>()

const inputStyle = {
  width: '112px',
  maxWidth: '100%',
  border: '1px solid #d9d9d9',
  borderRadius: '6px',
  padding: '6px 8px',
  minHeight: '34px',
}

const loading = ref(true)
const saving = ref(false)
const config = ref<SamplingConfig | null>(null)
const defaultEnabled = ref(false)
const defaultInterval = ref('30')
const defaultTolerance = ref('0')
const metrics = ref<MetricSamplingConfig[]>([])
const error = ref('')
const notice = ref('')

function apply(value: SamplingConfig) {
  config.value = value
  defaultEnabled.value = value.intervalSeconds != null
  defaultInterval.value = String(value.intervalSeconds ?? 30)
  defaultTolerance.value = String(value.toleranceSeconds ?? 0)
  metrics.value = (value.metrics ?? []).map((m) => ({ ...m }))
}

function validate(enabled: boolean, intervalText: string, toleranceText: string, label: string) {
  const seconds = Number(intervalText)
  const delay = Number(toleranceText)
  if (
    enabled &&
    (!intervalText ||
      !toleranceText ||
      !Number.isInteger(seconds) ||
      seconds < 1 ||
      seconds > 86400 ||
      !Number.isInteger(delay) ||
      delay < 0 ||
      delay > seconds)
  ) {
    throw new Error(`${label}的采样周期须为 1～86400 的整数秒，允许延迟须为 0～采样周期的整数秒`)
  }
  return { seconds, delay }
}

async function submit() {
  notice.value = ''
  error.value = ''
  try {
    const defaults = validate(defaultEnabled.value, defaultInterval.value, defaultTolerance.value, '设备默认')
    const normalizedMetrics = metrics.value.map((item) => {
      const values = validate(
        item.enabled,
        String(item.intervalSeconds ?? ''),
        String(item.toleranceSeconds ?? 0),
        item.metricName,
      )
      return {
        ...item,
        intervalSeconds: item.enabled ? values.seconds : null,
        toleranceSeconds: item.enabled ? values.delay : 0,
      }
    })
    saving.value = true
    const saved = await props.save(props.deviceId, {
      intervalSeconds: defaultEnabled.value ? defaults.seconds : null,
      toleranceSeconds: defaultEnabled.value ? defaults.delay : 0,
      metrics: normalizedMetrics,
    })
    apply(saved)
    notice.value = '独立采样周期已保存，未向设备下发配置'
  } catch (e) {
    error.value = e instanceof Error ? e.message : '保存失败'
  } finally {
    saving.value = false
  }
}

watch(
  () => props.deviceId,
  async (id) => {
    loading.value = true
    error.value = ''
    try {
      apply(await props.load(id))
    } catch (e) {
      error.value = e instanceof Error ? e.message : '读取配置失败'
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)
</script>
