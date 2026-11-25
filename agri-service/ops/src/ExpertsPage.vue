<template>
  <div class="ops-page">
    <div class="ops-page-title">
      <div>
        <h1>专家账号绑定</h1>
        <p>将已核实的专家档案绑定到本人统一账号，专家登录移动端后在“我的 → 专家工作台”回复问诊。</p>
      </div>
      <a-button @click="load">刷新</a-button>
    </div>

    <a-alert
      type="info"
      show-icon
      message="绑定要求"
      description="一位专家对应一个统一账号。账号须已启用，并具有 service:read / service:write 权限。绑定操作还需平台用户查询权限；不会自动新增角色或扩大账号权限。"
    />
    <a-alert v-if="error" type="error" show-icon :message="error" />

    <section class="ops-card ops-table-card">
      <a-table row-key="id" :loading="loading" :data-source="items" :columns="columns" :pagination="tablePagination">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'expert'">
            <b>{{ record.name }}</b>
            <div>{{ record.title }} · {{ record.organization }}</div>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="record.status === 'available' ? 'green' : 'orange'">
              {{ record.status === 'available' ? '可接诊' : '暂停接诊' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'userId'">
            {{ record.userId ? `${record.accountName || ''}（${record.userId}）` : '未绑定' }}
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button type="link" @click="openBind(record)">{{ record.userId ? '更换绑定' : '绑定账号' }}</a-button>
            <a-button v-if="record.userId" type="link" danger @click="unbind(record)">解除绑定</a-button>
          </template>
        </template>
      </a-table>
    </section>

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
import { onMounted, ref } from 'vue'
import { Modal, message } from 'ant-design-vue'
import { opsApi, type OpsExpert } from './api'

const items = ref<OpsExpert[]>([])
const loading = ref(false)
const error = ref('')
const active = ref<OpsExpert | null>(null)
const userId = ref('')
const saving = ref(false)

const tablePagination = {
  defaultPageSize: 20,
  showSizeChanger: true,
  showQuickJumper: true,
  pageSizeOptions: ['10', '20', '50', '100'],
  showTotal: (total: number) => `共 ${total} 条`,
}

const columns = [
  { title: '专家', key: 'expert' },
  { title: '领域', key: 'category', dataIndex: 'category' },
  { title: '状态', key: 'status', dataIndex: 'status' },
  { title: '统一账号', key: 'userId', dataIndex: 'userId' },
  { title: '操作', key: 'action' },
]

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
