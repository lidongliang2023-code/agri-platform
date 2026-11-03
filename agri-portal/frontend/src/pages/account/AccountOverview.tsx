/**
 * 用户中心 · 账号总览
 *
 * <p>原型《用户中心_用户端原型_V1》里的第一个页面，也是整个用户中心的落地页。
 * 它只做一件事：把散在各处的账号状态聚到一屏 —— 账号是谁、实名到哪一步、
 * 有几个身份、有什么待办、安全分多少。</p>
 *
 * <p><b>数据口径</b>：全部来自 {@code GET /api/v1/sso/account/summary} 一次返回，
 * 不在前端二次拼装假数据。安全评分是**按已核验字段现算**的（见 {@link securityScore}），
 * 每一项都能对上 summary 里的某个字段，不做"看起来 92 分"这种装饰。</p>
 */
import type { JSX } from 'react'
import { Icon } from '@/components/Icon'

/** 主体（身份）行 */
export interface OverviewMerchant {
  merchantId: string
  merchantName: string
  memberType: string | null
  roleInMerchant: string
  verifyStatus: string | null
}

/** 账号总览所需的数据（AccountCenter 的 summary 子集） */
export interface OverviewSummary {
  userId: string
  username: string
  nickname: string
  phone: string
  email: string | null
  status: number
  createdAt: string
  realName: {
    realName: string
    status: string
    policeVerified: boolean
    livenessVerified: boolean
    verificationChannel: string | null
  } | null
  activeMerchantId: string | null
  merchants: OverviewMerchant[]
  reviewInbox: { id: string }[]
  sentJoinRequests: { id: string; status: string }[]
}

interface Props {
  summary: OverviewSummary
  /** 跳到账号中心内的某个视图 */
  onNavigate: (view: 'profile' | 'security' | 'org' | 'enterprise' | 'team' | 'roles' | 'addresses') => void
}

/** 实名状态文案 */
const REAL_NAME_TEXT: Record<string, string> = {
  pending: '审核中',
  verified: '已认证',
  rejected: '未通过',
  none: '未实名',
}

/**
 * 计算安全评分。
 *
 * <p>5 项、每项 20 分，全部取自 summary 里能判定的字段。
 * 刻意不引入"密码强度""近期修改密码"这类拿不到的维度 ——
 * 拿不到就当满分或当 0 分都是在编数字。</p>
 *
 * @param summary 账号概览
 * @returns 分数与逐项明细
 */
export function securityScore(summary: OverviewSummary): {
  score: number
  items: { label: string; done: boolean; hint: string }[]
} {
  const items = [
    { label: '绑定手机号', done: Boolean(summary.phone), hint: '用于登录与找回密码' },
    { label: '绑定邮箱', done: Boolean(summary.email), hint: '用于接收通知与对账' },
    {
      label: '个人实名认证',
      done: ['pending', 'verified'].includes(summary.realName?.status ?? ''),
      hint: '实名后才能开展交易与结算',
    },
    { label: '公安身份比对', done: Boolean(summary.realName?.policeVerified), hint: '实名核验的第二道关卡' },
    { label: '人脸活体核验', done: Boolean(summary.realName?.livenessVerified), hint: '防止身份被冒用' },
  ]
  const done = items.filter((item) => item.done).length
  return { score: Math.round((done / items.length) * 100), items }
}

/**
 * 账号总览页面
 *
 * @param props 概览数据与跳转回调
 * @returns 页面内容
 */
export function AccountOverview({ summary, onNavigate }: Props): JSX.Element {
  const { score, items: scoreItems } = securityScore(summary)
  const activeMerchant =
    summary.merchants.find((item) => item.merchantId === summary.activeMerchantId) ?? summary.merchants[0]

  /** 待办：待我审核的加入申请 + 我发出还没结果的申请 + 未实名 */
  const todo: { text: string; action?: () => void; level: 'high' | 'normal' }[] = []
  if (summary.reviewInbox.length > 0) {
    todo.push({
      text: `${summary.reviewInbox.length} 条加入申请待你审核`,
      action: () => onNavigate('team'),
      level: 'high',
    })
  }
  const pendingSent = summary.sentJoinRequests.filter((item) => item.status === 'pending')
  if (pendingSent.length > 0) {
    todo.push({ text: `${pendingSent.length} 条加入申请等待对方审核`, level: 'normal' })
  }
  if (!summary.realName || summary.realName.status === 'none') {
    todo.push({ text: '尚未完成个人实名认证', action: () => onNavigate('security'), level: 'high' })
  }
  if (!summary.email) {
    todo.push({ text: '未绑定邮箱，将收不到对账与通知邮件', action: () => onNavigate('profile'), level: 'normal' })
  }

  return (
    <div className="uc-overview">
      {/* 概览卡 */}
      <div className="uc-stat-row">
        <div className="uc-stat">
          <span className="uc-stat-icon"><Icon name="users" size={18} /></span>
          <div>
            <strong>{summary.merchants.length}</strong>
            <small>我的身份</small>
          </div>
        </div>
        <div className="uc-stat">
          <span className="uc-stat-icon"><Icon name="award" size={18} /></span>
          <div>
            <strong>{REAL_NAME_TEXT[summary.realName?.status ?? 'none'] ?? '未实名'}</strong>
            <small>个人实名状态</small>
          </div>
        </div>
        <div className="uc-stat">
          <span className="uc-stat-icon"><Icon name="clipboard" size={18} /></span>
          <div>
            <strong>{todo.length}</strong>
            <small>待处理事项</small>
          </div>
        </div>
        <div className="uc-stat">
          <span className="uc-stat-icon"><Icon name="shield" size={18} /></span>
          <div>
            <strong className={score >= 80 ? 'uc-good' : score >= 60 ? 'uc-warn' : 'uc-bad'}>{score}</strong>
            <small>安全评分</small>
          </div>
        </div>
      </div>

      <div className="uc-two-col">
        {/* 账号概况 */}
        <div className="card uc-card">
          <div className="uc-card-head">
            <h3>账号概况</h3>
            <button className="btn btn-outline btn-sm" onClick={() => onNavigate('profile')}>
              编辑资料
            </button>
          </div>
          <dl className="uc-kv">
            <dt>登录账号</dt>
            <dd>{summary.username}</dd>
            <dt>昵称</dt>
            <dd>{summary.nickname || '未设置'}</dd>
            <dt>手机号</dt>
            <dd>{summary.phone || '未绑定'}</dd>
            <dt>邮箱</dt>
            <dd>{summary.email || '未绑定'}</dd>
            <dt>注册时间</dt>
            <dd>{String(summary.createdAt ?? '').slice(0, 10) || '—'}</dd>
            <dt>账号状态</dt>
            <dd>
              <span className={`tag ${summary.status === 1 ? 'tag-tech' : ''}`}>
                {summary.status === 1 ? '正常' : '已停用'}
              </span>
            </dd>
          </dl>
        </div>

        {/* 安全评分 */}
        <div className="card uc-card">
          <div className="uc-card-head">
            <h3>安全评分</h3>
            <button className="btn btn-outline btn-sm" onClick={() => onNavigate('security')}>
              去加固
            </button>
          </div>
          <div className="uc-score-bar">
            <div className="uc-score-track">
              <div
                className={`uc-score-fill ${score >= 80 ? 'good' : score >= 60 ? 'warn' : 'bad'}`}
                style={{ width: `${score}%` }}
              />
            </div>
            <span>{score} / 100</span>
          </div>
          <ul className="uc-check-list">
            {scoreItems.map((item) => (
              <li key={item.label} className={item.done ? 'done' : ''}>
                <span className="uc-check-dot">{item.done ? '✓' : ''}</span>
                <span>{item.label}</span>
                <small>{item.hint}</small>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="uc-two-col">
        {/* 我的身份 */}
        <div className="card uc-card">
          <div className="uc-card-head">
            <h3>我的身份</h3>
            <button className="btn btn-outline btn-sm" onClick={() => onNavigate('org')}>
              我的组织
            </button>
          </div>
          {summary.merchants.length === 0 ? (
            <div className="empty">还没有任何身份，先创建或加入一个经营主体</div>
          ) : (
            <ul className="uc-identity-list">
              {summary.merchants.map((item) => {
                const isActive = item.merchantId === activeMerchant?.merchantId
                return (
                  <li key={item.merchantId} className={isActive ? 'on' : ''}>
                    <span className="uc-identity-avatar">{item.merchantName.slice(0, 1)}</span>
                    <div>
                      <strong>{item.merchantName}</strong>
                      <small>
                        {item.memberType === 'personal' ? '个人主体' : '企业主体'} · {item.roleInMerchant}
                      </small>
                    </div>
                    {isActive && <span className="tag tag-tech">当前身份</span>}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* 待办 */}
        <div className="card uc-card">
          <div className="uc-card-head">
            <h3>待办事项</h3>
          </div>
          {todo.length === 0 ? (
            <div className="empty">没有待处理事项</div>
          ) : (
            <ul className="uc-todo-list">
              {todo.map((item) => (
                <li key={item.text} className={item.level}>
                  <span className="uc-todo-dot" />
                  <span>{item.text}</span>
                  {item.action && (
                    <button className="btn btn-outline btn-sm" onClick={item.action}>
                      去处理
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
