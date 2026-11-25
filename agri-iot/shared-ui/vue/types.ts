export type CommandReceipt = {
  commandNo: string | null
  status: string
  action: string
  operator: string
  result: string
  createdAt: string
  sentAt: string | null
  receiptAt: string | null
  expiresAt: string | null
  progress?: number
  installedVersion?: string | null
}

export interface MetricSamplingConfig {
  metricKey: string
  metricName: string
  enabled: boolean
  intervalSeconds: number | null
  toleranceSeconds: number
  effectiveIntervalSeconds: number | null
  effectiveToleranceSeconds: number
  maxGapSeconds: number | null
  effectiveAt?: string | null
}

export interface SamplingConfig {
  intervalSeconds: number | null
  toleranceSeconds: number
  effectiveAt?: string | null
  maxGapSeconds?: number | null
  metrics: MetricSamplingConfig[]
  fallbackDescription?: string
}
