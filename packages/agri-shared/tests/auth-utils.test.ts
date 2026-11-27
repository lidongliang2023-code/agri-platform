import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { logoutBrowser } from '../src/auth/logout'
import { logoutMobile } from '../src/auth/logoutMobile'
import { readSessionToken, sessionDeadline } from '../src/auth/mobileSession'
import {
  createLoginState,
  createMobileLogin,
  errorText,
  showAgreement,
  showCodeHelp,
  showPasswordHelp,
} from '../src/auth/mobileLogin'

function installMockUni(storage: Record<string, unknown> = {}) {
  const showToast = vi.fn()
  const showModal = vi.fn()
  const request = vi.fn()
  const getStorageSync = vi.fn((key: string) => storage[key])
  const setStorageSync = vi.fn((key: string, value: unknown) => {
    storage[key] = value
  })
  ;(globalThis as any).uni = {
    getStorageSync,
    setStorageSync,
    showToast,
    showModal,
    request,
  }
  return { storage, showToast, showModal, request, getStorageSync, setStorageSync }
}

describe('mobileSession：移动端会话有效期与令牌读取', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-27T10:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    delete (globalThis as any).uni
  })

  it('sessionDeadline 正常计算、缺省回退 2 小时，非法值抛错', () => {
    expect(sessionDeadline(undefined)).toBe(Date.now() + 7200 * 1000)
    expect(sessionDeadline(null)).toBe(Date.now() + 7200 * 1000)
    expect(sessionDeadline(3600)).toBe(Date.now() + 3600 * 1000)
    expect(() => sessionDeadline(0)).toThrow('会话有效期无效')
    expect(() => sessionDeadline(-10)).toThrow('会话有效期无效')
    expect(() => sessionDeadline('abc')).toThrow('会话有效期无效')
    expect(() => sessionDeadline(Number.MAX_SAFE_INTEGER)).toThrow('会话有效期无效')
  })

  it('readSessionToken 在缺失/过期时清理会话，有效时返回令牌', () => {
    const clear = vi.fn()
    const { storage } = installMockUni({})
    expect(readSessionToken('tok', 'exp', clear)).toBe('')
    expect(clear).not.toHaveBeenCalled()

    storage.tok = 'valid-token'
    storage.exp = Date.now() - 1
    expect(readSessionToken('tok', 'exp', clear)).toBe('')
    expect(clear).toHaveBeenCalledTimes(1)

    storage.exp = 'not-a-number'
    expect(readSessionToken('tok', 'exp', clear)).toBe('')
    expect(clear).toHaveBeenCalledTimes(2)

    storage.exp = Date.now() + 60_000
    expect(readSessionToken('tok', 'exp', clear)).toBe('valid-token')
  })
})

describe('logoutBrowser：PC 浏览器全局退出流程', () => {
  const assign = vi.fn()
  const alert = vi.fn()

  beforeEach(() => {
    assign.mockReset()
    alert.mockReset()
    ;(globalThis as any).window = {
      location: { assign },
      alert,
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete (globalThis as any).window
  })

  it('无 token 时直接跳转退出地址并返回 false', async () => {
    const clear = vi.fn()
    const ok = await logoutBrowser({
      token: null,
      clientId: 'prod-web',
      ssoOrigin: 'https://sso.example.com',
      clear,
    })
    expect(ok).toBe(false)
    expect(clear).not.toHaveBeenCalled()
    expect(assign).toHaveBeenCalledWith('https://sso.example.com/logout?client_id=prod-web')
  })

  it('服务端确认退出后清理本地状态、并发复用同一次请求并跳转完成页', async () => {
    const clear = vi.fn()
    let resolveFetch!: (v: unknown) => void
    const fetchMock = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const p1 = logoutBrowser({
      token: 'tk-1',
      clientId: 'trade web',
      ssoOrigin: 'https://sso.example.com',
      clear,
    })
    const p2 = logoutBrowser({
      token: 'tk-1',
      clientId: 'trade web',
      ssoOrigin: 'https://sso.example.com',
      clear,
    })
    expect(p1).toBe(p2)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    resolveFetch({ ok: true, json: async () => ({ code: 0 }) })
    expect(await p1).toBe(true)
    expect(clear).toHaveBeenCalledTimes(1)
    expect(assign).toHaveBeenCalledWith(
      'https://sso.example.com/api/v1/sso/logout/complete?client_id=trade%20web',
    )
  })

  it('接口非 0 或网络异常时弹窗提示且保留登录态', async () => {
    const clear = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ code: 500, message: '失败' }) }),
    )
    expect(
      await logoutBrowser({ token: 'tk-2', clientId: 'c1', ssoOrigin: 'https://sso.example.com', clear }),
    ).toBe(false)
    expect(clear).not.toHaveBeenCalled()
    expect(alert).toHaveBeenCalledTimes(1)

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    expect(
      await logoutBrowser({ token: 'tk-3', clientId: 'c1', ssoOrigin: 'https://sso.example.com', clear }),
    ).toBe(false)
    expect(alert).toHaveBeenCalledTimes(2)

    // 超时触发 AbortController.abort()
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
          }),
      ),
    )
    const timeoutTask = logoutBrowser({ token: 'tk-4', clientId: 'c1', ssoOrigin: 'https://sso.example.com', clear })
    vi.advanceTimersByTime(10_001)
    expect(await timeoutTask).toBe(false)
    expect(alert).toHaveBeenCalledTimes(3)
    vi.useRealTimers()
  })
})

describe('logoutMobile：移动端并发安全退出流程', () => {
  afterEach(() => {
    delete (globalThis as any).uni
  })

  it('无 token 时调用 onUnauthorized 或 clear 并返回 false', async () => {
    installMockUni()
    const clear = vi.fn()
    const onUnauthorized = vi.fn()
    expect(await logoutMobile('/api/logout', '', clear, onUnauthorized)).toBe(false)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(clear).not.toHaveBeenCalled()

    expect(await logoutMobile('/api/logout', '', clear)).toBe(false)
    expect(clear).toHaveBeenCalledTimes(1)
  })

  it('服务端 200+code=0 清理会话、并发复用；401 走 onUnauthorized；其他失败弹窗', async () => {
    const { request, showToast } = installMockUni()
    const clear = vi.fn()
    const onUnauthorized = vi.fn()

    request.mockImplementationOnce((opts: any) => {
      setTimeout(() => opts.success({ statusCode: 200, data: { code: 0 } }), 0)
    })
    const p1 = logoutMobile('/api/logout', 't1', clear, onUnauthorized)
    const p2 = logoutMobile('/api/logout', 't1', clear, onUnauthorized)
    expect(p1).toBe(p2)
    expect(await p1).toBe(true)
    expect(clear).toHaveBeenCalledTimes(1)

    // 401 分支
    request.mockImplementationOnce((opts: any) => opts.success({ statusCode: 401, data: { code: 401 } }))
    expect(await logoutMobile('/api/logout', 't2', clear, onUnauthorized)).toBe(false)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)

    // isCurrent 为 false 时不触发清理
    request.mockImplementationOnce((opts: any) => opts.success({ statusCode: 200, data: { code: 0 } }))
    expect(await logoutMobile('/api/logout', 't3', clear, onUnauthorized, () => false)).toBe(false)
    expect(clear).toHaveBeenCalledTimes(1)

    // 业务非 0 失败
    request.mockImplementationOnce((opts: any) => opts.success({ statusCode: 500, data: { code: 500 } }))
    expect(await logoutMobile('/api/logout', 't4', clear, onUnauthorized)).toBe(false)
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '未完成全局退出，请重试' }))

    // 网络失败
    request.mockImplementationOnce((opts: any) => opts.fail())
    expect(await logoutMobile('/api/logout', 't5', clear, onUnauthorized)).toBe(false)
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '未完成全局退出，请检查网络后重试' }))
  })
})

describe('mobileLogin：统一移动端登录状态机', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-27T10:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    delete (globalThis as any).uni
    delete (globalThis as any).plus
  })

  it('errorText、手机号分组、协议切换与弹窗文案辅助函数正常', () => {
    const { showModal } = installMockUni()
    expect(errorText(new Error('密码错'), '兜底')).toBe('密码错')
    expect(errorText('raw', '兜底')).toBe('兜底')

    const state = createLoginState({ platform: 'h5', entryView: 'home' })
    expect(state.view).toBe('home')
    expect(state.rememberAvailable).toBe(false)
    state.phoneInput = '138-0013-8000 extra'
    expect(state.phoneDigits).toBe('13800138000')
    expect(state.phoneInput).toBe('138 0013 8000')
    expect(state.validPhone).toBe(true)

    showAgreement('用户协议')
    showCodeHelp()
    showPasswordHelp()
    expect(showModal).toHaveBeenCalledTimes(3)
  })

  it('短信验证码发送、倒计时、视图切换与密码/短信/MFA 完整登录链路', async () => {
    installMockUni({ mobile_privacy_notice_v2: true })
    const sendSmsCode = vi.fn().mockResolvedValue('已发送至手机')
    const loginBySms = vi.fn().mockResolvedValue({ mfa: true, challengeToken: 'chal-1' })
    const completeMfa = vi.fn().mockResolvedValue({ mfa: false, data: { uid: 7 } })
    const loginByPassword = vi.fn().mockResolvedValue({ mfa: false, data: { uid: 9 } })
    const onSuccess = vi.fn()
    const onError = vi.fn()

    const state = createLoginState({ platform: 'h5', sms: true })
    const login = createMobileLogin(
      state,
      { sendSmsCode, loginBySms, completeMfa, loginByPassword, onSuccess, onError },
      { platform: 'h5', sms: true },
    )

    // 手机号不合法
    await login.requestCode()
    expect(state.message).toContain('11 位手机号')

    // 未勾协议会抖动并 toast
    state.phoneInput = '13800138000'
    await login.requestCode()
    expect(state.agreeError).toBe(true)
    expect(state.toastText).toContain('用户协议')
    vi.advanceTimersByTime(10)
    expect(state.shaking).toBe(true)
    vi.advanceTimersByTime(400)
    expect(state.shaking).toBe(false)

    // 勾选协议后发验证码并跑满 60 秒倒计时
    login.toggleAgree()
    expect(state.agreed).toBe(true)
    expect(state.agreeError).toBe(false)
    await login.requestCode()
    expect(sendSmsCode).toHaveBeenCalledWith('13800138000')
    expect(state.countdown).toBe(60)
    expect(state.messageType).toBe('notice')
    vi.advanceTimersByTime(61_000)
    expect(state.countdown).toBe(0)

    // 短信验证码格式不完整时报错
    state.smsCode = '123'
    await login.submit()
    expect(state.message).toContain('6 位短信验证码')
    expect(onError).toHaveBeenCalledTimes(1)

    // 短信登录进入 MFA
    state.smsCode = '123456'
    await login.submit()
    expect(state.view).toBe('mfa')
    expect(state.challengeToken).toBe('chal-1')

    // MFA 格式非法时不消耗挑战
    state.mfaCode = '12'
    await login.submit()
    expect(state.view).toBe('mfa')
    expect(completeMfa).not.toHaveBeenCalled()

    // MFA 正常通过
    state.mfaCode = '654 321'
    await login.submit()
    expect(completeMfa).toHaveBeenCalledWith('chal-1', '654321', false)
    expect(onSuccess).toHaveBeenCalledWith({ uid: 7 })

    // 切回密码登录并处理失败/成功
    state.completed = false
    login.openView('password')
    expect(state.view).toBe('password')
    state.username = 'admin'
    state.password = 'secret'
    await login.submit()
    expect(loginByPassword).toHaveBeenCalledWith('admin', 'secret', false)

    // MFA 服务端报错会退回登录页
    state.completed = false
    login.openView('sms')
    state.phoneInput = '13800138000'
    state.smsCode = '123456'
    await login.submit()
    completeMfa.mockRejectedValueOnce(new Error('动态码过期'))
    state.mfaCode = '111111'
    await login.submit()
    expect(state.view).toBe('sms')
    expect(state.message).toContain('请重新登录')

    // 渠道待开通与 run() 包装
    login.channelPending('微信')
    expect(state.toastText).toContain('微信登录待开通')
    await login.run(async () => ({ uid: 11 }))
    expect(onSuccess).toHaveBeenLastCalledWith({ uid: 11 })

    state.completed = false
    await login.run(async () => {
      throw new Error('会话恢复失败')
    })
    expect(state.message).toBe('会话恢复失败')

    login.dispose()
  })

  it('APP 隐私弹窗同意/拒绝（含 Android 退出）及小程序模式拦截密码页', async () => {
    const { setStorageSync } = installMockUni({})
    const quit = vi.fn()
    ;(globalThis as any).plus = { os: { name: 'Android' }, runtime: { quit } }

    const appState = createLoginState({ platform: 'app', sms: false })
    expect(appState.privacyVisible).toBe(true)
    expect(appState.view).toBe('password')
    expect(appState.rememberAvailable).toBe(true)

    const appLogin = createMobileLogin(
      appState,
      { loginByPassword: vi.fn(), onSuccess: vi.fn() },
      { platform: 'app', sms: false },
    )
    expect(appLogin.ensureAgreed()).toBe(false)
    appLogin.refusePrivacy()
    expect(quit).toHaveBeenCalledTimes(1)

    ;(globalThis as any).plus = { os: { name: 'iOS' }, runtime: { quit } }
    appLogin.refusePrivacy()
    expect(appState.toastText).toContain('暂未同意隐私提示')

    setStorageSync.mockImplementationOnce(() => {
      throw new Error('disk full')
    })
    appLogin.acceptPrivacy()
    expect(appState.toastText).toContain('无法保存隐私确认')

    appLogin.acceptPrivacy()
    expect(appState.privacyVisible).toBe(false)

    // 小程序模式禁止切密码页
    const mpState = createLoginState({ platform: 'mp', sms: true })
    const mpLogin = createMobileLogin(
      mpState,
      { loginByPassword: vi.fn(), onSuccess: vi.fn() },
      { platform: 'mp', sms: true },
    )
    mpLogin.openView('password')
    expect(mpState.view).toBe('sms')
    appLogin.dispose()
    mpLogin.dispose()
  })
})
