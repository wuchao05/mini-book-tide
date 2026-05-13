const { STORAGE_KEYS } = require('../../constants')
const { getStorage, setStorage, removeStorage } = require('../storage')
const { getCurrentMiniAppProfile } = require('../runtime-miniapp')

const DEFAULT_BASE_URL = 'https://edge.penetad.com'

function getRequestContext() {
  const profile = getCurrentMiniAppProfile() || {}
  return {
    appIdentifier: profile.appIdentifier || '',
    baseUrl: profile.baseUrl || DEFAULT_BASE_URL,
  }
}

function normalizeExpiresAt(value) {
  if (value === undefined || value === null || value === '') {
    return 0
  }

  const numericValue = Number(value)
  if (Number.isFinite(numericValue) && numericValue > 0) {
    return numericValue
  }

  const parsedTime = new Date(value).getTime()
  return Number.isFinite(parsedTime) ? parsedTime : 0
}

function normalizeAuth(rawAuth) {
  if (!rawAuth || typeof rawAuth !== 'object') {
    return null
  }

  const passcode = String(rawAuth.passcode || '').trim()
  const expiresAt = normalizeExpiresAt(rawAuth.expiresAt)
  if (!passcode || !expiresAt) {
    return null
  }

  return {
    passcode,
    expiresAt,
    albumId: Number(rawAuth.albumId || 0) || 0,
    hasOpenedInitialAlbum: !!rawAuth.hasOpenedInitialAlbum,
  }
}

function readAuth() {
  return normalizeAuth(getStorage(STORAGE_KEYS.BSHELL_PASSCODE_AUTH, null))
}

function isAuthExpired(auth) {
  return !auth || !auth.expiresAt || auth.expiresAt <= Date.now()
}

function readValidAuth() {
  const auth = readAuth()
  if (!auth) {
    return null
  }

  if (isAuthExpired(auth)) {
    clearAuth()
    return null
  }

  return auth
}

function saveVerifiedAuth(inputPasscode, data) {
  const previousAuth = readAuth()
  const passcode = String((data && data.passcode) || inputPasscode || '').trim()
  const expiresAt = normalizeExpiresAt(data && data.expires_at)
  const albumId = Number((data && data.album_id) || 0) || 0

  if (!passcode || !expiresAt) {
    clearAuth()
    return null
  }

  const shouldKeepOpenedState =
    previousAuth &&
    previousAuth.passcode === passcode &&
    previousAuth.hasOpenedInitialAlbum &&
    !isAuthExpired(previousAuth)
  const nextAuth = {
    passcode,
    expiresAt,
    albumId,
    hasOpenedInitialAlbum: !!shouldKeepOpenedState,
  }

  setStorage(STORAGE_KEYS.BSHELL_PASSCODE_AUTH, nextAuth)
  return nextAuth
}

function markInitialAlbumOpened() {
  const auth = readAuth()
  if (!auth) {
    return null
  }

  const nextAuth = Object.assign({}, auth, {
    hasOpenedInitialAlbum: true,
  })
  setStorage(STORAGE_KEYS.BSHELL_PASSCODE_AUTH, nextAuth)
  return nextAuth
}

function clearAuth() {
  removeStorage(STORAGE_KEYS.BSHELL_PASSCODE_AUTH)
}

function requestPrompt(message) {
  const promptState = {
    visible: true,
    message: message || '',
    createdAt: Date.now(),
  }

  try {
    const app = getApp()
    if (app && app.globalData) {
      app.globalData.bShellPasscodePrompt = promptState
    }
  } catch (error) {
    void error
  }

  setStorage(STORAGE_KEYS.BSHELL_PASSCODE_PROMPT_PENDING, promptState)
}

function consumePrompt() {
  let promptState = null

  try {
    const app = getApp()
    if (app && app.globalData && app.globalData.bShellPasscodePrompt) {
      promptState = app.globalData.bShellPasscodePrompt
      app.globalData.bShellPasscodePrompt = null
    }
  } catch (error) {
    void error
  }

  if (!promptState) {
    promptState = getStorage(STORAGE_KEYS.BSHELL_PASSCODE_PROMPT_PENDING, null)
  }

  removeStorage(STORAGE_KEYS.BSHELL_PASSCODE_PROMPT_PENDING)
  return promptState && promptState.visible ? promptState : null
}

function clearPrompt() {
  try {
    const app = getApp()
    if (app && app.globalData) {
      app.globalData.bShellPasscodePrompt = null
    }
  } catch (error) {
    void error
  }

  removeStorage(STORAGE_KEYS.BSHELL_PASSCODE_PROMPT_PENDING)
}

function verifyPasscode(passcode) {
  const normalizedPasscode = String(passcode || '').trim()
  const context = getRequestContext()

  if (!normalizedPasscode) {
    return Promise.resolve({
      success: false,
      reason: 'empty',
      message: '请输入口令',
    })
  }

  if (!context.appIdentifier) {
    return Promise.resolve({
      success: false,
      reason: 'missing_app',
      message: '小程序配置缺失，请稍后重试',
    })
  }

  return new Promise((resolve) => {
    wx.request({
      url: `${context.baseUrl}/miniapp/passcode/verify`,
      method: 'POST',
      timeout: 10000,
      data: {
        app: context.appIdentifier,
        passcode: normalizedPasscode,
      },
      header: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      success(response) {
        const result = response && response.data ? response.data : {}
        const data = result.data || {}

        if (result.code === 0 && data.valid === true) {
          const auth = saveVerifiedAuth(normalizedPasscode, data)
          if (auth) {
            resolve({
              success: true,
              auth,
              message: '',
            })
            return
          }
        }

        clearAuth()
        resolve({
          success: false,
          reason: 'invalid',
          message: result.message || '口令无效，请重新输入',
        })
      },
      fail(error) {
        console.warn('校验 B 壳口令失败', error)
        resolve({
          success: false,
          reason: 'network',
          message: '网络异常，请稍后重试',
        })
      },
    })
  })
}

async function verifyStoredPasscode() {
  const auth = readValidAuth()

  if (!auth) {
    return {
      success: false,
      reason: 'missing',
      message: '请输入口令',
    }
  }

  const result = await verifyPasscode(auth.passcode)
  if (!result.success) {
    return result
  }

  return result
}

module.exports = {
  readAuth,
  readValidAuth,
  saveVerifiedAuth,
  markInitialAlbumOpened,
  clearAuth,
  requestPrompt,
  consumePrompt,
  clearPrompt,
  verifyPasscode,
  verifyStoredPasscode,
}
