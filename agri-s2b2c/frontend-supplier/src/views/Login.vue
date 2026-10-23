<template>
  <div class="login-page">
    <div class="login-container">
      <div class="logo">
        <span class="logo-icon">🌾</span>
        <h1>农联优选 - 供应商管理</h1>
      </div>
      <el-form :model="form" :rules="rules" ref="formRef" class="login-form">
        <el-form-item prop="phone">
          <el-input v-model="form.phone" placeholder="手机号" prefix-icon="Phone" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" placeholder="密码" prefix-icon="Lock" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" block @click="handleLogin">登录</el-button>
        </el-form-item>
        <div class="links">
          <span @click="goApply">还没有账号？立即申请入驻</span>
        </div>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const formRef = ref(null)
const form = reactive({
  phone: '',
  password: ''
})

const rules = {
  phone: [{ required: true, message: '请输入手机号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const handleLogin = () => {
  formRef.value.validate((valid) => {
    if (valid) {
      localStorage.setItem('supplier', JSON.stringify({ id: 1, phone: form.phone }))
      router.push('/')
    }
  })
}

const goApply = () => {
  router.push('/apply')
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-container {
  width: 400px;
  background: #fff;
  border-radius: 16px;
  padding: 40px;
}

.logo {
  text-align: center;
  margin-bottom: 30px;
}

.logo-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 10px;
}

.logo h1 {
  font-size: 20px;
  color: #333;
}

.login-form {
  margin-top: 20px;
}

.links {
  text-align: center;
  margin-top: 15px;
}

.links span {
  color: #667eea;
  cursor: pointer;
}
</style>