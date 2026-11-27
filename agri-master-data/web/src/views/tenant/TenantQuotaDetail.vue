<template>
  <div class="quota-detail">
    <header class="page-head">
      <button class="back" @click="goBack">← 返回配额列表</button>
      <div>
        <h1>主体配额详情</h1>
        <p>查看经营主体的资源限额与实际用量。</p>
      </div>
      <button v-if="detail" class="edit" @click="editQuota">编辑配额</button>
    </header>

    <div v-if="error" class="state error">{{ error }}</div>
    <div v-else-if="!detail" class="state">正在加载配额详情…</div>
    <template v-else>
      <section class="subject-card">
        <div>
          <span class="subject-icon">{{ detail.tenantType === 'INDIVIDUAL' ? '👤' : '🏢' }}</span>
          <div>
            <h2>{{ detail.tenantName }}</h2>
            <p>{{ detail.tenantCode }}</p>
          </div>
        </div>
        <div class="subject-meta">
          <span class="type-badge" :class="detail.tenantType === 'INDIVIDUAL' ? 'personal' : 'enterprise'">
            {{ detail.tenantType === 'INDIVIDUAL' ? '个人主体' : '企业主体' }}
          </span>
          <span class="quota-state" :class="hasQuota ? 'ok' : 'off'">{{ hasQuota ? '已配置配额' : '尚未配置配额' }}</span>
        </div>
      </section>

      <div class="usage-grid">
        <section v-for="item in usageItems" :key="item.key" class="usage-card">
          <div class="usage-head">
            <span>{{ item.icon }} {{ item.label }}</span>
            <strong>{{ usageText(item.used, item.limit, item.unit) }}</strong>
          </div>
          <div class="bar"><i :class="{ danger: item.percent >= 80 }" :style="{ width: item.percent + '%' }" /></div>
          <div class="usage-foot">
            <span>{{ hasQuota ? `使用率 ${item.percent}%` : '未设置限额' }}</span>
            <span>{{ item.hint }}</span>
          </div>
        </section>
      </div>

      <section class="info-card">
        <div class="card-head"><h3>资源口径说明</h3></div>
        <div class="info-grid">
          <div><label>用户用量</label><strong>平台用户与当前主体的有效绑定数量</strong></div>
          <div><label>组织用量</label><strong>归属当前主体的部门、团队和生产单位数量</strong></div>
          <div><label>商品用量</label><strong>归属当前主体的商品数量</strong></div>
          <div><label>存储 / API</label><strong>由配额记录中的累计用量提供</strong></div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getTenantDetail } from '../../utils/api'

const GB = 1024 ** 3
const route = useRoute()
const router = useRouter()
const detail = ref(null)
const error = ref('')
const hasQuota = computed(() => detail.value?.quotaInfo?.userLimit !== null
  && detail.value?.quotaInfo?.userLimit !== undefined)

const usageItems = computed(() => {
  const quota = detail.value?.quotaInfo ?? {}
  return [
    item('users', '👥', '用户', quota.usedUsers, quota.userLimit),
    item('orgs', '🏠', '组织', quota.usedOrgs, quota.orgLimit),
    item('products', '📦', '商品', quota.usedProducts, quota.productLimit),
    item('storage', '💾', '存储', quota.usedStorage, quota.storageLimit, 'GB', '当前主体文件与附件'),
    item('api', '⚡', 'API', quota.usedApiToday, quota.apiLimit, '', '今日累计调用'),
  ]
})

function item(key, icon, label, used, limit, unit = '', hint = '') {
  const normalizedUsed = unit === 'GB' ? (Number(used) || 0) / GB : Number(used) || 0
  const normalizedLimit = unit === 'GB' ? (Number(limit) || 0) / GB : Number(limit) || 0
  return {
    key, icon, label, used: normalizedUsed,
    limit: limit === null || limit === undefined ? null : normalizedLimit,
    unit,
    hint,
    percent: normalizedLimit > 0 ? Math.min(100, Math.round(normalizedUsed / normalizedLimit * 100)) : 0,
  }
}

const usageText = (used, limit, unit) => `${Number(used || 0).toLocaleString('zh-CN')}${unit === 'GB' ? ' GB' : ''} / ${limit === null ? '—' : `${Number(limit).toLocaleString('zh-CN')}${unit === 'GB' ? ' GB' : ''}`}`

const load = async () => {
  try {
    const response = await getTenantDetail(route.params.id)
    if (response.code !== 200) throw new Error(response.message || '配额详情加载失败')
    detail.value = response.data
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '配额详情加载失败'
  }
}

const goBack = () => router.push('/subject/quota')
const editQuota = () => router.push(`/subject/quota/${route.params.id}/edit`)
onMounted(load)
</script>

<style scoped>
.quota-detail { padding:0; color:var(--pc-text,#1a1a1a); }
.page-head { display:flex; align-items:center; gap:16px; margin-bottom:20px; }
.page-head > div { flex:1; min-width:0; }
.page-head h1 { margin:0 0 4px; font-size:24px; line-height:1.35; color:var(--pc-text,#1a1a1a); }
.page-head p { margin:0; color:var(--pc-secondary,#595959); font-size:14px; }
.back,.edit { height:32px; padding:0 16px; border-radius:4px; font-size:14px; font-weight:500; cursor:pointer; }
.back { border:1px solid var(--pc-border,#e8e8e8); background:#fff; color:var(--pc-text,#1a1a1a); }
.back:hover { border-color:var(--pc-brand,#2d8f4e); color:var(--pc-brand,#2d8f4e); }
.edit { border:1px solid var(--pc-brand,#2d8f4e); background:var(--pc-brand,#2d8f4e); color:#fff; }
.edit:hover { border-color:var(--pc-hover,#247a3f); background:var(--pc-hover,#247a3f); }
.state,.subject-card,.usage-card,.info-card { border:1px solid var(--pc-border,#e8e8e8); border-radius:8px; background:#fff; box-shadow:none; }
.state { padding:40px; text-align:center; color:var(--pc-secondary,#595959); }
.state.error { color:#b71c1c; background:#ffebee; border-color:#ffcdd2; }
.subject-card { display:flex; justify-content:space-between; align-items:center; gap:16px; padding:20px 24px; margin-bottom:16px; }
.subject-card > div,.subject-meta { display:flex; align-items:center; gap:12px; }
.subject-icon { width:44px; height:44px; display:grid; place-items:center; border-radius:8px; background:var(--pc-light,#e8f5e9); font-size:22px; }
.subject-card h2 { margin:0; font-size:20px; color:var(--pc-text,#1a1a1a); }
.subject-card p { margin:4px 0 0; color:var(--pc-secondary,#595959); font-family:var(--pc-mono,ui-monospace,Consolas,monospace); font-size:12px; }
.type-badge,.quota-state { padding:3px 10px; border-radius:4px; font-size:12px; font-weight:500; }
.type-badge.enterprise,.quota-state.ok { background:var(--pc-light,#e8f5e9); color:var(--pc-active,#1b6332); }
.type-badge.personal { background:#e3f2fd; color:#1565c0; }
.quota-state.off { background:#fff3e0; color:#8f4500; }
.usage-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; margin-bottom:16px; }
.usage-card { padding:20px 24px; }
.usage-head { display:flex; justify-content:space-between; gap:12px; color:var(--pc-text,#1a1a1a); font-size:14px; }
.usage-head strong { color:var(--pc-brand,#2d8f4e); font-variant-numeric:tabular-nums; }
.bar { height:8px; margin:12px 0 8px; overflow:hidden; border-radius:4px; background:var(--pc-line,#f0f0f0); }
.bar i { display:block; height:100%; border-radius:4px; background:var(--pc-brand,#2d8f4e); }
.bar i.danger { background:#e53935; }
.usage-foot { display:flex; justify-content:space-between; gap:12px; color:var(--pc-secondary,#595959); font-size:12px; }
.info-card { padding:24px; }
.card-head h3 { margin:0 0 16px; font-size:18px; color:var(--pc-text,#1a1a1a); }
.info-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
.info-grid div { padding:12px 14px; border:1px solid var(--pc-line,#f0f0f0); border-radius:6px; background:var(--pc-bg,#f5f6fa); }
.info-grid label { display:block; margin-bottom:4px; color:var(--pc-secondary,#595959); font-size:12px; }
.info-grid strong { color:var(--pc-text,#1a1a1a); font-size:14px; font-weight:500; }
@media(max-width:650px){.page-head,.subject-card{flex-wrap:wrap}.usage-grid,.info-grid{grid-template-columns:1fr}}
</style>
