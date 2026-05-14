const { disableMiniProgramShare } = require('../page')
const passcodeAuth = require('./passcode-auth')
const passcodeEntry = require('./passcode-entry')

const ASHELL_HOME = '/pages/home/index'

function openAShellHome() {
  const app = getApp()
  if (app && typeof app.clearBShellEntryAuthorization === 'function') {
    app.clearBShellEntryAuthorization()
  }
  passcodeAuth.clearPrompt()

  wx.switchTab({
    url: ASHELL_HOME,
    fail() {
      wx.reLaunch({
        url: ASHELL_HOME,
      })
    },
  })
}

function hasControlledBShellEntry() {
  const app = getApp()
  return !!(
    app &&
    typeof app.hasBShellEntryAuthorization === 'function' &&
    app.hasBShellEntryAuthorization()
  )
}

async function guardBShellLaunchAccess() {
  if (!hasControlledBShellEntry()) {
    openAShellHome()
    return false
  }

  const passcodeResult = await passcodeAuth.verifyStoredPasscode()
  if (passcodeResult && passcodeResult.success) {
    return true
  }

  if (passcodeResult && passcodeResult.reason === 'network') {
    wx.showToast({
      title: passcodeResult.message || '网络异常，请稍后重试',
      icon: 'none',
    })
  }

  passcodeEntry.openAShellWithPasscodePrompt(
    (passcodeResult && passcodeResult.message) || '请输入口令',
  )
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
        })
      }
      return
    }

    if (this && typeof this.setData === 'function') {
      this.setData({
        __shellReady: true,
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
