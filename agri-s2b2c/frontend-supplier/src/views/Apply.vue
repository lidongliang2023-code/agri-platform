<template>
  <div class="apply-page">
    <div class="intro">
      <div>
        <h2>{{ isReapply ? '重新提交入驻申请' : '供应商入驻申请' }}</h2>
        <p>提交后由平台审核；审核通过后还需在用户中心完成批发商业务身份认证，才能上架商品和进入工作台。</p>
      </div>
      <el-steps :active="isReapply ? 1 : 0" finish-status="success" simple class="steps">
        <el-step title="填写资料" />
        <el-step title="平台审核" />
        <el-step title="业务身份" />
        <el-step title="开通工作台" />
      </el-steps>
    </div>

    <el-alert v-if="isReapply" type="warning" show-icon :closable="false"
              title="上次申请未通过"
              :description="profile.auditOpinion || '请根据平台意见调整资料后重新提交。'" />

    <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
      <div class="card">
        <h3>主体信息</h3>
        <div class="grid">
          <el-form-item label="公司名称" prop="companyName">
            <el-input v-model="form.companyName" maxlength="200" placeholder="与营业执照一致" />
          </el-form-item>
          <el-form-item label="统一信用代码" prop="creditCode">
            <el-input v-model="form.creditCode" maxlength="30" placeholder="营业执照统一社会信用代码" />
          </el-form-item>
          <el-form-item label="所属行业" prop="industry">
            <el-select v-model="form.industry" placeholder="选择行业" style="width: 100%">
              <el-option label="种植业" value="种植业" />
              <el-option label="养殖业" value="养殖业" />
              <el-option label="茶业" value="茶业" />
              <el-option label="食品加工" value="食品加工" />
              <el-option label="农产品贸易" value="农产品贸易" />
            </el-select>
          </el-form-item>
          <el-form-item label="省 / 市 / 区" prop="province">
            <div class="region-row">
              <el-input v-model="form.province" placeholder="省" />
              <el-input v-model="form.city" placeholder="市" />
              <el-input v-model="form.district" placeholder="区/县" />
            </div>
          </el-form-item>
          <el-form-item label="详细地址" prop="address" class="span-2">
            <el-input v-model="form.address" maxlength="200" placeholder="详细经营地址" />
          </el-form-item>
        </div>
      </div>

      <div class="card">
        <h3>联系人与资质</h3>
        <div class="grid">
          <el-form-item label="法定代表人" prop="legalName">
            <el-input v-model="form.legalName" maxlength="50" />
          </el-form-item>
          <el-form-item label="身份证号" prop="legalIdCard">
            <el-input v-model="form.legalIdCard" maxlength="18" />
          </el-form-item>
          <el-form-item label="联系电话" prop="contactPhone">
            <el-input v-model="form.contactPhone" maxlength="11" placeholder="用于审核联系" />
          </el-form-item>
        </div>
      </div>

      <div class="card">
        <h3>店铺与结算</h3>
        <div class="grid">
          <el-form-item label="店铺名称" prop="shopName">
            <el-input v-model="form.shopName" maxlength="100" />
          </el-form-item>
          <el-form-item label="店铺描述" prop="shopDesc" class="span-2">
            <el-input v-model="form.shopDesc" type="textarea" :rows="3" maxlength="500" show-word-limit />
          </el-form-item>
          <el-form-item label="银行名称" prop="bankName">
            <el-input v-model="form.bankName" maxlength="100" />
          </el-form-item>
          <el-form-item label="银行账号" prop="bankAccount">
            <el-input v-model="form.bankAccount" maxlength="40" />
          </el-form-item>
          <el-form-item label="开户支行" prop="bankBranch">
            <el-input v-model="form.bankBranch" maxlength="100" />
          </el-form-item>
        </div>
      </div>

      <div class="actions">
        <el-button @click="router.push('/audit-progress')">查看审核进度</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">
          {{ isReapply ? '重新提交申请' : '提交入驻申请' }}
        </el-button>
      </div>
    </el-form>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { supplierApi } from '../api'
import { resetSupplierSession } from '../api/supplierSession'

const router = useRouter()
const formRef = ref(null)
const submitting = ref(false)
const isReapply = ref(false)
const profile = reactive({ applied: false, auditOpinion: '', id: '' })

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
  creditCode: [
    { required: true, message: '请输入统一信用代码', trigger: 'blur' },
    { pattern: /^[0-9A-Za-z]{6,30}$/, message: '信用代码应为 6-30 位字母或数字', trigger: 'blur' },
  ],
  contactPhone: [
    { required: true, message: '请输入联系电话', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入 11 位手机号', trigger: 'blur' },
  ],
  shopName: [{ required: true, message: '请输入店铺名称', trigger: 'blur' }],
  province: [{ required: true, message: '请填写省份', trigger: 'blur' }],
}

onMounted(loadProfile)

async function loadProfile() {
  try {
    const data = (await supplierApi.getProfile()) || {}
    Object.assign(profile, data)
    if (!data.applied) return
    if (String(data.auditStatus || '').toUpperCase() === 'APPROVED') {
      ElMessage.info('已入驻商城，正在进入工作台')
      router.replace('/')
      return
    }
    if (String(data.auditStatus || '').toUpperCase() === 'PENDING') {
      router.replace('/audit-progress')
      return
    }
    isReapply.value = true
    const detail = await supplierApi.getDetail(data.id)
    Object.keys(form).forEach((key) => {
      if (detail?.[key] !== undefined && detail?.[key] !== null) form[key] = detail[key]
    })
  } catch (e) {
    ElMessage.error(e?.message || '入驻状态读取失败')
  }
}

async function submitForm() {
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    submitting.value = true
    try {
      const res = await supplierApi.apply({ ...form })
      if (res?.success === false) {
        ElMessage.error(res.message || '提交失败')
        return
      }
      resetSupplierSession()
      ElMessage.success(res?.message || '申请已提交，等待平台审核')
      router.push('/audit-progress')
    } catch (e) {
      ElMessage.error(e?.message || '提交失败')
    } finally {
      submitting.value = false
    }
  })
}
</script>

<style scoped>
.apply-page { display: flex; flex-direction: column; gap: 16px; }
.intro { padding: 20px 22px; border: 1px solid #e3eae5; border-radius: 14px; background: #fff; }
.intro h2 { margin: 0 0 6px; font-size: 20px; }
.intro p { margin: 0 0 14px; color: #6b7c72; font-size: 13px; line-height: 1.7; }
.steps { max-width: 760px; }
.card { padding: 18px 22px; border: 1px solid #e3eae5; border-radius: 14px; background: #fff; }
.card h3 { margin: 0 0 14px; font-size: 15px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 18px; }
.span-2 { grid-column: span 2; }
.region-row { display: flex; gap: 8px; width: 100%; }
.actions { display: flex; justify-content: flex-end; gap: 10px; padding: 4px 0 20px; }
@media (max-width: 900px) {
  .grid { grid-template-columns: 1fr; }
  .span-2 { grid-column: span 1; }
}
</style>