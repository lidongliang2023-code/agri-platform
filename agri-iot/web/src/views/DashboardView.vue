<template>
  <div>
    <div style="padding: 16px 24px 0">
      <div style="display: flex; gap: 8px">
        <a-button :type="view === 'dashboard' ? 'primary' : 'default'" @click="view = 'dashboard'">生产物联概况</a-button>
        <a-button :type="view === 'monitor' ? 'primary' : 'default'" @click="view = 'monitor'">实时遥测监测</a-button>
      </div>
    </div>

    <div v-if="!data" class="iot-loading"><i /><i /><i /></div>

    <!-- 实时监测大屏 -->
    <div v-else-if="view === 'monitor'" class="monitor-screen">
      <header>
        <div>
          <span>GREENHOUSE LIVE MONITOR</span>
          <h1>{{ data.farm.farmName }} · 物联网实时监测大屏</h1>
          <p>{{ clock.date }} {{ clock.time }} · 读数来自设备最近一次上报</p>
        </div>
        <div>
          <i />
          数据在线
          <a-button @click="loadOverview">刷新</a-button>
        </div>
      </header>
      <div class="monitor-kpis">
        <div>
          <small>在线设备</small>
          <b>{{ data.stats.online }}<em>台</em></b>
          <span>在线率 {{ data.stats.devices ? ((data.stats.online / data.stats.devices) * 100).toFixed(1) : '0.0' }}%</span>
        </div>
        <div>
          <small>环境告警</small>
          <b class="red">{{ data.stats.alerts }}<em>条</em></b>
          <span>优先处置红警</span>
        </div>
        <div>
          <small>今日数据</small>
          <b>{{ data.stats.dataToday.toLocaleString() }}</b>
          <span>遥测数据点</span>
        </div>
        <div>
          <small>控制指令</small>
          <b>{{ data.stats.todayControl }}</b>
          <span>成功率 99.1%</span>
        </div>
      </div>
      <div class="monitor-center">
        <section class="monitor-panel">
          <h3>环境趋势</h3>
          <div class="monitor-chart">
            <div v-for="s in data.series" :key="s.time">
              <span :style="{ height: `${(s.temperature / 35) * 100}%` }" />
              <i :style="{ height: `${s.humidity}%` }" />
              <em :style="{ height: `${s.soilMoisture}%` }" />
            </div>
          </div>
        </section>
        <section class="monitor-radar">
          <div class="radar-circle">
            <span class="point p1" />
            <span class="point p2" />
            <span class="point p3" />
            <b>1号温室</b>
            <em>环境正常</em>
          </div>
          <div class="monitor-gateway">
            GW001 · 48 台设备在线<br />
            <small>LoRa + 4G · v3.1.0</small>
          </div>
        </section>
        <section class="monitor-panel">
          <h3>实时告警</h3>
          <div v-for="a in data.alerts.slice(0, 4)" :key="a.id" class="monitor-alert">
            <IotStatus :value="a.level" />
            <div><b>{{ a.title }}</b><small>{{ a.deviceName }} · {{ a.createdAt }}</small></div>
          </div>
        </section>
      </div>
      <div class="monitor-bottom">
        <div v-for="p in data.plots.slice(0, 4)" :key="p.id">
          <span>🌱</span>
          <div><b>{{ p.plotName }}</b><small>{{ p.cropName }} · {{ p.cropStage }}</small></div>
          <em>{{ p.onlineCount }}/{{ p.deviceCount }}</em>
        </div>
      </div>
    </div>

    <!-- 生产物联概况 -->
    <div v-else class="iot-page">
      <IotPageTitle title="物联网工作台" desc="设备、环境、告警与自动化运行状态的一体化工作台。">
        <template #actions>
          <a-button @click="loadOverview">刷新数据</a-button>
          <a-button type="primary" @click="routeStore.navigate('/monitor')">进入监测大屏</a-button>
        </template>
      </IotPageTitle>

      <section class="farm-banner">
        <span class="farm-icon">🌾</span>
        <div>
          <IotStatus :value="data.farm.status" />
          <h2>{{ data.farm.farmName }}</h2>
          <p>{{ data.farm.address }} · {{ data.farm.area }} 亩 · 负责人 {{ data.farm.manager }}</p>
        </div>
        <div class="farm-stats">
          <span><small>设备在线</small><b>{{ data.stats.online }}<em>/{{ data.stats.devices }}</em></b></span>
          <span><small>地块</small><b>{{ data.stats.plots }}</b></span>
          <span><small>今日告警</small><b class="red">{{ data.stats.alerts }}</b></span>
          <span><small>数据点</small><b>{{ data.stats.dataToday.toLocaleString() }}</b></span>
        </div>
      </section>

      <div class="iot-metrics">
        <div class="iot-metric tone-green">
          <span><CloudServerOutlined /></span>
          <div><small>设备总数</small><b>{{ data.stats.devices }}</b><em>在线 {{ data.stats.online }} · 离线 {{ data.stats.offline }}</em></div>
        </div>
        <div class="iot-metric tone-blue">
          <span><EnvironmentOutlined /></span>
          <div><small>地块监测</small><b>{{ data.stats.plots }}</b><em>环境与土壤数据持续采集</em></div>
        </div>
        <div class="iot-metric tone-red">
          <span><AlertOutlined /></span>
          <div><small>待处理告警</small><b>{{ data.stats.alerts }}</b><em>红警优先处置</em></div>
        </div>
        <div class="iot-metric tone-amber">
          <span><PoweroffOutlined /></span>
          <div><small>今日控制</small><b>{{ data.stats.todayControl }}</b><em>远程控制指令</em></div>
        </div>
      </div>

      <div class="iot-two-grid">
        <section class="iot-card">
          <div class="iot-card-head"><div><b>实时环境</b><small>当前作物环境</small></div></div>
          <div class="env-grid">
            <div v-for="item in data.environment" :key="item.key">
              <span class="env-icon">{{ envIcon(item.key) }}</span>
              <small>{{ item.name }}</small>
              <b>{{ item.value }}<em>{{ item.unit }}</em></b>
              <span :class="item.change >= 0 ? 'up' : 'down'">{{ item.change > 0 ? '+' : '' }}{{ item.change }}</span>
            </div>
          </div>
        </section>
        <section class="iot-card">
          <div class="iot-card-head"><div><b>当前场景</b><small>自动控制运行中</small></div></div>
          <div class="active-scene">
            <span>{{ data.activeScene?.icon }}</span>
            <div>
              <b>{{ data.activeScene?.sceneName || '未启用场景' }}</b>
              <p>{{ data.activeScene?.description }}</p>
              <IotStatus :value="data.activeScene?.active ? 'running' : 'pending'" />
            </div>
          </div>
          <div class="scene-quick">
            <div v-for="log in data.recentControls.slice(0, 3)" :key="log.id">
              <b>{{ log.deviceName }}</b>
              <span>{{ log.action }} · {{ log.createdAt }}</span>
              <small>{{ log.result }}</small>
            </div>
          </div>
        </section>
      </div>

      <div class="iot-two-grid">
        <section class="iot-card">
          <div class="iot-card-head"><div><b>环境趋势</b><small>温度 / 湿度 / 土壤</small></div></div>
          <div class="line-chart">
            <div v-for="s in data.series" :key="s.time">
              <div class="line-bars">
                <span :style="{ height: `${(s.temperature / maxTemp) * 100}%` }" />
                <i :style="{ height: `${s.humidity}%` }" />
                <em :style="{ height: `${s.soilMoisture}%` }" />
              </div>
              <small>{{ s.time }}</small>
            </div>
          </div>
          <div class="legend">
            <span><i class="green" />温度</span>
            <span><i class="blue" />湿度</span>
            <span><i class="amber" />土壤</span>
          </div>
        </section>
        <section class="iot-card">
          <div class="iot-card-head"><div><b>设备类型</b><small>当前农场</small></div></div>
          <div class="type-list">
            <div v-for="t in data.deviceTypes" :key="t.name">
              <span>{{ t.icon }}</span>
              <b>{{ t.name }}</b>
              <em>{{ t.value }}</em>
            </div>
          </div>
        </section>
      </div>

      <section class="iot-card">
        <div class="iot-card-head">
          <div><b>最新告警</b><small>优先处理高等级告警</small></div>
          <a-button size="small" @click="routeStore.navigate('/alerts')">查看全部</a-button>
        </div>
        <div class="alert-list">
          <button v-for="a in data.alerts" :key="a.id" type="button" @click="routeStore.navigate('/alerts')">
            <span :class="`level-${a.level}`"><AlertOutlined /></span>
            <div>
              <b>{{ a.title }}</b>
              <p>{{ a.deviceName }} · {{ a.content }}</p>
              <small>{{ a.createdAt }} · {{ a.alertNo }}</small>
            </div>
            <IotStatus :value="a.status" />
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { AlertOutlined, CloudServerOutlined, EnvironmentOutlined, PoweroffOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { iotApi, type IotOverview } from '../api/iotExperience'
import { useClock } from '../../../shared-ui/vue/useClock'
import { useIotRouteStore } from '../stores/iotRoute'
import IotStatus from '../components/IotStatus.vue'
import IotPageTitle from '../components/IotPageTitle.vue'

const props = defineProps<{ initial: 'dashboard' | 'monitor' }>()
const routeStore = useIotRouteStore()
const clock = useClock()
const view = ref<'dashboard' | 'monitor'>(props.initial)
const data = ref<IotOverview | null>(null)

watch(() => props.initial, (val) => { view.value = val })

const maxTemp = computed(() => Math.max(...(data.value?.series.map((s) => s.temperature) ?? []), 1))

function envIcon(key: string): string {
  return key === 'temperature' ? '🌡️' : key === 'humidity' ? '💧' : key === 'soil_moisture' ? '🌱' : key === 'light' ? '☀️' : '🌫️'
}

function loadOverview() {
  void iotApi.overview()
    .then((res) => { data.value = res })
    .catch((e: Error) => message.error(e.message))
}

onMounted(loadOverview)
</script>
