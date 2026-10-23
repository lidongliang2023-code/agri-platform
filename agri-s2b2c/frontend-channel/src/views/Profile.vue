<template>
  <div class="profile-page">
    <el-form :model="form" :rules="rules" ref="formRef" label-width="120px">
      <h2>店铺信息</h2>
      <el-form-item label="店铺名称" prop="shopName">
        <el-input v-model="form.shopName" />
      </el-form-item>
      <el-form-item label="店铺描述" prop="shopDesc">
        <el-input v-model="form.shopDesc" type="textarea" :rows="3" />
      </el-form-item>
      <el-form-item label="注册类型" prop="registerType">
        <el-select v-model="form.registerType">
          <el-option label="个人" value="PERSONAL" />
          <el-option label="企业" value="ENTERPRISE" />
        </el-select>
      </el-form-item>
      <el-form-item label="公司名称" prop="companyName">
        <el-input v-model="form.companyName" />
      </el-form-item>
      <el-form-item label="信用代码" prop="creditCode">
        <el-input v-model="form.creditCode" />
      </el-form-item>
      <el-form-item label="联系人" prop="contactName">
        <el-input v-model="form.contactName" />
      </el-form-item>
      <el-form-item label="联系电话" prop="contactPhone">
        <el-input v-model="form.contactPhone" />
      </el-form-item>
      <el-form-item label="省份" prop="province">
        <el-input v-model="form.province" />
      </el-form-item>
      <el-form-item label="城市" prop="city">
        <el-input v-model="form.city" />
      </el-form-item>
      <el-form-item label="区县" prop="district">
        <el-input v-model="form.district" />
      </el-form-item>
      <el-form-item label="详细地址" prop="address">
        <el-input v-model="form.address" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="submitForm">保存修改</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { channelApi } from '../api'

const formRef = ref(null)

const form = reactive({
  id: 1,
  shopName: '',
  shopDesc: '',
  registerType: 'PERSONAL',
  companyName: '',
  creditCode: '',
  contactName: '',
  contactPhone: '',
  province: '',
  city: '',
  district: '',
  address: ''
})

const rules = {
  shopName: [{ required: true, message: '请输入店铺名称', trigger: 'blur' }],
  contactName: [{ required: true, message: '请输入联系人', trigger: 'blur' }],
  contactPhone: [{ required: true, message: '请输入联系电话', trigger: 'blur' }]
}

onMounted(() => {
  loadProfile()
})

const loadProfile = async () => {
  const res = await channelApi.getDetail(1)
  Object.assign(form, res)
}

const submitForm = async () => {
  formRef.value.validate(async (valid) => {
    if (valid) {
      const res = await channelApi.updateInfo(form)
      if (res.success) {
        alert('信息更新成功')
      }
    }
  })
}
</script>

<style scoped>
.profile-page {
  background: #fff;
  border-radius: 12px;
  padding: 30px;
}

.profile-page h2 {
  margin-bottom: 30px;
}
</style>