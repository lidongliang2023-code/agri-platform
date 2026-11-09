<script setup lang="ts">
import { reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { api, type AutomationRule, type Device } from '../../api/iot'

const id = ref(0)
const devices = ref<Device[]>([])
const saving = ref(false)
const ruleTypes = [
  { value: 'automation', label: '传感器自动触发' },
  { value: 'schedule', label: '定时触发' },
  { value: 'offline', label: '设备离线触发' },
]
const operators = [
  { value: '>', label: '大于（>）' },
  { value: '>=', label: '大于等于（>=）' },
  { value: '<', label: '小于（<）' },
  { value: '<=', label: '小于等于（<=）' },
  { value: '==', label: '等于（==）' },
]
const executionModes = [
  { value: 'edge', label: '边缘网关（本地自治）' },
  { value: 'cloud', label: '云端规则引擎' },
]
const metrics = [
  { value: 'temperature', label: '空气温度' },
  { value: 'humidity', label: '空气湿度' },
  { value: 'soil_moisture', label: '土壤含水率' },
  { value: 'co2', label: 'CO₂浓度' },
  { value: 'light', label: '光照强度' },
  { value: 'rain', label: '降雨量' },
  { value: 'device_offline', label: '设备离线' },
]
const form = reactive({
  ruleName: '',
  ruleType: 'automation',
  triggerMetric: 'temperature',
  operator: '>',
  threshold: '32',
  durationSeconds: 300,
  schedule: '',
  actionDeviceId: 0,
  actionDeviceName: '',
  actionCommand: 'on',
  actionValue: '',
  cooldownSeconds: 300,
  executionMode: 'edge',
  enabled: true,
})

onLoad(async (options?: Record<string, string>) => {
  id.value = Number(options?.id || 0)
  try {
    const [deviceData, ruleData] = await Promise.all([api.devices(), id.value ? api.rules() : Promise.resolve([])])
    devices.value = deviceData
    if (id.value) {
      const rule = ruleData.find((item: AutomationRule) => item.id === id.value)
      if (rule) {
        let extra: Record<string, unknown> = {}
        try {
          extra = rule.config ? JSON.parse(rule.config) as Record<string, unknown> : {}
        } catch {
          extra = {}
        }
        Object.assign(form, rule, {
          executionMode: String(extra.executionMode || 'edge'),
        })
      }
    }
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' })
  }
})

function chooseDevice(event: { detail: { value: number } }) {
  const index = Number(event.detail.value)
  const device = devices.value.filter(item => item.controlCapable)[index]
  if (!device) return
  form.actionDeviceId = device.id
  form.actionDeviceName = device.deviceName
}

function selectRuleType(event: { detail: { value: number } }) {
  form.ruleType = ruleTypes[Number(event.detail.value)]?.value || 'automation'
}

function selectMetric(event: { detail: { value: number } }) {
  form.triggerMetric = metrics[Number(event.detail.value)]?.value || 'temperature'
}

function selectOperator(event: { detail: { value: number } }) {
  form.operator = operators[Number(event.detail.value)]?.value || '>'
}

function selectExecutionMode(event: { detail: { value: number } }) {
  form.executionMode = executionModes[Number(event.detail.value)]?.value || 'edge'
}

function setEnabled(event: any) {
  form.enabled = Boolean(event.detail.value)
}

async function submit(test = false) {
  if (!form.ruleName.trim()) {
    uni.showToast({ title: '请输入规则名称', icon: 'none' })
    return
  }
  if (form.ruleType === 'schedule' && !form.schedule.trim()) {
    uni.showToast({ title: '请填写定时表达式', icon: 'none' })
    return
  }
  if (form.ruleType === 'automation' && form.triggerMetric !== 'device_offline') {
    if (!form.threshold.trim()) {
      uni.showToast({ title: '请输入触发阈值', icon: 'none' })
      return
    }
  }
  if (!form.actionDeviceId) {
    uni.showToast({ title: '请选择执行设备', icon: 'none' })
    return
  }
  const metricNames: Record<string, string> = {
    temperature: '空气温度', humidity: '空气湿度', soil_moisture: '土壤含水率',
    co2: 'CO₂浓度', light: '光照强度', rain: '降雨量', device_offline: '设备离线',
  }
  const trigger = form.ruleType === 'schedule'
    ? `定时触发 ${form.schedule || '未设置'}`
    : form.ruleType === 'offline' || form.triggerMetric === 'device_offline'
      ? '设备离线'
      : `${metricNames[form.triggerMetric] || form.triggerMetric} ${form.operator} ${form.threshold}` +
        (Number(form.durationSeconds) > 0 ? ` 持续${Math.ceil(Number(form.durationSeconds) / 60)}分钟` : '')
  const action = `${form.actionDeviceName || '目标设备'}：${form.actionCommand}` +
    (form.actionValue ? ` = ${form.actionValue}` : '')
  saving.value = true
  try {
    const body = { ...form, trigger, action, config: JSON.stringify(form) }
    const saved = id.value
      ? await api.updateRule(id.value, body)
      : await api.createRule(body)
    if (test) {
      try {
        await api.executeRule(saved.id)
      } catch (error) {
        uni.showModal({
          title: '规则已保存',
          content: `测试执行失败：${error instanceof Error ? error.message : '未知错误'}`,
          showCancel: false,
          success: () => uni.navigateBack(),
        })
        return
      }
    }
    uni.showToast({
      title: test ? '规则已保存并测试成功' : (id.value ? '规则已更新' : '规则已创建'),
      icon: 'success',
    })
    setTimeout(() => uni.navigateBack(), 300)
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '保存失败', icon: 'none' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <view class="page pad">
    <view class="card">
      <view class="card-head"><text class="card-title">{{ id ? '编辑自动化规则' : '新建自动化规则' }}</text><text class="tag blue">规则引擎</text></view>
      <view class="form-item"><text class="form-label">规则名称</text><input v-model="form.ruleName" class="input" placeholder="例如：高温自动通风" /></view>
      <view class="form-item"><text class="form-label">规则类型</text><picker :range="ruleTypes" range-key="label" @change="selectRuleType"><view class="input">{{ ruleTypes.find(i=>i.value===form.ruleType)?.label }}</view></picker></view>

      <view class="rule-section">
        <view class="section-label"><text class="if-badge">IF</text><text>触发条件</text></view>
        <template v-if="form.ruleType === 'schedule'">
          <view class="form-item"><text class="form-label">定时表达式</text><input v-model="form.schedule" class="input" placeholder="例如：每天 18:00 或 22:00-06:00" /></view>
          <text class="form-tip">到达设定时间后自动执行下方设备动作。</text>
        </template>
        <template v-else-if="form.ruleType === 'offline'">
          <view class="rule-hint">任一受控设备离线后触发，执行下方预设动作。</view>
        </template>
        <template v-else>
          <view class="form-item"><text class="form-label">触发指标</text><picker :range="metrics" range-key="label" @change="selectMetric"><view class="input">{{ metrics.find(i=>i.value===form.triggerMetric)?.label }}</view></picker></view>
          <view v-if="form.triggerMetric !== 'device_offline'" class="grid-2">
            <view class="form-item"><text class="form-label">比较方式</text><picker :range="operators" range-key="label" @change="selectOperator"><view class="input">{{ operators.find(i=>i.value===form.operator)?.label }}</view></picker></view>
            <view class="form-item"><text class="form-label">阈值</text><input v-model="form.threshold" class="input" placeholder="如 32" /></view>
            <view class="form-item"><text class="form-label">持续时间（秒）</text><input v-model.number="form.durationSeconds" class="input" type="number" /></view>
          </view>
          <view v-else class="rule-hint">设备离线状态持续达到设定时间后触发。</view>
        </template>
      </view>

      <view class="rule-section">
        <view class="section-label"><text class="then-badge">THEN</text><text>执行动作</text></view>
        <view class="form-item"><text class="form-label">执行设备（支持远程控制）</text><picker :range="devices.filter(i=>i.controlCapable)" range-key="deviceName" @change="chooseDevice"><view class="input">{{ form.actionDeviceName || '请选择执行设备' }}</view></picker></view>
        <view class="grid-2">
          <view class="form-item"><text class="form-label">执行指令</text><input v-model="form.actionCommand" class="input" placeholder="on/off/open" /></view>
          <view class="form-item"><text class="form-label">指令参数</text><input v-model="form.actionValue" class="input" placeholder="如 15分钟" /></view>
        </view>
        <view class="form-item"><text class="form-label">执行位置</text><picker :range="executionModes" range-key="label" @change="selectExecutionMode"><view class="input">{{ executionModes.find(i=>i.value===form.executionMode)?.label }}</view></picker></view>
        <view class="form-item"><text class="form-label">冷却时间（秒）</text><input v-model.number="form.cooldownSeconds" class="input" type="number" /></view>
      </view>

      <view class="form-item"><text class="form-label">创建后状态</text><switch :checked="form.enabled" color="#159a5e" @change="setEnabled" /></view>
      <view class="save-actions">
        <button class="btn btn-ghost" :disabled="saving" @tap="submit(false)">仅保存</button>
        <button class="btn btn-primary" :loading="saving" @tap="submit(true)">保存并测试</button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.rule-section{margin:0 0 20rpx;padding:18rpx;border:1rpx solid #e1e9e3;border-radius:17rpx;background:#fbfdfc}
.section-label{display:flex;align-items:center;gap:10rpx;margin-bottom:16rpx;font-size:24rpx;font-weight:700}
.if-badge,.then-badge{display:inline-flex;padding:4rpx 9rpx;border-radius:6rpx;font-size:24rpx;font-weight:800}
.if-badge{background:#e7f3fa;color:#176c93}.then-badge{background:#e5f5eb;color:#0e5233}
.form-tip,.rule-hint{display:block;margin-top:-7rpx;color:#718277;font-size:24rpx;line-height:1.6}
.rule-hint{padding:14rpx;border-radius:11rpx;background:#f2fbf5;color:#53665a}
.save-actions{display:grid;grid-template-columns:1fr 1.5fr;gap:12rpx}
</style>
