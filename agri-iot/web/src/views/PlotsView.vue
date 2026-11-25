<template>
  <div class="iot-page device-member-list">
    <IotPageTitle title="地块监测" desc="生产地块、作物状态与物联网设备覆盖的一体化监测。">
      <template #actions>
        <a-segmented size="small" :value="view" :options="viewOptions" @change="changeView" />
      </template>
    </IotPageTitle>

    <div class="plot-summary">
      <div><span class="tone-green"><EnvironmentOutlined /></span><small>地块总数</small><b>{{ items.length }}</b><em>生产管理同步</em></div>
      <div><span class="tone-blue"><AppstoreOutlined /></span><small>种植面积</small><b>{{ totalArea.toFixed(1) }}</b><em>亩</em></div>
      <div><span class="tone-orange"><CloudServerOutlined /></span><small>监测设备</small><b>{{ totalDevices }}</b><em>已覆盖地块</em></div>
      <div><span class="tone-green"><ApiOutlined /></span><small>设备在线率</small><b>{{ totalDevices ? Math.round((onlineDevices / totalDevices) * 100) : 0 }}%</b><em>{{ onlineDevices }} 台在线</em></div>
    </div>

    <section class="iot-card device-filter-card" aria-label="地块筛选">
      <a-form class="device-filter-grid" layout="vertical" @finish="applyFilter">
        <a-form-item label="关键字">
          <a-input v-model:value="draftKeyword" allow-clear placeholder="地块名称、编码、作物或农场">
            <template #prefix><SearchOutlined /></template>
          </a-input>
        </a-form-item>
        <a-form-item label="生产状态">
          <a-select v-model:value="draftStatus" :options="plotStatusOptions" />
        </a-form-item>
        <a-form-item label="生产农场">
          <a-select
            v-model:value="draftFarmFilter"
            allow-clear
            show-search
            option-filter-prop="label"
            placeholder="全部生产农场"
            :options="farms.map((farm) => ({ value: farm.id, label: farm.farmName }))"
          />
        </a-form-item>
        <a-space class="device-filter-actions">
          <a-button @click="resetFilter">重置</a-button>
          <a-button type="primary" html-type="submit">查询</a-button>
        </a-space>
      </a-form>
    </section>

    <section v-if="view === 'map'" class="iot-card plot-map-view">
      <div class="plot-map-view-head">
        <div><b>生产地块分布</b><span>天地图 · 当前显示 {{ mapPoints.length }} 个有坐标地块</span></div>
        <a-tag color="green">天地图</a-tag>
      </div>
      <AgriVueTiandituMap :points="mapPoints" :height="560" @point-click="handleMapPointClick" />
      <div v-if="!mapPoints.length" class="plot-map-missing">当前筛选结果没有带中心经纬度的地块，请先在生产管理中维护地块坐标。</div>
    </section>

    <div v-else-if="view === 'cards'" class="plot-monitor-grid">
      <article
        v-for="(plot, index) in filteredItems"
        :key="plot.id"
        :class="['iot-card', 'plot-monitor-card', `tone-${index % 4}`, plot.status === 'warning' ? 'warning' : '']"
      >
        <div class="plot-monitor-map">
          <span>🌾</span><i /><i />
          <b>{{ plot.cropStage }}</b>
          <IotStatus :value="plot.status === 'warning' ? 'alert' : 'online'" />
        </div>
        <div class="plot-monitor-main">
          <div class="plot-monitor-head">
            <div><b>{{ plot.plotName }}</b><small>{{ plot.plotCode }} · {{ plot.area }} 亩</small></div>
            <a-button size="small" type="text" @click="openDetail(plot)">详情</a-button>
          </div>
          <div class="plot-farm-line"><EnvironmentOutlined /><span>{{ plot.farmName || `农场 #${plot.farmId}` }}</span><em>{{ plot.farmCode }}</em></div>
          <div class="plot-crop-line"><span>当前作物</span><b>{{ plot.cropName || '未种植' }}</b><em>{{ plot.cropStage }}</em></div>
          <div class="plot-device-line">
            <span>设备在线 {{ plot.onlineCount }}/{{ plot.deviceCount }}</span>
            <a-progress :percent="plotOnlineRate(plot)" :show-info="false" :stroke-color="plot.status === 'warning' ? '#c54b4b' : '#159a5e'" />
            <b>{{ plotOnlineRate(plot) }}%</b>
          </div>
          <footer>
            <span>生产地块 · {{ plot.sourceUpdatedAt || '已同步' }}</span>
            <a-button size="small" @click="openDevices(plot.id)">查看设备</a-button>
          </footer>
        </div>
      </article>
      <div v-if="!filteredItems.length" class="plot-empty">
        <span>🌾</span><b>没有符合条件的地块</b><small>请调整搜索、状态或生产农场筛选。</small>
      </div>
    </div>

    <AgriAntdvListTable
      v-else
      :columns="plotColumns"
      :data="filteredItems"
      row-key="id"
      :loading="loading"
      :client-pagination="true"
      column-settings-storage-key="iot_plot_hidden_columns_v1"
      column-width-storage-key="iot_plot_column_widths_v1"
      :locked-column-keys="['plot', 'actions']"
      empty-text="当前经营主体还没有同步生产地块，或筛选条件没有匹配结果。"
      @refresh="load"
    >
      <template #toolbar-left>
        <a-button @click="openProductionPlots">
          <template #icon><EnvironmentOutlined /></template>
          查看生产地块
        </a-button>
      </template>

      <template #cell-plot="{ record }">
        <button type="button" class="entity-link" @click="openDetail(record as unknown as IotPlot)">
          <span>🌾</span>
          <div><b>{{ record.plotName }}</b><small>{{ record.plotCode }}</small></div>
        </button>
      </template>

      <template #cell-farm="{ record }">
        <div class="entity-copy">
          <b>{{ record.farmName || `农场 #${record.farmId}` }}</b>
          <small>{{ record.farmCode }} · 租户 {{ record.tenantId || '—' }}</small>
        </div>
      </template>

      <template #cell-crop="{ record }">
        <div class="entity-copy">
          <b>{{ record.cropName || '未种植' }}</b>
          <small>{{ record.cropStage }}</small>
        </div>
      </template>

      <template #cell-area="{ record }">{{ record.area }} 亩</template>

      <template #cell-coverage="{ record }">
        <div class="plot-list-coverage">
          <span>{{ record.onlineCount }}/{{ record.deviceCount }} 在线</span>
          <a-progress :percent="plotOnlineRate(record as unknown as IotPlot)" size="small" :show-info="false" :stroke-color="plotOnlineRate(record as unknown as IotPlot) < 60 ? '#c54b4b' : '#159a5e'" />
          <small>{{ plotOnlineRate(record as unknown as IotPlot) }}%</small>
        </div>
      </template>

      <template #cell-status="{ record }">
        <div class="plot-state-cell">
          <IotStatus :value="record.status === 'warning' ? 'alert' : 'online'" />
          <small>{{ record.status === 'warning' ? '生产状态需关注' : '生产运行正常' }}</small>
        </div>
      </template>

      <template #cell-actions="{ record }">
        <AgriVueRowActions
          :items="[
            { key: 'monitor', label: '查看监测', onClick: () => openDetail(record as unknown as IotPlot) },
            { key: 'devices', label: '设备', onClick: () => openDevices(Number(record.id)) },
          ]"
        />
      </template>
    </AgriAntdvListTable>

    <a-modal :open="Boolean(detail)" title="地块监测详情" :width="860" @cancel="detail = null">
      <template #footer>
        <template v-if="detail">
          <a-button @click="detail = null">关闭</a-button>
          <a-button type="primary" @click="openDevices(detail.id)">进入设备管理</a-button>
        </template>
      </template>
      <div v-if="detail" class="plot-detail">
        <div class="plot-detail-hero">
          <div class="plot-detail-map">
            <AgriVueTiandituMap
              compact
              :show-legend="false"
              :height="150"
              :zoom="13"
              :points="detailMapPoints"
            />
          </div>
          <div>
            <IotStatus :value="detail.status === 'warning' ? 'alert' : 'online'" />
            <h2>{{ detail.plotName }}</h2>
            <p>{{ detail.farmName }} · {{ detail.farmCode }} · 租户 {{ detail.tenantId || '—' }}</p>
          </div>
          <div class="plot-detail-coordinates">
            <small>中心坐标</small><b>{{ detail.latitude ?? '—' }}, {{ detail.longitude ?? '—' }}</b>
            <small>数据来源</small><b>{{ detail.sourceService || 'agri-production' }}</b>
          </div>
        </div>
        <div class="plot-detail-facts">
          <span><small>种植面积</small><b>{{ detail.area }} 亩</b></span>
          <span><small>当前作物</small><b>{{ detail.cropName || '未种植' }}</b></span>
          <span><small>生长阶段</small><b>{{ detail.cropStage }}</b></span>
          <span><small>设备在线</small><b>{{ detail.onlineCount }}/{{ detail.deviceCount }}</b></span>
          <span><small>种植日期</small><b>{{ detail.plantingDate || '—' }}</b></span>
          <span><small>预计采收</small><b>{{ detail.expectedHarvestDate || '—' }}</b></span>
        </div>
        <div class="plot-live-section">
          <div class="gateway-device-title">
            <b>最近监测数据</b>
            <span>{{ detailMonitoring?.summary.latestAt ? `更新于 ${detailMonitoring.summary.latestAt}` : '暂无遥测记录' }}</span>
          </div>
          <div v-if="detailLoading" class="plot-detail-loading">正在加载监测数据…</div>
          <div v-else-if="detailMonitoring?.telemetry.length" class="plot-telemetry-grid">
            <div v-for="item in detailMonitoring.telemetry" :key="item.key">
              <small>{{ item.name }}</small><b>{{ item.value }}<em>{{ item.unit }}</em></b><span>{{ item.recordedAt }}</span>
            </div>
          </div>
          <div v-else class="gateway-detail-empty"><span>📈</span><div><b>该地块暂无遥测记录</b><small>设备完成首次上报后，这里会显示最新环境数据。</small></div></div>
        </div>
        <div class="plot-live-section">
          <div class="gateway-device-title">
            <b>地块监测设备</b>
            <span>{{ detailMonitoring?.summary.deviceCount ?? 0 }} 台 · 在线 {{ detailMonitoring?.summary.onlineCount ?? 0 }} 台</span>
          </div>
          <div class="modal-list">
            <div v-if="detailLoading" class="plot-detail-loading">正在加载设备监测数据…</div>
            <template v-else-if="detailMonitoring?.devices.length">
              <div v-for="device in detailMonitoring.devices" :key="device.id">
                <span>{{ typeIcon(device.typeName) }}</span>
                <div><b>{{ device.deviceName }}</b><small>{{ device.deviceCode }} · {{ device.protocol }} · {{ device.lastReport }}</small></div>
                <IotStatus :value="device.onlineStatus" />
              </div>
            </template>
            <div v-else class="gateway-detail-empty"><span>📡</span><div><b>该地块暂未挂载设备</b><small>请在物联网设备管理中选择生产农场和地块进行关联。</small></div></div>
          </div>
        </div>
        <div class="plot-live-section">
          <div class="gateway-device-title"><b>地块关联告警</b><span>当前地块设备产生的告警</span></div>
          <div v-if="detailMonitoring?.alerts.length" class="plot-alert-list">
            <div v-for="alert in detailMonitoring.alerts.slice(0, 5)" :key="alert.id">
              <IotStatus :value="alert.level" />
              <div><b>{{ alert.title }}</b><small>{{ alert.content }} · {{ alert.createdAt }}</small></div>
              <IotStatus :value="alert.status" />
            </div>
          </div>
          <div v-else class="gateway-detail-empty"><span>✓</span><div><b>当前地块暂无关联告警</b><small>告警处置统一在物联网预警中心完成。</small></div></div>
        </div>
      </div>
    </a-modal>

    <div class="plot-source-note">
      <EnvironmentOutlined />
      <span>地块档案、农场、租户、作物和边界均由生产管理模块提供，物联网模块不维护第二套地块数据。</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ApiOutlined, AppstoreOutlined, CloudServerOutlined, EnvironmentOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { AgriAntdvListTable } from '@agri/shared/vue/antdv'
import { AgriVueRowActions, type VueListColumn } from '@agri/shared/vue/list'
import { AgriVueTiandituMap, type TiandituMapPoint } from '@agri/shared/vue/map'
import IotPageTitle from '../components/IotPageTitle.vue'
import IotStatus from '../components/IotStatus.vue'
import { useIotRouteStore } from '../stores/iotRoute'
import { iotApi, type IotPlot, type IotProductionFarm, type PlotMonitoring } from '../api/iotExperience'

const routeStore = useIotRouteStore()
const items = ref<IotPlot[]>([])
const farms = ref<IotProductionFarm[]>([])
const loading = ref(false)
const draftKeyword = ref('')
const draftStatus = ref('all')
const draftFarmFilter = ref<number | undefined>()
const keyword = ref('')
const status = ref('all')
const farmFilter = ref<number | undefined>()
const detail = ref<IotPlot | null>(null)
const detailMonitoring = ref<PlotMonitoring | null>(null)
const detailLoading = ref(false)

const savedView = localStorage.getItem('iot_plot_view')
const view = ref<'cards' | 'list' | 'map'>(savedView === 'list' || savedView === 'map' ? savedView : 'cards')

const viewOptions = [
  { value: 'cards', label: '卡片' },
  { value: 'list', label: '列表' },
  { value: 'map', label: '地图' },
]

const plotStatusOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'normal', label: '运行正常' },
  { value: 'warning', label: '需要关注' },
]

const plotColumns: VueListColumn[] = [
  { key: 'plot', label: '地块', width: 190 },
  { key: 'farm', label: '生产农场', width: 190 },
  { key: 'crop', label: '当前作物', width: 140 },
  { key: 'area', label: '面积', width: 100, align: 'right' },
  { key: 'coverage', label: '设备覆盖', width: 150, align: 'right' },
  { key: 'status', label: '生产状态', width: 140 },
  { key: 'actions', label: '操作', width: 150, align: 'right', fixed: 'right', kind: 'action' },
]

const filteredItems = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  return items.value.filter((item) => {
    const matchesKeyword = !query || [item.plotName, item.plotCode, item.cropName, item.farmName, item.farmCode].filter(Boolean).some((v) => String(v).toLowerCase().includes(query))
    const matchesStatus = status.value === 'all' || item.status === status.value
    const matchesFarm = !farmFilter.value || item.farmId === farmFilter.value
    return matchesKeyword && matchesStatus && matchesFarm
  })
})

const totalArea = computed(() => items.value.reduce((sum, item) => sum + Number(item.area || 0), 0))
const totalDevices = computed(() => items.value.reduce((sum, item) => sum + Number(item.deviceCount || 0), 0))
const onlineDevices = computed(() => items.value.reduce((sum, item) => sum + Number(item.onlineCount || 0), 0))

const mapPoints = computed<TiandituMapPoint[]>(() =>
  filteredItems.value
    .filter((plot) => plot.longitude != null && plot.latitude != null)
    .map((plot) => ({
      id: plot.id,
      longitude: Number(plot.longitude),
      latitude: Number(plot.latitude),
      title: plot.plotName,
      meta: `${plot.cropName || '未种植'} · ${plot.deviceCount} 台设备`,
      tone: plot.status === 'warning' ? 'orange' : 'green',
      boundary: plot.boundary,
    })),
)

const detailMapPoints = computed<TiandituMapPoint[]>(() => {
  const d = detail.value
  if (!d || d.longitude == null || d.latitude == null) return []
  return [{
    id: d.id,
    longitude: Number(d.longitude),
    latitude: Number(d.latitude),
    title: d.plotName,
    tone: d.status === 'warning' ? 'orange' : 'green',
    boundary: d.boundary,
  }]
})

function plotOnlineRate(plot: IotPlot): number {
  return plot.deviceCount ? Math.round((plot.onlineCount / plot.deviceCount) * 100) : 0
}

function typeIcon(name: string): string {
  return name.includes('温湿度') ? '🌡️' : name.includes('土壤') ? '🌱' : name.includes('阀') ? '💧' : name.includes('摄像头') ? '📹' : name.includes('风机') ? '🌀' : '📱'
}

async function load() {
  loading.value = true
  try {
    const [plotRows, farmRows] = await Promise.all([iotApi.plots(), iotApi.farms()])
    items.value = plotRows
    farms.value = farmRows
  } catch (error) {
    message.error(error instanceof Error ? error.message : '地块数据加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => void load())

function changeView(value: string | number) {
  const next = value === 'list' ? 'list' : value === 'map' ? 'map' : 'cards'
  view.value = next
  localStorage.setItem('iot_plot_view', next)
}

function applyFilter() {
  keyword.value = draftKeyword.value
  status.value = draftStatus.value
  farmFilter.value = draftFarmFilter.value
}

function resetFilter() {
  draftKeyword.value = ''
  draftStatus.value = 'all'
  draftFarmFilter.value = undefined
  keyword.value = ''
  status.value = 'all'
  farmFilter.value = undefined
}

async function openDetail(plot: IotPlot) {
  detail.value = plot
  detailMonitoring.value = null
  detailLoading.value = true
  try {
    detailMonitoring.value = await iotApi.plotMonitoring(plot.id)
  } catch (error) {
    message.error(error instanceof Error ? error.message : '地块监测数据加载失败')
  } finally {
    detailLoading.value = false
  }
}

function handleMapPointClick(point: TiandituMapPoint) {
  const plot = items.value.find((item) => item.id === Number(point.id))
  if (plot) void openDetail(plot)
}

function openDevices(plotId: number) {
  detail.value = null
  routeStore.navigate(`/devices?plotId=${plotId}`)
}

function openProductionPlots() {
  window.location.assign(`${window.location.protocol}//${window.location.hostname}/production/plots`)
}
</script>
