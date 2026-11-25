<template>
  <div class="page-stack">
    <PageTitle
      eyebrow="角色权限"
      title="权限矩阵"
      description="菜单级＝进入业务域，操作级＝写/删/导出/审核/管理；保存后整体覆盖 platform_role.permissions 并回读校验"
    >
      <template #actions>
        <a-space wrap>
          <a-select
            :value="active"
            style="width: 240px"
            :loading="loading"
            :options="roleOptions"
            @change="switchRole"
          />
          <a-button @click="selectAll">全选</a-button>
          <a-button @click="invertSelection">反选</a-button>
          <a-button @click="clearMatrix">清空矩阵</a-button>
          <a-button @click="loadPermissions(active)">重置</a-button>
          <a-button type="primary" :loading="saving" :disabled="!dirty" @click="save">保存权限配置</a-button>
        </a-space>
      </template>
    </PageTitle>

    <ErrorBlock v-if="error" :message="error" @retry="loadPermissions(active)" />

    <div v-if="wildcard" class="uc-inline-note">
      当前角色是通配权限（<code>*</code>），拥有全部业务域。要改成细粒度授权，
      先点「转为细粒度」，再按需勾选；保存时整体覆盖。
      <a-button type="link" size="small" @click="dropWildcard">转为细粒度</a-button>
    </div>

    <section class="surface-card list-card">
      <SectionHeading
        kicker="角色 × 权限点"
        :title="`${active || '未选择角色'} · 已选 ${wildcard ? '全部' : `${selectedCount} 项`}${dirty ? ' · 未保存' : ''}`"
      />
      <a-collapse v-model:activeKey="activePanels" class="perm-collapse">
        <a-collapse-panel v-for="mod in modules" :key="mod">
          <template #header>
            <div class="perm-group-title">
              <b>{{ moduleLabel(mod) }}</b>
              <span class="small muted">{{ mod }} · 已选 {{ wildcard ? ACTIONS.length : moduleSelectedCount(mod) }}/{{ ACTIONS.length }}</span>
            </div>
          </template>
          <template #extra>
            <span @click.stop>
              <a-space :size="4">
                <a-button size="small" type="link" @click="selectModule(mod, true)">全选</a-button>
                <a-button size="small" type="link" @click="selectModule(mod, false)">清空</a-button>
              </a-space>
            </span>
          </template>
          <div class="perm-panel">
            <div class="perm-row perm-row--menu">
              <span class="perm-row-label">菜单级</span>
              <a-checkbox
                :checked="wildcard || selected.includes(`${mod}:${MENU_ACTION}`)"
                :disabled="wildcard"
                @change="toggle(mod, MENU_ACTION)"
              >
                {{ ACTION_LABEL[MENU_ACTION] }}（进入该业务域 / 查看列表）
              </a-checkbox>
            </div>
            <div class="perm-row perm-row--action">
              <span class="perm-row-label">操作级</span>
              <a-checkbox
                v-for="act in OPERATION_ACTIONS"
                :key="act.key"
                :checked="wildcard || selected.includes(`${mod}:${act.key}`)"
                :disabled="wildcard"
                @change="toggle(mod, act.key)"
              >
                {{ act.label }}
              </a-checkbox>
            </div>
          </div>
        </a-collapse-panel>
      </a-collapse>
    </section>

    <section v-if="otherCodes.length > 0" class="surface-card list-card">
      <SectionHeading kicker="其它权限码" title="不在矩阵列里的授权" />
      <div class="tag-row">
        <a-tag
          v-for="perm in otherCodes"
          :key="perm"
          class="soft-tag"
          closable
          @close="removeOther(perm)"
        >
          {{ permissionLabel(perm) }}
        </a-tag>
      </div>
      <div class="uc-inline-note">
        这些是「身份型」权限（如 <code>finance:borrower</code>、<code>trade:consumer</code>），
        不是增删改查，所以没有放进矩阵的列里。直接删标签即可收回。
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Modal, message } from 'ant-design-vue'
import { ucApi } from '../api'
import ErrorBlock from '../components/ErrorBlock.vue'
import PageTitle from '../components/PageTitle.vue'
import SectionHeading from '../components/SectionHeading.vue'
import { roleText } from '../components/ui-constants'
import type { RoleRecord } from '../types'
import {
  ACTIONS,
  ACTION_LABEL,
  KNOWN_MODULES,
  MENU_ACTION,
  OPERATION_ACTIONS,
  moduleLabel,
  parsePermissions,
  permissionLabel,
  sameSet,
} from './role-utils'

const props = defineProps<{ code?: string }>()

const roles = ref<RoleRecord[]>([])
const active = ref(props.code ?? '')
const selected = ref<string[]>([])
const activePanels = ref<string[]>(KNOWN_MODULES.slice(0, 2))
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const dirty = ref(false)

onMounted(() => {
  ucApi.roles()
    .then((list) => {
      roles.value = list
      if (!active.value && list[0]?.code) active.value = list[0].code
    })
    .catch((reason: Error) => { error.value = reason.message })
    .finally(() => { loading.value = false })
})

watch(() => props.code, (code) => {
  if (code && code !== active.value) active.value = code
})

function loadPermissions(roleCode: string) {
  if (!roleCode) return
  error.value = ''
  ucApi.rolePermissions(roleCode)
    .then((list) => {
      selected.value = Array.from(new Set(list))
      dirty.value = false
    })
    .catch((reason: Error) => { error.value = reason.message })
}

watch(active, (roleCode) => {
  loadPermissions(roleCode)
}, { immediate: true })

const roleOptions = computed(() =>
  roles.value.map((role) => ({
    value: role.code,
    label: `${role.name || roleText(role.code)}（${role.code}）`,
  })),
)

const modules = computed(() => {
  const found = new Set<string>(KNOWN_MODULES)
  roles.value.forEach((role) => {
    parsePermissions(role.permissions).forEach((perm) => {
      const prefix = perm.split(':')[0]
      if (prefix && prefix !== '*') found.add(prefix)
    })
  })
  const sorted = KNOWN_MODULES.filter((mod) => found.has(mod))
  const extra = Array.from(found).filter((mod) => !KNOWN_MODULES.includes(mod)).sort()
  return [...sorted, ...extra]
})

const wildcard = computed(() => selected.value.includes('*'))

const matrixCodes = computed(() =>
  modules.value.flatMap((mod) => ACTIONS.map((act) => `${mod}:${act.key}`)),
)

const otherCodes = computed(() => {
  const matrixKeys = new Set(matrixCodes.value)
  return selected.value.filter((perm) => perm !== '*' && !matrixKeys.has(perm))
})

const selectedCount = computed(() => selected.value.filter((perm) => perm !== '*').length)

function moduleSelectedCount(mod: string): number {
  const set = new Set(selected.value)
  return ACTIONS.filter((act) => set.has(`${mod}:${act.key}`)).length
}

function switchRole(nextVal: string) {
  if (nextVal === active.value) return
  if (!dirty.value) {
    active.value = nextVal
    return
  }
  Modal.confirm({
    title: '当前角色有未保存的勾选',
    content: '切换角色会丢失这些未保存的改动。',
    okText: '放弃并切换',
    cancelText: '继续编辑',
    onOk: () => { active.value = nextVal },
  })
}

function toggle(mod: string, act: string) {
  const perm = `${mod}:${act}`
  const next = new Set(selected.value)
  if (next.has(perm)) next.delete(perm)
  else next.add(perm)
  selected.value = Array.from(next)
  dirty.value = true
}

function blockWildcard(): boolean {
  if (wildcard.value) {
    message.info('当前是通配权限，请先点「转为细粒度」再编辑')
    return true
  }
  return false
}

function selectAll() {
  if (blockWildcard()) return
  const next = new Set(selected.value)
  matrixCodes.value.forEach((perm) => next.add(perm))
  selected.value = Array.from(next)
  dirty.value = true
}

function invertSelection() {
  if (blockWildcard()) return
  const next = new Set(selected.value)
  matrixCodes.value.forEach((perm) => {
    if (next.has(perm)) next.delete(perm)
    else next.add(perm)
  })
  selected.value = Array.from(next)
  dirty.value = true
}

function clearMatrix() {
  if (blockWildcard()) return
  const next = new Set(selected.value)
  matrixCodes.value.forEach((perm) => next.delete(perm))
  selected.value = Array.from(next)
  dirty.value = true
}

function selectModule(mod: string, checked: boolean) {
  if (blockWildcard()) return
  const next = new Set(selected.value)
  ACTIONS.forEach((act) => {
    const perm = `${mod}:${act.key}`
    if (checked) next.add(perm)
    else next.delete(perm)
  })
  selected.value = Array.from(next)
  dirty.value = true
}

function dropWildcard() {
  const next = new Set(selected.value)
  next.delete('*')
  matrixCodes.value.forEach((perm) => next.add(perm))
  selected.value = Array.from(next)
  dirty.value = true
}

function removeOther(perm: string) {
  selected.value = selected.value.filter((item) => item !== perm)
  dirty.value = true
}

async function save() {
  if (!active.value) return
  saving.value = true
  const payload = [...selected.value]
  try {
    await ucApi.saveRolePermissions(active.value, payload)
    const readback = await ucApi.rolePermissions(active.value)
    if (!sameSet(payload, readback)) {
      throw new Error('保存后回读不一致，请刷新页面后重试')
    }
    selected.value = Array.from(new Set(readback))
    dirty.value = false
    message.success('权限已保存，并通过回读校验')
  } catch (reason) {
    message.error((reason as Error).message)
  } finally {
    saving.value = false
  }
}
</script>
