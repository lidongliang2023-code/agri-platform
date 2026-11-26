import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { productionApi } from './productionApi';
import { ACTION_LABELS, DATA_SCOPES, PERMISSION_GROUPS, ROLE_TEMPLATES } from './teamModel';
import type { ProductionRole } from './teamModel';
import './account-team.css';
interface Props {
  merchantId: string | null;
  merchantName: string | null;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}
export const RolesPermissions = defineComponent({
  name: "RolesPermissions",
  props: {
    merchantId: null as unknown as PropType<Props["merchantId"]>,
    merchantName: null as unknown as PropType<Props["merchantName"]>,
    onNotice: null as unknown as PropType<Props["onNotice"]>,
    onError: null as unknown as PropType<Props["onError"]>
  },
  setup(__props: Props, {
    slots: __slots
  }) {
    const roles = ref<ProductionRole[]>([]);
    const setRoles = (next: typeof roles.value | ((previous: typeof roles.value) => typeof roles.value)) => {
      roles.value = typeof next === 'function' ? (next as (previous: typeof roles.value) => typeof roles.value)(roles.value) : next;
    };
    const activeRole = ref<ProductionRole | null>(null);
    const setActiveRole = (next: typeof activeRole.value | ((previous: typeof activeRole.value) => typeof activeRole.value)) => {
      activeRole.value = typeof next === 'function' ? (next as (previous: typeof activeRole.value) => typeof activeRole.value)(activeRole.value) : next;
    };
    const permissions = ref<string[]>([]);
    const setPermissions = (next: typeof permissions.value | ((previous: typeof permissions.value) => typeof permissions.value)) => {
      permissions.value = typeof next === 'function' ? (next as (previous: typeof permissions.value) => typeof permissions.value)(permissions.value) : next;
    };
    const dataScope = ref('TENANT');
    const setDataScope = (next: typeof dataScope.value | ((previous: typeof dataScope.value) => typeof dataScope.value)) => {
      dataScope.value = typeof next === 'function' ? (next as (previous: typeof dataScope.value) => typeof dataScope.value)(dataScope.value) : next;
    };
    const loading = ref(false);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const busy = ref(false);
    const setBusy = (next: typeof busy.value | ((previous: typeof busy.value) => typeof busy.value)) => {
      busy.value = typeof next === 'function' ? (next as (previous: typeof busy.value) => typeof busy.value)(busy.value) : next;
    };
    const keyword = ref('');
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const load = async (): Promise<void> => {
      if (!__props.merchantId) {
        setRoles([]);
        return;
      }
      setLoading(true);
      try {
        setRoles(await productionApi<ProductionRole[]>('/members/roles'));
      } catch (error) {
        __props.onError((error as Error).message);
      } finally {
        setLoading(false);
      }
    };
    onMounted(() => {
      watch(() => [__props.merchantId], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          setActiveRole(null);
          void load();
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const visibleRoles = computed(() => roles.value.filter(role => !keyword.value.trim() || `${role.roleName}${role.roleCode}${role.description || ''}`.toLowerCase().includes(keyword.value.trim().toLowerCase())));
    const openRole = (role: ProductionRole): void => {
      setActiveRole(role);
      setPermissions([...role.permissions]);
      setDataScope(role.dataScope || 'TENANT');
    };
    const togglePermission = (code: string): void => {
      setPermissions(current => current.includes(code) ? current.filter(item => item !== code) : [...current, code]);
    };
    const toggleGroup = (domain: string, action: string, checked: boolean): void => {
      const group = PERMISSION_GROUPS.find(item => item.domain === domain);
      if (!group) return;
      const codes = group.resources.map(resource => `${group.domain}.${resource.code}.${action}`);
      setPermissions(current => checked ? Array.from(new Set([...current, ...codes])) : current.filter(code => !codes.includes(code)));
    };
    const save = async (): Promise<void> => {
      if (!activeRole.value) return;
      setBusy(true);
      try {
        const updated = await productionApi<ProductionRole>(`/members/roles/${encodeURIComponent(activeRole.value.roleId)}/permissions`, {
          method: 'PUT',
          body: JSON.stringify({
            permissions: permissions.value,
            dataScope: dataScope.value
          })
        });
        setRoles(current => current.map(role => role.roleId === updated.roleId ? updated : role));
        setActiveRole(updated);
        __props.onNotice(`「${updated.roleName}」权限已保存`);
      } catch (error) {
        __props.onError((error as Error).message);
      } finally {
        setBusy(false);
      }
    };
    return () => {
      const view_prop_merchantName = __props.merchantName;
      const view_roles = roles.value;
      const view_keyword = keyword.value;
      const view_loading = loading.value;
      const view_visibleRoles = visibleRoles.value;
      const view_activeRole = activeRole.value;
      const view_prop_merchantId = __props.merchantId;
      const view_dataScope = dataScope.value;
      const view_busy = busy.value;
      const view_permissions = permissions.value;
      return <div class="account-team-panel">
      <div class="account-subject-strip">
        <div><span>当前经营主体</span><strong>{view_prop_merchantName || '未选择主体'}</strong></div>
        <small>角色、权限点和数据范围仅对本主体成员生效</small>
      </div>
      <div class="card account-card">
        <div class="account-card-head">
          <h2>角色与权限</h2>
          <span>{view_roles.length} 个主体角色</span>
        </div>
        <div class="account-business-search">
          <input class="input" value={view_keyword} placeholder="搜索角色名称或编码" onInput={event => setKeyword((event.target as HTMLInputElement).value)} />
          <button class="btn btn-outline" disabled={view_loading} onClick={() => void load()}>刷新</button>
        </div>
        <div class="account-role-grid">
          {view_visibleRoles.map(role => <button type="button" class={`account-role-card ${view_activeRole?.roleId === role.roleId ? 'on' : ''}`} key={role.roleId} onClick={() => openRole(role)}>
              <span><strong>{role.roleName}</strong><small>{role.roleCode}</small></span>
              <b>{role.permissions.length} 个权限 · {role.memberCount} 人</b>
              <em>{role.description || '暂无职责说明'}</em>
            </button>)}
          {!view_visibleRoles.length && <div class="account-team-empty">{view_loading ? '加载中…' : view_prop_merchantId ? '当前主体暂无角色' : '暂无可操作主体'}</div>}
        </div>
      </div>

      {view_activeRole && <div class="card account-card">
          <div class="account-card-head">
            <h2>配置权限 · {view_activeRole.roleName}</h2>
            <div class="account-form-actions">
              <select class="select account-scope-select" value={view_dataScope} onChange={event => setDataScope((event.target as HTMLInputElement).value)}>
                {DATA_SCOPES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <button class="btn btn-primary" disabled={view_busy} onClick={() => void save()}>{view_busy ? '保存中…' : '保存权限'}</button>
            </div>
          </div>
          <div class="account-permission-toolbar">
            <span>已选 <b>{view_permissions.length}</b> 个权限点</span>
            <button type="button" onClick={() => setPermissions(ROLE_TEMPLATES[view_activeRole.roleCode] || [])}>按角色模板填充</button>
            <button type="button" onClick={() => setPermissions([])}>清空</button>
          </div>
          <div class="account-permission-groups">
            {PERMISSION_GROUPS.map(group => <section class="account-permission-group" key={group.domain}>
                <h3>{group.name}<small>{group.domain}</small></h3>
                <div class="account-permission-actions">
                  {group.actions.map(action => <span key={action}>{ACTION_LABELS[action] || action}</span>)}
                </div>
                <div class="account-permission-resources">
                  {group.resources.map(resource => <div key={resource.code}>
                      <strong>{resource.name}</strong>
                      <span>
                        {group.actions.map(action => {
                      const code = `${group.domain}.${resource.code}.${action}`;
                      return <label key={code}>
                              <input type="checkbox" checked={view_permissions.includes(code)} onInput={() => togglePermission(code)} />
                              {ACTION_LABELS[action] || action}
                            </label>;
                    })}
                      </span>
                    </div>)}
                </div>
                <div class="account-permission-batch">
                  {group.actions.map(action => {
                  const codes = group.resources.map(resource => `${group.domain}.${resource.code}.${action}`);
                  const allChecked = codes.every(code => view_permissions.includes(code));
                  return <button type="button" key={action} onClick={() => toggleGroup(group.domain, action, !allChecked)}>{allChecked ? '清除' : '全选'}「{ACTION_LABELS[action] || action}」</button>;
                })}
                </div>
              </section>)}
          </div>
        </div>}
    </div>;
    };
  }
});
