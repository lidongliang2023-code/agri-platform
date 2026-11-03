/**
 * `v-point="'POST /admin/masterdata/permission/role'"` —— 按权限点隐藏元素。
 *
 * <p>运营端有三十多个页面、七十来个写按钮，逐个在 `<script setup>` 里引 store 再写
 * `v-if="points.can(...)"` 会把同一件事抄几十遍；抽成指令后每个按钮只多一个属性。
 * 判据仍然只有一条：`denied` 里有没有这个编码（见 `stores/points.ts`）。</p>
 *
 * <p>三处实现细节都是踩过才知道的：</p>
 * <ul>
 *   <li>用内联 `display:none` 而不是 `el.hidden`：组件样式里的 `display` 规则会盖掉
 *       `[hidden]` 的浏览器默认样式，按钮照样看得见；</li>
 *   <li>用 `watchEffect` 而不是只在 `mounted` 判一次：权限点清单是异步加载的，
 *       挂载那一刻通常还没读到，只判一次就会永远停在"全部显示"；</li>
 *   <li>绑定值<b>必须带内层单引号</b>（`v-point="'POST /x'"`）。写成 `v-point="POST /x"`
 *       会被当成表达式编译成除法，指令拿到 `NaN`，于是"接了几十处一处都没生效"，
 *       而生产构建一句警告都不发。</li>
 * </ul>
 *
 * <p>隐藏时把编码登记进 store（引用计数），布局层据此给出一条「部分操作已隐藏」横幅；
 * 元素重新可见或离开页面时释放。计数是为了同一编码绑在多个按钮上时，
 * 隐藏其中一个不该让横幅提前消失。</p>
 */
import { watchEffect, type WatchStopHandle } from 'vue'
import { usePointStore } from '@/stores/points'

type PointElement = HTMLElement & {
  __pointStop?: WatchStopHandle
  __pointRelease?: () => void
}

export const pointDirective = {
  mounted(el: PointElement, binding: { value?: string }) {
    const store = usePointStore()
    const code = String(binding.value ?? '')
    let hidden = false
    const apply = (next: boolean) => {
      el.style.display = next ? 'none' : ''
      if (next === hidden) return
      hidden = next
      if (next) store.markHidden(code)
      else store.unmarkHidden(code)
    }
    el.__pointStop = watchEffect(() => apply(!store.can(code)))
    el.__pointRelease = () => {
      if (!hidden) return
      hidden = false
      store.unmarkHidden(code)
    }
  },
  unmounted(el: PointElement) {
    el.__pointRelease?.()
    el.__pointStop?.()
    delete el.__pointRelease
    delete el.__pointStop
  },
}
