<template>
  <div class="iot-page">
    <IotPageTitle title="运维与 OTA" desc="设备工单、固件版本和批量升级任务。">
      <template #actions><a-button type="primary" @click="open = true">+ 创建工单</a-button></template>
    </IotPageTitle>

    <div class="iot-two-grid">
      <section class="iot-card">
        <div class="iot-card-head"><div><b>运维工单</b><small>设备故障与预防性维保</small></div></div>
        <div v-for="o in orders" :key="o.id" class="work-order">
          <div class="iot-card-head">
            <div><b>{{ o.deviceName }}</b><small>{{ o.orderNo }} · {{ o.type }}</small></div>
            <IotStatus :value="o.status" />
          </div>
          <p>{{ o.source }} · {{ o.createdAt }}</p>
          <p v-if="o.description">{{ o.description }}</p>
          <footer><span>{{ o.technician }}</span><IotStatus :value="o.priority" /></footer>
        </div>
      </section>
      <section class="iot-card">
        <div class="iot-card-head"><div><b>固件版本</b><small>认证固件清单</small></div></div>
        <div v-for="f in firmware" :key="f.id" class="firmware-row">
          <span>📦</span>
          <div><b>{{ f.productName }}</b><small>{{ f.version }} · {{ f.releaseAt }}</small></div>
          <IotStatus :value="f.status" />
        </div>
      </section>
    </div>

    <section class="iot-card">
      <div class="iot-card-head"><div><b>OTA 升级任务</b><small>灰度、执行与结果</small></div></div>
      <div v-for="t in ota" :key="t.id" class="ota-row">
        <div><b>{{ t.taskNo }}</b><small>{{ t.firmwareVersion }} · 目标 {{ t.targetCount }} 台</small></div>
        <a-progress :percent="t.targetCount ? Math.round((t.successCount / t.targetCount) * 100) : 0" stroke-color="#159a5e" />
        <span>成功 {{ t.successCount }} / 失败 {{ t.failedCount }}</span>
        <IotStatus :value="t.status" />
      </div>
    </section>

    <a-modal v-model:open="open" title="创建运维工单" ok-text="提交工单" @ok="create">
      <a-form ref="formRef" :model="formState" layout="vertical">
        <a-form-item label="报修设备" name="deviceId" :rules="[{ required: true, message: '请选择要报修的设备' }]">
          <a-select
            v-model:value="formState.deviceId"
            show-search
            :virtual="false"
            option-filter-prop="label"
            placeholder="从当前经营主体的设备台账中选择"
            not-found-content="当前主体还没有已注册设备"
            :options="devices.map((device) => ({ value: device.id, label: `${device.deviceName} · ${device.deviceCode}` }))"
          />
        </a-form-item>
        <a-form-item label="问题类型" name="orderType">
          <a-select v-model:value="formState.orderType" :options="orderTypeOptions" />
        </a-form-item>
        <a-form-item label="优先级" name="priority">
          <a-select v-model:value="formState.priority" :options="priorityOptions" />
        </a-form-item>
        <a-form-item label="问题描述" name="description">
          <a-textarea v-model:value="formState.description" :rows="3" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { message, type FormInstance } from 'ant-design-vue'
import { iotApi, type IotDevice } from '../api/iotExperience'
import IotPageTitle from '../components/IotPageTitle.vue'
import IotStatus from '../components/IotStatus.vue'

type WorkOrder = Awaited<ReturnType<typeof iotApi.workOrders>>[number]
type Firmware = Awaited<ReturnType<typeof iotApi.firmware>>[number]
type OtaTask = Awaited<ReturnType<typeof iotApi.ota>>[number]

const orders = ref<WorkOrder[]>([])
const devices = ref<IotDevice[]>([])
const firmware = ref<Firmware[]>([])
const ota = ref<OtaTask[]>([])
const open = ref(false)
const formRef = ref<FormInstance>()

const formState = reactive<{ deviceId?: number; orderType: string; priority: string; description: string }>({
  deviceId: undefined,
  orderType: '设备故障',
  priority: 'normal',
  description: '',
})

const orderTypeOptions = ['设备故障', '供电/通信故障', '预防性维保', '安装调试'].map((v) => ({ value: v, label: v }))
const priorityOptions = [{ value: 'high', label: '高' }, { value: 'normal', label: '普通' }, { value: 'low', label: '低' }]

function load() {
  void Promise.all([iotApi.workOrders(), iotApi.firmware(), iotApi.ota(), iotApi.devices()])
    .then(([o, f, t, d]) => {
      orders.value = o
      firmware.value = f
      ota.value = t
      devices.value = d
    })
    .catch((e: Error) => message.error(e.message))
}

onMounted(load)

async function create() {
  try {
    await formRef.value?.validate()
    await iotApi.createWorkOrder({ ...formState })
    open.value = false
    formState.deviceId = undefined
    formState.description = ''
    message.success('运维工单已创建')
    load()
  } catch (e) {
    if (e instanceof Error) message.error(e.message)
  }
}
</script>
