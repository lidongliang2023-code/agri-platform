const baseUrl = 'http://localhost:8080/api'

export function request<T = any>(options: {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: Record<string, any>
  params?: Record<string, any>
}): Promise<T> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: baseUrl + options.url,
      method: options.method || 'GET',
      data: options.data,
      params: options.params,
      header: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + uni.getStorageSync('token')
      },
      success: (res) => {
        const data = res.data as { code: number; data: T; message: string }
        if (data.code === 200) {
          resolve(data.data)
        } else {
          reject(new Error(data.message))
        }
      },
      fail: (err) => {
        reject(err)
      }
    })
  })
}