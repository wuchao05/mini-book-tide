const userStore = require('../../stores/book-detail/user-store')

function checkLoginStatus() {
  return userStore.isLoggedIn()
}

async function ensureLogin(successCallback, failCallback) {
  if (userStore.isLoggedIn()) {
    if (typeof successCallback === 'function') {
      successCallback()
    }
    return true
  }
  const success = await unifiedLogin()
  if (success) {
    if (typeof successCallback === 'function') {
      successCallback()
    }
  } else if (typeof failCallback === 'function') {
    failCallback()
  }
  return success
}

function unifiedLogin() {
  return new Promise((resolve) => {
    wx.login({
      success: async (result) => {
        const success = await handleLoginResponse(result.code)
        resolve(success)
      },
      fail(error) {
        console.error('wx.login 失败', error)
        resolve(false)
      },
    })
  })
}

async function handleLoginResponse(code) {
  try {
    return await userStore.userLogin({ code })
  } catch (error) {
    console.error('登录响应处理失败', error)
    return false
  }
}

function doLogin(successCallback, failCallback) {
  return unifiedLogin().then((success) => {
    if (success) {
      if (typeof successCallback === 'function') {
        successCallback()
      }
      return true
    }
    if (typeof failCallback === 'function') {
      failCallback()
    }
    return false
  })
}

module.exports = {
  checkLoginStatus,
  ensureLogin,
  doLogin,
}
