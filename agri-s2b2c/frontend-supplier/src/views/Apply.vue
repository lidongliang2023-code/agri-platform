<template>
  <div class="apply-page">
    <el-form :model="form" :rules="rules" ref="formRef" label-width="120px">
      <h2>供应商入驻申请</h2>
      <el-form-item label="公司名称" prop="companyName">
        <el-input v-model="form.companyName" />
      </el-form-item>
      <el-form-item label="信用代码" prop="creditCode">
        <el-input v-model="form.creditCode" />
      </el-form-item>
      <el-form-item label="所属行业" prop="industry">
        <el-select v-model="form.industry">
          <el-option label="种植业" value="种植业" />
          <el-option label="养殖业" value="养殖业" />
          <el-option label="茶业" value="茶业" />
          <el-option label="食品加工" value="食品加工" />
          <el-option label="农产品贸易" value="农产品贸易" />
        </el-select>
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
      <el-form-item label="法定代表人" prop="legalName">
        <el-input v-model="form.legalName" />
      </el-form-item>
      <el-form-item label="身份证号" prop="legalIdCard">
        <el-input v-model="form.legalIdCard" />
      </el-form-item>
      <el-form-item label="联系电话" prop="contactPhone">
        <el-input v-model="form.contactPhone" />
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
import { supplierApi } from '../api'

const router = useRouter()
const formRef = ref(null)

const form = reactive({
  companyName: '',
  creditCode: '',
  industry: '',
  province: '',
  city: '',
  district: '',
  address: '',
  legalName: '',
  legalIdCard: '',
  contactPhone: '',
  bankName: '',
  bankAccount: '',
  bankBranch: '',
  shopName: '',
  shopDesc: ''
})

const rules = {
  companyName: [{ required: true, message: '请输入公司名称', trigger: 'blur' }],
  creditCode: [{ required: true, message: '请输入信用代码', trigger: 'blur' }],
  contactPhone: [{ required: true, message: '请输入联系电话', trigger: 'blur' }],
  shopName: [{ required: true, message: '请输入店铺名称', trigger: 'blur' }]
}

const submitForm = async () => {
  formRef.value.validate(async (valid) => {
    if (valid) {
      const res = await supplierApi.apply(form)
      if (res.success) {
        alert(res.message)
        router.push('/audit-progress')
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