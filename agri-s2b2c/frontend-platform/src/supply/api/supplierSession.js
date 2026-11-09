export async function currentSupplierId() {
  return sessionStorage.getItem('s2b2c-platform-supply-source') || null
}
export function resetSupplierSession() {}
