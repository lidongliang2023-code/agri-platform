<template>
  <div class="settings-page" v-loading="loading">
    <div class="page-head">
      <div>
        <h2>店铺与资质</h2>
        <p>维护店铺展示信息与联系方式；主体实名、证照与资质审核由用户中心主责，本页只展示渠道档案与经营状态。</p>
      </div>
      <el-button type="primary" :loading="saving" @click="save">保存修改</el-button>
    </div>

    <div class="grid">
      <div class="card">
        <h3>店铺信息</h3>
        <el-form label-width="100px">
          <el-form-item label="店铺名称">
            <el-input v-model="form.shopName" maxlength="100" />
          </el-form-item>
          <el-form-item label="店铺简介">
            <el-input v-model="form.shopDesc" type="textarea" :rows="3" maxlength="500" show-word-limit />
          </el-form-item>
          <el-form-item label="店铺 Logo">
            <el-input v-model="form.shopLogo" placeholder="图片地址（可选）" />
          </el-form-item>
          <el-form-item label="联系人">
            <el-input v-model="form.contactName" maxlength="50" />
          </el-form-item>
          <el-form-item label="联系电话">
            <el-input v-model="form.contactPhone" maxlength="20" />
          </el-form-item>
          <el-form-item label="所在地区">
            <div class="region-row">
              <el-input v-model="form.province" placeholder="省" />
              <el-input v-model="form.city" placeholder="市" />
              <el-input v-model="form.district" placeholder="区/县" />
            </div>
          </el-form-item>
          <el-form-item label="详细地址">
            <el-input v-model="form.address" maxlength="200" />
          </el-form-item>
        </el-form>
      </div>

      <div class="side">
        <div class="card">
          <h3>渠道档案</h3>
          <dl class="descs">
            <dt>商家 ID</dt><dd>{{ profile.id || '—' }}</dd>
            <dt>渠道等级</dt><dd><el-tag type="success">{{ gradeText(profile.grade) }}</el-tag></dd>
            <dt>审核状态</dt><dd>{{ auditText(profile.auditStatus) }}</dd>
            <dt>审核时间</dt><dd>{{ profile.auditTime || '—' }}</dd>
            <dt>注册类型</dt><dd>{{ profile.registerType === 'COMPANY' ? '企业' : '个人' }}</dd>
            <dt>主体名称</dt><dd>{{ profile.companyName || '—' }}</dd>
          </dl>
        </div>

        <div class="card">
          <h3>等级考核</h3>
          <dl class="descs">
            <dt>当前等级</dt><dd><el-tag type="success">{{ gradeText(gradeHistory.currentGrade || profile.grade) }}</el-tag></dd>
            <dt>近 {{ gradeHistory.days || 30 }} 天订单</dt><dd>{{ gradeHistory.orders || 0 }}</dd>
            <dt>近 {{ gradeHistory.days || 30 }} 天 GMV</dt><dd>¥{{ money(gradeHistory.gmv) }}</dd>
          </dl>
          <el-table :data="gradeHistory.changes || []" size="small" border style="margin-top: 10px">
            <el-table-column label="调整" width="170">
              <template #default="{ row }">{{ gradeText(row.fromGrade) }} → {{ gradeText(row.toGrade) }}</template>
            </el-table-column>
            <el-table-column prop="orders" label="订单" width="70" />
            <el-table-column label="GMV" width="110">
              <template #default="{ row }">¥{{ money(row.gmv) }}</template>
            </el-table-column>
            <el-table-column prop="createTime" label="时间" />
          </el-table>
          <el-empty v-if="!(gradeHistory.changes || []).length" description="暂无等级调整记录" :image-size="50" />
          <p class="note">每月 1 日自动考核；平台调整等级后，新订单按新等级计算佣金。</p>
        </div>

        <div class="card">
          <h3>经营资质</h3>
          <p class="muted">营业执照、食品经营许可、负责人实名等资质在「用户中心 → 资质证照」维护，本模块不重复建资质数据。</p>
          <el-table :data="qualifications" size="small" border>
            <el-table-column prop="name" label="资质" />
            <el-table-column prop="owner" label="维护方" width="100" />
            <el-table-column prop="status" label="状态" width="100" />
          </el-table>
          <p class="note">资质过期会由用户中心提醒；商家端仅按审核结果展示经营能力，不自行判定资质有效性。</p>
        </div>

        <div class="card">
          <h3>结算与安全</h3>
          <p class="muted">提现审核与打款流水在「账户与提现」查看；支付密码、手机号与实名信息请在用户中心维护。</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { channelApi } from '../api'

const loading = ref(true)
const saving = ref(false)
const profile = ref({})
const gradeHistory = ref({})
const form = reactive({
  id: '',
  shopName: '',
  shopDesc: '',
  shopLogo: '',
  contactName: '',
  contactPhone: '',
  province: '',
  city: '',
  district: '',
  address: '',
})

const qualifications = [
  { name: '营业执照 / 主体实名', owner: '用户中心', status: '按其审核结果' },
  { name: '食品经营许可证', owner: '用户中心', status: '按其审核结果' },
  { name: '负责人身份证', owner: '用户中心', status: '按其审核结果' },
]

onMounted(() => { load(); loadGradeHistory() })

async function loadGradeHistory() {
  try {
    gradeHistory.value = (await channelApi.getGradeHistory(30)) || {}
  } catch {
    gradeHistory.value = {}
  }
}

async function load() {
  loading.value = true
  try {
    const data = (await channelApi.getProfile()) || {}
    profile.value = data
    Object.keys(form).forEach((key) => {
      if (data[key] !== undefined && data[key] !== null) form[key] = data[key]
    })
    form.id = data.id || ''
  } catch (e) {
    ElMessage.error(e?.message || '店铺信息读取失败')
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!form.shopName.trim()) {
    ElMessage.warning('请填写店铺名称')
    return
  }
  saving.value = true
  try {
    const res = await channelApi.updateInfo({ ...form })
    if (res?.success === false) {
      ElMessage.error(res.message || '保存失败')
      return
    }
    ElMessage.success(res?.message || '已保存')
    await load()
  } catch (e) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

const money = (value) => Number(value || 0).toFixed(2)
const gradeText = (value) => ({ LEVEL_1: '铜牌渠道', LEVEL_2: '银牌渠道', LEVEL_3: '金牌渠道' }[value] || value || '待定级')
const auditText = (value) => ({ PENDING: '待审核', APPROVED: '已通过', REJECTED: '已驳回' }[value] || value || '—')
</script>

<style scoped>
.settings-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 780px; }
.grid { display: grid; grid-template-columns: 1.3fr 1fr; gap: 16px; align-items: start; }
.side { display: flex; flex-direction: column; gap: 16px; }
.card { padding: 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.card h3 { margin: 0 0 14px; font-size: 15px; }
.descs { display: grid; grid-template-columns: 100px 1fr; gap: 10px 12px; margin: 0; font-size: 13px; }
.descs dt { color: #84938a; }
.descs dd { margin: 0; color: #173e2a; word-break: break-all; }
.region-row { display: flex; gap: 8px; width: 100%; }
.muted { margin: 0 0 10px; color: #84938a; font-size: 12px; line-height: 1.7; }
.note { margin: 10px 0 0; color: #94a198; font-size: 12px; line-height: 1.6; }
@media (max-width: 1000px) { .grid { grid-template-columns: 1fr; } }
</style>
