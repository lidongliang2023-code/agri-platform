import { computed, defineComponent, onBeforeUnmount, onMounted, ref, shallowRef, watch, type PropType, type VNodeChild } from 'vue'
import { Link, useNavigate } from '@/vue/router'
import { ConfigProvider } from '@/vue/ui'
import {
  AlertOutlined,
  ApiOutlined,
  AppstoreOutlined,
  BellOutlined,
  CarOutlined,
  CustomerServiceOutlined,
  DollarOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  HeartOutlined,
  HomeOutlined,
  LogoutOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  StarOutlined,
  SwapOutlined,
  TeamOutlined,
  UpOutlined,
  UserOutlined,
} from '@ant-design/icons-vue'
import { logoutBrowser } from '@agri/shared/auth/logout'
import { WorkspaceHeader } from '@/vue/shared'
import { BrandMark } from '@/components/BrandMark'
import { clearSession, getAccessToken, getCurrentUser } from '@/utils/session'
import { ssoLogoutUrl } from '@/utils/sso'
import '@/pages/member-center/member-center.css'

interface NavItem {
  key: string
  label: string
  icon: VNodeChild
  group: string
}

const PERSONAL_CENTER = `${window.location.protocol}//${window.location.hostname}:8098/portal/#/account/business`

const BUYER_NAV: NavItem[] = [
  { key: 'agent', label: '采购 Agent', icon: <FileTextOutlined />, group: '交易寻源' },
  { key: 'overview', label: '首页概览', icon: <HomeOutlined />, group: '交易寻源' },
  { key: 'demand-list', label: '采购需求', icon: <FileSearchOutlined />, group: '交易寻源' },
  { key: 'inquiry', label: '询价与报价', icon: <FileSearchOutlined />, group: '交易寻源' },
  { key: 'chat', label: '洽谈消息', icon: <CustomerServiceOutlined />, group: '交易寻源' },
  { key: 'purchase', label: '采购订单', icon: <ShoppingCartOutlined />, group: '订单履约' },
  { key: 'after', label: '收货与售后', icon: <CarOutlined />, group: '订单履约' },
  { key: 'rate', label: '采购评价', icon: <StarOutlined />, group: '订单履约' },
  { key: 'contract', label: '合同管理', icon: <FileTextOutlined />, group: '资产与账务' },
  { key: 'fund', label: '资金与发票', icon: <DollarOutlined />, group: '资产与账务' },
  { key: 'favorite', label: '收藏与关注', icon: <HeartOutlined />, group: '资产与账务' },
]

const SELLER_NAV: NavItem[] = [
  { key: 'agent', label: '供货 Agent', icon: <FileTextOutlined />, group: '商品与撮合' },
  { key: 'overview', label: '首页概览', icon: <HomeOutlined />, group: '商品与撮合' },
  { key: 'goods', label: '商品管理', icon: <AppstoreOutlined />, group: '商品与撮合' },
  { key: 'p2t', label: '产销对接（承接）', icon: <SwapOutlined />, group: '商品与撮合' },
  { key: 'trade', label: '报价与撮合', icon: <StarOutlined />, group: '商品与撮合' },
  { key: 'chat', label: '洽谈消息', icon: <CustomerServiceOutlined />, group: '商品与撮合' },
  { key: 'sales', label: '销售订单', icon: <ShopOutlined />, group: '履约与售后' },
  { key: 'ship', label: '发货与物流', icon: <CarOutlined />, group: '履约与售后' },
  { key: 'after', label: '售后处理', icon: <AlertOutlined />, group: '履约与售后' },
  { key: 'rate', label: '店铺评价与信用', icon: <StarOutlined />, group: '履约与售后' },
  { key: 'contract', label: '合同管理', icon: <FileTextOutlined />, group: '账务与客户' },
  { key: 'fund', label: '资金结算', icon: <DollarOutlined />, group: '账务与客户' },
  { key: 'customer', label: '客户管理', icon: <TeamOutlined />, group: '账务与客户' },
  { key: 'iot', label: '生产接入', icon: <ApiOutlined />, group: '账务与客户' },
]

const memberTheme = {
  token: {
    colorPrimary: '#2d8f4e',
    colorLink: '#1b6332',
    colorLinkHover: '#247a3f',
    colorSuccess: '#2d8f4e',
    colorInfo: '#2d8f4e',
    borderRadius: 6,
    controlOutline: 'rgba(45, 143, 78, 0.12)',
  },
}

/**
 * 独立详情路由共用的会员中心工作区壳（左侧深色导航栏 + 统一顶栏面包屑 + 可滚主区）。
 */
export const OrderMemberWorkspaceShell = defineComponent({
  name: 'OrderMemberWorkspaceShell',
  props: {
    role: { type: String as PropType<'buyer' | 'seller'>, default: 'buyer' },
    merchantName: { type: String, default: '' },
    orderNo: { type: String, default: '' },
  },
  setup(props, { slots }) {
    const navigate = useNavigate()
    const collapsed = ref(window.matchMedia('(min-width: 1024px) and (max-width: 1279px)').matches)
    const isMobile = ref(window.matchMedia('(max-width: 1023px)').matches)
    const drawerOpen = ref(false)
    const userMenuOpen = ref(false)
    const scrollHost = shallowRef<HTMLDivElement | null>(null)

    const roleText = computed(() => (props.role === 'seller' ? '卖家中心' : '买家中心'))
    const basePath = computed(() => (props.role === 'seller' ? '/member/seller' : '/member/buyer'))
    const listTabKey = computed(() => (props.role === 'seller' ? 'sales' : 'purchase'))
    const listLabel = computed(() => (props.role === 'seller' ? '销售订单' : '采购订单'))
    const navItems = computed(() => (props.role === 'seller' ? SELLER_NAV : BUYER_NAV))

    const sessionUser = computed(() => getCurrentUser())
    const displayName = computed(
      () =>
        props.merchantName ||
        sessionUser.value?.nickname ||
        sessionUser.value?.username ||
        (props.role === 'seller' ? '卖家会员' : '买家会员'),
    )
    const avatar = computed(() => displayName.value.slice(0, 1))

    const navGroups = computed(() =>
      navItems.value.reduce<Array<{ title: string; items: NavItem[] }>>((acc, item) => {
        const last = acc[acc.length - 1]
        if (last && last.title === item.group) last.items.push(item)
        else acc.push({ title: item.group, items: [item] })
        return acc
      }, []),
    )

    let dispose: (() => void) | undefined
    onMounted(() => {
      const compactMedia = window.matchMedia('(min-width: 1024px) and (max-width: 1279px)')
      const mobileMedia = window.matchMedia('(max-width: 1023px)')
      const syncViewport = () => {
        isMobile.value = mobileMedia.matches
        if (!mobileMedia.matches) {
          drawerOpen.value = false
          collapsed.value = compactMedia.matches
        }
      }
      compactMedia.addEventListener('change', syncViewport)
      mobileMedia.addEventListener('change', syncViewport)
      const closeOnDocClick = (event: MouseEvent) => {
        if (!(event.target instanceof HTMLElement) || !event.target.closest('.pc-side-user')) userMenuOpen.value = false
      }
      document.addEventListener('click', closeOnDocClick)
      dispose = () => {
        compactMedia.removeEventListener('change', syncViewport)
        mobileMedia.removeEventListener('change', syncViewport)
        document.removeEventListener('click', closeOnDocClick)
      }
    })
    onBeforeUnmount(() => {
      dispose?.()
    })

    watch(
      () => props.orderNo,
      () => {
        if (scrollHost.value) scrollHost.value.scrollTop = 0
      },
    )

    const logout = () => {
      void logoutBrowser({
        token: getAccessToken(),
        clientId: 'trade',
        ssoOrigin: new URL(ssoLogoutUrl()).origin,
        clear: clearSession,
      })
    }

    return () => (
      <ConfigProvider theme={memberTheme}>
        <div
          class={`mc-shell${!isMobile.value && collapsed.value ? ' is-collapsed' : ''}${
            drawerOpen.value ? ' is-drawer-open' : ''
          }`}
        >
          {drawerOpen.value && (
            <button
              type="button"
              class="mc-drawer-overlay"
              aria-label="关闭导航菜单"
              onClick={() => {
                drawerOpen.value = false
              }}
            />
          )}
          <aside class={`mc-side${drawerOpen.value ? ' is-open' : ''}`}>
            <a class="mc-brand" href="/" title="丰链云">
              <span class="mc-brand-logo">
                <BrandMark size={34} />
              </span>
              <span class="mc-brand-copy">
                丰链云<small>FENGCHAIN · AGRI</small>
              </span>
            </a>
            <div class="mc-side-scroll">
              {navGroups.value.map(group => (
                <div key={group.title} class="mc-side-section">
                  <nav class="mc-side-nav">
                    {group.items.map(item => (
                      <button
                        type="button"
                        key={item.key}
                        class={item.key === listTabKey.value ? 'on' : ''}
                        title={item.label}
                        aria-label={item.label}
                        onClick={() => {
                          drawerOpen.value = false
                          navigate(`${basePath.value}?tab=${encodeURIComponent(item.key)}`)
                        }}
                      >
                        <span class="mc-nav-icon">{item.icon}</span>
                        <span class="mc-nav-label">{item.label}</span>
                      </button>
                    ))}
                  </nav>
                </div>
              ))}
              <div class="mc-side-section">
                <nav class="mc-side-nav">
                  <a href="/hall" title="交易大厅" aria-label="交易大厅">
                    <span class="mc-nav-icon">
                      <ShopOutlined />
                    </span>
                    <span class="mc-nav-label">交易大厅</span>
                  </a>
                  <a href={PERSONAL_CENTER} target="_blank" rel="noreferrer" title="个人中心" aria-label="个人中心">
                    <span class="mc-nav-icon">
                      <SwapOutlined />
                    </span>
                    <span class="mc-nav-label">个人中心</span>
                  </a>
                </nav>
              </div>
            </div>
            <div class="pc-side-user">
              <button
                type="button"
                class="pc-side-user-trigger"
                title={`${displayName.value} · ${roleText.value}`}
                aria-expanded={userMenuOpen.value}
                aria-haspopup="menu"
                onClick={(event: MouseEvent) => {
                  event.stopPropagation()
                  userMenuOpen.value = !userMenuOpen.value
                }}
              >
                <span class="pc-side-user-avatar">{avatar.value}</span>
                <span class="pc-side-user-meta">
                  <strong>{displayName.value}</strong>
                  <small>{roleText.value}</small>
                </span>
                <span class="pc-side-user-caret">
                  <UpOutlined />
                </span>
              </button>
              {userMenuOpen.value && (
                <div class="pc-side-user-menu" role="menu">
                  <a
                    href={PERSONAL_CENTER}
                    target="_blank"
                    rel="noreferrer"
                    role="menuitem"
                    onClick={() => {
                      userMenuOpen.value = false
                    }}
                  >
                    <UserOutlined /> 个人中心
                  </a>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      userMenuOpen.value = false
                      drawerOpen.value = false
                      navigate(props.role === 'seller' ? '/member/buyer' : '/member/seller')
                    }}
                  >
                    <SwapOutlined /> 切换至{props.role === 'seller' ? '买家中心' : '卖家中心'}
                  </button>
                  <div class="pc-side-user-divider" />
                  <button type="button" class="is-danger" role="menuitem" onClick={logout}>
                    <LogoutOutlined /> 退出登录
                  </button>
                </div>
              )}
            </div>
          </aside>

          <div class="mc-main">
            <WorkspaceHeader
              class="mc-top"
              leftClassName="mc-top-left"
              rightClassName="mc-top-right"
              collapsed={collapsed.value}
              mobile={isMobile.value}
              mobileOpen={drawerOpen.value}
              onToggleCollapse={() => {
                if (isMobile.value) drawerOpen.value = !drawerOpen.value
                else collapsed.value = !collapsed.value
              }}
              left={
                <div class="mc-crumb">
                  <Link to={basePath.value}>交易撮合</Link>
                  <span>/</span>
                  <Link to={`${basePath.value}?tab=${listTabKey.value}`}>{listLabel.value}</Link>
                  <span>/</span>
                  <strong class="trade-crumb-mono">{props.orderNo || '订单详情'}</strong>
                </div>
              }
              right={
                <>
                  <div class="mc-role-switch">
                    <Link class={props.role === 'buyer' ? 'on' : ''} to="/member/buyer">
                      买家中心
                    </Link>
                    <Link class={props.role === 'seller' ? 'on' : ''} to="/member/seller">
                      卖家中心
                    </Link>
                  </div>
                  <span class="mc-avatar">{avatar.value}</span>
                  <span class="mc-merchant-name">{displayName.value}</span>
                  <button type="button" class="mc-icon-btn" title="返回工作台" onClick={() => navigate(basePath.value)}>
                    <BellOutlined />
                  </button>
                </>
              }
            />
            <div ref={scrollHost} class="trade-order-scroll-host">
              <div class="trade-order-detail-container">{slots.default?.()}</div>
            </div>
          </div>
        </div>
      </ConfigProvider>
    )
  },
})
