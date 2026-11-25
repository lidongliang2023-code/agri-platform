<template>
  <div class="scope-page">
    <div class="o-title">
      <div>
        <span>监管组织与职责</span>
        <h1>监管范围配置</h1>
        <p>登记机构管辖地区与监管职责，建立清晰的监管边界。</p>
      </div>
      <a-button type="primary" @click="openEdit(null)">
        <template #icon><PlusOutlined /></template>
        新增机构范围
      </a-button>
    </div>

    <a-alert
      type="info"
      show-icon
      message="当前为范围配置登记"
      description="保存不会自动授予执法权。人员授权请前往“监管人员授权”配置；各业务接口的辖区过滤尚未全面接入本配置，登记状态不代表数据隔离已生效。行政区划代码请以正式资料为准。"
    />

    <div class="scope-summary">
      <a-card><span>已登记机构</span><strong>{{ rows.length }}</strong></a-card>
      <a-card><span>启用登记</span><strong>{{ rows.filter((r) => r.status === 'enabled').length }}</strong></a-card>
      <a-card><span>辖区配置条目</span><strong>{{ rows.reduce((n, r) => n + r.regions.length, 0) }}</strong></a-card>
    </div>

    <div class="scope-toolbar">
      <a-input-search v-model:value="keyword" allow-clear placeholder="搜索机构名称、机构代码或辖区" />
      <a-select v-model:value="status" aria-label="登记状态" :options="statusFilterOptions" />
      <a-button :loading="loading" @click="load">
        <template #icon><ReloadOutlined /></template>
        刷新
      </a-button>
    </div>

    <a-alert v-if="error" type="error" show-icon :message="error">
      <template #action><a-button @click="load">重试</a-button></template>
    </a-alert>
    <div v-else-if="loading" class="scope-loading"><a-spin /></div>
    <a-card v-else-if="filtered.length === 0">
      <a-empty :description="rows.length ? '没有匹配的配置' : '尚未登记监管机构范围'">
        <a-button v-if="!rows.length" type="primary" @click="openEdit(null)">登记首个机构</a-button>
      </a-empty>
    </a-card>
    <div v-else class="scope-grid">
      <a-card v-for="row in filtered" :key="row.id" class="scope-card">
        <div class="scope-card-heading">
          <div>
            <h2>{{ row.organizationName }}</h2>
            <small>机构代码 · {{ row.organizationCode }}</small>
          </div>
          <a-tag :color="row.status === 'enabled' ? 'green' : 'default'">
            {{ row.status === 'enabled' ? '启用登记' : '停用登记' }}
          </a-tag>
        </div>
        <div class="scope-regions">
          <section v-for="r in row.regions" :key="r.code">
            <div><b>{{ r.name }}</b><span>{{ r.code }}</span></div>
            <p>{{ r.includeChildren ? '包含下级行政区域（登记范围）' : '仅所选行政区域' }}</p>
            <a-space :size="[4, 6]" wrap>
              <a-tag v-for="d in r.duties" :key="d">{{ dutyLabel(d) }}</a-tag>
            </a-space>
          </section>
        </div>
        <p v-if="row.note" class="scope-note">{{ row.note }}</p>
        <footer>
          <small>更新于 {{ row.updatedAt?.replace('T', ' ').slice(0, 19) }} · 第 {{ row.version }} 版</small>
          <a-button @click="openEdit(row)">编辑范围</a-button>
        </footer>
      </a-card>
    </div>

    <a-modal
      v-model:open="open"
      :title="editing ? '编辑监管范围' : '新增监管机构范围'"
      :width="760"
      :confirm-loading="saving"
      ok-text="保存登记"
      cancel-text="取消"
      :mask-closable="!saving"
      :closable="!saving"
      :cancel-button-props="{ disabled: saving }"
      @ok="save"
    >
      <a-form layout="vertical" :disabled="saving" class="scope-form">
        <div class="scope-fields">
          <a-form-item label="机构全称" required>
            <a-input v-model:value="formState.organizationName" :maxlength="160" placeholder="填写正式机构名称" />
          </a-form-item>
          <a-form-item label="机构代码" required extra="使用机构统一代码或稳定的内部编码，不使用市场编号">
            <a-input v-model:value="formState.organizationCode" :maxlength="64" />
          </a-form-item>
        </div>
        <a-form-item label="登记状态" required>
          <a-select v-model:value="formState.status" :options="statusOptions" />
        </a-form-item>
        <div class="scope-section-title">
          <b>管辖地区与职责</b>
          <span>职责按辖区分别登记</span>
        </div>
        <div v-for="(reg, idx) in formState.regions" :key="idx" class="scope-region-form">
          <div class="scope-card-heading">
            <b>辖区 {{ idx + 1 }}</b>
            <a-button danger type="text" :disabled="formState.regions.length === 1" @click="formState.regions.splice(idx, 1)">
              移除条目
            </a-button>
          </div>
          <div class="scope-fields">
            <a-form-item label="辖区名称" required>
              <a-input v-model:value="reg.name" :maxlength="160" placeholder="填写完整行政区域名称" />
            </a-form-item>
            <a-form-item label="行政区划代码" required>
              <a-input v-model:value="reg.code" :maxlength="12" placeholder="6、9或12位行政区划代码" />
            </a-form-item>
          </div>
          <a-form-item label="包含下级行政区域">
            <a-switch v-model:checked="reg.includeChildren" checked-children="包含" un-checked-children="不包含" />
          </a-form-item>
          <a-form-item label="承担职责" required>
            <a-select v-model:value="reg.duties" mode="multiple" :options="DUTIES" placeholder="选择该辖区内承担的职责" />
          </a-form-item>
        </div>
        <a-button block type="dashed" :disabled="formState.regions.length >= 100" @click="addRegion">
          <template #icon><PlusOutlined /></template>
          增加辖区
        </a-button>
        <a-form-item label="职责依据与备注" style="margin-top: 12px">
          <a-textarea v-model:value="formState.note" :rows="3" :maxlength="1000" show-count placeholder="可填写职责依据、授权文件编号及边界说明" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import { opsApi, type RegulatoryScope } from './api'
import './scope-config.css'

const DUTIES = [
  { value: 'inspection', label: '执法检查' },
  { value: 'sampling', label: '监督抽检' },
  { value: 'case', label: '案件处置' },
  { value: 'credit', label: '信用监管' },
  { value: 'complaint', label: '举报处理' },
  { value: 'statistics', label: '监管统计' },
]

const statusFilterOptions = [
  { value: 'all', label: '全部登记状态' },
  { value: 'enabled', label: '启用登记' },
  { value: 'disabled', label: '停用登记' },
]

const statusOptions = [
  { value: 'enabled', label: '启用登记' },
  { value: 'disabled', label: '停用登记' },
]

const rows = ref<RegulatoryScope[]>([])
const loading = ref(true)
const error = ref('')
const keyword = ref('')
const status = ref('all')
const open = ref(false)
const saving = ref(false)
const editing = ref<RegulatoryScope | null>(null)

const formState = reactive<RegulatoryScope>({
  organizationCode: '',
  organizationName: '',
  status: 'enabled',
  note: '',
  regions: [{ code: '', name: '', includeChildren: false, duties: [] }],
})

function dutyLabel(d: string): string {
  return DUTIES.find((x) => x.value === d)?.label || d
}

const filtered = computed(() =>
  rows.value.filter(
    (r) =>
      (status.value === 'all' || r.status === status.value) &&
      `${r.organizationName} ${r.organizationCode} ${r.regions.map((a) => `${a.name} ${a.code}`).join(' ')}`
        .toLowerCase()
        .includes(keyword.value.trim().toLowerCase()),
  ),
)

async function load() {
  loading.value = true
  error.value = ''
  try {
    rows.value = await opsApi.scopes()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

function openEdit(row: RegulatoryScope | null) {
  editing.value = row
  if (row) {
    formState.organizationCode = row.organizationCode
    formState.organizationName = row.organizationName
    formState.status = row.status
    formState.note = row.note || ''
    formState.regions = row.regions.map((r) => ({ ...r, duties: [...r.duties] }))
  } else {
    formState.organizationCode = ''
    formState.organizationName = ''
    formState.status = 'enabled'
    formState.note = ''
    formState.regions = [{ code: '', name: '', includeChildren: false, duties: [] }]
  }
  open.value = true
}

function addRegion() {
  formState.regions.push({ code: '', name: '', includeChildren: false, duties: [] })
}

async function save() {
  if (!formState.organizationName.trim()) {
    message.warning('请填写机构全称')
    return
  }
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(formState.organizationCode.trim())) {
    message.warning('机构代码限64位以内字母、数字、下划线或短横线')
    return
  }
  if (!formState.regions.length) {
    message.warning('请至少登记一个辖区')
    return
  }
  const codes = new Set<string>()
  for (const reg of formState.regions) {
    if (!reg.name.trim()) {
      message.warning('请填写辖区名称')
      return
    }
    if (!/^(?:[1-9]\d{5}|[1-9]\d{8}|[1-9]\d{11})$/.test(reg.code.trim())) {
      message.warning('请输入6、9或12位行政区划代码')
      return
    }
    if (codes.has(reg.code.trim())) {
      message.warning('辖区代码不能重复')
      return
    }
    codes.add(reg.code.trim())
    if (!reg.duties.length) {
      message.warning('每个辖区至少选择一项职责')
      return
    }
  }
  saving.value = true
  try {
    const payload: RegulatoryScope = {
      organizationName: formState.organizationName.trim(),
      organizationCode: formState.organizationCode.trim(),
      status: formState.status,
      note: formState.note,
      regions: formState.regions.map((r) => ({
        name: r.name.trim(),
        code: r.code.trim(),
        includeChildren: Boolean(r.includeChildren),
        duties: [...r.duties],
      })),
      version: editing.value?.version,
    }
    const saved = await opsApi.saveScope(payload, editing.value?.id)
    rows.value = [saved, ...rows.value.filter((r) => r.id !== saved.id)]
    open.value = false
    message.success('监管范围已登记，未自动授予人员执法权限')
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
