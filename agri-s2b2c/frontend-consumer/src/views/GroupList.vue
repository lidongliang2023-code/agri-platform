<template>
  <div class="m-container" v-loading="loading">
    <div class="m-page-hd">
      <h1>拼团专区</h1>
      <span class="sub">按成团人数分档，人越多单价越低；团长价仅对发起人显示，具体以后端活动配置为准</span>
      <div class="hd-actions">
        <button type="button" class="m-btn sm" @click="load">刷新团列表</button>
      </div>
    </div>

    <!-- 档位 tabs：只显示后端真实存在的成团人数 -->
    <div v-if="tiers.length" class="m-card tabs">
      <button
        v-for="tab in tabs"
        :key="tab.value || 'all'"
        type="button"
        class="seg"
        :class="{ on: size === tab.value }"
        @click="size = tab.value"
      >
        {{ tab.label }}
        <span class="seg-num num">{{ countOf(tab.value) }}</span>
      </button>
    </div>

    <div v-if="visibleGroups.length" class="m-grid m-grid-3">
      <article v-for="group in visibleGroups" :key="group.id" class="group-card">
        <header class="g-hd">
          <div class="g-title">
            <b :title="group.name">{{ group.name }}</b>
            <span class="muted small" :title="group.productName" @click="router.push(`/product/${group.productId}`)">
              {{ group.productName }}
            </span>
          </div>
          <span class="m-tag" :class="tagClass(group)">{{ statusText(group) }}</span>
        </header>

        <div class="price-box">
          <div class="main-price">
            <span class="muted small">拼团价</span>
            <span class="price lg"><span class="cur">¥</span>{{ money(group.groupPrice) }}</span>
            <span v-if="group.unit" class="muted small">/{{ group.unit }}</span>
          </div>
          <div class="sub-price">
            <span class="cost">单买 ¥{{ money(group.singlePrice) }}</span>
            <span v-if="Number(group.leaderPrice) > 0" class="m-tag amber">团长价 ¥{{ money(group.leaderPrice) }}</span>
          </div>
        </div>

        <dl class="g-meta">
          <div><dt>成团人数</dt><dd class="num">{{ group.groupSize ?? '—' }} 人成团</dd></div>
          <div><dt>成团时限</dt><dd class="num">{{ group.validHours ?? '—' }} 小时</dd></div>
          <div><dt>活动场次</dt><dd class="num">{{ dateTime(group.startTime) }} 起</dd></div>
          <div><dt>结束时间</dt><dd class="num">{{ dateTime(group.endTime) }}</dd></div>
        </dl>

        <button type="button" class="m-btn primary block" @click="router.push(`/group/${group.id}`)">立即拼团</button>
      </article>
    </div>

    <EmptyBlock
      v-else-if="!loading"
      icon="👥"
      title="当前没有在售拼团"
      desc="拼团活动由平台运营端配置（商品、团价、成团人数、有效期、场次时间），配置后才会在这里开放；供应商与消费者都不能自行开团。"
    >
      <template #actions>
        <button type="button" class="m-btn primary" @click="router.push('/products')">去逛逛好货</button>
      </template>
    </EmptyBlock>

    <p class="note muted small">
      「团长价」只对发起人生效、参团人按拼团价结算；两者都会在下单时由后端按团实例重新计算并落到订单单价上，
      页面价格仅用于预览。
    </p>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { consumerApi } from '../api'
import { dateTime, money } from '../utils/format'
import EmptyBlock from '../components/EmptyBlock.vue'

const router = useRouter()

const loading = ref(false)
const groupBuys = ref([])
const size = ref('')

/** 真实存在的成团人数档位，升序排列（如 2 人团 / 3 人团 / 5 人团）。 */
const tiers = computed(() => {
  const set = new Set(
    groupBuys.value.map((item) => Number(item.groupSize)).filter((value) => Number.isFinite(value) && value > 0),
  )
  return [...set].sort((a, b) => a - b)
})

const tabs = computed(() => [
  { label: '全部', value: '' },
  ...tiers.value.map((value) => ({ label: `${value} 人团`, value })),
])

const visibleGroups = computed(() =>
  size.value ? groupBuys.value.filter((item) => Number(item.groupSize) === Number(size.value)) : groupBuys.value,
)

function countOf(value) {
  return value ? groupBuys.value.filter((item) => Number(item.groupSize) === Number(value)).length : groupBuys.value.length
}

function toTs(value) {
  if (!value) return 0
  const ts = new Date(String(value).replace(' ', 'T')).getTime()
  return Number.isNaN(ts) ? 0 : ts
}

/** 活动状态按场次时间判断，status 只作为兜底文案。 */
function statusText(group) {
  const now = Date.now()
  const start = toTs(group.startTime)
  const end = toTs(group.endTime)
  if (start && now < start) return '未开始'
  if (end && now > end) return '已结束'
  if (group.status && group.status !== 'ACTIVE') return '已停用'
  return '拼团中'
}

function tagClass(group) {
  const text = statusText(group)
  if (text === '拼团中') return ''
  if (text === '未开始') return 'amber'
  return 'plain'
}

async function load() {
  loading.value = true
  try {
    const data = await consumerApi.getMarketing()
    groupBuys.value = data?.groupBuys || []
    // 刷新后如果当前档位已不存在，回到「全部」
    if (size.value && !tiers.value.includes(Number(size.value))) size.value = ''
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '拼团列表加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(load)
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

.group-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 18px 18px;
  border: 1px solid #e3eae5;
  border-radius: 12px;
  background: #fff;
  transition: border-color .15s, box-shadow .15s;
}

.group-card:hover {
  border-color: #cfe3d7;
  box-shadow: 0 8px 22px rgba(4, 31, 20, .05);
}

.g-hd {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.g-title {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.g-title b {
  overflow: hidden;
  font-size: 15px;
  font-weight: 800;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.g-title span {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  cursor: pointer;
}

.g-title span:hover {
  color: #12764a;
}

.g-hd .m-tag {
  margin-left: auto;
}

.price-box {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 10px;
  background: linear-gradient(120deg, #fdf6f1, #fbfdfb);
}

.main-price {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.sub-price {
  display: flex;
  align-items: center;
  gap: 10px;
}

.g-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 16px;
  margin: 0;
  font-size: 12.5px;
}

.g-meta > div {
  display: flex;
  gap: 8px;
}

.g-meta dt {
  flex: 0 0 56px;
  color: #6b7c72;
}

.g-meta dd {
  margin: 0;
  color: #33453b;
}

.group-card .m-btn {
  margin-top: auto;
}

.note {
  margin: 16px 0 0;
  line-height: 1.8;
}
</style>
