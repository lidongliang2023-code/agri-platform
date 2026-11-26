import { defineComponent, ref, computed, onMounted } from 'vue';
import { useFormModel } from '../components/vue-form';
import { Button, Drawer, Form, Input, InputNumber, Modal, Progress, Select, Space, Switch, Table, Tag, Upload, message } from "../components/vue-ui";
import type { ColumnsType } from "ant-design-vue/es/table";
import { PlusOutlined, UploadOutlined } from "@ant-design/icons-vue";
import { opsApi } from '../api';
import type { OpsCourse, OpsLesson } from '../types';
import { InfoFilters, InfoList, InfoRowActions } from '../components/InfoList';
import { ErrorBlock, LoadingBlock, PageTitle, StatTile, formatCount } from '../components/ui';

/**
 * 培训课程管理：课程 → 章节 → 视频文件。
 *
 * <p>视频走「先上传拿相对路径，再写进章节」两步：上传接口只负责落盘并返回
 * {@code course-2/lesson-xxx.mp4}，播放地址由用户端 play-ticket 现场签发。
 * 运营端这里永远看不到签名地址，也就不存在"复制一个链接就能绕过报名"的漏洞。</p>
 */
export const CoursesPage = defineComponent({
  name: "CoursesPage",
  props: {},
  setup() {
    const courses = ref<OpsCourse[]>([]);
    const error = ref('');
    const loading = ref(true);
    const draft = ref('');
    const keyword = ref('');
    const statusFilter = ref('');
    const modeFilter = ref('');
    const courseOpen = ref(false);
    const courseForm = useFormModel();
    const editingCourse = ref<OpsCourse | null>(null);
    const saving = ref(false);
    const lessonCourse = ref<OpsCourse | null>(null);
    const lessons = ref<OpsLesson[]>([]);
    const lessonsLoading = ref(false);
    const lessonOpen = ref(false);
    const lessonForm = useFormModel();
    const editingLesson = ref<OpsLesson | null>(null);
    const uploading = ref(false);
    const uploadPercent = ref(0);

    const load = (): void => {
      loading.value = true;
      error.value = '';
      opsApi.courses()
        .then(result => { courses.value = result.items; })
        .catch((reason: Error) => { error.value = reason.message; })
        .finally(() => { loading.value = false; });
    };

    onMounted(load);

    const filteredCourses = computed(() => {
      const q = keyword.value.trim().toLowerCase();
      return courses.value.filter(c => {
        if (statusFilter.value && c.status !== statusFilter.value) return false;
        if (modeFilter.value && c.mode !== modeFilter.value) return false;
        if (!q) return true;
        return `${c.title} ${c.teacher} ${c.summary ?? ''}`.toLowerCase().includes(q);
      });
    });

    const loadLessons = (course: OpsCourse): void => {
      lessonsLoading.value = true;
      opsApi.courseLessons(course.id)
        .then(res => { lessons.value = res; })
        .catch((reason: Error) => message.error(reason.message))
        .finally(() => { lessonsLoading.value = false; });
    };

    const openCourse = (course?: OpsCourse): void => {
      editingCourse.value = course ?? null;
      courseForm.resetFields();
      courseForm.setFieldsValue(course ? {
        title: course.title,
        teacher: course.teacher,
        mode: course.mode,
        coverIcon: course.coverIcon,
        summary: course.summary,
        tags: course.tags.join(','),
        status: course.status,
        isLive: course.isLive,
        liveAt: course.liveAt
      } : {
        mode: '录播',
        coverIcon: '📘',
        status: 'draft',
        isLive: false
      });
      courseOpen.value = true;
    };

    const submitCourse = (values: Record<string, unknown>): void => {
      saving.value = true;
      const body = {
        ...values,
        id: editingCourse.value?.id ?? 0,
        tags: String(values.tags ?? '')
      };
      opsApi.saveCourse(body)
        .then(() => {
          message.success(editingCourse.value ? '课程已更新' : '课程已创建，请继续添加章节与视频');
          courseOpen.value = false;
          load();
        })
        .catch((reason: Error) => message.error(reason.message))
        .finally(() => { saving.value = false; });
    };

    const togglePublish = (course: OpsCourse): void => {
      const next = course.status === 'published' ? 'draft' : 'published';
      opsApi.publishCourse(course.id, next)
        .then(result => {
          message.success(result.message);
          load();
        })
        .catch((reason: Error) => message.error(reason.message));
    };

    const removeCourse = (course: OpsCourse): void => {
      opsApi.deleteCourse(course.id)
        .then(result => {
          message.success(result.message);
          load();
        })
        .catch((reason: Error) => message.error(reason.message));
    };

    const openLessons = (course: OpsCourse): void => {
      lessonCourse.value = course;
      lessons.value = [];
      loadLessons(course);
    };

    const openLesson = (lesson?: OpsLesson): void => {
      editingLesson.value = lesson ?? null;
      lessonForm.resetFields();
      lessonForm.setFieldsValue(lesson ? {
        seq: lesson.seq,
        title: lesson.title,
        durationSec: lesson.durationSec,
        videoUrl: lesson.videoUrl,
        freePreview: lesson.freePreview,
        status: lesson.status
      } : {
        freePreview: false,
        status: 'published',
        durationSec: 0
      });
      uploadPercent.value = 0;
      lessonOpen.value = true;
    };

    const submitLesson = (values: Record<string, unknown>): void => {
      if (!lessonCourse.value) return;
      saving.value = true;
      opsApi.saveLesson(lessonCourse.value.id, {
        ...values,
        id: editingLesson.value?.id ?? 0
      })
        .then(result => {
          message.success(editingLesson.value ? '章节已更新' : '章节已添加');
          lessons.value = result.lessons;
          lessonOpen.value = false;
          load();
        })
        .catch((reason: Error) => message.error(reason.message))
        .finally(() => { saving.value = false; });
    };

    const removeLesson = (lesson: OpsLesson): void => {
      if (!lessonCourse.value) return;
      opsApi.deleteLesson(lessonCourse.value.id, lesson.id)
        .then(result => {
          message.success('章节已删除');
          lessons.value = result.lessons;
          load();
        })
        .catch((reason: Error) => message.error(reason.message));
    };

    const handleUpload = async (file: File): Promise<void> => {
      if (!lessonCourse.value) return;
      const probe = await probeVideo(file);
      if (!probe.playable) {
        message.error('这个视频浏览器无法解码（常见于手机直拍的 H.265/HEVC）。请先转成 H.264 的 mp4 再上传：ffmpeg -i 原文件 -c:v libx264 -crf 23 -pix_fmt yuv420p -c:a aac -movflags +faststart 输出.mp4', 10);
        return;
      }
      uploading.value = true;
      uploadPercent.value = 0;
      try {
        const result = await opsApi.uploadMedia(lessonCourse.value.id, file, p => { uploadPercent.value = p; });
        lessonForm.setFieldValue('videoUrl', result.url);
        if (probe.duration > 0) {
          lessonForm.setFieldValue('durationSec', Math.round(probe.duration));
        }
        message.success(`上传完成：${result.originalName}（${result.codec ?? '已通过校验'}）`);
      } catch (reason) {
        message.error((reason as Error).message);
      } finally {
        uploading.value = false;
        uploadPercent.value = 0;
      }
    };

    const lessonColumns = computed<ColumnsType<OpsLesson>>(() => [{
      title: '#',
      dataIndex: 'seq',
      width: 50
    }, {
      title: '章节标题',
      dataIndex: 'title'
    }, {
      title: '时长',
      dataIndex: 'durationSec',
      width: 90,
      customRender: ({ text: value }: { text: any }) => value > 0 ? formatSeconds(value) : <Tag color="orange">未知</Tag>
    }, {
      title: '视频文件',
      dataIndex: 'videoUrl',
      width: 230,
      customRender: ({ text: value }: { text: any }) => <span class="small muted" style={{ wordBreak: 'break-all' }}>{value}</span>
    }, {
      title: '试看',
      dataIndex: 'freePreview',
      width: 70,
      customRender: ({ text: value }: { text: any }) => value ? <Tag color="green">试看</Tag> : '—'
    }, {
      title: '学习人次',
      dataIndex: 'learnCount',
      width: 90
    }, {
      title: '操作',
      width: 120,
      customRender: ({ record: row }: { record: OpsLesson }) => (
        <InfoRowActions
          actions={[
            { key: 'edit', label: '编辑', onClick: () => openLesson(row) },
            {
              key: 'delete',
              label: '删除',
              danger: true,
              onClick: () => {
                Modal.confirm({
                  title: '删除该章节？',
                  okButtonProps: { danger: true },
                  onOk: () => removeLesson(row),
                });
              },
            },
          ]}
        />
      )
    }]);

    return () => {
      if (loading.value && !courses.value.length) return <LoadingBlock rows={4} />;
      if (error.value) return <ErrorBlock message={error.value} onRetry={load} />;
      const published = courses.value.filter(item => item.status === 'published').length;
      const totalLessons = courses.value.reduce((sum, item) => sum + item.lessonCount, 0);
      const missingVideo = courses.value.filter(item => item.lessonCount === 0).length;
      return (
        <div class="page-stack">
          <PageTitle
            eyebrow="TRAINING"
            title="培训课程"
            description="课程 → 章节 → 视频。视频上传后自动填入章节路径，播放地址由用户端逐节换票，不对外暴露直链"
          />

          <div class="grid-4">
            <StatTile label="课程总数" value={courses.value.length} unit="门" note={`已上架 ${published} 门`} />
            <StatTile label="章节总数" value={totalLessons} unit="节" note="含草稿章节" />
            <StatTile label="待补视频" value={missingVideo} unit="门" note="一节都没有的课程" tone={missingVideo > 0 ? 'warn' : 'flat'} />
            <StatTile label="累计学员" value={formatCount(courses.value.reduce((sum, item) => sum + item.learners, 0))} unit="人次" note="含重复学习" tone="up" />
          </div>

          <InfoList
            listId="courses"
            rowKey="id"
            loading={loading.value}
            dataSource={filteredCourses.value}
            onRefresh={load}
            filterSlot={
              <InfoFilters
                loading={loading.value}
                fields={[
                  {
                    label: '关键字',
                    control: (
                      <Input
                        allowClear
                        value={draft.value}
                        placeholder="搜索课程标题 / 讲师 / 简介"
                        onChange={(e: any) => { draft.value = e.target?.value ?? ''; }}
                        onPressEnter={() => { keyword.value = draft.value.trim(); }}
                      />
                    ),
                  },
                  {
                    label: '课程形式',
                    control: (
                      <Select
                        value={modeFilter.value}
                        options={[
                          { value: '', label: '全部形式' },
                          { value: '录播', label: '录播' },
                          { value: '直播', label: '直播' },
                        ]}
                        onChange={v => { modeFilter.value = String(v ?? ''); }}
                      />
                    ),
                  },
                  {
                    label: '上架状态',
                    control: (
                      <Select
                        value={statusFilter.value}
                        options={[
                          { value: '', label: '全部状态' },
                          { value: 'published', label: '已上架' },
                          { value: 'draft', label: '草稿' },
                        ]}
                        onChange={v => { statusFilter.value = String(v ?? ''); }}
                      />
                    ),
                  },
                ]}
                onQuery={() => { keyword.value = draft.value.trim(); }}
                onReset={() => { draft.value = ''; keyword.value = ''; modeFilter.value = ''; statusFilter.value = ''; }}
              />
            }
            toolbarLeft={<Button type="primary" icon={<PlusOutlined />} onClick={() => openCourse()}>新建课程</Button>}
            columns={[
              {
                title: '课程',
                dataIndex: 'title',
                width: 280,
                render: (_, row: OpsCourse) => (
                  <div class="row" style={{ gap: "10px" }}>
                    <span style={{ fontSize: "22px" }}>{row.coverIcon}</span>
                    <div>
                      <b style={{ fontSize: "13px" }}>{row.title}</b>
                      <div class="small muted">{row.teacher}</div>
                    </div>
                  </div>
                )
              },
              { title: '形式', dataIndex: 'mode', width: 90, render: value => <Tag>{value}</Tag> },
              {
                title: '章节',
                dataIndex: 'lessonCount',
                width: 90,
                render: value => value > 0 ? <span>{value} 节</span> : <Tag color="orange">未配置</Tag>
              },
              { title: '学员', dataIndex: 'learners', width: 90, render: value => formatCount(value) },
              {
                title: '状态',
                dataIndex: 'status',
                width: 100,
                render: value => <Tag color={value === 'published' ? 'green' : 'default'}>{value === 'published' ? '已上架' : '草稿'}</Tag>
              },
              {
                title: '操作',
                key: 'action',
                width: 160,
                fixed: 'right',
                render: (_, row: OpsCourse) => (
                  <InfoRowActions
                    actions={[
                      { key: 'lessons', label: '章节与视频', onClick: () => openLessons(row) },
                      { key: 'edit', label: '编辑', onClick: () => openCourse(row) },
                      {
                        key: 'toggle',
                        label: row.status === 'published' ? '下架' : '上架',
                        onClick: () => togglePublish(row),
                      },
                      {
                        key: 'delete',
                        label: '删除',
                        danger: true,
                        onClick: () => {
                          Modal.confirm({
                            title: '删除课程',
                            content: '章节与学习记录会一并删除，确定吗？',
                            okButtonProps: { danger: true },
                            onOk: () => removeCourse(row),
                          });
                        },
                      },
                    ]}
                  />
                )
              }
            ]}
          />

          <Modal
            open={courseOpen.value}
            title={editingCourse.value ? `编辑课程 · ${editingCourse.value.title}` : '新建课程'}
            onCancel={() => { courseOpen.value = false; }}
            onOk={() => courseForm.submit()}
            confirmLoading={saving.value}
            width={620}
          >
            <Form form={courseForm} layout="vertical" onFinish={submitCourse}>
              <Form.Item name="title" label="课程标题" rules={[{ required: true, message: '请填写课程标题' }]}>
                <Input placeholder="如：水稻病虫害绿色防控实战" />
              </Form.Item>
              <div class="grid-2">
                <Form.Item name="teacher" label="讲师">
                  <Input placeholder="如：王新民 高级农艺师" />
                </Form.Item>
                <Form.Item name="mode" label="课程形式">
                  <Select options={[{ value: '录播' }, { value: '直播' }]} />
                </Form.Item>
              </div>
              <div class="grid-2">
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
              <div class="grid-2">
                <Form.Item name="status" label="状态">
                  <Select options={[{ value: 'draft', label: '草稿' }, { value: 'published', label: '已上架' }]} />
                </Form.Item>
                <Form.Item name="isLive" label="标记为直播课" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </div>
              <Form.Item noStyle shouldUpdate={(prev: Record<string, unknown>, next: Record<string, unknown>) => prev.isLive !== next.isLive}>
                {({ getFieldValue }: { getFieldValue: (key: string) => unknown }) =>
                  getFieldValue('isLive') ? (
                    <Form.Item name="liveAt" label="直播时间文案">
                      <Input placeholder="今天 19:30" />
                    </Form.Item>
                  ) : null
                }
              </Form.Item>
            </Form>
          </Modal>

          <Drawer
            open={Boolean(lessonCourse.value)}
            onClose={() => { lessonCourse.value = null; }}
            width={920}
            title={lessonCourse.value ? `章节与视频 · ${lessonCourse.value.title}` : ''}
            extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openLesson()}>新增章节</Button>}
          >
            <Table
              rowKey="id"
              size="small"
              loading={lessonsLoading.value}
              columns={lessonColumns.value}
              dataSource={lessons.value}
              pagination={false}
              locale={{ emptyText: '还没有章节。先上传视频，再点「新增章节」把文件挂上去。' }}
            />
          </Drawer>

          <Modal
            open={lessonOpen.value}
            title={editingLesson.value ? '编辑章节' : '新增章节'}
            onCancel={() => { lessonOpen.value = false; }}
            onOk={() => lessonForm.submit()}
            confirmLoading={saving.value}
            width={600}
          >
            <Form form={lessonForm} layout="vertical" onFinish={submitLesson}>
              <div class="grid-2">
                <Form.Item name="seq" label="序号" tooltip="留空自动排在最后">
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="title" label="章节标题" rules={[{ required: true, message: '请填写章节标题' }]}>
                  <Input placeholder="如：稻瘟病识别与分级" />
                </Form.Item>
              </div>

              <Form.Item name="videoUrl" label="视频路径" rules={[{ required: true, message: '请上传视频或填写相对路径' }]} extra="相对 /vod/ 的路径，如 course-2/lesson-20261028-153012-a1b2.mp4">
                <Input placeholder="上传后自动填充" />
              </Form.Item>

              <Form.Item label="上传视频">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Upload
                    accept="video/mp4,video/quicktime,video/webm"
                    showUploadList={false}
                    beforeUpload={file => {
                      void handleUpload(file as unknown as File);
                      return false;
                    }}
                  >
                    <Button icon={<UploadOutlined />} loading={uploading.value}>选择文件上传</Button>
                  </Upload>
                  {uploading.value && <Progress percent={uploadPercent.value} size="small" />}
                  <span class="small muted">
                    支持 mp4 / mov / webm，单文件上限 2GB。上传完成后会自动填入上方路径并读取时长。
                  </span>
                </Space>
              </Form.Item>

              <div class="grid-2">
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
      );
    };
  }
});

function formatSeconds(seconds: number): string {
  const hour = Math.floor(seconds / 3600);
  const minute = Math.floor(seconds % 3600 / 60);
  const second = seconds % 60;
  return hour > 0
    ? `${hour}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`
    : `${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
}

function probeVideo(file: File): Promise<{ playable: boolean; duration: number }> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const element = document.createElement('video');
    element.preload = 'metadata';
    element.muted = true;
    let settled = false;
    const finish = (playable: boolean): void => {
      if (settled) return;
      settled = true;
      const duration = Number.isFinite(element.duration) ? element.duration : 0;
      URL.revokeObjectURL(url);
      element.remove();
      resolve({ playable, duration });
    };
    element.onloadedmetadata = () => finish(element.videoWidth > 0);
    element.onerror = () => finish(false);
    setTimeout(() => finish(element.videoWidth > 0), 8000);
    element.src = url;
  });
}
