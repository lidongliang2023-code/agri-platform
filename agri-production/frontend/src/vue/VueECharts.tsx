import { defineComponent, h, onMounted, onBeforeUnmount, shallowRef, watch, type PropType } from 'vue'
import * as echarts from 'echarts'

/** Vue 图表包装：配置与事件响应式更新，卸载释放实例，容器尺寸变化自动重排。 */
export default defineComponent({
  name: 'ProductionECharts', inheritAttrs: false,
  props: {
    option: { type: Object as PropType<echarts.EChartsOption>, required: true },
    echarts: Object,
    notMerge: Boolean,
    lazyUpdate: Boolean,
    theme: [String, Object] as PropType<string | object>,
    opts: Object as PropType<Parameters<typeof echarts.init>[2]>,
    showLoading: Boolean,
    loadingOption: Object,
    onEvents: Object as PropType<Record<string, (params: any, instance: echarts.ECharts) => void>>,
    onChartReady: Function as PropType<(instance: echarts.ECharts) => void>,
  },
  setup(props, { attrs, expose }) {
    const root = shallowRef<HTMLDivElement>()
    let chart: echarts.ECharts | undefined
    let observer: ResizeObserver | undefined
    const registered = new Map<string, (...args: any[]) => void>()
    function bindEvents() {
      if (!chart) return
      for (const [name, handler] of registered) chart.off(name, handler)
      registered.clear()
      for (const [name, callback] of Object.entries(props.onEvents || {})) {
        const handler = (params: any) => { if (chart) callback(params, chart) }
        registered.set(name, handler); chart.on(name, handler)
      }
    }
    const resize = () => { if (root.value?.clientWidth && root.value.clientHeight) chart?.resize() }
    const update = () => { chart?.setOption(props.option, { notMerge: props.notMerge, lazyUpdate: props.lazyUpdate }); if (props.showLoading) chart?.showLoading(props.loadingOption); else chart?.hideLoading() }
    function initialize() {
      chart?.dispose()
      if (!root.value) return
      chart = echarts.init(root.value, props.theme, props.opts)
      update(); bindEvents(); props.onChartReady?.(chart)
    }
    onMounted(() => {
      initialize()
      if (typeof ResizeObserver !== 'undefined' && root.value) { observer = new ResizeObserver(resize); observer.observe(root.value) }
      window.addEventListener('resize', resize)
    })
    watch(() => [props.option, props.notMerge, props.lazyUpdate, props.showLoading, props.loadingOption], update, { deep: true, flush: 'post' })
    watch(() => props.onEvents, bindEvents, { deep: true })
    watch(() => [props.theme, props.opts], () => { if (chart) initialize() }, { deep: true })
    onBeforeUnmount(() => { observer?.disconnect(); window.removeEventListener('resize', resize); chart?.dispose(); chart = undefined; registered.clear() })
    expose({ getEchartsInstance: () => chart, resize })
    return () => h('div', { ...attrs, ref: root, style: [{ height: '300px', width: '100%' }, attrs.style as any] })
  },
})
