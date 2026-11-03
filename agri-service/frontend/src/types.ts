export type PageKey =
  | 'home'
  | 'services'
  | 'provider'
  | 'orders'
  | 'order-detail'
  | 'demand'
  | 'insurance'
  | 'policies'
  | 'training'
  | 'consult'
  | 'ai-diagnose'
  | 'resources'
  | 'messages'
  | 'join'
  | 'contracts'
  | 'complaints'

export interface ServiceCategory {
  name: string
  icon: string
  key: string
  count: number
}

export interface ServiceItem {
  id: number
  name: string
  category: string
  price: number
  unit: string
  description: string
  duration: string
  selectedCount: number
}

export interface Review {
  orderNo: string
  serviceName: string
  rating: number
  review: string
  appointmentDate: string
}

export interface Provider {
  id: number
  name: string
  category: string
  categoryIcon: string
  rating: number
  orderCount: number
  distanceKm: number
  responseMinutes: number
  price: number
  unit: string
  badge: string
  tags: string[]
  description: string
  certifications: string[]
  region: string
  availableSlots: string[]
  status: string
  favorited?: boolean
  items?: ServiceItem[]
  reviews?: Review[]
}

export interface Todo {
  title: string
  content: string
  status: string
  progress: string
  link: string
}

export interface Expert {
  id: number
  name: string
  title: string
  category: string
  organization: string
  serviceScope: string
  rating: number
  consultCount: number
  summary: string
  avatarIcon: string
  status: string
}

export interface ServiceResource {
  id: number
  resourceType: string
  title: string
  location: string
  areaMu: number
  price: number
  unit: string
  description: string
  contactName: string
  contactPhone: string
  merchantId?: string
  merchantName?: string
  mine: boolean
  status: string
  createdAt: string
}

export interface Enrollment {
  id: number
  courseId: number
  merchantId: string
  progress: number
  noteText: string
  certNo?: string | null
  completedAt?: string | null
  createdAt: string
}

export interface Certificate {
  certNo: string
  title: string
  teacher: string
  duration: string
  mode: string
  completedAt: string
}

export interface ServiceIdentity {
  merchantId: string
  merchantName: string
  merchantError?: string
  providerId?: number | string | null
  providerName?: string | null
  providerError?: string
  userId?: string
  operatorName?: string
  operatorRole?: string
  roles: { consumer: boolean; provider: boolean; admin: boolean }
}

export interface Dictionaries {
  orderStatus: string[]
  orderStatusText: Record<string, string>
  policyStatus: string[]
  claimStatus: string[]
  demandStatus: string[]
  categories: string[]
}

export interface Overview {
  stats: {
    serviceProviders: number
    completedOrders: number
    myOrders: number
    satisfaction: number
    protectedAmount: number
    unreadMessages: number
  }
  categories: ServiceCategory[]
  featuredProviders: Provider[]
  policies: Policy[]
  todos: Todo[]
}

export interface OrderEvent {
  title: string
  note: string
  eventTime: string
  completed: boolean
}

export interface ServiceOrder {
  id: number
  orderNo: string
  providerId: number
  providerName: string
  serviceName: string
  category: string
  quantity: number
  unit: string
  unitPrice: number
  totalAmount: number
  depositAmount: number
  appointmentDate: string
  appointmentSlot: string
  location: string
  contactName: string
  contactPhone: string
  notes: string
  status: string
  progress: number
  rating?: number
  review?: string
  createdAt: string
  timeline?: OrderEvent[]
}

export interface Demand {
  id: number
  demandNo: string
  category: string
  serviceName: string
  description: string
  location: string
  area: string
  preferredDate: string
  budgetMin: number
  budgetMax: number
  contactName: string
  contactPhone: string
  status: string
  matchCount: number
  acceptedProviderName?: string | null
  mine: boolean
  createdAt: string
}

export interface Policy {
  id: number
  title: string
  level: string
  category: string
  amountText: string
  deadline: string
  matchScore: number
  conditions: string
  materials: string[]
  status: string
  publishedAt: string
}

export interface PolicyApplication {
  id: number
  applicationNo: string
  policyId: number
  policyTitle: string
  applicant: string
  contactPhone: string
  amountText: string
  status: string
  progress: number
  submittedAt: string
}

export interface InsuranceProduct {
  id: number
  name: string
  category: string
  premium: string
  coverage: string
  subsidy: string
  icon: string
  summary: string
  tags: string[]
  premiumRate: number
  coveragePerUnit: number
  unitMeasure: string
}

export interface InsurancePolicy {
  id: number
  policyNo: string
  productId: number
  productName: string
  insuredSubject: string
  insuredArea: string
  premium: number
  coverageAmount: number
  effectiveDate: string
  status: string
}

export interface InsuranceClaim {
  id: number
  claimNo: string
  policyId: number
  policyNo: string
  disasterType: string
  description: string
  lossArea: string
  status: string
  progress: number
  createdAt: string
}

export interface Course {
  id: number
  title: string
  teacher: string
  mode: string
  duration: string
  learners: number
  rating: number
  progress: number
  cover: string
  summary: string
  tags: string[]
  enrolled: boolean
  myProgress: number
  certNo?: string | null
  myNote: string
}

export interface Consultation {
  id: number
  consultNo: string
  type: string
  expertName: string
  subject: string
  content: string
  aiLevel: string
  suggestion: string
  status: string
  createdAt: string
}

export interface ServiceMessage {
  id: number
  type: string
  title: string
  content: string
  read: boolean
  createdAt: string
}

export interface Complaint {
  id: number
  complaintNo: string
  orderNo: string
  category: string
  description: string
  demand: string
  status: string
  progress: number
  handler?: string | null
  resolution?: string | null
  createdAt: string
}

export interface DiagnoseResult {
  consultNo: string
  level: string
  suggestion: string
  matchedDiseases: string[]
  expertAvailable: boolean
  expertCount: number
}
