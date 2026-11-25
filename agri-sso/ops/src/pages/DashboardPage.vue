<template>
  <div class="page-stack">
    <PageTitle
      eyebrow="运营总览"
      title="用户中心总览"
      :description="data ? `平台全量账号 · 身份 · 认证 · 安全一体化视图 · 数据更新于 ${formatTime(data.updatedAt)}` : '平台全量账号 · 身份 · 认证 · 安全一体化视图'"
    >
      <template #actions>
        <a-segmented
          :value="days"
          :options="dayOptions"
          @change="(val: string | number) => { days = Number(val) }"
        />
        <a-button @click="load(days)">
          <template #icon><ReloadOutlined /></template>
          刷新
        </a-button>
      </template>
    </PageTitle>

    <ErrorBlock v-if="error" :message="error" @retry="load(days)" />
    <LoadingBlock v-if="loading && !data" :rows="4" />

    <template v-if="data && metrics">
      <div class="uc-metric-grid">
        <div class="uc-metric">
          <div class="uc-metric-label"><i><UserOutlined /></i>注册用户</div>
          <div class="uc-metric-value">{{ formatCount(metrics.userTotal) }}</div>
          <div class="uc-metric-note">今日新增 <b>{{ metrics.todayNew }}</b> 个账号</div>
        </div>
        <div class="uc-metric">
          <div class="uc-metric-label"><i><IdcardOutlined /></i>已实名认证</div>
          <div class="uc-metric-value">{{ formatCount(metrics.identityTotal) }}</div>
          <div class="uc-metric-note">实名率 <b>{{ metrics.realnameRate }}%</b> · 待审 {{ metrics.identityPending }} 件</div>
        </div>
        <div class="uc-metric">
          <div class="uc-metric-label"><i><ClusterOutlined /></i>组织主体</div>
          <div class="uc-metric-value">{{ formatCount(metrics.merchantTotal) }}</div>
          <div class="uc-metric-note">已认证 <b>{{ metrics.merchantCertified }}</b> / {{ metrics.merchantTotal }}</div>
        </div>
        <div class="uc-metric">
          <div class="uc-metric-label"><i><RiseOutlined /></i>活跃用户（{{ days }} 天）</div>
          <div class="uc-metric-value">{{ formatCount(metrics.activeUsers) }}</div>
          <div class="uc-metric-note">活跃率 <b>{{ metrics.activeRate }}%</b> · 冻结 {{ metrics.frozenCount }} 个</div>
        </div>
      </div>

      <div class="grid-main-aside">
        <section class="surface-card">
          <div class="section-heading compact">
            <div>
              <span class="section-kicker">增长</span>
              <h2>新增注册 / 实名 / 组织</h2>
            </div>
            <span class="small muted">按日统计，缺日补 0</span>
          </div>
          <LineChart
            :labels="data.trend.labels"
            :series="[
              { name: '新增注册', color: '#2d8f4e', values: data.trend.register },
              { name: '新增实名', color: '#17698f', values: data.trend.realname },
              { name: '新增组织', color: '#d88718', values: data.trend.org },
            ]"
            :height="240"
          />
        </section>

        <section class="surface-card">
          <div class="section-heading compact">
            <div>
              <span class="section-kicker">我的待办</span>
              <h2>合计 {{ todoTotal }} 件</h2>
            </div>
          </div>
          <div v-for="todo in data.todos" :key="todo.key" class="uc-todo">
            <div class="uc-todo-main">
              <span :class="`uc-todo-count${todo.count === 0 ? ' zero' : ''}`">{{ todo.count }}</span>
              <span class="uc-todo-label">{{ todo.label }}</span>
            </div>
            <a-button
              size="small"
              :type="todo.count > 0 ? 'primary' : 'default'"
              :ghost="todo.count > 0"
              @click="app.navigate(todo.route as OpsPageKey)"
            >
              处理
            </a-button>
          </div>
          <div class="uc-inline-note">
            待办数直接取自各单据表的 pending 状态，与用户端提交的是同一份数据 ——
            用户在「我的身份」提交后，这里立刻加一。
          </div>
        </section>
      </div>

      <div class="grid-3">
        <section class="surface-card">
          <div class="section-heading compact">
            <div><span class="section-kicker">身份分布</span><h2>按角色</h2></div>
          </div>
          <BarList :items="roleItems" />
        </section>

        <section class="surface-card">
          <div class="section-heading compact">
            <div><span class="section-kicker">组织分布</span><h2>按主体类型</h2></div>
          </div>
          <BarList :items="orgTypeItems" />
        </section>

        <section class="surface-card">
          <div class="section-heading compact">
            <div><span class="section-kicker">实名状态</span><h2>认证漏斗</h2></div>
          </div>
          <div class="stack">
            <span v-if="!data.identityStatus.length" class="small muted">暂无实名记录</span>
            <div v-for="item in data.identityStatus" :key="item.status" class="row" style="justify-content: space-between">
              <StatusTag :status="item.status" />
              <b>{{ item.c }}</b>
            </div>
          </div>
          <a-button type="link" style="padding-left: 0" @click="app.navigate('realname-audit')">去审核实名 →</a-button>
        </section>
      </div>

      <section class="surface-card">
        <div class="section-heading compact">
          <div><span class="section-kicker">快捷入口</span><h2>常用操作</h2></div>
        </div>
        <div class="chip-row">
          <button type="button" class="chip" @click="app.navigate('user-list')"><TeamOutlined /> 用户列表</button>
          <button type="button" class="chip" @click="app.navigate('org-list')"><ClusterOutlined /> 组织列表</button>
          <button type="button" class="chip" @click="app.navigate('security-risk')">安全风险</button>
          <button type="button" class="chip" @click="app.navigate('message-push')">发一条推送</button>
          <button type="button" class="chip" @click="app.navigate('config')">参数配置</button>
          <button type="button" class="chip" @click="copyLink">复制本页链接</button>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { ClusterOutlined, IdcardOutlined, ReloadOutlined, RiseOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons-vue'
import { useAppStore } from '../app-context'
import { ucApi } from '../api'
import BarList from '../components/BarList.vue'
import ErrorBlock from '../components/ErrorBlock.vue'
import LineChart from '../components/LineChart.vue'
import LoadingBlock from '../components/LoadingBlock.vue'
import PageTitle from '../components/PageTitle.vue'
import StatusTag from '../components/StatusTag.vue'
import { formatCount, formatTime, roleText } from '../components/ui-constants'
import type { DashboardData, OpsPageKey } from '../types'

const app = useAppStore()
const days = ref(30)
const data = ref<DashboardData | null>(null)
const loading = ref(true)
const error = ref('')

const dayOptions = [
  { label: '近 7 天', value: 7 },
  { label: '近 30 天', value: 30 },
  { label: '近 90 天', value: 90 },
]

function load(span: number) {
  loading.value = true
  error.value = ''
  ucApi.dashboard(span)
    .then((res) => { data.value = res })
    .catch((reason: Error) => { error.value = reason.message })
    .finally(() => { loading.value = false })
}

watch(days, (val) => load(val), { immediate: true })

const metrics = computed(() => data.value?.metrics)
const todoTotal = computed(() => data.value?.todos.reduce((sum, todo) => sum + todo.count, 0) ?? 0)
const roleItems = computed(() => (data.value?.roles ?? []).slice(0, 7).map((role) => ({ label: roleText(role.code), value: role.c })))
const orgTypeItems = computed(() => (data.value?.orgTypes ?? []).map((item) => ({ label: item.type, value: item.c })))

function copyLink() {
  void navigator.clipboard?.writeText(window.location.href)
  message.success('已复制当前页面地址')
}
</script>
