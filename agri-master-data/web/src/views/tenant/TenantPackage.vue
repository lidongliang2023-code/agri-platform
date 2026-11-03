<template>
  <div class="package-page">
    <header class="page-head">
      <div>
        <h1>服务套餐</h1>
        <p>维护平台级服务套餐定义、定价、有效期和资源限额。</p>
      </div>
      <button class="primary" @click="createPackage">+ 新建套餐</button>
    </header>

    <div class="summary-grid">
      <div><span>套餐数量</span><strong>{{ rows.length }}</strong></div>
      <div><span>已启用</span><strong>{{ activeCount }}</strong></div>
      <div><span>价格区间</span><strong class="price">¥{{ priceRange }}</strong></div>
    </div>

    <div v-if="loadError" class="error-banner">{{ loadError }}</div>
    <div v-if="loading" class="state">正在加载服务套餐…</div>
    <div v-else-if="rows.length === 0" class="state empty">
      <h2>暂无服务套餐</h2>
      <p>创建第一个套餐后，可配置价格、有效期和资源上限。</p>
    </div>
    <div v-else class="package-grid">
      <article v-for="pkg in rows" :key="pkg.id" class="package-card">
        <div class="package-top">
          <div>
            <span class="package-code">{{ pkg.packageCode }}</span>
            <h2>{{ pkg.packageName }}</h2>
          </div>
          <span class="status" :class="pkg.status === 1 ? 'on' : 'off'">{{ pkg.status === 1 ? '启用' : '停用' }}</span>
        </div>
        <div class="price-row">
          <strong>¥{{ pkg.price }}</strong>
          <span>/ {{ pkg.duration }} 天</span>
        </div>
        <p class="package-desc">{{ pkg.packageDesc || '暂无套餐说明' }}</p>
        <div class="limit-grid">
          <div><span>用户</span><strong>{{ count(pkg.userLimit) }}</strong></div>
          <div><span>组织</span><strong>{{ count(pkg.orgLimit) }}</strong></div>
          <div><span>商品</span><strong>{{ count(pkg.productLimit) }}</strong></div>
          <div><span>存储</span><strong>{{ storage(pkg.storageLimit) }}</strong></div>
          <div><span>每日 API</span><strong>{{ count(pkg.apiLimit) }}</strong></div>
          <div><span>服务级别</span><strong>{{ levelText(pkg.serviceLevel) }}</strong></div>
        </div>
        <div class="package-actions">
          <button @click="viewPackage(pkg.id)">查看详情</button>
          <button class="edit" @click="editPackage(pkg.id)">编辑</button>
          <button v-point="'DELETE /admin/masterdata/subject/package/{id}'" class="delete" @click="removePackage(pkg)">删除</button>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { deleteTenantPackage, getTenantPackageList } from '../../utils/api'

const GB = 1024 ** 3
const router = useRouter()
const rows = ref([])
const loading = ref(false)
const loadError = ref('')
const activeCount = computed(() => rows.value.filter(item => item.status === 1).length)
const priceRange = computed(() => {
  const prices = rows.value.map(item => Number(item.price)).filter(Number.isFinite)
  if (!prices.length) return '—'
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return min === max ? min.toLocaleString('zh-CN') : `${min.toLocaleString('zh-CN')} – ${max.toLocaleString('zh-CN')}`
})

const count = (value) => value === null || value === undefined || value <= 0 ? '不限' : Number(value).toLocaleString('zh-CN')
const storage = (value) => !value ? '不限' : `${Math.round(Number(value) / GB * 10) / 10} GB`
const levelText = (value) => ({ 1: '基础支持', 2: '标准支持', 3: '专属支持' }[value] || '—')

const load = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const response = await getTenantPackageList()
    if (response.code !== 200) throw new Error(response.message || '套餐加载失败')
    rows.value = response.data ?? []
  } catch (error) {
    rows.value = []
    loadError.value = error instanceof Error ? error.message : '套餐加载失败'
  } finally {
    loading.value = false
  }
}

const createPackage = () => router.push('/subject/package/new')
const viewPackage = (id) => router.push(`/subject/package/${id}`)
const editPackage = (id) => router.push(`/subject/package/${id}/edit`)
const removePackage = async (pkg) => {
  if (!confirm(`确定删除套餐“${pkg.packageName}”吗？`)) return
  try {
    const response = await deleteTenantPackage(pkg.id)
    if (response.code !== 200) throw new Error(response.message || '删除失败')
    message.success('套餐已删除')
    await load()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '删除失败')
  }
}

onMounted(load)
</script>

<style scoped>
.package-page { padding:20px; color:#1f2937; }
.page-head { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:18px; }
.page-head h1 { margin:0 0 5px; font-size:24px; }
.page-head p { margin:0; color:#6b7280; }
.primary { height:38px; padding:0 18px; border:0; border-radius:8px; background:#10b981; color:#fff; cursor:pointer; }
.summary-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin-bottom:16px; }
.summary-grid div { padding:15px; border:1px solid #e3eae5; border-radius:10px; background:#fff; }
.summary-grid span,.summary-grid strong { display:block; }
.summary-grid span { color:#8a9890; font-size: var(--agri-font-size-micro); }
.summary-grid strong { margin-top:6px; color:#0f6740; font-size:23px; }
.summary-grid strong.price { font-size:20px; }
.error-banner { margin-bottom:14px; padding:11px 13px; border-radius:8px; background:#fef2f2; color:#b91c1c; }
.state { padding:40px; text-align:center; border-radius:10px; background:#fff; color:#6b7280; }
.state h2 { margin:0 0 6px; color:#334155; }
.state p { margin:0; }
.package-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; }
.package-card { padding:18px; border:1px solid #e3eae5; border-radius:11px; background:#fff; }
.package-top { display:flex; justify-content:space-between; gap:12px; }
.package-code { color:#0f8050; font-family:ui-monospace,Consolas,monospace; font-size: var(--agri-font-size-micro); }
.package-top h2 { margin:5px 0 0; font-size:18px; }
.status { height:max-content; padding:4px 9px; border-radius:999px; font-size: var(--agri-font-size-micro); }
.status.on { background:#ecfdf5; color:#047857; }
.status.off { background:#f3f4f6; color:#6b7280; }
.price-row { display:flex; align-items:baseline; gap:6px; margin:16px 0 10px; }
.price-row strong { color:#173b28; font-size:29px; }
.price-row span { color:#94a3b8; font-size:12px; }
.package-desc { min-height:38px; margin:0 0 14px; color:#7c8c83; font-size:12px; line-height:1.6; }
.limit-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
.limit-grid div { padding:9px; border-radius:8px; background:#f8fafc; }
.limit-grid span,.limit-grid strong { display:block; }
.limit-grid span { color:#94a3b8; font-size: var(--agri-font-size-micro); }
.limit-grid strong { margin-top:4px; color:#334155; font-size:12.5px; }
.package-actions { display:flex; gap:7px; margin-top:15px; }
.package-actions button { flex:1; height:34px; border:1px solid #dbe4de; border-radius:7px; background:#fff; color:#4b5563; cursor:pointer; }
.package-actions .edit { border-color:#a7d9bf; color:#047857; background:#ecfdf5; }
.package-actions .delete { border-color:#fecaca; color:#b91c1c; background:#fff; }
@media(max-width:1100px){.package-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:700px){.package-grid,.summary-grid{grid-template-columns:1fr}.page-head{flex-direction:column}}
</style>
