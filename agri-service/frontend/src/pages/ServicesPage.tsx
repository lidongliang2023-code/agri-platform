import { useEffect, useMemo, useState } from 'react'
import { FilterOutlined, RobotOutlined, SearchOutlined } from '@ant-design/icons'
import { Button, Input, Select } from 'antd'
import { serviceApi } from '../api'
import { useApp } from '../app-context'
import type { Provider } from '../types'
import { EmptyState, LoadingBlock, PageTitle, ProviderCard } from '../components/ui'

export function ServicesPage(): JSX.Element {
  const { query, navigate, openServices } = useApp()
  const [providers, setProviders] = useState<Provider[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState(query.get('q') ?? '')
  const [category, setCategory] = useState(query.get('category') ?? '全部')
  const [sort, setSort] = useState('recommended')

  useEffect(() => {
    serviceApi.dictionaries()
      .then((dict) => setCategories(['全部', ...dict.categories]))
      .catch(() => setCategories(['全部']))
  }, [])

  useEffect(() => {
    setKeyword(query.get('q') ?? '')
    setCategory(query.get('category') ?? '全部')
  }, [query])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    serviceApi.providers({
      keyword: keyword || undefined,
      category: category === '全部' ? undefined : category,
      sort,
    })
      .then((items) => {
        if (!cancelled) setProviders(items)
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [keyword, category, sort])

  const heading = useMemo(
    () => keyword ? `“${keyword}” 的搜索结果` : category === '全部' ? '全部认证服务' : category,
    [keyword, category],
  )

  const search = (): void => {
    openServices(keyword.trim(), category === '全部' ? undefined : category)
  }

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="SERVICE MARKETPLACE"
        title="服务超市"
        description="平台认证、明码标价、过程可追踪。按生产场景筛选本地服务能力。"
        actions={<Button type="primary" icon={<RobotOutlined />} onClick={() => navigate('demand')}>描述需求，AI 帮我找</Button>}
      />

      <section className="filter-panel surface-card">
        <div className="filter-search">
          <Input
            size="large"
            value={keyword}
            allowClear
            prefix={<SearchOutlined />}
            placeholder="搜索服务项目、服务商或能力标签"
            onChange={(event) => setKeyword(event.target.value)}
            onPressEnter={search}
          />
          <Button size="large" type="primary" onClick={search}>搜索</Button>
        </div>
        <div className="filter-line">
          <span className="filter-label"><FilterOutlined /> 服务类型</span>
          <div className="category-tabs">
            {(categories.length ? categories : ['全部']).map((item) => (
              <button type="button" key={item} className={category === item ? 'on' : ''} onClick={() => setCategory(item)}>
                {item}
              </button>
            ))}
          </div>
          <Select
            value={sort}
            onChange={setSort}
            options={[
              { value: 'recommended', label: '综合推荐' },
              { value: 'distance', label: '距离最近' },
              { value: 'price', label: '价格最低' },
              { value: 'orders', label: '服务最多' },
            ]}
            className="sort-select"
          />
        </div>
      </section>

      <div className="result-heading">
        <div><span>{heading}</span><small>共找到 {providers.length} 家认证服务商</small></div>
        <span className="verified-note">仅展示状态为「可接单」的服务商，资质材料以其档案页公示为准</span>
      </div>

      {loading ? (
        <LoadingBlock rows={4} />
      ) : error ? (
        <EmptyState icon="📡" title="服务列表加载失败" description={error} action={<Button onClick={() => openServices()}>重新加载</Button>} />
      ) : providers.length === 0 ? (
        <EmptyState
          icon="🔎"
          title="没有找到匹配服务"
          description="换一个关键词或服务类型，也可以直接发布需求让服务商响应。"
          action={<Button type="primary" onClick={() => navigate('demand')}>发布需求</Button>}
        />
      ) : (
        <div className="provider-grid">
          {providers.map((provider) => <ProviderCard key={provider.id} provider={provider} />)}
        </div>
      )}
    </div>
  )
}
