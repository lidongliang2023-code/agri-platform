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
      <el-form-item label="公司名称" prop="companyName">
        <el-input v-model="form.companyName" />
      </el-form-item>
      <el-form-item label="信用代码" prop="creditCode">
        <el-input v-model="form.creditCode" />
      </el-form-item>
      <el-form-item label="所属行业" prop="industry">
        <el-input v-model="form.industry" />
      </el-form-item>
      <el-form-item label="联系人" prop="legalName">
        <el-input v-model="form.legalName" />
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
      <el-form-item label="银行名称" prop="bankName">
        <el-input v-model="form.bankName" />
      </el-form-item>
      <el-form-item label="银行账号" prop="bankAccount">
        <el-input v-model="form.bankAccount" />
      </el-form-item>
      <el-form-item label="开户支行" prop="bankBranch">
        <el-input v-model="form.bankBranch" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="submitForm">保存修改</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { supplierApi } from '../api'

const formRef = ref(null)

const form = reactive({
  id: 1,
  shopName: '',
  shopDesc: '',
  companyName: '',
  creditCode: '',
  industry: '',
  legalName: '',
  contactPhone: '',
  province: '',
  city: '',
  district: '',
  address: '',
  bankName: '',
  bankAccount: '',
  bankBranch: ''
})

const rules = {
  shopName: [{ required: true, message: '请输入店铺名称', trigger: 'blur' }],
  companyName: [{ required: true, message: '请输入公司名称', trigger: 'blur' }],
  contactPhone: [{ required: true, message: '请输入联系电话', trigger: 'blur' }]
}

onMounted(() => {
  loadProfile()
})

const loadProfile = async () => {
  const res = await supplierApi.getDetail(1)
  Object.assign(form, res)
}

const submitForm = async () => {
  formRef.value.validate(async (valid) => {
    if (valid) {
      const res = await supplierApi.updateInfo(form)
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