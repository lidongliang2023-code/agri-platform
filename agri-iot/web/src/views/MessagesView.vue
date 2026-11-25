<template>
  <div class="iot-page">
    <IotPageTitle title="消息中心" desc="告警、设备、场景和 OTA 通知统一收件箱。">
      <template #actions><a-button @click="readAll">全部已读</a-button></template>
    </IotPageTitle>
    <section class="iot-card message-list">
      <button v-for="i in items" :key="i.id" type="button" :class="{ read: i.read }" @click="readOne(i.id)">
        <span>{{ i.type === 'alert' ? '🔔' : i.type === 'device' ? '📱' : i.type === 'scene' ? '🌬️' : '📦' }}</span>
        <div>
          <b>{{ i.title }}<i v-if="!i.read" /></b>
          <p>{{ i.content }}</p>
          <small>{{ i.createdAt }}</small>
        </div>
      </button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import { iotApi } from '../api/iotExperience'
import IotPageTitle from '../components/IotPageTitle.vue'

type IotMessage = Awaited<ReturnType<typeof iotApi.messages>>[number]
const items = ref<IotMessage[]>([])
let timer: number | undefined

function load() {
  void iotApi.messages()
    .then((rows) => {
      items.value = rows
      window.dispatchEvent(new Event('iot-messages-updated'))
    })
    .catch((e: Error) => message.error(e.message))
}

onMounted(() => {
  load()
  timer = window.setInterval(load, 30000)
})
onUnmounted(() => {
  if (timer) window.clearInterval(timer)
})

function readOne(id: number) {
  void iotApi.readMessage(id).then(() => load()).catch((e: Error) => message.error(e.message))
}

async function readAll() {
  try {
    await iotApi.readAll()
    load()
    message.success('已全部标为已读')
  } catch (e) {
    message.error(e instanceof Error ? e.message : '已读保存失败')
  }
}
</script>
