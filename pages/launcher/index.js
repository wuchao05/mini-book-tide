const ASHELL_HOME = '/pages/home/index'
const { createPage } = require('../../utils/page')
const passcodeAuth = require('../../utils/book-detail/passcode-auth')
const passcodeEntry = require('../../utils/book-detail/passcode-entry')

function openAShellEntry(app, options = {}) {
  if (app && typeof app.clearBShellEntryAuthorization === 'function') {
    app.clearBShellEntryAuthorization()
  }

  if (options.clearPrompt) {
    passcodeAuth.clearPrompt()
  }

  wx.switchTab({
    url: ASHELL_HOME,
    fail() {
      wx.reLaunch({
        url: ASHELL_HOME,
      })
    },
  })
}

function openAShellWithPrompt(app, message) {
  passcodeEntry.openAShellWithPasscodePrompt(message || '请输入口令')
}

async function requestBShellLayout(app) {
  if (!(app && typeof app.refreshBShellLayout === 'function')) {
    return {
      success: false,
      data: null,
    }
  }

  return app.refreshBShellLayout({
    force: true,
  })
}

createPage({
  async onLoad(options) {
    await this.redirectByMode(options)
  },

  async redirectByMode(options) {
    const app = getApp()

    const shellResult = app.fetchMiniAppShellConfigWithRetry
      ? await app.fetchMiniAppShellConfigWithRetry(1)
      : {
          success: false,
          data: null,
        }

    if (!(shellResult.success && shellResult.data)) {
      wx.showToast({
        title: '网络异常，请稍后重试',
        icon: 'none',
      })
      openAShellEntry(app)
      return
    }

    const shellConfig = shellResult.data || {}
    if (shellConfig.mode !== 'B') {
      openAShellEntry(app, {
        clearPrompt: true,
      })
      return
    }

    const [layoutResult, passcodeResult] = await Promise.all([
      requestBShellLayout(app),
      passcodeAuth.verifyStoredPasscode(),
    ])

    if (!(layoutResult && layoutResult.success)) {
      wx.showToast({
        title: '网络异常，请稍后重试',
        icon: 'none',
      })
      if (passcodeResult && passcodeResult.success) {
        openAShellEntry(app)
      } else {
        openAShellWithPrompt(app, (passcodeResult && passcodeResult.message) || '请输入口令')
      }
      return
    }

    if (!(passcodeResult && passcodeResult.success)) {
      if (passcodeResult && passcodeResult.reason === 'network') {
        wx.showToast({
          title: passcodeResult.message || '网络异常，请稍后重试',
          icon: 'none',
        })
      }
      openAShellWithPrompt(app, (passcodeResult && passcodeResult.message) || '请输入口令')
      return
    }

    passcodeAuth.clearPrompt()
    passcodeEntry.openBShellEntry(passcodeResult.auth)
  },
})
