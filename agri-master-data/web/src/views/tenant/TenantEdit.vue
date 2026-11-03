<template>
  <div class="subject-edit">
    <header class="page-header">
      <button class="back-btn" @click="goBack">← 返回详情</button>
      <div>
        <h1>编辑主体资料</h1>
        <p>主体类型、编码及认证材料由注册和审核流程产生，本页维护可运营修正的注册档案。</p>
      </div>
    </header>

    <div v-if="loadError" class="state-card error">{{ loadError }}</div>
    <div v-else-if="loading" class="state-card">正在加载主体资料…</div>

    <form v-else class="edit-layout" @submit.prevent="save">
      <div class="form-column">
        <section class="form-card">
          <div class="card-head">
            <h2>基本信息</h2>
            <span class="type-badge" :class="isPersonal ? 'personal' : 'enterprise'">{{ subjectTypeText(tenantType) }}</span>
          </div>
          <div class="form-grid">
            <label class="form-field">
              <span>{{ isPersonal ? '真实姓名 *' : '企业名称 *' }}</span>
              <input v-model.trim="form.tenantName" type="text" />
            </label>
            <label class="form-field">
              <span>主体编码</span>
              <input :value="form.tenantCode" type="text" disabled />
            </label>

            <template v-if="isPersonal">
              <label class="form-field">
                <span>身份证号码（脱敏）</span>
                <input :value="form.identityNoMasked || '—'" type="text" disabled />
              </label>
              <label class="form-field">
                <span>个人经营类型</span>
                <input v-model.trim="form.businessType" list="business-type-options" placeholder="请选择或输入经营类型" />
                <datalist id="business-type-options">
                  <option v-for="item in BUSINESS_TYPES" :key="item" :value="item" />
                </datalist>
              </label>
              <label class="form-field">
                <span>证件有效期</span>
                <input :value="validityText" type="text" disabled />
              </label>
            </template>

            <template v-else>
              <label class="form-field">
                <span>统一社会信用代码</span>
                <input v-model.trim="form.creditCode" type="text" maxlength="18" />
              </label>
              <label class="form-field">
                <span>所属行业</span>
                <input v-model.trim="form.industry" list="industry-options" placeholder="请选择或输入所属行业" />
                <datalist id="industry-options">
                  <option v-for="item in INDUSTRIES" :key="item" :value="item" />
                </datalist>
              </label>
              <label class="form-field">
                <span>企业规模</span>
                <input v-model.trim="form.companySize" list="company-size-options" placeholder="请选择或输入企业规模" />
                <datalist id="company-size-options">
                  <option v-for="item in COMPANY_SIZES" :key="item" :value="item" />
                </datalist>
              </label>
              <label class="form-field">
                <span>法定代表人</span>
                <input :value="form.legalPerson || '—'" type="text" disabled />
              </label>
              <label class="form-field">
                <span>营业执照号</span>
                <input :value="form.licenseNo || '—'" type="text" disabled />
              </label>
            </template>

            <label class="form-field wide-field">
              <span>注册地址</span>
              <input v-model.trim="form.address" type="text" placeholder="请输入省、市、区和详细地址" />
            </label>
          </div>
        </section>

        <section class="form-card">
          <div class="card-head"><h2>联系人信息</h2></div>
          <div class="form-grid">
            <label class="form-field">
              <span>联系人</span>
              <input v-model.trim="form.contactName" type="text" />
            </label>
            <label class="form-field">
              <span>联系电话</span>
              <input v-model.trim="form.contactPhone" type="tel" maxlength="11" />
            </label>
            <label class="form-field">
              <span>主体状态</span>
              <select v-model.number="form.status">
                <option :value="1">启用</option>
                <option :value="0">停用</option>
              </select>
            </label>
          </div>
        </section>
      </div>

      <aside class="side-column">
        <section class="form-card read-only-card">
          <div class="card-head"><h2>认证信息</h2></div>
          <dl>
            <div><dt>认证状态</dt><dd>{{ verifyText(form.verifyStatus) }}</dd></div>
            <div><dt>认证单号</dt><dd>{{ form.certificationNo || '—' }}</dd></div>
            <div><dt>认证渠道</dt><dd>{{ form.verificationChannel || '—' }}</dd></div>
            <div v-if="isPersonal"><dt>公安二要素</dt><dd>{{ yesNo(form.policeVerified) }}</dd></div>
            <div v-if="isPersonal"><dt>活体核验</dt><dd>{{ yesNo(form.livenessVerified) }}</dd></div>
            <div v-if="!isPersonal"><dt>法人扫脸</dt><dd>{{ form.legalPersonFaceStatus || '—' }}</dd></div>
          </dl>
          <p class="form-note">认证材料、法人身份和证件号码不允许在本页直接改写；需要变更时走重新认证审核流程。</p>
        </section>

        <section class="form-card">
          <div class="card-head"><h2>保存说明</h2></div>
          <p class="form-note">主体名称、行业/经营类型、规模、地址、信用代码和联系人将同步写入统一经营主体主档。</p>
          <p v-if="saveError" class="save-error">{{ saveError }}</p>
          <button v-point="'PUT /admin/masterdata/subject/{id}'" type="submit" class="save-btn" :disabled="saving">{{ saving ? '保存中…' : '保存主体资料' }}</button>
          <button type="button" class="cancel-btn" :disabled="saving" @click="goBack">取消</button>
        </section>
      </aside>
    </form>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { getTenantDetail, updateTenant } from '../../utils/api'

const INDUSTRIES = ['粮油产业', '果蔬产业', '畜禽产业', '茶药产业', '饲料农资', '水产产业', '流通贸易', '加工制造', '其他']
const COMPANY_SIZES = ['微型（20人以下）', '小型（20-100人）', '中型（100-500人）', '大型（500人以上）']
const BUSINESS_TYPES = ['家庭农场', '农民专业合作社', '个体采购户', '经纪人', '其他']

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const saving = ref(false)
const loadError = ref('')
const saveError = ref('')
const tenantType = ref('')
const isPersonal = computed(() => tenantType.value === 'INDIVIDUAL')
const validityText = computed(() => form.validStart || form.validEnd
  ? `${form.validStart || '—'} 至 ${form.validEnd || '—'}`
  : '—')

const form = reactive({
  id: '',
  tenantCode: '',
  tenantName: '',
  creditCode: '',
  industry: '',
  companySize: '',
  businessType: '',
  address: '',
  contactName: '',
  contactPhone: '',
  status: 1,
  verifyStatus: '',
  legalPerson: '',
  licenseNo: '',
  identityNoMasked: '',
  validStart: '',
  validEnd: '',
  certificationNo: '',
  verificationChannel: '',
  legalPersonFaceStatus: '',
  policeVerified: null,
  livenessVerified: null,
})

const loadDetail = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const response = await getTenantDetail(route.params.id)
    if (response.code !== 200) throw new Error(response.message || '主体资料加载失败')
    const data = response.data ?? {}
    tenantType.value = data.tenantType
    Object.assign(form, {
      id: data.id,
      tenantCode: data.tenantCode ?? '',
      tenantName: data.tenantName ?? '',
      creditCode: data.creditCode ?? '',
      industry: data.industry ?? '',
      companySize: data.companySize ?? '',
      businessType: data.businessType ?? '',
      address: data.address ?? '',
      contactName: data.contactName ?? '',
      contactPhone: data.phone ?? '',
      status: Number(data.status) === 1 ? 1 : 0,
      verifyStatus: data.verifyStatus ?? '',
      legalPerson: data.legalPerson ?? '',
      licenseNo: data.licenseNo ?? '',
      identityNoMasked: data.identityNoMasked ?? '',
      validStart: data.validStart ?? '',
      validEnd: data.validEnd ?? '',
      certificationNo: data.certificationNo ?? '',
      verificationChannel: data.verificationChannel ?? '',
      legalPersonFaceStatus: data.legalPersonFaceStatus ?? '',
      policeVerified: data.policeVerified ?? null,
      livenessVerified: data.livenessVerified ?? null,
    })
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '主体资料加载失败'
  } finally {
    loading.value = false
  }
}

const validate = () => {
  if (!form.tenantName) return isPersonal.value ? '真实姓名不能为空' : '企业名称不能为空'
  if (form.contactPhone && !/^1[3-9]\d{9}$/.test(form.contactPhone)) return '联系电话应为 11 位手机号'
  if (!isPersonal.value && form.creditCode && !/^[0-9A-Za-z]{15,18}$/.test(form.creditCode)) {
    return '统一社会信用代码应为 15-18 位字母数字'
  }
  return ''
}

const save = async () => {
  saveError.value = validate()
  if (saveError.value) return
  saving.value = true
  try {
    const response = await updateTenant(form.id, {
      tenantName: form.tenantName,
      industry: isPersonal.value ? null : form.industry,
      companySize: isPersonal.value ? null : form.companySize,
      businessType: isPersonal.value ? form.businessType : null,
      address: form.address,
      creditCode: isPersonal.value ? null : form.creditCode,
      contactName: form.contactName,
      contactPerson: form.contactName,
      contactPhone: form.contactPhone,
      status: form.status,
    })
    if (response.code !== 200) throw new Error(response.message || '保存失败')
    message.success('主体资料已保存')
    await router.replace(`/subject/detail/${form.id}`)
  } catch (error) {
    saveError.value = error instanceof Error ? error.message : '保存失败'
  } finally {
    saving.value = false
  }
}

const goBack = () => router.push(`/subject/detail/${route.params.id}`)
const subjectTypeText = (type) => type === 'INDIVIDUAL' ? '个人主体' : '企业主体'
const verifyText = (status) => ({ approved: '已认证', pending: '审核中', rejected: '已驳回', draft: '草稿', unverified: '未认证' }[status] || '未认证')
const yesNo = (value) => value === true ? '已通过' : value === false ? '未通过' : '—'

onMounted(loadDetail)
</script>

<style scoped>
.subject-edit { padding:20px; color:#1f2937; }
.page-header { display:flex; align-items:center; gap:18px; margin-bottom:18px; }
.page-header h1 { margin:0 0 5px; font-size:24px; }
.page-header p { margin:0; color:#6b7280; }
.back-btn { height:36px; padding:0 14px; border:1px solid #d1d5db; border-radius:8px; background:#fff; color:#4b5563; cursor:pointer; }
.state-card,.form-card { border-radius:11px; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.06); }
.state-card { padding:40px; text-align:center; color:#6b7280; }
.state-card.error { color:#b91c1c; background:#fef2f2; }
.edit-layout { display:grid; grid-template-columns:minmax(0,1.45fr) minmax(300px,.55fr); gap:14px; align-items:start; }
.form-column,.side-column { display:flex; flex-direction:column; gap:14px; }
.form-card { padding:18px; }
.card-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:15px; }
.card-head h2 { margin:0; font-size:16px; }
.type-badge { padding:4px 9px; border-radius:999px; font-size:12px; }
.type-badge.enterprise { background:#ecfdf5; color:#047857; }
.type-badge.personal { background:#eff6ff; color:#1d4ed8; }
.form-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
.form-field { display:flex; flex-direction:column; gap:6px; color:#64748b; font-size:12.5px; }
.form-field input,.form-field select { height:38px; padding:0 10px; border:1px solid #d1d5db; border-radius:8px; background:#fff; outline:none; }
.form-field input:focus,.form-field select:focus { border-color:#10b981; box-shadow:0 0 0 3px rgba(16,185,129,.1); }
.form-field input:disabled { background:#f8fafc; color:#94a3b8; }
.wide-field { grid-column:span 2; }
.read-only-card dl { margin:0; }
.read-only-card dl > div { display:flex; justify-content:space-between; gap:12px; padding:9px 0; border-bottom:1px solid #edf0f2; }
.read-only-card dt { color:#94a3b8; font-size:12px; }
.read-only-card dd { margin:0; color:#334155; font-size:12.5px; text-align:right; }
.form-note { margin:13px 0 0; padding:10px; border-radius:8px; background:#f8fafc; color:#64748b; font-size:12px; line-height:1.65; }
.save-error { margin:12px 0 0; padding:10px; border-radius:8px; background:#fef2f2; color:#b91c1c; font-size:12.5px; }
.save-btn,.cancel-btn { width:100%; height:38px; margin-top:10px; border-radius:8px; cursor:pointer; }
.save-btn { border:0; background:#10b981; color:#fff; }
.cancel-btn { border:1px solid #d1d5db; background:#fff; color:#4b5563; }
.save-btn:disabled,.cancel-btn:disabled { opacity:.55; cursor:wait; }
@media(max-width:900px){.edit-layout{grid-template-columns:1fr}}
@media(max-width:600px){.page-header{align-items:flex-start;flex-wrap:wrap}.form-grid{grid-template-columns:1fr}.wide-field{grid-column:auto}}
</style>
