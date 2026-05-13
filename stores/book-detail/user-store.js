const appStore = require('./app-store')

const listeners = new Set()

const state = {
  userInfo: null,
  loading: false,
  coin: 0,
}

function emitChange() {
  listeners.forEach((listener) => {
    try {
      listener(state)
    } catch (error) {
      console.error('user-store listener error', error)
    }
  })
}

function subscribe(listener) {
  listeners.add(listener)
  return function unsubscribe() {
    listeners.delete(listener)
  }
}

function isLoggedIn() {
  return !!appStore.state.token && !!state.userInfo
}

function updateCoin(coin) {
  state.coin = Number(coin || 0)
  emitChange()
}

async function userLogin(params) {
  state.loading = true
  emitChange()
  try {
    const CommonApi = require('../../services/book-detail/api/common')
    const response = await CommonApi.login(params)
    if (response.code === 0 && response.data && response.data.token) {
      appStore.setToken(response.data.token)
      state.userInfo = response.data
      updateCoin(response.data.coin)
      return true
    }
    return false
  } catch (error) {
    console.error('用户登录失败', error)
    return false
  } finally {
    state.loading = false
    emitChange()
  }
}

async function fetchUserInfo() {
  if (!appStore.state.token) {
    return false
  }
  state.loading = true
  emitChange()
  try {
    const CommonApi = require('../../services/book-detail/api/common')
    const response = await CommonApi.getUserInfo()
    if (response.code === 0 && response.data) {
      state.userInfo = response.data
      updateCoin(response.data.coin)
      return true
    }
    return false
  } catch (error) {
    console.error('获取用户信息失败', error)
    return false
  } finally {
    state.loading = false
    emitChange()
  }
}

module.exports = {
  state,
  subscribe,
  isLoggedIn,
  updateCoin,
  userLogin,
  fetchUserInfo,
}
