import { supplierApi } from './index'

/**
 * 当前账号的供应商 ID。
 *
 * <p>原来产品列表/新增/编辑都写死 supplierId: 1，等于所有人共用供应商 1；
 * 改为从 /supplier/profile 取一次并缓存。未入驻返回 null。</p>
 */
let pending = null

export function currentSupplierId() {
  if (!pending) {
    pending = supplierApi.getProfile()
      .then((res) => (res && res.applied ? res.id : null))
      .catch(() => null)
  }
  return pending
}

export function resetSupplierSession() {
  pending = null
}
