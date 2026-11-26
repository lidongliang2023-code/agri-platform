<template>
  <div class="scope-page">
    <div class="o-title">
      <div>
        <span>监管组织与职责</span>
        <h1>监管人员授权</h1>
        <p>将监管人员绑定到机构的辖区与职责，保留每次授权变更记录。</p>
      </div>
      <a-button type="primary" @click="openEdit(null)">新增人员授权</a-button>
    </div>

    <a-alert
      show-icon
      type="info"
      message="人员范围授权独立于平台管理权限"
      description="仅能选择已有平台账号绑定的监管人员。此页管理范围授权及有效期，不会自动新增平台角色。监管业务按有效辖区和职责过滤，主体或举报未登记区划编码时不显示；全域历史趋势及跨域溯源明细暂不开放。"
    />

    <div class="scope-toolbar">
      <a-input-search v-model:value="search" allow-clear placeholder="搜索人员或机构" />
      <a-button :loading="loading" @click="load">刷新</a-button>
    </div>

    <a-alert v-if="error" type="error" show-icon :message="error" />
    <div v-else class="scope-grid">
      <a-card v-for="g in filteredRows" :key="g.id" :loading="loading" class="scope-card">
        <div class="scope-card-heading">
          <div>
            <h2>{{ personById(g.personnelId)?.name || `人员 ${g.personnelId}` }}</h2>
            <small>
              {{ scopeById(g.scopeId)?.organizationName || '机构不存在' }} · 平台账号编号
              {{ personById(g.personnelId)?.platformUserId || '未绑定' }}
            </small>
          </div>
          <a-tag :color="grantState(g) === '授权期内' ? 'green' : 'default'">{{ grantState(g) }}</a-tag>
        </div>
        <div class="scope-regions">
          <section v-for="r in g.regions" :key="r.code">
            <b>{{ r.name }}</b>
            <p>{{ r.code }} · {{ r.includeChildren ? '包含下级地区' : '仅本级地区' }}</p>
            <a-space wrap>
              <a-tag v-for="d in r.duties" :key="d">{{ DUTIES[d] || d }}</a-tag>
            </a-space>
          </section>
        </div>
        <p>{{ g.validFrom }} 至 {{ g.validUntil }}（含当日）</p>
        <p class="scope-note">授权依据：{{ g.basis }}</p>
        <footer>
          <small>第 {{ g.version }} 版</small>
          <a-space>
            <a-button @click="openHistory(g.id!)">变更记录</a-button>
            <a-button @click="openEdit(g)">编辑 / 停用</a-button>
          </a-space>
        </footer>
      </a-card>
      <a-card v-if="!loading && !rows.length">
        <a-empty description="暂无人员授权，请先登记机构范围及绑定人员账号" />
      </a-card>
    </div>

    <a-modal
      v-model:open="open"
      :title="editing ? '编辑人员授权' : '新增人员授权'"
      :width="760"
      ok-text="保存授权"
      :confirm-loading="saving"
      :mask-closable="!saving"
      :closable="!saving"
      :cancel-button-props="{ disabled: saving }"
      @ok="save"
    >
      <a-form layout="vertical" :disabled="saving" class="scope-form">
        <a-form-item label="监管人员" required>
          <a-select
            v-model:value="formState.personnelId"
            :disabled="Boolean(editing)"
            show-search
            option-filter-prop="label"
            :options="peopleOptions"
          />
        </a-form-item>
        <a-form-item label="所属监管机构" required>
          <a-select
            v-model:value="formState.scopeId"
            :disabled="Boolean(editing)"
            show-search
            option-filter-prop="label"
            :options="scopeOptions"
            @change="formState.regions = []"
          />
        </a-form-item>
        <a-form-item label="授权状态">
          <a-select v-model:value="formState.status" :options="statusOptions" />
        </a-form-item>
        <div class="scope-fields">
          <a-form-item label="生效日期" required>
            <a-input v-model:value="formState.validFrom" type="date" />
          </a-form-item>
          <a-form-item label="截止日期" required>
            <a-input v-model:value="formState.validUntil" type="date" />
          </a-form-item>
        </div>

        <b>辖区与职责（不得超出机构范围）</b>
        <div v-for="(reg, idx) in formState.regions" :key="idx" class="scope-region-form">
          <a-form-item label="辖区" required>
            <a-select
              v-model:value="reg.code"
              :options="availableRegionOptions"
              @change="(code: unknown) => handleRegionSelect(idx, String(code))"
            />
          </a-form-item>
          <a-form-item label="包含下级区域">
            <a-switch v-model:checked="reg.includeChildren" :disabled="!regionMeta(reg.code)?.includeChildren" />
          </a-form-item>
          <a-form-item label="授权职责" required>
            <a-select
              v-model:value="reg.duties"
              mode="multiple"
              option-filter-prop="label"
              :options="dutyOptionsForRegion(reg.code)"
            />
          </a-form-item>
          <a-button danger @click="formState.regions.splice(idx, 1)">移除此辖区</a-button>
        </div>
        <a-button
          block
          :disabled="!selectedScope || formState.regions.length >= 100"
          style="margin-bottom: 12px"
          @click="formState.regions.push({ code: '', name: '', includeChildren: false, duties: [] })"
        >
          增加授权辖区
        </a-button>

        <a-form-item label="授权依据 / 变更原因" required>
          <a-textarea v-model:value="formState.basis" :rows="3" :maxlength="1000" show-count />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal :open="history !== null" title="授权变更记录" :footer="null" :width="760" @cancel="history = null">
      <a-card v-for="h in history || []" :key="h.version" style="margin-bottom: 12px">
        <b>第 {{ h.version }} 版 · {{ h.operator_name }}</b>
        <p>{{ h.created_at.replace('T', ' ') }}</p>
        <template v-if="parseSnapshot(h.snapshot_json)">
          <p>
            {{ parseSnapshot(h.snapshot_json)!.status === 'enabled' ? '启用' : '停用' }} ·
            {{ parseSnapshot(h.snapshot_json)!.validFrom }} 至 {{ parseSnapshot(h.snapshot_json)!.validUntil }}
          </p>
          <p>{{ parseSnapshot(h.snapshot_json)!.basis }}</p>
          <p v-for="r in parseSnapshot(h.snapshot_json)!.regions" :key="r.code">
            {{ r.name }}（{{ r.code }}）{{ r.includeChildren ? '含下级' : '' }}：{{
              r.duties.map((d) => DUTIES[d] || d).join('、')
            }}
          </p>
        </template>
        <a-alert v-else type="error" message="历史记录解析失败" />
      </a-card>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { opsApi, type PersonnelGrant, type RegulatoryPerson, type RegulatoryScope } from './api'
import './scope-config.css'

const DUTIES: Record<string, string> = {
  inspection: '执法检查',
  sampling: '监督抽检',
  case: '案件处置',
  credit: '信用监管',
  complaint: '举报处理',
  statistics: '监管统计',
  subsidy: '补贴审核',
}

const statusOptions = [
  { value: 'enabled', label: '启用授权' },
  { value: 'disabled', label: '停用授权' },
]

function localDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const rows = ref<PersonnelGrant[]>([])
const scopes = ref<RegulatoryScope[]>([])
const people = ref<RegulatoryPerson[]>([])
const loading = ref(false)
const error = ref('')
const search = ref('')
const open = ref(false)
const saving = ref(false)
const editing = ref<PersonnelGrant | null>(null)
const history = ref<Awaited<ReturnType<typeof opsApi.grantHistory>> | null>(null)

const formState = reactive<PersonnelGrant>({
  personnelId: '',
  scopeId: '',
  status: 'enabled',
  validFrom: localDate(),
  validUntil: '',
  basis: '',
  regions: [],
})

const personById = (id: string) => people.value.find((p) => String(p.id) === String(id))
const scopeById = (id: string) => scopes.value.find((s) => s.id === id)
const selectedScope = computed(() => scopes.value.find((s) => s.id === formState.scopeId))

const peopleOptions = computed(() =>
  people.value.map((p) => ({
    value: String(p.id),
    label: `${p.name} · 平台账号 ${p.platformUserId}`,
    disabled: p.status !== 'active',
  })),
)

const scopeOptions = computed(() =>
  scopes.value.map((s) => ({
    value: s.id || '',
    label: s.organizationName,
    disabled: s.status !== 'enabled',
  })),
)

const availableRegionOptions = computed(
  () => selectedScope.value?.regions.map((r) => ({ value: r.code, label: `${r.name} · ${r.code}` })) ?? [],
)

function regionMeta(code: string) {
  return selectedScope.value?.regions.find((a) => a.code === code)
}

function dutyOptionsForRegion(code: string) {
  return regionMeta(code)?.duties.map((d) => ({ value: d, label: DUTIES[d] || d })) ?? []
}

function handleRegionSelect(index: number, code: string) {
  const r = regionMeta(code)
  const target = formState.regions[index]
  if (!target) return
  target.name = r?.name || ''
  target.duties = []
  target.includeChildren = false
}

function grantState(g: PersonnelGrant): string {
  if (g.status !== 'enabled') return '已停用'
  if (personById(g.personnelId)?.status !== 'active') return '人员已停用'
  const s = scopeById(g.scopeId)
  if (!s || s.status !== 'enabled') return '机构已停用'
  if (g.validFrom > localDate()) return '尚未生效'
  if (g.validUntil < localDate()) return '已到期'
  if (
    g.regions.some(
      (r) =>
        !s.regions.some(
          (a) =>
            a.code === r.code &&
            (!r.includeChildren || a.includeChildren) &&
            r.duties.every((d) => a.duties.includes(d)),
        ),
    )
  ) {
    return '范围需重新核对'
  }
  return '授权期内'
}

const filteredRows = computed(() =>
  rows.value.filter((g) =>
    `${personById(g.personnelId)?.name ?? ''} ${scopeById(g.scopeId)?.organizationName ?? ''}`.includes(
      search.value.trim(),
    ),
  ),
)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [a, b, c] = await Promise.all([opsApi.grants(), opsApi.scopes(), opsApi.personnel()])
    rows.value = a
    scopes.value = b
    people.value = c
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

function openEdit(row: PersonnelGrant | null) {
  editing.value = row
  if (row) {
    formState.personnelId = String(row.personnelId)
    formState.scopeId = row.scopeId
    formState.status = row.status
    formState.validFrom = row.validFrom
    formState.validUntil = row.validUntil
    formState.basis = row.basis
    formState.regions = row.regions.map((r) => ({ ...r, duties: [...r.duties] }))
  } else {
    formState.personnelId = ''
    formState.scopeId = ''
    formState.status = 'enabled'
    formState.validFrom = localDate()
    formState.validUntil = ''
    formState.basis = ''
    formState.regions = []
  }
  open.value = true
}

async function openHistory(id: string) {
  try {
    history.value = await opsApi.grantHistory(id)
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载历史失败')
  }
}

function parseSnapshot(raw: string): PersonnelGrant | null {
  try {
    return JSON.parse(raw) as PersonnelGrant
  } catch {
    return null
  }
}

async function save() {
  if (!formState.personnelId) {
    message.warning('请选择监管人员')
    return
  }
  if (!formState.scopeId) {
    message.warning('请选择所属监管机构')
    return
  }
  if (!formState.validFrom || !formState.validUntil) {
    message.warning('请选择生效日期和截止日期')
    return
  }
  if (formState.validUntil < formState.validFrom) {
    message.warning('截止日期不能早于生效日期')
    return
  }
  if (formState.status !== 'disabled') {
    if (!formState.regions.length) {
      message.warning('至少选择一个辖区')
      return
    }
    const codes = formState.regions.map((r) => r.code).filter(Boolean)
    if (codes.length !== formState.regions.length || new Set(codes).size !== codes.length) {
      message.warning('请选择有效且不重复的辖区')
      return
    }
    if (formState.regions.some((r) => !r.duties.length)) {
      message.warning('请为每个辖区选择至少一项职责')
      return
    }
  }
  if (!formState.basis.trim()) {
    message.warning('请填写授权依据或变更原因')
    return
  }
  saving.value = true
  try {
    const saved = await opsApi.saveGrant({
      ...formState,
      id: editing.value?.id,
      version: editing.value?.version,
      regions: formState.regions.map((r) => ({ ...r, duties: [...r.duties] })),
    })
    rows.value = [saved, ...rows.value.filter((x) => x.id !== saved.id)]
    open.value = false
    message.success('人员范围授权已保存')
  } catch (e) {
    message.error(e instanceof Error ? e.message : '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  void load()
})
</script>
