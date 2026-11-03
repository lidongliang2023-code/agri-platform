import { useEffect, useState } from 'react'
import { PlayCircleOutlined, StarFilled, TeamOutlined } from '@ant-design/icons'
import { Button, Progress, Tag, message } from 'antd'
import { infoApi } from '../api'
import type { Course } from '../types'
import { CourseRoom } from '../components/CourseRoom'
import { EmptyState, ErrorBlock, LoadingBlock, PageTitle, SectionHeading, StatTile, formatCount } from '../components/ui'

/**
 * 培训课堂：录播课程为主，直播课以「回放」形态挂在同一套章节结构里。
 *
 * <p>列表里的 progress 是后端按当前统一账号算出来的个人进度，
 * 不再是 info_course.progress 那个全站共享的数字，所以"已学完"统计才有意义。</p>
 */
export function TrainingPage(): JSX.Element {
  const [data, setData] = useState<{ items: Course[]; live: Course | null; learners: number } | null>(null)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('全部')
  const [enrolling, setEnrolling] = useState(0)
  const [roomCourseId, setRoomCourseId] = useState(0)
  const [roomOpen, setRoomOpen] = useState(false)

  const load = (): void => {
    setError('')
    infoApi.courses()
      .then(setData)
      .catch((reason: Error) => setError(reason.message))
  }

  useEffect(load, [])

  const openRoom = (course: Course): void => {
    setRoomCourseId(course.id)
    setRoomOpen(true)
  }

  const enroll = (course: Course): void => {
    setEnrolling(course.id)
    infoApi.enrollCourse(course.id)
      .then((result) => {
        message.success(result.message)
        // 报名后重新拉列表：enrolled / progress 都由后端按当前账号重算，本地改容易算错
        load()
        openRoom(course)
      })
      .catch((reason: Error) => message.error(reason.message))
      .finally(() => setEnrolling(0))
  }

  if (!data && !error) return <LoadingBlock rows={4} />
  if (error || !data) return <ErrorBlock message={error} onRetry={load} />

  const visible = mode === '全部' ? data.items : data.items.filter((item) => item.mode === mode)
  const finished = data.items.filter((item) => item.progress >= 100).length

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="TRAINING"
        title="培训课堂"
        description="农技专家授课 + 体系化录播课程 · 学完可获平台结业证明 · 支持手机端碎片化学习"
      />

      <div className="grid-4">
        <StatTile label="在线课程" value={data.items.length} unit="门" note={`录播 ${data.items.filter((item) => item.mode === '录播').length} 门`} />
        <StatTile label="累计学员" value={formatCount(data.learners)} unit="人次" note="含重复学习" tone="up" />
        <StatTile label="已学完课程" value={finished} unit="门" note="进度 100%" />
        <StatTile label="直播回放" value={data.live ? 1 : 0} unit="场" note={data.live ? data.live.liveAt : '暂无直播课'} tone="warn" />
      </div>

      {data.live && (
        <section className="live-card">
          <div className="live-left">
            <span className="live-flag">● 直播课</span>
            <h2>{data.live.title}</h2>
            <p>{data.live.summary}</p>
            <div className="row" style={{ gap: 14, flexWrap: 'wrap' }}>
              <span className="small muted">讲师 {data.live.teacher}</span>
              <span className="small muted">{data.live.duration}</span>
              <span className="small muted"><TeamOutlined /> {formatCount(data.live.learners)} 人在学</span>
              <span className="small muted"><StarFilled /> {data.live.rating.toFixed(1)}</span>
            </div>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              style={{ marginTop: 14 }}
              onClick={() => data.live && openRoom(data.live)}
            >
              进入课程
            </Button>
          </div>
          <div className="live-right">{data.live.coverIcon}</div>
        </section>
      )}

      <section className="surface-card">
        <div className="row between" style={{ marginBottom: 14 }}>
          <SectionHeading kicker="COURSES" title="全部课程" />
          <div className="chip-row">
            {['全部', '直播', '录播'].map((item) => (
              <button type="button" key={item} className={`chip${mode === item ? ' on' : ''}`} onClick={() => setMode(item)}>{item}</button>
            ))}
          </div>
        </div>

        {visible.length === 0 && <EmptyState icon="🎓" title="暂无课程" description="换个分类看看。" />}

        <div className="grid-2">
          {visible.map((course) => (
            <article className="course-card" key={course.id}>
              <div className="course-cover">{course.coverIcon}</div>
              <div className="course-body">
                <div className="row between">
                  <b style={{ fontSize: 14 }}>{course.title}</b>
                  <Tag className={`soft-tag ${course.mode === '直播' ? 'tone-up' : ''}`}>{course.mode}</Tag>
                </div>
                <p className="small muted" style={{ margin: '6px 0' }}>{course.summary}</p>
                <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
                  <span className="small muted">{course.teacher}</span>
                  <span className="small muted">{course.duration}</span>
                  <span className="small muted"><TeamOutlined /> {formatCount(course.learners)}</span>
                  <span className="small muted"><StarFilled /> {course.rating.toFixed(1)}</span>
                </div>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {course.tags.map((tag) => <Tag className="soft-tag" key={tag}>{tag}</Tag>)}
                </div>
                {course.progress > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div className="row between">
                      <span className="small muted">我的学习进度</span>
                      <span className="small">{course.progress}%</span>
                    </div>
                    <Progress percent={course.progress} showInfo={false} strokeColor="#12764a" />
                  </div>
                )}
                <div className="row" style={{ gap: 8, marginTop: 12 }}>
                  {!course.enrolled && (
                    <Button size="small" type="primary" loading={enrolling === course.id} onClick={() => enroll(course)}>
                      立即报名
                    </Button>
                  )}
                  <Button
                    size="small"
                    type={course.enrolled ? 'primary' : 'default'}
                    ghost={course.enrolled}
                    onClick={() => openRoom(course)}
                  >
                    {course.enrolled ? (course.progress > 0 ? '继续学习' : '开始学习') : '查看目录'}
                  </Button>
                  <Button size="small" onClick={() => message.info('已收藏，可在我的收藏中查看')}>收藏</Button>
                  {course.isLive && <span className="small" style={{ color: '#c62828' }}>● {course.liveAt}</span>}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {roomCourseId > 0 && (
        <CourseRoom
          courseId={roomCourseId}
          open={roomOpen}
          onClose={() => setRoomOpen(false)}
          onChanged={load}
        />
      )}
    </div>
  )
}
