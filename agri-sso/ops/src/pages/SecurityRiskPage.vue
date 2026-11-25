<template>
  <div class="page-stack">
    <PageTitle
      eyebrow="安全风控"
      title="安全风险监控"
      :description="data ? `近 ${days} 日风险事件 ${data.total} 起 · 登录成功 ${data.handled} 次 · 失败 ${data.pending} 次` : `近 ${days} 日风险事件`"
    >
      <template #actions>
        <a-select
          v-model:value="days"
          style="width: 140px"
          :options="[
            { label: '近 7 天', value: 7 },
            { label: '近 14 天', value: 14 },
            { label: '近 30 天', value: 30 },
          ]"
        />
      </template>
    </PageTitle>

    <ErrorBlock v-if="error" :message="error" @retry="load" />

    <template v-if="data">
      <div class="uc-metric-grid">
        <div v-for="category in data.categories" :key="category.key" class="uc-metric">
          <div class="uc-metric-label">{{ category.label }}</div>
          <div class="uc-metric-value">{{ category.count }}</div>
          <div class="uc-metric-note">{{ category.detail }}</div>
        </div>
      </div>

      <div class="grid-main-aside">
        <section class="surface-card">
          <SectionHeading kicker="趋势" title="登录行为（含失败）" />
          <LineChart
            :labels="data.trend.labels"
            :series="[{ name: '登录相关操作', color: '#17698f', values: data.trend.loginFail }]"
            :height="220"
          />
          <div class="uc-inline-note">
            这里统计的是 <code>platform_user_operation_log</code> 中 action 以 login 开头的记录。
            平台目前没有独立的风控事件流，所以「风险事件」是从登录日志聚合出来的，
            不是一张专门的告警表 —— 与其造一张空表假装有风控引擎，不如把口径说清楚。
          </div>
        </section>

        <section class="surface-card">
          <SectionHeading kicker="等级" title="风险等级分布" />
          <BarList :items="severityItems" />
          <SectionHeading kicker="来源" title="失败登录 Top IP" />
          <span v-if="!data.topIp.length" class="small muted">窗口期内无失败登录</span>
          <div class="stack">
            <div v-for="item in data.topIp" :key="item.ip" class="row" style="justify-content: space-between">
              <span class="small">{{ item.ip }}</span>
              <b class="small">{{ item.c }} 次</b>
            </div>
          </div>
        </section>
      </div>
    </template>

    <div v-if="loading && !data" class="small muted">正在加载…</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ucApi } from '../api'
import BarList from '../components/BarList.vue'
import ErrorBlock from '../components/ErrorBlock.vue'
import LineChart from '../components/LineChart.vue'
import PageTitle from '../components/PageTitle.vue'
import SectionHeading from '../components/SectionHeading.vue'
import type { SecurityRiskData } from '../types'

const data = ref<SecurityRiskData | null>(null)
const days = ref(7)
const loading = ref(true)
const error = ref('')

function load() {
  loading.value = true
  error.value = ''
  ucApi.risks(days.value)
    .then((res) => { data.value = res })
    .catch((reason: Error) => { error.value = reason.message })
    .finally(() => { loading.value = false })
}

watch(days, load, { immediate: true })

const severityItems = computed(() =>
  (data.value?.severity ?? []).map((item) => ({
    label: item.label,
    value: item.count,
    tone: item.level === 'high' ? 'danger' : item.level === 'medium' ? 'warn' : '',
  })),
)
</script>
