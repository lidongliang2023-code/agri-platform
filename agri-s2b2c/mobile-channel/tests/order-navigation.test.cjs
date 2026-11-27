const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const Vue = require('vue')
const { parse, compileScript } = require('vue/compiler-sfc')

const src = path.resolve(__dirname, '../src')
const read = file => fs.readFileSync(path.join(src, file), 'utf8')
const order = { id: '202611181510102', orderNo: 'TEST-AS-20261118-1510-02', status: 'REFUNDED', payAmount: 1 }
const sale = { id: '202611181510302', orderId: order.id, orderNo: order.orderNo, type: 'RETURN', status: 'COMPLETED' }
const notice = { id: '8123', refId: order.id, refType: 'ORDER', title: '退款已完成' }
const route = '/pages/orders/detail'

// 编译实际页面和模块，只替换 uni 运行环境、身份和网络传输。编译结果仅缓存在内存中。
const compiled = new Map()
function code(file) {
  if (!compiled.has(file)) {
    let source = read(file)
    if (file.endsWith('.vue')) {
      const { descriptor, errors } = parse(source, { filename: file })
      assert.deepEqual(errors, [])
      source = compileScript(descriptor, { id: 'nav-test', inlineTemplate: true,
        templateOptions: { compilerOptions: { isCustomElement: tag => /^[a-z]/.test(tag), hoistStatic: false } } }).content
    }
    source = source.replaceAll('import.meta.env.VITE_S2B2C_API_BASE', 'undefined')
    compiled.set(file, ts.transpileModule(source, { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
    } }).outputText)
  }
  return compiled.get(file)
}

function harness(notices = [notice]) {
  const requests = [], navigations = [], hooks = {}, modules = new Map()
  const detailData = { order, items: [], commissions: [], afterSales: [sale] }
  const responses = {
    '/channel/orders': { records: [order], total: 1 }, '/channel/notices': { records: notices, total: notices.length },
    '/channel/customer/74': { profile: { id: '74' }, orders: [order] },
    [`/channel/order/${order.id}`]: detailData, [`/channel/order/${order.id}/shipment`]: null,
  }
  const uni = {
    getSystemInfoSync: () => ({ uniPlatform: 'web' }), getStorageInfoSync: () => ({ keys: [] }),
    getStorageSync: key => key === 's2b2c_channel_mobile_session' ? { id: '63' } : '',
    $on() {}, stopPullDownRefresh() {}, navigateTo: ({url}) => navigations.push(url),
    request({url, method, success}) {
      assert.equal(method, 'GET')
      const endpoint = url.split('?')[0].replace(/^\/api/, '')
      requests.push(endpoint)
      const known = Object.hasOwn(responses, endpoint)
      const wrongOrder = !known && endpoint.startsWith('/channel/order/')
      success({ statusCode: wrongOrder ? 404 : 200, data: known ? responses[endpoint]
        : wrongOrder ? {message: '订单不存在'} : endpoint.includes('after-sale') ? [sale] : {} })
    },
  }
  const lifecycle = Object.fromEntries(['onLoad', 'onShow', 'onReachBottom', 'onPullDownRefresh'].map(name => [name, fn => { hooks[name] = fn }]))
  function load(file) {
    if (modules.has(file)) return modules.get(file)
    const exports = {}
    function resolve(name) {
      if (name === 'vue') return Vue
      if (name === '@dcloudio/uni-app') return lifecycle
      if (name.endsWith('/mobile-unified-auth')) return { getUnifiedToken: () => 'fixture' }
      if (name.endsWith('/MobileInputSheet.vue')) return { name: 'InputSheetStub' }
      return load(path.normalize(path.join(path.dirname(file), name + '.ts')))
    }
    new Function('require', 'exports', 'uni', code(file))(resolve, exports, uni)
    modules.set(file, exports)
    return exports
  }
  async function page(name, options = {}) {
    delete hooks.onLoad; delete hooks.onShow
    const render = load(`pages/${name}.vue`).default.setup({}, { expose() {} })
    hooks.onLoad?.(options)
    await hooks.onShow?.()
    await new Promise(resolve => setImmediate(resolve))
    return () => render({}, [])
  }
  return { page, requests, navigations }
}

// 从渲染树中按可见文字找可点击节点，直接调用编译后的 onTap。
function nodes(vnode) {
  if (!vnode || typeof vnode !== 'object') return []
  return [vnode, ...(Array.isArray(vnode.children) ? vnode.children.flatMap(nodes) : [])]
}
function text(vnode) { return nodes(vnode).map(n => typeof n.children === 'string' ? n.children : '').join('') }
function taps(tree, label) { return nodes(tree).filter(n => n.props?.onTap && text(n).includes(label)) }
function tap(tree, label) {
  const matches = taps(tree, label)
  assert.equal(matches.length, 1, `应只有一个可点的“${label}”`)
  matches[0].props.onTap({})
}

for (const [title, source, label] of [
  ['订单列表', 'orders/index', '查看详情'], ['售后记录', 'orders/index', order.orderNo],
  ['订单通知', 'notices/index', '查看订单'], ['工作台最近订单', 'home/index', order.orderNo],
  ['客户画像', 'customers/detail', order.orderNo],
]) {
  test(`${title}跳到原订单，同时加载正确的详情和物流`, async () => {
    const h = harness()
    const render = await h.page(source, { id: '74' })
    if (title === '售后记录') {
      tap(render(), '售后')
      await new Promise(resolve => setImmediate(resolve))
    }
    tap(render(), label)
    assert.deepEqual(h.navigations, [`${route}?id=${order.id}`])
    const target = new URL(h.navigations[0], 'https://fixture.invalid')
    assert.ok(JSON.parse(read('pages.json')).pages.some(p => '/' + p.path === target.pathname))
    const before = h.requests.length
    const detail = await h.page(target.pathname.slice('/pages/'.length), Object.fromEntries(target.searchParams))
    assert.deepEqual(h.requests.slice(before).sort(), [`/channel/order/${order.id}`, `/channel/order/${order.id}/shipment`])
    assert.ok(text(detail()).includes(order.orderNo))
    assert.ok(text(detail()).includes('已退款'))
  })
}
for (const invalid of [{ refType: 'PRODUCT' }, { refId: null }]) {
  test(`无关或缺失订单引用时隐藏通知跳转 ${JSON.stringify(invalid)}`, async () => {
    const h = harness([{ ...notice, ...invalid }])
    const render = await h.page('notices/index')
    assert.ok(text(render()).includes(notice.title))
    assert.equal(taps(render(), '查看订单').length, 0)
  })
}
test('详情缺少订单 ID 时提示并停止请求', async () => {
  const h = harness()
  const render = await h.page('orders/detail')
  assert.ok(text(render()).includes('缺少订单编号'))
  assert.deepEqual(h.requests, [])
})
test('误传售后 ID 时展示订单查询错误', async () => {
  const h = harness()
  const render = await h.page('orders/detail', { id: sale.id })
  assert.ok(text(render()).includes('订单不存在'))
  assert.equal(taps(render(), '重新加载').length, 1)
  assert.ok(!text(render()).includes(order.orderNo))
})
