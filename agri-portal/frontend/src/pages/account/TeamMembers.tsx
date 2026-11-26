import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { productionApi } from './productionApi';
import { MEMBER_TYPES, roleLabel } from './teamModel';
import type { ProductionRole, TeamMember } from './teamModel';
import './account-team.css';
interface Props {
  merchantId: string | null;
  merchantName: string | null;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}
interface MemberPage {
  records: TeamMember[];
  total: number;
}
const emptyForm = {
  memberName: '',
  phone: '',
  memberType: 'OPERATOR',
  roleCode: '',
  postName: '',
  joinDate: new Date().toISOString().slice(0, 10)
};
export const TeamMembers = defineComponent({
  name: "TeamMembers",
  props: {
    merchantId: null as unknown as PropType<Props["merchantId"]>,
    merchantName: null as unknown as PropType<Props["merchantName"]>,
    onNotice: null as unknown as PropType<Props["onNotice"]>,
    onError: null as unknown as PropType<Props["onError"]>
  },
  setup(__props: Props, {
    slots: __slots
  }) {
    const members = ref<TeamMember[]>([]);
    const setMembers = (next: typeof members.value | ((previous: typeof members.value) => typeof members.value)) => {
      members.value = typeof next === 'function' ? (next as (previous: typeof members.value) => typeof members.value)(members.value) : next;
    };
    const roles = ref<ProductionRole[]>([]);
    const setRoles = (next: typeof roles.value | ((previous: typeof roles.value) => typeof roles.value)) => {
      roles.value = typeof next === 'function' ? (next as (previous: typeof roles.value) => typeof roles.value)(roles.value) : next;
    };
    const keyword = ref('');
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const loading = ref(false);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const busy = ref(false);
    const setBusy = (next: typeof busy.value | ((previous: typeof busy.value) => typeof busy.value)) => {
      busy.value = typeof next === 'function' ? (next as (previous: typeof busy.value) => typeof busy.value)(busy.value) : next;
    };
    const formOpen = ref(false);
    const setFormOpen = (next: typeof formOpen.value | ((previous: typeof formOpen.value) => typeof formOpen.value)) => {
      formOpen.value = typeof next === 'function' ? (next as (previous: typeof formOpen.value) => typeof formOpen.value)(formOpen.value) : next;
    };
    const editing = ref<TeamMember | null>(null);
    const setEditing = (next: typeof editing.value | ((previous: typeof editing.value) => typeof editing.value)) => {
      editing.value = typeof next === 'function' ? (next as (previous: typeof editing.value) => typeof editing.value)(editing.value) : next;
    };
    const form = ref({
      ...emptyForm
    });
    const setForm = (next: typeof form.value | ((previous: typeof form.value) => typeof form.value)) => {
      form.value = typeof next === 'function' ? (next as (previous: typeof form.value) => typeof form.value)(form.value) : next;
    };
    const load = async (): Promise<void> => {
      if (!__props.merchantId) {
        setMembers([]);
        setRoles([]);
        return;
      }
      setLoading(true);
      try {
        const query = new URLSearchParams({
          pageNum: '1',
          pageSize: '200'
        });
        if (keyword.value.trim()) query.set('keyword', keyword.value.trim());
        const [memberPage, roleRows] = await Promise.all([productionApi<MemberPage>(`/members?${query.toString()}`), productionApi<ProductionRole[]>('/members/roles')]);
        setMembers(memberPage.records ?? []);
        setRoles(roleRows ?? []);
        setForm(current => ({
          ...current,
          roleCode: current.roleCode || roleRows?.[0]?.roleCode || ''
        }));
      } catch (error) {
        __props.onError((error as Error).message);
      } finally {
        setLoading(false);
      }
    };
    onMounted(() => {
      watch(() => [__props.merchantId], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          void load();
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const openCreate = (): void => {
      setEditing(null);
      setForm({
        ...emptyForm,
        roleCode: roles.value[0]?.roleCode || ''
      });
      setFormOpen(true);
    };
    const openEdit = (member: TeamMember): void => {
      setEditing(member);
      setForm({
        memberName: member.realName,
        phone: member.phone,
        memberType: member.memberType,
        roleCode: member.roleCode || roles.value[0]?.roleCode || '',
        postName: member.position || '',
        joinDate: member.joinedAt || new Date().toISOString().slice(0, 10)
      });
      setFormOpen(true);
    };
    const save = async (event: Event): Promise<void> => {
      event.preventDefault();
      if (!form.value.memberName.trim()) return __props.onError('请填写成员姓名');
      if (!/^1[3-9]\d{9}$/.test(form.value.phone.trim())) return __props.onError('请填写正确的 11 位手机号');
      if (!form.value.roleCode) return __props.onError('请选择主体内角色');
      setBusy(true);
      try {
        if (editing.value) {
          await productionApi(`/members/${encodeURIComponent(editing.value.memberId)}`, {
            method: 'PUT',
            body: JSON.stringify(form.value)
          });
          __props.onNotice('成员信息已更新');
        } else {
          await productionApi('/members', {
            method: 'POST',
            body: JSON.stringify({
              ...form.value,
              status: 2
            })
          });
          __props.onNotice('成员邀请已提交，状态为待激活');
        }
        setFormOpen(false);
        await load();
      } catch (error) {
        __props.onError((error as Error).message);
      } finally {
        setBusy(false);
      }
    };
    const changeStatus = async (member: TeamMember, status: number): Promise<void> => {
      setBusy(true);
      try {
        await productionApi(`/members/${encodeURIComponent(member.memberId)}`, {
          method: 'PUT',
          body: JSON.stringify({
            status
          })
        });
        __props.onNotice(status === 1 ? '成员已启用' : '成员已停用');
        await load();
      } catch (error) {
        __props.onError((error as Error).message);
      } finally {
        setBusy(false);
      }
    };
    const remove = async (member: TeamMember): Promise<void> => {
      if (!window.confirm(`确认移除成员「${member.realName}」？`)) return;
      setBusy(true);
      try {
        await productionApi(`/members/${encodeURIComponent(member.memberId)}`, {
          method: 'DELETE'
        });
        __props.onNotice('成员已移除');
        await load();
      } catch (error) {
        __props.onError((error as Error).message);
      } finally {
        setBusy(false);
      }
    };
    return () => {
      const view_prop_merchantName = __props.merchantName;
      const view_prop_merchantId = __props.merchantId;
      const view_busy = busy.value;
      const view_keyword = keyword.value;
      const view_loading = loading.value;
      const view_members = members.value;
      const view_roles = roles.value;
      const view_formOpen = formOpen.value;
      const view_editing = editing.value;
      const view_form = form.value;
      return <div class="account-team-panel">
      <div class="account-subject-strip">
        <div><span>当前经营主体</span><strong>{view_prop_merchantName || '未选择主体'}</strong></div>
        <small>{view_prop_merchantId ? `主体 ID：${view_prop_merchantId}` : '请先在主体资料中完成主体创建或切换'}</small>
      </div>
      <div class="card account-card">
        <div class="account-card-head">
          <h2>团队与成员</h2>
          <button class="btn btn-primary" disabled={!view_prop_merchantId || view_busy} onClick={openCreate}>邀请成员</button>
        </div>
        <form class="account-business-search" onSubmit={event => {
            event.preventDefault();
            void load();
          }}>
          <input class="input" value={view_keyword} placeholder="搜索姓名或手机号" onInput={event => setKeyword((event.target as HTMLInputElement).value)} />
          <button class="btn btn-outline" disabled={view_loading}>搜索</button>
        </form>
        <div class="account-team-table-wrap">
          <table class="account-team-table">
            <thead><tr><th>姓名</th><th>手机号</th><th>岗位</th><th>角色</th><th>状态</th><th>加入时间</th><th>操作</th></tr></thead>
            <tbody>
              {view_members.map(member => <tr key={member.memberId}>
                  <td><strong>{member.realName}</strong></td>
                  <td>{member.phone}</td>
                  <td>{member.position || '—'}</td>
                  <td>{roleLabel(member.roleCode, view_roles)}</td>
                  <td><span class={`account-status ${member.status === 1 ? 'green' : member.status === 2 ? 'amber' : 'ghost'}`}>{member.status === 1 ? '在职' : member.status === 2 ? '待激活' : '已停用'}</span></td>
                  <td>{member.joinedAt || '—'}</td>
                  <td class="account-team-actions">
                    <button type="button" onClick={() => openEdit(member)}>编辑</button>
                    <button type="button" onClick={() => void changeStatus(member, member.status === 1 ? 0 : 1)}>{member.status === 1 ? '停用' : '启用'}</button>
                    <button type="button" class="danger" onClick={() => void remove(member)}>移除</button>
                  </td>
                </tr>)}
              {!view_members.length && <tr><td colspan={7} class="account-team-empty">{view_loading ? '加载中…' : view_prop_merchantId ? '当前主体暂无团队成员' : '暂无可操作主体'}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {view_formOpen && <div class="account-modal-mask" onClick={() => setFormOpen(false)}>
          <form class="account-modal account-team-modal" onClick={event => event.stopPropagation()} onSubmit={event => void save(event)}>
            <div class="account-card-head">
              <h2>{view_editing ? '编辑成员' : '邀请成员'}</h2>
              <button type="button" class="account-modal-close" onClick={() => setFormOpen(false)}>×</button>
            </div>
            <div class="account-form-grid">
              <label>姓名<input class="input" value={view_form.memberName} onInput={event => setForm({
                  ...view_form,
                  memberName: (event.target as HTMLInputElement).value
                })} /></label>
              <label>手机号<input class="input" maxlength={11} value={view_form.phone} onInput={event => setForm({
                  ...view_form,
                  phone: (event.target as HTMLInputElement).value.replace(/\D/g, '')
                })} /></label>
              <label>成员类型<select class="select" value={view_form.memberType} onChange={event => setForm({
                  ...view_form,
                  memberType: (event.target as HTMLInputElement).value
                })}>{MEMBER_TYPES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
              <label>分配角色<select class="select" value={view_form.roleCode} onChange={event => setForm({
                  ...view_form,
                  roleCode: (event.target as HTMLInputElement).value
                })}>{view_roles.map(role => <option key={role.roleId} value={role.roleCode}>{role.roleName}</option>)}</select></label>
              <label>岗位<input class="input" value={view_form.postName} placeholder="如：种植技术员" onInput={event => setForm({
                  ...view_form,
                  postName: (event.target as HTMLInputElement).value
                })} /></label>
              <label>加入日期<input class="input" type="date" value={view_form.joinDate} onInput={event => setForm({
                  ...view_form,
                  joinDate: (event.target as HTMLInputElement).value
                })} /></label>
            </div>
            <p class="muted">成员与角色均绑定当前主体「{view_prop_merchantName || '—'}」，切换主体后不会混用。</p>
            <div class="account-form-actions">
              <button class="btn btn-primary" disabled={view_busy}>{view_busy ? '保存中…' : view_editing ? '保存修改' : '发送邀请'}</button>
              <button type="button" class="btn btn-ghost" onClick={() => setFormOpen(false)}>取消</button>
            </div>
          </form>
        </div>}
    </div>;
    };
  }
});
