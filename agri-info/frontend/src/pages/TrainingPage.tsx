import { defineComponent, ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, type PropType, type VNodeChild } from 'vue';
import { useFormModel } from '../components/vue-form';
import { PlayCircleOutlined, StarFilled, TeamOutlined } from "@ant-design/icons-vue";
import { Button, Progress, Tag, message } from "../components/vue-ui";
import { infoApi } from '../api';
import type { Course } from '../types';
import { CourseRoom } from '../components/CourseRoom';
import { EmptyState, ErrorBlock, LoadingBlock, PageTitle, SectionHeading, StatTile, formatCount } from '../components/ui';

/**
 * 培训课堂：录播课程为主，直播课以「回放」形态挂在同一套章节结构里。
 *
 * <p>列表里的 progress 是后端按当前统一账号算出来的个人进度，
 * 不再是 info_course.progress 那个全站共享的数字，所以"已学完"统计才有意义。</p>
 */
export const TrainingPage = defineComponent({
  name: "TrainingPage",
  props: {},
  setup(__props, {
    slots: __slots
  }) {
    const data = ref<{
      items: Course[];
      live: Course | null;
      learners: number;
    } | null>(null);
    const setData = (next: {
      items: Course[];
      live: Course | null;
      learners: number;
    } | null | ((previous: {
      items: Course[];
      live: Course | null;
      learners: number;
    } | null) => {
      items: Course[];
      live: Course | null;
      learners: number;
    } | null)) => {
      data.value = typeof next === 'function' ? (next as (previous: {
        items: Course[];
        live: Course | null;
        learners: number;
      } | null) => {
        items: Course[];
        live: Course | null;
        learners: number;
      } | null)(data.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const mode = ref('全部');
    const setMode = (next: typeof mode.value | ((previous: typeof mode.value) => typeof mode.value)) => {
      mode.value = typeof next === 'function' ? (next as (previous: typeof mode.value) => typeof mode.value)(mode.value) : next;
    };
    const enrolling = ref(0);
    const setEnrolling = (next: typeof enrolling.value | ((previous: typeof enrolling.value) => typeof enrolling.value)) => {
      enrolling.value = typeof next === 'function' ? (next as (previous: typeof enrolling.value) => typeof enrolling.value)(enrolling.value) : next;
    };
    const roomCourseId = ref(0);
    const setRoomCourseId = (next: typeof roomCourseId.value | ((previous: typeof roomCourseId.value) => typeof roomCourseId.value)) => {
      roomCourseId.value = typeof next === 'function' ? (next as (previous: typeof roomCourseId.value) => typeof roomCourseId.value)(roomCourseId.value) : next;
    };
    const roomOpen = ref(false);
    const setRoomOpen = (next: typeof roomOpen.value | ((previous: typeof roomOpen.value) => typeof roomOpen.value)) => {
      roomOpen.value = typeof next === 'function' ? (next as (previous: typeof roomOpen.value) => typeof roomOpen.value)(roomOpen.value) : next;
    };
    const load = (): void => {
      setError('');
      infoApi.courses().then(setData).catch((reason: Error) => setError(reason.message));
    };
    {
      let dispose: void | (() => void);
      onMounted(() => {
        dispose = load();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    }
    const openRoom = (course: Course): void => {
      setRoomCourseId(course.id);
      setRoomOpen(true);
    };
    const enroll = (course: Course): void => {
      setEnrolling(course.id);
      infoApi.enrollCourse(course.id).then(result => {
        message.success(result.message);
        // 报名后重新拉列表：enrolled / progress 都由后端按当前账号重算，本地改容易算错
        load();
        openRoom(course);
      }).catch((reason: Error) => message.error(reason.message)).finally(() => setEnrolling(0));
    };
    return () => {
      const view_data = data.value;
      const view_error = error.value;
      const view_mode = mode.value;
      const view_enrolling = enrolling.value;
      const view_roomCourseId = roomCourseId.value;
      const view_roomOpen = roomOpen.value;
      if (!view_data && !view_error) return <LoadingBlock rows={4} />;
      if (view_error || !view_data) return <ErrorBlock message={view_error} onRetry={load} />;
      const visible = view_mode === '全部' ? view_data.items : view_data.items.filter(item => item.mode === view_mode);
      const finished = view_data.items.filter(item => item.progress >= 100).length;
      return <div class="page-stack">
      <PageTitle eyebrow="TRAINING" title="培训课堂" description="农技专家授课 + 体系化录播课程 · 学完可获平台结业证明 · 支持手机端碎片化学习" />

      <div class="grid-4">
        <StatTile label="在线课程" value={view_data.items.length} unit="门" note={`录播 ${view_data.items.filter(item => item.mode === '录播').length} 门`} />
        <StatTile label="累计学员" value={formatCount(view_data.learners)} unit="人次" note="含重复学习" tone="up" />
        <StatTile label="已学完课程" value={finished} unit="门" note="进度 100%" />
        <StatTile label="直播回放" value={view_data.live ? 1 : 0} unit="场" note={view_data.live ? view_data.live.liveAt : '暂无直播课'} tone="warn" />
      </div>

      {view_data.live && <section class="live-card">
          <div class="live-left">
            <span class="live-flag">● 直播课</span>
            <h2>{view_data.live.title}</h2>
            <p>{view_data.live.summary}</p>
            <div class="row" style={{
              gap: "14px",
              flexWrap: 'wrap'
            }}>
              <span class="small muted">讲师 {view_data.live.teacher}</span>
              <span class="small muted">{view_data.live.duration}</span>
              <span class="small muted"><TeamOutlined /> {formatCount(view_data.live.learners)} 人在学</span>
              <span class="small muted"><StarFilled /> {view_data.live.rating.toFixed(1)}</span>
            </div>
            <Button type="primary" icon={<PlayCircleOutlined />} style={{
              marginTop: "14px"
            }} onClick={() => view_data.live && openRoom(view_data.live)}>
              进入课程
            </Button>
          </div>
          <div class="live-right">{view_data.live.coverIcon}</div>
        </section>}

      <section class="surface-card">
        <div class="row between" style={{
            marginBottom: "14px"
          }}>
          <SectionHeading kicker="COURSES" title="全部课程" />
          <div class="chip-row">
            {['全部', '直播', '录播'].map(item => <button type="button" key={item} class={`chip${view_mode === item ? ' on' : ''}`} onClick={() => setMode(item)}>{item}</button>)}
          </div>
        </div>

        {visible.length === 0 && <EmptyState icon="🎓" title="暂无课程" description="换个分类看看。" />}

        <div class="grid-2">
          {visible.map(course => <article class="course-card" key={course.id}>
              <div class="course-cover">{course.coverIcon}</div>
              <div class="course-body">
                <div class="row between">
                  <b style={{
                    fontSize: "14px"
                  }}>{course.title}</b>
                  <Tag class={`soft-tag ${course.mode === '直播' ? 'tone-up' : ''}`}>{course.mode}</Tag>
                </div>
                <p class="small muted" style={{
                  margin: '6px 0'
                }}>{course.summary}</p>
                <div class="row" style={{
                  gap: "12px",
                  flexWrap: 'wrap'
                }}>
                  <span class="small muted">{course.teacher}</span>
                  <span class="small muted">{course.duration}</span>
                  <span class="small muted"><TeamOutlined /> {formatCount(course.learners)}</span>
                  <span class="small muted"><StarFilled /> {course.rating.toFixed(1)}</span>
                </div>
                <div class="row" style={{
                  gap: "6px",
                  flexWrap: 'wrap',
                  marginTop: "8px"
                }}>
                  {course.tags.map(tag => <Tag class="soft-tag" key={tag}>{tag}</Tag>)}
                </div>
                {course.progress > 0 && <div style={{
                  marginTop: "10px"
                }}>
                    <div class="row between">
                      <span class="small muted">我的学习进度</span>
                      <span class="small">{course.progress}%</span>
                    </div>
                    <Progress percent={course.progress} showInfo={false} strokeColor="#2d8f4e" />
                  </div>}
                <div class="row" style={{
                  gap: "8px",
                  marginTop: "12px"
                }}>
                  {!course.enrolled && <Button size="small" type="primary" loading={view_enrolling === course.id} onClick={() => enroll(course)}>
                      立即报名
                    </Button>}
                  <Button size="small" type={course.enrolled ? 'primary' : 'default'} ghost={course.enrolled} onClick={() => openRoom(course)}>
                    {course.enrolled ? course.progress > 0 ? '继续学习' : '开始学习' : '查看目录'}
                  </Button>
                  <Button size="small" onClick={() => message.info('已收藏，可在我的收藏中查看')}>收藏</Button>
                  {course.isLive && <span class="small" style={{
                    color: '#c62828'
                  }}>● {course.liveAt}</span>}
                </div>
              </div>
            </article>)}
        </div>
      </section>

      {view_roomCourseId > 0 && <CourseRoom courseId={view_roomCourseId} open={view_roomOpen} onClose={() => setRoomOpen(false)} onChanged={load} />}
    </div>;
    };
  }
});
