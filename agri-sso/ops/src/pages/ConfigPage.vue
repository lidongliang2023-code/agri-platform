<template>
  <div class="page-stack">
    <PageTitle
      eyebrow="系统设置"
      title="参数配置"
      description="注册 / 实名 / 密码 / 会话 / 验证码五组账号侧策略 · 保存即写库、记审计，其中 7 项实时生效"
    >
      <template #actions>
        <a-button @click="load">重置</a-button>
        <a-button type="primary" :loading="saving" @click="save">
          保存配置{{ changed.length > 0 ? `（${changed.length} 项）` : '' }}
        </a-button>
      </template>
    </PageTitle>

    <ErrorBlock v-if="error" :message="error" @retry="load" />
    <div v-if="loading && !rows.length" class="small muted">正在加载…</div>

    <section v-for="[group, items] in grouped" :key="group" class="surface-card">
      <SectionHeading :kicker="group" :title="GROUP_LABEL[group] ?? group" />
      <div class="form-grid">
        <div v-for="row in items" :key="row.configKey" class="field">
          <label>
            {{ row.label ?? row.configKey }}
            <a-tag
              :class="`soft-tag tone-${ENFORCED_KEYS.has(row.configKey) ? 'green' : 'default'}`"
              style="margin-left: 6px; font-size: var(--o-fs-micro)"
            >
              {{ ENFORCED_KEYS.has(row.configKey) ? '已生效' : '仅记录' }}
            </a-tag>
            <span v-if="row.remark" class="small muted"> · {{ row.remark }}</span>
          </label>

          <a-switch
            v-if="row.valueType === 'switch'"
            :checked="draft[row.configKey] === '1' || draft[row.configKey] === 'true'"
            @change="(checked: boolean) => { draft[row.configKey] = checked ? '1' : '0' }"
          />
          <a-select
            v-else-if="row.valueType === 'select' || row.valueType === 'multi'"
            :mode="row.valueType === 'multi' ? 'multiple' : undefined"
            style="width: 100%"
            :value="row.valueType === 'multi' ? (draft[row.configKey] || '').split(',').filter(Boolean) : (draft[row.configKey] ?? '')"
            :options="parseOptions(row.options)"
            @change="(next: string | string[]) => { draft[row.configKey] = Array.isArray(next) ? next.join(',') : String(next) }"
          />
          <a-input-number
            v-else-if="row.valueType === 'number'"
            style="width: 100%"
            :value="draft[row.configKey] === '' ? undefined : Number(draft[row.configKey])"
            @change="(next: number | string | null) => { draft[row.configKey] = String(next ?? '') }"
          />
          <a-input
            v-else
            :value="draft[row.configKey] ?? ''"
            @change="(e: Event) => { draft[row.configKey] = (e.target as HTMLInputElement).value }"
          />
          <span class="small muted">{{ row.configKey }}</span>
        </div>
      </div>
    </section>

    <section class="surface-card">
      <SectionHeading kicker="生效范围" title="哪些改完立刻起作用" />
      <div class="small" style="line-height: 1.95">
        <div>
          <b>已生效（7 项）</b>：注册开关、注册方式、新用户默认身份、密码复杂度、禁止弱口令、
          记住我天数、短信验证码有效期。这些值由后端 <code>AccountPolicyService</code> 读取，
          注册、登录、改密码、重置密码时实时校验；保存后缓存立刻失效，不用等。
        </div>
        <div style="margin-top: 10px">
          <b>仅记录（其余）</b>：实名等级、人脸活体、公安库比对、密码过期、失败锁定、会话空闲超时、
          异地二次验证、图形验证码、IP/手机号注册上限。
          这些的执行点在 <code>core-infra</code> 的令牌与安全模块里，或依赖尚未落地的外部能力
          （公安库、活体检测、短信通道），本页只做记录与审计，<b>改完不会改变现有行为</b>。
        </div>
        <div style="margin-top: 10px" class="muted">
          把它们标出来而不是假装全都能用 —— 运营改完发现没反应，比没有这个页面更糟。
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { ucApi } from '../api'
import ErrorBlock from '../components/ErrorBlock.vue'
import PageTitle from '../components/PageTitle.vue'
import SectionHeading from '../components/SectionHeading.vue'
import type { SystemConfig } from '../types'

const ENFORCED_KEYS = new Set([
  'register.mode',
  'register.channels',
  'register.default.role',
  'password.policy',
  'password.weak.block',
  'session.remember.days',
  'captcha.sms.ttl',
])

const GROUP_LABEL: Record<string, string> = {
  register: '注册策略',
  realname: '实名强度',
  password: '密码与登录策略',
  session: '会话策略',
  captcha: '验证码策略',
}

const rows = ref<SystemConfig[]>([])
const draft = reactive<Record<string, string>>({})
const loading = ref(true)
const saving = ref(false)
const error = ref('')

function parseOptions(raw: string | null) {
  return (raw ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((opt) => ({ value: opt, label: opt }))
}

function load() {
  loading.value = true
  error.value = ''
  ucApi.configs()
    .then((list) => {
      rows.value = list
      Object.keys(draft).forEach((k) => { delete draft[k] })
      list.forEach((item) => { draft[item.configKey] = item.configValue ?? '' })
    })
    .catch((reason: Error) => { error.value = reason.message })
    .finally(() => { loading.value = false })
}

onMounted(load)

const grouped = computed(() => {
  const map = new Map<string, SystemConfig[]>()
  rows.value.forEach((row) => {
    const list = map.get(row.configGroup) ?? []
    list.push(row)
    map.set(row.configGroup, list)
  })
  return Array.from(map.entries())
})

const changed = computed(() =>
  rows.value.filter((row) => (draft[row.configKey] ?? '') !== (row.configValue ?? '')),
)

function save() {
  if (changed.value.length === 0) {
    message.info('没有改动')
    return
  }
  saving.value = true
  ucApi.saveConfigs(changed.value.map((row) => ({ key: row.configKey, value: draft[row.configKey] ?? '' })))
    .then((result) => {
      message.success(result.message)
      load()
    })
    .catch((reason: Error) => message.error(reason.message))
    .finally(() => { saving.value = false })
}
</script>
