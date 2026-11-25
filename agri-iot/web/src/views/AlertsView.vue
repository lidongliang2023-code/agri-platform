<template>
  <div class="iot-page">
    <IotPageTitle title="预警中心" desc="环境阈值、设备离线、数据异常与信号质量的统一处置。">
      <template #actions>
        <a-button @click="loadAlerts">刷新告警</a-button>
      </template>
    </IotPageTitle>

    <div class="iot-tabs">
      <button type="button" :class="{ on: tab === 'alerts' }" @click="setTab('alerts')">告警列表</button>
      <button type="button" :class="{ on: tab === 'rules' }" @click="setTab('rules')">告警规则</button>
    </div>

    <!-- 告警列表 -->
    <div v-if="tab === 'alerts'" class="alert-cards">
      <section v-for="a in items" :key="a.id" :class="`iot-card alert-card level-${a.level}`">
        <div class="iot-card-head">
          <div>
            <IotStatus :value="a.level" />
            <b>{{ a.title }}</b>
            <small>{{ a.deviceName }} · {{ a.alertNo }}</small>
          </div>
          <IotStatus :value="a.status" />
        </div>
        <p>{{ a.content }}</p>
        <div class="alert-values">
          <span><small>触发值</small><b>{{ a.triggerValue }}</b></span>
          <span><small>阈值</small><b>{{ a.thresholdValue }}</b></span>
          <span><small>时间</small><b>{{ a.createdAt }}</b></span>
        </div>
        <footer>
          <small v-if="a.status === 'resolved'">{{ a.handledBy }} · {{ a.handleNote }}</small>
          <template v-else>
            <a-button size="small" @click="openHandle(a)">{{ a.status === 'pending' ? '受理告警' : '登记处理结果' }}</a-button>
            <a-button size="small" @click="routeStore.navigate('/maintenance')">创建工单</a-button>
          </template>
        </footer>
      </section>
    </div>

    <!-- 告警规则工作台 -->
    <div v-else class="device-member-list">
      <div v-if="!ruleView || !ruleOptions" class="iot-loading"><i /><i /><i /></div>
      <template v-else>
        <section class="iot-card device-filter-card" aria-label="阈值规则筛选" style="margin-bottom: 12px">
          <a-form class="device-filter-grid" layout="vertical" @finish="applyRuleFilter">
            <a-form-item label="关键字">
              <a-input v-model:value="draftKeyword" allow-clear placeholder="规则名称 / 指标 / 设备类型">
                <template #prefix><SearchOutlined /></template>
              </a-input>
            </a-form-item>
            <a-form-item label="告警等级">
              <a-select
                v-model:value="draftLevel"
                allow-clear
                placeholder="全部等级"
                :options="ruleOptions.levels.map((level) => ({ value: level, label: STATUS[level]?.label || level }))"
              />
            </a-form-item>
            <a-space class="device-filter-actions">
              <a-button @click="resetRuleFilter">重置</a-button>
              <a-button type="primary" html-type="submit">查询</a-button>
            </a-space>
          </a-form>
        </section>

        <div class="iot-two-grid">
          <AgriAntdvListTable
            :columns="tenantColumns"
            :data="filteredTenant"
            row-key="id"
            :loading="ruleLoading"
            :client-pagination="true"
            column-settings-storage-key="iot_alert_tenant_rules_hidden_v1"
            column-width-storage-key="iot_alert_tenant_rules_widths_v1"
            :locked-column-keys="['ruleName', 'actions']"
            empty-text="还没有匹配的自定义阈值，所有指标按平台预置阈值判定。"
            @refresh="loadRules"
          >
            <template #toolbar-left>
              <a-space wrap>
                <a-button type="primary" @click="openRuleForm(null)">
                  <template #icon><PlusOutlined /></template>
                  新增阈值
                </a-button>
                <span style="color: var(--ink4); font-size: 12px">
                  我的阈值规则 · {{ ruleView.tenantName ? `${ruleView.tenantName}（同指标覆盖平台预置）` : '本经营主体生效' }}
                </span>
              </a-space>
            </template>
            <template #cell-condition="{ record }">
              <span>{{ record.metricName }} {{ record.operator }} {{ Number(record.threshold) }}{{ record.deviceType ? ` · ${record.deviceType}` : '' }}</span>
            </template>
            <template #cell-durationSeconds="{ record }">
              {{ Number(record.durationSeconds) > 0 ? `${record.durationSeconds} 秒` : '瞬时' }}
            </template>
            <template #cell-level="{ record }">
              <IotStatus :value="String(record.level || '')" />
            </template>
            <template #cell-enabled="{ record }">
              <IotStatus :value="record.enabled ? 'running' : 'disabled'" />
            </template>
            <template #cell-actions="{ record }">
              <AgriVueRowActions
                :items="[
                  { key: 'edit', label: '编辑', onClick: () => openRuleForm(record as unknown as AlertRule) },
                  { key: 'toggle', label: record.enabled ? '停用' : '启用', onClick: () => toggleRule(record as unknown as AlertRule) },
                  { key: 'delete', label: '删除', danger: true, onClick: () => removeRule(record as unknown as AlertRule) },
                ]"
              />
            </template>
          </AgriAntdvListTable>

          <AgriAntdvListTable
            :columns="platformColumns"
            :data="filteredPlatform"
            row-key="id"
            :loading="ruleLoading"
            :client-pagination="true"
            column-settings-storage-key="iot_alert_platform_rules_hidden_v1"
            column-width-storage-key="iot_alert_platform_rules_widths_v1"
            :locked-column-keys="['ruleName']"
            empty-text="暂无平台预置阈值"
            @refresh="loadRules"
          >
            <template #toolbar-left>
              <span style="font-weight: 600">
                平台预置阈值 <small style="color: var(--ink4); font-weight: 400">全平台兜底默认值，本页面只读</small>
              </span>
            </template>
            <template #cell-condition="{ record }">
              {{ record.metricName }} {{ record.operator }} {{ Number(record.threshold) }}
            </template>
            <template #cell-durationSeconds="{ record }">{{ record.durationSeconds }} 秒</template>
            <template #cell-level="{ record }"><IotStatus :value="String(record.level || '')" /></template>
            <template #cell-status="{ record }">
              <a-tag v-if="record.overridden" color="blue">已由「{{ record.overriddenByRuleName }}」覆盖</a-tag>
              <IotStatus v-else :value="record.enabled ? 'running' : 'disabled'" />
            </template>
          </AgriAntdvListTable>
        </div>

        <div class="iot-two-grid">
          <section class="iot-card">
            <div class="iot-card-head"><div><b>阈值试算</b><small>按当前主体生效规则判定</small></div></div>
            <div class="iot-filter">
              <a-select
                v-model:value="trialMetric"
                style="width: 180px"
                :options="ruleOptions.metrics.map((item) => ({ value: item.key, label: `${item.name}${item.unit ? ` (${item.unit})` : ''}` }))"
              />
              <a-input v-model:value="trialValue" style="width: 120px" placeholder="读数" />
              <a-button type="primary" @click="runTrial">判定</a-button>
            </div>
            <div v-if="trial" class="dialog-summary">
              <b>{{ metricNameOf(trial.metricKey) }} {{ trial.value }} → <IotStatus :value="trial.level" /></b>
              <span>{{ trial.note }}</span>
              <small v-if="trial.matchedRules.length > 0">
                {{ trial.matchedRules.map((rule) => `${rule.ruleName}（${rule.source === 'tenant' ? '本主体' : '平台'}）`).join('、') }}
              </small>
            </div>
          </section>

          <section class="iot-card">
            <div class="iot-card-head"><div><b>超过阈值的读数</b><small>最近一次读数已越线（含持续时间判定），不是自动生成的告警</small></div></div>
            <IotEmptyHint
              v-if="risks.length === 0"
              icon="✅"
              title="当前没有超过本主体阈值的读数"
              desc="判定按本主体生效阈值 + 实际读数序列；接入设备上报后这里会实时出现。"
            />
            <div v-else>
              <div v-for="risk in risks.slice(0, 6)" :key="`${risk.deviceId}-${risk.metricKey}-${risk.ruleId}`" class="work-order">
                <div class="iot-card-head">
                  <div><b>{{ risk.deviceName }}</b><small>{{ risk.deviceCode }} · {{ risk.typeName }}</small></div>
                  <IotStatus :value="risk.level" />
                </div>
                <p>
                  {{ risk.metricName }} {{ risk.value }}{{ risk.unit || '' }} · 阈值 {{ risk.operator }} {{ Number(risk.threshold) }}
                  {{ risk.durationSeconds > 0 ? ` · 需持续 ${risk.durationSeconds} 秒` : '' }} · {{ risk.recordedAt }}
                </p>
                <footer><span>{{ risk.ruleName }}（{{ risk.ruleSource === 'tenant' ? '本主体阈值' : '平台预置' }}）</span></footer>
              </div>
            </div>
          </section>
        </div>

        <a-modal
          :open="ruleModalOpen"
          :title="editingRule ? '编辑阈值规则' : '新增阈值规则'"
          :ok-text="editingRule ? '保存' : '创建'"
          :confirm-loading="ruleSubmitting"
          @cancel="ruleModalOpen = false"
          @ok="submitRule"
        >
          <a-form ref="ruleFormRef" :model="ruleForm" layout="vertical">
            <a-form-item label="规则名称" name="ruleName" :rules="[{ required: true, message: '请输入规则名称' }]">
              <a-input v-model:value="ruleForm.ruleName" placeholder="例如：蔬菜棚高温" :maxlength="160" />
            </a-form-item>
            <div class="form-grid">
              <a-form-item label="监控指标" name="metricKey" :rules="[{ required: true, message: '请选择监控指标' }]">
                <a-select
                  v-model:value="ruleForm.metricKey"
                  show-search
                  option-filter-prop="label"
                  :virtual="false"
                  :options="ruleOptions.metrics.map((item) => ({ value: item.key, label: `${item.name}${item.unit ? ` (${item.unit})` : ''}` }))"
                />
              </a-form-item>
              <a-form-item label="限定设备类型" name="deviceType">
                <a-select
                  v-model:value="ruleForm.deviceType"
                  allow-clear
                  :virtual="false"
                  placeholder="不限设备类型"
                  :options="ruleOptions.deviceTypes.map((type) => ({ value: type, label: type }))"
                />
              </a-form-item>
            </div>
            <div class="dialog-summary" style="margin-top: -4px; margin-bottom: 12px">
              <b>{{ currentMetricOption ? `${currentMetricOption.name}${currentMetricOption.unit ? `（${currentMetricOption.unit}）` : ''}` : '请选择指标' }}</b>
              <span>
                {{ currentMetricOption?.deviceTypes?.length ? `可用设备类型：${currentMetricOption.deviceTypes.join('、')}` : '按设备上报的该指标判定' }}；持续时间必须由对应采样周期覆盖，采样断档不会触发持续告警。
              </span>
            </div>
            <div class="form-grid">
              <a-form-item label="比较方式" name="operator" :rules="[{ required: true }]">
                <a-select v-model:value="ruleForm.operator" :options="ruleOptions.operators.map((op) => ({ value: op, label: op }))" />
              </a-form-item>
              <a-form-item label="阈值" name="threshold" :rules="[{ required: true, message: '请输入阈值' }]">
                <a-input-number v-model:value="ruleForm.threshold" style="width: 100%" :step="0.1" />
              </a-form-item>
            </div>
            <div class="form-grid">
              <a-form-item label="持续时间（秒）" name="durationSeconds">
                <a-input-number v-model:value="ruleForm.durationSeconds" :min="0" :max="86400" :step="1" style="width: 100%" />
              </a-form-item>
              <a-form-item label="告警等级" name="level" :rules="[{ required: true }]">
                <a-select
                  v-model:value="ruleForm.level"
                  :options="ruleOptions.levels.map((level) => ({ value: level, label: STATUS[level]?.label || level }))"
                />
              </a-form-item>
            </div>
            <a-form-item label="备注" name="remark">
              <a-textarea v-model:value="ruleForm.remark" :rows="2" :maxlength="400" placeholder="为什么要设成这个值" />
            </a-form-item>
          </a-form>
        </a-modal>
      </template>
    </div>

    <a-modal :open="Boolean(target)" title="处置告警" ok-text="确认处置" @cancel="target = null" @ok="handleAlert">
      <div class="dialog-summary">
        <b>{{ target?.title }}</b>
        <span>{{ target?.content }}</span>
      </div>
      <a-textarea v-model:value="note" :rows="4" />
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { Modal, message, type FormInstance } from 'ant-design-vue'
import { AgriAntdvListTable } from '@agri/shared/vue/antdv'
import { AgriVueRowActions, type VueListColumn } from '@agri/shared/vue/list'
import IotEmptyHint from '../components/IotEmptyHint.vue'
import IotPageTitle from '../components/IotPageTitle.vue'
import IotStatus from '../components/IotStatus.vue'
import { useIotRouteStore } from '../stores/iotRoute'
import {
  iotApi,
  STATUS,
  type AlertJudgement,
  type AlertRule,
  type AlertRuleOptions,
  type AlertRuleView,
  type IotAlert,
  type RiskReading,
} from '../api/iotExperience'

const routeStore = useIotRouteStore()
const tab = computed<'alerts' | 'rules'>(() =>
  routeStore.searchParams.get('tab') === 'rules' || routeStore.pathname.replace(/\/+$/, '') === '/alert-rules' ? 'rules' : 'alerts',
)

function setTab(next: 'alerts' | 'rules') {
  const params = new URLSearchParams(routeStore.search)
  params.set('tab', next)
  routeStore.navigate(`/alerts?${params.toString()}${routeStore.hash}`)
}

const items = ref<IotAlert[]>([])
const target = ref<IotAlert | null>(null)
const note = ref('')
let pollTimer: number | undefined

function loadAlerts() {
  void iotApi.alerts().then((rows) => { items.value = rows }).catch((e: Error) => message.error(e.message))
}

function openHandle(a: IotAlert) {
  target.value = a
  note.value = ''
}

async function handleAlert() {
  if (!target.value) return
  try {
    await iotApi.handleAlert(target.value.id, note.value, target.value.status === 'pending' ? 'handling' : 'resolved')
    target.value = null
    message.success('处置状态已保存并回读')
    loadAlerts()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '处置失败')
  }
}

// 告警规则工作台状态
const ruleView = ref<AlertRuleView | null>(null)
const ruleOptions = ref<AlertRuleOptions | null>(null)
const risks = ref<RiskReading[]>([])
const ruleLoading = ref(false)
const draftKeyword = ref('')
const draftLevel = ref<string | undefined>()
const keyword = ref('')
const levelFilter = ref<string | undefined>()
const trialMetric = ref('temperature')
const trialValue = ref('35')
const trial = ref<AlertJudgement | null>(null)
const ruleModalOpen = ref(false)
const editingRule = ref<AlertRule | null>(null)
const ruleSubmitting = ref(false)
const ruleFormRef = ref<FormInstance>()

const ruleForm = reactive<{
  ruleName: string
  metricKey?: string
  deviceType?: string
  operator: string
  threshold?: number
  durationSeconds: number
  level: string
  remark: string
}>({
  ruleName: '',
  metricKey: undefined,
  deviceType: undefined,
  operator: '>',
  threshold: undefined,
  durationSeconds: 300,
  level: 'major',
  remark: '',
})

const tenantColumns: VueListColumn[] = [
  { key: 'ruleName', prop: 'ruleName', label: '规则', width: 170, ellipsis: true },
  { key: 'condition', label: '条件', width: 190 },
  { key: 'durationSeconds', prop: 'durationSeconds', label: '持续', width: 100, align: 'right' },
  { key: 'level', prop: 'level', label: '等级', width: 100 },
  { key: 'enabled', prop: 'enabled', label: '状态', width: 100 },
  { key: 'actions', label: '操作', width: 140, align: 'right', fixed: 'right', kind: 'action' },
]

const platformColumns: VueListColumn[] = [
  { key: 'ruleName', prop: 'ruleName', label: '规则', width: 170, ellipsis: true },
  { key: 'condition', label: '条件', width: 170 },
  { key: 'durationSeconds', prop: 'durationSeconds', label: '持续', width: 100, align: 'right' },
  { key: 'level', prop: 'level', label: '等级', width: 100 },
  { key: 'status', label: '状态', width: 160 },
]

function loadRules() {
  ruleLoading.value = true
  void Promise.all([iotApi.alertRuleView(), iotApi.alertRuleOptions(), iotApi.riskReadings()])
    .then(([v, o, r]) => {
      ruleView.value = v
      ruleOptions.value = o
      risks.value = r
    })
    .catch((e: Error) => message.error(e.message))
    .finally(() => { ruleLoading.value = false })
}

watch(tab, (t) => {
  if (t === 'rules' && !ruleView.value) loadRules()
}, { immediate: true })

onMounted(() => {
  loadAlerts()
  pollTimer = window.setInterval(loadAlerts, 30000)
})
onUnmounted(() => {
  if (pollTimer) window.clearInterval(pollTimer)
})

function matchRule(rule: AlertRule): boolean {
  if (levelFilter.value && rule.level !== levelFilter.value) return false
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return true
  return `${rule.ruleName} ${rule.metricName} ${rule.deviceType || ''}`.toLowerCase().includes(kw)
}

const filteredTenant = computed(() => (ruleView.value?.tenant ?? []).filter(matchRule))
const filteredPlatform = computed(() => (ruleView.value?.platform ?? []).filter(matchRule))
const currentMetricOption = computed(() => ruleOptions.value?.metrics.find((m) => m.key === ruleForm.metricKey))

function metricNameOf(key: string): string {
  return ruleOptions.value?.metrics.find((item) => item.key === key)?.name || key
}

function applyRuleFilter() {
  keyword.value = draftKeyword.value
  levelFilter.value = draftLevel.value
}

function resetRuleFilter() {
  draftKeyword.value = ''
  draftLevel.value = undefined
  keyword.value = ''
  levelFilter.value = undefined
}

function openRuleForm(rule: AlertRule | null) {
  editingRule.value = rule
  if (rule) {
    ruleForm.ruleName = rule.ruleName
    ruleForm.metricKey = rule.metricKey
    ruleForm.operator = rule.operator
    ruleForm.threshold = Number(rule.threshold)
    ruleForm.durationSeconds = rule.durationSeconds
    ruleForm.level = rule.level
    ruleForm.deviceType = rule.deviceType || undefined
    ruleForm.remark = rule.remark || ''
  } else {
    ruleForm.ruleName = ''
    ruleForm.metricKey = ruleOptions.value?.metrics?.[0]?.key
    ruleForm.operator = '>'
    ruleForm.threshold = undefined
    ruleForm.durationSeconds = 300
    ruleForm.level = 'major'
    ruleForm.deviceType = undefined
    ruleForm.remark = ''
  }
  ruleModalOpen.value = true
}

async function submitRule() {
  try {
    await ruleFormRef.value?.validate()
    ruleSubmitting.value = true
    if (editingRule.value) await iotApi.updateAlertRule(editingRule.value.id, { ...ruleForm })
    else await iotApi.createAlertRule({ ...ruleForm })
    ruleModalOpen.value = false
    message.success('阈值规则已保存')
    loadRules()
  } catch (e) {
    if (e instanceof Error && e.message) message.error(e.message)
  } finally {
    ruleSubmitting.value = false
  }
}

async function toggleRule(rule: AlertRule) {
  try {
    await iotApi.toggleAlertRule(rule.id)
    loadRules()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '操作失败')
  }
}

function removeRule(rule: AlertRule) {
  Modal.confirm({
    title: `删除阈值规则「${rule.ruleName}」？`,
    content: '删除后该指标回落到平台预置阈值。',
    okText: '确认删除',
    okButtonProps: { danger: true },
    onOk: async () => {
      try {
        await iotApi.deleteAlertRule(rule.id)
        message.success('阈值规则已删除')
        loadRules()
      } catch (e) {
        message.error(e instanceof Error ? e.message : '删除失败')
      }
    },
  })
}

async function runTrial() {
  try {
    trial.value = await iotApi.evaluateAlertRule({ metricKey: trialMetric.value, value: trialValue.value })
  } catch (e) {
    message.error(e instanceof Error ? e.message : '试算失败')
  }
}
</script>
