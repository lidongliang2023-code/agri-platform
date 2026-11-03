import { useEffect, useState } from 'react'
import {
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Progress,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Upload,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined, UploadOutlined } from '@ant-design/icons'
import { opsApi } from '../api'
import type { OpsCourse, OpsLesson } from '../types'
import { ErrorBlock, LoadingBlock, PageTitle, SectionHeading, StatTile, formatCount } from '../components/ui'

/**
 * 培训课程管理：课程 → 章节 → 视频文件。
 *
 * <p>视频走「先上传拿相对路径，再写进章节」两步：上传接口只负责落盘并返回
 * {@code course-2/lesson-xxx.mp4}，播放地址由用户端 play-ticket 现场签发。
 * 运营端这里永远看不到签名地址，也就不存在"复制一个链接就能绕过报名"的漏洞。</p>
 */
export function CoursesPage(): JSX.Element {
  const [courses, setCourses] = useState<OpsCourse[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const [courseOpen, setCourseOpen] = useState(false)
  const [courseForm] = Form.useForm<Record<string, unknown>>()
  const [editingCourse, setEditingCourse] = useState<OpsCourse | null>(null)
  const [saving, setSaving] = useState(false)

  const [lessonCourse, setLessonCourse] = useState<OpsCourse | null>(null)
  const [lessons, setLessons] = useState<OpsLesson[]>([])
  const [lessonsLoading, setLessonsLoading] = useState(false)
  const [lessonOpen, setLessonOpen] = useState(false)
  const [lessonForm] = Form.useForm<Record<string, unknown>>()
  const [editingLesson, setEditingLesson] = useState<OpsLesson | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)

  const load = (): void => {
    setError('')
    opsApi.courses()
      .then((result) => setCourses(result.items))
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const loadLessons = (course: OpsCourse): void => {
    setLessonsLoading(true)
    opsApi.courseLessons(course.id)
      .then(setLessons)
      .catch((reason: Error) => message.error(reason.message))
      .finally(() => setLessonsLoading(false))
  }

  // ---------- 课程 ----------

  const openCourse = (course?: OpsCourse): void => {
    setEditingCourse(course ?? null)
    courseForm.resetFields()
    courseForm.setFieldsValue(course
      ? {
        title: course.title,
        teacher: course.teacher,
        mode: course.mode,
        coverIcon: course.coverIcon,
        summary: course.summary,
        tags: course.tags.join(','),
        status: course.status,
        isLive: course.isLive,
        liveAt: course.liveAt,
      }
      : { mode: '录播', coverIcon: '📘', status: 'draft', isLive: false })
    setCourseOpen(true)
  }

  const submitCourse = (values: Record<string, unknown>): void => {
    setSaving(true)
    const body = {
      ...values,
      id: editingCourse?.id ?? 0,
      tags: String(values.tags ?? ''),
    }
    opsApi.saveCourse(body)
      .then(() => {
        message.success(editingCourse ? '课程已更新' : '课程已创建，请继续添加章节与视频')
        setCourseOpen(false)
        load()
      })
      .catch((reason: Error) => message.error(reason.message))
      .finally(() => setSaving(false))
  }

  const togglePublish = (course: OpsCourse): void => {
    const next = course.status === 'published' ? 'draft' : 'published'
    opsApi.publishCourse(course.id, next)
      .then((result) => {
        message.success(result.message)
        load()
      })
      .catch((reason: Error) => message.error(reason.message))
  }

  const removeCourse = (course: OpsCourse): void => {
    opsApi.deleteCourse(course.id)
      .then((result) => {
        message.success(result.message)
        load()
      })
      .catch((reason: Error) => message.error(reason.message))
  }

  // ---------- 章节 ----------

  const openLessons = (course: OpsCourse): void => {
    setLessonCourse(course)
    setLessons([])
    loadLessons(course)
  }

  const openLesson = (lesson?: OpsLesson): void => {
    setEditingLesson(lesson ?? null)
    lessonForm.resetFields()
    lessonForm.setFieldsValue(lesson
      ? {
        seq: lesson.seq,
        title: lesson.title,
        durationSec: lesson.durationSec,
        videoUrl: lesson.videoUrl,
        freePreview: lesson.freePreview,
        status: lesson.status,
      }
      : { freePreview: false, status: 'published', durationSec: 0 })
    setUploadPercent(0)
    setLessonOpen(true)
  }

  const submitLesson = (values: Record<string, unknown>): void => {
    if (!lessonCourse) return
    setSaving(true)
    opsApi.saveLesson(lessonCourse.id, { ...values, id: editingLesson?.id ?? 0 })
      .then((result) => {
        message.success(editingLesson ? '章节已更新' : '章节已添加')
        setLessons(result.lessons)
        setLessonOpen(false)
        load()
      })
      .catch((reason: Error) => message.error(reason.message))
      .finally(() => setSaving(false))
  }

  const removeLesson = (lesson: OpsLesson): void => {
    if (!lessonCourse) return
    opsApi.deleteLesson(lessonCourse.id, lesson.id)
      .then((result) => {
        message.success('章节已删除')
        setLessons(result.lessons)
        load()
      })
      .catch((reason: Error) => message.error(reason.message))
  }

  /** 上传视频：先本地预检编码，再上传，拿到相对路径写进表单并顺手读出时长。 */
  const handleUpload = async (file: File): Promise<void> => {
    if (!lessonCourse) return

    // 先在浏览器里解一遍：H.265/HEVC 这类编码上传能成功、播放却黑屏且不报错，
    // 与其等几分钟传完再发现，不如选完文件就告诉运营。
    const probe = await probeVideo(file)
    if (!probe.playable) {
      message.error(
        '这个视频浏览器无法解码（常见于手机直拍的 H.265/HEVC）。'
        + '请先转成 H.264 的 mp4 再上传：ffmpeg -i 原文件 -c:v libx264 -crf 23 -pix_fmt yuv420p -c:a aac -movflags +faststart 输出.mp4',
        10,
      )
      return
    }

    setUploading(true)
    setUploadPercent(0)
    try {
      const result = await opsApi.uploadMedia(lessonCourse.id, file, setUploadPercent)
      lessonForm.setFieldValue('videoUrl', result.url)
      if (probe.duration > 0) {
        lessonForm.setFieldValue('durationSec', Math.round(probe.duration))
      }
      message.success(`上传完成：${result.originalName}（${result.codec ?? '已通过校验'}）`)
    } catch (reason) {
      message.error((reason as Error).message)
    } finally {
      setUploading(false)
      setUploadPercent(0)
    }
  }

  const columns: ColumnsType<OpsCourse> = [
    {
      title: '课程',
      dataIndex: 'title',
      render: (_, row) => (
        <div className="row" style={{ gap: 10 }}>
          <span style={{ fontSize: 22 }}>{row.coverIcon}</span>
          <div>
            <b style={{ fontSize: 13 }}>{row.title}</b>
            <div className="small muted">{row.teacher}</div>
          </div>
        </div>
      ),
    },
    { title: '形式', dataIndex: 'mode', width: 80, render: (value: string) => <Tag>{value}</Tag> },
    {
      title: '章节',
      dataIndex: 'lessonCount',
      width: 90,
      render: (value: number) => (
        value > 0 ? <span>{value} 节</span> : <Tag color="orange">未配置</Tag>
      ),
    },
    { title: '学员', dataIndex: 'learners', width: 90, render: (value: number) => formatCount(value) },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (value: string) => (
        <Tag color={value === 'published' ? 'green' : 'default'}>
          {value === 'published' ? '已上架' : '草稿'}
        </Tag>
      ),
    },
    {
      title: '操作',
      width: 260,
      render: (_, row) => (
        <Space size={4}>
          <Button size="small" onClick={() => openLessons(row)}>章节与视频</Button>
          <Button size="small" onClick={() => openCourse(row)}>编辑</Button>
          <Button size="small" onClick={() => togglePublish(row)}>
            {row.status === 'published' ? '下架' : '上架'}
          </Button>
          <Popconfirm
            title="删除课程"
            description="章节与学习记录会一并删除，确定吗？"
            onConfirm={() => removeCourse(row)}
          >
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const lessonColumns: ColumnsType<OpsLesson> = [
    { title: '#', dataIndex: 'seq', width: 50 },
    { title: '章节标题', dataIndex: 'title' },
    {
      title: '时长',
      dataIndex: 'durationSec',
      width: 90,
      render: (value: number) => (value > 0 ? formatSeconds(value) : <Tag color="orange">未知</Tag>),
    },
    {
      title: '视频文件',
      dataIndex: 'videoUrl',
      width: 230,
      render: (value: string) => <span className="small muted" style={{ wordBreak: 'break-all' }}>{value}</span>,
    },
    {
      title: '试看',
      dataIndex: 'freePreview',
      width: 70,
      render: (value: boolean) => (value ? <Tag color="green">试看</Tag> : '—'),
    },
    { title: '学习人次', dataIndex: 'learnCount', width: 90 },
    {
      title: '操作',
      width: 140,
      render: (_, row) => (
        <Space size={4}>
          <Button size="small" onClick={() => openLesson(row)}>编辑</Button>
          <Popconfirm title="删除该章节？" onConfirm={() => removeLesson(row)}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  if (loading) return <LoadingBlock rows={4} />
  if (error) return <ErrorBlock message={error} onRetry={load} />

  const published = courses.filter((item) => item.status === 'published').length
  const totalLessons = courses.reduce((sum, item) => sum + item.lessonCount, 0)
  const missingVideo = courses.filter((item) => item.lessonCount === 0).length

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="TRAINING"
        title="培训课程"
        description="课程 → 章节 → 视频。视频上传后自动填入章节路径，播放地址由用户端逐节换票，不对外暴露直链"
      />

      <div className="grid-4">
        <StatTile label="课程总数" value={courses.length} unit="门" note={`已上架 ${published} 门`} />
        <StatTile label="章节总数" value={totalLessons} unit="节" note="含草稿章节" />
        <StatTile label="待补视频" value={missingVideo} unit="门" note="一节都没有的课程" tone={missingVideo > 0 ? 'warn' : 'flat'} />
        <StatTile
          label="累计学员"
          value={formatCount(courses.reduce((sum, item) => sum + item.learners, 0))}
          unit="人次"
          note="含重复学习"
          tone="up"
        />
      </div>

      <section className="surface-card">
        <div className="row between" style={{ marginBottom: 14 }}>
          <SectionHeading kicker="COURSES" title="课程列表" />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openCourse()}>新建课程</Button>
        </div>

        <Table
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={courses}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
        />
      </section>

      {/* 课程表单 */}
      <Modal
        open={courseOpen}
        title={editingCourse ? `编辑课程 · ${editingCourse.title}` : '新建课程'}
        onCancel={() => setCourseOpen(false)}
        onOk={() => courseForm.submit()}
        confirmLoading={saving}
        width={620}
      >
        <Form form={courseForm} layout="vertical" onFinish={submitCourse}>
          <Form.Item name="title" label="课程标题" rules={[{ required: true, message: '请填写课程标题' }]}>
            <Input placeholder="如：水稻病虫害绿色防控实战" />
          </Form.Item>
          <div className="grid-2">
            <Form.Item name="teacher" label="讲师">
              <Input placeholder="如：王新民 高级农艺师" />
            </Form.Item>
            <Form.Item name="mode" label="课程形式">
              <Select options={[{ value: '录播' }, { value: '直播' }]} />
            </Form.Item>
          </div>
          <div className="grid-2">
            <Form.Item name="coverIcon" label="封面图标" tooltip="暂用 emoji 作封面，后续可换成图片">
              <Input placeholder="📘" />
            </Form.Item>
            <Form.Item name="tags" label="标签" tooltip="多个标签用英文逗号分隔">
              <Input placeholder="水稻,病虫害,绿色防控" />
            </Form.Item>
          </div>
          <Form.Item name="summary" label="课程简介">
            <Input.TextArea rows={3} placeholder="一句话说明这门课解决什么问题" />
          </Form.Item>
          <div className="grid-2">
            <Form.Item name="status" label="状态">
              <Select options={[{ value: 'draft', label: '草稿' }, { value: 'published', label: '已上架' }]} />
            </Form.Item>
            <Form.Item name="isLive" label="标记为直播课" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
          <Form.Item noStyle shouldUpdate={(prev, next) => prev.isLive !== next.isLive}>
            {({ getFieldValue }) => (getFieldValue('isLive') ? (
              <Form.Item name="liveAt" label="直播时间文案">
                <Input placeholder="今天 19:30" />
              </Form.Item>
            ) : null)}
          </Form.Item>
        </Form>
      </Modal>

      {/* 章节与视频 */}
      <Drawer
        open={Boolean(lessonCourse)}
        onClose={() => setLessonCourse(null)}
        width={920}
        title={lessonCourse ? `章节与视频 · ${lessonCourse.title}` : ''}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openLesson()}>新增章节</Button>}
      >
        <Table
          rowKey="id"
          size="small"
          loading={lessonsLoading}
          columns={lessonColumns}
          dataSource={lessons}
          pagination={false}
          locale={{ emptyText: '还没有章节。先上传视频，再点「新增章节」把文件挂上去。' }}
        />
      </Drawer>

      {/* 章节表单 */}
      <Modal
        open={lessonOpen}
        title={editingLesson ? '编辑章节' : '新增章节'}
        onCancel={() => setLessonOpen(false)}
        onOk={() => lessonForm.submit()}
        confirmLoading={saving}
        width={600}
      >
        <Form form={lessonForm} layout="vertical" onFinish={submitLesson}>
          <div className="grid-2">
            <Form.Item name="seq" label="序号" tooltip="留空自动排在最后">
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="title" label="章节标题" rules={[{ required: true, message: '请填写章节标题' }]}>
              <Input placeholder="如：稻瘟病识别与分级" />
            </Form.Item>
          </div>

          <Form.Item
            name="videoUrl"
            label="视频路径"
            rules={[{ required: true, message: '请上传视频或填写相对路径' }]}
            extra="相对 /vod/ 的路径，如 course-2/lesson-20261028-153012-a1b2.mp4"
          >
            <Input placeholder="上传后自动填充" />
          </Form.Item>

          <Form.Item label="上传视频">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Upload
                accept="video/mp4,video/quicktime,video/webm"
                showUploadList={false}
                beforeUpload={(file) => {
                  void handleUpload(file as unknown as File)
                  return false
                }}
              >
                <Button icon={<UploadOutlined />} loading={uploading}>选择文件上传</Button>
              </Upload>
              {uploading && <Progress percent={uploadPercent} size="small" />}
              <span className="small muted">
                支持 mp4 / mov / webm，单文件上限 2GB。上传完成后会自动填入上方路径并读取时长。
              </span>
            </Space>
          </Form.Item>

          <div className="grid-2">
            <Form.Item name="durationSec" label="时长（秒）" tooltip="上传视频后自动读取，也可手填">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="freePreview" label="允许试看" valuePropName="checked" tooltip="未报名用户也能播这一节">
              <Switch />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

function formatSeconds(seconds: number): string {
  const hour = Math.floor(seconds / 3600)
  const minute = Math.floor((seconds % 3600) / 60)
  const second = seconds % 60
  return hour > 0
    ? `${hour}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`
    : `${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`
}

/**
 * 用浏览器自己解一遍本地视频。
 *
 * <p>判据是 {@code videoWidth} 而不是 {@code error}：解不了的编码（HEVC 等）
 * 不会触发 error，readyState 照样到 4、时长也读得出，只有画面尺寸是 0。
 * 这正好解释了"上传成功但播放黑屏、控制台还没有报错"的现象。</p>
 */
function probeVideo(file: File): Promise<{ playable: boolean; duration: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const element = document.createElement('video')
    element.preload = 'metadata'
    element.muted = true
    let settled = false
    const finish = (playable: boolean): void => {
      if (settled) return
      settled = true
      const duration = Number.isFinite(element.duration) ? element.duration : 0
      URL.revokeObjectURL(url)
      element.remove()
      resolve({ playable, duration })
    }
    element.onloadedmetadata = () => finish(element.videoWidth > 0)
    element.onerror = () => finish(false)
    // 极少数文件 metadata 迟迟不来，别把上传按钮一直卡在 loading
    setTimeout(() => finish(element.videoWidth > 0), 8000)
    element.src = url
  })
}
