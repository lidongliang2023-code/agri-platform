const PRODUCT_TONES = ['green', 'amber', 'blue', 'violet', 'teal']
const productNameMap = new Map()

function compactAmount(value) {
  const amount = Number(value || 0)
  if (amount >= 100000000) return `${(amount / 100000000).toFixed(2)}亿`
  if (amount >= 10000) return `${(amount / 10000).toFixed(amount % 10000 === 0 ? 0 : 1)}万`
  return amount.toLocaleString('zh-CN')
}

/**
 * 将资金方产品配置转换为各业务端统一的展示模型。
 * 名称、利率、额度、期限、质押率和说明全部直接来自 finance_product_config。
 */
export function toProductView(product, index = 0) {
  const pledgeRate = Number(product.pledgeRate || 0)
  return {
    key: product.productCode,
    id: product.id,
    name: product.productName,
    eyebrow: String(product.productCode || '').toUpperCase(),
    description: product.description || '',
    amountMin: Number(product.amountMin || 0),
    amountMax: Number(product.amountMax || 0),
    amount: `${compactAmount(product.amountMin)} - ${compactAmount(product.amountMax)}元`,
    rateValue: Number(product.rate || 0),
    rate: `${Number(product.rate || 0).toFixed(2)}% 起`,
    termMin: Number(product.termMin || 0),
    termMax: Number(product.termMax || 0),
    term: `${product.termMin}-${product.termMax} 个月`,
    pledgeRate,
    tags: [
      pledgeRate > 0 ? `质押率 ${pledgeRate}%` : '纯信用',
      `${compactAmount(product.amountMax)}元以内`,
    ],
    tone: PRODUCT_TONES[index % PRODUCT_TONES.length],
    raw: product,
  }
}

/** 读取资金方配置后公开的启用产品目录。 */
export async function loadFinanceProducts() {
  const response = await fetch('/open/finance/products', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  const body = await response.json().catch(() => null)
  if (!response.ok || body?.code !== 200 || !Array.isArray(body.data)) {
    throw new Error(body?.message || '融资产品加载失败')
  }
  productNameMap.clear()
  body.data.forEach((product) => {
    productNameMap.set(String(product.productCode).toLowerCase(), product.productName)
  })
  return body.data.map(toProductView)
}

export function configuredProductName(code) {
  return productNameMap.get(String(code || '').toLowerCase()) || ''
}

/** 在动态产品目录中按编码查找，避免回退到写死的产品。 */
export function productByKey(products, key) {
  return products.find((item) => item.key === key) || products[0] || null
}
