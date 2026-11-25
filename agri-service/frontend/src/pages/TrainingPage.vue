<template>
  <div class="page-stack">
    <PageTitle
      eyebrow="AGRICULTURAL ACADEMY"
      title="培训课堂"
      description="线上课程与田间实训；报名、进度与结业证书都由平台按你的学习记录签发。"
    >
      <template #actions>
        <a-button type="primary" :disabled="!resumeTarget" @click="resumeTarget && openCourse(resumeTarget)">
          <template #icon><BookOutlined /></template>
          {{ resumeTarget ? `继续《${resumeTarget.title.slice(0, 10)}》` : '先报名一门课程' }}
        </a-button>
      </template>
    </PageTitle>

    <section class="training-hero">
      <div>
        <span class="hero-kicker"><i /> 丰链云 · 田间学院</span>
        <h2>把经验变成可复制的方法</h2>
        <p>围绕粮油生产、植保、农机安全与农场经营，提供短课、路径课和实操考核。</p>
        <div class="training-hero-stats">
          <span><b>{{ enrolled.length }}</b> 门已报名</span>
          <span><b>{{ certificates.length }}</b> 张结业证书</span>
          <span><b>{{ overall }}%</b> 平均进度</span>
        </div>
      </div>
      <div v-if="resumeTarget" class="training-hero-course">
        <span class="training-cover">{{ resumeTarget.cover }}</span>
        <div>
          <small>正在学习</small>
          <h3>{{ resumeTarget.title }}</h3>
          <a-progress :percent="resumeTarget.myProgress" :show-info="false" stroke-color="#fff" trail-color="rgba(255,255,255,.2)" />
          <p>{{ resumeTarget.mode }} · {{ resumeTarget.duration }}</p>
        </div>
        <button type="button" @click="openCourse(resumeTarget)">›</button>
      </div>
      <div v-else class="training-hero-course">
        <span class="training-cover">🌾</span>
        <div><small>还没有报名记录</small><h3>从下方挑一门课程开始</h3><p>报名后进度与证书才会在你的主体名下累积。</p></div>
      </div>
    </section>

    <section class="surface-card detail-section">
      <div class="section-heading compact">
        <div><span class="section-kicker">CATALOG</span><h2>全部课程</h2></div>
        <span class="section-note">共 {{ courses.length }} 门</span>
      </div>
      <LoadingBlock v-if="loading" :rows="3" />
      <EmptyState v-else-if="courses.length === 0" title="暂无课程" />
      <div v-else class="course-grid">
        <article v-for="course in courses" :key="course.id" class="course-card">
          <div class="course-cover">
            <span>{{ course.cover }}</span>
            <small>{{ course.mode }}</small>
            <em v-if="course.certNo"><a-tag color="green">已获证书</a-tag></em>
          </div>
          <div class="course-card-body">
            <div class="course-tags"><span v-for="tag in course.tags" :key="tag">{{ tag }}</span></div>
            <h3>{{ course.title }}</h3>
            <p>{{ course.summary }}</p>
            <div class="course-meta"><span><TeamOutlined /> {{ course.learners }} 人学习</span><span><ClockCircleOutlined /> {{ course.duration }}</span></div>
            <a-progress v-if="course.enrolled" :percent="course.myProgress" :show-info="false" stroke-color="#159a5e" trail-color="#edf3ef" />
            <div class="course-foot">
              <span>{{ course.teacher }} · <b>★ {{ course.rating }}</b></span>
              <a-button v-if="course.enrolled" type="primary" ghost @click="openCourse(course)">进入学习</a-button>
              <a-button v-else @click="enroll(course)">免费报名</a-button>
            </div>
          </div>
        </article>
      </div>
    </section>

    <section class="surface-card detail-section">
      <div class="section-heading compact">
        <div><span class="section-kicker">CERTIFICATES</span><h2>我的结业证书</h2></div>
        <span class="section-note">进度到 100% 后由平台签发</span>
      </div>
      <EmptyState v-if="certificates.length === 0" icon="🎓" title="还没有证书" description="把任意一门已报名课程学到 100%，平台会自动签发结业证书" />
      <div v-else class="certificate-grid">
        <article v-for="certificate in certificates" :key="certificate.certNo">
          <span><SafetyCertificateOutlined /></span>
          <h3>{{ certificate.title }}</h3>
          <p>{{ certificate.certNo }} · {{ certificate.completedAt }}</p>
          <small>{{ certificate.teacher }} · {{ certificate.duration }} · {{ certificate.mode }}</small>
        </article>
      </div>
    </section>

    <a-modal :open="Boolean(active)" :title="active?.title ?? '课程学习'" :footer="null" :width="760" @cancel="active = null">
      <div v-if="active" class="course-learning">
        <div class="learning-head">
          <div>
            <h3>{{ active.cover }} {{ active.title }}</h3>
            <p>讲师：{{ active.teacher }} · {{ active.mode }} · {{ active.duration }}</p>
          </div>
          <span class="status-tag tone-green">我的进度 {{ active.myProgress }}%</span>
        </div>
        <a-progress :percent="active.myProgress" stroke-color="#159a5e" />
        <p class="form-hint">本版没有接入视频播放器，「推进学习进度」按每次 25% 记录你的学习行为；到 100% 由服务端签发证书。</p>
        <div class="course-foot-actions">
          <a-button type="primary" :loading="saving" :disabled="active.myProgress >= 100" @click="advance">
            {{ active.myProgress >= 100 ? '已完成本课程' : '推进 25% 学习进度' }}
          </a-button>
          <a-tag v-if="active.certNo" color="green">结业证书 {{ active.certNo }}</a-tag>
        </div>
        <label class="note-label">我的学习笔记</label>
        <a-textarea v-model:value="note" :rows="5" placeholder="记录要点，笔记保存在本主体的学习记录里" />
        <a-button :loading="saving" @click="saveNote">保存笔记</a-button>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { BookOutlined, ClockCircleOutlined, SafetyCertificateOutlined, TeamOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { serviceApi } from '../api'
import type { Certificate, Course } from '../types'
import EmptyState from '../components/EmptyState.vue'
import LoadingBlock from '../components/LoadingBlock.vue'
import PageTitle from '../components/PageTitle.vue'

const courses = ref<Course[]>([])
const certificates = ref<Certificate[]>([])
const loading = ref(true)
const active = ref<Course | null>(null)
const note = ref('')
const saving = ref(false)

function load() {
  loading.value = true
  Promise.all([serviceApi.courses(), serviceApi.certificates()])
    .then(([rows, certs]) => {
      courses.value = rows
      certificates.value = certs
    })
    .catch((reason: Error) => message.error(reason.message))
    .finally(() => { loading.value = false })
}

onMounted(load)

const enrolled = computed(() => courses.value.filter((course) => course.enrolled))
const inProgress = computed(() => enrolled.value.filter((course) => course.myProgress < 100))
const overall = computed(() =>
  enrolled.value.length === 0 ? 0 : Math.round(enrolled.value.reduce((sum, course) => sum + course.myProgress, 0) / enrolled.value.length),
)
const resumeTarget = computed(() => inProgress.value[0] ?? enrolled.value[0] ?? null)

async function enroll(course: Course) {
  try {
    const updated = await serviceApi.enrollCourse(course.id)
    courses.value = courses.value.map((item) => (item.id === updated.id ? updated : item))
    active.value = updated
    note.value = updated.myNote ?? ''
    message.success(course.enrolled ? '已进入课程学习' : '已报名，进度由你每次推进的学习记录累计')
  } catch (reason) {
    message.error(reason instanceof Error ? reason.message : '报名失败')
  }
}

function openCourse(course: Course) {
  active.value = course
  note.value = course.myNote ?? ''
}

async function advance() {
  if (!active.value) return
  saving.value = true
  try {
    const current = Number(active.value.myProgress ?? 0)
    const next = Math.min(100, current + 25)
    const record = await serviceApi.updateCourseProgress(active.value.id, next)
    message.success(next >= 100 ? `课程学完，平台已签发结业证书 ${record.certNo ?? ''}` : `学习进度已推进到 ${record.progress}%`)
    load()
    const fresh = await serviceApi.courses()
    active.value = fresh.find((item) => item.id === active.value?.id) ?? null
  } catch (reason) {
    message.error(reason instanceof Error ? reason.message : '进度更新失败')
  } finally {
    saving.value = false
  }
}

async function saveNote() {
  if (!active.value) return
  saving.value = true
  try {
    await serviceApi.saveCourseNote(active.value.id, note.value)
    message.success('课堂笔记已保存到本主体的学习记录')
    load()
  } catch (reason) {
    message.error(reason instanceof Error ? reason.message : '保存失败')
  } finally {
    saving.value = false
  }
}
</script>
