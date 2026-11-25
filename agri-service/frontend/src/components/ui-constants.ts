export const ORDER_STATUS: Record<string, { label: string; tone: string }> = {
  pending_payment: { label: '待确认预约', tone: 'orange' },
  confirmed: { label: '已确认', tone: 'blue' },
  in_progress: { label: '服务中', tone: 'green' },
  completed: { label: '已完成', tone: 'gray' },
  cancelled: { label: '已取消', tone: 'red' },
}

export const POLICY_STATUS: Record<string, { label: string; tone: string }> = {
  submitted: { label: '已提交', tone: 'blue' },
  town_review: { label: '乡镇审核中', tone: 'orange' },
  county_review: { label: '区县审核中', tone: 'orange' },
  paid: { label: '已兑付', tone: 'green' },
}

export const INSURANCE_STATUS: Record<string, { label: string; tone: string }> = {
  effective: { label: '保障生效', tone: 'green' },
  claiming: { label: '理赔中', tone: 'orange' },
  expired: { label: '已到期', tone: 'gray' },
  submitted: { label: '已报案', tone: 'blue' },
  surveying: { label: '查勘中', tone: 'orange' },
}

export function formatMoney(value: number): string {
  return value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}
