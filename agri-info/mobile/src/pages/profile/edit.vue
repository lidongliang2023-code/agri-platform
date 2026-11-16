<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { currentOwner, getInfoUser } from '../../auth'
import { infoApi, toast, type InfoProfile } from '../../api'
const form = ref<InfoProfile>({ region: '', crops: '', scale: '', intro: '' })
const loading = ref(true)
const saving = ref(false)
const errorText = ref('')
onLoad(load)
async function load() {
  loading.value = true
  errorText.value = ''
  try { form.value = await infoApi.profile() }
  catch (error) { errorText.value = error instanceof Error ? error.message : '资料加载失败' }
  finally { loading.value = false }
}
async function save() {
  if (saving.value || loading.value || errorText.value) return
  saving.value = true
  try {
    form.value = await infoApi.saveProfile(form.value)
    toast('资料已保存', 'success')
    setTimeout(() => uni.navigateBack({ delta: 1 }), 400)
  } catch (error) { toast(error instanceof Error ? error.message : '保存失败') }
  finally { saving.value = false }
}
</script>

<template>
  <view class="page">
    <view class="avatar-block">
      <view class="avatar">👨‍🌾</view>
      <text class="change">{{ currentOwner() }}</text>
      <text class="tiny">{{ getInfoUser()?.username || '' }}</text>
    </view>

    <view class="page-pad">
      <view v-if="loading" class="loading">正在加载资料…</view>
      <view v-if="errorText" class="empty"><text>{{ errorText }}</text><button class="btn" @click="load">重新加载</button></view>
      <view class="card">
        <view class="form-item">
          <text class="form-label">昵称</text>
          <text>{{ currentOwner() }}</text>
          <text class="tiny">昵称由统一用户中心维护</text>
        </view>

        <view class="form-item">
          <text class="form-label">身份</text>
          <view class="field">
            <text class="field-label">统一账号</text>
            <text class="tiny">认证结果请查看「我的认证」</text>
          </view>
        </view>

        <view class="form-item">
          <text class="form-label">所在地区</text>
          <input v-model="form.region" :maxlength="100" class="input" placeholder="省 / 市 / 区县" />
        </view>

        <view class="form-item">
          <text class="form-label">主营品种</text>
          <input v-model="form.crops" :maxlength="200" class="input" placeholder="用「/」分隔多个品种" />
        </view>

        <view class="form-item">
          <text class="form-label">经营规模</text>
          <input v-model="form.scale" :maxlength="100" class="input" placeholder="例如：合作社 · 320 亩" />
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
          本页保存资讯使用资料，按统一账号隔离存储。昵称、头像及身份认证由统一用户中心维护。
        </text>
      </view>

      <button class="btn btn-primary btn-block" style="margin-top: 18rpx" :disabled="loading || saving || !!errorText" :loading="saving" @click="save">保存资料</button>
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
  font-size: 24rpx;
}
</style>
