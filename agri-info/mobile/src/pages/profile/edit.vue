<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { currentOwner, getInfoUser } from '../../auth'

interface ProfileForm {
  nickname: string
  identity: string
  region: string
  crops: string
  scale: string
  intro: string
}

const STORAGE_KEY = 'info_profile'

const form = ref<ProfileForm>({
  nickname: currentOwner() || '平台用户',
  identity: '种植户（已认证）',
  region: '山东省 潍坊市',
  crops: '大蒜 / 番茄 / 苹果',
  scale: '合作社 · 320 亩',
  intro: '从事大蒜与设施蔬菜种植 12 年，关注行情走势与病虫害防治，欢迎同行交流。',
})

onLoad(() => {
  const saved = uni.getStorageSync(STORAGE_KEY)
  if (saved) form.value = { ...form.value, ...saved }
})

function save() {
  if (!form.value.nickname.trim()) {
    uni.showToast({ title: '请填写昵称', icon: 'none' })
    return
  }
  uni.setStorageSync(STORAGE_KEY, form.value)
  uni.showToast({ title: '已保存', icon: 'success' })
  setTimeout(() => uni.navigateBack({ delta: 1 }), 400)
}

function changeAvatar() {
  uni.chooseImage({
    count: 1,
    success: () => uni.showToast({ title: '头像已更新（本机预览）', icon: 'none' }),
    fail: () => undefined,
  })
}
</script>

<template>
  <view class="page">
    <view class="avatar-block">
      <view class="avatar" @click="changeAvatar">👨‍🌾</view>
      <text class="change">更换头像</text>
      <text class="tiny">{{ getInfoUser()?.username || '' }}</text>
    </view>

    <view class="page-pad">
      <view class="card">
        <view class="form-item">
          <text class="form-label">昵称</text>
          <input v-model="form.nickname" class="input" placeholder="请输入昵称" />
        </view>

        <view class="form-item">
          <text class="form-label">身份</text>
          <view class="field">
            <text class="field-label">{{ form.identity }}</text>
            <text class="tiny">由平台认证结果决定</text>
          </view>
        </view>

        <view class="form-item">
          <text class="form-label">所在地区</text>
          <input v-model="form.region" class="input" placeholder="省 / 市 / 区县" />
        </view>

        <view class="form-item">
          <text class="form-label">主营品种</text>
          <input v-model="form.crops" class="input" placeholder="用「/」分隔多个品种" />
        </view>

        <view class="form-item">
          <text class="form-label">经营规模</text>
          <input v-model="form.scale" class="input" placeholder="例如：合作社 · 320 亩" />
        </view>

        <view class="form-item">
          <text class="form-label">简介</text>
          <textarea v-model="form.intro" class="textarea" :maxlength="120" auto-height />
          <text class="tiny">{{ form.intro.length }}/120</text>
        </view>
      </view>

      <view class="notice">
        <text>·</text>
        <text>
          昵称同时作为信息资讯模块私域数据的归属标识（我的发布、预警、订阅、收藏、AI 记录），
          正式环境由平台用户中心统一维护，本页在移动端做本机留存与预览。
        </text>
      </view>

      <button class="btn btn-primary btn-block" style="margin-top: 18rpx" @click="save">保存</button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.avatar-block {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 8rpx;
  padding: 30rpx 0 26rpx;
  background: #ffffff;
}

.avatar {
  display: flex;
  width: 140rpx;
  height: 140rpx;
  align-items: center;
  justify-content: center;
  border-radius: 40rpx;
  background: #eef6f1;
  font-size: 62rpx;
}

.change {
  color: #12764a;
  font-size: 22rpx;
}
</style>
