<template>
  <div v-if="!data" class="iot-loading"><i /><i /><i /></div>
  <div v-else class="iot-page">
    <IotPageTitle title="数据分析" desc="按当前经营主体统计遥测采集量、设备在线率、告警与控制指令。">
      <template #actions><a-button @click="exportReport">导出报表</a-button></template>
    </IotPageTitle>

    <div class="iot-metrics">
      <div class="iot-metric tone-blue"><span><BarChartOutlined /></span><div><small>遥测读数</small><b>{{ data.summary.dataPoints.toLocaleString() }}</b><em>设备累计上报条数</em></div></div>
      <div class="iot-metric tone-green"><span><CloudServerOutlined /></span><div><small>设备在线率</small><b>{{ data.summary.onlineRate }}%</b><em>当前设备运行状态</em></div></div>
      <div class="iot-metric tone-red"><span><AlertOutlined /></span><div><small>累计告警</small><b>{{ data.summary.alerts }}</b><em>本主体设备告警事件</em></div></div>
      <div class="iot-metric tone-amber"><span><ThunderboltOutlined /></span><div><small>控制指令</small><b>{{ data.summary.controls }}</b><em>远程控制下发次数</em></div></div>
    </div>

    <div class="iot-two-grid">
      <section class="iot-card">
        <div class="iot-card-head"><div><b>数据采集趋势</b><small>最近 7 个有读数的日期</small></div></div>
        <IotEmptyHint v-if="data.daily.length === 0" title="还没有遥测读数" desc="设备接入并上报后，这里会按日期展示当前主体的采集量与控制指令趋势。" />
        <div v-else class="analytics-bars">
          <div v-for="d in data.daily" :key="d.date">
            <i :style="{ height: `${(d.data / maxData) * 100}%` }" />
            <span>{{ d.date }}</span>
            <b>{{ d.data }}</b>
          </div>
        </div>
      </section>
      <section class="iot-card">
        <div class="iot-card-head"><div><b>设备数据量排行</b><small>Top 6</small></div></div>
        <div class="rank-list">
          <div v-for="(r, i) in data.rank" :key="r.name">
            <span>{{ i + 1 }}</span>
            <div><b>{{ r.name }}</b><small>{{ r.type }}</small></div>
            <em>{{ r.readings }} 条</em>
          </div>
        </div>
      </section>
    </div>

    <section class="iot-card">
      <div class="iot-card-head"><div><b>控制指令趋势</b><small>最近 7 个有读数的日期</small></div></div>
      <div class="water-list">
        <div v-for="d in data.daily" :key="d.date">
          <span>{{ d.date }}</span>
          <div><i :style="{ width: `${(d.control / maxControl) * 100}%` }" /></div>
          <b>{{ d.control }} 条</b>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { AlertOutlined, BarChartOutlined, CloudServerOutlined, ThunderboltOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { iotApi } from '../api/iotExperience'
import { downloadCsv, stampFilename } from '../../../shared-ui/exportCsv'
import IotEmptyHint from '../components/IotEmptyHint.vue'
import IotPageTitle from '../components/IotPageTitle.vue'

type ReportData = Awaited<ReturnType<typeof iotApi.reports>>
const data = ref<ReportData | null>(null)
const maxData = computed(() => Math.max(...(data.value?.daily.map((d) => d.data) ?? []), 1))
const maxControl = computed(() => Math.max(...(data.value?.daily.map((d) => d.control) ?? []), 1))

onMounted(() => {
  void iotApi.reports().then((res) => { data.value = res }).catch((e: Error) => message.error(e.message))
})

function exportReport() {
  if (!data.value) return
  const count = downloadCsv(
    stampFilename('物联网数据报表'),
    [
      { key: 'date', title: '日期' },
      { key: 'data', title: '遥测读数' },
      { key: 'control', title: '控制指令' },
    ],
    data.value.daily.map((item) => ({ date: item.date, data: item.data, control: item.control })),
  )
  message.success(`已导出 ${count} 行报表数据`)
}
</script>
