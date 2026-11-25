<template>
  <div class="iot-page">
    <a-modal
      :open="Boolean(receiptGateway)"
      title="网关重启与OTA升级回执"
      :footer="null"
      :width="1200"
      @cancel="receiptGateway = null"
    >
      <template v-if="receiptGateway">
        <h3>重启回执</h3>
        <CommandReceipts :key="`restart-${receiptGateway.id}`" :device-id="receiptGateway.id" :load="iotApi.gatewayCommandReceipts" />
        <h3>OTA升级回执（动作列为目标版本）</h3>
        <CommandReceipts :key="`ota-${receiptGateway.id}`" :device-id="receiptGateway.id" :load="iotApi.otaReceipts" />
      </template>
    </a-modal>

    <IotPageTitle title="边缘网关" desc="生产农场网关接入、状态监控、设备挂载与远程运维。">
      <template #actions>
        <a-button :loading="loading" @click="load"><template #icon><ReloadOutlined /></template>刷新</a-button>
        <a-button type="primary" @click="openCreate"><template #icon><PlusOutlined /></template>新增网关</a-button>
      </template>
    </IotPageTitle>

    <div class="gateway-summary">
      <div><span class="tone-green"><CloudServerOutlined /></span><small>网关总数</small><b>{{ items.length }}</b><em>生产租户范围</em></div>
      <div><span class="tone-blue"><ApiOutlined /></span><small>在线网关</small><b>{{ onlineGatewayCount }}</b><em>正在提供服务</em></div>
      <div><span class="tone-red"><AlertOutlined /></span><small>离线 / 异常</small><b>{{ offlineGatewayCount }}</b><em>需要巡检</em></div>
      <div><span class="tone-orange"><CloudServerOutlined /></span><small>挂载设备</small><b>{{ totalMountCount }}</b><em>在线 {{ onlineMountCount }} 台</em></div>
    </div>

    <section class="iot-card iot-filter">
      <div class="iot-filter-main">
        <a-input v-model:value="keyword" allow-clear placeholder="网关名称、编码、IP 或农场">
          <template #prefix><SearchOutlined /></template>
        </a-input>
        <a-select v-model:value="status" :options="statusOptions" />
        <a-select
          v-model:value="farmFilter"
          allow-clear
          show-search
          option-filter-prop="label"
          placeholder="全部生产农场"
          :options="farms.map((farm) => ({ value: farm.id, label: `${farm.farmName} · ${farm.farmCode}` }))"
        />
        <a-button @click="resetFilter">重置</a-button>
      </div>
      <span class="filter-result">共 {{ filteredItems.length }} 个网关</span>
    </section>

    <div class="gateway-grid">
      <section v-for="g in filteredItems" :key="g.id" class="iot-card gateway-card">
        <div class="iot-card-head">
          <div><b>{{ g.gatewayName }}</b><small>{{ g.gatewayCode }} · {{ g.model || '通用型号' }}</small></div>
          <IotStatus :value="g.onlineStatus" />
        </div>
        <div class="gateway-farm">
          <span>🌾</span>
          <div><b>{{ g.farmName || `农场 #${g.farmId}` }}</b><small>{{ g.farmCode || '生产管理农场' }} · 租户 {{ g.tenantId || '—' }}</small></div>
        </div>
        <div class="gateway-stats">
          <span><small>挂载设备</small><b>{{ g.onlineCount }}/{{ g.totalCount }}</b></span>
          <span><small>协议</small><b>{{ g.protocol || '—' }}</b></span>
          <span><small>固件</small><b>{{ g.firmwareVersion || '—' }}</b></span>
        </div>
        <div class="gateway-resource">
          <small>CPU {{ g.cpuRate }}%</small>
          <a-progress :percent="Number(g.cpuRate)" :show-info="false" stroke-color="#159a5e" />
          <small>内存 {{ g.memoryRate }}%</small>
          <a-progress :percent="Number(g.memoryRate)" :show-info="false" stroke-color="#176c93" />
        </div>
        <footer>
          <span>{{ g.ipAddress || '未配置 IP' }} · {{ g.lastOnline || '等待首次上报' }}</span>
          <div>
            <a-button size="small" @click="openDetail(g.id)">详情</a-button>
            <a-button size="small" type="text" @click="openEdit(g)"><template #icon><EditOutlined /></template></a-button>
            <a-button size="small" @click="receiptGateway = g">重启/升级回执</a-button>
            <a-button size="small" type="text" @click="restart(g)"><template #icon><ReloadOutlined /></template></a-button>
            <a-button size="small" type="text" danger @click="remove(g)"><template #icon><DeleteOutlined /></template></a-button>
          </div>
        </footer>
      </section>
      <div v-if="!filteredItems.length" class="gateway-empty">
        <span>🛰️</span>
        <b>没有符合条件的边缘网关</b>
        <small>可调整筛选条件，或先在当前生产农场新增网关。</small>
        <a-button type="primary" @click="openCreate"><template #icon><PlusOutlined /></template>新增网关</a-button>
      </div>
    </div>

    <a-modal :open="Boolean(detail)" title="网关详情" :width="700" @cancel="detail = null">
      <template #footer><a-button @click="detail = null">关闭</a-button></template>
      <template v-if="detail">
        <div class="gateway-detail-hero">
          <span><CloudServerOutlined /></span>
          <div>
            <IotStatus :value="detail.onlineStatus" />
            <h2>{{ detail.gatewayName }}</h2>
            <p>{{ detail.gatewayCode }} · {{ detail.model }} · {{ detail.protocol }}</p>
          </div>
          <div>
            <small>生产农场</small><b>{{ detail.farmName }}</b>
            <small>生产租户</small><b>{{ detail.tenantId || '—' }}</b>
          </div>
        </div>
        <div class="kv-grid gateway-kv-grid">
          <span><small>IP 地址</small><b>{{ detail.ipAddress || '未配置' }}</b></span>
          <span><small>在线设备</small><b>{{ detail.onlineCount }}/{{ detail.totalCount }}</b></span>
          <span><small>固件版本</small><b>{{ detail.firmwareVersion }}</b></span>
          <span><small>最近在线</small><b>{{ detail.lastOnline }}</b></span>
        </div>
        <div class="gateway-detail-resource">
          <div><small>CPU 使用率</small><a-progress :percent="Number(detail.cpuRate)" stroke-color="#159a5e" /></div>
          <div><small>内存使用率</small><a-progress :percent="Number(detail.memoryRate)" stroke-color="#176c93" /></div>
        </div>
        <div class="gateway-device-title"><b>挂载设备</b><span>{{ detail.devices.length }} 台</span></div>
        <div class="modal-list">
          <template v-if="detail.devices.length">
            <div v-for="d in detail.devices" :key="d.id">
              <span>{{ typeIcon(d.typeName) }}</span>
              <div><b>{{ d.deviceName }}</b><small>{{ d.deviceCode }}</small></div>
              <IotStatus :value="d.onlineStatus" />
            </div>
          </template>
          <div v-else class="gateway-detail-empty">
            <span>📡</span><div><b>暂无挂载设备</b><small>可在设备注册页选择该网关接入设备。</small></div>
          </div>
        </div>
      </template>
    </a-modal>

    <a-modal :open="formOpen" :title="editing ? '编辑边缘网关' : '新增边缘网关'" :width="780" :mask-closable="false" @cancel="formOpen = false">
      <template #footer>
        <a-button @click="formOpen = false">取消</a-button>
        <a-button type="primary" :loading="submitting" @click="submit">
          <template #icon><PlusOutlined /></template>
          {{ editing ? '保存修改' : '确认新增' }}
        </a-button>
      </template>
      <a-form ref="formRef" :model="formState" layout="vertical">
        <div class="register-intro gateway-form-intro">
          <span>🛰️</span>
          <div>
            <b>{{ editing ? '维护网关接入信息' : '接入新的边缘网关' }}</b>
            <small>网关必须归属生产管理当前租户的农场，新增后初始状态为离线。</small>
          </div>
        </div>
        <div class="register-section-title"><b>01 网关身份</b><span>编码、名称与设备型号</span></div>
        <div class="form-grid">
          <a-form-item
            label="网关编码"
            name="gatewayCode"
            :rules="[
              { required: true, whitespace: true, message: '请输入网关编码' },
              { pattern: /^[A-Za-z0-9][A-Za-z0-9_-]{2,49}$/, message: '编码需为 3-50 位字母、数字、横线或下划线' },
            ]"
          >
            <a-input v-model:value="formState.gatewayCode" :maxlength="50" placeholder="例如 GW004" @blur="formState.gatewayCode = formState.gatewayCode.trim().toUpperCase()" />
          </a-form-item>
          <a-form-item label="网关名称" name="gatewayName" :rules="[{ required: true, whitespace: true, message: '请输入网关名称' }]">
            <a-input v-model:value="formState.gatewayName" :maxlength="120" placeholder="例如 4号棚边缘网关" />
          </a-form-item>
          <a-form-item label="设备型号" name="model"><a-input v-model:value="formState.model" :maxlength="80" placeholder="例如 EG-200" /></a-form-item>
          <a-form-item label="固件版本" name="firmwareVersion"><a-input v-model:value="formState.firmwareVersion" :maxlength="40" placeholder="例如 v3.1.0" /></a-form-item>
        </div>
        <div class="register-section-title"><b>02 归属与接入</b><span>农场来自生产管理，租户随农场自动关联</span></div>
        <div class="form-grid">
          <a-form-item label="生产农场" name="farmId" :rules="[{ required: true, message: '请选择生产农场' }]">
            <a-select
              v-model:value="formState.farmId"
              show-search
              option-filter-prop="label"
              :disabled="Boolean(editing && editing.totalCount > 0)"
              placeholder="选择生产农场"
              :options="farms.map((farm) => ({ value: farm.id, label: `${farm.farmName} · ${farm.farmCode} · 租户 ${farm.tenantId}` }))"
            />
          </a-form-item>
          <a-form-item label="接入协议" name="protocol" :rules="[{ required: true, message: '请选择接入协议' }]">
            <a-select v-model:value="formState.protocol" :options="protocolOptions" />
          </a-form-item>
          <a-form-item
            label="IP 地址"
            name="ipAddress"
            :rules="[{ pattern: /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/, message: '请输入有效的 IPv4 地址' }]"
          >
            <a-input v-model:value="formState.ipAddress" placeholder="例如 192.168.1.10" />
          </a-form-item>
        </div>
        <div v-if="editing && editing.totalCount > 0" class="register-note">
          该网关已挂载 {{ editing.totalCount }} 台设备，暂不允许迁移农场；如需迁移，请先调整设备所属网关。
        </div>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { AlertOutlined, ApiOutlined, CloudServerOutlined, DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { Modal, message, type FormInstance } from 'ant-design-vue'
import CommandReceipts from '../../../shared-ui/vue/CommandReceipts.vue'
import IotPageTitle from '../components/IotPageTitle.vue'
import IotStatus from '../components/IotStatus.vue'
import { iotApi, STATUS, type IotDevice, type IotGateway, type IotProductionFarm } from '../api/iotExperience'

const items = ref<IotGateway[]>([])
const farms = ref<IotProductionFarm[]>([])
const detail = ref<(IotGateway & { devices: IotDevice[] }) | null>(null)
const receiptGateway = ref<IotGateway | null>(null)
const editing = ref<IotGateway | null>(null)
const formOpen = ref(false)
const loading = ref(false)
const submitting = ref(false)
const keyword = ref('')
const status = ref('all')
const farmFilter = ref<number | undefined>()
const formRef = ref<FormInstance>()

const formState = reactive<{
  gatewayCode: string
  gatewayName: string
  farmId?: number
  model: string
  protocol: string
  firmwareVersion: string
  ipAddress: string
}>({
  gatewayCode: '',
  gatewayName: '',
  farmId: undefined,
  model: 'EG-200',
  protocol: 'MQTT',
  firmwareVersion: 'v1.0.0',
  ipAddress: '',
})

const statusOptions = ['all', 'online', 'offline', 'alert'].map((value) => ({
  value,
  label: value === 'all' ? '全部状态' : STATUS[value]?.label || value,
}))
const protocolOptions = ['MQTT', 'LoRa+4G', 'LoRaWAN', 'NB-IoT', '4G', '5G', 'Modbus'].map((value) => ({ value, label: value }))

const onlineGatewayCount = computed(() => items.value.filter((item) => item.onlineStatus === 'online').length)
const offlineGatewayCount = computed(() => items.value.filter((item) => item.onlineStatus !== 'online').length)
const totalMountCount = computed(() => items.value.reduce((sum, item) => sum + item.totalCount, 0))
const onlineMountCount = computed(() => items.value.reduce((sum, item) => sum + item.onlineCount, 0))

const filteredItems = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  return items.value.filter((item) => {
    const matchesKeyword = !query || [item.gatewayName, item.gatewayCode, item.ipAddress, item.farmName].filter(Boolean).some((v) => String(v).toLowerCase().includes(query))
    const matchesStatus = status.value === 'all' || item.onlineStatus === status.value
    const matchesFarm = !farmFilter.value || item.farmId === farmFilter.value
    return matchesKeyword && matchesStatus && matchesFarm
  })
})

function typeIcon(name: string): string {
  return name.includes('温湿度') ? '🌡️' : name.includes('土壤') ? '🌱' : name.includes('阀') ? '💧' : name.includes('摄像头') ? '📹' : name.includes('风机') ? '🌀' : '📱'
}

async function load() {
  loading.value = true
  try {
    const [gatewayRows, farmRows] = await Promise.all([iotApi.gateways(), iotApi.farms()])
    items.value = gatewayRows
    farms.value = farmRows
  } catch (error) {
    message.error(error instanceof Error ? error.message : '边缘网关加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => void load())

function resetFilter() {
  keyword.value = ''
  status.value = 'all'
  farmFilter.value = undefined
}

function openCreate() {
  editing.value = null
  formState.gatewayCode = ''
  formState.gatewayName = ''
  formState.farmId = farms.value.find((farm) => items.value.every((gateway) => gateway.farmId !== farm.id))?.id ?? farms.value[0]?.id
  formState.model = 'EG-200'
  formState.protocol = 'MQTT'
  formState.firmwareVersion = 'v1.0.0'
  formState.ipAddress = ''
  formOpen.value = true
}

function openEdit(gateway: IotGateway) {
  editing.value = gateway
  formState.gatewayCode = gateway.gatewayCode
  formState.gatewayName = gateway.gatewayName
  formState.farmId = gateway.farmId
  formState.model = gateway.model
  formState.protocol = gateway.protocol
  formState.firmwareVersion = gateway.firmwareVersion
  formState.ipAddress = gateway.ipAddress
  formOpen.value = true
}

async function submit() {
  try {
    await formRef.value?.validate()
    submitting.value = true
    const body = {
      ...formState,
      gatewayCode: formState.gatewayCode.trim().toUpperCase(),
      gatewayName: formState.gatewayName.trim(),
    }
    if (editing.value) await iotApi.updateGateway(editing.value.id, body)
    else await iotApi.createGateway(body)
    message.success(editing.value ? '边缘网关已更新' : '边缘网关已创建')
    formOpen.value = false
    await load()
  } catch (error) {
    if (error instanceof Error) message.error(error.message)
  } finally {
    submitting.value = false
  }
}

async function openDetail(id: number) {
  try {
    detail.value = await iotApi.gateway(id)
  } catch (error) {
    message.error(error instanceof Error ? error.message : '网关详情加载失败')
  }
}

function restart(gateway: IotGateway) {
  Modal.confirm({
    title: '重启边缘网关',
    content: `登记「${gateway.gatewayName}」重启申请？当前未接入下发通道，不会执行设备重启。`,
    okText: '确认重启',
    onOk: async () => {
      try {
        await iotApi.restartGateway(gateway.id)
        message.info('重启申请已登记，请查看回执；未确认网关执行')
        await load()
        if (detail.value?.id === gateway.id) await openDetail(gateway.id)
      } catch (error) {
        message.error(error instanceof Error ? error.message : '网关重启失败')
        throw error
      }
    },
  })
}

function remove(gateway: IotGateway) {
  Modal.confirm({
    title: '删除边缘网关',
    content: `确定删除「${gateway.gatewayName}」吗？已挂载设备的网关不能删除。`,
    okText: '删除',
    okButtonProps: { danger: true },
    onOk: async () => {
      try {
        await iotApi.deleteGateway(gateway.id)
        message.success('边缘网关已删除')
        if (detail.value?.id === gateway.id) detail.value = null
        await load()
      } catch (error) {
        message.error(error instanceof Error ? error.message : '网关删除失败')
        throw error
      }
    },
  })
}
</script>
