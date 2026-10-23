<template>
  <div class="login-page">
    <div class="header">
      <h1>🌾 农联优选</h1>
      <p>品质农产品，直达您手中</p>
    </div>
    <div class="login-form">
      <van-cell-group inset>
        <van-field v-model="phone" placeholder="请输入手机号" type="tel" maxlength="11" />
      </van-cell-group>
      <van-button type="primary" block class="login-btn" @click="handleLogin">登录</van-button>
      <p class="tips">首次登录将自动注册</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { consumerApi } from '../api'

const router = useRouter()
const userStore = useUserStore()
const phone = ref('')

const handleLogin = async () => {
  if (!phone.value || phone.value.length !== 11) {
    alert('请输入正确的手机号')
    return
  }
  const res = await consumerApi.login(phone.value)
  if (res.success) {
    userStore.login(res.data)
    router.push('/')
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 100px;
}

.header {
  text-align: center;
  margin-bottom: 60px;
}

.header h1 {
  font-size: 36px;
  color: #fff;
  margin-bottom: 10px;
}

.header p {
  font-size: 16px;
  color: rgba(255,255,255,0.8);
}

.login-form {
  width: 90%;
  max-width: 360px;
  background: #fff;
  border-radius: 16px;
  padding: 30px;
}

.login-btn {
  margin-top: 20px;
  height: 48px;
  font-size: 18px;
}

.tips {
  text-align: center;
  color: #999;
  font-size: 12px;
  margin-top: 16px;
}
</style>