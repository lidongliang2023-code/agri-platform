<template>
  <div class="m-container" v-loading="loading">
    <div class="m-page-hd">
      <h1>会员中心</h1>
      <span class="sub">等级由累计消费（成长值）决定，等级、成长值均以后端返回为准</span>
      <div class="hd-actions">
        <button type="button" class="m-btn sm" @click="router.push('/growth')">成长值明细 ›</button>
      </div>
    </div>

    <!-- 未登录 -->
    <EmptyBlock
      v-if="userStore.booted && !userStore.consumerId"
      icon="🔐"
      title="登录后查看会员信息"
      desc="等级、成长值与优惠券都挂在消费者账号下。当前浏览器没有检测到已登录的统一身份，请从统一门户登录后再进入商城。"
    >
      <template #actions>
        <button type="button" class="m-btn primary" @click="router.push('/')">返回首页</button>
      </template>
    </EmptyBlock>

    <template v-else>
      <!-- 头部：身份 + 三个指标 -->
      <section class="m-card head-card">
        <div class="head-main">
          <span class="avatar">{{ (userStore.displayName || '会').slice(0, 1) }}</span>
          <div class="head-info">
            <b>{{ userStore.displayName }}</b>
            <div class="m-row-wrap">
              <span class="m-tag">{{ memberLevelText(userStore.user?.memberLevel) }}</span>
              <span class="muted small">成长值 {{ growth.growth ?? 0 }}</span>
            </div>
          </div>
        </div>

        <div class="head-stats">
          <button type="button" class="stat" @click="router.push('/growth')">
            <b class="num">¥{{ money(userStore.user?.totalConsume) }}</b>
            <small>累计消费</small>
          </button>
          <button type="button" class="stat" @click="router.push('/points')">
            <b class="num">{{ userStore.user?.points ?? 0 }}</b>
            <small>可用积分</small>
          </button>
          <button type="button" class="stat" @click="router.push('/my-coupons')">
            <b class="num">{{ couponCount }}</b>
            <small>可用优惠券</small>
          </button>
        </div>
      </section>

      <!-- 等级进度 -->
      <section class="m-card m-card-pad progress-card">
        <header class="pg-hd">
          <h3>等级进度</h3>
          <span class="m-spacer" />
          <span class="muted small num" v-if="nextThreshold">
            成长值 {{ growth.growth ?? 0 }} / {{ nextThreshold }}
          </span>
        </header>

        <div class="bar">
          <i :style="{ width: percent + '%' }" />
        </div>

        <div class="pg-ft">
          <span v-if="nextLevel">
            再消费
            <b class="num">¥{{ money(remainToNext) }}</b>
            升级为
            <b>{{ memberLevelText(nextLevel) }}</b>
          </span>
          <span v-else class="muted">已是最高等级，感谢一路支持</span>
          <span class="m-spacer" />
          <span class="muted small">成长值按累计消费金额取整，订单完成后计入</span>
        </div>
      </section>

      <!-- 权益对照表（产品口径，非后端生效配置） -->
      <section class="m-card rights-card">
        <header class="m-card-hd">
          <h3>等级权益对照</h3>
          <span class="hd-actions muted small">按等级由低到高排列</span>
        </header>

        <el-table :data="levelRows" :row-class-name="rowClass" size="default">
          <el-table-column label="会员等级" min-width="150">
            <template #default="{ row }">
              <div class="lv-cell">
                <b>{{ memberLevelText(row.level) }}</b>
                <small class="muted">{{ row.threshold }}</small>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="rate" label="积分倍率" min-width="100" />
          <el-table-column prop="coupon" label="专属券" min-width="220" />
          <el-table-column prop="birthday" label="生日礼" min-width="180" />
          <el-table-column prop="service" label="优先客服" min-width="170" />
        </el-table>

        <p class="rights-note muted small">
          这张表是产品口径的展示规则：后端目前只提供
          <code>/consumer/growth</code>（返回成长值、当前等级、下一等级与阈值），<b>没有权益配置接口</b>，
          因此上表所列的积分倍率、专属券、生日礼、优先客服在系统内尚未生效，前端不会据此调整积分或发券。
          接入权益配置后以此处替换为接口数据。
        </p>
      </section>

      <!-- 入口 -->
      <SectionHead title="会员服务" desc="积分、签到、优惠券都在这里" />
      <div class="m-grid m-grid-2 entries">
        <button type="button" class="entry" @click="router.push('/growth')">
          <b>📈 成长值明细</b>
          <span>查看每笔订单带来的成长值变动</span>
        </button>
        <button type="button" class="entry" @click="router.push('/signin')">
          <b>📅 每日签到</b>
          <span>每天签到得积分，连签不清零</span>
        </button>
        <button type="button" class="entry" @click="router.push('/points')">
          <b>⭐ 我的积分</b>
          <span>积分收支明细与余额</span>
        </button>
        <button type="button" class="entry" @click="router.push('/points-mall')">
          <b>🎁 积分商城</b>
          <span>用积分兑换平台优惠券</span>
        </button>
        <button type="button" class="entry" @click="router.push('/my-coupons')">
          <b>🎫 我的优惠券</b>
          <span>可用、已使用与已过期的券</span>
        </button>
        <button type="button" class="entry" @click="router.push('/coupons')">
          <b>🏷️ 领券中心</b>
          <span>先领券再下单</span>
        </button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { consumerApi } from '../api'
import { useUserStore } from '../stores/user'
import { memberLevelText, money } from '../utils/format'
import EmptyBlock from '../components/EmptyBlock.vue'
import SectionHead from '../components/SectionHead.vue'

const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const growth = ref({ growth: 0, totalConsume: 0, level: 'NORMAL', nextLevel: null, nextThreshold: null, records: [] })
const couponCount = ref(0)

const nextLevel = computed(() => growth.value.nextLevel || '')
const nextThreshold = computed(() => Number(growth.value.nextThreshold || 0))

/** 进度按「当前成长值 / 下一等级门槛」计算；已是最高等级时按 100% 展示。 */
const percent = computed(() => {
  if (!nextThreshold.value) return 100
  const value = Number(growth.value.growth || 0)
  return Math.min(100, Math.max(0, Math.round((value / nextThreshold.value) * 100)))
})

const remainToNext = computed(() => Math.max(0, nextThreshold.value - Number(growth.value.growth || 0)))

/**
 * 权益对照表为产品口径的展示规则（后端无权益配置接口），
 * 表下方已标注未生效，避免让人误以为是后端下发的权益。
 */
const levelRows = [
  { level: 'NORMAL', threshold: '成长值 0 – 499', rate: '1×', coupon: '无', birthday: '无', service: '标准在线客服' },
  { level: 'SILVER', threshold: '成长值 500 – 1999', rate: '1.2×', coupon: '每月 1 张满减券', birthday: '生日券 1 张', service: '标准在线客服' },
  { level: 'GOLD', threshold: '成长值 2000 – 4999', rate: '1.5×', coupon: '每月 2 张满减券', birthday: '生日券 + 双倍积分', service: '优先排队' },
  { level: 'PLATINUM', threshold: '成长值 5000 – 19999', rate: '1.8×', coupon: '每月 3 张满减券 + 1 张折扣券', birthday: '生日礼包', service: '专属客服' },
  { level: 'DIAMOND', threshold: '成长值 20000 以上', rate: '2×', coupon: '每月 5 张满减券 + 2 张折扣券', birthday: '生日礼包 + 专属券', service: '专属客服 + 优先处理' },
]

/** 当前等级行高亮，方便对照。 */
function rowClass({ row }) {
  return row.level === (growth.value.level || userStore.user?.memberLevel) ? 'on-row' : ''
}

async function load() {
  if (!userStore.consumerId) {
    couponCount.value = 0
    return
  }
  loading.value = true
  try {
    await userStore.refreshProfile()
    const [growthData, coupons] = await Promise.all([
      consumerApi.getGrowth(userStore.consumerId).catch(() => null),
      consumerApi.getCoupons(userStore.consumerId).catch(() => []),
    ])
    if (growthData) growth.value = growthData
    couponCount.value = (coupons || []).filter((row) => row.status === 'UNUSED').length
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '会员信息加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(load)

// 统一身份异步换回消费者 ID：拿到后再查成长值与券，避免直接进入本页时误判「未登录」
watch(
  () => userStore.consumerId,
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

.head-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 420px;
  gap: 18px;
  align-items: center;
  padding: 20px 22px;
}

.head-main {
  display: flex;
  align-items: center;
  gap: 14px;
}

.avatar {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: linear-gradient(135deg, #e4f6ec, #cbeadb);
  color: #12764a;
  font-size: 22px;
  font-weight: 800;
}

.head-info b {
  display: block;
  margin-bottom: 4px;
  font-size: 17px;
  font-weight: 800;
}

.head-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.stat {
  display: grid;
  gap: 2px;
  justify-items: center;
  padding: 12px 6px;
  border: 1px solid #eef3ef;
  border-radius: 10px;
  background: #fbfdfc;
  cursor: pointer;
  transition: border-color .15s, background .15s;
}

.stat:hover {
  border-color: #cfe3d7;
  background: #f1fbf5;
}

.stat b {
  color: #0b1a12;
  font-size: 17px;
  font-weight: 800;
}

.stat small {
  color: #6b7c72;
  font-size: var(--agri-font-size-micro);
}

.progress-card {
  margin-top: 16px;
}

.pg-hd {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.pg-hd h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
}

.bar {
  overflow: hidden;
  height: 10px;
  border-radius: 6px;
  background: #eef3ef;
}

.bar i {
  display: block;
  height: 100%;
  border-radius: 6px;
  background: linear-gradient(90deg, #159a5e, #12764a);
  transition: width .3s;
}

.pg-ft {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  font-size: 12.5px;
}

.pg-ft b {
  color: #12764a;
}

.rights-card {
  margin-top: 16px;
  overflow: hidden;
}

.rights-card :deep(.el-table) {
  border-bottom: 1px solid #e3eae5;
}

.lv-cell {
  display: grid;
  gap: 1px;
}

.lv-cell b {
  font-size: 13px;
}

.lv-cell small {
  font-size: var(--agri-font-size-micro);
}

.rights-card :deep(.on-row) {
  --el-table-tr-bg-color: #f1fbf5;
}

.rights-note {
  margin: 0;
  padding: 14px 22px 18px;
  line-height: 1.85;
}

.rights-note code {
  padding: 1px 5px;
  border-radius: 4px;
  background: #f1f5f2;
  color: #12764a;
  font-size: 12px;
}

.entries {
  margin-top: 4px;
}

.entry {
  display: grid;
  gap: 4px;
  padding: 16px 18px;
  border: 1px solid #e3eae5;
  border-radius: 12px;
  background: #fff;
  text-align: left;
  cursor: pointer;
  transition: transform .15s, border-color .15s, box-shadow .15s;
}

.entry:hover {
  transform: translateY(-2px);
  border-color: #cfe3d7;
  box-shadow: 0 8px 22px rgba(4, 31, 20, .06);
}

.entry b {
  font-size: 14px;
}

.entry span {
  color: #6b7c72;
  font-size: 12.5px;
}

@media (max-width: 1080px) {
  .head-card { grid-template-columns: minmax(0, 1fr); }
}
</style>
