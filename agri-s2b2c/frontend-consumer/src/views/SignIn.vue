<template>
  <div class="m-container" v-loading="loading">
    <div class="m-page-hd">
      <h1>每日签到</h1>
      <span class="sub">每天签到得积分，积分可在积分商城兑换优惠券</span>
      <div class="hd-actions">
        <button type="button" class="m-btn sm" @click="router.push('/points')">积分明细 ›</button>
        <button type="button" class="m-btn sm" @click="router.push('/points-mall')">积分商城 ›</button>
      </div>
    </div>

    <!-- 未登录 -->
    <EmptyBlock
      v-if="userStore.booted && !userStore.consumerId"
      icon="🔐"
      title="登录后才能签到"
      desc="签到记录按消费者账号存储，积分也记在该账号下。当前浏览器没有检测到已登录的统一身份，请从统一门户登录后再进入商城。"
    >
      <template #actions>
        <button type="button" class="m-btn primary" @click="router.push('/')">返回首页</button>
      </template>
    </EmptyBlock>

    <div v-else class="m-split">
      <!-- 左：日历 + 签到按钮 -->
      <section class="m-card cal-card">
        <header class="cal-hd">
          <h2>{{ monthTitle }}</h2>
          <span class="m-tag" :class="isSignedToday ? '' : 'amber'">
            {{ isSignedToday ? '今日已签到' : '今日未签到' }}
          </span>
          <span class="m-spacer" />
          <span class="muted small">已签 <b class="num">{{ state.monthDates.length }}</b> 天</span>
        </header>

        <div class="week-head">
          <span v-for="week in WEEKS" :key="week">{{ week }}</span>
        </div>

        <div class="days">
          <div v-for="cell in cells" :key="cell.key" class="day" :class="cellClass(cell)">
            <template v-if="cell.day">
              <span class="num">{{ cell.day }}</span>
              <i v-if="cell.signed" class="dot" />
            </template>
          </div>
        </div>

        <div class="cal-ft">
          <div class="stat">
            <b class="num">{{ state.continuousDays }}</b>
            <small>连续签到天数</small>
          </div>
          <div class="stat">
            <b class="num">{{ state.points }}</b>
            <small>当前积分</small>
          </div>
          <div class="stat">
            <b class="num">{{ state.todayPoints }}</b>
            <small>今日可得积分</small>
          </div>
          <span class="m-spacer" />
          <button
            type="button"
            class="m-btn primary sign-btn"
            :disabled="isSignedToday || signing"
            @click="sign"
          >
            {{ isSignedToday ? '今日已签到' : signing ? '签到中…' : `签到 +${state.todayPoints}` }}
          </button>
        </div>
      </section>

      <!-- 右：规则说明 -->
      <aside class="m-stack">
        <section class="m-card m-card-pad">
          <h3 class="aside-title">签到规则</h3>
          <ul class="rules muted small">
            <li>每日签到 <b class="num">+{{ state.todayPoints || 5 }}</b> 积分，积分额度来自后端常量，不同账号一致。</li>
            <li>同一自然日只能签到一次，重复提交会被后端唯一键拦截。</li>
            <li>积分可在「积分商城」兑换优惠券，兑换后券直接进入「我的优惠券」。</li>
            <li>连续签到<b>没有</b>额外递增奖励：后端只按天发放固定积分，页面不编造连签加成。</li>
          </ul>
        </section>

        <section class="m-card m-card-pad">
          <h3 class="aside-title">积分有什么用</h3>
          <p class="muted small rule-p">
            积分目前只用于兑换平台在发的优惠券（满减券按面额 ×10 积分、折扣券按门槛 ×2 积分，最低 50 分）。
            积分不可提现、不可转赠。
          </p>
          <button type="button" class="m-btn ghost block" @click="router.push('/points-mall')">去积分商城看看</button>
        </section>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { consumerApi } from '../api'
import { useUserStore } from '../stores/user'
import EmptyBlock from '../components/EmptyBlock.vue'

const router = useRouter()
const userStore = useUserStore()

const WEEKS = ['日', '一', '二', '三', '四', '五', '六']

const loading = ref(false)
const signing = ref(false)
const state = ref({ signedToday: false, continuousDays: 0, monthDates: [], points: 0, todayPoints: 0 })

const now = new Date()
const year = now.getFullYear()
const month = now.getMonth()
const pad = (n) => String(n).padStart(2, '0')
const todayKey = `${year}-${pad(month + 1)}-${pad(now.getDate())}`

const monthTitle = computed(() => `${year} 年 ${month + 1} 月`)
const isSignedToday = computed(() => Boolean(state.value.signedToday))

const signedDates = computed(() => new Set(state.value.monthDates || []))

/** 按当月真实天数生成日历格子，首格按 1 号星期几补空位。 */
const cells = computed(() => {
  const list = []
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstWeekday = new Date(year, month, 1).getDay()
  for (let i = 0; i < firstWeekday; i += 1) list.push({ key: `blank-${i}`, day: null })
  for (let d = 1; d <= daysInMonth; d += 1) {
    const date = `${year}-${pad(month + 1)}-${pad(d)}`
    list.push({
      key: date,
      day: d,
      date,
      signed: signedDates.value.has(date),
      today: date === todayKey,
    })
  }
  return list
})

function cellClass(cell) {
  return {
    blank: !cell.day,
    signed: Boolean(cell.signed),
    today: Boolean(cell.today),
  }
}

async function load() {
  if (!userStore.consumerId) {
    state.value = { signedToday: false, continuousDays: 0, monthDates: [], points: 0, todayPoints: 0 }
    return
  }
  loading.value = true
  try {
    const data = await consumerApi.getSignIn(userStore.consumerId)
    state.value = {
      signedToday: Boolean(data?.signedToday),
      continuousDays: Number(data?.continuousDays || 0),
      monthDates: data?.monthDates || [],
      points: Number(data?.points || 0),
      todayPoints: Number(data?.todayPoints || 0),
    }
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '签到状态加载失败')
  } finally {
    loading.value = false
  }
}

/** 签到后必须回读 getSignIn，确认 signedToday 变 true 才提示成功。 */
async function sign() {
  if (!userStore.consumerId) {
    ElMessage.warning('请先完成登录')
    return
  }
  signing.value = true
  try {
    const res = await consumerApi.signIn(userStore.consumerId)
    if (res?.success === false) {
      ElMessage.warning(res.message || '签到失败')
      await load()
      return
    }
    await load()
    if (state.value.signedToday) {
      ElMessage.success(`签到成功，积分 +${res?.points ?? state.value.todayPoints}`)
      await userStore.refreshProfile()
    } else {
      ElMessage.error('签到未生效，请刷新后重试')
    }
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '签到失败')
    await load()
  } finally {
    signing.value = false
  }
}

onMounted(load)

// 统一身份异步换回消费者 ID：拿到后再查签到状态，避免直接进入本页时误判「未登录」
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

.cal-card {
  padding: 18px 22px 20px;
}

.cal-hd {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 14px;
  border-bottom: 1px solid #eef3ef;
}

.cal-hd h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 800;
}

.week-head {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
  margin: 14px 0 8px;
  color: #93a29a;
  font-size: 12px;
  text-align: center;
}

.days {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
}

.day {
  position: relative;
  display: grid;
  place-items: center;
  height: 48px;
  border: 1px solid #eef3ef;
  border-radius: 10px;
  background: #fbfdfc;
  color: #33453b;
  font-size: 13.5px;
  font-weight: 600;
}

.day.blank {
  border-color: transparent;
  background: transparent;
}

.day.signed {
  border-color: #cfe7da;
  background: #e4f6ec;
  color: #12764a;
}

.day.today {
  border-color: #12764a;
  box-shadow: inset 0 0 0 1px #12764a;
}

.day .dot {
  position: absolute;
  bottom: 7px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #159a5e;
}

.cal-ft {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 22px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px dashed #e6ede8;
}

.stat {
  display: grid;
  gap: 1px;
}

.stat b {
  color: #0b1a12;
  font-size: 20px;
  font-weight: 800;
}

.stat small {
  color: #6b7c72;
  font-size: var(--agri-font-size-micro);
}

.sign-btn {
  height: 40px;
  padding: 0 26px;
}

.aside-title {
  margin: 0 0 10px;
  font-size: 14.5px;
  font-weight: 700;
}

.rules {
  display: grid;
  gap: 8px;
  margin: 0;
  padding-left: 16px;
  line-height: 1.8;
}

.rules b {
  color: #12764a;
}

.rule-p {
  margin: 0 0 12px;
  line-height: 1.8;
}

@media (max-width: 1080px) {
  .day { height: 40px; }
}
</style>
