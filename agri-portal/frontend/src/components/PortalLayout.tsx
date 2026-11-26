import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { logoutBrowser } from '../../../../packages/agri-shared/src/auth/logout';
import { Icon } from './Icon';
import { BrandMark } from './BrandMark';
import { completePlatformLogin, go, productionLogin, redirectToPlatformLogin, ssoRegister, tradeUrl } from '../utils';
import { clearPlatformAccessToken, getPlatformAccessToken } from '../utils/platformToken';
const CHANNELS = ['粮油产业', '果蔬产业', '畜禽产业', '茶药产业', '饲料农资', '水产产业', '预制菜', '冷链物流'];
type PortalScope = 'full' | 'info' | 'service';
const PORTAL_SCOPE = import.meta.env.VITE_PORTAL_SCOPE as PortalScope | undefined;
interface PortalUser {
  id?: string;
  username?: string;
  nickname?: string;
  phone?: string;
  stage?: string;
  identity?: string;
  subjectName?: string;
  certificationStatus?: string;
}
const NAV_ITEMS: Array<{
  path: string;
  active: string;
  label: string;
  scopes: PortalScope[];
}> = [{
  path: '#/',
  active: '/',
  label: '首页',
  scopes: ['full', 'info', 'service']
}, {
  path: '#/info',
  active: '/info',
  label: '产业资讯',
  scopes: ['full', 'info', 'service']
}, {
  path: '#/hall',
  active: '/hall',
  label: '交易大厅',
  scopes: ['full']
},
// 这两个原本是"滚到首页对应区块"的锚点，有了独立的资讯频道后直接指到频道里，
// 避免用户点了还在首页原地打转。
{
  path: '#/cloud-factory',
  active: '/cloud-factory',
  label: 'VR 云工厂',
  scopes: ['full', 'service']
}, {
  path: '#/info/market',
  active: '/info/market',
  label: '价格指数',
  scopes: ['full', 'info']
}, {
  path: '#/finance',
  active: '/finance',
  label: '供应链金融',
  scopes: ['full', 'service']
}, {
  path: '#/logistics',
  active: '/logistics',
  label: '物流服务',
  scopes: ['full', 'service']
}, {
  path: '#/government',
  active: '/government',
  label: '政府监管',
  scopes: ['full']
}];
const visibleNavItems = NAV_ITEMS.filter(item => item.scopes.includes(PORTAL_SCOPE ?? 'full'));
export const PortalLayout = defineComponent({
  name: "PortalLayout",
  props: {
    active: null as unknown as PropType<{
      children: VNodeChild;
      active?: string;
    }["active"]>
  },
  setup(__props: {
    children?: VNodeChild;
    active?: string;
  }, {
    slots: __slots
  }) {
    const keyword = ref('');
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const user = ref<PortalUser | null>(null);
    const setUser = (next: typeof user.value | ((previous: typeof user.value) => typeof user.value)) => {
      user.value = typeof next === 'function' ? (next as (previous: typeof user.value) => typeof user.value)(user.value) : next;
    };
    const accountMenuOpen = ref(false);
    const setAccountMenuOpen = (next: typeof accountMenuOpen.value | ((previous: typeof accountMenuOpen.value) => typeof accountMenuOpen.value)) => {
      accountMenuOpen.value = typeof next === 'function' ? (next as (previous: typeof accountMenuOpen.value) => typeof accountMenuOpen.value)(accountMenuOpen.value) : next;
    };
    const loggingOut = ref(false);
    const setLoggingOut = (next: typeof loggingOut.value | ((previous: typeof loggingOut.value) => typeof loggingOut.value)) => {
      loggingOut.value = typeof next === 'function' ? (next as (previous: typeof loggingOut.value) => typeof loggingOut.value)(loggingOut.value) : next;
    };
    const logoutPending = shallowRef(false);
    // 横滑导航之外保留手机抽屉，便于集中浏览所有入口。
    const navOpen = ref(false);
    const setNavOpen = (next: typeof navOpen.value | ((previous: typeof navOpen.value) => typeof navOpen.value)) => {
      navOpen.value = typeof next === 'function' ? (next as (previous: typeof navOpen.value) => typeof navOpen.value)(navOpen.value) : next;
    };
    const navRef = shallowRef<HTMLElement | null>(null);
    const navEdges = ref({
      left: false,
      right: false
    });
    const setNavEdges = (next: typeof navEdges.value | ((previous: typeof navEdges.value) => typeof navEdges.value)) => {
      navEdges.value = typeof next === 'function' ? (next as (previous: typeof navEdges.value) => typeof navEdges.value)(navEdges.value) : next;
    };
    (() => {
      let dispose: void | (() => void);
      onMounted(() => {
        dispose = (() => {
          const nav = navRef.value;
          if (!nav) return;
          const update = (): void => setNavEdges({
            left: nav.scrollLeft > 2,
            right: nav.scrollWidth - nav.clientWidth - nav.scrollLeft > 2
          });
          const wheel = (event: WheelEvent): void => {
            if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY) return;
            const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? nav.clientWidth : 1);
            const next = Math.max(0, Math.min(nav.scrollWidth - nav.clientWidth, nav.scrollLeft + delta));
            if (next === nav.scrollLeft) return;
            event.preventDefault();
            nav.scrollLeft = next;
          };
          const observer = new ResizeObserver(update);
          observer.observe(nav);
          Array.from(nav.children).forEach(child => observer.observe(child));
          nav.addEventListener('scroll', update, {
            passive: true
          });
          nav.addEventListener('wheel', wheel, {
            passive: false
          });
          update();
          return () => {
            observer.disconnect();
            nav.removeEventListener('scroll', update);
            nav.removeEventListener('wheel', wheel);
          };
        })();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    })();
    onMounted(() => {
      watch(() => [__props.active ?? '/'], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          const nav = navRef.value;
          const selected = nav?.querySelector<HTMLElement>('[aria-current="page"]');
          if (!nav || !selected) return;
          const left = selected.offsetLeft - nav.offsetLeft;
          if (left < nav.scrollLeft) nav.scrollLeft = left;else if (left + selected.offsetWidth > nav.scrollLeft + nav.clientWidth) {
            nav.scrollLeft = left + selected.offsetWidth - nav.clientWidth;
          }
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    function scrollNav(direction: number): void {
      const nav = navRef.value;
      nav?.scrollBy({
        left: direction * Math.max(160, nav.clientWidth * .7),
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
      });
    }

    // 抽屉打开时锁住背景滚动，否则手指一划页面跟着动，抽屉里的列表反而划不动。
    onMounted(() => {
      watch(() => [navOpen.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (!navOpen.value) return undefined;
          const previous = document.body.style.overflow;
          const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          const panel = document.querySelector<HTMLElement>('.portal-mobile-panel');
          const focusable = (): HTMLElement[] => Array.from(panel?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled)') ?? []);
          const onKeyDown = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') {
              event.preventDefault();
              setNavOpen(false);
            }
            if (event.key !== 'Tab') return;
            const items = focusable(),
              first = items[0],
              last = items[items.length - 1];
            if (!first || !last) return;
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          };
          const onResize = (): void => {
            if (window.innerWidth > 860) setNavOpen(false);
          };
          document.body.style.overflow = 'hidden';
          focusable()[0]?.focus();
          document.addEventListener('keydown', onKeyDown);
          window.addEventListener('resize', onResize);
          return () => {
            document.body.style.overflow = previous;
            document.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('resize', onResize);
            previousFocus?.focus({
              preventScroll: true
            });
          };
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    async function sessionUser(): Promise<PortalUser | null> {
      try {
        const response = await fetch('/api/v1/sso/onboarding/status?optional=true', {
          credentials: 'include'
        });
        const body = (await response.json()) as {
          code?: number;
          data?: {
            phone?: string;
            nickname?: string;
            stage?: string;
            identity?: string;
            subjectName?: string;
            certificationStatus?: string;
          };
        };
        if (!response.ok || body.code !== 0 || !body.data) return null;
        return {
          nickname: body.data.nickname,
          phone: body.data.phone,
          stage: body.data.stage,
          identity: body.data.identity,
          subjectName: body.data.subjectName,
          certificationStatus: body.data.certificationStatus
        };
      } catch {
        return null;
      }
    }
    (() => {
      let dispose: void | (() => void);
      onMounted(() => {
        dispose = (() => {
          let cancelled = false;
          void completePlatformLogin().catch(() => false).then(() => sessionUser()).then(nextUser => {
            if (cancelled) return;
            setUser(nextUser);
            if (sessionStorage.getItem('agri_portal_logout_pending') === '1') {
              sessionStorage.removeItem('agri_portal_logout_pending');
              if (nextUser) void logout(true);
            }
          });
          return () => {
            cancelled = true;
          };
        })();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    })();
    async function logout(resuming = false): Promise<void> {
      if (logoutPending.value) return;
      logoutPending.value = true;
      setLoggingOut(true);
      try {
        let token: string;
        try {
          token = await getPlatformAccessToken(true);
        } catch {
          if (resuming) {
            window.alert('未完成全局退出，请重试。');
            return;
          }
          // 只有全局 SSO 会话时，先为门户建立自身凭据，再继续同一次退出。
          sessionStorage.setItem('agri_portal_logout_pending', '1');
          try {
            await redirectToPlatformLogin();
          } catch {
            sessionStorage.removeItem('agri_portal_logout_pending');
            window.alert('无法连接统一认证中心，登录状态已保留，请重试。');
          }
          return;
        }
        const origin = ['localhost', '127.0.0.1'].includes(window.location.hostname) ? `${window.location.protocol}//${window.location.hostname}:8090` : 'https://sso.agri-platform.com';
        await logoutBrowser({
          token,
          clientId: 'portal',
          ssoOrigin: origin,
          clear: () => {
            sessionStorage.removeItem('agri_portal_logout_pending');
            clearPlatformAccessToken();
            setUser(null);
            setAccountMenuOpen(false);
          }
        });
      } finally {
        logoutPending.value = false;
        setLoggingOut(false);
      }
    }
    const registerBase = `${window.location.protocol}//${window.location.hostname}:8090/register`;
    const identityEntry = (identity: 'enterprise' | 'personal'): string => `${registerBase}?step=2&identity=${identity}`;
    const search = (event: Event): void => {
      event.preventDefault();
      const value = keyword.value.trim();
      go(value ? `/hall?q=${encodeURIComponent(value)}` : '/hall');
    };
    return () => {
      const view_user = user.value;
      const view_accountMenuOpen = accountMenuOpen.value;
      const view_loggingOut = loggingOut.value;
      const view_navEdges = navEdges.value;
      const view_prop_active = __props.active;
      const view_keyword = keyword.value;
      const view_navOpen = navOpen.value;
      return <div class="portal-root">
      <div class="topbar">
        <div class="container">
          <span>您好，欢迎来到丰链云！一站式农业产业链交易与服务平台</span>
          <span class="portal-top-actions">
            <a href={tradeUrl('/member/buyer')} target="_blank" rel="noreferrer">我是买家</a><span class="sep">·</span>
            <a href={tradeUrl('/member/seller')} target="_blank" rel="noreferrer">我是卖家</a><span class="sep">·</span>
            {view_user ? <span class="portal-logged-user">
                <span class="portal-user-avatar">{(view_user.nickname || view_user.username || view_user.phone || '用').slice(0, 1)}</span>
                <button class="portal-user-menu-trigger" type="button" onClick={() => setAccountMenuOpen(!view_accountMenuOpen)}>
                  <span class="portal-user-status">已登录</span>
                  <b>{view_user.nickname || view_user.username || view_user.phone || '丰链云用户'}</b>
                  <i>▾</i>
                </button>
                <button class="portal-user-logout" type="button" disabled={view_loggingOut} onClick={() => void logout()}>{view_loggingOut ? '退出中…' : '退出'}</button>
                {view_accountMenuOpen && <div class="portal-account-menu">
                    <a href="#/account" onClick={() => setAccountMenuOpen(false)}>
                      <Icon name="user" size={15} /><span><b>个人中心</b><small>资料、安全、实名、地址与经营主体</small></span>
                    </a>
                    <div class="portal-account-head">
                      <span>主体与认证</span>
                      <small>
                        {view_user.stage === 'done' ? '已完成认证' : view_user.stage === 'pending' ? '认证审核中' : view_user.stage === 'certification' ? '待提交认证' : '待创建主体'}
                      </small>
                    </div>
                    {(!view_user.stage || view_user.stage === 'subject') && <>
                        <p>请选择主体类型，完成主体注册与认证。</p>
                        <a href={identityEntry('enterprise')} onClick={event => {
                      event.preventDefault();
                      window.location.href = identityEntry('enterprise');
                    }}>
                          <Icon name="factory" size={15} /><span><b>企业主体</b><small>企业、合作社、加工厂、贸易商</small></span>
                        </a>
                        <a href={identityEntry('personal')} onClick={event => {
                      event.preventDefault();
                      window.location.href = identityEntry('personal');
                    }}>
                          <Icon name="user" size={15} /><span><b>个人主体</b><small>家庭农场、个体户、经纪人</small></span>
                        </a>
                      </>}
                    {view_user.stage === 'certification' && <a href={`${registerBase}?step=3`}>
                        <Icon name="shield" size={15} /><span><b>继续提交认证</b><small>主体已创建，等待认证开通</small></span>
                      </a>}
                    {view_user.stage === 'pending' && <a href={`${registerBase}?step=3`}>
                        <Icon name="activity" size={15} /><span><b>查看认证进度</b><small>资料已提交，平台审核中</small></span>
                      </a>}
                    {view_user.stage === 'done' && <div class="portal-account-done">
                        <Icon name="check" size={16} />
                        <span><b>{view_user.identity === 'personal' ? '个人主体' : '企业主体'}已认证</b><small>{view_user.subjectName || '认证状态已生效'}</small></span>
                      </div>}
                  </div>}
              </span> : <button class="portal-login-trigger" type="button" onClick={() => void redirectToPlatformLogin()}>
                <Icon name="user" size={12} />登录
              </button>}
            {!view_user && <>
                <span class="sep">·</span>
                <a href={ssoRegister()}><Icon name="plus" size={12} />免费注册</a>
              </>}
          </span>
        </div>
      </div>

      <header class="site-header">
        <div class="container">
          <a class="brand" href="#/">
            <span class="logo"><BrandMark size={36} /></span>
            <span>丰链云<small>FENGCHAIN · AGRI</small></span>
          </a>
          <div class="portal-nav-shell">
            <button type="button" class="portal-nav-arrow" aria-label="向左滚动顶部菜单" aria-controls="portal-main-navigation" disabled={!view_navEdges.left} onClick={() => scrollNav(-1)}>‹</button>
            <nav id="portal-main-navigation" class="main-nav" aria-label="官网主导航" ref={navRef} onKeydown={event => {
                if (event.altKey || event.ctrlKey || event.metaKey) return;
                if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                  event.preventDefault();
                  scrollNav(event.key === 'ArrowLeft' ? -1 : 1);
                }
              }}>
              {visibleNavItems.map(item => <a key={`${item.path}-${item.label}`} href={item.path} aria-current={(view_prop_active ?? '/') === item.active ? 'page' : undefined} class={(view_prop_active ?? '/') === item.active ? 'active' : ''}>{item.label}</a>)}
            </nav>
            <button type="button" class="portal-nav-arrow" aria-label="向右滚动顶部菜单" aria-controls="portal-main-navigation" disabled={!view_navEdges.right} onClick={() => scrollNav(1)}>›</button>
          </div>
          <form class="header-search" onSubmit={search}>
            <input value={view_keyword} onInput={event => setKeyword((event.target as HTMLInputElement).value)} placeholder="搜索商品 / 供应商 / 需求" aria-label="搜索商品、供应商或需求" />
            <button type="submit">搜索</button>
          </form>
          <button type="button" class="nav-toggle" aria-label={view_navOpen ? '关闭导航菜单' : '打开导航菜单'} aria-expanded={view_navOpen} aria-controls="portal-mobile-navigation" onClick={() => setNavOpen(open => !open)}>
            <span /><span /><span />
          </button>
        </div>
      </header>

      {view_navOpen && <div id="portal-mobile-navigation" class="portal-mobile-nav" role="dialog" aria-modal="true" aria-label="导航菜单">
          <button type="button" class="portal-mobile-mask" aria-label="关闭菜单" onClick={() => setNavOpen(false)} />
          <div class="portal-mobile-panel">
            <div class="portal-mobile-head">
              <b>导航</b>
              <button type="button" onClick={() => setNavOpen(false)}>关闭</button>
            </div>
            <form class="portal-mobile-search" onSubmit={search}>
              <input value={view_keyword} onInput={event => setKeyword((event.target as HTMLInputElement).value)} placeholder="搜索商品 / 供应商 / 需求" aria-label="搜索商品、供应商或需求" />
              <button type="submit" onClick={() => setNavOpen(false)}>搜索</button>
            </form>
            <nav class="portal-mobile-links">
              {visibleNavItems.map(item => <a key={`m-${item.path}-${item.label}`} href={item.path} class={item.active && (view_prop_active ?? '/') === item.active ? 'active' : ''} onClick={() => setNavOpen(false)}>
                  {item.label}
                </a>)}
            </nav>
          </div>
        </div>}

      <div class="portal-channelbar">
        <div class="container">
          <a class="tag portal-all-channel" href="#/hall"><Icon name="layers" size={14} />全部频道</a>
          {CHANNELS.map(channel => <a class="chip" key={channel} href={`#/hall?l1=${encodeURIComponent(channel)}`}>{channel}</a>)}
        </div>
      </div>

      <main>{__slots.default?.()}</main>

      <footer class="site-footer">
        <div class="container">
          <div class="grid portal-footer-grid">
            <div>
              <div class="brand portal-footer-brand">
                <span class="logo"><BrandMark size={36} /></span><span>丰链云</span>
              </div>
              <p class="portal-footer-desc">农业产业互联网平台，连接生产、加工、流通、销售全环节。</p>
            </div>
            <div>
              <h4>关于平台</h4>
              <a href="#/certify">认证中心</a>
              <a href="#/hall">交易大厅</a>
              <a href="#/logistics">物流服务</a>
              <a href="#/finance">供应链金融</a>
              <a href="#/government">政府监管</a>
              <a href={productionLogin()}>生产管理</a>
            </div>
            <div>
              <h4>买家服务</h4>
              <a href="#/hall">采购大厅</a>
              <a href={tradeUrl('/member/buyer?tab=publish')} target="_blank" rel="noreferrer">发布采购需求</a>
              <a href={tradeUrl('/member/buyer?tab=purchase')} target="_blank" rel="noreferrer">订单管理</a>
              <a href={tradeUrl('/member/buyer?tab=fund')} target="_blank" rel="noreferrer">资金管理</a>
            </div>
            <div>
              <h4>卖家服务</h4>
              <a href={tradeUrl('/member/seller?tab=publish')} target="_blank" rel="noreferrer">发布新商品</a>
              <a href={tradeUrl('/member/seller?tab=profile')} target="_blank" rel="noreferrer">店铺管理</a>
              <a href={productionLogin()}>物联网接入</a>
              <a href="#/certify/enterprise">企业认证</a>
            </div>
          </div>
          <div class="bottom">
            <span>© 2026 农业产业互联网平台 · 丰链云官网门户</span>
            <span>生产、交易、金融、溯源一体化服务</span>
          </div>
        </div>
      </footer>
    </div>;
    };
  }
});
