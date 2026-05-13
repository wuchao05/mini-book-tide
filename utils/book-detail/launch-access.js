const { disableMiniProgramShare } = require('../page')
const { STORAGE_KEYS } = require('../../constants')
const { getStorage } = require('../storage')

function resolveEffectiveMode(shellConfig) {
  const cachedMode = getStorage(STORAGE_KEYS.SHELL_MODE, '')
  const apiMode = (shellConfig && shellConfig.mode) || ''
  return apiMode || cachedMode
}

async function guardBShellLaunchAccess() {
  const app = getApp()

  if (!app) {
    wx.reLaunch({ url: '/pages/launcher/index' })
    return false
  }

  let shellConfig = app.getMiniAppShellConfig ? app.getMiniAppShellConfig() : null

  if (!shellConfig) {
    const result = app.fetchMiniAppShellConfigWithRetry
      ? await app.fetchMiniAppShellConfigWithRetry(1)
      : { success: false, data: null }

    shellConfig = result.data || null
  }

  if (resolveEffectiveMode(shellConfig) === 'B') {
    if (typeof app.setCurrentMode === 'function') {
      app.setCurrentMode('bshell')
    }
    return true
  }

  if (typeof app.setCurrentMode === 'function') {
    app.setCurrentMode('ashell')
  }
  return false
}

function resetNavigationBarTitle(page) {
  if (!page || !page.__shellNavigationBarTitle) {
    return
  }

  wx.setNavigationBarTitle({
    title: '',
  })
}

function scheduleNavigationBarTitleRestore(page) {
  if (!page || !page.__shellNavigationBarTitle) {
    return
  }

  clearTimeout(page.__shellNavigationBarTitleTimer)
  resetNavigationBarTitle(page)
  page.__shellNavigationBarTitleTimer = setTimeout(() => {
    wx.setNavigationBarTitle({
      title: page.__shellNavigationBarTitle,
    })
    page.__shellNavigationBarTitleTimer = null
  }, 1000)
}

function clearNavigationBarTitleRestore(page) {
  if (!page) {
    return
  }

  clearTimeout(page.__shellNavigationBarTitleTimer)
  page.__shellNavigationBarTitleTimer = null
}

function wrapGuardedHook(hook) {
  return async function guardedLifecycle(...args) {
    disableMiniProgramShare()

    if (!(await guardBShellLaunchAccess())) {
      if (this && typeof this.setData === 'function') {
        this.setData({
          __shellReady: false,
          __ashellFallback: true,
        })
      }
      return
    }

    if (this && typeof this.setData === 'function') {
      this.setData({
        __shellReady: true,
        __ashellFallback: false,
      })
    }

    if (typeof hook === 'function') {
      return hook.apply(this, args)
    }
  }
}

function createBShellPage(options) {
  const pageOptions = Object.assign({}, options)
  const originalOnShow = pageOptions.onShow
  const originalOnUnload = pageOptions.onUnload
  pageOptions.data = Object.assign(
    {
      __shellReady: false,
      __ashellFallback: false,
    },
    pageOptions.data || {},
  )

  pageOptions.__shellNavigationBarTitle = pageOptions.navigationBarTitleText || ''

  pageOptions.onLoad = wrapGuardedHook(pageOptions.onLoad)
  pageOptions.onShow = wrapGuardedHook(function wrappedOnShow(...args) {
    disableMiniProgramShare()
    scheduleNavigationBarTitleRestore(this)

    if (typeof originalOnShow === 'function') {
      return originalOnShow.apply(this, args)
    }
  })
  pageOptions.onUnload = function wrappedOnUnload(...args) {
    clearNavigationBarTitleRestore(this)

    if (typeof originalOnUnload === 'function') {
      return originalOnUnload.apply(this, args)
    }
  }

  Page(pageOptions)
}

module.exports = {
  guardBShellLaunchAccess,
  createBShellPage,
}
