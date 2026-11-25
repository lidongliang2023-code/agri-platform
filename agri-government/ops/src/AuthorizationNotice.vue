<template>
  <div v-if="error" class="scope-auth-notice">
    <a-alert
      show-icon
      type="error"
      message="授权状态加载失败，不能据此判断没有权限"
      :description="error"
    >
      <template #action>
        <a-button size="small" :loading="loading" @click="revision += 1">刷新授权状态</a-button>
      </template>
    </a-alert>
  </div>

  <div v-else-if="loading || !data" class="scope-auth-notice">
    <a-alert show-icon type="info" message="正在读取当前账号的辖区授权…" />
  </div>

  <section v-else class="scope-auth-notice" aria-label="当前辖区授权">
    <a-alert show-icon :type="capable || config ? 'info' : 'warning'" :message="title">
      <template #description>
        <p>
          {{ data.identity.operatorName || '当前账号'
          }}{{ data.identity.inspectorName ? ` · ${data.identity.inspectorName}` : '' }}。{{ details }}
        </p>
        <p>
          {{ config ? '当前为配置管理页面，登记和管理权限不等于执法权限。' : '平台管理员身份不自动获得全域执法权。' }}
          {{ page === 'dashboard' ? ' 工作台各项指标按对应职责过滤，部分指标可能为空。' : '' }}
          {{ page === 'statistics' ? ' 全域历史趋势和交易额尚无辖区映射，暂不提供。' : '' }}
          {{ page === 'sharing' ? ' 跨部门共享尚未建立可核实的范围映射，暂不开放审批。' : '' }}
        </p>
        <a-space wrap>
          <a-button size="small" href="#/users">人员账号绑定</a-button>
          <a-button size="small" href="#/scopes">机构与辖区</a-button>
          <a-button size="small" href="#/personnel-grants">人员授权</a-button>
          <a-button size="small" href="#/region-registry">业务辖区登记</a-button>
          <a-button size="small" :loading="loading" @click="revision += 1">刷新授权状态</a-button>
        </a-space>
      </template>
    </a-alert>

    <a-collapse v-if="mine.length > 0" size="small">
      <a-collapse-panel key="detail" :header="`查看当前人员授权明细（${mine.length} 条）`">
        <p>以下为登记状态提示；实际访问以服务端即时校验为准，有效期按服务端日期判定。</p>
        <div v-for="g in mine" :key="g.id" class="scope-auth-record">
          <strong>{{ scopeName(g.scopeId) }}</strong>
          <a-tag :color="grantReason(g) ? 'orange' : 'green'">
            {{ grantReason(g) || '登记范围有效' }}
          </a-tag>
          <p>{{ g.validFrom }} 至 {{ g.validUntil }}</p>
          <p v-for="r in g.regions" :key="r.code">
            {{ r.name }}（{{ r.code }}） · {{ r.includeChildren ? '含下级地区' : '仅本级' }} ·
            {{ r.duties.map((d) => labels[d] || d).join('、') }}
          </p>
        </div>
      </a-collapse-panel>
    </a-collapse>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { opsApi, type IdentityCard, type PersonnelGrant, type RegulatoryScope } from './api'
import './scope-config.css'

const props = defineProps<{ page: string }>()

const labels: Record<string, string> = {
  inspection: '执法检查',
  sampling: '监督抽检',
  case: '案件处置',
  credit: '信用监管',
  complaint: '举报处理',
  statistics: '监管统计',
  subsidy: '补贴审核',
}
const duties: Record<string, string> = {
  warnings: 'inspection',
  tasks: 'inspection',
  cases: 'case',
  repairs: 'credit',
  subsidies: 'subsidy',
  complaints: 'complaint',
  samplings: 'sampling',
  statistics: 'statistics',
}
const configPages = new Set(['users', 'scopes', 'personnel-grants', 'region-registry', 'items'])

const data = ref<{ identity: IdentityCard; grants: PersonnelGrant[]; scopes: RegulatoryScope[] } | null>(null)
const error = ref('')
const loading = ref(true)
const revision = ref(0)

function todayStr() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function grantReason(g: PersonnelGrant): string {
  const scopes = data.value?.scopes ?? []
  const today = todayStr()
  if (g.status !== 'enabled') return '授权已停用'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(g.validFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(g.validUntil)) return '有效期异常'
  if (today < g.validFrom) return '尚未生效'
  if (today > g.validUntil) return '授权已到期'
  const s = scopes.find((item) => item.id === g.scopeId)
  if (!s) return '机构登记不存在'
  if (s.status !== 'enabled') return '机构已停用'
  if (!g.regions?.length) return '未配置辖区'
  if (
    g.regions.some(
      (r) =>
        !s.regions.some(
          (a) =>
            a.code === r.code &&
            (!r.includeChildren || a.includeChildren) &&
            r.duties.length > 0 &&
            r.duties.every((d) => a.duties.includes(d)),
        ),
    )
  ) {
    return '机构范围已变化，需重新核对授权'
  }
  return ''
}

function scopeName(scopeId: string): string {
  return data.value?.scopes.find((s) => s.id === scopeId)?.organizationName || '机构登记不存在'
}

const mine = computed(() => {
  if (!data.value) return []
  return data.value.grants.filter((g) => String(g.personnelId) === String(data.value!.identity.inspectorId))
})

const available = computed(() => mine.value.filter((g) => !grantReason(g)))
const required = computed(() => duties[props.page])
const capable = computed(() =>
  available.value.some((g) => g.regions.some((r) => !required.value || r.duties.includes(required.value))),
)
const config = computed(() => configPages.has(props.page))

const title = computed(() => {
  if (!data.value?.identity.inspectorId) return '当前账号未绑定有效监管人员档案'
  if (!mine.value.length) return '当前人员尚未登记辖区授权'
  if (!available.value.length) return '当前人员没有生效的辖区授权'
  if (required.value && !capable.value) return `当前页面缺少「${labels[required.value]}」职责授权`
  return '当前人员已登记辖区授权'
})

const details = computed(() => {
  if (!data.value?.identity.inspectorId) {
    return '请在“组织与权限”中将当前平台账号绑定到启用的监管人员档案，再配置机构和人员授权。'
  }
  if (!mine.value.length) {
    return '请先登记监管机构及辖区，再在“监管人员授权”中为当前人员配置职责和有效期。'
  }
  if (!available.value.length) {
    return '请展开授权明细查看停用、到期或机构范围变化等原因，核实后修改对应登记。'
  }
  if (required.value && !capable.value) {
    return '请由授权管理员核实职责依据后调整授权；已有其他职责不代表可以办理本页业务。'
  }
  return '业务记录还须登记行政区划编码，且落在相应职责的授权辖区内。空列表也可能表示范围内暂无记录，不能据此判断全平台没有数据。'
})

let token = 0
watch(
  () => [props.page, revision.value] as const,
  async () => {
    const seq = ++token
    loading.value = true
    error.value = ''
    data.value = null
    try {
      const [identity, grants, scopes] = await Promise.all([opsApi.identity(), opsApi.grants(), opsApi.scopes()])
      if (seq === token) data.value = { identity, grants, scopes }
    } catch (e) {
      if (seq === token) error.value = e instanceof Error ? e.message : '授权信息加载失败'
    } finally {
      if (seq === token) loading.value = false
    }
  },
  { immediate: true },
)
</script>
