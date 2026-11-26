import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { GreenSupply } from './pages/GreenSupply';
import { CloudFactory } from './pages/CloudFactory';
import { QualityTrace } from './pages/QualityTrace';
import { PortalLayout } from './components/PortalLayout';
import { Home } from './pages/Home';
import { Certify } from './pages/Certify';
import { CertifyEnterprise } from './pages/CertifyEnterprise';
import { CertifyPersonal } from './pages/CertifyPersonal';
import { Finance } from './pages/Finance';
import { Government } from './pages/Government';
import { Hall } from './pages/Hall';
import { Logistics } from './pages/Logistics';
import { AccountCenter } from './pages/AccountCenter';
import { InfoHome } from './pages/info/InfoHome';
import { InfoNewsDetail } from './pages/info/InfoNews';
import { InfoMarket } from './pages/info/InfoMarket';
import { InfoSupplyDemand } from './pages/info/InfoSupplyDemand';
import { InfoService, type InfoTab } from './pages/info/InfoService';
import { InfoSearch } from './pages/info/InfoSearch';
import { useHashRoute } from './utils';
const NotFound = defineComponent({
  name: "NotFound",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    return () => {
      return <section class="section container">
      <div class="card empty">
        <div class="strong t-xl">页面不存在</div>
        <div class="muted t-sm mt-8">请从首页或交易大厅继续浏览。</div>
        <a class="btn btn-primary mt-16" href="#/">回到首页</a>
      </div>
    </section>;
    };
  }
});
const App = defineComponent({
  name: "App",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const route = useHashRoute();
    onMounted(() => {
      watch(() => [route.value.path], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          window.scrollTo({
            top: 0
          });
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });

    // 「产业链」已并入「交易大厅」，旧书签和深链保留筛选参数跳到合并后的页面。
    onMounted(() => {
      watch(() => [route.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (route.value.path !== '/chains') return;
          const query = route.value.query.toString();
          window.location.replace(`${window.location.pathname}${window.location.search}#/hall${query ? `?${query}` : ''}`);
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    return () => {
      const view_route = route.value;
      let page: VNodeChild;
      let active = '/';
      if (view_route.path === '/' || view_route.path === '') {
        page = <Home />;
      } else if (view_route.path === '/chains' || view_route.path === '/hall') {
        page = <Hall />;
        active = '/hall';
      } else if (view_route.path === '/green-supply') {
        page = <GreenSupply />;
        active = '/green-supply';
      } else if (view_route.path === '/cloud-factory') {
        page = <CloudFactory />;
        active = '/cloud-factory';
      } else if (view_route.path === '/certify') {
        page = <Certify />;
        active = '/certify';
      } else if (view_route.path === '/logistics') {
        page = <Logistics />;
        active = '/logistics';
      } else if (view_route.path === '/quality-trace') {
        page = <QualityTrace />;
        active = '/quality-trace';
      } else if (view_route.path === '/government') {
        page = <Government />;
        active = '/government';
      } else if (view_route.path === '/finance') {
        page = <Finance />;
        active = '/finance';
      } else if (view_route.path === '/certify/enterprise') {
        page = <CertifyEnterprise />;
        active = '/certify';
      } else if (view_route.path === '/certify/personal') {
        page = <CertifyPersonal />;
        active = '/certify';
      } else if (view_route.path === '/account' || view_route.path.startsWith('/account/')) {
        const tab = view_route.path.startsWith('/account/') ? view_route.path.slice('/account/'.length) : view_route.query.get('tab');
        page = <AccountCenter initialTab={tab} />;
      } else if (view_route.path === '/info') {
        page = <InfoHome />;
        active = '/info';
      } else if (view_route.path === '/info/news') {
        // 列表已并入资讯首页；旧地址直接回首页，避免收藏的链接失效
        page = <InfoHome />;
        active = '/info';
      } else if (view_route.path.startsWith('/info/news/')) {
        page = <InfoNewsDetail id={Number(view_route.path.split('/')[3])} />;
        active = '/info';
      } else if (view_route.path === '/info/market') {
        page = <InfoMarket />;
        active = '/info/market';
      } else if (view_route.path.startsWith('/info/market/')) {
        page = <InfoMarket id={Number(view_route.path.split('/')[3])} />;
        active = '/info/market';
      } else if (view_route.path === '/info/supply-demand') {
        page = <InfoSupplyDemand />;
        active = '/info';
      } else if (view_route.path.startsWith('/info/supply-demand/')) {
        page = <InfoSupplyDemand id={Number(view_route.path.split('/')[3])} type={view_route.query.get('type') ?? 'supply'} />;
        active = '/info';
      } else if (['/info/training', '/info/experts', '/info/reports', '/info/knowledge'].includes(view_route.path)) {
        page = <InfoService tab={view_route.path.slice('/info/'.length) as InfoTab} />;
        active = '/info';
      } else if (view_route.path === '/info/search') {
        page = <InfoSearch keyword={view_route.query.get('keyword') ?? ''} />;
        active = '/info';
      } else {
        page = <NotFound />;
      }
      return <PortalLayout active={active}>{page}</PortalLayout>;
    };
  }
});
export default App;
