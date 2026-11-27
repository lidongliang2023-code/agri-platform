<template>
  <div v-if="loadError" class="agri-detail-page">
    <div class="mds-detail-state is-error">
      <p>{{ loadError }}</p>
      <div style="margin-top: 12px; display: flex; justify-content: center; gap: 8px">
        <a-button @click="goBack">返回用户列表</a-button>
        <a-button type="primary" @click="loadDetail">重新加载</a-button>
      </div>
    </div>
  </div>
  <div v-else-if="loading && !userData" class="agri-detail-page">
    <div class="mds-detail-state">正在加载统一用户详情…</div>
  </div>
  <AgriVueDetailLayout
    v-else-if="userData"
    :code="userData.username || `USER-${route.params.id}`"
    :title="userData.nickName && userData.nickName !== userData.username ? userData.nickName : ''"
    :status="statusBadge"
    :extra-statuses="extraStatuses"
    :meta="headerMeta"
    :tabs="tabs"
    v-model:active-tab="activeTab"
    back-label="返回用户列表"
    @back="goBack"
  >
    <template #actions>
      <a-button @click="printPage">打印</a-button>
      <a-button :loading="loading" @click="loadDetail">刷新</a-button>
      <a-button type="primary" @click="openUserCenter">前往用户中心办理</a-button>
    </template>

    <template #banner>
      <NoticeBar tone="info" title="只读视图：">
        本页已移除「停用 / 启用账号」操作 —— 账号启停、密码重置与实名审核统一由用户中心运营端办理，避免同一账号在两处产生状态冲突。
      </NoticeBar>
    </template>

    <template v-if="activeTab === 'detail'">
      <AgriVueDetailSection title="账号资料">
        <template #extra>
          <span class="detail-section-hint">只读来自统一认证中心</span>
        </template>
        <MdsDetailInfoGrid :items="accountItems" />
      </AgriVueDetailSection>

      <AgriVueDetailSection title="主体绑定概览">
        <template #extra>
          <button
            v-if="memberships.length > 0"
            type="button"
            class="detail-section-link"
            @click="activeTab = 'memberships'"
          >
            查看全部 {{ memberships.length }} 家
          </button>
        </template>
        <div class="detail-kpi-strip">
          <div class="detail-kpi-cell">
            <span>绑定主体</span>
            <strong>{{ memberships.length }}</strong>
            <small>平台关联主体总数</small>
          </div>
          <div class="detail-kpi-cell">
            <span>企业主体</span>
            <strong>{{ enterpriseCount }}</strong>
            <small>企业/合作社类型</small>
          </div>
          <div class="detail-kpi-cell">
            <span>个人主体</span>
            <strong>{{ personalCount }}</strong>
            <small>个人经营主体</small>
          </div>
          <div class="detail-kpi-cell">
            <span>待认证</span>
            <strong>{{ pendingCount }}</strong>
            <small>审核中主体数</small>
          </div>
        </div>
      </AgriVueDetailSection>

      <AgriVueDetailSection title="经营主体与成员角色" :flush="true">
        <template #extra>
          <button
            v-if="memberships.length > 0"
            type="button"
            class="detail-section-link"
            @click="activeTab = 'memberships'"
          >
            查看全部 {{ memberships.length }} 项
          </button>
        </template>
        <div v-if="memberships.length" class="mds-detail-table-wrap">
          <table class="mds-detail-table">
            <thead>
              <tr>
                <th>主体名称</th>
                <th>主体编号</th>
                <th>主体类型</th>
                <th>主体内角色</th>
                <th>认证状态</th>
                <th>绑定状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in memberships.slice(0, 5)" :key="item.bindingId ?? item.subjectId">
                <td><strong>{{ item.subjectName || item.subjectId }}</strong></td>
                <td class="detail-mono">{{ item.subjectId }}</td>
                <td>{{ memberTypeText(item.memberType) }}</td>
                <td>{{ roleText(item.roleInMerchant) }}</td>
                <td>
                  <span class="agri-detail-status-pill" :class="`is-${verifyTone(item.verifyStatus)}`">
                    {{ verifyText(item.verifyStatus) }}
                  </span>
                </td>
                <td>
                  <span class="agri-detail-status-pill" :class="item.status === 1 ? 'is-green' : 'is-gray'">
                    {{ item.status === 1 ? '有效' : '停用' }}
                  </span>
                </td>
                <td>
                  <button type="button" class="detail-section-link" @click="viewSubject(item.subjectId)">
                    查看主体
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="mds-detail-empty">
          该账号尚未绑定经营主体，可在个人中心创建或加入企业、个人主体。
        </div>
        <template v-if="memberships.length" #footer>
          <span>共关联 <strong class="detail-mono">{{ memberships.length }}</strong> 家经营主体</span>
        </template>
      </AgriVueDetailSection>
    </template>

    <template v-else-if="activeTab === 'memberships'">
      <AgriVueDetailSection title="全部绑定经营主体" :flush="true">
        <div v-if="memberships.length" class="mds-detail-table-wrap">
          <table class="mds-detail-table">
            <thead>
              <tr>
                <th>主体名称</th>
                <th>主体编号</th>
                <th>主体类型</th>
                <th>主体内角色</th>
                <th>认证状态</th>
                <th>绑定状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in memberships" :key="item.bindingId ?? item.subjectId">
                <td><strong>{{ item.subjectName || item.subjectId }}</strong></td>
                <td class="detail-mono">{{ item.subjectId }}</td>
                <td>{{ memberTypeText(item.memberType) }}</td>
                <td>{{ roleText(item.roleInMerchant) }}</td>
                <td>
                  <span class="agri-detail-status-pill" :class="`is-${verifyTone(item.verifyStatus)}`">
                    {{ verifyText(item.verifyStatus) }}
                  </span>
                </td>
                <td>
                  <span class="agri-detail-status-pill" :class="item.status === 1 ? 'is-green' : 'is-gray'">
                    {{ item.status === 1 ? '有效' : '停用' }}
                  </span>
                </td>
                <td>
                  <button type="button" class="detail-section-link" @click="viewSubject(item.subjectId)">
                    查看主体
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="mds-detail-empty">该账号尚未绑定任何经营主体。</div>
        <template v-if="memberships.length" #footer>
          <span>合计 <strong class="detail-mono">{{ memberships.length }}</strong> 家经营主体</span>
        </template>
      </AgriVueDetailSection>
    </template>

    <template v-else-if="activeTab === 'source'">
      <AgriVueDetailSection title="主数据来源说明">
        <MdsDetailInfoGrid :items="dataSourceItems" />
      </AgriVueDetailSection>
      <AgriVueDetailSection title="协同边界说明">
        <p class="mds-detail-text-block">
          本页仅提供账号资料与主体绑定关系的只读查询；账号启停、冻结解冻及实名审核请前往用户中心运营端办理，个人资料与密码由用户本人在个人中心维护。
        </p>
      </AgriVueDetailSection>
    </template>

    <template #aside>
      <AgriVueDetailSection title="账号状态进度">
        <AgriVueDetailTimeline :items="timelineSteps" />
      </AgriVueDetailSection>

      <AgriVueDetailSection title="关联单据与入口">
        <AgriVueDetailRelated :items="relatedDocs" />
      </AgriVueDetailSection>
    </template>
  </AgriVueDetailLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  AgriVueDetailLayout,
  AgriVueDetailRelated,
  AgriVueDetailSection,
  AgriVueDetailTimeline,
  type DetailRelatedDocItem,
  type DetailStatusBadge,
  type DetailStatusTone,
  type DetailTabEntry,
  type DetailTimelineStep,
} from '@agri/shared/vue/detail'
import MdsDetailInfoGrid, { type MdsDetailInfoItem } from '@/components/ui/MdsDetailInfoGrid.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import { getUserDetail } from '../../utils/api'

interface UserMembership {
  bindingId?: number | string
  subjectId: number | string
  subjectName?: string
  memberType?: string
  roleInMerchant?: string
  verifyStatus?: string
  status?: number
}

interface UserDetailModel {
  id: number | string
  username?: string
  nickName?: string
  phone?: string
  email?: string
  status?: number | string
  createTime?: string
  updateTime?: string
  memberships?: UserMembership[]
}

const route = useRoute()
const router = useRouter()
const userData = ref<UserDetailModel | null>(null)
const loading = ref(false)
const loadError = ref('')
const activeTab = ref('detail')

const memberships = computed(() => userData.value?.memberships ?? [])
const isActive = computed(() => Number(userData.value?.status) === 1)
const enterpriseCount = computed(() => memberships.value.filter(item => item.memberType === 'enterprise').length)
const personalCount = computed(() => memberships.value.filter(item => item.memberType === 'personal').length)
const pendingCount = computed(() => memberships.value.filter(item => item.verifyStatus === 'pending').length)

const statusBadge = computed<DetailStatusBadge>(() => ({
  label: isActive.value ? '账号正常' : '账号已停用',
  tone: isActive.value ? 'green' : 'gray',
}))

const extraStatuses = computed<DetailStatusBadge[]>(() => [
  { label: '只读 · 统一认证主档', tone: 'blue' },
])

const headerMeta = computed(() => {
  const d = userData.value
  if (!d) return []
  return [
    { label: '用户标识', value: String(d.id) },
    { label: '手机号', value: d.phone || '未绑定' },
    { label: '绑定主体', value: `${memberships.value.length} 家` },
    { label: '创建时间', value: formatDate(d.createTime) },
  ]
})

const tabs = computed<DetailTabEntry[]>(() => [
  { key: 'detail', label: '用户详情' },
  { key: 'memberships', label: '绑定主体', count: memberships.value.length },
  { key: 'source', label: '数据来源' },
])

const accountItems = computed<MdsDetailInfoItem[]>(() => {
  const d = userData.value
  if (!d) return []
  return [
    { key: 'username', label: '统一账号', value: d.username, mono: true },
    { key: 'nickName', label: '昵称', value: d.nickName },
    { key: 'phone', label: '手机号', value: d.phone, mono: true },
    { key: 'email', label: '邮箱', value: d.email },
    { key: 'status', label: '账号状态', value: isActive.value ? '正常' : '已停用' },
    { key: 'id', label: '用户标识', value: String(d.id), mono: true },
    { key: 'createTime', label: '创建时间', value: formatDate(d.createTime), mono: true },
    { key: 'updateTime', label: '更新时间', value: formatDate(d.updateTime), mono: true },
  ]
})

const dataSourceItems: MdsDetailInfoItem[] = [
  { key: 'userTable', label: '用户主档', value: 'platform_user', mono: true },
  { key: 'memberTable', label: '成员关系', value: 'platform_user_merchant', mono: true },
  { key: 'merchantTable', label: '主体资料', value: 'platform_merchant', mono: true },
  { key: 'owner', label: '写操作主责', value: '用户中心运营端' },
]

const timelineSteps = computed<DetailTimelineStep[]>(() => {
  const d = userData.value
  if (!d) return []
  const hasContact = Boolean(d.phone || d.email)
  const hasMembership = memberships.value.length > 0
  return [
    {
      key: 'registered',
      title: '统一账号已注册',
      time: formatDate(d.createTime),
      description: `账号 ${d.username || d.id}`,
      state: 'done',
    },
    {
      key: 'contact',
      title: hasContact ? '联系方式已登记' : '尚未绑定联系方式',
      description: d.phone || d.email || '未绑定手机与邮箱',
      state: hasContact ? 'done' : 'pending',
    },
    {
      key: 'membership',
      title: hasMembership ? `已关联 ${memberships.value.length} 家经营主体` : '尚未绑定经营主体',
      description: hasMembership
        ? `企业 ${enterpriseCount.value} 家 · 个人 ${personalCount.value} 家${pendingCount.value ? ` · 待认证 ${pendingCount.value} 家` : ''}`
        : '可在个人中心创建或加入经营主体',
      state: hasMembership ? (pendingCount.value > 0 ? 'current' : 'done') : 'pending',
    },
    {
      key: 'status',
      title: isActive.value ? '账号正常启用' : '账号已停用',
      time: formatDate(d.updateTime),
      description: '由统一认证中心与用户中心统一维护',
      state: isActive.value ? 'done' : 'error',
    },
  ]
})

const relatedDocs = computed<DetailRelatedDocItem[]>(() => {
  const d = userData.value
  if (!d) return []
  const primarySubject = memberships.value[0]
  return [
    {
      key: 'uc',
      label: '用户中心办理',
      text: '前往用户中心运营端 ↗',
      mono: false,
      clickable: true,
      onClick: openUserCenter,
    },
    {
      key: 'primarySubject',
      label: '主要绑定主体',
      text: primarySubject?.subjectName || (primarySubject ? String(primarySubject.subjectId) : undefined),
      emptyText: '尚未绑定主体',
      clickable: Boolean(primarySubject?.subjectId),
      onClick: () => { if (primarySubject?.subjectId) viewSubject(primarySubject.subjectId) },
    },
    {
      key: 'userAudit',
      label: '实名认证审核',
      text: '查看认证台账',
      mono: false,
      clickable: true,
      onClick: () => void router.push('/user/audit'),
    },
    {
      key: 'userList',
      label: '全平台用户',
      text: '返回用户列表',
      mono: false,
      clickable: true,
      onClick: goBack,
    },
  ]
})

const loadDetail = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const response = await getUserDetail(String(route.params.id))
    if (response.code !== 200) throw new Error(response.message || '统一用户详情加载失败')
    userData.value = response.data as UserDetailModel
  } catch (error) {
    userData.value = null
    loadError.value = error instanceof Error ? error.message : '统一用户详情加载失败'
  } finally {
    loading.value = false
  }
}

const openUserCenter = () => {
  window.open(`${window.location.protocol}//${window.location.hostname}:8115/user-center-ops/`, '_blank', 'noopener')
}

const goBack = () => void router.push('/user/list')
const viewSubject = (id: number | string) => void router.push(`/subject/detail/${id}`)
const printPage = () => window.print()

const formatDate = (input?: string) => (input ? String(input).replace('T', ' ').slice(0, 16) : '—')
const memberTypeText = (type?: string) => ({ enterprise: '企业主体', personal: '个人主体' }[type || ''] || '主体类型待补充')
const roleText = (role?: string) => ({ owner: '负责人', buyer: '采购', seller: '销售', finance: '财务' }[role || ''] || role || '成员')
const verifyText = (status?: string) => ({ approved: '已认证', pending: '审核中', rejected: '已驳回', unverified: '未认证' }[status || ''] || '未认证')
const verifyTone = (status?: string): DetailStatusTone => ({ approved: 'green', pending: 'orange', rejected: 'red', unverified: 'gray' }[status || ''] as DetailStatusTone || 'gray')

watch(() => route.params.id, () => {
  activeTab.value = 'detail'
  void loadDetail()
})

onMounted(loadDetail)
</script>

<style scoped>
.detail-section-hint {
  color: #68776e;
  font-size: 12px;
}
</style>
