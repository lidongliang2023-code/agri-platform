import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BookOutlined,
  ClockCircleOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { App, Button, Input, Modal, Progress, Tag } from 'antd'
import { serviceApi } from '../api'
import type { Certificate, Course } from '../types'
import { EmptyState, LoadingBlock, PageTitle } from '../components/ui'

export function TrainingPage(): JSX.Element {
  const { message } = App.useApp()
  const [courses, setCourses] = useState<Course[]>([])
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<Course | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback((): void => {
    setLoading(true)
    Promise.all([serviceApi.courses(), serviceApi.certificates()])
      .then(([rows, certs]) => {
        setCourses(rows)
        setCertificates(certs)
      })
      .catch((reason: Error) => message.error(reason.message))
      .finally(() => setLoading(false))
  }, [message])

  useEffect(() => {
    load()
  }, [load])

  const enrolled = useMemo(() => courses.filter((course) => course.enrolled), [courses])
  const inProgress = useMemo(() => enrolled.filter((course) => course.myProgress < 100), [enrolled])
  const overall = enrolled.length === 0
    ? 0
    : Math.round(enrolled.reduce((sum, course) => sum + course.myProgress, 0) / enrolled.length)

  const enroll = async (course: Course): Promise<void> => {
    try {
      const updated = await serviceApi.enrollCourse(course.id)
      setCourses((current) => current.map((item) => item.id === updated.id ? updated : item))
      setActive(updated)
      setNote(updated.myNote ?? '')
      message.success(course.enrolled ? '已进入课程学习' : '已报名，进度由你每次推进的学习记录累计')
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : '报名失败')
    }
  }

  const openCourse = (course: Course): void => {
    setActive(course)
    setNote(course.myNote ?? '')
  }

  const advance = async (): Promise<void> => {
    if (!active) return
    setSaving(true)
    try {
      const current = Number(active.myProgress ?? 0)
      const next = Math.min(100, current + 25)
      const record = await serviceApi.updateCourseProgress(active.id, next)
      message.success(next >= 100
        ? `课程学完，平台已签发结业证书 ${record.certNo ?? ''}`
        : `学习进度已推进到 ${record.progress}%`)
      await load()
      const fresh = await serviceApi.courses()
      setActive(fresh.find((item) => item.id === active.id) ?? null)
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : '进度更新失败')
    } finally {
      setSaving(false)
    }
  }

  const saveNote = async (): Promise<void> => {
    if (!active) return
    setSaving(true)
    try {
      await serviceApi.saveCourseNote(active.id, note)
      message.success('课堂笔记已保存到本主体的学习记录')
      load()
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const resumeTarget = inProgress[0] ?? enrolled[0] ?? null

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="AGRICULTURAL ACADEMY"
        title="培训课堂"
        description="线上课程与田间实训；报名、进度与结业证书都由平台按你的学习记录签发。"
        actions={(
          <Button type="primary" icon={<BookOutlined />} disabled={!resumeTarget} onClick={() => resumeTarget && openCourse(resumeTarget)}>
            {resumeTarget ? `继续《${resumeTarget.title.slice(0, 10)}》` : '先报名一门课程'}
          </Button>
        )}
      />

      <section className="training-hero">
        <div>
          <span className="hero-kicker"><i /> 丰链云 · 田间学院</span>
          <h2>把经验变成可复制的方法</h2>
          <p>围绕粮油生产、植保、农机安全与农场经营，提供短课、路径课和实操考核。</p>
          <div className="training-hero-stats">
            <span><b>{enrolled.length}</b> 门已报名</span>
            <span><b>{certificates.length}</b> 张结业证书</span>
            <span><b>{overall}%</b> 平均进度</span>
          </div>
        </div>
        {resumeTarget ? (
          <div className="training-hero-course">
            <span className="training-cover">{resumeTarget.cover}</span>
            <div>
              <small>正在学习</small>
              <h3>{resumeTarget.title}</h3>
              <Progress percent={resumeTarget.myProgress} showInfo={false} strokeColor="#fff" trailColor="rgba(255,255,255,.2)" />
              <p>{resumeTarget.mode} · {resumeTarget.duration}</p>
            </div>
            <button type="button" onClick={() => openCourse(resumeTarget)}>›</button>
          </div>
        ) : (
          <div className="training-hero-course">
            <span className="training-cover">🌾</span>
            <div><small>还没有报名记录</small><h3>从下方挑一门课程开始</h3><p>报名后进度与证书才会在你的主体名下累积。</p></div>
          </div>
        )}
      </section>

      <section className="surface-card detail-section">
        <div className="section-heading compact">
          <div><span className="section-kicker">CATALOG</span><h2>全部课程</h2></div>
          <span className="section-note">共 {courses.length} 门</span>
        </div>
        {loading ? <LoadingBlock rows={3} /> : courses.length === 0 ? <EmptyState title="暂无课程" /> : (
          <div className="course-grid">
            {courses.map((course) => (
              <article key={course.id} className="course-card">
                <div className="course-cover">
                  <span>{course.cover}</span>
                  <small>{course.mode}</small>
                  {course.certNo && <em><Tag color="green">已获证书</Tag></em>}
                </div>
                <div className="course-card-body">
                  <div className="course-tags">{course.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                  <h3>{course.title}</h3>
                  <p>{course.summary}</p>
                  <div className="course-meta"><span><TeamOutlined /> {course.learners} 人学习</span><span><ClockCircleOutlined /> {course.duration}</span></div>
                  {course.enrolled && <Progress percent={course.myProgress} showInfo={false} strokeColor="#159a5e" trailColor="#edf3ef" />}
                  <div className="course-foot">
                    <span>{course.teacher} · <b>★ {course.rating}</b></span>
                    {course.enrolled
                      ? <Button type="primary" ghost onClick={() => openCourse(course)}>进入学习</Button>
                      : <Button onClick={() => void enroll(course)}>免费报名</Button>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="surface-card detail-section">
        <div className="section-heading compact">
          <div><span className="section-kicker">CERTIFICATES</span><h2>我的结业证书</h2></div>
          <span className="section-note">进度到 100% 后由平台签发</span>
        </div>
        {certificates.length === 0 ? (
          <EmptyState icon="🎓" title="还没有证书" description="把任意一门已报名课程学到 100%，平台会自动签发结业证书" />
        ) : (
          <div className="certificate-grid">
            {certificates.map((certificate) => (
              <article key={certificate.certNo}>
                <span><SafetyCertificateOutlined /></span>
                <h3>{certificate.title}</h3>
                <p>{certificate.certNo} · {certificate.completedAt}</p>
                <small>{certificate.teacher} · {certificate.duration} · {certificate.mode}</small>
              </article>
            ))}
          </div>
        )}
      </section>

      <Modal title={active?.title ?? '课程学习'} open={Boolean(active)} onCancel={() => setActive(null)} footer={null} width={760}>
        {active && (
          <div className="course-learning">
            <div className="learning-head">
              <div>
                <h3>{active.cover} {active.title}</h3>
                <p>讲师：{active.teacher} · {active.mode} · {active.duration}</p>
              </div>
              <span className="status-tag tone-green">我的进度 {active.myProgress}%</span>
            </div>
            <Progress percent={active.myProgress} strokeColor="#159a5e" />
            <p className="form-hint">本版没有接入视频播放器，「推进学习进度」按每次 25% 记录你的学习行为；到 100% 由服务端签发证书。</p>
            <div className="course-foot-actions">
              <Button type="primary" loading={saving} disabled={active.myProgress >= 100} onClick={() => void advance()}>
                {active.myProgress >= 100 ? '已完成本课程' : '推进 25% 学习进度'}
              </Button>
              {active.certNo && <Tag color="green">结业证书 {active.certNo}</Tag>}
            </div>
            <label className="note-label">我的学习笔记</label>
            <Input.TextArea value={note} onChange={(event) => setNote(event.target.value)} rows={5} placeholder="记录要点，笔记保存在本主体的学习记录里" />
            <Button loading={saving} onClick={() => void saveNote()}>保存笔记</Button>
          </div>
        )}
      </Modal>
    </div>
  )
}
