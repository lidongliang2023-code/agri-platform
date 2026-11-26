import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
/**
 * 用户中心 · 二次验证（TOTP）
 *
 * <p>与手机验证器兼容（Google / 微软 Authenticator、1Password 等）：
 * HMAC-SHA1、30 秒步长、6 位数字、Base32 密钥。</p>
 *
 * <p><b>流程是"先生成、再确认"两段</b>：扫码后必须输一次正确的码才算启用 ——
 * 否则用户装错应用或手机时间不准，会直接被锁在门外。</p>
 *
 * <p>备用码只在生成时显示一次，之后库里只有哈希。停用必须再验一次码，
 * 防止会话被别人拿到就直接关掉 2FA。</p>
 *
 * <p><b>已知缺口（页面上也写明）</b>：二次验证目前拦在独立登录接口
 * （密码登录 / 短信登录）。子系统跳转的 OIDC 授权码流程尚未接入第二因子 ——
 * 那需要在授权码流程里插入一个可恢复的中间态，改动面比本页大。</p>
 */

import { Icon } from '@/components/Icon';
interface MfaStatus {
  enabled: boolean;
  status: string;
  enabledAt: string | null;
  lastUsedAt: string | null;
  remainingRecoveryCodes: number;
}
interface SetupResult {
  secret: string;
  otpauthUri: string;
  issuer: string;
  digits: number;
  period: number;
}
interface ApiBody<T> {
  code: number;
  message?: string;
  data?: T;
}
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  });
  const body = (await response.json()) as ApiBody<T>;
  if (!response.ok || body.code !== 0) {
    throw new Error(body.message || '请求失败');
  }
  return body.data as T;
}
const formatTime = (value: string | null): string => (value ?? '').replace('T', ' ').slice(0, 16);

/** Base32 密钥按 4 位分组，方便手输 */
function groupSecret(secret: string): string {
  return secret.replace(/(.{4})/g, '$1 ').trim();
}

/**
 * 二次验证页面
 *
 * @returns 页面内容
 */
export const Mfa = defineComponent({
  name: "Mfa",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const status = ref<MfaStatus | null>(null);
    const setStatus = (next: typeof status.value | ((previous: typeof status.value) => typeof status.value)) => {
      status.value = typeof next === 'function' ? (next as (previous: typeof status.value) => typeof status.value)(status.value) : next;
    };
    const loading = ref(true);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const notice = ref('');
    const setNotice = (next: typeof notice.value | ((previous: typeof notice.value) => typeof notice.value)) => {
      notice.value = typeof next === 'function' ? (next as (previous: typeof notice.value) => typeof notice.value)(notice.value) : next;
    };
    const saving = ref(false);

    /** setup：已生成密钥待确认；recovery：展示备用码；disable：输入码停用；regen：重生成备用码 */
    const setSaving = (next: typeof saving.value | ((previous: typeof saving.value) => typeof saving.value)) => {
      saving.value = typeof next === 'function' ? (next as (previous: typeof saving.value) => typeof saving.value)(saving.value) : next;
    };
    const step = ref<'idle' | 'setup' | 'recovery' | 'disable' | 'regen'>('idle');
    const setStep = (next: typeof step.value | ((previous: typeof step.value) => typeof step.value)) => {
      step.value = typeof next === 'function' ? (next as (previous: typeof step.value) => typeof step.value)(step.value) : next;
    };
    const setup = ref<SetupResult | null>(null);
    const setSetup = (next: typeof setup.value | ((previous: typeof setup.value) => typeof setup.value)) => {
      setup.value = typeof next === 'function' ? (next as (previous: typeof setup.value) => typeof setup.value)(setup.value) : next;
    };
    const code = ref('');
    const setCode = (next: typeof code.value | ((previous: typeof code.value) => typeof code.value)) => {
      code.value = typeof next === 'function' ? (next as (previous: typeof code.value) => typeof code.value)(code.value) : next;
    };
    const recoveryCodes = ref<string[]>([]);
    const setRecoveryCodes = (next: typeof recoveryCodes.value | ((previous: typeof recoveryCodes.value) => typeof recoveryCodes.value)) => {
      recoveryCodes.value = typeof next === 'function' ? (next as (previous: typeof recoveryCodes.value) => typeof recoveryCodes.value)(recoveryCodes.value) : next;
    };
    const savedChecked = ref(false);
    const setSavedChecked = (next: typeof savedChecked.value | ((previous: typeof savedChecked.value) => typeof savedChecked.value)) => {
      savedChecked.value = typeof next === 'function' ? (next as (previous: typeof savedChecked.value) => typeof savedChecked.value)(savedChecked.value) : next;
    };
    const load = async (): Promise<void> => {
      setLoading(true);
      setError('');
      try {
        const data = await api<MfaStatus>('/api/v1/sso/account/mfa');
        setStatus(data);
      } catch (e) {
        setError((e as Error).message || '状态加载失败');
      } finally {
        setLoading(false);
      }
    };
    onMounted(() => {
      watch(() => [], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          void load();
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const resetFlow = (): void => {
      setStep('idle');
      setSetup(null);
      setCode('');
      setRecoveryCodes([]);
      setSavedChecked(false);
    };
    const startSetup = async (): Promise<void> => {
      setSaving(true);
      setError('');
      setNotice('');
      try {
        const data = await api<SetupResult>('/api/v1/sso/account/mfa/setup', {
          method: 'POST'
        });
        setSetup(data);
        setStep('setup');
        setCode('');
      } catch (e) {
        setError((e as Error).message || '生成密钥失败');
      } finally {
        setSaving(false);
      }
    };
    const confirm = async (): Promise<void> => {
      if (code.value.replace(/\s/g, '').length !== 6) {
        setError('请输入验证器上的 6 位验证码');
        return;
      }
      setSaving(true);
      setError('');
      try {
        const data = await api<{
          recoveryCodes: string[];
        }>('/api/v1/sso/account/mfa/confirm', {
          method: 'POST',
          body: JSON.stringify({
            code: code.value.replace(/\s/g, '')
          })
        });
        setRecoveryCodes(data?.recoveryCodes ?? []);
        setStep('recovery');
        setNotice('');
        await load();
      } catch (e) {
        setError((e as Error).message || '验证失败');
      } finally {
        setSaving(false);
      }
    };
    const disable = async (): Promise<void> => {
      if (!code.value.trim()) {
        setError('请输入验证码或备用码');
        return;
      }
      setSaving(true);
      setError('');
      try {
        await api('/api/v1/sso/account/mfa/disable', {
          method: 'POST',
          body: JSON.stringify({
            code: code.value.trim()
          })
        });
        setNotice('二次验证已停用。建议尽快重新启用，账号安全会明显下降');
        resetFlow();
        await load();
      } catch (e) {
        setError((e as Error).message || '停用失败');
      } finally {
        setSaving(false);
      }
    };
    const regenerate = async (): Promise<void> => {
      if (!code.value.trim()) {
        setError('请输入验证码或备用码');
        return;
      }
      setSaving(true);
      setError('');
      try {
        const data = await api<{
          recoveryCodes: string[];
        }>('/api/v1/sso/account/mfa/recovery-codes', {
          method: 'POST',
          body: JSON.stringify({
            code: code.value.trim()
          })
        });
        setRecoveryCodes(data?.recoveryCodes ?? []);
        setStep('recovery');
        await load();
      } catch (e) {
        setError((e as Error).message || '生成失败');
      } finally {
        setSaving(false);
      }
    };
    const enabled = computed(() => status.value?.enabled ?? false);
    return () => {
      const view_loading = loading.value;
      const view_notice = notice.value;
      const view_error = error.value;
      const view_status = status.value;
      const view_enabled = enabled.value;
      const view_saving = saving.value;
      const view_step = step.value;
      const view_setup = setup.value;
      const view_code = code.value;
      const view_recoveryCodes = recoveryCodes.value;
      const view_savedChecked = savedChecked.value;
      return <div class="uc-mfa">
      <div class="uc-mfa-head">
        <div>
          <strong>二次验证</strong>
          <small>用手机验证器生成的 6 位动态码，作为密码之外的第二道验证</small>
        </div>
        <button class="btn btn-outline btn-sm" onClick={() => void load()} disabled={view_loading}>
          刷新
        </button>
      </div>

      {view_notice && <div class="account-notice">{view_notice}</div>}
      {view_error && <div class="account-error">{view_error}</div>}
      {view_loading && <div class="card empty">正在加载…</div>}

      {!view_loading && view_status && <>
          <div class={`uc-mfa-status ${view_enabled ? 'on' : ''}`}>
            <span class="uc-mfa-icon">
              <Icon name={view_enabled ? 'shield' : 'alert'} size={20} />
            </span>
            <div class="uc-mfa-status-body">
              <strong>{view_enabled ? '已启用' : '未启用'}</strong>
              <small>
                {view_enabled ? `启用时间 ${formatTime(view_status.enabledAt)}　最近验证 ${formatTime(view_status.lastUsedAt)}　剩余备用码 ${view_status.remainingRecoveryCodes} 个` : '未启用时，只有密码一道防线；密码泄露即账号失守'}
              </small>
            </div>
            {view_enabled ? <div class="uc-mfa-actions">
                <button class="btn btn-outline btn-sm" disabled={view_saving} onClick={() => {
                resetFlow();
                setStep('regen');
              }}>
                  重生成备用码
                </button>
                <button class="btn btn-outline btn-sm uc-mfa-danger" disabled={view_saving} onClick={() => {
                resetFlow();
                setStep('disable');
              }}>
                  停用
                </button>
              </div> : <button class="btn btn-primary btn-sm" disabled={view_saving} onClick={() => void startSetup()}>
                {view_saving ? '生成中…' : '开始设置'}
              </button>}
          </div>

          {/* 设置：展示密钥 + 输码确认 */}
          {view_step === 'setup' && view_setup && <div class="uc-mfa-panel">
              <h4>第 1 步：把密钥添加到验证器</h4>
              <p class="uc-mfa-hint">
                用验证器 App（Google Authenticator / 微软 Authenticator / 1Password）扫描下方链接，
                或手动输入密钥。当前环境没有生成二维码，**扫码链接可直接复制**到手机打开。
              </p>
              <label class="uc-mfa-field">
                密钥（Base32，手动输入时用这个）
                <input readonly value={groupSecret(view_setup.secret)} onFocus={e => (e.target as HTMLInputElement).select()} />
              </label>
              <label class="uc-mfa-field">
                otpauth 链接
                <input readonly value={view_setup.otpauthUri} onFocus={e => (e.target as HTMLInputElement).select()} />
              </label>
              <p class="uc-mfa-hint">
                参数：{view_setup.issuer}　{view_setup.digits} 位　{view_setup.period} 秒刷新　算法 SHA1
              </p>

              <h4>第 2 步：输入验证器当前的 6 位码</h4>
              <div class="uc-mfa-code-row">
                <input class="uc-mfa-code" value={view_code} inputmode="numeric" maxlength={6} placeholder="000000" onInput={event => setCode((event.target as HTMLInputElement).value.replace(/\D/g, ''))} />
                <button class="btn btn-primary btn-sm" disabled={view_saving} onClick={() => void confirm()}>
                  {view_saving ? '校验中…' : '确认启用'}
                </button>
                <button class="btn btn-outline btn-sm" disabled={view_saving} onClick={resetFlow}>
                  取消
                </button>
              </div>
              <p class="uc-mfa-hint">
                输错通常是因为手机时间不准 —— 验证器依赖时间同步，请把手机设为自动校准时间。
              </p>
            </div>}

          {/* 备用码展示（仅一次） */}
          {view_step === 'recovery' && view_recoveryCodes.length > 0 && <div class="uc-mfa-panel uc-mfa-recovery">
              <h4>备用码（只显示这一次）</h4>
              <p class="uc-mfa-hint">
                手机丢失或验证器被卸载时，用其中一个备用码登录。**每个码只能用一次**，
                刷新页面后无法再次查看 —— 请现在保存到安全的地方。
              </p>
              <ul class="uc-mfa-codes">
                {view_recoveryCodes.map(item => <li key={item}>{item}</li>)}
              </ul>
              <label class="uc-mfa-check">
                <input type="checkbox" checked={view_savedChecked} onInput={event => setSavedChecked((event.target as HTMLInputElement).checked)} />
                我已把这些备用码保存到安全的地方
              </label>
              <button class="btn btn-primary btn-sm" disabled={!view_savedChecked} onClick={resetFlow}>
                完成
              </button>
            </div>}

          {/* 停用 */}
          {view_step === 'disable' && <div class="uc-mfa-panel">
              <h4>停用二次验证</h4>
              <p class="uc-mfa-hint">
                需要再验证一次（验证码或备用码）。停用后账号只剩密码一道防线，
                建议只在更换手机等必要场景下临时停用。
              </p>
              <div class="uc-mfa-code-row">
                <input class="uc-mfa-code uc-mfa-code-wide" value={view_code} placeholder="6 位验证码，或 XXXX-XXXXX 备用码" onInput={event => setCode((event.target as HTMLInputElement).value.toUpperCase())} />
                <button class="btn btn-sm uc-mfa-danger" disabled={view_saving} onClick={() => void disable()}>
                  {view_saving ? '处理中…' : '确认停用'}
                </button>
                <button class="btn btn-outline btn-sm" disabled={view_saving} onClick={resetFlow}>
                  取消
                </button>
              </div>
            </div>}

          {/* 重生成备用码 */}
          {view_step === 'regen' && <div class="uc-mfa-panel">
              <h4>重新生成备用码</h4>
              <p class="uc-mfa-hint">
                生成后**旧的备用码立即作废**。同样需要先验证一次。
              </p>
              <div class="uc-mfa-code-row">
                <input class="uc-mfa-code uc-mfa-code-wide" value={view_code} placeholder="6 位验证码，或 XXXX-XXXXX 备用码" onInput={event => setCode((event.target as HTMLInputElement).value.toUpperCase())} />
                <button class="btn btn-primary btn-sm" disabled={view_saving} onClick={() => void regenerate()}>
                  {view_saving ? '生成中…' : '生成新备用码'}
                </button>
                <button class="btn btn-outline btn-sm" disabled={view_saving} onClick={resetFlow}>
                  取消
                </button>
              </div>
            </div>}

          <div class="uc-mfa-note">
            <Icon name="alert" size={13} />
            <div>
              <strong>当前生效范围（不夸大）</strong>
              <p>
                二次验证已拦在**独立登录接口**：密码登录与短信登录在验证码通过前不会建立会话。
                子系统跳转的 OIDC 授权码流程**尚未接入**第二因子 —— 那条链路需要在授权码流程里
                插入一个可恢复的中间态，本轮未做。这里如实写明，不做"已全面开启 2FA"的表述。
              </p>
            </div>
          </div>

          <p class="uc-mfa-foot">
            密钥以加密形式存储（AES-GCM），明文只在设置时显示一次；备用码只存哈希。
            停用会一并清空密钥与备用码。
          </p>
        </>}
    </div>;
    };
  }
});
