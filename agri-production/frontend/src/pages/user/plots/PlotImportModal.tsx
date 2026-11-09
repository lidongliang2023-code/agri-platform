import { useRef, useState } from 'react'
import { Select } from 'antd'
import BusinessImportModal from '@/components/BusinessImportModal'
import { createPlot, listPlots, type PlotPayload } from '@/api/plots'
import { loadCompletePages } from '@/utils/load-complete-pages'
import useAuthStore from '@/store/auth'

const headers = ['地块名称', '面积（亩）', '种植类型', '土壤类型', '灌溉方式', '中心经度', '中心纬度']
const plantingTypes: Record<string, 1 | 2 | 3 | 4> = { '露天': 1, '大棚': 2, '水田': 3, '山地': 4 }
interface Props {
  farms: { farmId: string; farmName: string }[]
  initialFarmId?: string
  onClose: () => void
  onComplete: () => unknown
}
export default function PlotImportModal({ farms, initialFarmId, onClose, onComplete }: Props): JSX.Element {
  const [farmId, setFarmId] = useState(initialFarmId)
  const currentFarm = useRef(farmId); currentFarm.current = farmId
  const subject = useAuthStore(state => state.userInfo?.tenantId)
  const token = useAuthStore(state => state.token)
  const existingNames = useRef(new Set<string>())
  const sessionAtOpen = useRef(token)
  const context = () => `${useAuthStore.getState().userInfo?.tenantId ?? ''}:${currentFarm.current ?? ''}:${useAuthStore.getState().token === sessionAtOpen.current ? 'same' : 'changed'}`
  const available = !!farmId && farms.some(farm => String(farm.farmId) === String(farmId)) && !!subject && token === sessionAtOpen.current
  return <BusinessImportModal<PlotPayload> open title="导入地块" headers={headers} requiredHeaders={['地块名称', '面积（亩）']}
    contextKey={`${subject ?? ''}:${farmId ?? ''}:${token === sessionAtOpen.current ? 'same' : 'changed'}`} getContextKey={context}
    contextReady={available}
    contextControl={<label>所属农场 <Select style={{ width: 320 }} placeholder="请选择所属农场" showSearch optionFilterProp="label" value={farmId}
      onChange={value => { currentFarm.current = value; setFarmId(value) }} options={farms.map(farm => ({ value: String(farm.farmId), label: farm.farmName }))} /></label>}
    beforeSubmit={async () => {
      if (!available) throw new Error('请选择当前主体的有效农场')
      const result = await loadCompletePages(listPlots, plot => plot.plotId)
      existingNames.current = new Set(result.list.filter(plot => String(plot.farmId) === String(currentFarm.current)).map(plot => plot.plotName.trim()))
    }}
    prepare={(raw, index, all) => {
      const errors: string[] = []
      const name = raw['地块名称']?.trim() ?? ''
      const area = Number(raw['面积（亩）'])
      if (!name || name.length > 100) errors.push('地块名称必填且不能超过100字')
      if (!raw['面积（亩）'] || !Number.isFinite(area) || area <= 0) errors.push('面积必须为大于0的数值')
      if (all.some((row, i) => i !== index && row['地块名称']?.trim() === name)) errors.push('文件内地块名称重复')
      if (existingNames.current.has(name)) errors.push('所选农场已有同名地块')
      const kind = raw['种植类型']?.trim()
      if (kind && !plantingTypes[kind]) errors.push('种植类型仅支持：露天、大棚、水田、山地')
      const lng = raw['中心经度'], lat = raw['中心纬度']
      if (!!lng !== !!lat) errors.push('中心经度和纬度必须同时填写')
      if (lng && (!Number.isFinite(Number(lng)) || Number(lng) < -180 || Number(lng) > 180)) errors.push('中心经度须在-180至180之间')
      if (lat && (!Number.isFinite(Number(lat)) || Number(lat) < -90 || Number(lat) > 90)) errors.push('中心纬度须在-90至90之间')
      return { errors, payload: {
        farmId, plotName: name, area,
        plantingType: kind ? plantingTypes[kind] : undefined,
        soilType: raw['土壤类型'] || undefined, irrigationType: raw['灌溉方式'] || undefined,
        centerLongitude: lng ? Number(lng) : undefined, centerLatitude: lat ? Number(lat) : undefined,
      } }
    }} submit={payload => createPlot(payload)} onClose={onClose} onComplete={onComplete} />
}
