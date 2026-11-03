<template>
  <div class="quota-edit">
    <header class="page-head">
      <button class="back" @click="goBack">← 返回配额详情</button>
      <div>
        <h1>编辑主体配额</h1>
        <p>配置当前经营主体可使用的用户、组织、商品、存储和 API 资源上限。</p>
      </div>
    </header>

    <div v-if="error" class="state error">{{ error }}</div>
    <div v-else-if="loading" class="state">正在加载主体配额…</div>
    <form v-else class="edit-grid" @submit.prevent="save">
      <section class="form-card">
        <div class="card-head"><h2>{{ subject.tenantName }}</h2><span>{{ subject.tenantCode }}</span></div>
        <p class="hint">限额填写为 0 表示该资源不可用；未配置配额时建议先按主体实际需要填写完整限额。</p>
        <div class="field-grid">
          <label><span>用户限额</span><input v-model.number="form.userLimit" type="number" min="0" /></label>
          <label><span>组织限额</span><input v-model.number="form.orgLimit" type="number" min="0" /></label>
          <label><span>商品限额</span><input v-model.number="form.productLimit" type="number" min="0" /></label>
          <label><span>存储限额（GB）</span><input v-model.number="form.storageGb" type="number" min="0" step="0.1" /></label>
          <label><span>API 限额（次/日）</span><input v-model.number="form.apiLimit" type="number" min="0" /></label>
        </div>
        <p v-if="saveError" class="error-text">{{ saveError }}</p>
        <div class="actions">
          <button type="button" class="cancel" @click="goBack">取消</button>
          <button v-point="'PUT /admin/masterdata/subject/{id}/quota'" type="submit" class="save" :disabled="saving">{{ saving ? '保存中…' : '保存配额' }}</button>
        </div>
      </section>
      <aside class="side-card">
        <h2>当前实际用量</h2>
        <div class="usage-list">
          <div><span>用户</span><strong>{{ subject.quotaInfo?.usedUsers ?? 0 }}</strong></div>
          <div><span>组织</span><strong>{{ subject.quotaInfo?.usedOrgs ?? 0 }}</strong></div>
          <div><span>商品</span><strong>{{ subject.quotaInfo?.usedProducts ?? 0 }}</strong></div>
          <div><span>今日 API</span><strong>{{ subject.quotaInfo?.usedApiToday ?? 0 }}</strong></div>
        </div>
        <p>保存后会重新计算当前真实用量；存储用量保留配额记录中的累计值。</p>
      </aside>
    </form>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { adjustTenantQuota, getTenantDetail } from '../../utils/api'

const GB = 1024 ** 3
const route = useRoute()
const router = useRouter()
const subject = ref({})
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const saveError = ref('')
const form = reactive({
  userLimit: 100,
  orgLimit: 20,
  productLimit: 100,
  storageGb: 10,
  apiLimit: 10000,
})

const load = async () => {
  try {
    const response = await getTenantDetail(route.params.id)
    if (response.code !== 200) throw new Error(response.message || '主体资料加载失败')
    subject.value = response.data
    const quota = response.data?.quotaInfo ?? {}
    Object.assign(form, {
      userLimit: quota.userLimit ?? 100,
      orgLimit: quota.orgLimit ?? 20,
      productLimit: quota.productLimit ?? 100,
      storageGb: quota.storageLimit == null ? 10 : Math.round(quota.storageLimit / GB * 10) / 10,
      apiLimit: quota.apiLimit ?? 10000,
    })
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '主体资料加载失败'
  } finally {
    loading.value = false
  }
}

const save = async () => {
  saveError.value = ''
  if (Object.values(form).some(value => Number(value) < 0 || !Number.isFinite(Number(value)))) {
    saveError.value = '所有限额必须是非负数字'
    return
  }
  saving.value = true
  try {
    const response = await adjustTenantQuota(route.params.id, {
      userLimit: Number(form.userLimit),
      orgLimit: Number(form.orgLimit),
      productLimit: Number(form.productLimit),
      storageLimit: Math.round(Number(form.storageGb) * GB),
      apiLimit: Number(form.apiLimit),
      reason: '运营端主体配额配置',
    })
    if (response.code !== 200) throw new Error(response.message || '配额保存失败')
    message.success('主体配额已保存')
    await router.replace(`/subject/quota/${route.params.id}`)
  } catch (cause) {
    saveError.value = cause instanceof Error ? cause.message : '配额保存失败'
  } finally {
    saving.value = false
  }
}

const goBack = () => router.push(`/subject/quota/${route.params.id}`)
onMounted(load)
</script>

<style scoped>
.quota-edit { padding:20px; color:#1f2937; }
.page-head { display:flex; align-items:center; gap:18px; margin-bottom:18px; }
.page-head h1 { margin:0 0 5px; font-size:24px; }
.page-head p { margin:0; color:#6b7280; }
.back { height:36px; padding:0 14px; border:1px solid #d1d5db; border-radius:8px; background:#fff; color:#4b5563; cursor:pointer; }
.state,.form-card,.side-card { border-radius:10px; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.06); }
.state { padding:40px; text-align:center; color:#6b7280; }
.state.error { color:#b91c1c; background:#fef2f2; }
.edit-grid { display:grid; grid-template-columns:minmax(0,1fr) 280px; gap:14px; align-items:start; }
.form-card,.side-card { padding:20px; }
.card-head { display:flex; justify-content:space-between; gap:12px; }
.card-head h2,.side-card h2 { margin:0; font-size:18px; }
.card-head span { color:#94a3b8; font-family:ui-monospace,Consolas,monospace; font-size:12px; }
.hint { margin:10px 0 18px; color:#64748b; font-size:12.5px; line-height:1.65; }
.field-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
.field-grid label { display:flex; flex-direction:column; gap:6px; color:#64748b; font-size:12.5px; }
.field-grid input { height:40px; padding:0 11px; border:1px solid #d1d5db; border-radius:8px; outline:none; }
.field-grid input:focus { border-color:#10b981; box-shadow:0 0 0 3px rgba(16,185,129,.1); }
.actions { display:flex; justify-content:flex-end; gap:10px; margin-top:20px; }
.actions button { height:38px; padding:0 18px; border-radius:8px; cursor:pointer; }
.cancel { border:1px solid #d1d5db; background:#fff; color:#4b5563; }
.save { border:0; background:#10b981; color:#fff; }
.save:disabled { opacity:.55; cursor:wait; }
.usage-list { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; margin:15px 0; }
.usage-list div { padding:11px; border-radius:8px; background:#f8fafc; }
.usage-list span,.usage-list strong { display:block; }
.usage-list span { color:#94a3b8; font-size: var(--agri-font-size-micro); }
.usage-list strong { margin-top:5px; color:#1f3b2a; font-size:17px; }
.side-card > p { margin:0; color:#94a3b8; font-size: var(--agri-font-size-micro); line-height:1.65; }
.error-text { margin:14px 0 0; padding:10px; border-radius:8px; background:#fef2f2; color:#b91c1c; font-size:12.5px; }
@media(max-width:800px){.edit-grid{grid-template-columns:1fr}}
@media(max-width:600px){.field-grid{grid-template-columns:1fr}}
</style>
