<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { infoApi, money, toast, type Quote } from '../../api'
import { currentOwner, getInfoUser } from '../../auth'

const sdType = ref<'supply' | 'demand'>('supply')
const categories = ['蔬菜', '水果', '粮食', '畜牧', '食用菌', '水产']
const grades = ['优等', '一级', '二级']
const durations = [7, 15, 30, 60]
const units = ['斤', '公斤', '吨', '箱']

const quotes = ref<Quote[]>([])
const submitting = ref(false)

const form = ref({
  category: '水果',
  variety: '',
  grade: '一级',
  spec: '',
  quantity: '',
  unit: '斤',
  minOrder: '',
  price: '',
  origin: '',
  availableDate: '',
  duration: 30,
  contactName: currentOwner() || '',
  contactPhone: '',
  orgName: '',
  description: '',
})

onLoad((options) => {
  sdType.value = String(options?.type || 'supply') === 'demand' ? 'demand' : 'supply'
  uni.setNavigationBarTitle({ title: sdType.value === 'supply' ? '发布供应' : '发布需求' })
  const repost = uni.getStorageSync('info_sd_repost')
  if (repost) {
    uni.removeStorageSync('info_sd_repost')
    form.value = {
      ...form.value,
      category: repost.category || form.value.category,
      variety: repost.variety || '',
      spec: repost.spec || '',
      quantity: String(repost.quantity || '').replace(/[^\d.]/g, ''),
      price: String(repost.price || ''),
      origin: repost.origin || '',
      duration: Number(repost.duration || 30),
    }
  }
  loadQuotes()
})

async function loadQuotes() {
  try {
    const data = await infoApi.markets({})
    quotes.value = data.quotes
  } catch {
    quotes.value = []
  }
}

/** AI 定价建议：用同品种最新行情给出参考区间，与 PC 端口径一致。 */
const reference = computed<Quote | undefined>(() => {
  const key = form.value.variety.trim()
  if (!key) return undefined
  return quotes.value.find((item) => item.name.includes(key) || key.includes(item.name))
})

const priceHint = computed(() => {
  const quote = reference.value
  if (!quote) return ''
  const low = quote.price * 0.96
  const high = quote.price * 1.04
  return `近 7 日${quote.origin}${quote.name}产地均价 ${money(quote.price)} ${quote.priceUnit}，建议定价区间 ${money(low)} - ${money(high)} ${quote.priceUnit}。`
})

function pickDate(event: { detail: { value: string } }) {
  form.value.availableDate = event.detail.value
}

async function submit() {
  if (submitting.value) return
  if (!form.value.variety.trim()) {
    toast('请填写品种')
    return
  }
  if (!form.value.quantity.trim()) {
    toast('请填写数量')
    return
  }
  if (!form.value.contactPhone.trim() || form.value.contactPhone.trim().length < 6) {
    toast('请填写有效联系电话')
    return
  }

  const specParts = [
    form.value.grade ? `${form.value.grade}` : '',
    form.value.spec.trim(),
    form.value.minOrder ? `起批 ${form.value.minOrder}${form.value.unit}` : '',
    form.value.description.trim(),
  ].filter(Boolean)

  const title =
    sdType.value === 'supply'
      ? `${form.value.variety.trim()} · ${form.value.grade} ${form.value.spec.trim()}`.trim()
      : `采购 ${form.value.variety.trim()} ${form.value.quantity}${form.value.unit}`

  submitting.value = true
  try {
    const result = await infoApi.publishSupplyDemand({
      sdType: sdType.value,
      title,
      category: form.value.category,
      variety: form.value.variety.trim(),
      spec: specParts.join(' · '),
      quantity: `${form.value.quantity}${form.value.unit}`,
      price: Number(form.value.price || reference.value?.price || 0),
      priceUnit: `元/${form.value.unit}`,
      origin: form.value.origin.trim() || '待完善产地',
      marketRef: priceHint.value || '平台将在审核后补充行情参考',
      availableDate: form.value.availableDate || '',
      durationDays: form.value.duration,
      contactName: form.value.contactName.trim() || currentOwner() || '平台用户',
      contactPhone: form.value.contactPhone.trim(),
      orgName: form.value.orgName.trim() || currentOwner() || '平台用户',
      orgType: '个人',
    })
    uni.showModal({
      title: '提交成功',
      content: `${result.message}\n信息编号：${result.sdNo}\nAI 预估匹配度：${result.matchScore}%`,
      showCancel: false,
      success: () => uni.redirectTo({ url: '/pages/sd/mine' }),
    })
  } catch (error) {
    toast(error instanceof Error ? error.message : '发布失败')
  } finally {
    submitting.value = false
  }
}

function saveDraft() {
  uni.setStorageSync('info_sd_draft', { sdType: sdType.value, ...form.value })
  toast('草稿已保存到本机')
}

function useQuote() {
  if (reference.value) form.value.price = String(reference.value.price)
}

const phoneMasked = computed(() => {
  const phone = getInfoUser()?.username || ''
  return phone.length === 11 ? `${phone.slice(0, 3)}****${phone.slice(7)}` : ''
})
</script>

<template>
  <view class="page">
    <view class="page-pad">
      <view v-if="priceHint" class="ai-card">
        <view class="ai-icon">✦</view>
        <view class="ai-copy">
          <text>AI 定价建议</text>
          <text>{{ priceHint }}</text>
          <text>基于平台行情库生成 · 仅供参考</text>
        </view>
      </view>

      <view class="card">
        <view class="card-head">
          <text class="card-title">基本信息</text>
          <text class="card-sub">带 * 为必填</text>
        </view>

        <view class="form-item">
          <text class="form-label">品类 *</text>
          <view class="chip-row">
            <text
              v-for="item in categories"
              :key="item"
              :class="['chip', { active: form.category === item }]"
              @click="form.category = item"
            >
              {{ item }}
            </text>
          </view>
        </view>

        <view class="form-item">
          <text class="form-label">品种 *</text>
          <input v-model="form.variety" class="input" placeholder="例如：大蒜 / 红富士苹果" />
        </view>

        <view class="form-item">
          <text class="form-label">规格</text>
          <input v-model="form.spec" class="input" placeholder="例如：杂交红蒜 横径 5.5cm 以上" />
        </view>

        <view class="form-item">
          <text class="form-label">等级</text>
          <view class="chip-row">
            <text
              v-for="item in grades"
              :key="item"
              :class="['chip', { active: form.grade === item }]"
              @click="form.grade = item"
            >
              {{ item }}
            </text>
          </view>
        </view>
      </view>

      <view class="card">
        <view class="card-head">
          <text class="card-title">数量与价格</text>
        </view>

        <view class="form-item">
          <text class="form-label">{{ sdType === 'supply' ? '可供货量' : '采购量' }} *</text>
          <view class="inline-row">
            <input v-model="form.quantity" class="input grow" type="digit" placeholder="请输入数量" />
            <picker mode="selector" :range="units" :value="units.indexOf(form.unit)" @change="form.unit = units[Number($event.detail.value)]">
              <view class="unit-picker">{{ form.unit }} ▾</view>
            </picker>
          </view>
        </view>

        <view v-if="sdType === 'supply'" class="form-item">
          <text class="form-label">起批量</text>
          <input v-model="form.minOrder" class="input" type="digit" :placeholder="`起批数量（${form.unit}）`" />
        </view>

        <view class="form-item">
          <text class="form-label">{{ sdType === 'supply' ? '期望单价 *' : '期望价' }}</text>
          <view class="inline-row">
            <input v-model="form.price" class="input grow" type="digit" placeholder="请输入单价" />
            <text class="unit-label">元/{{ form.unit }}</text>
            <text v-if="reference" class="link" @click="useQuote">用行情价</text>
          </view>
        </view>
      </view>

      <view class="card">
        <view class="card-head">
          <text class="card-title">时间与产地</text>
        </view>

        <view class="form-item">
          <text class="form-label">{{ sdType === 'supply' ? '可供应时间' : '交货期' }}</text>
          <picker mode="date" :value="form.availableDate" @change="pickDate">
            <view class="picker">
              <text>{{ form.availableDate || '请选择日期' }}</text>
              <text class="item-arrow">›</text>
            </view>
          </picker>
        </view>

        <view class="form-item">
          <text class="form-label">{{ sdType === 'supply' ? '产地' : '收货地' }}</text>
          <input v-model="form.origin" class="input" placeholder="例如：山东 济宁 金乡县" />
        </view>

        <view class="form-item">
          <text class="form-label">信息有效期</text>
          <view class="chip-row">
            <text
              v-for="item in durations"
              :key="item"
              :class="['chip', { active: form.duration === item }]"
              @click="form.duration = item"
            >
              {{ item }}天
            </text>
          </view>
        </view>
      </view>

      <view class="card">
        <view class="card-head">
          <text class="card-title">描述与联系方式</text>
        </view>

        <view class="form-item">
          <text class="form-label">产品描述</text>
          <textarea v-model="form.description" class="textarea" :maxlength="200" placeholder="补充品质、包装、储运等关键信息" auto-height />
          <text class="tiny">{{ form.description.length }}/200</text>
        </view>

        <view class="form-item">
          <text class="form-label">联系人 *</text>
          <input v-model="form.contactName" class="input" placeholder="请输入联系人姓名" />
        </view>

        <view class="form-item">
          <text class="form-label">手机号 *</text>
          <input v-model="form.contactPhone" class="input" type="number" :placeholder="phoneMasked ? `统一账号绑定：${phoneMasked}` : '请输入手机号'" />
        </view>

        <view class="form-item">
          <text class="form-label">合作社 / 企业名称</text>
          <input v-model="form.orgName" class="input" placeholder="选填，用于展示商家主体" />
        </view>
      </view>

      <view class="notice">
        <text>·</text>
        <text>发布后进入平台审核队列，一般 2 小时内完成；审核通过后自动上链存证并由 AI 推送撮合。</text>
      </view>

      <view class="submit-row">
        <button class="btn grow" @click="saveDraft">存草稿</button>
        <button class="btn btn-primary grow" :disabled="submitting" @click="submit">
          {{ submitting ? '提交中…' : '立即发布' }}
        </button>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.chip-row .chip {
  margin-right: 0;
}

.inline-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.grow {
  flex: 1;
}

.unit-picker {
  display: flex;
  min-height: 82rpx;
  align-items: center;
  padding: 0 20rpx;
  border: 1rpx solid #dfe8e2;
  border-radius: 16rpx;
  font-size: 25rpx;
}

.unit-label {
  color: #718277;
  font-size: 24rpx;
}

.link {
  color: #12764a;
  font-size: 24rpx;
}

.picker {
  display: flex;
  min-height: 82rpx;
  align-items: center;
  justify-content: space-between;
  padding: 0 22rpx;
  border: 1rpx solid #dfe8e2;
  border-radius: 16rpx;
  font-size: 25rpx;
}

.submit-row {
  display: flex;
  gap: 14rpx;
  margin: 20rpx 0 40rpx;
}
</style>
