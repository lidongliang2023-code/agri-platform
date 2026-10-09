/**
 * 当前农场 Store（zustand）
 *
 * 用户端所有业务数据均以「当前农场」为作用域，切换农场后页面需重新取数。
 */
import { create } from 'zustand'

/** 当前农场上下文（轻量结构，避免与实体 Farm 强耦合） */
export interface CurrentFarm {
  /** 农场 ID */
  farmId: string
  /** 农场编码 */
  farmCode: string
  /** 农场名称 */
  farmName: string
}

/** 当前农场状态与行为 */
export interface FarmState {
  /** 当前农场，未选择时为 null */
  currentFarm: CurrentFarm | null
  /** 可选农场列表 */
  farmOptions: CurrentFarm[]
  /** 设置当前农场 */
  setCurrentFarm: (farm: CurrentFarm | null) => void
  /** 设置可选农场列表 */
  setFarmOptions: (farms: CurrentFarm[]) => void
}

/** 从 localStorage 读取当前农场 */
function readCurrentFarm(): CurrentFarm | null {
  try {
    const raw = localStorage.getItem('agri_current_farm')
    if (!raw || raw === 'null' || raw === 'undefined') return null
    return JSON.parse(raw) as CurrentFarm
  } catch {
    return null
  }
}

const useFarmStore = create<FarmState>((set) => ({
  currentFarm: readCurrentFarm(),
  farmOptions: [],

  setCurrentFarm: (farm: CurrentFarm | null) => {
    if (farm) {
      localStorage.setItem('agri_current_farm', JSON.stringify(farm))
    } else {
      localStorage.removeItem('agri_current_farm')
    }
    set({ currentFarm: farm })
  },

  setFarmOptions: (farms: CurrentFarm[]) => {
    set((state) => {
      // 若当前农场不在新列表中，则默认选中第一项，保证上下文始终有效
      const stillValid = state.currentFarm
        ? farms.some((item) => item.farmId === state.currentFarm?.farmId)
        : false
      const nextFarm = stillValid ? state.currentFarm : (farms[0] ?? null)
      if (nextFarm) {
        localStorage.setItem('agri_current_farm', JSON.stringify(nextFarm))
      } else {
        localStorage.removeItem('agri_current_farm')
      }
      return { farmOptions: farms, currentFarm: nextFarm }
    })
  },
}))

export default useFarmStore
