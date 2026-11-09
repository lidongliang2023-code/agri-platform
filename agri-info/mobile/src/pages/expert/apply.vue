<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { infoApi, toast, type Expert } from '../../api'
import { currentOwner } from '../../auth'

const fields = ['作物栽培', '病虫害防治', '土壤肥料', '品种选育', '畜牧兽医', '水产养殖', '农业机械', '智慧农业', '其他']
const regions = ['山东', '河南', '江苏', '河北', '线上不限']
const levels = ['权威专家', '认证专家', '热心达人']

const selectedFields = ref<string[]>([])
const selectedRegions = ref<string[]>(['山东'])
const agreed = ref(false)
const submitting = ref(false)
const records = ref<Expert[]>([])

const form = ref({
  name: currentOwner() || '',
  certNo: '',
  phone: '',
  region: '山东省 济宁市 金乡县',
  title: '高级农艺师',
  orgName: '',
  years: '',
  level: '认证专家',
  intro: '',
})

const completeness = computed(() => {
  let score = 0
  if (form.value.name.trim()) score += 15
  if (form.value.certNo.trim()) score += 20
  if (form.value.phone.trim().length >= 6) score += 15
  if (form.value.region.trim()) score += 10
  if (selectedFields.value.length) score += 20
  if (form.value.years) score += 10
  if (form.value.intro.trim().length >= 20) score += 10
  return Math.min(score, 100)
})

onShow(() => {
  loadMine()
})

async function loadMine() {
  try {
    records.value = await infoApi.myExpert()
  } catch {
    records.value = []
  }
}

function toggleField(name: string) {
  if (selectedFields.value.includes(name)) {
    selectedFields.value = selectedFields.value.filter((item) => item !== name)
    return
  }
  if (selectedFields.value.length >= 3) {
    toast('最多选择 3 个专业领域')
    return
  }
  selectedFields.value = [...selectedFields.value, name]
}

function toggleRegion(name: string) {
  selectedRegions.value = selectedRegions.value.includes(name)
    ? selectedRegions.value.filter((item) => item !== name)
    : [...selectedRegions.value, name]
}

async function submit() {
  if (submitting.value) return
  if (!form.value.name.trim()) {
    toast('请填写真实姓名')
    return
  }
  if (!form.value.certNo.trim()) {
    toast('请填写职称证书编号')
    return
  }
  if (!selectedFields.value.length) {
    toast('请选择擅长领域')
    return
  }
  if (!agreed.value) {
    toast('请先同意《专家服务协议》与《隐私政策》')
    return
  }
  submitting.value = true
  try {
    const result = await infoApi.applyExpert({
      name: form.value.name.trim(),
      certNo: form.value.certNo.trim(),
      field: selectedFields.value.join('、'),
      title: form.value.title,
      orgName: form.value.orgName.trim() || '待补充',
      region: form.value.region.trim(),
      level: form.value.level,
      intro: [
        form.value.years ? `从业 ${form.value.years} 年` : '',
        `服务区域：${selectedRegions.value.join('、')}`,
        form.value.intro.trim(),
      ]
        .filter(Boolean)
        .join('；'),
    })
    uni.showModal({
      title: '提交成功',
      content: result.message,
      showCancel: false,
      success: () => {
        loadMine()
        uni.navigateTo({ url: '/pages/expert/cert' })
      },
    })
  } catch (error) {
    toast(error instanceof Error ? error.message : '提交失败')
  } finally {
    submitting.value = false
  }
}

function upload() {
  uni.chooseImage({
    count: 1,
    success: () => toast('材料已上传（本机预览）'),
    fail: () => undefined,
  })
}

function toVerify() {
  uni.navigateTo({ url: '/pages/expert/verify' })
}
</script>

<template>
  <view class="page">
    <view class="head">
      <text class="head-title">申请须知</text>
      <text class="head-desc">
        审核周期 7 个工作日；认证有效期：权威专家 3 年 / 认证专家 2 年 / 热心达人 1 年；
        材料须真实有效，通过后自动链上存证并公示。
      </text>
      <view class="steps">
        <text class="step">1. 填写申请资料（进行中）</text>
        <text class="step">2. 平台材料初审（1 个工作日）</text>
        <text class="step">3. 专家评审（3 位同领域专家交叉评审）</text>
        <text class="step">4. 链上存证并公示</text>
      </view>
      <text class="verify-link" @click="toVerify">已有认证？去查询认证状态 ›</text>
    </view>

    <view class="page-pad">
      <view v-if="records.length" class="card">
        <view class="card-head">
          <text class="card-title">我的申请记录</text>
        </view>
        <view v-for="item in records" :key="item.id" class="list-item">
          <view class="item-icon">🎖</view>
          <view class="item-body">
            <text class="item-title">{{ item.name }} · {{ item.level }}</text>
            <text class="item-sub">{{ item.field }} · {{ item.certNo }}</text>
          </view>
          <text :class="['tag', item.status === 'approved' ? 'green' : item.status === 'rejected' ? 'red' : 'orange']">
            {{ item.status === 'approved' ? '已通过' : item.status === 'rejected' ? '已驳回' : '审核中' }}
          </text>
        </view>
      </view>

      <view class="card">
        <view class="card-head">
          <text class="card-title">基本信息</text>
        </view>
        <view class="form-item">
          <text class="form-label">姓名 *</text>
          <input v-model="form.name" class="input" placeholder="请填写真实姓名" />
        </view>
        <view class="form-item">
          <text class="form-label">职称证书编号 *</text>
          <input v-model="form.certNo" class="input" placeholder="例如：EXPERT-2026-00001" />
        </view>
        <view class="form-item">
          <text class="form-label">手机号 *</text>
          <input v-model="form.phone" class="input" type="number" placeholder="用于接收审核结果通知" />
        </view>
        <view class="form-item">
          <text class="form-label">所在地区</text>
          <input v-model="form.region" class="input" placeholder="省 / 市 / 区县" />
        </view>
        <view class="form-item">
          <text class="form-label">职称</text>
          <input v-model="form.title" class="input" placeholder="例如：高级农艺师" />
        </view>
        <view class="form-item">
          <text class="form-label">单位名称</text>
          <input v-model="form.orgName" class="input" placeholder="例如：金乡县农业技术推广中心" />
        </view>
      </view>

      <view class="card">
        <view class="card-head">
          <text class="card-title">专业领域</text>
          <text class="card-sub">最多选 3 个（{{ selectedFields.length }}/3）</text>
        </view>
        <view class="chip-row">
          <text
            v-for="item in fields"
            :key="item"
            :class="['chip', { active: selectedFields.includes(item) }]"
            @click="toggleField(item)"
          >
            {{ item }}
          </text>
        </view>

        <view class="divider" />
        <view class="card-head">
          <text class="card-title">认证等级</text>
        </view>
        <view class="chip-row">
          <text
            v-for="item in levels"
            :key="item"
            :class="['chip', { active: form.level === item }]"
            @click="form.level = item"
          >
            {{ item }}
          </text>
        </view>
      </view>

      <view class="card">
        <view class="card-head">
          <text class="card-title">资质证明</text>
        </view>
        <view class="upload-row" @click="upload">
          <text class="upload-icon">📄</text>
          <view class="upload-copy">
            <text class="strong">职称证书 *</text>
            <text class="tiny">支持 JPG / PNG / PDF，单张不超过 5MB</text>
          </view>
          <text class="upload-btn">上传</text>
        </view>

        <view class="form-item">
          <text class="form-label">从业年限 *</text>
          <input v-model="form.years" class="input" type="number" placeholder="例如：18" />
        </view>

        <view class="form-item">
          <text class="form-label">服务区域</text>
          <view class="chip-row">
            <text
              v-for="item in regions"
              :key="item"
              :class="['chip', { active: selectedRegions.includes(item) }]"
              @click="toggleRegion(item)"
            >
              {{ item }}
            </text>
          </view>
        </view>

        <view class="form-item">
          <text class="form-label">代表成果 *</text>
          <textarea
            v-model="form.intro"
            class="textarea"
            :maxlength="300"
            placeholder="例如：从事大蒜栽培与病虫害防治 18 年，主持标准化种植示范 3,200 亩……"
            auto-height
          />
          <text class="tiny">{{ form.intro.length }}/300</text>
        </view>
      </view>

      <view class="agree" @click="agreed = !agreed">
        <text :class="['checkbox', { checked: agreed }]">{{ agreed ? '✓' : '' }}</text>
        <text class="agree-text">我承诺所提交信息真实有效，同意平台核验并链上存证，同意《专家服务协议》与《隐私政策》</text>
      </view>

      <view class="card completeness">
        <view class="between">
          <text class="strong">材料完整度</text>
          <text class="complete-num">{{ completeness }}%</text>
        </view>
        <view class="progress" style="margin-top: 10rpx">
          <view :style="{ width: `${completeness}%` }" />
        </view>
        <text class="tiny" style="display: block; margin-top: 10rpx">预计 7 个工作日内出结果</text>
      </view>

      <button class="btn btn-primary btn-block" :disabled="submitting" @click="submit">
        {{ submitting ? '提交中…' : '提交申请' }}
      </button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.head {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  padding: 26rpx 24rpx;
  background: radial-gradient(circle at 92% 0, rgba(83, 213, 138, 0.24), transparent 380rpx), linear-gradient(145deg, #073821, #0d5d3b);
  color: #ffffff;
}

.head-title {
  font-size: 30rpx;
  font-weight: 700;
}

.head-desc {
  color: rgba(255, 255, 255, 0.68);
  font-size: 24rpx;
  line-height: 1.7;
}

.steps {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  margin-top: 6rpx;
}

.step {
  color: rgba(255, 255, 255, 0.55);
  font-size: 24rpx;
}

.verify-link {
  margin-top: 10rpx;
  font-size: 24rpx;
  text-decoration: underline;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.chip-row .chip {
  margin-right: 0;
}

.upload-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-bottom: 18rpx;
  padding: 20rpx;
  border: 1rpx dashed #cfe0d6;
  border-radius: 16rpx;
  background: #f8fbf9;
}

.upload-icon {
  font-size: 30rpx;
}

.upload-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 3rpx;
}

.upload-btn {
  padding: 8rpx 18rpx;
  border-radius: 12rpx;
  background: #eef7f2;
  color: #0e5233;
  font-size: 24rpx;
}

.agree {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  margin: 6rpx 4rpx 18rpx;
}

.checkbox {
  display: flex;
  width: 34rpx;
  height: 34rpx;
  flex: 0 0 34rpx;
  align-items: center;
  justify-content: center;
  border: 1rpx solid #cfdad3;
  border-radius: 8rpx;
  background: #ffffff;
  color: #ffffff;
  font-size: 24rpx;
}

.checkbox.checked {
  border-color: #12764a;
  background: #12764a;
}

.agree-text {
  color: #718277;
  font-size: 24rpx;
  line-height: 1.6;
}

.completeness {
  background: #f8fbf9;
}

.complete-num {
  color: #0e5233;
  font-family: "DIN Alternate", monospace;
  font-size: 30rpx;
  font-weight: 700;
}
</style>
