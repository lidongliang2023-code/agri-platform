import { useEffect, useMemo, useState } from 'react'
import { Button, Drawer, Input, Tag, message } from 'antd'
import { EyeOutlined } from '@ant-design/icons'
import { infoApi } from '../api'
import { useApp } from '../app-context'
import type { Knowledge } from '../types'
import { EmptyState, ErrorBlock, LoadingBlock, PageTitle, SectionHeading, formatCount } from '../components/ui'

/**
 * 知识库：按作物 + 关键词检索。详情走抽屉而非独立页，便于对比多条知识。
 * 内容正文使用后端约定的【小标题】+ 换行结构，这里按行渲染成段落。
 */
export function KnowledgePage(): JSX.Element {
  const { id } = useApp()
  const [items, setItems] = useState<Knowledge[] | null>(null)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [crop, setCrop] = useState('全部作物')
  const [detail, setDetail] = useState<Knowledge | null>(null)

  const load = (nextKeyword: string, nextCrop: string): void => {
    setKeyword(nextKeyword)
    setCrop(nextCrop)
    setError('')
    infoApi.knowledge({
      keyword: nextKeyword || undefined,
      crop: nextCrop === '全部作物' ? undefined : nextCrop,
    })
      .then(setItems)
      .catch((reason: Error) => setError(reason.message))
  }

  useEffect(() => { load('', '全部作物') }, [])

  // 支持从 AI 问答页通过 /knowledge/{id} 直接打开某条知识。
  useEffect(() => {
    if (!id) return
    infoApi.knowledgeDetail(id).then(setDetail).catch((reason: Error) => message.error(reason.message))
  }, [id])

  const crops = useMemo(() => {
    const unique = new Set((items ?? []).map((item) => item.crop).filter(Boolean))
    return ['全部作物', ...Array.from(unique)]
  }, [items])

  if (!items && !error) return <LoadingBlock rows={4} />
  if (error || !items) return <ErrorBlock message={error} onRetry={() => load(keyword, crop)} />

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="KNOWLEDGE BASE"
        title="农技知识库"
        description="病虫害防治、营养管理、采后处理、政策解读等标准化知识条目 · 内容由农科院与植保站审核供稿"
        actions={
          <Input.Search
            style={{ width: 260 }}
            allowClear
            placeholder="搜索标题 / 标签 / 作物"
            defaultValue={keyword}
            onSearch={(value) => load(value.trim(), crop)}
          />
        }
      />

      <section className="surface-card">
        <div className="chip-row" style={{ marginBottom: 14 }}>
          {crops.map((item) => (
            <button type="button" key={item} className={`chip${crop === item ? ' on' : ''}`} onClick={() => load(keyword, item)}>
              {item}
            </button>
          ))}
        </div>

        {items.length === 0 && (
          <EmptyState icon="📚" title="没有匹配的知识条目" description="换个关键词试试，例如「叶枯病」「缺钾」「储存」。" />
        )}

        <div className="grid-2">
          {items.map((item) => (
            <article className="knowledge-card" key={item.id} onClick={() => setDetail(item)}>
              <div className="row between">
                <b style={{ fontSize: 14 }}>{item.title}</b>
                <Tag className="soft-tag tone-green">{item.category}</Tag>
              </div>
              <p className="small" style={{ margin: '8px 0' }}>{item.summary}</p>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                <Tag className="soft-tag">{item.crop}</Tag>
                {item.tags.slice(0, 3).map((tag) => <Tag className="soft-tag" key={tag}>{tag}</Tag>)}
              </div>
              <div className="row between" style={{ marginTop: 10 }}>
                <span className="small muted">{item.sourceName} · {item.updatedAt}</span>
                <span className="small muted"><EyeOutlined /> {formatCount(item.viewCount)}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <Drawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        width={620}
        title={detail?.title ?? ''}
      >
        {detail && (
          <div className="stack">
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              <Tag className="soft-tag tone-green">{detail.category}</Tag>
              <Tag className="soft-tag">{detail.crop}</Tag>
              {detail.tags.map((tag) => <Tag className="soft-tag" key={tag}>{tag}</Tag>)}
            </div>
            <p className="small muted">来源 {detail.sourceName} · 更新 {detail.updatedAt} · 阅读 {formatCount(detail.viewCount)}</p>
            <div className="prose">
              {detail.content.split('\n').filter(Boolean).map((line, index) => (
                <p key={index}>{line}</p>
              ))}
            </div>
            {(detail.related ?? []).length > 0 && (
              <>
                <SectionHeading kicker="RELATED" title="相关知识" />
                <div className="stack" style={{ gap: 8 }}>
                  {(detail.related ?? []).map((item) => (
                    <button
                      type="button"
                      className="related-row"
                      key={item.id}
                      onClick={() => infoApi.knowledgeDetail(item.id).then(setDetail).catch((reason: Error) => message.error(reason.message))}
                    >
                      <b>{item.title}</b>
                      <span className="small muted">{item.category} · {item.crop}</span>
                      <span className="small muted">{item.summary}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            <Button onClick={() => message.success('已收藏到我的收藏')}>收藏这条知识</Button>
          </div>
        )}
      </Drawer>
    </div>
  )
}
