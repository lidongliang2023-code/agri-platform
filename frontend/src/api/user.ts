import axios from './index'
import type { LoginDTO, User, UserCreateDTO, Result } from '@/types'

export const login = async (data: LoginDTO): Promise<Result<{ token: string }>> => {
  const response = await axios.post('/api/users/login', data)
  return response.data
}

export const getUserList = async (): Promise<Result<User[]>> => {
  const response = await axios.get('/api/users')
  return response.data
}

export const getUserById = async (id: number): Promise<Result<User>> => {
  const response = await axios.get(`/api/users/${id}`)
  return response.data
}

export const createUser = async (data: UserCreateDTO): Promise<Result<User>> => {
  const response = await axios.post('/api/users', data)
  return response.data
}

export const updateUser = async (id: number, data: UserCreateDTO): Promise<Result<User>> => {
  const response = await axios.put(`/api/users/${id}`, data)
  return response.data
}

export const deleteUser = async (id: number): Promise<Result<void>> => {
  const response = await axios.delete(`/api/users/${id}`)
  return response.data
}