import { createRouter, createWebHistory, RouterView, useRoute } from 'vue-router';
import { defineComponent, h, onErrorCaptured, ref, watch } from 'vue';
import { isLoggedIn } from '@/utils/session';
import { normalizeReturnTarget, redirectToSso, SSO_CALLBACK_PATH } from '@/utils/sso';
const MOBILE_ORIGIN = import.meta.env.VITE_TRADE_MOBILE_ORIGIN || (['localhost', '127.0.0.1'].includes(location.hostname) ? `${location.protocol}//${location.hostname}:8181/` : 'https://trade-mobile.agri-platform.com/');
const Waiting = defineComponent({
  setup: () => () => h('div', {
    role: 'status',
    style: {
      padding: '32px'
    }
  }, '正在打开页面…')
});
const router = createRouter({
  history: createWebHistory(),
  routes: [{
    path: '/login',
    component: Waiting,
    beforeEnter: to => isLoggedIn() ? normalizeReturnTarget(typeof to.query.redirect === 'string' ? to.query.redirect : null, '/member/buyer') : (void redirectToSso(normalizeReturnTarget(typeof to.query.redirect === 'string' ? to.query.redirect : null, '/member/buyer')), false)
  }, {
    path: "/hall",
    component: () => import("@/pages/hall")
  }, {
    path: "/member/buyer",
    component: () => import("@/pages/member-center/BuyerCenter"),
    meta: {
      requiresAuth: true
    }
  }, {
    path: "/member/seller",
    component: () => import("@/pages/member-center/SellerCenter"),
    meta: {
      requiresAuth: true
    }
  }, {
    path: "/order/detail/:id",
    component: () => import("@/pages/order/detail"),
    meta: {
      requiresAuth: true
    }
  }, {
    path: "/order/confirm",
    component: () => import("@/pages/order/confirm"),
    meta: {
      requiresAuth: true
    }
  }, {
    path: "/order/create",
    component: () => import("@/pages/order/create"),
    meta: {
      requiresAuth: true
    }
  }, {
    path: "/product/create",
    redirect: to => ({
      path: '/member/seller',
      query: {
        ...to.query,
        tab: 'publish',
        ...(to.params.id ? {
          id: String(to.params.id)
        } : {})
      }
    })
  }, {
    path: "/product/edit/:id",
    redirect: to => ({
      path: '/member/seller',
      query: {
        ...to.query,
        tab: 'publish',
        ...(to.params.id ? {
          id: String(to.params.id)
        } : {})
      }
    })
  }, {
    path: "/product/detail/:id",
    component: () => import("@/pages/product/detail")
  }, {
    path: "/shop/:sellerId",
    component: () => import("@/pages/shop/detail")
  }, {
    path: "/demand/create",
    redirect: to => ({
      path: '/member/buyer',
      query: {
        ...to.query,
        tab: 'publish',
        ...(to.params.id ? {
          id: String(to.params.id)
        } : {})
      }
    })
  }, {
    path: "/demand/detail/:id",
    component: () => import("@/pages/demand/detail"),
    meta: {
      requiresAuth: true
    }
  }, {
    path: "/order",
    redirect: "/member/buyer?tab=purchase"
  }, {
    path: "/product",
    redirect: "/member/seller?tab=goods"
  }, {
    path: "/demand",
    redirect: "/member/buyer?tab=demand-list"
  }, {
    path: "/quote",
    redirect: "/member/seller?tab=trade"
  }, {
    path: "/match",
    redirect: "/member/seller?tab=trade"
  }, {
    path: "/price",
    redirect: "/member/seller?tab=trade"
  }, {
    path: "/contract",
    redirect: "/member/buyer?tab=contract"
  }, {
    path: "/logistics",
    redirect: "/member/seller?tab=ship"
  }, {
    path: "/evaluation",
    redirect: "/member/buyer?tab=rate"
  }, {
    path: "/dispute",
    redirect: "/member/buyer?tab=after"
  }, {
    path: "/my-guarantee",
    redirect: "/member/buyer?tab=fund"
  }, {
    path: "/my-compensation",
    redirect: "/member/buyer?tab=fund"
  }, {
    path: '/my-identity',
    component: Waiting,
    beforeEnter: () => {
      location.assign(`${location.protocol}//${location.hostname}:8098/portal/#/account/business`);
      return false;
    }
  }, {
    path: "/mine",
    redirect: "/member/buyer"
  }, {
    path: SSO_CALLBACK_PATH,
    component: () => import('@/pages/sso/callback')
  }, {
    path: '/admin/trade',
    component: () => import('@/pages/admin/layout'),
    meta: {
      requiresAuth: true
    },
    children: [{
      path: '',
      redirect: '/admin/trade/dashboard'
    }, {
      path: "dashboard",
      component: () => import("@/pages/admin/dashboard")
    }, {
      path: "product",
      component: () => import("@/pages/admin/product")
    }, {
      path: "order",
      component: () => import("@/pages/admin/order")
    }, {
      path: "order/:id",
      component: () => import("@/pages/admin/order/detail")
    }, {
      path: "dispute",
      component: () => import("@/pages/admin/dispute")
    }, {
      path: "refund",
      component: () => import("@/pages/admin/refund")
    }, {
      path: "invoice",
      component: () => import("@/pages/admin/invoice")
    }, {
      path: "compensation",
      component: () => import("@/pages/admin/compensation")
    }, {
      path: "bindings",
      component: () => import("@/pages/admin/bindings")
    }, {
      path: "settlement",
      component: () => import("@/pages/admin/settlement")
    }, {
      path: "credit",
      component: () => import("@/pages/admin/credit")
    }, {
      path: "catalog",
      component: () => import("@/pages/admin/external-redirect"),
      props: {
        path: "/product/catalog"
      }
    }, {
      path: "certification",
      component: () => import("@/pages/admin/external-redirect"),
      props: {
        path: "/user/audit"
      }
    }, {
      path: "certification-review",
      component: () => import("@/pages/admin/external-redirect"),
      props: {
        path: "/user/audit"
      }
    }, {
      path: "config",
      component: () => import("@/pages/admin/config")
    }, {
      path: "risk",
      component: () => import("@/pages/admin/risk")
    }, {
      path: "report",
      component: () => import("@/pages/admin/report")
    }, {
      path: "guarantee",
      component: () => import("@/pages/admin/guarantee")
    }, {
      path: "contract-template",
      component: () => import("@/pages/admin/contract-template")
    }, {
      path: "carrier",
      component: () => import("@/pages/admin/carrier")
    }, {
      path: "identity",
      component: () => import("@/pages/admin/external-redirect"),
      props: {
        path: "/user/audit"
      }
    }, {
      path: "p2t/orders",
      component: () => import("@/pages/admin/p2t/Orders")
    }, {
      path: "p2t/recon",
      component: () => import("@/pages/admin/p2t/Recon")
    }, {
      path: "p2t/rules",
      component: () => import("@/pages/admin/p2t/Rules")
    }, {
      path: "p2t/diffs",
      component: () => import("@/pages/admin/p2t/Diffs")
    }, {
      path: "p2t/trace",
      component: () => import("@/pages/admin/p2t/Trace")
    }, {
      path: "p2t/boundary",
      component: () => import("@/pages/admin/p2t/Boundary")
    }]
  }, ...['/mobile/trade', '/mobile', '/m'].map(path => ({
    path,
    component: Waiting,
    beforeEnter: () => {
      location.replace(MOBILE_ORIGIN);
      return false;
    }
  })), {
    path: '/',
    component: Waiting,
    beforeEnter: () => {
      if (matchMedia('(max-width:768px)').matches) {
        location.replace(MOBILE_ORIGIN);
        return false;
      }
      return '/member/buyer';
    }
  }, {
    path: '/:pathMatch(.*)*',
    redirect: '/member/buyer'
  }]
});
router.beforeEach(to => {
  if (to.matched.some(r => r.meta.requiresAuth) && !isLoggedIn()) {
    void redirectToSso(to.fullPath);
    return false;
  }
});
export default router;
export const TradeRouterView = defineComponent({
  setup() {
    const route = useRoute();
    const failed = ref(false);
    onErrorCaptured(() => {
      failed.value = true;
      return false;
    });
    watch(() => route.fullPath, () => failed.value = false);
    return () => failed.value ? h('div', {
      role: 'alert',
      style: {
        padding: '32px'
      }
    }, [h('p', '页面加载失败，请检查网络后重试。'), h('button', {
      onClick: () => location.reload()
    }, '重新加载')]) : h(RouterView);
  }
});
