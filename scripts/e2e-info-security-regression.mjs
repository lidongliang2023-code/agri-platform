#!/usr/bin/env node
// 资讯发布边界、令牌身份隔离与并发报名回归。仅清理本轮创建的 ID。
import { execFileSync } from 'node:child_process'
import process from 'node:process'
const INFO = process.env.INFO_URL || 'http://localhost:8096'
const CORE = process.env.CORE_URL || 'http://localhost:8093'
const MYSQL = process.env.MYSQL_BIN || 'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe'
const mark = `INFO-SEC-${Date.now()}`
const esc = s => `'${String(s).replaceAll("'", "''")}'`
const sql = q => execFileSync(MYSQL, ['-uroot', `-p${process.env.AGRI_INFO_DB_PASSWORD || 'root'}`, '--default-character-set=utf8mb4', '-N', '-B', '-e', `USE agri_info; ${q}`], { encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const ids = { articles: [], course: null, lesson: null }
let checks = 0, failures = 0
function check(ok, label, detail = '') { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ': ' + detail : ''}`) }
async function call(method, path, token, body, nickname = mark) {
  const r = await fetch(`${INFO}${path}`, { method, signal: AbortSignal.timeout(15000), headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'X-Agri-User': encodeURIComponent(nickname), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const json = await r.json(); return { status: r.status, ...json }
}
async function login(username) {
  const r = await fetch(`${CORE}/api/v1/auth/login`, { method: 'POST', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password: process.env.E2E_PASSWORD || 'Admin@123' }) })
  const j = await r.json(); const token = j.data?.accessToken
  if (!token) throw new Error(`无法登录 ${username}`)
  const me = await (await fetch(`${CORE}/api/v1/auth/me`, { signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${token}` } })).json()
  if (!me.data?.id) throw new Error('认证用户 ID 缺失')
  return { token, owner: `uid:${me.data.id}` }
}
try {
  const health = await (await fetch(`${INFO}/actuator/health`, { signal: AbortSignal.timeout(5000) })).json()
  check(health.status === 'UP', '资讯服务健康')
  const a = await login('admin'), b = await login('farmer')
  check(a.owner !== b.owner, '两个真实账号 ID 不同')
  for (const state of ['draft', 'pending', 'offline', 'rejected', 'published']) {
    const title = `${mark}-${state}`
    const id = Number(sql(`INSERT INTO info_article(article_no,title,channel,content,status) VALUES(${esc(title)},${esc(title)},'行情分析','PRIVATE-BODY',${esc(state)}); SELECT LAST_INSERT_ID();`))
    ids.articles.push(id)
    for (const token of [null, b.token]) {
      const prefix = token ? '/api/v1/info' : '/api/v1/info/public'
      const r = await call('GET', `${prefix}/articles/${id}`, token)
      check(state === 'published' ? r.status === 200 && r.data?.content === 'PRIVATE-BODY' : r.status === 404 && !r.data,
        `${token ? '登录用户' : '公开'}详情 ${state}`, `HTTP ${r.status}`)
    }
    if (state !== 'published') {
      check(sql(`SELECT read_count FROM info_article WHERE id=${id}`) === '0', `${state} 未增加阅读量`)
      const like = await call('POST', `/api/v1/info/articles/${id}/like`, b.token)
      const comment = await call('POST', `/api/v1/info/articles/${id}/comments`, b.token, { content: mark })
      check(like.status === 404 && comment.status === 404, `${state} 禁止点赞评论`)
    }
  }
  const article = ids.articles.at(-1)
  const fav = await call('POST', '/api/v1/info/favorites', a.token, { targetType: 'article', targetId: article, title: mark })
  const fid = fav.data?.favorites?.find(it => Number(it.targetId) === article)?.id
  check(fav.status === 200 && Boolean(fid), '创建账号 A 收藏')
  check(sql(`SELECT owner FROM info_favorite WHERE id=${Number(fid)}`) === a.owner, '收藏使用令牌 ID 而非昵称落库')
  const stolen = await call('GET', '/api/v1/info/favorites', b.token)
  check(!stolen.data?.some(it => String(it.id) === String(fid)), '账号 B 伪造相同昵称读不到 A 收藏')
  await call('DELETE', `/api/v1/info/favorites/${fid}`, b.token)
  check(sql(`SELECT COUNT(*) FROM info_favorite WHERE id=${Number(fid)}`) === '1', '账号 B 不能删除 A 收藏')
  const changed = await call('GET', '/api/v1/info/favorites', a.token, null, `${mark}-changed`)
  check(changed.data?.some(it => String(it.id) === String(fid)), '账号 A 换昵称头仍能读到自身收藏')
  check((await call('GET', '/api/v1/info/favorites', null)).status === 401, '无令牌不回退到共享身份')
  const invalid = await call('GET', '/api/v1/info/favorites', 'invalid')
  check([401, 403].includes(invalid.status), '伪造令牌拒绝访问私域')

  const cid = Number(sql(`INSERT INTO info_course(title,learners,status) VALUES(${esc(mark)},0,'published'); SELECT LAST_INSERT_ID();`)); ids.course = cid
  const lid = Number(sql(`INSERT INTO info_course_lesson(course_id,seq,title,duration_sec,video_url,free_preview,status) VALUES(${cid},1,${esc(mark)},100,'e2e-not-a-real-video.mp4',FALSE,'published'); SELECT LAST_INSERT_ID();`)); ids.lesson = lid
  const enroll = () => call('POST', `/api/v1/info/courses/${cid}/enroll`, a.token)
  check((await enroll()).status === 200 && (await enroll()).status === 200, '连续重复报名成功幂等')
  const concurrent = await Promise.all(Array.from({ length: 12 }, enroll))
  check(concurrent.every(it => it.status === 200), '12 个并发重复报名均正常返回')
  check(sql(`SELECT learners FROM info_course WHERE id=${cid}`) === '1', '同一用户学员数只增加 1')
  check(sql(`SELECT COUNT(*) FROM info_course_enrollment WHERE course_id=${cid}`) === '1', '同一课程同一用户报名记录唯一')
  check(sql(`SELECT COUNT(*) FROM info_subscription WHERE target_type='course' AND target_name=${esc(mark)}`) === '1', '课程订阅不重复')
  const progress = await call('POST', `/api/v1/info/courses/${cid}/lessons/${lid}/progress`, a.token, { positionSec: 40 })
  check(progress.status === 200 && progress.data?.positionSec === 40, '账号 A 写入学习进度')
  const own = await call('GET', `/api/v1/info/courses/${cid}`, a.token, null, `${mark}-new`)
  check(own.data?.enrolled === true && own.data?.lessons?.[0]?.positionSec === 40, '同账号改昵称头报名和学习进度保持一致')
  const other = await call('GET', `/api/v1/info/courses/${cid}`, b.token)
  check(other.data?.enrolled === false && Number(other.data?.lessons?.[0]?.positionSec) === 0, 'B 伪造昵称无法读取 A 报名与进度')
  const denied = await call('POST', `/api/v1/info/courses/${cid}/lessons/${lid}/play-ticket`, b.token)
  check(denied.status === 400, 'B 未报名不能获取 A 课程播放票据')
  sql(`DELETE FROM info_subscription WHERE target_name=${esc(mark)} AND owner=${esc(a.owner)}; UPDATE info_course SET title=${esc(mark + '-renamed')} WHERE id=${cid};`)
  check((await call('GET', `/api/v1/info/courses/${cid}`, a.token)).data?.enrolled === true, '课程改名/删除订阅不会丢失报名')
  await enroll()
  check(sql(`SELECT learners FROM info_course WHERE id=${cid}`) === '1', '改名后重复报名不会再次计数')
  const second = await call('POST', `/api/v1/info/courses/${cid}/enroll`, b.token)
  check(second.status === 200 && sql(`SELECT learners FROM info_course WHERE id=${cid}`) === '2', '不同真实账号各计 1 名学员')
  // 真正首次并发报名使用新课程，避免只验证已报名后的快速返回。
  sql(`DELETE FROM info_course_enrollment WHERE course_id=${cid}; DELETE FROM info_subscription WHERE target_name IN (${esc(mark)},${esc(mark + '-renamed')}); UPDATE info_course SET learners=0 WHERE id=${cid};`)
  const firstConcurrent = await Promise.all(Array.from({ length: 12 }, enroll))
  check(firstConcurrent.every(it => it.status === 200), '首次报名 12 个并发请求无异常')
  check(sql(`SELECT learners FROM info_course WHERE id=${cid}`) === '1' && sql(`SELECT COUNT(*) FROM info_course_enrollment WHERE course_id=${cid}`) === '1', '首次并发报名人数与记录均为 1')
  check(sql(`SELECT COUNT(*) FROM info_subscription WHERE target_name=${esc(mark + '-renamed')}`) === '1', '首次并发报名只生成 1 条订阅')
  const op = await call('POST', '/api/v1/info/ops/contents', a.token, { title: `${mark}-ops`, channel: '行情分析', content: mark, status: 'draft' })
  if (op.data?.id) ids.articles.push(Number(op.data.id))
  check(op.status === 200, '运营仍可创建草稿')
  const preview = await call('GET', `/api/v1/info/ops/contents/${op.data?.id}`, a.token)
  check(preview.status === 200 && preview.data?.status === 'draft', '运营专用预览仍可读取草稿')
  check((await call('GET', `/api/v1/info/ops/contents/${op.data?.id}`, b.token)).status === 403, '普通用户不能访问运营预览')
  check(sql(`SELECT operator_name FROM info_audit_log WHERE target_name=${esc(mark + '-ops')} ORDER BY id DESC LIMIT 1`) === a.owner, '运营审计不信任昵称头')
} catch (e) {
  failures++; console.error('ERROR', e.message)
} finally {
  try {
    if (ids.articles.length) {
      const list = ids.articles.join(',')
      sql(`DELETE FROM info_article_comment WHERE article_id IN (${list}); DELETE FROM info_favorite WHERE target_type='article' AND target_id IN (${list}); DELETE FROM info_article WHERE id IN (${list});`)
    }
    if (ids.course) sql(`DELETE FROM info_course_learn WHERE course_id=${ids.course}; DELETE FROM info_course_enrollment WHERE course_id=${ids.course}; DELETE FROM info_course_lesson WHERE course_id=${ids.course}; DELETE FROM info_course WHERE id=${ids.course};`)
    sql(`DELETE FROM info_subscription WHERE target_type='course' AND target_name IN (${esc(mark)},${esc(mark + '-renamed')}); DELETE FROM info_audit_log WHERE target_name=${esc(mark + '-ops')};`)
    check(sql(`SELECT (SELECT COUNT(*) FROM info_article WHERE title LIKE ${esc(mark + '%')})+(SELECT COUNT(*) FROM info_course WHERE title LIKE ${esc(mark + '%')})+(SELECT COUNT(*) FROM info_subscription WHERE target_name LIKE ${esc(mark + '%')})+(SELECT COUNT(*) FROM info_audit_log WHERE target_name LIKE ${esc(mark + '%')});`) === '0', '本轮测试夹具零残留')
  } catch (e) { failures++; console.error('CLEANUP ERROR', e.message) }
}
console.log(`RESULT checks=${checks} failures=${failures}`)
if (failures) process.exitCode = 1
