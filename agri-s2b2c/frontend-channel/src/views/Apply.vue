<template>
  <div class="apply-page">
    <el-form :model="form" :rules="rules" ref="formRef" label-width="120px">
      <h2>渠道商入驻申请</h2>
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
      <el-form-item label="联系人" prop="contactName">
        <el-input v-model="form.contactName" />
      </el-form-item>
      <el-form-item label="联系电话" prop="contactPhone">
        <el-input v-model="form.contactPhone" />
      </el-form-item>
      <el-form-item label="推荐人ID" prop="referrerId">
        <el-input v-model.number="form.referrerId" type="number" />
      </el-form-item>
      <el-form-item label="店铺名称" prop="shopName">
        <el-input v-model="form.shopName" />
      </el-form-item>
      <el-form-item label="店铺描述" prop="shopDesc">
        <el-input v-model="form.shopDesc" type="textarea" :rows="3" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="submitForm">提交申请</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { channelApi } from '../api'

const router = useRouter()
const formRef = ref(null)

const form = reactive({
  registerType: 'PERSONAL',
  companyName: '',
  creditCode: '',
  province: '',
  city: '',
  district: '',
  address: '',
  contactName: '',
  contactPhone: '',
  referrerId: null,
  shopName: '',
  shopDesc: ''
})

const rules = {
  contactName: [{ required: true, message: '请输入联系人', trigger: 'blur' }],
  contactPhone: [{ required: true, message: '请输入联系电话', trigger: 'blur' }],
  shopName: [{ required: true, message: '请输入店铺名称', trigger: 'blur' }]
}

const submitForm = async () => {
  formRef.value.validate(async (valid) => {
    if (valid) {
      const res = await channelApi.apply(form)
      if (res.success) {
        alert(res.message)
        router.push('/')
      }
    }
  })
}
</script>

<style scoped>
.apply-page {
  background: #fff;
  border-radius: 12px;
  padding: 30px;
}

.apply-page h2 {
  margin-bottom: 30px;
}
</style>