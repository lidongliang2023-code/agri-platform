<template>
  <div class="m-container" v-loading="loading">
    <!-- 页头 -->
    <div class="m-page-hd">
      <h1>消息通知</h1>
      <span class="sub">订单、活动与系统通知由后端写入消息表，本页只做已读标记</span>
      <div class="hd-actions">
        <button type="button" class="m-btn sm" :disabled="!unreadCount || markingAll" @click="markAll">
          {{ markingAll ? '处理中…' : '全部标为已读' }}
        </button>
        <button type="button" class="m-btn sm" @click="load">刷新</button>
      </div>
    </div>

    <!-- 未登录 -->
    <EmptyBlock
      v-if="userStore.booted && !consumerId"
      icon="🔐"
      title="登录后查看消息"
      desc="消息按消费者账号投递。当前浏览器没有检测到已登录的统一身份，请从统一门户登录后再进入商城。"
    >
      <template #actions>
        <button type="button" class="m-btn primary" @click="router.push('/')">返回首页</button>
      </template>
    </EmptyBlock>

    <template v-else>
      <!-- 类型 tab：只显示后端真实出现过的 type，不给空分类造标签 -->
      <div class="m-card tabs">
        <button
          v-for="tab in tabs"
          :key="tab.value || 'all'"
          type="button"
          class="seg"
          :class="{ on: activeType === tab.value }"
          @click="activeType = tab.value"
        >
          {{ tab.label }}
          <span class="seg-num num">{{ tab.count }}</span>
        </button>
      </div>

      <!-- 消息列表 -->
      <div v-if="visible.length" class="m-stack msg-list">
        <article
          v-for="item in visible"
          :key="item.id"
          class="m-card msg"
          :class="{ unread: !item.isRead }"
          @click="open(item)"
        >
          <div class="msg-hd">
            <span class="dot" :class="{ on: !item.isRead }" />
            <b class="msg-title">{{ item.title || '（无标题消息）' }}</b>
            <span class="m-tag plain">{{ typeLabel(item.type) }}</span>
            <span class="m-spacer" />
            <span class="muted small num">{{ dateTime(item.createTime) }}</span>
          </div>

          <p class="msg-content" :class="{ folded: !isExpanded(item) }">{{ item.content || '该消息没有正文内容。' }}</p>

          <div class="msg-ft">
            <button v-if="isLong(item)" type="button" class="m-btn text" @click.stop="toggle(item)">
              {{ isExpanded(item) ? '收起' : '展开全文' }}
            </button>
            <span class="m-spacer" />
            <span v-if="!item.isRead" class="muted small">未读 · 点击标记为已读</span>
            <span v-else class="muted small">已读</span>
          </div>
        </article>
      </div>

      <EmptyBlock
        v-else-if="!loading"
        icon="🔔"
        :title="activeType ? `暂无「${typeLabel(activeType)}」消息` : '当前没有消息'"
        desc="消息由订单状态变更、平台活动与系统公告产生，由后端写入 s2b2c_message。当前账号在该分类下没有消息，有新的通知会出现在这里。"
      >
        <template #actions>
          <button type="button" class="m-btn" @click="router.push('/orders')">查看我的订单</button>
          <button v-if="activeType" type="button" class="m-btn" @click="activeType = ''">查看全部消息</button>
        </template>
      </EmptyBlock>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { consumerApi } from '../api'
import { useUserStore } from '../stores/user'
import { dateTime } from '../utils/format'
import EmptyBlock from '../components/EmptyBlock.vue'

const router = useRouter()
const userStore = useUserStore()

/** 已知 type 的中文名；遇到未知取值原样显示，不猜业务含义。 */
const TYPE_LABELS = {
  NOTICE: '系统通知',
  ORDER: '订单消息',
  PROMOTION: '活动优惠',
  SYSTEM: '系统消息',
  AFTER_SALE: '售后消息',
  POINTS: '积分消息',
  UNKNOWN: '未分类',
}

/** 已知类型的排序，未知类型排在后面（按首次出现顺序）。 */
const TYPE_ORDER = ['ORDER', 'AFTER_SALE', 'PROMOTION', 'NOTICE', 'SYSTEM', 'POINTS']

const loading = ref(false)
const markingAll = ref(false)
const busyId = ref('')
const rows = ref([])
const activeType = ref('')
const expandedIds = ref(new Set())

const consumerId = computed(() => userStore.consumerId)
const unreadCount = computed(() => rows.value.filter((row) => !row.isRead).length)

/** tab 由真实数据生成：全部 + 出现过的类型，避免出现"点进去永远是空"的分类。 */
const tabs = computed(() => {
  const counts = new Map()
  for (const row of rows.value) {
    counts.set(row.type, (counts.get(row.type) || 0) + 1)
  }
  const known = TYPE_ORDER.filter((key) => counts.has(key))
  const unknown = [...counts.keys()].filter((key) => !TYPE_ORDER.includes(key))
  return [
    { label: '全部', value: '', count: rows.value.length },
    ...[...known, ...unknown].map((key) => ({
      label: typeLabel(key),
      value: key,
      count: counts.get(key),
    })),
  ]
})

const visible = computed(() =>
  activeType.value ? rows.value.filter((row) => row.type === activeType.value) : rows.value,
)

function typeLabel(type) {
  if (!type) return '未分类'
  return TYPE_LABELS[type] || type
}

function isLong(item) {
  return String(item.content || '').length > 60
}

function isExpanded(item) {
  return expandedIds.value.has(String(item.id))
}

function toggle(item) {
  const key = String(item.id)
  const next = new Set(expandedIds.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedIds.value = next
}

async function load() {
  if (!consumerId.value) {
    rows.value = []
    return
  }
  loading.value = true
  try {
    const list = (await consumerApi.getMessages({ consumerId: consumerId.value })) || []
    // type 理论上不会为空（建表默认 NOTICE），兜底成 UNKNOWN 以便 tab 能筛到它
    rows.value = list.map((row) => ({ ...row, type: row.type || 'UNKNOWN' }))
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '消息加载失败')
  } finally {
    loading.value = false
  }
}

/** 点击消息：展开/收起正文；未读的顺带标记已读并回读确认。 */
async function open(item) {
  toggle(item)
  if (item.isRead || busyId.value) return
  busyId.value = String(item.id)
  try {
    const res = await consumerApi.readMessage(item.id)
    if (res?.success === false) {
      ElMessage.error(res.message || '标记已读失败')
      return
    }
    await load()
    const target = rows.value.find((row) => String(row.id) === String(item.id))
    if (target && target.isRead) {
      await userStore.refreshUnread()
    } else {
      ElMessage.error('已读状态未更新，请刷新后重试')
    }
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '标记已读失败')
    await load()
  } finally {
    busyId.value = ''
  }
}

/** 全部标为已读：接口只回 updated 条数，必须回读确认没有未读残留。 */
async function markAll() {
  if (!unreadCount.value || markingAll.value) return
  const before = unreadCount.value
  markingAll.value = true
  try {
    const res = await consumerApi.readAllMessages(consumerId.value)
    if (res?.success === false) {
      ElMessage.error(res.message || '全部已读失败')
      await load()
      return
    }
    await load()
    if (unreadCount.value === 0) {
      await userStore.refreshUnread()
      ElMessage.success(`已将 ${before} 条消息标为已读`)
    } else {
      ElMessage.error(`仍有 ${unreadCount.value} 条未读，请重试`)
    }
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '全部已读失败')
    await load()
  } finally {
    markingAll.value = false
  }
}

onMounted(load)

// 统一身份异步换回消费者 ID：拿到后再查消息
watch(
  () => consumerId.value,
  (id) => {
    if (id) load()
  },
)
</script>

<style scoped>
.m-container {
  width: min(1280px, calc(100% - 48px));
  margin: 18px auto 0;
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
  padding: 8px;
}

.seg {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 16px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #4b5d53;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background .15s, color .15s, box-shadow .15s;
}

.seg:hover {
  background: #f1fbf5;
  color: #12764a;
}

.seg.on {
  background: linear-gradient(135deg, #12764a, #159a5e);
  color: #fff;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(18, 118, 74, .18);
}

.seg-num {
  padding: 0 6px;
  border-radius: 8px;
  background: rgba(11, 26, 18, .06);
  font-size: var(--agri-font-size-micro);
  font-weight: 700;
}

.seg.on .seg-num {
  background: rgba(255, 255, 255, .24);
}

.msg-list {
  gap: 10px;
}

.msg {
  padding: 14px 18px;
  cursor: pointer;
  transition: border-color .15s, box-shadow .15s;
}

.msg:hover {
  border-color: #d4e7db;
  box-shadow: 0 8px 22px rgba(4, 31, 20, .05);
}

.msg.unread {
  border-color: #cfe6d9;
  background: linear-gradient(120deg, #f7fdfa, #fff 55%);
}

.msg-hd {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dot {
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #dfe8e2;
}

.dot.on {
  background: #159a5e;
  box-shadow: 0 0 0 3px rgba(21, 154, 94, .14);
}

.msg-title {
  overflow: hidden;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.msg.unread .msg-title {
  font-weight: 800;
}

.msg-content {
  margin: 8px 0 0;
  color: #4b5d53;
  font-size: 13px;
  line-height: 1.85;
  white-space: pre-wrap;
  word-break: break-word;
}

.msg-content.folded {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.msg-ft {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}
</style>
