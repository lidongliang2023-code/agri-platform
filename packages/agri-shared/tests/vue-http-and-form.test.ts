import { describe, expect, it, vi } from 'vitest'
import axios, { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { createAgriHttp, extractApiErrorMessage, requestData } from '../src/vue/http/createAgriHttp'
import { useFormModel } from '../src/vue/antdv/formModel'

describe('createAgriHttp & requestData：共享 HTTP 客户端', () => {
  it('extractApiErrorMessage 覆盖 AxiosError（message/error/自身 message）与兜底', () => {
    const withMsg = new AxiosError('net', 'ERR', undefined, undefined, {
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: {} as InternalAxiosRequestConfig,
      data: { message: '参数有误' },
    })
    expect(extractApiErrorMessage(withMsg)).toBe('参数有误')

    const withErr = new AxiosError('net', 'ERR', undefined, undefined, {
      status: 500,
      statusText: 'Err',
      headers: {},
      config: {} as InternalAxiosRequestConfig,
      data: { error: '上游超时' },
    })
    expect(extractApiErrorMessage(withErr)).toBe('上游超时')

    const plainAxios = new AxiosError('Network Error')
    expect(extractApiErrorMessage(plainAxios)).toBe('Network Error')
    expect(extractApiErrorMessage(new Error('自定义错误'))).toBe('自定义错误')
    expect(extractApiErrorMessage({}, '默认提示')).toBe('默认提示')
  })

  it('请求拦截自动注入 Bearer Token，不覆盖显式 Authorization，401 触发回调', async () => {
    const onUnauthorized = vi.fn()
    let capturedAuth: string | undefined
    const adapter: AxiosAdapter = async (config) => {
      capturedAuth = String(config.headers?.Authorization ?? '')
      if (config.url === '/unauth') {
        throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, {
          status: 401,
          statusText: 'Unauthorized',
          headers: {},
          config,
          data: { message: '未登录' },
        })
      }
      if (config.url === '/server-err') {
        throw new AxiosError('Server Error', 'ERR_BAD_RESPONSE', config, undefined, {
          status: 500,
          statusText: 'Server Error',
          headers: {},
          config,
          data: {},
        })
      }
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        data:
          config.url === '/ok-envelope'
            ? { code: 0, data: { ok: true } }
            : config.url === '/ok-200'
              ? { code: 200, data: [1, 2] }
              : config.url === '/biz-fail'
                ? { code: 4001, message: '库存不足', data: null }
                : config.url === '/biz-fail-no-msg'
                  ? { code: 5002, data: null }
                  : { raw: 123 },
      }
    }

    const client = createAgriHttp({
      baseURL: '/api',
      getToken: () => 'abc123',
      onUnauthorized,
    })
    client.defaults.adapter = adapter

    expect(await requestData<{ ok: boolean }>(client, { url: '/ok-envelope' })).toEqual({ ok: true })
    expect(capturedAuth).toBe('Bearer abc123')

    expect(await requestData<number[]>(client, { url: '/ok-200', headers: { Authorization: 'Custom tok' } })).toEqual([
      1, 2,
    ])
    expect(capturedAuth).toBe('Custom tok')

    expect(await requestData<{ raw: number }>(client, { url: '/raw' })).toEqual({ raw: 123 })
    await expect(requestData(client, { url: '/biz-fail' })).rejects.toThrow('库存不足')
    await expect(requestData(client, { url: '/biz-fail-no-msg' })).rejects.toThrow('code=5002')

    await expect(client.get('/unauth')).rejects.toBeInstanceOf(AxiosError)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)

    await expect(client.get('/server-err')).rejects.toBeInstanceOf(AxiosError)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)

    // token 已含 Bearer 前缀时不再重复拼接
    const client2 = createAgriHttp({ getToken: () => 'Bearer already' })
    client2.defaults.adapter = adapter
    await requestData(client2, { url: '/raw' })
    expect(capturedAuth).toBe('Bearer already')
    expect(axios.isAxiosError(new AxiosError('x'))).toBe(true)
  })
})

describe('useFormModel：Antdv 表单模型状态与校验', () => {
  it('支持默认值绑定、嵌套路径读写、脏状态检测与重置', () => {
    const form = useFormModel()
    const clearValidate = vi.fn()
    const scrollToField = vi.fn()
    form.instance.value = { clearValidate, scrollToField, validate: vi.fn().mockResolvedValue({}) } as any

    form.bind(undefined, { title: '默认标题', count: 1 })
    expect(form.getFieldsValue()).toEqual({ title: '默认标题', count: 1 })

    form.setFieldsValue({ title: '已编辑' })
    expect(form.isFieldsTouched()).toBe(false)
    form.model.title = '未保存改动'
    expect(form.isFieldsTouched()).toBe(true)

    form.setFieldValue(['items', 0, 'name'], '脐橙')
    form.setFieldValue([], 'ignored')
    expect(form.getFieldValue(['items', 0, 'name'])).toBe('脐橙')
    expect(form.getFieldValue('title')).toBe('未保存改动')

    form.recordErrors([{ name: ['title'], errors: ['必填'] }])
    expect(form.getFieldsError()).toHaveLength(1)

    form.scrollToField('title', { block: 'center' })
    expect(scrollToField).toHaveBeenCalledWith('title', { block: 'center' })

    form.resetFields()
    expect(form.getFieldsValue()).toEqual({ title: '默认标题', count: 1 })
    expect(form.getFieldsError()).toEqual([])
    expect(clearValidate).toHaveBeenCalledTimes(1)
  })

  it('校验未就绪、校验成功含列表校验器、校验失败记录错误与 submit 回调', async () => {
    const form = useFormModel()
    await expect(form.validateFields()).rejects.toThrow('表单尚未就绪')

    const onFinish = vi.fn()
    const validate = vi.fn().mockResolvedValue({})
    form.instance.value = { validate, clearValidate: vi.fn() } as any
    form.bind(onFinish, { code: 'A1' })

    const listCheck = vi.fn().mockResolvedValue(undefined)
    form.registerListValidator('rows', listCheck)
    await form.submit()
    expect(validate).toHaveBeenCalledTimes(1)
    expect(listCheck).toHaveBeenCalledTimes(1)
    expect(onFinish).toHaveBeenCalledWith({ code: 'A1' })

    // 注销列表校验器
    form.registerListValidator('rows')

    // 校验抛出 Antdv 结构错误对象时记录错误且 submit 不外抛普通对象
    validate.mockRejectedValueOnce({ errorFields: [{ name: ['code'], errors: ['不能为空'] }] })
    await form.submit()
    expect(form.getFieldsError()).toEqual([{ name: ['code'], errors: ['不能为空'] }])

    // 校验抛出 Error 实例时 submit 继续上抛
    validate.mockRejectedValueOnce(new Error('校验器异常'))
    await expect(form.submit()).rejects.toThrow('校验器异常')
  })
})
