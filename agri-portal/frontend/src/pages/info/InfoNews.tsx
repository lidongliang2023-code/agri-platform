import { useEffect, useState } from 'react'
import {
  formatCount,
  infoPublicApi,
  type Article,
} from './infoApi'
import { applyStructuredData, usePageMeta } from '../../utils'
import './info.css'

/**
 * 资讯详情。
 *
 * <p>列表已合并进资讯首页（`#/info` 的「产业资讯」区块），这里只负责单篇正文；
 * 返回链接指向首页的列表位置，而不是原来那个独立的列表页。</p>
 */

/** 正文按空行/换行切段：后端存的是纯文本，直接塞进 HTML 会挤成一坨。 */
function paragraphs(content?: string): string[] {
  if (!content) return []
  return content
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
}

export function InfoNewsDetail({ id }: { id: number }): JSX.Element {
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  usePageMeta(article?.title ?? '资讯详情', article?.summary)

  // 结构化数据：让搜索结果能展示标题/时间/发布方，是 hash 路由下少有的有效 SEO 手段
  useEffect(() => {
    if (!article) return
    applyStructuredData('ld-article', {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: article.title,
      description: article.summary ?? '',
      datePublished: article.publishedAt ?? article.createdAt ?? '',
      articleSection: article.channel,
      author: { '@type': 'Organization', name: article.author ?? '丰链云' },
      publisher: { '@type': 'Organization', name: '丰链云' },
      mainEntityOfPage: window.location.href,
    })
  }, [article])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    infoPublicApi.article(id)
      .then((data) => { if (!cancelled) setArticle(data) })
      .catch((reason: Error) => { if (!cancelled) setError(reason.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  if (loading) return <div className="info-page"><div className="info-loading">正在加载…</div></div>
  if (error || !article) {
    return (
      <div className="info-page">
        <a className="info-back" href="#/info">‹ 返回产业资讯</a>
        <div className="info-error">{error || '资讯不存在或已下架'}</div>
      </div>
    )
  }

  return (
    <div className="info-page">
      <a className="info-back" href="#/info">‹ 返回产业资讯</a>
      <article className="info-article">
        <h1>{article.title}</h1>
        <div className="info-meta">
          <span className="info-chip gray">{article.channel}</span>
          {article.author && <span>{article.author}</span>}
          <span>{article.publishedAt ?? article.createdAt}</span>
          <span>阅读 {formatCount(article.readCount)}</span>
          {article.attestNo && <span>已存证 {article.attestNo}</span>}
        </div>

        {article.summary && (
          <div className="info-card" style={{ marginTop: 18, background: 'var(--green-050)', borderColor: 'var(--green-100)' }}>
            <p style={{ margin: 0, color: 'var(--green-800)', fontSize: 13.5, lineHeight: 1.8 }}>{article.summary}</p>
          </div>
        )}

        <div className="info-article-body">
          {paragraphs(article.content).map((line, index) => (
            <p key={index}>{line}</p>
          ))}
          {paragraphs(article.content).length === 0 && <p className="gray">暂无正文内容</p>}
        </div>

        {article.tags && article.tags.length > 0 && (
          <div className="info-chips" style={{ marginTop: 24 }}>
            {article.tags.map((tag) => <span className="info-chip gray" key={tag}>{tag}</span>)}
          </div>
        )}
      </article>
    </div>
  )
}
