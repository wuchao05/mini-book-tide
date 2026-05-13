const env = require('../../config/book-detail/env')
const appStore = require('../../stores/book-detail/app-store')
const auth = require('../../utils/book-detail/auth')

function appendParamsToUrl(url, params) {
  const query = Object.keys(params || {})
    .filter((key) => params[key] !== '' && params[key] !== undefined && params[key] !== null)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&')
  if (!query) {
    return url
  }
  return `${url}${url.indexOf('?') === -1 ? '?' : '&'}${query}`
}

function request(options) {
  const method = (options.method || 'GET').toUpperCase()
  const requestData = Object.assign({}, options.data || {}, {
    app: appStore.state.appIdentifier,
  })
  let url = options.url.indexOf('http') === 0 ? options.url : `${env.baseUrl}${options.url}`
  if (method === 'GET') {
    url = appendParamsToUrl(url, requestData)
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method,
      timeout: options.timeout || 30000,
      data: method === 'GET' ? {} : requestData,
      header: options.header || {
        'content-type': 'application/x-www-form-urlencoded',
        token: appStore.state.token || '',
      },
      success(res) {
        const response = res.data || {}
        if (response.code === 0) {
          resolve(response)
          return
        }
        if (response.code === -100) {
          appStore.clearToken()
          auth.ensureLogin()
          resolve(response)
          return
        }
        if (!options.noErrorToast) {
          wx.showToast({
            icon: 'none',
            title: response.message || '未知错误',
          })
        }
        resolve(response)
      },
      fail(error) {
        if (!options.noErrorToast) {
          wx.showToast({
            icon: 'none',
            title: error.errMsg || '网络请求失败',
          })
        }
        reject(error)
      },
    })
  })
}

module.exports = request
