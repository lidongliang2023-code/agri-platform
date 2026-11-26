import { computed, defineComponent, onBeforeUnmount, onMounted, ref, type PropType, type VNodeChild } from 'vue';
import { logoutBrowser } from '../../../../../packages/agri-shared/src/auth/logout';
import { Link, useNavigate } from '@/vue/router';
import { ConfigProvider } from '@/vue/ui';
import { BellOutlined, LogoutOutlined, ShopOutlined, SwapOutlined, UpOutlined, UserOutlined } from '@ant-design/icons-vue';
import { WorkspaceHeader } from '@/vue/shared';
import { WorkspacePanels } from '@/vue/WorkspacePanels';
import { clearSession, getAccessToken, getCurrentUser } from '@/utils/session';
import { ssoLogoutUrl } from '@/utils/sso';
import { BrandMark } from '@/components/BrandMark';
import './member-center.css';
export interface MemberNavItem {
  key: string;
  label: string;
  icon: VNodeChild;
  group?: string;
}
const ROLE_TEXT = {
  buyer: '买家中心',
  seller: '卖家中心'
};
const PERSONAL_CENTER = `${window.location.protocol}//${window.location.hostname}:8098/portal/#/account/business`;
const memberTheme = {
  token: {
    colorPrimary: '#2d8f4e',
    colorLink: '#1b6332',
    colorLinkHover: '#247a3f',
    colorSuccess: '#2d8f4e',
    colorInfo: '#2d8f4e',
    borderRadius: 6,
    controlOutline: 'rgba(45, 143, 78, 0.12)'
  }
};
export const MemberCenterShell = defineComponent({
  name: 'MemberCenterShell',
  props: {
    role: {
      type: String as PropType<'buyer' | 'seller'>,
      required: true
    },
    active: {
      type: String,
      required: true
    },
    tabKey: String,
    extraTabLabels: Object as PropType<Record<string, string>>,
    homeTabKey: {
      type: String,
      default: 'overview'
    },
    navItems: {
      type: Array as PropType<MemberNavItem[]>,
      required: true
    },
    merchantName: {
      type: String,
      required: true
    },
    onNavigate: {
      type: Function as PropType<(key: string) => void>,
      required: true
    },
    notice: null as unknown as PropType<VNodeChild>,
    renderTab: Function as PropType<(key: string) => VNodeChild>
  },
  setup(props, {
    slots
  }) {
    const navigate = useNavigate();
    const collapsed = ref(window.matchMedia('(min-width: 1024px) and (max-width: 1279px)').matches);
    const isMobile = ref(window.matchMedia('(max-width: 1023px)').matches);
    const drawerOpen = ref(false);
    const userMenuOpen = ref(false);
    const currentTabKey = computed(() => props.tabKey || props.active || props.homeTabKey);
    const resolveTabLabel = (key: string): string => props.extraTabLabels?.[key] ?? props.navItems.find(item => item.key === key)?.label ?? '首页概览';
    const activeLabel = computed(() => resolveTabLabel(currentTabKey.value));
    const homeLabel = computed(() => resolveTabLabel(props.homeTabKey));
    const sessionUser = computed(() => getCurrentUser());
    const displayName = computed(() => props.merchantName || sessionUser.value?.nickname || sessionUser.value?.username || (props.role === 'buyer' ? '买家会员' : '卖家会员'));
    const avatar = computed(() => displayName.value.slice(0, 1));
    const navGroups = computed(() => props.navItems.reduce<Array<{
      title: string;
      items: MemberNavItem[];
    }>>((acc, item) => {
      const title = item.group || ROLE_TEXT[props.role];
      const last = acc[acc.length - 1];
      if (last && last.title === title) last.items.push(item);else acc.push({
        title,
        items: [item]
      });
      return acc;
    }, []));
    let dispose: (() => void) | undefined;
    onMounted(() => {
      const compactMedia = window.matchMedia('(min-width: 1024px) and (max-width: 1279px)');
      const mobileMedia = window.matchMedia('(max-width: 1023px)');
      const syncViewport = () => {
        isMobile.value = mobileMedia.matches;
        if (!mobileMedia.matches) {
          drawerOpen.value = false;
          collapsed.value = compactMedia.matches;
        }
      };
      compactMedia.addEventListener('change', syncViewport);
      mobileMedia.addEventListener('change', syncViewport);
      const closeOnDocClick = (event: MouseEvent) => {
        if (!(event.target instanceof HTMLElement) || !event.target.closest('.pc-side-user')) userMenuOpen.value = false;
      };
      document.addEventListener('click', closeOnDocClick);
      dispose = () => {
        compactMedia.removeEventListener('change', syncViewport);
        mobileMedia.removeEventListener('change', syncViewport);
        document.removeEventListener('click', closeOnDocClick);
      };
    });
    onBeforeUnmount(() => {
      dispose?.();
    });
    const handleSelectNav = (key: string) => {
      drawerOpen.value = false;
      props.onNavigate(key);
    };
    const logout = () => {
      void logoutBrowser({
        token: getAccessToken(),
        clientId: 'trade',
        ssoOrigin: new URL(ssoLogoutUrl()).origin,
        clear: clearSession
      });
    };
    return () => <ConfigProvider theme={memberTheme}>
        <div class={`mc-shell${!isMobile.value && collapsed.value ? ' is-collapsed' : ''}${drawerOpen.value ? ' is-drawer-open' : ''}`}>
          {drawerOpen.value && <button type="button" class="mc-drawer-overlay" aria-label="关闭导航菜单" onClick={() => {
          drawerOpen.value = false;
        }} />}
          <aside class={`mc-side${drawerOpen.value ? ' is-open' : ''}`}>
            <a class="mc-brand" href="/" title="丰链云">
              <span class="mc-brand-logo"><BrandMark size={34} /></span>
              <span class="mc-brand-copy">丰链云<small>FENGCHAIN · AGRI</small></span>
            </a>
            <div class="mc-side-scroll">
              {navGroups.value.map(group => <div key={group.title} class="mc-side-section">
                  <nav class="mc-side-nav">
                    {group.items.map(item => <button type="button" key={item.key} class={item.key === props.active ? 'on' : ''} title={item.label} aria-label={item.label} onClick={() => handleSelectNav(item.key)}>
                        <span class="mc-nav-icon">{item.icon}</span>
                        <span class="mc-nav-label">{item.label}</span>
                      </button>)}
                  </nav>
                </div>)}
              <div class="mc-side-section">
                <nav class="mc-side-nav">
                  <a href="/hall" title="交易大厅" aria-label="交易大厅">
                    <span class="mc-nav-icon"><ShopOutlined /></span>
                    <span class="mc-nav-label">交易大厅</span>
                  </a>
                  <a href={PERSONAL_CENTER} target="_blank" rel="noreferrer" title="个人中心" aria-label="个人中心">
                    <span class="mc-nav-icon"><SwapOutlined /></span>
                    <span class="mc-nav-label">个人中心</span>
                  </a>
                </nav>
              </div>
            </div>
            <div class="pc-side-user">
              <button type="button" class="pc-side-user-trigger" title={`${displayName.value} · ${ROLE_TEXT[props.role]}`} aria-expanded={userMenuOpen.value} aria-haspopup="menu" onClick={(event: MouseEvent) => {
              event.stopPropagation();
              userMenuOpen.value = !userMenuOpen.value;
            }}>
                <span class="pc-side-user-avatar">{avatar.value}</span>
                <span class="pc-side-user-meta">
                  <strong>{displayName.value}</strong>
                  <small>{ROLE_TEXT[props.role]}</small>
                </span>
                <span class="pc-side-user-caret"><UpOutlined /></span>
              </button>
              {userMenuOpen.value && <div class="pc-side-user-menu" role="menu">
                  <a href={PERSONAL_CENTER} target="_blank" rel="noreferrer" role="menuitem" onClick={() => {
                userMenuOpen.value = false;
              }}>
                    <UserOutlined /> 个人中心
                  </a>
                  <button type="button" role="menuitem" onClick={() => {
                userMenuOpen.value = false;
                drawerOpen.value = false;
                navigate(props.role === 'buyer' ? '/member/seller' : '/member/buyer');
              }}>
                    <SwapOutlined /> 切换至{props.role === 'buyer' ? '卖家中心' : '买家中心'}
                  </button>
                  <div class="pc-side-user-divider" />
                  <button type="button" class="is-danger" role="menuitem" onClick={logout}>
                    <LogoutOutlined /> 退出登录
                  </button>
                </div>}
            </div>
          </aside>

          <div class="mc-main">
            <WorkspaceHeader class="mc-top" leftClassName="mc-top-left" rightClassName="mc-top-right" collapsed={collapsed.value} mobile={isMobile.value} mobileOpen={drawerOpen.value} onToggleCollapse={() => {
            if (isMobile.value) drawerOpen.value = !drawerOpen.value;else collapsed.value = !collapsed.value;
          }} left={<div class="mc-crumb">
                  <Link to={props.role === 'buyer' ? '/member/buyer' : '/member/seller'}>{ROLE_TEXT[props.role]}</Link>
                  <span>/</span>
                  <strong>{activeLabel.value}</strong>
                </div>} right={<>
                  <div class="mc-role-switch">
                    <Link class={props.role === 'buyer' ? 'on' : ''} to="/member/buyer">买家中心</Link>
                    <Link class={props.role === 'seller' ? 'on' : ''} to="/member/seller">卖家中心</Link>
                  </div>
                  <span class="mc-avatar">{avatar.value}</span>
                  <span class="mc-merchant-name">{props.merchantName || '尚未绑定经营主体'}</span>
                  <button type="button" class="mc-icon-btn" title="消息通知（待接入）" onClick={() => navigate('/')}>
                    <BellOutlined />
                  </button>
                </>} />
            <WorkspacePanels key={props.role} class="mc-workspace" activeKey={currentTabKey.value} activeLabel={activeLabel.value} homeKey={props.homeTabKey} homeLabel={homeLabel.value} tabBarClassName="mc-workspace-tabbar" paneClassName="mc-workspace-pane" onSelect={props.onNavigate} renderPane={(tab, isActive) => <div class="mc-body">
                  {isActive && props.notice}
                  {props.renderTab ? props.renderTab(tab.key) : isActive ? slots.default?.() : null}
                </div>} footer={<footer class="mc-foot">© 2026 农业产业互联网平台 · 交易撮合会员中心</footer>} />
          </div>
        </div>
      </ConfigProvider>;
  }
});
