<template>
  <div class="ops-page">
    <div class="ops-page-title">
      <div>
        <h1>专家账号绑定</h1>
        <p>将已核实的专家档案绑定到本人统一账号，专家登录移动端后在“我的 → 专家工作台”回复问诊。</p>
      </div>
    </div>

    <a-alert
      type="info"
      show-icon
      message="绑定要求"
      description="一位专家对应一个统一账号。账号须已启用，并具有 service:read / service:write 权限。绑定操作还需平台用户查询权限；不会自动新增角色或扩大账号权限。"
    />
    <a-alert v-if="error" type="error" show-icon :message="error" />

    <AgriAntdvListTable
      :columns="columns"
      :data="filteredItems"
      row-key="id"
      :loading="loading"
      client-pagination
      column-settings-storage-key="service-ops:experts"
      @refresh="load"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="2" :loading="loading" @search="applyFilter" @reset="resetFilter">
          <div class="agri-vue-filter-field">
            <label>关键字</label>
            <a-input
              v-model:value="draft"
              allow-clear
              placeholder="姓名 / 单位 / 领域 / 统一账号"
              @press-enter="applyFilter"
            />
          </div>
          <div class="agri-vue-filter-field">
            <label>接诊状态</label>
            <a-select
              v-model:value="statusFilter"
              :options="statusOptions"
              @change="applyFilter"
            />
          </div>
        </AgriVueFilterBar>
      </template>
      <template #cell-expert="{ record }">
        <b>{{ record.name }}</b>
        <div>{{ record.title }} · {{ record.organization }}</div>
      </template>
      <template #cell-status="{ record }">
        <a-tag :color="record.status === 'available' ? 'green' : 'orange'">
          {{ record.status === 'available' ? '可接诊' : '暂停接诊' }}
        </a-tag>
      </template>
      <template #cell-userId="{ record }">
        {{ record.userId ? `${record.accountName || ''}（${record.userId}）` : '未绑定' }}
      </template>
      <template #cell-action="{ record }">
        <AgriVueRowActions :actions="rowActions(record as unknown as OpsExpert)" />
      </template>
    </AgriAntdvListTable>

    <a-modal
      :open="Boolean(active)"
      :title="`绑定专家：${active?.name || ''}`"
      :confirm-loading="saving"
      ok-text="保存绑定"
      cancel-text="取消"
      @cancel="!saving && (active = null)"
      @ok="save"
    >
      <p>请填写已核实属于该专家本人的统一账号编号；系统将验证账号有效性并记录操作人。</p>
      <a-input v-model:value="userId" aria-label="统一账号编号" :disabled="saving" placeholder="统一用户中心中的账号编号" />
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Modal, message } from 'ant-design-vue'
import { AgriAntdvListTable } from '@agri/shared/vue/antdv'
import { AgriVueFilterBar, AgriVueRowActions, type VueListColumn, type VueRowActionItem } from '@agri/shared/vue/list'
import { opsApi, type OpsExpert } from './api'

const items = ref<OpsExpert[]>([])
const loading = ref(false)
const error = ref('')
const active = ref<OpsExpert | null>(null)
const userId = ref('')
const saving = ref(false)
const draft = ref('')
const keyword = ref('')
const statusFilter = ref('all')

const statusOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'available', label: '可接诊' },
  { value: 'paused', label: '暂停接诊' },
]

const filteredItems = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  return items.value.filter((item) => {
    if (statusFilter.value === 'available' && item.status !== 'available') return false
    if (statusFilter.value === 'paused' && item.status === 'available') return false
    if (!q) return true
    return `${item.name} ${item.title} ${item.organization} ${item.category} ${item.userId || ''} ${item.accountName || ''}`
      .toLowerCase()
      .includes(q)
  })
})

const columns: VueListColumn[] = [
  { label: '专家', key: 'expert', width: 260, locked: true },
  { label: '领域', key: 'category', prop: 'category', width: 150 },
  { label: '状态', key: 'status', prop: 'status', width: 110 },
  { label: '统一账号', key: 'userId', prop: 'userId', width: 200 },
  { label: '操作', key: 'action', width: 160, fixed: 'right' },
]

function applyFilter() {
  keyword.value = draft.value.trim()
}

function resetFilter() {
  draft.value = ''
  keyword.value = ''
  statusFilter.value = 'all'
}

function rowActions(row: OpsExpert): VueRowActionItem[] {
  const actions: VueRowActionItem[] = [
    { key: 'bind', label: row.userId ? '更换绑定' : '绑定账号', onClick: () => openBind(row) },
  ]
  if (row.userId) {
    actions.push({ key: 'unbind', label: '解除绑定', danger: true, onClick: () => unbind(row) })
  }
  return actions
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    items.value = await opsApi.experts()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

function openBind(row: OpsExpert) {
  active.value = row
  userId.value = row.userId || ''
}

async function save() {
  if (!active.value || saving.value) return
  if (!/^[1-9]\d*$/.test(userId.value.trim())) {
    message.warning('请填写有效的统一账号编号')
    return
  }
  saving.value = true
  try {
    await opsApi.bindExpert(active.value.id, userId.value.trim())
    active.value = null
    message.success('专家账号已绑定')
    await load()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '绑定失败')
  } finally {
    saving.value = false
  }
}

function unbind(row: OpsExpert) {
  Modal.confirm({
    title: `解除 ${row.name} 的账号绑定？`,
    content: `账号 ${row.userId} 将失去该专家工作台访问权限，既有回复留痕保留。`,
    okText: '解除绑定',
    cancelText: '取消',
    onOk: async () => {
      try {
        await opsApi.bindExpert(row.id, null)
        message.success('已解除绑定')
        await load()
      } catch (e) {
        message.error(e instanceof Error ? e.message : '解绑失败')
        throw e
      }
    },
  })
}

onMounted(() => {
  void load()
})
</script>
