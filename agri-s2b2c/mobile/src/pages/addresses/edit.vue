<template>
  <view class="page edit-page">
    <view class="form-card">
      <view class="card-head"><text class="card-title">{{ id ? '编辑地址' : '新增地址' }}</text><text class="card-sub">DELIVERY ADDRESS</text></view>
      <view class="form-item">
        <text class="form-label">收货人</text>
        <input v-model="form.name" class="input" placeholder="请输入收货人姓名" />
      </view>
      <view class="form-item">
        <text class="form-label">联系电话</text>
        <input v-model="form.phone" class="input" type="number" maxlength="11" placeholder="请输入联系电话" />
      </view>
      <view class="area-row">
        <view class="form-item area-item">
          <text class="form-label">省份</text>
          <input v-model="form.province" class="input" placeholder="省份" />
        </view>
        <view class="form-item area-item">
          <text class="form-label">城市</text>
          <input v-model="form.city" class="input" placeholder="城市" />
        </view>
      </view>
      <view class="form-item">
        <text class="form-label">区县</text>
        <input v-model="form.district" class="input" placeholder="区县" />
      </view>
      <view class="form-item">
        <text class="form-label">详细地址</text>
        <textarea v-model="form.address" class="textarea" placeholder="街道、门牌号、楼栋和房间号" />
      </view>
      <view class="default-row">
        <view><text>设为默认地址</text><small>下单时优先使用此地址</small></view>
        <switch :checked="form.isDefault" color="#12764a" @change="onDefaultChange" />
      </view>
    </view>

    <view class="fixed-bottom save-bar">
      <button class="btn btn-primary btn-block" :loading="submitting" @tap="submit">保存地址</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { mallApi, type Address } from '../../api'
import { session } from '../../session'
import { toast } from '../../utils'

const id = ref('')
const submitting = ref(false)
const form = reactive<Address>({
  id: 0,
  consumerId: session.user?.id || 0,
  name: '',
  phone: '',
  province: '',
  city: '',
  district: '',
  address: '',
  isDefault: false,
  status: 'ACTIVE',
})

onLoad(async (options) => {
  id.value = String(options?.id || '')
  if (!session.user) {
    uni.redirectTo({ url: '/pages/login/index?redirect=%2Fpages%2Faddresses%2Findex' })
    return
  }
  form.consumerId = session.user.id
  if (id.value) {
    const list = await mallApi.getAddresses(session.user.id)
    const current = list.find((item) => String(item.id) === id.value)
    if (current) Object.assign(form, current)
  }
})

async function submit() {
  if (!form.name.trim()) return toast('请输入收货人')
  if (!/^1\d{10}$/.test(form.phone)) return toast('请输入正确的联系电话')
  if (!form.province.trim() || !form.city.trim() || !form.district.trim()) return toast('请填写完整地区')
  if (!form.address.trim()) return toast('请输入详细地址')
  submitting.value = true
  try {
    const result = id.value
      ? await mallApi.updateAddress({ ...form, id: id.value })
      : await mallApi.addAddress(form)
    if (!result.success) throw new Error('地址保存失败')
    toast('地址已保存', 'success')
    setTimeout(() => uni.navigateBack(), 300)
  } catch (error) {
    toast((error as Error).message)
  } finally {
    submitting.value = false
  }
}

function onDefaultChange(event: any) {
  form.isDefault = Boolean(event.detail.value)
}
</script>

<style scoped lang="scss">
.edit-page {
  padding-bottom: calc(130rpx + env(safe-area-inset-bottom));
}

.form-card {
  margin: 22rpx;
  padding: 26rpx;
  border: 1rpx solid #e3eae5;
  border-radius: 22rpx;
  background: #fff;
}

.area-row {
  display: flex;
  gap: 14rpx;
}

.area-item {
  min-width: 0;
  flex: 1;
}

.default-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #edf2ee;
}

.default-row text,
.default-row small {
  display: block;
}

.default-row text {
  color: #0b1a12;
  font-size: 23rpx;
  font-weight: 650;
}

.default-row small {
  margin-top: 5rpx;
  color: #93a29a;
  font-size: 18rpx;
}

.save-bar {
  padding-top: 14rpx;
}
</style>
