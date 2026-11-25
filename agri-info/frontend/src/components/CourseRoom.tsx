import { defineComponent, ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, type PropType, type VNodeChild } from 'vue';
import { useFormModel } from './vue-form';
import { Button, Modal, Progress, Spin, Tag, message } from "./vue-ui";
import { CheckCircleFilled, LockOutlined } from "@ant-design/icons-vue";
import { infoApi } from '../api';
import type { CourseDetail, PlayTicket } from '../types';
import { ErrorBlock, LoadingBlock } from './ui';
import CoursePlayer from './CoursePlayer.vue';

/**
 * 课程学习间：左侧播放器 + 右侧目录。
 *
 * <p>为什么播放地址要单独取：目录接口刻意不下发 videoUrl，每切一节才换一次票。
 * 这样"未报名只能试看第一节"的限制才有意义 —— 否则前端一开弹层就拿到了全课地址。</p>
 */

interface CourseRoomProps {
  courseId: number;
  open: boolean;
  onClose: () => void;
  /** 报名/进度变化后通知列表刷新，避免关掉弹层后卡片还是旧进度。 */
  onChanged?: () => void;
}
export const CourseRoom = defineComponent({
  name: "CourseRoom",
  props: {
    courseId: null as unknown as PropType<CourseRoomProps["courseId"]>,
    open: null as unknown as PropType<CourseRoomProps["open"]>,
    onClose: null as unknown as PropType<CourseRoomProps["onClose"]>,
    onChanged: null as unknown as PropType<CourseRoomProps["onChanged"]>
  },
  setup(__props: CourseRoomProps, {
    slots: __slots
  }) {
    const courseId = computed(() => __props.courseId);
    const open = computed(() => __props.open);
    const onClose = computed(() => __props.onClose);
    const onChanged = computed(() => __props.onChanged);
    const detail = ref<CourseDetail | null>(null);
    const setDetail = (next: CourseDetail | null | ((previous: CourseDetail | null) => CourseDetail | null)) => {
      detail.value = typeof next === 'function' ? (next as (previous: CourseDetail | null) => CourseDetail | null)(detail.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const lessonId = ref(0);
    const setLessonId = (next: typeof lessonId.value | ((previous: typeof lessonId.value) => typeof lessonId.value)) => {
      lessonId.value = typeof next === 'function' ? (next as (previous: typeof lessonId.value) => typeof lessonId.value)(lessonId.value) : next;
    };
    const ticket = ref<PlayTicket | null>(null);
    const setTicket = (next: PlayTicket | null | ((previous: PlayTicket | null) => PlayTicket | null)) => {
      ticket.value = typeof next === 'function' ? (next as (previous: PlayTicket | null) => PlayTicket | null)(ticket.value) : next;
    };
    const loadingTicket = ref(false);
    const setLoadingTicket = (next: typeof loadingTicket.value | ((previous: typeof loadingTicket.value) => typeof loadingTicket.value)) => {
      loadingTicket.value = typeof next === 'function' ? (next as (previous: typeof loadingTicket.value) => typeof loadingTicket.value)(loadingTicket.value) : next;
    };
    const enrolling = ref(false);
    const setEnrolling = (next: typeof enrolling.value | ((previous: typeof enrolling.value) => typeof enrolling.value)) => {
      enrolling.value = typeof next === 'function' ? (next as (previous: typeof enrolling.value) => typeof enrolling.value)(enrolling.value) : next;
    };
    const retried = ref(false);
    const setRetried = (next: typeof retried.value | ((previous: typeof retried.value) => typeof retried.value)) => {
      retried.value = typeof next === 'function' ? (next as (previous: typeof retried.value) => typeof retried.value)(retried.value) : next;
    };
    let detailRequest = 0;
    let ticketRequest = 0;
    const loadDetail = computed(() => async (): Promise<CourseDetail | null> => {
      const requestId = ++detailRequest;
      const requestedCourse = courseId.value;
      setError('');
      try {
        const data = await infoApi.courseDetail(requestedCourse);
        if (requestId !== detailRequest || !open.value || requestedCourse !== courseId.value) return null;
        setDetail(data);
        setLessonId(current => current && data.lessons.some(item => item.id === current) ? current : data.lastLessonId || data.lessons[0]?.id || 0);
        return data;
      } catch (reason) {
        if (requestId === detailRequest && open.value) setError((reason as Error).message);
        return null;
      }
    });
    watch([open, courseId], () => {
      ++detailRequest;
      ++ticketRequest;
      setDetail(null);
      setLessonId(0);
      setTicket(null);
      setError('');
      setLoadingTicket(false);
      setRetried(false);
      if (open.value) void loadDetail.value();
    }, { immediate: true });
    const fetchTicket = computed(() => async (id: number): Promise<PlayTicket | null> => {
      const requestId = ++ticketRequest;
      const requestedCourse = courseId.value;
      setTicket(null);
      setLoadingTicket(true);
      try {
        const result = await infoApi.playTicket(requestedCourse, id);
        if (requestId !== ticketRequest || !open.value || requestedCourse !== courseId.value || id !== lessonId.value) return null;
        setTicket(result);
        return result;
      } catch (reason) {
        if (requestId === ticketRequest && open.value) {
          setTicket(null);
          message.error((reason as Error).message);
        }
        return null;
      } finally {
        if (requestId === ticketRequest) setLoadingTicket(false);
      }
    });
    watch(lessonId, (id) => {
      ++ticketRequest;
      setTicket(null);
      setRetried(false);
      if (open.value && id) void fetchTicket.value(id);
      else setLoadingTicket(false);
    });
    onBeforeUnmount(() => { ++detailRequest; ++ticketRequest; });
    const current = computed(() => detail.value?.lessons.find(item => item.id === lessonId.value) ?? null);
    const report = computed(() => (positionSec: number, finished = false): void => {
      if (!lessonId.value) return;
      // 进度上报失败不打扰用户：下一次上报会带着更大的 positionSec 覆盖，
      // 弹提示反而会让"看视频时不断弹错"变成新的体验问题。
      infoApi.reportProgress(courseId.value, lessonId.value, {
        positionSec,
        finished
      }).catch(() => undefined);
    });
    const handleFailed = (): void => {
      if (retried.value) {
        message.warning('视频加载失败，请稍后重试或联系运营');
        return;
      }
      setRetried(true);
      void fetchTicket.value(lessonId.value);
    };
    const handleEnded = (): void => {
      report.value(current.value?.durationSec ?? 0, true);
      if (!detail.value) return;
      const index = detail.value.lessons.findIndex(item => item.id === lessonId.value);
      const next = detail.value.lessons[index + 1];
      if (next) {
        setLessonId(next.id);
      } else {
        message.success('本课程已学完');
        onChanged.value?.();
      }
    };
    const handleEnroll = (): void => {
      setEnrolling(true);
      infoApi.enrollCourse(courseId.value).then(result => {
        message.success(result.message);
        onChanged.value?.();
        return loadDetail.value();
      }).catch((reason: Error) => message.error(reason.message)).finally(() => setEnrolling(false));
    };
    const canPlay = computed(() => Boolean(current.value?.playable));
    return () => {
      const view_open = open.value;
      const view_onClose = onClose.value;
      const view_detail = detail.value;
      const view_error = error.value;
      const view_loadDetail = loadDetail.value;
      const view_ticket = ticket.value;
      const view_canPlay = canPlay.value;
      const view_current = current.value;
      const view_report = report.value;
      const view_loadingTicket = loadingTicket.value;
      const view_enrolling = enrolling.value;
      const view_lessonId = lessonId.value;
      return <Modal open={view_open} onCancel={view_onClose} footer={null} width={940} title={view_detail ? `${view_detail.title} · ${view_detail.teacher}` : '课程学习'} styles={{
        body: {
          paddingTop: 12
        }
      }}>
      {view_error && <ErrorBlock message={view_error} onRetry={() => void view_loadDetail()} />}
      {!view_detail && !view_error && <LoadingBlock rows={3} />}

      {view_detail && <div class="course-room">
          <div class="course-room-stage">
            {view_ticket && view_canPlay ? <CoursePlayer key={view_ticket.url} src={view_ticket.url} initialTime={view_current?.positionSec ?? 0} onProgress={sec => view_report(sec)} onEnded={handleEnded} onFailed={handleFailed} /> : <div class="course-room-placeholder">
                {view_loadingTicket ? <Spin /> : !view_canPlay ? <>
                    <LockOutlined style={{
                  fontSize: "22px"
                }} />
                    <span>本节需报名后学习</span>
                    <Button type="primary" loading={view_enrolling} onClick={handleEnroll}>立即报名</Button>
                  </> : <span>请在右侧选择章节</span>}
              </div>}

            <div class="course-room-head">
              <h3>{view_current ? `${view_current.seq}. ${view_current.title}` : '课程目录'}</h3>
              <p>
                {view_current?.freePreview && <Tag color="green" style={{
                  marginRight: "6px"
                }}>试看</Tag>}
                {view_current ? `时长 ${view_current.durationLabel}` : ''}
                {view_detail.enrolled ? ' · 已加入学习' : ' · 未报名，仅可试看标注章节'}
              </p>
            </div>

            <div>
              <div class="row between" style={{
                marginBottom: "4px"
              }}>
                <span class="small muted">我的学习进度</span>
                <span class="small">{view_detail.progress}%</span>
              </div>
              <Progress percent={view_detail.progress} showInfo={false} strokeColor="#2d8f4e" />
            </div>
          </div>

          <aside class="course-room-side">
            <div class="row between" style={{
              marginBottom: "2px"
            }}>
              <b style={{
                fontSize: "13px"
              }}>课程目录</b>
              <span class="small muted">{view_detail.lessonCount} 节</span>
            </div>
            {view_detail.lessons.map(lesson => <button type="button" key={lesson.id} class={`lesson-item${lesson.id === view_lessonId ? ' on' : ''}`} disabled={!lesson.playable} onClick={() => setLessonId(lesson.id)}>
                <span class="lesson-seq">
                  {lesson.finished ? <CheckCircleFilled style={{
                  color: '#2d8f4e'
                }} /> : lesson.playable ? lesson.seq : <LockOutlined />}
                </span>
                <span class="lesson-title">{lesson.title}</span>
                <span class="lesson-meta">
                  {lesson.freePreview && <Tag color="green" style={{
                  margin: "0px",
                  fontSize: "12px"
                }}>试看</Tag>}
                  {lesson.durationLabel}
                </span>
              </button>)}
          </aside>
        </div>}
    </Modal>;
    };
  }
});
