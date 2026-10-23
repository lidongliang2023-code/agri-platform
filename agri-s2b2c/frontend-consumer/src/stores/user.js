import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUserStore = defineStore('user', () => {
  const user = ref(null)
  const token = ref('')

  const login = (data) => {
    user.value = data
    token.value = 'mock_token_' + Date.now()
    localStorage.setItem('user', JSON.stringify(data))
    localStorage.setItem('token', token.value)
  }

  const logout = () => {
    user.value = null
    token.value = ''
    localStorage.removeItem('user')
    localStorage.removeItem('token')
  }

  const init = () => {
    const saved = localStorage.getItem('user')
    if (saved) {
      user.value = JSON.parse(saved)
      token.value = localStorage.getItem('token') || ''
    }
  }

  return { user, token, login, logout, init }
})