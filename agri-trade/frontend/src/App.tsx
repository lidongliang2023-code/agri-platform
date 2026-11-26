import { defineComponent, h } from 'vue';
import { ConfigProvider } from 'ant-design-vue';
import zhCN from 'ant-design-vue/es/locale/zh_CN';
import { TradeRouterView } from './router';
import { antdvTheme } from '@agri/shared/vue/antdv';
export default defineComponent({
  name: 'TradeApp',
  setup: () => () => h(ConfigProvider, {
    locale: zhCN,
    theme: {
      token: antdvTheme.token
    }
  }, () => h(TradeRouterView))
});
