<template>
  <div class="page-stack">
    <PageTitle
      eyebrow="数据分析"
      title="用户统计分析"
      :description="data ? `统计区间 ${data.range.from} ~ ${data.range.to}（${data.range.days} 天）· 数据直接取自业务表，非离线汇总` : '统计区间加载中'"
    >
      <template #actions>
        <a-select
          v-model:value="days"
          style="width: 150px"
          :options="[
            { label: '近 7 天', value: 7 },
            { label: '近 30 天', value: 30 },
            { label: '近 90 天', value: 90 },
            { label: '近 1 年', value: 365 },
          ]"
        />
      </template>
    </PageTitle>

    <ErrorBlock v-if="error" :message="error" @retry="load" />
    <div v-if="loading && !data" class="small muted">正在加载…</div>

    <template v-if="data">
      <div class="grid-3">
        <StatTile label="区间新增注册" :value="formatCount(data.summary.register)" unit="个" />
        <StatTile label="区间新增实名" :value="formatCount(data.summary.realname)" unit="条" />
        <StatTile label="区间新增组织" :value="formatCount(data.summary.org)" unit="家" />
      </div>

      <section class="surface-card">
        <SectionHeading kicker="趋势" title="注册 / 实名 / 组织" />
        <LineChart
          :labels="data.trend.labels"
          :series="[
            { name: '新增注册', color: '#2d8f4e', values: data.trend.register },
            { name: '新增实名', color: '#17698f', values: data.trend.realname },
            { name: '新增组织', color: '#d88718', values: data.trend.org },
          ]"
          :height="260"
        />
      </section>

      <div class="grid-3">
        <section class="surface-card">
          <SectionHeading kicker="身份" title="角色分布" />
          <BarList :items="data.roles.slice(0, 8).map((item) => ({ label: roleText(item.code), value: item.c }))" />
        </section>
        <section class="surface-card">
          <SectionHeading kicker="组织" title="主体类型" />
          <BarList :items="data.orgTypes.map((item) => ({ label: item.type, value: item.c }))" />
        </section>
        <section class="surface-card">
          <SectionHeading kicker="认证" title="组织认证状态" />
          <div class="stack">
            <span v-if="!data.orgVerify.length" class="small muted">暂无组织</span>
            <div v-for="item in data.orgVerify" :key="item.status" class="row" style="justify-content: space-between">
              <StatusTag :status="item.status" />
              <b>{{ item.c }}</b>
            </div>
          </div>
        </section>
      </div>

      <section class="surface-card">
        <SectionHeading kicker="地域" title="组织所在地区 Top 12" />
        <BarList :items="data.regions.map((item) => ({ label: item.region, value: item.c }))" />
        <div class="uc-inline-note">
          地区按 <code>platform_merchant.address</code> 的首段粗分（空格前），
          不做行政区划编码归一 —— 平台目前没有地区字典，硬做会把「山东省潍坊市寿光市」切成一个地区。
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ucApi } from '../api'
import BarList from '../components/BarList.vue'
import ErrorBlock from '../components/ErrorBlock.vue'
import LineChart from '../components/LineChart.vue'
import PageTitle from '../components/PageTitle.vue'
import SectionHeading from '../components/SectionHeading.vue'
import StatTile from '../components/StatTile.vue'
import StatusTag from '../components/StatusTag.vue'
import { formatCount, roleText } from '../components/ui-constants'
import type { StatsData } from '../types'

const data = ref<StatsData | null>(null)
const days = ref(30)
const loading = ref(true)
const error = ref('')

function load() {
  loading.value = true
  error.value = ''
  ucApi.stats(days.value)
    .then((res) => { data.value = res })
    .catch((reason: Error) => { error.value = reason.message })
    .finally(() => { loading.value = false })
}

watch(days, load, { immediate: true })
</script>
