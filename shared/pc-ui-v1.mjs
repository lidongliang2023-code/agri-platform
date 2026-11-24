import './pc-ui-v1.css'

// 此模块仅从 PC 入口引用。只增强表现与键盘操作，不读写账号和业务数据。
document.documentElement.classList.add('pc-ui-v1')
const tableSelector = '.ant-table table,.el-table table,table.data-table,table.mds-table,table.uc-table,table.log-table,table.mc-table,.table-card table,.ranking-card table,.g-table-wrap table,.o-table table,.ops-table table,.iot-table table'

const statusHeader = /^(?:状态|结果|等级|级别|合规性?|在线|启用|是否(?:达标|启用|匿名|有效|默认|置顶|推荐|必填|通过)|[\u4e00-\u9fa5A-Za-z0-9]{1,8}(?:状态|等级|级别|结果|结论))$/
const statusExclude = /时间|日期|人|原因|备注|意见|说明|名称|记录|痕迹|凭证|工单|管理|筛选|查询|规则|结构|要求|切换|\/|／|全部|班次/

const numberHeader = /^(?:数量|金额|单价|总价|小计|合计|总额|价格|货值|佣金|余额|额度|成本|成本价|利润|收入|支出|费用|实付|已退款|退款额|销量|库存|面积|产量|重量|比例|占比|得分|评分|耗时|天数|次数|人数|笔数|件数|排名|[\u4e00-\u9fa5A-Za-z0-9]{1,8}(?:金额|数量|单价|总价|总额|货值|佣金|余额|额度|成本|费用|收入|支出|退款|库存|销量|面积|产量|重量|比例|占比|率|得分|评分|耗时|天数|次数|人数|笔数|件数|限额|配额|价格|小计|合计|量))$/
const numberExclude = /名称|类型|说明|描述|原因|备注|时间|日期|地址|单号|编号|编码|ID|状态|管理|校验|预警|规则|趋势|区间|范围|承担方|方向|留痕|变化|走势|记录|云仓|品种|\/|／|阈值|全部|筛选|查询|内容|冻结|适用|搜索|数据质量|连接质量|变量/

const codeHeader = /^(?:单号|订单号|编号|编码|[\u4e00-\u9fa5A-Za-z0-9]{1,6}(?:单号|编号|编码))$/
const bareEmptyText = /^(?:No\s*Data|暂无数据)$/i
const friendlyEmptyText = '暂无符合条件的记录，请调整筛选条件或稍后再试'

function normalizeHeader(raw) {
  return (raw || '')
    .replace(/\s+/g, '')
    .replace(/[（(][^）)]*[）)]$/g, '')
    .replace(/(?:%|kg|吨|亩|元)$/i, '')
}

function classifyHeader(raw) {
  const compact = (raw || '').replace(/\s+/g, '').trim()
  if (!compact) return ''
  if (compact === '操作') return 'pc-cell-actions'
  const clean = normalizeHeader(compact)
  if (!clean) return ''
  if (statusHeader.test(clean) && !statusExclude.test(compact)) return 'pc-cell-status'
  if (numberHeader.test(clean) && !numberExclude.test(compact)) return 'pc-cell-number'
  if (codeHeader.test(clean)) return 'pc-cell-code'
  return ''
}

function enhanceEmptyStates() {
  document.querySelectorAll('.ant-empty-description,.el-table__empty-text,.el-empty__description p,.empty-inline,.empty-cell,td.empty').forEach(node => {
    if (node.children.length > 0) return
    const text = (node.textContent || '').trim()
    if (bareEmptyText.test(text)) {
      node.textContent = friendlyEmptyText
    }
  })
}

let openMoreMenu = null
function closeMoreMenu() {
  if (!openMoreMenu) return
  openMoreMenu.menu.remove()
  openMoreMenu.trigger.setAttribute('aria-expanded', 'false')
  openMoreMenu = null
}

function getActionControls(cell) {
  return [...cell.querySelectorAll('button,a')].filter(el => {
    if (el.classList.contains('pc-more-trigger') || el.classList.contains('pc-more-item')) return false
    if (el.closest('.pc-more-wrap,.ant-dropdown,.el-dropdown-menu')) return false
    if (el.classList.contains('pc-action-hidden')) return true
    const style = window.getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden') return false
    return (el.textContent || '').trim().length > 0
  })
}

function cleanActionLabel(el) {
  return (el.textContent || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1$2')
}

function isDangerControl(el) {
  const cls = el.className || ''
  if (/danger|delete|remove|reject|stop/i.test(typeof cls === 'string' ? cls : '')) return true
  const txt = cleanActionLabel(el)
  return /^(?:删除|停用|禁用|下架|驳回|拒绝|强制下线|注销|丢弃|解绑|清退|冻结|终止|关闭|撤销|作废|移出)$/.test(txt)
}

function resolveActionHost(cell, controls) {
  const known = cell.querySelector('.ant-space,.el-space,.table-actions,.row,.actions,.mds-actions,.mc-actions,.action-cell,.cell')
  if (known) return known
  const first = controls[0]
  if (first) {
    let cur = first.parentElement
    while (cur && cur !== cell) {
      if (controls.every(ctrl => cur.contains(ctrl))) return cur
      cur = cur.parentElement
    }
  }
  return cell
}

function enhanceActionCells() {
  document.querySelectorAll('td.pc-cell-actions').forEach(cell => {
    const controls = getActionControls(cell)
    const host = resolveActionHost(cell, controls)
    if (host !== cell) host.classList.add('pc-action-host')
    const existingWrap = cell.querySelector(':scope .pc-more-wrap')
    if (controls.length <= 3) {
      controls.forEach(el => el.classList.remove('pc-action-hidden'))
      if (existingWrap) existingWrap.remove()
      return
    }
    const overflow = controls.slice(2)
    controls.slice(0, 2).forEach(el => el.classList.remove('pc-action-hidden'))
    overflow.forEach(el => el.classList.add('pc-action-hidden'))
    const sig = overflow.map(el => `${cleanActionLabel(el)}|${el.disabled ? 1 : 0}|${isDangerControl(el) ? 1 : 0}`).join(';;')
    if (existingWrap && existingWrap.dataset.sig === sig && existingWrap.parentElement === host) return
    if (existingWrap) existingWrap.remove()
    const wrap = document.createElement('span')
    wrap.className = 'pc-more-wrap'
    wrap.dataset.sig = sig
    const trigger = document.createElement('button')
    trigger.type = 'button'
    trigger.className = 'pc-more-trigger'
    trigger.setAttribute('aria-haspopup', 'menu')
    trigger.setAttribute('aria-expanded', 'false')
    trigger.textContent = '更多 ▾'
    const openMenu = (focusFirst = false) => {
      closeMoreMenu()
      const menu = document.createElement('div')
      menu.className = 'pc-more-menu'
      menu.setAttribute('role', 'menu')
      overflow.forEach(orig => {
        const item = document.createElement('button')
        item.type = 'button'
        item.className = 'pc-more-item' + (isDangerControl(orig) ? ' is-danger' : '')
        item.setAttribute('role', 'menuitem')
        item.disabled = Boolean(orig.disabled || orig.classList.contains('is-disabled') || orig.classList.contains('ant-btn-disabled') || orig.getAttribute('aria-disabled') === 'true')
        item.textContent = cleanActionLabel(orig)
        item.addEventListener('click', ev => {
          ev.preventDefault()
          ev.stopPropagation()
          closeMoreMenu()
          if (!item.disabled) orig.click()
        })
        menu.appendChild(item)
      })
      document.body.appendChild(menu)
      const rect = trigger.getBoundingClientRect()
      const mw = menu.offsetWidth || 120
      const mh = menu.offsetHeight || 96
      const left = Math.max(8, Math.min(window.innerWidth - mw - 8, rect.right - mw))
      const top = rect.bottom + 4 + mh > window.innerHeight ? Math.max(8, rect.top - mh - 4) : rect.bottom + 4
      menu.style.left = `${left}px`
      menu.style.top = `${top}px`
      trigger.setAttribute('aria-expanded', 'true')
      openMoreMenu = { menu, trigger }
      if (focusFirst) {
        const firstEnabled = menu.querySelector('button.pc-more-item:not(:disabled)')
        if (firstEnabled instanceof HTMLElement) firstEnabled.focus()
      }
    }
    trigger.addEventListener('click', event => {
      event.preventDefault()
      event.stopPropagation()
      if (openMoreMenu && openMoreMenu.trigger === trigger) {
        closeMoreMenu()
        return
      }
      openMenu(event.detail === 0)
    })
    trigger.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        if (!openMoreMenu || openMoreMenu.trigger !== trigger) openMenu(true)
        else {
          const items = [...openMoreMenu.menu.querySelectorAll('button.pc-more-item:not(:disabled)')]
          const target = event.key === 'ArrowUp' ? items[items.length - 1] : items[0]
          if (target instanceof HTMLElement) target.focus()
        }
      }
    })
    wrap.appendChild(trigger)
    host.appendChild(wrap)
  })
}

document.addEventListener('click', event => {
  if (!openMoreMenu) return
  const target = event.target
  if (target instanceof Node && (openMoreMenu.menu.contains(target) || openMoreMenu.trigger.contains(target))) return
  closeMoreMenu()
})
document.addEventListener('keydown', event => {
  if (!openMoreMenu) return
  if (event.key === 'Escape') {
    const t = openMoreMenu.trigger
    closeMoreMenu()
    t.focus()
    return
  }
  if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    const items = [...openMoreMenu.menu.querySelectorAll('button.pc-more-item:not(:disabled)')]
    if (!items.length) return
    event.preventDefault()
    const current = items.indexOf(document.activeElement)
    let next = 0
    if (event.key === 'ArrowDown') next = current < 0 ? 0 : (current + 1) % items.length
    else if (event.key === 'ArrowUp') next = current <= 0 ? items.length - 1 : current - 1
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = items.length - 1
    if (items[next] instanceof HTMLElement) items[next].focus()
  }
})
window.addEventListener('scroll', closeMoreMenu, true)
window.addEventListener('resize', closeMoreMenu)

// 仅处理单层表头。分离表头、拖拽列宽及 Element 的 colgroup 由组件自身维护。
function sizeListTable(table, headings, kinds) {
  if (!table.tHead || table.tHead.rows.length !== 1 || headings.some(th => th.colSpan !== 1)) return
  if (table.closest('.el-table,.production-record-table,.ant-table-header,.ant-table-body')) return
  const viewport = table.parentElement
  if (!viewport || !viewport.matches('.ant-table-content,.mds-table-wrap,.table-wrap,.table-scroll,.g-table-wrap,.mc-table-wrap,.uc-table-wrap,.table-card,.table-wrapper,.ops-table,.o-table,.iot-table')) return
  const cols = Array.from(table.querySelectorAll(':scope > colgroup > col'))
  const widths = { 'pc-cell-number': 120, 'pc-cell-status': 100, 'pc-cell-code': 164, 'pc-cell-actions': 160 }
  let minWidth = 0
  headings.forEach((th, index) => {
    const explicit = cols[index]?.style.width || cols[index]?.getAttribute('width') || th.style.width || th.getAttribute('width')
    const time = /(?:日期|时间)$/.test(normalizeHeader(th.textContent))
    const width = th.querySelector('input[type=checkbox]') ? 48 : widths[kinds[index]] || (time ? 150 : 0)
    // 仅设置回退宽度，已配置的列和业务表样式优先。
    if (!explicit && width) th.style.setProperty('--pc-list-col', `${width}px`)
    else th.style.removeProperty('--pc-list-col')
    minWidth += explicit && /^\d+(?:px)?$/.test(explicit) ? parseFloat(explicit) : width || 132
  })
  table.classList.add('pc-fixed-list')
  table.style.setProperty('--pc-list-min', `${minWidth}px`)
  viewport.classList.add('pc-list-scroll')
}

function enhanceTables() {
  document.querySelectorAll(tableSelector).forEach(table => {
    const owner = table.closest('.ant-table,.el-table')
    let headerRow = null
    if (owner) {
      const headerTable = owner.querySelector('.el-table__header-wrapper thead tr:last-child, .ant-table-header thead tr:last-child, .ant-table-thead tr:last-child, thead tr:last-child')
      headerRow = headerTable
    } else {
      headerRow = table.querySelector('thead tr:last-child')
    }
    if (!headerRow) return
    const headings = [...headerRow.querySelectorAll('th')].filter(th => !th.classList.contains('gutter'))
    if (!headings.length) return
    const kinds = headings.map(th => classifyHeader(th.textContent))
    sizeListTable(table, headings, kinds)
    table.querySelectorAll('tr:not(.ant-table-measure-row)').forEach(row => {
      const cells = [...row.children].filter(cell => ['TD', 'TH'].includes(cell.tagName) && !cell.classList.contains('gutter'))
      if (cells.length !== kinds.length) return
      cells.forEach((cell, index) => {
        if (cell.colSpan > 1) return
        const kind = kinds[index]
        if (kind) cell.classList.add(kind)
        if (cell.tagName === 'TD' && !cell.children.length && table.classList.contains('pc-fixed-list')) {
          if (!cell.hasAttribute('title') || cell.hasAttribute('data-pc-text-title')) {
            cell.title = cell.textContent.trim()
            cell.setAttribute('data-pc-text-title', '')
          }
        }
        if (!cell.hasAttribute('tabindex')) cell.tabIndex = -1
      })
    })
    const first = table.querySelector('tbody tr:not(.ant-table-measure-row) td')
    if (first && !table.querySelector('td[tabindex="0"]')) first.tabIndex = 0
  })
  enhanceActionCells()
  enhanceEmptyStates()
}

let scheduled = false
const observer = new MutationObserver(() => {
  if (scheduled) return
  scheduled = true
  requestAnimationFrame(() => { scheduled = false; enhanceTables() })
})
function start() {
  enhanceTables()
  observer.observe(document.body, { childList: true, subtree: true })
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true })
else start()
document.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
  const cell = event.target
  if (!(cell instanceof HTMLTableCellElement) || !cell.closest('table')?.matches(tableSelector)) return
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  const table = cell.closest('table')
  const rows = [...table.rows].filter(row => row.getBoundingClientRect().height > 0)
  const rowIndex = rows.indexOf(cell.parentElement)
  let nextRow = rowIndex
  let nextColumn = cell.cellIndex
  if (event.key === 'ArrowUp') nextRow--
  if (event.key === 'ArrowDown') nextRow++
  if (event.key === 'ArrowLeft') nextColumn--
  if (event.key === 'ArrowRight') nextColumn++
  if (event.key === 'Home') nextColumn = 0
  if (event.key === 'End') nextColumn = cell.parentElement.cells.length - 1
  const next = rows[nextRow]?.cells[nextColumn]
  if (!next) return
  event.preventDefault()
  table.querySelectorAll('[tabindex="0"]').forEach(item => { item.tabIndex = -1 })
  next.tabIndex = 0
  next.focus()
})
