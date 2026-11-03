import { useEffect, useState } from 'react'
import { LikeOutlined, StarOutlined } from '@ant-design/icons'
import { Button, Input, message } from 'antd'
import { infoApi } from '../api'
import { useApp } from '../app-context'
import type { ArticleDetail } from '../types'
import { ArticleCard, ErrorBlock, LoadingBlock, PageTitle } from '../components/ui'

export function NewsDetailPage(): JSX.Element {
  const { id, navigate } = useApp()
  const [article, setArticle] = useState<ArticleDetail | null>(null)
  const [error, setError] = useState('')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = (): void => {
    if (!id) return
    setError('')
    infoApi.article(id).then(setArticle).catch((reason: Error) => setError(reason.message))
  }

  useEffect(() => { load() }, [id])

  if (!id) return <ErrorBlock message="缺少资讯编号，请从资讯频道进入" />
  if (!article && !error) return <LoadingBlock rows={4} />
  if (error || !article) return <ErrorBlock message={error} />

  const submitComment = async (): Promise<void> => {
    if (!comment.trim()) {
      message.warning('请填写评论内容')
      return
    }
    setSubmitting(true)
    try {
      await infoApi.commentArticle(article.id, { content: comment.trim(), region: '平台用户' })
      message.success('评论已发布')
      setComment('')
      load()
    } catch (reason) {
      message.error((reason as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow={`${article.channel} · ${article.contentType}`}
        title={article.title}
        description={`${article.author} · ${article.publishedAt} · 阅读 ${article.readCount} · 来源：${article.source}`}
        actions={
          <>
            <Button icon={<LikeOutlined />} onClick={() => infoApi.likeArticle(article.id).then(() => { message.success('已点赞'); load() })}>
              点赞 {article.likeCount}
            </Button>
            <Button icon={<StarOutlined />} onClick={() => infoApi.addFavorite({
              targetType: 'article',
              targetId: article.id,
              title: article.title,
              summary: `${article.author} · ${article.publishedAt}`,
            }).then(() => message.success('已收藏')).catch((reason: Error) => message.error(reason.message))}>
              {article.favorited ? '已收藏' : '收藏'}
            </Button>
            <Button type="primary" onClick={() => navigate('news')}>返回资讯频道</Button>
          </>
        }
      />

      <div className="grid-main-aside">
        <div className="stack">
          <section className="surface-card">
            <div className="tag-row" style={{ marginBottom: 14 }}>
              <span className="soft-tag tone-green">{article.channel}</span>
              {article.aiGenerated && <span className="soft-tag tone-purple">✦ AI 辅助生成</span>}
              {article.tags.map((tag) => <span className="soft-tag" key={tag}>#{tag}</span>)}
            </div>
            <div className="prose">{article.content}</div>
            <div className="source-note">
              内容来源：{article.source}；本文经平台审核后发布{article.attestation ? `，并已在${article.attestation.chainName}完成存证（${article.attestation.attestNo}）` : ''}。
              {article.aiGenerated && ' AI 生成内容已通过人工抽检，关键数据以官方发布为准。'}
            </div>
          </section>

          <section className="surface-card">
            <b style={{ fontSize: 14 }}>评论（{article.comments.length}）</b>
            <div className="row" style={{ marginTop: 12, gap: 8 }}>
              <Input.TextArea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="说说你的看法或补充本地情况…"
                autoSize={{ minRows: 2, maxRows: 4 }}
                maxLength={300}
              />
              <Button type="primary" loading={submitting} onClick={() => void submitComment()}>发布</Button>
            </div>
            <div style={{ marginTop: 8 }}>
              {article.comments.map((item) => (
                <div className="comment-item" key={item.id}>
                  <span className="comment-avatar">{item.userName.slice(0, 1)}</span>
                  <div className="comment-body">
                    <b>{item.userName} <span className="soft-tag" style={{ marginLeft: 6 }}>{item.userRegion}</span></b>
                    <p>{item.content}</p>
                    <small>{item.createdAt} · 赞 {item.likeCount}</small>
                  </div>
                </div>
              ))}
              {article.comments.length === 0 && <p className="muted small">还没有评论，来说两句。</p>}
            </div>
          </section>
        </div>

        <aside className="stack">
          {article.attestation && (
            <section className="surface-card">
              <b style={{ fontSize: 13.5 }}>⛓ 内容存证</b>
              <div className="kv-list" style={{ marginTop: 10 }}>
                <div className="kv"><span>存证编号</span><b>{article.attestation.attestNo}</b></div>
                <div className="kv"><span>链名称</span><b>{article.attestation.chainName}</b></div>
                <div className="kv"><span>区块高度</span><b>{article.attestation.blockHeight}</b></div>
                <div className="kv"><span>存证时间</span><b>{article.attestation.attestedAt}</b></div>
              </div>
              <div className="hash-box" style={{ marginTop: 10 }}>{article.attestation.contentHash}</div>
              <Button size="small" style={{ width: '100%', marginTop: 10 }} onClick={() => navigate('attest')}>去验证</Button>
            </section>
          )}

          <section className="surface-card">
            <b style={{ fontSize: 13.5, display: 'block', marginBottom: 10 }}>相关阅读</b>
            <div className="stack">
              {article.related.map((item) => <ArticleCard key={item.id} article={item} compact />)}
              {article.related.length === 0 && <p className="muted small">暂无相关资讯</p>}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
