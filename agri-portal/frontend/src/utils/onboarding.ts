export interface OnboardingProfile {
  identity: 'enterprise' | 'personal'
  companyName?: string
  creditCode?: string
  industry?: string
  companySize?: string
  address?: string
  realName?: string
  idCard?: string
  businessType?: string
  contactName?: string
  contactPhone?: string
  legalPerson?: string
  licenseNo?: string
  attachNote?: string
  validStart?: string
  validEnd?: string
  email?: string
}

export interface OnboardingResult {
  code?: number
  message?: string
  data?: {
    stage?: string
    identity?: string
    subjectName?: string
    certificationStatus?: string
    certificationNo?: string
  }
}

async function post(path: string, body?: unknown): Promise<OnboardingResult> {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  return await response.json() as OnboardingResult
}

export function saveSubject(profile: OnboardingProfile): Promise<OnboardingResult> {
  return post('/api/v1/sso/onboarding/subject', profile)
}

export function activateCertification(): Promise<OnboardingResult> {
  return post('/api/v1/sso/onboarding/certification', {})
}

export async function onboardingStatus(): Promise<OnboardingResult> {
  const response = await fetch('/api/v1/sso/onboarding/status', { credentials: 'include' })
  return await response.json() as OnboardingResult
}
