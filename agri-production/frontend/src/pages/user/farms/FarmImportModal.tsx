import { useRef } from 'react'
import BusinessImportModal from '@/components/BusinessImportModal'
import { createFarm, listFarms, type FarmPayload } from '@/api/farms'
import { FARM_IMPORT_COLUMNS, prepareFarmImportRecord } from '@/utils/farm-import'
import { loadCompletePages } from '@/utils/load-complete-pages'
import useAuthStore from '@/store/auth'

interface Props {
  onClose: () => void
  onComplete: () => unknown
}

/** 农场导入仅提供业务校验和保存，解析、预览及结果由统一组件处理。 */
export default function FarmImportModal({ onClose, onComplete }: Props): JSX.Element {
  const subject = useAuthStore(state => state.userInfo?.tenantId)
  const token = useAuthStore(state => state.token)
  const initialSession = useRef({ subject, token })
  const existingNames = useRef(new Set<string>())
  const context = () => {
    const current = useAuthStore.getState()
    return `${current.userInfo?.tenantId ?? ''}:${current.token === initialSession.current.token ? 'same' : 'changed'}`
  }
  const available = !!subject && !!token && subject === initialSession.current.subject && token === initialSession.current.token
  return <BusinessImportModal<FarmPayload>
    open title="导入农场"
    headers={FARM_IMPORT_COLUMNS}
    requiredHeaders={['农场名称', '农场类型', '省份', '城市', '区县', '详细地址', '面积（亩）', '负责人', '联系电话']}
    contextKey={`${subject ?? ''}:${token === initialSession.current.token ? 'same' : 'changed'}`}
    getContextKey={context} contextReady={available}
    beforeSubmit={async () => {
      if (!available) throw new Error('登录或所属主体已变化，请重新打开导入')
      const result = await loadCompletePages(listFarms, farm => farm.farmId)
      existingNames.current = new Set(result.list.map(farm => farm.farmName.trim()))
    }}
    prepare={(raw, index, all) => {
      const result = prepareFarmImportRecord(raw)
      const name = raw['农场名称']?.trim() ?? ''
      if (all.some((row, i) => i !== index && row['农场名称']?.trim() === name)) result.errors.push('文件内农场名称重复')
      if (existingNames.current.has(name)) result.errors.push('当前主体已有同名农场')
      return result
    }}
    submit={payload => createFarm(payload)} onClose={onClose} onComplete={onComplete}
  />
}
