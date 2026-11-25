<template>
  <div v-if="error" class="page-stack">
    <PageTitle title="组织详情" />
    <ErrorBlock :message="error" @retry="app.navigate('org-list')" />
  </div>
  <div v-else-if="!data" class="page-stack">
    <PageTitle title="组织详情" description="正在加载…" />
  </div>
  <div v-else class="page-stack">
    <PageTitle eyebrow="组织管理" title="组织详情">
      <template #actions>
        <a-button @click="app.navigate('org-list')">返回列表</a-button>
      </template>
    </PageTitle>

    <section class="surface-card">
      <div class="uc-detail-head">
        <div style="display: flex; gap: 16px; align-items: flex-start">
          <div class="uc-detail-avatar">{{ data.org.name.slice(0, 1) }}</div>
          <div>
            <h2 class="uc-detail-title">{{ data.org.name }}</h2>
            <div class="uc-detail-sub">
              {{ data.org.code }} · {{ ORG_TYPE_LABEL[data.org.type ?? ''] ?? data.org.type ?? '未分类' }} · {{ data.org.industry || '未填行业' }}
            </div>
            <div class="tag-row" style="margin-top: 10px">
              <StatusTag :status="data.org.verifyStatus" />
              <span v-if="data.org.verifyTime" class="small muted">认证于 {{ formatTime(data.org.verifyTime) }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="grid-2">
      <section class="surface-card">
        <SectionHeading kicker="主体档案" title="工商与联系信息" />
        <a-descriptions :column="1" size="small" bordered>
          <a-descriptions-item label="统一社会信用代码">{{ data.org.creditCode || '—' }}</a-descriptions-item>
          <a-descriptions-item label="所在地">{{ data.org.address || '—' }}</a-descriptions-item>
          <a-descriptions-item label="联系人">{{ data.org.contactName || '—' }}　{{ data.org.contactPhone || '' }}</a-descriptions-item>
          <a-descriptions-item label="会员类型">{{ data.org.memberType || '—' }}</a-descriptions-item>
          <a-descriptions-item label="创建时间">{{ formatTime(data.org.createdAt) }}</a-descriptions-item>
          <a-descriptions-item label="认证意见">{{ data.org.verifyRemark || '—' }}</a-descriptions-item>
        </a-descriptions>
      </section>

      <section class="surface-card">
        <SectionHeading kicker="成员" :title="`成员关系（${data.members.length}）`" />
        <span v-if="!data.members.length" class="small muted">暂无成员绑定</span>
        <a-table
          row-key="userId"
          size="small"
          :pagination="false"
          :data-source="data.members"
          :columns="memberColumns"
        >
          <template #bodyCell="{ column, record, text }">
            <div v-if="column.key === 'username'">
              <b>{{ record.nickname || text }}</b>
              <div class="small muted">{{ text }}</div>
            </div>
            <template v-else-if="column.key === 'roleInMerchant'">{{ text || '—' }}</template>
            <template v-else-if="column.key === 'joinedAt'">{{ formatTime(text) }}</template>
            <a-button v-else-if="column.key === 'action'" size="small" type="link" @click="app.navigate('user-detail', record.userId)">
              查看
            </a-button>
          </template>
        </a-table>
      </section>
    </div>

    <section class="surface-card">
      <SectionHeading kicker="资质材料" :title="`认证记录（${data.certifications.length}）`" />
      <span v-if="!data.certifications.length" class="small muted">该组织尚未提交资质认证</span>
      <a-table
        v-else
        row-key="id"
        size="small"
        :pagination="false"
        :data-source="data.certifications"
        :scroll="{ x: 860 }"
        :columns="certColumns"
      >
        <template #bodyCell="{ column, text }">
          <StatusTag v-if="column.key === 'certStatus'" :status="text" />
          <template v-else-if="column.key === 'submitTime'">{{ formatTime(text) }}</template>
          <template v-else>{{ text || '—' }}</template>
        </template>
      </a-table>
    </section>

    <section v-if="data.applications.length > 0" class="surface-card">
      <SectionHeading kicker="身份申请" :title="`该主体关联的申请（${data.applications.length}）`" />
      <a-table
        row-key="id"
        size="small"
        :pagination="false"
        :data-source="data.applications"
        :columns="appColumns"
      >
        <template #bodyCell="{ column, record, text }">
          <a-tag v-if="column.key === 'identityType'" class="soft-tag">{{ identityTypeText(text) }}</a-tag>
          <StatusTag v-else-if="column.key === 'status'" :status="text" />
          <template v-else-if="column.key === 'applyTime'">{{ formatTime(text ?? record.createdAt) }}</template>
          <template v-else>{{ text || '—' }}</template>
        </template>
      </a-table>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAppStore } from '../app-context'
import { ucApi } from '../api'
import ErrorBlock from '../components/ErrorBlock.vue'
import PageTitle from '../components/PageTitle.vue'
import SectionHeading from '../components/SectionHeading.vue'
import StatusTag from '../components/StatusTag.vue'
import { ORG_TYPE_LABEL, formatTime, identityTypeText } from '../components/ui-constants'
import type { OrgDetailData } from '../types'

const props = defineProps<{ id: string }>()
const app = useAppStore()
const data = ref<OrgDetailData | null>(null)
const error = ref('')

const memberColumns = [
  { title: '账号', dataIndex: 'username', key: 'username' },
  { title: '组织内角色', dataIndex: 'roleInMerchant', key: 'roleInMerchant', width: 120 },
  { title: '加入时间', dataIndex: 'joinedAt', key: 'joinedAt', width: 140 },
  { title: '操作', key: 'action', width: 90 },
]

const certColumns = [
  { title: '证书编号', dataIndex: 'certNo', key: 'certNo', width: 160 },
  { title: '企业名称', dataIndex: 'companyName', key: 'companyName' },
  { title: '法人', dataIndex: 'legalPerson', key: 'legalPerson', width: 100 },
  { title: '状态', dataIndex: 'certStatus', key: 'certStatus', width: 110 },
  { title: '提交时间', dataIndex: 'submitTime', key: 'submitTime', width: 150 },
  { title: '审核意见', dataIndex: 'reviewRemark', key: 'reviewRemark' },
]

const appColumns = [
  { title: '申请身份', dataIndex: 'identityType', key: 'identityType', width: 130 },
  { title: '主体名称', dataIndex: 'subjectName', key: 'subjectName' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 110 },
  { title: '提交时间', dataIndex: 'applyTime', key: 'applyTime', width: 150 },
]

watch(() => props.id, (id) => {
  if (!id) {
    error.value = '缺少组织 ID'
    return
  }
  error.value = ''
  data.value = null
  ucApi.orgDetail(id)
    .then((res) => { data.value = res })
    .catch((reason: Error) => { error.value = reason.message })
}, { immediate: true })
</script>
