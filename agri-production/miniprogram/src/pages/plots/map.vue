<template>
  <view class="page">
    <view class="notice">
      地图标记取自地块台账的边界/中心经纬度；未标注的地块不落点。「导航到这里」需在真机上调起系统地图。
    </view>

    <!-- 小程序端用原生 map 组件；H5 无地图 Key 时退回列表（不假装有地图） -->
    <!-- #ifdef MP-WEIXIN -->
    <map
      v-if="markers.length > 0"
      class="map-box"
      :latitude="center.latitude"
      :longitude="center.longitude"
      :markers="markers"
      @markertap="onMarkerTap"
    />
    <!-- #endif -->
    <!-- #ifdef H5 -->
    <view class="notice">当前 H5 预览未配置地图 Key，以下以列表呈现地块经纬度。</view>
    <!-- #endif -->

    <view v-if="located.length === 0" class="empty">该农场地块都没有经纬度标注</view>
    <view v-for="plot in located" :key="plot.plotId" class="card">
      <view class="row">
        <text class="strong">{{ plot.plotName }}</text>
        <text class="muted">{{ fmtNumber(plot.latitude, '') }}, {{ fmtNumber(plot.longitude, '') }}</text>
      </view>
      <view class="row" style="margin-top: 8rpx">
        <text class="muted">{{ plot.currentCrop || '—' }} · {{ fmtNumber(plot.area, '亩') }}</text>
        <text class="link" @click="goDetail(plot.plotId)">查看详情 →</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { listPlots } from '@/api/production'
import { currentFarm, ensureLogin } from '@/utils/auth-helper'
import { fmtNumber } from '@/utils/format'

/** 带经纬度的地块（boundary GeoJSON 或中心点任一可用即算） */
const located = ref<any[]>([])

/** 取 GeoJSON 多边形的重心近似值（第一个环的平均值），失败返回 null */
function centerOf(boundary?: string | null): { latitude: number; longitude: number } | null {
  if (!boundary) return null
  try {
    const geo = JSON.parse(boundary)
    const ring = geo?.coordinates?.[0]
    if (!Array.isArray(ring) || ring.length === 0) return null
    const sum = ring.reduce(
      (acc: { lng: number; lat: number }, point: number[]) => ({
        lng: acc.lng + Number(point[0]),
        lat: acc.lat + Number(point[1]),
      }),
      { lng: 0, lat: 0 },
    )
    return { longitude: sum.lng / ring.length, latitude: sum.lat / ring.length }
  } catch {
    return null
  }
}

const center = computed(() =>
  located.value.length > 0
    ? { latitude: located.value[0].latitude, longitude: located.value[0].longitude }
    : { latitude: 23.52, longitude: 113.61 },
)

const markers = computed(() =>
  located.value.map((plot, index) => ({
    id: index,
    latitude: plot.latitude,
    longitude: plot.longitude,
    width: 24,
    height: 24,
    callout: { content: plot.plotName, display: 'ALWAYS', fontSize: 12 },
  })),
)

function onMarkerTap(event: any): void {
  const plot = located.value[event.detail.markerId]
  if (plot) goDetail(plot.plotId)
}

function goDetail(plotId: string): void {
  uni.navigateTo({ url: `/pages/plots/detail?id=${plotId}` })
}

async function load(): Promise<void> {
  const farm = currentFarm()
  if (!farm) return
  const page = await listPlots({ farmId: farm.farmId, pageSize: 100 })
  located.value = page.list
    .map((row: any) => {
      const point = centerOf(row.boundary)
      const longitude = Number(row.centerLongitude ?? point?.longitude)
      const latitude = Number(row.centerLatitude ?? point?.latitude)
      return {
        ...row,
        plotId: String(row.plotId ?? row.id ?? ''),
        longitude: Number.isFinite(longitude) ? longitude : null,
        latitude: Number.isFinite(latitude) ? latitude : null,
      }
    })
    .filter((row: any) => row.longitude !== null && row.latitude !== null)
}

onShow(() => {
  if (!ensureLogin()) return
  void load()
})
</script>

<style lang="scss" scoped>
.map-box {
  width: 100%;
  height: 560rpx;
}
</style>
