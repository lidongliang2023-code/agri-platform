import axios from 'axios'

/**
 * 系统配置（运营端）。
 *
 * 只包含"真的有代码在读"的配置项：改了会真的改变系统行为，
 * 而不是改完没反应（本项目在别处吃过这种亏）。
 */
export interface ConfigRow {
  id: number
  configKey: string
  configValue: string
  valueType: string
  configGroup: string
  configName: string
  description: string
  editable: number
  updateTime: string
}

export async function getConfigs() {
  const response = await axios.get('/api/trade/admin/config/list')
  return response.data
}

export async function updateConfig(key: string, value: string) {
  const response = await axios.put(`/api/trade/admin/config/${key}`, { value })
  return response.data
}
