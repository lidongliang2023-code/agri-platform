<template>
  <div class="iot-page device-member-list" aria-label="设备管理">
    <section class="iot-card device-filter-card" aria-label="设备筛选">
      <a-form class="device-filter-grid" layout="vertical">
        <a-form-item label="设备名称或编码">
          <a-input v-model:value="keyword" allow-clear placeholder="输入设备名称或编码" @pressEnter="loadDevices">
            <template #prefix><SearchOutlined /></template>
          </a-input>
        </a-form-item>
        <a-form-item label="设备状态">
          <a-select v-model:value="status" :options="statusFilterOptions" />
        </a-form-item>
        <a-form-item label="设备分组">
          <a-select
            v-model:value="group"
            allow-clear
            placeholder="全部设备分组"
            :options="groups.map((g) => ({ value: g.id, label: `${g.icon} ${g.name}` }))"
          />
        </a-form-item>
        <a-form-item label="安装地块">
          <a-select
            v-model:value="plotFilter"
            allow-clear
            show-search
            option-filter-prop="label"
            placeholder="全部地块"
            :options="plots.map((plot) => ({ value: plot.id, label: `${plot.plotName} · ${plot.plotCode}` }))"
          />
        </a-form-item>
        <a-space class="device-filter-actions">
          <a-button @click="resetFilters">重置</a-button>
          <a-button type="primary" html-type="button" @click="loadDevices">查询</a-button>
        </a-space>
      </a-form>
      <div v-if="plotLoadError" role="alert">生产地块暂不可用：{{ plotLoadError }}。请刷新后重试，当前绑定不会改变。</div>
    </section>

    <AgriAntdvListTable
      :columns="deviceColumns"
      :data="items"
      row-key="id"
      :loading="loading"
      :client-pagination="true"
      column-settings-storage-key="agri:iot:devices:hidden-columns:v1"
      column-width-storage-key="agri:iot:devices:hidden-columns:v1:widths"
      :locked-column-keys="['device', 'actions']"
      empty-text="当前经营主体还没有登记设备，或筛选条件没有匹配结果。"
      @refresh="loadDevices"
    >
      <template #toolbar-left>
        <a-space wrap>
          <a-button type="primary" @click="openCreate">
            <template #icon><PlusOutlined /></template>
            注册设备
          </a-button>
          <a-popover trigger="click" title="当前筛选结果">
            <template #content>
              <a-space direction="vertical">
                <span>当前设备 {{ items.length }} 台</span>
                <span>在线 {{ onlineCount }} 台</span>
                <span>异常 / 离线 {{ offlineCount }} 台</span>
                <span>远程可控 {{ controllableCount }} 台</span>
              </a-space>
            </template>
            <a-button>设备统计</a-button>
          </a-popover>
        </a-space>
      </template>

      <template #cell-device="{ record }">
        <button type="button" class="entity-link" @click="openDetail(Number(record.id))">
          <span>{{ typeIcon(String(record.typeName || '')) }}</span>
          <div>
            <b>{{ record.deviceName }}</b>
            <small>{{ record.deviceCode }}</small>
          </div>
        </button>
      </template>

      <template #cell-protocol="{ record }">
        <div class="entity-copy">
          <b>{{ record.typeName }}</b>
          <small>{{ record.protocol }} · {{ record.controlCapable ? '支持远程控制' : '仅数据采集' }}</small>
        </div>
      </template>

      <template #cell-location="{ record }">
        <div class="entity-copy">
          <b>{{ farmNameOf(Number(record.farmId)) }}</b>
          <small>{{ locationSubtitle(record) }}</small>
        </div>
      </template>

      <template #cell-group="{ record }">
        {{ groupNameOf(record.groupId as number | null) }}
      </template>

      <template #cell-status="{ record }">
        <div class="device-state">
          <IotStatus :value="String(record.onlineStatus || '')" />
          <small>{{ record.onlineStatus === 'offline' ? record.lastReport : '实时在线' }}</small>
        </div>
      </template>

      <template #cell-quality="{ record }">
        <div class="device-health">
          <span>信号 {{ record.rssi == null ? '—' : `${record.rssi} dBm` }}</span>
          <div>
            <a-progress
              :percent="Number(record.battery || 0)"
              size="small"
              :show-info="false"
              :stroke-color="Number(record.battery || 0) < 30 ? '#c54b4b' : '#159a5e'"
            />
            <small>电量 {{ record.battery }}%</small>
          </div>
        </div>
      </template>

      <template #cell-actions="{ record }">
        <a-button type="link" @click="openDetail(Number(record.id))">
          {{ record.controlCapable ? '详情与控制' : '查看详情' }}
        </a-button>
      </template>
    </AgriAntdvListTable>

    <a-modal
      :open="bindingOpen"
      title="维护地块绑定"
      :confirm-loading="bindingSaving"
      ok-text="保存绑定"
      cancel-text="取消"
      :mask-closable="!bindingSaving"
      :closable="!bindingSaving"
      :cancel-button-props="{ disabled: bindingSaving }"
      destroy-on-close
      @ok="saveBinding"
      @cancel="() => { if (!bindingSaving) bindingOpen = false }"
    >
      <p>设备：{{ detail?.deviceName }}（{{ detail?.deviceCode }}）</p>
      <p>所属农场：{{ detail ? farmNameOf(detail.farmId) : '' }}</p>
      <a-form layout="vertical">
        <a-form-item label="安装地块" extra="只允许选择设备所在农场的启用地块。清空后保存即解除绑定。">
          <a-select
            :value="bindingPlotId ?? undefined"
            style="width: 100%"
            allow-clear
            show-search
            option-filter-prop="label"
            placeholder="未绑定地块"
            :disabled="bindingSaving"
            :options="bindingPlotOptions"
            @change="(val: unknown) => { bindingPlotId = val == null ? null : Number(val) }"
          />
        </a-form-item>
      </a-form>
      <small>保存后设备列表及地块监测按新关联实时查询；不迁移设备历史数据，不向硬件下发指令。</small>
    </a-modal>

    <a-modal
      :open="Boolean(detail)"
      title="设备详情"
      :width="780"
      @cancel="closeDetail"
    >
      <template #footer>
        <a-button @click="closeDetail">关闭</a-button>
      </template>
      <div v-if="detail" class="device-detail">
        <div class="device-hero">
          <span>{{ typeIcon(detail.typeName) }}</span>
          <div>
            <IotStatus :value="detail.onlineStatus" />
            <h2>{{ detail.deviceName }}</h2>
            <p>{{ detail.deviceCode }} · {{ detail.typeName }} · {{ detail.protocol }}</p>
          </div>
          <div>
            <small>固件</small>
            <b>{{ detail.firmwareVersion }}</b>
            <small>最近上报</small>
            <b>{{ detail.lastReport }}</b>
          </div>
        </div>
        <section class="iot-card" style="padding: 12px; margin-bottom: 12px">
          <div class="iot-actions" style="justify-content: space-between">
            <b>生产地块关联</b>
            <a-button :loading="bindingLoading" @click="openBinding">维护地块绑定</a-button>
          </div>
          <p>所属农场：{{ farmNameOf(detail.farmId) }}</p>
          <p>安装地块：{{ detail.plotId === null ? '未绑定地块' : plotNameOf(detail.plotId) }}</p>
          <small>地块档案由生产管理维护；这里只维护设备关联，不修改网关、设备坐标或历史采样。</small>
        </section>
        <DeviceSampling :key="`s-${detail.id}`" :device-id="detail.id" :load="iotApi.sampling" :save="iotApi.saveSampling" />
        <div v-if="detail.telemetry?.length" class="telemetry-grid">
          <div v-for="t in detail.telemetry" :key="t.key">
            <small>{{ t.name }}</small>
            <b>{{ t.value }}<em>{{ t.unit }}</em></b>
            <span>{{ t.recordedAt }}</span>
          </div>
        </div>
        <div v-else class="device-empty-state">
          <span>📡</span>
          <div>
            <b>等待首次数据上报</b>
            <small>设备已注册，收到有效采样后将在此展示遥测数据；接入状态以实际设备上报为准。</small>
          </div>
        </div>
        <DeviceRemoteControl :key="`c-${detail.id}`" :device="detail" />
      </div>
    </a-modal>

    <a-modal
      :open="addOpen"
      title="注册新设备"
      :width="820"
      :mask-closable="false"
      @cancel="addOpen = false"
    >
      <template #footer>
        <a-button @click="addOpen = false">取消</a-button>
        <a-button type="primary" :loading="registering" @click="createDevice">
          <template #icon><PlusOutlined /></template>
          确认注册
        </a-button>
      </template>
      <a-form ref="createFormRef" :model="createForm" layout="vertical">
        <div class="register-intro">
          <span>📡</span>
          <div>
            <b>建立设备数字身份</b>
            <small>设备注册后初始为离线状态，首次数据上报时自动转为在线。</small>
          </div>
        </div>
        <div class="register-section-title"><b>01 设备身份</b><span>编码用于平台唯一识别，请与设备铭牌保持一致</span></div>
        <div class="form-grid">
          <a-form-item
            label="设备编码"
            name="deviceCode"
            :rules="[
              { required: true, whitespace: true, message: '请输入设备编码' },
              { pattern: /^[A-Za-z0-9][A-Za-z0-9_-]{2,59}$/, message: '编码需为 3-60 位字母、数字、横线或下划线' },
            ]"
          >
            <a-input v-model:value="createForm.deviceCode" :maxlength="60" placeholder="例如 DEV-TEM-101" @blur="createForm.deviceCode = createForm.deviceCode.trim().toUpperCase()" />
          </a-form-item>
          <a-form-item label="设备名称" name="deviceName" :rules="[{ required: true, whitespace: true, message: '请输入设备名称' }]">
            <a-input v-model:value="createForm.deviceName" :maxlength="160" placeholder="例如 3号棚东侧温湿度传感器" />
          </a-form-item>
        </div>
        <div class="form-grid">
          <a-form-item label="设备类型" name="typeId" :rules="[{ required: true, message: '请选择设备类型' }]">
            <a-select
              v-model:value="createForm.typeId"
              show-search
              option-filter-prop="label"
              placeholder="选择设备类型"
              :options="deviceTypes.map((item) => ({ value: item.id, label: `${item.icon} ${item.name} · ${item.protocol}` }))"
              @change="onSelectType"
            />
          </a-form-item>
          <a-form-item label="初始固件版本" name="firmwareVersion">
            <a-input v-model:value="createForm.firmwareVersion" :maxlength="40" placeholder="例如 v1.0.0" />
          </a-form-item>
        </div>
        <div v-if="selectedType" class="device-type-summary">
          <span>{{ selectedType.icon }}</span>
          <div>
            <b>{{ selectedType.name }}</b>
            <small>{{ selectedType.category }} · {{ selectedType.protocol }} · {{ selectedType.manufacturer || '未配置厂商' }} · {{ selectedType.model || '通用型号' }}</small>
          </div>
          <div class="property-tags"><a-tag v-for="property in selectedType.properties.slice(0, 4)" :key="property">{{ property }}</a-tag></div>
        </div>

        <div class="register-section-title"><b>02 接入拓扑</b><span>农场、租户和地块均来自生产管理当前登录租户</span></div>
        <div class="form-grid">
          <a-form-item label="生产农场" name="farmId" :rules="[{ required: true, message: '请选择生产农场' }]">
            <a-select
              v-model:value="createForm.farmId"
              show-search
              option-filter-prop="label"
              placeholder="选择生产管理农场"
              :options="farms.map((farm) => ({ value: farm.id, label: `${farm.farmName} · ${farm.farmCode}` }))"
              @change="onSelectFarm"
            />
          </a-form-item>
          <a-form-item label="归属租户">
            <div class="source-readonly">{{ selectedFarm ? `租户 ${selectedFarm.tenantId} · 生产管理统一租户` : '选择农场后自动带出' }}</div>
          </a-form-item>
          <a-form-item label="安装地块" name="plotId" :help="plotLoadError ? '生产地块加载失败，请刷新后重试' : undefined" :validate-status="plotLoadError ? 'error' : undefined">
            <a-select
              v-model:value="createForm.plotId"
              :disabled="Boolean(plotLoadError)"
              allow-clear
              show-search
              option-filter-prop="label"
              :placeholder="selectedFarmPlots.length ? '选择该农场下的生产地块' : '该农场暂无地块，可不绑定'"
              :options="selectedFarmPlots.map((plot) => ({ value: plot.id, label: `${plot.plotName} · ${plot.plotCode} · ${plot.cropName}` }))"
            />
          </a-form-item>
          <a-form-item label="接入网关" name="gatewayId" :rules="[{ required: true, message: '请选择接入网关' }]">
            <a-select
              v-model:value="createForm.gatewayId"
              show-search
              option-filter-prop="label"
              :placeholder="selectedFarmGateways.length ? '选择该农场下的边缘网关' : '该农场暂无可用网关，请先在网关管理中接入'"
              :options="selectedFarmGateways.map((gateway) => ({ value: gateway.id, label: `${gateway.gatewayName} · ${gateway.gatewayCode} · ${gateway.protocol}` }))"
            />
          </a-form-item>
          <a-form-item label="设备分组" name="groupId" :rules="[{ required: true, message: '请选择设备分组' }]">
            <a-select
              v-model:value="createForm.groupId"
              placeholder="选择运营分组"
              :options="groups.map((item) => ({ value: item.id, label: `${item.icon} ${item.name}` }))"
            />
          </a-form-item>
          <a-form-item label="支持远程控制" name="controlCapable">
            <a-switch v-model:checked="createForm.controlCapable" checked-children="支持" un-checked-children="不支持" />
          </a-form-item>
        </div>

        <div class="register-section-title"><b>03 扩展配置</b><span>使用 JSON 保存上报频率、通道或采集策略</span></div>
        <div class="form-grid">
          <a-form-item label="采样周期（秒）" name="reportInterval" :rules="[{ required: true, message: '请输入采样周期' }]">
            <a-input-number v-model:value="createForm.reportInterval" :min="1" :max="86400" :precision="0" style="width: 100%" />
          </a-form-item>
          <a-form-item label="允许延迟（秒）" name="samplingToleranceSeconds" :rules="[{ required: true, message: '请输入允许延迟' }]">
            <a-input-number v-model:value="createForm.samplingToleranceSeconds" :min="0" :max="86400" :precision="0" style="width: 100%" />
          </a-form-item>
        </div>
        <p>按每个告警指标的实际采样频率配置；平台保存不代表已下发硬件。</p>
        <a-form-item label="设备配置 JSON" name="config" extra='示例：{"channel":1}；采样相关参数以上方字段为准'>
          <a-textarea v-model:value="createForm.config" :rows="4" class="mono-input" />
        </a-form-item>
        <div class="register-note">注册会校验设备编码唯一性、设备类型、网关和分组有效性，并同步更新网关及分组设备数量。</div>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { message, type FormInstance } from 'ant-design-vue'
import { AgriAntdvListTable } from '@agri/shared/vue/antdv'
import type { VueListColumn } from '@agri/shared/vue/list'
import DeviceSampling from '../../../shared-ui/vue/DeviceSampling.vue'
import DeviceRemoteControl from '../components/DeviceRemoteControl.vue'
import IotStatus from '../components/IotStatus.vue'
import { useIotRouteStore } from '../stores/iotRoute'
import {
  iotApi,
  STATUS,
  type IotDevice,
  type IotDeviceType,
  type IotGateway,
  type IotGroup,
  type IotPlot,
  type IotProductionFarm,
} from '../api/iotExperience'

const routeStore = useIotRouteStore()

const items = ref<IotDevice[]>([])
const groups = ref<IotGroup[]>([])
const gateways = ref<IotGateway[]>([])
const deviceTypes = ref<IotDeviceType[]>([])
const plots = ref<IotPlot[]>([])
const farms = ref<IotProductionFarm[]>([])

const keyword = ref(routeStore.searchParams.get('keyword') || '')
const status = ref('all')
const group = ref<number | undefined>()
const plotFilter = ref<number | undefined>(Number(routeStore.searchParams.get('plotId')) || undefined)

const detail = ref<IotDevice | null>(null)
const addOpen = ref(false)
const bindingOpen = ref(false)
const bindingSaving = ref(false)
const bindingLoading = ref(false)
const bindingPlotId = ref<number | null>(null)
const plotLoadError = ref('')
const loading = ref(false)
const registering = ref(false)
const createFormRef = ref<FormInstance>()

const createForm = reactive<{
  deviceCode: string
  deviceName: string
  typeId?: number
  farmId?: number
  plotId?: number
  gatewayId?: number
  groupId?: number
  controlCapable: boolean
  firmwareVersion: string
  config: string
  reportInterval: number
  samplingToleranceSeconds: number
}>({
  deviceCode: '',
  deviceName: '',
  typeId: undefined,
  farmId: undefined,
  plotId: undefined,
  gatewayId: undefined,
  groupId: undefined,
  controlCapable: false,
  firmwareVersion: 'v1.0.0',
  config: '{}',
  reportInterval: 30,
  samplingToleranceSeconds: 5,
})

const statusFilterOptions = ['all', 'online', 'offline', 'alert'].map((v) => ({
  value: v,
  label: STATUS[v]?.label || '全部状态',
}))

const deviceColumns: VueListColumn[] = [
  { key: 'device', prop: 'deviceName', label: '设备', width: 185 },
  { key: 'protocol', label: '类型 / 协议', width: 155 },
  { key: 'location', label: '安装位置', width: 180 },
  { key: 'group', label: '设备分组', width: 110 },
  { key: 'status', prop: 'onlineStatus', label: '状态', width: 125 },
  { key: 'quality', label: '连接质量', width: 130, align: 'right' },
  { key: 'actions', label: '操作', width: 118, align: 'right', fixed: 'right', kind: 'action' },
]

const onlineCount = computed(() => items.value.filter((item) => item.onlineStatus === 'online').length)
const offlineCount = computed(() => items.value.filter((item) => item.onlineStatus !== 'online').length)
const controllableCount = computed(() => items.value.filter((item) => item.controlCapable).length)
const selectedType = computed(() => deviceTypes.value.find((item) => item.id === createForm.typeId))
const selectedFarm = computed(() => farms.value.find((item) => item.id === createForm.farmId))
const selectedFarmGateways = computed(() => gateways.value.filter((item) => item.farmId === createForm.farmId))
const selectedFarmPlots = computed(() => plots.value.filter((plot) => plot.farmId === createForm.farmId && plot.productionStatus !== 0))
const bindingPlotOptions = computed(() =>
  plots.value
    .filter((plot) => plot.farmId === detail.value?.farmId && plot.productionStatus !== 0)
    .map((plot) => ({ value: plot.id, label: `${plot.plotName} · ${plot.plotCode}` })),
)

function typeIcon(name: string): string {
  return name.includes('温湿度') ? '🌡️' : name.includes('土壤') ? '🌱' : name.includes('阀') ? '💧' : name.includes('摄像头') ? '📹' : name.includes('风机') ? '🌀' : '📱'
}

function farmNameOf(farmId: number): string {
  return farms.value.find((item) => item.id === farmId)?.farmName || `农场 #${farmId}`
}

function plotNameOf(plotId: number): string {
  return plots.value.find((item) => item.id === plotId)?.plotName || `地块 #${plotId}（暂未取得档案）`
}

function groupNameOf(groupId: number | null | undefined): string {
  return groups.value.find((item) => item.id === groupId)?.name || '未分组'
}

function locationSubtitle(record: Record<string, unknown>): string {
  const plot = plots.value.find((item) => item.id === record.plotId)
  const gateway = gateways.value.find((item) => item.id === record.gatewayId)
  return plot
    ? `${plot.plotName} · ${gateway?.gatewayName || '未绑定网关'}`
    : `未绑定地块 · ${gateway?.gatewayName || '未绑定网关'}`
}

async function loadDevices() {
  loading.value = true
  try {
    items.value = await iotApi.devices({
      keyword: keyword.value.trim() || undefined,
      status: status.value === 'all' ? undefined : status.value,
      groupId: group.value,
      plotId: plotFilter.value,
    })
  } catch (error) {
    message.error(error instanceof Error ? error.message : '设备列表加载失败')
  } finally {
    loading.value = false
  }
}

async function loadOptions() {
  const [groupRows, gatewayRows, typeRows, farmRows] = await Promise.all([
    iotApi.groups(),
    iotApi.gateways(),
    iotApi.deviceTypes(),
    iotApi.farms(),
  ])
  groups.value = groupRows
  gateways.value = gatewayRows
  deviceTypes.value = typeRows
  farms.value = farmRows
  try {
    plots.value = await iotApi.plots()
    plotLoadError.value = ''
  } catch (error) {
    plotLoadError.value = error instanceof Error ? error.message : '生产地块加载失败'
  }
  return { groupRows, gatewayRows, typeRows, farmRows }
}

watch([status, group, plotFilter], () => {
  void loadDevices()
}, { immediate: true })

onMounted(() => {
  void loadOptions().catch((error: Error) => message.error(error.message))
})

function openDetail(id: number) {
  void iotApi.device(id).then((d) => { detail.value = d }).catch((e: Error) => message.error(e.message))
}

function closeDetail() {
  bindingOpen.value = false
  detail.value = null
}

async function openBinding() {
  if (!detail.value) return
  bindingPlotId.value = detail.value.plotId
  bindingLoading.value = true
  try {
    plots.value = await iotApi.plots()
    plotLoadError.value = ''
    bindingOpen.value = true
  } catch (error) {
    plotLoadError.value = error instanceof Error ? error.message : '生产地块加载失败'
    message.error('生产地块加载失败，未打开绑定表单，请刷新后重试')
  } finally {
    bindingLoading.value = false
  }
}

async function saveBinding() {
  if (!detail.value) return
  if (
    bindingPlotId.value !== null &&
    !plots.value.some((plot) => plot.id === bindingPlotId.value && plot.farmId === detail.value?.farmId && plot.productionStatus !== 0)
  ) {
    message.error('请选择设备所在农场的启用地块，或清空以解除绑定')
    return
  }
  bindingSaving.value = true
  try {
    const updated = await iotApi.updateDevice(detail.value.id, { plotId: bindingPlotId.value })
    if (detail.value.id === updated.id) detail.value = { ...detail.value, ...updated }
    bindingOpen.value = false
    message.success(bindingPlotId.value === null ? '已解除地块绑定' : '地块绑定已保存')
    await loadDevices()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存地块绑定失败')
  } finally {
    bindingSaving.value = false
  }
}

async function openCreate() {
  try {
    const options = await loadOptions()
    const defaultFarm =
      options.farmRows.find((farm) => options.gatewayRows.some((gateway) => gateway.farmId === farm.id)) ??
      options.farmRows[0]
    const defaultGateway =
      options.gatewayRows.find((gateway) => gateway.farmId === defaultFarm?.id && gateway.onlineStatus === 'online') ??
      options.gatewayRows.find((gateway) => gateway.farmId === defaultFarm?.id)
    createForm.deviceCode = ''
    createForm.deviceName = ''
    createForm.typeId = options.typeRows[0]?.id
    createForm.farmId = defaultFarm?.id
    createForm.plotId = undefined
    createForm.groupId = options.groupRows.find((item) => item.isDefault)?.id ?? options.groupRows[0]?.id
    createForm.gatewayId = defaultGateway?.id
    createForm.controlCapable = options.typeRows[0]?.category?.includes('控制') ?? false
    createForm.firmwareVersion = 'v1.0.0'
    createForm.config = '{}'
    createForm.reportInterval = 30
    createForm.samplingToleranceSeconds = 5
    addOpen.value = true
  } catch (error) {
    message.error(error instanceof Error ? error.message : '注册选项加载失败')
  }
}

function onSelectType(typeId: unknown) {
  const type = deviceTypes.value.find((item) => item.id === Number(typeId))
  createForm.controlCapable = type?.category?.includes('控制') ?? false
}

function onSelectFarm(farmId: unknown) {
  const id = Number(farmId)
  const gateway =
    gateways.value.find((item) => item.farmId === id && item.onlineStatus === 'online') ??
    gateways.value.find((item) => item.farmId === id)
  createForm.gatewayId = gateway?.id
  createForm.plotId = undefined
}

async function createDevice() {
  try {
    await createFormRef.value?.validate()
    const parsedConfig = JSON.parse(createForm.config || '{}')
    if (!parsedConfig || typeof parsedConfig !== 'object' || Array.isArray(parsedConfig)) {
      throw new Error('设备扩展配置必须是有效的 JSON 对象')
    }
    const plot = plots.value.find((item) => item.id === createForm.plotId)
    registering.value = true
    const created = await iotApi.createDevice({
      ...createForm,
      config: JSON.stringify({
        ...parsedConfig,
        reportInterval: createForm.reportInterval,
        samplingToleranceSeconds: createForm.samplingToleranceSeconds,
      }),
      deviceCode: createForm.deviceCode.trim().toUpperCase(),
      deviceName: createForm.deviceName.trim(),
      latitude: plot?.latitude,
      longitude: plot?.longitude,
    })
    addOpen.value = false
    detail.value = created
    message.success(`设备 ${created.deviceCode} 注册成功，等待首次上报`)
    await loadDevices()
    await loadOptions()
  } catch (e) {
    if (e instanceof Error) message.error(e.message)
  } finally {
    registering.value = false
  }
}

async function resetFilters() {
  keyword.value = ''
  status.value = 'all'
  group.value = undefined
  plotFilter.value = undefined
  routeStore.navigate('/devices', { replace: true })
  await loadDevices()
}
</script>
