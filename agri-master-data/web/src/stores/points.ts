/**
 * 权限点上下文：当前账号「会被拦」的写操作清单（一次加载，全站复用）。
 *
 * <p>前端在这里只做一件事：读后端算好的 `denied` 集合，判断某个编码在不在里面。
 * 规则本身（超管豁免、已纳管、已持有）一律不在前端复刻 —— 复刻一份就有两份口径，
 * 迟早出现"按钮还在但一调就 403"或"按钮没了其实还能调"。服务端那份是唯一的判定处。</p>
 *
 * <p>两个读取端点，同一份计算：运营端页面读 `/admin/masterdata/permission/mine`，
 * 企业端页面读 `/api/user/permission-points/mine`。分开是因为运营端那条受 RBAC 的
 * `masterdata:read` 保护，主体侧账号本来就没这个码；谁读得到哪个就用哪个，
 * 所以先按当前路由选，失败再退到另一个（见 {@link load}）。</p>
 *
 * <p>读不到就当没有限制（`can()` 返回 true）：隐藏按钮只是体验优化，真正的门在服务端。
 * 把"读失败"渲染成"没权限"会让人以为自己被回收了权限，那比多显示一个按钮更坏。</p>
 */
import { defineStore } from 'pinia'
import { getMyPermissionPoints } from '@/utils/api'
import { userGet } from '@/utils/userApi'

interface MyPoints {
  username?: string
  localUserId?: number | string | null
  superAdmin?: boolean
  granted?: string[]
  denied?: string[]
  /** 我已经提交过、还在等处理的权限点编码 */
  pending?: string[]
}

const OPS_ENDPOINT = '/admin/masterdata/permission/mine'
const USER_ENDPOINT = '/api/user/permission-points/mine'

/** 企业端页面（`/user/**`）读主体侧端点，其余按运营端端点。 */
const preferredEndpoint = () => (window.location.pathname.startsWith('/user') ? USER_ENDPOINT : OPS_ENDPOINT)

const fetchMine = async (endpoint: string): Promise<MyPoints> => {
  const response = endpoint === OPS_ENDPOINT
    ? await getMyPermissionPoints()
    : await userGet<MyPoints>(endpoint)
  if (response.code !== 200) throw new Error(response.message || '权限点读取失败')
  return (response.data ?? {}) as MyPoints
}

export const usePointStore = defineStore('points', {
  state: () => ({
    denied: [] as string[],
    granted: [] as string[],
    /** 已提交、还在等运营端处理的权限点编码 */
    pending: [] as string[],
    superAdmin: false,
    username: '',
    /** 实际读到的是哪个端点：出问题时页面要能自证来源 */
    source: '',
    loaded: false,
    loading: false,
    /** 读取失败时不隐藏任何按钮，但页面要能说出"这次没读到" */
    failed: false,
    /**
     * 当前页面上因权限点被收紧而隐藏的编码 → 隐藏了几个元素。
     *
     * <p>由 `v-point` 指令自己登记（元素挂/隐/卸载都记账），布局层用它渲染一条
     * 「部分操作已隐藏」横幅。之所以不在每个页面手写一遍提示：运营端 31 个页面、73 处绑定，
     * 逐页维护一份"这页有哪些点"的清单一定会和按钮漂移 —— 漂移后的表现是
     * 按钮已经消失而横幅还在说没事，比没有横幅更坏。</p>
     */
    hiddenCounts: {} as Record<string, number>,
  }),
  getters: {
    /** 唯一判据：这个权限点会不会拦我。没加载成功时按"不拦"处理（见文件头说明）。 */
    can: (state) => (permCode: string) => !state.denied.includes(permCode),
    /** 这个点我已经申请过了：横幅据此把「申请授权」变成"已在排队"，不让人重复提交 */
    isPending: (state) => (permCode: string) => state.pending.includes(permCode),
    /** 当前被隐藏的编码（去重、按字母序），横幅只列这个，不列"多少个按钮" */
    hiddenCodes: (state) => Object.keys(state.hiddenCounts).filter((code) => state.hiddenCounts[code] > 0).sort(),
  },
  actions: {
    markHidden(permCode: string) {
      this.hiddenCounts[permCode] = (this.hiddenCounts[permCode] ?? 0) + 1
    },
    unmarkHidden(permCode: string) {
      const next = (this.hiddenCounts[permCode] ?? 0) - 1
      if (next > 0) this.hiddenCounts[permCode] = next
      else delete this.hiddenCounts[permCode]
    },
    async load(force = false) {
      if (this.loading) return
      if (this.loaded && !force) return
      this.loading = true
      const preferred = preferredEndpoint()
      try {
        this.apply(await fetchMine(preferred), preferred)
      } catch {
        // 端点选错时退到另一个：主体侧账号从运营端入口进来、或运营角色直接打开企业端页面都会走到这里
        try {
          const fallback = preferred === OPS_ENDPOINT ? USER_ENDPOINT : OPS_ENDPOINT
          this.apply(await fetchMine(fallback), fallback)
        } catch {
          this.denied = []
          this.granted = []
          this.pending = []
          this.failed = true
          this.source = ''
        }
      } finally {
        this.loaded = true
        this.loading = false
      }
    },
    apply(data: MyPoints, source: string) {
      this.denied = (data.denied ?? []).map(String)
      this.granted = (data.granted ?? []).map(String)
      this.pending = (data.pending ?? []).map(String)
      this.superAdmin = Boolean(data.superAdmin)
      this.username = data.username ?? ''
      this.source = source
      this.failed = false
    },
  },
})
