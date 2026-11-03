<template>
  <div class="package-detail">
    <header class="page-head">
      <button class="back" @click="goBack">← 返回套餐列表</button>
      <div>
        <h1>服务套餐详情</h1>
        <p>查看套餐价格、有效期、资源限额和服务级别。</p>
      </div>
      <button v-if="pkg" class="edit" @click="edit">编辑套餐</button>
    </header>

    <div v-if="error" class="state error">{{ error }}</div>
    <div v-else-if="!pkg" class="state">正在加载套餐详情…</div>
    <template v-else>
      <section class="hero">
        <div>
          <span class="code">{{ pkg.packageCode }}</span>
          <h2>{{ pkg.packageName }}</h2>
          <p>{{ pkg.packageDesc || '暂无套餐说明' }}</p>
        </div>
        <div class="hero-price">
          <strong>¥{{ pkg.price }}</strong>
          <span>/ {{ pkg.duration }} 天</span>
          <span class="status" :class="pkg.status === 1 ? 'on' : 'off'">{{ pkg.status === 1 ? '启用中' : '已停用' }}</span>
        </div>
      </section>

      <section class="limits">
        <div v-for="item in limits" :key="item.label">
          <span>{{ item.icon }} {{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </section>

      <section class="info-card">
        <div class="card-head"><h3>套餐配置</h3></div>
        <div class="info-grid">
          <div><label>套餐编码</label><strong>{{ pkg.packageCode }}</strong></div>
          <div><label>服务级别</label><strong>{{ levelText(pkg.serviceLevel) }}</strong></div>
          <div><label>服务说明</label><strong>{{ pkg.serviceLevelDesc || '—' }}</strong></div>
          <div><label>有效期</label><strong>{{ pkg.duration }} 天</strong></div>
          <div><label>状态</label><strong>{{ pkg.status === 1 ? '启用' : '停用' }}</strong></div>
          <div><label>创建时间</label><strong>{{ formatTime(pkg.createTime) }}</strong></div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getTenantPackageDetail } from '../../utils/api'

const GB = 1024 ** 3
const route = useRoute()
const router = useRouter()
const pkg = ref(null)
const error = ref('')
const levelText = (value) => ({ 1: '基础支持', 2: '标准支持', 3: '7×24 专属支持' }[value] || '—')
const num = (value) => value === null || value === undefined || value <= 0 ? '不限' : Number(value).toLocaleString('zh-CN')
const limits = computed(() => [
  { icon: '👥', label: '用户上限', value: num(pkg.value?.userLimit) },
  { icon: '🏠', label: '组织上限', value: num(pkg.value?.orgLimit) },
  { icon: '📦', label: '商品上限', value: num(pkg.value?.productLimit) },
  { icon: '💾', label: '存储上限', value: pkg.value?.storageLimit > 0 ? `${Math.round(pkg.value.storageLimit / GB * 10) / 10} GB` : '不限' },
  { icon: '⚡', label: '每日 API', value: num(pkg.value?.apiLimit) },
])

const load = async () => {
  try {
    const response = await getTenantPackageDetail(route.params.id)
    if (response.code !== 200) throw new Error(response.message || '套餐详情加载失败')
    pkg.value = response.data
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '套餐详情加载失败'
  }
}

const formatTime = (value) => value ? String(value).replace('T', ' ').slice(0, 16) : '—'
const goBack = () => router.push('/subject/package')
const edit = () => router.push(`/subject/package/${route.params.id}/edit`)
onMounted(load)
</script>

<style scoped>
.package-detail { padding:20px; color:#1f2937; }
.page-head { display:flex; align-items:center; gap:18px; margin-bottom:18px; }
.page-head > div { flex:1; }
.page-head h1 { margin:0 0 5px; font-size:24px; }
.page-head p { margin:0; color:#6b7280; }
.back,.edit { height:36px; padding:0 14px; border-radius:8px; cursor:pointer; }
.back { border:1px solid #d1d5db; background:#fff; color:#4b5563; }
.edit { border:0; background:#10b981; color:#fff; }
.state,.hero,.limits,.info-card { border-radius:11px; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.06); }
.state { padding:40px; text-align:center; color:#6b7280; }
.state.error { color:#b91c1c; background:#fef2f2; }
.hero { display:flex; justify-content:space-between; gap:22px; padding:23px; margin-bottom:14px; background:linear-gradient(130deg,#0f4c33,#10a365); color:#fff; }
.code { font-family:ui-monospace,Consolas,monospace; font-size:12px; opacity:.7; }
.hero h2 { margin:7px 0; font-size:24px; }
.hero p { margin:0; opacity:.8; font-size:13px; }
.hero-price { text-align:right; }
.hero-price strong { display:block; font-size:32px; }
.hero-price > span { display:inline-block; margin-left:5px; opacity:.75; font-size:12px; }
.status { margin-top:9px; padding:4px 9px; border-radius:999px; font-size: var(--agri-font-size-micro); }
.status.on { background:rgba(255,255,255,.2); }
.status.off { background:rgba(0,0,0,.15); }
.limits { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; padding:16px; margin-bottom:14px; }
.limits div { padding:12px; border-radius:8px; background:#f8fafc; }
.limits span,.limits strong { display:block; }
.limits span { color:#94a3b8; font-size: var(--agri-font-size-micro); }
.limits strong { margin-top:6px; color:#0f6740; font-size:17px; }
.info-card { padding:18px; }
.card-head h3 { margin:0 0 14px; }
.info-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
.info-grid div { padding:11px; border-radius:8px; background:#f8fafc; }
.info-grid label { display:block; margin-bottom:5px; color:#94a3b8; font-size: var(--agri-font-size-micro); }
.info-grid strong { color:#334155; font-size:12.5px; }
@media(max-width:800px){.limits{grid-template-columns:repeat(2,minmax(0,1fr))}.info-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.hero{flex-direction:column}.hero-price{text-align:left}}
</style>
