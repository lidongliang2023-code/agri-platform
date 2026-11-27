<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { serviceApi, type Course } from '../../api'

const courses = ref<Course[]>([])
const certificates = ref<Array<{ certNo: string; title: string; teacher: string; duration: string; mode: string; completedAt: string }>>([])
const loading = ref(false)
const error = ref('')
const active = ref<Course | null>(null)
const note = ref('')
const saving = ref(false)
const enrolled = computed(() => courses.value.filter((item) => item.enrolled))
const overall = computed(() => enrolled.value.length ? Math.round(enrolled.value.reduce((sum, item) => sum + item.myProgress, 0) / enrolled.value.length) : 0)

onShow(load)
onPullDownRefresh(async () => { await load(); uni.stopPullDownRefresh() })

async function load() {
  if (loading.value) return
  loading.value = true; error.value = ''
  try {
    const [rows, certs] = await Promise.all([serviceApi.courses(), serviceApi.certificates()])
    courses.value = rows; certificates.value = certs
  } catch (reason) { error.value = reason instanceof Error ? reason.message : '培训数据暂不可用' }
  finally { loading.value = false }
}

async function enroll(course: Course) {
  try {
    const updated = await serviceApi.enrollCourse(course.id)
    courses.value = courses.value.map((item) => item.id === updated.id ? updated : item)
    openCourse(updated)
    uni.showToast({ title: course.enrolled ? '已进入学习' : '报名成功', icon: 'success' })
  } catch (reason) { uni.showToast({ title: reason instanceof Error ? reason.message : '报名失败', icon: 'none' }) }
}

function openCourse(course: Course) { active.value = course; note.value = course.myNote || '' }
function closeCourse() { active.value = null }

async function advance() {
  if (!active.value || saving.value) return
  saving.value = true
  try {
    const next = Math.min(100, Number(active.value.myProgress || 0) + 25)
    const record = await serviceApi.updateCourseProgress(active.value.id, next)
    uni.showToast({ title: next >= 100 ? `已完成，证书 ${record.certNo || ''}` : `进度已到 ${record.progress}%`, icon: 'success' })
    await load()
    active.value = courses.value.find((item) => item.id === active.value?.id) || null
  } catch (reason) { uni.showToast({ title: reason instanceof Error ? reason.message : '进度更新失败', icon: 'none' }) }
  finally { saving.value = false }
}

async function saveNote() {
  if (!active.value || saving.value) return
  saving.value = true
  try { await serviceApi.saveCourseNote(active.value.id, note.value); uni.showToast({ title: '笔记已保存', icon: 'success' }); await load() }
  catch (reason) { uni.showToast({ title: reason instanceof Error ? reason.message : '保存失败', icon: 'none' }) }
  finally { saving.value = false }
}
</script>

<template>
  <view class="page page-pad training-page">
    <view class="hero"><text class="hero-kicker">AGRICULTURAL ACADEMY</text><text class="hero-title">丰链云 · 田间学院</text><text class="hero-desc">围绕粮油生产、植保、农机安全与农场经营，把经验变成可复制的方法。</text><view class="hero-stats"><text><b>{{ enrolled.length }}</b> 门已报名</text><text><b>{{ certificates.length }}</b> 张证书</text><text><b>{{ overall }}%</b> 平均进度</text></view></view>
    <view v-if="error" class="card error-state"><text>{{ error }}</text><button class="btn btn-ghost" @click="load">重新加载</button></view>
    <view v-else-if="loading && !courses.length" class="loading">正在加载课程…</view>
    <template v-else>
      <view class="section-head"><text class="card-title">全部课程</text><text class="muted">共 {{ courses.length }} 门</text></view>
      <view v-if="!courses.length" class="empty"><text class="empty-icon">📚</text><text>暂无课程</text></view>
      <view v-for="course in courses" :key="course.id" class="card course-card"><view class="course-cover"><text>{{ course.cover }}</text><text class="tag tag-blue">{{ course.mode }}</text></view><view class="course-main"><view class="course-tags"><text v-for="tag in course.tags" :key="tag" class="tag tag-gray">{{ tag }}</text></view><text class="strong course-title">{{ course.title }}</text><text class="muted">{{ course.summary }}</text><text class="tiny">{{ course.teacher }} · {{ course.duration }} · {{ course.learners }} 人学习 · ★ {{ course.rating }}</text><view v-if="course.enrolled" class="progress"><view :style="{ width: `${course.myProgress}%` }" /></view><view class="between course-foot"><text v-if="course.enrolled" class="tiny">我的进度 {{ course.myProgress }}%{{ course.certNo ? ' · 已获证书' : '' }}</text><text v-else class="tiny">免费报名</text><button class="btn btn-sm" :class="course.enrolled ? 'btn-primary' : 'btn-ghost'" @click="course.enrolled ? openCourse(course) : enroll(course)">{{ course.enrolled ? '进入学习' : '免费报名' }}</button></view></view></view>

      <view class="section-head certificate-head"><text class="card-title">我的结业证书</text><text class="muted">完成 100% 后签发</text></view>
      <view v-if="!certificates.length" class="card empty-card"><text class="empty-icon">🎓</text><text class="muted">还没有证书，完成任意课程后自动签发</text></view>
      <view v-for="cert in certificates" :key="cert.certNo" class="card certificate"><text class="certificate-icon">🏅</text><view><text class="strong">{{ cert.title }}</text><text class="tiny">{{ cert.certNo }} · {{ cert.completedAt }}</text><text class="muted">{{ cert.teacher }} · {{ cert.duration }} · {{ cert.mode }}</text></view></view>
    </template>

    <view v-if="active" class="sheet-mask" @click.self="closeCourse"><view class="mobile-sheet"><view class="between"><text class="card-title">{{ active.title }}</text><text class="close" @click="closeCourse">×</text></view><text class="muted">讲师：{{ active.teacher }} · {{ active.mode }} · {{ active.duration }}</text><view class="progress progress-large"><view :style="{ width: `${active.myProgress}%` }" /></view><text class="tiny">我的进度 {{ active.myProgress }}%</text><text class="tip">本版以每次推进 25% 记录学习行为，到 100% 由服务端签发证书。</text><button class="btn btn-primary btn-block" :disabled="saving || active.myProgress >= 100" @click="advance">{{ active.myProgress >= 100 ? '已完成本课程' : '推进 25% 学习进度' }}</button><view class="form-item"><text class="form-label">我的学习笔记</text><textarea class="textarea" v-model="note" placeholder="笔记保存在本主体的学习记录里" /></view><button class="btn btn-ghost btn-block" :disabled="saving" @click="saveNote">保存笔记</button></view></view>
  </view>
</template>

<style lang="scss" scoped>
.hero { margin: -24rpx -24rpx 24rpx; padding: 34rpx 28rpx 30rpx; border-radius: 0 0 30rpx 30rpx; background: linear-gradient(145deg,#0d5036,#159a5e); color: #fff; }
.hero-kicker { display: block; color: #cdebd8; font-size: 13px; letter-spacing: 2rpx; }
.hero-title { display: block; margin-top: 12rpx; font-size: 38rpx; font-weight: 750; }
.hero-desc { display: block; margin-top: 10rpx; color: rgba(255,255,255,.72); font-size: 13px; line-height: 1.6; }
.hero-stats { display: flex; justify-content: space-between; margin-top: 26rpx; color: #d7f0df; font-size: 13px; }
.hero-stats b { color: #fff; font-size: 32rpx; }
.section-head { display: flex; justify-content: space-between; align-items: baseline; margin: 22rpx 0 14rpx; }
.certificate-head { margin-top: 34rpx; }
.course-card { display: flex; gap: 18rpx; }
.course-cover { display: flex; width: 120rpx; min-height: 150rpx; flex: 0 0 120rpx; align-items: center; justify-content: center; flex-direction: column; gap: 12rpx; border-radius: 18rpx; background: linear-gradient(145deg,#dfeeda,#b9d7ae); font-size: 48rpx; }
.course-main { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 9rpx; }
.course-tags { display: flex; flex-wrap: wrap; gap: 7rpx; }
.course-title { font-size: 15px; }
.course-foot { margin-top: 4rpx; }
.progress-large { margin: 18rpx 0 5rpx; }
.tip { display: block; margin: 18rpx 0; padding: 16rpx; border-radius: 14rpx; background: #f5f6fa; color: #52665a; font-size: 13px; line-height: 1.6; }
.certificate { display: flex; align-items: center; gap: 16rpx; }
.certificate-icon { font-size: 42rpx; }
.certificate > view { display: flex; flex-direction: column; gap: 5rpx; }
.empty-card { display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 10rpx; min-height: 170rpx; }
.error-state { display: flex; flex-direction: column; gap: 18rpx; }
.close { color: #52665a; font-size: 44rpx; }

.course-tags .tag { min-width: 0; max-width: 100%; }
.course-foot, .hero-stats, .section-head { gap: 10px; flex-wrap: wrap; }
.certificate > view { min-width: 0; }
@media (max-width: 360px) { .course-card { flex-direction: column; } .course-cover { width: 100%; min-height: 72px; flex-basis: auto; } }

</style>
