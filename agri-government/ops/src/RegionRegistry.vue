<template>
  <div class="scope-page">
    <div class="o-title">
      <div>
        <span>监管数据归属</span>
        <h1>业务辖区登记</h1>
        <p>依据核实材料登记行政区划编码，不以地址文字或主体名称推测辖区。</p>
      </div>
    </div>

    <a-alert
      show-icon
      type="info"
      message="归属登记不授予执法权"
      description="此页仅展示识别记录所需的名称或编号。业务明细须同时具备有效人员授权和对应职责；没有编码的记录不进入辖区台账。修改归属会立即影响授权范围。"
    />

    <div class="scope-toolbar">
      <a-select v-model:value="kind" :options="kindOptions" />
      <a-input-search v-model:value="search" placeholder="搜索名称、编号或区划编码" allow-clear />
      <a-button :loading="loading" @click="load">刷新</a-button>
    </div>

    <a-alert v-if="error" type="error" :message="error" />

    <div class="scope-grid">
      <a-card v-for="r in visible" :key="r.id" class="scope-card">
        <div class="scope-card-heading">
          <h2>{{ r.name }}</h2>
          <a-tag :color="r.regionCode ? 'green' : 'orange'">{{ r.regionCode ? '已登记' : '待登记' }}</a-tag>
        </div>
        <p>行政区划编码：{{ r.regionCode || '尚未登记' }}</p>
        <footer>
          <small>记录编号 {{ r.id }}</small>
          <a-button @click="openEdit(r)">登记 / 更正归属</a-button>
        </footer>
      </a-card>
    </div>

    <a-empty v-if="!loading && !visible.length && !error" description="暂无匹配记录" />

    <a-modal
      :open="Boolean(editing)"
      title="登记业务辖区"
      :confirm-loading="saving"
      :mask-closable="!saving"
      :closable="!saving"
      :cancel-button-props="{ disabled: saving }"
      @cancel="!saving && (editing = null)"
      @ok="save"
    >
      <a-form layout="vertical" :disabled="saving">
        <p>{{ editing?.name }}</p>
        <a-form-item label="行政区划编码" required>
          <a-input v-model:value="formState.regionCode" :maxlength="12" placeholder="请输入6、9或12位行政区划编码" />
        </a-form-item>
        <a-form-item label="登记依据 / 更正原因" required>
          <a-textarea v-model:value="formState.reason" :rows="3" :maxlength="500" show-count />
        </a-form-item>
        <a-space>请核实实际所在地，编码格式通过不代表真实归属已核实。</a-space>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { opsApi } from './api'
import './scope-config.css'

type Row = { id: number; name: string; regionCode: string | null }

const kindOptions = [
  { value: 'subjects', label: '监管主体' },
  { value: 'complaints', label: '举报记录' },
]

const kind = ref('subjects')
const rows = ref<Row[]>([])
const error = ref('')
const loading = ref(false)
const saving = ref(false)
const editing = ref<Row | null>(null)
const search = ref('')
const formState = reactive({ regionCode: '', reason: '' })

const visible = computed(() =>
  rows.value.filter((r) => `${r.name} ${r.regionCode || ''}`.includes(search.value.trim())),
)

async function load() {
  loading.value = true
  error.value = ''
  try {
    rows.value = await opsApi.regionRegistry(kind.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

function openEdit(r: Row) {
  formState.regionCode = r.regionCode || ''
  formState.reason = ''
  editing.value = r
}

async function save() {
  if (!editing.value) return
  if (!/^[1-9][0-9]{5}(?:[0-9]{3})?(?:[0-9]{3})?$/.test(formState.regionCode.trim())) {
    message.warning('请输入6、9或12位行政区划编码')
    return
  }
  if (!formState.reason.trim()) {
    message.warning('请填写登记依据 / 更正原因')
    return
  }
  saving.value = true
  try {
    await opsApi.saveRegion(kind.value, editing.value.id, {
      regionCode: formState.regionCode.trim(),
      reason: formState.reason.trim(),
      previousCode: editing.value.regionCode || '',
    })
    editing.value = null
    message.success('辖区归属已保存，变更已留痕')
    await load()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '保存失败')
  } finally {
    saving.value = false
  }
}

watch(
  kind,
  () => {
    rows.value = []
    void load()
  },
  { immediate: true },
)
</script>
