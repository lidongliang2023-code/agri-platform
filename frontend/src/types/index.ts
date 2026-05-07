export interface User {
  id: number
  username: string
  realName: string
  phone: string
  email: string
  status: number
  roleId: number
  roleName: string
  organizationId: number | null
  createdAt: string
  updatedAt: string
}

export interface LoginDTO {
  username: string
  password: string
}

export interface UserCreateDTO {
  username: string
  password: string
  realName?: string
  phone?: string
  email?: string
  status?: number
  roleId: number
  organizationId?: number
}

export interface Result<T> {
  code: number
  message: string
  data: T
}

export interface MenuItem {
  key: string
  label: string
  icon: React.ReactNode
  children?: MenuItem[]
}