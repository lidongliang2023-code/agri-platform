import axios from 'axios'
import { reactive } from 'vue'

/**
 * 当前登录者在金融侧的身份（融资主体 / 资金机构 / 操作人）。
 *
 * <p>由后端 {@code GET /api/v1/finance/subject} 从访问令牌解析。之前没有这个来源：
 * 融资主体号写死 '2001'、资金机构写死 'PROVIDER-BANK-001'，换任何人登录看到的都是同一家
 * 的借款、还款和投资组合。</p>
 */
export const financeSubject = reactive({
  loaded: false,
  borrowerId: '',
  borrowerName: '',
  borrowerError: '',
  providerId: '',
  providerName: '',
  providerReady: false,
  operatorId: '',
  operatorName: '',
  roles: {},
})

export const financeUser = reactive({ id: '', name: '融资方' })
export const fundProvider = reactive({ id: '', name: '资金方' })
export const operationUser = reactive({ id: '', name: '平台运营' })

let pending = null

function applyIdentity(data) {
  Object.assign(financeSubject, data, { loaded: true })
  financeUser.id = data.borrowerId || ''
  financeUser.name = data.borrowerName || data.operatorName || '融资方'
  fundProvider.id = data.providerId || ''
  fundProvider.name = data.providerName || '资金方'
  operationUser.id = data.operatorId || ''
  operationUser.name = data.operatorName || '平台运营'
}

/** 拉取身份卡；并发调用共用一次请求（页面挂载时各布局都会调它）。 */
export function loadFinanceSubject(force = false) {
  if (financeSubject.loaded && !force) return Promise.resolve(financeSubject)
  if (pending) return pending
  pending = axios.get('/api/v1/finance/subject')
    .then((response) => {
      const body = response.data
      if (!body || body.code !== 200 || !body.data) {
        throw new Error(body?.message || '读取金融侧登录身份失败')
      }
      applyIdentity(body.data)
      return financeSubject
    })
    .finally(() => {
      pending = null
    })
  return pending
}
