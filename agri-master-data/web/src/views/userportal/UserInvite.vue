<!--
  成员邀请与审批（重构版）

  <p><b>为什么不做"邀请码"表单</b>：账号注册、手机号校验与角色授予都在用户中心，
  主数据后端没有邀请签发/接受接口。上一版这里放了一段诚实的说明（不造假表单），
  但页面完全不能操作。</p>

  <p>现在用户中心补上了「本主体加入申请列表」接口，于是这页可以<b>真正干活</b>：
  列出待审批的加入申请，负责人通过/驳回 —— 通过后用户中心会创建真实的成员绑定
  （`platform_user_merchant`），成员随即出现在「成员账号」页。</p>

  <p>仍然不造邀请表：邀请的入口是"让对方在用户中心申请加入本主体"，
  审批入口在这里。这是复用既有闭环，不是另起一套。</p>
-->
<template>
  <div class="mds-page">
    <PageHeader
      title="成员邀请与审批"
      :subtitle="`加入申请由用户中心受理，本页负责审批（主体 ${merchantId || '—'}）`"
      source="用户中心 · 加入申请"
    >
      <template #actions>
        <button class="mds-btn" :disabled="loading" @click="load">刷新</button>
        <button class="mds-btn mds-btn--primary" @click="openUserCenter">去用户中心邀请</button>
      </template>
    </PageHeader>

    <NoticeBar tone="info" title="邀请怎么发出去：">
      让对方在<b>用户中心</b>提交「加入经营主体」申请，填写本主体 ID
      <code>{{ merchantId || '—' }}</code>；提交后申请会出现在下方，
      你在这里审批通过即成为正式成员。主数据不另建邀请表，避免两套成员来源。
    </NoticeBar>

    <div class="mds-card">
      <div class="mds-card-head">
        <div>
          <h2 class="mds-card-title">待审批的加入申请</h2>
          <p class="mds-card-sub">共 {{ pending.length }} 条 · 通过后立即写入成员绑定</p>
        </div>
        <StatusTag v-if="pending.length" :text="`${pending.length} 条待处理`" tone="warning" />
      </div>

      <div v-if="loading" class="mds-card-body">
        <p class="mds-hint">正在加载申请…</p>
      </div>
      <div v-else-if="!pending.length" class="mds-card-body">
        <EmptyState
          icon="📨"
          title="没有待审批的加入申请"
          description="对方提交申请后，这里会出现待处理记录；也可以把本页的主体 ID 发给对方。"
        />
      </div>
      <div v-else class="mds-table-wrap">
        <table class="mds-table">
          <thead>
            <tr>
              <th>申请人</th>
              <th>申请角色</th>
              <th>申请说明</th>
              <th>提交时间</th>
              <th class="mds-center">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in pending" :key="row.id">
              <td>
                <strong>{{ row.applicantName || row.applicantUserId }}</strong>
              </td>
              <td>
                <StatusTag :text="roleText(row.requestedRole)" tone="info" plain />
              </td>
              <td>{{ row.message || '—' }}</td>
              <td class="mds-mono">{{ formatTime(row.createdAt) }}</td>
              <td class="mds-center">
                <button class="wb-link" :disabled="acting === row.id" @click="review(row, true)">
                  通过
                </button>
                <button class="wb-link wb-link--danger" :disabled="acting === row.id" @click="review(row, false)">
                  驳回
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="tip" class="wb-tip" style="padding: 10px 18px">{{ tip }}</p>
    </div>

    <div class="mds-card">
      <div class="mds-card-head">
        <div>
          <h2 class="mds-card-title">邀请流程（在用户中心完成）</h2>
          <p class="mds-card-sub">主数据侧只在成员成为本主体成员后，按其租户展示档案</p>
        </div>
      </div>
      <div class="mds-card-body">
        <div class="mds-steps">
          <div class="mds-step is-done"><span class="mds-step__no">1</span>把主体 ID 发给对方</div>
          <span class="mds-step__line" />
          <div class="mds-step is-done"><span class="mds-step__no">2</span>对方在用户中心提交加入申请</div>
          <span class="mds-step__line" />
          <div class="mds-step"><span class="mds-step__no">3</span>在本页审批通过</div>
          <span class="mds-step__line" />
          <div class="mds-step"><span class="mds-step__no">4</span>成员出现在「成员账号」</div>
        </div>
        <div class="mds-form-actions">
          <button class="mds-btn" @click="router.push('/user/members')">查看成员账号</button>
          <button class="mds-btn" @click="openUserCenter">去用户中心邀请</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { userGet, userPost } from '@/utils/userApi'
import { useMeStore } from '@/stores/me'

interface JoinRow {
  id: string
  applicantUserId?: string
  applicantName?: string
  requestedRole?: string
  message?: string
  status?: string
  createdAt?: string
}

const router = useRouter()
const me = useMeStore()
const loading = ref(false)
const acting = ref('')
const pending = ref<JoinRow[]>([])
const tip = ref('')
const merchantId = computed(() => String(me.current?.merchantId ?? ''))

const ROLE_TEXT: Record<string, string> = {
  owner: '负责人',
  admin: '管理员',
  member: '成员',
  finance: '财务',
}
const roleText = (code?: string) => ROLE_TEXT[code ?? ''] ?? code ?? '成员'
const formatTime = (value?: string | null) => (value ? String(value).replace('T', ' ').slice(0, 16) : '—')

async function load() {
  loading.value = true
  tip.value = ''
  try {
    await me.load()
    if (!merchantId.value) {
      pending.value = []
      return
    }
    const res = await userGet<{ records: JoinRow[] }>(
      `/api/v1/sso/account/businesses/${merchantId.value}/join-requests`,
      { status: 'pending' },
    )
    pending.value = res.data?.records ?? []
  } catch {
    pending.value = []
  } finally {
    loading.value = false
  }
}

/**
 * 审批一条加入申请。
 *
 * <p>通过后由用户中心创建成员绑定（真正的落库动作在主责方），
 * 本页只做触发与刷新，不自己写成员表。</p>
 */
async function review(row: JoinRow, approved: boolean) {
  acting.value = row.id
  tip.value = ''
  try {
    const res = await userPost(
      `/api/v1/sso/account/businesses/join-requests/${row.id}/review`,
      { approved, remark: approved ? '主数据企业端审批通过' : '主数据企业端驳回' },
    )
    if (res.code !== 200 && res.code !== 0) {
      throw new Error(res.message || '审批失败')
    }
    tip.value = approved
      ? `已通过「${row.applicantName || row.applicantUserId}」的加入申请，成员绑定已写入`
      : `已驳回「${row.applicantName || row.applicantUserId}」的加入申请`
    await load()
  } catch (e) {
    tip.value = (e as Error).message || '审批失败'
  } finally {
    acting.value = ''
  }
}

function openUserCenter() {
  window.open(
    `${window.location.protocol}//${window.location.hostname}:8115/user-center-ops/`,
    '_blank',
    'noopener',
  )
}

onMounted(load)
</script>

<style scoped>
.wb-link {
  border: 0;
  background: none;
  padding: 0 6px;
  color: #12764a;
  font-size: 12.5px;
  cursor: pointer;
}
.wb-link:disabled {
  color: #9aa8a0;
  cursor: not-allowed;
}
.wb-link--danger {
  color: #c53030;
}
.wb-tip {
  margin: 0;
  font-size: var(--agri-font-size-micro);
  color: #6b7c72;
}
</style>
