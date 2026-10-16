<template>
  <view class="page">
    <!-- 步骤指示器：已完成步骤实心 -->
    <view class="steps">
      <view v-for="(label, index) in stepLabels" :key="label" class="step">
        <view class="step-dot" :class="{ done: step > index + 1, current: step === index + 1 }">
          {{ index + 1 }}
        </view>
        <text class="step-label" :class="{ current: step === index + 1 }">{{ label }}</text>
      </view>
    </view>

    <view v-if="error" class="error-box">{{ error }}</view>

    <!-- Step1 基础信息 -->
    <view v-if="step === 1" class="card">
      <view class="card-title"><text>🌾 Step1 · 基础信息</text></view>
      <view class="field">
        <text class="field-label">地块名称</text>
        <input v-model="form.plotName" class="input" placeholder="如：F区试验田" />
      </view>
      <view class="field">
        <text class="field-label">面积(亩)</text>
        <input v-model="form.area" class="input" type="digit" placeholder="如 12.5" />
      </view>
      <picker mode="selector" :range="soilTypes" @change="onSoilTypeChange">
        <view class="field">
          <text class="field-label">土壤类型</text>
          <text class="field-value">{{ form.soilType || '请选择' }}</text>
        </view>
      </picker>
      <picker mode="selector" :range="irrigationTypes" @change="onIrrigationChange">
        <view class="field" style="border-bottom: none">
          <text class="field-label">灌溉方式</text>
          <text class="field-value">{{ form.irrigationType || '请选择' }}</text>
        </view>
      </picker>
    </view>

    <!-- Step2 位置定位 -->
    <view v-if="step === 2" class="card">
      <view class="card-title"><text>📍 Step2 · 位置定位</text></view>
      <view class="btn-ghost" @click="locate">获取当前位置</view>
      <view class="muted" style="margin: 12rpx 0">
        H5 预览可能拿不到定位（浏览器权限 / 非 https），拿不到就手填经纬度；两者都留空也能建档，只是地图上不落点。
      </view>
      <view class="field">
        <text class="field-label">经度</text>
        <input v-model="form.centerLongitude" class="input" type="digit" placeholder="如 113.61" />
      </view>
      <view class="field">
        <text class="field-label">纬度</text>
        <input v-model="form.centerLatitude" class="input" type="digit" placeholder="如 23.52" />
      </view>
      <view class="field" style="border-bottom: none">
        <text class="field-label">备注</text>
        <input v-model="form.remark" class="input" placeholder="选填" />
      </view>
    </view>

    <!-- Step3 作物信息 -->
    <view v-if="step === 3" class="card">
      <view class="card-title"><text>🍅 Step3 · 作物信息</text></view>
      <view class="field">
        <text class="field-label">当前作物</text>
        <input v-model="form.currentCrop" class="input" placeholder="如：番茄" />
      </view>
      <view class="field">
        <text class="field-label">作物品种</text>
        <input v-model="form.cropVariety" class="input" placeholder="如：中杂9号" />
      </view>
      <picker mode="date" :value="form.plantingDate" @change="onPlantingDateChange">
        <view class="field">
          <text class="field-label">种植日期</text>
          <text class="field-value">{{ form.plantingDate || '请选择' }}</text>
        </view>
      </picker>
      <picker mode="date" :value="form.expectedHarvestDate" @change="onHarvestDateChange">
        <view class="field" style="border-bottom: none">
          <text class="field-label">预计采收</text>
          <text class="field-value">{{ form.expectedHarvestDate || '请选择' }}</text>
        </view>
      </picker>
      <view class="muted" style="margin-top: 12rpx">
        作物这里只记名称与品种（文本）；作物主数据联动是 PC 端能力，移动端不做半套。
      </view>
    </view>

    <!-- 成功页 -->
    <view v-if="step === 4" class="card">
      <view class="card-title"><text>✅ 地块已创建</text></view>
      <view class="field"><text class="field-label">地块名称</text><text class="field-value">{{ form.plotName }}</text></view>
      <view class="field"><text class="field-label">地块编号</text><text class="field-value">{{ createdPlotCode || '（后端未返回编号）' }}</text></view>
      <view class="field" style="border-bottom: none">
        <text class="field-label">面积</text><text class="field-value">{{ form.area || '—' }} 亩</text>
      </view>
      <view style="margin-top: 20rpx; display: flex; gap: 20rpx">
        <view class="btn-primary" style="flex: 1" @click="goDetail">查看地块详情</view>
        <view class="btn-ghost" style="flex: 1" @click="resetForAnother">继续添加</view>
      </view>
    </view>

    <view v-if="step < 4" style="margin: 24rpx; display: flex; gap: 20rpx">
      <view v-if="step > 1" class="btn-ghost" style="flex: 1" @click="step -= 1">上一步</view>
      <view class="btn-primary" style="flex: 2" @click="next">
        {{ step === 3 ? (submitting ? '提交中…' : '提交') : '下一步' }}
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { createPlot, getPlot } from '@/api/production'
import { currentFarm } from '@/utils/auth-helper'

/** 步骤标题（与 PRD §4.2.3 的三步一致） */
const stepLabels = ['基础信息', '位置定位', '作物信息']

/** 土壤类型候选（与 PC 端同值域） */
const soilTypes = ['壤土', '沙土', '黏土', '壤砂土']
/** 灌溉方式候选（与 PC 端同值域） */
const irrigationTypes = ['滴灌', '喷灌', '漫灌', '沟灌', '其他']

const step = ref(1)
const error = ref('')
const submitting = ref(false)
/** 提交后回查到的地块编号（创建接口只返回主键，编号要再查一次） */
const createdPlotCode = ref('')
const createdPlotId = ref('')

const form = ref({
  plotName: '',
  area: '',
  soilType: '',
  irrigationType: '',
  centerLongitude: '',
  centerLatitude: '',
  currentCrop: '',
  cropVariety: '',
  plantingDate: '',
  expectedHarvestDate: '',
  remark: '',
})

function onSoilTypeChange(event: any): void {
  form.value.soilType = soilTypes[Number(event.detail.value)] ?? ''
}

function onIrrigationChange(event: any): void {
  form.value.irrigationType = irrigationTypes[Number(event.detail.value)] ?? ''
}

function onPlantingDateChange(event: any): void {
  form.value.plantingDate = String(event.detail.value)
  // 预计采收留空时给个"种植后 90 天"的起点，用户可改（不是必填，不猜也能建档）
  if (!form.value.expectedHarvestDate) {
    const base = new Date(form.value.plantingDate + 'T00:00:00')
    base.setDate(base.getDate() + 90)
    const pad = (n: number) => String(n).padStart(2, '0')
    form.value.expectedHarvestDate = base.getFullYear() + '-' + pad(base.getMonth() + 1) + '-' + pad(base.getDate())
  }
}

function onHarvestDateChange(event: any): void {
  form.value.expectedHarvestDate = String(event.detail.value)
}

/** 取当前位置：拿不到就如实提示（H5 常因权限 / 非 https 失败），不假装拿到了 */
function locate(): void {
  uni.getLocation({
    type: 'wgs84',
    success: (res: any) => {
      form.value.centerLongitude = String(res.longitude)
      form.value.centerLatitude = String(res.latitude)
      uni.showToast({ title: '已填入当前位置', icon: 'success' })
    },
    fail: () => {
      uni.showToast({ title: '未取到定位，请手动填写经纬度', icon: 'none' })
    },
  })
}

/** 校验当前步：必填没填就不许下一步（PRD §4.2.3 交互说明第 2 条） */
function validateStep(): string {
  if (step.value === 1) {
    if (!form.value.plotName.trim()) return '请填写地块名称'
    if (form.value.area && Number(form.value.area) <= 0) return '面积要大于 0'
  }
  if (step.value === 2) {
    const lng = Number(form.value.centerLongitude || 0)
    const lat = Number(form.value.centerLatitude || 0)
    if ((lng && !lat) || (!lng && lat)) return '经度与纬度要么都填、要么都留空'
  }
  return ''
}

function next(): void {
  error.value = ''
  const message = validateStep()
  if (message) {
    error.value = message
    return
  }
  if (step.value < 3) {
    step.value += 1
    return
  }
  void submit()
}

async function submit(): Promise<void> {
  const farm = currentFarm()
  if (!farm) {
    error.value = '当前账号未关联农场，请到「我的」页选择农场'
    return
  }
  submitting.value = true
  try {
    const plotId = await createPlot({
      farmId: farm.farmId,
      plotName: form.value.plotName.trim(),
      area: form.value.area ? Number(form.value.area) : undefined,
      soilType: form.value.soilType || undefined,
      irrigationType: form.value.irrigationType || undefined,
      centerLongitude: form.value.centerLongitude ? Number(form.value.centerLongitude) : undefined,
      centerLatitude: form.value.centerLatitude ? Number(form.value.centerLatitude) : undefined,
      currentCrop: form.value.currentCrop || undefined,
      cropVariety: form.value.cropVariety || undefined,
      plantingDate: form.value.plantingDate || undefined,
      expectedHarvestDate: form.value.expectedHarvestDate || undefined,
      remark: form.value.remark || undefined,
    })
    createdPlotId.value = plotId
    step.value = 4
    // 编号回查：创建接口只返回主键，编号（DEMO-PLOT-xxx）得再查一次；查不到就如实留空
    try {
      const detail = await getPlot(plotId)
      createdPlotCode.value = detail?.plotCode ?? ''
    } catch {
      createdPlotCode.value = ''
    }
  } catch (err: any) {
    error.value = err?.message ?? '创建失败，请稍后重试'
  } finally {
    submitting.value = false
  }
}

function goDetail(): void {
  uni.redirectTo({ url: '/pages/plots/detail?id=' + createdPlotId.value })
}

/** 继续添加：清空表单回到第一步（农场上下文不变） */
function resetForAnother(): void {
  form.value = {
    plotName: '',
    area: '',
    soilType: '',
    irrigationType: '',
    centerLongitude: '',
    centerLatitude: '',
    currentCrop: '',
    cropVariety: '',
    plantingDate: '',
    expectedHarvestDate: '',
    remark: '',
  }
  createdPlotCode.value = ''
  createdPlotId.value = ''
  step.value = 1
}
</script>

<style lang="scss" scoped>
.steps {
  display: flex;
  background-color: #ffffff;
  padding: 28rpx 24rpx;
}

.step {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.step-dot {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background-color: #e5e7eb;
  color: #6b7280;
  font-size: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.step-dot.done {
  background-color: #13a05a;
  color: #ffffff;
}

.step-dot.current {
  background-color: #13a05a;
  color: #ffffff;
}

.step-label {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #8c8c8c;
}

.step-label.current {
  color: #13a05a;
  font-weight: 600;
}
</style>
