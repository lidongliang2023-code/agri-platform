<template>
  <div class="package-edit">
    <header class="page-head">
      <button class="back" @click="goBack">← 返回</button>
      <div>
        <h1>{{ isEdit ? '编辑服务套餐' : '新建服务套餐' }}</h1>
        <p>配置套餐价格、有效期、服务级别和可使用的资源限额。</p>
      </div>
    </header>

    <div v-if="loadError" class="state error">{{ loadError }}</div>
    <div v-else-if="loading" class="state">正在加载套餐…</div>
    <form v-else @submit.prevent="save">
      <section class="form-card">
        <div class="card-head"><h2>套餐定义</h2></div>
        <div class="field-grid">
          <label><span>套餐编码 *</span><input v-model.trim="form.packageCode" :disabled="isEdit" placeholder="如：BASE_MONTHLY" /></label>
          <label><span>套餐名称 *</span><input v-model.trim="form.packageName" placeholder="如：标准版" /></label>
          <label class="wide"><span>套餐说明</span><textarea v-model.trim="form.packageDesc" rows="3" placeholder="请输入套餐适用范围与说明" /></label>
          <label><span>价格（元）</span><input v-model.number="form.price" type="number" min="0" step="0.01" /></label>
          <label><span>有效期（天）</span><input v-model.number="form.duration" type="number" min="1" /></label>
          <label><span>服务级别</span><select v-model.number="form.serviceLevel"><option :value="1">基础支持</option><option :value="2">标准支持</option><option :value="3">7×24 专属支持</option></select></label>
          <label><span>状态</span><select v-model.number="form.status"><option :value="1">启用</option><option :value="0">停用</option></select></label>
        </div>
      </section>

      <section class="form-card">
        <div class="card-head"><h2>资源限额</h2><span>0 表示不开放该资源</span></div>
        <div class="field-grid">
          <label><span>用户上限</span><input v-model.number="form.userLimit" type="number" min="0" /></label>
          <label><span>组织上限</span><input v-model.number="form.orgLimit" type="number" min="0" /></label>
          <label><span>商品上限</span><input v-model.number="form.productLimit" type="number" min="0" /></label>
          <label><span>存储上限（GB）</span><input v-model.number="form.storageGb" type="number" min="0" step="0.1" /></label>
          <label><span>每日 API 上限</span><input v-model.number="form.apiLimit" type="number" min="0" /></label>
        </div>
      </section>

      <div class="actions">
        <button type="button" class="cancel" @click="goBack">取消</button>
        <button v-point="isEdit ? 'PUT /admin/masterdata/subject/package/{id}' : 'POST /admin/masterdata/subject/package'" type="submit" class="save" :disabled="saving">{{ saving ? '保存中…' : (isEdit ? '保存修改' : '创建套餐') }}</button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { createTenantPackage, getTenantPackageDetail, updateTenantPackage } from '../../utils/api'

const GB = 1024 ** 3
const route = useRoute()
const router = useRouter()
const isEdit = computed(() => Boolean(route.params.id))
const loading = ref(false)
const saving = ref(false)
const loadError = ref('')
const form = reactive({
  packageCode: '',
  packageName: '',
  packageDesc: '',
  price: 0,
  duration: 365,
  serviceLevel: 1,
  status: 1,
  userLimit: 100,
  orgLimit: 20,
  productLimit: 100,
  storageGb: 10,
  apiLimit: 10000,
})

const load = async () => {
  if (!isEdit.value) return
  loading.value = true
  try {
    const response = await getTenantPackageDetail(route.params.id)
    if (response.code !== 200) throw new Error(response.message || '套餐资料加载失败')
    const data = response.data ?? {}
    Object.assign(form, {
      packageCode: data.packageCode ?? '',
      packageName: data.packageName ?? '',
      packageDesc: data.packageDesc ?? '',
      price: Number(data.price ?? 0),
      duration: Number(data.duration ?? 30),
      serviceLevel: Number(data.serviceLevel ?? 1),
      status: Number(data.status ?? 1),
      userLimit: Number(data.userLimit ?? 0),
      orgLimit: Number(data.orgLimit ?? 0),
      productLimit: Number(data.productLimit ?? 0),
      storageGb: data.storageLimit == null ? 0 : Math.round(Number(data.storageLimit) / GB * 10) / 10,
      apiLimit: Number(data.apiLimit ?? 0),
    })
  } catch (cause) {
    loadError.value = cause instanceof Error ? cause.message : '套餐资料加载失败'
  } finally {
    loading.value = false
  }
}

const save = async () => {
  if (!form.packageCode || !form.packageName) return message.warning('请填写套餐编码和名称')
  if (form.price < 0 || form.duration <= 0) return message.warning('价格不能小于 0，有效期必须大于 0 天')
  saving.value = true
  try {
    const payload = {
      packageCode: form.packageCode,
      packageName: form.packageName,
      packageDesc: form.packageDesc,
      userLimit: Number(form.userLimit) || 0,
      orgLimit: Number(form.orgLimit) || 0,
      productLimit: Number(form.productLimit) || 0,
      storageLimit: Math.round(Number(form.storageGb || 0) * GB),
      apiLimit: Number(form.apiLimit) || 0,
      serviceLevel: Number(form.serviceLevel),
      price: Number(form.price) || 0,
      duration: Number(form.duration),
      status: Number(form.status),
    }
    const response = isEdit.value
      ? await updateTenantPackage(route.params.id, payload)
      : await createTenantPackage(payload)
    if (response.code !== 200) throw new Error(response.message || '套餐保存失败')
    message.success(isEdit.value ? '套餐已更新' : '套餐已创建')
    await router.replace(isEdit.value ? `/subject/package/${route.params.id}` : '/subject/package')
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '套餐保存失败')
  } finally {
    saving.value = false
  }
}

const goBack = () => router.push(isEdit.value ? `/subject/package/${route.params.id}` : '/subject/package')
onMounted(load)
</script>

<style scoped>
.package-edit { padding:20px; color:#1f2937; }
.page-head { display:flex; align-items:center; gap:18px; margin-bottom:18px; }
.page-head h1 { margin:0 0 5px; font-size:24px; }
.page-head p { margin:0; color:#6b7280; }
.back { height:36px; padding:0 14px; border:1px solid #d1d5db; border-radius:8px; background:#fff; color:#4b5563; cursor:pointer; }
.state,.form-card { border-radius:10px; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.06); }
.state { padding:40px; text-align:center; color:#6b7280; }
.state.error { color:#b91c1c; background:#fef2f2; }
.form-card { padding:19px; margin-bottom:14px; }
.card-head { display:flex; justify-content:space-between; gap:12px; margin-bottom:15px; }
.card-head h2 { margin:0; font-size:17px; }
.card-head span { color:#94a3b8; font-size: var(--agri-font-size-micro); }
.field-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
.field-grid label { display:flex; flex-direction:column; gap:6px; color:#64748b; font-size:12.5px; }
.field-grid .wide { grid-column:span 2; }
.field-grid input,.field-grid select,.field-grid textarea { width:100%; padding:0 11px; border:1px solid #d1d5db; border-radius:8px; background:#fff; outline:none; }
.field-grid input,.field-grid select { height:40px; }
.field-grid textarea { padding-top:10px; resize:vertical; }
.field-grid input:focus,.field-grid select:focus,.field-grid textarea:focus { border-color:#10b981; box-shadow:0 0 0 3px rgba(16,185,129,.1); }
.field-grid input:disabled { background:#f8fafc; color:#94a3b8; }
.actions { display:flex; justify-content:flex-end; gap:10px; }
.actions button { height:38px; padding:0 18px; border-radius:8px; cursor:pointer; }
.cancel { border:1px solid #d1d5db; background:#fff; color:#4b5563; }
.save { border:0; background:#10b981; color:#fff; }
.save:disabled { opacity:.55; cursor:wait; }
@media(max-width:650px){.field-grid{grid-template-columns:1fr}.field-grid .wide{grid-column:auto}.page-head{align-items:flex-start;flex-wrap:wrap}}
</style>
