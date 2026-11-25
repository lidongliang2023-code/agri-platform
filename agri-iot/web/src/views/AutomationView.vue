<template>
  <div class="iot-page device-member-list">
    <IotPageTitle title="场景与自动化" desc="环境联动场景、自动化规则和手动执行。">
      <template #actions>
        <a-button @click="openScene()"><template #icon><PlusOutlined /></template>新建场景</a-button>
      </template>
    </IotPageTitle>

    <section class="iot-card">
      <div class="iot-card-head"><div><b>场景模式</b><small>一键应用环境控制策略，可新建和编辑</small></div></div>
      <div class="scene-grid">
        <article v-for="s in scenes" :key="s.id" :class="{ active: s.active }">
          <span>{{ s.icon }}</span>
          <small>{{ s.category }}</small>
          <h3>{{ s.sceneName }}</h3>
          <p>{{ s.description }}</p>
          <footer>
            <span>{{ s.plotCount }} 个地块</span>
            <div>
              <a-button size="small" type="text" @click="openScene(s)"><template #icon><EditOutlined /></template></a-button>
              <a-button size="small" type="text" danger @click="removeScene(s)"><template #icon><DeleteOutlined /></template></a-button>
              <a-button size="small" :type="s.active ? 'primary' : 'default'" @click="activate(s)">{{ s.active ? '运行中' : '启用' }}</a-button>
            </div>
          </footer>
        </article>
      </div>
    </section>

    <section class="iot-card device-filter-card" aria-label="自动化规则筛选">
      <a-form class="device-filter-grid" layout="vertical" @finish="applyFilter">
        <a-form-item label="关键字">
          <a-input v-model:value="draftKeyword" allow-clear placeholder="规则名称 / 编码 / 触发条件 / 动作">
            <template #prefix><SearchOutlined /></template>
          </a-input>
        </a-form-item>
        <a-form-item label="执行位置">
          <a-select v-model:value="draftExecMode" allow-clear placeholder="全部位置" :options="execModeOptions" />
        </a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="draftEnabled" allow-clear placeholder="全部状态" :options="enabledOptions" />
        </a-form-item>
        <a-space class="device-filter-actions">
          <a-button @click="resetFilter">重置</a-button>
          <a-button type="primary" html-type="submit">查询</a-button>
        </a-space>
      </a-form>
    </section>

    <AgriAntdvListTable
      :columns="ruleColumns"
      :data="filteredRules"
      row-key="id"
      :loading="loading"
      :client-pagination="true"
      column-settings-storage-key="iot_automation_rules_hidden_v1"
      column-width-storage-key="iot_automation_rules_widths_v1"
      :locked-column-keys="['rule', 'actions']"
      empty-text="请调整筛选条件或点击「新建规则」配置联动策略。"
      @refresh="load"
    >
      <template #toolbar-left>
        <a-button type="primary" @click="openRule()"><template #icon><PlusOutlined /></template>新建规则</a-button>
      </template>
      <template #cell-rule="{ record }">
        <div class="entity-copy"><b>{{ record.ruleName }}</b><small>{{ record.ruleCode }}</small></div>
      </template>
      <template #cell-mode="{ record }">
        {{ parseRuleConfig(String(record.config || '')).executionMode === 'cloud' ? '云端' : '边缘网关' }}
      </template>
      <template #cell-cooldown="{ record }">
        {{ Math.round(Number(record.cooldownSeconds || 0) / 60) }} 分钟
      </template>
      <template #cell-enabled="{ record }">
        <IotStatus :value="record.enabled ? 'running' : 'disabled'" />
      </template>
      <template #cell-actions="{ record }">
        <AgriVueRowActions
          :items="[
            { key: 'exec', label: '执行', onClick: () => executeRule(Number(record.id)) },
            { key: 'toggle', label: record.enabled ? '停用' : '启用', onClick: () => toggleRule(Number(record.id)) },
            { key: 'edit', label: '编辑', onClick: () => openRule(record as unknown as IotRule) },
            { key: 'del', label: '删除', danger: true, onClick: () => removeRule(record as unknown as IotRule) },
          ]"
        />
      </template>
    </AgriAntdvListTable>

    <a-modal
      :open="sceneOpen"
      :title="editingScene ? '编辑场景' : '新建场景'"
      :ok-text="editingScene ? '保存场景' : '创建场景'"
      :confirm-loading="submitting"
      @cancel="sceneOpen = false"
      @ok="submitScene"
    >
      <a-form ref="sceneFormRef" :model="sceneForm" layout="vertical">
        <div class="form-grid">
          <a-form-item label="场景名称" name="sceneName" :rules="[{ required: true, message: '请输入场景名称' }]">
            <a-input v-model:value="sceneForm.sceneName" placeholder="例如：低温保温" />
          </a-form-item>
          <a-form-item label="场景图标" name="icon"><a-input v-model:value="sceneForm.icon" :maxlength="8" /></a-form-item>
        </div>
        <div class="form-grid">
          <a-form-item label="场景分类" name="category">
            <a-select v-model:value="sceneForm.category" :options="sceneCategoryOptions" />
          </a-form-item>
          <a-form-item label="适用地块数量" name="plotCount">
            <a-input-number v-model:value="sceneForm.plotCount" :min="0" style="width: 100%" />
          </a-form-item>
        </div>
        <a-form-item label="场景说明" name="description">
          <a-textarea v-model:value="sceneForm.description" :rows="3" placeholder="说明场景用途和执行目标" />
        </a-form-item>
        <a-form-item label="执行配置" name="config" extra='可使用 JSON，例如 {"valve":"on","durationMinutes":15}'>
          <a-textarea v-model:value="sceneForm.config" :rows="5" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal :open="ruleOpen" :title="editingRule ? '编辑自动化规则' : '新建自动化规则'" :width="720" @cancel="ruleOpen = false">
      <template #footer>
        <a-button @click="ruleOpen = false">取消</a-button>
        <a-button :loading="submitting" @click="submitRule(false)">仅保存</a-button>
        <a-button type="primary" :loading="submitting" @click="submitRule(true)">保存并测试</a-button>
      </template>
      <a-form ref="ruleFormRef" :model="ruleForm" layout="vertical">
        <div class="form-grid">
          <a-form-item label="规则名称" name="ruleName" :rules="[{ required: true, message: '请输入规则名称' }]">
            <a-input v-model:value="ruleForm.ruleName" placeholder="例如：高温自动通风" />
          </a-form-item>
          <a-form-item label="规则类型" name="ruleType" :rules="[{ required: true, message: '请选择规则类型' }]">
            <a-select v-model:value="ruleForm.ruleType" :options="ruleTypeOptions" />
          </a-form-item>
        </div>
        <div class="dialog-summary">
          <b>IF · 触发条件</b>
          <span>
            {{
              ruleForm.ruleType === 'schedule'
                ? '到达设定时间后触发'
                : ruleForm.ruleType === 'offline'
                  ? '受控设备离线后触发'
                  : ruleForm.triggerMetric === 'device_offline'
                    ? '监测指标进入离线状态后触发'
                    : '监测指标满足阈值并持续达到设定时间后触发'
            }}
          </span>
        </div>
        <a-form-item
          v-if="ruleForm.ruleType === 'schedule'"
          label="定时表达式"
          name="schedule"
          :rules="[{ required: true, whitespace: true, message: '请填写定时表达式' }]"
          extra="支持每天 18:00、22:00-06:00 等调度描述"
        >
          <a-input v-model:value="ruleForm.schedule" placeholder="例如：每天 18:00" />
        </a-form-item>
        <div v-if="ruleForm.ruleType === 'offline'" class="dialog-summary">
          <span>规则将在任一受控设备离线后执行下方动作；冷却时间用于避免重复下发。</span>
        </div>
        <div v-if="ruleForm.ruleType === 'automation'" class="form-grid">
          <a-form-item label="触发指标" name="triggerMetric" :rules="[{ required: true, message: '请选择触发指标' }]">
            <a-select v-model:value="ruleForm.triggerMetric" :options="triggerMetricOptions" />
          </a-form-item>
          <a-form-item v-if="ruleForm.triggerMetric !== 'device_offline'" label="比较方式" name="operator" :rules="[{ required: true, message: '请选择比较方式' }]">
            <a-select v-model:value="ruleForm.operator" :options="operatorOptions" />
          </a-form-item>
          <a-form-item v-if="ruleForm.triggerMetric !== 'device_offline'" label="阈值" name="threshold" :rules="[{ required: true, message: '请输入阈值' }]">
            <a-input v-model:value="ruleForm.threshold" placeholder="如 32" />
          </a-form-item>
          <a-form-item v-if="ruleForm.triggerMetric !== 'device_offline'" label="持续时间（秒）" name="durationSeconds">
            <a-input-number v-model:value="ruleForm.durationSeconds" :min="0" style="width: 100%" />
          </a-form-item>
        </div>
        <div class="dialog-summary" style="margin-top: 12px">
          <b>THEN · 执行动作</b>
          <span>选择支持远程控制的设备，并配置指令与执行位置。</span>
        </div>
        <div class="form-grid">
          <a-form-item label="执行设备" name="actionDeviceId" :rules="[{ required: true, message: '请选择执行设备' }]">
            <a-select
              v-model:value="ruleForm.actionDeviceId"
              show-search
              option-filter-prop="label"
              placeholder="请选择支持远程控制的设备"
              :options="controllableDeviceOptions"
            />
          </a-form-item>
          <a-form-item label="执行指令" name="actionCommand" :rules="[{ required: true, message: '请选择执行指令' }]">
            <a-select v-model:value="ruleForm.actionCommand" :options="commandOptions" />
          </a-form-item>
          <a-form-item label="指令参数" name="actionValue"><a-input v-model:value="ruleForm.actionValue" placeholder="如 15分钟、30%" /></a-form-item>
          <a-form-item label="执行位置" name="executionMode">
            <a-select v-model:value="ruleForm.executionMode" :options="execLocationOptions" />
          </a-form-item>
          <a-form-item label="冷却时间（秒）" name="cooldownSeconds">
            <a-input-number v-model:value="ruleForm.cooldownSeconds" :min="0" style="width: 100%" />
          </a-form-item>
          <a-form-item label="规则状态" name="enabled">
            <a-select v-model:value="ruleForm.enabled" :options="[{ value: true, label: '创建后立即启用' }, { value: false, label: '暂不启用' }]" />
          </a-form-item>
        </div>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { Modal, message, type FormInstance } from 'ant-design-vue'
import { AgriAntdvListTable } from '@agri/shared/vue/antdv'
import { AgriVueRowActions, type VueListColumn } from '@agri/shared/vue/list'
import IotPageTitle from '../components/IotPageTitle.vue'
import IotStatus from '../components/IotStatus.vue'
import { iotApi, type IotDevice, type IotRule, type IotScene } from '../api/iotExperience'

function parseRuleConfig(raw?: string): Record<string, unknown> {
  if (!raw) return {}
  try {
    const value = JSON.parse(raw) as unknown
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

const scenes = ref<IotScene[]>([])
const rules = ref<IotRule[]>([])
const devices = ref<IotDevice[]>([])
const loading = ref(false)
const draftKeyword = ref('')
const draftExecMode = ref<string | undefined>()
const draftEnabled = ref<string | undefined>()
const keyword = ref('')
const execModeFilter = ref<string | undefined>()
const enabledFilter = ref<string | undefined>()
const sceneOpen = ref(false)
const ruleOpen = ref(false)
const editingScene = ref<IotScene | null>(null)
const editingRule = ref<IotRule | null>(null)
const submitting = ref(false)
const sceneFormRef = ref<FormInstance>()
const ruleFormRef = ref<FormInstance>()

const sceneForm = reactive({ sceneName: '', icon: '⚙️', category: '自定义场景', description: '', config: '{}', plotCount: 0 })
const ruleForm = reactive<{
  ruleName: string
  ruleType: string
  triggerMetric: string
  operator: string
  threshold: string
  durationSeconds: number
  schedule: string
  actionDeviceId?: number
  actionCommand: string
  actionValue: string
  cooldownSeconds: number
  executionMode: string
  enabled: boolean
}>({
  ruleName: '',
  ruleType: 'automation',
  triggerMetric: 'temperature',
  operator: '>',
  threshold: '32',
  durationSeconds: 300,
  schedule: '',
  actionDeviceId: undefined,
  actionCommand: 'on',
  actionValue: '',
  cooldownSeconds: 300,
  executionMode: 'edge',
  enabled: true,
})

const execModeOptions = [{ value: 'edge', label: '边缘网关' }, { value: 'cloud', label: '云端' }]
const enabledOptions = [{ value: 'enabled', label: '运行中' }, { value: 'disabled', label: '已停用' }]
const sceneCategoryOptions = ['环境控制', '水肥管理', '植保管理', '自定义场景'].map((v) => ({ value: v, label: v }))
const ruleTypeOptions = [
  { value: 'automation', label: '传感器自动触发' },
  { value: 'schedule', label: '定时触发' },
  { value: 'offline', label: '设备离线触发' },
]
const triggerMetricOptions = [
  { value: 'temperature', label: '空气温度' },
  { value: 'humidity', label: '空气湿度' },
  { value: 'soil_moisture', label: '土壤含水率' },
  { value: 'co2', label: 'CO₂浓度' },
  { value: 'light', label: '光照强度' },
  { value: 'rain', label: '降雨量' },
  { value: 'device_offline', label: '设备离线' },
]
const operatorOptions = ['>', '>=', '<', '<=', '=='].map((v) => ({ value: v, label: v }))
const commandOptions = ['on', 'off', 'open', 'close', 'start', 'stop', 'irrigate'].map((v) => ({ value: v, label: v }))
const execLocationOptions = [{ value: 'edge', label: '边缘网关（本地自治）' }, { value: 'cloud', label: '云端规则引擎' }]

const controllableDeviceOptions = computed(() =>
  devices.value.filter((d) => d.controlCapable).map((d) => ({ value: d.id, label: `${d.deviceName} · ${d.deviceCode}` })),
)

const ruleColumns: VueListColumn[] = [
  { key: 'rule', prop: 'ruleName', label: '规则', width: 190 },
  { key: 'trigger', prop: 'trigger', label: '触发条件', width: 200, ellipsis: true },
  { key: 'action', prop: 'action', label: '执行动作', width: 200, ellipsis: true },
  { key: 'mode', label: '执行位置', width: 110 },
  { key: 'cooldown', label: '冷却', width: 100, align: 'right' },
  { key: 'triggerCount', prop: 'triggerCount', label: '触发次数', width: 100, align: 'right' },
  { key: 'lastTrigger', prop: 'lastTrigger', label: '最近触发', width: 160 },
  { key: 'enabled', prop: 'enabled', label: '状态', width: 110 },
  { key: 'actions', label: '操作', width: 150, align: 'right', fixed: 'right', kind: 'action' },
]

const filteredRules = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return rules.value.filter((r) => {
    if (execModeFilter.value) {
      const mode = parseRuleConfig(r.config).executionMode === 'cloud' ? 'cloud' : 'edge'
      if (mode !== execModeFilter.value) return false
    }
    if (enabledFilter.value === 'enabled' && !r.enabled) return false
    if (enabledFilter.value === 'disabled' && r.enabled) return false
    if (kw) {
      const hay = `${r.ruleName} ${r.ruleCode || ''} ${r.trigger || ''} ${r.action || ''}`.toLowerCase()
      if (!hay.includes(kw)) return false
    }
    return true
  })
})

function load() {
  loading.value = true
  void Promise.all([iotApi.scenes(), iotApi.rules(), iotApi.devices()])
    .then(([s, r, d]) => {
      scenes.value = s
      rules.value = r
      devices.value = d
    })
    .catch((e: Error) => message.error(e.message))
    .finally(() => { loading.value = false })
}

onMounted(load)

function applyFilter() {
  keyword.value = draftKeyword.value
  execModeFilter.value = draftExecMode.value
  enabledFilter.value = draftEnabled.value
}

function resetFilter() {
  draftKeyword.value = ''
  draftExecMode.value = undefined
  draftEnabled.value = undefined
  keyword.value = ''
  execModeFilter.value = undefined
  enabledFilter.value = undefined
}

function activate(scene: IotScene) {
  Modal.confirm({
    title: '切换运行场景',
    content: `启用「${scene.sceneName}」后，其他场景将停止运行。是否继续？`,
    okText: '启用场景',
    onOk: async () => {
      try {
        await iotApi.activateScene(scene.id)
        message.success('场景已启用')
        load()
      } catch (error) {
        message.error(error instanceof Error ? error.message : '场景启用失败')
      }
    },
  })
}

async function toggleRule(id: number) {
  try {
    await iotApi.toggleRule(id)
    message.success('规则状态已更新')
    load()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '规则状态更新失败')
  }
}

async function executeRule(id: number) {
  try {
    await iotApi.executeRule(id)
    message.success('规则已执行并写入控制日志')
    load()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '执行失败')
  }
}

function openScene(scene?: IotScene) {
  editingScene.value = scene ?? null
  sceneForm.sceneName = scene?.sceneName ?? ''
  sceneForm.icon = scene?.icon ?? '⚙️'
  sceneForm.category = scene?.category ?? '自定义场景'
  sceneForm.description = scene?.description ?? ''
  sceneForm.config = scene?.config ?? '{}'
  sceneForm.plotCount = scene?.plotCount ?? 0
  sceneOpen.value = true
}

async function submitScene() {
  try {
    await sceneFormRef.value?.validate()
    const parsed = JSON.parse(sceneForm.config || '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('执行配置必须是有效的 JSON 对象')
    submitting.value = true
    if (editingScene.value) await iotApi.updateScene(editingScene.value.id, { ...sceneForm })
    else await iotApi.createScene({ ...sceneForm })
    message.success(editingScene.value ? '场景已更新' : '场景已创建')
    sceneOpen.value = false
    load()
  } catch (error) {
    if (error instanceof Error) message.error(error.message)
  } finally {
    submitting.value = false
  }
}

function removeScene(scene: IotScene) {
  Modal.confirm({
    title: '删除场景',
    content: `确定删除「${scene.sceneName}」吗？`,
    okText: '删除',
    okButtonProps: { danger: true },
    onOk: async () => {
      try {
        await iotApi.deleteScene(scene.id)
        message.success('场景已删除')
        load()
      } catch (error) {
        message.error(error instanceof Error ? error.message : '场景删除失败')
      }
    },
  })
}

function openRule(rule?: IotRule) {
  editingRule.value = rule ?? null
  const extra = parseRuleConfig(rule?.config)
  ruleForm.ruleName = rule?.ruleName ?? ''
  ruleForm.ruleType = rule?.ruleType || 'automation'
  ruleForm.triggerMetric = rule?.triggerMetric || 'temperature'
  ruleForm.operator = rule?.operator || '>'
  ruleForm.threshold = String(rule?.threshold ?? '32')
  ruleForm.durationSeconds = rule?.durationSeconds ?? 300
  ruleForm.schedule = rule?.schedule ?? ''
  ruleForm.actionDeviceId = rule?.actionDeviceId ?? undefined
  ruleForm.actionCommand = rule?.actionCommand || 'on'
  ruleForm.actionValue = rule?.actionValue ?? ''
  ruleForm.cooldownSeconds = rule?.cooldownSeconds ?? 300
  ruleForm.executionMode = String(extra.executionMode || 'edge')
  ruleForm.enabled = rule ? rule.enabled : true
  ruleOpen.value = true
}

async function submitRule(test = false) {
  try {
    await ruleFormRef.value?.validate()
    const metricNames: Record<string, string> = {
      temperature: '空气温度',
      humidity: '空气湿度',
      soil_moisture: '土壤含水率',
      co2: 'CO₂浓度',
      light: '光照强度',
      rain: '降雨量',
      device_offline: '设备离线',
    }
    const duration = Number(ruleForm.durationSeconds || 0)
    const trigger =
      ruleForm.ruleType === 'schedule'
        ? `定时触发 ${ruleForm.schedule || '未设置'}`
        : ruleForm.ruleType === 'offline' || ruleForm.triggerMetric === 'device_offline'
          ? '设备离线'
          : `${metricNames[ruleForm.triggerMetric] || ruleForm.triggerMetric} ${ruleForm.operator} ${ruleForm.threshold}` +
            (duration > 0 ? ` 持续${Math.ceil(duration / 60)}分钟` : '')
    const device = devices.value.find((item) => item.id === ruleForm.actionDeviceId)
    const action = `${device?.deviceName || '目标设备'}：${ruleForm.actionCommand || '执行动作'}` + (ruleForm.actionValue ? ` = ${ruleForm.actionValue}` : '')
    submitting.value = true
    const body = {
      ...ruleForm,
      trigger,
      action,
      actionDeviceName: device?.deviceName || '',
      config: JSON.stringify({ ...ruleForm, actionDeviceName: device?.deviceName || '' }),
    }
    const saved = editingRule.value ? await iotApi.updateRule(editingRule.value.id, body) : await iotApi.createRule(body)
    ruleOpen.value = false
    load()
    if (test) {
      try {
        await iotApi.executeRule(saved.id)
      } catch (error) {
        message.warning(`规则已保存，但测试执行失败：${error instanceof Error ? error.message : '未知错误'}`)
        return
      }
    }
    message.success(test ? '规则已保存，测试指令已下发' : editingRule.value ? '自动化规则已更新' : '自动化规则已创建')
  } catch (error) {
    if (error instanceof Error) message.error(error.message)
  } finally {
    submitting.value = false
  }
}

function removeRule(rule: IotRule) {
  Modal.confirm({
    title: '删除自动化规则',
    content: `确定删除「${rule.ruleName}」吗？`,
    okText: '删除',
    okButtonProps: { danger: true },
    onOk: async () => {
      try {
        await iotApi.deleteRule(rule.id)
        message.success('规则已删除')
        load()
      } catch (error) {
        message.error(error instanceof Error ? error.message : '规则删除失败')
      }
    },
  })
}
</script>
