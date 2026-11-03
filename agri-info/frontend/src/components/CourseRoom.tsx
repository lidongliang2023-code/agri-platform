import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Modal, Progress, Spin, Tag, message } from 'antd'
import { CheckCircleFilled, LockOutlined } from '@ant-design/icons'
import { infoApi } from '../api'
import type { CourseDetail, PlayTicket } from '../types'
import { ErrorBlock, LoadingBlock } from './ui'
import { CoursePlayer } from './CoursePlayer'

/**
 * 课程学习间：左侧播放器 + 右侧目录。
 *
 * <p>为什么播放地址要单独取：目录接口刻意不下发 videoUrl，每切一节才换一次票。
 * 这样"未报名只能试看第一节"的限制才有意义 —— 否则前端一开弹层就拿到了全课地址。</p>
 */

interface CourseRoomProps {
  courseId: number
  open: boolean
  onClose: () => void
  /** 报名/进度变化后通知列表刷新，避免关掉弹层后卡片还是旧进度。 */
  onChanged?: () => void
}

export function CourseRoom({ courseId, open, onClose, onChanged }: CourseRoomProps): JSX.Element {
  const [detail, setDetail] = useState<CourseDetail | null>(null)
  const [error, setError] = useState('')
  const [lessonId, setLessonId] = useState(0)
  const [ticket, setTicket] = useState<PlayTicket | null>(null)
  const [loadingTicket, setLoadingTicket] = useState(false)
  const [enrolling, setEnrolling] = useState(false)
  const [retried, setRetried] = useState(false)

  const loadDetail = useCallback(async (): Promise<CourseDetail | null> => {
    setError('')
    try {
      const data = await infoApi.courseDetail(courseId)
      setDetail(data)
      setLessonId((current) => (current && data.lessons.some((item) => item.id === current)
        ? current
        : data.lastLessonId || data.lessons[0]?.id || 0))
      return data
    } catch (reason) {
      setError((reason as Error).message)
      return null
    }
  }, [courseId])

  useEffect(() => {
    if (!open) {
      setDetail(null)
      setLessonId(0)
      setTicket(null)
      setError('')
      return
    }
    void loadDetail()
  }, [open, loadDetail])

  const fetchTicket = useCallback(async (id: number): Promise<PlayTicket | null> => {
    setLoadingTicket(true)
    try {
      const result = await infoApi.playTicket(courseId, id)
      setTicket(result)
      return result
    } catch (reason) {
      setTicket(null)
      message.error((reason as Error).message)
      return null
    } finally {
      setLoadingTicket(false)
    }
  }, [courseId])

  useEffect(() => {
    if (!lessonId) {
      setTicket(null)
      return
    }
    setRetried(false)
    void fetchTicket(lessonId)
  }, [lessonId, fetchTicket])

  const current = useMemo(
    () => detail?.lessons.find((item) => item.id === lessonId) ?? null,
    [detail, lessonId],
  )

  const report = useCallback((positionSec: number, finished = false): void => {
    if (!lessonId) return
    // 进度上报失败不打扰用户：下一次上报会带着更大的 positionSec 覆盖，
    // 弹提示反而会让"看视频时不断弹错"变成新的体验问题。
    infoApi.reportProgress(courseId, lessonId, { positionSec, finished }).catch(() => undefined)
  }, [courseId, lessonId])

  /** 播放失败只重试一次。反复重试会在地址真的不可用时变成死循环。 */
  const handleFailed = (): void => {
    if (retried) {
      message.warning('视频加载失败，请稍后重试或联系运营')
      return
    }
    setRetried(true)
    void fetchTicket(lessonId)
  }

  const handleEnded = (): void => {
    report(current?.durationSec ?? 0, true)
    if (!detail) return
    const index = detail.lessons.findIndex((item) => item.id === lessonId)
    const next = detail.lessons[index + 1]
    if (next) {
      setLessonId(next.id)
    } else {
      message.success('本课程已学完')
      onChanged?.()
    }
  }

  const handleEnroll = (): void => {
    setEnrolling(true)
    infoApi.enrollCourse(courseId)
      .then((result) => {
        message.success(result.message)
        onChanged?.()
        return loadDetail()
      })
      .catch((reason: Error) => message.error(reason.message))
      .finally(() => setEnrolling(false))
  }

  const canPlay = Boolean(current?.playable)

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={940}
      title={detail ? `${detail.title} · ${detail.teacher}` : '课程学习'}
      styles={{ body: { paddingTop: 12 } }}
    >
      {error && <ErrorBlock message={error} onRetry={() => void loadDetail()} />}
      {!detail && !error && <LoadingBlock rows={3} />}

      {detail && (
        <div className="course-room">
          <div className="course-room-stage">
            {ticket && canPlay ? (
              <CoursePlayer
                key={ticket.url}
                src={ticket.url}
                initialTime={current?.positionSec ?? 0}
                onProgress={(sec) => report(sec)}
                onEnded={handleEnded}
                onFailed={handleFailed}
              />
            ) : (
              <div className="course-room-placeholder">
                {loadingTicket ? (
                  <Spin />
                ) : !canPlay ? (
                  <>
                    <LockOutlined style={{ fontSize: 22 }} />
                    <span>本节需报名后学习</span>
                    <Button type="primary" loading={enrolling} onClick={handleEnroll}>立即报名</Button>
                  </>
                ) : (
                  <span>请在右侧选择章节</span>
                )}
              </div>
            )}

            <div className="course-room-head">
              <h3>{current ? `${current.seq}. ${current.title}` : '课程目录'}</h3>
              <p>
                {current?.freePreview && <Tag color="green" style={{ marginRight: 6 }}>试看</Tag>}
                {current ? `时长 ${current.durationLabel}` : ''}
                {detail.enrolled ? ' · 已加入学习' : ' · 未报名，仅可试看标注章节'}
              </p>
            </div>

            <div>
              <div className="row between" style={{ marginBottom: 4 }}>
                <span className="small muted">我的学习进度</span>
                <span className="small">{detail.progress}%</span>
              </div>
              <Progress percent={detail.progress} showInfo={false} strokeColor="#12764a" />
            </div>
          </div>

          <aside className="course-room-side">
            <div className="row between" style={{ marginBottom: 2 }}>
              <b style={{ fontSize: 13 }}>课程目录</b>
              <span className="small muted">{detail.lessonCount} 节</span>
            </div>
            {detail.lessons.map((lesson) => (
              <button
                type="button"
                key={lesson.id}
                className={`lesson-item${lesson.id === lessonId ? ' on' : ''}`}
                disabled={!lesson.playable}
                onClick={() => setLessonId(lesson.id)}
              >
                <span className="lesson-seq">
                  {lesson.finished
                    ? <CheckCircleFilled style={{ color: '#12764a' }} />
                    : lesson.playable ? lesson.seq : <LockOutlined />}
                </span>
                <span className="lesson-title">{lesson.title}</span>
                <span className="lesson-meta">
                  {lesson.freePreview && <Tag color="green" style={{ margin: 0, fontSize: 12 }}>试看</Tag>}
                  {lesson.durationLabel}
                </span>
              </button>
            ))}
          </aside>
        </div>
      )}
    </Modal>
  )
}
