#!/usr/bin/env node
/**
 * 开发环境「取短信验证码」小工具。
 *
 * 为什么需要：短信通道没有接真实服务商，`agri.auth.sms.mode=dev` 时验证码只写后端日志 + Redis，
 * 不回传响应体。联调时要么翻日志、要么开 redis-cli，来回切很烦，所以固化成一个命令。
 *
 * 用法：
 *   node scripts/dev-sms-code.mjs                    # 列出当前所有未过期的验证码
 *   node scripts/dev-sms-code.mjs --phone 13800000001                # 发一次 login 码并读出来
 *   node scripts/dev-sms-code.mjs --phone 13800000001 --scene register
 *   node scripts/dev-sms-code.mjs --phone 13800000001 --read-only    # 只读，不重新发（避免把用户刚收到的码顶掉）
 *
 * 场景（scene）：login / register / reset_password
 * 依赖：本机 Redis（C:\Redis）与统一认证中心（:8090）。
 */
import { execFileSync } from 'node:child_process'

const args = process.argv.slice(2)
const opt = (name, fallback = '') => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const has = (name) => args.includes(`--${name}`)

const phone = opt('phone')
const scene = opt('scene', 'login')
const readOnly = has('read-only')

const REDIS = process.env.REDIS_CLI || 'C:/Redis/redis-cli.exe'
const AUTH = process.env.AUTH_BASE || 'http://127.0.0.1:8090'

const redis = (...cmd) =>
  execFileSync(REDIS, ['-p', '6379', '-n', '0', ...cmd], { encoding: 'utf8' }).trim()

function listCodes() {
  const keys = redis('KEYS', 'agri:sms:code:*').split('\n').filter(Boolean)
  if (!keys.length) {
    console.log('当前没有未过期的验证码（5 分钟有效，过期即删）。')
    return
  }
  console.log('未过期的验证码：')
  let shown = 0
  for (const k of keys) {
    const value = redis('GET', k)
    const ttl = Number(redis('TTL', k))
    // KEYS 会带出已过期但尚未惰性删除的键（TTL<=0 或值为空），跳过，别让"已过期"冒充可用
    if (!value || ttl <= 0) continue
    shown += 1
    const [, , , sceneName, ...rest] = k.split(':')
    const phoneNo = rest.join(':')
    console.log(`  ${phoneNo.padEnd(12)} 场景 ${sceneName.padEnd(14)} 验证码 ${value}  剩余 ${ttl}s`)
  }
  if (!shown) console.log('  （没有仍在有效期内的验证码，5 分钟后自动作废）')
}

async function sendCode() {
  const res = await fetch(`${AUTH}/api/v1/sso/sms/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, scene }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || (body.code !== undefined && body.code !== 0)) {
    console.error('发码失败：', body.message || res.status)
    process.exit(1)
  }
  const hint = body.data?.hint || ''
  if (!body.data?.devMode) {
    console.error('当前不是 dev 模式，验证码不会写入 Redis/日志：', hint)
    process.exit(2)
  }
  console.log(`已发送（dev 模式，未真实发短信）：${hint}`)
}

if (!phone) {
  listCodes()
  process.exit(0)
}

if (!readOnly) await sendCode()

const key = `agri:sms:code:${scene}:${phone}`
const code = redis('GET', key)
const ttl = Number(redis('TTL', key))
if (!code) {
  console.error(`没有取到 ${phone} 在「${scene}」场景的验证码：可能刚被校验消费掉，或已过期（5 分钟）。`)
  process.exit(3)
}
console.log(`${phone}  场景 ${scene}  验证码：${code}（剩余 ${ttl}s）`)
