<template>
  <div class="mds-page">
    <PageHeader
      title="全平台用户"
      subtitle="统一认证账号、经营主体成员关系与认证状态；账号启停与实名审核由用户中心运营端办理。"
      source="只读 · 统一认证用户主档"
    >
      <template #actions>
        <button class="mds-btn" @click="openUserCenter">前往用户中心 · 用户管理</button>
        <button class="mds-btn" :disabled="loading" @click="load">刷新</button>
      </template>
    </PageHeader>

    <NoticeBar tone="info" title="只读视图：">
      本页的「停用 / 启用」已移除 —— 账号状态改由用户中心运营端统一处置，避免同一账号在两处被改成不同状态。
    </NoticeBar>

    <StatGrid :items="statItems" />

    <div class="mds-card">
      <div class="mds-filter">
        <input
          v-model="filters.keyword"
          class="mds-input"
          type="search"
          placeholder="搜索账号、昵称、手机号、邮箱或主体名称"
          @keyup.enter="search"
        />
        <select v-model="filters.userType" class="mds-select" @change="search">
          <option value="">全部主体类型</option>
          <option value="enterprise">企业主体成员</option>
          <option value="personal">个人主体成员</option>
        </select>
        <select v-model="filters.verifyStatus" class="mds-select" @change="search">
          <option value="">全部认证状态</option>
          <option value="approved">已认证</option>
          <option value="pending">审核中</option>
          <option value="rejected">已驳回</option>
          <option value="unverified">未认证</option>
        </select>
        <select v-model="filters.status" class="mds-select" @change="search">
          <option value="">全部账号状态</option>
          <option value="active">正常</option>
          <option value="inactive">已停用</option>
        </select>
        <button class="mds-btn mds-btn--primary" @click="search">查询</button>
        <button class="mds-btn" @click="reset">重置</button>
      </div>

      <div class="mds-table-wrap">
        <table class="mds-table user-table">
          <thead>
            <tr>
              <th>统一账号</th>
              <th>联系方式</th>
              <th>绑定主体</th>
              <th>主体内角色</th>
              <th>认证状态</th>
              <th>账号状态</th>
              <th>创建时间</th>
              <th class="mds-actions">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="8" class="mds-empty">正在加载统一用户…</td>
            </tr>
            <tr v-else-if="!rows.length">
              <td colspan="8">
                <EmptyState title="暂无符合条件的统一用户" description="调整关键字或筛选条件后重试。" />
              </td>
            </tr>
            <tr v-for="user in rows" :key="user.id">
              <td>
                <div class="user-account">
                  <span class="avatar">{{ (user.nickName || user.username || '用').slice(0, 1) }}</span>
                  <div>
                    <strong>{{ user.username }}</strong>
                    <small class="mds-hint">{{ user.nickName || '未设置昵称' }}</small>
                  </div>
                </div>
              </td>
              <td>
                <div>{{ user.phone || '—' }}</div>
                <small class="mds-hint">{{ user.email || '未填写邮箱' }}</small>
              </td>
              <td>
                <template v-if="user.memberships?.length">
                  <StatusTag
                    v-for="member in user.memberships"
                    :key="member.bindingId"
                    :text="member.subjectName || member.subjectId"
                    :tone="member.memberType === 'personal' ? 'info' : 'brand'"
                    plain
                  />
                </template>
                <span v-else class="mds-muted">未绑定主体</span>
              </td>
              <td>{{ roleText(user.roleNames) }}</td>
              <td><StatusTag :text="verifyText(user.realNameStatus)" :tone="verifyTone(user.realNameStatus)" /></td>
              <td>
                <StatusTag
                  :text="isActive(user) ? '正常' : '已停用'"
                  :tone="isActive(user) ? 'success' : 'gray'"
                />
              </td>
              <td class="mds-muted">{{ formatDate(user.createTime) }}</td>
              <td class="mds-actions">
                <button class="mds-btn mds-btn--link" @click="viewDetail(user.id)">查看详情</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <PagerBar
        :page="pageNum"
        :page-size="PAGE_SIZE"
        :total="total"
        :page-size-options="[20]"
        @change="changePage"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatGrid from '@/components/ui/StatGrid.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PagerBar from '@/components/ui/PagerBar.vue'
import { getUserList } from '../../utils/api'

const PAGE_SIZE = 20
const router = useRouter()
const rows = ref([])
const loading = ref(false)
const pageNum = ref(1)
const total = ref(0)
const filters = reactive({ keyword: '', userType: '', verifyStatus: '', status: '' })
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const activeCount = computed(() => rows.value.filter(isActive).length)
const boundCount = computed(() => rows.value.filter((user) => user.memberships?.length).length)
const pendingCount = computed(() => rows.value.filter((user) => user.realNameStatus === 'pending').length)
const isActive = (user) => Number(user?.status) === 1

/** 后三张卡是「当前页」口径：接口没有按状态聚合的字段，这里如实标注 */
const statItems = computed(() => [
  { label: '用户总数', value: total.value, hint: '统一认证账号' },
  { label: '当前页正常', value: activeCount.value, hint: '账号状态启用' },
  { label: '当前页已绑定', value: boundCount.value, hint: '至少加入一个经营主体' },
  {
    label: '当前页待认证',
    value: pendingCount.value,
    hint: '主体认证审核中',
    tone: pendingCount.value ? 'warning' : undefined,
  },
])

const load = async () => {
  loading.value = true
  try {
    const response = await getUserList({
      pageNum: pageNum.value,
      pageSize: PAGE_SIZE,
      username: filters.keyword || undefined,
      userType: filters.userType || undefined,
      realNameStatus: filters.verifyStatus || undefined,
      userStatus: filters.status || undefined,
    })
    if (response.code !== 200) throw new Error(response.message || '统一用户加载失败')
    rows.value = response.data?.list ?? []
    total.value = Number(response.data?.total ?? 0)
  } catch (error) {
    rows.value = []
    total.value = 0
    message.error(error instanceof Error ? error.message : '统一用户加载失败')
  } finally {
    loading.value = false
  }
}

const search = () => {
  pageNum.value = 1
  void load()
}
const reset = () => {
  Object.assign(filters, { keyword: '', userType: '', verifyStatus: '', status: '' })
  search()
}
const changePage = (page) => {
  if (page < 1 || page > totalPages.value) return
  pageNum.value = page
  void load()
}
const viewDetail = (id) => router.push(`/user/detail/${id}`)

const VERIFY_TEXT = { approved: '已认证', pending: '审核中', rejected: '已驳回', unverified: '未认证' }
const VERIFY_TONE = { approved: 'success', pending: 'warning', rejected: 'danger', unverified: 'gray' }
const verifyText = (status) => VERIFY_TEXT[status] ?? '未认证'
const verifyTone = (status) => VERIFY_TONE[status] ?? 'gray'
const roleText = (roles) => {
  if (!roles?.length) return '—'
  const labels = { owner: '负责人', buyer: '采购', seller: '销售', finance: '财务' }
  return [...new Set(roles)].map((role) => labels[role] || role).join('、')
}
const formatDate = (value) => (value ? String(value).replace('T', ' ').slice(0, 16) : '—')

function openUserCenter() {
  window.open(`${window.location.protocol}//${window.location.hostname}:8115/user-center-ops/`, '_blank', 'noopener')
}

onMounted(load)
</script>

<style scoped>
.user-table {
  min-width: 1120px;
}

.user-account {
  display: flex;
  align-items: center;
  gap: 10px;
}

.avatar {
  width: 32px;
  height: 32px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: linear-gradient(135deg, #13a05a, #0ea5e9);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}
</style>
